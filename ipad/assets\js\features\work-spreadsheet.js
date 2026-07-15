(function () {
 "use strict";

 var fields = ["pc", "type", "code", "description", "unit", "contractQty", "unitPrice", "contractTotal", "currentQty"];
 var labels = {
  pc: "P. č.", type: "Typ", code: "Kód položky", description: "Popis položky", unit: "MJ",
  contractQty: "Zmluvné množstvo", unitPrice: "Jednotková cena", contractTotal: "Cena celkom", currentQty: "Aktuálne množstvo"
 };
 var active = { itemId: "", field: "" };

 function cellSelector(itemId, field) {
  return '[data-work-item="' + CSS.escape(itemId) + '"][data-work-field="' + CSS.escape(field) + '"]';
 }

 function ensureBar() {
  var panel = document.querySelector("#workStatements .work-table-panel");
  if (!panel || document.getElementById("workExcelBar")) return;
  var bar = document.createElement("div");
  bar.id = "workExcelBar";
  bar.className = "work-excel-bar";
  bar.innerHTML = '<div class="work-cell-name" id="workCellName">A1</div><div class="work-cell-fx">fx</div><input class="work-cell-formula" id="workCellFormula" aria-label="Hodnota vybranej bunky" placeholder="Klikni do bunky v súpise"><div class="work-cell-help">Šípky / Enter / Tab · Ctrl+V z Excelu · Ctrl+Z späť</div>';
  panel.parentNode.insertBefore(bar, panel);
  var formula = document.getElementById("workCellFormula");
  formula.addEventListener("input", function () {
   if (!active.itemId || !active.field) return;
   var input = document.querySelector(cellSelector(active.itemId, active.field));
   if (!input) return;
   input.value = formula.value;
   input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  formula.addEventListener("keydown", function (event) {
   if (event.key !== "Enter") return;
   event.preventDefault();
   focusRelative(1, 0);
  });
 }

 function visibleRows() {
  return Array.from(document.querySelectorAll("#workStatementBody tr[data-work-row]"));
 }

 function position(itemId, field) {
  var rows = visibleRows();
  return { row: rows.findIndex(function (row) { return row.dataset.workRow === itemId; }), col: fields.indexOf(field), rows: rows };
 }

 function setActive(input) {
  if (!input || !input.dataset.workItem) return;
  ensureBar();
  active.itemId = input.dataset.workItem;
  active.field = input.dataset.workField;
  document.querySelectorAll("#workStatementTable .work-active-cell").forEach(function (cell) { cell.classList.remove("work-active-cell"); });
  if (input.closest("td")) input.closest("td").classList.add("work-active-cell");
  var pos = position(active.itemId, active.field);
  var name = document.getElementById("workCellName");
  var formula = document.getElementById("workCellFormula");
  if (name) name.textContent = String.fromCharCode(65 + Math.max(0, pos.col)) + String(Math.max(1, pos.row + 1));
  if (formula && document.activeElement !== formula) formula.value = input.value;
  if (formula) formula.title = (labels[active.field] || active.field) + " – " + input.value;
 }

 function focusCell(itemId, field) {
  window.setTimeout(function () {
   var input = document.querySelector(cellSelector(itemId, field));
   if (!input) return;
   input.focus();
   if (typeof input.select === "function") input.select();
   setActive(input);
   input.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, 0);
 }

 function focusRelative(rowDelta, colDelta) {
  if (!active.itemId || !active.field) return;
  var pos = position(active.itemId, active.field);
  if (pos.row < 0 || pos.col < 0 || !pos.rows.length) return;
  var nextRow = Math.max(0, Math.min(pos.rows.length - 1, pos.row + rowDelta));
  var nextCol = Math.max(0, Math.min(fields.length - 1, pos.col + colDelta));
  focusCell(pos.rows[nextRow].dataset.workRow, fields[nextCol]);
 }

 function handleGridKey(event) {
  var input = event.target.closest && event.target.closest("[data-work-item][data-work-field]");
  if (!input || !document.getElementById("workStatements").contains(input)) return;
  setActive(input);
  var rowDelta = 0, colDelta = 0, navigate = false, multiline = input.tagName === "TEXTAREA";
  if (event.key === "Enter" && !event.altKey && (!multiline || event.ctrlKey)) { rowDelta = event.shiftKey ? -1 : 1; navigate = true; }
  else if (event.key === "Tab") { colDelta = event.shiftKey ? -1 : 1; navigate = true; }
  else if (event.key === "ArrowUp" && event.ctrlKey) { rowDelta = -1; navigate = true; }
  else if (event.key === "ArrowDown" && event.ctrlKey) { rowDelta = 1; navigate = true; }
  else if (event.key === "ArrowLeft" && event.ctrlKey) { colDelta = -1; navigate = true; }
  else if (event.key === "ArrowRight" && event.ctrlKey) { colDelta = 1; navigate = true; }
  else if (event.key === "Escape") { input.blur(); return; }
  if (!navigate) return;
  event.preventDefault();
  var pos = position(input.dataset.workItem, input.dataset.workField);
  if (pos.row < 0 || pos.col < 0) return;
  var nextRow = pos.row + rowDelta, nextCol = pos.col + colDelta;
  if (nextCol >= fields.length) { nextCol = 0; nextRow += 1; }
  if (nextCol < 0) { nextCol = fields.length - 1; nextRow -= 1; }
  nextRow = Math.max(0, Math.min(pos.rows.length - 1, nextRow));
  var itemId = pos.rows[nextRow].dataset.workRow, field = fields[nextCol];
  input.blur();
  focusCell(itemId, field);
 }

 function restoreActive() {
  ensureBar();
  if (!active.itemId || !active.field) return;
  var input = document.querySelector(cellSelector(active.itemId, active.field));
  if (input) setActive(input);
 }

 document.addEventListener("focusin", function (event) {
  if (event.target.matches && event.target.matches("#workStatementTable [data-work-item][data-work-field]")) setActive(event.target);
 });
 document.addEventListener("keydown", handleGridKey, true);
 document.addEventListener("DOMContentLoaded", function () {
  ensureBar();
  var body = document.getElementById("workStatementBody");
  if (body) new MutationObserver(function () { window.requestAnimationFrame(restoreActive); }).observe(body, { childList: true, subtree: true });
 });
})();
