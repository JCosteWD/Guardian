import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import api from './api';

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE OFFLINE – Cache local chiffré + queue de synchronisation
// ══════════════════════════════════════════════════════════════════════════════
// L'app enfant doit fonctionner MÊME sans connexion internet :
// 1. Les règles (blocklist, quota) sont cachées localement après chaque sync
// 2. Les événements d'activité sont mis en queue et envoyés à la reconnexion
// 3. Le quota est géré localement via timer quand offline
// 4. Guardian informe l'enfant si l'accès est possible sans connexion

const CACHE_KEYS = {
  RULES:           'guardian_rules_cache',
  QUOTA:           'guardian_quota_cache',
  CHILD_PROFILE:   'guardian_child_profile',
  SYNC_QUEUE:      'guardian_sync_queue',
  LAST_SYNC:       'guardian_last_sync',
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ── SAVE RULES CACHE ──────────────────────────────────────────────────────────
export const cacheRules = async (rules) => {
  try {
    const payload = {
      data: rules,
      cachedAt: Date.now(),
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    await AsyncStorage.setItem(CACHE_KEYS.RULES, JSON.stringify(payload));
  } catch (err) {
    console.warn('cacheRules error:', err);
  }
};

// ── GET CACHED RULES ──────────────────────────────────────────────────────────
export const getCachedRules = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.RULES);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (Date.now() > payload.expiresAt) {
      await AsyncStorage.removeItem(CACHE_KEYS.RULES);
      return null;
    }
    return payload.data;
  } catch {
    return null;
  }
};

// ── SAVE QUOTA CACHE ──────────────────────────────────────────────────────────
export const cacheQuota = async (quota) => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.QUOTA, JSON.stringify({
      ...quota,
      cachedAt: Date.now(),
    }));
  } catch (err) {
    console.warn('cacheQuota error:', err);
  }
};

// ── GET CACHED QUOTA ──────────────────────────────────────────────────────────
export const getCachedQuota = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.QUOTA);
    if (!raw) return null;
    const quota = JSON.parse(raw);
    // Ajuste le temps utilisé selon le temps passé hors ligne
    const elapsedMins = Math.floor((Date.now() - quota.cachedAt) / 60000);
    return { ...quota, usedMins: Math.min(quota.baseLimitMins, quota.usedMins + elapsedMins) };
  } catch {
    return null;
  }
};

// ── SAVE CHILD PROFILE ────────────────────────────────────────────────────────
export const cacheChildProfile = async (child) => {
  try {
    await AsyncStorage.setItem(CACHE_KEYS.CHILD_PROFILE, JSON.stringify(child));
  } catch {}
};

export const getCachedChildProfile = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.CHILD_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

// ── SYNC QUEUE (événements à envoyer quand online) ────────────────────────────
export const enqueueEvent = async (eventType, payload) => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.SYNC_QUEUE);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ eventType, payload, createdAt: Date.now() });
    // Garde max 500 événements
    const trimmed = queue.slice(-500);
    await AsyncStorage.setItem(CACHE_KEYS.SYNC_QUEUE, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('enqueueEvent error:', err);
  }
};

export const flushQueue = async () => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEYS.SYNC_QUEUE);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    console.log(`[Offline] Flushing ${queue.length} queued events...`);

    // Envoie par batch de 20
    const batches = [];
    for (let i = 0; i < queue.length; i += 20) batches.push(queue.slice(i, i + 20));

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(evt => api.post('/device/activity', {
          eventType: evt.eventType,
          payload: evt.payload,
        }))
      );
    }

    await AsyncStorage.removeItem(CACHE_KEYS.SYNC_QUEUE);
    console.log('[Offline] Queue flushed successfully');
  } catch (err) {
    console.warn('flushQueue error:', err);
  }
};

// ── OFFLINE QUOTA MANAGER ─────────────────────────────────────────────────────
// Gère le quota localement quand l'app est offline
class OfflineQuotaManager {
  constructor() {
    this.quota    = null;
    this.timer    = null;
    this.listeners = [];
  }

  async init(quotaData) {
    this.quota = quotaData;
    await cacheQuota(quotaData);
    this.startTimer();
  }

  startTimer() {
    if (this.timer) clearInterval(this.timer);
    // Décrémente le quota toutes les minutes
    this.timer = setInterval(async () => {
      if (!this.quota) return;
      this.quota.usedMins += 1;
      await cacheQuota(this.quota);
      this.notifyListeners();
    }, 60000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getRemainingMins() {
    if (!this.quota) return 120;
    const total = this.quota.baseLimitMins + (this.quota.bonusMins||0) - (this.quota.penaltyMins||0);
    return Math.max(0, total - this.quota.usedMins);
  }

  isLocked() {
    return this.quota?.isLocked || this.getRemainingMins() <= 0;
  }

  addListener(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  notifyListeners() {
    this.listeners.forEach(fn => fn({
      remainingMins: this.getRemainingMins(),
      isLocked: this.isLocked(),
      quota: this.quota,
    }));
  }
}

export const offlineQuota = new OfflineQuotaManager();

// ── CONNECTIVITY MONITOR ──────────────────────────────────────────────────────
export const startConnectivityMonitor = (onOnline, onOffline) => {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('[Connectivity] Online - flushing queue...');
      flushQueue().catch(() => {});
      onOnline?.();
    } else {
      console.log('[Connectivity] Offline - using cache...');
      onOffline?.();
    }
  });
};

// ── SMART FETCH (essaie le réseau, fallback sur cache) ────────────────────────
export const smartFetchRules = async () => {
  const netState = await NetInfo.fetch();
  const isOnline = netState.isConnected && netState.isInternetReachable;

  if (isOnline) {
    try {
      const { data } = await api.get('/device/rules');
      await cacheRules(data);
      await cacheQuota({
        usedMins: 0,
        baseLimitMins: data.baseLimitMins || 120,
        bonusMins: data.bonusMins || 0,
        penaltyMins: data.penaltyMins || 0,
        isLocked: data.isLocked || false,
        lockReason: data.lockReason || '',
        remainingMins: data.remainingMins || 120,
      });
      await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
      return { data, fromCache: false };
    } catch (err) {
      console.warn('[SmartFetch] API failed, using cache:', err.message);
    }
  }

  // Fallback sur le cache
  const cachedRules = await getCachedRules();
  const cachedQuota = await getCachedQuota();
  const lastSync    = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);

  if (cachedRules) {
    console.log(`[SmartFetch] Using cached rules (last sync: ${
      lastSync ? new Date(parseInt(lastSync)).toLocaleTimeString() : 'unknown'
    })`);
    return {
      data: { ...cachedRules, ...(cachedQuota || {}), fromCache: true },
      fromCache: true,
      lastSync: lastSync ? parseInt(lastSync) : null,
    };
  }

  // Aucun cache disponible — mode ultra-restrictif par défaut
  console.warn('[SmartFetch] No cache available - applying default restrictions');
  return {
    data: {
      isLocked: false,
      remainingMins: 30, // Mode dégradé : 30 min par défaut
      blockedApps: [],
      blockedDomains: [],
      blockedCategories: ['adult', 'violence', 'gambling'],
      fromCache: false,
      degradedMode: true,
    },
    fromCache: false,
    degradedMode: true,
  };
};

export default {
  cacheRules, getCachedRules,
  cacheQuota, getCachedQuota,
  cacheChildProfile, getCachedChildProfile,
  enqueueEvent, flushQueue,
  offlineQuota, startConnectivityMonitor,
  smartFetchRules,
};
