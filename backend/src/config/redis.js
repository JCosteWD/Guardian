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
          if (retries > 2) {
            return new Error('Redis non disponible');
          }
          return 100;
        },
      },
      password: process.env.REDIS_PASSWORD || undefined,
    });

    client.on('error', (err) => {
      mockMode = true;
    });

    await client.connect();
    return client;
  } catch (err) {
    logger.warn('Redis non disponible, mode dégradé activé');
    mockMode = true;
    return null;
  }
};

const getClient = () => {
  if (mockMode || !client || !client.isOpen) return null;
  return client;
};

// ── QUOTA HELPERS (temps d'écran en temps réel) ───────────────────────────────
const QUOTA_PREFIX = 'quota:';
const SESSION_PREFIX = 'session:';
const BLOCK_PREFIX = 'block:';

const quota = {
  async get(childId) {
    if (mockMode || !client || !client.isOpen) return null;
    try {
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
    } catch { return null; }
  },

  async init(childId, baseLimitMins, bonusMins = 0, penaltyMins = 0) {
    if (mockMode || !client || !client.isOpen) return null;
    try {
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
    } catch { return null; }
  },

  async increment(childId, mins = 1) {
    if (mockMode || !client || !client.isOpen) return 0;
    try {
      const key = `${QUOTA_PREFIX}${childId}:${today()}`;
      return await client.hIncrBy(key, 'used_mins', mins);
    } catch { return 0; }
  },

  async addBonus(childId, bonusMins) {
    if (mockMode || !client || !client.isOpen) return null;
    try {
      const key = `${QUOTA_PREFIX}${childId}:${today()}`;
      await client.hIncrBy(key, 'bonus_mins', bonusMins);
      return this.get(childId);
    } catch { return null; }
  },

  async addPenalty(childId, penaltyMins) {
    if (mockMode || !client || !client.isOpen) return null;
    try {
      const key = `${QUOTA_PREFIX}${childId}:${today()}`;
      await client.hIncrBy(key, 'penalty_mins', penaltyMins);
      return this.get(childId);
    } catch { return null; }
  },

  async hasTimeLeft(childId) {
    if (mockMode || !client || !client.isOpen) return true;
    try {
      const q = await this.get(childId);
      if (!q) return true;
      if (q.isLocked) return false;
      const totalMins = q.baseLimitMins + q.bonusMins - q.penaltyMins;
      return q.usedMins < Math.max(0, totalMins);
    } catch { return true; }
  },

  async getRemainingMins(childId) {
    if (mockMode || !client || !client.isOpen) return 120;
    try {
      const q = await this.get(childId);
      if (!q) return 120;
      const totalMins = q.baseLimitMins + q.bonusMins - q.penaltyMins;
      return Math.max(0, totalMins - q.usedMins);
    } catch { return 120; }
  },

  async lock(childId, reason = 'Accès restreint par un parent') {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const key = `${QUOTA_PREFIX}${childId}:${today()}`;
      await client.hSet(key, { is_locked: 'true', lock_reason: reason });
    } catch {}
  },

  async unlock(childId) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const key = `${QUOTA_PREFIX}${childId}:${today()}`;
      await client.hSet(key, { is_locked: 'false', lock_reason: '' });
    } catch {}
  },
};

// ── SESSION HELPERS ───────────────────────────────────────────────────────────
const session = {
  async set(userId, userType, data, ttlSeconds = 86400) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const key = `${SESSION_PREFIX}${userType}:${userId}`;
      await client.setEx(key, ttlSeconds, JSON.stringify(data));
    } catch {}
  },

  async get(userId, userType) {
    if (mockMode || !client || !client.isOpen) return null;
    try {
      const key = `${SESSION_PREFIX}${userType}:${userId}`;
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  },

  async del(userId, userType) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const key = `${SESSION_PREFIX}${userType}:${userId}`;
      await client.del(key);
    } catch {}
  },
};

// ── BLOCK STATUS CACHE ────────────────────────────────────────────────────────
const blockCache = {
  async setAppBlock(childId, packageName, isBlocked) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const key = `${BLOCK_PREFIX}app:${childId}:${packageName}`;
      await client.setEx(key, 300, isBlocked ? '1' : '0');
    } catch {}
  },

  async isAppBlocked(childId, packageName) {
    if (mockMode || !client || !client.isOpen) return false;
    try {
      const key = `${BLOCK_PREFIX}app:${childId}:${packageName}`;
      const val = await client.get(key);
      return val === '1';
    } catch { return false; }
  },

  async invalidateChild(childId) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      const pattern = `${BLOCK_PREFIX}*:${childId}:*`;
      const keys = await client.keys(pattern);
      if (keys.length > 0) await client.del(keys);
    } catch {}
  },
};

// ── RATE LIMIT HELPERS ────────────────────────────────────────────────────────
const rateLimit = {
  async check(key, maxAttempts, windowSecs) {
    if (mockMode || !client || !client.isOpen) return { count: 1, exceeded: false };
    try {
      const fullKey = `ratelimit:${key}`;
      const count = await client.incr(fullKey);
      if (count === 1) await client.expire(fullKey, windowSecs);
      return { count, exceeded: count > maxAttempts };
    } catch {
      return { count: 1, exceeded: false };
    }
  },

  async reset(key) {
    if (mockMode || !client || !client.isOpen) return;
    try {
      await client.del(`ratelimit:${key}`);
    } catch {}
  },
};

const today = () => new Date().toISOString().split('T')[0];

const endOfDayTimestamp = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return Math.floor(d.getTime() / 1000);
};

module.exports = { connect, getClient, quota, session, blockCache, rateLimit };
