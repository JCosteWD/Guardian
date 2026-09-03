// ══════════════════════════════════════════════════════════════════════════════
// GUARDIAN – Service Worker (PWA)
// ══════════════════════════════════════════════════════════════════════════════
// Fournit le support offline et les notifications push pour le dashboard web.
// Placé dans web-parent/public/sw.js (servi à la racine via Vite config).

const CACHE_NAME     = 'guardian-v5';
const API_CACHE_NAME = 'guardian-api-v5';
const STATIC_ASSETS  = [
  '/', '/index.html', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png',
];

// ── INSTALL ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== API_CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH STRATEGY ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: Network first, fallback cache (5min TTL)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Static assets: Cache first
  if (request.method === 'GET') {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstWithCache(request) {
  const cache = await caches.open(API_CACHE_NAME);
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      // Ne cache que les GET non-sensibles
      if (request.method === 'GET' &&
          !request.url.includes('/auth/') &&
          !request.url.includes('/billing/')) {
        const cloned = response.clone();
        // Ajoute un header d'expiration
        const headers = new Headers(cloned.headers);
        headers.append('sw-cached-at', Date.now().toString());
        const cachedResponse = new Response(await cloned.blob(), {
          status: cloned.status, headers,
        });
        cache.put(request, cachedResponse);
      }
    }
    return response;
  } catch {
    // Offline: retourne le cache si disponible
    const cached = await cache.match(request);
    if (cached) {
      // Vérifie l'expiration (5 min)
      const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0');
      if (Date.now() - cachedAt < 5 * 60 * 1000) return cached;
    }
    // Retourne une réponse offline générique pour l'API
    return new Response(
      JSON.stringify({ error: 'Offline', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // SPA fallback: retourne index.html pour les routes inconnues
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('/index.html');
    }
    return new Response('Offline', { status: 503 });
  }
}

// ── PUSH NOTIFICATIONS (depuis Firebase/FCM) ─────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'Guardian', body: event.data.text() } };
  }

  const { title, body, data = {} } = payload.notification || payload;
  const icon  = '/icons/icon-192.png';
  const badge = '/icons/icon-72.png';

  const notificationOptions = {
    body,
    icon,
    badge,
    data,
    tag:     data.type || 'guardian-notif',
    renotify: true,
    requireInteraction: data.priority === 'high',
    actions: data.childId ? [
      { action: 'view',  title: '👁️ Voir',          icon: '/icons/view.png'  },
      { action: 'quick', title: '⚡ Action rapide',  icon: '/icons/action.png' },
    ] : [],
    vibrate: data.priority === 'high' ? [200, 100, 200] : [100],
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Guardian', notificationOptions)
  );
});

// ── NOTIFICATION CLICK ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const action = event.action;

  let url = '/';

  if (action === 'quick' && data.childId) {
    url = `/children/${data.childId}/quick`;
  } else if (data.type === 'tamper_attempt' && data.childId) {
    url = `/children/${data.childId}/activity`;
  } else if (data.type === 'quota_warning' && data.childId) {
    url = `/children/${data.childId}`;
  } else if (data.type === 'weekly_report' && data.childId) {
    url = `/children/${data.childId}/report`;
  } else if (data.childId) {
    url = `/children/${data.childId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Essaie de naviguer dans un onglet existant
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NAVIGATE', url });
          return;
        }
      }
      // Ouvre un nouvel onglet
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ── BACKGROUND SYNC ───────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-activity') {
    event.waitUntil(syncPendingActivity());
  }
});

async function syncPendingActivity() {
  try {
    const db = await openDB();
    const pending = await db.getAll('pending-events');

    for (const item of pending) {
      try {
        await fetch('/api/device/activity', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${item.token}` },
          body:    JSON.stringify(item.payload),
        });
        await db.delete('pending-events', item.id);
      } catch {
        // Réessaiera au prochain sync
      }
    }
  } catch (err) {
    console.warn('[SW] Background sync failed:', err);
  }
}

// ── SIMPLE INDEXEDDB HELPER ───────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('guardian-sw', 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore('pending-events', { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}
