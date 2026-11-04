(function(){
 "use strict";
 const button=document.getElementById("exportBillingPdf");
 if(!button)return;
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const currency=value=>`${new Intl.NumberFormat("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0)} €`;
 const monthLabel=value=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return value;
  return new Intl.DateTimeFormat("sk-SK",{month:"long",year:"numeric"}).format(new Date(`${value}-15T12:00:00`))
 };
 function buildReport(project,period,months,records){
  const monthRows=months.map(month=>{
   const selected=records.filter(record=>record.month===month);
   return{month,records:selected,total:selected.reduce((sum,record)=>sum+Number(record.amount||0),0)}
  });
  const allTotal=records.reduce((sum,record)=>sum+Number(record.amount||0),0),
        companyTotals=new Map();
  records.forEach(record=>{
   const name=company(record.companyId)?.name||"Neznáma firma";
   companyTotals.set(name,(companyTotals.get(name)||0)+Number(record.amount||0))
  });
  const summaryRows=monthRows.map(row=>`<tr><td>${escape(monthLabel(row.month))}</td><td class="num">${row.records.length}</td><td class="num">${currency(row.total)}</td></tr>`).join(""),
        companyRows=[...companyTotals].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"sk")).map(([name,total])=>`<tr><td>${escape(name)}</td><td class="num">${currency(total)}</td></tr>`).join(""),
        details=monthRows.filter(row=>row.records.length).map(row=>`<section class="month-detail"><h2>${escape(monthLabel(row.month))}<span>${currency(row.total)}</span></h2><table><thead><tr><th>Firma</th><th>Čo sa fakturovalo</th><th class="num">Suma bez DPH</th></tr></thead><tbody>${row.records.slice().sort((a,b)=>(company(a.companyId)?.name||"").localeCompare(company(b.companyId)?.name||"","sk")).map(record=>`<tr><td>${escape(company(record.companyId)?.name||"Neznáma firma")}</td><td>${escape(billingRecordDescription(record)||record.amendmentNo||"—")}</td><td class="num">${currency(record.amount)}</td></tr>`).join("")}</tbody></table></section>`).join("");
  const logo=new URL("assets/images/navigation-logo.png",document.baseURI).href;
  return `<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Fakturácia ${escape(project.name||"")}</title><style>
   @page{size:A4 portrait;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172b3d;font-size:10px;margin:0;background:#fff}header{display:flex;align-items:center;gap:13px;border-bottom:2px solid #0a5b91;padding-bottom:10px;margin-bottom:14px}header img{max-width:92px;max-height:42px;object-fit:contain}h1{font-size:19px;line-height:1.2;margin:0;color:#143a59}header p{margin:4px 0 0;color:#516575;font-size:10px}.meta{display:flex;justify-content:space-between;gap:12px;margin-bottom:17px}.meta>div{flex:1;border-bottom:1px solid #cbd7df;padding-bottom:6px}.meta small{display:block;color:#536677;text-transform:uppercase;font-size:8px;letter-spacing:.06em;margin-bottom:4px}.meta strong{font-size:11px}h2{font-size:13px;color:#143a59;margin:17px 0 7px}h2 span{float:right}table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#eaf1f6;color:#173a54;text-align:left;font-size:9px;padding:7px 6px;border-bottom:1px solid #b7cbd9}td{padding:6px;border-bottom:1px solid #dce5eb;vertical-align:top;overflow-wrap:anywhere}.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}.overview th:first-child{width:52%}.overview th:nth-child(2){width:17%}.overview th:last-child{width:31%}.overview tfoot td{font-weight:bold;background:#dbeaf4;border-top:1px solid #8fb7d1}.company-summary th:first-child{width:69%}.company-summary th:last-child{width:31%}.month-detail{break-inside:auto}.month-detail h2{break-after:avoid;border-top:1px solid #a9c1d1;padding-top:9px}.month-detail th:first-child{width:27%}.month-detail th:nth-child(2){width:46%}.month-detail th:last-child{width:27%}tr{break-inside:avoid}thead{display:table-header-group}footer{border-top:1px solid #cedce5;margin-top:16px;padding-top:7px;color:#647584;font-size:8px}
  </style></head><body><header><img src="${escape(logo)}" alt="BETPRES"><div><h1>Fakturácia stavby</h1><p>Prehľad za zvolené obdobie · sumy bez DPH</p></div></header><div class="meta"><div><small>Stavba</small><strong>${escape(project.name||"—")}</strong></div><div><small>Obdobie</small><strong>${escape(monthLabel(period.startMonth))} – ${escape(monthLabel(period.endMonth))}</strong></div></div><h2>Prehľad po mesiacoch</h2><table class="overview"><thead><tr><th>Mesiac</th><th class="num">Počet záznamov</th><th class="num">Fakturácia bez DPH</th></tr></thead><tbody>${summaryRows}</tbody><tfoot><tr><td>Spolu za obdobie</td><td class="num">${records.length}</td><td class="num">${currency(allTotal)}</td></tr></tfoot></table>${companyRows?`<h2>Spolu podľa firiem</h2><table class="company-summary"><thead><tr><th>Firma</th><th class="num">Fakturácia bez DPH</th></tr></thead><tbody>${companyRows}</tbody></table>`:""}${details?`<h2>Podrobný prehľad</h2>${details}`:""}<footer>BETPRES · fakturačný prehľad vygenerovaný ${escape(new Intl.DateTimeFormat("sk-SK",{dateStyle:"medium",timeStyle:"short"}).format(new Date()))}</footer></body></html>`
 }
 button.addEventListener("click",()=>{
  const project=activeProject(),startMonth=document.getElementById("billingPeriodStart")?.value,
        endMonth=document.getElementById("billingPeriodEnd")?.value,
        period={startMonth,endMonth};
  if(!project)return;
  if(!billingValidMonth(startMonth)||!billingValidMonth(endMonth)||endMonth<startMonth){
   alert("Vyber platný počiatočný a koncový mesiac fakturácie.");return
  }
  const months=billingMonthRange(period.startMonth,period.endMonth),records=state.billings.filter(record=>record.projectId===project.id&&record.month>=period.startMonth&&record.month<=period.endMonth),
        html=buildReport(project,period,months,records),fileName=`fakturacia-${project.id}-${period.startMonth}-${period.endMonth}.pdf`;
  if(!months.length||months.length>=240){alert("Vyber kratšie fakturačné obdobie.");return}
  if(typeof window.showPdfPreview==="function")void window.showPdfPreview({html,fileName,title:`Fakturácia · ${project.name}`,landscape:false});
  else alert("Náhľad PDF sa nenačítal. Obnov stránku a skús export znova.")
 })
})();
