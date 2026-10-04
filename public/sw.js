const CACHE_NAME = "moneypilot-shell-v1";
const RUNTIME_CACHE = "moneypilot-runtime-v1";
const APP_SHELL = ["/offline.html", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      }).catch(async () => {
        const cachedPage = await caches.match(request);
        if (cachedPage) return cachedPage;
        const offlinePage = await caches.match("/offline.html");
        if (!offlinePage) throw new Error("MoneyPilot offline page is not available in cache.");
        return offlinePage;
      }),
    );
    return;
  }

  const url = new URL(request.url);
  const isStaticAsset = url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|ico|js|png|svg|webp|woff2?)$/i.test(url.pathname);
  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    })),
  );
});
