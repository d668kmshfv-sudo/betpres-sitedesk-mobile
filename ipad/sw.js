const CACHE = "betpres-sitedesk-online-1.1.7";
const CACHE_PREFIX = "betpres-sitedesk-online-";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "assets/styles/app.css?v=5.1.3", "assets/styles/appearance-settings.css?v=5.1.0",
  "assets/styles/ai-assistant.css?v=5.1.0", "assets/styles/material-samples.css?v=5.1.0", "assets/styles/ipad.css?v=1.1.0",
  "assets/images/app-icon.png", "assets/images/navigation-logo.png", "assets/images/document-logo.png",
  "assets/js/ipad-bridge.js?v=1.1.7", "assets/js/bootstrap/startup-guard.js?v=5.1.0",
  "assets/js/data/seed-data.js?v=5.1.0", "assets/js/data/material-passport-data.js?v=5.1.0",
  "assets/js/vendor/jszip.min.js", "assets/js/vendor/exceljs.min.js", "assets/js/legacy/sitedesk-core.js?v=5.1.7",
  "assets/js/features/work-spreadsheet.js?v=5.1.0", "assets/js/features/work-statement-roundtrip.js?v=5.1.0",
  "assets/js/features/pdf-preview.js?v=5.1.5", "assets/js/features/timesheet-pdf-export.js?v=5.1.7",
  "assets/js/features/mobile-diary-dashboard.js?v=5.1.0", "assets/js/features/appearance-settings.js?v=5.1.0",
  "assets/js/features/ai-assistant.js?v=5.1.0", "assets/js/features/material-samples.js?v=5.1.0"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match("index.html"))));
});
