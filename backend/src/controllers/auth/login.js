const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const { query } = require('../../config/database');
const { rateLimit } = require('../../config/redis');
const logger = require('../../utils/logger');
const { generateTokens, saveSession, saveRefreshToken } = require('./token');

exports.login = async (req, res) => {
  const { email, password, totpCode } = req.body;
  const ip = req.ip;

  try {
    // MODE DÉMO FORCÉ
    if (process.env.DEMO_MODE === 'true') {
      logger.warn('Mode démo activé - Accepte n\'importe quel login');
      const demoParent = {
        id: 'demo-id',
        email: email || 'demo@guardian.com',
        firstName: 'Parent',
        lastName: 'Demo',
        plan: 'premium',
        subStatus: 'active',
        pin_hash: null,
        totp_enabled: false,
      };
      const tokens = generateTokens(demoParent.id, 'parent');
      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        parent: {
          id: demoParent.id,
          email: demoParent.email,
          firstName: demoParent.firstName,
          lastName: demoParent.lastName,
          plan: demoParent.plan,
          subStatus: demoParent.subStatus,
          hasPIN: false,
          twoFAEnabled: false,
        },
      });
    }

    // Rate limiting par IP
    const rl = await rateLimit.check(`login:${ip}`, 10, 900);
    if (rl.exceeded) {
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });
    }

    const result = await query(
      `SELECT p.*, s.plan, s.status as sub_status
       FROM parents p
       JOIN subscriptions s ON s.parent_id = p.id
       WHERE p.email = $1`,
      [email.toLowerCase()]
    );

    const parent = result.rows[0];

    // Vérification générique (pas de distinction email/mdp pour la sécurité)
    if (!parent || !(await bcrypt.compare(password, parent.password_hash))) {
      await query(
        'UPDATE parents SET login_attempts = login_attempts + 1 WHERE email = $1',
        [email.toLowerCase()]
      );
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Compte verrouillé ?
    if (parent.locked_until && new Date(parent.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Compte temporairement verrouillé' });
    }

    // 2FA TOTP requis ?
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

    // Reset login attempts
    await query(
      'UPDATE parents SET login_attempts = 0, last_login = NOW() WHERE id = $1',
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
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode dégradé sans PostgreSQL - Retourne un utilisateur démo');
      const demoParent = {
        id: 'demo-id',
        email: email || 'demo@guardian.com',
        firstName: 'Parent',
        lastName: 'Demo',
        plan: 'premium',
        subStatus: 'active',
      };
      const tokens = generateTokens(demoParent.id, 'parent');
      return res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        parent: {
          id: demoParent.id,
          email: demoParent.email,
          firstName: demoParent.firstName,
          lastName: demoParent.lastName,
          plan: demoParent.plan,
          subStatus: demoParent.subStatus,
          hasPIN: false,
          twoFAEnabled: false,
        },
      });
    }
    res.status(500).json({ error: 'Erreur de connexion' });
  }
};
