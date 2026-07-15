const CACHE = "betpres-sitedesk-ipad-1.0.0";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "assets/styles/app.css", "assets/styles/appearance-settings.css",
  "assets/styles/ai-assistant.css", "assets/styles/material-samples.css", "assets/styles/ipad.css",
  "assets/images/app-icon.png", "assets/images/navigation-logo.png", "assets/images/document-logo.png",
  "assets/js/ipad-bridge.js", "assets/js/bootstrap/startup-guard.js",
  "assets/js/data/seed-data.js", "assets/js/data/material-passport-data.js",
  "assets/js/vendor/jszip.min.js", "assets/js/legacy/sitedesk-core.js",
  "assets/js/features/work-spreadsheet.js", "assets/js/features/work-statement-roundtrip.js",
  "assets/js/features/pdf-preview.js", "assets/js/features/timesheet-pdf-export.js",
  "assets/js/features/mobile-diary-dashboard.js", "assets/js/features/appearance-settings.js",
  "assets/js/features/ai-assistant.js", "assets/js/features/material-samples.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("index.html"))));
});
