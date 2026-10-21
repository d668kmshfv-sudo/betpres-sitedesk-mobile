window.__BETPRES_NAV_READY__ = false;
window.__BETPRES_APP_READY__ = false;
(function () {
  let shown = false;
  let pendingTimer = 0;

  function appIsReady() {
    return Boolean(window.__BETPRES_APP_READY__ || window.__BETPRES_NAV_READY__);
  }

  function showStartupError(message) {
    if (shown || appIsReady()) return;
    shown = true;

    const render = () => {
      if (document.getElementById("betpresStartupError")) return;
      const box = document.createElement("div");
      box.id = "betpresStartupError";
      box.style.cssText =
        "position:fixed;inset:18px;z-index:999999;background:#fff7f7;" +
        "border:2px solid #b42318;border-radius:14px;padding:22px;" +
        "font-family:Arial,sans-serif;color:#5d1b16;box-shadow:0 18px 60px #0004;" +
        "overflow:auto";
      box.innerHTML =
        "<h2 style='margin:0 0 10px'>Aplikácia sa nenačítala správne</h2>" +
        "<p style='margin:0 0 12px'>Niektorý súbor sa nepodarilo načítať. Tvoje uložené údaje zostali zachované.</p>" +
        "<pre style='white-space:pre-wrap;background:#fff;border:1px solid #e4b8b4;" +
        "padding:12px;border-radius:8px'>" +
        String(message || "Neznáma chyba").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])) +
        "</pre><p>Obnov aplikáciu. Ak chyba ostane, pošli fotografiu tohto hlásenia.</p>" +
        "<button id='betpresStartupReload' style='min-height:48px;padding:10px 18px;border:0;border-radius:13px;background:#0a548c;color:#fff;font:700 16px system-ui'>Obnoviť aplikáciu</button>";
      document.body.appendChild(box);
      document.getElementById("betpresStartupReload").onclick = () => window.location.reload();
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  function reportStartupError(message, generic) {
    if (appIsReady()) return;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => {
      if (!appIsReady()) showStartupError(generic ? "Nepodarilo sa načítať jeden zo súborov aplikácie." : message);
    }, generic ? 1800 : 250);
  }

  window.addEventListener("error", event => {
    const message = (event.error && event.error.stack) || event.message || "Chyba JavaScriptu pri spustení.";
    const generic = !event.error && /^Script error\.?$/i.test(String(event.message || ""));
    reportStartupError(message, generic);
  });

  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    reportStartupError(
      (reason && reason.stack) ||
      (reason && reason.message) ||
      String(reason || "Nezachytená chyba."),
      false
    );
  });

  setTimeout(() => {
    if (!window.__BETPRES_APP_READY__) {
      showStartupError("Aplikácia nedokončila načítanie do 30 sekúnd.");
    }
  }, 30000);
})();
