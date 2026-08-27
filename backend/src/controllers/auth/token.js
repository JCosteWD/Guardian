const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');
const { session } = require('../../config/redis');
const logger = require('../../utils/logger');

exports.generateTokens = (userId, type) => {
  const secret = process.env.JWT_SECRET || 'default_jwt_secret_dev_key_guardian_app_64_chars';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_dev_key_guardian_app_64_chars';
  const payload = { id: userId, type };
  const accessToken = jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, refreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

exports.saveSession = async (userId, type, data = {}) => {
  await session.set(userId, type, { ...data, loginAt: new Date().toISOString() });
};

exports.saveRefreshToken = async (userId, refreshToken, ip, userAgent) => {
  const tokenHash = await bcrypt.hash(refreshToken, 6);
  await query(
    `INSERT INTO refresh_tokens (user_id, user_type, token_hash, expires_at, device_info)
     VALUES ($1, 'parent', $2, NOW() + INTERVAL '7 days', $3)`,
    [userId, tokenHash, JSON.stringify({ ip, ua: userAgent })]
  );
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requis' });

  try {
    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default_jwt_refresh_secret_dev_key_guardian_app_64_chars';
    const decoded = jwt.verify(refreshToken, refreshSecret);

    // Vérifie en DB
    const tokens = await query(
      `SELECT id, token_hash FROM refresh_tokens
       WHERE user_id = $1 AND revoked = false AND expires_at > NOW()`,
      [decoded.id]
    );

    let valid = false;
    for (const t of tokens.rows) {
      if (await bcrypt.compare(refreshToken, t.token_hash)) {
        valid = true;
        break;
      }
    }

    if (!valid) return res.status(401).json({ error: 'Refresh token invalide ou expiré' });

    const newTokens = exports.generateTokens(decoded.id, decoded.type);
    await exports.saveSession(decoded.id, decoded.type);

    res.json({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

exports.logout = async (req, res) => {
  try {
    await session.del(req.user.id, req.user.type);
    await query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
};
