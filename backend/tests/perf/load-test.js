// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Tests de performance / charge (k6)
// ══════════════════════════════════════════════════════════════════════════════
// Installation: https://k6.io/docs/get-started/installation/
//   brew install k6   (macOS)
//   apt install k6    (Ubuntu, via repo k6)
//
// Usage:
//   k6 run perf-tests/load-test.js
//   k6 run --vus 50 --duration 60s perf-tests/load-test.js
//   k6 run perf-tests/stress-test.js
//   k6 run perf-tests/spike-test.js
//
// Visualisation: k6 run --out json=results.json puis k6-reporter ou Grafana

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ── MÉTRIQUES CUSTOM ───────────────────────────────────────────────────────────
const errorRate       = new Rate('errors');
const loginDuration    = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const aiChatDuration   = new Trend('ai_chat_duration');
const quotaChecks      = new Counter('quota_checks');

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';

// Scénario par défaut : montée en charge progressive
export const options = {
  scenarios: {
    // Charge normale simulée (usage quotidien)
    normal_load: {
      executor:    'ramping-vus',
      startVUs:    0,
      stages: [
        { duration: '30s', target: 20 },   // Montée à 20 utilisateurs
        { duration: '1m',  target: 50 },   // Montée à 50 utilisateurs
        { duration: '2m',  target: 50 },   // Maintien 50 utilisateurs
        { duration: '30s', target: 0 },    // Descente
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_duration:        ['p(95)<500', 'p(99)<1500'],  // 95% sous 500ms
    http_req_failed:          ['rate<0.01'],                 // < 1% d'erreurs
    errors:                   ['rate<0.05'],
    login_duration:           ['p(95)<800'],
    dashboard_duration:       ['p(95)<600'],
    ai_chat_duration:         ['p(95)<3000'],  // L'IA est naturellement plus lente
  },
};

// ── DONNÉES DE TEST ───────────────────────────────────────────────────────────
const TEST_USERS = Array.from({ length: 50 }, (_, i) => ({
  email:    `loadtest_${i}@guardian-test.com`,
  password: 'LoadTest123',
}));

// ── SETUP (exécuté une fois avant le test) ────────────────────────────────────
export function setup() {
  console.log(`🚀 Starting load test against ${BASE_URL}`);
  // Vérifie que l'API répond
  const health = http.get(`${BASE_URL}/health`);
  if (health.status !== 200) {
    throw new Error('API health check failed — aborting load test');
  }
  return { startTime: Date.now() };
}

// ── SCÉNARIO PRINCIPAL ─────────────────────────────────────────────────────────
export default function () {
  const user = randomItem(TEST_USERS);
  let accessToken = null;
  let childId = null;

  group('1. Authentification', () => {
    const loginStart = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: user.email, password: user.password,
    }), { headers: { 'Content-Type': 'application/json' } });

    loginDuration.add(Date.now() - loginStart);

    const success = check(res, {
      'login status is 200': (r) => r.status === 200,
      'has access token':    (r) => r.json('accessToken') !== undefined,
    });
    errorRate.add(!success);

    if (success) accessToken = res.json('accessToken');
  });

  if (!accessToken) {
    sleep(1);
    return; // Skip le reste si login échoue
  }

  const authHeaders = {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
  };

  group('2. Liste des enfants', () => {
    const res = http.get(`${BASE_URL}/children`, authHeaders);
    const success = check(res, {
      'children status is 200': (r) => r.status === 200,
      'children is array':      (r) => Array.isArray(r.json('children')),
    });
    errorRate.add(!success);

    if (success && res.json('children').length > 0) {
      childId = res.json('children')[0].id;
    }
  });

  if (childId) {
    group('3. Dashboard enfant', () => {
      const dashStart = Date.now();
      const res = http.get(`${BASE_URL}/children/${childId}/dashboard`, authHeaders);
      dashboardDuration.add(Date.now() - dashStart);

      const success = check(res, {
        'dashboard status is 200': (r) => r.status === 200,
        'has quota data':          (r) => r.json('quota') !== undefined,
      });
      errorRate.add(!success);
      quotaChecks.add(1);
    });

    group('4. Action rapide (quick-action)', () => {
      const res = http.post(
        `${BASE_URL}/children/${childId}/quick-action`,
        JSON.stringify({ customDelta: 0, childName: 'LoadTest' }),
        authHeaders
      );
      check(res, { 'quick-action status is 200': (r) => r.status === 200 });
    });

    group('5. Historique d\'activité', () => {
      const res = http.get(`${BASE_URL}/children/${childId}/activity-stream?days=7`, authHeaders);
      check(res, { 'activity status is 200': (r) => r.status === 200 });
    });
  }

  group('6. Notifications', () => {
    const res = http.get(`${BASE_URL}/notifications?limit=20`, authHeaders);
    check(res, { 'notifications status is 200': (r) => r.status === 200 });
  });

  // Simule le temps de lecture/réflexion d'un utilisateur réel
  sleep(Math.random() * 3 + 1); // 1-4 secondes
}

// ── SCÉNARIO IA (séparé, car plus coûteux) ────────────────────────────────────
export function aiChatScenario() {
  const user = randomItem(TEST_USERS);

  const loginRes = http.post(`${BASE_URL}/auth/child`, JSON.stringify({
    deviceId: `loadtest_device_${__VU}`,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (loginRes.status !== 200) return;

  const token = loginRes.json('accessToken');
  const headers = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };

  const messages = [
    'Pourquoi ai-je moins de temps ?',
    'Je veux faire un quiz',
    'Comment gagner du temps bonus ?',
  ];

  const aiStart = Date.now();
  const res = http.post(
    `${BASE_URL}/ai/chat`,
    JSON.stringify({ message: randomItem(messages) }),
    headers
  );
  aiChatDuration.add(Date.now() - aiStart);

  check(res, {
    'ai chat status is 200 or 403': (r) => [200, 403].includes(r.status),
  });

  sleep(2);
}

// ── TEARDOWN ───────────────────────────────────────────────────────────────────
export function teardown(data) {
  const durationSec = (Date.now() - data.startTime) / 1000;
  console.log(`✅ Load test completed in ${durationSec.toFixed(1)}s`);
}

// ── RAPPORT PERSONNALISÉ (résumé console) ─────────────────────────────────────
export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    'perf-tests/results/summary.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  const m = data.metrics;
  return `
╔══════════════════════════════════════════════════════════════╗
║              GUARDIAN – RÉSULTATS LOAD TEST                   ║
╠══════════════════════════════════════════════════════════════╣
║ Requêtes totales:        ${String(m.http_reqs?.values?.count || 0).padEnd(36)}║
║ Taux d'erreur:           ${((m.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%${' '.repeat(34)}║
║ Durée moyenne (p50):     ${(m.http_req_duration?.values?.med || 0).toFixed(0)}ms${' '.repeat(32)}║
║ Durée p95:               ${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(0)}ms${' '.repeat(32)}║
║ Durée p99:               ${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(0)}ms${' '.repeat(32)}║
║ Login p95:               ${(m.login_duration?.values?.['p(95)'] || 0).toFixed(0)}ms${' '.repeat(32)}║
║ Dashboard p95:           ${(m.dashboard_duration?.values?.['p(95)'] || 0).toFixed(0)}ms${' '.repeat(32)}║
╚══════════════════════════════════════════════════════════════╝
`;
}
