const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// ── GET PROFILE ───────────────────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, email, first_name, last_name, phone, avatar_url,
              totp_enabled, email_verified, last_login, created_at,
              preferences
       FROM parents WHERE id = $1`,
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Profil introuvable' });

    const sub = await query(
      'SELECT plan, status, current_period_end FROM subscriptions WHERE parent_id = $1',
      [req.user.id]
    );

    res.json({
      parent: {
        ...result.rows[0],
        firstName: result.rows[0].first_name,
        lastName:  result.rows[0].last_name,
        plan:      sub.rows[0]?.plan || 'free',
        subStatus: sub.rows[0]?.status,
      }
    });
  } catch (err) {
    logger.error('getProfile error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

// ── UPDATE PROFILE ────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  const { firstName, lastName, phone, preferences } = req.body;
  try {
    const result = await query(
      `UPDATE parents SET
         first_name  = COALESCE($1, first_name),
         last_name   = COALESCE($2, last_name),
         phone       = COALESCE($3, phone),
         preferences = COALESCE($4::JSONB, preferences)
       WHERE id = $5
       RETURNING id, email, first_name, last_name, phone, preferences`,
      [firstName?.trim(), lastName?.trim(), phone?.trim(),
       preferences ? JSON.stringify(preferences) : null, req.user.id]
    );
    res.json({
      parent: {
        ...result.rows[0],
        firstName: result.rows[0].first_name,
        lastName:  result.rows[0].last_name,
      }
    });
  } catch (err) {
    logger.error('updateProfile error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Le nouveau mot de passe doit faire au moins 8 caractères' });
  }
  if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins une majuscule et un chiffre' });
  }

  try {
    const result = await query('SELECT password_hash FROM parents WHERE id = $1', [req.user.id]);
    const parent = result.rows[0];
    if (!parent) return res.status(404).json({ error: 'Compte introuvable' });

    const valid = await bcrypt.compare(currentPassword, parent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE parents SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    // Révoque tous les refresh tokens (force reconnexion sur autres appareils)
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [req.user.id]
    );

    logger.info(`Password changed for parent ${req.user.id}`);
    res.json({ message: 'Mot de passe modifié avec succès. Reconnectez-vous sur vos autres appareils.' });
  } catch (err) {
    logger.error('changePassword error:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
};

// ── REGISTER PUSH TOKEN ───────────────────────────────────────────────────────
exports.registerPushToken = async (req, res) => {
  const { token, platform = 'android' } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requis' });

  try {
    await query(
      `INSERT INTO push_tokens (parent_id, token, platform, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (token) DO UPDATE SET parent_id = $1, is_active = true`,
      [req.user.id, token, platform]
    );
    res.json({ message: 'Token enregistré' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement du token' });
  }
};

// ── PAIR DEVICE (avec token QR) ───────────────────────────────────────────────
exports.pairDevice = async (req, res) => {
  const { pairingToken } = req.body;
  if (!pairingToken) return res.status(400).json({ error: 'Token de couplage requis' });

  try {
    // Le pairingCode est stocké temporairement dans Redis lors de la création de l'enfant
    const { getClient } = require('../config/redis');
    const redis = getClient();
    const childId = await redis.get(`pairing:${pairingToken.toUpperCase()}`);

    if (!childId) {
      return res.status(404).json({ error: 'Code de couplage invalide ou expiré' });
    }

    // Récupère les infos de l'enfant
    const result = await query(
      'SELECT id, first_name, age, avatar_color, ai_persona_name FROM children WHERE id = $1',
      [childId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Profil enfant introuvable' });
    }

    // Génère un deviceId unique
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Stocke le deviceId (sera complété lors de la 1ère authentification)
    await redis.del(`pairing:${pairingToken.toUpperCase()}`);

    res.json({
      child: result.rows[0],
      deviceId,
      message: 'Couplage réussi ! Connectez-vous avec cet appareil.',
    });
  } catch (err) {
    logger.error('pairDevice error:', err);
    res.status(500).json({ error: 'Erreur lors du couplage' });
  }
};
