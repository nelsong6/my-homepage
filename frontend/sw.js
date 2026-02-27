const CACHE_NAME = "app-shell-v2";
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/auth.js",
  "/config.js",
];

// ── Install: pre-cache the app shell ────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ───────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for same-origin, network-only for API/CDN ─
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip API calls — let the app handle those with its own caching
  if (url.pathname.startsWith("/api/")) return;

  // Skip Auth0 callback redirects so the auth SDK can process them
  if (url.searchParams.has("code") && url.searchParams.has("state")) return;

  // Skip cross-origin requests (Auth0 CDN, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first: try network, fall back to cache for offline support
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("/index.html");
        }
        return caches.match(event.request);
      })
  );
});
