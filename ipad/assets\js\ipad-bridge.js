(() => {
  "use strict";

  const KEYS = {
    mobileConfig: "betpres-mobile-cloud-v1",
    mobileSession: "betpres-mobile-session-v1",
    desktopConfig: "betpres-stavebna-evidencia-v7-cloud-config",
    desktopSession: "betpres-stavebna-evidencia-v7-cloud-session"
  };

  const read = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  };

  const mobileConfig = read(KEYS.mobileConfig);
  const mobileSession = read(KEYS.mobileSession);
  const desktopConfig = read(KEYS.desktopConfig) || {};

  if (mobileConfig?.url && mobileConfig?.key && (!desktopConfig.url || !desktopConfig.key)) {
    localStorage.setItem(KEYS.desktopConfig, JSON.stringify({
      ...desktopConfig,
      url: mobileConfig.url,
      key: mobileConfig.key,
      workspaceName: mobileConfig.workspaceName || "Medická – pilot",
      autoSync: true,
      lastCloudVersion: Number(mobileConfig.version || 0),
      lastCloudId: mobileConfig.workspaceId || "",
      currentRole: mobileConfig.role || "none",
      lastEmail: mobileConfig.email || mobileSession?.user?.email || ""
    }));
  }

  if (mobileSession?.access_token && !read(KEYS.desktopSession)?.access_token) {
    localStorage.setItem(KEYS.desktopSession, JSON.stringify(mobileSession));
  }

  window.__BETPRES_IPAD_WEB__ = true;

  function addIpadControls() {
    document.body.classList.add("ipad-web");
    if (document.getElementById("ipadWebBadge")) return;
    const badge = document.createElement("div");
    badge.id = "ipadWebBadge";
    badge.className = "ipad-web-badge";
    badge.innerHTML = '<span>iPad</span><a href="../" aria-label="Otvoriť jednoduchú mobilnú verziu">Mobil</a>';
    document.body.appendChild(badge);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", addIpadControls);
  window.addEventListener("load", () => {
    registerServiceWorker();
    window.setTimeout(() => {
      if (typeof window.cloudPull === "function" && read(KEYS.desktopSession)?.access_token) {
        window.cloudPull({ silent: true }).catch(() => {});
      }
    }, 1800);
  });
})();
