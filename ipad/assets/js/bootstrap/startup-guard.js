window.__BETPRES_NAV_READY__ = false;
window.__BETPRES_APP_READY__ = false;
(function () {
  let shown = false;

  function showStartupError(message) {
    if (shown) return;
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
        "<p style='margin:0 0 12px'>Kliknutia v menu preto nemusia fungovať.</p>" +
        "<pre style='white-space:pre-wrap;background:#fff;border:1px solid #e4b8b4;" +
        "padding:12px;border-radius:8px'>" +
        String(message || "Neznáma chyba").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])) +
        "</pre><p>Zatvor aplikáciu a spusti ju znovu. Ak chyba ostane, pošli fotografiu tohto hlásenia.</p>";
      document.body.appendChild(box);
    };

    if (document.body) render();
    else document.addEventListener("DOMContentLoaded", render, { once: true });
  }

  window.addEventListener("error", event => {
    showStartupError(
      (event.error && event.error.stack) ||
      event.message ||
      "Chyba JavaScriptu pri spustení."
    );
  });

  window.addEventListener("unhandledrejection", event => {
    const reason = event.reason;
    showStartupError(
      (reason && reason.stack) ||
      (reason && reason.message) ||
      String(reason || "Nezachytená chyba.")
    );
  });

  setTimeout(() => {
    if (!window.__BETPRES_APP_READY__) {
      showStartupError("Aplikácia nedokončila načítanie do 10 sekúnd.");
    }
  }, 10000);
})();