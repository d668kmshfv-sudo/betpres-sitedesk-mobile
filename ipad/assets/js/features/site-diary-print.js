(function(){
 "use strict";
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`)):String(value||"");
 const safeImage=value=>{const url=String(value||"").trim();return /^(https?:\/\/|file:\/\/\/|blob:https?:\/\/)/i.test(url)||/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=]+$/i.test(url)?escape(url):""};
 const styles=`
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:#172a3b;font:11px/1.48 Arial,Helvetica,sans-serif}
  .sdp-page{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}
  .sdp-page:last-child{break-after:auto;page-break-after:auto}
  .sdp-letterhead{position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill}
  .sdp-content{position:relative;z-index:1;width:210mm;height:297mm;padding:37mm 16mm 59mm;overflow:hidden}
  .sdp-flow{display:flow-root;width:178mm;color:#172a3b;font:10px/1.38 Arial,Helvetica,sans-serif}
  .sdp-kicker{color:#31577b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .sdp-title{margin:2mm 0 5mm;color:#15345a;font-size:18px;line-height:1.18;overflow-wrap:anywhere}
  .sdp-meta{display:flex;flex-wrap:wrap;gap:2mm 8mm;padding:3mm 0;border-top:1px solid #bac8d4;border-bottom:1px solid #bac8d4;color:#52677b;font-size:10px}
  .sdp-meta strong{color:#1b3d61}
  .sdp-weather{margin-top:4mm;padding:3mm 4mm;border-radius:2mm;background:#edf3f8;color:#274663;font-size:10px}
  .sdp-weather strong{color:#153a61}
  .sdp-weather small{display:block;margin-top:1mm;color:#607387;font-size:9px}
  .sdp-day-heading{margin-top:4mm;padding:1.7mm 2.5mm;border-left:2mm solid #245d87;background:#edf3f8;color:#153a61;font-size:11px;font-weight:800}
  .sdp-day-heading .sdp-weather{margin:1.5mm 0 0;padding:0;background:transparent;font-weight:400}
  .sdp-section-title{display:flex;justify-content:space-between;align-items:center;gap:3mm;margin-top:4mm;padding:1.5mm 2.5mm;background:#617b8a;color:#fff;font-size:10px;font-weight:800;letter-spacing:.035em;break-inside:avoid}
  .sdp-section-title small{font-size:9px;font-weight:600;letter-spacing:0}
  .sdp-data-head,.sdp-data-row{display:grid;grid-template-columns:minmax(0,41fr) minmax(0,45fr) minmax(12mm,14fr);align-items:start;gap:2mm;padding:1.25mm 2.5mm;border-bottom:1px solid #d4dee6;break-inside:avoid}
  .sdp-data-head{background:#f3f6f8;color:#557084;font-size:8px;font-weight:800;letter-spacing:.035em;text-transform:uppercase}
  .sdp-data-row{color:#21394f;font-size:9.5px;line-height:1.3;overflow-wrap:anywhere}
  .sdp-data-head span:last-child,.sdp-data-row span:last-child{text-align:right;font-variant-numeric:tabular-nums}
  .sdp-data-empty{padding:1.8mm 2.5mm;border-bottom:1px solid #d4dee6;color:#708394;font-size:9px}
  .sdp-entry{display:flow-root;margin-top:1.6mm;padding-top:.8mm;border-top:1px solid #aebecb;break-inside:avoid}
  .sdp-entry-head{display:flex;justify-content:space-between;align-items:baseline;gap:6mm}
  .sdp-entry-head-day{justify-content:flex-end}
  .sdp-entry-head strong{flex:none;color:#1d587d;font-size:10px}
  .sdp-entry p{margin:.7mm 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;line-height:1.38}
  .sdp-inspection{padding:1.7mm 2.5mm;border-bottom:1px solid #d4dee6;break-inside:avoid}
  .sdp-inspection-meta{display:flex;justify-content:space-between;gap:4mm;color:#466176;font-size:9px}
  .sdp-inspection-meta strong{color:#213e57;font-size:9.5px}
  .sdp-inspection p{margin:.7mm 0 0;white-space:pre-wrap;overflow-wrap:anywhere;color:#263b4d;font-size:9.5px;line-height:1.34}
  .sdp-docs{display:flow-root;margin-top:3mm;color:#3b566d;font-size:10px;overflow-wrap:anywhere}
  .sdp-docs strong{color:#244666}.sdp-docs ul{margin:1mm 0 0;padding-left:5mm}.sdp-docs li{margin:.6mm 0}
  .sdp-signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:8mm;padding-top:8mm;break-inside:avoid}
  .sdp-signature{border-top:1px solid #557084;padding-top:2mm;color:#52677b;font-size:9px;font-weight:700}
  .sdp-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin-top:6mm}
  .sdp-photos img{display:block;width:100%;height:52mm;object-fit:contain;border:1px solid #d7e0e8;background:#fff}
  .sdp-attachment-page{display:flex;flex-direction:column;padding:9mm 10mm 8mm}
  .sdp-attachment-header{display:flex;justify-content:space-between;gap:6mm;min-height:13mm;padding-bottom:2mm;border-bottom:1px solid #bac8d4;color:#15345a;font-size:9px;line-height:1.3}
  .sdp-attachment-header strong{display:block;font-size:11px;overflow-wrap:anywhere}
  .sdp-attachment-header span:last-child{flex:none;text-align:right;color:#52677b}
  .sdp-attachment-image{display:block;width:190mm;height:0;min-height:0;flex:1 1 0;object-fit:contain}
  .sdp-attachment-footer{display:flex;justify-content:space-between;gap:5mm;border-top:1px solid #d4dee6;padding-top:2mm;color:#68798b;font-size:9px}
  .sdp-footer{position:absolute;left:16mm;right:16mm;bottom:58mm;display:flex;justify-content:space-between;color:#68798b;font-size:9px}
  @page{size:A4 portrait;margin:0}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 `;
 function normalizedWeather(weather){
  const source=weather&&typeof weather==="object"?weather:{};
  const temperature=value=>value===""||value===null||value===undefined||!Number.isFinite(Number(value))?"":String(Math.round(Number(value)));
  return{text:String(source.text||"").trim(),min:temperature(source.min),max:temperature(source.max),source:String(source.source||"").trim(),station:String(source.station||"").trim()}
 }
 function weatherHtml(weather){
  const value=normalizedWeather(weather);
  if(!value.text&&value.min===""&&value.max==="")return"";
  const range=value.min!==""&&value.max!==""?` · ${escape(value.min)} až ${escape(value.max)} °C`:value.min!==""?` · ${escape(value.min)} °C`:value.max!==""?` · ${escape(value.max)} °C`:"";
  return `<div class="sdp-weather"><strong>Počasie:</strong> ${escape(value.text||"—")}${range}${value.source||value.station?`<small>${escape([value.source,value.station].filter(Boolean).join(" · "))}</small>`:""}</div>`
 }
 function countValue(value){const number=Number(value);return Number.isFinite(number)?Math.max(0,Math.round(number)):0}
 function rowsForDate(map,date,kind){
  const source=map&&typeof map==="object"?map[date]:null;
  return (Array.isArray(source)?source:[]).filter(item=>item&&typeof item==="object").map(item=>({
   name:String((kind==="crew"?item.profession:item.name)||"—").trim()||"—",
   companyName:String(item.companyName||"—").trim()||"—",
   count:countValue(item.count)
  })).filter(item=>item.count>0)
 }
 function sectionTitle(label,continued=false,total=null){
  return `<div class="sdp-section-title"><span>${escape(label)}${continued?" · pokračovanie":""}</span>${total===null?"":`<small>Spolu ${escape(total)}</small>`}</div>`
 }
 function dataHeading(kind){return `<div class="sdp-data-head"><span>${kind==="crew"?"Profesia":"Prostriedok"}</span><span>Dodávateľ</span><span>Počet</span></div>`}
 function dataRow(row){return `<div class="sdp-data-row"><span>${escape(row.name)}</span><span>${escape(row.companyName)}</span><span>${escape(row.count)}</span></div>`}
 function dayHeading(date,weather){return `<div class="sdp-day-heading">${escape(dateLabel(date))}${weatherHtml(weather)}</div>`}
 function inspectionsForDate(map,date){
  const source=map&&typeof map==="object"?map[date]:null;
  return (Array.isArray(source)?source:[]).filter(item=>item&&typeof item==="object").map(item=>({
   recipient:String(item.recipient||"Adresát neuvedený").trim(),
   subject:String(item.subject||"Kontrola").trim(),
   note:String(item.note||"").trim(),
   dueDate:String(item.dueDate||"").trim(),
   status:String(item.status||"").trim()
  }))
 }
 function inspectionHtml(item,text,continuation){
  const due=/^\d{4}-\d{2}-\d{2}/.test(item.dueDate)?`${dateLabel(item.dueDate.slice(0,10))}${item.dueDate.includes("T")?` · ${item.dueDate.slice(11,16)}`:""}`:item.dueDate;
  const status=item.status==="done"?"Kontrola vykonaná":item.status==="open"?"Čaká na kontrolu":item.status;
  return `<div class="sdp-inspection"><div class="sdp-inspection-meta"><strong>${escape(item.recipient)}${continuation?" · pokračovanie":""}</strong><span>${escape([due,status].filter(Boolean).join(" · "))}</span></div><p>${escape(text||"").replace(/\r\n?/g,"\n")}</p></div>`
 }
 function recordHeader(entry,mode,continuation){
  const count=countValue(entry.workersCount);
  const label=continuation?`<span>Pokračovanie · ${escape(dateLabel(entry.date))}</span>`:"";
  const heading=count||continuation?`<div class="sdp-entry-head${mode==="day"?" sdp-entry-head-day":""}">${label}${count?`<strong>${count} pracovníkov</strong>`:""}</div>`:"";
  return heading
 }
 function entryHtml(entry,mode,text,continuation){
  return `<section class="sdp-entry">${recordHeader(entry,mode,continuation)}<p>${escape(text||"").replace(/\r\n?/g,"\n")}</p></section>`
 }
 function documentHtml(entry,docs,continuation){
  return `<div class="sdp-docs"><strong>Prílohy · ${escape(dateLabel(entry.date))}${continuation?" · pokračovanie":""}</strong><ul>${docs.map(item=>`<li>${escape(item.name||"Dokument")}</li>`).join("")}</ul></div>`
 }
 function signaturesHtml(){return '<div class="sdp-signatures"><div class="sdp-signature">Podpis objednávateľa</div><div class="sdp-signature">Podpis zhotoviteľa</div></div>'}
 const isPdfAttachment=item=>/\.pdf$/i.test(String(item?.name||""))||/\bpdf\b/i.test(String(item?.type||""));
 let pdfLibraryPromise;
 async function pdfLibrary(){
  if(!pdfLibraryPromise){
   const script=document.querySelector('script[src*="site-diary-print.js"]');
   if(!script?.src)throw new Error("Modul PDF príloh sa nepodarilo nájsť. Obnov aplikáciu.");
   const libraryUrl=new URL("../vendor/pdfjs/pdf.mjs",script.src);
   const workerUrl=new URL("../vendor/pdfjs/pdf.worker.mjs",script.src);
   pdfLibraryPromise=import(libraryUrl.href).then(library=>{
    library.GlobalWorkerOptions.workerSrc=workerUrl.href;
    return library
   }).catch(error=>{pdfLibraryPromise=null;throw new Error(`Modul PDF príloh sa nepodarilo načítať: ${error.message||error}`)})
  }
  return pdfLibraryPromise
 }
 async function attachmentBlob(item){
  if(item.blob instanceof Blob)return item.blob;
  const key=String(item.sourceKey||"");
  if(key&&typeof siteDeskGetAttachment==="function"){
   try{const local=await siteDeskGetAttachment(key);if(local)return local}
   catch(error){console.warn("BETPRES: lokálnu PDF prílohu sa nepodarilo načítať; skúšam cloud.",error)}
  }
  if(item.path&&typeof cloudConfigured==="function"&&cloudConfigured()){
   await cloudEnsureSession();
   if(!cloudSession?.access_token)throw new Error("Na načítanie PDF prílohy z cloudu sa prihlás.");
   const base=normalizeCloudUrl(cloudConfig.url),path=encodeStoragePath(item.path),headers={apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`};
   for(const prefix of ["authenticated/",""]){
    const response=await fetch(`${base}/storage/v1/object/${prefix}sitedesk-files/${path}`,{headers,cache:"no-store"});
    if(response.ok)return response.blob()
   }
  }
  throw new Error(`PDF príloha „${item.name||"Dokument"}“ nie je dostupná v tomto zariadení ani v cloude. Skontroluj synchronizáciu.`)
 }
 async function renderPdfAttachment(item,date){
  const library=await pdfLibrary(),blob=await attachmentBlob(item);
  if(!blob.size)throw new Error(`PDF príloha „${item.name||"Dokument"}“ je prázdna.`);
  const task=library.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  task.onPassword=(updatePassword)=>{
   const password=window.prompt(`Zadaj heslo pre PDF prílohu „${item.name||"Dokument"}“:`);
   if(password===null){void task.destroy();return}
   updatePassword(password)
  };
  let pdf;
  try{
   pdf=await task.promise;
   const rendered=[];
   for(let number=1;number<=pdf.numPages;number++){
    const source=await pdf.getPage(number),size=source.getViewport({scale:1});
    const scale=Math.min(2.1,1600/size.width,2200/size.height);
    const viewport=source.getViewport({scale}),canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw new Error("Prehliadač nepodporuje vykreslenie PDF prílohy.");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
    try{
     await source.render({canvasContext:context,viewport,background:"#fff"}).promise;
     rendered.push({date,name:String(item.name||"Dokument"),number,total:pdf.numPages,image:canvas.toDataURL("image/jpeg",.9)})
    }finally{canvas.width=0;canvas.height=0;source.cleanup()}
   }
   return rendered
  }catch(error){
   throw new Error(`PDF prílohu „${item.name||"Dokument"}“ sa nepodarilo pridať do exportu: ${error.message||error}`)
  }finally{if(pdf)await pdf.destroy();else await task.destroy()}
 }
 function attachmentPageHtml(item,index,total,projectName){
  return `<section class="sdp-page sdp-attachment-page"><div class="sdp-attachment-header"><div><span>BETPRES · stavebný denník · príloha</span><strong>${escape(item.name)}</strong></div><span>${escape(dateLabel(item.date))}<br>Strana prílohy ${item.number} / ${item.total}</span></div><img class="sdp-attachment-image" src="${safeImage(item.image)}" alt="Strana ${item.number} prílohy ${escape(item.name)}"><div class="sdp-attachment-footer"><span>${escape(projectName||"BETPRES")}</span><span>Strana ${index+1} / ${total}</span></div></section>`
 }
 function createMeasurer(){
  const host=document.createElement("div");host.style.cssText="position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-1";
  document.body.appendChild(host);
  const root=host.attachShadow({mode:"closed"}),style=document.createElement("style"),flow=document.createElement("div"),gauge=document.createElement("div");
  style.textContent=styles;flow.className="sdp-flow";gauge.style.height="195mm";
  root.append(style,flow,gauge);
  const limit=gauge.getBoundingClientRect().height;
  return{fits(markup){flow.innerHTML=markup;return flow.getBoundingClientRect().height<=limit-.5},close(){host.remove()}}
 }
 function makeHeader({mode,title,projectName,projectLocation,date,weather,continuation}){
  const place=projectLocation?`<span><strong>Lokalita:</strong> ${escape(projectLocation)}</span>`:"";
  const meta=mode==="day"||mode==="range"?`<span><strong>Stavba:</strong> ${escape(projectName)}</span>${place}<span><strong>Dátum:</strong> ${escape(dateLabel(date))}</span>`:
   `<span><strong>Stavba:</strong> ${escape(projectName)}</span>${place}<span>Prehľad prác podľa dní</span>`;
  return `<div class="sdp-kicker">Stavebný denník · BETPRES</div><h1 class="sdp-title">${escape(title)}${continuation?" · pokračovanie":""}</h1><div class="sdp-meta">${meta}</div>${(mode==="day"||mode==="range")&&!continuation?weatherHtml(weather):""}`
 }
 async function printDiary({mode="day",entries=[],weatherByDate={},crewByDate={},machineryByDate={},inspectionsByDate={},dayFilesByDate={},projectName="",projectLocation="",title="Stavebný denník",fileName="stavebny-dennik.pdf",letterheadImage=""}={}){
  if(!["day","range","company"].includes(mode))throw new Error("Neznámy typ exportu stavebného denníka.");
  const records=(Array.isArray(entries)?entries:[]).filter(item=>item&&item.date).slice().sort((a,b)=>mode==="company"||mode==="range"?String(a.date).localeCompare(String(b.date))||String(a.companyName||"").localeCompare(String(b.companyName||""),"sk"):String(a.companyName||"").localeCompare(String(b.companyName||""),"sk"));
  if(!records.length)return false;
  const displayTitle=mode==="company"?"Stavebný denník · prehľad prác":title;
  const firstDate=String(records[0].date),weatherMap=weatherByDate&&typeof weatherByDate==="object"?weatherByDate:{};
  const measure=createMeasurer(),pages=[],attachmentQueue=[];
  try{
   let currentPageDate=firstDate;
   const newPage=(continuation=false,photo=false)=>{
    const pageTitle=mode==="range"?`Stavebný denník · ${dateLabel(currentPageDate)}`:displayTitle;
    const page={date:currentPageDate,header:makeHeader({mode,title:photo?"Fotodokumentácia · "+pageTitle:pageTitle,projectName,projectLocation,date:currentPageDate,weather:weatherMap[currentPageDate],continuation}),blocks:[],photo};
    pages.push(page);return page
   };
   let page=newPage();
   const fits=block=>measure.fits(page.header+page.blocks.join("")+block);
   const addTable=(title,kind,rows,lead="")=>{
    const total=rows.reduce((sum,row)=>sum+row.count,0);
    let index=0,continued=false;
    do{
     const heading=`${continued?"":lead}${sectionTitle(title,continued,continued?null:total)}${rows.length?dataHeading(kind):""}`;
     const first=rows.length?dataRow(rows[index]):'<div class="sdp-data-empty">Bez záznamov</div>';
     if(!fits(heading+first))page=newPage(true);
     if(!fits(heading+first))throw new Error(`${title}: záznam sa nezmestí na stranu A4.`);
     page.blocks.push(heading,first);
     if(!rows.length)break;
     index++;
     while(index<rows.length&&fits(dataRow(rows[index]))){page.blocks.push(dataRow(rows[index]));index++}
     if(index<rows.length){page=newPage(true);continued=true}
    }while(index<rows.length)
   };
   const addEntry=entry=>{
    let remainder=entry.work||"—",continuation=false;
    for(;;){
     const first=entryHtml(entry,mode,remainder.slice(0,1),continuation);
     if(!fits(first)){
      page=newPage(true);
      const heading=sectionTitle("Vykonané práce",true);
      if(!fits(heading+first))throw new Error("Záznam práce sa nezmestí na stranu A4.");
      page.blocks.push(heading)
     }
     const full=entryHtml(entry,mode,remainder,continuation);
     if(fits(full)){page.blocks.push(full);break}
     let low=0,high=remainder.length;
     while(low<high){const mid=Math.ceil((low+high)/2);if(fits(entryHtml(entry,mode,remainder.slice(0,mid),continuation)))low=mid;else high=mid-1}
     if(low<1)throw new Error("Záznam práce sa nezmestí na stranu A4.");
     let cut=low;
     if(cut<remainder.length){const breakAt=remainder.lastIndexOf(" ",cut);if(breakAt>cut-80)cut=breakAt+1}
     page.blocks.push(entryHtml(entry,mode,remainder.slice(0,cut),continuation));
     remainder=remainder.slice(cut);
     if(!remainder)break;
     continuation=true;
     page=newPage(true);
     const heading=sectionTitle("Vykonané práce",true);
     if(!fits(heading+entryHtml(entry,mode,remainder.slice(0,1),continuation)))throw new Error("Záznam práce sa nezmestí na stranu A4.");
     page.blocks.push(heading)
    }
   };
   const addDocuments=entry=>{
    const docs=Array.isArray(entry.attachments)?entry.attachments:[];
    let start=0;
    while(start<docs.length){
     let count=docs.length-start,block=documentHtml(entry,docs.slice(start,start+count),start>0);
     if(fits(block)){page.blocks.push(block);break}
     if(page.blocks.length){page=newPage(true);continue}
     while(count>1&&!fits(block=documentHtml(entry,docs.slice(start,start+count),start>0)))count--;
     if(!fits(block))throw new Error("Príloha má príliš dlhý názov na stranu A4.");
     page.blocks.push(block);start+=count;
     if(start<docs.length)page=newPage(true)
    }
   };
   const addInspections=items=>{
    if(!items.length)return;
    const heading=sectionTitle("Kontroly a výzvy"),first=inspectionHtml(items[0],(items[0].subject||"Kontrola").slice(0,1),false);
    if(!fits(heading+first))page=newPage(true);
    if(!fits(heading+first))throw new Error("Kontroly a výzvy sa nezmestia na stranu A4.");
    page.blocks.push(heading);
    for(const item of items){
     let remainder=[item.subject,item.note].filter(Boolean).join("\n")||"Kontrola",continued=false;
     for(;;){
      const firstPart=inspectionHtml(item,remainder.slice(0,1),continued);
      if(!fits(firstPart)){
       page=newPage(true);
       const continuationHeading=sectionTitle("Kontroly a výzvy",true);
       if(!fits(continuationHeading+firstPart))throw new Error("Záznam kontroly sa nezmestí na stranu A4.");
       page.blocks.push(continuationHeading)
      }
      const full=inspectionHtml(item,remainder,continued);
      if(fits(full)){page.blocks.push(full);break}
      let low=0,high=remainder.length;
      while(low<high){const mid=Math.ceil((low+high)/2);if(fits(inspectionHtml(item,remainder.slice(0,mid),continued)))low=mid;else high=mid-1}
      if(low<1)throw new Error("Záznam kontroly sa nezmestí na stranu A4.");
      let cut=low;
      if(cut<remainder.length){const breakAt=Math.max(remainder.lastIndexOf(" ",cut),remainder.lastIndexOf("\n",cut));if(breakAt>cut-80)cut=breakAt+1}
      page.blocks.push(inspectionHtml(item,remainder.slice(0,cut),continued));
      remainder=remainder.slice(cut);if(!remainder)break;
      continued=true;page=newPage(true);
      const continuationHeading=sectionTitle("Kontroly a výzvy",true);
      if(!fits(continuationHeading+inspectionHtml(item,remainder.slice(0,1),continued)))throw new Error("Záznam kontroly sa nezmestí na stranu A4.");
      page.blocks.push(continuationHeading)
     }
    }
   };
   const groups=new Map();
   for(const item of records){
    const date=mode==="day"?firstDate:String(item.date);
    if(!groups.has(date))groups.set(date,[]);
    groups.get(date).push({...item,date:String(item.date),companyName:String(item.companyName||"Firma"),work:String(item.work||"")})
   }
   for(const [date,dayEntries] of groups){
    if(mode==="range"&&date!==firstDate){currentPageDate=date;page=newPage()}
    const crew=rowsForDate(crewByDate,date,"crew"),machinery=rowsForDate(machineryByDate,date,"machinery");
    let lead=mode==="company"?dayHeading(date,weatherMap[date]):"";
    if(mode==="day"||mode==="range"||crew.length){addTable("Osoby na stavenisku","crew",crew,lead);lead=""}
    if(mode==="day"||mode==="range"||machinery.length){addTable("Mechanizmy","machinery",machinery,lead);lead=""}
    const workHeading=lead+sectionTitle("Vykonané práce");
    const firstEntry=dayEntries[0],firstWork=entryHtml(firstEntry,mode,(firstEntry.work||"—").slice(0,1),false);
    if(!fits(workHeading+firstWork))page=newPage(true);
    if(!fits(workHeading+firstWork))throw new Error("Záznam práce sa nezmestí na stranu A4.");
    page.blocks.push(workHeading);
    for(const entry of dayEntries)addEntry(entry);
    if(mode==="day"||mode==="range")addInspections(inspectionsForDate(inspectionsByDate,date));
    const documents=[...dayEntries.flatMap(entry=>Array.isArray(entry.attachments)?entry.attachments:[]),...((mode==="day"||mode==="range")&&Array.isArray(dayFilesByDate[date]?.attachments)?dayFilesByDate[date].attachments:[])];
    if(documents.length){
     addDocuments({date,attachments:documents});
     for(const item of documents)if(isPdfAttachment(item))attachmentQueue.push({...item,date})
    }
    if(!fits(signaturesHtml()))page=newPage(true);
    if(!fits(signaturesHtml()))throw new Error("Podpisy sa nezmestia na stranu A4.");
    page.blocks.push(signaturesHtml());
   }
   const photoDates=new Set();
   for(const entry of records){
    currentPageDate=entry.date;
    const firstPhotoForDate=!photoDates.has(entry.date);photoDates.add(entry.date);
    const dayPhotos=(mode==="day"||mode==="range")&&firstPhotoForDate&&Array.isArray(dayFilesByDate[entry.date]?.photos)?dayFilesByDate[entry.date].photos:[];
    const urls=[...(Array.isArray(entry.photos)?entry.photos:[]),...dayPhotos].map(safeImage).filter(Boolean);
    for(let start=0;start<urls.length;start+=4){
     const page=newPage(true,true),pictures=urls.slice(start,start+4).map(url=>`<img src="${url}" alt="Fotografia zo stavby">`).join("");
     page.blocks.push(`<div class="sdp-meta"><span><strong>Dátum:</strong> ${escape(dateLabel(entry.date))}</span></div><div class="sdp-photos">${pictures}</div>`)
    }
   }
  }finally{measure.close()}
  const attachmentPages=[];
  for(const item of attachmentQueue)attachmentPages.push(...await renderPdfAttachment(item,item.date));
  const documentTheme=window.betpresDocumentTheme?.()||{};
  const accent=/^#[0-9a-f]{6}$/i.test(String(documentTheme.accentColor||""))?documentTheme.accentColor:"#15345a";
  const themedStyles=styles.replaceAll("#15345a",accent).replaceAll("#153a61",accent).replaceAll("#245d87",accent).replaceAll("#617b8a",accent).replaceAll("#1d587d",accent);
  const letterhead=safeImage(documentTheme.letterheadImage||letterheadImage);
  const ordered=[];
  if(mode==="range"){
   for(const date of [...new Set(records.map(item=>String(item.date)))]){
    for(const page of pages)if(page.date===date)ordered.push({kind:"diary",page});
    for(const item of attachmentPages)if(item.date===date)ordered.push({kind:"attachment",item})
   }
  }else{
   for(const page of pages)ordered.push({kind:"diary",page});
   for(const item of attachmentPages)ordered.push({kind:"attachment",item})
  }
  const total=ordered.length;
  const htmlPages=ordered.map((entry,index)=>entry.kind==="attachment"
   ?attachmentPageHtml(entry.item,index,total,projectName)
   :`<section class="sdp-page">${letterhead?`<img class="sdp-letterhead" src="${letterhead}" alt="">`:""}<div class="sdp-content"><div class="sdp-flow">${entry.page.header}${entry.page.blocks.join("")}</div><div class="sdp-footer"><span>${escape(projectName||"BETPRES")}</span><span>Strana ${index+1} / ${total}</span></div></div></section>`).join("");
  const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${escape(displayTitle)}</title><style>${themedStyles}</style></head><body>${htmlPages}</body></html>`;
  const payload={html,fileName,landscape:false,title:displayTitle};
  if(typeof window.showPdfPreview==="function")void window.showPdfPreview(payload);
  else if(window.betpresDesktop?.exportPdf)void window.betpresDesktop.exportPdf(payload);
  return payload
 }
 window.siteDiaryPrint=printDiary;
})();
