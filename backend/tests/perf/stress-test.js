// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Tests de stress et de pic (k6)
// ══════════════════════════════════════════════════════════════════════════════
// Stress test : trouve le point de rupture du système
// Spike test  : simule un pic soudain de trafic (ex: pic viral, rentrée scolaire)

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');
const BASE_URL  = __ENV.BASE_URL || 'http://localhost:3000/api';

// ══════════════════════════════════════════════════════════════════════════════
// STRESS TEST — Montée progressive jusqu'à la rupture
// ══════════════════════════════════════════════════════════════════════════════
export const stressOptions = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 150 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 500 },   // Au-delà de la charge normale attendue
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // Tolérance plus large en stress
    http_req_failed:   ['rate<0.10'],   // Jusqu'à 10% d'erreurs acceptable en stress
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// SPIKE TEST — Pic soudain (ex: notification push de masse, rentrée)
// ══════════════════════════════════════════════════════════════════════════════
export const spikeOptions = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: 5 },     // Charge de base
        { duration: '10s', target: 400 },   // 🔺 PIC SOUDAIN (8x en 10s)
        { duration: '1m',  target: 400 },   // Maintien du pic
        { duration: '10s', target: 5 },     // Retour à la normale
        { duration: '30s', target: 5 },     // Observation post-pic
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed:   ['rate<0.15'],
  },
};

// Choix du scénario via variable d'env: k6 run -e SCENARIO=spike perf-tests/stress-test.js
export const options = __ENV.SCENARIO === 'spike' ? spikeOptions : stressOptions;

// ── ENDPOINTS LES PLUS CRITIQUES (priorité au quota temps réel) ──────────────
export default function () {
  // 1. Health check (doit toujours répondre, même sous charge extrême)
  const health = http.get(`${BASE_URL}/health`);
  check(health, { 'health check OK': (r) => r.status === 200 }) || errorRate.add(1);

  // 2. Route de règles enfant (la plus appelée — toutes les minutes par appareil)
  const rulesRes = http.get(`${BASE_URL}/device/rules`, {
    headers: { 'Authorization': `Bearer fake_token_${__VU}` },
  });
  // On accepte 401 (token invalide attendu) mais pas 500 (crash serveur)
  check(rulesRes, {
    'rules endpoint does not crash': (r) => r.status !== 500 && r.status !== 502 && r.status !== 503,
  }) || errorRate.add(1);

  sleep(0.5);
}

// ══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET STRESS TEST (connexions simultanées)
// ══════════════════════════════════════════════════════════════════════════════
import ws from 'k6/ws';

export function websocketStressTest() {
  const url = (__ENV.BASE_URL || 'ws://localhost:3000').replace('http', 'ws');

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        event: 'identify',
        data: { type: 'parent', id: `loadtest_${__VU}` },
      }));
    });

    socket.on('message', (msg) => {
      check(msg, { 'received valid message': (m) => m.length > 0 });
    });

    socket.on('error', (e) => {
      console.error('WebSocket error:', e);
      errorRate.add(1);
    });

    // Maintient la connexion ouverte 30s (simule un dashboard ouvert)
    socket.setTimeout(() => socket.close(), 30000);
  });

  check(res, { 'WS connection established': (r) => r && r.status === 101 });
}

export const wsOptions = {
  scenarios: {
    websocket_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // 100 connexions WebSocket simultanées
        { duration: '1m',  target: 100 },
        { duration: '30s', target: 0 },
      ],
      exec: 'websocketStressTest',
    },
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// GUIDE D'INTERPRÉTATION DES RÉSULTATS
// ══════════════════════════════════════════════════════════════════════════════
/*
✅ BON SIGNE:
- http_req_failed reste < 5% même à 300 VUs
- p95 reste sous 1s à charge normale (50 VUs)
- Le serveur récupère rapidement après le pic (spike test)

⚠️ SIGNAUX D'ALERTE:
- Erreurs 500/502/503 qui apparaissent (crash ou timeout backend)
- p99 qui explose (>5s) — indique une saturation des connexions DB/Redis
- Le serveur ne récupère pas après le pic — fuite mémoire ou connexions DB non libérées

🔧 ACTIONS RECOMMANDÉES SI ÉCHEC:
1. Vérifier le pool de connexions PostgreSQL (max_connections, pool size côté Node)
2. Vérifier les limites Redis (maxmemory-policy)
3. Augmenter les replicas API (déjà 2 dans docker-compose.prod.yml)
4. Ajouter un cache supplémentaire sur /device/rules (appelé très fréquemment)
5. Vérifier les index PostgreSQL sur les requêtes lentes (EXPLAIN ANALYZE)
*/
