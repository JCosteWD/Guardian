const webpush = require('web-push');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Web Push Notifications (VAPID)
// ══════════════════════════════════════════════════════════════════════════════
// Permet d'envoyer des notifications push au dashboard web PWA, même fenêtre fermée.
// Complémentaire à Firebase FCM (mobile) — VAPID est le standard navigateur natif.
//
// Installation:
//   npm install web-push
//
// Génération des clés VAPID (une seule fois):
//   npx web-push generate-vapid-keys
//   → Stocker VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans .env
//
// Table SQL (ajouter à migrateV6.js ou une nouvelle migration):
// CREATE TABLE IF NOT EXISTS web_push_subscriptions (
//   id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   parent_id   UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
//   endpoint    TEXT NOT NULL UNIQUE,
//   p256dh_key  TEXT NOT NULL,
//   auth_key    TEXT NOT NULL,
//   user_agent  TEXT,
//   created_at  TIMESTAMPTZ DEFAULT NOW(),
//   last_used   TIMESTAMPTZ DEFAULT NOW()
// );

// ── CONFIGURATION VAPID ───────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:contact@guardian-app.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  logger.warn('⚠️ VAPID keys not configured — web push disabled');
}

// ── GET PUBLIC KEY (pour le frontend) ─────────────────────────────────────────
exports.getPublicKey = (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Web push non configuré' });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
};

// ── SUBSCRIBE ──────────────────────────────────────────────────────────────────
exports.subscribe = async (req, res) => {
  const { subscription, userAgent } = req.body;

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Subscription invalide' });
  }

  try {
    await query(
      `INSERT INTO web_push_subscriptions (parent_id, endpoint, p256dh_key, auth_key, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET
         parent_id = $1, p256dh_key = $3, auth_key = $4, last_used = NOW()`,
      [req.user.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, userAgent || '']
    );

    logger.info(`Web push subscription saved for parent ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error('subscribe error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement' });
  }
};

// ── UNSUBSCRIBE ────────────────────────────────────────────────────────────────
exports.unsubscribe = async (req, res) => {
  const { endpoint } = req.body;
  try {
    await query('DELETE FROM web_push_subscriptions WHERE endpoint = $1 AND parent_id = $2', [endpoint, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ── SEND PUSH (utilisé en interne par d'autres services) ──────────────────────
exports.sendWebPush = async (parentId, { title, body, data = {}, icon, badge }) => {
  if (!VAPID_PUBLIC_KEY) return { sent: 0 };

  try {
    const subs = await query(
      'SELECT endpoint, p256dh_key, auth_key FROM web_push_subscriptions WHERE parent_id = $1',
      [parentId]
    );

    if (subs.rows.length === 0) return { sent: 0 };

    const payload = JSON.stringify({
      notification: {
        title, body,
        icon:  icon  || '/icons/icon-192.png',
        badge: badge || '/icons/icon-72.png',
        data,
      },
    });

    const results = await Promise.allSettled(
      subs.rows.map(sub =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
          },
          payload
        )
      )
    );

    // Nettoie les subscriptions invalides (410 Gone = désabonné)
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected' && results[i].reason?.statusCode === 410) {
        await query('DELETE FROM web_push_subscriptions WHERE endpoint = $1', [subs.rows[i].endpoint]);
        logger.debug(`Removed expired push subscription: ${subs.rows[i].endpoint.substring(0, 50)}...`);
      }
    }

    const sent = results.filter(r => r.status === 'fulfilled').length;
    logger.debug(`Web push sent: ${sent}/${subs.rows.length} for parent ${parentId}`);
    return { sent, total: subs.rows.length };

  } catch (err) {
    logger.error('sendWebPush error:', err);
    return { sent: 0, error: err.message };
  }
};

// ── TEST PUSH (endpoint de debug) ──────────────────────────────────────────────
exports.testPush = async (req, res) => {
  const result = await exports.sendWebPush(req.user.id, {
    title: '🛡️ Guardian',
    body:  'Notification de test — tout fonctionne !',
    data:  { type: 'test' },
  });
  res.json(result);
};
