const { query } = require('../../config/database');
const logger = require('../../utils/logger');

exports.getChildren = async (req, res) => {
  try {
    // MODE DÉMO FORCÉ - Retourne des enfants statiques
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Retourne enfants statiques');
      const demoChildren = [
        {
          id: 'ethan-id',
          first_name: 'Ethan',
          age: 17,
          avatar_url: null,
          avatar_color: '#3B82F6',
          device_id: 'iphone-ethan',
          device_name: 'iPhone 15 Pro',
          is_active: true,
          ai_persona_name: 'Guardian',
          ai_tone: 'friendly',
          last_seen: new Date(),
          used_mins_today: 45,
          base_limit: 180,
          bonus_mins: 0,
          penalty_mins: 0,
          is_locked: false
        },
        {
          id: 'morgan-id',
          first_name: 'Morgan',
          age: 11,
          avatar_url: null,
          avatar_color: '#10B981',
          device_id: 'samsung-morgan',
          device_name: 'Samsung Galaxy A54',
          is_active: true,
          ai_persona_name: 'Pixel',
          ai_tone: 'fun',
          last_seen: new Date(),
          used_mins_today: 90,
          base_limit: 120,
          bonus_mins: 15,
          penalty_mins: 0,
          is_locked: false
        },
        {
          id: 'lana-id',
          first_name: 'Lana',
          age: 7,
          avatar_url: null,
          avatar_color: '#f50bc2c5',
          device_id: 'tablet-lana',
          device_name: 'iPad Air',
          is_active: true,
          ai_persona_name: 'Guardian',
          ai_tone: 'friendly',
          last_seen: new Date(),
          used_mins_today: 60,
          base_limit: 90,
          bonus_mins: 0,
          penalty_mins: 0,
          is_locked: false
        },
        {
          id: 'loan-id',
          first_name: 'Loan',
          age: 4,
          avatar_url: null,
          avatar_color: '#e4b210',
          device_id: 'tablet-loan',
          device_name: 'Tablette Android',
          is_active: true,
          ai_persona_name: 'Pixel',
          ai_tone: 'fun',
          last_seen: new Date(),
          used_mins_today: 30,
          base_limit: 60,
          bonus_mins: 0,
          penalty_mins: 0,
          is_locked: false
        }
      ];
      return res.json({ children: demoChildren });
    }

    const result = await query(
      `SELECT c.id, c.first_name, c.age, c.avatar_url, c.avatar_color,
              c.device_id, c.device_name, c.is_active, c.ai_persona_name,
              c.ai_tone, c.last_seen,
              COALESCE(dq.used_mins, 0) as used_mins_today,
              COALESCE(dq.base_limit_mins, str.daily_limit_mins, 120) as base_limit,
              COALESCE(dq.bonus_mins, 0) as bonus_mins,
              COALESCE(dq.penalty_mins, 0) as penalty_mins,
              dq.is_locked
       FROM children c
       LEFT JOIN screen_time_rules str ON str.child_id = c.id AND str.is_active = true
       LEFT JOIN daily_quotas dq ON dq.child_id = c.id AND dq.quota_date = CURRENT_DATE
       WHERE c.parent_id = $1
       ORDER BY c.created_at ASC`,
      [req.user.id]
    );
    res.json({ children: result.rows });
  } catch (err) {
    logger.error('getChildren error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des enfants' });
  }
};
