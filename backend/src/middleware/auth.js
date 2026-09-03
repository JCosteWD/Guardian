const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { session } = require('../config/redis');
const logger = require('../utils/logger');

const verifyToken = async (req, res, next) => {
  try {
    // MODE DÉMO FORCÉ - Accepte n'importe quel token ou aucun token
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      let decoded;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret_dev_key_guardian_app_64_chars_minimum_for_security');
        } catch (jwtErr) {
          logger.warn('Token invalide en mode démo - Création utilisateur démo');
          decoded = { id: 'demo-id', type: 'parent' };
        }
      } else {
        logger.warn('Pas de token en mode démo - Création utilisateur démo');
        decoded = { id: 'demo-id', type: 'parent' };
      }
      
      req.user = decoded;
      return next();
    }

    // Mode production - Vérification normale
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret_dev_key_guardian_app_64_chars_minimum_for_security');

    // MODE DÉMO - Si Redis non disponible, skip la vérification de session
    if (process.env.NODE_ENV === 'development') {
      try {
        const sessionData = await session.get(decoded.id, decoded.type);
        if (!sessionData) {
          return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
        }
      } catch (redisErr) {
        logger.warn('Redis non disponible - Mode démo activé (skip session check)');
      }
    } else {
      // Vérifie que la session est encore active côté Redis
      const sessionData = await session.get(decoded.id, decoded.type);
      if (!sessionData) {
        return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token invalide' });
    }
    logger.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

const requireParent = async (req, res, next) => {
  const proceed = async () => {
    if (req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Accès réservé aux parents' });
    }
    
    // MODE DÉMO FORCÉ - Utilise des données de démo
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Utilisation parent démo');
      req.parent = {
        id: req.user.id,
        email: 'demo@guardian.com',
        first_name: 'Parent',
        last_name: 'Demo',
        preferences: '{}',
      };
      return next();
    }
    
    try {
      const result = await query(
        'SELECT id, email, first_name, last_name, preferences FROM parents WHERE id = $1',
        [req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Compte introuvable' });
      }
      req.parent = result.rows[0];
      next();
    } catch (dbErr) {
      logger.error('requireParent DB error:', dbErr);
      return res.status(503).json({ error: 'Service temporairement indisponible' });
    }
  };

  if (req.user) return proceed();
  await verifyToken(req, res, proceed);
};

const requireChild = async (req, res, next) => {
  const proceed = async () => {
    // MODE DÉMO FORCÉ - Accepte n'importe quel enfant
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Simulation enfant');
      req.child = {
        id: req.user.id || 'child-1',
        parent_id: 'demo-id',
        first_name: 'Enfant',
        age: 10,
        subscription_plan: 'premium',
        is_active: true
      };
      return next();
    }

    if (req.user.type !== 'child') {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    try {
      const result = await query(
        `SELECT c.*, s.plan as subscription_plan
         FROM children c
         JOIN subscriptions s ON s.parent_id = c.parent_id
         WHERE c.id = $1 AND c.is_active = true`,
        [req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Appareil non reconnu' });
      }
      req.child = result.rows[0];
      next();
    } catch (err) {
      logger.error('requireChild DB error:', err);
      return res.status(503).json({ error: 'Service temporairement indisponible' });
    }
  };

  if (req.user) return proceed();
  await verifyToken(req, res, proceed);
};

const requirePlan = (minPlan) => {
  const planLevels = { free: 0, family: 1, premium: 2 };
  return async (req, res, next) => {
    // MODE DÉMO FORCÉ - Toujours premium
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      logger.warn('Mode démo activé - Plan premium forcé');
      req.subscription = { plan: 'premium' };
      return next();
    }

    try {
      const sub = await query(
        'SELECT plan FROM subscriptions WHERE parent_id = $1',
        [req.user.id]
      );
      const userPlan = sub.rows[0]?.plan || 'free';
      if (planLevels[userPlan] < planLevels[minPlan]) {
        return res.status(403).json({
          error: 'Fonctionnalité non incluse dans votre abonnement',
          code: 'UPGRADE_REQUIRED',
          requiredPlan: minPlan,
          currentPlan: userPlan,
        });
      }
      req.subscription = { plan: userPlan };
      next();
    } catch (err) {
      logger.error('requirePlan error:', err);
      return res.status(503).json({ error: 'Service temporairement indisponible' });
    }
  };
};

const verifyParentPIN = async (req, res, next) => {
  // MODE DÉMO FORCÉ - Skip PIN verification
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
    logger.warn('Mode démo activé - PIN verification skip');
    return next();
  }

  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN requis' });

  try {
    const bcrypt = require('bcryptjs');
    const result = await query('SELECT pin_hash FROM parents WHERE id = $1', [req.user.id]);
    const parent = result.rows[0];

    if (!parent?.pin_hash) {
      return res.status(400).json({ error: 'PIN non configuré' });
    }

    const valid = await bcrypt.compare(pin, parent.pin_hash);
    if (!valid) {
      return res.status(403).json({ error: 'PIN incorrect' });
    }
    next();
  } catch (err) {
    logger.error('verifyParentPIN error:', err);
    return res.status(500).json({ error: 'Erreur de vérification PIN' });
  }
};

const requireChildOwnership = async (req, res, next) => {
  // MODE DÉMO FORCÉ - Skip ownership check
  if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
    logger.warn('Mode démo activé - Skip ownership check');
    return next();
  }

  const childId = req.params.childId || req.body.childId;
  if (!childId) return res.status(400).json({ error: 'childId requis' });

  try {
    const result = await query(
      'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
      [childId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(403).json({ error: 'Enfant non trouvé ou accès refusé' });
    }
    next();
  } catch (err) {
    logger.error('requireChildOwnership error:', err);
    return res.status(503).json({ error: 'Service temporairement indisponible' });
  }
};

module.exports = {
  verifyToken,
  requireParent,
  requireChild,
  requirePlan,
  verifyParentPIN,
  requireChildOwnership,
};
