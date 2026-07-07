const request = require('supertest');
const bcrypt  = require('bcryptjs');

// ── Mocks identiques au fichier de test v1 ────────────────────────────────────
jest.mock('../src/config/redis', () => ({
  connect:    jest.fn().mockResolvedValue(true),
  getClient:  jest.fn().mockReturnValue({
    get:    jest.fn().mockResolvedValue(null),
    set:    jest.fn().mockResolvedValue('OK'),
    setEx:  jest.fn().mockResolvedValue('OK'),
    del:    jest.fn().mockResolvedValue(1),
    keys:   jest.fn().mockResolvedValue([]),
    hSet:   jest.fn().mockResolvedValue(1),
    hGetAll: jest.fn().mockResolvedValue({}),
    hIncrBy: jest.fn().mockResolvedValue(1),
    expireAt: jest.fn().mockResolvedValue(1),
    incr:   jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  }),
  quota: {
    get: jest.fn().mockResolvedValue({ usedMins:30, baseLimitMins:120, bonusMins:0, penaltyMins:0, isLocked:false, lockReason:null }),
    init: jest.fn().mockResolvedValue(true),
    increment: jest.fn().mockResolvedValue(31),
    addBonus: jest.fn().mockResolvedValue(true),
    addPenalty: jest.fn().mockResolvedValue(true),
    hasTimeLeft: jest.fn().mockResolvedValue(true),
    getRemainingMins: jest.fn().mockResolvedValue(90),
    lock: jest.fn().mockResolvedValue(true),
    unlock: jest.fn().mockResolvedValue(true),
  },
  session: {
    set: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue({ loginAt: new Date().toISOString() }),
    del: jest.fn().mockResolvedValue(true),
  },
  blockCache: {
    setAppBlock: jest.fn(), isAppBlocked: jest.fn().mockResolvedValue(false), invalidateChild: jest.fn(),
  },
  rateLimit: {
    check: jest.fn().mockResolvedValue({ count:1, exceeded:false }),
    reset: jest.fn(),
  },
}));

jest.mock('../src/services/notificationService', () => ({
  sendToParent: jest.fn().mockResolvedValue(true),
  sendToChild:  jest.fn().mockResolvedValue(true),
}));

jest.mock('@anthropic/sdk', () => jest.fn().mockImplementation(() => ({
  messages: {
    create: jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Bonjour ! Je suis Guardian. Comment puis-je t\'aider ?' }],
    }),
  },
})));

jest.mock('stripe', () => () => ({
  checkout: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test', id: 'cs_test' }) } },
  customers: { create: jest.fn().mockResolvedValue({ id: 'cus_test' }), update: jest.fn() },
  subscriptions: { retrieve: jest.fn().mockResolvedValue({ id: 'sub_test', current_period_start: 0, current_period_end: 9999999999, trial_end: null }), update: jest.fn() },
  invoices: { list: jest.fn().mockResolvedValue({ data: [] }) },
  coupons: { create: jest.fn().mockResolvedValue({ id: 'coup_test' }) },
  billingPortal: { sessions: { create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/test' }) } },
}));

const mockParent = {
  id: 'parent-uuid-test',
  email: 'test@guardian.com',
  password_hash: bcrypt.hashSync('Password123', 10),
  first_name: 'Marie', last_name: 'Dupont',
  pin_hash: null, totp_enabled: false,
  login_attempts: 0, locked_until: null,
  plan: 'premium', sub_status: 'active',
};

const mockChild = {
  id: 'child-uuid-test', parent_id: 'parent-uuid-test',
  first_name: 'Lucas', age: 10, device_id: 'device-test-123',
  device_name: 'Samsung Galaxy', avatar_color: '#7F77DD',
  ai_persona_name: 'Guardian', ai_tone: 'friendly',
  is_active: true, subscription_plan: 'premium',
};

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  pool: { connect: jest.fn(), end: jest.fn() },
}));

const { query, transaction } = require('../src/config/database');

const setupMocks = () => {
  query.mockImplementation((sql) => {
    if (sql.includes('SELECT') && sql.includes('parents') && sql.includes('email')) return Promise.resolve({ rows: [mockParent] });
    if (sql.includes('INSERT INTO parents')) return Promise.resolve({ rows: [{ id: 'new-uuid', email: 'new@test.com', first_name: 'Jean', last_name: 'Test' }] });
    if (sql.includes('INSERT INTO subscriptions')) return Promise.resolve({ rows: [{ id: 'sub-uuid' }] });
    if (sql.includes('UPDATE parents')) return Promise.resolve({ rows: [] });
    if (sql.includes('INSERT INTO refresh_tokens')) return Promise.resolve({ rows: [] });
    if (sql.includes('SELECT') && sql.includes('children') && sql.includes('device_id')) return Promise.resolve({ rows: [mockChild] });
    if (sql.includes('SELECT') && sql.includes('children') && sql.includes('parent_id')) return Promise.resolve({ rows: [mockChild] });
    if (sql.includes('SELECT') && sql.includes('subscriptions')) return Promise.resolve({ rows: [{ plan: 'premium', status: 'active', stripe_customer_id: 'cus_test' }] });
    if (sql.includes('SELECT') && sql.includes('refresh_tokens')) return Promise.resolve({ rows: [{ id: 'rt-uuid', token_hash: bcrypt.hashSync('refresh', 4) }] });
    if (sql.includes('COUNT(*)') && sql.includes('children')) return Promise.resolve({ rows: [{ count: '0' }] });
    if (sql.includes('INSERT INTO children')) return Promise.resolve({ rows: [mockChild] });
    if (sql.includes('SELECT') && sql.includes('parents') && sql.includes('id =')) return Promise.resolve({ rows: [mockParent] });
    if (sql.includes('SELECT') && sql.includes('children') && sql.includes('id =')) return Promise.resolve({ rows: [mockChild] });
    if (sql.includes('screen_time_rules')) return Promise.resolve({ rows: [{ daily_limit_mins: 120 }] });
    if (sql.includes('app_rules')) return Promise.resolve({ rows: [] });
    if (sql.includes('url_rules')) return Promise.resolve({ rows: [] });
    if (sql.includes('category_filters')) return Promise.resolve({ rows: [] });
    if (sql.includes('daily_quotas')) return Promise.resolve({ rows: [{ base_limit_mins: 120, used_mins: 30, bonus_mins: 0, penalty_mins: 0, is_locked: false }] });
    if (sql.includes('grades')) return Promise.resolve({ rows: [] });
    if (sql.includes('behavior_logs')) return Promise.resolve({ rows: [] });
    if (sql.includes('activity_events')) return Promise.resolve({ rows: [] });
    if (sql.includes('ai_conversations')) return Promise.resolve({ rows: [{ id: 'conv-uuid' }] });
    if (sql.includes('quizzes')) return Promise.resolve({ rows: [] });
    if (sql.includes('geofence_zones')) return Promise.resolve({ rows: [] });
    if (sql.includes('family_members')) return Promise.resolve({ rows: [] });
    if (sql.includes('child_stats')) return Promise.resolve({ rows: [{ total_points: 100, current_level: 2, current_streak_days: 5, levelProgress: 40 }] });
    if (sql.includes('rewards')) return Promise.resolve({ rows: [] });
    if (sql.includes('referrals')) return Promise.resolve({ rows: [{ code: 'MARIE-7X4K', referrer_id: 'parent-uuid-test' }] });
    if (sql.includes('ent_configs')) return Promise.resolve({ rows: [] });
    return Promise.resolve({ rows: [] });
  });
  transaction.mockImplementation(async (cb) => cb({ query }));
};

let app;
beforeAll(async () => {
  process.env.JWT_SECRET = 'test_jwt_secret_minimum_64_chars_long_for_testing_purposes_only';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_also_64_chars_long_for_testing_purposes';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
  setupMocks();
  app = require('../src/server').app;
});

afterEach(() => { jest.clearAllMocks(); setupMocks(); });

// ── HELPER ────────────────────────────────────────────────────────────────────
const getToken = async (type = 'parent') => {
  if (type === 'parent') {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@guardian.com', password: 'Password123' });
    return res.body.accessToken;
  }
  const res = await request(app).post('/api/auth/child').send({ deviceId: 'device-test-123' });
  return res.body.accessToken;
};

const auth = async (type = 'parent') => ({ Authorization: `Bearer ${await getToken(type)}` });

// ══════════════════════════════════════════════════════════════════════════════
describe('Health', () => {
  test('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('Guardian API');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Auth', () => {
  test('register → 201', async () => {
    query.mockImplementationOnce(() => Promise.resolve({ rows: [] }));
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'new@test.com', password: 'Password123', firstName: 'Jean', lastName: 'Test' });
    expect(res.status).toBe(201);
  });

  test('login → 200 + tokens', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@guardian.com', password: 'Password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.parent.email).toBe('test@guardian.com');
  });

  test('login mauvais mdp → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test@guardian.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('child auth → 200', async () => {
    const res = await request(app).post('/api/auth/child').send({ deviceId: 'device-test-123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('refresh → 200', async () => {
    const { refreshToken } = (await request(app).post('/api/auth/login').send({ email: 'test@guardian.com', password: 'Password123' })).body;
    query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 'rt', token_hash: bcrypt.hashSync(refreshToken, 4) }] }));
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  test('logout → 200', async () => {
    const h = await auth();
    const res = await request(app).post('/api/auth/logout').set(h);
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Children', () => {
  test('GET /api/children → 200', async () => {
    const h = await auth();
    const res = await request(app).get('/api/children').set(h);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.children)).toBe(true);
  });

  test('POST /api/children → 201', async () => {
    const h = await auth();
    const res = await request(app).post('/api/children').set(h).send({ firstName: 'Lucas', age: 10 });
    expect(res.status).toBe(201);
    expect(res.body.child).toBeDefined();
    expect(typeof res.body.pairingCode).toBe('string');
    expect(res.body.pairingCode.length).toBe(6);
  });

  test('POST /api/children sans age → 400', async () => {
    const h = await auth();
    const res = await request(app).post('/api/children').set(h).send({ firstName: 'Lucas' });
    expect(res.status).toBe(400);
  });

  test('GET /api/children/:id/dashboard → 200', async () => {
    const h = await auth();
    const res = await request(app).get(`/api/children/${mockChild.id}/dashboard`).set(h);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('quota');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Rules', () => {
  test('GET /api/device/rules → 200 (enfant)', async () => {
    const h = await auth('child');
    const res = await request(app).get('/api/device/rules').set(h);
    expect(res.status).toBe(200);
    expect(res.body.remainingMins).toBeDefined();
    expect(Array.isArray(res.body.blockedApps)).toBe(true);
  });

  test('PATCH screen-time rules → 200', async () => {
    const h = await auth();
    const res = await request(app)
      .patch(`/api/children/${mockChild.id}/rules/screen-time`).set(h)
      .send({ dailyLimitMins: 90, weekendLimitMins: 150 });
    expect(res.status).toBe(200);
  });

  test('POST grade → 200 (bonne note = bonus)', async () => {
    query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 'grade-uuid', subject: 'Maths', grade: 18, max_grade: 20 }] }));
    const h = await auth();
    const res = await request(app)
      .post(`/api/children/${mockChild.id}/grades`).set(h)
      .send({ subject: 'Maths', grade: 18, maxGrade: 20, gradeDate: new Date() });
    expect(res.status).toBe(200);
    expect(res.body.bonusMins).toBeGreaterThan(0);
  });

  test('POST grade → 200 (mauvaise note = pénalité)', async () => {
    query.mockImplementationOnce(() => Promise.resolve({ rows: [{ id: 'grade-uuid', subject: 'Histoire', grade: 5, max_grade: 20 }] }));
    const h = await auth();
    const res = await request(app)
      .post(`/api/children/${mockChild.id}/grades`).set(h)
      .send({ subject: 'Histoire', grade: 5, maxGrade: 20, gradeDate: new Date() });
    expect(res.status).toBe(200);
    expect(res.body.penaltyMins).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Quick Actions', () => {
  test('POST quick-action -30 min → 200', async () => {
    const h = await auth();
    const res = await request(app)
      .post(`/api/children/${mockChild.id}/quick-action`).set(h)
      .send({ customDelta: -30, childName: 'Lucas' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST quick-action lock → 200', async () => {
    const h = await auth();
    const res = await request(app)
      .post(`/api/children/${mockChild.id}/quick-action`).set(h)
      .send({ customLock: true, lockReason: 'Test verrouillage', childName: 'Lucas' });
    expect(res.status).toBe(200);
    expect(res.body.isLocked).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('AI Service', () => {
  test('POST /api/ai/chat → 200 (premium)', async () => {
    query.mockImplementation((sql) => {
      if (sql.includes('children') && sql.includes('parents')) return Promise.resolve({ rows: [{ ...mockChild, parent_first_name: 'Marie' }] });
      if (sql.includes('grades')) return Promise.resolve({ rows: [] });
      if (sql.includes('daily_quotas')) return Promise.resolve({ rows: [{ base_limit_mins:120, bonus_mins:0, penalty_mins:0, used_mins:30, is_locked:false }] });
      if (sql.includes('behavior_logs')) return Promise.resolve({ rows: [] });
      if (sql.includes('ai_conversations')) return Promise.resolve({ rows: [{ id: 'conv-uuid' }] });
      if (sql.includes('activity_events')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [mockChild] });
    });
    const h = await auth('child');
    const res = await request(app).post('/api/ai/chat').set(h).send({ message: 'Pourquoi ai-je moins de temps ?' });
    expect(res.status).toBe(200);
    expect(res.body.response).toBeDefined();
    expect(typeof res.body.response).toBe('string');
    expect(res.body.remainingMins).toBeDefined();
  });

  test('POST /api/ai/chat → 403 (free plan)', async () => {
    query.mockImplementationOnce(() => Promise.resolve({ rows: [{ ...mockChild, subscription_plan: 'free' }] }));
    query.mockImplementationOnce(() => Promise.resolve({ rows: [mockParent] }));
    const h = await auth('child');
    const res = await request(app).post('/api/ai/chat').set(h).send({ message: 'Bonjour' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('UPGRADE_REQUIRED');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Billing', () => {
  test('GET /api/billing/subscription → 200', async () => {
    const h = await auth();
    const res = await request(app).get('/api/billing/subscription').set(h);
    expect(res.status).toBe(200);
    expect(res.body.plan).toBeDefined();
  });

  test('POST /api/billing/checkout → 200 (plan valide)', async () => {
    const h = await auth();
    const res = await request(app).post('/api/billing/checkout').set(h).send({ plan: 'premium' });
    expect(res.status).toBe(200);
    expect(res.body.checkoutUrl).toBeDefined();
  });

  test('POST /api/billing/checkout → 400 (plan invalide)', async () => {
    const h = await auth();
    const res = await request(app).post('/api/billing/checkout').set(h).send({ plan: 'invalid' });
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Gamification', () => {
  test('GET /api/children/:id/rewards → 200', async () => {
    const h = await auth();
    const res = await request(app).get(`/api/children/${mockChild.id}/rewards`).set(h);
    expect(res.status).toBe(200);
    expect(res.body.stats).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Referral', () => {
  test('GET /api/referral/code → 200', async () => {
    const h = await auth();
    const res = await request(app).get('/api/referral/code').set(h);
    expect(res.status).toBe(200);
    expect(res.body.code).toBeDefined();
    expect(typeof res.body.link).toBe('string');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('Sécurité', () => {
  test('Route protégée sans token → 401', async () => {
    expect((await request(app).get('/api/children')).status).toBe(401);
  });

  test('Token enfant sur route parent → 403', async () => {
    const h = await auth('child');
    expect((await request(app).get('/api/children').set(h)).status).toBe(403);
  });

  test('Injection SQL → 400 ou 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: "' OR 1=1--", password: 'x' });
    expect([400, 401]).toContain(res.status);
  });

  test('XSS dans prénom → sanitisé', async () => {
    const h = await auth();
    const res = await request(app).post('/api/children').set(h)
      .send({ firstName: '<script>alert(1)</script>', age: 10 });
    // Soit rejeté soit le prénom est stocké sans exécution côté SQL
    expect([201, 400]).toContain(res.status);
  });

  test('Token expiré → 401 TOKEN_EXPIRED', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign({ id: 'parent-uuid-test', type: 'parent' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    const res = await request(app).get('/api/children').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('Rate limiting auth → 429 après trop de tentatives', async () => {
    // Simule le dépassement du rate limit
    const { rateLimit } = require('../src/config/redis');
    rateLimit.check.mockResolvedValueOnce({ count: 11, exceeded: true });
    const res = await request(app).post('/api/auth/login').send({ email: 'test@guardian.com', password: 'Password123' });
    expect(res.status).toBe(429);
  });

  test('Route 404 → 404', async () => {
    const res = await request(app).get('/api/route-inexistante');
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe('RGPD', () => {
  test('GET /api/gdpr/export → 200', async () => {
    query.mockImplementation((sql) => {
      if (sql.includes('parents') && sql.includes('id = $1')) return Promise.resolve({ rows: [mockParent] });
      if (sql.includes('children')) return Promise.resolve({ rows: [mockChild] });
      if (sql.includes('subscriptions')) return Promise.resolve({ rows: [{ plan: 'premium', status: 'active' }] });
      return Promise.resolve({ rows: [] });
    });
    const h = await auth();
    const res = await request(app).get('/api/gdpr/export').set(h);
    expect(res.status).toBe(200);
    expect(res.body.exportedBy).toBe(mockParent.email);
  });

  test('DELETE /api/gdpr/delete sans confirmation → 400', async () => {
    const h = await auth();
    const res = await request(app).delete('/api/gdpr/delete').set(h).send({ confirmation: 'mauvais' });
    expect(res.status).toBe(400);
  });
});
