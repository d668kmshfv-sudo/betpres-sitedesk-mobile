const CACHE = "betpres-sitedesk-online-1.8.0";
const CACHE_PREFIX = "betpres-sitedesk-online-";
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "assets/styles/app.css?v=5.8.0", "assets/styles/appearance-settings.css?v=5.1.0",
  "assets/styles/ai-assistant.css?v=5.1.0", "assets/styles/material-samples.css?v=5.1.0", "assets/styles/material-samples-simple.css?v=5.8.0", "assets/styles/document-settings.css?v=5.8.0", "assets/styles/ipad.css?v=1.1.0", "assets/styles/ux-refresh.css?v=5.8.0", "assets/styles/apple-design.css?v=5.3.2", "assets/styles/mobile-worker-entry.css?v=5.8.0", "assets/styles/operations-refresh.css?v=5.8.0", "assets/styles/apple-system-5.5.css?v=5.5.1", "assets/styles/apple-calendar.css?v=5.6.0", "assets/styles/mobile-work-statements.css?v=5.6.3", "assets/styles/mobile-form-keyboard.css?v=5.8.0", "assets/styles/site-diary.css?v=5.8.0", "assets/styles/site-diary-calm.css?v=5.8.0", "assets/styles/site-diary-subcontractors.css?v=5.8.0", "assets/styles/coordination-on-demand.css?v=5.8.0", "assets/styles/archive-usability.css?v=5.8.0", "assets/styles/apple-timesheets-desktop.css?v=5.8.0", "assets/styles/work-statement-calm.css?v=5.8.0", "assets/styles/app-visibility.css?v=5.8.0", "assets/styles/timesheet-clarity.css?v=5.8.0",
  "assets/styles/subcontract-admin.css?v=5.8.0", "assets/styles/module-permissions-admin.css?v=5.8.0",
  "assets/images/app-icon.png", "assets/images/navigation-logo.png", "assets/images/document-logo.png", "assets/images/betpres-letterhead-2026.jpg", "assets/data/shmu-history.json?v=5.8.0",
  "assets/js/ipad-bridge.js?v=5.8.0", "assets/js/bootstrap/startup-guard.js?v=5.6.0",
  "assets/js/features/subcontract-admin.js?v=5.8.0", "assets/js/features/module-permissions-admin.js?v=5.8.0",
  "assets/js/data/seed-data.js?v=5.1.0", "assets/js/data/material-passport-data.js?v=5.1.0",
  "assets/js/vendor/jszip.min.js", "assets/js/vendor/exceljs.min.js", "assets/js/vendor/pdfjs/pdf.mjs", "assets/js/vendor/pdfjs/pdf.worker.mjs", "assets/js/legacy/sitedesk-core.js?v=5.8.0",
  "assets/js/features/work-spreadsheet.js?v=5.1.0", "assets/js/features/work-statement-roundtrip.js?v=5.2.15",
  "assets/js/features/pdf-preview.js?v=5.8.0", "assets/js/features/billing-period-pdf.js?v=5.8.0", "assets/js/features/timesheet-pdf-export.js?v=5.2.15",
  "assets/js/features/mobile-diary-dashboard.js?v=5.2.15", "assets/js/features/appearance-settings.js?v=5.3.1", "assets/js/features/document-settings.js?v=5.8.0",
  "assets/js/features/ai-assistant.js?v=5.2.15", "assets/js/features/material-samples.js?v=5.2.15", "assets/js/features/material-samples-simple.js?v=5.8.0", "assets/js/features/ux-refresh.js?v=5.2.15", "assets/js/features/apple-motion.js?v=5.6.0", "assets/js/features/mobile-worker-entry.js?v=5.8.0", "assets/js/features/mobile-work-carousel.js?v=5.6.3", "assets/js/features/site-diary-print.js?v=5.8.0", "assets/js/features/site-diary.js?v=5.8.0", "assets/js/features/site-diary-subcontractors.js?v=5.8.0", "assets/js/features/site-diary-missing-days.js?v=5.8.0", "assets/js/features/site-diary-day-files.js?v=5.8.0", "assets/js/features/archive-usability.js?v=5.8.0", "assets/js/features/mobile-form-keyboard.js?v=5.8.0", "assets/js/features/apple-calendar.js?v=5.8.0"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const scopePath = new URL(self.registration.scope).pathname;
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("index.html");
      if (shell) return shell;
    }
    return new Response("Nedostupné offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }));
});
