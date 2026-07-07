const { query } = require('../../config/database');
const { quota } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.getChildDashboard = async (req, res) => {
  const { childId } = req.params;
  try {
    // Quota du jour (Redis en priorité, fallback DB)
    let quotaData = await quota.get(childId);
    if (!quotaData) {
      const dbQuota = await query(
        'SELECT * FROM daily_quotas WHERE child_id = $1 AND quota_date = CURRENT_DATE',
        [childId]
      );
      if (dbQuota.rows[0]) {
        quotaData = {
          usedMins: dbQuota.rows[0].used_mins,
          baseLimitMins: dbQuota.rows[0].base_limit_mins,
          bonusMins: dbQuota.rows[0].bonus_mins,
          penaltyMins: dbQuota.rows[0].penalty_mins,
          isLocked: dbQuota.rows[0].is_locked,
        };
      }
    }

    // Dernières activités
    const activities = await query(
      `SELECT event_type, payload, app_package, url, duration_secs, created_at
       FROM activity_events WHERE child_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [childId]
    );

    // Dernières notes
    const grades = await query(
      'SELECT * FROM grades WHERE child_id = $1 ORDER BY grade_date DESC LIMIT 5',
      [childId]
    );

    // Quiz en cours
    const quiz = await query(
      `SELECT id, subject, num_questions, time_bonus_mins, status, expires_at
       FROM quizzes WHERE child_id = $1 AND status = 'pending' AND expires_at > NOW()
       LIMIT 1`,
      [childId]
    );

    // Stats 7 derniers jours
    const weekStats = await query(
      `SELECT DATE(created_at) as day,
              SUM(CASE WHEN event_type = 'app_opened' THEN duration_secs ELSE 0 END) / 60 as screen_mins
       FROM activity_events
       WHERE child_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at) ORDER BY day`,
      [childId]
    );

    res.json({
      quota: quotaData,
      recentActivities: activities.rows,
      recentGrades: grades.rows,
      pendingQuiz: quiz.rows[0] || null,
      weekStats: weekStats.rows,
    });
  } catch (err) {
    logger.error('getClientDashboard error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du tableau de bord' });
  }
};
