const { query } = require('../../config/database');
const { quota } = require('../../config/redis');
const notificationService = require('../../services/notificationService');
const logger = require('../../utils/logger');

exports.logActivity = async (req, res) => {
  const { eventType, payload, appPackage, url, durationSecs } = req.body;
  const childId = req.child.id;

  try {
    await query(
      `INSERT INTO activity_events (child_id, event_type, payload, app_package, url, duration_secs)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [childId, eventType, JSON.stringify(payload || {}), appPackage, url, durationSecs]
    );

    // Incrémente le temps utilisé si c'est une ouverture d'app
    if (eventType === 'app_opened' && durationSecs) {
      const mins = Math.ceil(durationSecs / 60);
      const usedMins = await quota.increment(childId, mins);

      // Alerte le parent si proche de la limite
      const remaining = await quota.getRemainingMins(childId);
      if (remaining <= 10 && remaining > 0) {
        const io = req.app.get('io');
        const childResult = await query('SELECT first_name, parent_id FROM children WHERE id = $1', [childId]);
        if (childResult.rows[0]) {
          io.to(`parent:${childResult.rows[0].parent_id}`).emit('quota_warning', {
            childId,
            childName: childResult.rows[0].first_name,
            remainingMins: remaining,
          });
        }
      }
    }

    // Détecte les tentatives de contournement
    if (eventType === 'tamper_attempt') {
      const child = await query(
        'SELECT first_name, parent_id FROM children WHERE id = $1', [childId]
      );
      if (child.rows[0]) {
        await notificationService.sendToParent(child.rows[0].parent_id, {
          title: '⚠️ Alerte de sécurité',
          body: `${child.rows[0].first_name} a tenté de contourner les restrictions.`,
          priority: 'high',
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('logActivity error:', err);
    res.status(500).json({ error: 'Erreur d\'enregistrement' });
  }
};
