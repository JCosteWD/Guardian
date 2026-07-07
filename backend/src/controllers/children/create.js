const bcrypt = require('bcryptjs');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger');

exports.createChild = async (req, res) => {
  const { firstName, age, avatarColor, aiPersonaName, aiTone, pin } = req.body;

  try {
    // Vérifie la limite du plan
    const subResult = await query(
      'SELECT plan FROM subscriptions WHERE parent_id = $1',
      [req.user.id]
    );
    const plan = subResult.rows[0]?.plan || 'free';
    const limits = { free: 1, family: 3, premium: 999 };

    const countResult = await query(
      'SELECT COUNT(*) FROM children WHERE parent_id = $1 AND is_active = true',
      [req.user.id]
    );
    const count = parseInt(countResult.rows[0].count);

    if (count >= limits[plan]) {
      return res.status(403).json({
        error: `Votre plan ${plan} est limité à ${limits[plan]} enfant(s)`,
        code: 'CHILD_LIMIT_REACHED',
        requiredPlan: plan === 'free' ? 'family' : 'premium',
      });
    }

    // Génère le code de couplage appareil
    const pairingCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const result = await transaction(async (client) => {
      const child = await client.query(
        `INSERT INTO children
           (parent_id, first_name, age, avatar_color, ai_persona_name, ai_tone)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.user.id, firstName, age, avatarColor || '#6C63FF',
         aiPersonaName || 'Guardian', aiTone || 'friendly']
      );

      const childId = child.rows[0].id;

      // Règle de temps d'écran par défaut selon l'âge
      const defaultLimitMins = age <= 8 ? 60 : age <= 12 ? 90 : age <= 15 ? 120 : 150;
      await client.query(
        `INSERT INTO screen_time_rules
           (child_id, name, daily_limit_mins, weekend_limit_mins, bedtime_start, bedtime_end)
         VALUES ($1, 'Règle par défaut', $2, $3, '21:00', '07:00')`,
        [childId, defaultLimitMins, Math.round(defaultLimitMins * 1.5)]
      );

      // Filtres de catégories bloquées par défaut
      const defaultBlocked = ['adult', 'violence', 'gambling', 'drugs'];
      for (const cat of defaultBlocked) {
        await client.query(
          'INSERT INTO category_filters (child_id, category_name, is_blocked) VALUES ($1, $2, true)',
          [childId, cat]
        );
      }

      return child.rows[0];
    });

    // PIN enfant optionnel
    if (pin) {
      const pinHash = await bcrypt.hash(pin, 10);
      await query('UPDATE children SET pin_hash = $1 WHERE id = $2', [pinHash, result.id]);
    }

    logger.info(`Child created: ${result.id} for parent ${req.user.id}`);
    res.status(201).json({
      child: result,
      pairingCode,
      message: `Profil créé. Code d'appairage : ${pairingCode}`,
    });
  } catch (err) {
    logger.error('createChild error:', err);
    res.status(500).json({ error: 'Erreur lors de la création du profil' });
  }
};
