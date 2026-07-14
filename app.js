(() => {
 "use strict";

 const KEYS={
  config:"betpres-mobile-cloud-v1",
  session:"betpres-mobile-session-v1",
  snapshot:"betpres-mobile-snapshot-v1",
  queue:"betpres-mobile-queue-v1",
  appearance:"betpres-mobile-appearance-v1",
  project:"betpres-mobile-project-v1"
 };
 const ARRAYS=["projects","companies","assignments","purchases","defects","controlDays","calendarEvents","workerSheets","betpresTimesheets","thpTimesheets","mobileDiary"];
 const $=id=>document.getElementById(id);
 const q=(selector,root=document)=>root.querySelector(selector);
 const qa=(selector,root=document)=>[...root.querySelectorAll(selector)];
 const clone=value=>JSON.parse(JSON.stringify(value));
 const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
 const uid=prefix=>`${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
 const todayISO=()=>new Date().toLocaleDateString("sv-SE");
 const isoNow=()=>new Date().toISOString();
 const formatDate=value=>value?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)):"—";
 const formatDay=value=>value?new Intl.DateTimeFormat("sk-SK",{weekday:"short",day:"numeric",month:"short"}).format(new Date(`${value}T12:00:00`)):"—";
 const monthLabel=value=>new Intl.DateTimeFormat("sk-SK",{month:"long",year:"numeric"}).format(new Date(`${value}-01T12:00:00`));
 const company=id=>app.data.companies.find(item=>item.id===id);
 const companyAssignment=id=>app.data.assignments.find(item=>item.projectId===app.projectId&&item.companyId===id);
 const companyResponsible=id=>companyAssignment(id)?.contact||company(id)?.contact||"";
 const project=id=>app.data.projects.find(item=>item.id===id);
 const selectedProject=()=>project(app.projectId);
 const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};

 const app={
  route:"home",
  projectId:localStorage.getItem(KEYS.project)||"",
  calendarMonth:todayISO().slice(0,7),
  defectFilter:"open",
  workerMode:"companies",
  coordinationDate:"",
  materialSupplier:"",
  focusMode:false,
  ocrWorker:null,
  photoUrls:new Map(),
  syncRunning:false,
  config:Object.assign({url:"",key:"",workspaceName:"Medická – pilot",role:"none",version:0,workspaceId:""},read(KEYS.config,{})),
  session:read(KEYS.session,null),
  data:normalizeData(read(KEYS.snapshot,{})),
  queue:read(KEYS.queue,[]),
  appearance:Object.assign({theme:"system",fontScale:"1",contrast:45,compact:false},read(KEYS.appearance,{}))
 };

 function normalizeData(value){
  const data=value&&typeof value==="object"?value:{};
  ARRAYS.forEach(key=>{if(!Array.isArray(data[key]))data[key]=[]});
  return data
 }
 function saveConfig(){localStorage.setItem(KEYS.config,JSON.stringify(app.config))}
 function saveSession(){if(app.session)localStorage.setItem(KEYS.session,JSON.stringify(app.session));else localStorage.removeItem(KEYS.session)}
 function saveSnapshot(){localStorage.setItem(KEYS.snapshot,JSON.stringify(app.data))}
 function saveQueue(){localStorage.setItem(KEYS.queue,JSON.stringify(app.queue));updatePendingBadge()}
 function saveAppearance(){localStorage.setItem(KEYS.appearance,JSON.stringify(app.appearance))}

 function toast(message){
  const element=$("toast");element.textContent=message;element.hidden=false;
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.hidden=true,2600)
 }
 function setCloudMessage(message,type=""){
  const element=$("cloudMessage");element.textContent=message;element.className=`form-message ${type}`
 }
 function updatePendingBadge(){
  const badge=$("pendingBadge");badge.textContent=String(app.queue.length);badge.hidden=!app.queue.length
 }
 function connectionLabel(mode,text){
  const element=$("connectionState");element.className=`connection-state ${mode}`;element.innerHTML=`<i></i> ${esc(text)}`
 }

 function applyAppearance(){
  document.documentElement.dataset.theme=app.appearance.theme||"system";
  document.documentElement.style.setProperty("--font-scale",app.appearance.fontScale||"1");
  document.documentElement.classList.toggle("compact",Boolean(app.appearance.compact));
  document.documentElement.classList.toggle("high-contrast",Number(app.appearance.contrast)>=68);
  qa("[data-theme]",$("themeChoices")).forEach(button=>button.classList.toggle("active",button.dataset.theme===app.appearance.theme));
  if($("fontScale"))$("fontScale").value=app.appearance.fontScale;
  if($("contrastRange"))$("contrastRange").value=String(app.appearance.contrast);
  if($("compactToggle"))$("compactToggle").checked=Boolean(app.appearance.compact);
  const dark=app.appearance.theme==="dark"||(app.appearance.theme==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);
  q('meta[name="theme-color"]').content=dark?"#0c1724":"#f4f8fb"
 }

 function ensureProject(){
  if(!project(app.projectId))app.projectId=app.data.projects[0]?.id||"";
  if(app.projectId)localStorage.setItem(KEYS.project,app.projectId)
 }
 function renderProjectSelect(){
  ensureProject();
  const select=$("projectSelect");
  select.innerHTML=app.data.projects.length?app.data.projects.map(item=>`<option value="${esc(item.id)}" ${item.id===app.projectId?"selected":""}>${esc(item.name)}</option>`).join(""):`<option value="">Najprv pripoj SiteDesk Cloud</option>`;
  select.disabled=!app.data.projects.length
 }

 function route(name){
  if(!["workers","meetings"].includes(name)&&app.focusMode)setFocusMode(false);
  app.route=name;
  qa(".screen").forEach(screen=>screen.classList.toggle("active",screen.dataset.screen===name));
  qa(".tabbar [data-route]").forEach(button=>button.classList.toggle("active",button.dataset.route===name));
  window.scrollTo({top:0,behavior:"instant"});
  renderRoute();
 }
 function setFocusMode(force){
  app.focusMode=typeof force==="boolean"?force:!app.focusMode;
  document.documentElement.classList.toggle("focus-mode",app.focusMode);
  qa("[data-focus-toggle]").forEach(button=>{button.setAttribute("aria-pressed",String(app.focusMode));button.textContent=app.focusMode?"Ukončiť":"Sústrediť"})
 }
 function renderRoute(){
  renderProjectSelect();
  if(app.route==="home")renderHome();
  if(app.route==="materials")renderMaterials();
  if(app.route==="defects")renderDefects();
  if(app.route==="workers")renderWorkers();
  if(app.route==="meetings")renderCoordination();
  if(app.route==="calendar")renderCalendar();
  if(app.route==="diary")renderDiary();
  if(app.route==="settings")renderSettings()
 }

 function currentProjectItems(key){return (app.data[key]||[]).filter(item=>item.projectId===app.projectId)}
 function recordActivity(item,type,title,detail,date){return{item,type,title,detail,date:date||item.updatedAt||item.createdAt||item.date||""}}
 function recentActivities(){
  return [
   ...currentProjectItems("purchases").map(item=>recordActivity(item,"▤",item.material||"Dodací list",item.supplier||item.documentNo,item.createdAt||item.date)),
   ...currentProjectItems("defects").map(item=>recordActivity(item,"!",item.description||"Vada",item.location,item.updatedAt)),
   ...currentProjectItems("mobileDiary").map(item=>recordActivity(item,"✎",item.title||"Denný zápis",item.place,item.createdAt))
  ].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5)
 }
 function renderHome(){
  $("todayLabel").textContent=new Intl.DateTimeFormat("sk-SK",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
  const date=todayISO(),workers=workersForDate(date),openDefects=currentProjectItems("defects").filter(item=>!isDefectDone(item)),diary=currentProjectItems("mobileDiary").filter(item=>String(item.createdAt||"").slice(0,10)===date);
  $("metricWorkers").textContent=String(workers.reduce((sum,row)=>sum+Number(row.value||0),0));
  $("metricDefects").textContent=String(openDefects.length);$("metricDiary").textContent=String(diary.length);
  $("homeProjectBadge").textContent=selectedProject()?.name||"Bez stavby";
  const activities=recentActivities();
  $("recentActivity").innerHTML=activities.length?activities.map(item=>`<article class="list-item"><span class="item-icon">${item.type}</span><div class="item-main"><strong>${esc(item.title)}</strong><span>${esc(item.detail||"Bez ďalšieho popisu")}</span></div><div class="item-side"><small>${esc(String(item.date||"").slice(0,10)?formatDate(String(item.date).slice(0,10)):"")}</small></div></article>`).join(""):`<div class="empty-state">Po pripojení cloudu sa tu zobrazia posledné zmeny zo stavby.</div>`
 }

 function numberValue(value){
  const cleaned=String(value??"").replace(/[^\d,.-]/g,"").replace(/\.(?=\d{3}(?:\D|$))/g,"").replace(",",".");
  const number=Number(cleaned);return Number.isFinite(number)?number:0
 }
 function euro(value){return new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"}).format(value)}
 function renderMaterials(){
  const query=$("materialSearch").value.trim().toLowerCase();
  let items=currentProjectItems("purchases").filter(item=>!query||[item.material,item.supplier,item.documentNo,item.invoiceNo].some(value=>String(value||"").toLowerCase().includes(query)));
  if(app.materialSupplier)items=items.filter(item=>item.supplier===app.materialSupplier);
  items.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))||Number(b.sequence||0)-Number(a.sequence||0));
  const all=currentProjectItems("purchases"),unbilled=all.filter(item=>!String(item.invoiceNo||"").trim());
  $("materialUnbilled").textContent=euro(unbilled.reduce((sum,item)=>sum+numberValue(item.estimatedPrice),0));
  $("materialUnbilledCount").textContent=String(unbilled.length);
  const summary=$("materialFilterSummary");summary.hidden=!app.materialSupplier;summary.innerHTML=app.materialSupplier?`Dodávateľ: <b>${esc(app.materialSupplier)}</b> · <button type="button" data-action="clear-material-filter">zrušiť</button>`:"";
  const clearFilter=q('[data-action="clear-material-filter"]',summary);if(clearFilter)clearFilter.onclick=()=>{app.materialSupplier="";renderMaterials()};
  $("materialsList").innerHTML=items.length?items.map(item=>`<article class="list-item"><span class="item-icon">${esc(item.sequence||"▤")}</span><div class="item-main"><strong>${esc(item.material||"Materiál bez názvu")}</strong><span>${esc(item.supplier||"Dodávateľ neuvedený")} · ${esc(item.documentNo||"bez čísla dokladu")}</span></div><div class="item-side"><strong>${esc(item.estimatedPrice||"—")}</strong><small>${formatDate(item.date)}${item.invoiceNo?" · faktúra":" · neodfakt."}</small></div></article>`).join(""):`<div class="empty-state">Nenašiel sa žiadny dodací list. Stlač + a odfoť alebo zapíš prvý.</div>`
 }

 function isDefectDone(item){return /odstránen|uzavret|hotov|splnen/i.test(String(item.status||""))}
 function mobilePhotoImage(photo,className=""){
  const classes=className?` class="${className}"`:"";
  if(photo?.dataUrl)return`<img${classes} src="${photo.dataUrl}" alt="Fotografia vady">`;
  return`<img${classes} src="" data-cloud-photo="${esc(photo?.path||"")}" alt="Fotografia vady">`
 }
 async function hydrateMobileCloudPhotos(root=document){
  const images=qa("img[data-cloud-photo]",root);
  for(const image of images){
   const path=image.dataset.cloudPhoto;
   if(!path||image.dataset.loaded==="true")continue;
   try{
    await ensureSession();
    let url=app.photoUrls.get(path);
    if(!url){
     const encoded=path.split("/").map(encodeURIComponent).join("/"),response=await fetch(`${normalizeUrl(app.config.url)}/storage/v1/object/authenticated/sitedesk-files/${encoded}`,{headers:{apikey:app.config.key,Authorization:`Bearer ${app.session.access_token}`}});
     if(!response.ok)throw new Error(`HTTP ${response.status}`);
     url=URL.createObjectURL(await response.blob());app.photoUrls.set(path,url)
    }
    image.src=url;image.dataset.loaded="true"
   }catch{image.classList.add("photo-load-error")}
  }
 }
 function renderDefects(){
  const query=$("defectSearch").value.trim().toLowerCase();
  let items=currentProjectItems("defects").filter(item=>!query||[item.description,item.location,item.number,company(item.companyId)?.name].some(value=>String(value||"").toLowerCase().includes(query)));
  if(app.defectFilter==="open")items=items.filter(item=>!isDefectDone(item));
  if(app.defectFilter==="done")items=items.filter(isDefectDone);
  items.sort((a,b)=>String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999")));
  $("defectsList").innerHTML=items.length?items.map(item=>`<article class="list-item defect-mobile-card" data-defect-id="${esc(item.id)}"><span class="status-dot ${isDefectDone(item)?"done":""}"></span><div class="item-main"><strong class="${/vysok/i.test(item.severity||"")?"severity-high":""}">${esc(item.number?`${item.number} · `:"")}${esc(item.description||"Vada bez popisu")}</strong><span>${esc(item.location||"Miesto neuvedené")} · ${esc(company(item.companyId)?.name||"Bez firmy")}</span>${Array.isArray(item.photos)&&item.photos.length?`<div class="defect-mobile-photos">${item.photos.slice(0,2).map(photo=>mobilePhotoImage(photo,"defect-mobile-thumb")).join("")}${item.photos.length>2?`<b>+${item.photos.length-2}</b>`:""}</div><span>📷 ${item.photos.length} fotografií</span>`:""}</div><div class="item-side"><strong>${esc(item.status||"Otvorená")}</strong><small>termín ${formatDate(item.dueDate)}</small><button type="button" class="defect-edit-button" data-edit-defect="${esc(item.id)}">Upraviť</button></div></article>`).join(""):`<div class="empty-state">V tomto filtri nie sú žiadne vady ani nedorobky.</div>`;
  qa("[data-edit-defect]",$("defectsList")).forEach(button=>button.onclick=event=>{event.stopPropagation();openDefectForm(button.dataset.editDefect)});
  qa("[data-defect-id]",$("defectsList")).forEach(card=>{card.onclick=event=>{if(event.target.closest("button,a,input,select,textarea"))return;openDefectForm(card.dataset.defectId)}});
  requestAnimationFrame(()=>hydrateMobileCloudPhotos($("defectsList")))
 }

 function addDays(date,days){const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+days);return value.toLocaleDateString("sv-SE")}
 function nextTuesday(date=todayISO()){const value=new Date(`${date}T12:00:00`),offset=(9-value.getDay())%7||7;value.setDate(value.getDate()+offset);return value.toLocaleDateString("sv-SE")}
 function coordinationRecords(){return currentProjectItems("controlDays").filter(item=>item.kind!=="controlDay").sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")))}
 function coordinationRecord(date=app.coordinationDate){return coordinationRecords().find(item=>item.date===date)}
 function coordinationTaskDone(task){return String(task.status||"").trim()==="Splnené"}
 function coordinationCompanyName(task){return company(task.companyId)?.name||task.responsible||"Bez priradenej firmy"}
 function coordinationGroupKey(task){return task.companyId||`custom:${coordinationCompanyName(task)}`}
 function coordinationGroups(tasks){const groups=new Map();tasks.forEach(task=>{const key=coordinationGroupKey(task);if(!groups.has(key))groups.set(key,{key,name:coordinationCompanyName(task),tasks:[]});groups.get(key).tasks.push(task)});return[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"))}
 function coordinationPlainText(value){const node=document.createElement("div");node.innerHTML=String(value||"");return(node.textContent||"").replace(/\s+/g," ").trim()}
 function ensureCoordinationDate(){if(app.coordinationDate)return;const records=coordinationRecords();app.coordinationDate=records.at(-1)?.date||nextTuesday()}
 function createCoordinationRecord(date=app.coordinationDate){const existing=coordinationRecord(date);if(existing)return existing;const records=coordinationRecords(),previous=records.filter(item=>item.date<date).at(-1),maxNumber=Math.max(0,...records.map(item=>Number(String(item.number||"").match(/\d+/)?.[0]||0))),number=`KP č. ${maxNumber+1}`;const tasks=(previous?.tasks||[]).filter(task=>!coordinationTaskDone(task)).map(task=>{const id=uid("ktu");return{...clone(task),id,rootTaskId:task.rootTaskId||task.id||id,enteredDate:task.enteredDate||previous.date,enteredMeetingNumber:task.enteredMeetingNumber||previous.number||"",originDate:task.originDate||previous.date,originNumber:task.originNumber||previous.number||"",carried:true,carriedFromDate:previous.date,carriedFromMeetingNumber:previous.number||""}});const record={id:uid("kd"),projectId:app.projectId,date,kind:"coordination",number,time:"09:00",place:"Zariadenie staveniska",chairperson:selectedProject()?.manager||"",recorder:"Jakub Varga",nextDate:addDays(date,7),status:"Plánovaný",agenda:"1. Kontrola plnenia úloh z predchádzajúcej koordinačnej porady\n2. Aktuálny postup prác\n3. Koordinácia profesií a nadväznosti prác\n4. Kvalita, BOZP a poriadok na stavenisku\n5. Rôzne",generalNotes:"",tasks,dismissedTaskRoots:[],attendees:clone(previous?.attendees||[]),savedToDocuments:false,lastSavedAt:"",createdAt:isoNow(),updatedAt:isoNow()};upsertRecord("controlDays",record,"upsert-control-day");return record}
 function storeCoordination(record,message){record.updatedAt=isoNow();upsertRecord("controlDays",record,"upsert-control-day");renderCoordination();toast(message)}
 function renderCoordination(){ensureCoordinationDate();const record=coordinationRecord(),empty=$("coordinationEmpty"),workspace=$("coordinationWorkspace");$("coordinationDate").value=app.coordinationDate;if(!record){workspace.hidden=true;empty.hidden=false;empty.innerHTML=`Pre dátum <b>${esc(formatDate(app.coordinationDate))}</b> ešte nie je vytvorená porada.<br><button type="button" class="secondary-button coordination-create-button" data-create-coordination>Vytvoriť poradu a preniesť otvorené úlohy</button>`;q("[data-create-coordination]",empty).onclick=()=>{createCoordinationRecord();renderCoordination();toast("Koordinačná porada bola pripravená.")};return}empty.hidden=true;workspace.hidden=false;record.tasks=Array.isArray(record.tasks)?record.tasks:[];record.attendees=Array.isArray(record.attendees)?record.attendees:[];const groups=coordinationGroups(record.tasks),open=record.tasks.filter(task=>!coordinationTaskDone(task));$("coordinationTitle").textContent=`${record.number||"Koordinačná porada"} – ${selectedProject()?.name||""}`;$("coordinationMeta").textContent=`${formatDate(record.date)} o ${record.time||"—"} · ${record.place||"Miesto neuvedené"} · ${record.status||"Rozpracovaný"}`;$("coordinationOpenCount").textContent=String(open.length);$("coordinationCompanyCount").textContent=String(groups.length);$("coordinationAttendeeCount").textContent=String(record.attendees.length);$("coordinationAgenda").textContent=coordinationPlainText(record.agendaHtml||record.agenda)||"Bez programu";$("coordinationNotes").textContent=coordinationPlainText(record.generalNotesHtml||record.generalNotes)||"Bez poznámky";$("coordinationCompanyList").innerHTML=groups.length?groups.map(group=>`<article class="coordination-company-card" data-edit-coordination-company="${esc(group.key)}"><header><div><small>FIRMA</small><h3>${esc(group.name)}</h3></div><button type="button">Upraviť celú firmu</button></header><div class="coordination-task-list">${group.tasks.map((task,index)=>`<div class="coordination-task-mobile"><b>${index+1}</b><div><strong>${esc(task.text||"Úloha bez popisu")}</strong><span>${esc(task.responsible||group.name)} · termín ${task.deadline?formatDate(task.deadline):"neurčený"}</span>${task.note?`<small>${esc(task.note)}</small>`:""}</div><em class="coordination-status ${coordinationTaskDone(task)?"done":""}">${esc(task.status||"Bez vyjadrenia")}</em></div>`).join("")}</div></article>`).join(""):`<div class="empty-state">Zatiaľ nie sú pridané žiadne firmy ani úlohy.</div>`;qa("[data-edit-coordination-company]",$("coordinationCompanyList")).forEach(card=>card.onclick=event=>{if(event.target.closest("button")…11125 tokens truncated…g(text||"").split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean),
        label=/(dodaci\s*(?:list|doklad)|dod\.?\s*list|cislo\s*(?:dodacieho\s*listu|dokladu)|doklad\s*(?:c|cislo)|delivery\s*note|lieferschein|vydajka|vydajovy\s*doklad|expedicny\s*list)/;
  for(let index=0;index<lines.length;index++){
   if(!label.test(normalizeText(lines[index])))continue;
   const context=[lines[index],lines[index+1]||""],candidates=context.flatMap(ocrDocumentCandidates)
    .filter(value=>!/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(value));
   if(candidates.length)return candidates.sort((a,b)=>(/\d{4,}/.test(b)?1:0)-(/\d{4,}/.test(a)?1:0)||b.length-a.length)[0]
  }
  const scored=[];
  lines.forEach((line,index)=>{
   const normalized=normalizeText(line);
   if(/ico|ic dph|dic|faktur|objednav|iban|telefon|zakaznik|odberatel|prijemca|variabilny|strana/.test(normalized))return;
   ocrDocumentCandidates(line).forEach(value=>{
    const digits=value.replace(/\D/g,"");
    if(digits.length<5||(/^20\d{6}$/.test(digits)&&!/[A-Za-z]/.test(value)))return;
    scored.push({value,score:(digits.length>=7?4:0)+(index<18?2:0)+(/[A-Za-z]/.test(value)?1:0)-Math.max(0,value.length-20)})
   })
  });
  return scored.sort((a,b)=>b.score-a.score||b.value.length-a.value.length)[0]?.value||""
 }
 function ocrDate(text){const match=String(text||"").match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2}|\d{2})\b/);if(!match)return todayISO();const year=Number(match[3])+(match[3].length===2?2000:0);return String(year)+"-"+String(match[2]).padStart(2,"0")+"-"+String(match[1]).padStart(2,"0")}
 function ocrSupplier(text){
  const lines=String(text||"").split(/\r?\n/).map(value=>value.replace(/\s+/g," ").trim()).filter(Boolean),supplierLabel=/(dodavatel|predavajuci|odosielatel|vystavitel|supplier|vendor)/,
        known=[...new Set([...app.data.purchases.map(item=>item.supplier),...app.data.companies.map(item=>item.name)].map(value=>String(value||"").trim()).filter(Boolean))].sort((a,b)=>b.length-a.length),
        found=known.find(name=>lines.slice(0,35).some((line,index)=>normalizeText(line).includes(normalizeText(name))&&!/(odberatel|prijemca|miesto dodania)/.test(normalizeText(`${lines[index-1]||""} ${line}`))));
  if(found)return found;
  for(let index=0;index<lines.length;index++){
   const current=normalizeText(lines[index]);if(!supplierLabel.test(current))continue;
   const after=lines[index].replace(/^(?:dodávateľ|dodavatel|predávajúci|predavajuci|odosielateľ|odosielatel|vystaviteľ|vystavitel|supplier|vendor)\s*[:.-]?\s*/i,"").trim(),candidates=[after,lines[index+1],lines[index+2]].filter(Boolean);
   const explicit=candidates.find(value=>/[A-Za-zÁ-ž]{3}/.test(value)&&!/(odberateľ|odberatel|príjemca|prijemca|dodací list|dodaci list|číslo|cislo|dátum|datum|ulica|street)/i.test(value)&&value.length<=90);
   if(explicit)return explicit
  }
  const candidates=lines.slice(0,30).map((value,index)=>{
   const item=normalizeText(value);let score=0;
   if(/\b(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol|gmbh|se|k\.?\s*s\.?)\b/.test(item))score+=8;
   if(/ico|ic dph|dic/.test(normalizeText([lines[index+1],lines[index+2]].filter(Boolean).join(" "))))score+=3;
   if(index<12)score+=2;if(/odberatel|prijemca|miesto dodania|dodaci list|faktura|objednavka|datum|strana|telefon|email|www\./.test(item))score-=12;
   if(!/[A-Za-zÁ-ž]{3}/.test(value)||value.length>90)score-=10;
   return{value,score}
  });
  return candidates.sort((a,b)=>b.score-a.score)[0]?.score>0?candidates.sort((a,b)=>b.score-a.score)[0].value:""
 }
 function parseDeliveryOcr(text){return{date:ocrDate(text),supplier:ocrSupplier(text),documentNo:ocrDocument(text),material:ocrMaterial(text),estimatedPrice:ocrPrice(text)}}
 function formatEuro(value){const number=typeof value==="number"?value:Number(String(value??"").replace(/\s/g,"").replace("€","").replace(",","."));return Number.isFinite(number)&&number>0?number.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":""}
 async function analyzeDeliveryWithAI(photo,ocrText=""){
  if(!photo?.dataUrl)throw new Error("Chýba fotografia dodacieho listu.");
  const response=await cloud("/functions/v1/analyze-delivery-note",{method:"POST",body:JSON.stringify({imageDataUrl:photo.dataUrl,ocrText:String(ocrText||"").slice(0,12000),projectName:selectedProject()?.name||"",today:todayISO()})});
  if(!response||typeof response!=="object")throw new Error("AI nevrátila platné údaje.");return response
 }

 function normalizeUrl(value){return String(value||"").trim().replace(/\/+$/,"")}
 function authHeaders(json=true){const headers={apikey:app.config.key};if(app.session?.access_token)headers.Authorization=`Bearer ${app.session.access_token}`;if(json)headers["Content-Type"]="application/json";return headers}
 async function rawCloud(path,options={}){
  const response=await fetch(normalizeUrl(app.config.url)+path,{...options,headers:{...authHeaders(options.json!==false),...(options.headers||{})}});if(!response.ok){let message=`HTTP ${response.status}`;try{const data=await response.json();message=data.message||data.error_description||data.error||message}catch{}throw new Error(message)}if(response.status===204)return null;return (response.headers.get("content-type")||"").includes("application/json")?response.json():response
 }
 async function ensureSession(){
  if(!app.session?.access_token)throw new Error("Najprv sa prihlás.");
  if(Number(app.session.expires_at||0)-Date.now()/1000>90)return;
  if(!app.session.refresh_token)throw new Error("Prihlásenie vypršalo.");
  const response=await rawCloud("/auth/v1/token?grant_type=refresh_token",{method:"POST",body:JSON.stringify({refresh_token:app.session.refresh_token})});response.expires_at=Math.floor(Date.now()/1000)+Number(response.expires_in||3600);app.session=response;saveSession()
 }
 async function cloud(path,options={}){await ensureSession();return rawCloud(path,options)}
 async function signIn(email,password){
  if(!normalizeUrl(app.config.url)||!app.config.key)throw new Error("Doplň Project URL a publishable/anon key.");
  const response=await rawCloud("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});response.expires_at=Math.floor(Date.now()/1000)+Number(response.expires_in||3600);app.session=response;saveSession()
 }
 async function getWorkspace(){const rows=await cloud(`/rest/v1/sitedesk_workspaces?name=eq.${encodeURIComponent(app.config.workspaceName)}&select=*`,{method:"GET",headers:{Accept:"application/json"}});return Array.isArray(rows)?rows[0]:null}
 async function rpc(name,payload){return cloud(`/rest/v1/rpc/${name}`,{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)})}
 async function uploadPhoto(workspaceId,collection,recordId,photo){
  if(photo.path||!photo.dataUrl)return photo;
  const match=photo.dataUrl.match(/^data:([^;]+);base64,(.+)$/);if(!match)return photo;const bytes=Uint8Array.from(atob(match[2]),char=>char.charCodeAt(0)),path=`${workspaceId}/${collection}/${recordId}/${photo.id||uid("photo")}.jpg`,encoded=path.split("/").map(encodeURIComponent).join("/");
  const response=await fetch(`${normalizeUrl(app.config.url)}/storage/v1/object/sitedesk-files/${encoded}`,{method:"POST",headers:{apikey:app.config.key,Authorization:`Bearer ${app.session.access_token}`,"Content-Type":match[1],"x-upsert":"true"},body:new Blob([bytes],{type:match[1]})});if(!response.ok)throw new Error("Fotografiu sa nepodarilo odoslať.");return{...photo,path,dataUrl:undefined}
 }
 async function prepareUploads(data,workspaceId){
  for(const [collection,pathName] of [["defects","defects"],["mobileDiary","diary"],["purchases","materials"]])for(const record of data[collection]||[]){if(!Array.isArray(record.photos))continue;record.photos=await Promise.all(record.photos.map(photo=>uploadPhoto(workspaceId,pathName,record.id,photo)))}return data
 }
 async function sync({silent=false}={}){
  if(app.syncRunning)return;if(!navigator.onLine){connectionLabel("offline","Offline");if(!silent)toast("Zmeny ostali bezpečne uložené v mobile.");return}
  if(!app.session?.access_token){connectionLabel("offline",app.queue.length?`${app.queue.length} čaká`:"Nepripojené");if(!silent)route("settings");return}
  app.syncRunning=true;$("syncButton").classList.add("syncing");connectionLabel("syncing","Synchronizujem");
  try{
   await ensureSession();
   for(let attempt=0;attempt<2;attempt++){
    const remote=await getWorkspace();if(!remote?.data)throw new Error("Pracovný priestor neobsahuje údaje SiteDesk.");app.config.workspaceId=remote.id;
    const roleResult=await rpc("sitedesk_current_role",{p_workspace_id:remote.id}),role=Array.isArray(roleResult)?roleResult[0]:roleResult;app.config.role=role||"none";
    if(!app.queue.length){app.data=normalizeData(clone(remote.data));app.config.version=Number(remote.data_version||0);saveSnapshot();saveConfig();break}
    if(!["owner","editor"].includes(role))throw new Error("Tento účet má prístup iba na čítanie. Mobilné zmeny ostali v telefóne.");
    const merged=normalizeData(clone(remote.data));app.queue.forEach(operation=>applyOperation(merged,operation));await prepareUploads(merged,remote.id);
    const result=await rpc("sitedesk_save_workspace",{p_workspace_id:remote.id,p_expected_version:Number(remote.data_version||0),p_data:merged,p_device_id:"mobile-pwa",p_description:`Mobilná synchronizácia · ${app.queue.length} zmien`}),saved=Array.isArray(result)?result[0]:result;
    if(saved?.success){app.data=merged;app.queue=[];app.config.version=Number(saved.data_version||Number(remote.data_version)+1);saveSnapshot();saveQueue();saveConfig();break}
    if(attempt===1)throw new Error("Cloud sa medzitým zmenil. Skús synchronizáciu znova.")
   }
   connectionLabel("online",`Cloud v${app.config.version}`);renderProjectSelect();renderRoute();renderSettings();if(!silent)toast("SiteDesk je synchronizovaný.")
  }catch(error){connectionLabel("offline",app.queue.length?`${app.queue.length} čaká`:"Chyba cloudu");setCloudMessage(error.message,"error");if(!silent)toast(error.message)}finally{app.syncRunning=false;$("syncButton").classList.remove("syncing")}
 }
 function autoSync(){if(navigator.onLine&&app.session?.access_token)setTimeout(()=>sync({silent:true}),500)}

 function openQuickOpen(){
  const commands=[
   {icon:"⌂",title:"Prehľad",detail:"Dnešný stav a posledné zmeny",route:"home",keywords:"domov dashboard"},
   {icon:"▤",title:"Pasport materiálu",detail:"Dodacie listy a neodfakturovaný materiál",route:"materials",keywords:"sklad dodávateľ"},
   {icon:"!",title:"Vady a nedorobky",detail:"Fotografie, firmy a termíny",route:"defects",keywords:"kvalita chyba foto"},
   {icon:"♟",title:"Stav pracovníkov",detail:"Firmy, BETPRES a THP",route:"workers",keywords:"smenovka dochádzka"},
   {icon:"◫",title:"Koordinačné porady",detail:"Úlohy a hromadná úprava firmy",route:"meetings",keywords:"body zápis"},
   {icon:"▣",title:"Kalendár",detail:"Termíny a úlohy zo stavby",route:"calendar",keywords:"dátum"},
   {icon:"✎",title:"Denné zápisy",detail:"Poznámky, ktoré nechceš zabudnúť",route:"diary",keywords:"denník poznámka"},
   {icon:"⚙",title:"Nastavenia",detail:"Cloud, vzhľad a inštalácia",route:"settings",keywords:"supabase prihlásenie"},
   {icon:"＋",title:"Nový dodací list",detail:"Odfotiť alebo vybrať z galérie",action:"material",keywords:"pridať materiál"},
   {icon:"＋",title:"Nová vada",detail:"Zapísať vadu a pridať fotografie",action:"defect",keywords:"pridať nedorobok"},
   {icon:"＋",title:"Nový denný zápis",detail:"Rýchla poznámka zo stavby",action:"diary",keywords:"pridať denník"}
  ];
  showSheet({eyebrow:"RÝCHLE OTVORENIE",title:"Kam chceš ísť?",sheetClass:"command-palette-sheet",html:`<label class="command-search"><span>⌕</span><input id="commandSearchInput" type="search" placeholder="Napíš modul alebo činnosť" autocomplete="off"></label><span class="command-group-label">MODULY A RÝCHLE AKCIE</span><div id="commandList" class="command-list"></div>`,onReady:()=>{
   const input=$("commandSearchInput"),list=$("commandList");
   const render=()=>{const term=normalizeText(input.value),items=commands.filter(item=>!term||normalizeText(`${item.title} ${item.detail} ${item.keywords}`).includes(term));list.innerHTML=items.length?items.map(item=>`<button class="command-item" type="button" data-command-index="${commands.indexOf(item)}"><span>${esc(item.icon)}</span><div><b>${esc(item.title)}</b><small>${esc(item.detail)}</small></div><i>›</i></button>`).join(""):`<div class="command-empty">Nič také som nenašiel.</div>`;qa("[data-command-index]",list).forEach(button=>button.onclick=()=>{const item=commands[Number(button.dataset.commandIndex)];closeSheet();if(item.route)route(item.route);if(item.action==="material")openMaterialForm();if(item.action==="defect")openDefectForm();if(item.action==="diary")openDiaryForm()})};
   input.oninput=render;render();setTimeout(()=>input.focus(),60)
  }})
 }

 function openInstallHelp(){showSheet({eyebrow:"INŠTALÁCIA NA IPHONE A IPAD",title:"Pridať SiteDesk na plochu",html:`<div class="sheet-form"><p class="form-note"><b>1.</b> Túto stránku otvor v aplikácii Safari.</p><p class="form-note"><b>2.</b> Stlač ikonu Zdieľať (štvorec so šípkou nahor).</p><p class="form-note"><b>3.</b> Vyber „Pridať na plochu“ a potvrď „Pridať“.</p><p class="form-note"><b>4.</b> SiteDesk sa zobrazí medzi aplikáciami a na iPade sa automaticky otvorí v širokom tabletovom režime.</p><button class="primary-button full" id="closeInstallHelp" type="button">Rozumiem</button></div>`,onReady:()=>$("closeInstallHelp").onclick=closeSheet})}

 function wireEvents(){
  qa("[data-route]").forEach(button=>button.addEventListener("click",()=>route(button.dataset.route)));
  qa("[data-action]").forEach(button=>button.addEventListener("click",()=>({"add-material":openMaterialForm,"add-defect":openDefectForm,"add-diary":openDiaryForm,"add-event":openEventForm,"new-coordination":()=>{ensureCoordinationDate();createCoordinationRecord();renderCoordination();toast("Koordinačná porada bola pripravená.")},"material-filter":openMaterialFilter,"clear-material-filter":()=>{app.materialSupplier="";renderMaterials()}})[button.dataset.action]?.()));
  $("projectSelect").onchange=()=>{app.projectId=$("projectSelect").value;app.coordinationDate="";localStorage.setItem(KEYS.project,app.projectId);renderRoute()};
  $("materialSearch").oninput=renderMaterials;$("defectSearch").oninput=renderDefects;$("diarySearch").oninput=renderDiary;
  qa('[data-filter-group="defects"] button').forEach(button=>button.onclick=()=>{app.defectFilter=button.dataset.value;qa('[data-filter-group="defects"] button').forEach(item=>item.classList.toggle("active",item===button));renderDefects()});
  $("workerDate").onchange=renderWorkers;$("workerSaveButton").onclick=saveWorkers;qa("[data-worker-mode]",$("workerModeSwitch")).forEach(button=>button.onclick=()=>{app.workerMode=button.dataset.workerMode;renderWorkers()});$("coordinationDate").onchange=()=>{app.coordinationDate=$("coordinationDate").value;renderCoordination()};$("coordinationPrev").onclick=()=>{const records=coordinationRecords(),previous=records.filter(item=>item.date<app.coordinationDate).at(-1);app.coordinationDate=previous?.date||addDays(app.coordinationDate,-7);renderCoordination()};$("coordinationNext").onclick=()=>{const records=coordinationRecords(),next=records.find(item=>item.date>app.coordinationDate);app.coordinationDate=next?.date||addDays(app.coordinationDate,7);renderCoordination()};$("coordinationEditInfo").onclick=openCoordinationInfoForm;$("coordinationAddCompany").onclick=()=>openCoordinationCompanyForm();$("calendarPrev").onclick=()=>shiftCalendar(-1);$("calendarNext").onclick=()=>shiftCalendar(1);
  $("closeSheet").onclick=closeSheet;$("sheetBackdrop").onclick=closeSheet;$("syncButton").onclick=()=>sync();
  $("quickOpenButton").onclick=openQuickOpen;qa("[data-focus-toggle]").forEach(button=>button.onclick=()=>setFocusMode());
  qa("[data-theme]",$("themeChoices")).forEach(button=>button.onclick=()=>{app.appearance.theme=button.dataset.theme;saveAppearance();applyAppearance()});
  $("fontScale").onchange=()=>{app.appearance.fontScale=$("fontScale").value;saveAppearance();applyAppearance()};
  $("contrastRange").oninput=()=>{app.appearance.contrast=Number($("contrastRange").value);saveAppearance();applyAppearance()};
  $("compactToggle").onchange=()=>{app.appearance.compact=$("compactToggle").checked;saveAppearance();applyAppearance()};
  $("resetAppearance").onclick=()=>{app.appearance={theme:"system",fontScale:"1",contrast:45,compact:false};saveAppearance();applyAppearance();toast("BETPRES vzhľad bol obnovený.")};
  $("connectionForm").onsubmit=async event=>{event.preventDefault();app.config.url=normalizeUrl($("cloudUrl").value);app.config.key=$("cloudKey").value.trim();app.config.workspaceName=$("workspaceName").value.trim()||"Medická – pilot";saveConfig();setCloudMessage("Prihlasujem…");try{await signIn($("cloudEmail").value.trim(),$("cloudPassword").value);$("cloudPassword").value="";setCloudMessage("Prihlásenie bolo úspešné. Načítavam stavbu…","success");await sync();renderSettings()}catch(error){setCloudMessage(error.message,"error")}};
  $("connectionFile").onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.type!=="BETPRES_SITEDESK_CONNECTION"||!data.url||!data.publishableKey)throw new Error();app.config.url=normalizeUrl(data.url);app.config.key=String(data.publishableKey);app.config.workspaceName=data.workspaceName||"Medická – pilot";saveConfig();renderSettings();setCloudMessage("Pripojenie bolo načítané. Zadaj e-mail a heslo.","success")}catch{setCloudMessage("Súbor nie je platné pripojenie BETPRES SiteDesk.","error")}};
  $("signOutButton").onclick=()=>{app.session=null;app.config.role="none";saveSession();saveConfig();renderSettings();connectionLabel("offline",app.queue.length?`${app.queue.length} čaká`:"Offline");toast("Mobil bol odhlásený.")};
  $("installHelpButton").onclick=openInstallHelp;
  document.addEventListener("keydown",event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();openQuickOpen();return}if(event.key==="Escape"){if(!$("bottomSheet").hidden)closeSheet();else if(app.focusMode)setFocusMode(false)}});
  addEventListener("online",()=>sync({silent:true}));addEventListener("offline",()=>connectionLabel("offline","Offline"));
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",applyAppearance)
 }

 async function registerServiceWorker(){
  if(!("serviceWorker" in navigator))return;
  try{
   const registration=await navigator.serviceWorker.register("sw.js",{updateViaCache:"none"});
   const activate=worker=>worker?.postMessage({type:"SKIP_WAITING"});
   if(registration.waiting)activate(registration.waiting);
   registration.addEventListener("updatefound",()=>{
    const worker=registration.installing;
    worker?.addEventListener("statechange",()=>{
     if(worker.state==="installed"&&navigator.serviceWorker.controller)activate(worker)
    })
   });
   await registration.update()
  }catch(error){console.warn("Service worker",error)}
 }

 async function init(){
  applyAppearance();wireEvents();ensureProject();$("workerDate").value=todayISO();renderProjectSelect();renderSettings();const requested=new URLSearchParams(location.search).get("open");route(["home","materials","defects","workers","meetings","calendar","diary","settings"].includes(requested)?requested:"home");updatePendingBadge();
  registerServiceWorker();
  if(navigator.onLine&&app.session?.access_token)sync({silent:true});else connectionLabel("offline",app.queue.length?`${app.queue.length} čaká`:"Offline")
 }
 document.addEventListener("DOMContentLoaded",init)
})();
