const OFFLINE_CACHE = 'offline-v1';
const OFFLINE_URL = '/offline.html';
const OFFLINE_ASSETS = [OFFLINE_URL, '/offline.webp', '/offline-mobile.webp'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(function (cache) { return cache.addAll(OFFLINE_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) {
          return k.indexOf('offline-') === 0 && k !== OFFLINE_CACHE;
        }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function offlineResponse() {
  return caches.match(OFFLINE_URL).then(function (r) {
    return r || new Response('Восстановление электропитания серверов. Пожалуйста, попробуйте позже.', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  });
}

// Сайт полностью недоступен (нет ответа или сервер отдаёт 5xx) — показываем заставку
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin && OFFLINE_ASSETS.indexOf(url.pathname) !== -1) {
    event.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
    return;
  }
  if (req.mode !== 'navigate') return;
  event.respondWith(
    fetch(req)
      .then(function (res) { return res.status >= 500 ? offlineResponse() : res; })
      .catch(offlineResponse)
  );
});

self.addEventListener('push', function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Уведомление', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Foto-Mix';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'support-ticket',
    data: { url: data.url || '/' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
