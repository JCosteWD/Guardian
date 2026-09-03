const { query } = require('../config/database');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

// Table SQL (ajouter à migrateV3.js):
// CREATE TABLE IF NOT EXISTS notifications (
//   id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   parent_id  UUID REFERENCES parents(id) ON DELETE CASCADE,
//   child_id   UUID REFERENCES children(id) ON DELETE SET NULL,
//   type       VARCHAR(50) NOT NULL,
//   title      TEXT NOT NULL,
//   body       TEXT,
//   data       JSONB DEFAULT '{}',
//   priority   INTEGER DEFAULT 1,
//   read_at    TIMESTAMPTZ,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX IF NOT EXISTS idx_notifs_parent ON notifications(parent_id, created_at DESC);

// ── GET NOTIFICATIONS ─────────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  const { limit = 50, offset = 0, unreadOnly } = req.query;
  try {
    const whereExtra = unreadOnly === 'true' ? 'AND n.read_at IS NULL' : '';
    const result = await query(
      `SELECT n.*, c.first_name AS child_name
       FROM notifications n
       LEFT JOIN children c ON c.id = n.child_id
       WHERE n.parent_id = $1 ${whereExtra}
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    const unreadCount = await query(
      'SELECT COUNT(*) FROM notifications WHERE parent_id = $1 AND read_at IS NULL',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unread: parseInt(unreadCount.rows[0].count),
      total: result.rows.length,
    });
  } catch (err) {
    logger.error('getNotifications error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
  }
};

// ── MARK AS READ ──────────────────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  const { notifId } = req.params;
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND parent_id = $2',
      [notifId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ── MARK ALL READ ─────────────────────────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE parent_id = $1 AND read_at IS NULL',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ── DELETE NOTIFICATION ───────────────────────────────────────────────────────
exports.deleteNotification = async (req, res) => {
  const { notifId } = req.params;
  try {
    await query(
      'DELETE FROM notifications WHERE id = $1 AND parent_id = $2',
      [notifId, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ── CLEAR ALL ─────────────────────────────────────────────────────────────────
exports.clearAll = async (req, res) => {
  try {
    await query(
      'DELETE FROM notifications WHERE parent_id = $1 AND read_at IS NOT NULL',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ── CREATE NOTIFICATION (utilisé par les autres services) ─────────────────────
exports.createNotification = async (parentId, childId, type, title, body, data = {}, priority = 1) => {
  try {
    await query(
      `INSERT INTO notifications (parent_id, child_id, type, title, body, data, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [parentId, childId, type, title, body, JSON.stringify(data), priority]
    );
  } catch (err) {
    logger.error('createNotification error:', err);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// SUPPORT CONTROLLER
// ══════════════════════════════════════════════════════════════════════════════

// Table SQL:
// CREATE TABLE IF NOT EXISTS support_tickets (
//   id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
//   parent_id  UUID REFERENCES parents(id) ON DELETE CASCADE,
//   category   VARCHAR(30) NOT NULL,
//   subject    TEXT NOT NULL,
//   message    TEXT NOT NULL,
//   status     VARCHAR(20) DEFAULT 'open',
//   reply      TEXT,
//   replied_at TIMESTAMPTZ,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );

exports.createTicket = async (req, res) => {
  const { category, subject, message, email, plan } = req.body;
  if (!category || !subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Catégorie, sujet et message requis' });
  }
  try {
    const result = await query(
      `INSERT INTO support_tickets (parent_id, category, subject, message)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [req.user.id, category, subject.trim(), message.trim()]
    );
    const ticketId = result.rows[0].id;

    // Envoie un email au support (Sendgrid ou similaire)
    // En production: await sendEmail({ to: 'support@guardian-app.com', ... })

    logger.info(`Support ticket created: ${ticketId} (${category}) by parent ${req.user.id}`);
    res.json({ ticketId, message: 'Ticket créé. Nous vous répondrons sous 24h.' });
  } catch (err) {
    logger.error('createTicket error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du ticket' });
  }
};

exports.getTickets = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, category, subject, status, reply, replied_at, created_at FROM support_tickets WHERE parent_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ tickets: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ACTIVITY STREAM – Timeline enrichie des événements
// ══════════════════════════════════════════════════════════════════════════════
exports.getActivityStream = async (req, res) => {
  const { childId } = req.params;
  const { days = 7, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  try {
    const result = await query(
      `SELECT
         ae.event_type, ae.app_package, ae.url, ae.payload,
         ae.duration_secs, ae.created_at,
         ar.app_name, ar.is_blocked AS app_blocked
       FROM activity_events ae
       LEFT JOIN app_rules ar ON ar.child_id = ae.child_id AND ar.package_name = ae.app_package
       WHERE ae.child_id = $1
         AND ae.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
       ORDER BY ae.created_at DESC
       LIMIT $2 OFFSET $3`,
      [childId, parseInt(limit), offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM activity_events
       WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'`,
      [childId]
    );

    // Agrège par heure pour la timeline
    const timeline = await query(
      `SELECT
         DATE_TRUNC('hour', created_at) AS hour,
         COUNT(*) AS events,
         SUM(CASE WHEN event_type = 'app_opened' THEN duration_secs ELSE 0 END) / 60 AS screen_mins
       FROM activity_events
       WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
       GROUP BY 1 ORDER BY 1`,
      [childId]
    );

    res.json({
      events:   result.rows,
      total:    parseInt(countResult.rows[0].count),
      page:     parseInt(page),
      pages:    Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
      timeline: timeline.rows,
    });
  } catch (err) {
    logger.error('getActivityStream error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'activité' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// ROUTES FINALES CONSOLIDÉES (routesFinal.js)
// ══════════════════════════════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const { requireParent } = require('../middleware/auth');
const notifCtrl = exports;

// Notifications
router.get('/notifications',           requireParent, notifCtrl.getNotifications);
router.post('/notifications/read-all', requireParent, notifCtrl.markAllRead);
router.post('/notifications/:notifId/read', requireParent, notifCtrl.markAsRead);
router.delete('/notifications/:notifId',    requireParent, notifCtrl.deleteNotification);
router.delete('/notifications',        requireParent, notifCtrl.clearAll);

// Support
router.get('/support/tickets',  requireParent, notifCtrl.getTickets);
router.post('/support/ticket',  requireParent, notifCtrl.createTicket);

// Activity stream enrichi
router.get('/children/:childId/activity-stream', requireParent, notifCtrl.getActivityStream);

module.exports = router;
