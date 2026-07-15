(function () {
 "use strict";

 var APP_VERSION = "5.0.76";
 var dayNames = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
 var euro = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" });

 function el(id) {
  return document.getElementById(id);
 }

 function html(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
   return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
 }

 function currentMonth() {
  return (el("workerMonth") && el("workerMonth").value) || selectedWorkerMonth || todayMonthValue();
 }

 function monthInfo(month) {
  var parts = month.split("-").map(Number);
  return { year: parts[0], month: parts[1], days: daysInMonth(month), label: String(parts[1]).padStart(2, "0") + "/" + parts[0] };
 }

 function projectLabel() {
  var projectData = activeProject();
  return projectData && projectData.name ? projectData.name : "Stavba";
 }

 function safePart(value) {
  return String(value || "")
   .normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-zA-Z0-9_-]+/g, "-")
   .replace(/^-+|-+$/g, "")
   .slice(0, 70) || "smenovka";
 }

 function displayValue(value) {
  if (value == null || value === "") return "";
  var normalized = String(value).replace(",", ".");
  var numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric % 1 ? numeric.toLocaleString("sk-SK", { maximumFractionDigits: 2 }) : String(numeric);
  return String(value);
 }

 function dayMeta(month, day) {
  var info = monthInfo(month);
  var date = new Date(info.year, info.month - 1, day);
  var holiday = slovakHoliday(date);
  var weekend = date.getDay() === 0 || date.getDay() === 6;
  return { name: dayNames[date.getDay()], holiday: holiday, className: holiday ? "holiday" : weekend ? "weekend" : "" };
 }

function splitRows(rows, size) {
  var source = rows && rows.length ? rows : [null];
  var result = [];
  for (var index = 0; index < source.length; index += size) result.push(source.slice(index, index + size));
  return result;
}

 function splitRowsBalanced(rows, maxPerPage) {
  var source = rows && rows.length ? rows : [null];
  var pageCount = Math.max(1, Math.ceil(source.length / maxPerPage));
  var size = Math.ceil(source.length / pageCount);
  return splitRows(source, size);
 }

 function tableHead(month, nameTitle, withAmount) {
  var info = monthInfo(month);
  var top = '<tr><th class="number" rowspan="2">Č.</th><th class="name" rowspan="2">' + html(nameTitle) + "</th>";
  var bottom = "<tr>";
  for (var day = 1; day <= info.days; day += 1) {
   var meta = dayMeta(month, day);
   top += '<th class="day ' + meta.className + '">' + day + "</th>";
   bottom += '<th class="day ' + meta.className + '" title="' + html(meta.holiday || "") + '">' + meta.name + "</th>";
  }
  top += '<th class="sum" rowspan="2">Spolu</th>';
  if (withAmount) top += '<th class="amount" rowspan="2">Suma</th>';
  return top + "</tr>" + bottom + "</tr>";
 }

 function exportHeader(title, month, pageNumber, pageCount, detail) {
  return '<header class="document-head"><div class="brand-rail"></div><div class="app-name"><img src="' + html(exportLogoDataUrl()) + '" alt="BETPRES"><span>BETPRES, s.r.o. · stavebná evidencia</span></div><div class="document-title"><span class="document-kicker">MESAČNÝ VÝKAZ STAVBY</span><h1>' +
   html(title) + '</h1><div class="document-meta"><span><b>Stavba</b>' + html(projectLabel()) + '</span><span><b>Obdobie</b>' + html(monthInfo(month).label) + '</span><span><b>Obsah</b>' + html(detail || "evidencia") +
   '</span></div></div><div class="page-number"><span>STRANA</span><strong>' + pageNumber + " / " + pageCount + '</strong><small>ISO 9001 · 14001 · 45001</small></div></header>';
 }

 function exportLogoDataUrl() {
  var source = document.querySelector(".site-sidebar .site-brand img") || document.querySelector(".dashboard-brand-logo img");
  if (!source) return "";
  try {
   var canvas = document.createElement("canvas");
   canvas.width = source.naturalWidth || 320;
   canvas.height = source.naturalHeight || 100;
   canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
   return canvas.toDataURL("image/png");
  } catch (error) {
   return source.src || "";
  }
 }

 function exportFooter(summary) {
  return '<footer><span class="footer-app">BETPRES SiteDesk ' + APP_VERSION + '</span><strong>' + html(summary || "") + '</strong><span>Interný výkaz stavby</span></footer>';
 }

 function page(title, month, pageNumber, pageCount, detail, table, summary) {
  return '<section class="timesheet-page">' + exportHeader(title, month, pageNumber, pageCount, detail) +
   '<div class="legend"><span><i class="weekend-box"></i> víkend</span><span><i class="holiday-box"></i> sviatok</span><span>Exportované ' +
   html(new Date().toLocaleDateString("sk-SK")) + "</span></div>" + table + exportFooter(summary) + "</section>";
 }

 function documentHtml(title, pages) {
  var styles = [
   "@page{size:A4 landscape;margin:7mm}",
   "*{box-sizing:border-box}",
   "html,body{margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#102d51;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
   ".timesheet-page{position:relative;min-height:196mm;display:flex;flex-direction:column;page-break-after:always;overflow:hidden;background:#fff}",
   ".timesheet-page:last-child{page-break-after:auto}",
   ".document-head{position:relative;display:grid;grid-template-columns:4mm 52mm minmax(0,1fr) 29mm;align-items:center;gap:4mm;min-height:23mm;border:1px solid #b9c9d8;border-radius:2.5mm;overflow:hidden;margin-bottom:2mm;background:linear-gradient(105deg,#fff 0%,#f2f7fb 100%)}",
   ".brand-rail{align-self:stretch;background:#082f61}",
   ".app-name{display:grid;align-content:center;gap:1mm}.app-name img{display:block;width:47mm;height:14mm;object-fit:contain;object-position:left center}.app-name span{font-size:7px;line-height:1.1;color:#536d83;font-weight:700;letter-spacing:.02em}",
   ".document-title{min-width:0;text-align:left;padding-left:4mm;border-left:1px solid #cad6e1}.document-kicker{display:block;color:#51738f;font-size:6.5px;font-weight:900;letter-spacing:.13em}.document-title h1{font-size:15px;line-height:1;margin:1.2mm 0 1.5mm;color:#082f61}.document-meta{display:grid;grid-template-columns:1.6fr .55fr .8fr;gap:2mm}.document-meta span{min-width:0;color:#314e67;font-size:7.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.document-meta b{display:block;color:#7890a3;font-size:5.8px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4mm}",
   ".page-number{align-self:stretch;display:grid;align-content:center;justify-items:center;gap:.7mm;background:#082f61;color:#fff;text-align:center}.page-number span{font-size:5.8px;letter-spacing:.12em;color:#bcd1e3}.page-number strong{font-size:12px}.page-number small{font-size:5.5px;color:#d7e8f5;white-space:nowrap}",
   ".legend{display:flex;gap:5mm;align-items:center;min-height:5mm;padding:1mm 2mm;border:1px solid #cfdae4;border-radius:1.5mm;background:#f6f9fb;font-size:7.2px;color:#53677f;margin-bottom:2mm}",
   ".legend i{display:inline-block;width:3mm;height:3mm;border:1px solid #bdc9d6;vertical-align:middle;margin-right:1mm}.weekend-box{background:#edf2f7}.holiday-box{background:#ffe7e5}",
   "table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7px;color:#152c48}",
   "th,td{border:1px solid #9eafc1;text-align:center;height:6.5mm;padding:.6mm;overflow:hidden}",
   "thead tr:first-child th{background:#082f61;color:#fff;font-weight:800}thead tr:nth-child(2) th{background:#174f7f;color:#fff;font-weight:700}.number{width:7mm}.name{width:42mm;text-align:left!important;padding-left:2mm!important}.day{width:6mm}.sum{width:12mm;background:#dcebf7!important;color:#082f61!important;font-weight:800}.amount{width:22mm;background:#dcebf7!important;color:#082f61!important;font-weight:800}",
   "tbody tr:nth-child(even) td{background:#f3f7fa}tbody tr:nth-child(odd) td{background:#fff}tbody td.weekend,tfoot td.weekend{background:#e8eff5!important}tbody td.holiday,tfoot td.holiday{background:#ffe8e5!important}",
   "td.name strong{display:block;font-size:7.4px}td.name small{display:block;color:#64768b;font-size:6.3px;margin-top:.5mm}",
   ".company-status-table .number{width:3%}.company-status-table .name{width:19%;padding-left:2.4mm!important;padding-right:1.2mm!important}.company-status-table .day{width:2.35%;padding-left:.2mm!important;padding-right:.2mm!important;font-size:6.4px}.company-status-table .sum{width:5.15%}",
   ".company-status-table th,.company-status-table td{height:4.4mm;padding-top:.15mm;padding-bottom:.15mm}",
   ".company-status-table tbody td.name strong{font-size:11px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.company-status-table tbody td:not(.name){font-size:6.8px}.company-status-table tfoot td.name{font-size:8px}",
    ".employee-timesheet-table .name{width:46mm}.employee-timesheet-table tbody td.name strong{font-size:11px;line-height:1.12}.employee-timesheet-table tbody td.name small{font-size:7.5px;line-height:1.1;margin-top:.4mm}",
    ".betpres-employee-timesheet-table tbody td{height:8.3mm}.employee-timesheet-table .employee-reward{display:inline-flex;align-items:center;gap:1mm;margin-top:.7mm;padding:.45mm 1.2mm;border:1px solid #8eb6d6;border-radius:1.5mm;background:#e8f3fb;color:#082f61;font-size:6.8px;font-weight:800;line-height:1}.employee-timesheet-table .employee-reward b{font-size:7.4px}",
    ".employee-timesheet-table .thp-stack{display:flex;min-height:5mm;flex-direction:column;align-items:center;justify-content:center;line-height:2.2mm}.employee-timesheet-table .thp-stack .thp-extra{color:#a05c12;font-size:6.1px}",
   ".employee-timesheet-table tbody tr.hours-row td{border-bottom:1px dashed #8aa2b7}.employee-timesheet-table tbody tr.overtime-row td{height:5.2mm;background:#fff4df!important;color:#754712;border-top:0}.employee-timesheet-table td.sum small{display:block;font-size:5.5px;line-height:1;color:#60778b}.employee-timesheet-table tr.overtime-row td.sum small,.employee-timesheet-table tr.overtime-total td.sum small{color:#9b5c13}.employee-timesheet-table tfoot tr.overtime-total td{background:#ffe7bd!important;color:#6f430f}",
   "tfoot td{background:#d5e6f4;font-weight:800;border-top:1.5px solid #082f61}.empty{height:18mm;text-align:left;padding-left:4mm;color:#6b7c90}",
   "footer{margin-top:auto;min-height:6mm;border-top:1.2px solid #082f61;padding:1.2mm 0 0;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:4mm;font-size:7px;color:#45647d}.footer-app{font-weight:850;color:#244d70}footer>strong{color:#082f61;font-size:8px}footer>span:last-child{text-align:right}",
   "@media print{body{background:#fff}}"
  ].join("");
  return '<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>' + html(title) + "</title><style>" + styles + "</style></head><body>" + pages.join("") + "</body></html>";
 }

 async function savePdf(title, fileName, pages) {
  if (!pages || !pages.length) {
   alert("Pre tento mesiac nie je čo exportovať.");
   return { ok: false, reason: "empty" };
  }
  var content = documentHtml(title, pages);
  try {
   if (window.showPdfPreview || (window.betpresDesktop && typeof window.betpresDesktop.exportPdf === "function")) {
    var payload = { html: content, fileName: fileName, landscape: true, title: title };
    var result = window.showPdfPreview ? await window.showPdfPreview(payload) : await window.betpresDesktop.exportPdf(payload);
    if (result && result.ok && typeof toast === "function") toast("PDF smenovky bolo uložené.");
    return result || { ok: false };
   }
   var printWindow = window.open("", "_blank");
   if (!printWindow) throw new Error("Otvorenie tlačového okna bolo zablokované.");
   printWindow.document.write(content.replace("</body>", '<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\\/script></body>'));
   printWindow.document.close();
   return { ok: true, fallback: true };
  } catch (error) {
   alert("PDF sa nepodarilo vytvoriť: " + (error && error.message ? error.message : error));
   return { ok: false, error: String(error && error.message ? error.message : error) };
  }
 }

 function companyStatusPages(month) {
  var sheet = workerSheet(month, true);
  syncBetpresWorkerRow(month, sheet);
  sortWorkerRows(sheet);
  var allRows = sheet.rows || [];
  var rowsPerPage = 36;
  var chunks = splitRowsBalanced(allRows, rowsPerPage);
  var info = monthInfo(month);
  var pages = [];
  var rowOffset = 0;
  chunks.forEach(function (rows, pageIndex) {
   var body = "";
   rows.forEach(function (row, rowIndex) {
    if (!row) {
     body += '<tr><td class="empty" colspan="' + (info.days + 3) + '">V tomto mesiaci zatiaľ nie sú pridané firmy.</td></tr>';
     return;
    }
    var total = 0;
    body += "<tr><td>" + (rowOffset + rowIndex + 1) + '</td><td class="name"><strong>' + html(workerRowMainLabel(row)) + "</strong></td>";
    for (var day = 1; day <= info.days; day += 1) {
     var value = Number(row.values && row.values[day]) || 0;
     total += value;
     body += '<td class="' + dayMeta(month, day).className + '">' + html(displayValue(value || "")) + "</td>";
    }
    body += '<td class="sum">' + html(displayValue(total)) + "</td></tr>";
   });
   var totals = '<tr><td colspan="2" class="name">Spolu za deň</td>';
   var grand = 0;
   for (var day = 1; day <= info.days; day += 1) {
    var dayTotal = allRows.reduce(function (sum, row) { return sum + (Number(row.values && row.values[day]) || 0); }, 0);
    grand += dayTotal;
    totals += '<td class="' + dayMeta(month, day).className + '">' + html(displayValue(dayTotal || "")) + "</td>";
   }
   totals += '<td class="sum">' + html(displayValue(grand)) + "</td></tr>";
   var table = '<table class="company-status-table"><thead>' + tableHead(month, "Firma / skupina", false) + "</thead><tbody>" + body + "</tbody><tfoot>" + totals + "</tfoot></table>";
   pages.push(page("STAV PRACOVNÍKOV", month, pageIndex + 1, chunks.length, "denný počet osôb", table, allRows.length + " skupín · spolu " + displayValue(grand)));
   rowOffset += rows.length;
  });
  return pages;
 }

 function employeePages(month, kind) {
  var isThp = kind === "thp";
  var sheet = isThp ? thpTimesheet(month, true) : betpresTimesheet(month, true);
  var rows = sheet.rows || [];
  var rowsPerPage = 14;
  var chunks = splitRows(rows, rowsPerPage);
  var info = monthInfo(month);
  var title = isThp ? "PODSMENOVKA THP" : "PODSMENOVKA BETPRES";
  var pages = [];
  function combinedHtml(value, overtime) {
   var regular = displayValue(value);
   var extra = displayValue(overtime);
   if (!regular && !extra) return "";
   return '<span class="thp-stack"><span>' + html(regular) + '</span>' + (extra ? '<span class="thp-extra">' + html(extra) + '</span>' : "") + '</span>';
  }
  chunks.forEach(function (pageRows, pageIndex) {
   var body = "";
   pageRows.forEach(function (row, rowIndex) {
    if (!row) {
     body += '<tr><td class="empty" colspan="' + (info.days + 3) + '">V tejto podsmenovke zatiaľ nie sú pridaní pracovníci.</td></tr>';
     return;
    }
    var total = 0;
    var overtimeTotal = 0;
    row.overtime = row.overtime || {};
    var employeePosition = row.position || "";
    var rewardValue = !isThp && row.rewardPercent !== undefined && row.rewardPercent !== "" ? displayValue(row.rewardPercent) : "";
    body += '<tr><td>' + (pageIndex * rowsPerPage + rowIndex + 1) + '</td><td class="name"><strong>' + html(row.name || "") + "</strong>" + (employeePosition ? '<small>' + html(employeePosition) + '</small>' : "") + (rewardValue ? '<span class="employee-reward">Odmena <b>' + html(rewardValue) + " %</b></span>" : "") + "</td>";
    for (var day = 1; day <= info.days; day += 1) {
     var value = row.values && row.values[day];
     var overtimeValue = isThp && row.overtime ? row.overtime[day] : "";
     total += attendanceHours(value);
     overtimeTotal += attendanceHours(overtimeValue);
      body += '<td class="' + dayMeta(month, day).className + '">' + (isThp ? combinedHtml(value, overtimeValue) : html(displayValue(value))) + "</td>";
    }
     body += '<td class="sum">' + (isThp ? combinedHtml(total, overtimeTotal) : html(displayValue(total))) + "</td></tr>";
   });
   var totals = '<tr><td colspan="2" class="name">Spolu za deň</td>';
   var grand = 0;
   var overtimeGrand = 0;
   for (var day = 1; day <= info.days; day += 1) {
    var dayTotal = rows.reduce(function (sum, row) { return sum + attendanceHours(row.values && row.values[day]); }, 0);
    var overtimeDayTotal = isThp ? rows.reduce(function (sum, row) { return sum + attendanceHours(row.overtime && row.overtime[day]); }, 0) : 0;
    grand += dayTotal;
    overtimeGrand += overtimeDayTotal;
     totals += '<td class="' + dayMeta(month, day).className + '">' + (isThp ? combinedHtml(dayTotal || "", overtimeDayTotal || "") : html(displayValue(dayTotal || ""))) + "</td>";
   }
    totals += '<td class="sum">' + (isThp ? combinedHtml(grand, overtimeGrand) : html(displayValue(grand))) + "</td></tr>";
   var table = '<table class="employee-timesheet-table ' + (isThp ? "thp-employee-timesheet-table" : "betpres-employee-timesheet-table") + '"><thead>' + tableHead(month, isThp ? "Meno a pozícia" : "Meno, pozícia a odmena", false) + "</thead><tbody>" + body + "</tbody><tfoot>" + totals + "</tfoot></table>";
    var detail = rows.length + " pracovníkov" + (isThp ? " · hodiny a nadčas pod sebou" : " · bežné hodiny");
    var summary = isThp && !grand && !overtimeGrand ? "" : displayValue(grand) + " h" + (isThp && overtimeGrand ? " · " + displayValue(overtimeGrand) + " h nadčas" : "");
   pages.push(page(title, month, pageIndex + 1, chunks.length, detail, table, summary));
  });
  return pages;
 }

 function companyHourPages(row, month) {
  var workers = companyHourWorkers(row);
  var chunks = splitRows(workers, 12);
  var info = monthInfo(month);
  var rate = companyHourRate(row);
  var companyName = companyHourRowName(row);
  var allHours = companyHourRowHours(row);
  var pages = [];
  chunks.forEach(function (pageRows, pageIndex) {
   var body = "";
   pageRows.forEach(function (worker, rowIndex) {
    if (!worker) {
     body += '<tr><td class="empty" colspan="' + (info.days + 4) + '">V smenovke zatiaľ nie sú pridaní pracovníci.</td></tr>';
     return;
    }
    var total = 0;
    body += "<tr><td>" + (pageIndex * 12 + rowIndex + 1) + '</td><td class="name"><strong>' + html(worker.name || "") + "</strong></td>";
    for (var day = 1; day <= info.days; day += 1) {
     var value = worker.values && worker.values[day];
     total += attendanceHours(value);
     body += '<td class="' + dayMeta(month, day).className + '">' + html(displayValue(value)) + "</td>";
    }
    body += '<td class="sum">' + html(displayValue(total)) + '</td><td class="amount">' + html(euro.format(total * rate)) + "</td></tr>";
   });
   var totals = '<tr><td colspan="2" class="name">Spolu za deň</td>';
   for (var day = 1; day <= info.days; day += 1) {
    totals += '<td class="' + dayMeta(month, day).className + '">' + html(displayValue(companyHourDayTotal(row, day) || "")) + "</td>";
   }
   totals += '<td class="sum">' + html(displayValue(allHours)) + '</td><td class="amount">' + html(euro.format(allHours * rate)) + "</td></tr>";
   var table = "<table><thead>" + tableHead(month, "Pracovník", true) + "</thead><tbody>" + body + "</tbody><tfoot>" + totals + "</tfoot></table>";
   pages.push(page("HODINOVÁ SMENOVKA – " + companyName, month, pageIndex + 1, chunks.length, euro.format(rate) + "/h", table, displayValue(allHours) + " h · " + euro.format(allHours * rate)));
  });
  return pages;
 }

 async function exportWorkerStatusPdf() {
  var month = currentMonth();
  return savePdf("Stav pracovníkov", "stav-pracovnikov-" + safePart(projectLabel()) + "-" + month + ".pdf", companyStatusPages(month));
 }

 async function exportEmployeePdf(kind) {
  var month = currentMonth();
  var label = kind === "thp" ? "podsmenovka-thp" : "podsmenovka-betpres";
  return savePdf(label, label + "-" + safePart(projectLabel()) + "-" + month + ".pdf", employeePages(month, kind));
 }

 async function exportCompanyHourPdf(rowId) {
  var month = currentMonth();
  var sheet = companyHourTimesheet(month, false);
  var row = sheet && sheet.rows ? sheet.rows.find(function (item) { return item.id === rowId; }) : null;
  if (!row) {
   alert("Smenovka firmy sa nenašla.");
   return { ok: false, reason: "missing-row" };
  }
  return savePdf("Hodinová smenovka", "hodinova-smenovka-" + safePart(companyHourRowName(row)) + "-" + month + ".pdf", companyHourPages(row, month));
 }

 async function exportAllPdf() {
  var month = currentMonth();
  var pages = companyStatusPages(month).concat(employeePages(month, "betpres"), employeePages(month, "thp"));
  var hourSheet = companyHourTimesheet(month, false);
  if (hourSheet && hourSheet.rows) hourSheet.rows.forEach(function (row) { pages = pages.concat(companyHourPages(row, month)); });
  return savePdf("Všetky smenovky", "vsetky-smenovky-" + safePart(projectLabel()) + "-" + month + ".pdf", pages);
 }

 function chooseCompanyHourPdf() {
  var month = currentMonth();
  var sheet = companyHourTimesheet(month, false);
  if (!sheet || !sheet.rows || !sheet.rows.length) {
   alert("Najprv pridaj firmu na hodiny.");
   return;
  }
  if (sheet.rows.length === 1) {
   exportCompanyHourPdf(sheet.rows[0].id);
   return;
  }
  var list = sheet.rows.map(function (row, index) { return (index + 1) + ". " + companyHourRowName(row); }).join("\n");
  var answer = prompt("Ktorú firemnú smenovku chceš exportovať?\n\n" + list + "\n\nZadaj číslo firmy:");
  if (answer == null) return;
  var index = Number(String(answer).trim()) - 1;
  if (!Number.isInteger(index) || !sheet.rows[index]) {
   alert("Neplatné číslo firmy.");
   return;
  }
  exportCompanyHourPdf(sheet.rows[index].id);
 }

 function bind(id, handler) {
  var button = el(id);
  if (!button) return;
  button.onclick = function () {
   button.disabled = true;
   Promise.resolve(handler()).finally(function () { button.disabled = false; });
  };
 }

 bind("exportAllTimesheetsPdf", exportAllPdf);
 bind("exportWorkersPdf", exportWorkerStatusPdf);
 bind("exportBetpresTimesheetPdf", function () { return exportEmployeePdf("betpres"); });
 bind("exportThpTimesheetPdf", function () { return exportEmployeePdf("thp"); });
 bind("exportCompanyHoursPdf", chooseCompanyHourPdf);

 window.exportCompanyHourTimesheetPdf = exportCompanyHourPdf;
 window.chooseCompanyHourTimesheetForExport = chooseCompanyHourPdf;

 window.__BETPRES_RUN_EXPORT_TESTS__ = async function () {
  var month = todayMonthValue();
  selectedWorkerMonth = month;
  if (el("workerMonth")) el("workerMonth").value = month;

  var statusSheet = workerSheet(month, true);
  if (!statusSheet.rows.some(function (row) { return !isBetpresWorkerRow(row); })) {
   statusSheet.rows.push({ id: uid("test-company"), name: "Testovacia firma", alias: "Testovacia firma", actualName: "Testovacia firma", companyId: "", values: { 1: 4, 2: 5, 3: 3 } });
  }
  var betpresSheet = betpresTimesheet(month, true);
  if (!betpresSheet.rows.length) betpresSheet.rows.push({ id: uid("test-betpres"), name: "Testovací pracovník", position: "Montér", rewardPercent: 12.5, values: { 1: 8, 2: 8, 3: "P" } });
  if (betpresSheet.rows.length && (betpresSheet.rows[0].rewardPercent === undefined || betpresSheet.rows[0].rewardPercent === "")) betpresSheet.rows[0].rewardPercent = 12.5;
  var rewardExportHtml = employeePages(month, "betpres").join("");
  if (rewardExportHtml.indexOf('class="employee-reward"') === -1 || rewardExportHtml.indexOf("Odmena") === -1) throw new Error("V PDF podsmenovky BETPRES chýba percento odmeny.");
  var thpSheet = thpTimesheet(month, true);
  if (!thpSheet.rows.length) thpSheet.rows.push({ id: uid("test-thp"), name: "Testovací technik", position: "THP", values: { 1: 8, 2: 9 }, overtime: {} });
  var hourSheet = companyHourTimesheet(month, true);
  if (!hourSheet.rows.length) {
   hourSheet.rows.push({ id: uid("test-hours"), companyId: "", companyName: "Testovacia hodinová firma", hourlyRate: "25", description: "Test exportu", workersText: "Testovací pracovník", workers: [{ id: uid("test-worker"), name: "Testovací pracovník", values: { 1: 8, 2: 7.5 } }], values: {}, statementItemId: "" });
  }
  var firstAssignment = activeAssignments()[0];
  if (firstAssignment) {
   selectedWorkCompanyId = firstAssignment.companyId;
   selectedWorkPeriod = month;
   if (!Array.isArray(firstAssignment.addenda)) firstAssignment.addenda = [];
   if (!firstAssignment.addenda.length) firstAssignment.addenda.push({ id: uid("test-addendum"), number: "1", name: "Testovací dodatok", price: "500" });
   var statement = getWorkStatement(true);
   if (statement && !statement.items.length) {
    var workItem = createBlankWorkItem();
    workItem.pc = "1";
    workItem.code = "TEST";
    workItem.description = "Test exportu súpisu prác";
    workItem.unit = "hod";
    workItem.contractQty = "10";
    workItem.unitPrice = "25";
    workItem.currentQty = "8";
    statement.items.push(workItem);
   }
   var testAddendum = firstAssignment.addenda[0];
   var testAddendumId = "assignment-addendum:" + testAddendum.id;
   if (statement && !statement.items.some(function (item) { return item.sourceDocId === testAddendumId; })) {
    var addendumItem = createBlankWorkItem(assignmentAddendumLabel(testAddendum), testAddendumId);
    addendumItem.pc = "D1";
    addendumItem.code = "DOD-TEST";
    addendumItem.description = "Test exportu položky dodatku";
    addendumItem.unit = "ks";
    addendumItem.contractQty = "2";
    addendumItem.unitPrice = "250";
    addendumItem.currentQty = "1";
    statement.items.push(addendumItem);
   }
  }
  syncBetpresWorkerRow(month, statusSheet);

  var tests = [
   ["stav-pracovnikov", exportWorkerStatusPdf],
   ["podsmenovka-betpres", function () { return exportEmployeePdf("betpres"); }],
   ["podsmenovka-thp", function () { return exportEmployeePdf("thp"); }],
   ["hodinova-smenovka", function () { return exportCompanyHourPdf(hourSheet.rows[0].id); }],
   ["vsetky-smenovky", exportAllPdf],
   ["supis-prac-pdf", function () {
    var button = el("exportWorkPdf");
    return button && typeof button.onclick === "function" ? button.onclick() : { ok: false, reason: "missing-handler" };
   }],
   ["vady-fotodokumentacia", async function () {
    var response = await fetch("assets/images/navigation-logo.png");
    var blob = await response.blob();
    var companyId = activeAssignments()[0] ? activeAssignments()[0].companyId : "";
    var defectId = uid("test-defect-photo");
    var photoPath = "workspace-test/defects/" + defectId + "/mobile-photo.png";
    var defect = {id:defectId,projectId:state.selectedProjectId,companyId:companyId,number:"V-TEST-PHOTO",location:"Test mobilnej fotodokumentácie",description:"Automatický test všetkých fotografií stiahnutých z mobilného cloudu.",dueDate:todayISO(),severity:"Bežná",status:"Nová",photos:Array.from({length:10},function (_,index) { return {id:uid("test-photo"),name:"mobile-photo-"+(index+1)+".png",type:"image/png",path:photoPath}; })};
    var previousConfig = cloudConfig;
    var previousSession = cloudSession;
    var originalFetch = window.fetch;
    cloudConfig = Object.assign({}, previousConfig, {url:"https://cloud-photo.test",key:"test-anon-key",lastCloudVersion:7});
    cloudSession = {access_token:"test-access-token",refresh_token:"test-refresh-token",expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"test-user"}};
    defectPhotoUrlCache.delete(photoPath);
    window.fetch = function (input, options) {
     var url = String(input || "");
     if (url.indexOf("/rest/v1/sitedesk_workspaces") >= 0) {
      return Promise.resolve(new Response(JSON.stringify([{id:"workspace-test",data_version:7,data:{projects:[],companies:[]}}]),{status:200,headers:{"Content-Type":"application/json"}}));
     }
     if (url.indexOf("/storage/v1/object/authenticated/sitedesk-files/") >= 0 && url.indexOf("mobile-photo.png") >= 0) {
      return Promise.resolve(new Response(blob,{status:200,headers:{"Content-Type":"image/png"}}));
     }
     return originalFetch.call(window,input,options);
    };
    state.defects.push(defect);
    selectedDefectIds = new Set([defect.id]);
    try {
     var result = await exportDefectsPdf();
     result.responsible = defectResponsibleName(defect);
     result.responsibleOK = Boolean(result.responsible && result.responsible !== defectCompanyName(defect));
     result.allPhotosOK = result.photoCount === 10 && result.photoPages === 2;
     result.ok = Boolean(result.ok && result.responsibleOK && result.allPhotosOK);
     return result;
    } finally {
     window.fetch = originalFetch;
     cloudConfig = previousConfig;
     cloudSession = previousSession;
     defectPhotoUrlCache.delete(photoPath);
    }
   }]
  ];
  var results = [];
  for (var index = 0; index < tests.length; index += 1) {
   var result = await tests[index][1]();
   result = result || { ok: false };
   result.export = tests[index][0];
   results.push(result);
  }
  return results;
 };
})();
