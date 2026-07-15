(function () {
 "use strict";

 var activeResolve = null;
 var activePayload = null;
 var zoom = 0.78;

 function ensurePreview() {
  var modal = document.getElementById("pdfPreviewModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "pdfPreviewModal";
  modal.className = "pdf-preview-modal hidden";
  modal.innerHTML = '<div class="pdf-preview-shell" role="dialog" aria-modal="true" aria-labelledby="pdfPreviewTitle"><header><div><span>NÁHĽAD PRED EXPORTOM</span><h2 id="pdfPreviewTitle">PDF dokument</h2></div><div class="pdf-preview-zoom"><button type="button" data-pdf-zoom="out">−</button><strong id="pdfPreviewZoom">78 %</strong><button type="button" data-pdf-zoom="in">+</button><button class="ghost" type="button" data-pdf-print>Tlačiť</button><button type="button" data-pdf-save>Uložiť PDF</button><button class="ghost" type="button" data-pdf-close>Zavrieť</button></div></header><div class="pdf-preview-stage"><iframe id="pdfPreviewFrame" title="Náhľad PDF"></iframe></div></div>';
  document.body.appendChild(modal);

  modal.querySelector("[data-pdf-close]").onclick = function () { closePreview({ ok: false, canceled: true }); };
  modal.addEventListener("click", function (event) { if (event.target === modal) closePreview({ ok: false, canceled: true }); });
  modal.querySelector("[data-pdf-zoom='out']").onclick = function () { setZoom(zoom - 0.1); };
  modal.querySelector("[data-pdf-zoom='in']").onclick = function () { setZoom(zoom + 0.1); };
  modal.querySelector("[data-pdf-print]").onclick = function () {
   var frame = document.getElementById("pdfPreviewFrame");
   if (frame && frame.contentWindow) { frame.contentWindow.focus(); frame.contentWindow.print(); }
  };
  modal.querySelector("[data-pdf-save]").onclick = async function () {
   if (!activePayload || !window.betpresDesktop || typeof window.betpresDesktop.exportPdf !== "function") return;
   var button = modal.querySelector("[data-pdf-save]");
   button.disabled = true;
   button.textContent = "Ukladám…";
   try {
    var result = await window.betpresDesktop.exportPdf(activePayload);
    if (result && result.ok) closePreview(result);
   } catch (error) {
    alert("PDF sa nepodarilo uložiť: " + (error && error.message ? error.message : error));
   } finally {
    button.disabled = false;
    button.textContent = "Uložiť PDF";
   }
  };
  return modal;
 }

 function setZoom(value) {
  zoom = Math.max(0.4, Math.min(1.4, value));
  var label = document.getElementById("pdfPreviewZoom");
  var frame = document.getElementById("pdfPreviewFrame");
  if (label) label.textContent = Math.round(zoom * 100) + " %";
  if (frame && frame.contentDocument && frame.contentDocument.documentElement) frame.contentDocument.documentElement.style.zoom = String(zoom);
 }

 function closePreview(result) {
  var modal = document.getElementById("pdfPreviewModal");
  if (modal) modal.classList.add("hidden");
  activePayload = null;
  if (activeResolve) {
   var resolve = activeResolve;
   activeResolve = null;
   resolve(result || { ok: false, canceled: true });
  }
 }

 window.showPdfPreview = function (payload) {
  if (window.betpresDesktop && window.betpresDesktop.isAutomated && !window.__BETPRES_FORCE_PDF_PREVIEW__) return window.betpresDesktop.exportPdf(payload);
  if (activeResolve) closePreview({ ok: false, canceled: true });
  var modal = ensurePreview();
  var frame = document.getElementById("pdfPreviewFrame");
  var title = document.getElementById("pdfPreviewTitle");
  activePayload = payload;
  zoom = payload && payload.landscape === false ? 0.72 : 0.68;
  if (title) title.textContent = (payload && payload.title) || (payload && payload.fileName) || "PDF dokument";
  modal.classList.remove("hidden");
  if (frame) {
   frame.onload = async function () {
    var images = Array.prototype.slice.call(frame.contentDocument ? frame.contentDocument.images : []);
    await Promise.all(images.map(function (image) {
     if (image.complete && image.naturalWidth > 0) return typeof image.decode === "function" ? image.decode().catch(function () {}) : Promise.resolve();
     return new Promise(function (resolve) {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
      setTimeout(resolve, 12000);
     });
    }));
    setZoom(zoom);
   };
   frame.srcdoc = payload.html || "";
  }
  setZoom(zoom);
  return new Promise(function (resolve) { activeResolve = resolve; });
 };
})();
