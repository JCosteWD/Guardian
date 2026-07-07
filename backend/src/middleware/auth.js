const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { session } = require('../config/redis');
const logger = require('../utils/logger');

// ── VERIFY JWT TOKEN ──────────────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    // MODE DÉMO FORCÉ - Accepte n'importe quel token ou aucun token
    if (process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      let decoded;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split(' ')[1];
          decoded = jwt.verify(token, process.env.JWT_SECRET);
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

// ── PARENT ONLY ───────────────────────────────────────────────────────────────
const requireParent = async (req, res, next) => {
  await verifyToken(req, res, async () => {
    if (req.user.type !== 'parent') {
      return res.status(403).json({ error: 'Accès réservé aux parents' });
    }
    // Charge les infos du parent
    try {
      const result = await query(
        'SELECT id, email, first_name, last_name, preferences FROM parents WHERE id = $1',
        [req.user.id]
      );
      if (!result.rows[0]) {
        return res.status(401).json({ error: 'Compte introuvable' });
      }
      req.parent = result.rows[0];
    } catch (dbErr) {
      // MODE DÉMO - Si PostgreSQL non disponible, utilise des données de démo
      logger.warn('PostgreSQL non disponible - Mode démo activé (requireParent)');
      req.parent = {
        id: req.user.id,
        email: 'demo@guardian.com',
        first_name: 'Parent',
        last_name: 'Demo',
        preferences: '{}',
      };
    }
    next();
  });
};

// ── CHILD DEVICE ─────────────────────────────────────────────────────────────
const requireChild = async (req, res, next) => {
  await verifyToken(req, res, async () => {
    if (req.user.type !== 'child') {
      return res.status(403).json({ error: 'Accès refusé' });
    }
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
  });
};

// ── SUBSCRIPTION GUARD ────────────────────────────────────────────────────────
const requirePlan = (minPlan) => {
  const planLevels = { free: 0, family: 1, premium: 2 };
  return async (req, res, next) => {
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
  };
};

// ── PIN VERIFICATION (actions sensibles parent) ───────────────────────────────
const verifyParentPIN = async (req, res, next) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN requis' });

  const bcrypt = require('bcryptjs');
  const result = await query('SELECT pin_hash FROM parents WHERE id = $1', [req.user.id]);
  const parent = result.rows[0];

  if (!parent?.pin_hash) return next(); // PIN non configuré, on passe

  const valid = await bcrypt.compare(pin, parent.pin_hash);
  if (!valid) {
    return res.status(403).json({ error: 'PIN incorrect' });
  }
  next();
};

// ── CHILD OWNERSHIP CHECK ─────────────────────────────────────────────────────
const requireChildOwnership = async (req, res, next) => {
  const childId = req.params.childId || req.body.childId;
  if (!childId) return res.status(400).json({ error: 'childId requis' });

  const result = await query(
    'SELECT id FROM children WHERE id = $1 AND parent_id = $2',
    [childId, req.user.id]
  );
  if (!result.rows[0]) {
    return res.status(403).json({ error: 'Enfant non trouvé ou accès refusé' });
  }
  next();
};

module.exports = {
  verifyToken,
  requireParent,
  requireChild,
  requirePlan,
  verifyParentPIN,
  requireChildOwnership,
};
