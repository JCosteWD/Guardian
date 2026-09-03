const { query } = require('../../config/database');
const { quota } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.getActiveRules = async (req, res) => {
  const childId = req.child.id;

  try {
    const [screenRule, appRules, urlRules, categories, quotaData] = await Promise.all([
      query(
        'SELECT * FROM screen_time_rules WHERE child_id = $1 AND is_active = true LIMIT 1',
        [childId]
      ),
      query('SELECT package_name, is_blocked, daily_limit_mins FROM app_rules WHERE child_id = $1', [childId]),
      query('SELECT domain, is_blocked FROM url_rules WHERE child_id = $1', [childId]),
      query('SELECT category_name, is_blocked FROM category_filters WHERE child_id = $1', [childId]),
      quota.get(childId),
    ]);

    const remaining = quotaData
      ? Math.max(0, quotaData.baseLimitMins + quotaData.bonusMins - quotaData.penaltyMins - quotaData.usedMins)
      : (screenRule.rows[0]?.daily_limit_mins || 120);

    const now = new Date();
    const rule = screenRule.rows[0];
    let isBedtime = false;
    if (rule?.bedtime_start && rule?.bedtime_end) {
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      isBedtime = currentTime >= rule.bedtime_start || currentTime <= rule.bedtime_end;
    }

    res.json({
      isLocked: quotaData?.isLocked || false,
      lockReason: quotaData?.lockReason || null,
      isBedtime,
      remainingMins: remaining,
      usedMins: quotaData?.usedMins || 0,
      blockedApps: appRules.rows.filter(a => a.is_blocked).map(a => a.package_name),
      appLimits: appRules.rows.filter(a => a.daily_limit_mins).reduce((acc, a) => {
        acc[a.package_name] = a.daily_limit_mins;
        return acc;
      }, {}),
      blockedDomains: urlRules.rows.filter(u => u.is_blocked).map(u => u.domain),
      allowedDomains: urlRules.rows.filter(u => !u.is_blocked).map(u => u.domain),
      blockedCategories: categories.rows.filter(c => c.is_blocked).map(c => c.category_name),
    });
  } catch (err) {
    logger.error('getActiveRules error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des règles' });
  }
};
