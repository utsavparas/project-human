// Project Human · Service Worker · V1.0
// Handles scheduled notifications and offline caching

const CACHE_NAME = 'project-human-v1';
const APP_URL = '/project-human/';

// ── Notification scheduling ──
// Timers stored in SW scope — persist while SW is alive
const scheduledTimers = {};

self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SCHEDULE_NOTIF') {
    const { id, delay, title, body } = e.data;

    // Clear any existing timer with this id
    if (scheduledTimers[id]) {
      clearTimeout(scheduledTimers[id]);
      delete scheduledTimers[id];
    }

    scheduledTimers[id] = setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/project-human/icon-192.png',
        badge: '/project-human/icon-192.png',
        tag: id,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200],
        data: { url: APP_URL }
      });
      delete scheduledTimers[id];
    }, delay);
  }

  if (e.data.type === 'CANCEL_NOTIF') {
    const { id } = e.data;
    if (scheduledTimers[id]) {
      clearTimeout(scheduledTimers[id]);
      delete scheduledTimers[id];
    }
  }

  // Heartbeat — client pings to keep SW alive
  if (e.data.type === 'PING') {
    e.source.postMessage({ type: 'PONG' });
  }
});

// ── Notification click ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || APP_URL;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/project-human') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Install & cache app shell ──
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        '/project-human/',
        '/project-human/index.html',
      ]).catch(() => {})
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch — network first, cache fallback ──
self.addEventListener('fetch', e => {
  // Only handle same-origin requests for the app
  if (!e.request.url.includes('/project-human')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
