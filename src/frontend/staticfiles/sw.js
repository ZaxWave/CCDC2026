const CACHE = 'lightscan-runtime-v2';

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/api/')) return;
  if (e.request.mode === 'navigate') return;

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && res.type === 'basic') {
        const cacheable = /\.(svg|png|jpg|jpeg|webp|woff2?)($|\?)/i.test(new URL(e.request.url).pathname);
        if (cacheable) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
