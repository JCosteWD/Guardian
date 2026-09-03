const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const demo = require('../../config/demo');
const { generateTokens, saveSession } = require('./token');

exports.childAuth = async (req, res) => {
  const { deviceId, pin } = req.body;
  try {
    let child = null;

    if (demo.isDemoMode()) {
      child = demo.listChildren().find((c) => c.device_id === deviceId && c.is_active !== false);
    }

    if (!child) {
      const result = await query(
        `SELECT c.*, s.plan
         FROM children c
         JOIN subscriptions s ON s.parent_id = c.parent_id
         WHERE c.device_id = $1 AND c.is_active = true`,
        [deviceId]
      );
      child = result.rows[0];
    }

    if (child.pin_hash) {
      if (!pin) return res.status(401).json({ error: 'PIN requis' });
      const valid = await bcrypt.compare(pin, child.pin_hash);
      if (!valid) return res.status(401).json({ error: 'PIN incorrect' });
    }

    const { accessToken } = generateTokens(child.id, 'child');
    await saveSession(child.id, 'child', { parentId: child.parent_id });

    if (!demo.isDemoMode()) {
      await query('UPDATE children SET last_seen = NOW() WHERE id = $1', [child.id]);
    }

    return res.json({
      accessToken,
      child: {
        id: child.id,
        firstName: child.first_name,
        age: child.age,
        avatarColor: child.avatar_color,
        aiPersonaName: child.ai_persona_name,
        subscriptionPlan: child.plan || 'premium',
      },
    });
  } catch (err) {
    logger.error('Child auth error:', err);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};
