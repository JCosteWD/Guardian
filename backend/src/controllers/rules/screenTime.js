const { query } = require('../../config/database');
const { quota } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.getScreenTimeRules = async (req, res) => {
  const { childId } = req.params;
  try {
    // MODE DÉMO FORCÉ - Retourne des règles de démonstration
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Retourne règles temps écran statiques');
      const demoRules = [
        {
          id: 'demo-rule-1',
          child_id: childId,
          name: 'Règle principale',
          daily_limit_mins: 120,
          weekend_limit_mins: 180,
          bedtime_start: '21:00',
          bedtime_end: '07:00',
          school_mode_enabled: true,
          school_start: '08:00',
          school_end: '17:00',
          active_days: [1, 2, 3, 4, 5],
          is_active: true
        }
      ];
      return res.json({ rules: demoRules });
    }

    const result = await query(
      'SELECT * FROM screen_time_rules WHERE child_id = $1 ORDER BY created_at',
      [childId]
    );
    res.json({ rules: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la récupération des règles' });
  }
};

exports.updateScreenTimeRule = async (req, res) => {
  const { childId } = req.params;
  const {
    dailyLimitMins, weekendLimitMins, bedtimeStart, bedtimeEnd,
    schoolModeEnabled, schoolStart, schoolEnd, activeDays,
  } = req.body;

  try {
    const existing = await query(
      'SELECT id FROM screen_time_rules WHERE child_id = $1 AND is_active = true',
      [childId]
    );

    let ruleId;
    if (existing.rows[0]) {
      await query(
        `UPDATE screen_time_rules SET
           daily_limit_mins = COALESCE($1, daily_limit_mins),
           weekend_limit_mins = COALESCE($2, weekend_limit_mins),
           bedtime_start = COALESCE($3::TIME, bedtime_start),
           bedtime_end = COALESCE($4::TIME, bedtime_end),
           school_mode_enabled = COALESCE($5, school_mode_enabled),
           school_start = COALESCE($6::TIME, school_start),
           school_end = COALESCE($7::TIME, school_end),
           active_days = COALESCE($8::day_of_week[], active_days)
         WHERE child_id = $9 AND is_active = true`,
        [dailyLimitMins, weekendLimitMins, bedtimeStart, bedtimeEnd,
         schoolModeEnabled, schoolStart, schoolEnd,
         activeDays, childId]
      );
      ruleId = existing.rows[0].id;
    } else {
      const res2 = await query(
        `INSERT INTO screen_time_rules
           (child_id, name, daily_limit_mins, weekend_limit_mins, bedtime_start, bedtime_end)
         VALUES ($1, 'Règle principale', $2, $3, $4, $5) RETURNING id`,
        [childId, dailyLimitMins || 120, weekendLimitMins || 180, bedtimeStart || '21:00', bedtimeEnd || '07:00']
      );
      ruleId = res2.rows[0].id;
    }

    const todayQuota = await quota.get(childId);
    if (todayQuota && dailyLimitMins) {
      const { getClient } = require('../../config/redis');
      const redis = getClient();
      const today = new Date().toISOString().split('T')[0];
      await redis.hSet(`quota:${childId}:${today}`, 'base_limit_mins', dailyLimitMins);
    }

    const io = req.app.get('io');
    io.to(`child:${childId}`).emit('rules_updated', { type: 'screen_time', dailyLimitMins });

    res.json({ success: true, ruleId });
  } catch (err) {
    logger.error('updateScreenTimeRule error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour des règles' });
  }
};
