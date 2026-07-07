const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Stripe avancé : parrainage, codes promo, facturation
// ══════════════════════════════════════════════════════════════════════════════
//
// Table SQL (ajouter à migrateV3.js) :
// CREATE TABLE IF NOT EXISTS referrals (
//   id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   referrer_id     UUID REFERENCES parents(id) ON DELETE CASCADE,
//   referee_id      UUID REFERENCES parents(id) ON DELETE SET NULL,
//   code            TEXT UNIQUE NOT NULL,
//   status          VARCHAR(20) DEFAULT 'pending', -- pending|converted|rewarded
//   referee_email   TEXT,
//   reward_given_at TIMESTAMPTZ,
//   created_at      TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE TABLE IF NOT EXISTS promo_codes (
//   id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   code            TEXT UNIQUE NOT NULL,
//   stripe_coupon   TEXT NOT NULL,
//   discount_pct    INTEGER,
//   discount_months INTEGER DEFAULT 1,
//   max_uses        INTEGER DEFAULT 100,
//   uses_count      INTEGER DEFAULT 0,
//   valid_until     TIMESTAMPTZ,
//   is_active       BOOLEAN DEFAULT TRUE,
//   created_at      TIMESTAMPTZ DEFAULT NOW()
// );

// ── GENERATE REFERRAL CODE ────────────────────────────────────────────────────
exports.generateReferralCode = async (req, res) => {
  const parentId = req.user.id;
  try {
    // Vérifie si un code existe déjà
    const existing = await query(
      'SELECT code FROM referrals WHERE referrer_id = $1 AND referee_id IS NULL LIMIT 1',
      [parentId]
    );
    if (existing.rows[0]) {
      return res.json({ code: existing.rows[0].code, link: `https://guardian-app.com/join?ref=${existing.rows[0].code}` });
    }

    // Génère un code unique lisible (ex: MARIE-7X4K)
    const parent = await query('SELECT first_name FROM parents WHERE id = $1', [parentId]);
    const firstName = (parent.rows[0]?.first_name || 'USER').toUpperCase().substring(0, 5).replace(/[^A-Z]/g, '');
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `${firstName}-${suffix}`;

    await query(
      'INSERT INTO referrals (referrer_id, code) VALUES ($1, $2)',
      [parentId, code]
    );

    res.json({ code, link: `https://guardian-app.com/join?ref=${code}` });
  } catch (err) {
    logger.error('generateReferralCode error:', err);
    res.status(500).json({ error: 'Erreur génération code parrainage' });
  }
};

// ── GET REFERRAL STATS ────────────────────────────────────────────────────────
exports.getReferralStats = async (req, res) => {
  const parentId = req.user.id;
  try {
    const result = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')   AS pending_count,
         COUNT(*) FILTER (WHERE status = 'converted') AS converted_count,
         COUNT(*) FILTER (WHERE status = 'rewarded')  AS rewarded_count,
         STRING_AGG(DISTINCT code, ', ') AS codes
       FROM referrals WHERE referrer_id = $1`,
      [parentId]
    );

    const referees = await query(
      `SELECT referee_email, status, created_at
       FROM referrals WHERE referrer_id = $1 AND referee_id IS NOT NULL
       ORDER BY created_at DESC`,
      [parentId]
    );

    res.json({
      stats: result.rows[0],
      referees: referees.rows,
      rewardPerConversion: '1 mois Premium offert',
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur stats parrainage' });
  }
};

// ── APPLY REFERRAL (lors de l'inscription du filleul) ────────────────────────
exports.applyReferral = async (req, res) => {
  const { code, refereeId } = req.body;
  if (!code) return res.status(400).json({ error: 'Code requis' });

  try {
    const referral = await query(
      'SELECT * FROM referrals WHERE code = $1 AND referee_id IS NULL',
      [code.toUpperCase().trim()]
    );

    if (!referral.rows[0]) {
      return res.status(404).json({ error: 'Code de parrainage invalide ou déjà utilisé' });
    }

    const ref = referral.rows[0];

    // Vérifie que le filleul ne se parraine pas lui-même
    if (ref.referrer_id === refereeId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas utiliser votre propre code' });
    }

    // Marque le parrainage comme utilisé
    await query(
      `UPDATE referrals SET referee_id = $1, status = 'converted', referee_email = (SELECT email FROM parents WHERE id = $1)
       WHERE id = $2`,
      [refereeId, ref.id]
    );

    // Applique 1 mois gratuit au filleul via Stripe coupon
    const sub = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [refereeId]);
    if (sub.rows[0]?.stripe_customer_id) {
      try {
        // Crée un coupon 1 mois gratuit
        const coupon = await stripe.coupons.create({
          duration: 'once',
          percent_off: 100,
          metadata: { type: 'referral_new_user', code },
        });
        await stripe.customers.update(sub.rows[0].stripe_customer_id, {
          coupon: coupon.id,
        });
      } catch (stripeErr) {
        logger.warn('Stripe coupon application failed:', stripeErr.message);
      }
    }

    // Notifie le parrain
    await notificationService.sendToParent(ref.referrer_id, {
      title: '🎉 Nouveau filleul !',
      body: 'Quelqu\'un a utilisé votre code de parrainage. Vous recevrez votre récompense dès qu\'il souscrit à un plan payant.',
    });

    res.json({ success: true, message: '✅ Code de parrainage appliqué ! 1 mois offert.' });
  } catch (err) {
    logger.error('applyReferral error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'application du parrainage' });
  }
};

// ── REWARD REFERRER (déclenché par webhook Stripe checkout.session.completed) ─
exports.rewardReferrer = async (parentId) => {
  try {
    // Vérifie s'il y a un parrainage converti non récompensé
    const referral = await query(
      `SELECT r.*, p.email as referee_email
       FROM referrals r
       JOIN parents p ON p.id = r.referee_id
       WHERE r.referee_id = $1 AND r.status = 'converted' AND r.reward_given_at IS NULL`,
      [parentId]
    );

    if (!referral.rows[0]) return;

    const ref = referral.rows[0];

    // Donne 1 mois gratuit au parrain
    const referrerSub = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [ref.referrer_id]);
    if (referrerSub.rows[0]?.stripe_customer_id) {
      const coupon = await stripe.coupons.create({
        duration: 'once',
        percent_off: 100,
        metadata: { type: 'referral_reward', referee: ref.referee_email },
      });
      await stripe.customers.update(referrerSub.rows[0].stripe_customer_id, { coupon: coupon.id });
    }

    await query(
      `UPDATE referrals SET status = 'rewarded', reward_given_at = NOW() WHERE id = $1`,
      [ref.id]
    );

    await notificationService.sendToParent(ref.referrer_id, {
      title: '🏆 Récompense de parrainage !',
      body: `Votre filleul a souscrit à Guardian. Vous recevrez 1 mois offert sur votre prochaine facture !`,
    });

    logger.info(`Referral reward given to ${ref.referrer_id}`);
  } catch (err) {
    logger.error('rewardReferrer error:', err);
  }
};

// ── VALIDATE PROMO CODE ───────────────────────────────────────────────────────
exports.validatePromoCode = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code requis' });

  try {
    const promo = await query(
      `SELECT * FROM promo_codes
       WHERE UPPER(code) = $1
         AND is_active = true
         AND uses_count < max_uses
         AND (valid_until IS NULL OR valid_until > NOW())`,
      [code.toUpperCase().trim()]
    );

    if (!promo.rows[0]) {
      return res.status(404).json({ error: 'Code promo invalide ou expiré' });
    }

    const p = promo.rows[0];
    res.json({
      valid: true,
      code: p.code,
      discountPct: p.discount_pct,
      discountMonths: p.discount_months,
      description: `${p.discount_pct}% de réduction pendant ${p.discount_months} mois`,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur validation code promo' });
  }
};

// ── CREATE CHECKOUT WITH PROMO ────────────────────────────────────────────────
exports.createCheckoutWithPromo = async (req, res) => {
  const { plan, promoCode } = req.body;
  const parentId = req.user.id;

  try {
    const parentResult = await query('SELECT email FROM parents WHERE id = $1', [parentId]);
    const subResult    = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [parentId]);

    let customerId = subResult.rows[0]?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: parentResult.rows[0]?.email,
        metadata: { parentId },
      });
      customerId = customer.id;
      await query('UPDATE subscriptions SET stripe_customer_id = $1 WHERE parent_id = $2', [customerId, parentId]);
    }

    const PRICES = {
      family:  process.env.STRIPE_PRICE_FAMILY,
      premium: process.env.STRIPE_PRICE_PREMIUM,
    };

    const sessionParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PRICES[plan], quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 14 },
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: { parentId, plan },
      allow_promotion_codes: true,
    };

    // Applique le code promo si fourni
    if (promoCode) {
      const promo = await query(
        'SELECT stripe_coupon FROM promo_codes WHERE UPPER(code) = $1 AND is_active = true',
        [promoCode.toUpperCase().trim()]
      );
      if (promo.rows[0]) {
        sessionParams.discounts = [{ coupon: promo.rows[0].stripe_coupon }];
        // Incrémente le compteur d'utilisations
        await query('UPDATE promo_codes SET uses_count = uses_count + 1 WHERE UPPER(code) = $1', [promoCode.toUpperCase().trim()]);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    logger.error('createCheckoutWithPromo error:', err);
    res.status(500).json({ error: 'Erreur création session paiement' });
  }
};

// ── GET INVOICE HISTORY ───────────────────────────────────────────────────────
exports.getInvoices = async (req, res) => {
  const parentId = req.user.id;
  try {
    const sub = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [parentId]);
    const customerId = sub.rows[0]?.stripe_customer_id;

    if (!customerId) return res.json({ invoices: [] });

    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
    });

    res.json({
      invoices: invoices.data.map(inv => ({
        id:         inv.id,
        number:     inv.number,
        amount:     (inv.amount_paid / 100).toFixed(2),
        currency:   inv.currency.toUpperCase(),
        status:     inv.status,
        date:       new Date(inv.created * 1000).toISOString(),
        pdfUrl:     inv.invoice_pdf,
        hostedUrl:  inv.hosted_invoice_url,
        period: {
          start: new Date(inv.period_start * 1000).toISOString(),
          end:   new Date(inv.period_end   * 1000).toISOString(),
        },
      })),
    });
  } catch (err) {
    logger.error('getInvoices error:', err);
    res.status(500).json({ error: 'Erreur récupération factures' });
  }
};

// ── UPDATE BILLING INFO ───────────────────────────────────────────────────────
exports.updateBillingInfo = async (req, res) => {
  const parentId = req.user.id;
  const { name, address } = req.body;

  try {
    const sub = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [parentId]);
    const customerId = sub.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ error: 'Client Stripe introuvable' });

    await stripe.customers.update(customerId, {
      name,
      address: {
        line1:       address?.line1,
        city:        address?.city,
        postal_code: address?.postalCode,
        country:     address?.country || 'FR',
      },
    });

    res.json({ message: 'Informations de facturation mises à jour' });
  } catch (err) {
    logger.error('updateBillingInfo error:', err);
    res.status(500).json({ error: 'Erreur mise à jour facturation' });
  }
};

// ── CREATE BILLING PORTAL ─────────────────────────────────────────────────────
exports.createBillingPortal = async (req, res) => {
  const parentId = req.user.id;
  try {
    const sub = await query('SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1', [parentId]);
    const customerId = sub.rows[0]?.stripe_customer_id;
    if (!customerId) return res.status(404).json({ error: 'Client Stripe introuvable' });

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error('createBillingPortal error:', err);
    res.status(500).json({ error: 'Erreur portail de facturation' });
  }
};
