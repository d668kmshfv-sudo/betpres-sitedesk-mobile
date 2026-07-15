(function () {
 "use strict";

 var TEMPLATE_VERSION = "BETPRES-WS-2";
 var pendingImport = null;

 function byId(id) { return document.getElementById(id); }
 function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
   return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
 }
 function xml(value) {
  return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
 }
 function columnName(number) {
  var output = "";
  while (number) {
   number -= 1;
   output = String.fromCharCode(65 + (number % 26)) + output;
   number = Math.floor(number / 26);
  }
  return output;
 }
 function cell(reference, value, style, formula) {
  var stylePart = style ? ' s="' + style + '"' : "";
  if (formula) return '<c r="' + reference + '"' + stylePart + "><f>" + xml(formula) + "</f></c>";
  if (typeof value === "number" && Number.isFinite(value)) return '<c r="' + reference + '"' + stylePart + "><v>" + value + "</v></c>";
  return '<c r="' + reference + '" t="inlineStr"' + stylePart + "><is><t>" + xml(value) + "</t></is></c>";
 }
 function rowXml(number, values, styles, formulas, height) {
  var cells = values.map(function (value, index) {
   return cell(columnName(index + 1) + number, value, styles[index] || 0, formulas[index] || "");
  }).join("");
  return '<row r="' + number + '"' + (height ? ' ht="' + height + '" customHeight="1"' : "") + ">" + cells + "</row>";
 }
 function padded(values, length) {
  var result = values.slice();
  while (result.length < length) result.push("");
  return result;
 }
 function itemCurrentValue(item, calculated) {
  return String(item.currentQty == null ? "" : item.currentQty).trim() === "" ? "" : calculated.currentQty;
 }

 function synchronizeStatementBudgets(statement) {
  var added = 0;
  if (typeof workBudgetList === "function" && typeof addBudgetItemsToStatement === "function") {
   (workBudgetList(statement.companyId) || []).forEach(function (budget) {
    added += addBudgetItemsToStatement(statement, budget, { replace: false });
   });
  }
  var itemCount = (statement.items || []).filter(function (item) { return !isWorkDocSectionItem(item); }).length;
  if (added) {
   statement.updatedAt = new Date().toISOString();
   if (typeof commitDirectState === "function") commitDirectState();
   if (typeof renderWorkStatements === "function") renderWorkStatements();
  }
  if (!itemCount) throw new Error("Súpis nemá žiadne položky. Najprv importuj rozpočet ZoD alebo dodatku, prípadne pridaj položky do otvoreného dokladu.");
  return itemCount;
 }

 function workbookStyles() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
   '<numFmts count="2"><numFmt numFmtId="164" formatCode="0.000"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>' +
   '<fonts count="5">' +
    '<font><sz val="9"/><name val="Aptos"/></font>' +
    '<font><b/><sz val="18"/><color rgb="FF082F61"/><name val="Aptos Display"/></font>' +
    '<font><b/><sz val="9"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>' +
    '<font><b/><sz val="9"/><color rgb="FF173753"/><name val="Aptos"/></font>' +
    '<font><sz val="9"/><color rgb="FF526D7E"/><name val="Aptos"/></font>' +
   '</fonts>' +
   '<fills count="9">' +
    '<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF082F61"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE3F4E9"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D8"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE6F0F8"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF174F7F"/></patternFill></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>' +
   '</fills>' +
   '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFA9BAC8"/></left><right style="thin"><color rgb="FFA9BAC8"/></right><top style="thin"><color rgb="FFA9BAC8"/></top><bottom style="thin"><color rgb="FFA9BAC8"/></bottom><diagonal/></border></borders>' +
   '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
   '<cellXfs count="20">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="8" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' +
    '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' +
    '<xf numFmtId="165" fontId="3" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf>' +
    '<xf numFmtId="164" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyNumberFormat="1" applyProtection="1"><alignment horizontal="right" vertical="center"/><protection locked="0"/></xf>' +
    '<xf numFmtId="165" fontId="3" fillId="4" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0"><alignment horizontal="left"/></xf>' +
    '<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>' +
   '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>';
 }

 async function logoBytes() {
  try {
   var response = await fetch(BETPRES_LOGO_IMAGE);
   if (!response.ok) return null;
   return await response.arrayBuffer();
  } catch (error) { return null; }
 }

 async function buildWorkStatementWorkbook(statement) {
  synchronizeStatementBudgets(statement);
  var projectData = activeProject();
  var companyData = company(statement.companyId);
  var assignmentData = assignment(statement.projectId, statement.companyId);
  var documentShort = assignmentDocShort(assignmentData);
  var sourceItems = workItemsWithDocumentSections(statement);
  var zip = new JSZip();
  var sheetRows = [];
  var merges = ["A1:B1", "C1:N1", "A2:G2", "H2:N2", "A3:D3", "E3:H3", "I3:K3", "L3:N3", "A4:N4", "A6:E6", "F6:H6", "I6:J6", "K6:L6", "M6:N6"];
  var topStyles = padded([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], 18);
  sheetRows.push(rowXml(1, padded(["", "", "SÚPIS VYKONANÝCH PRÁC – EXCEL PRE SUBDODÁVATEĽA"], 18), topStyles, {}, 42));
  sheetRows.push(rowXml(2, padded(["OBJEDNÁVATEĽ: BETPRES, s.r.o.", "", "", "", "", "", "", "ZHOTOVITEĽ: " + (companyData && companyData.name || "")], 18), padded(Array(14).fill(2), 18), {}, 24));
  sheetRows.push(rowXml(3, padded(["STAVBA: " + (projectData && projectData.name || ""), "", "", "", documentShort + " č.: " + (assignmentData && assignmentData.contractNo || "—"), "", "", "", "OBDOBIE: " + formatBillingMonth(statement.period), "", "", "SÚPIS č. " + (statement.number || "—") + " · " + fmtDateISO(statement.statementDate)], 18), padded(Array(14).fill(2), 18), {}, 24));
  sheetRows.push(rowXml(4, padded(["POKYNY: Vyplň iba zelené bunky v stĺpci AKTUÁLNY MESIAC – MNOŽSTVO. Ostatné údaje sú chránené a program ich po vrátení skontroluje."], 18), padded(Array(14).fill(4), 18), {}, 28));
  sheetRows.push(rowXml(5, padded([], 18), padded([], 18), {}, 8));
  var groups = padded(["POLOŽKY", "", "", "", "", "ROZPOČET (" + documentShort + ")", "", "", "AKTUÁLNY MESIAC", "", "DOTERAZ ČERPANÉ", "", "ZOSTÁVA ČERPAŤ", ""], 18);
  var groupStyles = padded([3,3,3,3,3,3,3,3,4,4,5,5,6,6], 18);
  sheetRows.push(rowXml(6, groups, groupStyles, {}, 26));
  var headers = ["TYP", "KÓD", "PODKÓD", "POPIS POLOŽKY", "MJ", "MNOŽSTVO", "J. CENA €", "CENA €", "MNOŽSTVO", "CENA €", "MNOŽSTVO", "CENA €", "MNOŽSTVO", "CENA €", "BETPRES_ITEM_ID", "BETPRES_STATEMENT_ID", "BETPRES_TEMPLATE_VERSION", "BETPRES_SOURCE"];
  sheetRows.push(rowXml(7, headers, [7,7,7,7,7,7,7,7,4,4,5,5,6,6,18,18,18,18], {}, 32));

  sourceItems.forEach(function (item, index) {
   var rowNumber = index + 8;
   var calculated = workItemCalc(statement, item);
   var section = String(item.type || "").toUpperCase() === "D";
   if (section) {
    var sectionValues = padded([item.pc || "", item.type || "D", item.code || "", item.description || "", "", "", "", "", "", "", "", "", "", "", item.id || "", statement.id, TEMPLATE_VERSION, workItemSourceLabel(item) || ""], 18);
    sheetRows.push(rowXml(rowNumber, sectionValues, [12,12,12,12,12,12,12,12,12,12,12,12,12,12,18,18,18,18], {}, 21));
    merges.push("D" + rowNumber + ":N" + rowNumber);
    return;
   }
   var priceOnly = isWorkPriceOnlyItem(item);
   var currentValue = itemCurrentValue(item, calculated);
   var values = [
    item.pc || "", item.type || "K", item.code || "", item.description || "", item.unit || "",
    priceOnly ? "" : calculated.contractQty, priceOnly ? "" : calculated.unitPrice, calculated.contractTotal,
    priceOnly ? "" : currentValue, calculated.currentPrice,
    priceOnly ? "" : calculated.previousQty, calculated.previousPrice,
    priceOnly ? "" : calculated.remainingQty, calculated.remainingPrice,
    item.id || "", statement.id, TEMPLATE_VERSION, workItemSourceLabel(item) || "ZoD"
   ];
   var formulas = {};
   if (!priceOnly) {
    formulas[9] = 'IF(I' + rowNumber + '="","",I' + rowNumber + '*G' + rowNumber + ')';
    formulas[12] = 'IF(F' + rowNumber + '="","",F' + rowNumber + '-K' + rowNumber + '-IF(I' + rowNumber + '="",0,I' + rowNumber + '))';
    formulas[13] = 'IF(H' + rowNumber + '="","",H' + rowNumber + '-L' + rowNumber + '-IF(J' + rowNumber + '="",0,J' + rowNumber + '))';
   }
   sheetRows.push(rowXml(rowNumber, values, [9,9,9,15,9,10,11,11,priceOnly?10:16,17,10,11,10,11,18,18,18,18], formulas, 23));
  });

  var firstDataRow = 8;
  var lastDataRow = Math.max(firstDataRow, sourceItems.length + 7);
  var summaryRow = sourceItems.length + 8;
  var summaryValues = padded(["CELKOM (bez DPH)", "", "", "", "", "", "", 0, 0, 0, 0, 0, 0, 0], 18);
  var summaryFormulas = {7:"SUM(H"+firstDataRow+":H"+lastDataRow+")",8:"SUM(I"+firstDataRow+":I"+lastDataRow+")",9:"SUM(J"+firstDataRow+":J"+lastDataRow+")",10:"SUM(K"+firstDataRow+":K"+lastDataRow+")",11:"SUM(L"+firstDataRow+":L"+lastDataRow+")",12:"SUM(M"+firstDataRow+":M"+lastDataRow+")",13:"SUM(N"+firstDataRow+":N"+lastDataRow+")"};
  sheetRows.push(rowXml(summaryRow, summaryValues, [13,13,13,13,13,13,13,14,19,14,19,14,19,14,18,18,18,18], summaryFormulas, 25));
  merges.push("A" + summaryRow + ":G" + summaryRow);

  var logo = await logoBytes();
  var drawingTag = logo ? '<drawing r:id="rId1"/>' : "";
  var dataValidation = sourceItems.length ? '<dataValidations count="1"><dataValidation type="decimal" operator="between" allowBlank="1" showErrorMessage="1" errorTitle="Neplatné množstvo" error="Zadaj číslo, napríklad 12,5." sqref="I8:I' + lastDataRow + '"><formula1>-999999999</formula1><formula2>999999999</formula2></dataValidation></dataValidations>' : "";
  var sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
   '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
   '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:R' + summaryRow + '"/>' +
   '<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
   '<cols><col min="1" max="1" width="6" customWidth="1"/><col min="2" max="2" width="6" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="62" customWidth="1"/><col min="5" max="5" width="7" customWidth="1"/><col min="6" max="14" width="14" customWidth="1"/><col min="15" max="18" hidden="1" width="2" customWidth="1"/></cols>' +
   '<sheetData>' + sheetRows.join("") + '</sheetData><mergeCells count="' + merges.length + '">' + merges.map(function (range) { return '<mergeCell ref="' + range + '"/>'; }).join("") + '</mergeCells>' +
   '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="1" formatColumns="1" formatRows="1" insertColumns="1" insertRows="1" deleteColumns="1" deleteRows="1" selectLockedCells="1"/>' +
   dataValidation + '<pageMargins left="0.25" right="0.25" top="0.45" bottom="0.45" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
   '<headerFooter><oddHeader>&amp;C&amp;B' + xml(companyData && companyData.name || "") + '</oddHeader><oddFooter>&amp;LBETPRES SiteDesk&amp;CStrana &amp;P / &amp;N&amp;R' + xml(formatBillingMonth(statement.period)) + '</oddFooter></headerFooter>' + drawingTag + '</worksheet>';

  var contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' + (logo ? '<Default Extension="png" ContentType="image/png"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : "") + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  zip.file("[Content_Types].xml", contentTypes);
  zip.folder("_rels").file(".rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.folder("xl").file("workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Súpis prác" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">\'Súpis prác\'!$A$1:$N$' + summaryRow + '</definedName></definedNames><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
  zip.folder("xl").folder("_rels").file("workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
  zip.folder("xl").folder("worksheets").file("sheet1.xml", sheet);
  zip.folder("xl").file("styles.xml", workbookStyles());
  if (logo) {
   zip.folder("xl").folder("media").file("image1.png", logo);
   zip.folder("xl").folder("worksheets").folder("_rels").file("sheet1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
   zip.folder("xl").folder("drawings").file("drawing1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>120000</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>80000</xdr:rowOff></xdr:from><xdr:to><xdr:col>2</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>1</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="BETPRES logo"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>');
   zip.folder("xl").folder("drawings").folder("_rels").file("drawing1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>');
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
 }

 async function buildExcelJsWorkStatementWorkbook(statement) {
  synchronizeStatementBudgets(statement);
  if (!window.ExcelJS) throw new Error("Knižnica pre vytvorenie Excelu sa nenačítala. Reštartuj aplikáciu a skús export znova.");
  var projectData = activeProject(), companyData = company(statement.companyId), assignmentData = assignment(statement.projectId, statement.companyId);
  var documentShort = assignmentDocShort(assignmentData), sourceItems = workItemsWithDocumentSections(statement);
  var workbook = new window.ExcelJS.Workbook();
  workbook.creator = "BETPRES SiteDesk";
  workbook.company = "BETPRES, s.r.o.";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  var sheet = workbook.addWorksheet("Súpis prác", {
   views: [{ state: "frozen", ySplit: 7, activeCell: "I8", showGridLines: false }],
   pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 } },
   headerFooter: { oddHeader: "&C&B" + (companyData && companyData.name || ""), oddFooter: "&LBETPRES SiteDesk&CStrana &P / &N&R" + formatBillingMonth(statement.period) },
   properties: { defaultRowHeight: 20 }
  });
  var widths = [6,6,18,62,7,14,14,14,14,14,14,14,14,14,2,2,2,2];
  widths.forEach(function (width, index) { sheet.getColumn(index + 1).width = width; if (index >= 14) sheet.getColumn(index + 1).hidden = true; });
  sheet.mergeCells("A1:B1"); sheet.mergeCells("C1:N1"); sheet.mergeCells("A2:G2"); sheet.mergeCells("H2:N2");
  sheet.mergeCells("A3:D3"); sheet.mergeCells("E3:H3"); sheet.mergeCells("I3:K3"); sheet.mergeCells("L3:N3"); sheet.mergeCells("A4:N4");
  sheet.mergeCells("A6:E6"); sheet.mergeCells("F6:H6"); sheet.mergeCells("I6:J6"); sheet.mergeCells("K6:L6"); sheet.mergeCells("M6:N6");
  sheet.getCell("C1").value = "SÚPIS VYKONANÝCH PRÁC – EXCEL PRE SUBDODÁVATEĽA";
  sheet.getCell("A2").value = "OBJEDNÁVATEĽ: BETPRES, s.r.o.";
  sheet.getCell("H2").value = "ZHOTOVITEĽ: " + (companyData && companyData.name || "");
  sheet.getCell("A3").value = "STAVBA: " + (projectData && projectData.name || "");
  sheet.getCell("E3").value = documentShort + " č.: " + (assignmentData && assignmentData.contractNo || "—");
  sheet.getCell("I3").value = "OBDOBIE: " + formatBillingMonth(statement.period);
  sheet.getCell("L3").value = "SÚPIS č. " + (statement.number || "—") + " · " + fmtDateISO(statement.statementDate);
  sheet.getCell("A4").value = "POKYNY: Vyplň iba zelené bunky v stĺpci AKTUÁLNY MESIAC – MNOŽSTVO. Ostatné údaje sú chránené a program ich po vrátení skontroluje.";
  [["A6","POLOŽKY"],["F6","ROZPOČET (" + documentShort + ")"],["I6","AKTUÁLNY MESIAC"],["K6","DOTERAZ ČERPANÉ"],["M6","ZOSTÁVA ČERPAŤ"]].forEach(function (entry) { sheet.getCell(entry[0]).value = entry[1]; });
  ["TYP","KÓD","PODKÓD","POPIS POLOŽKY","MJ","MNOŽSTVO","J. CENA €","CENA €","MNOŽSTVO","CENA €","MNOŽSTVO","CENA €","MNOŽSTVO","CENA €","BETPRES_ITEM_ID","BETPRES_STATEMENT_ID","BETPRES_TEMPLATE_VERSION","BETPRES_SOURCE"].forEach(function (value, index) { sheet.getCell(7, index + 1).value = value; });

  var navy = "FF082F61", blue = "FF174F7F", pale = "FFEAF2F8", green = "FFE3F4E9", amber = "FFFFF3D8", remaining = "FFE6F0F8", borderColor = "FFA9BAC8";
  sheet.getRow(1).height = 42; sheet.getRow(2).height = 24; sheet.getRow(3).height = 24; sheet.getRow(4).height = 28; sheet.getRow(5).height = 8; sheet.getRow(6).height = 26; sheet.getRow(7).height = 32;
  sheet.getCell("C1").font = { name: "Aptos Display", size: 18, bold: true, color: { argb: navy } }; sheet.getCell("C1").alignment = { horizontal: "center", vertical: "middle" };
  ["A2","H2","A3","E3","I3","L3"].forEach(function (ref) { sheet.getCell(ref).font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF173753" } }; sheet.getCell(ref).fill = { type: "pattern", pattern: "solid", fgColor: { argb: pale } }; sheet.getCell(ref).alignment = { vertical: "middle", wrapText: true }; });
  sheet.getCell("A4").font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF173753" } }; sheet.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; sheet.getCell("A4").alignment = { vertical: "middle", wrapText: true };
  [["A6",navy],["F6",navy],["I6",green],["K6",amber],["M6",remaining]].forEach(function (entry) { var cellItem = sheet.getCell(entry[0]); cellItem.fill = { type: "pattern", pattern: "solid", fgColor: { argb: entry[1] } }; cellItem.font = { name: "Aptos", size: 9, bold: true, color: { argb: entry[1] === navy ? "FFFFFFFF" : "FF173753" } }; cellItem.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
  sheet.getRow(7).eachCell({ includeEmpty: true }, function (cellItem, colNumber) { cellItem.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colNumber <= 8 ? blue : colNumber <= 10 ? green : colNumber <= 12 ? amber : remaining } }; cellItem.font = { name: "Aptos", size: 9, bold: true, color: { argb: colNumber <= 8 ? "FFFFFFFF" : "FF173753" } }; cellItem.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });

  sourceItems.forEach(function (item, index) {
   var rowNumber = index + 8, row = sheet.getRow(rowNumber), calculated = workItemCalc(statement, item), section = String(item.type || "").toUpperCase() === "D", priceOnly = isWorkPriceOnlyItem(item);
   row.height = section ? 21 : 23;
   if (section) {
    [item.pc || "", item.type || "D", item.code || "", item.description || "", "", "", "", "", "", "", "", "", "", "", item.id || "", statement.id, TEMPLATE_VERSION, workItemSourceLabel(item) || ""].forEach(function (value, column) { row.getCell(column + 1).value = value; });
    sheet.mergeCells("D" + rowNumber + ":N" + rowNumber);
    row.eachCell({ includeEmpty: true }, function (cellItem) { cellItem.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } }; cellItem.font = { name: "Aptos", size: 9, bold: true, color: { argb: "FFFFFFFF" } }; cellItem.alignment = { vertical: "middle", wrapText: true }; });
   } else {
    var currentValue = itemCurrentValue(item, calculated);
    [item.pc || "", item.type || "K", item.code || "", item.description || "", item.unit || "", priceOnly ? null : calculated.contractQty, priceOnly ? null : calculated.unitPrice, calculated.contractTotal, priceOnly || currentValue === "" ? null : Number(currentValue), null, priceOnly ? null : calculated.previousQty, calculated.previousPrice, priceOnly ? null : calculated.remainingQty, calculated.remainingPrice, item.id || "", statement.id, TEMPLATE_VERSION, workItemSourceLabel(item) || "ZoD"].forEach(function (value, column) { row.getCell(column + 1).value = value; });
    if (!priceOnly) row.getCell(10).value = { formula: 'IF(I' + rowNumber + '=0,"",I' + rowNumber + '*G' + rowNumber + ')', result: currentValue === "" ? 0 : calculated.currentPrice };
    row.eachCell({ includeEmpty: true }, function (cellItem, colNumber) { cellItem.font = { name: "Aptos", size: 9, color: { argb: "FF102A43" } }; cellItem.alignment = { vertical: colNumber === 4 ? "top" : "middle", horizontal: colNumber >= 6 && colNumber <= 14 ? "right" : "left", wrapText: colNumber === 4 }; if ([6,9,11,13].includes(colNumber)) cellItem.numFmt = "0.000"; else if ([7,8,10,12,14].includes(colNumber)) cellItem.numFmt = "#,##0.00"; });
    row.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } }; row.getCell(9).font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF173753" } }; row.getCell(9).protection = { locked: false };
   }
  });
  var firstDataRow = 8, lastDataRow = Math.max(firstDataRow, sourceItems.length + 7), summaryRow = sourceItems.length + 8;
  sheet.mergeCells("A" + summaryRow + ":G" + summaryRow); sheet.getCell("A" + summaryRow).value = "CELKOM (bez DPH)";
  [[8,"SUM(H"+firstDataRow+":H"+lastDataRow+")"],[9,"SUM(I"+firstDataRow+":I"+lastDataRow+")"],[10,"SUM(J"+firstDataRow+":J"+lastDataRow+")"],[11,"SUM(K"+firstDataRow+":K"+lastDataRow+")"],[12,"SUM(L"+firstDataRow+":L"+lastDataRow+")"],[13,"SUM(M"+firstDataRow+":M"+lastDataRow+")"],[14,"SUM(N"+firstDataRow+":N"+lastDataRow+")"]].forEach(function (entry) { sheet.getCell(summaryRow, entry[0]).value = { formula: entry[1], result: 0 }; });
  sheet.getRow(summaryRow).height = 25; sheet.getRow(summaryRow).eachCell({ includeEmpty: true }, function (cellItem, colNumber) { cellItem.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colNumber === 9 || colNumber === 10 ? green : pale } }; cellItem.font = { name: "Aptos", size: 9, bold: true, color: { argb: "FF173753" } }; cellItem.alignment = { vertical: "middle", horizontal: colNumber >= 8 ? "right" : "left" }; if (colNumber >= 8 && colNumber <= 14) cellItem.numFmt = colNumber % 2 ? "0.000" : "#,##0.00"; });
  sheet.eachRow(function (row) { row.eachCell({ includeEmpty: true }, function (cellItem, colNumber) { if (colNumber <= 14) cellItem.border = { top: { style: "thin", color: { argb: borderColor } }, left: { style: "thin", color: { argb: borderColor } }, bottom: { style: "thin", color: { argb: borderColor } }, right: { style: "thin", color: { argb: borderColor } } }; }); });
  for (var rowNumber = 8; rowNumber <= lastDataRow; rowNumber += 1) sheet.getCell("I" + rowNumber).dataValidation = { type: "decimal", operator: "between", allowBlank: true, showErrorMessage: true, errorTitle: "Neplatné množstvo", error: "Zadaj číslo, napríklad 12,5.", formulae: [-999999999, 999999999] };
  var logo = await logoBytes();
  if (logo) { var imageId = workbook.addImage({ buffer: new Uint8Array(logo), extension: "png" }); sheet.addImage(imageId, { tl: { col: 0.15, row: 0.15 }, br: { col: 1.9, row: 1.15 }, editAs: "oneCell" }); }
  sheet.pageSetup.printArea = "A1:N" + summaryRow;
  await sheet.protect("", { selectLockedCells: false, selectUnlockedCells: true, formatCells: false, formatColumns: false, formatRows: false, insertRows: false, deleteRows: false });
  var buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
 }

 function numericValue(raw) {
  var normalized = String(raw == null ? "" : raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return { blank: true, ok: true, value: 0 };
  var value = Number(normalized);
  return { blank: false, ok: Number.isFinite(value), value: value };
 }
 function findHeader(rawRows) {
  for (var index = 0; index < Math.min(rawRows.length, 80); index += 1) {
   var row = rawRows[index] || [];
   var idColumn = row.findIndex(function (value) { return String(value || "").trim() === "BETPRES_ITEM_ID"; });
   if (idColumn >= 0) return { rowIndex: index, idColumn: idColumn, statementColumn: row.findIndex(function (value) { return String(value || "").trim() === "BETPRES_STATEMENT_ID"; }), versionColumn: row.findIndex(function (value) { return String(value || "").trim() === "BETPRES_TEMPLATE_VERSION"; }) };
  }
  return null;
 }
 function parseReturnedWorkbook(rawRows, statement) {
  var header = findHeader(rawRows);
  if (!header) return { fatal: "Toto nie je návratová šablóna BETPRES. Najprv ju vyexportuj tlačidlom „Excel pre subdodávateľa“.", updates: [], invalid: [], unchanged: 0, skipped: 0, totalDelta: 0 };
  var itemMap = new Map((statement.items || []).map(function (item) { return [String(item.id), item]; }));
  var updates = [], invalid = [], unchanged = 0, skipped = 0, totalDelta = 0, statementMismatch = false;
  for (var rowIndex = header.rowIndex + 1; rowIndex < rawRows.length; rowIndex += 1) {
   var row = rawRows[rowIndex] || [];
   var itemId = String(row[header.idColumn] || "").trim();
   if (!itemId) continue;
   var fileStatementId = header.statementColumn >= 0 ? String(row[header.statementColumn] || "").trim() : "";
   if (fileStatementId && fileStatementId !== String(statement.id)) { statementMismatch = true; continue; }
   if (String(row[1] || "").trim().toUpperCase() === "D") continue;
   var item = itemMap.get(itemId);
   if (!item) { skipped += 1; continue; }
   if (String(item.type || "").toUpperCase() === "D" || isWorkPriceOnlyItem(item)) continue;
   var parsed = numericValue(row[8]);
   if (parsed.blank) continue;
   if (!parsed.ok) { invalid.push({ row: rowIndex + 1, item: item, raw: row[8] }); continue; }
   var oldValue = parseWorkNumber(item.currentQty);
   var newValue = workRound(parsed.value, 6);
   if (Math.abs(oldValue - newValue) < 0.0000005) { unchanged += 1; continue; }
   var calculated = workItemCalc(statement, item);
   var over = newValue + calculated.previousQty > calculated.contractQty + 0.0005;
   var negative = newValue < 0;
   var delta = workRound((newValue - oldValue) * calculated.unitPrice, 2);
   totalDelta += delta;
   updates.push({ item: item, oldValue: oldValue, newValue: newValue, delta: delta, over: over, negative: negative, row: rowIndex + 1 });
  }
  if (statementMismatch) return { fatal: "Excel patrí k inému súpisu, firme alebo mesiacu. Otvor správny súpis a načítaj ho znova.", updates: [], invalid: invalid, unchanged: unchanged, skipped: skipped, totalDelta: 0 };
  return { fatal: "", updates: updates, invalid: invalid, unchanged: unchanged, skipped: skipped, totalDelta: workRound(totalDelta, 2) };
 }

 function normalizedSearch(value) {
  return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
 }
 function fileDataUrl(file) {
  return new Promise(function (resolve, reject) {
   var reader = new FileReader();
   reader.onload = function () { resolve(String(reader.result || "")); };
   reader.onerror = function () { reject(reader.error || new Error("Súbor sa nepodarilo načítať.")); };
   reader.readAsDataURL(file);
  });
 }
 function pdfPageRows(page) {
  var rows = [];
  (page.items || []).slice().sort(function (a, b) { return b.y - a.y || a.x - b.x; }).forEach(function (item) {
   var row = rows.find(function (candidate) { return Math.abs(candidate.y - item.y) <= 2.8; });
   if (!row) { row = { y: item.y, items: [] }; rows.push(row); }
   row.items.push(item);
  });
  rows.forEach(function (row) { row.items.sort(function (a, b) { return a.x - b.x; }); row.text = row.items.map(function (item) { return item.text; }).join(" "); });
  return rows;
 }
 function workResultFromPdf(pages, statement) {
  var allText = normalizedSearch((pages || []).flatMap(function (page) { return (page.items || []).map(function (item) { return item.text; }); }).join(" "));
  var companyName = normalizedSearch((company(statement.companyId) || {}).name || "");
  var periodName = normalizedSearch(formatBillingMonth(statement.period));
  if ((companyName && !allText.includes(companyName)) || (periodName && !allText.includes(periodName))) {
   return { fatal: "PDF patrí k inej firme alebo k inému mesiacu. Otvor správny súpis a načítaj súbor znova.", updates: [], invalid: [], unchanged: 0, skipped: 0, totalDelta: 0 };
  }
  var candidates = (statement.items || []).filter(function (item) { return String(item.type || "").toUpperCase() !== "D" && !isWorkPriceOnlyItem(item); });
  var updates = [], invalid = [], unchanged = 0, skipped = 0, totalDelta = 0;
  (pages || []).forEach(function (page) {
   var header = (page.items || []).filter(function (item) { return normalizedSearch(item.text).includes("aktualny mesiac"); }).sort(function (a, b) { return String(a.text || "").length - String(b.text || "").length; })[0];
   if (!header) return;
   var quantityMinX = header.x - 18, quantityMaxX = header.x + 44;
   pdfPageRows(page).forEach(function (row) {
    var rowSearch = normalizedSearch(row.text);
    var item = candidates.find(function (candidate) {
     var code = normalizedSearch(candidate.code || ""), description = normalizedSearch(candidate.description || "").slice(0, 34), pc = normalizedSearch(candidate.pc || "");
     return (code && rowSearch.includes(code)) || (description.length >= 12 && rowSearch.includes(description)) || (!code && pc && rowSearch.startsWith(pc + " "));
    });
    if (!item || updates.some(function (update) { return update.item.id === item.id; })) return;
    var quantityCell = row.items.find(function (cellItem) { return cellItem.x >= quantityMinX && cellItem.x <= quantityMaxX && /^[-+]?\s*[0-9][0-9\s.,]*$/.test(String(cellItem.text || "").trim()); });
    if (!quantityCell) return;
    var parsed = numericValue(quantityCell.text);
    if (!parsed.ok || parsed.blank) { invalid.push({ row: "PDF", item: item, raw: quantityCell.text }); return; }
    var oldValue = parseWorkNumber(item.currentQty), newValue = workRound(parsed.value, 6);
    if (Math.abs(oldValue - newValue) < 0.0000005) { unchanged += 1; return; }
    var calculated = workItemCalc(statement, item), delta = workRound((newValue - oldValue) * calculated.unitPrice, 2);
    totalDelta += delta;
    updates.push({ item: item, oldValue: oldValue, newValue: newValue, delta: delta, over: newValue + calculated.previousQty > calculated.contractQty + 0.0005, negative: newValue < 0, row: "PDF" });
   });
  });
  if (!updates.length && !invalid.length) return { fatal: "V PDF sa nenašli doplnené množstvá v stĺpci Aktuálny mesiac. PDF musí pochádzať z BETPRES šablóny a obsahovať čitateľný text; pri skene použi vrátený Excel.", updates: [], invalid: [], unchanged: unchanged, skipped: skipped, totalDelta: 0 };
  return { fatal: "", updates: updates, invalid: invalid, unchanged: unchanged, skipped: skipped, totalDelta: workRound(totalDelta, 2) };
 }

 function showImportPreview(result, fileName, statement) {
  pendingImport = { result: result, statementId: statement.id, fileName: fileName };
  byId("workReturnFileName").textContent = fileName + " · " + (company(statement.companyId) && company(statement.companyId).name || "") + " · " + formatBillingMonth(statement.period);
  byId("workReturnSummary").innerHTML = '<div><span>ZMENENÉ POLOŽKY</span><strong>' + result.updates.length + '</strong></div><div><span>ZMENA SUMY BEZ DPH</span><strong>' + (result.totalDelta >= 0 ? "+" : "") + workMoney(result.totalDelta) + ' €</strong></div><div><span>VYŽADUJÚ KONTROLU</span><strong>' + (result.invalid.length + result.updates.filter(function (update) { return update.over || update.negative; }).length) + '</strong></div>';
  var message = byId("workReturnMessage");
  message.className = "work-return-message";
  message.textContent = "";
  if (result.fatal) { message.className += " error"; message.textContent = result.fatal; }
  else if (result.invalid.length || result.skipped) { message.className += " warning"; message.textContent = "Niektoré riadky sa nedajú bezpečne načítať: " + result.invalid.length + " neplatných a " + result.skipped + " preskočených. Skontroluj náhľad."; }
  var rows = result.updates.map(function (update) {
   var warning = update.over ? "Prekročenie rozpočtu" : update.negative ? "Záporné množstvo" : "V poriadku";
   return '<tr class="' + (update.over || update.negative ? "is-warning" : "") + '"><td><strong>' + escapeHtml(update.item.code || update.item.pc || "Položka") + '</strong><br><small>' + escapeHtml(update.item.description || "") + '</small></td><td>' + escapeHtml(workQty(update.oldValue)) + '</td><td><strong>' + escapeHtml(workQty(update.newValue)) + '</strong></td><td>' + escapeHtml((update.newValue - update.oldValue >= 0 ? "+" : "") + workQty(update.newValue - update.oldValue)) + '</td><td><span class="work-return-status ' + (update.over || update.negative ? "warning" : "") + '">' + warning + '</span></td></tr>';
  }).join("");
  result.invalid.forEach(function (entry) {
   rows += '<tr class="is-warning"><td><strong>Riadok ' + entry.row + '</strong><br><small>' + escapeHtml(entry.item && entry.item.description || "") + '</small></td><td>—</td><td>' + escapeHtml(entry.raw) + '</td><td>—</td><td><span class="work-return-status warning">Neplatná hodnota</span></td></tr>';
  });
  byId("workReturnPreviewBody").innerHTML = rows || '<tr><td colspan="5" style="padding:24px;text-align:center;color:#6d8495">V súbore nie sú žiadne nové množstvá na doplnenie.</td></tr>';
  byId("confirmWorkReturnImport").disabled = Boolean(result.fatal) || !result.updates.length;
  byId("workReturnImportModal").classList.remove("hidden");
 }

 async function readReturnedFile(file) {
  var statement = getWorkStatement(false);
  if (!statement) throw new Error("Najprv otvor súpis firmy a mesiaca, ku ktorému Excel patrí.");
  synchronizeStatementBudgets(statement);
  var isPdf = /\.pdf$/i.test(file.name || "") || file.type === "application/pdf";
  var result;
  if (isPdf) {
   if (!window.betpresDesktop || typeof window.betpresDesktop.extractWorkStatementPdf !== "function") throw new Error("Import PDF je dostupný v nainštalovanej počítačovej aplikácii. Na iPade použi vyplnený Excel.");
   var extracted = await window.betpresDesktop.extractWorkStatementPdf({ dataUrl: await fileDataUrl(file) });
   result = workResultFromPdf(extracted && extracted.pages || [], statement);
  } else {
   var rows = await parseXlsx(file);
   result = parseReturnedWorkbook(rows, statement);
  }
  showImportPreview(result, file.name || "Vyplnený súpis.xlsx", statement);
  return result;
 }

 var exportButton = byId("exportWorkXlsx");
 if (exportButton) exportButton.onclick = async function () {
  var statement = getWorkStatement(true);
  if (!statement) return;
  exportButton.disabled = true;
  var original = exportButton.textContent;
  exportButton.textContent = "Pripravujem Excel…";
  try {
   var blob = await buildExcelJsWorkStatementWorkbook(statement);
   downloadWorkBlob(blob, workFileBase(statement) + "-pre-subdodavatela.xlsx");
   if (typeof toast === "function") toast("Excel pre subdodávateľa bol pripravený.");
  } catch (error) {
   alert("Excel sa nepodarilo vytvoriť: " + (error && error.message ? error.message : error));
  } finally {
   exportButton.disabled = false;
   exportButton.textContent = original;
  }
 };

 var importButton = byId("importCompletedWorkXlsx");
 var fileInput = byId("completedWorkXlsxFile");
 if (importButton && fileInput) {
  importButton.onclick = function () { fileInput.value = ""; fileInput.click(); };
  fileInput.onchange = async function () {
   var file = fileInput.files && fileInput.files[0];
   if (!file) return;
   importButton.disabled = true;
   var original = importButton.textContent;
   importButton.textContent = "Kontrolujem súpis…";
   try { await readReturnedFile(file); }
   catch (error) { alert("Excel sa nepodarilo načítať: " + (error && error.message ? error.message : error)); }
   finally { importButton.disabled = false; importButton.textContent = original; }
  };
 }

 var confirmButton = byId("confirmWorkReturnImport");
 if (confirmButton) confirmButton.onclick = function () {
  if (!pendingImport || pendingImport.result.fatal || !pendingImport.result.updates.length) return;
  var statement = state.workStatements.find(function (item) { return item.id === pendingImport.statementId; });
  if (!statement) { alert("Súpis už nie je otvorený. Načítaj Excel znova."); return; }
  pendingImport.result.updates.forEach(function (update) {
   var item = (statement.items || []).find(function (candidate) { return candidate.id === update.item.id; });
   if (item) item.currentQty = Math.abs(update.newValue) < 0.0000005 ? "" : String(update.newValue).replace(".", ",");
  });
  statement.updatedAt = new Date().toISOString();
  var count = pendingImport.result.updates.length;
  byId("workReturnImportModal").classList.add("hidden");
  pendingImport = null;
  save("Vyplnený Excel bol skontrolovaný a " + count + " položiek bolo doplnených do súpisu.");
 };

 window.__BETPRES_WORK_ROUNDTRIP_TEST__ = async function (showPreview) {
  var statement = getWorkStatement(true);
  if (!statement) throw new Error("Test nemá otvorený súpis.");
  var item = (statement.items || []).find(function (candidate) { return String(candidate.type || "").toUpperCase() !== "D" && !isWorkPriceOnlyItem(candidate); });
  if (!item) {
   item = createBlankWorkItem("ZoD");
   Object.assign(item, { pc: "1", type: "K", code: "TEST-001", description: "Test návratového Excelu", unit: "m2", contractQty: "100", unitPrice: "12,50", currentQty: "" });
   statement.items.push(item);
  }
  var blob = await buildExcelJsWorkStatementWorkbook(statement);
  var archive = await JSZip.loadAsync(blob);
  ["xl/worksheets/sheet1.xml", "xl/styles.xml", "xl/drawings/drawing1.xml", "xl/media/image1.png"].forEach(function (path) {
   if (!archive.file(path)) throw new Error("V Excel šablóne chýba súčasť: " + path);
  });
  var sheetXml = await archive.file("xl/worksheets/sheet1.xml").async("text");
  if (new DOMParser().parseFromString(sheetXml, "application/xml").querySelector("parsererror")) throw new Error("Excel šablóna obsahuje neplatnú XML štruktúru.");
  var rows = await parseXlsx(blob);
  var header = findHeader(rows);
  if (!header) throw new Error("V exporte chýbajú bezpečné identifikátory.");
  var dataRow = rows.find(function (row, index) { return index > header.rowIndex && String(row[header.idColumn] || "") === String(item.id); });
  if (!dataRow) throw new Error("Exportovaná položka sa nenašla.");
  var nextValue = workRound(parseWorkNumber(item.currentQty) + 2.5, 3);
  dataRow[8] = String(nextValue);
  var result = parseReturnedWorkbook(rows, statement);
  if (result.fatal || result.updates.length !== 1 || Math.abs(result.updates[0].newValue - nextValue) > 0.000001) throw new Error("Návratový import nepriradil množstvo k pôvodnej položke.");
  if (showPreview) showImportPreview(result, "Test-vyplneny-supis.xlsx", statement);
  return { ok: true, blobSize: blob.size, rows: rows.length, updates: result.updates.length, itemId: item.id, newValue: nextValue, logo: true, template: TEMPLATE_VERSION };
 };
 window.__BETPRES_BUILD_WORK_XLSX__ = buildExcelJsWorkStatementWorkbook;
})();
