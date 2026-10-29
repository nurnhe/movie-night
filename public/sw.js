// Lets the installed app open without a connection. Only this site's own files are cached:
// Firebase and TMDB requests always go to the network, so the shared list is never served stale from here.
const CACHE = "movie-night-v2";
const SHELL = ["./", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // Pages: always try for the latest deploy, fall back to the last one seen when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put("./", res.clone()));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  // Built files have content hashes in their names, so a cached copy never goes out of date.
  event.respondWith(
    caches.match(req).then((hit) =>
      hit ?? fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }),
    ),
  );
});
