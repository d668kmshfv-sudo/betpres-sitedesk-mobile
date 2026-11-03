(function(){
 "use strict";
 const get=id=>document.getElementById(id),escape=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const editor=get("siteDiaryModal"),form=get("siteDiaryForm");if(!editor||!form)return;
 let day=todayISO(),photos=[],documents=[],newFiles=[],weatherMeta=null,weatherDirty=false,weatherFormDay="",busy=false;
 const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`)):value;
 const rows=()=>Array.isArray(state.mobileDiary)?state.mobileDiary.filter(item=>item.kind==="siteLog"&&item.projectId===state.selectedProjectId):[];
 const companyName=item=>state.companies.find(company=>company.id===item.companyId)?.name||item.companyName||"Firma";
 const siteProject=()=>state.projects.find(project=>project.id===state.selectedProjectId)||null;
 const makeId=prefix=>typeof uid==="function"?uid(prefix):`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const alertUser=message=>typeof toast==="function"?toast(message):alert(message);
 const roundedTemp=value=>value===""||value==null||!Number.isFinite(Number(value))?"":String(Math.round(Number(value)));
 const dayWeatherRows=()=>Array.isArray(state.siteDiaryWeather)?state.siteDiaryWeather:[];
 function weatherForDate(date){
  const saved=dayWeatherRows().find(item=>item.projectId===state.selectedProjectId&&item.date===date);
  if(saved)return saved.weather||null;
  return rows().find(item=>item.date===date&&(item.weather?.text||item.weather?.min!==""&&item.weather?.min!=null))?.weather||null
 }
 function workerCountsForDay(date){
  const sheet=(state.workerSheets||[]).find(item=>item.projectId===state.selectedProjectId&&item.month===date.slice(0,7)),map=new Map();
  if(!sheet)return map;
  const dayNo=Number(date.slice(8));
  for(const row of sheet.rows||[]){
   const name=state.companies.find(company=>company.id===row.companyId)?.name||row.actualName||row.alias||row.name||"";
   if(!name)continue;
   const matched=state.companies.find(company=>norm(company.name)===norm(name));
   const id=row.companyId||matched?.id||`custom:${norm(name)}`;
   const previous=map.get(id);map.set(id,{id,name:previous?.name||name,count:(previous?.count||0)+Math.max(0,Number(row.values?.[dayNo])||0)})
  }
  return map
 }
 const workerCountFor=(date,companyId,name)=>workerCountsForDay(date).get(companyId)||[...workerCountsForDay(date).values()].find(item=>norm(item.name)===norm(name))||null;
 const workersAt=(date,companyId,name)=>workerCountFor(date,companyId,name)?.count||0;
 const displayedWorkers=item=>item.workersManual?Math.max(0,Number(item.workersCount)||0):workerCountFor(item.date,item.companyId,companyName(item))?.count??Math.max(0,Number(item.workersCount)||0);
 const rosterForDay=date=>[...workerCountsForDay(date).values()].filter(item=>item.count>0).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 function choices(){
  const map=new Map();
  state.companies.forEach(item=>{if(item.name)map.set(item.id,{id:item.id,name:item.name})});
  for(const date of [day,get("siteDiaryEntryDate")?.value].filter(Boolean))for(const item of rosterForDay(date))if(!map.has(item.id))map.set(item.id,{id:item.id,name:item.name});
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
 function fillCompanyOptions(select,value=""){
  const options=choices();select.innerHTML='<option value="">Vyber firmu</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
  if(value&&!options.some(item=>item.id===value))select.insertAdjacentHTML("beforeend",`<option value="${escape(value)}">${escape(value)}</option>`);
  select.value=value
 }
 function selectedCompanyName(){const select=get("siteDiaryEntryCompany");return select.selectedOptions[0]?.textContent||""}
 function recordFor(date,companyId){return rows().find(item=>item.date===date&&item.companyId===companyId)}
 function setWeather(weather){
  get("siteDiaryWeatherText").value=weather?.text||"";get("siteDiaryTempMin").value=roundedTemp(weather?.min);get("siteDiaryTempMax").value=roundedTemp(weather?.max);
  get("siteDiaryWeatherCity").value=weather?.city||[...dayWeatherRows()].filter(item=>item.projectId===state.selectedProjectId&&item.weather?.city).sort((a,b)=>b.date.localeCompare(a.date))[0]?.weather?.city||siteProject()?.city||"";
  weatherMeta=weather?{source:weather.source||"Ručný údaj",station:weather.station||"",retrievedAt:weather.retrievedAt||""}:null;
  get("siteDiaryWeatherSource").textContent=weatherMeta?.source?`${weatherMeta.source}${weatherMeta.station?` · ${weatherMeta.station}`:""}`:"Počasie sa uloží raz pre celý deň. Predpoveď ALADIN SHMÚ môžeš upraviť."
 }
 function saveWeather({silent=false}={}){
  if(!Array.isArray(state.siteDiaryWeather))state.siteDiaryWeather=[];
  const existing=dayWeatherRows().find(item=>item.projectId===state.selectedProjectId&&item.date===day),now=new Date().toISOString();
  const weather={text:get("siteDiaryWeatherText").value.trim(),min:roundedTemp(get("siteDiaryTempMin").value),max:roundedTemp(get("siteDiaryTempMax").value),city:get("siteDiaryWeatherCity").value.trim(),source:weatherMeta?.source||"Ručný údaj",station:weatherMeta?.station||"",retrievedAt:weatherMeta?.retrievedAt||""};
  const record={id:existing?.id||makeId("site-weather"),projectId:state.selectedProjectId,date:day,weather,createdAt:existing?.createdAt||now,updatedAt:now};
  if(existing)state.siteDiaryWeather[state.siteDiaryWeather.indexOf(existing)]=record;else state.siteDiaryWeather.push(record);
  weatherDirty=false;weatherFormDay=day;save(silent?"":`Počasie pre ${dateLabel(day)} bolo uložené.`);render()
 }
 function renderAttachments(){
  const items=[...photos.map((item,index)=>`<div class="site-diary-attachment"><span>📷 ${escape(item.name||`Fotografia ${index+1}`)}</span><button type="button" data-site-diary-remove-photo="${index}" aria-label="Odstrániť fotografiu">×</button></div>`),...documents.map(item=>`<div class="site-diary-attachment"><span>PDF · ${escape(item.name)}</span><button type="button" data-site-diary-open-document="${escape(item.id)}">Otvoriť</button><button type="button" data-site-diary-remove-document="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`),...newFiles.map(item=>`<div class="site-diary-attachment"><span>Nové PDF · ${escape(item.file.name)}</span><button type="button" data-site-diary-remove-new="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`)];
  get("siteDiaryAttachments").innerHTML=items.join("")||'<small>Bez príloh.</small>'
 }
 function openEditor(id="",chosenCompany=""){
  const item=id?rows().find(record=>record.id===id):null,date=item?.date||day;
  get("siteDiaryId").value=item?.id||"";get("siteDiaryEntryDate").value=date;fillCompanyOptions(get("siteDiaryEntryCompany"),item?.companyId||chosenCompany);
  get("siteDiaryWorkers").value=item?displayedWorkers(item):workersAt(date,chosenCompany,selectedCompanyName());get("siteDiaryWorkers").dataset.userEdited=item?.workersManual?"1":"0";
  get("siteDiaryPlace").value=item?.place||"";get("siteDiaryWork").value=item?.work||"";
  photos=Array.isArray(item?.photos)?item.photos.map(photo=>({...photo})):[];
  documents=Array.isArray(item?.attachments)?item.attachments.map(document=>({...document})):[];newFiles=[];
  get("siteDiaryPhotos").value="";get("siteDiaryDocuments").value="";renderAttachments();
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
   const now=new Date().toISOString(),manualWorkers=get("siteDiaryWorkers").dataset.userEdited==="1",sheetWorkers=workerCountFor(date,companyId,companyLabel),record={...existing,id,kind:"siteLog",projectId:state.selectedProjectId,date,companyId,companyName:companyLabel,workersCount:manualWorkers||!sheetWorkers?Math.max(0,Math.min(999,Number(get("siteDiaryWorkers").value)||0)):sheetWorkers.count,workersManual:manualWorkers,place:get("siteDiaryPlace").value.trim(),work,
    photos:photos.slice(),attachments:[...documents,...stored],author:existing?.author||cloudConfig?.displayName||"BETPRES",createdAt:existing?.createdAt||now,updatedAt:now};
   if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
   if(existing)state.mobileDiary[state.mobileDiary.indexOf(existing)]=record;else state.mobileDiary.push(record);
   day=date;get("siteDiaryDate").value=date;editor.classList.add("hidden");save(existing?"Denný záznam bol upravený.":"Denný záznam firmy bol uložený.");render()
  }catch(error){alert(`Záznam sa nepodarilo uložiť: ${error.message||error}`)}finally{busy=false;form.querySelector('[type="submit"]').disabled=false}
 }
 function render(){
  const filter=get("siteDiaryCompanyFilter"),previous=filter.value;
  const roster=rosterForDay(day),allEntries=rows().filter(item=>item.date===day),options=[...new Map([...roster.map(item=>[item.id,{id:item.id,name:item.name}]),...rows().map(item=>[item.companyId,{id:item.companyId,name:companyName(item)}])]).values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  filter.innerHTML='<option value="">Všetky firmy</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");filter.value=options.some(item=>item.id===previous)?previous:"";
  const entries=allEntries.filter(item=>!filter.value||item.companyId===filter.value).sort((a,b)=>companyName(a).localeCompare(companyName(b),"sk"));
  if(weatherFormDay!==day||!weatherDirty){setWeather(weatherForDate(day));weatherFormDay=day;weatherDirty=false}
  const weather=weatherForDate(day),weatherRange=weather?.min!==""&&weather?.min!=null&&weather?.max!==""&&weather?.max!=null?` · ${roundedTemp(weather.min)} až ${roundedTemp(weather.max)} °C`:"";
  get("siteDiaryWeatherSummary").textContent=weather?.text?`${weather.text}${weatherRange}`:"Počasie pre tento deň ešte nie je vyplnené.";
  get("siteDiaryLoadWeather").textContent=day<todayISO()?"Načítať merania SHMÚ":"Načítať predpoveď SHMÚ";
  const allIds=new Set([...roster.map(item=>item.id),...allEntries.map(item=>item.companyId)]),totalWorkers=roster.reduce((sum,item)=>sum+item.count,0)+allEntries.filter(item=>!roster.some(worker=>worker.id===item.companyId)).reduce((sum,item)=>sum+displayedWorkers(item),0);
  get("siteDiaryDate").value=day;get("siteDiaryDaySummary").textContent=`${dateLabel(day)} · ${allIds.size} ${allIds.size===1?"firma":allIds.size<5?"firmy":"firiem"} · ${totalWorkers} pracovníkov`;
  get("siteDiaryRoster").innerHTML=roster.map(item=>`<div class="site-diary-roster-item"><span><strong>${escape(item.name)}</strong><small>${item.count} pracovníkov podľa stavu</small></span>${recordFor(day,item.id)?'<span class="site-diary-roster-done">Práce zapísané</span>':`<button type="button" data-site-diary-add-company="${escape(item.id)}">+ Zapísať práce</button>`}</div>`).join("")||'<small>Počty sa zobrazia po vyplnení Stavu pracovníkov pre tento deň.</small>';
  get("siteDiaryExportCompany").disabled=!filter.value||!rows().some(item=>item.companyId===filter.value);
  get("siteDiaryDayList").innerHTML=entries.map(item=>`<article class="site-diary-card"><div class="site-diary-card-head"><span>${escape(companyName(item))}</span><strong>${displayedWorkers(item)} pracovníkov</strong></div><div class="site-diary-card-meta">${item.place?`<span>⌖ ${escape(item.place)}</span>`:""}</div><p>${escape(item.work)}</p><div class="site-diary-card-foot"><small>${(item.photos||[]).length} foto · ${(item.attachments||[]).length} PDF</small><div><button type="button" data-site-diary-edit="${escape(item.id)}">Upraviť záznam</button></div></div></article>`).join("")||'<div class="site-diary-empty"><strong>Zatiaľ tu nie je opis prác</strong><span>Firmy a počty zo Stavu pracovníkov vidíš vyššie. Pri každej dopíš, čo robila.</span></div>'
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
   const {weather:_sourceWeather,...sourceEntry}=item;
   state.mobileDiary.push({...sourceEntry,id,date:target,workersCount:item.workersCount,photos:(item.photos||[]).map(photo=>({...photo,id:makeId("site-photo")})),attachments,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),copiedFrom:source});copied++
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
 function stationDistance(a,b){
  const toRad=value=>Number(value)*Math.PI/180,lat1=toRad(a.lat),lat2=toRad(b.lat),deltaLat=lat2-lat1,deltaLon=toRad(b.lon)-toRad(a.lon);
  return 6371*2*Math.asin(Math.sqrt(Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLon/2)**2))
 }
 async function loadWeather(){
  const button=get("siteDiaryLoadWeather"),city=get("siteDiaryWeatherCity").value.trim(),date=day;
  if(!city){get("siteDiaryWeatherCity").focus();return}
  button.disabled=true;button.textContent="Načítavam…";
  try{
   let stations=[];
   try{const response=await fetch(`https://shmu.bmikuska.com/api/v1/stations?q=${encodeURIComponent(city)}&page_size=20`,{cache:"no-store"});if(response.ok)stations=(await response.json()).stations||[]}catch{}
   const station=stations.find(item=>norm(item.name)===norm(city))||stations.find(item=>norm(item.name).startsWith(norm(city)))||stations[0];
   if(date<todayISO()){
    let archive=null;
    for(const url of [
     `https://raw.githubusercontent.com/d668kmshfv-sudo/betpres-sitedesk-mobile/main/ipad/assets/data/shmu-history.json?date=${date}&t=${Math.floor(Date.now()/300000)}`,
     "assets/data/shmu-history.json?v=5.7.1"
    ]){
     try{const response=await fetch(url,{cache:"no-store"});if(response.ok){const value=await response.json();if(value?.dates?.[date]){archive=value;break}}}catch{}
    }
    if(!archive)throw new Error("Merania SHMÚ pre tento deň zatiaľ nie sú v archíve. Počasie môžeš doplniť ručne.");
    const available=(archive.dates[date].stations||[]).filter(item=>Number(item.sampleCount)>=120);
    if(!available.length)throw new Error("Merania SHMÚ pre tento deň zatiaľ nie sú v archíve. Počasie môžeš doplniť ručne.");
    const candidates=available.filter(item=>Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lon))&&item.lat!=null&&item.lon!=null);
    const nearest=station&&candidates.length?candidates.map(item=>({item,distance:stationDistance(station,item)})).sort((a,b)=>a.distance-b.distance)[0]:null;
    const named=available.find(item=>norm(item.name).includes(norm(city)))||available.find(item=>norm(city).includes(norm(item.name.split(",")[0])));
    const measured=nearest&&nearest.distance<=80?nearest.item:named;
    if(!measured)throw new Error("V archíve SHMÚ sa nenašla blízka stanica. Skús názov väčšieho mesta alebo doplň počasie ručne.");
    setWeather({text:measured.condition||"Namerané údaje",min:roundedTemp(measured.minC),max:roundedTemp(measured.maxC),city,source:"SHMÚ · namerané počasie",station:measured.name,retrievedAt:new Date().toISOString()})
   }else{
    if(!station)throw new Error("Pre túto lokalitu sa nenašla stanica modelu ALADIN.");
    const forecastResponse=await fetch(`https://shmu.bmikuska.com/api/v1/forecast/daily?station=${station.id}`,{cache:"no-store"});
    if(!forecastResponse.ok)throw new Error("Predpoveď SHMÚ sa teraz nedá načítať.");
    const forecast=await forecastResponse.json(),value=(forecast.list||[]).find(item=>item.date===date);
    if(!value)throw new Error("Predpoveď SHMÚ pre tento deň nie je dostupná. Počasie môžeš doplniť ručne.");
    setWeather({text:description[value.weather?.code]||value.weather?.description||"",min:roundedTemp(value.temp_min),max:roundedTemp(value.temp_max),city,source:"SHMÚ ALADIN · predpoveď",station:forecast.city?.name||station.name,retrievedAt:new Date().toISOString()})
   }
   saveWeather();
  }catch(error){alertUser(error.message||"Počasie sa nepodarilo načítať.")}finally{button.disabled=false;button.textContent=date<todayISO()?"Načítať merania SHMÚ":"Načítať predpoveď SHMÚ"}
 }
 async function printReport(mode,entries,title,fileName){
  if(!entries.length){alertUser("Nie sú záznamy na export.");return}
  if(typeof window.siteDiaryPrint!=="function"){alertUser("Export sa nepodarilo načítať. Obnov stránku.");return}
  try{
   const normalized=await Promise.all(entries.map(async item=>({
    date:item.date,companyName:companyName(item),workersCount:displayedWorkers(item),work:item.work||"Práce zatiaľ nezapísané.",place:item.place||"",
    attachments:(item.attachments||[]).map(attachment=>({name:attachment.name})),
    photos:(await Promise.all((item.photos||[]).map(async photo=>{try{return photo.dataUrl||photo.path&&await cloudPhotoObjectUrl(photo.path)||""}catch{return""}}))).filter(Boolean)
   })));
   const weatherByDate=Object.fromEntries([...new Set(normalized.map(item=>item.date))].map(date=>[date,weatherForDate(date)]));
   await window.siteDiaryPrint({mode,entries:normalized,weatherByDate,projectName:siteProject()?.name||"BETPRES",title,fileName,letterheadImage:LETTERHEAD_IMAGE})
  }catch(error){alertUser(`Export sa nepodaril: ${error.message||error}`)}
 }
 function dayReportEntries(){
  const entries=rows().filter(item=>item.date===day),recorded=new Set(entries.map(item=>item.companyId));
  for(const item of rosterForDay(day))if(!recorded.has(item.id))entries.push({id:`roster:${item.id}`,date:day,companyId:item.id,companyName:item.name,workersCount:item.count,work:"Práce zatiaľ nezapísané.",photos:[],attachments:[]});
  return entries.sort((a,b)=>companyName(a).localeCompare(companyName(b),"sk"))
 }
 get("siteDiaryDate").value=day;get("siteDiaryCopySource").value=new Date(Date.now()-86400000).toISOString().slice(0,10);
 get("siteDiaryPrev").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()-1);day=dateKey(date);render()};
 get("siteDiaryNext").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()+1);day=dateKey(date);render()};
 get("siteDiaryDate").onchange=event=>{day=event.target.value||todayISO();render()};
 get("siteDiaryCompanyFilter").onchange=render;
 get("siteDiaryAdd").onclick=()=>openEditor();get("siteDiaryAddInline").onclick=()=>openEditor("",get("siteDiaryCompanyFilter").value);
 get("siteDiaryCopy").onclick=()=>void copyDay();get("siteDiaryLoadWeather").onclick=()=>void loadWeather();get("siteDiaryWeatherSave").onclick=()=>saveWeather();form.onsubmit=event=>void saveEntry(event);
 for(const id of ["siteDiaryWeatherCity","siteDiaryWeatherText","siteDiaryTempMin","siteDiaryTempMax"])get(id).addEventListener("input",()=>{weatherDirty=true;weatherMeta={source:"Ručný údaj",station:"",retrievedAt:""};get("siteDiaryWeatherSource").textContent="Ručný údaj · ulož počasie pre vybraný deň."});
 get("siteDiaryWorkers").oninput=()=>{get("siteDiaryWorkers").dataset.userEdited="1"};
 get("siteDiaryUseWorkers").onclick=()=>{get("siteDiaryWorkers").value=workersAt(get("siteDiaryEntryDate").value,get("siteDiaryEntryCompany").value,selectedCompanyName());get("siteDiaryWorkers").dataset.userEdited="0"};
 get("siteDiaryEntryCompany").onchange=()=>{const date=get("siteDiaryEntryDate").value;get("siteDiaryWorkers").value=workersAt(date,get("siteDiaryEntryCompany").value,selectedCompanyName());get("siteDiaryWorkers").dataset.userEdited="0"};
 get("siteDiaryEntryDate").onchange=()=>{get("siteDiaryWorkers").value=workersAt(get("siteDiaryEntryDate").value,get("siteDiaryEntryCompany").value,selectedCompanyName());get("siteDiaryWorkers").dataset.userEdited="0"};
 get("siteDiaryPhotos").onchange=async event=>{const files=[...(event.target.files||[])].slice(0,Math.max(0,6-photos.length));for(const file of files)try{photos.push(await compressPhoto(file))}catch(error){alertUser(error.message)}event.target.value="";renderAttachments()};
 get("siteDiaryDocuments").onchange=event=>{for(const file of event.target.files||[]){if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){alertUser("Vyber PDF dokument.");continue}newFiles.push({id:makeId("site-pdf"),file})}event.target.value="";renderAttachments()};
 get("siteDiaryAttachments").onclick=event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.siteDiaryRemovePhoto!==undefined)photos.splice(Number(button.dataset.siteDiaryRemovePhoto),1);else if(button.dataset.siteDiaryRemoveDocument)documents=documents.filter(item=>item.id!==button.dataset.siteDiaryRemoveDocument);else if(button.dataset.siteDiaryRemoveNew)newFiles=newFiles.filter(item=>item.id!==button.dataset.siteDiaryRemoveNew);else if(button.dataset.siteDiaryOpenDocument)void openDocument(button.dataset.siteDiaryOpenDocument);renderAttachments()};
 get("siteDiaryRoster").onclick=event=>{const button=event.target.closest("[data-site-diary-add-company]");if(button)openEditor("",button.dataset.siteDiaryAddCompany)};
 get("siteDiaryDayList").onclick=event=>{const button=event.target.closest("[data-site-diary-edit]");if(button)openEditor(button.dataset.siteDiaryEdit)};
 get("siteDiaryExportDay").onclick=()=>void printReport("day",dayReportEntries(),`Stavebný denník · ${dateLabel(day)}`,`stavebny-dennik-${day}.pdf`);
 get("siteDiaryExportCompany").onclick=()=>{const id=get("siteDiaryCompanyFilter").value,entries=rows().filter(item=>item.companyId===id).sort((a,b)=>a.date.localeCompare(b.date));if(id)void printReport("company",entries,`Stavebný denník · ${entries[0]?companyName(entries[0]):"firma"}`,`stavebny-dennik-firma-${id.replace(/[^a-z0-9-]/gi,"-")}.pdf`)};
 window.renderSiteDiary=render;window.__BETPRES_SITE_DIARY_READY__=true;render()
})();
