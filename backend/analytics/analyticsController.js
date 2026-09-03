const { query } = require('../config/database');
const logger = require('../utils/logger');

// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Analytics & métriques business
// ══════════════════════════════════════════════════════════════════════════════
// Tableau de bord interne pour l'équipe Guardian :
// - MRR (Monthly Recurring Revenue)
// - Churn rate
// - DAU / MAU (Daily / Monthly Active Users)
// - Taux de conversion free → paid
// - Rétention par cohorte
// - Top features utilisées
// - Alertes de sécurité agrégées

// ── MRR ───────────────────────────────────────────────────────────────────────
exports.getMRR = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE plan = 'family')  AS family_count,
        COUNT(*) FILTER (WHERE plan = 'premium') AS premium_count,
        COUNT(*) FILTER (WHERE plan = 'free')    AS free_count,
        COUNT(*) TOTAL,
        (COUNT(*) FILTER (WHERE plan = 'family')  * 4.99 +
         COUNT(*) FILTER (WHERE plan = 'premium') * 9.99) AS mrr,
        (COUNT(*) FILTER (WHERE plan = 'family' AND created_at >= NOW() - INTERVAL '30 days') * 4.99 +
         COUNT(*) FILTER (WHERE plan = 'premium' AND created_at >= NOW() - INTERVAL '30 days') * 9.99) AS new_mrr_30d
      FROM subscriptions
      WHERE status = 'active'
    `);

    const { family_count, premium_count, free_count, total, mrr, new_mrr_30d } = result.rows[0];

    // MRR historique (12 derniers mois)
    const history = await query(`
      SELECT
        DATE_TRUNC('month', created_at) AS month,
        SUM(CASE WHEN plan = 'family' THEN 4.99 WHEN plan = 'premium' THEN 9.99 ELSE 0 END) AS mrr
      FROM subscriptions
      WHERE status = 'active' AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1 ORDER BY 1
    `);

    res.json({
      current: {
        mrr:          parseFloat(mrr || 0).toFixed(2),
        newMrr30d:    parseFloat(new_mrr_30d || 0).toFixed(2),
        arr:          (parseFloat(mrr || 0) * 12).toFixed(2),
        totalUsers:   parseInt(total),
        freeUsers:    parseInt(free_count),
        familyUsers:  parseInt(family_count),
        premiumUsers: parseInt(premium_count),
        paidTotal:    parseInt(family_count) + parseInt(premium_count),
        conversionRate: total > 0
          ? ((parseInt(family_count) + parseInt(premium_count)) / parseInt(total) * 100).toFixed(1) + '%'
          : '0%',
      },
      history: history.rows,
    });
  } catch (err) {
    logger.error('getMRR error:', err);
    res.status(500).json({ error: 'Erreur analytics' });
  }
};

// ── CHURN ─────────────────────────────────────────────────────────────────────
exports.getChurn = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'canceled' AND updated_at >= NOW() - INTERVAL '30 days') AS churned_30d,
        COUNT(*) FILTER (WHERE status = 'active') AS active_paid,
        COUNT(*) FILTER (WHERE cancel_at_period_end = true) AS pending_churn
      FROM subscriptions
      WHERE plan != 'free'
    `);

    const { churned_30d, active_paid, pending_churn } = result.rows[0];
    const churnRate = active_paid > 0
      ? (parseInt(churned_30d) / (parseInt(active_paid) + parseInt(churned_30d)) * 100).toFixed(2)
      : '0';

    res.json({
      churned30d:   parseInt(churned_30d),
      activePaid:   parseInt(active_paid),
      pendingChurn: parseInt(pending_churn),
      churnRate:    churnRate + '%',
      ltv: active_paid > 0
        ? (parseFloat((await query(`SELECT AVG(CASE WHEN plan='family' THEN 4.99 WHEN plan='premium' THEN 9.99 END) FROM subscriptions WHERE status='active' AND plan!='free'`)).rows[0].avg || 0) / (parseFloat(churnRate) / 100 || 0.05)).toFixed(2)
        : '0',
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur analytics churn' });
  }
};

// ── DAU / MAU ─────────────────────────────────────────────────────────────────
exports.getActiveUsers = async (req, res) => {
  try {
    const [dau, mau, wau] = await Promise.all([
      query(`SELECT COUNT(DISTINCT child_id) AS count FROM activity_events WHERE created_at >= NOW() - INTERVAL '24 hours'`),
      query(`SELECT COUNT(DISTINCT child_id) AS count FROM activity_events WHERE created_at >= NOW() - INTERVAL '30 days'`),
      query(`SELECT COUNT(DISTINCT child_id) AS count FROM activity_events WHERE created_at >= NOW() - INTERVAL '7 days'`),
    ]);

    const dauVal = parseInt(dau.rows[0].count);
    const mauVal = parseInt(mau.rows[0].count);
    const stickiness = mauVal > 0 ? ((dauVal / mauVal) * 100).toFixed(1) + '%' : '0%';

    // DAU sur 30 jours
    const dauHistory = await query(`
      SELECT DATE(created_at) AS day, COUNT(DISTINCT child_id) AS active_children
      FROM activity_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at) ORDER BY day
    `);

    res.json({
      dau: dauVal,
      wau: parseInt(wau.rows[0].count),
      mau: mauVal,
      stickiness,
      dauHistory: dauHistory.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur analytics DAU/MAU' });
  }
};

// ── FEATURES USAGE ────────────────────────────────────────────────────────────
exports.getFeatureUsage = async (req, res) => {
  try {
    const [aiChats, quizzes, geofences, familyMembers, entConfigs] = await Promise.all([
      query(`SELECT COUNT(*) FROM ai_conversations WHERE created_at >= NOW() - INTERVAL '30 days'`),
      query(`SELECT COUNT(*) FROM quizzes WHERE created_at >= NOW() - INTERVAL '30 days'`),
      query(`SELECT COUNT(*) FROM geofence_zones WHERE is_active = true`),
      query(`SELECT COUNT(*) FROM family_members WHERE is_active = true`),
      query(`SELECT COUNT(*) FROM ent_configs WHERE is_active = true`).catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const topEvents = await query(`
      SELECT event_type, COUNT(*) AS count
      FROM activity_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY event_type ORDER BY count DESC LIMIT 10
    `);

    res.json({
      features: {
        aiChats:       parseInt(aiChats.rows[0].count),
        quizzes:       parseInt(quizzes.rows[0].count),
        geofences:     parseInt(geofences.rows[0].count),
        familyMembers: parseInt(familyMembers.rows[0].count),
        entConfigs:    parseInt(entConfigs.rows[0].count || 0),
      },
      topEvents: topEvents.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur analytics features' });
  }
};

// ── RETENTION COHORT ─────────────────────────────────────────────────────────
exports.getRetention = async (req, res) => {
  try {
    // Cohorte par semaine d'inscription
    const cohorts = await query(`
      WITH cohort_week AS (
        SELECT
          id AS parent_id,
          DATE_TRUNC('week', created_at) AS cohort
        FROM parents
        WHERE created_at >= NOW() - INTERVAL '12 weeks'
      ),
      activity AS (
        SELECT DISTINCT
          c.parent_id,
          cw.cohort,
          DATE_TRUNC('week', ae.created_at) AS active_week
        FROM cohort_week cw
        JOIN children ch ON ch.parent_id = cw.parent_id
        JOIN activity_events ae ON ae.child_id = ch.id
        CROSS JOIN cohort_week c
        WHERE c.parent_id = cw.parent_id
      )
      SELECT
        cohort,
        COUNT(DISTINCT parent_id) AS cohort_size,
        COUNT(DISTINCT CASE WHEN active_week = cohort THEN parent_id END) AS week0,
        COUNT(DISTINCT CASE WHEN active_week = cohort + INTERVAL '1 week' THEN parent_id END) AS week1,
        COUNT(DISTINCT CASE WHEN active_week = cohort + INTERVAL '2 weeks' THEN parent_id END) AS week2,
        COUNT(DISTINCT CASE WHEN active_week = cohort + INTERVAL '4 weeks' THEN parent_id END) AS week4
      FROM activity
      GROUP BY cohort ORDER BY cohort DESC LIMIT 12
    `);

    res.json({ cohorts: cohorts.rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur retention' });
  }
};

// ── SECURITY OVERVIEW ─────────────────────────────────────────────────────────
exports.getSecurityOverview = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'tamper_attempt') AS tamper_attempts,
        COUNT(*) FILTER (WHERE event_type = 'app_blocked')    AS app_blocks,
        COUNT(*) FILTER (WHERE event_type = 'url_blocked')    AS url_blocks,
        COUNT(*) FILTER (WHERE event_type = 'quota_reached')  AS quota_hits
      FROM activity_events
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const topBlockedApps = await query(`
      SELECT app_package, COUNT(*) AS count
      FROM activity_events
      WHERE event_type = 'app_blocked' AND created_at >= NOW() - INTERVAL '30 days'
        AND app_package IS NOT NULL
      GROUP BY app_package ORDER BY count DESC LIMIT 10
    `);

    res.json({
      last30Days: result.rows[0],
      topBlockedApps: topBlockedApps.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur security overview' });
  }
};
