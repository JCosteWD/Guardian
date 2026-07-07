const bcrypt = require('bcryptjs');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { generateTokens, saveSession } = require('./token');

exports.childAuth = async (req, res) => {
  const { deviceId, pin } = req.body;
  try {
    const result = await query(
      `SELECT c.*, s.plan
       FROM children c
       JOIN subscriptions s ON s.parent_id = c.parent_id
       WHERE c.device_id = $1 AND c.is_active = true`,
      [deviceId]
    );

    const child = result.rows[0];
    if (!child) return res.status(401).json({ error: 'Appareil non reconnu' });

    if (child.pin_hash && pin) {
      const valid = await bcrypt.compare(pin, child.pin_hash);
      if (!valid) return res.status(401).json({ error: 'PIN incorrect' });
    }

    const { accessToken } = generateTokens(child.id, 'child');
    await saveSession(child.id, 'child', { parentId: child.parent_id });

    await query('UPDATE children SET last_seen = NOW() WHERE id = $1', [child.id]);

    res.json({
      accessToken,
      child: {
        id: child.id,
        firstName: child.first_name,
        age: child.age,
        avatarColor: child.avatar_color,
        aiPersonaName: child.ai_persona_name,
        subscriptionPlan: child.plan,
      },
    });
  } catch (err) {
    logger.error('Child auth error:', err);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};
