(function () {
 "use strict";

 var fields = ["date", "supplier", "ticketNo", "invoiceNo", "machineName", "activity", "performance", "sequence"];
 var letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

 function el(id) { return document.getElementById(id); }
 function html(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]; }); }
 function rowsForProject() { return state.machinePassport.filter(function (row) { return row.projectId === state.selectedProjectId; }); }
 function filteredRows() {
  var query = String(el("machineSearch") && el("machineSearch").value || "").trim().toLocaleLowerCase("sk");
  var supplier = String(el("machineSupplierFilter") && el("machineSupplierFilter").value || "");
  var month = String(el("machineMonthFilter") && el("machineMonthFilter").value || "");
  return rowsForProject().filter(function (row) {
   if (supplier && String(row.supplier || "") !== supplier) return false;
   if (month && !String(row.date || "").startsWith(month)) return false;
   if (!query) return true;
   return fields.some(function (field) { return String(row[field] || "").toLocaleLowerCase("sk").includes(query); });
  }).sort(function (a, b) { return String(a.date || "").localeCompare(String(b.date || "")) || Number(a.sequence || 0) - Number(b.sequence || 0); });
 }
 function nextSequence() { return String(Math.max(0, ...rowsForProject().map(function (row) { return Number(row.sequence) || 0; })) + 1); }
 function dateLabel(value) {
  if (!value) return "";
  var parts = String(value).split("-");
  return parts.length === 3 ? String(Number(parts[2])) + "." + String(Number(parts[1])) + "." + String(parts[0]).slice(-2) : value;
 }
 function normalizeFormula(input, field) {
  var value = input.value.trim();
  if (!["performance", "sequence"].includes(field) || !isWorkFormula(value)) return value;
  var result = evalWorkFormula(value);
  if (!result.ok) { input.classList.add("table-formula-error"); toast("Vzorec sa nedá vypočítať: " + result.error + "."); return null; }
  value = String(Math.round((result.value + Number.EPSILON) * 1000000) / 1000000).replace(".", ",");
  input.value = value;
  input.classList.remove("table-formula-error");
  return value;
 }
 function saveCell(input) {
  var record = state.machinePassport.find(function (row) { return row.id === input.dataset.machineId; });
  if (!record) return;
  var field = input.dataset.machineField, value = normalizeFormula(input, field);
  if (value == null) return;
  if (field === "date") { value = parseExcelDate(value); input.value = dateLabel(value); }
  record[field] = value;
  record.updatedAt = new Date().toISOString();
  commitDirectState();
  el("machineSaveStatus").textContent = "Uložené " + new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" });
 }
 function inputCell(row, field, index) {
  var value = field === "date" ? dateLabel(row[field]) : row[field] || "";
  var mode = ["performance", "sequence"].includes(field) ? ' inputmode="decimal"' : "";
  return '<td class="excel-cell"><input data-machine-id="' + row.id + '" data-machine-field="' + field + '" data-machine-col="' + letters[index] + '" value="' + html(value) + '"' + mode + ' autocomplete="off"></td>';
 }
 function attachEvents() {
  document.querySelectorAll("#machinePassportBody input[data-machine-field]").forEach(function (input) {
   input.onfocus = function () {
    beginDirectUndo("Úprava pasportu strojov");
    document.querySelectorAll("#machinePassportBody .excel-cell.active").forEach(function (cell) { cell.classList.remove("active"); });
    input.closest("td").classList.add("active");
    el("machineCellName").textContent = input.dataset.machineCol + (input.closest("tr").rowIndex + 1);
    el("machineFormula").textContent = input.value || "";
   };
   input.oninput = function () { el("machineFormula").textContent = input.value; };
   input.onchange = function () { saveCell(input); };
   input.onblur = function () { saveCell(input); endDirectUndo(); };
   input.onkeydown = function (event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    saveCell(input);
    var all = Array.from(document.querySelectorAll("#machinePassportBody input[data-machine-field]")), position = all.indexOf(input);
    all[Math.min(all.length - 1, position + fields.length)]?.focus();
   };
  });
  document.querySelectorAll("[data-delete-machine]").forEach(function (button) {
   button.onclick = function () {
    if (!confirm("Vymazať tento riadok z pasportu strojov?")) return;
    state.machinePassport = state.machinePassport.filter(function (row) { return row.id !== button.dataset.deleteMachine; });
    save("Riadok pasportu strojov bol vymazaný.");
   };
  });
 }
 function render() {
  if (!el("machinePassportBody")) return;
  var months = [...new Set(rowsForProject().map(function (row) { return String(row.date || "").slice(0, 7); }).filter(function (value) { return /^\d{4}-\d{2}$/.test(value); }))].sort().reverse();
  var suppliers = [...new Set(rowsForProject().map(function (row) { return String(row.supplier || "").trim(); }).filter(Boolean))].sort(function (a, b) { return a.localeCompare(b, "sk", { sensitivity: "base" }); });
  var selectedSupplier = el("machineSupplierFilter").value;
  el("machineSupplierFilter").innerHTML = '<option value="">Všetci dodávatelia</option>' + suppliers.map(function (supplier) { return '<option value="' + html(supplier) + '"' + (supplier === selectedSupplier ? " selected" : "") + '>' + html(supplier) + "</option>"; }).join("");
  var selected = el("machineMonthFilter").value;
  el("machineMonthFilter").innerHTML = '<option value="">Všetky mesiace</option>' + months.map(function (month) { return '<option value="' + month + '"' + (month === selected ? " selected" : "") + '>' + month.slice(5) + " / " + month.slice(0, 4) + "</option>"; }).join("");
  var rows = filteredRows();
  el("machineResultCount").textContent = rows.length + " riadkov";
  el("machinePassportBody").innerHTML = rows.map(function (row) {
   return '<tr data-machine-row="' + row.id + '"><td class="excel-row-number machine-row-tools"><span>' + html(row.sequence || "") + '</span><button class="excel-delete" data-delete-machine="' + row.id + '" title="Vymazať">×</button></td>' + fields.map(function (field, index) { return inputCell(row, field, index); }).join("") + '</tr>';
  }).join("") || '<tr><td class="excel-row-number">1</td><td colspan="9" class="machine-empty">Pridaj prvý stroj alebo mechanizmus.</td></tr>';
  attachEvents();
 }
 function addRow() {
  var row = { id: uid("mp"), projectId: state.selectedProjectId, date: todayISO(), supplier: "", ticketNo: "", invoiceNo: "", machineName: "", activity: "", performance: "", sequence: nextSequence(), createdAt: new Date().toISOString() };
  state.machinePassport.push(row);
  save("Nový riadok bol pridaný do pasportu strojov.");
  setTimeout(function () { document.querySelector('[data-machine-id="' + row.id + '"][data-machine-field="supplier"]')?.focus(); }, 50);
 }
 function pdfRows() {
  var source = filteredRows(), perPage = 30, pages = [], count = Math.max(1, Math.ceil(source.length / perPage));
  for (var pageIndex = 0; pageIndex < count; pageIndex += 1) {
   var pageRows = source.slice(pageIndex * perPage, pageIndex * perPage + perPage), body = "";
   for (var index = 0; index < perPage; index += 1) {
    var row = pageRows[index];
    if (row) body += "<tr><td>" + html(dateLabel(row.date)) + "</td><td>" + html(row.supplier) + "</td><td>" + html(row.ticketNo) + "</td><td>" + html(row.invoiceNo) + "</td><td>" + html(row.machineName) + "</td><td>" + html(row.activity) + "</td><td>" + html(row.performance) + "</td><td class='pc'>" + html(row.sequence) + "</td></tr>";
    else body += "<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td class='pc'>" + (pageIndex * perPage + index + 1) + "</td></tr>";
   }
   pages.push('<section class="machine-print-page"><header><strong>' + html(activeProject()?.name || "Stavba") + '</strong><span>Pasport strojov</span></header><table><thead><tr><th>Dátum</th><th>Dodávateľ</th><th>číslo<br>stazky</th><th>Faktúra<br>číslo</th><th>Názov stroja</th><th>činnosť</th><th>Výkon</th><th>P.č.</th></tr></thead><tbody>' + body + '</tbody></table><footer>Strana ' + (pageIndex + 1) + " / " + count + "</footer></section>");
  }
  return pages.join("");
 }
 async function exportPdf() {
  var printHtml = '<!doctype html><html lang="sk"><head><meta charset="utf-8"><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#000}.machine-print-page{position:relative;width:210mm;min-height:297mm;padding:15mm 15mm 14mm;page-break-after:always}.machine-print-page:last-child{page-break-after:auto}header{height:20mm;display:flex;justify-content:space-between;align-items:flex-start;font-size:12px;font-weight:400;padding:0 1mm}header strong{font-weight:400}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th,td{border:0.35mm solid #111;padding:1.2mm 1mm;height:6.4mm;line-height:1.15;vertical-align:middle;overflow:hidden}th{height:12mm;font-size:9px;text-align:center;font-weight:700}th:nth-child(1){width:10%}th:nth-child(2){width:16%}th:nth-child(3){width:12%}th:nth-child(4){width:12%}th:nth-child(5){width:18%}th:nth-child(6){width:21%}th:nth-child(7){width:8%}th:nth-child(8){width:5%}td.pc{text-align:right}footer{position:absolute;right:15mm;bottom:7mm;font-size:8px;color:#555}</style></head><body>' + pdfRows() + "</body></html>";
 var payload = { html: printHtml, fileName: "Pasport strojov " + fmtDateISO(todayISO()) + ".pdf", landscape: false, title: "Pasport strojov" };
  window.__BETPRES_MACHINE_PDF_PAYLOAD__ = payload;
  if (window.showPdfPreview) await window.showPdfPreview(payload); else if (window.betpresDesktop?.exportPdf) await window.betpresDesktop.exportPdf(payload);
 }
 function exportCsv() {
  var headings = ["Dátum", "Dodávateľ", "Číslo stazky", "Faktúra číslo", "Názov stroja", "Činnosť", "Výkon", "P. č."], quote = function (value) { return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"'; };
  var text = "\uFEFF" + [headings].concat(filteredRows().map(function (row) { return [dateLabel(row.date), row.supplier, row.ticketNo, row.invoiceNo, row.machineName, row.activity, row.performance, row.sequence]; })).map(function (row) { return row.map(quote).join(";"); }).join("\n");
  downloadWorkBlob(new Blob([text], { type: "text/csv;charset=utf-8" }), "pasport-strojov-" + todayISO() + ".csv");
 }

 window.renderMachinePassport = render;
 el("addMachineRow").onclick = addRow;
 el("exportMachinesPdf").onclick = exportPdf;
 el("exportMachinesCsv").onclick = exportCsv;
 el("machineSearch").oninput = render;
 el("machineSupplierFilter").onchange = render;
 el("machineMonthFilter").onchange = render;
 el("resetMachineFilters").onclick = function () { el("machineSearch").value = ""; el("machineSupplierFilter").value = ""; el("machineMonthFilter").value = ""; render(); };
})();
