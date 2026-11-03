(function(){
 "use strict";
 const get=id=>document.getElementById(id),escape=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const editor=get("siteDiaryModal"),form=get("siteDiaryForm");if(!editor||!form)return;
 let day=todayISO(),photos=[],documents=[],newFiles=[],weatherMeta=null,busy=false;
 const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`)):value;
 const rows=()=>Array.isArray(state.mobileDiary)?state.mobileDiary.filter(item=>item.kind==="siteLog"&&item.projectId===state.selectedProjectId):[];
 const companyName=item=>state.companies.find(company=>company.id===item.companyId)?.name||item.companyName||"Firma";
 const siteProject=()=>state.projects.find(project=>project.id===state.selectedProjectId)||null;
 const makeId=prefix=>typeof uid==="function"?uid(prefix):`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const alertUser=message=>typeof toast==="function"?toast(message):alert(message);
 function choices(){
  const map=new Map();
  state.companies.forEach(item=>{if(item.name)map.set(item.id,{id:item.id,name:item.name})});
  const months=new Set([day.slice(0,7),get("siteDiaryEntryDate")?.value.slice(0,7)].filter(Boolean));
  (state.workerSheets||[]).filter(sheet=>sheet.projectId===state.selectedProjectId&&months.has(sheet.month)).forEach(sheet=>(sheet.rows||[]).forEach(row=>{
   if(typeof isBetpresWorkerRow==="function"&&isBetpresWorkerRow(row))return;
   const name=row.alias||row.name||state.companies.find(company=>company.id===row.companyId)?.name||"";
   if(!name)return;
   const id=row.companyId||`custom:${norm(name)}`;if(!map.has(id))map.set(id,{id,name})
  }));
  rows().forEach(item=>{if(item.companyId&&!map.has(item.companyId))map.set(item.companyId,{id:item.companyId,name:item.companyName||"Firma"})});
  return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"))
 }
 function workersAt(date,companyId,name){
  const sheet=(state.workerSheets||[]).find(item=>item.projectId===state.selectedProjectId&&item.month===date.slice(0,7));
  if(!sheet)return 0;
  const dayNo=Number(date.slice(8));
  return(sheet.rows||[]).filter(row=>companyId&&row.companyId===companyId||!row.companyId&&norm(row.alias||row.name)===norm(name)).reduce((sum,row)=>sum+(Number(row.values?.[dayNo])||0),0)
 }
 function fillCompanyOptions(select,value=""){
  const options=choices();select.innerHTML='<option value="">Vyber firmu</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
  if(value&&!options.some(item=>item.id===value))select.insertAdjacentHTML("beforeend",`<option value="${escape(value)}">${escape(value)}</option>`);
  select.value=value
 }
 function selectedCompanyName(){const select=get("siteDiaryEntryCompany");return select.selectedOptions[0]?.textContent||""}
 function recordFor(date,companyId){return rows().find(item=>item.date===date&&item.companyId===companyId)}
 function weatherFromSameDay(date){return rows().find(item=>item.date===date&&item.weather)?.weather||null}
 function setWeather(weather){
  get("siteDiaryWeatherText").value=weather?.text||"";get("siteDiaryTempMin").value=weather?.min??"";get("siteDiaryTempMax").value=weather?.max??"";
  get("siteDiaryWeatherCity").value=weather?.city||siteProject()?.city||"";
  weatherMeta=weather?{source:weather.source||"Ručný údaj",station:weather.station||"",retrievedAt:weather.retrievedAt||""}:null;
  get("siteDiaryWeatherSource").textContent=weatherMeta?.source?`${weatherMeta.source}${weatherMeta.station?` · ${weatherMeta.station}`:""}`:"Počasie môžeš doplniť ručne. Automatické údaje sú predpoveď modelu ALADIN SHMÚ."
 }
 function renderAttachments(){
  const items=[...photos.map((item,index)=>`<div class="site-diary-attachment"><span>📷 ${escape(item.name||`Fotografia ${index+1}`)}</span><button type="button" data-site-diary-remove-photo="${index}" aria-label="Odstrániť fotografiu">×</button></div>`),...documents.map(item=>`<div class="site-diary-attachment"><span>PDF · ${escape(item.name)}</span><button type="button" data-site-diary-open-document="${escape(item.id)}">Otvoriť</button><button type="button" data-site-diary-remove-document="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`),...newFiles.map(item=>`<div class="site-diary-attachment"><span>Nové PDF · ${escape(item.file.name)}</span><button type="button" data-site-diary-remove-new="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`)];
  get("siteDiaryAttachments").innerHTML=items.join("")||'<small>Bez príloh.</small>'
 }
 function openEditor(id="",chosenCompany=""){
  const item=id?rows().find(record=>record.id===id):null,date=item?.date||day;
  get("siteDiaryId").value=item?.id||"";get("siteDiaryEntryDate").value=date;fillCompanyOptions(get("siteDiaryEntryCompany"),item?.companyId||chosenCompany);
  get("siteDiaryWorkers").value=item?.workersCount??(chosenCompany?workersAt(date,chosenCompany,selectedCompanyName()):0);
  get("siteDiaryPlace").value=item?.place||"";get("siteDiaryWork").value=item?.work||"";
  photos=Array.isArray(item?.photos)?item.photos.map(photo=>({...photo})):[];
  documents=Array.isArray(item?.attachments)?item.attachments.map(document=>({...document})):[];newFiles=[];
  get("siteDiaryPhotos").value="";get("siteDiaryDocuments").value="";setWeather(item?.weather||weatherFromSameDay(date));renderAttachments();
  get("siteDiaryModalTitle").textContent=item?"Upraviť denný záznam":"Práce firmy za deň";editor.classList.remove("hidden")
 }
 async function compressPhoto(file){
  if(!file.type.startsWith("image/"))throw new Error("Vyber fotografiu.");
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Fotografiu sa nepodarilo načítať."));image.src=url});
   const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const dataUrl=canvas.toDataURL("image/jpeg",.72);return{id:makeId("site-photo"),name:file.name,type:"image/jpeg",size:Math.round(dataUrl.length*.75),dataUrl}
  }finally{URL.revokeObjectURL(url)}
 }
 async function saveEntry(event){
  event.preventDefault();if(busy)return;
  const date=get("siteDiaryEntryDate").value,companyId=get("siteDiaryEntryCompany").value,companyLabel=selectedCompanyName(),work=get("siteDiaryWork").value.trim();
  if(!date||!companyId||!work){form.reportValidity();return}
  const oldId=get("siteDiaryId").value,existing=oldId?rows().find(item=>item.id===oldId):null,duplicate=recordFor(date,companyId);
  if(duplicate&&duplicate.id!==oldId){alertUser("Táto firma už má v daný deň zápis. Otvor ho cez Upraviť záznam.");return}
  const id=existing?.id||makeId("site-day"),stored=[];busy=true;form.querySelector('[type="submit"]').disabled=true;
  try{
   for(const pending of newFiles){await siteDeskPutAttachment(`${id}:${pending.id}`,pending.file);stored.push({id:pending.id,name:pending.file.name,type:"application/pdf",size:pending.file.size,path:""})}
   const now=new Date().toISOString(),record={...existing,id,kind:"siteLog",projectId:state.selectedProjectId,date,companyId,companyName:companyLabel,workersCount:Math.max(0,Math.min(999,Number(get("siteDiaryWorkers").value)||0)),place:get("siteDiaryPlace").value.trim(),work,
    weather:{text:get("siteDiaryWeatherText").value.trim(),min:get("siteDiaryTempMin").value,max:get("siteDiaryTempMax").value,city:get("siteDiaryWeatherCity").value.trim(),source:weatherMeta?.source||"Ručný údaj",station:weatherMeta?.station||"",retrievedAt:weatherMeta?.retrievedAt||""},
    photos:photos.slice(),attachments:[...documents,...stored],author:existing?.author||cloudConfig?.displayName||"BETPRES",createdAt:existing?.createdAt||now,updatedAt:now};
   if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
   if(existing)state.mobileDiary[state.mobileDiary.indexOf(existing)]=record;else state.mobileDiary.push(record);
   day=date;get("siteDiaryDate").value=date;editor.classList.add("hidden");save(existing?"Denný záznam bol upravený.":"Denný záznam firmy bol uložený.");render()
  }catch(error){alert(`Záznam sa nepodarilo uložiť: ${error.message||error}`)}finally{busy=false;form.querySelector('[type="submit"]').disabled=false}
 }
 function render(){
  const filter=get("siteDiaryCompanyFilter"),previous=filter.value;
  const options=[...new Map(rows().map(item=>[item.companyId,{id:item.companyId,name:companyName(item)}])).values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  filter.innerHTML='<option value="">Všetky firmy</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");filter.value=options.some(item=>item.id===previous)?previous:"";
  const entries=rows().filter(item=>item.date===day&&(!filter.value||item.companyId===filter.value)).sort((a,b)=>companyName(a).localeCompare(companyName(b),"sk"));
  get("siteDiaryDate").value=day;get("siteDiaryDaySummary").textContent=`${dateLabel(day)} · ${entries.length} ${entries.length===1?"firma":entries.length<5?"firmy":"firiem"} · ${entries.reduce((sum,item)=>sum+(Number(item.workersCount)||0),0)} pracovníkov`;
  get("siteDiaryExportCompany").disabled=!filter.value;
  get("siteDiaryDayList").innerHTML=entries.map(item=>`<article class="site-diary-card"><div class="site-diary-card-head"><span>${escape(companyName(item))}</span><strong>${Number(item.workersCount)||0} pracovníkov</strong></div><div class="site-diary-card-meta">${item.place?`<span>⌖ ${escape(item.place)}</span>`:""}${item.weather?.text?`<span>☁ ${escape(item.weather.text)}</span>`:""}</div><p>${escape(item.work)}</p><div class="site-diary-card-foot"><small>${(item.photos||[]).length} foto · ${(item.attachments||[]).length} PDF</small><div><button type="button" class="ghost" data-site-diary-export-one="${escape(item.id)}">Export PDF</button><button type="button" data-site-diary-edit="${escape(item.id)}">Upraviť záznam</button></div></div></article>`).join("")||'<div class="site-diary-empty"><strong>Zatiaľ tu nie je denný zápis</strong><span>Vyber firmu a zapíš, čo dnes robila. Údaje o pracovníkoch sa doplnia zo stavu pracovníkov.</span></div>'
 }
 async function copyDay(){
  const source=get("siteDiaryCopySource").value,target=day;
  if(!source){get("siteDiaryCopySource").showPicker?.();return}
  if(source===target){alertUser("Vyber iný zdrojový deň.");return}
  const sourceEntries=rows().filter(item=>item.date===source);
  if(!sourceEntries.length){alertUser("V zdrojovom dni nie sú záznamy firiem.");return}
  let copied=0,skipped=0;
  for(const item of sourceEntries){
   if(recordFor(target,item.companyId)){skipped++;continue}
   const id=makeId("site-day"),attachments=[];
   for(const attachment of item.attachments||[]){
    const copy={...attachment,id:makeId("site-pdf")};
    const blob=await siteDeskGetAttachment(`${item.id}:${attachment.id}`);
    if(blob)await siteDeskPutAttachment(`${id}:${copy.id}`,blob);
    if(blob||copy.path)attachments.push(copy)
   }
   state.mobileDiary.push({...item,id,date:target,workersCount:item.workersCount,photos:(item.photos||[]).map(photo=>({...photo,id:makeId("site-photo")})),attachments,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),copiedFrom:source});copied++
  }
  if(copied)save(`Skopírované zápisy ${copied} firiem. Teraz ich môžeš upraviť.`);
  else alertUser("Všetky firmy už majú v cieľovom dni zápis.");
  if(skipped)alertUser(`${skipped} existujúcich zápisov sa neprepísalo.`);
  render()
 }
 async function attachmentBlob(item,attachment){
  const local=await siteDeskGetAttachment(`${item.id}:${attachment.id}`);if(local)return local;
  if(!attachment.path||!cloudConfigured()||!cloudSession?.access_token)throw new Error("PDF nie je dostupné v tomto zariadení ani v cloude.");
  await cloudEnsureSession();const path=encodeStoragePath(attachment.path),base=normalizeCloudUrl(cloudConfig.url),headers={apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`};
  for(const prefix of ["authenticated/",""]){const response=await fetch(`${base}/storage/v1/object/${prefix}sitedesk-files/${path}`,{headers,cache:"no-store"});if(response.ok)return response.blob()}
  throw new Error("PDF sa nepodarilo načítať z cloudu.")
 }
 async function openDocument(id){
  const recordId=get("siteDiaryId").value,item=rows().find(row=>row.id===recordId),attachment=documents.find(document=>document.id===id);
  if(!item||!attachment)return;
  try{const blob=await attachmentBlob(item,attachment),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.target="_blank";link.rel="noopener";link.download=attachment.name||"priloha.pdf";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(error){alertUser(error.message)}
 }
 const description={clear:"Jasno",few_clouds:"Malá oblačnosť",scattered_clouds:"Polooblačno",broken_clouds:"Oblačno",overcast_clouds:"Zamračené",light_rain:"Slabý dážď",moderate_rain:"Dážď",heavy_rain:"Silný dážď",light_snow:"Slabé sneženie",rain_and_snow:"Dážď so snehom"};
 async function loadWeather(){
  const button=get("siteDiaryLoadWeather"),city=get("siteDiaryWeatherCity").value.trim(),date=get("siteDiaryEntryDate").value;
  if(!city){get("siteDiaryWeatherCity").focus();return}
  button.disabled=true;button.textContent="Načítavam…";
  try{
   const stationResponse=await fetch(`https://shmu.bmikuska.com/api/v1/stations?q=${encodeURIComponent(city)}&page_size=20`,{cache:"no-store"});
   if(!stationResponse.ok)throw new Error("Lokalita sa nenašla.");
   const stationData=await stationResponse.json(),stations=stationData.stations||[],station=stations.find(item=>norm(item.name)===norm(city))||stations.find(item=>norm(item.name).startsWith(norm(city)))||stations[0];
   if(!station)throw new Error("Pre túto lokalitu sa nenašla stanica modelu ALADIN.");
   const forecastResponse=await fetch(`https://shmu.bmikuska.com/api/v1/forecast/daily?station=${station.id}`,{cache:"no-store"});
   if(!forecastResponse.ok)throw new Error("Predpoveď SHMÚ sa teraz nedá načítať.");
   const forecast=await forecastResponse.json(),value=(forecast.list||[]).find(item=>item.date===date);
   if(!value)throw new Error("Predpoveď SHMÚ pre tento deň nie je dostupná. Starší deň doplň ručne.");
   const source="SHMÚ ALADIN · predpoveď";
   setWeather({text:description[value.weather?.code]||value.weather?.description||"",min:value.temp_min,max:value.temp_max,city,source,station:forecast.city?.name||station.name,retrievedAt:new Date().toISOString()});
   alertUser("Predpoveď SHMÚ bola doplnená. Skontroluj ju pred uložením.")
  }catch(error){alertUser(error.message||"Počasie sa nepodarilo načítať.")}finally{button.disabled=false;button.textContent="Načítať podľa SHMÚ"}
 }
 async function printEntries(entries,title,fileName){
  if(!entries.length){alertUser("Nie sú záznamy na export.");return}
  const project=siteProject(),parts=[];
  for(const item of entries){
   const sourcePhotos=await Promise.all((item.photos||[]).map(async photo=>photo.dataUrl||photo.path&&await cloudPhotoObjectUrl(photo.path)||""));
   const text=String(item.work||""),chunks=text.match(/[\s\S]{1,1150}/g)||[""];
   chunks.forEach((chunk,index)=>parts.push({item,type:"work",text:chunk,continuation:index>0,photos:[]}));
   const validPhotos=sourcePhotos.filter(Boolean);
   for(let index=0;index<validPhotos.length;index+=4)parts.push({item,type:"photos",text:"",continuation:index>0,photos:validPhotos.slice(index,index+4)})
  }
  const pages=parts.map((part,index)=>{
   const item=part.item,weather=item.weather||{},docs=(item.attachments||[]).map(attachment=>`<li>${escape(attachment.name)}</li>`).join(""),photosHtml=part.photos.map(src=>`<img src="${src}" alt="Fotografia zo stavby">`).join("");
   return `<section class="diary-page"><img class="diary-letterhead" src="${LETTERHEAD_IMAGE}" alt=""><div class="diary-content"><div class="diary-kicker">STAVEBNÝ DENNÍK · BETPRES</div><h1>${escape(title)}</h1><div class="diary-meta"><div><small>Stavba</small><strong>${escape(project?.name||"")}</strong></div><div><small>Dátum</small><strong>${escape(dateLabel(item.date))}</strong></div><div><small>Firma</small><strong>${escape(companyName(item))}</strong></div><div><small>Pracovníci</small><strong>${Number(item.workersCount)||0}</strong></div></div>${part.type==="work"?`<div class="diary-section"><h2>${part.continuation?"Pokračovanie záznamu":"Vykonané práce"}</h2><p>${escape(part.text).replace(/\n/g,"<br>")}</p></div>${item.place?`<div class="diary-line"><strong>Miesto / objekt:</strong> ${escape(item.place)}</div>`:""}<div class="diary-line"><strong>Počasie:</strong> ${escape(weather.text||"—")}${weather.min!==""&&weather.min!=null?` · ${escape(weather.min)} až ${escape(weather.max)} °C`:""}<small>${escape(weather.source||"Ručný údaj")}${weather.station?` · ${escape(weather.station)}`:""}</small></div>${docs?`<div class="diary-section"><h2>Priložené PDF dokumenty</h2><ul>${docs}</ul></div>`:""}`:`<div class="diary-section"><h2>Fotodokumentácia${part.continuation?" · pokračovanie":""}</h2><div class="diary-photos">${photosHtml}</div></div>`}<div class="diary-footer"><span>${escape(project?.name||"BETPRES")}</span><span>Strana ${index+1} / ${parts.length}</span></div></div></section>`
  }).join("");
  const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${escape(title)}</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;color:#162232;font:11px/1.45 Arial,sans-serif}.diary-page{position:relative;width:210mm;min-height:297mm;page-break-after:always;overflow:hidden}.diary-letterhead{position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill}.diary-content{position:relative;z-index:1;min-height:297mm;padding:37mm 16mm 31mm}.diary-kicker{font-size:10px;letter-spacing:.1em;font-weight:800;color:#305580}h1{font-size:19px;margin:4mm 0 8mm;color:#142c54}.diary-meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #aab7c6}.diary-meta>div{min-height:17mm;padding:3mm;border-bottom:1px solid #ccd4df}.diary-meta>div:nth-child(odd){border-right:1px solid #ccd4df}.diary-meta small{display:block;color:#647389;text-transform:uppercase;font-size:9px}.diary-meta strong{font-size:12px}.diary-section{margin-top:7mm}.diary-section h2{margin:0 0 2mm;padding-bottom:2mm;border-bottom:1px solid #aab7c6;font-size:12px;color:#183765}.diary-section p{margin:0;white-space:normal;overflow-wrap:anywhere;font-size:12px;line-height:1.55}.diary-line{margin-top:4mm;font-size:11px}.diary-line small{display:block;color:#667}.diary-photos{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.diary-photos img{max-width:100%;max-height:52mm;object-fit:contain}.diary-footer{position:absolute;left:16mm;right:16mm;bottom:18mm;display:flex;justify-content:space-between;color:#677487;font-size:9px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${pages}</body></html>`;
  const payload={html,fileName,landscape:false,title};
  if(window.showPdfPreview)void window.showPdfPreview(payload);
  else if(window.betpresDesktop?.exportPdf)void window.betpresDesktop.exportPdf(payload);
  else{const windowRef=window.open("","_blank");if(windowRef){windowRef.document.write(html);windowRef.document.close();windowRef.onload=()=>windowRef.print()}}
 }
 get("siteDiaryDate").value=day;get("siteDiaryCopySource").value=new Date(Date.now()-86400000).toISOString().slice(0,10);
 get("siteDiaryPrev").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()-1);day=dateKey(date);render()};
 get("siteDiaryNext").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()+1);day=dateKey(date);render()};
 get("siteDiaryDate").onchange=event=>{day=event.target.value||todayISO();render()};
 get("siteDiaryCompanyFilter").onchange=render;
 get("siteDiaryAdd").onclick=()=>openEditor();get("siteDiaryAddInline").onclick=()=>openEditor("",get("siteDiaryCompanyFilter").value);
 get("siteDiaryCopy").onclick=()=>void copyDay();get("siteDiaryLoadWeather").onclick=()=>void loadWeather();form.onsubmit=event=>void saveEntry(event);
 get("siteDiaryEntryCompany").onchange=()=>{const date=get("siteDiaryEntryDate").value;get("siteDiaryWorkers").value=workersAt(date,get("siteDiaryEntryCompany").value,selectedCompanyName())};
 get("siteDiaryEntryDate").onchange=()=>{get("siteDiaryWorkers").value=workersAt(get("siteDiaryEntryDate").value,get("siteDiaryEntryCompany").value,selectedCompanyName())};
 get("siteDiaryPhotos").onchange=async event=>{const files=[...(event.target.files||[])].slice(0,Math.max(0,6-photos.length));for(const file of files)try{photos.push(await compressPhoto(file))}catch(error){alertUser(error.message)}event.target.value="";renderAttachments()};
 get("siteDiaryDocuments").onchange=event=>{for(const file of event.target.files||[]){if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){alertUser("Vyber PDF dokument.");continue}newFiles.push({id:makeId("site-pdf"),file})}event.target.value="";renderAttachments()};
 get("siteDiaryAttachments").onclick=event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.siteDiaryRemovePhoto!==undefined)photos.splice(Number(button.dataset.siteDiaryRemovePhoto),1);else if(button.dataset.siteDiaryRemoveDocument)documents=documents.filter(item=>item.id!==button.dataset.siteDiaryRemoveDocument);else if(button.dataset.siteDiaryRemoveNew)newFiles=newFiles.filter(item=>item.id!==button.dataset.siteDiaryRemoveNew);else if(button.dataset.siteDiaryOpenDocument)void openDocument(button.dataset.siteDiaryOpenDocument);renderAttachments()};
 get("siteDiaryDayList").onclick=event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.siteDiaryEdit)openEditor(button.dataset.siteDiaryEdit);else if(button.dataset.siteDiaryExportOne){const item=rows().find(record=>record.id===button.dataset.siteDiaryExportOne);if(item)void printEntries([item],`Stavebný denník · ${companyName(item)}`,`stavebny-dennik-${item.date}-${norm(companyName(item)).replace(/\W+/g,"-")}.pdf`)}};
 get("siteDiaryExportDay").onclick=()=>void printEntries(rows().filter(item=>item.date===day),`Stavebný denník · ${dateLabel(day)}`,`stavebny-dennik-${day}.pdf`);
 get("siteDiaryExportCompany").onclick=()=>{const id=get("siteDiaryCompanyFilter").value,entries=rows().filter(item=>item.companyId===id).sort((a,b)=>a.date.localeCompare(b.date));if(id)void printEntries(entries,`Stavebný denník · ${entries[0]?companyName(entries[0]):"firma"}`,`stavebny-dennik-firma-${id.replace(/[^a-z0-9-]/gi,"-")}.pdf`)};
 window.renderSiteDiary=render;window.__BETPRES_SITE_DIARY_READY__=true;render()
})();
