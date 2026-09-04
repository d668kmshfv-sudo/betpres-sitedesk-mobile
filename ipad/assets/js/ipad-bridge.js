(() => {
  "use strict";

  const KEYS = {
    mobileConfig: "betpres-mobile-cloud-v1",
    mobileSession: "betpres-mobile-session-v1",
    desktopConfig: "betpres-stavebna-evidencia-v7-cloud-config",
    desktopSession: "betpres-stavebna-evidencia-v7-cloud-session"
  };

  const read = (key, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const tokenIssuedAt = (session) => {
    try {
      const raw = String(session?.access_token || "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return Number(JSON.parse(atob(raw + "=".repeat((4 - raw.length % 4) % 4))).iat || 0);
    } catch { return 0; }
  };
  const sessionRank = (session) => Math.max(
    Number(session?.expires_at || 0),
    tokenIssuedAt(session),
    Number(session?._savedAt || 0) / 1000
  );
  const isSecretKey = (value) => {
    const key = String(value || "").trim();
    if (/^sb_secret_/i.test(key)) return true;
    if (!key.includes(".")) return false;
    try { const raw = key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return /service_role|secret/i.test(String(JSON.parse(atob(raw + "=".repeat((4 - raw.length % 4) % 4))).role || "")); }
    catch { return false; }
  };

  function reconcileConfig() {
    const mobile = read(KEYS.mobileConfig, {});
    const desktop = read(KEYS.desktopConfig, {});
    const url = mobile.url || desktop.url || "";
    const key = [mobile.key, desktop.key].find((value) => value && !isSecretKey(value)) || "";
    const workspaceName = mobile.workspaceName || desktop.workspaceName || "Medická – pilot";
    if (!key && (mobile.key || desktop.key)) {
      localStorage.setItem(KEYS.desktopConfig, JSON.stringify({ ...desktop, key: "" }));
      localStorage.setItem(KEYS.mobileConfig, JSON.stringify({ ...mobile, key: "" }));
      sessionStorage.setItem("betpres-cloud-secret-removed", "1");
      return;
    }
    if (!url || !key) return;
    localStorage.setItem(KEYS.desktopConfig, JSON.stringify({
      ...desktop,
      url, key, workspaceName, autoSync: true,
      lastCloudVersion: Math.max(Number(desktop.lastCloudVersion || 0), Number(mobile.version || 0)),
      lastCloudId: desktop.lastCloudId || mobile.workspaceId || "",
      currentRole: desktop.currentRole || mobile.role || "none",
      lastEmail: desktop.lastEmail || mobile.email || ""
    }));
    localStorage.setItem(KEYS.mobileConfig, JSON.stringify({
      ...mobile,
      url, key, workspaceName,
      version: Math.max(Number(mobile.version || 0), Number(desktop.lastCloudVersion || 0)),
      workspaceId: mobile.workspaceId || desktop.lastCloudId || "",
      role: mobile.role || desktop.currentRole || "none",
      email: mobile.email || desktop.lastEmail || ""
    }));
  }

  function reconcileSession() {
    const sessions = [read(KEYS.mobileSession), read(KEYS.desktopSession)]
      .filter((session) => session?.access_token)
      .sort((a, b) => sessionRank(b) - sessionRank(a));
    const freshest = sessions[0];
    if (!freshest) return null;
    const value = JSON.stringify(freshest);
    localStorage.setItem(KEYS.mobileSession, value);
    localStorage.setItem(KEYS.desktopSession, value);
    if (typeof window.siteDeskAdoptCloudSession === "function") {
      window.siteDeskAdoptCloudSession(freshest);
    }
    return freshest;
  }

  function resumeSync() {
    reconcileConfig();
    const session = reconcileSession();
    if (!session || document.hidden || !navigator.onLine) return;
    if (typeof window.siteDeskResumeCloudSync === "function") {
      window.siteDeskResumeCloudSync().catch(() => {});
    }
  }

  function addIpadControls() {
    document.body.classList.add("ipad-web");
    if (document.getElementById("ipadWebBadge")) return;
    const badge = document.createElement("div");
    badge.id = "ipadWebBadge";
    badge.className = "ipad-web-badge";
    badge.innerHTML = '<span>Online · 5.1.15</span>';
    document.body.appendChild(badge);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js", { scope: "./", updateViaCache: "none" }).then((registration) => {
        registration.update().catch(() => {});
      }).catch(() => {});
    }
  }

  reconcileConfig();
  reconcileSession();
  window.__BETPRES_IPAD_WEB__ = true;

  document.addEventListener("DOMContentLoaded", addIpadControls);
  window.addEventListener("load", () => {
    registerServiceWorker();
    window.setTimeout(resumeSync, 1800);
    window.setInterval(resumeSync, 30000);
  });
  window.addEventListener("online", resumeSync);
  window.addEventListener("focus", resumeSync);
  window.addEventListener("pageshow", resumeSync);
  window.addEventListener("storage", (event) => {
    if ([KEYS.mobileSession, KEYS.desktopSession, KEYS.mobileConfig, KEYS.desktopConfig].includes(event.key)) resumeSync();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) resumeSync();
  });
})();
