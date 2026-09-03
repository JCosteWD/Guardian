const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

const PLAN_PRICES = {
  family: process.env.STRIPE_PRICE_FAMILY,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

exports.createCheckoutSession = async (req, res) => {
  const { plan } = req.body;
  if (!PLAN_PRICES[plan]) return res.status(400).json({ error: 'Plan invalide' });

  try {
    const parentResult = await query(
      'SELECT email, first_name, last_name FROM parents WHERE id = $1',
      [req.user.id]
    );
    const parent = parentResult.rows[0];

    let customerId;
    const subResult = await query(
      'SELECT stripe_customer_id FROM subscriptions WHERE parent_id = $1',
      [req.user.id]
    );

    if (subResult.rows[0]?.stripe_customer_id) {
      customerId = subResult.rows[0].stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: parent.email,
        name: `${parent.first_name} ${parent.last_name}`,
        metadata: { parentId: req.user.id },
      });
      customerId = customer.id;
      await query(
        'UPDATE subscriptions SET stripe_customer_id = $1 WHERE parent_id = $2',
        [customerId, req.user.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: PLAN_PRICES[plan], quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 14 },
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: { parentId: req.user.id, plan },
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    logger.error('createCheckoutSession error:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la session de paiement' });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const subResult = await query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE parent_id = $1',
      [req.user.id]
    );
    const stripeSub = subResult.rows[0]?.stripe_subscription_id;
    if (!stripeSub) return res.status(400).json({ error: 'Aucun abonnement actif' });

    await stripe.subscriptions.update(stripeSub, { cancel_at_period_end: true });
    await query(
      'UPDATE subscriptions SET cancel_at_period_end = true WHERE parent_id = $1',
      [req.user.id]
    );

    res.json({ message: 'Abonnement annulé à la fin de la période en cours' });
  } catch (err) {
    logger.error('cancelSubscription error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'annulation' });
  }
};
