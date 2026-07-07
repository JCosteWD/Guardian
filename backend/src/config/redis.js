const { createClient } = require('redis');
const logger = require('../utils/logger');

let client;
let mockMode = false;

const connect = async () => {
  try {
    client = createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            logger.warn('Redis non disponible après 3 tentatives, abandon');
            return new Error('Redis non disponible');
          }
          return Math.min(retries * 50, 2000);
        },
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      if (err.message !== 'Redis non disponible') {
        logger.error('Redis error:', err.message);
      }
    });
    client.on('connect', () => logger.info('Redis connected'));
    client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

    await client.connect();
    return client;
  } catch (err) {
    logger.warn('Redis non disponible, mode dégradé activé');
    mockMode = true;
    return null;
  }
};

const getClient = () => {
  if (mockMode) return null;
  if (!client) throw new Error('Redis not initialized');
  return client;
};

// ── QUOTA HELPERS (temps d'écran en temps réel) ───────────────────────────────
const QUOTA_PREFIX = 'quota:';
const SESSION_PREFIX = 'session:';
const BLOCK_PREFIX = 'block:';

const quota = {
  // Récupère le quota live d'un enfant pour aujourd'hui
  async get(childId) {
    if (mockMode) return null;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    const data = await client.hGetAll(key);
    if (!data || Object.keys(data).length === 0) return null;
    return {
      usedMins: parseInt(data.used_mins || 0),
      baseLimitMins: parseInt(data.base_limit_mins || 120),
      bonusMins: parseInt(data.bonus_mins || 0),
      penaltyMins: parseInt(data.penalty_mins || 0),
      isLocked: data.is_locked === 'true',
      lockReason: data.lock_reason || null,
    };
  },

  // Initialise le quota du jour
  async init(childId, baseLimitMins, bonusMins = 0, penaltyMins = 0) {
    if (mockMode) return null;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    await client.hSet(key, {
      used_mins: 0,
      base_limit_mins: baseLimitMins,
      bonus_mins: bonusMins,
      penalty_mins: penaltyMins,
      is_locked: 'false',
      lock_reason: '',
    });
    await client.expireAt(key, endOfDayTimestamp());
    return this.get(childId);
  },

  // Incrémente le temps utilisé (appelé depuis l'app enfant toutes les minutes)
  async increment(childId, mins = 1) {
    if (mockMode) return 0;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    const newVal = await client.hIncrBy(key, 'used_mins', mins);
    return newVal;
  },

  // Ajoute du bonus (après quiz réussi)
  async addBonus(childId, bonusMins) {
    if (mockMode) return null;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    await client.hIncrBy(key, 'bonus_mins', bonusMins);
    return this.get(childId);
  },

  // Applique une pénalité (mauvaise note, mauvais comportement)
  async addPenalty(childId, penaltyMins) {
    if (mockMode) return null;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    await client.hIncrBy(key, 'penalty_mins', penaltyMins);
    return this.get(childId);
  },

  // Vérifie si l'enfant a encore du temps
  async hasTimeLeft(childId) {
    if (mockMode) return true;
    const q = await this.get(childId);
    if (!q) return true;
    if (q.isLocked) return false;
    const totalMins = q.baseLimitMins + q.bonusMins - q.penaltyMins;
    return q.usedMins < Math.max(0, totalMins);
  },

  // Calcule les minutes restantes
  async getRemainingMins(childId) {
    if (mockMode) return 120;
    const q = await this.get(childId);
    if (!q) return 120;
    const totalMins = q.baseLimitMins + q.bonusMins - q.penaltyMins;
    return Math.max(0, totalMins - q.usedMins);
  },

  // Verrouille l'accès (punition immédiate)
  async lock(childId, reason = 'Accès restreint par un parent') {
    if (mockMode) return;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    await client.hSet(key, { is_locked: 'true', lock_reason: reason });
  },

  async unlock(childId) {
    if (mockMode) return;
    const key = `${QUOTA_PREFIX}${childId}:${today()}`;
    await client.hSet(key, { is_locked: 'false', lock_reason: '' });
  },
};

// ── SESSION HELPERS ───────────────────────────────────────────────────────────
const session = {
  async set(userId, userType, data, ttlSeconds = 86400) {
    if (mockMode) return;
    const key = `${SESSION_PREFIX}${userType}:${userId}`;
    await client.setEx(key, ttlSeconds, JSON.stringify(data));
  },

  async get(userId, userType) {
    if (mockMode) return null;
    const key = `${SESSION_PREFIX}${userType}:${userId}`;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  },

  async del(userId, userType) {
    if (mockMode) return;
    const key = `${SESSION_PREFIX}${userType}:${userId}`;
    await client.del(key);
  },
};

// ── BLOCK STATUS CACHE ────────────────────────────────────────────────────────
const blockCache = {
  async setAppBlock(childId, packageName, isBlocked) {
    if (mockMode) return;
    const key = `${BLOCK_PREFIX}app:${childId}:${packageName}`;
    await client.setEx(key, 300, isBlocked ? '1' : '0'); // 5 min cache
  },

  async isAppBlocked(childId, packageName) {
    if (mockMode) return false;
    const key = `${BLOCK_PREFIX}app:${childId}:${packageName}`;
    const val = await client.get(key);
    return val === '1';
  },

  async invalidateChild(childId) {
    if (mockMode) return;
    const pattern = `${BLOCK_PREFIX}*:${childId}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(keys);
  },
};

// ── RATE LIMIT HELPERS ────────────────────────────────────────────────────────
const rateLimit = {
  async check(key, maxAttempts, windowSecs) {
    if (mockMode) return { count: 1, exceeded: false };
    const fullKey = `ratelimit:${key}`;
    const count = await client.incr(fullKey);
    if (count === 1) await client.expire(fullKey, windowSecs);
    return { count, exceeded: count > maxAttempts };
  },

  async reset(key) {
    if (mockMode) return;
    await client.del(`ratelimit:${key}`);
  },
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const endOfDayTimestamp = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return Math.floor(d.getTime() / 1000);
};

module.exports = { connect, getClient, quota, session, blockCache, rateLimit };
