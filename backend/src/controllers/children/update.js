const { query } = require('../../config/database');
const logger = require('../../utils/logger');

exports.updateChild = async (req, res) => {
  const { childId } = req.params;
  const { firstName, age, avatarColor, avatarUrl, aiPersonaName, aiTone } = req.body;
  try {
    // MODE DÉMO FORCÉ - Mise à jour d'enfant simulée
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Simulation mise à jour enfant');
      
      const updatedChild = {
        id: childId,
        parent_id: req.user.id,
        first_name: firstName || 'Enfant',
        age: age || 10,
        avatar_color: avatarColor || '#6C63FF',
        avatar_url: avatarUrl || null,
        ai_persona_name: aiPersonaName || 'Guardian',
        ai_tone: aiTone || 'friendly',
        device_id: null,
        device_name: null,
        is_active: true,
        created_at: new Date(),
        last_seen: new Date()
      };
      
      return res.json({ child: updatedChild });
    }

    const result = await query(
      `UPDATE children SET
         first_name = COALESCE($1, first_name),
         age = COALESCE($2, age),
         avatar_color = COALESCE($3, avatar_color),
         avatar_url = COALESCE($4, avatar_url),
         ai_persona_name = COALESCE($5, ai_persona_name),
         ai_tone = COALESCE($6, ai_tone)
       WHERE id = $7 AND parent_id = $8 RETURNING *`,
      [firstName, age, avatarColor, avatarUrl, aiPersonaName, aiTone, childId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Enfant non trouvé' });
    res.json({ child: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
};

exports.pairDevice = async (req, res) => {
  const { childId } = req.params;
  const { deviceId, deviceName } = req.body;
  try {
    // MODE DÉMO FORCÉ - Couplage d'appareil simulé
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Simulation couplage appareil');
      return res.json({ message: 'Appareil couplé avec succès (mode démo)', deviceId });
    }

    await query(
      'UPDATE children SET device_id = $1, device_name = $2 WHERE id = $3 AND parent_id = $4',
      [deviceId, deviceName, childId, req.user.id]
    );
    res.json({ message: 'Appareil couplé avec succès', deviceId });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors du couplage' });
  }
};
