const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../../config/database');
const { session } = require('../../config/redis');
const logger = require('../../utils/logger');
const demo = require('../../config/demo');

const HASH_ROUNDS = 12;

exports.generateTokens = (userId, type) => {
  const payload = { id: userId, type };
  const accessToken = jwt.sign(payload, demo.getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  const refreshToken = jwt.sign(payload, demo.getJwtRefreshSecret(), {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
  return { accessToken, refreshToken };
};

exports.saveSession = async (userId, type, data = {}) => {
  if (demo.isDemoMode() && (demo.isDemoParentId(userId) || demo.getChild(userId))) {
    demo.setSession(userId, type, data);
    return;
  }
  await session.set(userId, type, { ...data, loginAt: new Date().toISOString() });
};

exports.saveRefreshToken = async (userId, refreshToken, ip, userAgent) => {
  const tokenHash = await bcrypt.hash(refreshToken, HASH_ROUNDS);
  if (demo.isDemoMode() && demo.isDemoParentId(userId)) {
    demo.saveRefresh(userId, tokenHash);
    return;
  }
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
    const decoded = jwt.verify(refreshToken, demo.getJwtRefreshSecret());

    if (demo.isDemoMode() && demo.isDemoParentId(decoded.id)) {
      const stored = demo.findRefresh(decoded.id);
      if (!stored || !(await bcrypt.compare(refreshToken, stored.tokenHash))) {
        return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
      }
      demo.revokeRefresh(decoded.id);
      const newTokens = exports.generateTokens(decoded.id, decoded.type);
      await exports.saveSession(decoded.id, decoded.type);
      await exports.saveRefreshToken(decoded.id, newTokens.refreshToken, req.ip, req.headers['user-agent']);
      return res.json({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
    }

    const tokens = await query(
      `SELECT id, token_hash FROM refresh_tokens
       WHERE user_id = $1 AND revoked = false AND expires_at > NOW()`,
      [decoded.id]
    );

    let matchedId = null;
    for (const t of tokens.rows) {
      if (await bcrypt.compare(refreshToken, t.token_hash)) {
        matchedId = t.id;
        break;
      }
    }

    if (!matchedId) return res.status(401).json({ error: 'Refresh token invalide ou expiré' });

    await query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [matchedId]);

    const newTokens = exports.generateTokens(decoded.id, decoded.type);
    await exports.saveSession(decoded.id, decoded.type);
    await exports.saveRefreshToken(decoded.id, newTokens.refreshToken, req.ip, req.headers['user-agent']);

    res.json({ accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

exports.logout = async (req, res) => {
  try {
    if (demo.isDemoMode() && (demo.isDemoParentId(req.user.id) || demo.getChild(req.user.id))) {
      demo.delSession(req.user.id, req.user.type);
      demo.revokeRefresh(req.user.id);
      return res.json({ message: 'Déconnexion réussie' });
    }
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
