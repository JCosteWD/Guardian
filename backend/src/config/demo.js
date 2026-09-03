const crypto = require('crypto');
const logger = require('../utils/logger');

const DEMO_PARENT_ID = 'demo-id';
const DEMO_EMAIL = 'demo@guardian.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Password123';
const DEMO_CHILD_DEVICE_ID = 'demo-device-ethan';
const LEGACY_DEMO_PASSWORDS = new Set(['Password123', 'Demo1234']);

const isProduction = () => process.env.NODE_ENV === 'production';

const isDemoMode = () => {
  if (isProduction()) {
    return process.env.DEMO_MODE === 'true';
  }
  return process.env.DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
};

const isDemoParentId = (id) => id === DEMO_PARENT_ID;
const isDemoEmail = (email) => String(email || '').trim().toLowerCase() === DEMO_EMAIL;

const passwordsMatch = (provided, expected) => {
  const input = String(provided || '');
  const candidates = new Set([String(expected || ''), ...Array.from(LEGACY_DEMO_PASSWORDS)]);

  for (const candidate of candidates) {
    const a = Buffer.from(input);
    const b = Buffer.from(candidate);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }

  return false;
};

const defaultQuota = (used, base) => ({
  usedMins: used,
  baseLimitMins: base,
  bonusMins: 0,
  penaltyMins: 0,
  isLocked: false,
  lockReason: null,
});

const makeChild = (partial) => ({
  parent_id: DEMO_PARENT_ID,
  avatar_url: null,
  is_active: true,
  last_seen: new Date(),
  bonus_mins: 0,
  penalty_mins: 0,
  is_locked: false,
  pin_hash: null,
  created_at: new Date(),
  ...partial,
});

const defaultAppsFor = (childId) => [
  {
    id: `${childId}-app-ig`,
    child_id: childId,
    package_name: 'com.instagram.android',
    app_name: 'Instagram',
    app_icon_url: null,
    is_blocked: false,
    daily_limit_mins: 30,
    allowed_time_start: null,
    allowed_time_end: null,
    blocked_reason: null,
  },
  {
    id: `${childId}-app-tt`,
    child_id: childId,
    package_name: 'com.tiktok.android',
    app_name: 'TikTok',
    app_icon_url: null,
    is_blocked: true,
    daily_limit_mins: null,
    allowed_time_start: null,
    allowed_time_end: null,
    blocked_reason: 'Contenu inapproprié',
  },
  {
    id: `${childId}-app-wa`,
    child_id: childId,
    package_name: 'com.whatsapp',
    app_name: 'WhatsApp',
    app_icon_url: null,
    is_blocked: false,
    daily_limit_mins: null,
    allowed_time_start: null,
    allowed_time_end: null,
    blocked_reason: null,
  },
];

const defaultScreenRule = (childId, daily) => ({
  id: `${childId}-rule-1`,
  child_id: childId,
  name: 'Règle principale',
  daily_limit_mins: daily,
  weekend_limit_mins: Math.round(daily * 1.5),
  bedtime_start: '21:00',
  bedtime_end: '07:00',
  school_mode_enabled: true,
  school_start: '08:00',
  school_end: '17:00',
  active_days: [1, 2, 3, 4, 5],
  is_active: true,
});

const createStore = () => {
  const children = [
    makeChild({
      id: 'ethan-id',
      first_name: 'Ethan',
      age: 17,
      avatar_color: '#3B82F6',
      device_id: 'iphone-ethan',
      device_name: 'iPhone 15 Pro',
      ai_persona_name: 'Guardian',
      ai_tone: 'friendly',
      used_mins_today: 45,
      base_limit: 180,
    }),
    makeChild({
      id: 'morgan-id',
      first_name: 'Morgan',
      age: 11,
      avatar_color: '#10B981',
      device_id: 'samsung-morgan',
      device_name: 'Samsung Galaxy A54',
      ai_persona_name: 'Pixel',
      ai_tone: 'fun',
      used_mins_today: 90,
      base_limit: 120,
      bonus_mins: 15,
    }),
    makeChild({
      id: 'lana-id',
      first_name: 'Lana',
      age: 7,
      avatar_color: '#f50bc2c5',
      device_id: 'tablet-lana',
      device_name: 'iPad Air',
      ai_persona_name: 'Guardian',
      ai_tone: 'friendly',
      used_mins_today: 60,
      base_limit: 90,
    }),
    makeChild({
      id: 'loan-id',
      first_name: 'Loan',
      age: 4,
      avatar_color: '#e4b210',
      device_id: 'tablet-loan',
      device_name: 'Tablette Android',
      ai_persona_name: 'Pixel',
      ai_tone: 'fun',
      used_mins_today: 30,
      base_limit: 60,
    }),
  ];

  return {
    children,
    appRules: Object.fromEntries(children.map((c) => [c.id, defaultAppsFor(c.id)])),
    screenRules: Object.fromEntries(children.map((c) => [c.id, [defaultScreenRule(c.id, c.base_limit)]])),
    urlRules: {},
    categories: Object.fromEntries(
      children.map((c) => [c.id, ['adult', 'violence', 'gambling', 'drugs'].map((cat) => ({
        child_id: c.id,
        category_name: cat,
        is_blocked: true,
      }))])
    ),
    grades: {},
    activities: [],
    pairing: new Map(),
    sessions: new Map(),
    refreshTokens: [],
  };
};

let store = createStore();

const resetStore = () => {
  store = createStore();
};

const demoParent = () => ({
  id: DEMO_PARENT_ID,
  email: DEMO_EMAIL,
  first_name: 'Parent',
  last_name: 'Demo',
  firstName: 'Parent',
  lastName: 'Demo',
  plan: 'premium',
  subStatus: 'active',
  pin_hash: null,
  totp_enabled: false,
  preferences: '{}',
});

const demoParentPublic = () => ({
  id: DEMO_PARENT_ID,
  email: DEMO_EMAIL,
  firstName: 'Parent',
  lastName: 'Demo',
  plan: 'premium',
  subStatus: 'active',
  hasPIN: false,
  twoFAEnabled: false,
  isDemo: true,
});

const listChildren = (parentId) => {
  if (parentId && parentId !== DEMO_PARENT_ID) return [];
  return store.children.filter((c) => c.is_active !== false);
};

const getChild = (childId) => store.children.find((c) => c.id === childId);

const ownsChild = (parentId, childId) => {
  const child = getChild(childId);
  return Boolean(child && child.parent_id === parentId);
};

const addChild = ({ firstName, age, avatarColor, aiPersonaName, aiTone }) => {
  const id = `child-${Date.now()}`;
  const defaultLimitMins = age <= 8 ? 60 : age <= 12 ? 90 : age <= 15 ? 120 : 150;
  const child = makeChild({
    id,
    first_name: firstName,
    age,
    avatar_color: avatarColor || '#6C63FF',
    device_id: null,
    device_name: null,
    ai_persona_name: aiPersonaName || 'Guardian',
    ai_tone: aiTone || 'friendly',
    last_seen: null,
    used_mins_today: 0,
    base_limit: defaultLimitMins,
  });
  store.children.push(child);
  store.appRules[id] = defaultAppsFor(id);
  store.screenRules[id] = [defaultScreenRule(id, defaultLimitMins)];
  store.categories[id] = ['adult', 'violence', 'gambling', 'drugs'].map((cat) => ({
    child_id: id,
    category_name: cat,
    is_blocked: true,
  }));
  return child;
};

const updateChild = (childId, fields) => {
  const child = getChild(childId);
  if (!child) return null;
  if (fields.firstName != null) child.first_name = fields.firstName;
  if (fields.age != null) child.age = fields.age;
  if (fields.avatarColor != null) child.avatar_color = fields.avatarColor;
  if (fields.avatarUrl != null) child.avatar_url = fields.avatarUrl;
  if (fields.aiPersonaName != null) child.ai_persona_name = fields.aiPersonaName;
  if (fields.aiTone != null) child.ai_tone = fields.aiTone;
  if (fields.deviceId != null) child.device_id = fields.deviceId;
  if (fields.deviceName != null) child.device_name = fields.deviceName;
  return child;
};

const deleteChild = (childId) => {
  const child = getChild(childId);
  if (!child) return false;
  child.is_active = false;
  return true;
};

const generatePairingCode = (childId) => {
  const code = crypto.randomBytes(4).toString('hex').toUpperCase();
  store.pairing.set(code, { childId, expiresAt: Date.now() + 86400000 });
  return code;
};

const resolvePairing = (code) => {
  const entry = store.pairing.get(String(code || '').toUpperCase());
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry.childId;
};

const setSession = (userId, type, data) => {
  store.sessions.set(`${type}:${userId}`, { ...data, loginAt: new Date().toISOString() });
};

const getSession = (userId, type) => store.sessions.get(`${type}:${userId}`) || null;

const delSession = (userId, type) => {
  store.sessions.delete(`${type}:${userId}`);
};

const saveRefresh = (userId, tokenHash) => {
  store.refreshTokens = store.refreshTokens.filter((t) => t.userId !== userId);
  store.refreshTokens.push({
    userId,
    tokenHash,
    expiresAt: Date.now() + 7 * 86400000,
    revoked: false,
  });
};

const findRefresh = (userId) =>
  store.refreshTokens.find((t) => t.userId === userId && !t.revoked && t.expiresAt > Date.now());

const revokeRefresh = (userId) => {
  store.refreshTokens.forEach((t) => {
    if (t.userId === userId) t.revoked = true;
  });
};

const getAppRules = (childId) => store.appRules[childId] || [];

const setAppRule = (childId, rule) => {
  const list = store.appRules[childId] || [];
  const idx = list.findIndex((r) => r.package_name === rule.packageName);
  const row = {
    id: idx >= 0 ? list[idx].id : `${childId}-app-${Date.now()}`,
    child_id: childId,
    package_name: rule.packageName,
    app_name: rule.appName,
    app_icon_url: rule.appIconUrl || null,
    is_blocked: Boolean(rule.isBlocked),
    daily_limit_mins: rule.dailyLimitMins ?? null,
    allowed_time_start: rule.allowedTimeStart || null,
    allowed_time_end: rule.allowedTimeEnd || null,
    blocked_reason: rule.blockedReason || null,
  };
  if (idx >= 0) list[idx] = row;
  else list.push(row);
  store.appRules[childId] = list;
  return row;
};

const deleteAppRule = (childId, packageName) => {
  store.appRules[childId] = (store.appRules[childId] || []).filter((r) => r.package_name !== packageName);
};

const getScreenRules = (childId) => store.screenRules[childId] || [];

const updateScreenRule = (childId, fields) => {
  const rules = store.screenRules[childId] || [defaultScreenRule(childId, 120)];
  const rule = rules[0];
  if (fields.dailyLimitMins != null) {
    rule.daily_limit_mins = fields.dailyLimitMins;
    const child = getChild(childId);
    if (child) child.base_limit = fields.dailyLimitMins;
  }
  if (fields.weekendLimitMins != null) rule.weekend_limit_mins = fields.weekendLimitMins;
  if (fields.bedtimeStart != null) rule.bedtime_start = fields.bedtimeStart;
  if (fields.bedtimeEnd != null) rule.bedtime_end = fields.bedtimeEnd;
  if (fields.schoolModeEnabled != null) rule.school_mode_enabled = fields.schoolModeEnabled;
  if (fields.schoolStart != null) rule.school_start = fields.schoolStart;
  if (fields.schoolEnd != null) rule.school_end = fields.schoolEnd;
  if (fields.activeDays != null) rule.active_days = fields.activeDays;
  store.screenRules[childId] = rules;
  return rule;
};

const applyQuotaDelta = (childId, { penaltyMins = 0, bonusMins = 0, lock, lockReason }) => {
  const child = getChild(childId);
  if (!child) return null;
  child.penalty_mins = (child.penalty_mins || 0) + penaltyMins;
  child.bonus_mins = (child.bonus_mins || 0) + bonusMins;
  if (lock) {
    child.is_locked = true;
    child.lock_reason = lockReason || 'Accès restreint';
  }
  return child;
};

const addActivity = (event) => {
  store.activities.unshift({ ...event, created_at: new Date() });
  store.activities = store.activities.slice(0, 200);
};

const recentActivities = (childId, limit = 20) =>
  store.activities.filter((a) => !childId || a.child_id === childId).slice(0, limit);

const dashboardFor = (childId) => {
  const child = getChild(childId);
  if (!child) return null;
  const used = child.used_mins_today || 0;
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { day: d.toISOString().split('T')[0], screen_mins: 40 + ((i * 17 + used) % 90) };
  });
  return {
    quota: {
      usedMins: used,
      baseLimitMins: child.base_limit || 120,
      bonusMins: child.bonus_mins || 0,
      penaltyMins: child.penalty_mins || 0,
      isLocked: Boolean(child.is_locked),
      lockReason: child.lock_reason || null,
    },
    recentActivities: recentActivities(childId, 8).length
      ? recentActivities(childId, 8)
      : [
          { event_type: 'app_opened', app_package: 'com.whatsapp', duration_secs: 300, created_at: new Date() },
        ],
    recentGrades: store.grades[childId] || [
      { subject: 'Mathématiques', grade: 15, max_grade: 20, grade_date: new Date() },
    ],
    pendingQuiz: null,
    weekStats: days,
  };
};

const getJwtSecret = () => {
  if (isProduction()) {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET est obligatoire en production');
    }
    return process.env.JWT_SECRET;
  }
  return process.env.JWT_SECRET || 'guardian_demo_jwt_secret_local_only_64_chars_minimum_xx';
};

const getJwtRefreshSecret = () => {
  if (isProduction()) {
    if (!process.env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_REFRESH_SECRET est obligatoire en production');
    }
    return process.env.JWT_REFRESH_SECRET;
  }
  return process.env.JWT_REFRESH_SECRET || 'guardian_demo_jwt_refresh_secret_local_only_64_chars';
};

if (isDemoMode()) {
  logger.warn('Mode démo actif — compte test demo@guardian.com / Password123 (désactivé en production)');
}

module.exports = {
  DEMO_PARENT_ID,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_CHILD_DEVICE_ID,
  isDemoMode,
  isDemoParentId,
  isDemoEmail,
  passwordsMatch,
  demoParent,
  demoParentPublic,
  resetStore,
  listChildren,
  getChild,
  ownsChild,
  addChild,
  updateChild,
  deleteChild,
  generatePairingCode,
  resolvePairing,
  setSession,
  getSession,
  delSession,
  saveRefresh,
  findRefresh,
  revokeRefresh,
  getAppRules,
  setAppRule,
  deleteAppRule,
  getScreenRules,
  updateScreenRule,
  applyQuotaDelta,
  addActivity,
  recentActivities,
  dashboardFor,
  getJwtSecret,
  getJwtRefreshSecret,
  defaultQuota,
};
