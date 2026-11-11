/*
 * Offline support for the installed app. Network first (so a new version shows
 * up as soon as it's online), falling back to the last copy when offline.
 * Only this site's own files are cached: the online rooms always go to the network.
 */
const CACHE = 'kratunball-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png']))
      .catch(() => {}),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(nav ? './' : req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(nav ? './' : req, { ignoreSearch: nav }).then((r) => r || Response.error()),
      ),
  );
});
