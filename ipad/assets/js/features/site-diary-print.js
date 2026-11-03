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
  .sdp-content{position:relative;z-index:1;width:210mm;height:297mm;padding:37mm 16mm 31mm;overflow:hidden}
  .sdp-flow{display:flow-root;width:178mm;color:#172a3b;font:10px/1.38 Arial,Helvetica,sans-serif}
  .sdp-kicker{color:#31577b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
  .sdp-title{margin:2mm 0 5mm;color:#15345a;font-size:18px;line-height:1.18;overflow-wrap:anywhere}
  .sdp-meta{display:flex;flex-wrap:wrap;gap:2mm 8mm;padding:3mm 0;border-top:1px solid #bac8d4;border-bottom:1px solid #bac8d4;color:#52677b;font-size:10px}
  .sdp-meta strong{color:#1b3d61}
  .sdp-weather{margin-top:4mm;padding:3mm 4mm;border-radius:2mm;background:#edf3f8;color:#274663;font-size:10px}
  .sdp-weather strong{color:#153a61}
  .sdp-weather small{display:block;margin-top:1mm;color:#607387;font-size:9px}
  .sdp-entry{display:flow-root;margin-top:3mm;padding-top:1.5mm;border-top:1px solid #aebecb;break-inside:avoid}
  .sdp-entry-head{display:flex;justify-content:space-between;align-items:baseline;gap:6mm}
  .sdp-entry h2{margin:0;color:#18385e;font-size:11px;line-height:1.3;overflow-wrap:anywhere}
  .sdp-entry-head strong{flex:none;color:#1d587d;font-size:10px}
  .sdp-entry-date{color:#0b598a;font-size:11px;font-weight:800}
  .sdp-entry-place{margin-top:1mm;color:#536a7d;font-size:9px;overflow-wrap:anywhere}
  .sdp-entry p{margin:1.5mm 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;line-height:1.38}
  .sdp-docs{display:flow-root;margin-top:3mm;color:#3b566d;font-size:10px;overflow-wrap:anywhere}
  .sdp-docs strong{color:#244666}.sdp-docs ul{margin:1mm 0 0;padding-left:5mm}.sdp-docs li{margin:.6mm 0}
  .sdp-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4mm;margin-top:6mm}
  .sdp-photos img{display:block;width:100%;height:52mm;object-fit:contain;border:1px solid #d7e0e8;background:#fff}
  .sdp-footer{position:absolute;left:16mm;right:16mm;bottom:17mm;display:flex;justify-content:space-between;color:#68798b;font-size:9px}
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
 function recordHeader(entry,mode,continuation,weather){
  const name=String(entry.companyName||"Firma");
  const count=Math.max(0,Number(entry.workersCount)||0);
  const heading=mode==="day"?`<div class="sdp-entry-head"><h2>${escape(name)}${continuation?" · pokračovanie":""}</h2><strong>${count} pracovníkov</strong></div>`:
   `<div class="sdp-entry-head"><h2 class="sdp-entry-date">${escape(dateLabel(entry.date))}${continuation?" · pokračovanie":""}</h2><strong>${count} pracovníkov</strong></div>`;
  return `${heading}${!continuation&&mode==="company"?weatherHtml(weather):""}${!continuation&&entry.place?`<div class="sdp-entry-place"><strong>Miesto / objekt:</strong> ${escape(entry.place)}</div>`:""}`
 }
 function entryHtml(entry,mode,text,continuation,weather){
  return `<section class="sdp-entry">${recordHeader(entry,mode,continuation,weather)}<p>${escape(text||"").replace(/\r\n?/g,"\n")}</p></section>`
 }
 function documentHtml(entry,docs,continuation){
  const label=`${dateLabel(entry.date)} · ${entry.companyName||"Firma"}`;
  return `<div class="sdp-docs"><strong>PDF prílohy · ${escape(label)}${continuation?" · pokračovanie":""}</strong><ul>${docs.map(item=>`<li>${escape(item.name||"PDF dokument")}</li>`).join("")}</ul></div>`
 }
 function createMeasurer(){
  const host=document.createElement("div");host.style.cssText="position:fixed;left:-20000px;top:0;width:210mm;visibility:hidden;pointer-events:none;z-index:-1";
  document.body.appendChild(host);
  const root=host.attachShadow({mode:"closed"}),style=document.createElement("style"),flow=document.createElement("div"),gauge=document.createElement("div");
  style.textContent=styles;flow.className="sdp-flow";gauge.style.height="225mm";
  root.append(style,flow,gauge);
  const limit=gauge.getBoundingClientRect().height;
  return{fits(markup){flow.innerHTML=markup;return flow.getBoundingClientRect().height<=limit-.5},close(){host.remove()}}
 }
 function makeHeader({mode,title,projectName,date,weather,continuation,companyName}){
  const meta=mode==="day"?`<span><strong>Stavba:</strong> ${escape(projectName)}</span><span><strong>Dátum:</strong> ${escape(dateLabel(date))}</span>`:
   `<span><strong>Stavba:</strong> ${escape(projectName)}</span><span><strong>Firma:</strong> ${escape(companyName)}</span>`;
  return `<div class="sdp-kicker">Stavebný denník · BETPRES</div><h1 class="sdp-title">${escape(title)}${continuation?" · pokračovanie":""}</h1><div class="sdp-meta">${meta}</div>${mode==="day"&&!continuation?weatherHtml(weather):""}`
 }
 async function printDiary({mode="day",entries=[],weatherByDate={},projectName="",title="Stavebný denník",fileName="stavebny-dennik.pdf",letterheadImage=""}={}){
  if(!["day","company"].includes(mode))throw new Error("Neznámy typ exportu stavebného denníka.");
  const records=(Array.isArray(entries)?entries:[]).filter(item=>item&&item.date).slice().sort((a,b)=>mode==="company"?String(a.date).localeCompare(String(b.date))||String(a.companyName||"").localeCompare(String(b.companyName||""),"sk"):String(a.companyName||"").localeCompare(String(b.companyName||""),"sk"));
  if(!records.length)return false;
  const firstDate=String(records[0].date),weatherMap=weatherByDate&&typeof weatherByDate==="object"?weatherByDate:{};
  const measure=createMeasurer(),pages=[];
  try{
   const newPage=(continuation=false,photo=false)=>{
    const page={header:makeHeader({mode,title:photo?"Fotodokumentácia · "+title:title,projectName,date:firstDate,weather:weatherMap[firstDate],continuation,companyName:records[0].companyName||""}),blocks:[],photo};
    pages.push(page);return page
   };
   let page=newPage();
   const fits=block=>measure.fits(page.header+page.blocks.join("")+block);
   for(const item of records){
    const entry={...item,date:String(item.date),companyName:String(item.companyName||"Firma"),work:String(item.work||"")};
    let remainder=entry.work,continuation=false,done=false;
    while(!done){
     const full=entryHtml(entry,mode,remainder,continuation,weatherMap[entry.date]);
     if(fits(full)){page.blocks.push(full);done=true;break}
     if(page.blocks.length){page=newPage(true);continue}
     let low=0,high=remainder.length;
     while(low<high){const mid=Math.ceil((low+high)/2);if(fits(entryHtml(entry,mode,remainder.slice(0,mid),continuation,weatherMap[entry.date])))low=mid;else high=mid-1}
     if(low<1)throw new Error("Záznam sa nezmestí na stranu A4.");
     let cut=low;
     if(cut<remainder.length){const breakAt=remainder.lastIndexOf(" ",cut);if(breakAt>cut-80)cut=breakAt+1}
     page.blocks.push(entryHtml(entry,mode,remainder.slice(0,cut),continuation,weatherMap[entry.date]));
     remainder=remainder.slice(cut);continuation=true;
     if(!remainder){done=true;break}
     page=newPage(true)
    }
    const docs=Array.isArray(entry.attachments)?entry.attachments:[];
    if(docs.length){
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
    }
   }
   for(const entry of records){
    const urls=(Array.isArray(entry.photos)?entry.photos:[]).map(safeImage).filter(Boolean);
    for(let start=0;start<urls.length;start+=4){
     const page=newPage(true,true),pictures=urls.slice(start,start+4).map(url=>`<img src="${url}" alt="Fotografia zo stavby">`).join("");
     page.blocks.push(`<div class="sdp-meta"><span><strong>Dátum:</strong> ${escape(dateLabel(entry.date))}</span><span><strong>Firma:</strong> ${escape(entry.companyName||"Firma")}</span></div><div class="sdp-photos">${pictures}</div>`)
    }
   }
  }finally{measure.close()}
  const total=pages.length,letterhead=safeImage(letterheadImage);
  const pageHtml=pages.map((page,index)=>`<section class="sdp-page">${letterhead?`<img class="sdp-letterhead" src="${letterhead}" alt="">`:""}<div class="sdp-content"><div class="sdp-flow">${page.header}${page.blocks.join("")}</div><div class="sdp-footer"><span>${escape(projectName||"BETPRES")}</span><span>Strana ${index+1} / ${total}</span></div></div></section>`).join("");
  const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${styles}</style></head><body>${pageHtml}</body></html>`;
  const payload={html,fileName,landscape:false,title};
  if(typeof window.showPdfPreview==="function")void window.showPdfPreview(payload);
  else if(window.betpresDesktop?.exportPdf)void window.betpresDesktop.exportPdf(payload);
  return payload
 }
 window.siteDiaryPrint=printDiary;
})();
