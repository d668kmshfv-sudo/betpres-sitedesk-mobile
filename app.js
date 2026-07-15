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
  config:Object.assign({url:"",key:"",workspaceName:"Medická – pilot",role:"none",version:0,workspaceId:"",email:""},read(KEYS.config,{})),
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

 function decodePairingPayload(value){
  const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
  const padded=normalized+"=".repeat((4-normalized.length%4)%4),binary=atob(padded),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes))
 }
 function applyPairingFromUrl(){
  const current=new URL(location.href),encoded=current.searchParams.get("pair");
  if(!encoded)return{paired:false};
  try{
   const data=decodePairingPayload(encoded),url=normalizeUrl(data.url),parsed=new URL(url);
   if(data.type!=="BETPRES_SITEDESK_PAIRING"||data.version!==1||parsed.protocol!=="https:"||!data.publishableKey)throw new Error("Neplatný párovací kód.");
   const email=String(data.email||"").trim(),connectionChanged=Boolean(app.config.url&&(normalizeUrl(app.config.url)!==url||app.config.key!==String(data.publishableKey)));
   if(connectionChanged||(app.session?.user?.email&&email&&app.session.user.email.toLowerCase()!==email.toLowerCase())){app.session=null;saveSession()}
   app.config.url=url;
   app.config.key=String(data.publishableKey);
   app.config.workspaceName=String(data.workspaceName||"Medická – pilot");
   app.config.email=email;
   app.config.pairedAt=isoNow();
   saveConfig();
   current.searchParams.delete("pair");
   history.replaceState({},"",`${current.pathname}${current.search}${current.hash}`);
   return{paired:true,email}
  }catch(error){
   current.searchParams.delete("pair");
   history.replaceState({},"",`${current.pathname}${current.search}${current.hash}`);
   return{paired:false,error:error.message||"Párovanie sa nepodarilo."}
  }
 }

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
 function renderCoordination(){ensureCoordinationDate();const record=coordinationRecord(),empty=$("coordinationEmpty"),workspace=$("coordinationWorkspace");$("coordinationDate").value=app.coordinationDate;if(!record){workspace.hidden=true;empty.hidden=false;empty.innerHTML=`Pre dátum <b>${esc(formatDate(app.coordinationDate))}</b> ešte nie je vytvorená porada.<br><button type="button" class="secondary-button coordination-create-button" data-create-coordination>Vytvoriť poradu a preniesť otvorené úlohy</button>`;q("[data-create-coordination]",empty).onclick=()=>{createCoordinationRecord();renderCoordination();toast("Koordinačná porada bola pripravená.")};return}empty.hidden=true;workspace.hidden=false;record.tasks=Array.isArray(record.tasks)?record.tasks:[];record.attendees=Array.isArray(record.attendees)?record.attendees:[];const groups=coordinationGroups(record.tasks),open=record.tasks.filter(task=>!coordinationTaskDone(task));$("coordinationTitle").textContent=`${record.number||"Koordinačná porada"} – ${selectedProject()?.name||""}`;$("coordinationMeta").textContent=`${formatDate(record.date)} o ${record.time||"—"} · ${record.place||"Miesto neuvedené"} · ${record.status||"Rozpracovaný"}`;$("coordinationOpenCount").textContent=String(open.length);$("coordinationCompanyCount").textContent=String(groups.length);$("coordinationAttendeeCount").textContent=String(record.attendees.length);$("coordinationAgenda").textContent=coordinationPlainText(record.agendaHtml||record.agenda)||"Bez programu";$("coordinationNotes").textContent=coordinationPlainText(record.generalNotesHtml||record.generalNotes)||"Bez poznámky";$("coordinationCompanyList").innerHTML=groups.length?groups.map(group=>`<article class="coordination-company-card" data-edit-coordination-company="${esc(group.key)}"><header><div><small>FIRMA</small><h3>${esc(group.name)}</h3></div><button type="button">Upraviť celú firmu</button></header><div class="coordination-task-list">${group.tasks.map((task,index)=>`<div class="coordination-task-mobile"><b>${index+1}</b><div><strong>${esc(task.text||"Úloha bez popisu")}</strong><span>${esc(task.responsible||group.name)} · termín ${task.deadline?formatDate(task.deadline):"neurčený"}</span>${task.note?`<small>${esc(task.note)}</small>`:""}</div><em class="coordination-status ${coordinationTaskDone(task)?"done":""}">${esc(task.status||"Bez vyjadrenia")}</em></div>`).join("")}</div></article>`).join(""):`<div class="empty-state">Zatiaľ nie sú pridané žiadne firmy ani úlohy.</div>`;qa("[data-edit-coordination-company]",$("coordinationCompanyList")).forEach(card=>card.onclick=event=>{if(event.target.closest("button")||event.currentTarget===card)openCoordinationCompanyForm(card.dataset.editCoordinationCompany)})}
 function openCoordinationInfoForm(){const record=coordinationRecord();if(!record)return;const attendees=(record.attendees||[]).map(item=>[item.name,item.customCompany||company(item.companyId)?.name||"",item.role,item.contact].filter(Boolean).join(" | ")).join("\n");showSheet({eyebrow:"KOORDINAČNÁ PORADA",title:"Upraviť údaje porady",html:`<form id="coordinationInfoForm" class="sheet-form"><div class="form-split"><label>Číslo porady<input id="coordinationNumberInput" required value="${esc(record.number||"")}"></label><label>Dátum<input id="coordinationDateInput" type="date" required value="${esc(record.date||"")}"></label></div><div class="form-split"><label>Čas<input id="coordinationTimeInput" type="time" value="${esc(record.time||"")}"></label><label>Miesto<input id="coordinationPlaceInput" value="${esc(record.place||"")}"></label></div><div class="form-split"><label>Poradu viedol<input id="coordinationChairInput" value="${esc(record.chairperson||"")}"></label><label>Zápis vyhotovil<input id="coordinationRecorderInput" value="${esc(record.recorder||"")}"></label></div><div class="form-split"><label>Nasledujúca porada<input id="coordinationNextDateInput" type="date" value="${esc(record.nextDate||"")}"></label><label>Stav<select id="coordinationMeetingStatus"><option ${record.status==="Plánovaný"?"selected":""}>Plánovaný</option><option ${record.status==="Rozpracovaný"?"selected":""}>Rozpracovaný</option><option ${record.status==="Uzavretý"?"selected":""}>Uzavretý</option></select></label></div><label>Program<textarea id="coordinationAgendaInput">${esc(coordinationPlainText(record.agendaHtml||record.agenda))}</textarea></label><label>Všeobecná poznámka<textarea id="coordinationNotesInput">${esc(coordinationPlainText(record.generalNotesHtml||record.generalNotes))}</textarea></label><label>Účastníci – jeden na riadok<textarea id="coordinationAttendeesInput" placeholder="Meno | Firma | Funkcia | Kontakt">${esc(attendees)}</textarea></label><p class="form-note">Formát účastníka: Meno | Firma | Funkcia | Kontakt</p><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">Uložiť údaje</button></div></form>`,onReady:()=>{q(".cancel",$("coordinationInfoForm")).onclick=closeSheet;$("coordinationInfoForm").onsubmit=event=>{event.preventDefault();const date=$("coordinationDateInput").value;if(coordinationRecords().some(item=>item.date===date&&item.id!==record.id)){toast("Pre tento dátum už porada existuje.");return}record.number=$("coordinationNumberInput").value.trim();record.date=date;record.time=$("coordinationTimeInput").value;record.place=$("coordinationPlaceInput").value.trim();record.chairperson=$("coordinationChairInput").value.trim();record.recorder=$("coordinationRecorderInput").value.trim();record.nextDate=$("coordinationNextDateInput").value;record.status=$("coordinationMeetingStatus").value;record.agenda=$("coordinationAgendaInput").value.trim();record.agendaHtml="";record.generalNotes=$("coordinationNotesInput").value.trim();record.generalNotesHtml="";record.attendees=$("coordinationAttendeesInput").value.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{const[name,customCompany,role,contact]=line.split("|").map(value=>value.trim());return{id:record.attendees?.[index]?.id||uid("kat"),companyId:"",name:name||"",customCompany:customCompany||"",role:role||"",contact:contact||""}});app.coordinationDate=date;closeSheet();storeCoordination(record,"Údaje porady boli uložené.")}}})}
 function openCoordinationCompanyForm(groupKey=""){const record=coordinationRecord();if(!record)return;const group=groupKey?coordinationGroups(record.tasks||[]).find(item=>item.key===groupKey):null,selectedCompanyId=group?.tasks[0]?.companyId||"";let rows=(group?.tasks||[]).map(task=>({...clone(task),sourceId:task.id}));if(!rows.length)rows=[{id:uid("row"),text:"",responsible:"",deadline:"",status:"Bez vyjadrenia",note:""},{id:uid("row"),text:"",responsible:"",deadline:"",status:"Bez vyjadrenia",note:""}];showSheet({eyebrow:group?"HROMADNÁ ÚPRAVA FIRMY":"VIAC ÚLOH PRE FIRMU",title:group?`Upraviť firmu ${group.name}`:"Pridať firmu do porady",html:`<form id="coordinationCompanyForm" class="sheet-form coordination-company-form"><label>Firma<select id="coordinationCompanyInput" ${group?"disabled":""}>${companyOptions(selectedCompanyId)}</select></label><div class="form-split"><label>Spoločná zodpovedná osoba<input id="coordinationResponsibleAll" placeholder="Vyplň, ak ju chceš nastaviť všetkým"></label><label>Nastaviť stav všetkým<select id="coordinationStatusAll"><option value="">Ponechať jednotlivé stavy</option><option>Bez vyjadrenia</option><option>Prebieha</option><option>Splnené</option><option>Po termíne</option></select></label></div><div id="coordinationTaskEditors" class="coordination-task-editors"></div><button id="coordinationAddTaskRow" class="secondary-button full" type="button">+ Pridať ďalšiu úlohu</button><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">${group?"Uložiť celú firmu":"Pridať firmu a úlohy"}</button></div></form>`,onReady:()=>{const readRows=()=>{qa("[data-coordination-task-row]",$("coordinationTaskEditors")).forEach(editor=>{const row=rows.find(item=>item.id===editor.dataset.coordinationTaskRow);if(!row)return;qa("[data-coordination-field]",editor).forEach(field=>row[field.dataset.coordinationField]=field.value)})};const renderRows=()=>{$("coordinationTaskEditors").innerHTML=rows.map((row,index)=>`<article class="coordination-task-editor" data-coordination-task-row="${esc(row.id)}"><header><strong>Úloha ${index+1}</strong>${rows.length>1?`<button type="button" data-remove-coordination-row="${esc(row.id)}">Odstrániť</button>`:""}</header><label>Úloha / zápis<textarea data-coordination-field="text" required>${esc(row.text||"")}</textarea></label><div class="form-split"><label>Termín<input data-coordination-field="deadline" type="date" value="${esc(row.deadline||"")}"></label><label>Stav<select data-coordination-field="status"><option ${row.status==="Bez vyjadrenia"?"selected":""}>Bez vyjadrenia</option><option ${row.status==="Prebieha"?"selected":""}>Prebieha</option><option ${row.status==="Splnené"?"selected":""}>Splnené</option><option ${row.status==="Po termíne"?"selected":""}>Po termíne</option></select></label></div><label>Zodpovedná osoba<input data-coordination-field="responsible" value="${esc(row.responsible||"")}"></label><label>Poznámka<textarea data-coordination-field="note">${esc(row.note||"")}</textarea></label></article>`).join("");qa("[data-remove-coordination-row]",$("coordinationTaskEditors")).forEach(button=>button.onclick=()=>{readRows();rows=rows.filter(row=>row.id!==button.dataset.removeCoordinationRow);renderRows()})};$("coordinationAddTaskRow").onclick=()=>{readRows();rows.push({id:uid("row"),text:"",responsible:$("coordinationResponsibleAll").value.trim(),deadline:"",status:$("coordinationStatusAll").value||"Bez vyjadrenia",note:""});renderRows()};q(".cancel",$("coordinationCompanyForm")).onclick=closeSheet;$("coordinationCompanyForm").onsubmit=event=>{event.preventDefault();readRows();const companyId=group?selectedCompanyId:$("coordinationCompanyInput").value;if(!companyId){toast("Najprv vyber firmu.");return}const commonResponsible=$("coordinationResponsibleAll").value.trim(),commonStatus=$("coordinationStatusAll").value,valid=rows.map(row=>({...row,text:String(row.text||"").trim()})).filter(row=>row.text);if(!valid.length){toast("Zadaj aspoň jednu úlohu.");return}const existing=record.tasks||[],oldGroup=group?existing.filter(task=>coordinationGroupKey(task)===group.key):[],removedRoots=oldGroup.filter(task=>!valid.some(row=>row.sourceId===task.id)).map(task=>task.rootTaskId||task.id);const newTasks=valid.map(row=>{const source=existing.find(task=>task.id===row.sourceId),id=source?.id||uid("ktu");return{...(source||{}),id,rootTaskId:source?.rootTaskId||id,text:row.text,companyId,responsible:commonResponsible||row.responsible||company(companyId)?.name||"",deadline:row.deadline||"",status:commonStatus||row.status||"Bez vyjadrenia",note:String(row.note||"").trim(),enteredDate:source?.enteredDate||record.date,enteredMeetingNumber:source?.enteredMeetingNumber||record.number||"",originDate:source?.originDate||"",originNumber:source?.originNumber||"",carried:Boolean(source?.carried),carriedFromDate:source?.carriedFromDate||"",carriedFromMeetingNumber:source?.carriedFromMeetingNumber||""}});record.tasks=group?[...existing.filter(task=>coordinationGroupKey(task)!==group.key),...newTasks]:[...existing,...newTasks];if(removedRoots.length)record.dismissedTaskRoots=[...new Set([...(record.dismissedTaskRoots||[]),...removedRoots])];closeSheet();storeCoordination(record,group?`Firma ${group.name} bola upravená naraz.`:`Firma ${company(companyId)?.name||""} bola pridaná do porady.`)};renderRows()}})}

 function workerSheetForDate(date){return app.data.workerSheets.find(sheet=>sheet.projectId===app.projectId&&sheet.month===date.slice(0,7))}
 function derivedWorkerRows(){
  const assignedIds=new Set(app.data.assignments.filter(item=>item.projectId===app.projectId).map(item=>item.companyId));
  return app.data.companies.filter(item=>assignedIds.has(item.id)).sort((a,b)=>String(a.name).localeCompare(String(b.name),"sk")).map(item=>({id:`mobile-${item.id}`,companyId:item.id,name:item.name,alias:item.shortName||item.customName||item.name,actualName:item.name,values:{}}))
 }
 function workersForDate(date){
  const sheet=workerSheetForDate(date),day=Number(date.slice(8,10)),rows=sheet?.rows?.length?sheet.rows:derivedWorkerRows();
  return rows.map(row=>({...row,value:Number(row.values?.[day]||0)}))
 }
 function employeeSheetForDate(type,date){
  const key=type==="thp"?"thpTimesheets":"betpresTimesheets",month=date.slice(0,7);
  return app.data[key].find(sheet=>sheet.projectId===app.projectId&&sheet.month===month)||app.data[key].filter(sheet=>sheet.projectId===app.projectId&&sheet.month<month).sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0]
 }
 function employeesForDate(type,date){
  const day=Number(date.slice(8,10)),sheet=employeeSheetForDate(type,date);
  return (sheet?.rows||[]).slice().sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"sk",{sensitivity:"base"})).map(row=>({...row,value:row.values?.[day]??"",overtime:row.overtime?.[day]??""}))
 }
 function normalizeAttendance(value,{overtime=false}={}){
  const raw=String(value??"").trim().toUpperCase().replace(",",".");
  if(!raw)return"";
  if(!overtime&&["P","N","D"].includes(raw))return raw;
  const number=Number(raw);return Number.isFinite(number)?Math.max(0,Math.min(24,number)):null
 }
 function renderWorkers(){
  const date=$("workerDate").value||todayISO();if(!$("workerDate").value)$("workerDate").value=date;
  qa("[data-worker-mode]",$("workerModeSwitch")).forEach(button=>button.classList.toggle("active",button.dataset.workerMode===app.workerMode));
  if(app.workerMode!=="companies"){renderEmployeeTimesheet(date);return}
  const rows=workersForDate(date),total=rows.reduce((sum,row)=>sum+Number(row.value||0),0);
  $("workerTotalLabel").textContent="Spolu na stavbe";$("workerTotalUnit").textContent="osôb";$("workerTotal").textContent=String(total);$("workerCompanyCount").textContent=`${rows.filter(row=>Number(row.value)>0).length} firiem`;
  $("workersList").innerHTML=rows.length?rows.map(row=>`<article class="worker-row"><div><strong>${esc(row.alias||row.name||row.actualName||company(row.companyId)?.name||"Bez názvu")}</strong><small>${esc(row.actualName&&row.actualName!==(row.alias||row.name)?row.actualName:company(row.companyId)?.scope||"")}</small></div><div class="number-stepper"><button type="button" data-step="-1" aria-label="Odobrať">−</button><input type="number" min="0" inputmode="numeric" value="${Number(row.value||0)||""}" data-worker-id="${esc(row.id)}" data-company-id="${esc(row.companyId||"")}" data-name="${esc(row.name||row.alias||row.actualName||"")}" aria-label="Počet pracovníkov"><button type="button" data-step="1" aria-label="Pridať">+</button></div></article>`).join(""):`<div class="empty-state">Na tejto stavbe zatiaľ nie sú priradené firmy.</div>`;
  qa("[data-step]",$("workersList")).forEach(button=>button.onclick=()=>{const input=q("input",button.parentElement),value=Math.max(0,Number(input.value||0)+Number(button.dataset.step));input.value=value||"";updateWorkerPreview()});
  qa("[data-worker-id]",$("workersList")).forEach(input=>input.oninput=updateWorkerPreview)
 }
 function renderEmployeeTimesheet(date){
  const type=app.workerMode,rows=employeesForDate(type,date),isThp=type==="thp",hours=rows.reduce((sum,row)=>sum+(Number(row.value)||0),0),overtime=rows.reduce((sum,row)=>sum+(Number(row.overtime)||0),0),active=rows.filter(row=>String(row.value??"").trim()!==""||Number(row.overtime)>0).length;
  $("workerTotalLabel").textContent=isThp?"THP odpracované hodiny":"BETPRES odpracované hodiny";$("workerTotalUnit").textContent="h";$("workerTotal").textContent=String(hours).replace(".",",");$("workerCompanyCount").textContent=isThp&&overtime?`${active} ľudí · ${String(overtime).replace(".",",")} h nadčas`:`${active} pracovníkov`;
  $("workersList").innerHTML=rows.length?rows.map(row=>`<article class="worker-row employee-hours-row ${isThp?"thp":""}"><div><strong>${esc(row.name||"Bez mena")}</strong><small>${esc(row.position||"Pozícia nie je doplnená")}</small></div><label class="hours-field"><span>Hodiny</span><input class="employee-hours-input" inputmode="decimal" value="${esc(row.value)}" data-employee-hours="${esc(row.id)}" data-name="${esc(row.name||"")}" data-position="${esc(row.position||"")}" aria-label="Hodiny ${esc(row.name||"")}"></label>${isThp?`<label class="hours-field"><span>Nadčas</span><input class="employee-hours-input" inputmode="decimal" value="${esc(row.overtime)}" data-employee-overtime="${esc(row.id)}" aria-label="Nadčas ${esc(row.name||"")}" placeholder=""></label>`:""}</article>`).join(""):`<div class="empty-state">V podsmenovke ${isThp?"THP":"BETPRES"} zatiaľ nie sú pracovníci.<span class="worker-empty-note">Meno pridaj v počítačovej aplikácii; po synchronizácii sa zobrazí aj tu.</span></div>`;
  qa("[data-employee-hours],[data-employee-overtime]",$("workersList")).forEach(input=>input.oninput=updateEmployeePreview)
 }
 function updateEmployeePreview(){
  const rows=qa("[data-employee-hours]",$("workersList")),hours=rows.reduce((sum,input)=>sum+(Number(String(input.value).replace(",","."))||0),0),overtime=qa("[data-employee-overtime]",$("workersList")).reduce((sum,input)=>sum+(Number(String(input.value).replace(",","."))||0),0),active=rows.filter(input=>String(input.value).trim()!==""||Number(String(q(`[data-employee-overtime=\"${CSS.escape(input.dataset.employeeHours)}\"]`,$("workersList"))?.value||"").replace(",","."))>0).length;
  $("workerTotal").textContent=String(hours).replace(".",",");$("workerCompanyCount").textContent=app.workerMode==="thp"&&overtime?`${active} ľudí · ${String(overtime).replace(".",",")} h nadčas`:`${active} pracovníkov`
 }
 function updateWorkerPreview(){
  const values=qa("[data-worker-id]",$("workersList")).map(input=>Number(input.value||0));
  $("workerTotal").textContent=String(values.reduce((sum,value)=>sum+value,0));$("workerCompanyCount").textContent=`${values.filter(Boolean).length} firiem`
 }
 function saveWorkers(){
  const date=$("workerDate").value||todayISO();
  if(app.workerMode!=="companies"){
   const invalid=[],entries=qa("[data-employee-hours]",$("workersList")).map(input=>{
    const rowId=input.dataset.employeeHours,overtimeInput=q(`[data-employee-overtime=\"${CSS.escape(rowId)}\"]`,$("workersList")),value=normalizeAttendance(input.value),overtime=normalizeAttendance(overtimeInput?.value||"",{overtime:true});
    if(value===null||overtime===null)invalid.push(input.dataset.name||"pracovník");
    return{input,rowId,value,overtime}
   });
   if(invalid.length){toast(`Skontroluj hodiny: ${invalid.join(", ")}. Povolené sú 0–24 alebo P / N / D.`);return}
   entries.forEach(({input,rowId,value,overtime})=>{
    const operation={id:uid("op"),kind:"employee-day",timesheet:app.workerMode,projectId:app.projectId,date,rowId,name:input.dataset.name,position:input.dataset.position,value,overtime,createdAt:isoNow()};
    applyOperation(app.data,operation);enqueue(operation,{replaceKey:`${operation.kind}:${operation.timesheet}:${operation.projectId}:${operation.date}:${operation.rowId}`})
   });
   saveSnapshot();toast(`Podsmenovka ${app.workerMode==="thp"?"THP":"BETPRES"} je uložená v mobile.`);renderHome();autoSync();return
  }
  qa("[data-worker-id]",$("workersList")).forEach(input=>{
   const operation={id:uid("op"),kind:"worker-day",projectId:app.projectId,date,rowId:input.dataset.workerId,companyId:input.dataset.companyId,name:input.dataset.name,value:Math.max(0,Number(input.value||0)),createdAt:isoNow()};
   applyOperation(app.data,operation);enqueue(operation,{replaceKey:`${operation.kind}:${operation.projectId}:${operation.date}:${operation.rowId}`})
  });
  saveSnapshot();toast("Stav pracovníkov je uložený v mobile.");renderHome();autoSync()
 }

 function renderCalendar(){
  $("calendarMonthLabel").textContent=monthLabel(app.calendarMonth);
  const items=currentProjectItems("calendarEvents").filter(item=>String(item.date||"").slice(0,7)===app.calendarMonth).sort((a,b)=>`${a.date}${a.start||""}`.localeCompare(`${b.date}${b.start||""}`));
  const groups=Object.groupBy?Object.groupBy(items,item=>item.date):items.reduce((map,item)=>((map[item.date]??=[]).push(item),map),{});
  $("calendarList").innerHTML=Object.keys(groups).length?Object.entries(groups).map(([date,events])=>`<article class="timeline-day"><div class="timeline-date"><b>${Number(date.slice(8,10))}</b><small>${new Intl.DateTimeFormat("sk-SK",{weekday:"short"}).format(new Date(`${date}T12:00:00`))}</small></div><div class="timeline-events">${events.map(event=>`<div class="calendar-event" style="--event-color:${esc(event.color||"#1682d4")}"><strong>${esc(event.title||"Udalosť")}</strong><small>${esc(event.start||"Celý deň")}${event.companyId?` · ${esc(company(event.companyId)?.name||"")}`:""}</small>${event.note?`<small>${esc(event.note)}</small>`:""}</div>`).join("")}</div></article>`).join(""):`<div class="empty-state">V tomto mesiaci nie sú žiadne termíny. Stlač + a pridaj prvý.</div>`
 }
 function shiftCalendar(delta){const [year,month]=app.calendarMonth.split("-").map(Number),date=new Date(year,month-1+delta,1);app.calendarMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;renderCalendar()}

 function renderDiary(){
  const query=$("diarySearch").value.trim().toLowerCase();
  const items=currentProjectItems("mobileDiary").filter(item=>!query||[item.title,item.text,item.place].some(value=>String(value||"").toLowerCase().includes(query))).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  $("diaryList").innerHTML=items.length?items.map(item=>`<article class="list-item"><span class="item-icon">✎</span><div class="item-main"><strong>${esc(item.title||"Zápis zo stavby")}</strong><span>${esc(item.text||"Bez textu")}</span><span>${esc(item.place||"Bez miesta")}</span></div><div class="item-side"><strong>${esc(item.priority||"Stredná")}</strong><small>${formatDate(String(item.createdAt||"").slice(0,10))}</small></div></article>`).join(""):`<div class="empty-state">Zatiaľ nemáš žiadne mobilné zápisy pre túto stavbu.</div>`
 }

 function renderSettings(){
  applyAppearance();
  $("cloudUrl").value=app.config.url||"";$("cloudKey").value=app.config.key||"";$("workspaceName").value=app.config.workspaceName||"Medická – pilot";
  if(!$("cloudEmail").value)$("cloudEmail").value=app.session?.user?.email||app.config.email||"";
  const user=app.session?.user,signed=Boolean(user?.email);$("signedInBox").hidden=!signed;
  if(signed){$("signedInEmail").textContent=user.email;$("workspaceVersion").textContent=`${app.config.workspaceName} · cloud v${app.config.version||"?"}`}
  $("cloudRole").textContent=roleLabel(app.config.role);
  $("userInitials").textContent=user?.email?user.email.split("@")[0].split(/[._-]/).slice(0,2).map(part=>part[0]).join("").toUpperCase():"JV"
 }
 function roleLabel(role){return({owner:"Vlastník",editor:"Editor",viewer:"Iba čítanie",none:"Nepripojené"})[role]||role||"Nepripojené"}

 function showSheet({eyebrow,title,html,onReady,sheetClass=""}){
  $("sheetEyebrow").textContent=eyebrow;$("sheetTitle").textContent=title;$("sheetBody").innerHTML=html;
  $("bottomSheet").className=`bottom-sheet ${sheetClass}`.trim();
  $("sheetBackdrop").hidden=false;$("bottomSheet").hidden=false;document.body.style.overflow="hidden";
  if(onReady)onReady()
 }
 function closeSheet(){$("sheetBackdrop").hidden=true;$("bottomSheet").hidden=true;$("bottomSheet").className="bottom-sheet";$("sheetBody").innerHTML="";document.body.style.overflow=""}
 function companyOptions(selected=""){return `<option value="">Bez firmy</option>`+app.data.companies.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),"sk")).map(item=>`<option value="${esc(item.id)}" ${item.id===selected?"selected":""}>${esc(item.name)}</option>`).join("")}

 function openMaterialForm(){
  const nextSequence=String(Math.max(0,...currentProjectItems("purchases").map(item=>Number(item.sequence)||0))+1);
  showSheet({eyebrow:"PASPORT SKLADU",title:"Nový dodací list",html:`<form id="materialForm" class="sheet-form"><div class="photo-picker"><label>📷 Odfotiť doklad<input id="materialCamera" type="file" accept="image/*" capture="environment"></label><label>🖼 Vybrať z galérie<input id="materialPhoto" type="file" accept="image/*"></label></div><p id="ocrStatus" class="form-note">AI prečíta celý dodací list. Pred uložením skontroluj vyplnené údaje.</p><button id="materialAiAnalyze" type="button" class="secondary-button full" hidden>🤖 Analyzovať celý doklad pomocou AI</button><div class="form-split"><label>Dátum<input id="materialDate" type="date" required value="${todayISO()}"></label><label>P. č.<input id="materialSequence" inputmode="numeric" value="${esc(nextSequence)}"></label></div><label>Dodávateľ<input id="materialSupplierInput" required placeholder="napr. DEK"></label><label>Číslo dodacieho listu<input id="materialDocumentNo" placeholder="Číslo dokladu"></label><label>Číslo faktúry<input id="materialInvoiceNo" placeholder="Nechaj prázdne, kým nie je faktúra"></label><label>Materiál<input id="materialName" required placeholder="napr. vata / spotrebný materiál"></label><label>Cena dodacieho listu<input id="materialPrice" inputmode="decimal" placeholder="0,00 €"></label><p id="materialPriceNote" class="form-note ai-estimate-note" hidden></p><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">Uložiť dodací list</button></div></form>`,onReady:()=>{
   let photo=null,ocrText="",aiAnalysis=null;
   const fillFields=result=>{
    if(result.document_date&&/^\d{4}-\d{2}-\d{2}$/.test(result.document_date))$("materialDate").value=result.document_date;
    if(result.supplier)$("materialSupplierInput").value=result.supplier;
    if(result.delivery_note_number)$("materialDocumentNo").value=result.delivery_note_number;
    if(result.invoice_number)$("materialInvoiceNo").value=result.invoice_number;
    if(result.material_summary)$("materialName").value=result.material_summary;
    const price=formatEuro(result.price_total_eur);if(price)$("materialPrice").value=price;
    const note=$("materialPriceNote");note.hidden=false;
    if(result.price_source==="document")note.textContent="✓ Cena bola prečítaná priamo z dodacieho listu.";
    else if(result.price_source==="ai_estimate"){const low=formatEuro(result.price_low_eur),high=formatEuro(result.price_high_eur),range=low&&high?` · rozsah ${low} – ${high}`:"";note.textContent=`🤖 AI odhad, nie cena z dokladu${range} · istota ${Number(result.confidence_percent)||0} %. Hodnotu môžeš upraviť.`}
    else note.textContent="Cena sa na doklade nenašla a nebolo ju možné spoľahlivo odhadnúť. Môžeš ju dopísať ručne.";
   };
   const runLocalOcr=async(prefix="")=>{const status=$("ocrStatus");status.textContent=`${prefix}Rozpoznávam doklad priamo v telefóne… 0 %`;const result=await recognizeDelivery(photo.dataUrl,progress=>status.textContent=`${prefix}Rozpoznávam doklad priamo v telefóne… ${Math.round(progress*100)} %`);ocrText=result.text||"";const parsed=parseDeliveryOcr(ocrText);$("materialDate").value=parsed.date;$("materialSupplierInput").value=parsed.supplier;$("materialDocumentNo").value=parsed.documentNo;$("materialName").value=parsed.material;$("materialPrice").value=parsed.estimatedPrice;status.textContent=`Lokálne rozpoznanie dokončené · istota ${Math.round(result.confidence||0)} % · údaje skontroluj.`};
   const runAi=async()=>{if(!photo)throw new Error("Najprv odfoť alebo vyber dodací list.");const button=$("materialAiAnalyze"),status=$("ocrStatus");button.disabled=true;status.textContent="AI číta celý dodací list a pripravuje údaje…";try{const result=await analyzeDeliveryWithAI(photo,ocrText);aiAnalysis=result;fillFields(result);status.textContent=`AI vyplnila dodávateľa, doklad, materiál a cenu · istota ${Number(result.confidence_percent)||0} %. Údaje skontroluj.`;button.textContent="🤖 Znova analyzovať celý doklad";return true}finally{button.disabled=false}};
   qa("#materialCamera,#materialPhoto").forEach(input=>input.onchange=async()=>{const file=input.files?.[0];if(!file)return;const status=$("ocrStatus"),button=$("materialAiAnalyze");try{photo=await imageData(file,1800,.82);button.hidden=false;if(app.session?.access_token&&normalizeUrl(app.config.url)&&app.config.key){try{await runAi();return}catch(error){await runLocalOcr(`AI nie je dostupná (${error.message}). `);return}}await runLocalOcr("Cloud nie je pripojený. ")}catch(error){status.textContent=`Doklad sa nepodarilo spracovať: ${error.message}. Údaje môžeš zapísať ručne.`}finally{input.value=""}});
   $("materialAiAnalyze").onclick=async()=>{try{await runAi()}catch(error){$("ocrStatus").textContent=`AI analýza sa nepodarila: ${error.message}`} };
   q(".cancel",$("materialForm")).onclick=closeSheet;
   $("materialForm").onsubmit=event=>{event.preventDefault();const record={id:uid("pd"),projectId:app.projectId,date:$("materialDate").value,supplier:$("materialSupplierInput").value.trim(),documentNo:$("materialDocumentNo").value.trim(),invoiceNo:$("materialInvoiceNo").value.trim(),material:$("materialName").value.trim(),estimatedPrice:$("materialPrice").value.trim(),sequence:$("materialSequence").value.trim()||nextSequence,source:aiAnalysis?"AI analýza mobil":photo?"OCR mobil":"Mobil",priceSource:aiAnalysis?.price_source||($("materialPrice").value.trim()?"manual":"none"),aiAnalysis:aiAnalysis?clone(aiAnalysis):null,ocrText,photos:photo?[photo]:[],createdAt:isoNow()};addRecord("purchases",record,"add-purchase");closeSheet();route("materials");toast("Dodací list bol uložený.")}
  }})
 }

 function openDefectForm(defectId=""){
  const existing=defectId?app.data.defects.find(item=>item.id===defectId&&item.projectId===app.projectId):null,isEdit=Boolean(existing),severities=["Nízka","Stredná","Vysoká"],statuses=["Otvorená","Prebieha","Odoslaná firme","Odstránená"],selectedSeverity=existing?.severity||"Stredná",selectedStatus=existing?.status||"Otvorená";
  showSheet({eyebrow:"KONTROLA KVALITY",title:isEdit?`Upraviť vadu č. ${existing.number||""}`:"Nová vada / nedorobok",html:`<form id="defectFormMobile" class="sheet-form"><label>Popis vady<textarea id="defectDescriptionInput" required placeholder="Čo treba opraviť alebo dokončiť?">${esc(existing?.description||"")}</textarea></label><div class="form-split"><label>Miesto<input id="defectLocationInput" value="${esc(existing?.location||"")}" placeholder="napr. 6. NP, byt 34"></label><label>Termín<input id="defectDueInput" type="date" value="${esc(existing?.dueDate||"")}"></label></div><label>Zodpovedná firma<select id="defectCompanyInput">${companyOptions(existing?.companyId||"")}</select></label><label>Zodpovedná osoba<input id="defectResponsibleInput" value="${esc(existing?.responsible||companyResponsible(existing?.companyId)||"")}" placeholder="Doplní sa podľa firmy"></label><div class="form-split"><label>Závažnosť<select id="defectSeverityInput">${severities.map(value=>`<option ${value===selectedSeverity?"selected":""}>${value}</option>`).join("")}</select></label><label>Stav<select id="defectStatusInput">${statuses.map(value=>`<option ${value===selectedStatus?"selected":""}>${value}</option>`).join("")}</select></label></div><div class="photo-picker"><label>📷 Odfotiť<input id="defectCameraInput" type="file" accept="image/*" capture="environment"></label><label>🖼 Vybrať z galérie<input id="defectGalleryInput" type="file" accept="image/*" multiple></label></div><div id="defectPhotoPreview" class="defect-photo-preview-mobile"></div><p id="defectPhotoStatus" class="form-note">${isEdit?`Uložené fotografie: ${Array.isArray(existing.photos)?existing.photos.length:0} / 6. Môžeš doplniť ďalšie.`:"Môžeš spolu pridať najviac 6 fotografií."}</p><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">${isEdit?"Uložiť zmeny":"Uložiť vadu"}</button></div></form>`,onReady:()=>{
   let photos=clone(Array.isArray(existing?.photos)?existing.photos:[]);
   const renderPhotoPreview=()=>{const preview=$("defectPhotoPreview");preview.innerHTML=photos.map((photo,index)=>`<div>${mobilePhotoImage(photo,"defect-edit-thumb")}<button type="button" data-remove-mobile-photo="${index}" aria-label="Odstrániť fotografiu">×</button></div>`).join("");qa("[data-remove-mobile-photo]",preview).forEach(button=>button.onclick=()=>{photos.splice(Number(button.dataset.removeMobilePhoto),1);$("defectPhotoStatus").textContent=`Fotografie: ${photos.length} / 6`;renderPhotoPreview()});requestAnimationFrame(()=>hydrateMobileCloudPhotos(preview))};
   const addDefectPhotos=async event=>{const status=$("defectPhotoStatus"),free=Math.max(0,6-photos.length),files=[...event.target.files].slice(0,free);if(!free){status.textContent="K vade je už uložených maximálne 6 fotografií.";event.target.value="";return}status.textContent="Pripravujem fotografie…";try{for(const file of files)photos.push(await imageData(file,1400,.72));status.textContent=`Uložené a pripravené fotografie: ${photos.length} / 6${event.target.files.length>files.length?" · ďalšie sa nezmestili":""}`;renderPhotoPreview()}catch(error){status.textContent=`Fotografiu sa nepodarilo pridať: ${error.message}`}event.target.value=""};qa("#defectCameraInput,#defectGalleryInput").forEach(input=>input.onchange=addDefectPhotos);renderPhotoPreview();
   $("defectCompanyInput").onchange=()=>{$("defectResponsibleInput").value=companyResponsible($("defectCompanyInput").value)};
   if(!$("defectResponsibleInput").value)$("defectResponsibleInput").value=companyResponsible($("defectCompanyInput").value);
   q(".cancel",$("defectFormMobile")).onclick=closeSheet;
   $("defectFormMobile").onsubmit=event=>{event.preventDefault();const number=existing?.number||String(Math.max(0,...currentProjectItems("defects").map(item=>Number(String(item.number||"").replace(/\D/g,""))||0))+1),status=$("defectStatusInput").value,companyId=$("defectCompanyInput").value,record={...(existing||{}),id:existing?.id||uid("defect"),projectId:app.projectId,companyId,number,location:$("defectLocationInput").value.trim(),description:$("defectDescriptionInput").value.trim(),dueDate:$("defectDueInput").value,severity:$("defectSeverityInput").value,status,responsible:$("defectResponsibleInput").value.trim()||companyResponsible(companyId),photos,createdAt:existing?.createdAt||isoNow(),updatedAt:isoNow(),sentAt:status==="Odoslaná firme"?(existing?.sentAt||isoNow()):(existing?.sentAt||"")};upsertRecord("defects",record,"add-defect");closeSheet();route("defects");toast(isEdit?"Zmeny vady boli uložené.":"Vada bola uložená.")}
  }})
 }

 function openDiaryForm(){
  showSheet({eyebrow:"MÔJ STAVEBNÝ DENNÍK",title:"Nový denný zápis",html:`<form id="diaryFormMobile" class="sheet-form"><label>Názov<input id="diaryTitleInput" required placeholder="Čo si si všimol?"></label><label>Poznámka<textarea id="diaryTextInput" required placeholder="Zapíš detail, otázku alebo úlohu na neskôr."></textarea></label><div class="form-split"><label>Miesto<input id="diaryPlaceInput" placeholder="napr. strecha"></label><label>Termín<input id="diaryDueInput" type="date"></label></div><label>Priorita<select id="diaryPriorityInput"><option>Nízka</option><option selected>Stredná</option><option>Vysoká</option></select></label><div class="photo-picker"><label>📷 Odfotiť<input id="diaryCameraInput" type="file" accept="image/*" capture="environment"></label><label>🖼 Vybrať z galérie<input id="diaryGalleryInput" type="file" accept="image/*" multiple></label></div><p id="diaryPhotoStatus" class="form-note">Môžeš spolu pridať najviac 6 fotografií; odošlú sa pri synchronizácii.</p><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">Uložiť zápis</button></div></form>`,onReady:()=>{
   let photos=[];const addDiaryPhotos=async event=>{const status=$("diaryPhotoStatus"),files=[...event.target.files].slice(0,Math.max(0,6-photos.length));status.textContent="Pripravujem fotografie…";try{for(const file of files)photos.push(await imageData(file,1400,.72));status.textContent=`Pripravené fotografie: ${photos.length} / 6`}catch(error){status.textContent=`Fotografiu sa nepodarilo pridať: ${error.message}`}event.target.value=""};qa("#diaryCameraInput,#diaryGalleryInput").forEach(input=>input.onchange=addDiaryPhotos);
   q(".cancel",$("diaryFormMobile")).onclick=closeSheet;
   $("diaryFormMobile").onsubmit=event=>{event.preventDefault();const record={id:uid("diary"),projectId:app.projectId,title:$("diaryTitleInput").value.trim(),text:$("diaryTextInput").value.trim(),place:$("diaryPlaceInput").value.trim(),dueDate:$("diaryDueInput").value,priority:$("diaryPriorityInput").value,photos,createdAt:isoNow(),updatedAt:isoNow()};addRecord("mobileDiary",record,"add-diary");closeSheet();route("diary");toast("Denný zápis bol uložený.")}
  }})
 }

 function openEventForm(){
  showSheet({eyebrow:"KALENDÁR",title:"Nový termín",html:`<form id="eventFormMobile" class="sheet-form"><label>Názov udalosti<input id="eventTitleInput" required placeholder="Kontrolný deň, dodávka, termín…"></label><div class="form-split"><label>Dátum<input id="eventDateInput" type="date" required value="${todayISO()}"></label><label>Čas<input id="eventTimeInput" type="time"></label></div><label>Firma<select id="eventCompanyInput">${companyOptions()}</select></label><label>Poznámka<textarea id="eventNoteInput" placeholder="Čo treba pripraviť?"></textarea></label><label>Farba<input id="eventColorInput" type="color" value="#1682d4"></label><div class="sheet-actions"><button type="button" class="cancel">Zrušiť</button><button class="submit" type="submit">Uložiť termín</button></div></form>`,onReady:()=>{
   q(".cancel",$("eventFormMobile")).onclick=closeSheet;
   $("eventFormMobile").onsubmit=event=>{event.preventDefault();const date=$("eventDateInput").value,record={id:uid("cal"),projectId:app.projectId,title:$("eventTitleInput").value.trim(),type:"Iné",date,start:$("eventTimeInput").value,end:"",companyId:$("eventCompanyInput").value,location:"",color:$("eventColorInput").value,note:$("eventNoteInput").value.trim(),updatedAt:isoNow()};addRecord("calendarEvents",record,"add-calendar");app.calendarMonth=date.slice(0,7);closeSheet();route("calendar");toast("Termín bol uložený.")}
  }})
 }

 function openMaterialFilter(){
  const suppliers=[...new Set(currentProjectItems("purchases").map(item=>item.supplier).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sk"));
  showSheet({eyebrow:"PASPORT SKLADU",title:"Filtrovať dodávateľa",html:`<form id="materialFilterForm" class="sheet-form"><label>Dodávateľ<select id="materialSupplierFilter"><option value="">Všetci dodávatelia</option>${suppliers.map(value=>`<option ${value===app.materialSupplier?"selected":""}>${esc(value)}</option>`).join("")}</select></label><div class="sheet-actions"><button class="cancel" type="button">Zrušiť</button><button class="submit" type="submit">Použiť filter</button></div></form>`,onReady:()=>{q(".cancel",$("materialFilterForm")).onclick=closeSheet;$("materialFilterForm").onsubmit=event=>{event.preventDefault();app.materialSupplier=$("materialSupplierFilter").value;closeSheet();renderMaterials()}}})
 }

 function addRecord(collection,record,kind){
  app.data[collection].push(record);saveSnapshot();enqueue({id:uid("op"),kind,record:clone(record),createdAt:isoNow()});renderHome();autoSync()
 }
 function upsertRecord(collection,record,kind){
  const index=app.data[collection].findIndex(item=>item.id===record.id);if(index>=0)app.data[collection][index]=record;else app.data[collection].push(record);saveSnapshot();enqueue({id:uid("op"),kind,record:clone(record),createdAt:isoNow()},{replaceKey:`${kind}:${record.id}`});renderHome();autoSync()
 }
 function enqueue(operation,{replaceKey=""}={}){
  operation.replaceKey=replaceKey;
  if(replaceKey)app.queue=app.queue.filter(item=>item.replaceKey!==replaceKey);
  app.queue.push(operation);saveQueue();connectionLabel(navigator.onLine?"syncing":"offline",navigator.onLine?`${app.queue.length} čaká na sync`:"Offline")
 }

 function applyOperation(data,operation){
  normalizeData(data);
  const map={"add-purchase":"purchases","add-defect":"defects","upsert-control-day":"controlDays","add-calendar":"calendarEvents","add-diary":"mobileDiary"},collection=map[operation.kind];
  if(collection){const existing=data[collection].findIndex(item=>item.id===operation.record.id);if(existing>=0)data[collection][existing]=clone(operation.record);else data[collection].push(clone(operation.record));return}
  if(operation.kind==="worker-day"){
   const month=operation.date.slice(0,7),day=Number(operation.date.slice(8,10));
   let sheet=data.workerSheets.find(item=>item.projectId===operation.projectId&&item.month===month);
   if(!sheet){const previous=data.workerSheets.filter(item=>item.projectId===operation.projectId&&item.month<month).sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0];sheet={id:uid("ws"),projectId:operation.projectId,month,rows:(previous?.rows||[]).map(row=>({...clone(row),id:uid("wr"),values:{}}))};data.workerSheets.push(sheet)}
   let row=sheet.rows.find(item=>item.id===operation.rowId)||(operation.companyId&&sheet.rows.find(item=>item.companyId===operation.companyId));
   if(!row){row={id:operation.rowId||uid("wr"),companyId:operation.companyId||"",name:operation.name||"Bez názvu",alias:operation.name||"Bez názvu",actualName:operation.name||"",values:{}};sheet.rows.push(row)}
   row.values=row.values||{};if(Number(operation.value))row.values[day]=Number(operation.value);else delete row.values[day]
  }
  if(operation.kind==="employee-day"){
   const key=operation.timesheet==="thp"?"thpTimesheets":"betpresTimesheets",month=operation.date.slice(0,7),day=Number(operation.date.slice(8,10));
   let sheet=data[key].find(item=>item.projectId===operation.projectId&&item.month===month);
   if(!sheet){const previous=data[key].filter(item=>item.projectId===operation.projectId&&item.month<month).sort((a,b)=>String(b.month).localeCompare(String(a.month)))[0];sheet={id:uid(operation.timesheet==="thp"?"thps":"bts"),projectId:operation.projectId,month,rows:(previous?.rows||[]).map((row,index)=>({...clone(row),id:uid(operation.timesheet==="thp"?"thpe":"bte"),sortOrder:index,values:{},overtime:{}}))};data[key].push(sheet)}
   let row=sheet.rows.find(item=>item.id===operation.rowId)||sheet.rows.find(item=>item.name===operation.name);
   if(!row){row={id:operation.rowId||uid(operation.timesheet==="thp"?"thpe":"bte"),name:operation.name||"Bez mena",position:operation.position||"",sortOrder:sheet.rows.length,values:{},overtime:{}};sheet.rows.push(row)}
   row.values=row.values||{};row.overtime=row.overtime||{};
   if(operation.value===""||operation.value===0)delete row.values[day];else row.values[day]=operation.value;
   if(operation.timesheet==="thp"&&operation.overtime!==""&&operation.overtime!==0)row.overtime[day]=operation.overtime;else delete row.overtime[day]
  }
 }

 async function imageData(file,max=1400,quality=.74){
  if(!file?.type?.startsWith("image/"))throw new Error("Vyber fotografiu.");
  const url=URL.createObjectURL(file),image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Fotografiu sa nepodarilo načítať."));image.src=url});
  const scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const context=canvas.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
  const dataUrl=canvas.toDataURL("image/jpeg",quality);return{id:uid("photo"),name:file.name||"foto.jpg",type:"image/jpeg",size:Math.round(dataUrl.length*.75),dataUrl}
 }

 async function recognizeDelivery(dataUrl,onProgress=()=>{}){
  if(!window.Tesseract?.createWorker)throw new Error("OCR modul nie je dostupný");
  if(!app.ocrWorker)app.ocrWorker=window.Tesseract.createWorker("slk",1,{workerPath:new URL("vendor/worker.min.js",location.href).href,langPath:new URL("vendor/lang",location.href).href,corePath:new URL("vendor/tesseract-core/tesseract-core-lstm.wasm.js",location.href).href,logger:message=>{if(message.status==="recognizing text")onProgress(message.progress||0)}});
  const worker=await app.ocrWorker,result=await worker.recognize(dataUrl);return result.data
 }
 function normalizeText(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
 function ocrPrice(text){const values=[];String(text||"").split(/\r?\n/).forEach(line=>{if(!/(?:€|eur|celkom|spolu|suma)/i.test(line))return;(line.match(/\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+[,.]\d{2}/g)||[]).forEach(raw=>{const value=Number(raw.replace(/[ .](?=\d{3}(?:\D|$))/g,"").replace(",","."));if(Number.isFinite(value)&&value>0&&value<10000000)values.push(value)})});const value=values.length?Math.max(...values):0;return value?value.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":""}
 function ocrMaterial(text){const value=normalizeText(text),found=[];const add=(regex,label)=>{if(regex.test(value)&&!found.includes(label))found.push(label)};add(/vata|mineraln|izolac|isover|ursa|rockwool/,"Vata / tepelná izolácia");add(/eps|xps|polystyren/,"EPS / XPS izolácia");add(/cement|beton|malta|poter/,"Cement / malta / stavebné zmesi");add(/sadrokarton|sdk|profil cw|profil uw/,"Sadrokartónový materiál");add(/tehl|tvarnic|ytong|porfix/,"Murivo / tvárnice");add(/obrubnik/,"Obrubníky");add(/kanal|potrub|rura|koleno|odtok|vpust|poklop/,"Potrubie / kanalizácia");add(/kabel|vodic|zasuv|svietid|elektro/,"Elektroinštalačný materiál");add(/dlaz|obklad|keram/,"Dlažba / obklad");add(/omietk|farb|penetr|stierk/,"Omietky / nátery");add(/hydroizol|lepenk|asfalt|ipa/,"Hydroizolačný materiál");add(/silikon|tmel|pena|pask|lepid|skrut|kotv|vrtak|foli|rukavic|uter|sprej/,"Spotrebný materiál");add(/roxor|vystuz|kari|ocel|profil/,"Oceľ / výstuž / profily");add(/drevo|dosk|osb|preglej/,"Drevo / doskový materiál");return found.length>3?"Stavebný a spotrebný materiál":found.join(", ")||"Materiál podľa dodacieho listu"}
 function ocrDocumentCandidates(line){return(line.match(/\b[A-Z0-9][A-Z0-9._\/-]{2,25}\b/gi)||[]).map(value=>value.replace(/^[._\/-]+|[._\/-]+$/g,"")).filter(value=>/\d/.test(value)&&value.length>=3)}
 function ocrDocument(text){
  const lines=String(text||"").split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean),
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
  const response=await rawCloud("/auth/v1/token?grant_type=password",{method:"POST",body:JSON.stringify({email,password})});response.expires_at=Math.floor(Date.now()/1000)+Number(response.expires_in||3600);app.session=response;app.config.email=email;saveSession();saveConfig()
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
  $("connectionForm").onsubmit=async event=>{event.preventDefault();app.config.url=normalizeUrl($("cloudUrl").value);app.config.key=$("cloudKey").value.trim();app.config.workspaceName=$("workspaceName").value.trim()||"Medická – pilot";app.config.email=$("cloudEmail").value.trim();saveConfig();setCloudMessage("Prihlasujem…");try{await signIn(app.config.email,$("cloudPassword").value);$("cloudPassword").value="";setCloudMessage("Prihlásenie bolo úspešné. Mobil si ho zapamätá aj po zatvorení aplikácie.","success");await sync();renderSettings()}catch(error){setCloudMessage(error.message,"error")}};
  $("connectionFile").onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.type!=="BETPRES_SITEDESK_CONNECTION"||!data.url||!data.publishableKey)throw new Error();app.config.url=normalizeUrl(data.url);app.config.key=String(data.publishableKey);app.config.workspaceName=data.workspaceName||"Medická – pilot";app.config.email=String(data.email||"");saveConfig();renderSettings();setCloudMessage("Pripojenie bolo načítané. Zadaj heslo iba prvýkrát.","success")}catch{setCloudMessage("Súbor nie je platné pripojenie BETPRES SiteDesk.","error")}};
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
  applyAppearance();const pairing=applyPairingFromUrl();wireEvents();ensureProject();$("workerDate").value=todayISO();renderProjectSelect();renderSettings();const requested=new URLSearchParams(location.search).get("open"),initialRoute=pairing.paired?"settings":(["home","materials","defects","workers","meetings","calendar","diary","settings"].includes(requested)?requested:"home");route(initialRoute);updatePendingBadge();
  if(pairing.paired)setCloudMessage(app.session?.access_token?"Mobil je spárovaný a prihlásenie ostalo zachované.":"Mobil je spárovaný. Skontroluj e-mail a zadaj heslo iba prvýkrát.","success");
  if(pairing.error)setCloudMessage(pairing.error,"error");
  registerServiceWorker();
  if(navigator.onLine&&app.session?.access_token)sync({silent:true});else connectionLabel("offline",app.queue.length?`${app.queue.length} čaká`:"Offline")
 }
 document.addEventListener("DOMContentLoaded",init)
})();
