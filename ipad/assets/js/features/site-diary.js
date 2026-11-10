(function(){
 "use strict";
 const get=id=>document.getElementById(id),escape=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
 const editor=get("siteDiaryModal"),form=get("siteDiaryForm");if(!editor||!form)return;
 let day=todayISO(),photos=[],documents=[],newFiles=[],weatherMeta=null,weatherDirty=false,weatherFormDay="",busy=false;
 const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"long",year:"numeric"}).format(new Date(`${value}T12:00:00`)):value;
 const precedingDate=value=>{const date=new Date(`${value}T12:00:00`);date.setDate(date.getDate()-1);return dateKey(date)};
 const rows=()=>Array.isArray(state.mobileDiary)?state.mobileDiary.filter(item=>item.kind==="siteLog"&&item.projectId===state.selectedProjectId):[];
 const companyName=item=>state.companies.find(company=>company.id===item.companyId)?.name||item.companyName||"Firma";
 const siteProject=()=>state.projects.find(project=>project.id===state.selectedProjectId)||null;
 const weatherCity=()=>siteProject()?.city?.trim()||weatherForDate(day)?.city?.trim()||[...dayWeatherRows()].filter(item=>item.projectId===state.selectedProjectId&&item.weather?.city).sort((a,b)=>b.date.localeCompare(a.date))[0]?.weather?.city?.trim()||"";
 const makeId=prefix=>typeof uid==="function"?uid(prefix):`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 const alertUser=message=>typeof toast==="function"?toast(message):alert(message);
 const roundedTemp=value=>value===""||value==null||!Number.isFinite(Number(value))?"":String(Math.round(Number(value)));
 const dayWeatherRows=()=>Array.isArray(state.siteDiaryWeather)?state.siteDiaryWeather:[];
 function weatherForDate(date){
  const saved=dayWeatherRows().find(item=>item.projectId===state.selectedProjectId&&item.date===date);
  if(saved)return saved.weather||null;
  return rows().find(item=>item.date===date&&(item.weather?.text||item.weather?.min!==""&&item.weather?.min!=null))?.weather||null
 }
 const betpresCompany=()=>state.companies.find(item=>norm(item.name).startsWith("betpres"))||{id:"betpres",name:"BETPRES s.r.o."};
 const companyIdentity=(id,name)=>{const found=state.companies.find(item=>item.id===id)||state.companies.find(item=>norm(item.name)===norm(name));return{id:found?.id||id||`custom:${norm(name)}`,name:found?.name||name}};
 const customCompanyOption="__custom__";
 const workDescription=item=>{const work=String(item?.work||"").trim(),place=String(item?.place||"").trim();return place&&!norm(work).includes(norm(place))?`${place} – ${work}`:work};
 function selectedSupplier(selectId,customId){
  const select=get(selectId),value=select.value;
  if(!value)return{id:"",name:""};
  if(value!==customCompanyOption)return{id:value,name:select.selectedOptions[0]?.textContent?.trim()||""};
  const name=get(customId).value.trim();if(!name)return{id:"",name:""};
  const existing=[...rows(),...(state.siteDiaryMachinery||[]).filter(item=>item.projectId===state.selectedProjectId)].find(item=>norm(item.companyName)===norm(name));
  return existing?{id:existing.companyId,name:existing.companyName}:companyIdentity("",name)
 }
 function toggleCustomSupplier(selectId,wrapId,inputId,focus=false){
  const custom=get(selectId).value===customCompanyOption,wrap=get(wrapId),input=get(inputId);
  wrap.classList.toggle("hidden",!custom);input.required=custom;
  if(custom&&focus)input.focus()
 }
 function namedBetpresCrew(date){
  const month=date.slice(0,7),number=Number(date.slice(8)),groups=new Map(),supplier=betpresCompany();
  for(const [key,fallback] of [["betpresTimesheets","Stavebný pracovník"],["thpTimesheets","THP"]]){
   const sheet=(state[key]||[]).find(item=>item.projectId===state.selectedProjectId&&item.month===month);
   for(const person of sheet?.rows||[]){
    if(!String(person.name||"").trim())continue;
    const present=typeof attendanceHours==="function"?(attendanceHours(person.values?.[number])>0||key==="betpresTimesheets"&&attendanceHours(person.overtime?.[number])>0):Number(person.values?.[number])>0;
    if(!present)continue;
    const profession=String(person.position||fallback).trim()||fallback;
    groups.set(profession,(groups.get(profession)||0)+1)
   }
  }
  return[...groups].map(([profession,count])=>({profession,companyId:supplier.id,companyName:supplier.name,count}))
 }
 function workerCountsForDay(date){
  const month=date.slice(0,7),dayNo=Number(date.slice(8)),sheet=(state.workerSheets||[]).find(item=>item.projectId===state.selectedProjectId&&item.month===month),map=new Map();
  const upsert=(companyId,companyLabel,count,authoritative=false)=>{
   if(!companyLabel)return;
   const identity=companyIdentity(companyId,companyLabel),previous=map.get(identity.id);
   if(previous?.authoritative&&!authoritative)return;
   map.set(identity.id,{id:identity.id,name:identity.name,count:Math.max(0,(previous?.count||0)+Number(count||0)),authoritative:authoritative||previous?.authoritative||false})
  };
  for(const row of sheet?.rows||[]){
   const name=state.companies.find(company=>company.id===row.companyId)?.name||row.actualName||row.alias||row.name||"";
   upsert(row.companyId,name,row.values?.[dayNo],Object.hasOwn(row.values||{},dayNo))
  }
  const named=namedBetpresCrew(date),namedCount=named.reduce((sum,row)=>sum+row.count,0);
  if(namedCount){
   const betpres=betpresCompany(),identity=companyIdentity(betpres.id,betpres.name);
   for(const [id,item] of map)if(id===identity.id||norm(item.name).startsWith("betpres"))map.delete(id);
   map.set(identity.id,{id:identity.id,name:identity.name,count:namedCount,authoritative:true})
  }
  for(const hourly of (state.companyHourTimesheets||[]).filter(item=>item.projectId===state.selectedProjectId&&item.month===month))for(const row of hourly.rows||[]){
   const name=state.companies.find(company=>company.id===row.companyId)?.name||row.companyName||"";
   const count=(row.workers||[]).filter(person=>String(person.name||"").trim()&&typeof attendanceHours==="function"&&attendanceHours(person.values?.[dayNo])>0).length;
   const identity=companyIdentity(row.companyId,name);if(!map.get(identity.id)?.authoritative&&count)upsert(row.companyId,name,count)
  }
  for(const sheet of (state.companyTimesheets||[]).filter(item=>item.projectId===state.selectedProjectId&&item.month===month))for(const row of sheet.rows||[]){
   const name=state.companies.find(company=>company.id===row.companyId)?.name||row.companyName||"",identity=companyIdentity(row.companyId,name);
   if(map.get(identity.id)?.authoritative||map.get(identity.id)?.count)continue;
   const count=(row.workers||[]).filter(person=>String(person.name||"").trim()&&typeof companyTimesheetDayHours==="function"&&companyTimesheetDayHours(person,dayNo)>0).length;
   if(count)upsert(row.companyId,name,count)
  }
  return map
 }
 const workerCountFor=(date,companyId,name)=>workerCountsForDay(date).get(companyId)||[...workerCountsForDay(date).values()].find(item=>norm(item.name)===norm(name))||null;
 const savedCrewForDay=date=>(state.siteDiaryCrew||[]).find(item=>item.projectId===state.selectedProjectId&&item.date===date)||null;
 const savedCrewCount=(date,companyId,name)=>{
  const snapshot=savedCrewForDay(date);if(!snapshot)return null;
  return(snapshot.rows||[]).filter(row=>companyId&&row.companyId===companyId||name&&norm(row.companyName)===norm(name)).reduce((sum,row)=>sum+Math.max(0,Number(row.count)||0),0)
 };
 const workersAt=(date,companyId,name)=>savedCrewCount(date,companyId,name)??workerCountFor(date,companyId,name)?.count??0;
 const displayedWorkers=item=>item.workersManual?Math.max(0,Number(item.workersCount)||0):savedCrewCount(item.date,item.companyId,companyName(item))??workerCountFor(item.date,item.companyId,companyName(item))?.count??Math.max(0,Number(item.workersCount)||0);
 const rosterForDay=date=>[...workerCountsForDay(date).values()].filter(item=>item.count>0).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 function crewFromState(date){
  const named=namedBetpresCrew(date),crew=[];
  for(const item of workerCountsForDay(date).values()){
   if(item.count<=0)continue;
   if(norm(item.name).startsWith("betpres")&&named.length){crew.push(...named);continue}
   const recorded=rows().find(entry=>entry.date===date&&(entry.companyId===item.id||norm(companyName(entry))===norm(item.name)));
   crew.push({profession:recorded?.profession||"Stavebný pracovník",companyId:item.id,companyName:item.name,count:item.count})
  }
  return crew.sort((a,b)=>a.companyName.localeCompare(b.companyName,"sk")||a.profession.localeCompare(b.profession,"sk"))
 }
 function liveCrewForDay(date){
  const named=namedBetpresCrew(date),people=workerCountsForDay(date),crew=[];
  for(const item of people.values()){
   if(item.count<=0)continue;
   const special=norm(item.name).startsWith("betpres");
   if(special&&named.length){crew.push(...named);continue}
   const recorded=rows().find(entry=>entry.date===date&&(entry.companyId===item.id||norm(companyName(entry))===norm(item.name)));
   crew.push({profession:recorded?.profession||"Stavebný pracovník",companyId:item.id,companyName:item.name,count:recorded?.workersManual?displayedWorkers(recorded):item.count})
  }
  for(const entry of rows().filter(item=>item.date===date))if(!crew.some(row=>row.companyId===entry.companyId||norm(row.companyName)===norm(companyName(entry)))){
   const count=displayedWorkers(entry);if(count)crew.push({profession:entry.profession||"Stavebný pracovník",companyId:entry.companyId,companyName:companyName(entry),count})
  }
  return crew.filter(item=>item.count>0).sort((a,b)=>a.companyName.localeCompare(b.companyName,"sk")||a.profession.localeCompare(b.profession,"sk"))
 }
 function crewForDay(date){
  const snapshot=savedCrewForDay(date);
  return snapshot?(snapshot.rows||[]).filter(item=>Number(item.count)>0):liveCrewForDay(date)
 }
 function saveCrewFromState(){
  const crew=crewFromState(day),existing=savedCrewForDay(day);
  if(!crew.length){alertUser("V stave pracovníkov pre tento deň ešte nie sú zapísané počty.");return}
  const snapshotRows=crew.map(item=>({profession:item.profession,companyId:item.companyId,companyName:item.companyName,count:item.count}));
  if(existing&&JSON.stringify(existing.rows||[])===JSON.stringify(snapshotRows)){alertUser("Pracovníci v denníku už zodpovedajú stavu.");return}
  if(existing&&!confirm("Nahradiť uložené počty pracovníkov pre tento deň aktuálnym stavom?"))return;
  if(!Array.isArray(state.siteDiaryCrew))state.siteDiaryCrew=[];
  const now=new Date().toISOString(),snapshot={id:existing?.id||makeId("site-crew"),projectId:state.selectedProjectId,date:day,rows:snapshotRows,source:"Stav pracovníkov",createdAt:existing?.createdAt||now,updatedAt:now};
  if(existing)state.siteDiaryCrew[state.siteDiaryCrew.indexOf(existing)]=snapshot;else state.siteDiaryCrew.push(snapshot);
  save(existing?"Pracovníci v denníku boli aktualizovaní.":"Pracovníci boli zapísaní do denníka.");window.queueDiaryReviewPublish?.(day);render()
 }
 const machinesForDay=date=>(state.siteDiaryMachinery||[]).filter(item=>item.projectId===state.selectedProjectId&&item.date===date).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 const inspectionsForDay=date=>(state.siteDiaryInspections||[]).filter(item=>item.projectId===state.selectedProjectId&&item.date===date).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")));
 const inspectionDueLabel=value=>{if(!value)return"";const date=new Date(value);return Number.isNaN(date.getTime())?String(value):new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date)};
 function choices(){
  const map=new Map();
  state.companies.forEach(item=>{if(item.name)map.set(item.id,{id:item.id,name:item.name})});
  const betpres=betpresCompany();if(![...map.values()].some(item=>norm(item.name).startsWith("betpres")))map.set(betpres.id,{id:betpres.id,name:betpres.name});
  for(const date of [day,get("siteDiaryEntryDate")?.value].filter(Boolean))for(const item of rosterForDay(date))if(!map.has(item.id))map.set(item.id,{id:item.id,name:item.name});
  const months=new Set([day.slice(0,7),get("siteDiaryEntryDate")?.value.slice(0,7)].filter(Boolean));
  (state.workerSheets||[]).filter(sheet=>sheet.projectId===state.selectedProjectId&&months.has(sheet.month)).forEach(sheet=>(sheet.rows||[]).forEach(row=>{
   if(typeof isBetpresWorkerRow==="function"&&isBetpresWorkerRow(row))return;
   const name=row.alias||row.name||state.companies.find(company=>company.id===row.companyId)?.name||"";
   if(!name)return;
   const id=row.companyId||`custom:${norm(name)}`;if(!map.has(id))map.set(id,{id,name})
  }));
  rows().forEach(item=>{if(item.companyId&&!map.has(item.companyId))map.set(item.companyId,{id:item.companyId,name:item.companyName||"Firma"})});
  (state.siteDiaryMachinery||[]).filter(item=>item.projectId===state.selectedProjectId).forEach(item=>{if(item.companyId&&!map.has(item.companyId))map.set(item.companyId,{id:item.companyId,name:item.companyName||"Dodávateľ"})});
  return[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"))
 }
 function fillCompanyOptions(select,value=""){
  const options=choices();select.innerHTML='<option value="">Vyber firmu</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")+`<option value="${customCompanyOption}">+ Napísať inú firmu</option>`;
  if(value&&!options.some(item=>item.id===value))select.insertAdjacentHTML("beforeend",`<option value="${escape(value)}">${escape(value)}</option>`);
  select.value=value
 }
 const selectedWorkCompany=()=>selectedSupplier("siteDiaryEntryCompany","siteDiaryCustomCompany");
 function selectedCompanyName(){return selectedWorkCompany().name}
 function recordFor(date,companyId){return rows().find(item=>item.date===date&&item.companyId===companyId)}
 function setWeather(weather){
  get("siteDiaryWeatherText").value=weather?.text||"";get("siteDiaryTempMin").value=roundedTemp(weather?.min);get("siteDiaryTempMax").value=roundedTemp(weather?.max);
  weatherMeta=weather?{source:weather.source||"Ručný údaj",station:weather.station||"",retrievedAt:weather.retrievedAt||""}:null;
  get("siteDiaryWeatherSource").textContent=weatherMeta?.source?`${weatherMeta.source}${weatherMeta.station?` · ${weatherMeta.station}`:""}`:"Počasie sa uloží raz pre celý deň. Predpoveď ALADIN SHMÚ môžeš upraviť."
 }
 function saveWeather({silent=false}={}){
  if(!Array.isArray(state.siteDiaryWeather))state.siteDiaryWeather=[];
  const existing=dayWeatherRows().find(item=>item.projectId===state.selectedProjectId&&item.date===day),now=new Date().toISOString();
  const weather={text:get("siteDiaryWeatherText").value.trim(),min:roundedTemp(get("siteDiaryTempMin").value),max:roundedTemp(get("siteDiaryTempMax").value),city:weatherCity(),source:weatherMeta?.source||"Ručný údaj",station:weatherMeta?.station||"",retrievedAt:weatherMeta?.retrievedAt||""};
  const record={id:existing?.id||makeId("site-weather"),projectId:state.selectedProjectId,date:day,weather,createdAt:existing?.createdAt||now,updatedAt:now};
  if(existing)state.siteDiaryWeather[state.siteDiaryWeather.indexOf(existing)]=record;else state.siteDiaryWeather.push(record);
  weatherDirty=false;weatherFormDay=day;save(silent?"":`Počasie pre ${dateLabel(day)} bolo uložené.`);window.queueDiaryReviewPublish?.(day);render()
 }
 function renderAttachments(){
  const items=[...photos.map((item,index)=>`<div class="site-diary-attachment"><span>📷 ${escape(item.name||`Fotografia ${index+1}`)}</span><button type="button" data-site-diary-remove-photo="${index}" aria-label="Odstrániť fotografiu">×</button></div>`),...documents.map(item=>`<div class="site-diary-attachment"><span>PDF · ${escape(item.name)}</span><button type="button" data-site-diary-open-document="${escape(item.id)}">Otvoriť</button><button type="button" data-site-diary-remove-document="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`),...newFiles.map(item=>`<div class="site-diary-attachment"><span>Nové PDF · ${escape(item.file.name)}</span><button type="button" data-site-diary-remove-new="${escape(item.id)}" aria-label="Odstrániť PDF">×</button></div>`)];
  get("siteDiaryAttachments").innerHTML=items.join("")||'<small>Bez príloh.</small>'
 }
 function openEditor(id="",chosenCompany=""){
  const item=id?rows().find(record=>record.id===id):null,date=item?.date||day;
   const selectedId=item?.companyId||chosenCompany||betpresCompany().id;
   get("siteDiaryId").value=item?.id||"";get("siteDiaryEntryDate").value=date;fillCompanyOptions(get("siteDiaryEntryCompany"),selectedId);
  get("siteDiaryCustomCompany").value="";toggleCustomSupplier("siteDiaryEntryCompany","siteDiaryCustomCompanyWrap","siteDiaryCustomCompany");
   get("siteDiaryWorkers").value=item?displayedWorkers(item):workersAt(date,selectedId,selectedCompanyName());get("siteDiaryWorkers").dataset.userEdited=item?.workersManual?"1":"0";
  get("siteDiaryProfession").value=item?.profession||"";get("siteDiaryWork").value=workDescription(item);
  photos=Array.isArray(item?.photos)?item.photos.map(photo=>({...photo})):[];
  documents=Array.isArray(item?.attachments)?item.attachments.map(document=>({...document})):[];newFiles=[];
  get("siteDiaryPhotos").value="";get("siteDiaryDocuments").value="";renderAttachments();
  get("siteDiaryModalTitle").textContent=item?"Upraviť denný záznam":"Nový záznam prác";get("siteDiaryModalDate").textContent=dateLabel(date);editor.classList.remove("hidden")
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
   const date=get("siteDiaryEntryDate").value,supplier=selectedWorkCompany().id?selectedWorkCompany():betpresCompany(),companyId=supplier.id,companyLabel=supplier.name,work=get("siteDiaryWork").value.trim();
  if(!date||!companyId||!companyLabel||!work){form.reportValidity();return}
  const oldId=get("siteDiaryId").value,existing=oldId?rows().find(item=>item.id===oldId):null,duplicate=recordFor(date,companyId);
  if(duplicate&&duplicate.id!==oldId){alertUser("Táto firma už má v daný deň zápis. Otvor ho cez Upraviť záznam.");return}
  const id=existing?.id||makeId("site-day"),stored=[];busy=true;form.querySelector('[type="submit"]').disabled=true;
  try{
   for(const pending of newFiles){await siteDeskPutAttachment(`${id}:${pending.id}`,pending.file);stored.push({id:pending.id,name:pending.file.name,type:"application/pdf",size:pending.file.size,path:""})}
   const now=new Date().toISOString(),manualWorkers=get("siteDiaryWorkers").dataset.userEdited==="1",sheetWorkers=workerCountFor(date,companyId,companyLabel),record={...existing,id,kind:"siteLog",projectId:state.selectedProjectId,date,companyId,companyName:companyLabel,workersCount:manualWorkers||!sheetWorkers?Math.max(0,Math.min(999,Number(get("siteDiaryWorkers").value)||0)):sheetWorkers.count,workersManual:manualWorkers,profession:get("siteDiaryProfession").value.trim(),place:"",work,
    photos:photos.slice(),attachments:[...documents,...stored],author:existing?.author||cloudConfig?.displayName||"BETPRES",createdAt:existing?.createdAt||now,updatedAt:now};
   if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
   if(existing)state.mobileDiary[state.mobileDiary.indexOf(existing)]=record;else state.mobileDiary.push(record);
   day=date;get("siteDiaryDate").value=date;editor.classList.add("hidden");save(existing?"Denný záznam bol upravený.":"Denný záznam firmy bol uložený.");window.queueDiaryReviewPublish?.(date);render()
  }catch(error){alert(`Záznam sa nepodarilo uložiť: ${error.message||error}`)}finally{busy=false;form.querySelector('[type="submit"]').disabled=false}
 }
 function prepareMachineForm(item=null){
  const select=get("siteDiaryMachineCompany"),available=choices(),betpres=betpresCompany();
  if(!available.some(company=>norm(company.name).startsWith("betpres")))available.unshift({id:betpres.id,name:betpres.name});
  const past=(state.siteDiaryMachinery||[]).filter(row=>row.projectId===state.selectedProjectId).map(row=>({id:row.companyId,name:row.companyName}));
  for(const company of past)if(company.name&&!available.some(option=>option.id===company.id||norm(option.name)===norm(company.name)))available.push(company);
  select.innerHTML='<option value="">Vyber dodávateľa</option>'+available.map(company=>`<option value="${escape(company.id)}">${escape(company.name)}</option>`).join("")+`<option value="${customCompanyOption}">+ Napísať iného dodávateľa</option>`;
  get("siteDiaryMachineNames").innerHTML=[...new Set((state.machinePassport||[]).filter(row=>row.projectId===state.selectedProjectId).map(row=>row.machineName).filter(Boolean))].map(name=>`<option value="${escape(name)}"></option>`).join("");
  get("siteDiaryMachineId").value=item?.id||"";get("siteDiaryMachineName").value=item?.name||"";select.value=item?.companyId||"";get("siteDiaryMachineCustomCompany").value="";toggleCustomSupplier("siteDiaryMachineCompany","siteDiaryMachineCustomCompanyWrap","siteDiaryMachineCustomCompany");get("siteDiaryMachineCount").value=item?.count||1
 }
 function openMachineEditor(item=null){
  prepareMachineForm(item);
  get("siteDiaryMachineModalTitle").textContent=item?"Upraviť mechanizmus":"Nový mechanizmus";
  get("siteDiaryMachineModalDate").textContent=dateLabel(day);
  get("siteDiaryMachineModal").classList.remove("hidden")
 }
 function saveMachine(event){
  event.preventDefault();const name=get("siteDiaryMachineName").value.trim(),supplier=selectedSupplier("siteDiaryMachineCompany","siteDiaryMachineCustomCompany"),companyId=supplier.id,companyName=supplier.name,count=Math.min(999,Math.max(1,Math.trunc(Number(get("siteDiaryMachineCount").value)||1)));
  if(!name||!companyId||!companyName){get("siteDiaryMachineForm").reportValidity();return}
  const id=get("siteDiaryMachineId").value,existing=(state.siteDiaryMachinery||[]).find(item=>item.id===id),now=new Date().toISOString();
  const duplicate=machinesForDay(day).find(item=>item.id!==id&&norm(item.name)===norm(name)&&item.companyId===companyId);
  if(duplicate){alertUser("Tento mechanizmus už má v daný deň záznam. Uprav existujúci riadok.");return}
  const item={...existing,id:existing?.id||makeId("site-machine"),projectId:state.selectedProjectId,date:day,name,companyId,companyName,count,createdAt:existing?.createdAt||now,updatedAt:now};
  if(!Array.isArray(state.siteDiaryMachinery))state.siteDiaryMachinery=[];
  if(existing)state.siteDiaryMachinery[state.siteDiaryMachinery.indexOf(existing)]=item;else state.siteDiaryMachinery.push(item);
  get("siteDiaryMachineModal").classList.add("hidden");
  save(existing?"Mechanizmus bol upravený.":"Mechanizmus bol uložený.");window.queueDiaryReviewPublish?.(day);prepareMachineForm();render()
 }
 function removeMachine(id){
  const item=machinesForDay(day).find(row=>row.id===id);if(!item)return;
  if(!confirm(`Odstrániť mechanizmus ${item.name} z ${dateLabel(day)}?`))return;
  state.siteDiaryMachinery=state.siteDiaryMachinery.filter(row=>row.id!==id);save("Mechanizmus bol odstránený.");window.queueDiaryReviewPublish?.(day);render()
 }
 function prepareInspectionForm(item=null){
  get("siteDiaryInspectionId").value=item?.id||"";get("siteDiaryInspectionRecipient").value=item?.recipient||"";get("siteDiaryInspectionPerson").value=item?.person||"";
  get("siteDiaryInspectionSubject").value=item?.subject||"";get("siteDiaryInspectionDue").value=item?.dueAt||"";get("siteDiaryInspectionStatus").value=item?.status||"open";get("siteDiaryInspectionNote").value=item?.note||"";
  get("siteDiaryInspectionEntry").querySelector("summary").textContent=item?"Upraviť výzvu":"+ Pridať výzvu na kontrolu"
 }
 function saveInspection(event){
  event.preventDefault();const recipient=get("siteDiaryInspectionRecipient").value,subject=get("siteDiaryInspectionSubject").value.trim();
  if(!recipient||!subject){get("siteDiaryInspectionForm").reportValidity();return}
  if(!Array.isArray(state.siteDiaryInspections))state.siteDiaryInspections=[];
  const id=get("siteDiaryInspectionId").value,existing=state.siteDiaryInspections.find(item=>item.id===id),now=new Date().toISOString();
  const item={...existing,id:existing?.id||makeId("site-inspection"),projectId:state.selectedProjectId,date:day,recipient,person:get("siteDiaryInspectionPerson").value.trim(),subject,dueAt:get("siteDiaryInspectionDue").value,status:get("siteDiaryInspectionStatus").value==="done"?"done":"open",note:get("siteDiaryInspectionNote").value.trim(),createdAt:existing?.createdAt||now,updatedAt:now};
  if(existing)state.siteDiaryInspections[state.siteDiaryInspections.indexOf(existing)]=item;else state.siteDiaryInspections.push(item);
  save(existing?"Výzva bola upravená.":"Výzva na kontrolu bola uložená.");window.queueDiaryReviewPublish?.(day);prepareInspectionForm();get("siteDiaryInspectionEntry").open=false;render()
 }
 function removeInspection(id){
  const item=inspectionsForDay(day).find(row=>row.id===id);if(!item)return;
  if(!confirm(`Odstrániť výzvu „${item.subject}“?`))return;
  state.siteDiaryInspections=state.siteDiaryInspections.filter(row=>row.id!==id);save("Výzva bola odstránená.");window.queueDiaryReviewPublish?.(day);render()
 }
 function render(){
  const filter=get("siteDiaryCompanyFilter"),previous=filter.value,exportSelect=get("siteDiaryExportCompanySelect"),previousExport=exportSelect.value;
  const roster=rosterForDay(day),allEntries=rows().filter(item=>item.date===day),options=[...new Map([...roster.map(item=>[item.id,{id:item.id,name:item.name}]),...rows().map(item=>[item.companyId,{id:item.companyId,name:companyName(item)}]),...machinesForDay(day).map(item=>[item.companyId,{id:item.companyId,name:item.companyName}])]).values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  filter.innerHTML='<option value="">Všetky práce</option>'+options.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");filter.value=options.some(item=>item.id===previous)?previous:"";
  const exportOptions=[...new Map(rows().map(item=>[item.companyId,{id:item.companyId,name:companyName(item)}])).values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  exportSelect.innerHTML='<option value="">Vyber firmu</option>'+exportOptions.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
  exportSelect.value=exportOptions.some(item=>item.id===previousExport)?previousExport:exportOptions.some(item=>item.id===filter.value)?filter.value:"";
  const entries=allEntries.filter(item=>!filter.value||item.companyId===filter.value).sort((a,b)=>companyName(a).localeCompare(companyName(b),"sk"));
  if(weatherFormDay!==day||!weatherDirty){setWeather(weatherForDate(day));weatherFormDay=day;weatherDirty=false}
  const weather=weatherForDate(day),weatherRange=weather?.min!==""&&weather?.min!=null&&weather?.max!==""&&weather?.max!=null?` · ${roundedTemp(weather.min)} až ${roundedTemp(weather.max)} °C`:"";
  get("siteDiaryWeatherSummary").textContent=weather?.text?`${weather.text}${weatherRange}`:"Počasie pre tento deň ešte nie je vyplnené.";
  get("siteDiaryLoadWeather").textContent=day<todayISO()?"Načítať merania SHMÚ":"Načítať predpoveď SHMÚ";
  const crew=crewForDay(day).filter(item=>!filter.value||item.companyId===filter.value),machines=machinesForDay(day).filter(item=>!filter.value||item.companyId===filter.value);
  const people=crew.reduce((sum,item)=>sum+item.count,0),machineCount=machines.reduce((sum,item)=>sum+Math.max(0,Number(item.count)||0),0);
  get("siteDiaryCrewTotal").textContent=`${people} ${people===1?"osoba":people<5?"osoby":"osôb"}`;
  const crewSnapshot=savedCrewForDay(day);
  get("siteDiarySaveCrew").textContent=crewSnapshot?"Aktualizovať zo stavu pracovníkov":"Načítať pracovníkov zo stavu";
  get("siteDiaryCrewSource").textContent=crewSnapshot?"Počty sú uložené v denníku pre tento deň.":"Zobrazené počty sú zatiaľ náhľad zo stavu pracovníkov.";
  get("siteDiaryMachineTotal").textContent=`${machineCount} ${machineCount===1?"stroj":machineCount<5?"stroje":"strojov"}`;
  get("siteDiaryCrewRows").innerHTML=crew.map(item=>`<div class="site-diary-data-row" role="row"><span class="site-diary-data-primary" role="cell">${escape(item.profession)}</span><span role="cell">${escape(item.companyName)}</span><strong role="cell">${item.count}</strong></div>`).join("")||'<p class="site-diary-data-empty">V tento deň ešte nie sú evidovaní pracovníci.</p>';
  get("siteDiaryMachineRows").innerHTML=machines.map(item=>`<div class="site-diary-data-row" role="row"><span class="site-diary-data-primary" role="cell">${escape(item.name)}</span><span role="cell">${escape(item.companyName)}</span><strong role="cell">${Math.max(0,Number(item.count)||0)}</strong><span class="site-diary-machine-tools" role="cell"><button type="button" class="ghost" data-site-diary-machine-edit="${escape(item.id)}" aria-label="Upraviť ${escape(item.name)}">Upraviť</button><button type="button" class="ghost" data-site-diary-machine-remove="${escape(item.id)}" aria-label="Odstrániť ${escape(item.name)}">×</button></span></div>`).join("")||'<p class="site-diary-data-empty">Mechanizmy zatiaľ nie sú zapísané.</p>';
  get("siteDiaryDate").value=day;get("siteDiaryDaySummary").textContent=`${entries.length} ${entries.length===1?"záznam":entries.length<5?"záznamy":"záznamov"}`;
  get("siteDiaryExportCompany").disabled=!exportOptions.length;
  get("siteDiaryDayList").innerHTML=entries.map(item=>`<article class="site-diary-card"><p class="site-diary-card-work">${escape(workDescription(item))}</p><div class="site-diary-card-meta"><span>${displayedWorkers(item)} pracovníkov</span></div><div class="site-diary-card-foot"><button type="button" class="ghost site-diary-edit" data-site-diary-edit="${escape(item.id)}">Upraviť</button></div></article>`).join("")||'<div class="site-diary-empty"><strong>Zatiaľ tu nie je opis prác</strong><span>Pridaj, čo sa v tento deň robilo. Počet pracovníkov sa doplní zo Stavu pracovníkov.</span></div>'
  const inspections=inspectionsForDay(day);get("siteDiaryInspectionTotal").textContent=`${inspections.length} ${inspections.length===1?"výzva":inspections.length<5?"výzvy":"výziev"}`;
  get("siteDiaryInspectionRows").innerHTML=inspections.map(item=>`<article class="site-diary-inspection-row"><div class="site-diary-inspection-main"><strong>${escape(item.subject)}</strong><span>${escape(item.recipient)}${item.person?` · ${escape(item.person)}`:""}${item.dueAt?` · ${escape(inspectionDueLabel(item.dueAt))}`:""}</span>${item.note?`<p>${escape(item.note)}</p>`:""}</div><span class="site-diary-inspection-status${item.status==="done"?" is-done":""}">${item.status==="done"?"Vykonané":"Čaká"}</span><div class="site-diary-machine-tools"><button type="button" class="ghost" data-site-diary-inspection-edit="${escape(item.id)}">Upraviť</button><button type="button" class="ghost" data-site-diary-inspection-remove="${escape(item.id)}" aria-label="Odstrániť výzvu">×</button></div></article>`).join("")||'<p class="site-diary-data-empty">Na tento deň ešte nie je zapísaná žiadna kontrola ani výzva.</p>'
 }
 async function copyDay(sourceOverride=""){
  const source=sourceOverride||get("siteDiaryCopySource").value,target=day;
  if(!source){get("siteDiaryCopySource").showPicker?.();return}
  if(source===target){alertUser("Vyber iný zdrojový deň.");return}
  const sourceEntries=rows().filter(item=>item.date===source),sourceMachines=machinesForDay(source);
  if(!sourceEntries.length&&!sourceMachines.length){alertUser("V zdrojovom dni nie sú záznamy prác ani mechanizmov.");return}
  let copied=0,skipped=0,copiedMachines=0;
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
  if(!Array.isArray(state.siteDiaryMachinery))state.siteDiaryMachinery=[];
  for(const item of sourceMachines){
   if(machinesForDay(target).some(row=>row.companyId===item.companyId&&norm(row.name)===norm(item.name)))continue;
   const now=new Date().toISOString();state.siteDiaryMachinery.push({...item,id:makeId("site-machine"),date:target,createdAt:now,updatedAt:now,copiedFrom:source});copiedMachines++
  }
  if(copied||copiedMachines){save(`Skopírované: ${copied} zápisov prác a ${copiedMachines} mechanizmov. Teraz ich môžeš upraviť.`);window.queueDiaryReviewPublish?.(target)}
  else alertUser("Všetky záznamy už sú v cieľovom dni.");
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
  const button=get("siteDiaryLoadWeather"),city=weatherCity(),date=day;
  if(!city){alertUser("Doplň mesto v nastavení stavby, aby sa dalo načítať počasie SHMÚ.");return}
  button.disabled=true;button.textContent="Načítavam…";
  try{
   let stations=[];
   try{const response=await fetch(`https://shmu.bmikuska.com/api/v1/stations?q=${encodeURIComponent(city)}&page_size=20`,{cache:"no-store"});if(response.ok)stations=(await response.json()).stations||[]}catch{}
   const station=stations.find(item=>norm(item.name)===norm(city))||stations.find(item=>norm(item.name).startsWith(norm(city)))||stations[0];
   if(date<todayISO()){
    let archive=null;
    for(const url of [
     `https://raw.githubusercontent.com/d668kmshfv-sudo/betpres-sitedesk-mobile/main/ipad/assets/data/shmu-history.json?date=${date}&t=${Math.floor(Date.now()/300000)}`,
     "assets/data/shmu-history.json?v=5.8.0"
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
 async function printReport(mode,entries,title,fileName,selectedCompanyId=""){
  if(!entries.length&&mode!=="day"){alertUser("Nie sú záznamy na export.");return}
  if(typeof window.siteDiaryPrint!=="function"){alertUser("Export sa nepodarilo načítať. Obnov stránku.");return}
  try{
   const reportEntries=entries.length?entries:[{date:day,work:"Práce zatiaľ nezapísané.",photos:[],attachments:[]}];
   const normalized=await Promise.all(reportEntries.map(async item=>({
    id:item.id,date:item.date,companyName:companyName(item),workersCount:displayedWorkers(item),work:workDescription(item)||"Práce zatiaľ nezapísané.",
    attachments:(item.attachments||[]).map(attachment=>({id:attachment.id,name:attachment.name,type:attachment.type,path:attachment.path,size:attachment.size,sourceKey:`${item.id}:${attachment.id}`})),
    photos:(await Promise.all((item.photos||[]).map(async photo=>{try{return photo.dataUrl||photo.path&&await cloudPhotoObjectUrl(photo.path)||""}catch{return""}}))).filter(Boolean)
   })));
   const dates=[...new Set(normalized.map(item=>item.date))],weatherByDate=Object.fromEntries(dates.map(date=>[date,weatherForDate(date)]));
   const crewByDate=Object.fromEntries(dates.map(date=>[date,crewForDay(date).filter(item=>!selectedCompanyId||item.companyId===selectedCompanyId)]));
   const machineryByDate=Object.fromEntries(dates.map(date=>[date,machinesForDay(date).filter(item=>!selectedCompanyId||item.companyId===selectedCompanyId).map(item=>({name:item.name,companyName:item.companyName,count:item.count}))]));
   const inspectionsByDate=Object.fromEntries(dates.map(date=>[date,inspectionsForDay(date).map(item=>({recipient:[item.recipient,item.person].filter(Boolean).join(" · "),subject:item.subject,dueDate:item.dueAt,note:item.note,status:item.status}))]));
   const dayFilesByDate=Object.fromEntries(await Promise.all(dates.map(async date=>{
    const record=(state.siteDiaryDayAttachments||[]).find(item=>item.projectId===state.selectedProjectId&&item.date===date);
    const photos=mode==="day"||mode==="range"?await Promise.all((record?.photos||[]).map(async photo=>{try{return photo.dataUrl||photo.path&&await cloudPhotoObjectUrl(photo.path)||""}catch{return""}})):[];
    return[date,{attachments:(record?.attachments||[]).map(item=>({id:item.id,name:item.name,type:item.type,path:item.path,size:item.size,sourceKey:`${record.id}:${item.id}`})),photos:photos.filter(Boolean)}]
   })));
   await window.siteDiaryPrint({mode,entries:normalized,weatherByDate,crewByDate,machineryByDate,inspectionsByDate,dayFilesByDate,projectName:siteProject()?.name||"BETPRES",projectLocation:siteProject()?.address||siteProject()?.city||"",title,fileName,letterheadImage:LETTERHEAD_IMAGE})
  }catch(error){alertUser(`Export sa nepodaril: ${error.message||error}`)}
 }
 function dayReportEntries(){return rangeReportEntries(day,day).sort((a,b)=>companyName(a).localeCompare(companyName(b),"sk"))}
 function rangeReportEntries(from,to){
  const byDate=new Map();
  for(const item of rows())if(item.date>=from&&item.date<=to){if(!byDate.has(item.date))byDate.set(item.date,[]);byDate.get(item.date).push(item)}
  const result=[];
  for(let date=from;date<=to;){
   const records=byDate.get(date)||[];
   result.push(...(records.length?records:[{date,companyName:"BETPRES s.r.o.",workersCount:0,work:"Práce zatiaľ nezapísané.",photos:[],attachments:[]}]));
   const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10)
  }
  return result
 }
 get("siteDiaryDate").value=day;get("siteDiaryCopySource").value=precedingDate(day);get("siteDiaryExportFrom").value=day;get("siteDiaryExportTo").value=day;prepareMachineForm();prepareInspectionForm();
 get("siteDiaryPrev").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()-1);day=dateKey(date);get("siteDiaryCopySource").value=precedingDate(day);render()};
 get("siteDiaryNext").onclick=()=>{const date=new Date(`${day}T12:00:00`);date.setDate(date.getDate()+1);day=dateKey(date);get("siteDiaryCopySource").value=precedingDate(day);render()};
 get("siteDiaryDate").onchange=event=>{day=event.target.value||todayISO();get("siteDiaryCopySource").value=precedingDate(day);render()};
 get("siteDiarySaveCrew").onclick=saveCrewFromState;
 get("siteDiaryCompanyFilter").onchange=()=>{if(get("siteDiaryCompanyFilter").value)get("siteDiaryExportCompanySelect").value=get("siteDiaryCompanyFilter").value;render()};
 get("siteDiaryAddInline").onclick=()=>openEditor("",get("siteDiaryCompanyFilter").value);
 get("siteDiaryCopyPrevious").onclick=()=>{const source=precedingDate(day);get("siteDiaryCopySource").value=source;void copyDay(source)};
 get("siteDiaryCopy").onclick=()=>void copyDay();get("siteDiaryLoadWeather").onclick=()=>void loadWeather();get("siteDiaryWeatherSave").onclick=()=>saveWeather();form.onsubmit=event=>void saveEntry(event);
 for(const id of ["siteDiaryWeatherText","siteDiaryTempMin","siteDiaryTempMax"])get(id).addEventListener("input",()=>{weatherDirty=true;weatherMeta={source:"Ručný údaj",station:"",retrievedAt:""};get("siteDiaryWeatherSource").textContent="Ručný údaj · ulož počasie pre vybraný deň."});
 get("siteDiaryWorkers").oninput=()=>{get("siteDiaryWorkers").dataset.userEdited="1"};
 const updateWorkSupplierWorkers=()=>{const supplier=selectedWorkCompany();get("siteDiaryWorkers").value=workersAt(get("siteDiaryEntryDate").value,supplier.id,supplier.name);get("siteDiaryWorkers").dataset.userEdited="0"};
 get("siteDiaryUseWorkers").onclick=updateWorkSupplierWorkers;
 get("siteDiaryEntryCompany").onchange=()=>{toggleCustomSupplier("siteDiaryEntryCompany","siteDiaryCustomCompanyWrap","siteDiaryCustomCompany",true);updateWorkSupplierWorkers()};
 get("siteDiaryCustomCompany").oninput=()=>{if(get("siteDiaryWorkers").dataset.userEdited!=="1")updateWorkSupplierWorkers()};
 get("siteDiaryMachineCompany").onchange=()=>toggleCustomSupplier("siteDiaryMachineCompany","siteDiaryMachineCustomCompanyWrap","siteDiaryMachineCustomCompany",true);
 get("siteDiaryAddMachine").onclick=()=>openMachineEditor();
 get("siteDiaryMachineModal").addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();get("siteDiaryMachineModal").classList.add("hidden")}});
 get("siteDiaryMachineForm").onsubmit=saveMachine;
 get("siteDiaryMachineRows").onclick=event=>{const button=event.target.closest("button");if(!button)return;
  if(button.dataset.siteDiaryMachineEdit){const item=machinesForDay(day).find(row=>row.id===button.dataset.siteDiaryMachineEdit);if(item)openMachineEditor(item)}
  if(button.dataset.siteDiaryMachineRemove)removeMachine(button.dataset.siteDiaryMachineRemove)
 };
 get("siteDiaryInspectionForm").onsubmit=saveInspection;
 get("siteDiaryInspectionCancel").onclick=()=>{prepareInspectionForm();get("siteDiaryInspectionEntry").open=false};
 get("siteDiaryInspectionEntry").querySelector("summary").onclick=()=>{if(!get("siteDiaryInspectionEntry").open)prepareInspectionForm()};
 get("siteDiaryInspectionRows").onclick=event=>{const button=event.target.closest("button");if(!button)return;
  if(button.dataset.siteDiaryInspectionEdit){const item=inspectionsForDay(day).find(row=>row.id===button.dataset.siteDiaryInspectionEdit);if(item){prepareInspectionForm(item);get("siteDiaryInspectionEntry").open=true;get("siteDiaryInspectionSubject").focus()}}
  if(button.dataset.siteDiaryInspectionRemove)removeInspection(button.dataset.siteDiaryInspectionRemove)
 };
 get("siteDiaryPhotos").onchange=async event=>{const files=[...(event.target.files||[])].slice(0,Math.max(0,6-photos.length));for(const file of files)try{photos.push(await compressPhoto(file))}catch(error){alertUser(error.message)}event.target.value="";renderAttachments()};
 get("siteDiaryDocuments").onchange=event=>{for(const file of event.target.files||[]){if(file.type!=="application/pdf"&&!file.name.toLowerCase().endsWith(".pdf")){alertUser("Vyber PDF dokument.");continue}newFiles.push({id:makeId("site-pdf"),file})}event.target.value="";renderAttachments()};
 get("siteDiaryAttachments").onclick=event=>{const button=event.target.closest("button");if(!button)return;if(button.dataset.siteDiaryRemovePhoto!==undefined)photos.splice(Number(button.dataset.siteDiaryRemovePhoto),1);else if(button.dataset.siteDiaryRemoveDocument)documents=documents.filter(item=>item.id!==button.dataset.siteDiaryRemoveDocument);else if(button.dataset.siteDiaryRemoveNew)newFiles=newFiles.filter(item=>item.id!==button.dataset.siteDiaryRemoveNew);else if(button.dataset.siteDiaryOpenDocument)void openDocument(button.dataset.siteDiaryOpenDocument);renderAttachments()};
 get("siteDiaryDayList").onclick=event=>{const button=event.target.closest("[data-site-diary-edit]");if(button)openEditor(button.dataset.siteDiaryEdit)};
 get("siteDiaryExportDay").onclick=()=>void printReport("day",dayReportEntries(),`Stavebný denník · ${dateLabel(day)}`,`stavebny-dennik-${day}.pdf`);
 get("siteDiaryExportRange").onclick=()=>{
  const from=get("siteDiaryExportFrom").value,to=get("siteDiaryExportTo").value;
  if(!from||!to){alertUser("Vyber začiatok a koniec obdobia.");return}
  if(from>to){alertUser("Dátum Od musí byť pred dátumom Do.");return}
  if((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000>365){alertUser("Naraz môžeš exportovať najviac 366 dní. Vyber kratšie obdobie.");return}
  const entries=rangeReportEntries(from,to);
  void printReport("range",entries,`Stavebný denník · ${dateLabel(from)} – ${dateLabel(to)}`,`stavebny-dennik-${from}-az-${to}.pdf`)
 };
 get("siteDiaryExportCompany").onclick=()=>{const select=get("siteDiaryExportCompanySelect"),id=select.value;if(!id){select.focus();select.showPicker?.();alertUser("Vyber firmu pre PDF export.");return}const entries=rows().filter(item=>item.companyId===id).sort((a,b)=>a.date.localeCompare(b.date));void printReport("company",entries,"Stavebný denník · prehľad prác",`stavebny-dennik-firma-${id.replace(/[^a-z0-9-]/gi,"-")}.pdf`,id)};
 window.siteDiaryReviewSnapshot=date=>({
  day:date,
  weather:weatherForDate(date)||{},
  works:rows().filter(item=>item.date===date).map(item=>({work:workDescription(item),workersCount:displayedWorkers(item)})),
  crew:crewForDay(date).map(item=>({profession:item.profession,companyName:item.companyName,count:Number(item.count)||0})),
  machines:machinesForDay(date).map(item=>({name:item.name,companyName:item.companyName,count:Number(item.count)||0}))
 });
 window.renderSiteDiary=render;window.__BETPRES_SITE_DIARY_READY__=true;render()
})();
