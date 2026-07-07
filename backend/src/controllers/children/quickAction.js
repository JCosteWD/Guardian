const { query } = require('../../config/database');
const { quota, blockCache } = require('../../config/redis');
const notificationService = require('../../services/notificationService');
const logger = require('../../utils/logger');

exports.quickAction = async (req, res) => {
  const { childId } = req.params;
  const { presetId, customDelta, customLock, lockReason, message } = req.body;

  try {
    let deltaMinutes = customDelta || 0;
    let shouldLock = customLock || false;
    let reason = lockReason || '';

    // Charge le preset si fourni
    if (presetId) {
      const preset = await query(
        'SELECT * FROM quick_presets WHERE id = $1 AND parent_id = $2',
        [presetId, req.user.id]
      );
      if (preset.rows[0]) {
        const p = preset.rows[0];
        deltaMinutes = p.time_delta_mins;
        shouldLock = p.block_all_except_school;
        reason = p.custom_message || reason;
      }
    }

    // Applique l'action sur le quota Redis
    if (deltaMinutes < 0) {
      await quota.addPenalty(childId, Math.abs(deltaMinutes));
    } else if (deltaMinutes > 0) {
      await quota.addBonus(childId, deltaMinutes);
    }

    if (shouldLock) {
      await quota.lock(childId, reason);
    }

    // Persiste en DB
    await query(
      `UPDATE daily_quotas SET
         penalty_mins = penalty_mins + $1,
         bonus_mins = bonus_mins + $2,
         is_locked = CASE WHEN $3 THEN true ELSE is_locked END,
         lock_reason = CASE WHEN $3 THEN $4 ELSE lock_reason END
       WHERE child_id = $5 AND quota_date = CURRENT_DATE`,
      [
        deltaMinutes < 0 ? Math.abs(deltaMinutes) : 0,
        deltaMinutes > 0 ? deltaMinutes : 0,
        shouldLock,
        reason,
        childId,
      ]
    );

    // Invalide le cache des restrictions
    await blockCache.invalidateChild(childId);

    // Notifie l'appareil enfant en temps réel (WebSocket)
    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('quota_updated', {
      type: deltaMinutes < 0 ? 'penalty' : 'bonus',
      deltaMinutes,
      isLocked: shouldLock,
      message: message || reason,
    });

    // Notifie le parent par push de la confirmation
    await notificationService.sendToParent(req.user.id, {
      title: '✅ Modification appliquée',
      body: `Les restrictions ont été mises à jour pour ${req.body.childName || 'votre enfant'}.`,
    });

    res.json({ success: true, deltaMinutes, isLocked: shouldLock });
  } catch (err) {
    logger.error('quickAction error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'application de l\'action' });
  }
};
