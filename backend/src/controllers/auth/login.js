const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const { query } = require('../../config/database');
const { rateLimit } = require('../../config/redis');
const logger = require('../../utils/logger');
const demo = require('../../config/demo');
const { generateTokens, saveSession, saveRefreshToken } = require('./token');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const issueDemoLogin = async (req, res) => {
  const tokens = generateTokens(demo.DEMO_PARENT_ID, 'parent');
  await saveSession(demo.DEMO_PARENT_ID, 'parent', { email: demo.DEMO_EMAIL, plan: 'premium' });
  await saveRefreshToken(demo.DEMO_PARENT_ID, tokens.refreshToken, req.ip, req.headers['user-agent']);
  return res.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    parent: demo.demoParentPublic(),
  });
};

exports.login = async (req, res) => {
  const { email, password, totpCode } = req.body;
  const ip = req.ip;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  try {
    if (demo.isDemoMode() && demo.isDemoEmail(normalizedEmail)) {
      if (!demo.passwordsMatch(password, demo.DEMO_PASSWORD)) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }
      logger.info('Connexion compte démo');
      return issueDemoLogin(req, res);
    }

    const rl = await rateLimit.check(`login:${ip}`, 10, 900);
    if (rl.exceeded) {
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    }

    const result = await query(
      `SELECT p.*, s.plan, s.status as sub_status
       FROM parents p
       JOIN subscriptions s ON s.parent_id = p.id
       WHERE p.email = $1`,
      [normalizedEmail]
    );

    const parent = result.rows[0];

    if (!parent || !parent.password_hash) {
      if (normalizedEmail) {
        await query(
          `UPDATE parents SET
             login_attempts = login_attempts + 1,
             locked_until = CASE
               WHEN login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
               ELSE locked_until
             END
           WHERE email = $1`,
          [normalizedEmail, MAX_ATTEMPTS, String(LOCK_MINUTES)]
        );
      }
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (!(await bcrypt.compare(password, parent.password_hash))) {
      if (normalizedEmail) {
        await query(
          `UPDATE parents SET
             login_attempts = login_attempts + 1,
             locked_until = CASE
               WHEN login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval
               ELSE locked_until
             END
           WHERE email = $1`,
          [normalizedEmail, MAX_ATTEMPTS, String(LOCK_MINUTES)]
        );
      }
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    if (parent.locked_until && new Date(parent.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Compte temporairement verrouillé' });
    }

    if (parent.totp_enabled) {
      if (!totpCode) {
        return res.status(200).json({ requiresTOTP: true, message: 'Code 2FA requis' });
      }
      const valid = speakeasy.totp.verify({
        secret: parent.totp_secret,
        encoding: 'base32',
        token: totpCode,
        window: 1,
      });
      if (!valid) {
        return res.status(401).json({ error: 'Code 2FA invalide' });
      }
    }

    await query(
      'UPDATE parents SET login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
      [parent.id]
    );

    const tokens = generateTokens(parent.id, 'parent');
    await saveSession(parent.id, 'parent', { email: parent.email, plan: parent.plan });
    await saveRefreshToken(parent.id, tokens.refreshToken, ip, req.headers['user-agent']);

    await rateLimit.reset(`login:${ip}`);

    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      parent: {
        id: parent.id,
        email: parent.email,
        firstName: parent.first_name,
        lastName: parent.last_name,
        plan: parent.plan,
        subStatus: parent.sub_status,
        hasPIN: !!parent.pin_hash,
        twoFAEnabled: parent.totp_enabled,
      },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Erreur de connexion' });
  }
};
