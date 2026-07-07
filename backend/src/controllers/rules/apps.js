const { query } = require('../../config/database');
const { blockCache } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.getAppRules = async (req, res) => {
  const { childId } = req.params;
  try {
    const result = await query(
      'SELECT * FROM app_rules WHERE child_id = $1 ORDER BY app_name',
      [childId]
    );
    res.json({ apps: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des règles d\'apps' });
  }
};

exports.setAppRule = async (req, res) => {
  const { childId } = req.params;
  const { packageName, appName, appIconUrl, isBlocked, dailyLimitMins, allowedTimeStart, allowedTimeEnd, blockedReason } = req.body;

  try {
    const result = await query(
      `INSERT INTO app_rules
         (child_id, package_name, app_name, app_icon_url, is_blocked, daily_limit_mins,
          allowed_time_start, allowed_time_end, blocked_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (child_id, package_name) DO UPDATE SET
         is_blocked = EXCLUDED.is_blocked,
         daily_limit_mins = EXCLUDED.daily_limit_mins,
         allowed_time_start = EXCLUDED.allowed_time_start,
         allowed_time_end = EXCLUDED.allowed_time_end,
         blocked_reason = EXCLUDED.blocked_reason
       RETURNING *`,
      [childId, packageName, appName, appIconUrl, isBlocked, dailyLimitMins,
       allowedTimeStart, allowedTimeEnd, blockedReason]
    );

    await blockCache.setAppBlock(childId, packageName, isBlocked);

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', {
      type: 'app_rule',
      packageName,
      isBlocked,
    });

    res.json({ rule: result.rows[0] });
  } catch (err) {
    logger.error('setAppRule error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la règle' });
  }
};

exports.deleteAppRule = async (req, res) => {
  const { childId } = req.params;
  const { packageName } = req.body;

  try {
    await query(
      'DELETE FROM app_rules WHERE child_id = $1 AND package_name = $2',
      [childId, packageName]
    );

    await blockCache.setAppBlock(childId, packageName, false);

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', {
      type: 'app_rule',
      packageName,
      isBlocked: false,
    });

    res.json({ message: 'Règle d\'app supprimée' });
  } catch (err) {
    logger.error('deleteAppRule error:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de la règle' });
  }
};
