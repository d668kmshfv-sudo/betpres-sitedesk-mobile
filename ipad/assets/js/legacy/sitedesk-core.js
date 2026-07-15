const BETPRES_LOGO_IMAGE=new URL("assets/images/navigation-logo.png",document.baseURI).href;const LETTERHEAD_IMAGE=new URL("assets/images/betpres-letterhead-2026.jpg",document.baseURI).href;
const KEY="betpres-stavebna-evidencia-v7";const AUTO_BACKUP_KEY=KEY+"-auto-backup";const seed=window.SEED_DATA;const clone=o=>JSON.parse(JSON.stringify(o));
const SITE_DESK_APP_VERSION="5.0.76";
const SITE_DESK_DB_NAME="betpres-sitedesk-localdb";
const SITE_DESK_DB_VERSION=1;
const SITE_DESK_SNAPSHOT_STORE="snapshots";
let siteDeskDbPromise=null;
function siteDeskOpenDb(){
 if(!("indexedDB" in window))return Promise.resolve(null);
 if(siteDeskDbPromise)return siteDeskDbPromise;
 siteDeskDbPromise=new Promise(resolve=>{
  const req=indexedDB.open(SITE_DESK_DB_NAME,SITE_DESK_DB_VERSION);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains(SITE_DESK_SNAPSHOT_STORE))db.createObjectStore(SITE_DESK_SNAPSHOT_STORE,{keyPath:"key"})
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>resolve(null);
 });
 return siteDeskDbPromise
}
function siteDeskSaveDbSnapshot(serialized){
 if(!serialized)return;
 siteDeskOpenDb().then(db=>{
  if(!db)return;
  try{
   const tx=db.transaction(SITE_DESK_SNAPSHOT_STORE,"readwrite");
   tx.objectStore(SITE_DESK_SNAPSHOT_STORE).put({key:KEY,value:serialized,version:SITE_DESK_APP_VERSION,updatedAt:new Date().toISOString()})
  }catch{}
 })
}
function siteDeskRestoreDbSnapshotIfNeeded(){
 try{if(localStorage.getItem(KEY))return}catch{}
 siteDeskOpenDb().then(db=>{
  if(!db)return;
  try{
   const tx=db.transaction(SITE_DESK_SNAPSHOT_STORE,"readonly"),req=tx.objectStore(SITE_DESK_SNAPSHOT_STORE).get(KEY);
   req.onsuccess=()=>{
    const row=req.result;
    if(row&&row.value){
     try{localStorage.setItem(KEY,row.value);location.reload()}catch{}
    }
   }
  }catch{}
 })
}
siteDeskRestoreDbSnapshotIfNeeded();
let state=(()=>{try{return JSON.parse(localStorage.getItem(KEY))||clone(seed)}catch{return clone(seed)}})();let undoStack=[];let lastCommittedState=JSON.stringify(state);let directUndoActive=false;
if(!state.handoverDrafts||typeof state.handoverDrafts!=="object"||Array.isArray(state.handoverDrafts))state.handoverDrafts={};
const normalizeStateList=key=>{
 if(!Array.isArray(state[key]))state[key]=[]
};
[
 "projects","companies","assignments","billings","materials","purchases",
 "handovers","workerSheets","betpresTimesheets","thpTimesheets","companyHourTimesheets","acceptanceProtocols","siteMeetings","controlDays",
 "documentVersions","calendarEvents","workStatements","workBudgets","defects","mobileDiary","materialSamples"
].forEach(normalizeStateList);
if(!Array.isArray(state.defects))state.defects=[];

if(state.medickaDocumentSignerVersion!=="betpres-1.1-peter-balaz"){
 const medicka=state.projects.find(p=>p.id==="p1"||String(p.name||"").toUpperCase().includes("MEDICKÁ"));
 if(medicka){
  medicka.manager="Ing. Peter Baláž – stavbyvedúci";
  medicka.managerPhone="0902 926 099"
 }
 state.handovers.filter(x=>x.projectId==="p1").forEach(x=>{
  x.clientRep="Ing. Peter Baláž – stavbyvedúci";
  x.clientPhone="0902 926 099";
  x.clientSigner="Ing. Peter Baláž"
 });
 state.acceptanceProtocols.filter(x=>x.projectId==="p1").forEach(x=>{
  x.clientRep="Ing. Peter Baláž – stavbyvedúci"
 });
 state.controlDays.filter(x=>x.projectId==="p1").forEach(x=>{
  x.chairperson="Ing. Peter Baláž – stavbyvedúci"
 });
 state.siteMeetings.filter(x=>x.projectId==="p1").forEach(x=>{
  x.chairperson="Ing. Peter Baláž – stavbyvedúci"
 });
 state.medickaDocumentSignerVersion="betpres-1.1-peter-balaz";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.coordinationTaskLineageVersion!=="betpres-4.0"){
 const projects=[...new Set(state.controlDays.map(record=>record.projectId))];
 projects.forEach(projectId=>{
  const rootsByKey=new Map(),
        records=state.controlDays
         .filter(record=>record.projectId===projectId)
         .sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
  records.forEach(record=>{
   record.tasks=Array.isArray(record.tasks)?record.tasks:[];
   record.dismissedTaskRoots=Array.isArray(record.dismissedTaskRoots)?record.dismissedTaskRoots:[];
   record.tasks.forEach(task=>{
    if(!task.id)task.id=uid("ktu");
    const originalDate=task.enteredDate||task.originDate||record.date,
          originalMeeting=task.enteredMeetingNumber||task.originNumber||record.number||"",
          key=[
           originalDate,
           originalMeeting,
           task.companyId||"",
           String(task.text||"").trim().toLowerCase()
          ].join("|");
    if(!rootsByKey.has(key))rootsByKey.set(key,task.rootTaskId||task.id);
    task.rootTaskId=rootsByKey.get(key);
    task.enteredDate=originalDate;
    task.enteredMeetingNumber=originalMeeting;
    task.carried=Boolean(task.carried||originalDate!==record.date);
    if(task.carried&&!task.carriedFromDate)task.carriedFromDate=task.originDate||"";
    if(task.carried&&!task.carriedFromMeetingNumber)task.carriedFromMeetingNumber=task.originNumber||""
   })
  })
 });
 state.coordinationTaskLineageVersion="betpres-4.0";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}


if(state.assignmentDocumentTypeVersion!=="betpres-4.8"){
 state.assignments.forEach(assignment=>{
  if(!assignment.contractType){
   const no=String(assignment.contractNo||"").toLowerCase();
   assignment.contractType=(no.includes("obj")||no.includes("objed"))?"Obj":"ZoD"
  }
 });
 state.assignmentDocumentTypeVersion="betpres-4.8";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.assignmentScopeVersion!=="betpres-4.7"){
 state.assignments.forEach(assignment=>{
  if(!assignment.scope){
   const c=state.companies.find(company=>company.id===assignment.companyId);
   if(c?.scope)assignment.scope=c.scope
  }
 });
 state.assignmentScopeVersion="betpres-4.7";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.billingRememberContractPriceVersion!=="betpres-3.8"){
 state.assignments.forEach(assignment=>{
  if(Number(assignment.billingContractPrice||0)>0)return;
  const latest=state.billings
   .filter(record=>
    record.projectId===assignment.projectId&&
    record.companyId===assignment.companyId&&
    Number(record.contractPrice||0)>0
   )
   .sort((a,b)=>String(b.month||"").localeCompare(String(a.month||"")))[0];
  if(latest)assignment.billingContractPrice=Number(latest.contractPrice)
 });
 state.billingRememberContractPriceVersion="betpres-3.8";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.billingContractFieldsVersion!=="betpres-3.6"){
 state.billings.forEach(record=>{
  if(record.contractPrice===undefined)record.contractPrice="";
  if(record.amendmentNo===undefined)record.amendmentNo=""
 });
 state.billingContractFieldsVersion="betpres-3.6";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.betpresEmployeeOrderVersion!=="betpres-2.5"){
 state.betpresTimesheets.forEach(sheet=>{
  (sheet.rows||[]).forEach((row,index)=>row.sortOrder=index)
 });
 state.betpresEmployeeOrderVersion="betpres-2.5";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.calendarManualColorsVersion!=="betpres-2.3"){
 state.calendarEvents.forEach(event=>{
  event.color=normalizeCalendarColor(event.color,"#2563eb")
 });
 state.calendarManualColorsVersion="betpres-2.3";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.coordinationManualSaveVersion!=="betpres-1.4-manual"){
 state.controlDays.forEach(record=>{
  if(typeof record.savedToDocuments!=="boolean"){
   record.savedToDocuments=Boolean(
    record.lastExportedAt||
    state.documentVersions.some(v=>v.kind==="controlDay"&&v.documentId===record.id)
   )
  }
  if(record.savedToDocuments&&!record.lastSavedAt){
   const latest=state.documentVersions
    .filter(v=>v.kind==="controlDay"&&v.documentId===record.id)
    .sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))[0];
   record.lastSavedAt=latest?.savedAt||record.updatedAt||record.createdAt||""
  }
 });
 state.coordinationManualSaveVersion="betpres-1.4-manual";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

if(state.workStatementsResetVersion!=="betpres-1.0-clean"){
 state.workStatements=[];
 state.workStatementsResetVersion="betpres-1.0-clean";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}


/* BETPRES 5.0.5 - odstránenie evidencie materiálu z aplikácie */
if(state.materialEvidenceRemovedVersion!=="betpres-5.0.5"){
 state.materials=[];
 state.purchases=[];
 state.materialPassportVersion="removed-5.0.5";
 state.materialEvidenceRemovedVersion="betpres-5.0.5";
 localStorage.setItem(KEY,JSON.stringify(state));
 lastCommittedState=JSON.stringify(state)
}

try{
 if(false && state.materialPassportVersion!=="medicka-2026-06-12"){
  const existingSequences=new Set(
   state.purchases
    .filter(x=>x.projectId==="p1")
    .map(x=>String(x.sequence||"").trim())
    .filter(Boolean)
  );
  (window.MATERIAL_PASSPORT_DATA||[]).forEach(row=>{
   const sequence=String(row.sequence||"").trim();
   if(!existingSequences.has(sequence)){
    state.purchases.push(clone(row));
    existingSequences.add(sequence)
   }
  });
  state.materialPassportVersion="medicka-2026-06-12";
  localStorage.setItem(KEY,JSON.stringify(state));
  lastCommittedState=JSON.stringify(state)
 }

 state.handovers.forEach(h=>{
  if(h.content&&!h.content.item10){
   h.content.item10="Bola odovzdaná projektová dokumentácia"
  }
 });

 state.companies.forEach(c=>{
  const a=state.assignments.find(x=>x.companyId===c.id);
  if(a){
   c.contact=c.contact||a.contact||"";
   c.phone=c.phone||a.phone||"";
   c.scope=c.scope||a.scope||""
  }
 });

 state.controlDays.forEach(meeting=>{
  meeting.tasks=Array.isArray(meeting.tasks)?meeting.tasks:[];
  meeting.attendees=Array.isArray(meeting.attendees)?meeting.attendees:[];
  meeting.tasks.forEach(task=>{
   if(!task.enteredDate)task.enteredDate=task.originDate||meeting.date;
   if(!task.enteredMeetingNumber){
    task.enteredMeetingNumber=task.originNumber||meeting.number
   }
   if(!task.status)task.status="Bez vyjadrenia"
  })
 });

 state.workerSheets.forEach(sheet=>(sheet.rows||[]).forEach(r=>{
  if(!r.alias&&!r.name){
   r.name=company(r.companyId)?.name||r.actualName||"Bez názvu";
   r.alias=r.name
  }
 }))
}catch(migrationError){
 console.error("Betpres – chyba migrácie starších údajov:",migrationError)
}
let purchasePage=1;const PURCHASE_PAGE_SIZE=150;let zoom=.76;let selectedWorkerMonth=todayMonthValue();let selectedWorkerMode="companies";const workerRenderSignatures=new Map();let lastCompaniesViewSignature="";let selectedCompanyHourRowId="";let selectedDefectIds=new Set();let editingDefectId="";let pendingDefectPhotos=[];const defectPhotoUrlCache=new Map();let selectedControlDayDate=nextTuesdayISO(todayISO());let selectedCoordinationKind="coordination";let selectedCalendarMonth=todayMonthValue();let selectedWorkCompanyId="";let selectedWorkPeriod=todayMonthValue();let selectedWorkDocFilter="manual:zod";let selectedWorkItemId="";let selectedWorkItemIds=new Set();let lastWorkSelectionIndex=-1;let workSummaryTimer=null;let workSummaryPendingStatement=null;let workPreviousIndexCache=new WeakMap();let handoverDraft=null;let handoverDraftKey="";let editingHandoverId="";const $=id=>document.getElementById(id);const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));const eur=new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"});const monthNames=["Jan","Feb","Mar","Apr","Máj","Jún","Júl","Aug","Sep","Okt","Nov","Dec"];
function todayMonthValue(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}function uid(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function updateUndoButton(){const b=$("undoBtn");if(!b)return;b.disabled=!undoStack.length;b.title=undoStack.length?`Vrátiť: ${undoStack.at(-1).label||"poslednú zmenu"} (Ctrl + Z)`:"Nie je čo vrátiť"}
function rememberPreviousState(label="Posledná zmena",serialized=""){const current=serialized||JSON.stringify(state);if(lastCommittedState!==current){undoStack.push({data:lastCommittedState,label});if(undoStack.length>30)undoStack.shift()}}
let directSaveTimer=null;
let siteDeskPersistTimer=null;
let siteDeskPendingSerialized="";
let siteDeskPendingBackup=false;
let siteDeskLastBackupAt=0;
let siteDeskRenderTimer=null;
function siteDeskRunIdle(fn){("requestIdleCallback" in window)?requestIdleCallback(fn,{timeout:1200}):setTimeout(fn,0)}
function siteDeskQueueRender(){
 if(siteDeskRenderTimer)return;
 siteDeskRenderTimer=requestAnimationFrame(()=>{
  siteDeskRenderTimer=null;
  renderAll();
 })
}
function siteDeskFlushPersistNow(){
 clearTimeout(siteDeskPersistTimer);
 siteDeskPersistTimer=null;
 const serialized=siteDeskPendingSerialized||JSON.stringify(state);
 if(siteDeskPendingBackup){
  const now=Date.now();
  if(now-siteDeskLastBackupAt>15000){
   try{const previous=localStorage.getItem(KEY);if(previous)localStorage.setItem(AUTO_BACKUP_KEY,previous);siteDeskLastBackupAt=now}catch{}
  }
 }
 try{localStorage.setItem(KEY,serialized)}catch{}
 lastCommittedState=serialized;
 siteDeskPendingSerialized="";
 siteDeskPendingBackup=false;
 siteDeskSaveDbSnapshot(serialized);
 updateSiteDeskSaveState("Automaticky uložené",false)
}
function siteDeskSchedulePersist(serialized,{backup=false}={}){
 siteDeskPendingSerialized=serialized;
 siteDeskPendingBackup=siteDeskPendingBackup||backup;
 clearTimeout(siteDeskPersistTimer);
 siteDeskPersistTimer=setTimeout(()=>siteDeskRunIdle(siteDeskFlushPersistNow),520);
}
function flushDirectState(description="Automatická zmena údajov"){
 clearTimeout(directSaveTimer);
 directSaveTimer=null;
 const current=JSON.stringify(state);
 lastCommittedState=current;
 siteDeskSchedulePersist(current,{backup:false});
 updateSiteDeskSaveState("Automaticky uložené",false);
 queueCloudPush(description)
}
function save(msg){
 updateSiteDeskSaveState("Ukladám...",true);
 const current=JSON.stringify(state);
 rememberPreviousState(msg||"Posledná zmena",current);
 lastCommittedState=current;
 siteDeskSchedulePersist(current,{backup:true});
 siteDeskQueueRender();
 updateSiteDeskSaveState("Automaticky uložené",false);
 queueCloudPush(msg||"Zmena údajov");
 if(msg)toast(msg)
}
function beginDirectUndo(label){if(directUndoActive)return;undoStack.push({data:lastCommittedState,label});if(undoStack.length>30)undoStack.shift();directUndoActive=true;updateUndoButton()}
function commitDirectState(){
 updateSiteDeskSaveState("Ukladám...",true);
 clearTimeout(directSaveTimer);
 directSaveTimer=setTimeout(()=>flushDirectState(),520)
}
function endDirectUndo(){
 if(directSaveTimer)flushDirectState();
 directUndoActive=false
}
window.addEventListener("beforeunload",()=>{if(directSaveTimer)flushDirectState();if(siteDeskPersistTimer)siteDeskFlushPersistNow()});
window.addEventListener("visibilitychange",()=>{if(document.hidden){if(directSaveTimer)flushDirectState();if(siteDeskPersistTimer)siteDeskFlushPersistNow()}});
setInterval(()=>{workPreviousIndexCache=new WeakMap();if(workSummaryTimer){cancelAnimationFrame(workSummaryTimer);workSummaryTimer=null;workSummaryPendingStatement=null}},10*60*1000);
function undoLast(){if(!undoStack.length){toast("Nie je čo vrátiť.");return}const entry=undoStack.pop();try{state=JSON.parse(entry.data);lastCommittedState=entry.data;siteDeskSchedulePersist(entry.data,{backup:true});directUndoActive=false;handoverDraft=null;handoverDraftKey="";renderAll();const active=document.querySelector(".view.active")?.id;if(active==="handover")prepareHandover(true);if(active==="workers")prepareWorkers();if(active==="siteMeetings")prepareControlDay();toast(`Vrátené: ${entry.label||"posledná zmena"}`)}catch{toast("Poslednú zmenu sa nepodarilo vrátiť.")}updateUndoButton()}function toast(t){const e=$("toast");e.textContent=t;e.classList.add("show");clearTimeout(window.tt);window.tt=setTimeout(()=>e.classList.remove("show"),2200)}function project(id){return state.projects.find(x=>x.id===id)}function company(id){return state.companies.find(x=>x.id===id)}function assignment(pid,cid){return state.assignments.find(x=>x.projectId===pid&&x.companyId===cid)}
function assignmentDocType(a){const t=String(a?.contractType||a?.documentType||"ZoD").trim().toLowerCase();return t.startsWith("obj")?"Obj":"ZoD"}
function assignmentDocShort(a){return assignmentDocType(a)==="Obj"?"Obj.":"ZoD"}
function assignmentDocName(a){return assignmentDocType(a)==="Obj"?"objednávky":"zmluvy o dielo"}
function assignmentDocRef(a){const no=String(a?.contractNo||"").trim();return `${assignmentDocShort(a)} ${no||"—"}`.trim()}
function activeProject(){return project(state.selectedProjectId)||state.projects[0]}function fmtDateISO(v){if(!v)return"";const [y,m,d]=v.split("-");return `${d}.${m}.${y}`}function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function isoLocalDate(v){const [y,m,d]=String(v).split("-").map(Number);return new Date(y,m-1,d)}
function localDateISO(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function addDaysISO(v,n){const d=isoLocalDate(v);d.setDate(d.getDate()+n);return localDateISO(d)}
function nextTuesdayISO(v){const d=isoLocalDate(v),day=d.getDay(),add=(2-day+7)%7;d.setDate(d.getDate()+add);return localDateISO(d)}
function forceTuesdayISO(v){const d=isoLocalDate(v);if(d.getDay()===2)return localDateISO(d);return nextTuesdayISO(v)}
function optionList(items,selected,label=x=>x.name,blank){return (blank!==undefined?`<option value="">${esc(blank)}</option>`:"")+items.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${esc(label(x))}</option>`).join("")}
let siteDeskViewRenderToken=0,siteDeskViewRenderFrame=0,siteDeskViewRenderTimer=0;
function scheduleSiteDeskViewRender(id){
 const token=++siteDeskViewRenderToken;
 cancelAnimationFrame(siteDeskViewRenderFrame);
 clearTimeout(siteDeskViewRenderTimer);
 const run=()=>{
  if(token!==siteDeskViewRenderToken||activeViewId()!==id)return;
  document.body.classList.add("view-rendering");
  try{renderActiveView(id)}finally{document.body.classList.remove("view-rendering")}
 };
 if(["workers","companies"].includes(id)){
  siteDeskViewRenderFrame=requestAnimationFrame(()=>{siteDeskViewRenderTimer=setTimeout(run,0)})
 }else run()
}
function showView(id){
 const requestedView=id;
 if(id==="controlDays"){selectedCoordinationKind="controlDay";id="siteMeetings"}
 else if(id==="siteMeetings")selectedCoordinationKind="coordination";
 document.body.classList.toggle("workers-focus-mode",id==="workers");
 document.body.classList.toggle("work-focus-mode",id==="workStatements");
 if($("siteSectionTitle"))$("siteSectionTitle").textContent=siteViewLabel(requestedView);
 document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id===id));
 document.querySelectorAll(".nav-btn").forEach(x=>x.classList.toggle("active",x.dataset.view===requestedView));
 $("sidebar").classList.remove("open");
 scheduleSiteDeskViewRender(id);
 window.scrollTo({top:0,behavior:"auto"})
}document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showView(b.dataset.view)}));window.__BETPRES_NAV_READY__=true;document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>{const m=$(b.dataset.close);m.classList.add("hidden");if(b.dataset.close==="assignCompanyModal"&&$("assignCompanySelect"))$("assignCompanySelect").disabled=false});document.querySelectorAll(".modal").forEach(m=>m.onclick=e=>{if(e.target===m)m.classList.add("hidden")});

function renderSiteDeskDashboardExtras(){
 const p=activeProject();
 if(!p)return;
 const assignmentRows=state.assignments.filter(a=>a.projectId===p.id),
       protocols=state.acceptanceProtocols.filter(x=>x.projectId===p.id);

 const today=todayISO(),
       todayDate=isoLocalDate(today),
       weekdayNames=["nedeľa","pondelok","utorok","streda","štvrtok","piatok","sobota"],
       monthLabel=new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"long",year:"numeric"}).format(todayDate);

 if($("dashboardTodayLabel"))$("dashboardTodayLabel").textContent=`${weekdayNames[todayDate.getDay()]} · ${monthLabel}`;
 if($("dashboardProjectManager"))$("dashboardProjectManager").textContent=p.manager||"Stavbyvedúci neuvedený";
 if($("dashboardProjectAddress"))$("dashboardProjectAddress").textContent=[p.address,p.city].filter(Boolean).join(" · ")||"Adresa stavby neuvedená";

 const meetings=state.controlDays.filter(x=>x.projectId===p.id&&coordinationRecordKind(x)==="coordination").sort((a,b)=>String(a.date||"").localeCompare(String(b.date||"")));
 const latestMeeting=meetings.at(-1),
       openTasks=(latestMeeting?.tasks||[]).filter(task=>task.status!=="Splnené");

 if($("dashboardOpenTasksMetric"))$("dashboardOpenTasksMetric").textContent=openTasks.length;
 if($("dashboardOpenTasksList")){
  $("dashboardOpenTasksList").innerHTML=openTasks.slice(0,6).map((task,index)=>`
   <div class="site-task-item">
    <span class="site-task-index">${index+1}</span>
    <div><strong>${esc(task.text||"Bez názvu úlohy")}</strong><small>${esc(controlDayTaskResponsible(task)||"Bez zodpovedného")} · ${task.deadline?fmtDateISO(task.deadline):"bez termínu"}</small></div>
   </div>`).join("")||`<div class="site-empty">Žiadne otvorené úlohy z poslednej koordinačnej porady.</div>`
 }

 const upcoming=state.calendarEvents
  .filter(event=>event.projectId===p.id&&event.date>=today)
  .sort((a,b)=>`${a.date} ${a.start||""}`.localeCompare(`${b.date} ${b.start||""}`))
  .slice(0,7);

 if($("dashboardTodayAgenda")){
  $("dashboardTodayAgenda").innerHTML=upcoming.map(event=>{
   const date=isoLocalDate(event.date),
         day=String(date.getDate()).padStart(2,"0"),
         month=String(date.getMonth()+1).padStart(2,"0");
   return `<div class="site-agenda-item">
    <span class="site-day">${day}.${month}</span>
    <div><strong>${esc(event.title||"Udalosť")}</strong><small>${esc(event.start?event.start+" · ":"")}${esc(event.companyId?company(event.companyId)?.name||"":"")}</small></div>
   </div>`
  }).join("")||`<div class="site-empty">V kalendári nie sú naplánované žiadne najbližšie udalosti.</div>`
 }

 const docs=[
  ...state.handovers.filter(x=>x.projectId===p.id).map(x=>({...x,kindLabel:"Odovzdanie pracoviska"})),
  ...state.acceptanceProtocols.filter(x=>x.projectId===p.id).map(x=>({...x,kindLabel:"Preberací protokol"})),
  ...state.controlDays.filter(x=>x.projectId===p.id&&x.savedToDocuments).map(x=>({...x,kindLabel:coordinationKindLabel(coordinationRecordKind(x))}))
 ].sort((a,b)=>String(b.updatedAt||b.date||"").localeCompare(String(a.updatedAt||a.date||""))).slice(0,6);


 if($("dashboardAcceptanceOverview")){
  const latestByCompany=new Map();
  protocols.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  protocols.forEach(rec=>{if(!latestByCompany.has(rec.companyId))latestByCompany.set(rec.companyId,rec)});
  const overview=assignmentRows.slice().sort((a,b)=>(company(a.companyId)?.name||"").localeCompare(company(b.companyId)?.name||""))
   .slice(0,6)
   .map(a=>{
    const rec=latestByCompany.get(a.companyId);
    const status=!rec?'<span class="acceptance-status-chip acceptance-status-missing">Chýba</span>':rec.result==='Prevzaté bez vád'?'<span class="acceptance-status-chip acceptance-status-done">Hotové</span>':'<span class="acceptance-status-chip acceptance-status-warn">S vadami</span>';
    const subtitle=rec?`Posledný protokol: ${fmtDateISO(rec.date)}`:`Bez uloženého preberacieho protokolu`;
    return `<div class="acceptance-overview-item"><div><strong>${esc(company(a.companyId)?.name||"")}</strong><small>${esc(a.scope||"—")}</small><small>${esc(subtitle)}</small></div>${status}</div>`
   });
  $("dashboardAcceptanceOverview").innerHTML=overview.join("")||'<div style="color:#789;padding:12px 0">Na stavbe zatiaľ nie sú priradené firmy.</div>';
 }
 if($("dashboardRecentDocs")){
  $("dashboardRecentDocs").innerHTML=docs.map(doc=>`
   <div class="site-doc-item">
    <span class="site-doc-icon">▤</span>
    <div><strong>${esc(doc.kindLabel)}</strong><small>${esc(fmtDateISO(doc.date||""))}${doc.number?` · ${esc(doc.number)}`:""}</small></div>
   </div>`).join("")||`<div class="site-empty">Zatiaľ nie sú uložené žiadne dokumenty.</div>`
 }
}

function updateSiteDeskSaveState(text="Automaticky uložené",saving=false){
 const indicator=$("saveStateIndicator");
 if(!indicator)return;
 indicator.classList.toggle("saving",saving);
 indicator.lastChild.textContent=` ${text}`
}

function siteViewLabel(id){
 return({
  dashboard:"Prehľad stavby",quick:"Rýchle zadávanie",calendar:"Kalendár",
  workers:"Stav pracovníkov",defects:"Vady a nedorobky",siteMeetings:"Koordinačné porady",controlDays:"Kontrolné dni",billing:"Fakturácia",
  workStatements:"Súpis prác",purchases:"Pasport skladu",materialSamples:"Vzorkovanie materiálov",documents:"Archív dokumentov",
  handover:"Odovzdanie pracoviska",acceptance:"Preberacie protokoly",
  projects:"Stavby",companies:"Firmy a zmluvy",excelImport:"Import z Excelu",appearance:"Vzhľad aplikácie",cloud:"Cloud a databáza",data:"Dáta a záloha"
 })[id]||"Stavebná evidencia"
}

function openSiteCommandPalette(){
 $("commandPalette").classList.remove("hidden");
 $("commandSearch").value="";
 document.querySelectorAll("#commandGrid button").forEach(button=>button.classList.remove("command-hidden"));
 setTimeout(()=>$("commandSearch").focus(),40)
}

$("openCommandPalette").onclick=openSiteCommandPalette;
$("commandSearch").oninput=()=>{
 const query=$("commandSearch").value.trim().toLowerCase();
 document.querySelectorAll("#commandGrid button").forEach(button=>{
  button.classList.toggle("command-hidden",!String(button.dataset.commandLabel||"").includes(query))
 })
};
document.querySelectorAll("#commandGrid [data-go]").forEach(button=>{
 button.addEventListener("click",()=>$("commandPalette").classList.add("hidden"))
});
document.addEventListener("keydown",event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
  event.preventDefault();openSiteCommandPalette()
 }
 if(event.key==="Escape")$("commandPalette")?.classList.add("hidden")
});


function normalizeUiText(value){
 return String(value||"").replace(/\s+/g," ").trim().toLowerCase()
}
function siteDeskUiNodes(selector){
 const roots=[
  document.querySelector(".view.active"),
  document.querySelector(".site-topbar"),
  ...document.querySelectorAll(".modal:not(.hidden)")
 ].filter(Boolean),seen=new Set(),nodes=[];
 roots.forEach(root=>{
  if(root.matches?.(selector)&&!seen.has(root)){seen.add(root);nodes.push(root)}
  root.querySelectorAll(selector).forEach(node=>{
   if(!seen.has(node)){seen.add(node);nodes.push(node)}
  })
 });
 return nodes
}
function applySiteDesk3UI(){
 document.body.classList.add("sitedesk-v3");

 siteDeskUiNodes("button").forEach(button=>{
  if(button.classList.contains("nav-btn")||button.closest(".site-command-grid"))return;

  const text=normalizeUiText(button.textContent),
        attrs=[...button.attributes].map(attribute=>`${attribute.name}=${attribute.value}`).join(" ").toLowerCase();

  button.classList.remove("ui-primary","ui-secondary","ui-info","ui-danger","ui-close");

  if(button.classList.contains("close")||text==="×"){
   button.classList.add("ui-close");
   button.setAttribute("aria-label","Zatvoriť okno");
   if(!button.title)button.title="Zatvoriť"
  }else if(
   text.includes("vymazať")||
   text.includes("odstrániť")||
   attrs.includes("data-del-")||
   attrs.includes("data-delete-")||
   button.classList.contains("danger")||
   button.classList.contains("excel-delete")
  ){
   button.classList.add("ui-danger");
   if(!button.title)button.title="Vymazať položku"
  }else if(
   text.includes("aktualizovať náhľad")||
   text.includes("upraviť")||
   text.includes("obnoviť")||
   text.includes("predchádzajúci")||
   text.includes("nasledujúci")
  ){
   button.classList.add("ui-info")
  }else if(
   text.startsWith("uložiť")||
   text.startsWith("+ pridať")||
   text.startsWith("pridať")||
   text.startsWith("vytvoriť")||
   text.startsWith("potvrdiť")||
   text.startsWith("nainštalovať")
  ){
   button.classList.add("ui-primary")
  }else if(
   text.includes("exportovať")||
   text.includes("tlačiť")||
   text.includes("náhľad")||
   text.includes("zrušiť")||
   text.includes("späť")||
   button.classList.contains("ghost")
  ){
   button.classList.add("ui-secondary")
  }
 });

 siteDeskUiNodes(".row-actions").forEach(group=>group.setAttribute("role","group"));
 siteDeskUiNodes(".page-title .header-actions").forEach(group=>group.setAttribute("aria-label","Akcie modulu"));
 siteDeskUiNodes("table").forEach(table=>table.setAttribute("data-ui-table","true"));

 const section=document.querySelector(".view.active");
 if(section&&$("siteSectionTitle")){
  const heading=section.querySelector(".page-title h1");
  if(heading)$("siteSectionTitle").textContent=heading.textContent.trim()
 }
}


const CLOUD_CONFIG_KEY=KEY+"-cloud-config";
const CLOUD_SESSION_KEY=KEY+"-cloud-session";
const CLOUD_PRE_PULL_BACKUP_KEY=KEY+"-pre-cloud-pull";
const CLOUD_PRE_PUSH_BACKUP_KEY=KEY+"-pre-cloud-push";
const SITE_DESK_MOBILE_URL="https://d668kmshfv-sudo.github.io/betpres-sitedesk-mobile/";
let cloudConfig=loadCloudConfig();
let cloudSession=loadCloudSession();
let cloudPushTimer=null;
let cloudPollTimer=null;
let cloudPushRunning=false;
let cloudLastPushBackupAt=0;
let cloudRemoteCheckRunning=false;
let cloudLastLocalChangeAt=0;
let cloudLocalDirty=false;
let cloudPendingDescription="Synchronizácia údajov";
let cloudTeamMembers=[];
let cloudTeamActivity=[];
let cloudPilotFeedback=[];

function loadCloudConfig(){
 try{
  return Object.assign({
   url:"",
   key:"",
   workspaceName:"Medická – pilot",
   autoSync:false,
   lastCloudVersion:0,
   lastCloudUpdatedAt:"",
   lastCloudId:"",
   currentRole:"none",
   displayName:"",
   lastEmail:"",
   deviceId:localStorage.getItem(KEY+"-device-id")||uid("device")
  },JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY)||"{}"))
  }catch{return{url:"",key:"",workspaceName:"Medická – pilot",autoSync:false,lastCloudVersion:0,lastCloudUpdatedAt:"",lastCloudId:"",currentRole:"none",displayName:"",lastEmail:"",deviceId:uid("device")}}
}
function saveCloudConfig(){
 localStorage.setItem(KEY+"-device-id",cloudConfig.deviceId);
 localStorage.setItem(CLOUD_CONFIG_KEY,JSON.stringify(cloudConfig))
}
function loadCloudSession(){
 try{return JSON.parse(localStorage.getItem(CLOUD_SESSION_KEY)||"null")}catch{return null}
}
function saveCloudSession(session){
 cloudSession=session||null;
 if(cloudSession)localStorage.setItem(CLOUD_SESSION_KEY,JSON.stringify(cloudSession));
 else localStorage.removeItem(CLOUD_SESSION_KEY);
 renderCloudPanel()
}
function normalizeCloudUrl(value){
 return String(value||"").trim().replace(/\/+$/,"")
}
function cloudConfigured(){
 return Boolean(normalizeCloudUrl(cloudConfig.url)&&String(cloudConfig.key||"").trim())
}
function cloudAuthHeaders(json=true){
 const headers={apikey:cloudConfig.key};
 if(cloudSession?.access_token)headers.Authorization=`Bearer ${cloudSession.access_token}`;
 if(json)headers["Content-Type"]="application/json";
 return headers
}
async function cloudFetch(path,options={},requireAuth=true){
 if(!cloudConfigured())throw new Error("Najprv ulož Project URL a publishable/anon key.");
 if(requireAuth)await cloudEnsureSession();
 const response=await fetch(normalizeCloudUrl(cloudConfig.url)+path,{
  ...options,
  headers:{...cloudAuthHeaders(options.json!==false),...(options.headers||{})}
 });
 if(!response.ok){
  let message=`HTTP ${response.status}`;
  try{
   const body=await response.json();
   message=body.msg||body.message||body.error_description||body.error||message
  }catch{
   try{message=await response.text()||message}catch{}
  }
  throw new Error(message)
 }
 if(response.status===204)return null;
 const type=response.headers.get("content-type")||"";
 return type.includes("application/json")?response.json():response
}
async function cloudEnsureSession(){
 if(!cloudSession?.access_token)throw new Error("Nie si prihlásený.");
 const expiresAt=Number(cloudSession.expires_at||0);
 if(expiresAt&&expiresAt-Date.now()/1000>90)return cloudSession;
 if(!cloudSession.refresh_token)throw new Error("Prihlásenie vypršalo. Prihlás sa znova.");
 const data=await cloudFetch("/auth/v1/token?grant_type=refresh_token",{
  method:"POST",
  body:JSON.stringify({refresh_token:cloudSession.refresh_token})
 },false);
 if(!data?.access_token)throw new Error("Prihlásenie sa nepodarilo obnoviť.");
 data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in||3600);
 saveCloudSession(data);
 return data
}
async function cloudSignIn(){
 const email=$("cloudEmail").value.trim(),
       password=$("cloudPassword").value,
       displayName=$("cloudDisplayName").value.trim();
 if(!email||!password){setCloudMessage("cloudAuthMessage","Zadaj e-mail aj heslo.","error");return}
 try{
  setCloudMessage("cloudAuthMessage","Prihlasujem...","");
  const data=await cloudFetch("/auth/v1/token?grant_type=password",{
   method:"POST",
   body:JSON.stringify({email,password})
  },false);
  data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in||3600);
  saveCloudSession(data);
  cloudConfig.lastEmail=email;
  cloudConfig.displayName=displayName||cloudConfig.displayName||"";
  saveCloudConfig();
  if(displayName)await cloudUpdateOwnProfile(displayName);
  $("cloudPassword").value="";
  setCloudMessage("cloudAuthMessage","Prihlásenie bolo úspešné. Na tomto počítači ostaneš prihlásený.","success");
  await cloudRefreshWorkspaceStatus();
  await cloudLoadTeamContext()
 }catch(error){setCloudMessage("cloudAuthMessage",error.message,"error")}
}
async function cloudSignUp(){
 const email=$("cloudEmail").value.trim(),
       password=$("cloudPassword").value,
       displayName=$("cloudDisplayName").value.trim();
 if(!email||password.length<6){setCloudMessage("cloudAuthMessage","Zadaj e-mail a heslo s minimálne 6 znakmi.","error");return}
 try{
  setCloudMessage("cloudAuthMessage","Vytváram účet...","");
  const data=await cloudFetch("/auth/v1/signup",{
   method:"POST",
   body:JSON.stringify({email,password,data:{display_name:displayName||email.split("@")[0]}})
  },false);
  cloudConfig.lastEmail=email;
  cloudConfig.displayName=displayName||cloudConfig.displayName||"";
  saveCloudConfig();
  if(data?.session){
   data.session.expires_at=Math.floor(Date.now()/1000)+Number(data.session.expires_in||3600);
   saveCloudSession(data.session);
   if(displayName)await cloudUpdateOwnProfile(displayName)
  }
  setCloudMessage("cloudAuthMessage",data?.session?"Účet bol vytvorený a používateľ je prihlásený.":"Účet bol vytvorený. Potvrď e-mail a potom sa prihlás.","success")
 }catch(error){setCloudMessage("cloudAuthMessage",error.message,"error")}
}
async function cloudSignOut(){
 try{
  if(cloudSession?.access_token)await cloudFetch("/auth/v1/logout",{method:"POST"},true)
 }catch{}
 saveCloudSession(null);
 cloudTeamMembers=[];
 cloudTeamActivity=[];
 cloudPilotFeedback=[];
 cloudConfig.currentRole="none";
 saveCloudConfig();
 setCloudMessage("cloudAuthMessage","Používateľ bol odhlásený.","success")
}
function cloudSessionUser(){
 return cloudSession?.user||null
}
function setCloudMessage(id,message,type=""){
 const element=$(id);
 if(!element)return;
 element.textContent=message;
 element.classList.remove("error","success");
 if(type)element.classList.add(type)
}
function cloudSetQuickStatus(mode,text){
 const button=$("cloudQuickStatus");
 if(!button)return;
 button.classList.remove("local","connected","syncing","conflict");
 button.classList.add(mode);
 const labels={local:cloudConfigured()?"Cloud pripravený":"Uložené lokálne",connected:"Synchronizované",syncing:"Synchronizujem",conflict:text==="Novšie dáta v cloude"?"Novšie dáta":"Vyžaduje kontrolu"};
 $("cloudQuickStatusText").textContent=labels[mode]||"Stav uloženia";
 button.title=`${text||labels[mode]||"Stav synchronizácie"}. Podrobnosti a technická verzia zálohy sú v nastaveniach.`
}
async function testCloudConnection(){
 cloudConfig.url=normalizeCloudUrl($("cloudProjectUrl").value);
 cloudConfig.key=$("cloudPublishableKey").value.trim();
 cloudConfig.workspaceName=$("cloudWorkspaceName").value.trim()||"Medická – pilot";
 saveCloudConfig();
 try{
  setCloudMessage("cloudSyncMessage","Testujem Supabase projekt...","");
  await cloudFetch("/auth/v1/settings",{method:"GET"},false);
  setCloudMessage("cloudSyncMessage","Project URL a verejný kľúč sú platné.","success");
  cloudSetQuickStatus(cloudSession?"connected":"local",cloudSession?"Cloud pripojený":"Projekt nastavený")
 }catch(error){
  setCloudMessage("cloudSyncMessage",error.message,"error");
  cloudSetQuickStatus("conflict","Chyba pripojenia")
 }
 renderCloudPanel()
}
function workspaceQuery(){
 return `/rest/v1/sitedesk_workspaces?name=eq.${encodeURIComponent(cloudConfig.workspaceName)}&select=*`
}
async function cloudGetWorkspace(){
 const rows=await cloudFetch(workspaceQuery(),{
  method:"GET",
  headers:{Accept:"application/json"}
 });
 return Array.isArray(rows)?rows[0]||null:null
}
async function cloudRpc(name,payload={}){
 return cloudFetch(`/rest/v1/rpc/${name}`,{
  method:"POST",
  headers:{Prefer:"return=representation"},
  body:JSON.stringify(payload)
 })
}
async function cloudUpdateOwnProfile(displayName){
 const currentUser=cloudSessionUser();
 if(!currentUser?.id||!displayName)return;
 try{
  await cloudFetch(`/rest/v1/sitedesk_profiles?user_id=eq.${encodeURIComponent(currentUser.id)}`,{
   method:"PATCH",
   headers:{Prefer:"return=minimal"},
   body:JSON.stringify({display_name:displayName,updated_at:new Date().toISOString()})
  })
 }catch(error){console.warn("Profil sa nepodarilo aktualizovať",error)}
}
async function cloudLoadCurrentRole(workspaceId){
 if(!workspaceId){
  cloudConfig.currentRole="none";
  saveCloudConfig();
  return"none"
 }
 const result=await cloudRpc("sitedesk_current_role",{p_workspace_id:workspaceId});
 const role=Array.isArray(result)?result[0]:result;
 cloudConfig.currentRole=role||"none";
 saveCloudConfig();
 return cloudConfig.currentRole
}
async function cloudLoadMembers(workspaceId){
 if(!workspaceId){cloudTeamMembers=[];return[]}
 const result=await cloudRpc("sitedesk_list_members",{p_workspace_id:workspaceId});
 cloudTeamMembers=Array.isArray(result)?result:[];
 return cloudTeamMembers
}
async function cloudLoadActivity(workspaceId){
 if(!workspaceId){cloudTeamActivity=[];return[]}
 const result=await cloudRpc("sitedesk_list_activity",{p_workspace_id:workspaceId,p_limit:30});
 cloudTeamActivity=Array.isArray(result)?result:[];
 return cloudTeamActivity
}
async function cloudLoadPilotFeedback(workspaceId){
 if(!workspaceId){cloudPilotFeedback=[];return[]}
 const result=await cloudFetch(`/rest/v1/sitedesk_pilot_feedback?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=*&order=created_at.desc&limit=50`,{
  method:"GET",
  headers:{Accept:"application/json"}
 });
 cloudPilotFeedback=Array.isArray(result)?result:[];
 return cloudPilotFeedback
}
async function cloudLoadTeamContext(workspace=null){
 try{
  const remote=workspace||await cloudGetWorkspace();
  if(!remote){
   cloudConfig.currentRole="none";
   cloudTeamMembers=[];
   cloudTeamActivity=[];
   cloudPilotFeedback=[];
   saveCloudConfig();
   renderCloudPanel();
   return
  }
  cloudConfig.lastCloudId=remote.id;
  await cloudLoadCurrentRole(remote.id);
  await Promise.all([
   cloudLoadMembers(remote.id),
   cloudLoadActivity(remote.id),
   cloudLoadPilotFeedback(remote.id)
  ]);
  renderCloudPanel()
 }catch(error){
  setCloudMessage("teamMessage",error.message,"error")
 }
}
async function cloudAddTeamMember(){
 const remote=await cloudGetWorkspace(),
       workspaceId=cloudConfig.lastCloudId||remote?.id||"",
       email=$("teamMemberEmail").value.trim(),
       role=$("teamMemberRole").value;
 if(!workspaceId||!email)return setCloudMessage("teamMessage","Zadaj e-mail kolegu a načítaj pracovný priestor.","error");
 try{
  await cloudRpc("sitedesk_add_member",{p_workspace_id:workspaceId,p_email:email,p_role:role});
  $("teamMemberEmail").value="";
  setCloudMessage("teamMessage","Kolega bol pridaný do tímu.","success");
  await cloudLoadTeamContext(remote)
 }catch(error){setCloudMessage("teamMessage",error.message,"error")}
}
async function cloudUpdateTeamMember(userId,role){
 try{
  await cloudRpc("sitedesk_update_member_role",{p_workspace_id:cloudConfig.lastCloudId,p_user_id:userId,p_role:role});
  setCloudMessage("teamMessage","Rola používateľa bola zmenená.","success");
  await cloudLoadTeamContext()
 }catch(error){setCloudMessage("teamMessage",error.message,"error")}
}
async function cloudRemoveTeamMember(userId,email){
 if(!confirm(`Odobrať používateľa ${email} z tímu?`))return;
 try{
  await cloudRpc("sitedesk_remove_member",{p_workspace_id:cloudConfig.lastCloudId,p_user_id:userId});
  setCloudMessage("teamMessage","Používateľ bol odobratý.","success");
  await cloudLoadTeamContext()
 }catch(error){setCloudMessage("teamMessage",error.message,"error")}
}
async function cloudSubmitPilotFeedback(){
 const text=$("pilotFeedbackText").value.trim(),
       category=$("pilotFeedbackCategory").value,
       currentUser=cloudSessionUser();
 if(!text)return toast("Najprv napíš pripomienku.");
 if(!cloudConfig.lastCloudId||!currentUser?.id)return toast("Najprv sa prihlás a načítaj pracovný priestor.");
 try{
  await cloudFetch("/rest/v1/sitedesk_pilot_feedback",{
   method:"POST",
   headers:{Prefer:"return=minimal"},
   body:JSON.stringify({
    workspace_id:cloudConfig.lastCloudId,
    user_id:currentUser.id,
    user_email:currentUser.email||"",
    category,
    feedback:text
   })
  });
  $("pilotFeedbackText").value="";
  await cloudLoadPilotFeedback(cloudConfig.lastCloudId);
  renderCloudPanel();
  toast("Pripomienka bola uložená.")
 }catch(error){toast(`Pripomienku sa nepodarilo uložiť: ${error.message}`)}
}

function dataUrlToBlob(dataUrl){
 const [header,data]=String(dataUrl).split(","),
       mime=header.match(/data:([^;]+)/)?.[1]||"image/jpeg",
       binary=atob(data),
       bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return new Blob([bytes],{type:mime})
}
function encodeStoragePath(path){
 return String(path).split("/").map(encodeURIComponent).join("/")
}
async function cloudUploadPhoto(defect,photo,workspaceId){
 if(photo.path)return photo.path;
 if(!photo.dataUrl)return"";
 const currentUser=cloudSessionUser();
 if(!currentUser?.id||!workspaceId)throw new Error("Fotografiu nie je možné nahrať bez pracovného priestoru.");
 const extension=photo.type==="image/png"?"png":"jpg",
       photoId=photo.id||uid("photo"),
       path=`${workspaceId}/defects/${defect.id}/${photoId}.${extension}`,
       response=await fetch(`${normalizeCloudUrl(cloudConfig.url)}/storage/v1/object/sitedesk-files/${encodeStoragePath(path)}`,{
        method:"POST",
        headers:{
         apikey:cloudConfig.key,
         Authorization:`Bearer ${cloudSession.access_token}`,
         "Content-Type":dataUrlToBlob(photo.dataUrl).type,
         "x-upsert":"true"
        },
        body:dataUrlToBlob(photo.dataUrl)
       });
 if(!response.ok){
  let message=`Nahratie fotografie zlyhalo (${response.status}).`;
  try{message=(await response.json()).message||message}catch{}
  throw new Error(message)
 }
 photo.id=photoId;
 photo.path=path;
 return path
}
async function cloudPrepareState(workspaceId){
 const cloudData=typeof structuredClone==="function"?structuredClone(state):clone(state);
 let localStateChanged=false;
 for(const defect of state.defects||[]){
  const cloudDefect=cloudData.defects.find(item=>item.id===defect.id);
  if(!cloudDefect)continue;
  cloudDefect.photos=Array.isArray(cloudDefect.photos)?cloudDefect.photos:[];
  for(let index=0;index<(defect.photos||[]).length;index++){
   const localPhoto=defect.photos[index],
         cloudPhoto=cloudDefect.photos[index];
   if(localPhoto.dataUrl&&!localPhoto.path){await cloudUploadPhoto(defect,localPhoto,workspaceId);localStateChanged=true}
   if(localPhoto.path)cloudPhoto.path=localPhoto.path;
   delete cloudPhoto.dataUrl
  }
 }
 if(localStateChanged){
  const serialized=JSON.stringify(state);
  lastCommittedState=serialized;
  siteDeskSchedulePersist(serialized,{backup:false})
 }
 return cloudData
}
async function cloudPush({force=false,silent=false}={}){
 if(cloudPushRunning)return;
 cloudPushRunning=true;
 cloudSetQuickStatus("syncing","Synchronizujem");
 try{
  await cloudEnsureSession();
  const nowMs=Date.now();
  if(nowMs-cloudLastPushBackupAt>5*60*1000){
   localStorage.setItem(CLOUD_PRE_PUSH_BACKUP_KEY,lastCommittedState||JSON.stringify(state));
   cloudLastPushBackupAt=nowMs
  }
  let remote=await cloudGetWorkspace();
  const currentUser=cloudSessionUser(),
        now=new Date().toISOString();

  if(!remote){
   throw new Error("Pracovný priestor nie je dostupný. Vlastník musí najprv pridať tento účet do tímu.")
  }

  const role=await cloudLoadCurrentRole(remote.id);
  if(!["owner","editor"].includes(role))throw new Error("Tento účet má prístup iba na čítanie.");
  if(force&&role!=="owner")throw new Error("Nútené prepísanie môže použiť iba vlastník.");

  if(!force&&Number(remote.data_version||0)>Number(cloudConfig.lastCloudVersion||0)){
   cloudSetQuickStatus("conflict","Konflikt dát");
   setCloudMessage("cloudSyncMessage","Cloud obsahuje novšiu verziu. Najprv načítaj aktuálne dáta. Tvoje lokálne údaje zostali zachované.","error");
   return
  }

  const cloudData=await cloudPrepareState(remote.id),
        result=await cloudRpc("sitedesk_save_workspace",{
         p_workspace_id:remote.id,
         p_expected_version:Number(remote.data_version||0),
         p_data:cloudData,
         p_device_id:cloudConfig.deviceId,
         p_description:cloudPendingDescription||"Synchronizácia údajov"
        }),
        saveResult=Array.isArray(result)?result[0]:result;

  if(!saveResult?.success){
   cloudSetQuickStatus("conflict","Konflikt dát");
   setCloudMessage("cloudSyncMessage",`Uloženie bolo zastavené. Cloud je už vo verzii ${saveResult?.current_version||"novšej"}. Najprv načítaj cloudové dáta.`,"error");
   return
  }

  cloudConfig.lastCloudVersion=Number(saveResult.data_version||remote.data_version+1);
  cloudConfig.lastCloudUpdatedAt=saveResult.updated_at||now;
  cloudConfig.lastCloudId=remote.id;
  cloudPendingDescription="Synchronizácia údajov";
  cloudLocalDirty=false;
  saveCloudConfig();
  cloudSetQuickStatus("connected",`Cloud v${cloudConfig.lastCloudVersion}`);
  setCloudMessage("cloudSyncMessage",`Dáta boli uložené. Cloudová verzia ${cloudConfig.lastCloudVersion}.`,"success");
  await cloudLoadTeamContext({...remote,data_version:cloudConfig.lastCloudVersion,updated_at:cloudConfig.lastCloudUpdatedAt});
  if(!silent)toast("Cloudová synchronizácia dokončená.")
 }catch(error){
  cloudSetQuickStatus("conflict","Chyba cloudu");
  setCloudMessage("cloudSyncMessage",error.message,"error");
  if(!silent)toast("Synchronizácia zlyhala.")
 }finally{
  cloudPushRunning=false;
  renderCloudPanel()
 }
}
async function cloudPull({silent=false}={}){
 try{
  cloudSetQuickStatus("syncing","Načítavam cloud");
  await cloudEnsureSession();
  const remote=await cloudGetWorkspace();
  if(!remote?.data)throw new Error("V cloude zatiaľ nie sú uložené žiadne dáta.");
  localStorage.setItem(CLOUD_PRE_PULL_BACKUP_KEY,JSON.stringify(state));
  const imported=remote.data;
  if(!Array.isArray(imported.projects)||!Array.isArray(imported.companies))throw new Error("Cloudový záznam nemá platný formát SiteDesk.");
  state=imported;
  ["projects","companies","assignments","billings","materials","purchases","handovers","workerSheets","betpresTimesheets","thpTimesheets","companyHourTimesheets","acceptanceProtocols","siteMeetings","controlDays","documentVersions","calendarEvents","workStatements","workBudgets","defects","mobileDiary","materialSamples"].forEach(key=>{
   if(!Array.isArray(state[key]))state[key]=[]
  });
  const serialized=JSON.stringify(state);
  localStorage.setItem(KEY,serialized);
  lastCommittedState=serialized;
  cloudConfig.lastCloudVersion=Number(remote.data_version||0);
  cloudConfig.lastCloudUpdatedAt=remote.updated_at||"";
  cloudConfig.lastCloudId=remote.id||"";
  cloudLocalDirty=false;
  saveCloudConfig();
  await cloudLoadTeamContext(remote);
  renderAll();
  cloudSetQuickStatus("connected",`Cloud v${cloudConfig.lastCloudVersion}`);
  setCloudMessage("cloudSyncMessage",`Cloudové dáta boli načítané. Verzia ${cloudConfig.lastCloudVersion}.`,"success");
  if(!silent)toast("Načítané údaje z cloudu.")
 }catch(error){
  cloudSetQuickStatus("conflict","Chyba načítania");
  setCloudMessage("cloudSyncMessage",error.message,"error")
 }
}
async function cloudRefreshWorkspaceStatus(){
 if(!cloudConfigured()){renderCloudPanel();return}
 try{
  await cloudEnsureSession();
  const remote=await cloudGetWorkspace();
  if(remote){
   cloudConfig.lastCloudId=remote.id||cloudConfig.lastCloudId;
   await cloudLoadTeamContext(remote);
   $("cloudVersionLabel").textContent=`v${remote.data_version||1}`;
   $("cloudVersionDetail").textContent=`Aktualizované ${new Date(remote.updated_at).toLocaleString("sk-SK")}`;
   if(Number(remote.data_version||0)>Number(cloudConfig.lastCloudVersion||0)){
    cloudSetQuickStatus("conflict","Novšie dáta v cloude");
    setCloudMessage("cloudSyncMessage","V cloude je novšia verzia. Načítaj ju do počítača.","error")
   }else cloudSetQuickStatus("connected",`Cloud v${remote.data_version||1}`)
  }else{
   cloudConfig.currentRole="none";
   $("cloudVersionLabel").textContent="Nedostupný";
   $("cloudVersionDetail").textContent="Vlastník musí najprv pridať tento účet do tímu.";
   cloudSetQuickStatus("conflict","Bez prístupu")
  }
 }catch(error){
  cloudSetQuickStatus("conflict","Cloud nedostupný");
  setCloudMessage("cloudSyncMessage",error.message,"error")
 }
 renderCloudPanel()
}
function queueCloudPush(description=""){
 cloudLastLocalChangeAt=Date.now();
 cloudLocalDirty=true;
 if(description)cloudPendingDescription=description;
 if(!cloudConfig.autoSync||!cloudSession?.access_token)return;
 if(!["owner","editor"].includes(cloudConfig.currentRole))return;
 clearTimeout(cloudPushTimer);
 cloudPushTimer=setTimeout(()=>siteDeskRunIdle(()=>cloudPush({silent:true})),4500)
}
function startCloudPolling(){
 clearInterval(cloudPollTimer);
 if(!cloudConfig.autoSync||!cloudSession?.access_token)return;
 cloudPollTimer=setInterval(async()=>{
  if(document.hidden||cloudRemoteCheckRunning||cloudPushRunning)return;
  cloudRemoteCheckRunning=true;
  try{
   const remote=await cloudGetWorkspace();
   if(remote&&Number(remote.data_version||0)>Number(cloudConfig.lastCloudVersion||0)){
    if(!cloudLocalDirty)await cloudPull({silent:true});
    else{
     cloudSetQuickStatus("conflict","Konflikt dát");
     setCloudMessage("cloudSyncMessage","V cloude je novšia verzia a v tomto počítači sú neodoslané zmeny. Najprv rozhodni, ktorú verziu zachovať.","error")
    }
   }
  }catch{}
  cloudRemoteCheckRunning=false
 },60000)
}
function renderCloudPanel(){
 if(!$("cloudProjectUrl"))return;
 $("cloudProjectUrl").value=cloudConfig.url||"";
 $("cloudPublishableKey").value=cloudConfig.key||"";
 $("cloudWorkspaceName").value=cloudConfig.workspaceName||"Medická – pilot";
 $("cloudDisplayName").value=cloudConfig.displayName||"";
 if(!$("cloudEmail").value)$("cloudEmail").value=cloudSessionUser()?.email||cloudConfig.lastEmail||"";
 $("cloudAutoSync").checked=Boolean(cloudConfig.autoSync);
 const currentUser=cloudSessionUser(),
       role=cloudConfig.currentRole||"none",
       canEdit=["owner","editor"].includes(role),
       isOwner=role==="owner";
 if(!cloudConfigured()){
  $("cloudConnectionLabel").textContent="Nenastavené";
  $("cloudConnectionDetail").textContent="Doplň Project URL a verejný kľúč.";
  cloudSetQuickStatus("local","Iba lokálne")
 }else{
  $("cloudConnectionLabel").textContent="Projekt nastavený";
  $("cloudConnectionDetail").textContent=normalizeCloudUrl(cloudConfig.url).replace("https://","")
 }
 if(currentUser){
  $("cloudUserLabel").textContent=cloudConfig.displayName||currentUser.email||"Prihlásený";
  $("cloudUserDetail").textContent=`${currentUser.email||""} · ${roleLabel(role)}`;
  $("cloudSignOut").classList.remove("hidden");
  $("cloudSignIn").classList.add("hidden");
  $("cloudSignUp").classList.add("hidden");
  $("cloudModeLabel").textContent=cloudConfig.autoSync?"Automatický cloud":"Ručný cloud";
  $("cloudModeDetail").textContent=canEdit?(cloudConfig.autoSync?"Zmeny sa odosielajú automaticky.":"Synchronizácia sa spúšťa tlačidlom."):"Účet má prístup iba na čítanie.";
  if(cloudConfig.lastCloudVersion)$("cloudVersionLabel").textContent=`v${cloudConfig.lastCloudVersion}`
 }else{
  $("cloudUserLabel").textContent="Neprihlásený";
  $("cloudUserDetail").textContent="Každý kolega používa vlastný účet.";
  $("cloudSignOut").classList.add("hidden");
  $("cloudSignIn").classList.remove("hidden");
  $("cloudSignUp").classList.remove("hidden");
  $("cloudModeLabel").textContent="Lokálny";
  $("cloudModeDetail").textContent="Lokálne dáta zostávajú zachované."
 }
 $("cloudPushData").disabled=Boolean(currentUser)&&!canEdit;
 $("cloudForcePush").classList.toggle("hidden",!isOwner);
 $("cloudAutoSync").disabled=Boolean(currentUser)&&!canEdit;
 $("pairMobileDevice").disabled=!cloudConfigured();

 const badge=$("cloudCurrentRoleBadge");
 badge.textContent=roleLabel(role);
 badge.className=`team-role-badge ${role}`;
 $("teamOwnerControls").classList.toggle("hidden",!isOwner);

 $("teamMembersBody").innerHTML=cloudTeamMembers.length?cloudTeamMembers.map(member=>{
  const memberRole=member.role||"viewer",
        memberIsOwner=memberRole==="owner",
        actions=isOwner&&!memberIsOwner
         ?`<div class="team-member-actions"><button class="danger" data-remove-team-member="${member.user_id}" data-member-email="${esc(member.email||"")}">Odobrať</button></div>`
         :"";
  return`<tr>
   <td class="team-user"><strong>${esc(member.display_name||member.email||"Používateľ")}</strong><small>${esc(member.email||"")}</small></td>
   <td>${isOwner&&!memberIsOwner
    ?`<select class="team-role-select" data-team-role-user="${member.user_id}"><option value="editor" ${memberRole==="editor"?"selected":""}>Editor</option><option value="viewer" ${memberRole==="viewer"?"selected":""}>Čítanie</option></select>`
    :`<span class="team-role-badge ${memberRole}">${roleLabel(memberRole)}</span>`}</td>
   <td>${member.created_at?new Date(member.created_at).toLocaleDateString("sk-SK"):"—"}</td>
   <td>${actions}</td>
  </tr>`
 }).join(""):`<tr><td colspan="4" class="team-empty">Po prihlásení načítaj tím pracovného priestoru.</td></tr>`;

 document.querySelectorAll("[data-team-role-user]").forEach(select=>select.onchange=()=>cloudUpdateTeamMember(select.dataset.teamRoleUser,select.value));
 document.querySelectorAll("[data-remove-team-member]").forEach(button=>button.onclick=()=>cloudRemoveTeamMember(button.dataset.removeTeamMember,button.dataset.memberEmail));

 $("teamActivityList").innerHTML=cloudTeamActivity.length?cloudTeamActivity.map(item=>`
  <article class="team-activity-item">
   <header><strong>${esc(item.display_name||item.user_email||"Používateľ")}</strong><time>${new Date(item.created_at).toLocaleString("sk-SK")}</time></header>
   <p>${esc(item.description||item.action||"Cloudová zmena")}</p>
   <small>Verzia ${item.data_version||"—"} · ${esc(item.module||"SiteDesk")}</small>
  </article>`).join(""):`<div class="team-empty">Zatiaľ bez cloudovej histórie.</div>`;

 $("pilotFeedbackList").innerHTML=cloudPilotFeedback.length?cloudPilotFeedback.map(item=>`
  <article class="pilot-feedback-item">
   <header><div><strong>${esc(item.user_email||"Používateľ")}</strong> <span class="feedback-category">${esc(item.category||"Všeobecné")}</span></div><time>${new Date(item.created_at).toLocaleString("sk-SK")}</time></header>
   <p>${esc(item.feedback||"")}</p>
  </article>`).join(""):`<div class="team-empty">Zatiaľ bez pripomienok.</div>`;

 startCloudPolling()
}

function encodePairingPayload(value){
 const bytes=new TextEncoder().encode(JSON.stringify(value));
 let binary="";
 for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
 return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")
}
function mobilePairingLink(){
 const email=cloudSessionUser()?.email||cloudConfig.lastEmail||$("cloudEmail")?.value.trim()||"";
 const payload={
  type:"BETPRES_SITEDESK_PAIRING",
  version:1,
  url:normalizeCloudUrl(cloudConfig.url),
  publishableKey:String(cloudConfig.key||""),
  workspaceName:cloudConfig.workspaceName||"Medická – pilot",
  email
 };
 return `${SITE_DESK_MOBILE_URL}?pair=${encodePairingPayload(payload)}`
}
async function openMobilePairing(){
 if(!cloudConfigured())return toast("Najprv ulož Project URL a publishable/anon kľúč.");
 const modal=$("mobilePairingModal"),image=$("mobilePairingQr"),status=$("mobilePairingQrStatus"),link=mobilePairingLink();
 $("mobilePairingLink").value=link;
 image.removeAttribute("src");
 status.hidden=false;
 status.textContent="Pripravujem QR kód…";
 modal.classList.remove("hidden");
 try{
  if(!window.betpresDesktop?.createPairingQr)throw new Error("Generovanie QR nie je dostupné.");
  image.src=await window.betpresDesktop.createPairingQr(link);
  status.hidden=true
 }catch(error){status.textContent=error.message||"QR kód sa nepodarilo pripraviť. Použi párovací odkaz."}
}
async function copyMobilePairingLink(){
 const input=$("mobilePairingLink"),value=input.value;
 try{await navigator.clipboard.writeText(value)}catch{input.select();document.execCommand("copy")}
 toast("Párovací odkaz bol skopírovaný.")
}
function roleLabel(role){
 return({owner:"Vlastník",editor:"Editor",viewer:"Čítanie",none:"Bez prístupu"})[role]||role||"Bez prístupu"
}
function cloudBlobDataUrl(blob){
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||""));
  reader.onerror=()=>reject(reader.error||new Error("Fotografiu sa nepodarilo načítať."));
  reader.readAsDataURL(blob)
 })
}
async function cloudPhotoObjectUrl(path){
 if(!path||!cloudConfigured()||!cloudSession?.access_token)return"";
 if(defectPhotoUrlCache.has(path))return defectPhotoUrlCache.get(path);
 try{
  await cloudEnsureSession();
  const base=normalizeCloudUrl(cloudConfig.url),headers={apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`},encoded=encodeStoragePath(path),candidates=[
   `${base}/storage/v1/object/authenticated/sitedesk-files/${encoded}`,
   `${base}/storage/v1/object/sitedesk-files/${encoded}`
  ];
  for(const endpoint of candidates){
   const response=await fetch(endpoint,{headers,cache:"no-store"});
   if(!response.ok)continue;
   const blob=await response.blob();
   if(!blob.size||blob.type&&!blob.type.startsWith("image/"))continue;
   const url=await cloudBlobDataUrl(blob);
   if(url){defectPhotoUrlCache.set(path,url);return url}
  }
  throw new Error("Fotografia sa nedá načítať.")
 }catch{return""}
}
async function hydrateCloudDefectPhotos(){
 const images=[...document.querySelectorAll("img[data-cloud-photo]")];
 for(const image of images){
  const path=image.dataset.cloudPhoto;
  if(!path||image.dataset.loaded==="true")continue;
  const url=await cloudPhotoObjectUrl(path);
  if(url){image.src=url;image.dataset.loaded="true"}
 }
}

async function cloudRefreshDefectsForExport(){
 if(!cloudConfigured()||!cloudSession?.access_token)return{ok:true,refreshed:false};
 try{
  await cloudEnsureSession();
  const remote=await cloudGetWorkspace(),
        remoteVersion=Number(remote?.data_version||0),
        localVersion=Number(cloudConfig.lastCloudVersion||0);
  if(!remote?.data||remoteVersion<=localVersion)return{ok:true,refreshed:false};
  if(cloudLocalDirty){
   return{ok:false,message:"V mobile sú novšie údaje, ale v počítači sú ešte neodoslané zmeny. Najprv v časti Cloud dokonči synchronizáciu a potom export zopakuj."}
  }
  await cloudPull({silent:true});
  if(Number(cloudConfig.lastCloudVersion||0)<remoteVersion){
   return{ok:false,message:"Najnovšie mobilné údaje sa nepodarilo načítať. Skontroluj prihlásenie a pripojenie ku cloudu."}
  }
  return{ok:true,refreshed:true}
 }catch(error){
  return{ok:false,message:`Pred exportom sa nepodarilo načítať mobilné údaje z cloudu: ${error.message}`}
 }
}

/* Vady a nedorobky */
function defectCompanyName(defect){return company(defect.companyId)?.name||"Bez firmy"}
function defectCompanyResponsible(companyId,projectId=state.selectedProjectId){
 const assigned=assignment(projectId,companyId),record=company(companyId);
 return assigned?.contact||record?.contact||""
}
function defectResponsibleName(defect){
 return defect?.responsible||defectCompanyResponsible(defect?.companyId,defect?.projectId)||defectCompanyName(defect)
}
function defectIsClosed(defect){return["Odstránená","Skontrolovaná","Uzavretá"].includes(defect.status)}
function defectIsOverdue(defect){return Boolean(defect.dueDate&&defect.dueDate<todayISO()&&!defectIsClosed(defect))}
function defectStatusClass(defect){
 if(defectIsOverdue(defect))return"overdue";
 if(defectIsClosed(defect))return"closed";
 if(defect.status==="Odoslaná firme")return"sent";
 if(defect.status==="V riešení")return"progress";
 return"new"
}
function nextDefectNumber(){
 const year=new Date().getFullYear(),
       max=Math.max(0,...state.defects.map(item=>Number(String(item.number||"").match(/(\d+)$/)?.[1]||0)));
 return`V-${year}-${String(max+1).padStart(3,"0")}`
}
function filteredDefects(){
 const query=$("defectSearch")?.value.trim().toLowerCase()||"",
       companyId=$("defectCompanyFilter")?.value||"",
       status=$("defectStatusFilter")?.value||"",
       deadline=$("defectDeadlineFilter")?.value||"",
       weekEnd=addDaysISO(todayISO(),7);
 return state.defects
  .filter(item=>item.projectId===state.selectedProjectId)
  .filter(item=>!companyId||item.companyId===companyId)
  .filter(item=>!status||item.status===status)
  .filter(item=>deadline!=="overdue"||defectIsOverdue(item))
  .filter(item=>deadline!=="week"||(item.dueDate&&item.dueDate>=todayISO()&&item.dueDate<=weekEnd))
  .filter(item=>!query||[
   item.number,item.location,item.description,item.responsible,defectCompanyName(item)
  ].some(value=>String(value||"").toLowerCase().includes(query)))
  .sort((a,b)=>String(a.dueDate||"9999").localeCompare(String(b.dueDate||"9999"))||String(a.number||"").localeCompare(String(b.number||"")))
}
function groupedDefects(items){
 const groups=new Map();
 items.forEach(item=>{
  const key=item.companyId||"none";
  if(!groups.has(key))groups.set(key,{companyId:key,name:defectCompanyName(item),items:[]});
  groups.get(key).items.push(item)
 });
 return[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk",{sensitivity:"base"}))
}
function photoPreviewSource(photo){
 return photo?.dataUrl||""
}
function renderDefects(){
 if(!$("defectCompanyGroups"))return;
 const projectDefects=state.defects.filter(item=>item.projectId===state.selectedProjectId),
       visible=filteredDefects(),
       open=projectDefects.filter(item=>!defectIsClosed(item)).length,
       overdue=projectDefects.filter(defectIsOverdue).length,
       photoCount=projectDefects.reduce((sum,item)=>sum+(item.photos?.length||0),0);
 $("defectOpenCount").textContent=open;
 $("defectOverdueCount").textContent=overdue;
 $("defectSelectedCount").textContent=selectedDefectIds.size;
 $("defectPhotoCount").textContent=photoCount;
 if($("dashboardOpenDefectsMetric"))$("dashboardOpenDefectsMetric").textContent=open;
 if($("dashboardOverdueDefectsText"))$("dashboardOverdueDefectsText").textContent=`${overdue} po termíne`;

 const assigned=activeAssignments().map(item=>company(item.companyId)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 const currentCompany=$("defectCompanyFilter").value;
 $("defectCompanyFilter").innerHTML=`<option value="">Všetky firmy</option>`+assigned.map(item=>`<option value="${item.id}" ${item.id===currentCompany?"selected":""}>${esc(item.name)}</option>`).join("");

 $("defectCompanyGroups").innerHTML=groupedDefects(visible).map(group=>`
  <section class="defect-company-group">
   <div class="defect-company-head">
    <div><strong>${esc(group.name)}</strong><span>${group.items.length} ${group.items.length===1?"vada":"vád"}</span></div>
    <button type="button" data-select-defect-company="${group.companyId}">Označiť firmu</button>
   </div>
   ${group.items.map(item=>{
    const photos=item.photos||[],
          first=photos[0],
          firstSrc=photoPreviewSource(first),
          dateLabel=item.dueDate?fmtDateISO(item.dueDate):"bez termínu";
    return`<div class="defect-row">
     <input type="checkbox" data-select-defect="${item.id}" ${selectedDefectIds.has(item.id)?"checked":""}>
     <div class="defect-number"><strong>${esc(item.number||"Bez čísla")}</strong><small>${esc(dateLabel)}</small></div>
     <div class="defect-main"><strong>${esc(item.location||"Bez miesta")}</strong><p>${esc(item.description||"")}</p></div>
     <div class="defect-photo-strip">
      ${photos.slice(0,2).map(photo=>photo.dataUrl
       ?`<img class="defect-photo-thumb" src="${photo.dataUrl}" alt="">`
       :`<img class="defect-photo-thumb" src="" data-cloud-photo="${esc(photo.path||"")}" alt="">`).join("")}
      ${photos.length>2?`<span>+${photos.length-2}</span>`:""}
     </div>
     <div class="defect-meta"><strong>${esc(defectResponsibleName(item))}</strong><br><span class="defect-status ${defectStatusClass(item)}">${esc(defectIsOverdue(item)?"Po termíne":item.status||"Nová")}</span></div>
     <div class="defect-actions">
      <button class="ghost" data-edit-defect="${item.id}">Upraviť</button>
      <button class="danger" data-delete-defect="${item.id}">Vymazať</button>
     </div>
    </div>`
   }).join("")}
  </section>`).join("")||`<article class="panel defect-empty">V tomto filtri nie sú žiadne vady.</article>`;

 $("selectAllDefects").checked=visible.length>0&&visible.every(item=>selectedDefectIds.has(item.id));
 document.querySelectorAll("[data-select-defect]").forEach(input=>input.onchange=()=>{
  if(input.checked)selectedDefectIds.add(input.dataset.selectDefect);
  else selectedDefectIds.delete(input.dataset.selectDefect);
  renderDefects()
 });
 document.querySelectorAll("[data-select-defect-company]").forEach(button=>button.onclick=()=>{
  const ids=visible.filter(item=>(item.companyId||"none")===button.dataset.selectDefectCompany).map(item=>item.id),
        all=ids.every(id=>selectedDefectIds.has(id));
  ids.forEach(id=>all?selectedDefectIds.delete(id):selectedDefectIds.add(id));
  renderDefects()
 });
 document.querySelectorAll("[data-edit-defect]").forEach(button=>button.onclick=()=>openDefectEditor(button.dataset.editDefect));
 document.querySelectorAll("[data-delete-defect]").forEach(button=>button.onclick=()=>{
  if(confirm("Vymazať túto vadu?")){
   state.defects=state.defects.filter(item=>item.id!==button.dataset.deleteDefect);
   selectedDefectIds.delete(button.dataset.deleteDefect);
   save("Vada bola vymazaná.")
  }
 });
 requestAnimationFrame(hydrateCloudDefectPhotos)
}
function openDefectEditor(id=""){
 const item=state.defects.find(defect=>defect.id===id),
       assigned=activeAssignments().map(record=>company(record.companyId)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 editingDefectId=item?.id||"";
 pendingDefectPhotos=clone(item?.photos||[]);
 $("defectModalTitle").textContent=item?"Upraviť vadu":"Nová vada";
 $("defectId").value=item?.id||"";
 $("defectCompany").innerHTML=optionList(assigned,item?.companyId||"");
 $("defectNumber").value=item?.number||nextDefectNumber();
 $("defectLocation").value=item?.location||"";
 $("defectDescription").value=item?.description||"";
 $("defectDueDate").value=item?.dueDate||addDaysISO(todayISO(),7);
 $("defectSeverity").value=item?.severity||"Bežná";
 $("defectStatus").value=item?.status||"Nová";
 $("defectResponsible").value=item?.responsible||defectCompanyResponsible($("defectCompany").value,item?.projectId)||"";
 renderDefectPhotoEditor();
 $("defectModal").classList.remove("hidden")
}
function renderDefectPhotoEditor(){
 $("defectPhotoEditor").innerHTML=pendingDefectPhotos.map((photo,index)=>{
  const src=photo.dataUrl||"";
  return`<div class="defect-photo-edit-item">
   ${src?`<img src="${src}" alt="">`:`<img src="" data-cloud-photo="${esc(photo.path||"")}" alt="">`}
   <button type="button" data-remove-defect-photo="${index}">×</button>
  </div>`
 }).join("")||`<div class="database-hint">K vade zatiaľ nie je priložená fotografia.</div>`;
 document.querySelectorAll("[data-remove-defect-photo]").forEach(button=>button.onclick=()=>{
  pendingDefectPhotos.splice(Number(button.dataset.removeDefectPhoto),1);
  renderDefectPhotoEditor()
 });
 requestAnimationFrame(hydrateCloudDefectPhotos)
}
async function compressDefectPhoto(file){
 const dataUrl=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=reject;
  reader.readAsDataURL(file)
 });
 const image=await new Promise((resolve,reject)=>{
  const element=new Image();
  element.onload=()=>resolve(element);
  element.onerror=reject;
  element.src=dataUrl
 });
 const max=1600,
       scale=Math.min(1,max/Math.max(image.width,image.height)),
       canvas=document.createElement("canvas");
 canvas.width=Math.round(image.width*scale);
 canvas.height=Math.round(image.height*scale);
 canvas.getContext("2d").drawImage(image,0,0,canvas.width,canvas.height);
 return{id:uid("photo"),name:file.name,type:"image/jpeg",dataUrl:canvas.toDataURL("image/jpeg",.78),path:""}
}
function defectPrintPhoto(photo){
 return photo.dataUrl||""
}
async function exportDefectsPdf(){
 const cloudRefresh=await cloudRefreshDefectsForExport();
 if(!cloudRefresh.ok){
  alert(cloudRefresh.message);
  return{ok:false,reason:"cloud-refresh-failed"}
 }
 const selected=state.defects.filter(item=>selectedDefectIds.has(item.id));
 if(!selected.length){alert("Najprv označ vady, ktoré chceš vložiť do PDF.");return}
 const remotePhotoSources=new Map();
 const remotePaths=[...new Set(selected.flatMap(item=>(item.photos||[]).filter(photo=>!photo?.dataUrl&&photo?.path).map(photo=>photo.path)))];
 await Promise.all(remotePaths.map(async path=>remotePhotoSources.set(path,await cloudPhotoObjectUrl(path))));
 const failedPhotos=remotePaths.filter(path=>!remotePhotoSources.get(path));
 if(failedPhotos.length){
  alert(`PDF sa nevytvorilo, pretože ${failedPhotos.length===1?"fotografiu":"fotografie"} sa nepodarilo stiahnuť z cloudu. Skontroluj internet a prihlásenie do SiteDesk Cloud, stlač synchronizáciu a export zopakuj.`);
  return{ok:false,reason:"cloud-photo-unavailable",failedPhotos:failedPhotos.length}
 }
 const groups=groupedDefects(selected),
       projectData=activeProject(),
       pages=[];
 for(const group of groups){
  const pageEntries=[];
  let textOnly=[];
  const flushTextOnly=()=>{
   for(let i=0;i<textOnly.length;i+=3)pageEntries.push(textOnly.slice(i,i+3));
   textOnly=[]
  };
  group.items.forEach((item,itemIndex)=>{
   const photos=item.photos||[];
   if(!photos.length){textOnly.push({item,itemNumber:itemIndex+1,photos:[],photoStart:0});return}
   flushTextOnly();
   for(let photoStart=0;photoStart<photos.length;photoStart+=8){
    pageEntries.push([{item,itemNumber:itemIndex+1,photos:photos.slice(photoStart,photoStart+8),photoStart}])
   }
  });
  flushTextOnly();
  pageEntries.forEach((entries,pageIndex)=>{
    pages.push(`<section class="defect-print-page">
     <img class="defect-letterhead-bg" src="${LETTERHEAD_IMAGE}" alt="">
     <div class="defect-letterhead-content">
     <header><div><span class="defect-print-kicker">KONTROLA KVALITY A ODSTRAŇOVANIE VÁD</span><h1>ZOZNAM VÁD A NEDOROBKOV</h1><p>${esc(projectData?.name||"")}</p></div></header>
     <div class="defect-print-company"><span>ZODPOVEDNÁ FIRMA</span><strong>${esc(group.name)}</strong><small>${fmtDateISO(todayISO())} · Strana ${pageIndex+1} / ${pageEntries.length}</small></div>
    ${entries.map(entry=>{const item=entry.item,photoCount=entry.photos.length,photoColumns=photoCount<=1?1:photoCount<=4?2:photoCount<=6?3:4,totalPhotos=(item.photos||[]).length;return`<article class="defect-print-item ${photoCount?"has-photos":""}">
     <div class="defect-print-number">${entry.itemNumber}</div>
     <div class="defect-print-content">
      <div class="defect-print-meta"><strong>${esc(item.number||"")}</strong><span>Termín: ${esc(item.dueDate?fmtDateISO(item.dueDate):"—")}</span><span>Závažnosť: ${esc(item.severity||"")}</span><span>Zodpovedná osoba: ${esc(defectResponsibleName(item))}</span></div>
      <h2>${esc(item.location||"")}</h2>
      <p>${esc(item.description||"")}</p>
      ${entry.photoStart?`<div class="defect-photo-continuation">Pokračovanie fotodokumentácie · fotografie ${entry.photoStart+1}–${entry.photoStart+photoCount} z ${totalPhotos}</div>`:""}
      <div class="defect-print-photos" style="--photo-cols:${photoColumns}">${entry.photos.map((photo,photoIndex)=>{const src=photo.dataUrl||remotePhotoSources.get(photo.path)||"",number=entry.photoStart+photoIndex+1;return src?`<figure><img src="${src}" alt="Fotografia vady ${number}"><figcaption>Foto ${number} / ${totalPhotos}</figcaption></figure>`:`<div class="remote-photo-placeholder">Fotografiu sa nepodarilo načítať</div>`}).join("")}</div>
     </div>
    </article>`}).join("")}
     </div>
    </section>`)
  })
 }
 let frame=$("defectPrintFrame");
 if(frame)frame.remove();
 frame=document.createElement("iframe");
 frame.id="defectPrintFrame";
 frame.style.cssText="position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0";
 document.body.appendChild(frame);
 const doc=frame.contentDocument;
 const printHtml=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Vady a nedorobky</title><style>
 @page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#172f42;background:#fff}
 .defect-print-page{width:210mm;height:297mm;position:relative;page-break-after:always;overflow:hidden;background:#fff}
 .defect-print-page:last-child{page-break-after:auto}.defect-letterhead-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.defect-letterhead-content{position:relative;z-index:1;width:100%;height:100%;padding:46.5mm 14mm 29mm}
 header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0b2f57;padding-bottom:3mm;margin-bottom:4mm}
 .defect-print-kicker{display:block;margin-bottom:1.2mm;font-size:7.5px;font-weight:700;letter-spacing:.08em;color:#687d8b}h1{font-size:17px;margin:0;color:#0b2f57}header p{margin:1mm 0 0;font-size:10px;color:#667b89}
 .defect-print-company{display:grid;grid-template-columns:auto 1fr auto;gap:4mm;align-items:center;background:#edf4f8;border:1px solid #cbdbe4;padding:3mm 4mm;margin-bottom:4mm}
 .defect-print-company span,.defect-print-company small{font-size:8px;color:#627786}.defect-print-company strong{font-size:13px}
 .defect-print-item{display:grid;grid-template-columns:9mm 1fr;border:1px solid #bfcdd6;margin-bottom:3mm;page-break-inside:avoid;min-height:48mm}.defect-print-item.has-photos{min-height:0}
 .defect-print-number{background:#0b2f57;color:#fff;font-weight:bold;display:grid;place-items:center}.defect-print-content{padding:3mm}
 .defect-print-meta{display:flex;gap:4mm;flex-wrap:wrap;font-size:8px;color:#607482}.defect-print-meta strong{color:#0b2f57}
 h2{font-size:12px;margin:2mm 0 1mm}p{font-size:9.5px;line-height:1.35;margin:0 0 2mm}.defect-photo-continuation{font-size:8px;font-weight:700;color:#0b2f57;margin:1mm 0 2mm}.defect-print-photos{display:grid;grid-template-columns:repeat(var(--photo-cols,2),minmax(0,1fr));gap:2mm;align-items:start}
 .defect-print-photos figure{position:relative;margin:0;min-width:0;border:1px solid #cbd5db;border-radius:2mm;overflow:hidden;background:#f3f6f8}.defect-print-photos img{display:block;width:100%;max-height:118mm;aspect-ratio:4/3;object-fit:contain;background:#eef3f6}.defect-print-photos figcaption{position:absolute;right:1mm;bottom:1mm;padding:.7mm 1.2mm;border-radius:1mm;background:rgba(11,47,87,.82);color:#fff;font-size:7px}
 .remote-photo-placeholder{width:100%;aspect-ratio:4/3;border:1px solid #cbd5db;border-radius:2mm}
 .remote-photo-placeholder{display:grid;place-items:center;color:#789;font-size:8px;background:#f2f5f7}
 @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
 </style></head><body>${pages.join("")}</body></html>`;
 if(window.showPdfPreview||window.betpresDesktop?.exportPdf){
  frame.remove();
  const payload={html:printHtml,fileName:`vady-a-nedorobky-${todayISO()}.pdf`,landscape:false,title:"Vady a nedorobky"};
  const result=window.showPdfPreview?await window.showPdfPreview(payload):await window.betpresDesktop.exportPdf(payload);
  if(result&&typeof result==="object"){
   result.photoCount=selected.reduce((sum,item)=>sum+(item.photos||[]).length,0);
   result.photoPages=pages.length
  }
  return result
 }
 doc.open();
 doc.write(printHtml);
 doc.close();
 await Promise.all([...doc.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{
  image.addEventListener("load",resolve,{once:true});
  image.addEventListener("error",resolve,{once:true})
 })));
 setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print()},120)
}

function activeViewId(){return document.querySelector(".view.active")?.id||"dashboard"}
function renderActiveView(id=activeViewId()){
 switch(id){
  case "dashboard":renderDashboard();renderSiteDeskDashboardExtras();break;
  case "quick":renderQuickEntry();break;
  case "projects":renderProjects();break;
  case "companies":prepareCompaniesView();break;
  case "billing":renderBilling();break;
  case "workStatements":prepareWorkStatements();break;
  case "purchases":renderPurchases();break;
  case "materialSamples":window.renderMaterialSamples?.();break;
  case "workers":prepareWorkers();break;
  case "handover":prepareHandover(true);break;
  case "acceptance":renderAcceptance();break;
  case "siteMeetings":prepareControlDay();break;
  case "calendar":renderCalendar();break;
  case "defects":renderDefects();break;
  case "documents":renderDocuments();break;
  case "excelImport":renderExcelPreview();break;
  case "cloud":renderCloudPanel();break;
 }
}
function renderAllFull(){renderProjectSelectors();renderDashboard();renderSiteDeskDashboardExtras();renderProjects();renderCompanies();renderBilling();renderWorkStatements();renderPurchases();window.renderMaterialSamples?.();renderWorkers();renderBetpresTimesheet();renderThpTimesheet();renderDefects();renderAcceptance();renderSiteMeetings();renderCalendar();renderQuickEntry();renderDocuments();renderCloudPanel();updateUndoButton();applySiteDesk3UI()}
function renderAll(){
 renderProjectSelectors();
 renderActiveView(activeViewId());
 updateUndoButton();
 applySiteDesk3UI()
}
function renderProjectSelectors(){if(!project(state.selectedProjectId))state.selectedProjectId=state.projects[0]?.id||"";$("globalProject").innerHTML=optionList(state.projects,state.selectedProjectId);$("handoverProject").innerHTML=optionList(state.projects,$("handoverProject").value||state.selectedProjectId);if(activeViewId()==="handover")renderHandoverCompanies()}$("globalProject").onchange=e=>{state.selectedProjectId=e.target.value;const current=JSON.stringify(state);lastCommittedState=current;siteDeskSchedulePersist(current,{backup:false});queueCloudPush();renderAll()};
function renderDashboard(){const p=activeProject();if(!p)return;$('dashTitle').textContent=p.name;const bs=state.billings.filter(b=>b.projectId===p.id),hs=state.handovers.filter(h=>h.projectId===p.id),ps=state.purchases.filter(x=>x.projectId===p.id),assignmentRows=state.assignments.filter(a=>a.projectId===p.id),protocols=state.acceptanceProtocols.filter(x=>x.projectId===p.id);const today=todayISO(),month=today.slice(0,7),day=Number(today.slice(8,10)),todaySheet=syncBetpresWorkerRow(month,workerSheet(month,true))&&workerSheet(month,true),workersToday=(todaySheet?.rows||[]).reduce((sum,r)=>sum+(Number(r.values?.[day])||0),0);$('metricWorkersToday').textContent=workersToday;$('metricWorkersDate').textContent=workersToday?`${fmtDateISO(today)} · spolu na stavbe`:`${fmtDateISO(today)} · dnešný stav zatiaľ nevyplnený`;$('metricBilling').textContent=eur.format(bs.reduce((s,x)=>s+Number(x.amount||0),0));$('metricHandovers').textContent=hs.length;if($('metricPurchases'))$('metricPurchases').textContent=ps.length;const missingAcceptance=Math.max(0,assignmentRows.length-new Set(protocols.map(x=>x.companyId)).size);if($('metricAcceptance'))$('metricAcceptance').textContent=protocols.length;if($('metricAcceptanceText'))$('metricAcceptanceText').textContent=`${missingAcceptance} firiem bez protokolu`;
const recent=[...ps].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);if($('recentPurchases'))$('recentPurchases').innerHTML='';const monthly={};bs.forEach(b=>monthly[b.month]=(monthly[b.month]||0)+Number(b.amount||0));const keys=Object.keys(monthly).sort().slice(-12);const max=Math.max(1,...keys.map(k=>monthly[k]));$('billingChart').innerHTML=keys.length?keys.map(k=>{const m=Number(k.slice(5));return `<div class="bar-group"><div class="bar ${k===keys.at(-1)?'current':''}" style="height:${Math.max(3,monthly[k]/max*90)}%" data-value="${esc(eur.format(monthly[k]))}"></div><small>${monthNames[m-1]}</small></div>`}).join(''):`<div style="align-self:center;color:#789">Zatiaľ bez fakturácie</div>`;const byCompany={};bs.forEach(b=>byCompany[b.companyId]=(byCompany[b.companyId]||0)+Number(b.amount||0));$('topCompanies').innerHTML=Object.entries(byCompany).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v],i)=>`<div class="rank-row"><b>${i+1}.</b><div><strong>${esc(company(id)?.name||'')}</strong><small>${esc(company(id)?.scope||'')}</small></div><span>${eur.format(v)}</span></div>`).join('')||`<p style="color:#789">Zatiaľ bez údajov.</p>`;$('projectCards').innerHTML=state.projects.slice(0,5).map(x=>`<div class="mini-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.address||'')}</small></div><span class="status">${x.id===state.selectedProjectId?'Aktívna':'Stavba'}</span></div>`).join('')}
function renderProjects(){$("projectsGrid").innerHTML=state.projects.map(p=>`<article class="panel project-card"><h3>${esc(p.name)}</h3><p>${esc(p.address||"Bez adresy")}</p><div class="project-meta"><span class="chip">${state.assignments.filter(a=>a.projectId===p.id).length} firiem</span><span class="chip">${state.handovers.filter(h=>h.projectId===p.id).length} zápisníc</span><span class="chip">${esc(p.region||"Kraj neuvedený")}</span></div><div class="project-card-actions"><button class="ghost" data-activate-project="${p.id}">${p.id===state.selectedProjectId?"Aktívna stavba":"Nastaviť ako aktívnu"}</button><button class="delete-project" data-delete-project="${p.id}">Vymazať stavbu</button></div></article>`).join("");document.querySelectorAll("[data-activate-project]").forEach(b=>b.onclick=()=>{state.selectedProjectId=b.dataset.activateProject;localStorage.setItem(KEY,JSON.stringify(state));renderAll();toast("Aktívna stavba bola zmenená.")});document.querySelectorAll("[data-delete-project]").forEach(b=>b.onclick=()=>deleteProject(b.dataset.deleteProject))}
function deleteProject(id){const p=project(id);if(!p)return;if(state.projects.length===1){alert("Poslednú stavbu nie je možné vymazať. Najprv vytvor inú stavbu.");return}const typed=prompt(`Vymazanie je trvalé. Pre potvrdenie napíš presný názov stavby:\n\n${p.name}`);if(typed!==p.name){if(typed!==null)alert("Názov sa nezhoduje. Stavba nebola vymazaná.");return}state.projects=state.projects.filter(x=>x.id!==id);state.assignments=state.assignments.filter(x=>x.projectId!==id);state.billings=state.billings.filter(x=>x.projectId!==id);state.materials=state.materials.filter(x=>x.projectId!==id);state.purchases=state.purchases.filter(x=>x.projectId!==id);state.handovers=state.handovers.filter(x=>x.projectId!==id);state.workerSheets=state.workerSheets.filter(x=>x.projectId!==id);state.betpresTimesheets=state.betpresTimesheets.filter(x=>x.projectId!==id);state.thpTimesheets=state.thpTimesheets.filter(x=>x.projectId!==id);state.companyHourTimesheets=state.companyHourTimesheets.filter(x=>x.projectId!==id);state.acceptanceProtocols=state.acceptanceProtocols.filter(x=>x.projectId!==id);state.siteMeetings=state.siteMeetings.filter(x=>x.projectId!==id);state.controlDays=state.controlDays.filter(x=>x.projectId!==id);state.documentVersions=state.documentVersions.filter(x=>x.projectId!==id);state.calendarEvents=state.calendarEvents.filter(x=>x.projectId!==id);state.workStatements=state.workStatements.filter(x=>x.projectId!==id);state.workBudgets=state.workBudgets.filter(x=>x.projectId!==id);state.materialSamples=state.materialSamples.filter(x=>x.projectId!==id);if(state.selectedProjectId===id)state.selectedProjectId=state.projects[0]?.id||"";save("Stavba a jej naviazané údaje boli vymazané. Firmy zostali v databáze.")}
$("addProjectBtn").onclick=()=>$("projectModal").classList.remove("hidden");$("projectForm").onsubmit=e=>{e.preventDefault();const id=uid("p");state.projects.push({id,name:$("projectName").value,address:$("projectAddress").value,city:$("projectCity").value,documentCity:$("projectDocumentCity").value||$("projectCity").value,cadastre:$("projectCadastre").value,region:$("projectRegion").value,manager:$("projectManager").value,managerPhone:$("projectManagerPhone").value,constructionPermit:$("projectPermit").value||"áno",constructionLine:$("projectConstructionLine").value,surveyPoints:$("projectSurvey").value||"geodetickým vytýčením",mechanisms:$("projectMechanisms").value,electricity:$("projectElectricity").value||"Zo staveniskového rozvádzača",water:$("projectWater").value||"Staveniskové rozvody",networks:$("projectNetworks").value,documentation:$("projectDocumentation").value||"Bola odovzdaná projektová dokumentácia"});state.selectedProjectId=id;e.target.reset();$("projectPermit").value="áno";$("projectSurvey").value="geodetickým vytýčením";$("projectElectricity").value="Zo staveniskového rozvádzača";$("projectWater").value="Staveniskové rozvody";$("projectDocumentation").value="Bola odovzdaná projektová dokumentácia";$("projectModal").classList.add("hidden");save("Stavba bola pridaná a je pripravená aj pre odovzdanie pracoviska.")};
function activeAssignments(){return state.assignments.filter(a=>a.projectId===state.selectedProjectId)}function masterContact(c,key){return c?.[key]||"—"}
function companiesViewSignature(){
 const query=$("companySearch")?.value||"",assignments=activeAssignments(),ids=new Set(assignments.map(item=>item.companyId));
 return JSON.stringify([state.selectedProjectId,query,assignments,state.companies.filter(item=>ids.has(item.id))])
}
function prepareCompaniesView(){
 const signature=companiesViewSignature();
 if(signature===lastCompaniesViewSignature)return;
 renderCompanies();
 lastCompaniesViewSignature=signature
}
function availableCompanies(currentCompanyId=""){const used=new Set(state.assignments.filter(a=>a.projectId===state.selectedProjectId&&a.companyId!==currentCompanyId).map(a=>a.companyId));return state.companies.filter(c=>!used.has(c.id)).sort((a,b)=>a.name.localeCompare(b.name,"sk"))}
function assignmentAddenda(item){if(!item)return[];if(!Array.isArray(item.addenda))item.addenda=[];return item.addenda}
function assignmentAddendumLabel(item){return `Dodatok č. ${String(item?.number||"").trim()||"—"}`}
function renderCompanies(){const q=$("companySearch").value.trim().toLowerCase();const rows=activeAssignments().map(a=>({a,c:company(a.companyId)})).filter(x=>x.c&&`${x.c.name} ${x.c.ico} ${x.c.contact||""} ${x.a.scope||""} ${assignmentAddenda(x.a).map(d=>`${d.number} ${d.name}`).join(" ")}`.toLowerCase().includes(q));$("companyCount").textContent=`${rows.length} firiem`;$("companyTable").innerHTML=rows.map(({a,c})=>{const addenda=assignmentAddenda(a);return `<tr><td><strong>${esc(c.name)}</strong></td><td><strong>${esc(assignmentDocRef(a))}</strong>${addenda.length?`<div class="assignment-addenda-chips">${addenda.map(d=>`<span title="${esc(d.name||"")}">${esc(assignmentAddendumLabel(d))} · ${esc(d.name||"Bez názvu")} · ${eur.format(parseWorkNumber(d.price||0))}</span>`).join("")}</div>`:""}</td><td>${esc(c.address||"—")}</td><td>${esc(c.postalCity||"—")}</td><td>${esc(c.ico||"—")}</td><td>${esc(c.dic||"—")}</td><td>${esc(c.icdph||"—")}</td><td>${esc(masterContact(c,"contact"))}</td><td>${esc(masterContact(c,"phone"))}</td><td><strong>${esc(a.scope||"—")}</strong></td><td><div class="row-actions multi"><button class="warn" data-edit-assignment="${c.id}">Doklad / predmet</button><button class="assignment-addendum-action" data-add-assignment-addendum="${a.id}">+ Dodatok</button><button class="ghost" data-edit-company="${c.id}">Údaje firmy</button><button data-handover-company="${c.id}">Odovzdanie</button><button class="danger" data-remove-assignment="${c.id}">Odobrať</button></div></td></tr>`}).join("")||`<tr><td colspan="11" style="text-align:center;color:#789;padding:30px">Na tejto stavbe zatiaľ nie sú firmy. Klikni na „Priradiť existujúcu firmu“.</td></tr>`;
document.querySelectorAll("[data-edit-assignment]").forEach(b=>b.onclick=()=>openAssignment(b.dataset.editAssignment));
document.querySelectorAll("[data-add-assignment-addendum]").forEach(b=>b.onclick=()=>openAssignmentAddendum(b.dataset.addAssignmentAddendum));
document.querySelectorAll("[data-edit-company]").forEach(b=>b.onclick=()=>openCompany(b.dataset.editCompany));
document.querySelectorAll("[data-remove-assignment]").forEach(b=>b.onclick=()=>removeAssignment(b.dataset.removeAssignment));
document.querySelectorAll("[data-handover-company]").forEach(b=>b.onclick=()=>{showView("handover");$("handoverProject").value=state.selectedProjectId;renderHandoverCompanies(b.dataset.handoverCompany);renderHandover()})}
function renderAssignmentAddendumList(item){
 const box=$("assignmentAddendumList");if(!box)return;
 box.innerHTML=assignmentAddenda(item).map(addendum=>`<div class="assignment-addendum-row"><div><strong>${esc(assignmentAddendumLabel(addendum))} · ${esc(addendum.name||"Bez názvu")}</strong><small>${eur.format(parseWorkNumber(addendum.price||0))} bez DPH</small></div><div><button type="button" class="ghost" data-edit-assignment-addendum="${addendum.id}">Upraviť</button><button type="button" class="danger" data-delete-assignment-addendum="${addendum.id}">Vymazať</button></div></div>`).join("")||`<div class="assignment-addendum-empty">Firma zatiaľ nemá pridaný dodatok.</div>`;
 box.querySelectorAll("[data-edit-assignment-addendum]").forEach(button=>button.onclick=()=>openAssignmentAddendum(item.id,button.dataset.editAssignmentAddendum));
 box.querySelectorAll("[data-delete-assignment-addendum]").forEach(button=>button.onclick=()=>{
  const current=assignmentAddenda(item).find(x=>x.id===button.dataset.deleteAssignmentAddendum);if(!current)return;
  if(!confirm(`Vymazať ${assignmentAddendumLabel(current)} – ${current.name||"bez názvu"}?`))return;
  item.addenda=item.addenda.filter(x=>x.id!==current.id);renderAssignmentAddendumList(item);save("Dodatok bol odstránený z firmy.")
 })
}
function openAssignmentAddendum(assignmentId,addendumId=""){
 const item=state.assignments.find(x=>x.id===assignmentId);if(!item)return;
 const addendum=assignmentAddenda(item).find(x=>x.id===addendumId);
 $("assignmentAddendumAssignmentId").value=item.id;$("assignmentAddendumId").value=addendum?.id||"";
 $("assignmentAddendumTitle").textContent=addendum?"Upraviť dodatok":"Pridať dodatok";
 $("assignmentAddendumCompanyName").textContent=company(item.companyId)?.name||"Firma";
 $("assignmentAddendumNumber").value=addendum?.number||"";$("assignmentAddendumName").value=addendum?.name||"";$("assignmentAddendumPrice").value=addendum?.price||"";
 renderAssignmentAddendumList(item);$("assignmentAddendumModal").classList.remove("hidden");setTimeout(()=>$("assignmentAddendumNumber").focus(),40)
}
if($("assignmentAddendumForm"))$("assignmentAddendumForm").onsubmit=event=>{
 event.preventDefault();const item=state.assignments.find(x=>x.id===$("assignmentAddendumAssignmentId").value);if(!item)return;
 const id=$("assignmentAddendumId").value||uid("add"),number=$("assignmentAddendumNumber").value.trim(),name=$("assignmentAddendumName").value.trim(),price=$("assignmentAddendumPrice").value.trim();
 if(!number||!name)return;
 const duplicate=assignmentAddenda(item).find(x=>String(x.number).toLowerCase()===number.toLowerCase()&&x.id!==id);
 if(duplicate){alert("Dodatok s rovnakým číslom už pri tejto firme existuje.");return}
 const record={id,number,name,price,updatedAt:new Date().toISOString()},existing=assignmentAddenda(item).find(x=>x.id===id);
 if(existing)Object.assign(existing,record);else item.addenda.push(record);
 $("assignmentAddendumId").value="";$("assignmentAddendumNumber").value="";$("assignmentAddendumName").value="";$("assignmentAddendumPrice").value="";
 renderAssignmentAddendumList(item);save(`${assignmentAddendumLabel(record)} bol uložený a je dostupný v súpise prác.`)
};
$("companySearch").oninput=renderCompanies;
$("addCompanyBtn").onclick=()=>openAssignment();
$("addNewCompanyBtn").onclick=()=>openCompany();

function openCompany(id){const c=id?company(id):null;$("companyModalTitle").textContent=id?"Upraviť údaje firmy":"Pridať novú firmu do databázy";$("companyId").value=id||"";$("companyName").value=c?.name||"";$("companyAddress").value=c?.address||"";$("companyPostal").value=c?.postalCity||"";$("companyIco").value=c?.ico||"";$("companyDic").value=c?.dic||"";$("companyIcdph").value=c?.icdph||"";$("companyContact").value=c?.contact||"";$("companyPhone").value=c?.phone||"";$("companyScope").value=c?.scope||"";$("companyModal").classList.remove("hidden")}

$("companyForm").onsubmit=e=>{e.preventDefault();let id=$("companyId").value;let c=id?company(id):null;const isNew=!c;if(!c){id=uid("c");c={id};state.companies.push(c)}Object.assign(c,{name:$("companyName").value.trim(),address:$("companyAddress").value.trim(),postalCity:$("companyPostal").value.trim(),ico:$("companyIco").value.trim(),dic:$("companyDic").value.trim(),icdph:$("companyIcdph").value.trim(),contact:$("companyContact").value.trim(),phone:$("companyPhone").value.trim(),scope:$("companyScope").value.trim()});$("companyModal").classList.add("hidden");localStorage.setItem(KEY,JSON.stringify(state));renderAll();toast(isNew?"Firma bola uložená do databázy. Teraz jej zadaj číslo zmluvy na stavbe.":"Údaje firmy boli upravené.");if(isNew)setTimeout(()=>openAssignment(id),150)};

function renderAssignmentPreview(){const c=company($("assignCompanySelect").value),box=$("assignCompanyPreview");if(!c){box.className="company-preview empty span2";box.innerHTML="Vyber firmu zo spoločnej databázy.";return}box.className="company-preview span2";box.innerHTML=`<div class="company-preview-grid"><div>Firma<strong>${esc(c.name)}</strong></div><div>IČO<strong>${esc(c.ico||"—")}</strong></div><div>Adresa<strong>${esc([c.address,c.postalCity].filter(Boolean).join(", ")||"—")}</strong></div><div>DIČ / IČ DPH<strong>${esc([c.dic,c.icdph].filter(Boolean).join(" / ")||"—")}</strong></div><div>Kontakt<strong>${esc(c.contact||"—")} · ${esc(c.phone||"—")}</strong></div><div>Údaje firmy<strong>Typ dokladu a predmet činnosti doplníš nižšie pre túto stavbu</strong></div></div>`}

function openAssignment(companyId=""){const existing=companyId?assignment(state.selectedProjectId,companyId):null;const list=availableCompanies(companyId);$("assignmentId").value=existing?.id||"";$("assignCompanyTitle").textContent=existing?"Zmeniť doklad a predmet činnosti":"Priradiť existujúcu firmu";$("assignProjectName").textContent=activeProject()?.name||"";$("assignCompanySelect").innerHTML=optionList(list,companyId,x=>x.name,"Vyber firmu");$("assignCompanySelect").disabled=!!existing;$("assignContractType").value=assignmentDocType(existing||{});$("assignContract").value=existing?.contractNo||"";$("assignContractStart").value=existing?.contractStart||"";$("assignContractEnd").value=existing?.contractEnd||"";$("assignScope").value=existing?.scope||company(companyId)?.scope||"";$("assignCompanyModal").classList.remove("hidden");renderAssignmentPreview();setTimeout(()=>existing?$("assignContract").focus():$("assignCompanySelect").focus(),60)}
$("assignCompanySelect").onchange=renderAssignmentPreview;
$("assignCompanyForm").onsubmit=e=>{e.preventDefault();const assignmentId=$("assignmentId").value,companyId=$("assignCompanySelect").value;if(!companyId)return;let a=assignmentId?state.assignments.find(x=>x.id===assignmentId):assignment(state.selectedProjectId,companyId);if(!a){a={id:uid("a"),projectId:state.selectedProjectId,companyId};state.assignments.push(a)}a.contractType=$("assignContractType").value||"ZoD";a.contractNo=$("assignContract").value.trim();a.contractStart=$("assignContractStart").value||"";a.contractEnd=$("assignContractEnd").value||"";a.scope=$("assignScope").value.trim();$("assignCompanySelect").disabled=false;$("assignCompanyModal").classList.add("hidden");save(assignmentId?"Doklad a predmet činnosti boli upravené.":"Firma bola priradená ku stavbe.")};

function removeAssignment(companyId){const c=company(companyId);if(!c)return;const typed=prompt(`Odobratie firmy zo stavby odstráni jej zmluvu na tejto stavbe, ale firma zostane v spoločnej databáze.

Pre potvrdenie napíš presný názov firmy:
${c.name}`);if(typed!==c.name){if(typed!==null)alert("Názov firmy sa nezhoduje. Firma nebola odobratá.");return}state.assignments=state.assignments.filter(a=>!(a.projectId===state.selectedProjectId&&a.companyId===companyId));save("Firma bola odobratá zo stavby, ale zostala v spoločnej databáze.")};
function billingCompanyOptions(){const ids=[...new Set(state.billings.filter(x=>x.projectId===state.selectedProjectId).map(x=>x.companyId))];activeAssignments().forEach(a=>ids.push(a.companyId));return [...new Set(ids)].map(company).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"))}
function billingContractPriceForRows(rows){
 const latestByCompany=new Map();
 [...rows]
  .sort((a,b)=>String(b.month||"").localeCompare(String(a.month||"")))
  .forEach(record=>{
   const value=Number(record.contractPrice||0);
   if(!latestByCompany.has(record.companyId)&&value>0)latestByCompany.set(record.companyId,value)
  });
 return [...latestByCompany.values()].reduce((sum,value)=>sum+value,0)
}
function savedBillingContractPrice(companyId,projectId=state.selectedProjectId){
 if(!companyId)return"";

 const assignmentRecord=state.assignments.find(assignment=>
  assignment.projectId===projectId&&assignment.companyId===companyId
 );
 const assignmentPrice=Number(assignmentRecord?.billingContractPrice||0);
 if(assignmentPrice>0)return assignmentPrice;

 const latest=state.billings
  .filter(record=>
   record.projectId===projectId&&
   record.companyId===companyId&&
   Number(record.contractPrice||0)>0
  )
  .sort((a,b)=>String(b.month||"").localeCompare(String(a.month||"")))[0];

 return latest?Number(latest.contractPrice):""
}
function storeBillingContractPrice(companyId,value,projectId=state.selectedProjectId){
 const price=Number(value||0);
 if(!companyId||price<=0)return;

 const assignmentRecord=state.assignments.find(assignment=>
  assignment.projectId===projectId&&assignment.companyId===companyId
 );
 if(assignmentRecord)assignmentRecord.billingContractPrice=price
}
function fillSavedBillingContractPrice(force=false){
 const companyId=$("billingCompany").value,
       isEditing=Boolean($("billingId").value);

 if(isEditing&&!force)return;

 const saved=savedBillingContractPrice(companyId);
 $("billingContractPrice").value=saved!==""?saved:"";
 $("billingContractPrice").dataset.autoFilled=saved!==""?"true":"false"
}

function openBillingEditor(record=null){
 const assignedCompanies=activeAssignments()
  .map(assignment=>company(assignment.companyId))
  .filter(Boolean)
  .sort((a,b)=>a.name.localeCompare(b.name,"sk"));

 $("billingCompany").innerHTML=optionList(
  assignedCompanies,
  record?.companyId||"",
  item=>item.name,
  "Vyber firmu"
 );
 $("billingId").value=record?.id||"";
 $("billingModalTitle").textContent=record?"Upraviť fakturáciu":"Pridať fakturáciu";
 $("billingMonth").value=record?.month||$("billingMonthFilter")?.value||todayISO().slice(0,7);
 $("billingAmount").value=record?.amount??"";
 $("billingContractPrice").value=record
  ?(record.contractPrice??"")
  :savedBillingContractPrice($("billingCompany").value);
 $("billingContractPrice").dataset.autoFilled=!record&&$("billingContractPrice").value!==""?"true":"false";
 $("billingAmendmentNo").value=record?.amendmentNo||"";
 $("billingModal").classList.remove("hidden");
 setTimeout(()=>$("billingCompany").focus(),50)
}
function renderBilling(){
 if(!$("billingTable"))return;

 $("billingActiveProjectName").textContent=activeProject()?.name||"—";

 const companies=billingCompanyOptions(),
       currentCompany=$("billingCompanyFilter").value;

 $("billingCompanyFilter").innerHTML=`<option value="">Všetky firmy</option>`+
  companies.map(item=>`<option value="${item.id}" ${item.id===currentCompany?"selected":""}>${esc(item.name)}</option>`).join("");

 $("billingCompanyNames").innerHTML=companies.map(item=>`<option value="${esc(item.name)}"></option>`).join("");

 const projectRows=state.billings.filter(record=>record.projectId===state.selectedProjectId),
       years=[...new Set(projectRows.map(record=>record.month?.slice(0,4)).filter(Boolean))].sort().reverse(),
       currentYear=$("billingYearFilter").value,
       selectedMonth=$("billingMonthFilter")?.value||"";

 $("billingYearFilter").innerHTML=`<option value="">Všetky roky</option>`+
  years.map(year=>`<option value="${year}" ${year===currentYear?"selected":""}>${year}</option>`).join("");

 const query=$("billingSearch").value.trim().toLowerCase(),
       companyId=$("billingCompanyFilter").value,
       year=$("billingYearFilter").value,
       rows=projectRows
        .filter(record=>
         (!companyId||record.companyId===companyId)&&
         (!year||record.month.startsWith(year))&&
         (!selectedMonth||record.month===selectedMonth)&&
         (!query||(company(record.companyId)?.name||"").toLowerCase().includes(query))
        )
        .sort((a,b)=>String(b.month||"").localeCompare(String(a.month||""))||(company(a.companyId)?.name||"").localeCompare(company(b.companyId)?.name||"","sk"));

 const displayedTotal=rows.reduce((sum,record)=>sum+Number(record.amount||0),0);
 $("billingTotal").textContent=eur.format(displayedTotal);
 $("billingContractPriceTotal").textContent=eur.format(billingContractPriceForRows(rows));
 $("billingCount").textContent=rows.length;
 $("billingSelectedCompany").textContent=companyId?(company(companyId)?.name||"—"):"Všetky";

 const monthRows=selectedMonth
  ?projectRows.filter(record=>
    record.month===selectedMonth&&
    (!companyId||record.companyId===companyId)&&
    (!query||(company(record.companyId)?.name||"").toLowerCase().includes(query))
   )
  :rows;
 const monthAmount=monthRows.reduce((sum,record)=>sum+Number(record.amount||0),0),
       monthCompanies=new Set(monthRows.map(record=>record.companyId).filter(Boolean)).size;
 $("billingMonthAmount").textContent=eur.format(monthAmount);
 $("billingMonthLabel").textContent=selectedMonth
  ?`${formatBillingMonth(selectedMonth)} · bez DPH${companyId?` · ${company(companyId)?.name||""}`:""}`
  :"Súčet aktuálne zobrazených záznamov";
 $("billingMonthCompanyCount").textContent=monthCompanies;

 $("billingTable").innerHTML=rows.map(record=>{
  const contractPrice=Number(record.contractPrice||0),
        amendment=String(record.amendmentNo||"").trim(),
        selectedRow=selectedMonth&&record.month===selectedMonth;
  return `<tr class="${selectedRow?"billing-month-selected-row":""}">
   <td><strong>${esc(company(record.companyId)?.name||"")}</strong>${record.workStatementId?`<small class="billing-source-badge">Zo súpisu č. ${esc(record.workStatementNo||"")}</small>`:""}</td>
   <td>${esc(formatBillingMonth(record.month))}${record.documents?.length?`<small class="billing-document-list">${esc(record.documents.join(" · "))}</small>`:""}</td>
   <td class="num">${contractPrice>0?`<strong>${eur.format(contractPrice)}</strong>`:`<span class="billing-empty-value">Nedoplnené</span>`}</td>
   <td>${amendment?`<span class="billing-amendment">${esc(amendment)}</span>`:`<span class="billing-empty-value">Bez dodatku</span>`}</td>
   <td class="num"><strong>${eur.format(record.amount)}</strong></td>
   <td><div class="row-actions">
    ${record.workStatementId?`<button class="ghost" data-open-work-statement="${record.id}">Otvoriť súpis</button>`:""}
    <button class="ghost" data-edit-billing="${record.id}">Upraviť</button>
    <button class="danger" data-del-billing="${record.id}">Vymazať</button>
   </div></td>
  </tr>`
 }).join("")||`<tr><td colspan="6" style="text-align:center;padding:30px;color:#789">Na aktívnej stavbe nie sú vo vybranom filtri záznamy.</td></tr>`;

 document.querySelectorAll("[data-edit-billing]").forEach(button=>{
  button.onclick=()=>{
   const record=state.billings.find(item=>item.id===button.dataset.editBilling);
   if(record)openBillingEditor(record)
  }
 });

 document.querySelectorAll("[data-open-work-statement]").forEach(button=>{
  button.onclick=()=>{
   const record=state.billings.find(item=>item.id===button.dataset.openWorkStatement);
   if(!record)return;
   selectedWorkCompanyId=record.companyId;selectedWorkPeriod=record.month;selectedWorkDocFilter="";
   showView("workStatements")
  }
 });

 document.querySelectorAll("[data-del-billing]").forEach(button=>{
  button.onclick=()=>{
   if(confirm("Vymazať tento záznam fakturácie?")){
    state.billings=state.billings.filter(item=>item.id!==button.dataset.delBilling);
    save("Vymazanie fakturácie")
   }
  }
 });

 renderBillingMonthOverview(projectRows,companyId,year,query,selectedMonth);
 renderBillingHistory(companyId,year,selectedMonth)
}
function renderBillingMonthOverview(projectRows,companyId,year,query,selectedMonth){
 const box=$("billingMonthOverview");
 if(!box)return;
 const monthMap=new Map();
 projectRows
  .filter(record=>
   (!companyId||record.companyId===companyId)&&
   (!year||record.month.startsWith(year))&&
   (!query||(company(record.companyId)?.name||"").toLowerCase().includes(query))
  )
  .forEach(record=>{
   if(!record.month)return;
   if(!monthMap.has(record.month))monthMap.set(record.month,{month:record.month,amount:0,count:0,companies:new Set()});
   const item=monthMap.get(record.month);
   item.amount+=Number(record.amount||0);
   item.count+=1;
   if(record.companyId)item.companies.add(record.companyId)
  });

 const months=[...monthMap.values()].sort((a,b)=>String(b.month).localeCompare(String(a.month)));
 $("billingMonthOverviewTitle").textContent=year?`Mesačný prehľad za rok ${year}`:"Mesačný prehľad fakturácie";

 box.innerHTML=months.map(item=>`
  <button type="button" class="billing-month-chip ${selectedMonth===item.month?"active":""}" data-billing-month-chip="${item.month}">
   <span>${esc(formatBillingMonth(item.month))}</span>
   <strong>${eur.format(item.amount)}</strong>
   <small>${item.count} záznamov · ${item.companies.size} firiem</small>
  </button>
 `).join("")||`<div class="billing-month-empty">Zatiaľ nie je dostupná fakturácia po mesiacoch.</div>`;

 document.querySelectorAll("[data-billing-month-chip]").forEach(button=>{
  button.onclick=()=>{
   $("billingMonthFilter").value=button.dataset.billingMonthChip;
   if(!$("billingYearFilter").value)$("billingYearFilter").value=button.dataset.billingMonthChip.slice(0,4);
   renderBilling()
  }
 })
}
function formatBillingMonth(value){
 if(!value)return"";
 const [year,month]=value.split("-");
 return `${monthNames[Number(month)-1]} ${year}`
}
function renderBillingHistory(companyId,year,selectedMonth=""){
 const box=$("billingCompanyHistory"),
       title=$("billingHistoryTitle");

 if(!companyId){
  title.textContent=selectedMonth?`Stav za ${formatBillingMonth(selectedMonth)}`:"Vyber firmu";
  box.className="billing-history-empty";
  box.textContent=selectedMonth
   ?"Po výbere firmy sa zobrazí detail za daný mesiac."
   :"Po výbere firmy sa zobrazí fakturácia, zmluvná cena a čísla dodatkov.";
  return
 }

 const selectedCompany=company(companyId),
       rows=state.billings
        .filter(record=>
         record.companyId===companyId&&
         record.projectId===state.selectedProjectId&&
         (!year||record.month.startsWith(year))&&
         (!selectedMonth||record.month===selectedMonth)
        )
        .sort((a,b)=>String(b.month||"").localeCompare(String(a.month||""))),
       total=rows.reduce((sum,record)=>sum+Number(record.amount||0),0),
       latestContractRecord=rows.find(record=>Number(record.contractPrice||0)>0),
       latestContractPrice=Number(latestContractRecord?.contractPrice||0);

 title.textContent=selectedMonth
  ?`${selectedCompany?.name||"Firma"} · ${formatBillingMonth(selectedMonth)}`
  :selectedCompany?.name||"Firma";
 box.className="billing-history-list";
 box.innerHTML=`
  <div class="billing-history-total"><span>${selectedMonth?"Fakturované za vybraný mesiac":"Spolu fakturované na aktívnej stavbe"}</span><strong>${eur.format(total)}</strong></div>
  <div class="billing-history-contract">
   <span>Posledná zadaná zmluvná cena</span>
   <strong>${latestContractPrice>0?eur.format(latestContractPrice):"Nedoplnená"}</strong>
  </div>`+
  (rows.map(record=>`
   <div class="billing-history-row">
    <div>
     <strong>${esc(formatBillingMonth(record.month))}</strong>
     <div class="billing-history-meta">
      <span>Zmluvná cena: <b>${Number(record.contractPrice||0)>0?eur.format(Number(record.contractPrice)):"nedoplnená"}</b></span>
      <span>Dodatok: <b>${esc(record.amendmentNo||"bez dodatku")}</b></span>
     </div>
    </div>
    <strong>${eur.format(record.amount)}</strong>
   </div>`).join("")||`<div class="billing-history-empty">Bez fakturácie.</div>`)
}
[$("billingSearch"),$("billingCompanyFilter"),$("billingYearFilter"),$("billingMonthFilter")].forEach(element=>{
 element.oninput=renderBilling;
 element.onchange=renderBilling
});
$("billingMonthFilter").onchange=()=>{
 const month=$("billingMonthFilter").value;
 if(month)$("billingYearFilter").value=month.slice(0,4);
 renderBilling()
};
$("billingCurrentMonth").onclick=()=>{
 $("billingMonthFilter").value=todayISO().slice(0,7);
 $("billingYearFilter").value=todayISO().slice(0,4);
 renderBilling()
};
$("clearBillingFilters").onclick=()=>{
 $("billingSearch").value="";
 $("billingCompanyFilter").value="";
 $("billingYearFilter").value="";
 $("billingMonthFilter").value="";
 renderBilling()
};
$("billingSearch").onchange=()=>{
 const selected=billingCompanyOptions().find(item=>
  item.name.toLowerCase()===$("billingSearch").value.trim().toLowerCase()
 );
 if(selected)$("billingCompanyFilter").value=selected.id;
 renderBilling()
};
$("addBillingBtn").onclick=()=>openBillingEditor();
$("billingCompany").onchange=()=>fillSavedBillingContractPrice(true);
$("billingContractPrice").oninput=()=>{
 $("billingContractPrice").dataset.autoFilled="false"
};
$("billingForm").onsubmit=event=>{
 event.preventDefault();

 const id=$("billingId").value,
       existing=state.billings.find(record=>record.id===id),
       record={
        ...(existing?{workStatementId:existing.workStatementId||"",workStatementNo:existing.workStatementNo||"",source:existing.source||"",sourceLabel:existing.sourceLabel||"",documents:existing.documents||[]}:{}),
        id:id||uid("b"),
        projectId:state.selectedProjectId,
        companyId:$("billingCompany").value,
        month:$("billingMonth").value,
        amount:Number($("billingAmount").value||0),
        contractPrice:$("billingContractPrice").value===""?"":Number($("billingContractPrice").value),
        amendmentNo:$("billingAmendmentNo").value.trim()
       };

 if(existing){
  Object.assign(existing,record)
 }else{
  state.billings.push(record)
 }

 storeBillingContractPrice(record.companyId,record.contractPrice,record.projectId);

 event.target.reset();
 $("billingId").value="";
 $("billingModal").classList.add("hidden");
 save(existing?"Úprava fakturácie":"Pridanie fakturácie")
};
function shiftMonth(v,delta){const [y,m]=v.split("-").map(Number),d=new Date(y,m-1+delta,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function daysInMonth(v){const [y,m]=v.split("-").map(Number);return new Date(y,m,0).getDate()}
function easterSunday(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;return new Date(year,month-1,day)}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function slovakHoliday(date){const y=date.getFullYear(),fixed={"01-01":"Deň vzniku SR","01-06":"Traja králi","05-01":"Sviatok práce","05-08":"Deň víťazstva","07-05":"Cyril a Metod","08-29":"SNP","09-01":"Deň Ústavy","09-15":"Sedembolestná Panna Mária","11-01":"Všetkých svätých","11-17":"Deň boja za slobodu","12-24":"Štedrý deň","12-25":"1. sviatok vianočný","12-26":"2. sviatok vianočný"},md=`${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;if(fixed[md])return fixed[md];const easter=easterSunday(y),good=new Date(easter);good.setDate(easter.getDate()-2);const mon=new Date(easter);mon.setDate(easter.getDate()+1);if(dateKey(date)===dateKey(good))return"Veľký piatok";if(dateKey(date)===dateKey(mon))return"Veľkonočný pondelok";return""}
function isBetpresWorkerRow(row){
 return Boolean(row?.isBetpres)||String(workerRowLabel(row)).trim().toUpperCase()==="BETPRES"
}
function ensureBetpresWorkerRow(sheet){
 let row=sheet.rows.find(isBetpresWorkerRow);
 if(!row){
  row={
   id:uid("wr"),
   name:"BETPRES",
   alias:"BETPRES",
   companyId:"",
   actualName:"Betpres s.r.o.",
   isBetpres:true,
   values:{}
  };
  sheet.rows.unshift(row)
 }
 row.name="BETPRES";
 row.alias="BETPRES";
 row.actualName="Betpres s.r.o.";
 row.isBetpres=true;
 row.values=row.values||{};
 return row
}
function syncBetpresWorkerRow(month,sheet){
 const targetSheet=sheet||workerSheet(month,true),
       betpresRow=ensureBetpresWorkerRow(targetSheet),
       timeSheet=betpresTimesheet(month,true),
       thpSheet=thpTimesheet(month,true),
       days=daysInMonth(month);
 betpresRow.values={};
 for(let day=1;day<=days;day++){
  const hourlyCount=timeSheet.rows.filter(employee=>attendanceHours(employee.values?.[day])>0||attendanceHours(employee.overtime?.[day])>0).length,
        thpCount=thpSheet.rows.filter(employee=>attendanceHours(employee.values?.[day])>0).length;
  betpresRow.values[day]=hourlyCount+thpCount
 }
 sortWorkerRows(targetSheet);
 return betpresRow
}
function workerSheet(month=selectedWorkerMonth,create=true){
 let sheet=state.workerSheets.find(x=>x.projectId===state.selectedProjectId&&x.month===month);
 if(!sheet&&create){
  const prev=[...state.workerSheets]
   .filter(x=>x.projectId===state.selectedProjectId&&x.month<month)
   .sort((a,b)=>b.month.localeCompare(a.month))[0];
  sheet={
   id:uid("ws"),
   projectId:state.selectedProjectId,
   month,
   rows:(prev?.rows||[])
    .filter(row=>!isBetpresWorkerRow(row))
    .map(r=>({
     id:uid("wr"),
     name:r.name||workerRowLabel(r),
     alias:r.alias||workerRowLabel(r),
     companyId:r.companyId||"",
     actualName:r.actualName||company(r.companyId)?.name||"",
     values:{}
    }))
  };
  ensureBetpresWorkerRow(sheet);
  sortWorkerRows(sheet);
  state.workerSheets.push(sheet);
  commitDirectState()
 }
 if(sheet)ensureBetpresWorkerRow(sheet);
 return sheet
}
function workerRowLabel(row){
 return String(row.alias||row.name||row.actualName||company(row.companyId)?.name||"Bez názvu").trim()
}
function workerRowActualLabel(row){
 const dbName=company(row?.companyId)?.name||"";
 return String(dbName||row?.actualName||"").trim()
}
function workerRowCustomLabel(row){
 const actual=workerRowActualLabel(row),label=workerRowLabel(row);
 if(actual&&label&&label.toLowerCase()!==actual.toLowerCase())return label;
 return ""
}
function workerRowMainLabel(row){
 return workerRowActualLabel(row)||workerRowLabel(row)
}
function workerRowNameHtml(row){
 const main=workerRowMainLabel(row),custom=workerRowCustomLabel(row);
 return `<strong>${esc(main)}</strong>${custom?`<small>${esc(custom)}</small>`:""}`
}
function sortWorkerRows(sheet){
 sheet.rows.sort((a,b)=>{
  const aBetpres=isBetpresWorkerRow(a),bBetpres=isBetpresWorkerRow(b);
  if(aBetpres&&!bBetpres)return-1;
  if(!aBetpres&&bBetpres)return 1;
  const aKey=workerRowActualLabel(a)||workerRowLabel(a);
  const bKey=workerRowActualLabel(b)||workerRowLabel(b);
  return aKey.localeCompare(bKey,"sk",{sensitivity:"base"})
 })
}
function workerCompanyMatchKey(value){
 return String(value||"")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("sk")
  .replace(/[^a-z0-9]+/g,"")
}
function syncAssignedWorkerRows(sheet){
 if(!sheet)return{changed:false,added:0,linked:0};
 sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
 const assignments=activeAssignments(),known=new Set(Array.isArray(sheet.knownAssignmentCompanyIds)?sheet.knownAssignmentCompanyIds:[]),rowsByCompanyId=new Map(),rowsByName=new Map();
 sheet.rows.filter(row=>!isBetpresWorkerRow(row)).forEach(row=>{
  if(row.companyId)rowsByCompanyId.set(row.companyId,row);
  [row.actualName,row.alias,row.name].map(workerCompanyMatchKey).filter(Boolean).forEach(key=>{if(!rowsByName.has(key))rowsByName.set(key,row)})
 });
 let added=0,linked=0;
 assignments.forEach(item=>{
  const companyData=company(item.companyId);
  if(!companyData)return;
  const name=String(companyData.name||"").trim(),key=workerCompanyMatchKey(name),existing=rowsByCompanyId.get(companyData.id)||rowsByName.get(key);
  if(existing){
   if(!existing.companyId){existing.companyId=companyData.id;linked++}
   if(!existing.actualName)existing.actualName=name;
   if(!existing.name)existing.name=name;
   if(!existing.alias)existing.alias=existing.name;
   rowsByCompanyId.set(companyData.id,existing)
  }else if(!known.has(companyData.id)){
   const row={id:uid("wr"),name,alias:name,companyId:companyData.id,actualName:name,values:{}};
   sheet.rows.push(row);rowsByCompanyId.set(companyData.id,row);if(key)rowsByName.set(key,row);added++
  }
 });
 const nextKnown=[...new Set([...known,...assignments.map(item=>item.companyId).filter(Boolean)])],knownChanged=JSON.stringify(nextKnown)!==JSON.stringify(sheet.knownAssignmentCompanyIds||[]);
 sheet.knownAssignmentCompanyIds=nextKnown;
 if(added||linked)sortWorkerRows(sheet);
 return{changed:Boolean(added||linked||knownChanged),added,linked}
}
function prepareWorkers(){
 if(!selectedWorkerMonth)selectedWorkerMonth=todayMonthValue();
 $("workerMonth").value=selectedWorkerMonth;
 const sheet=workerSheet(selectedWorkerMonth,true);
 const assignmentSync=syncAssignedWorkerRows(sheet);
 if(assignmentSync.changed)commitDirectState();
 betpresTimesheet(selectedWorkerMonth,true);
 thpTimesheet(selectedWorkerMonth,true);
 companyHourTimesheet(selectedWorkerMonth,true);
 syncBetpresWorkerRow(selectedWorkerMonth,sheet);
 const signature=workerRenderSignature();
 setWorkerMode(selectedWorkerMode,signature!==workerRenderSignatures.get(selectedWorkerMode))
}
function renderWorkers(){
 if(!$("workerHead"))return;
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue();
 selectedWorkerMonth=month;
 const sheet=workerSheet(month,true);
 syncBetpresWorkerRow(month,sheet);
 sortWorkerRows(sheet);

 const [year,mon]=month.split("-").map(Number),
       days=daysInMonth(month),
       today=todayISO(),
       names=["Ne","Po","Ut","St","Št","Pi","So"];

 const liveHeader=$("workerLiveHeader");
 if(liveHeader){
  const p=activeProject(),created=new Date().toLocaleDateString("sk-SK"),monthLabel=month.split("-").reverse().join("/"),todayDay=Number(todayISO().slice(8,10));
  const firmCount=Math.max(0,sheet.rows.length-1);
  const todayTotal=todayISO().slice(0,7)===month?sheet.rows.reduce((sum,row)=>sum+(Number(row.values?.[todayDay])||0),0):0;
  const filledDays=Array.from({length:days},(_,i)=>i+1).filter(day=>sheet.rows.some(row=>row.values?.[day]!==undefined&&row.values?.[day]!==""));
  const monthTotal=sheet.rows.reduce((total,row)=>total+Object.values(row.values||{}).reduce((a,b)=>a+(Number(b)||0),0),0);
  liveHeader.innerHTML=`
   <div class="worker-brand-card compact-worker-card">
    <div class="worker-brand-title-block">
      <div class="worker-brand-kicker">BETPRES SiteDesk · Stav pracovníkov</div>
      <h2>Stav pracovníkov – ${esc(p?.name||"Stavba")}</h2>
      <div class="worker-brand-meta">
       <span>Mesiac <strong>${esc(monthLabel)}</strong></span>
       <span>Vytvorené <strong>${esc(created)}</strong></span>
       <span>Aktuálny deň <strong>${todayISO().slice(0,7)===month?todayDay+"." : "—"}</strong></span>
      </div>
    </div>
    <div class="worker-brand-stats">
     <div><small>Počet firiem</small><strong>${firmCount}</strong></div>
     <div><small>Pracovníci dnes</small><strong>${formatWorkHoursCell(todayTotal)}</strong></div>
     <div><small>Pracovníci v mesiaci spolu</small><strong>${formatWorkHoursCell(monthTotal)}</strong></div>
    </div>
    <div class="worker-live-legend worker-brand-legend">
     <span><i class="worker-live-swatch weekend"></i> Víkend</span>
     <span><i class="worker-live-swatch holiday"></i> Sviatok</span>
     <span><i class="worker-live-swatch today"></i> Aktuálny deň</span>
     <span><i class="worker-live-swatch total"></i> Spolu za deň</span>
     <span class="worker-brand-help">Pôvodné ovládanie ostáva zachované: pridať firmu, exporty, import aj uloženie.</span>
    </div>
   </div>`;
 }

 let head=`<tr><th class="company-col">Firma / pracovník</th>`;
 for(let day=1;day<=days;day++){
  const date=new Date(year,mon-1,day),
        weekend=[0,6].includes(date.getDay()),
        holiday=slovakHoliday(date),
        key=dateKey(date),
        cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
  head+=`<th class="${cls}" title="${esc(holiday||"")}"><span class="worker-day-no">${day}</span><span class="worker-day-name">${names[date.getDay()]}</span>${holiday?`<span class="worker-holiday-name">${esc(holiday)}</span>`:""}</th>`
 }
 head+="</tr>";
 $("workerHead").innerHTML=head;

 $("workerBody").innerHTML=sheet.rows.map(row=>{
  const label=workerRowLabel(row),
        betpres=isBetpresWorkerRow(row);
  let cells=`<tr class="${betpres?"betpres-company-row":""}">
   <td class="company-col">
    <div class="worker-company-cell">
     <div class="worker-company-names">
      <span class="worker-company-main" title="${esc(workerRowMainLabel(row))}">${esc(workerRowMainLabel(row))}</span>
      ${workerRowCustomLabel(row)?`<span class="worker-company-alias">${esc(workerRowCustomLabel(row))}</span>`:""}
      ${betpres?`<small class="betpres-sync-note">automaticky z podsmenoviek BETPRES + THP</small>`:""}
     </div>
     ${betpres?"":`<button data-del-worker-row="${row.id}">Vymazať</button>`}
    </div>
   </td>`;
  for(let day=1;day<=days;day++){
   const date=new Date(year,mon-1,day),
         holiday=slovakHoliday(date),
         weekend=[0,6].includes(date.getDay()),
         key=dateKey(date),
         cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
   cells+=betpres
    ?`<td class="${cls}"><input class="betpres-auto-count" readonly tabindex="-1" data-betpres-company-day="${day}" value="${esc(formatWorkHoursCell(row.values?.[day]??""))}" title="Počet pracovníkov je prevzatý z podsmenoviek BETPRES a THP"></td>`
    :`<td class="${cls}"><input type="text" maxlength="3" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-worker-row="${row.id}" data-worker-day="${day}" value="${esc(row.values?.[day]??"")}" aria-label="Počet pracovníkov – deň ${day}"></td>`
  }
  return cells+"</tr>"
 }).join("");

 let foot=`<tr><td class="company-col worker-total">Spolu za deň</td>`;
 for(let day=1;day<=days;day++){
  const total=sheet.rows.reduce((sum,row)=>sum+(Number(row.values?.[day])||0),0),
        date=new Date(year,mon-1,day),
        holiday=slovakHoliday(date),
        weekend=[0,6].includes(date.getDay()),
        key=dateKey(date),
        cls=["worker-total",weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
  foot+=`<td class="${cls}" data-worker-total-day="${day}">${formatWorkHoursCell(total)}</td>`
 }
 $("workerFoot").innerHTML=foot+"</tr>";

 $("workerSheetStatus").textContent=`BETPRES + ${Math.max(0,sheet.rows.length-1)} firiem · BETPRES sa preberá z oboch podsmenoviek`;

 document.querySelectorAll("[data-worker-row]").forEach(input=>{
  input.onfocus=()=>beginDirectUndo("Úprava stavu pracovníkov");
  input.oninput=()=>{
   const row=sheet.rows.find(item=>item.id===input.dataset.workerRow);
   if(!row)return;
   row.values=row.values||{};
   const day=input.dataset.workerDay;
   const clean=input.value.replace(/\D/g,"").slice(0,3);
   if(input.value!==clean)input.value=clean;
   if(clean==="")delete row.values[day];
   else row.values[day]=Number(clean);
   commitDirectState();
   const total=sheet.rows.reduce((sum,item)=>sum+(Number(item.values?.[day])||0),0),
         cell=document.querySelector(`[data-worker-total-day="${day}"]`);
   if(cell)cell.textContent=formatWorkHoursCell(total);
   if(activeViewId()==="dashboard")renderDashboard()
  };
  input.onblur=endDirectUndo
 });

 document.querySelectorAll("[data-del-worker-row]").forEach(button=>{
  button.onclick=()=>{
   const row=sheet.rows.find(item=>item.id===button.dataset.delWorkerRow),
         label=row?workerRowLabel(row):"";
   if(confirm(`Vymazať „${label}“ z mesiaca ${month}?`)){
    sheet.rows=sheet.rows.filter(item=>item.id!==button.dataset.delWorkerRow);
    save("Vymazanie názvu zo stavu pracovníkov")
   }
  }
 })
}
$("workerMonth").onchange=()=>{selectedWorkerMonth=$("workerMonth").value;workerSheet(selectedWorkerMonth,true);betpresTimesheet(selectedWorkerMonth,true);thpTimesheet(selectedWorkerMonth,true);companyHourTimesheet(selectedWorkerMonth,true);renderWorkers();renderBetpresTimesheet();renderThpTimesheet();renderCompanyHoursTimesheet()};$("workerPrevMonth").onclick=()=>{$("workerMonth").value=shiftMonth($("workerMonth").value||todayMonthValue(),-1);$("workerMonth").dispatchEvent(new Event("change"))};$("workerNextMonth").onclick=()=>{$("workerMonth").value=shiftMonth($("workerMonth").value||todayMonthValue(),1);$("workerMonth").dispatchEvent(new Event("change"))};$("workerCurrentMonth").onclick=()=>{$("workerMonth").value=todayMonthValue();$("workerMonth").dispatchEvent(new Event("change"));setTimeout(scrollWorkerCurrentDay,0)};
function carryWorkerCompaniesFromPreviousMonth(){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),previousMonth=shiftMonth(month,-1),previous=workerSheet(previousMonth,false);
 if(!previous){alert(`Pre mesiac ${previousMonth.split("-").reverse().join("/")} nie je uložený stav pracovníkov.`);return}
 const target=workerSheet(month,true),targetRows=target.rows.filter(row=>!isBetpresWorkerRow(row));
 let added=0,renamed=0;
 previous.rows.filter(row=>!isBetpresWorkerRow(row)).forEach(source=>{
  const sourceKeys=[source.actualName,source.alias,source.name].map(workerCompanyMatchKey).filter(Boolean),existing=targetRows.find(row=>source.companyId&&row.companyId===source.companyId)||targetRows.find(row=>{
   const rowKeys=[row.actualName,row.alias,row.name].map(workerCompanyMatchKey).filter(Boolean);
   return sourceKeys.some(key=>rowKeys.includes(key))
  });
  if(existing){
   const custom=workerRowCustomLabel(source);
   if(custom&&!workerRowCustomLabel(existing)){existing.name=custom;existing.alias=custom;renamed++}
   if(!existing.companyId&&source.companyId)existing.companyId=source.companyId;
   if(!existing.actualName&&source.actualName)existing.actualName=source.actualName;
   return
  }
  const copied={id:uid("wr"),name:source.name||workerRowLabel(source),alias:source.alias||workerRowLabel(source),companyId:source.companyId||"",actualName:source.actualName||company(source.companyId)?.name||"",values:{}};
  target.rows.push(copied);targetRows.push(copied);added++
 });
 sortWorkerRows(target);
 if(!added&&!renamed){alert("Všetky firmy z minulého mesiaca už v tomto mesiaci sú.");return}
 save(`${added} firiem prenesených z minulého mesiaca${renamed?` · ${renamed} vlastných názvov doplnených`:""}`)
}
if($("carryWorkerCompanies"))$("carryWorkerCompanies").onclick=carryWorkerCompaniesFromPreviousMonth;
function updateWorkerNamePreview(){
 const custom=$("workerCustomName").value.trim(),cid=$("workerDatabaseCompany").value,c=company(cid);
 const label=custom||(c?.name||"Vyber firmu alebo zadaj vlastný názov");
 $("workerNamePreview").innerHTML=c&&custom
  ?`<strong>${esc(c.name)}</strong><span>Vlastný názov sa zobrazí pod skutočným názvom: ${esc(custom)}</span>`
  :`<strong>${esc(label)}</strong><span>${c?`Názov je prevzatý zo spoločnej databázy.`:`Tento názov sa zobrazí v tabuľke aj v PDF.`}</span>`
}
$("addWorkerCompany").onclick=()=>{
 const dbCompanies=[...state.companies].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 $("workerDatabaseCompany").innerHTML=`<option value="">Nevybraná – použijem vlastný názov</option>`+dbCompanies.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 $("workerDatabaseCompany").value="";$("workerCustomName").value="";updateWorkerNamePreview();
 $("workerCompanyModal").classList.remove("hidden");setTimeout(()=>$("workerDatabaseCompany").focus(),50)
};
$("workerCustomName").oninput=updateWorkerNamePreview;
$("workerDatabaseCompany").onchange=updateWorkerNamePreview;
$("workerCompanyForm").onsubmit=e=>{
 e.preventDefault();
 const companyId=$("workerDatabaseCompany").value,custom=$("workerCustomName").value.trim(),dbCompany=company(companyId);
 const name=custom||(dbCompany?.name||"");
 if(!name){alert("Vyber firmu z databázy alebo zadaj vlastný názov.");return}
 const sheet=workerSheet(selectedWorkerMonth,true);
 if(sheet.rows.some(r=>workerRowLabel(r).toLowerCase()===name.toLowerCase())){alert("Rovnaký názov už v tomto mesiaci existuje.");return}
 sheet.rows.push({id:uid("wr"),name,alias:custom||name,companyId:companyId||"",actualName:dbCompany?.name||"",values:{}});
 sortWorkerRows(sheet);$("workerCompanyModal").classList.add("hidden");save("Pridanie firmy do stavu pracovníkov")
};


function betpresTimesheet(month,create=true){
 let sheet=state.betpresTimesheets.find(x=>x.projectId===state.selectedProjectId&&x.month===month);
 if(!sheet&&create){
  const previous=[...state.betpresTimesheets]
   .filter(x=>x.projectId===state.selectedProjectId&&x.month<month)
   .sort((a,b)=>b.month.localeCompare(a.month))[0];
  sheet={
   id:uid("bts"),
   projectId:state.selectedProjectId,
   month,
   rows:(previous?.rows||[]).map((row,index)=>({
    id:uid("bte"),
    name:row.name||"",
    position:row.position||"",
    rewardPercent:row.rewardPercent??"",
    sortOrder:Number.isFinite(Number(row.sortOrder))?Number(row.sortOrder):index,
    values:{},
    overtime:{}
   }))
  };
  sortBetpresEmployees(sheet);
  state.betpresTimesheets.push(sheet);
  commitDirectState()
 }
 if(sheet){
  sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
  sheet.rows.forEach(row=>{row.values=row.values||{};row.overtime=row.overtime||{}})
 }
 return sheet
}
function ensureBetpresEmployeeOrder(sheet){
 sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
 sheet.rows.forEach((row,index)=>{
  if(!Number.isFinite(Number(row.sortOrder)))row.sortOrder=index
 });
}
function sortBetpresEmployees(sheet){
 sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
 sheet.rows.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"sk",{
  sensitivity:"base",
  ignorePunctuation:true,
  numeric:true
 }));
 sheet.rows.forEach((row,index)=>row.sortOrder=index)
}
const ATTENDANCE_CODES=["P","N","D"];
function attendanceCode(value){
 const code=String(value??"").trim().toUpperCase();
 return ATTENDANCE_CODES.includes(code)?code:""
}
function attendanceHours(value){
 if(attendanceCode(value))return 0;
 const number=Number(String(value??"").replace(",","."));
 return Number.isFinite(number)&&number>0?number:0
}
function normalizeAttendanceValue(value,max=24){
 const raw=String(value??"").trim().toUpperCase();
 if(raw==="")return"";
 if(ATTENDANCE_CODES.includes(raw))return raw;
 const number=Number(raw.replace(",","."));
 if(!Number.isFinite(number))return null;
 return Math.max(0,Math.min(max,number))
}
function normalizeHourOnlyValue(value,max=24){
 const raw=String(value??"").trim();
 if(raw==="")return"";
 const number=Number(raw.replace(",","."));
 if(!Number.isFinite(number))return null;
 return Math.max(0,Math.min(max,number))
}
function formatWorkHours(value){
 const code=attendanceCode(value);
 if(code)return code;
 const number=attendanceHours(value);
 return Number.isInteger(number)?String(number):number.toLocaleString("sk-SK",{maximumFractionDigits:2})
}
function formatWorkHoursCell(value){
 const code=attendanceCode(value);
 if(code)return code;
 const raw=String(value??"").trim();
 if(raw==="")return "";
 const number=Number(raw.replace(",","."));
 if(!Number.isFinite(number)||number<=0)return "";
 return Number.isInteger(number)?String(number):number.toLocaleString("sk-SK",{maximumFractionDigits:2})
}
function isElapsedTimesheetExportDay(month,day){
 const [year,mon]=String(month||"").split("-").map(Number);
 if(!Number.isFinite(year)||!Number.isFinite(mon)||!Number.isFinite(Number(day)))return false;
 const today=todayISO();
 const current=new Date(`${today}T00:00:00`);
 const target=new Date(year,mon-1,Number(day));
 return target.getTime()<=current.getTime()
}
function formatWorkerStateExportCell(value,month,day){
 const formatted=formatWorkHoursCell(value);
 return formatted|| (isElapsedTimesheetExportDay(month,day)?"0":"")
}
function formatWorkHoursPlus(value){
 const formatted=formatWorkHoursCell(value);
 return formatted||""
}
function formatCombinedThpHours(value,overtime){
 const hours=formatWorkHoursPlus(value),extra=formatWorkHoursCell(overtime);
 return extra?`${hours||"0"}+${extra}`:hours
}
function formatStackedThpHours(value,overtime){
 const hours=formatWorkHoursPlus(value),extra=formatWorkHoursCell(overtime);
 return extra?`${hours||"0"}\n${extra}`:hours
}
function formatThpHoursStackHtml(value,overtime){
 const hours=formatWorkHoursPlus(value),extra=formatWorkHoursCell(overtime);
 if(!hours&&!extra)return "";
 return `<span class="thp-hours-main">${esc(hours)}</span>${extra?`<span class="thp-hours-overtime">${esc(extra)}</span>`:""}`
}
function parseCombinedThpHours(value){
 const raw=String(value??"").trim();
 if(!raw)return{hours:"",overtime:""};
 const parts=raw.split(/\s*(?:\+|\r?\n)\s*/).map(part=>part.trim());
 if(parts.length>2||!parts[0])return null;
 const hours=normalizeAttendanceValue(parts[0],24),overtime=parts.length===2?normalizeHourOnlyValue(parts[1],24):"";
 if(hours===null||overtime===null||parts.length===2&&parts[1]==="")return null;
 return{hours,overtime}
}
function formatThpLabel(label,value){
 const formatted=formatWorkHoursCell(value);
 return formatted||""
}
function thpTimesheet(month,create=true){
 let sheet=state.thpTimesheets.find(x=>x.projectId===state.selectedProjectId&&x.month===month);
 if(!sheet&&create){
  const previous=[...state.thpTimesheets]
   .filter(x=>x.projectId===state.selectedProjectId&&x.month<month)
   .sort((a,b)=>b.month.localeCompare(a.month))[0];
  sheet={
   id:uid("thps"),
   projectId:state.selectedProjectId,
   month,
   rows:(previous?.rows||[]).map((row,index)=>({
    id:uid("thpe"),
    name:row.name||"",
    position:row.position||"",
    sortOrder:Number.isFinite(Number(row.sortOrder))?Number(row.sortOrder):index,
    values:{},
    overtime:{}
   }))
  };
  sortThpEmployees(sheet);
  state.thpTimesheets.push(sheet);
  commitDirectState()
 }
 if(sheet){
  sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
  sheet.rows.forEach(row=>{
   row.values=row.values||{};
   row.overtime=row.overtime||{}
  })
 }
 return sheet
}
function sortThpEmployees(sheet){
 sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
 sheet.rows.sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"sk",{
  sensitivity:"base",ignorePunctuation:true,numeric:true
 }));
 sheet.rows.forEach((row,index)=>row.sortOrder=index)
}
function workerRenderSignature(){
 const sheet=selectedWorkerMode==="betpres"
  ?betpresTimesheet(selectedWorkerMonth,true)
  :selectedWorkerMode==="thp"
   ?thpTimesheet(selectedWorkerMonth,true)
   :selectedWorkerMode==="companyHours"
    ?companyHourTimesheet(selectedWorkerMonth,true)
    :workerSheet(selectedWorkerMonth,true),assignments=activeAssignments();
 return JSON.stringify([state.selectedProjectId,selectedWorkerMonth,selectedWorkerMode,sheet?.rows||[],assignments.map(item=>[item.id,item.companyId,item.scope]),state.companies.map(item=>[item.id,item.name])])
}
function setWorkerMode(mode,renderMode=true){
 selectedWorkerMode=["betpres","thp","companyHours"].includes(mode)?mode:"companies";
 const currentSignature=workerRenderSignature();
 if(renderMode&&currentSignature===workerRenderSignatures.get(selectedWorkerMode))renderMode=false;
 if(renderMode){
  if(selectedWorkerMode==="betpres")renderBetpresTimesheet();
  else if(selectedWorkerMode==="thp")renderThpTimesheet();
  else if(selectedWorkerMode==="companyHours")renderCompanyHoursTimesheet();
  else renderWorkers();
 }
 document.querySelectorAll("[data-worker-mode]").forEach(button=>{
  const active=button.dataset.workerMode===selectedWorkerMode;
  button.classList.toggle("active",active);
  button.setAttribute("aria-selected",String(active));
  button.tabIndex=active?0:-1
 });
 $("workerCompaniesPanel").classList.toggle("hidden",selectedWorkerMode!=="companies");
 $("betpresTimesheetPanel").classList.toggle("hidden",selectedWorkerMode!=="betpres");
 $("thpTimesheetPanel").classList.toggle("hidden",selectedWorkerMode!=="thp");
 if($("companyHoursPanel"))$("companyHoursPanel").classList.toggle("hidden",selectedWorkerMode!=="companyHours");
 document.querySelectorAll(".worker-company-action").forEach(element=>element.classList.toggle("hidden",selectedWorkerMode!=="companies"));
 document.querySelectorAll(".worker-betpres-action").forEach(element=>element.classList.toggle("hidden",selectedWorkerMode!=="betpres"));
 document.querySelectorAll(".worker-thp-action").forEach(element=>element.classList.toggle("hidden",selectedWorkerMode!=="thp"));
 document.querySelectorAll(".worker-company-hours-action").forEach(element=>element.classList.toggle("hidden",selectedWorkerMode!=="companyHours"));
 const sheet=selectedWorkerMode==="betpres"
  ?betpresTimesheet(selectedWorkerMonth,true)
  :selectedWorkerMode==="thp"
   ?thpTimesheet(selectedWorkerMonth,true)
   :selectedWorkerMode==="companyHours"
    ?companyHourTimesheet(selectedWorkerMonth,true)
    :workerSheet(selectedWorkerMonth,true);
 $("workerSheetStatus").textContent=selectedWorkerMode==="betpres"
  ?`${sheet?.rows?.length||0} pracovníkov BETPRES · bežné hodiny + nadčas alebo P / N / D`
  :selectedWorkerMode==="thp"
   ?`${sheet?.rows?.length||0} THP pracovníkov · hodiny + nadčas`
   :selectedWorkerMode==="companyHours"
    ?`${sheet?.rows?.length||0} firiem na hodiny · z hodín vytvoríš súpis prác`
    :`${sheet?.rows?.length||0} názvov · zapisuje sa počet pracovníkov`;
 if(renderMode)workerRenderSignatures.set(selectedWorkerMode,workerRenderSignature())
}
let workerModeSwitchToken=0;
document.querySelectorAll("[data-worker-mode]").forEach(button=>{
 button.onclick=()=>{
  const token=++workerModeSwitchToken,mode=button.dataset.workerMode;
  setWorkerMode(mode,false);
  requestAnimationFrame(()=>setTimeout(()=>{
   if(token===workerModeSwitchToken&&activeViewId()==="workers")setWorkerMode(mode,true)
  },0))
 }
});

const WORKER_GRID_INPUT_SELECTOR="input[data-worker-row][data-worker-day],input[data-betpres-cell][data-day],input[data-thp-cell][data-day],input[data-thp-overtime][data-day],input[data-company-hour-worker][data-company-hour-day]";
function workerGridInputLocator(input){
 const escape=value=>CSS.escape(String(value??""));
 if(input.dataset.workerRow)return`[data-worker-row="${escape(input.dataset.workerRow)}"][data-worker-day="${escape(input.dataset.workerDay)}"]`;
 if(input.dataset.betpresCell)return`[data-betpres-cell="${escape(input.dataset.betpresCell)}"][data-day="${escape(input.dataset.day)}"]`;
 if(input.dataset.thpCell)return`[data-thp-cell="${escape(input.dataset.thpCell)}"][data-day="${escape(input.dataset.day)}"]`;
 if(input.dataset.thpOvertime)return`[data-thp-overtime="${escape(input.dataset.thpOvertime)}"][data-day="${escape(input.dataset.day)}"]`;
 if(input.dataset.companyHourWorker)return`[data-company-hour-worker="${escape(input.dataset.companyHourWorker)}"][data-company-hour-day="${escape(input.dataset.companyHourDay)}"]`;
 return""
}
function focusWorkerGridInput(input){
 const locator=workerGridInputLocator(input);
 if(!locator)return;
 setTimeout(()=>{
  const current=document.querySelector(locator);
  if(!current)return;
  current.focus({preventScroll:true});
  current.select?.();
  current.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"})
 },0)
}
function moveWorkerGridFocus(input,rowStep,columnStep){
 const row=input.closest("tr"),cell=input.closest("td"),table=input.closest("table");
 if(!row||!cell||!table)return;
 const bodyRows=[...table.tBodies].flatMap(body=>[...body.rows]);
 const rowIndex=bodyRows.indexOf(row);
 let target=null;
 if(columnStep){
  const rowInputs=[...row.querySelectorAll(WORKER_GRID_INPUT_SELECTOR)];
  const inputIndex=rowInputs.indexOf(input);
  target=rowInputs[inputIndex+columnStep]||null
 }else if(rowStep){
  const cellInputs=[...cell.querySelectorAll(WORKER_GRID_INPUT_SELECTOR)],cellInputIndex=Math.max(0,cellInputs.indexOf(input));
  for(let index=rowIndex+rowStep;index>=0&&index<bodyRows.length;index+=rowStep){
   const targetInputs=[...(bodyRows[index].cells[cell.cellIndex]?.querySelectorAll(WORKER_GRID_INPUT_SELECTOR)||[])];
   target=targetInputs[cellInputIndex]||targetInputs[0]||null;
   if(target)break
  }
 }
 if(target)focusWorkerGridInput(target)
}
function scrollWorkerCurrentDay(){
 const todayCell=document.querySelector("#workers .today-col input"),wrap=todayCell?.closest(".worker-table-wrap");
 if(todayCell&&wrap)todayCell.scrollIntoView({block:"nearest",inline:"center",behavior:"auto"})
}
function setupWorkerTableControls(){
 const tabList=document.querySelector(".worker-mode-tabs"),tabs=[...document.querySelectorAll("[data-worker-mode]")];
 if(tabList)tabList.setAttribute("role","tablist");
 tabs.forEach((button,index)=>{
  button.setAttribute("role","tab");
  button.setAttribute("aria-label",`${index+1}. ${button.querySelector("strong")?.textContent?.trim()||"Režim"}`);
  button.title=`Alt+${index+1} · ${button.querySelector("small")?.textContent?.trim()||"Otvorí režim"}`;
  button.addEventListener("keydown",event=>{
   if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
   event.preventDefault();
   const current=tabs.indexOf(button),next=event.key==="Home"?0:event.key==="End"?tabs.length-1:(current+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
   tabs[next].click();tabs[next].focus()
  })
 });
 document.querySelectorAll("#workers .worker-table-wrap").forEach(wrap=>{
  const updateEdges=()=>{
   wrap.classList.toggle("is-scrolled-x",wrap.scrollLeft>2);
   wrap.classList.toggle("has-more-x",wrap.scrollLeft+wrap.clientWidth<wrap.scrollWidth-2)
  };
  wrap.addEventListener("scroll",updateEdges,{passive:true});
  wrap.addEventListener("wheel",event=>{
   if(!event.shiftKey||Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
   event.preventDefault();wrap.scrollLeft+=event.deltaY;updateEdges()
  },{passive:false});
  requestAnimationFrame(updateEdges)
 })
}
setupWorkerTableControls();
document.addEventListener("focusin",event=>{
 const input=event.target.closest?.(WORKER_GRID_INPUT_SELECTOR);
 if(!input)return;
 input.closest("td")?.classList.add("worker-active-cell");
 input.closest("tr")?.classList.add("worker-active-row");
 input.select?.()
});
document.addEventListener("focusout",event=>{
 const input=event.target.closest?.(WORKER_GRID_INPUT_SELECTOR);
 if(!input)return;
 input.closest("td")?.classList.remove("worker-active-cell");
 input.closest("tr")?.classList.remove("worker-active-row")
});
document.addEventListener("keydown",event=>{
 if(activeViewId()!=="workers")return;
 if(event.altKey&&!event.ctrlKey&&!event.metaKey&&/^[1-4]$/.test(event.key)){
  event.preventDefault();document.querySelectorAll("[data-worker-mode]")[Number(event.key)-1]?.click();return
 }
 const input=event.target.closest?.(WORKER_GRID_INPUT_SELECTOR);
 if(!input||event.ctrlKey||event.metaKey||event.altKey)return;
 const move=event.key==="Enter"?[event.shiftKey?-1:1,0]:event.key==="ArrowUp"?[-1,0]:event.key==="ArrowDown"?[1,0]:event.key==="ArrowLeft"?[0,-1]:event.key==="ArrowRight"?[0,1]:null;
 if(!move)return;
 event.preventDefault();moveWorkerGridFocus(input,move[0],move[1])
});

function splitCompanyHourWorkerNames(text){
 return String(text||"").split(/[\n;,]+/).map(name=>name.trim()).filter(Boolean)
}
function companyHourWorkers(row){
 if(!row)return[];
 const oldValues=row.values||{};
 if(!Array.isArray(row.workers)){
  const names=splitCompanyHourWorkerNames(row.workersText||row.workerNames||"");
  row.workers=(names.length?names:[""]).map((name,index)=>({
   id:uid("chw"),
   name,
   values:index===0?{...oldValues}:{}
  }))
 }
 row.workers=row.workers.map(worker=>({
  id:worker.id||uid("chw"),
  name:worker.name||"",
  values:worker.values||{}
 }));
 if(!row.workers.length)row.workers.push({id:uid("chw"),name:"",values:{}});
 row.workersText=row.workers.map(worker=>worker.name).filter(Boolean).join(", ");
 row.values=row.values||{};
 return row.workers
}

function projectCompanies(){
 return activeAssignments().map(a=>company(a.companyId)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"))
}
function renderSimpleEmployeeTimesheet(config){
 const headEl=$(config.head),bodyEl=$(config.body),footEl=$(config.foot);
 if(!headEl||!bodyEl||!footEl)return;
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=config.sheet(month,true),[year,mon]=month.split("-").map(Number),days=daysInMonth(month),today=todayISO(),dayNames=["Ne","Po","Ut","St","Št","Pi","So"];
 config.sort(sheet);
 if(config.overtime)sheet.rows.forEach(row=>{row.values=row.values||{};row.overtime=row.overtime||{}});
 let head=`<tr><th class="employee-col">Meno a pozícia</th>`;
 for(let day=1;day<=days;day++){
  const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
  head+=`<th class="${cls}" title="${esc(holiday||"")}"><span class="worker-day-name">${dayNames[date.getDay()]}</span>${day}${holiday?`<span class="worker-holiday-name">${esc(holiday)}</span>`:""}</th>`
 }
 head+=`<th class="monthly-total-col">Spolu</th></tr>`;
 headEl.innerHTML=head;
 let grand=0,overtimeGrand=0,workedDays=new Set();
 bodyEl.innerHTML=sheet.rows.map(row=>{
  row.values=row.values||{};
  row.overtime=row.overtime||{};
  let total=0,overtimeTotal=0,cells=`<tr><td class="employee-cell"><div class="employee-identity"><div class="employee-name">${esc(row.name||"")}</div><input class="employee-position-input" data-${config.key}-position="${row.id}" value="${esc(row.position||"")}" placeholder="Pozícia / čo robí" autocomplete="off">${config.key==="betpres"?`<label class="employee-reward-field"><span>Odmena</span><input type="text" inputmode="decimal" maxlength="6" data-betpres-reward="${row.id}" value="${esc(row.rewardPercent??"")}" placeholder="0"><b>%</b></label>`:""}</div><button class="employee-delete-btn" data-del-${config.key}="${row.id}">×</button></td>`;
  for(let day=1;day<=days;day++){
   const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),value=row.values?.[day]??"",cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
   const overtime=row.overtime?.[day]??"",h=attendanceHours(value),oh=attendanceHours(overtime);total+=h;overtimeTotal+=oh;if(h>0||oh>0)workedDays.add(day);
    cells+=config.overtime
     ?`<td class="${cls}"><div class="thp-day-stack"><input class="thp-hours-input" type="text" maxlength="5" inputmode="decimal" spellcheck="false" data-${config.key}-cell="${row.id}" data-day="${day}" value="${esc(formatWorkHoursPlus(value))}" placeholder="" title="Bežné hodiny" aria-label="THP bežné hodiny – deň ${day}"><input class="thp-overtime-input" type="text" maxlength="5" inputmode="decimal" spellcheck="false" data-${config.key}-overtime="${row.id}" data-day="${day}" value="${esc(formatWorkHoursCell(overtime))}" placeholder="" title="Nadčas" aria-label="THP nadčas – deň ${day}"></div></td>`
    :`<td class="${cls}"><input type="text" maxlength="5" inputmode="decimal" spellcheck="false" data-${config.key}-cell="${row.id}" data-day="${day}" value="${esc(formatWorkHoursPlus(value))}"></td>`
  }
  grand+=total;overtimeGrand+=overtimeTotal;
   cells+=config.overtime?`<td class="monthly-total-col"><div class="thp-month-total"><strong>${total?`${formatWorkHoursCell(total)} h`:""}</strong><small>${overtimeTotal?`${formatWorkHoursCell(overtimeTotal)} h nadčas`:""}</small></div></td></tr>`:`<td class="monthly-total-col"><strong>${formatWorkHoursCell(total)||"0"}</strong></td></tr>`;
  return cells
 }).join("")||`<tr><td colspan="${days+2}" style="padding:20px;color:#789;text-align:left">Zatiaľ nie je pridaný žiadny pracovník.</td></tr>`;
 let foot=`<tr><td class="employee-col">Spolu za deň</td>`;
 for(let day=1;day<=days;day++){
  const total=sheet.rows.reduce((sum,row)=>sum+attendanceHours(row.values?.[day]),0),overtimeTotal=sheet.rows.reduce((sum,row)=>sum+attendanceHours(row.overtime?.[day]),0),date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
   foot+=config.overtime?`<td class="${cls}"><strong class="thp-combined-total">${formatThpHoursStackHtml(total,overtimeTotal)}</strong></td>`:`<td class="${cls}">${formatWorkHoursCell(total)}</td>`
 }
  foot+=config.overtime?`<td class="monthly-total-col"><div class="thp-month-total"><strong>${grand?`${formatWorkHoursCell(grand)} h`:""}</strong><small>${overtimeGrand?`${formatWorkHoursCell(overtimeGrand)} h nadčas`:""}</small></div></td></tr>`:`<td class="monthly-total-col"><strong>${formatWorkHoursCell(grand)||"0"}</strong></td></tr>`;
 footEl.innerHTML=foot;
 if($(config.count))$(config.count).textContent=sheet.rows.length;
 if($(config.hours))$(config.hours).textContent=config.overtime&&!grand?"":`${formatWorkHours(grand)} h`;
 if(config.days&&$(config.days))$(config.days).textContent=workedDays.size;
 if(config.overtimeMetric&&$(config.overtimeMetric))$(config.overtimeMetric).textContent=overtimeGrand?`${formatWorkHours(overtimeGrand)} h`:"";
 if(config.status&&selectedWorkerMode===config.mode)$("workerSheetStatus").textContent=config.overtime&&!grand&&!overtimeGrand?`${sheet.rows.length} pracovníkov`:config.overtime&&overtimeGrand?`${sheet.rows.length} pracovníkov · ${formatWorkHours(grand)} h + ${formatWorkHours(overtimeGrand)} h nadčas`:`${sheet.rows.length} pracovníkov · ${formatWorkHours(grand)} h`;
 document.querySelectorAll(`[data-${config.key}-cell]`).forEach(input=>{
  input.onfocus=()=>beginDirectUndo(config.undo);
  input.onchange=()=>{
   const row=sheet.rows.find(r=>r.id===input.dataset[config.key+"Cell"]);
   if(!row)return;
   const day=input.dataset.day,value=normalizeAttendanceValue(input.value,24);
   if(value===null){alert("Zadaj hodiny od 0 do 24 alebo kód P, N, D.");input.value=formatWorkHoursPlus(row.values?.[day]??"");return}
   if(value===""||value===0)delete row.values[day];else row.values[day]=value;
   input.value=formatWorkHoursPlus(value);
   commitDirectState();
   config.render();
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll(`[data-${config.key}-overtime]`).forEach(input=>{
  input.onfocus=()=>beginDirectUndo(config.undo);
  input.onchange=()=>{
   const row=sheet.rows.find(r=>r.id===input.dataset[config.key+"Overtime"]);
   if(!row)return;
   row.overtime=row.overtime||{};
   const day=input.dataset.day,value=normalizeHourOnlyValue(input.value,24);
   if(value===null){alert("Zadaj nadčas od 0 do 24.");input.value=formatWorkHoursCell(row.overtime?.[day]??"");return}
   if(value===""||value===0)delete row.overtime[day];else row.overtime[day]=value;
   input.value=formatWorkHoursCell(value);
   commitDirectState();
   config.render();
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll(`[data-${config.key}-combined]`).forEach(input=>{
  input.onfocus=()=>beginDirectUndo(config.undo);
  input.onchange=()=>{
   const row=sheet.rows.find(r=>r.id===input.dataset[config.key+"Combined"]);
   if(!row)return;
   const day=input.dataset.day,parsed=parseCombinedThpHours(input.value);
   if(!parsed){alert("Zadaj napríklad 8 alebo 8+2, kde 2 sú hodiny nadčasu.");input.value=formatStackedThpHours(row.values?.[day],row.overtime?.[day]);return}
   row.values=row.values||{};row.overtime=row.overtime||{};
   if(parsed.hours===""||parsed.hours===0)delete row.values[day];else row.values[day]=parsed.hours;
   if(parsed.overtime===""||parsed.overtime===0)delete row.overtime[day];else row.overtime[day]=parsed.overtime;
   input.value=formatStackedThpHours(parsed.hours,parsed.overtime);
   commitDirectState();config.render()
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll(`[data-${config.key}-position]`).forEach(input=>{
  input.onfocus=()=>beginDirectUndo(config.undo);
  input.oninput=()=>{const row=sheet.rows.find(r=>r.id===input.dataset[config.key+"Position"]);if(!row)return;row.position=input.value;commitDirectState()};
 input.onblur=()=>endDirectUndo()
 });
 if(config.key==="betpres")document.querySelectorAll("[data-betpres-reward]").forEach(input=>{
  input.onfocus=()=>beginDirectUndo("Úprava percenta odmeny");
  input.oninput=()=>{
   const row=sheet.rows.find(r=>r.id===input.dataset.betpresReward);
   if(!row)return;
   const raw=input.value.replace(/[^0-9,.]/g,"").replace(",","."),value=raw===""?"":Math.max(0,Math.min(100,Number(raw)));
   if(raw!==""&&!Number.isFinite(value))return;
   row.rewardPercent=value;
   commitDirectState()
  };
  input.onblur=()=>{const row=sheet.rows.find(r=>r.id===input.dataset.betpresReward);input.value=row?.rewardPercent??"";endDirectUndo()}
 });
 document.querySelectorAll(`[data-del-${config.key}]`).forEach(button=>{
  button.onclick=()=>{if(confirm("Vymazať pracovníka zo smenovky?")){sheet.rows=sheet.rows.filter(r=>r.id!==button.dataset[`del${config.key.charAt(0).toUpperCase()+config.key.slice(1)}`]);save("Pracovník bol vymazaný zo smenovky.")}}
 })
}
function renderBetpresTimesheet(){
 renderSimpleEmployeeTimesheet({key:"betpres",mode:"betpres",head:"betpresTimeHead",body:"betpresTimeBody",foot:"betpresTimeFoot",count:"betpresEmployeeCount",hours:"betpresHoursTotal",days:"betpresWorkedDays",status:true,sheet:betpresTimesheet,sort:sortBetpresEmployees,render:renderBetpresTimesheet,undo:"Úprava podsmenovky BETPRES"})
}
function renderThpTimesheet(){
 renderSimpleEmployeeTimesheet({key:"thp",mode:"thp",head:"thpTimeHead",body:"thpTimeBody",foot:"thpTimeFoot",count:"thpEmployeeCount",hours:"thpHoursTotal",overtime:true,overtimeMetric:"thpOvertimeTotal",status:true,sheet:thpTimesheet,sort:sortThpEmployees,render:renderThpTimesheet,undo:"Úprava podsmenovky THP"})
}
function employeeNameSuggestions(kind){
 const sheets=kind==="thp"?state.thpTimesheets:state.betpresTimesheets,map=new Map();
 [...sheets].sort((a,b)=>String(b.month||"").localeCompare(String(a.month||""))).forEach(sheet=>(sheet.rows||[]).forEach(row=>{const name=String(row.name||"").trim();if(name&&!map.has(name.toLocaleLowerCase("sk")))map.set(name.toLocaleLowerCase("sk"),{name,position:String(row.position||"").trim(),rewardPercent:row.rewardPercent??""})}));
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"))
}
function openEmployeeModal(kind){
 const isThp=kind==="thp",form=$(isThp?"thpEmployeeForm":"betpresEmployeeForm"),modal=$(isThp?"thpEmployeeModal":"betpresEmployeeModal"),nameInput=$(isThp?"thpEmployeeName":"betpresEmployeeName"),positionInput=$(isThp?"thpEmployeePosition":"betpresEmployeePosition"),rewardInput=isThp?null:$("betpresEmployeeReward"),list=$(isThp?"thpEmployeeSuggestions":"betpresEmployeeSuggestions"),items=employeeNameSuggestions(kind);
 form.reset();
 if(list)list.innerHTML=items.map(item=>`<option value="${esc(item.name)}">${esc(item.position)}</option>`).join("");
 nameInput.oninput=()=>{const found=items.find(item=>item.name.toLocaleLowerCase("sk")===nameInput.value.trim().toLocaleLowerCase("sk"));if(found&&!positionInput.value)positionInput.value=found.position;if(found&&rewardInput&&!rewardInput.value)rewardInput.value=found.rewardPercent??""};
 modal.classList.remove("hidden");setTimeout(()=>nameInput.focus(),50)
}
if($("addBetpresEmployee"))$("addBetpresEmployee").onclick=()=>openEmployeeModal("betpres");
if($("addBetpresEmployeeInline"))$("addBetpresEmployeeInline").onclick=()=>openEmployeeModal("betpres");
if($("betpresEmployeeForm"))$("betpresEmployeeForm").onsubmit=e=>{e.preventDefault();const sheet=betpresTimesheet(selectedWorkerMonth,true),rewardRaw=$("betpresEmployeeReward").value.trim().replace(",","."),reward=rewardRaw===""?"":Math.max(0,Math.min(100,Number(rewardRaw)));sheet.rows.push({id:uid("bte"),name:$("betpresEmployeeName").value.trim(),position:$("betpresEmployeePosition").value.trim(),rewardPercent:Number.isFinite(reward)?reward:"",values:{},overtime:{}});sortBetpresEmployees(sheet);$("betpresEmployeeModal").classList.add("hidden");save("Pracovník BETPRES bol pridaný.")};
if($("addThpEmployee"))$("addThpEmployee").onclick=()=>openEmployeeModal("thp");
if($("addThpEmployeeInline"))$("addThpEmployeeInline").onclick=()=>openEmployeeModal("thp");
if($("thpEmployeeForm"))$("thpEmployeeForm").onsubmit=e=>{e.preventDefault();const sheet=thpTimesheet(selectedWorkerMonth,true);sheet.rows.push({id:uid("thpe"),name:$("thpEmployeeName").value.trim(),position:$("thpEmployeePosition").value.trim(),values:{},overtime:{}});sortThpEmployees(sheet);$("thpEmployeeModal").classList.add("hidden");save("THP pracovník bol pridaný.")};
function printSimpleEmployeeTimesheet(title,selector){window.print()}
if($("exportBetpresTimesheetPdf"))$("exportBetpresTimesheetPdf").onclick=()=>window.print();
if($("exportThpTimesheetPdf"))$("exportThpTimesheetPdf").onclick=()=>window.print();

function companyHourWorkerNames(row){
 return companyHourWorkers(row).map(worker=>String(worker.name||"").trim()).filter(Boolean)
}
function companyHourTimesheet(month,create=true){
 let sheet=state.companyHourTimesheets.find(x=>x.projectId===state.selectedProjectId&&x.month===month);
 if(!sheet&&create){
  const previous=[...state.companyHourTimesheets]
   .filter(x=>x.projectId===state.selectedProjectId&&x.month<month)
   .sort((a,b)=>b.month.localeCompare(a.month))[0];
  sheet={
   id:uid("chts"),
   projectId:state.selectedProjectId,
   month,
   rows:(previous?.rows||[]).map(row=>({
    id:uid("chr"),
    companyId:row.companyId||"",
    companyName:row.companyName||"",
    hourlyRate:row.hourlyRate||"",
    description:row.description||"Hodinové práce podľa smenovky",
    workersText:row.workersText||row.workerNames||"",
    workers:companyHourWorkers(row).map(worker=>({id:uid("chw"),name:worker.name||"",values:{}})),
    values:{},
    statementItemId:""
   }))
  };
  state.companyHourTimesheets.push(sheet);
  commitDirectState()
 }
 if(sheet){
  sheet.rows=Array.isArray(sheet.rows)?sheet.rows:[];
  sheet.rows.forEach(row=>{
   row.values=row.values||{};
   row.description=row.description||"Hodinové práce podľa smenovky";
   companyHourWorkers(row)
  })
 }
 return sheet
}
function companyHourRate(row){return parseWorkNumber(row?.hourlyRate||0)}
function companyHourRowName(row){return String(company(row?.companyId)?.name||row?.companyName||"Bez názvu").trim()}
function companyHourWorkerHours(worker){return Object.values(worker?.values||{}).reduce((sum,value)=>sum+attendanceHours(value),0)}
function companyHourRowHours(row){return companyHourWorkers(row).reduce((sum,worker)=>sum+companyHourWorkerHours(worker),0)}
function companyHourRowAmount(row){return workRound(companyHourRowHours(row)*companyHourRate(row),2)}
function companyHourDayTotal(row,day){return companyHourWorkers(row).reduce((sum,worker)=>sum+attendanceHours(worker.values?.[day]),0)}
function ensureCompanyHourAssignment(companyId,scope="Hodinové práce"){
 if(!companyId||!state.selectedProjectId)return;
 if(!state.assignments.some(a=>a.projectId===state.selectedProjectId&&a.companyId===companyId)){
  state.assignments.push({id:uid("a"),projectId:state.selectedProjectId,companyId,contractNo:"",contact:"",phone:"",scope,note:"Vytvorené automaticky z firemnej hodinovej smenovky"})
 }
}
function setActiveCompanyHourRow(rowId){
 selectedCompanyHourRowId=rowId||"";
 document.querySelectorAll("[data-company-hour-group]").forEach(group=>group.classList.toggle("is-active",group.dataset.companyHourGroup===selectedCompanyHourRowId));
}
function addEmptyCompanyHourWorker(rowId,render=true){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,true);
 const row=sheet.rows.find(item=>item.id===rowId);
 if(!row)return false;
 const workers=companyHourWorkers(row);
 const onlyEmpty=workers.length===1&&!String(workers[0].name||"").trim()&&!Object.keys(workers[0].values||{}).length;
 if(!onlyEmpty)row.workers.push({id:uid("chw"),name:"",values:{}});
 row.workersText=companyHourWorkerNames(row).join(", ");
 selectedCompanyHourRowId=row.id;
 if(render)save("Prázdny riadok pracovníka bol pridaný do firemnej hodinovej smenovky.");
 return true
}
function chooseCompanyHourRowForWorker(){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,true);
 if(!sheet.rows.length){alert("Najprv pridaj firmu na hodiny.");return null}
 const active=selectedCompanyHourRowId&&sheet.rows.find(row=>row.id===selectedCompanyHourRowId);
 if(active)return active;
 if(sheet.rows.length===1)return sheet.rows[0];
 const list=sheet.rows.map((row,index)=>`${index+1}. ${companyHourRowName(row)}`).join("\n");
 const answer=prompt(`Ku ktorej firme chceš pridať pracovníka?\n\n${list}\n\nZadaj číslo firmy:`);
 if(answer===null)return null;
 const index=Number(String(answer).trim())-1;
 if(!Number.isInteger(index)||!sheet.rows[index]){alert("Neplatné číslo firmy.");return null}
 return sheet.rows[index]
}
function chooseCompanyHourRowForStatement(){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,true);
 if(!sheet.rows.length){alert("Najprv pridaj firmu na hodiny.");return null}
 const active=selectedCompanyHourRowId&&sheet.rows.find(row=>row.id===selectedCompanyHourRowId);
 if(active)return active;
 if(sheet.rows.length===1)return sheet.rows[0];
 const list=sheet.rows.map((row,index)=>`${index+1}. ${companyHourRowName(row)} (${formatWorkHoursCell(companyHourRowHours(row))} h)`).join("\n");
 const answer=prompt(`Pre ktorú firmu chceš vytvoriť súpis prác?\n\n${list}\n\nZadaj číslo firmy:`);
 if(answer===null)return null;
 const index=Number(String(answer).trim())-1;
 if(!Number.isInteger(index)||!sheet.rows[index]){alert("Neplatné číslo firmy.");return null}
 return sheet.rows[index]
}
function ensureCompanyHourCompany(row){
 if(!row)return false;
 if(row.companyId&&company(row.companyId)){
  ensureCompanyHourAssignment(row.companyId,row.description||"Hodinové práce");
  return true
 }
 const name=String(row.companyName||companyHourRowName(row)||"").trim();
 if(!name||name==="Bez názvu"){alert("Firma musí mať názov, aby sa dal vytvoriť súpis prác.");return false}
 let existing=state.companies.find(c=>String(c.name||"").trim().toLowerCase()===name.toLowerCase());
 if(!existing){
  existing={id:uid("c"),name,address:"",postalCity:"",ico:"",dic:"",icdph:"",note:"Vytvorené automaticky z firemnej hodinovej smenovky pri tvorbe súpisu"};
  state.companies.push(existing)
 }
 row.companyId=existing.id;
 row.companyName=existing.name;
 ensureCompanyHourAssignment(existing.id,row.description||"Hodinové práce");
 return true
}

function updateCompanyHourPreview(){
 if(!$("companyHourPreview"))return;
 const cid=$("companyHourCompany").value,custom=$("companyHourCustomName").value.trim(),c=company(cid),name=custom||(c?.name||"Vyber firmu alebo zadaj vlastný názov"),rate=parseWorkNumber($("companyHourRate").value),workers=($("companyHourWorkers")?.value||"").trim();
 $("companyHourPreview").innerHTML=`<strong>${esc(name)}</strong><span>${rate?`Sadzba: ${eur.format(rate)} / hod · z hodín sa vytvorí súpis prác.`:`Zadaj hodinovú sadzbu bez DPH.`}</span>${workers?`<span class="company-hour-workers-preview">Pracovníci: ${esc(workers)}</span>`:""}`
}
function openCompanyHourModal(){
 const select=$("companyHourCompany"),form=$("companyHourForm");
 if(!select||!form)return;
 form.reset();
 const companies=[...state.companies].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"sk",{sensitivity:"base"}));
 select.innerHTML=optionList(companies,"",x=>x.name,"Nevybraná – vytvorím vlastnú firmu");
 $("companyHourDescription").value="Hodinové práce podľa smenovky";
 updateCompanyHourPreview();
 $("companyHourModal").classList.remove("hidden")
}
if($("addCompanyHourTimesheet"))$("addCompanyHourTimesheet").onclick=openCompanyHourModal;
if($("companyHourCompany"))$("companyHourCompany").onchange=updateCompanyHourPreview;
["companyHourCustomName","companyHourRate","companyHourWorkers"].forEach(id=>{if($(id))$(id).oninput=updateCompanyHourPreview});
if($("companyHourForm"))$("companyHourForm").onsubmit=event=>{
 event.preventDefault();
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,true),companyId=$("companyHourCompany").value,c=company(companyId),customName=$("companyHourCustomName").value.trim(),name=c?.name||customName,rate=parseWorkNumber($("companyHourRate").value),description=$("companyHourDescription").value.trim()||"Hodinové práce podľa smenovky",names=splitCompanyHourWorkerNames($("companyHourWorkers").value);
 if(!name){alert("Vyber firmu alebo zadaj jej názov.");return}
 if(rate<=0){alert("Zadaj platnú hodinovú sadzbu bez DPH.");return}
 if(sheet.rows.some(row=>(companyId&&row.companyId===companyId)||companyHourRowName(row).toLowerCase()===name.toLowerCase())){alert("Táto firma už má v otvorenom mesiaci hodinovú smenovku.");return}
 const row={id:uid("chr"),companyId:companyId||"",companyName:name,hourlyRate:rate,description,workersText:names.join(", "),workers:(names.length?names:[""]).map(workerName=>({id:uid("chw"),name:workerName,values:{}})),values:{},statementItemId:""};
 sheet.rows.push(row);selectedCompanyHourRowId=row.id;$("companyHourModal").classList.add("hidden");save(`Hodinová smenovka firmy ${name} bola pridaná.`)
};
if($("addCompanyHourWorkerTop"))$("addCompanyHourWorkerTop").onclick=()=>{
 const sheet=companyHourTimesheet($("workerMonth").value||selectedWorkerMonth||todayMonthValue(),true),row=sheet.rows.find(item=>item.id===selectedCompanyHourRowId)||(sheet.rows.length===1?sheet.rows[0]:null);
 if(!row){alert("Najskôr klikni na firmu, ktorej chceš pridať pracovníka.");return}
 addEmptyCompanyHourWorker(row.id,true)
};
if($("createCompanyHourStatementTop"))$("createCompanyHourStatementTop").onclick=()=>{
 const sheet=companyHourTimesheet($("workerMonth").value||selectedWorkerMonth||todayMonthValue(),true),row=sheet.rows.find(item=>item.id===selectedCompanyHourRowId)||(sheet.rows.length===1?sheet.rows[0]:null);
 if(!row){alert("Najskôr klikni na firmu, pre ktorú chceš vytvoriť súpis.");return}
 createWorkStatementFromCompanyHours(row.id)
};
function renderCompanyHoursTimesheet(){
 if(!$("companyHoursHead"))return;
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,true),[year,mon]=month.split("-").map(Number),days=daysInMonth(month),today=todayISO(),dayNames=["Ne","Po","Ut","St","Št","Pi","So"];
 sheet.rows.sort((a,b)=>companyHourRowName(a).localeCompare(companyHourRowName(b),"sk",{sensitivity:"base"}));
 let head=`<tr><th class="company-hour-worker-cell">MENO PRACOVNÍKA</th>`;
 for(let day=1;day<=days;day++){
  const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
  head+=`<th class="${cls}" title="${esc(holiday||"")}"><span class="worker-day-name">${dayNames[date.getDay()]}</span>${day}${holiday?`<span class="worker-holiday-name">${esc(holiday)}</span>`:""}</th>`
 }
  head+=`<th class="company-hour-total-col">Spolu<br>hodín</th><th class="company-hour-amount-col">Suma<br>bez DPH</th><th class="company-hour-actions-col">Akcie</th></tr>`;
 $("companyHoursHead").innerHTML=head;
 let grandHours=0,grandAmount=0;
 const rowsHtml=[];
 sheet.rows.forEach(row=>{
  const name=companyHourRowName(row),rate=companyHourRate(row),workers=companyHourWorkers(row),rowHours=companyHourRowHours(row),rowAmount=companyHourRowAmount(row);
  grandHours+=rowHours;grandAmount+=rowAmount;
  rowsHtml.push(`<tr class="company-hour-group-row"><td colspan="${days+4}"><div class="company-hour-group ${selectedCompanyHourRowId===row.id?"is-active":""}" data-company-hour-group="${row.id}"><div class="company-hour-group-title"><div class="company-hour-title-line"><strong>FIRMA: ${esc(name)}</strong><span class="company-hour-title-actions"><button type="button" class="ghost mini" data-add-company-hour-worker-empty="${row.id}">+ Dopísať meno</button><button type="button" class="ghost mini" data-company-hour-pdf="${row.id}">Export PDF</button><button type="button" class="company-hour-statement-fast" data-company-hour-statement="${row.id}" title="Vytvoriť alebo aktualizovať súpis prác pre túto firmu">Vytvoriť súpis</button><button type="button" class="company-hour-firm-x" data-del-company-hour="${row.id}" title="Odstrániť firmu zo smenovky">×</button></span></div><div class="company-hour-company-meta"><small>${esc(row.description||"Hodinové práce podľa smenovky")} · ${workers.length} pracovníkov</small><label>Hodinová sadzba firmy <span class="company-hour-rate-field"><input type="text" inputmode="decimal" data-company-hour-rate="${row.id}" value="${esc(formatWorkHoursCell(rate))}" aria-label="Hodinová sadzba firmy ${esc(name)}"><b>€/h</b></span></label></div></div></div></td></tr>`);
  workers.forEach(worker=>{
   let total=0;
   let cells=`<tr><td class="company-hour-worker-cell"><div class="company-hour-worker-inner"><input class="company-hour-worker-name" data-company-hour-worker-name="${row.id}:${worker.id}" value="${esc(worker.name||"")}" placeholder="Meno a priezvisko"><button type="button" class="ghost mini danger-mini" data-del-company-hour-worker="${row.id}:${worker.id}">×</button></div></td>`;
   for(let day=1;day<=days;day++){
    const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),value=worker.values?.[day]??"",cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
    total+=attendanceHours(value);
    cells+=`<td class="${cls}"><input type="text" maxlength="5" inputmode="decimal" spellcheck="false" data-company-hour-worker="${row.id}:${worker.id}" data-company-hour-day="${day}" value="${esc(formatWorkHoursCell(value))}"></td>`
   }
   const amount=workRound(total*rate,2);
   cells+=`<td class="company-hour-sum">${formatWorkHoursCell(total)}</td><td class="company-hour-amount">${eur.format(amount)}</td><td></td></tr>`;
   rowsHtml.push(cells)
  });
  let totalRow=`<tr class="company-hour-total-row"><td class="company-hour-worker-cell">Spolu ${esc(name)}</td>`;
  for(let day=1;day<=days;day++){
   const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
   totalRow+=`<td class="${cls}">${formatWorkHoursCell(companyHourDayTotal(row,day))}</td>`
  }
  totalRow+=`<td class="company-hour-sum">${formatWorkHoursCell(rowHours)}</td><td class="company-hour-amount">${eur.format(rowAmount)}</td><td></td></tr>`;
  // SiteDesk 5.0.31: riadok "Spolu za firmu" sa nezobrazuje, zostáva iba spodný riadok Spolu za deň.
 });
 $("companyHoursBody").innerHTML=rowsHtml.join("")||`<tr><td class="company-hour-company-col" colspan="${days+4}" style="padding:20px;color:#789;text-align:left">Pridaj firmu na hodiny. Potom pridáš pracovníkov, vyplníš hodiny po dňoch a z nich vytvoríš súpis prác.</td></tr>`;
 let foot=`<tr><td class="company-hour-worker-cell">Spolu za deň</td>`;
 for(let day=1;day<=days;day++){
  const total=sheet.rows.reduce((sum,row)=>sum+companyHourDayTotal(row,day),0),date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),key=dateKey(date),cls=[weekend?"weekend":"",holiday?"holiday":"",key===today?"today-col":""].filter(Boolean).join(" ");
  foot+=`<td class="${cls}">${formatWorkHoursCell(total)}</td>`
 }
 foot+=`<td class="company-hour-sum" id="companyHourGrandHours">${formatWorkHoursCell(grandHours)}</td><td class="company-hour-amount" id="companyHourGrandAmount">${eur.format(grandAmount)}</td><td></td></tr>`;
 $("companyHoursFoot").innerHTML=foot;
 $("companyHoursCount").textContent=sheet.rows.length;
 $("companyHoursTotal").textContent=`${formatWorkHours(grandHours)} h`;
 $("companyHoursAmount").textContent=eur.format(grandAmount);
 if(selectedWorkerMode==="companyHours")$("workerSheetStatus").textContent=`${sheet.rows.length} firiem na hodiny · ${formatWorkHours(grandHours)} h · ${eur.format(grandAmount)} bez DPH`;
 if(selectedCompanyHourRowId&&!sheet.rows.some(row=>row.id===selectedCompanyHourRowId))selectedCompanyHourRowId=sheet.rows[0]?.id||"";
 document.querySelectorAll("[data-company-hour-group]").forEach(group=>{
  group.onclick=event=>{
   if(event.target.closest("button"))return;
   setActiveCompanyHourRow(group.dataset.companyHourGroup)
  }
 });
 document.querySelectorAll("[data-company-hour-worker-name]").forEach(input=>{
  input.onfocus=()=>{
   const [rowId]=input.dataset.companyHourWorkerName.split(":");
   setActiveCompanyHourRow(rowId);
   beginDirectUndo("Úprava mena pracovníka na hodiny")
  };
  input.onchange=()=>{
   const [rowId,workerId]=input.dataset.companyHourWorkerName.split(":");
   const row=sheet.rows.find(item=>item.id===rowId),worker=companyHourWorkers(row).find(item=>item.id===workerId);
   if(!worker)return;
   worker.name=input.value.trim();
   row.workersText=companyHourWorkerNames(row).join(", ");
   commitDirectState();
   renderCompanyHoursTimesheet()
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll("[data-company-hour-rate]").forEach(input=>{
  input.onfocus=()=>beginDirectUndo("Úprava hodinovej sadzby firmy");
  input.onchange=()=>{
   const row=sheet.rows.find(item=>item.id===input.dataset.companyHourRate);
   if(!row)return;
   const rate=parseWorkNumber(input.value);
   if(rate<=0){alert("Zadaj platnú hodinovú sadzbu firmy bez DPH.");input.value=formatWorkHoursCell(companyHourRate(row));return}
   row.hourlyRate=rate;
   commitDirectState();
   renderCompanyHoursTimesheet();
   renderDashboard()
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll("[data-company-hour-worker]").forEach(input=>{
  input.onfocus=()=>{
   const [rowId]=input.dataset.companyHourWorker.split(":");
   setActiveCompanyHourRow(rowId);
   beginDirectUndo("Úprava firemnej smenovky na hodiny")
  };
  input.onchange=()=>{
   const [rowId,workerId]=input.dataset.companyHourWorker.split(":"),row=sheet.rows.find(item=>item.id===rowId),worker=companyHourWorkers(row).find(item=>item.id===workerId);
   if(!worker)return;
   const day=input.dataset.companyHourDay,value=normalizeHourOnlyValue(input.value,24);
   if(value===null){alert("Zadaj hodiny od 0 do 24, napríklad 8 alebo 8,5.");input.value=formatWorkHoursCell(worker.values?.[day]??"");return}
   if(value===""||value===0)delete worker.values[day];else worker.values[day]=value;
   input.value=formatWorkHoursCell(value);
   row.workersText=companyHourWorkerNames(row).join(", ");
   commitDirectState();
   renderCompanyHoursTimesheet();
   renderDashboard()
  };
  input.onblur=()=>{input.dispatchEvent(new Event("change"));endDirectUndo()}
 });
 document.querySelectorAll("[data-add-company-hour-worker-empty]").forEach(button=>{
  button.onclick=()=>addEmptyCompanyHourWorker(button.dataset.addCompanyHourWorkerEmpty,true)
 });
 document.querySelectorAll("[data-add-company-hour-worker]").forEach(button=>{
  button.onclick=()=>{
   const row=sheet.rows.find(item=>item.id===button.dataset.addCompanyHourWorker);if(!row)return;
   const name=prompt(`Zadaj meno pracovníka pre firmu ${companyHourRowName(row)}:`,"");
   if(name===null)return;
   const clean=String(name||"").trim();
   const workers=companyHourWorkers(row);
   const onlyEmpty=workers.length===1&&!String(workers[0].name||"").trim()&&!Object.keys(workers[0].values||{}).length;
   if(onlyEmpty)row.workers=[];
   row.workers.push({id:uid("chw"),name:clean,values:{}});
   row.workersText=companyHourWorkerNames(row).join(", ");
   save(clean?`Pracovník ${clean} bol pridaný do firemnej hodinovej smenovky.`:"Prázdny riadok pracovníka bol pridaný do firemnej hodinovej smenovky.")
  }
 });
 document.querySelectorAll("[data-add-company-hour-workers-bulk]").forEach(button=>{
  button.onclick=()=>{
   const row=sheet.rows.find(item=>item.id===button.dataset.addCompanyHourWorkersBulk);if(!row)return;
   const text=prompt(`Zadaj mená pracovníkov pre firmu ${companyHourRowName(row)}.\nKaždé meno daj na nový riadok alebo ich oddeľ čiarkou.`,"");
   if(text===null)return;
   const names=splitCompanyHourWorkerNames(text);
   if(!names.length){alert("Zadaj aspoň jedno meno pracovníka.");return}
   const workers=companyHourWorkers(row);
   const onlyEmpty=workers.length===1&&!String(workers[0].name||"").trim()&&!Object.keys(workers[0].values||{}).length;
   if(onlyEmpty)row.workers=[];
   names.forEach(name=>row.workers.push({id:uid("chw"),name,values:{}}));
   row.workersText=companyHourWorkerNames(row).join(", ");
   save(`${names.length} pracovníkov bolo pridaných pod seba do firemnej hodinovej smenovky.`)
  }
 });
 document.querySelectorAll("[data-del-company-hour-worker]").forEach(button=>{
  button.onclick=()=>{
   const [rowId,workerId]=button.dataset.delCompanyHourWorker.split(":"),row=sheet.rows.find(item=>item.id===rowId);if(!row)return;
   const worker=companyHourWorkers(row).find(item=>item.id===workerId);
   if(confirm(`Vymazať pracovníka „${worker?.name||"bez mena"}“ z hodinovej smenovky firmy ${companyHourRowName(row)}?`)){
    row.workers=companyHourWorkers(row).filter(item=>item.id!==workerId);
    if(!row.workers.length)row.workers.push({id:uid("chw"),name:"",values:{}});
    row.workersText=companyHourWorkerNames(row).join(", ");
    save("Pracovník bol vymazaný z firemnej hodinovej smenovky.")
   }
  }
 });
 document.querySelectorAll("[data-company-hour-pdf]").forEach(button=>{
  button.onclick=()=>exportCompanyHourTimesheetPdf(button.dataset.companyHourPdf)
 });
 document.querySelectorAll("[data-company-hour-statement]").forEach(button=>{
  button.onclick=()=>createWorkStatementFromCompanyHours(button.dataset.companyHourStatement)
 });
 document.querySelectorAll("[data-del-company-hour]").forEach(button=>{
  button.onclick=()=>{
   const row=sheet.rows.find(item=>item.id===button.dataset.delCompanyHour),name=companyHourRowName(row);
   if(confirm(`Odstrániť firmu „${name}“ zo smenovky za ${month}? Údaje tejto firemnej smenovky sa vymažú.`)){
    sheet.rows=sheet.rows.filter(item=>item.id!==button.dataset.delCompanyHour);
    save("Firma bola odstránená zo smenovky.")
   }
  }
 })
}
function createWorkStatementFromCompanyHours(rowId){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,false),row=sheet?.rows?.find(item=>item.id===rowId);
 if(!row){alert("Smenovka firmy sa nenašla.");return}
 const hours=companyHourRowHours(row),rate=companyHourRate(row),amount=companyHourRowAmount(row),name=companyHourRowName(row),workerNames=companyHourWorkerNames(row);
 if(!ensureCompanyHourCompany(row))return;
 if(hours<=0){alert("Najprv zadaj odpracované hodiny.");return}
 if(rate<=0){alert("Firma nemá zadanú hodinovú sadzbu.");return}
 selectedWorkCompanyId=row.companyId;selectedWorkPeriod=month;
 const statement=getWorkStatement(true),sourceKey=`company-hours:${row.id}:${month}`;
 let item=statement.items.find(x=>x.sourceKey===sourceKey);
 if(!item){
  item=createBlankWorkItem("ZoD",workDocumentId("ZoD"));
  item.sourceKey=sourceKey;
  statement.items.push(item)
 }
 item.pc=item.pc||String(statement.items.indexOf(item)+1);
 item.type="K";
 item.code="HOD";
 item.description=`${row.description||"Hodinové práce podľa smenovky"} – ${name} – ${formatBillingMonth(month)}${workerNames.length?` – pracovníci: ${workerNames.join(", ")}`:""}`;
 item.unit="";
 item.priceOnly=true;
 item.contractQty="";
 item.unitPrice="";
 item.contractTotal=amount.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2});
 item.currentQty="";
 item.currentPriceOverride=item.contractTotal;
 statement.scope=statement.scope||row.description||"Hodinové práce";
 statement.updatedAt=new Date().toISOString();
 row.statementItemId=item.id;
 selectedWorkDocFilter=workDocumentId("ZoD");selectedWorkItemIds.clear();selectedWorkItemIds.add(item.id);
 save(`Súpis pre firmu ${name} bol vytvorený / aktualizovaný.`);
 showView("workStatements")
}
function chooseCompanyHourTimesheetForExport(){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,false);
 if(!sheet||!sheet.rows.length){alert("Najprv pridaj firmu na hodiny.");return}
 if(sheet.rows.length===1){exportCompanyHourTimesheetPdf(sheet.rows[0].id);return}
 const list=sheet.rows.map((row,index)=>`${index+1}. ${companyHourRowName(row)} (${formatWorkHoursCell(companyHourRowHours(row))} h)`).join("\n");
 const answer=prompt(`Ktorú firemnú smenovku chceš exportovať?\n\n${list}\n\nZadaj číslo firmy:`);
 if(answer===null)return;
 const index=Number(String(answer).trim())-1;
 if(!Number.isInteger(index)||!sheet.rows[index]){alert("Neplatné číslo firmy.");return}
 exportCompanyHourTimesheetPdf(sheet.rows[index].id)
}
if($("exportCompanyHoursPdf"))$("exportCompanyHoursPdf").onclick=chooseCompanyHourTimesheetForExport;
function exportCompanyHourTimesheetPdf(rowId){
 const month=$("workerMonth").value||selectedWorkerMonth||todayMonthValue(),sheet=companyHourTimesheet(month,false),row=sheet?.rows?.find(item=>item.id===rowId);
 if(!row){alert("Smenovka firmy sa nenašla.");return}
 const workers=companyHourWorkers(row),hours=companyHourRowHours(row),rate=companyHourRate(row),amount=companyHourRowAmount(row);
 if(!workers.length){alert("V smenovke firmy nie sú žiadni pracovníci.");return}
 const [year,mon]=month.split("-").map(Number),days=daysInMonth(month),names=["Ne","Po","Ut","St","Št","Pi","So"],projectData=activeProject(),created=fmtDateISO(todayISO()),monthLabel=`${String(mon).padStart(2,"0")}/${year}`,companyName=companyHourRowName(row),rowsPerPage=12,pageCount=Math.max(1,Math.ceil(workers.length/rowsPerPage)),pages=[];
 function dayClass(day){const date=new Date(year,mon-1,day),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay());return holiday?"holiday":weekend?"weekend":""}
 function tableHead(){let top=`<tr><th class="num" rowspan="2">Č.</th><th class="name" rowspan="2">Pracovník</th>`;let bottom="<tr>";for(let day=1;day<=days;day++){const date=new Date(year,mon-1,day),cls=dayClass(day),holiday=slovakHoliday(date);top+=`<th class="${cls}">${day}</th>`;bottom+=`<th class="${cls}"><small>${names[date.getDay()]}</small>${holiday?`<em>S</em>`:""}</th>`}top+=`<th class="sum" rowspan="2">Spolu</th><th class="amount" rowspan="2">Suma</th></tr>`;bottom+="</tr>";return top+bottom}
 for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
  const part=workers.slice(pageIndex*rowsPerPage,(pageIndex+1)*rowsPerPage);
  const body=part.map((worker,i)=>{let total=0,html=`<tr><td class="num">${pageIndex*rowsPerPage+i+1}</td><td class="name">${esc(worker.name||"")}</td>`;for(let day=1;day<=days;day++){const v=worker.values?.[day],cls=dayClass(day);total+=attendanceHours(v);html+=`<td class="${cls}">${esc(formatWorkHoursCell(v))}</td>`}html+=`<td class="sum">${formatWorkHoursCell(total)}</td><td class="amount">${eur.format(workRound(total*rate,2))}</td></tr>`;return html}).join("");
  let totals=`<tr><td class="sumLabel" colspan="2">Spolu za deň</td>`;for(let day=1;day<=days;day++){totals+=`<td class="${dayClass(day)}">${formatWorkHoursCell(companyHourDayTotal(row,day))}</td>`}totals+=`<td class="sum">${formatWorkHoursCell(hours)}</td><td class="amount">${eur.format(amount)}</td></tr>`;
  pages.push(`<section class="page"><div class="blue-head"><div class="logoText">Betpres</div><div><h1>HODINOVÁ SMENOVKA – ${esc(companyName)}</h1><p>${esc(projectData?.name||"")}</p></div><div class="pageNo">${pageIndex+1} / ${pageCount}</div></div><div class="meta-row"><span><strong>Stavba:</strong> ${esc(projectData?.name||"")}</span><span><strong>Mesiac:</strong> ${monthLabel}</span><span><strong>Sadzba:</strong> ${eur.format(rate)}/h</span><span><strong>Vytvorené:</strong> ${created}</span></div><div class="legend"><span><i class="weekendBox"></i> víkend</span><span><i class="holidayBox"></i> sviatok</span><span>${esc(row.description||"Hodinové práce podľa smenovky")}</span></div><table><thead>${tableHead()}</thead><tbody>${body}</tbody><tfoot>${totals}</tfoot></table><footer><span>BETPRES SiteDesk 5.0.39</span><span>${esc(companyName)} · ${formatWorkHoursCell(hours)} h · ${eur.format(amount)} bez DPH</span></footer></section>`)
 }
 const w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre PDF. Povoľ vyskakovacie okná.");return}
 const docs=(Array.isArray(x.documents)?x.documents:[]).filter(Boolean);
 const docsHtml=(docs.length?docs:["Kópie stavebného denníka"]).map((d,i)=>`<div>${i+1}. ${esc(d)}</div>`).join("");
 w.document.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Preberací protokol</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff}.page{position:relative;width:210mm;min-height:297mm;overflow:hidden;background:#fff}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.content{position:relative;z-index:1;padding:36mm 15mm 38mm;min-height:297mm;font-family:Arial,sans-serif;color:#111;font-size:11px}.page-two .content{padding-top:34mm}.docline{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #183765;padding-bottom:5px;margin-bottom:10px;color:#183765;font-weight:bold}.kicker{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6c7e95;margin-bottom:5px}h1{text-align:center;font-size:18px;margin:0 0 14px}.meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #333}.meta div{padding:8px;border-bottom:1px solid #aaa;min-height:46px}.meta div:nth-child(odd){border-right:1px solid #aaa}.meta strong{display:block;font-size:9px;text-transform:uppercase;color:#555;margin-bottom:4px}.section{border:1px solid #333;padding:10px 12px;margin-top:12px;background:rgba(255,255,255,.94)}.section h3{margin:0 0 8px;font-size:12px;color:#183765}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.docs-list div{margin:0 0 4px}.result{font-size:15px;font-weight:bold}.sign{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:90px}.line{border-top:1px solid #333;text-align:center;padding-top:5px} .small-note{color:#6b7c93;font-size:10px;margin-top:10px}</style></head><body><section class="page"><img class="bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><div class="kicker">PREBERANIE DOKONČENÝCH PRÁC</div><div class="docline"><span>${esc(x.protocolNo||"PREBERACÍ PROTOKOL")}</span><span>${esc(fmtDateISO(x.date))}</span></div><h1>PREBERACÍ PROTOKOL</h1><div class="meta"><div><strong>Stavba</strong>${esc(p?.name||"")}</div><div><strong>Dátum</strong>${esc(fmtDateISO(x.date))}</div><div><strong>Zhotoviteľ</strong>${esc(c?.name||"")}</div><div><strong>Číslo ZoD / objednávky</strong>${esc(x.contractNo||a?.contractNo||"—")}</div><div><strong>Predmet preberania</strong>${esc(x.subject||a?.scope||"")}</div><div><strong>Dodatky</strong>${esc(x.additions||"—")}</div><div><strong>Miesto / objekt</strong>${esc(x.location||"—")}</div><div><strong>Výsledok</strong>${esc(x.result||"—")}</div></div><div class="two-col"><div class="section"><h3>Termíny</h3><div><strong>Začiatok podľa ZoD:</strong> ${esc(fmtDateISO(x.contractStart)||"—")}</div><div><strong>Dokončenie podľa ZoD:</strong> ${esc(fmtDateISO(x.contractEnd)||"—")}</div><div><strong>Skutočný začiatok:</strong> ${esc(fmtDateISO(x.actualStart)||"—")}</div><div><strong>Skutočné dokončenie:</strong> ${esc(fmtDateISO(x.actualEnd)||"—")}</div></div><div class="section"><h3>Cena diela</h3><div><strong>Podľa ZoD:</strong> ${esc(x.contractPrice||"—")}</div><div><strong>Skutočná cena:</strong> ${esc(x.actualPrice||"—")}</div><div class="small-note">Ceny a termíny môžeš v aplikácii upraviť pre konkrétny protokol.</div></div></div><div class="section"><h3>Odovzdané doklady</h3><div class="docs-list">${docsHtml}</div></div></div></section><section class="page page-two"><img class="bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><div class="kicker">PREBERACÍ PROTOKOL</div><div class="docline"><span>${esc(c?.name||"")}</span><span>${esc(fmtDateISO(x.date))}</span></div><div class="section"><h3>Vady, nedorobky a poznámky</h3><div>${nl2br(x.notes||"Bez vád a nedorobkov.")}</div></div><div class="section"><h3>Podpisy strán</h3><div class="sign"><div class="line">Za objednávateľa<br>${esc(x.clientRep||"")}</div><div class="line">Za zhotoviteľa<br>${esc(x.supplierRep||"")}</div></div></div></div></section><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close();
}



function defaultHandoverDraft(pid,cid){
 const p=project(pid),c=company(cid),a=assignment(pid,cid),contract=a?.contractNo||"";
 const documentType=assignmentDocShort(a||{}),documentRef=assignmentDocRef(a||{contractType:documentType,contractNo:contract});
 const manager=p?.manager||"Ing. Peter Baláž – stavbyvedúci";
 const managerPhone=p?.managerPhone||"0902 926 099";
 const supplierRep=c?.contact||a?.contact||"";
 return{
  contract,
  documentType,
  date:todayISO(),
  entryDate:todayISO(),
  documentCity:p?.documentCity||p?.city||"Košiciach",
  clientName:"Betpres s.r.o,",
  clientAddress:"Južná trieda 3913/117,",
  clientPostal:"040 01 Košice",
  clientIco:"31684343",
  clientDic:"2020527861",
  clientRep:manager,
  clientPhone:managerPhone,
  supplierName:c?.name||"",
  supplierAddress:c?.address||"",
  supplierPostal:c?.postalCity||"",
  supplierIco:c?.ico||"",
  supplierDic:c?.dic||"",
  supplierRep,
  supplierPhone:c?.phone||a?.phone||"",
  projectName:p?.name||"",
  cadastre:p?.cadastre||"",
  region:p?.region||"",
  item1:`Stavebné povolenie (áno/nie): ${p?.constructionPermit||"áno"}`,
  item2:`Stavebná čiara určená (áno/nie): ${p?.constructionLine||""}`,
  item3:`Právo vstupu na stavenisko (bez nároku tretích osôb) sa udeľuje od dňa: ${fmtDateISO(todayISO())}`,
  item4:`Odovzdanie smerových a výškových bodov staveniska (spôsob, forma): ${p?.surveyPoints||"geodetickým vytýčením"}`,
  item5:`Prísun mechanizmov na stavenisko: ${p?.mechanisms||""}`,
  item6:`Miesto odberu elektrickej energie:\n${p?.electricity||"Z staveniskového rozvádzača"}`,
  item7:`Miesto odberu vody:\n${p?.water||"Staveniskové rozvody"}`,
  item8:`Inžinierske siete:\n${p?.networks||"Zhotoviteľ bude v prípade vykonávania zemných prác oboznámený s polohou IS vytýčením ich polohy na povrchu"}`,
  item9:`Ďalšie ujednania a vyjadrenia strán:\nZhotoviteľ v plnom rozsahu zodpovedá za zaistenie stavu BOZP, PO a legislatívnych požiadaviek na hore uvedenom pracovisku u seba a svojich zamestnancov. Pred začiatkom realizácie všetkých prác na stavbe,`,
  item10:`Bola odovzdaná projektová dokumentácia`,
  page2Text:`Zhotoviteľ vypracuje technologický postup prác, ktorým chce prácu na stavbe realizovať, ako aj plán protipožiarnych opatrení, ak je potrebný, a predloží ho zástupcovi objednávateľa na posúdenie, prípadne odsúhlasenie a preukázateľne s týmito dokladmi oboznámi všetkých svojich pracovníkov, ktorí danú prácu budú realizovať. Zhotoviteľ vyhlasuje, že sa riadne oboznámil s projektovou dokumentáciou, jej rozsahom a obsahom, pričom mu sú všetky skutočnosti potrebné na realizáciu diela jasné a zrozumiteľné.

Ďalšie podmienky sú stanovené v ${documentRef}. V súlade s nimi je zhotoviteľ povinný:
- viesť stavebný denník,
- dodržiavať režim na stavenisku, s ktorým bol oboznámený pred zahájením prác, a to hlavne:
  a. hlásiť príchod a odchod pracovníkov pred a po ukončení zmeny,
  b. udržiavať pracovisko v čistote (denne po ukončení prác aj v priebehu nich v rámci možností; v prípade neplnenia má objednávateľ právo udeliť sankcie a na náklady zhotoviteľa vypratať pracovisko),
  c. zúčastňovať sa koordinačných porád minimálne 1-krát týždenne,
- na prevzatie všetkých dokončených prác vyzve objednávateľa 3 pracovné dni vopred zápisom v denníku a podaním telefonickej informácie na čísle ${managerPhone} o vykonaní takéhoto zápisu. Povinnou prílohou požiadavky na prevzatie budú geodetické zamerania polohy s porovnaním zistenej polohy s požiadavkami PD a doklady preukazujúce kvalitu zrealizovaných prác,
- na prevzatie všetkých dokončených prác pred vystavením súpisu prác vyzve objednávateľa minimálne 5 pracovných dní pred požadovaným termínom prevzatia zápisom v stavebnom denníku a podaním telefonickej informácie o tomto zápise na čísle ${managerPhone}. Povinnou prílohou požiadavky na prevzatie budú geodetické zamerania polohy s porovnaním zistenej polohy s požiadavkami PD a doklady preukazujúce kvalitu zrealizovaných prác.`,
  clientSigner:manager.replace(" – stavbyvedúci",""),
  supplierSigner:supplierRep||c?.name||""
 }
}
function renderHandoverCompanies(selected){
 const pid=$("handoverProject").value||state.selectedProjectId;
 const assignedIds=state.assignments.filter(a=>a.projectId===pid).map(a=>a.companyId);
 const assignedCompanies=assignedIds.map(company).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 const otherCompanies=state.companies.filter(c=>!assignedIds.includes(c.id)).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 const all=[...assignedCompanies,...otherCompanies];
 const requested=selected||$("handoverCompany").value||"";
 const current=all.some(c=>c.id===requested)?requested:(assignedCompanies[0]?.id||all[0]?.id||"");
 let html="";
 if(assignedCompanies.length){
  html+=`<optgroup label="Firmy priradené k stavbe">${assignedCompanies.map(c=>`<option value="${c.id}" ${c.id===current?"selected":""}>${esc(c.name)}</option>`).join("")}</optgroup>`
 }
 if(otherCompanies.length){
  html+=`<optgroup label="Ostatné firmy z databázy">${otherCompanies.map(c=>`<option value="${c.id}" ${c.id===current?"selected":""}>${esc(c.name)} – bez zmluvy na stavbe</option>`).join("")}</optgroup>`
 }
 $("handoverCompany").innerHTML=html||`<option value="">Bez firmy – dokument sa zobrazí s prázdnymi údajmi</option>`;
 if(current)$("handoverCompany").value=current;
 return current
}
$("handoverProject").onchange=()=>{state.selectedProjectId=$("handoverProject").value;$("handoverCompany").value="";renderHandoverCompanies();handoverDraft=null;prepareHandover(true)};$("handoverCompany").onchange=()=>{handoverDraft=null;prepareHandover(true)};$("handoverDate").onchange=()=>{if(!handoverDraft)return;handoverDraft.date=$("handoverDate").value;renderHandover()};$("entryDate").onchange=()=>{if(!handoverDraft)return;handoverDraft.entryDate=$("entryDate").value;handoverDraft.item3=handoverDraft.item3.replace(/\d{2}\.\d{2}\.\d{4}/,fmtDateISO(handoverDraft.entryDate));renderHandover()};$("generateHandover").onclick=()=>prepareHandover(true);
function prepareHandover(force=false){
 let pid=$("handoverProject")?.value||state.selectedProjectId||state.projects[0]?.id||"";
 if(!project(pid))pid=state.projects[0]?.id||"";
 state.selectedProjectId=pid;
 if($("handoverProject"))$("handoverProject").value=pid;
 const cid=renderHandoverCompanies($("handoverCompany")?.value||"");
 const key=`${pid}|${cid||"blank"}`;
 if(force||!handoverDraft||handoverDraftKey!==key){
  const stored=state.handoverDrafts?.[key];
  handoverDraft=stored?clone(stored):defaultHandoverDraft(pid,cid||"");
  handoverDraftKey=key;
  editingHandoverId=stored?.savedHandoverId&&state.handovers.some(item=>item.id===stored.savedHandoverId)?stored.savedHandoverId:""
 }
 if($("handoverDate"))$("handoverDate").value=handoverDraft?.date||todayISO();
 if($("entryDate"))$("entryDate").value=handoverDraft?.entryDate||todayISO();
 renderHandover()
}
function nl2br(v){return esc(v||"").replace(/\n/g,"<br>")}

function partyBlockDraft(d,prefix,title){return `<div class="doc-party"><div class="label">${title}</div><div>${esc(d[prefix+"Name"]||"")}</div><div>${esc(d[prefix+"Address"]||"")}</div><div>${esc(d[prefix+"Postal"]||"")}</div><div>IČO: ${esc(d[prefix+"Ico"]||"")}</div><div>DIČ: ${esc(d[prefix+"Dic"]||"")}</div><div>V zastúpení:</div><div><i>${esc(d[prefix+"Rep"]||"")}</i></div><div>tel. č.: ${esc(d[prefix+"Phone"]||"")}</div></div>`}
function projectBlockDraft(d){return `<div class="doc-project"><div class="doc-project-row"><div class="doc-project-name">Názov stavby: „${esc(d.projectName||"")}“</div><div></div></div><div class="doc-project-row"><div>Kataster, obec stavby: <b><i>${esc(d.cadastre||"")}</i></b></div><div>Kraj: <b><i>${esc(d.region||"")}</i></b></div></div></div>`}

function handoverDocRef(documentType,contract){const type=String(documentType||"ZoD").toLowerCase().startsWith("obj")?"Obj.":"ZoD";return `${type} ${contract||"—"}`.trim()}
function handoverLetterheadHeader(contract,page,date,city,documentType="ZoD"){const docRef=handoverDocRef(documentType,contract);return `<div class="letter-doc-top"><div>${esc(docRef||"—")}</div><div>Str. : ${page}/2</div></div><div class="letter-doc-title">ZÁPISNICA O ODOVZDANÍ A PREVZATÍ PRACOVISKA</div><div class="letter-doc-intro">Spísaná v ${esc(city||"Košiciach")} dňa ${esc(date)} v zmysle platných predpisov o stavebnom poriadku a na základe ${esc(docRef||"—")} po obhliadke staveniska s týmto záverom:</div>`}
function renderHandover(){
 try{
 let pid=$("handoverProject").value||state.selectedProjectId;
 if(!project(pid))pid=state.projects[0]?.id||"";
 if(pid&&$("handoverProject").value!==pid)$("handoverProject").value=pid;
 let cid=$("handoverCompany").value||$("handoverCompany").selectedOptions?.[0]?.value||"";
 if(!cid)cid=renderHandoverCompanies();
 const key=`${pid}|${cid||"blank"}`;
 if(!handoverDraft||handoverDraftKey!==key){
  handoverDraft=defaultHandoverDraft(pid,cid||"");
  handoverDraftKey=key
 }
 const d=handoverDraft||defaultHandoverDraft(pid,cid||"");
 d.date=$("handoverDate").value||d.date||todayISO();
 d.entryDate=$("entryDate").value||d.entryDate||todayISO();
 const client=partyBlockDraft(d,"client","Odovzdáva (objednávateľ):"),
       supplier=partyBlockDraft(d,"supplier","Preberá (dodávateľ):");
 d.item10=d.item10||"Bola odovzdaná projektová dokumentácia";const items=[d.item1,d.item2,d.item3,d.item4,d.item5,d.item6,d.item7,d.item8,d.item9,d.item10];
 const itemHtml=items.map((t,i)=>`<div class="doc-item ${i===0?"compact":""}"><div class="n">${i+1}.</div><div class="txt">${nl2br(t)}</div></div>`).join("");
 $("handoverPreview").innerHTML=`<section class="paper letterhead-page handover-page handover-page-1"><img class="letterhead-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="letterhead-content handover-letterhead-content">${handoverLetterheadHeader(d.contract||"—",1,fmtDateISO(d.date),d.documentCity,d.documentType)}<div class="doc-parties">${client}${supplier}</div>${projectBlockDraft(d)}<div class="doc-items">${itemHtml}</div></div></section><section class="paper letterhead-page handover-page handover-page-2"><img class="letterhead-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="letterhead-content handover-letterhead-content">${handoverLetterheadHeader(d.contract||"—",2,fmtDateISO(d.date),d.documentCity,d.documentType)}<div class="doc-parties">${client}${supplier}</div>${projectBlockDraft(d)}<div class="doc-tech"><div class="doc-tech-text">${nl2br(d.page2Text)}</div></div><div class="signatures"><div class="signature">Za objednávateľa: ${esc(d.clientSigner)}<br>podpis:<div class="sig-line"></div></div><div class="signature">Za dodávateľa: ${esc(d.supplierSigner)}<br>podpis:<div class="sig-line"></div></div></div></div></section>`;
applyZoom()
 }catch(error){
  console.error("Chyba náhľadu odovzdania pracoviska:",error);
  const box=$("handoverPreview");
  if(box)box.innerHTML=`<div style="background:#fff;border:1px solid #d9e2e8;border-radius:12px;padding:24px;color:#9b2d2d"><strong>Náhľad dokumentu sa nepodarilo vytvoriť.</strong><br><span>Skús tlačidlo Aktualizovať náhľad. Ak chyba zostane, zobrazí sa jej presný názov nižšie.</span><br><span style="color:#5f7180">Technická chyba: ${esc(error?.message||String(error))}</span></div>`;
 }
}
const handoverEditorSections=[
 {title:"Hlavička dokumentu",fields:[["documentType","Typ dokladu (ZoD / Obj.)"],["contract","Číslo dokladu"],["documentCity","Miesto spísania (napr. Košiciach)"],["date","Dátum odovzdania","date"],["entryDate","Deň povoleného vstupu","date"]]},
 {title:"Odovzdávajúci – BETPRES",fields:[["clientName","Názov"],["clientAddress","Adresa"],["clientPostal","PSČ a mesto"],["clientIco","IČO"],["clientDic","DIČ"],["clientRep","V zastúpení"],["clientPhone","Telefón"]]},
 {title:"Preberajúci – dodávateľ",fields:[["supplierName","Názov"],["supplierAddress","Adresa"],["supplierPostal","PSČ a mesto"],["supplierIco","IČO"],["supplierDic","DIČ"],["supplierRep","V zastúpení"],["supplierPhone","Telefón"]]},
 {title:"Stavba",fields:[["projectName","Názov stavby"],["cadastre","Kataster a obec"],["region","Kraj"]]},
 {title:"Body na 1. strane",fields:[["item1","Bod 1","textarea"],["item2","Bod 2","textarea"],["item3","Bod 3","textarea"],["item4","Bod 4","textarea"],["item5","Bod 5","textarea"],["item6","Bod 6","textarea"],["item7","Bod 7","textarea"],["item8","Bod 8","textarea"],["item9","Bod 9 – začiatok","textarea"],["item10","Bod 10","textarea"]]},
 {title:"Text 2. strany a podpisy",fields:[["page2Text","Text druhej strany","long"],["clientSigner","Za objednávateľa"],["supplierSigner","Za dodávateľa"]]}
];
function openHandoverEditor(){if(!handoverDraft)prepareHandover();$("handoverEditorFields").innerHTML=handoverEditorSections.map(sec=>`<section class="editor-section"><h3>${esc(sec.title)}</h3><div class="editor-grid">${sec.fields.map(([key,label,type])=>{const full=type==="long"||type==="textarea",value=handoverDraft?.[key]||"";return `<label class="${full?"full":""}">${esc(label)}${type==="textarea"||type==="long"?`<textarea class="${type==="long"?"long":""}" data-handover-field="${key}">${esc(value)}</textarea>`:`<input type="${type==="date"?"date":"text"}" data-handover-field="${key}" value="${esc(value)}">`}</label>`}).join("")}</div></section>`).join("");$("handoverEditorModal").classList.remove("hidden")}
function readHandoverEditor(){document.querySelectorAll("[data-handover-field]").forEach(el=>handoverDraft[el.dataset.handoverField]=el.value);$("handoverDate").value=handoverDraft.date;$("entryDate").value=handoverDraft.entryDate}
function persistHandoverEditorDraft(){
 const pid=$("handoverProject").value||state.selectedProjectId,cid=$("handoverCompany").value||"",key=`${pid}|${cid||"blank"}`;
 if(!state.handoverDrafts||typeof state.handoverDrafts!=="object")state.handoverDrafts={};
 const existing=editingHandoverId?state.handovers.find(item=>item.id===editingHandoverId):null;
 if(existing){
  existing.content=clone(handoverDraft);
  existing.contractNo=handoverDraft.contract||existing.contractNo;
  existing.contractType=handoverDraft.documentType||existing.contractType||"ZoD";
  existing.date=handoverDraft.date||existing.date;
  existing.entryDate=handoverDraft.entryDate||existing.entryDate;
  existing.edited=true;
  existing.updatedAt=new Date().toISOString()
 }
 state.handoverDrafts[key]={...clone(handoverDraft),savedHandoverId:existing?.id||""};
 handoverDraftKey=key;
 commitDirectState()
}
$("handoverEditorForm").onsubmit=e=>{
 e.preventDefault();
 const previousClientRep=handoverDraft?.clientRep||"",previousSupplierRep=handoverDraft?.supplierRep||"",previousClientSigner=handoverDraft?.clientSigner||"",previousSupplierSigner=handoverDraft?.supplierSigner||"";
 readHandoverEditor();
 if(handoverDraft.clientRep!==previousClientRep&&handoverDraft.clientSigner===previousClientSigner)handoverDraft.clientSigner=handoverDraft.clientRep.replace(/\s*[–-]\s*stavbyvedúci\s*$/i,"");
 if(handoverDraft.supplierRep!==previousSupplierRep&&handoverDraft.supplierSigner===previousSupplierSigner)handoverDraft.supplierSigner=handoverDraft.supplierRep;
 persistHandoverEditorDraft();
 $("handoverEditorModal").classList.add("hidden");
 renderHandover();
 toast("Ručné úpravy vrátane mien boli uložené.")
};[$("editHandoverBtn"),$("editHandoverTop"),$("editHandoverBottom")].forEach(b=>b.onclick=openHandoverEditor);function resetHandoverTemplate(){if(!confirm("Obnoviť všetky texty a údaje podľa šablóny a databázy?"))return;const pid=$("handoverProject").value||state.selectedProjectId;const cid=$("handoverCompany").value||state.assignments.find(a=>a.projectId===pid)?.companyId||"";if(!cid){alert("Na stavbe nie je priradená firma.");return}handoverDraft=defaultHandoverDraft(pid,cid);handoverDraftKey=`${pid}|${cid}`;if(state.handoverDrafts)delete state.handoverDrafts[handoverDraftKey];editingHandoverId="";commitDirectState();$("handoverDate").value=handoverDraft.date;$("entryDate").value=handoverDraft.entryDate;renderHandover();toast("Šablóna bola obnovená.")}$("resetHandoverBtn").onclick=resetHandoverTemplate;$("editorResetTemplate").onclick=()=>{resetHandoverTemplate();openHandoverEditor()};function newHandover(){const pid=$("handoverProject").value||state.selectedProjectId,cid=$("handoverCompany").value||"";handoverDraft=defaultHandoverDraft(pid,cid);handoverDraftKey=`${pid}|${cid||"blank"}`;editingHandoverId="";renderHandover();toast("Bola vytvorená nová zápisnica.")}$("newHandoverTop").onclick=newHandover;
function applyZoom(){$("handoverPreview").style.zoom=zoom;$("zoomLabel").textContent=`${Math.round(zoom*100)} %`}$("zoomOut").onclick=()=>{zoom=Math.max(.4,zoom-.08);applyZoom()};$("zoomIn").onclick=()=>{zoom=Math.min(1,zoom+.08);applyZoom()};function removeHandoverPrintFrame(){
 const existing=document.getElementById("handoverPrintFrame");
 if(existing)existing.remove()
}
function printDoc(){
 prepareHandover(false);
 renderHandover();

 const markup=$("handoverPreview").innerHTML;
 removeHandoverPrintFrame();

 const frame=document.createElement("iframe");
 frame.id="handoverPrintFrame";
 frame.setAttribute("title","Tlač odovzdania pracoviska");
 frame.style.position="fixed";
 frame.style.right="0";
 frame.style.bottom="0";
 frame.style.width="1px";
 frame.style.height="1px";
 frame.style.border="0";
 frame.style.opacity="0";
 frame.style.pointerEvents="none";
 frame.style.zIndex="-1";
 document.body.appendChild(frame);

 const printDocument=frame.contentDocument||frame.contentWindow.document;
 printDocument.open();
 printDocument.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Odovzdanie pracoviska</title>
 <style>
 @page{size:A4 portrait;margin:0}
  html,body{margin:0;padding:0;background:#dfe6ec;font-family:"Times New Roman",serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  *{box-sizing:border-box}
  .handover-print-root{display:flex;flex-direction:column;align-items:center;padding:8mm 0;gap:8mm}
  .handover-page{position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;box-shadow:0 10px 28px rgba(0,0,0,.18);page-break-after:always}
  .handover-page:last-child{page-break-after:auto}
  .letterhead-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0}
  .letterhead-content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column}
  .handover-letterhead-content{padding:46.5mm 10.4mm 28mm;font-size:9.35pt;line-height:1.12}
  .letter-doc-top{display:grid;grid-template-columns:1fr 30mm;border:1px solid #000;border-bottom:0;font-size:9.15pt}
  .letter-doc-top>div{padding:1.25mm 2mm}
  .letter-doc-top>div:last-child{text-align:center;border-left:1px solid #000}
  .letter-doc-title{border:1px solid #000;text-align:center;font-weight:bold;font-size:13.2pt;padding:1.8mm 1mm}
  .letter-doc-intro{border:1px solid #000;border-top:0;text-align:center;font-style:italic;font-size:9.05pt;padding:1.65mm 3mm;line-height:1.12}
  .doc-parties{display:grid;grid-template-columns:1fr 1fr;border-left:1px solid #000;border-right:1px solid #000;background:rgba(255,255,255,.94)}
  .doc-party{padding:1.8mm 2.5mm;font-size:9.6pt;border-bottom:1px solid #000}
  .doc-party+.doc-party{border-left:1px solid #000}
  .doc-party .label{margin-bottom:1.4mm}
  .doc-party div{margin:.48mm 0}
  .doc-project{border-left:1px solid #000;border-right:1px solid #000;border-bottom:1px solid #000;background:rgba(255,255,255,.94)}
  .doc-project-row{display:grid;grid-template-columns:1fr 32mm}
  .doc-project-row>div{padding:1.2mm 1.8mm}
  .doc-project-row>div+div{border-left:1px solid #000}
  .doc-project-row+.doc-project-row{border-top:1px solid #000}
  .doc-project-name{font-weight:bold}
  .doc-items{border-left:1px solid #000;border-right:1px solid #000;background:rgba(255,255,255,.94)}
  .doc-item{display:grid;grid-template-columns:7.2mm 1fr;border-bottom:1px solid #000;min-height:10.65mm}
  .doc-item.compact{min-height:8.45mm}
  .doc-item .n{padding:1.25mm 1.2mm;text-align:center;font-size:9.65pt}
  .doc-item .txt{padding:1.25mm 2mm;border-left:1px solid #000;font-size:9.25pt;line-height:1.12}
  .doc-tech{border:1px solid #000;border-top:0;padding:2.3mm 3.2mm;font-size:9.45pt;line-height:1.18;flex:1;background:rgba(255,255,255,.94)}
  .doc-tech p{margin:0 0 1.2mm}
  .doc-tech ul{margin:.75mm 0 .95mm 4.2mm;padding-left:3mm}
  .doc-tech li{margin:.42mm 0}
  .signatures{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:0;min-height:25mm;background:rgba(255,255,255,.94)}
  .signature{padding:2.5mm;font-weight:bold;font-size:9.75pt}
  .signature+.signature{border-left:1px solid #000}
  .sig-line{margin-top:8mm;border-bottom:1px dotted #333;width:80%}
  @media print{
   html,body{background:#fff}
   .handover-print-root{padding:0;gap:0}
   .handover-page{box-shadow:none;margin:0}
  }
 </style></head><body><div class="handover-print-root">${markup}</div></body></html>`);
 printDocument.close();

 const runPrint=()=>{
  try{
   const printWindow=frame.contentWindow;
   if(!printWindow)throw new Error("Tlačový rám nie je dostupný.");
   printWindow.focus();
   printWindow.addEventListener("afterprint",()=>setTimeout(removeHandoverPrintFrame,250),{once:true});
   printWindow.print();
   setTimeout(removeHandoverPrintFrame,60000)
  }catch(error){
   console.error("Chyba tlače odovzdania pracoviska:",error);
   removeHandoverPrintFrame();
   alert("Tlač sa nepodarilo spustiť. Skús aplikáciu zavrieť, znovu otvoriť a tlač zopakovať.")
  }
 };

 const images=[...printDocument.images];
 if(!images.length){
  setTimeout(runPrint,80)
 }else{
  Promise.all(images.map(image=>image.complete
   ?Promise.resolve()
   :new Promise(resolve=>{
     image.addEventListener("load",resolve,{once:true});
     image.addEventListener("error",resolve,{once:true})
    })))
   .then(()=>setTimeout(runPrint,100))
 }
}
function saveDocumentVersion(kind,record,label){const versions=state.documentVersions.filter(v=>v.kind===kind&&v.documentId===record.id);state.documentVersions.push({id:uid("ver"),kind,documentId:record.id,version:versions.length+1,projectId:record.projectId,savedAt:new Date().toISOString(),label:label||"Uloženie dokumentu",snapshot:clone(record)})}
function documentVersions(kind,id){return state.documentVersions.filter(v=>v.kind===kind&&v.documentId===id).sort((a,b)=>b.version-a.version)}
function openHistory(kind,id){const versions=documentVersions(kind,id),latest=versions[0];$("historyModalTitle").textContent="História dokumentu";$("historySummary").innerHTML=versions.length?`Dokument má <strong>${versions.length}</strong> uložených verzií. Najnovšia je verzia <strong>${latest.version}</strong>.`:`Dokument zatiaľ nemá uloženú históriu.`;$("historyTable").innerHTML=versions.map(v=>`<tr><td><span class="history-version">v${v.version}</span></td><td>${esc(new Date(v.savedAt).toLocaleString("sk-SK"))}</td><td>${esc(v.label||"Uloženie dokumentu")}</td><td><button data-restore-version="${v.id}">Obnoviť túto verziu</button></td></tr>`).join("")||`<tr><td colspan="4" style="text-align:center;padding:24px;color:#789">Bez histórie.</td></tr>`;document.querySelectorAll("[data-restore-version]").forEach(b=>b.onclick=()=>restoreDocumentVersion(b.dataset.restoreVersion));$("historyModal").classList.remove("hidden")}
function restoreDocumentVersion(versionId){const v=state.documentVersions.find(x=>x.id===versionId);if(!v)return;if(!confirm(`Obnoviť verziu ${v.version}? Aktuálny stav zostane uložený ako nová verzia.`))return;const snap=clone(v.snapshot);if(v.kind==="handover"){const current=state.handovers.find(x=>x.id===v.documentId);if(current)saveDocumentVersion("handover",current,"Automatická verzia pred obnovením");state.handovers=state.handovers.map(x=>x.id===v.documentId?snap:x);saveDocumentVersion("handover",snap,`Obnovená verzia ${v.version}`)}if(v.kind==="acceptance"){const current=state.acceptanceProtocols.find(x=>x.id===v.documentId);if(current)saveDocumentVersion("acceptance",current,"Automatická verzia pred obnovením");state.acceptanceProtocols=state.acceptanceProtocols.map(x=>x.id===v.documentId?snap:x);saveDocumentVersion("acceptance",snap,`Obnovená verzia ${v.version}`)}if(v.kind==="controlDay"){const current=state.controlDays.find(x=>x.id===v.documentId);if(current)saveDocumentVersion("controlDay",current,"Automatická verzia pred obnovením");state.controlDays=state.controlDays.map(x=>x.id===v.documentId?snap:x);saveDocumentVersion("controlDay",snap,`Obnovená verzia ${v.version}`)}$("historyModal").classList.add("hidden");save("Staršia verzia dokumentu bola obnovená.")}

function saveHandover(){const pid=$("handoverProject").value||state.selectedProjectId;let cid=$("handoverCompany").value||$("handoverCompany").selectedOptions?.[0]?.value||state.assignments.find(a=>a.projectId===pid)?.companyId||"";if(cid)$("handoverCompany").value=cid;if(!pid||!cid){alert("Najprv vyber stavbu a firmu.");return}if(!handoverDraft){prepareHandover(true)}if(!handoverDraft){alert("Dokument sa nepodarilo pripraviť.");return}if(!handoverDraft.contract||handoverDraft.contract==="—"){alert("Doplň číslo ZoD alebo objednávky v editore dokumentu alebo priraď firmu k stavbe.");return}const wasEditing=!!editingHandoverId,record={id:editingHandoverId||uid("h"),projectId:pid,companyId:cid,contractNo:handoverDraft.contract,contractType:handoverDraft.documentType||"ZoD",date:handoverDraft.date||todayISO(),entryDate:handoverDraft.entryDate||todayISO(),type:"Odovzdanie pracoviska",content:clone(handoverDraft),edited:true,updatedAt:new Date().toISOString()},companyAssignment=assignment(pid,cid);if(companyAssignment&&!companyAssignment.actualStart)companyAssignment.actualStart=record.entryDate||record.date;if(editingHandoverId){state.handovers=state.handovers.map(x=>x.id===editingHandoverId?record:x)}else{state.handovers.push(record);editingHandoverId=record.id}handoverDraftKey=`${pid}|${cid}`;state.handoverDrafts[handoverDraftKey]={...clone(handoverDraft),savedHandoverId:record.id};saveDocumentVersion("handover",record,wasEditing?"Úprava zápisnice":"Vytvorenie zápisnice");save(`Zápisnica bola uložená. Skutočný začiatok realizácie firmy: ${fmtDateISO(companyAssignment?.actualStart||record.entryDate||record.date)}.`)}[$("printHandover"),$("printHandoverTop")].forEach(b=>b.onclick=printDoc);[$("saveHandover"),$("saveHandoverTop")].forEach(b=>b.onclick=saveHandover);


function acceptanceResultClass(v){return v==="Prevzaté bez vád"?"acceptance-ok":v==="Neprevzaté"?"acceptance-no":"acceptance-warning"}
function renderAcceptance(){
 if(!$("acceptanceTable"))return;
 const pid=state.selectedProjectId;
 $("acceptanceProjectName").textContent=activeProject()?.name||"—";
 const q=$("acceptanceSearch").value.trim().toLowerCase();
 const assignments=state.assignments.filter(a=>a.projectId===pid);
 const protocols=state.acceptanceProtocols.filter(x=>x.projectId===pid);
 const latestByCompany=new Map();
 protocols.slice().sort((a,b)=>(b.date||"").localeCompare(a.date||"")).forEach(rec=>{if(!latestByCompany.has(rec.companyId))latestByCompany.set(rec.companyId,rec)});
 const rows=assignments.map(a=>({a,c:company(a.companyId),rec:latestByCompany.get(a.companyId)}))
   .filter(row=>`${row.c?.name||""} ${row.a?.contractNo||""} ${row.a?.scope||""} ${row.rec?.subject||""} ${row.rec?.location||""} ${row.rec?.notes||""}`.toLowerCase().includes(q))
   .sort((x,y)=>(x.c?.name||"").localeCompare(y.c?.name||""));
 const done=assignments.filter(a=>latestByCompany.has(a.companyId)).length;
 const missing=Math.max(0,assignments.length-done);
 const termCount=assignments.filter(a=>a.contractStart||a.contractEnd).length;
 if($("acceptanceCompaniesMetric"))$("acceptanceCompaniesMetric").textContent=assignments.length;
 if($("acceptanceDoneMetric"))$("acceptanceDoneMetric").textContent=done;
 if($("acceptanceMissingMetric"))$("acceptanceMissingMetric").textContent=missing;
 if($("acceptanceTermsMetric"))$("acceptanceTermsMetric").textContent=termCount;
 $("acceptanceCount").textContent=`${rows.length} firiem`;
 $("acceptanceTable").innerHTML=rows.map(({a,c,rec})=>{
   const status=!rec?'<span class="acceptance-status-chip acceptance-status-missing">Chýba</span>':rec.result==='Prevzaté bez vád'?'<span class="acceptance-status-chip acceptance-status-done">Hotový</span>':rec.result==='Neprevzaté'?'<span class="acceptance-status-chip acceptance-status-missing">Neprevzaté</span>':'<span class="acceptance-status-chip acceptance-status-warn">S vadami</span>';
   const terms=[a.contractStart?`od ${fmtDateISO(a.contractStart)}`:"",a.contractEnd?`do ${fmtDateISO(a.contractEnd)}`:""] .filter(Boolean).join(' · ')||'—';
   const protoMeta=rec?`<div><strong>${esc(rec.protocolNo||fmtDateISO(rec.date))}</strong><div class="acceptance-inline-meta"><span>${esc(fmtDateISO(rec.date))}</span>${rec.location?`<span>${esc(rec.location)}</span>`:''}</div></div>`:'—';
   const actions=!rec
    ?`<div class="acceptance-actions-stack"><button data-new-acceptance-company="${a.companyId}">Vytvoriť protokol</button></div>`
    :`<div class="acceptance-actions-stack"><button data-print-acceptance="${rec.id}">Tlačiť</button><button class="ghost" data-edit-acceptance="${rec.id}">Upraviť</button><button class="ghost" data-new-acceptance-company="${a.companyId}">Nový</button></div>`;
   return `<tr><td><strong>${esc(c?.name||"")}</strong></td><td><strong>${esc(assignmentDocRef(a))}</strong></td><td><strong>${esc(rec?.subject||a.scope||"—")}</strong></td><td>${esc(terms)}</td><td>${protoMeta}</td><td>${status}</td><td>${actions}</td></tr>`
 }).join("")||`<tr><td colspan="7" style="text-align:center;padding:30px;color:#789">Na aktívnej stavbe zatiaľ nie je priradená žiadna firma.</td></tr>`;
 document.querySelectorAll("[data-print-acceptance]").forEach(b=>b.onclick=()=>printAcceptance(b.dataset.printAcceptance));
 document.querySelectorAll("[data-edit-acceptance]").forEach(b=>b.onclick=()=>openAcceptance(b.dataset.editAcceptance));
 document.querySelectorAll("[data-new-acceptance-company]").forEach(b=>b.onclick=()=>openAcceptance("",b.dataset.newAcceptanceCompany));
}
if($("acceptanceSearch"))$("acceptanceSearch").oninput=renderAcceptance;
if($("addAcceptanceBtn"))$("addAcceptanceBtn").onclick=()=>openAcceptance();
function openAcceptance(id="",prefillCompanyId=""){
 const x=id?state.acceptanceProtocols.find(v=>v.id===id):null;
 currentAcceptanceId=id;
 $("acceptanceModalTitle").textContent=id?"Upraviť preberací protokol":"Nový preberací protokol";
 $("acceptanceId").value=id;
 const selectedCompanyId=x?.companyId||prefillCompanyId||"";
 const baseAssignment=selectedCompanyId?assignment(state.selectedProjectId,selectedCompanyId):null;
 const companies=projectCompanies();
 $("acceptanceCompany").innerHTML=optionList(companies,selectedCompanyId,v=>v.name,"Vyber firmu");
 $("acceptanceDate").value=x?.date||todayISO();
 $("acceptanceProtocolNo").value=x?.protocolNo||"";
 $("acceptanceContractNo").value=x?.contractNo||baseAssignment?.contractNo||"";
 $("acceptanceSubject").value=x?.subject||baseAssignment?.scope||"";
 $("acceptanceAdditions").value=x?.additions||"";
 $("acceptanceLocation").value=x?.location||"";
 $("acceptanceContractStart").value=x?.contractStart||baseAssignment?.contractStart||"";
 $("acceptanceContractEnd").value=x?.contractEnd||baseAssignment?.contractEnd||"";
 $("acceptanceActualStart").value=x?.actualStart||"";
 $("acceptanceActualEnd").value=x?.actualEnd||"";
 $("acceptanceContractPrice").value=x?.contractPrice||"";
 $("acceptanceActualPrice").value=x?.actualPrice||"";
 $("acceptanceResult").value=x?.result||"Prevzaté bez vád";
 $("acceptanceDocuments").value=Array.isArray(x?.documents)?x.documents.join("\n"):(x?.documentsText||"");
 $("acceptanceNotes").value=x?.notes||"";
 $("acceptanceClientRep").value=x?.clientRep||activeProject()?.manager||"";
 $("acceptanceSupplierRep").value=x?.supplierRep||baseAssignment?.contact||company(selectedCompanyId)?.contact||"";
 $("acceptanceModal").classList.remove("hidden");
}
$("acceptanceCompany").onchange=()=>{const cid=$("acceptanceCompany").value,a=assignment(state.selectedProjectId,cid);if(!$("acceptanceSupplierRep").value)$("acceptanceSupplierRep").value=a?.contact||company(cid)?.contact||"";if(!$("acceptanceContractNo").value)$("acceptanceContractNo").value=a?.contractNo||"";if(!$("acceptanceSubject").value)$("acceptanceSubject").value=a?.scope||"";if(!$("acceptanceContractStart").value)$("acceptanceContractStart").value=a?.contractStart||"";if(!$("acceptanceContractEnd").value)$("acceptanceContractEnd").value=a?.contractEnd||"";};
$("acceptanceForm").onsubmit=e=>{
 e.preventDefault();
 const id=$("acceptanceId").value||uid("ap");
 const docs=$("acceptanceDocuments").value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const record={id,projectId:state.selectedProjectId,companyId:$("acceptanceCompany").value,date:$("acceptanceDate").value,protocolNo:$("acceptanceProtocolNo").value.trim(),contractNo:$("acceptanceContractNo").value.trim(),subject:$("acceptanceSubject").value.trim(),additions:$("acceptanceAdditions").value.trim(),location:$("acceptanceLocation").value.trim(),contractStart:$("acceptanceContractStart").value||"",contractEnd:$("acceptanceContractEnd").value||"",actualStart:$("acceptanceActualStart").value||"",actualEnd:$("acceptanceActualEnd").value||"",contractPrice:$("acceptanceContractPrice").value.trim(),actualPrice:$("acceptanceActualPrice").value.trim(),result:$("acceptanceResult").value,documents:docs,documentsText:docs.join("\n"),notes:$("acceptanceNotes").value.trim(),clientRep:$("acceptanceClientRep").value.trim(),supplierRep:$("acceptanceSupplierRep").value.trim(),updatedAt:new Date().toISOString()};
 if($("acceptanceId").value)state.acceptanceProtocols=state.acceptanceProtocols.map(x=>x.id===id?record:x);else state.acceptanceProtocols.push(record);saveDocumentVersion("acceptance",record,$("acceptanceId").value?"Úprava preberacieho protokolu":"Vytvorenie preberacieho protokolu");
 $("acceptanceModal").classList.add("hidden");save("Uloženie preberacieho protokolu");
};
function printAcceptance(id){
 const x=state.acceptanceProtocols.find(v=>v.id===id);if(!x)return;
 const p=project(x.projectId),c=company(x.companyId),a=assignment(x.projectId,x.companyId),w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač.");return}
 const docs=(Array.isArray(x.documents)?x.documents:[]).filter(Boolean);
 const docsHtml=(docs.length?docs:["Kópie stavebného denníka"]).map((d,i)=>`<div>${i+1}. ${esc(d)}</div>`).join("");
 w.document.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Preberací protokol</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff}.page{position:relative;width:210mm;min-height:297mm;overflow:hidden;background:#fff}.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.content{position:relative;z-index:1;padding:36mm 15mm 38mm;min-height:297mm;font-family:Arial,sans-serif;color:#111;font-size:11px}.page-two .content{padding-top:34mm}.docline{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #183765;padding-bottom:5px;margin-bottom:10px;color:#183765;font-weight:bold}.kicker{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6c7e95;margin-bottom:5px}h1{text-align:center;font-size:18px;margin:0 0 14px}.meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #333}.meta div{padding:8px;border-bottom:1px solid #aaa;min-height:46px}.meta div:nth-child(odd){border-right:1px solid #aaa}.meta strong{display:block;font-size:9px;text-transform:uppercase;color:#555;margin-bottom:4px}.section{border:1px solid #333;padding:10px 12px;margin-top:12px;background:rgba(255,255,255,.94)}.section h3{margin:0 0 8px;font-size:12px;color:#183765}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}.docs-list div{margin:0 0 4px}.small-note{color:#6b7c93;font-size:10px;margin-top:10px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:90px}.line{border-top:1px solid #333;text-align:center;padding-top:5px}</style></head><body><section class="page"><img class="bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><div class="kicker">PREBERANIE DOKONČENÝCH PRÁC</div><div class="docline"><span>${esc(x.protocolNo||"PREBERACÍ PROTOKOL")}</span><span>${esc(fmtDateISO(x.date))}</span></div><h1>PREBERACÍ PROTOKOL</h1><div class="meta"><div><strong>Stavba</strong>${esc(p?.name||"")}</div><div><strong>Dátum</strong>${esc(fmtDateISO(x.date))}</div><div><strong>Zhotoviteľ</strong>${esc(c?.name||"")}</div><div><strong>Číslo ZoD / objednávky</strong>${esc(x.contractNo||a?.contractNo||"—")}</div><div><strong>Predmet preberania</strong>${esc(x.subject||a?.scope||"")}</div><div><strong>Dodatky</strong>${esc(x.additions||"—")}</div><div><strong>Miesto / objekt</strong>${esc(x.location||"—")}</div><div><strong>Výsledok</strong>${esc(x.result||"—")}</div></div><div class="two-col"><div class="section"><h3>Termíny</h3><div><strong>Začiatok podľa ZoD:</strong> ${esc(x.contractStart?fmtDateISO(x.contractStart):"—")}</div><div><strong>Dokončenie podľa ZoD:</strong> ${esc(x.contractEnd?fmtDateISO(x.contractEnd):"—")}</div><div><strong>Skutočný začiatok:</strong> ${esc(x.actualStart?fmtDateISO(x.actualStart):"—")}</div><div><strong>Skutočné dokončenie:</strong> ${esc(x.actualEnd?fmtDateISO(x.actualEnd):"—")}</div></div><div class="section"><h3>Cena diela</h3><div><strong>Podľa ZoD:</strong> ${esc(x.contractPrice||"—")}</div><div><strong>Skutočná cena:</strong> ${esc(x.actualPrice||"—")}</div><div class="small-note">Ceny a termíny môžeš v aplikácii upraviť pre konkrétny protokol.</div></div></div><div class="section"><h3>Odovzdané doklady</h3><div class="docs-list">${docsHtml}</div></div></div></section><section class="page page-two"><img class="bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><div class="kicker">PREBERACÍ PROTOKOL</div><div class="docline"><span>${esc(c?.name||"")}</span><span>${esc(fmtDateISO(x.date))}</span></div><div class="section"><h3>Vady, nedorobky a poznámky</h3><div>${nl2br(x.notes||"Bez vád a nedorobkov.")}</div></div><div class="section"><h3>Podpisy strán</h3><div class="sign"><div class="line">Za objednávateľa<br>${esc(x.clientRep||"")}</div><div class="line">Za zhotoviteľa<br>${esc(x.supplierRep||"")}</div></div></div></div></section><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);w.document.close();
}

function textToRichHtml(text){
 return esc(String(text||"")).replace(/\r/g,"").split("\n").map(line=>line||"<br>").join("<br>")
}
function sanitizeCoordinationHtml(value){
 const template=document.createElement("template");
 template.innerHTML=String(value||"");
 const allowed=new Set(["B","STRONG","I","EM","U","BR","P","DIV","UL","OL","LI","SPAN"]);
 const walk=node=>{
  [...node.children].forEach(child=>{
   walk(child);
   if(!allowed.has(child.tagName)){
    child.replaceWith(...child.childNodes);
    return
   }
   [...child.attributes].forEach(attr=>{
    if(attr.name!=="style")child.removeAttribute(attr.name)
   });
   if(child.hasAttribute("style")){
    const align=(child.style.textAlign||"").toLowerCase();
    child.removeAttribute("style");
    if(["left","center","right","justify"].includes(align))child.style.textAlign=align
   }
  })
 };
 walk(template.content);
 return template.innerHTML
}
function richHtmlToText(value){
 const box=document.createElement("div");box.innerHTML=String(value||"");
 return (box.innerText||box.textContent||"").replace(/\u00a0/g," ").trim()
}
function coordinationAgendaHtml(record){
 return sanitizeCoordinationHtml(record.agendaHtml||textToRichHtml(record.agenda||""))
}
function coordinationNotesHtml(record){
 return sanitizeCoordinationHtml(record.generalNotesHtml||textToRichHtml(record.generalNotes||""))
}
function formatDateTimeISO(value){
 if(!value)return"—";
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return"—";
 return date.toLocaleString("sk-SK",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
}
function coordinationTasks(record){
 record.tasks=Array.isArray(record.tasks)?record.tasks:[];
 record.dismissedTaskRoots=Array.isArray(record.dismissedTaskRoots)?record.dismissedTaskRoots:[];
 record.tasks.forEach(task=>normalizeCoordinationTask(task,record));
 return record.tasks
}
function isCoordinationTaskCompleted(task){
 return String(task?.status||"").trim()==="Splnené"
}
function coordinationTaskRoot(task){
 return task?.rootTaskId||task?.id||""
}
function normalizeCoordinationTask(task,record){
 if(!task.id)task.id=uid("ktu");
 if(!task.rootTaskId)task.rootTaskId=task.id;
 if(!task.enteredDate)task.enteredDate=task.originDate||record?.date||todayISO();
 if(!task.enteredMeetingNumber)task.enteredMeetingNumber=task.originNumber||record?.number||"";
 if(task.carried===undefined)task.carried=Boolean(record&&task.enteredDate!==record.date);
 if(!task.carriedFromDate&&task.carried)task.carriedFromDate=task.originDate||"";
 if(!task.carriedFromMeetingNumber&&task.carried)task.carriedFromMeetingNumber=task.originNumber||"";
 return task
}
function coordinationTaskCompanyName(task){
 return company(task.companyId)?.name||task.responsible||"Bez priradenej firmy"
}
function coordinationTaskGroupKey(task){
 return task.companyId||`custom:${coordinationTaskCompanyName(task)}`
}
function coordinationTaskDateSortValue(task){
 return String(task?.enteredDate||task?.originDate||task?.deadline||"9999-12-31")
}
function coordinationTaskDeadlineSortValue(task){
 return String(task?.deadline||"9999-12-31")
}
function compareCoordinationTasksByDate(a,b){
 return coordinationTaskDateSortValue(a).localeCompare(coordinationTaskDateSortValue(b))||
  coordinationTaskDeadlineSortValue(a).localeCompare(coordinationTaskDeadlineSortValue(b))||
  String(a.text||"").localeCompare(String(b.text||""),"sk",{sensitivity:"base"})
}
function groupedCoordinationTasks(tasks){
 const groups=new Map();
 tasks.forEach(task=>{
  const key=coordinationTaskGroupKey(task),
        name=coordinationTaskCompanyName(task);
  if(!groups.has(key))groups.set(key,{key,name,tasks:[]});
  groups.get(key).tasks.push(task)
 });
 return [...groups.values()]
  .sort((a,b)=>a.name.localeCompare(b.name,"sk",{sensitivity:"base"}))
  .map(group=>({
   ...group,
   tasks:[...group.tasks].sort(compareCoordinationTasksByDate)
  }))
}
function coordinationRecordKind(record){return record?.kind==="controlDay"?"controlDay":"coordination"}
function coordinationKindLabel(kind=selectedCoordinationKind){return kind==="controlDay"?"Kontrolný deň":"Koordinačná porada"}
function coordinationKindTitle(kind=selectedCoordinationKind){return kind==="controlDay"?"Zápis z kontrolného dňa":"Zápis z koordinačnej porady"}
function latestCoordinationTaskStatesBefore(record){
 const states=new Map(),
       previous=state.controlDays
        .filter(item=>item.projectId===record.projectId&&coordinationRecordKind(item)===coordinationRecordKind(record)&&item.date<record.date)
        .sort((a,b)=>a.date.localeCompare(b.date));
 previous.forEach(previousRecord=>{
  coordinationTasks(previousRecord).forEach(task=>{
   states.set(coordinationTaskRoot(task),{task,record:previousRecord,dismissed:false})
  });
  (previousRecord.dismissedTaskRoots||[]).forEach(root=>{
   states.set(root,{task:null,record:previousRecord,dismissed:true})
  })
 });
 return states
}
function carriedCoordinationTask(task,fromRecord){
 const copy=clone(task),
       root=coordinationTaskRoot(task);
 return{
  ...copy,
  id:uid("ktu"),
  rootTaskId:root,
  enteredDate:task.enteredDate||fromRecord.date,
  enteredMeetingNumber:task.enteredMeetingNumber||fromRecord.number,
  originDate:task.enteredDate||fromRecord.date,
  originNumber:task.enteredMeetingNumber||fromRecord.number,
  carried:true,
  carriedFromDate:fromRecord.date,
  carriedFromMeetingNumber:fromRecord.number
 }
}
function refreshedCarriedCoordinationTask(existing,task,fromRecord){
 const refreshed=carriedCoordinationTask(task,fromRecord);
 refreshed.id=existing?.id||refreshed.id;
 refreshed.rootTaskId=coordinationTaskRoot(task);
 return refreshed
}
function syncControlDayCarry(record){
 if(!record)return false;
 coordinationTasks(record);
 const states=latestCoordinationTaskStatesBefore(record),
       dismissed=new Set(record.dismissedTaskRoots||[]),
       currentByRoot=new Map(record.tasks.map(task=>[coordinationTaskRoot(task),task]));
 let changed=false;

 states.forEach((stateValue,root)=>{
  if(dismissed.has(root))return;
  const existing=currentByRoot.get(root);

  if(stateValue.dismissed||isCoordinationTaskCompleted(stateValue.task)){
   if(existing&&existing.carried){
    record.tasks=record.tasks.filter(task=>coordinationTaskRoot(task)!==root);
    currentByRoot.delete(root);
    changed=true
   }
   return
  }

  if(!existing){
   const carried=carriedCoordinationTask(stateValue.task,stateValue.record);
   record.tasks.push(carried);
   currentByRoot.set(root,carried);
   changed=true
  }
 });

 if(changed)record.updatedAt=new Date().toISOString();
 return changed
}
function syncFutureCoordinationTask(sourceRecord,sourceTask){
 const root=coordinationTaskRoot(sourceTask),
       future=state.controlDays
        .filter(record=>record.projectId===sourceRecord.projectId&&coordinationRecordKind(record)===coordinationRecordKind(sourceRecord)&&record.date>sourceRecord.date)
        .sort((a,b)=>a.date.localeCompare(b.date));
 let previousRecord=sourceRecord,
     previousTask=sourceTask,
     stopped=isCoordinationTaskCompleted(sourceTask);

 future.forEach(record=>{
  coordinationTasks(record);
  const existing=record.tasks.find(task=>coordinationTaskRoot(task)===root);

  if(stopped){
   if(existing&&existing.carried){
    record.tasks=record.tasks.filter(task=>coordinationTaskRoot(task)!==root);
    record.updatedAt=new Date().toISOString()
   }
   return
  }

  if((record.dismissedTaskRoots||[]).includes(root)){
   stopped=true;
   return
  }

  if(existing){
   const refreshed=existing.carried?refreshedCarriedCoordinationTask(existing,previousTask,previousRecord):existing;
   if(existing.carried){
    record.tasks=record.tasks.map(task=>task.id===existing.id?refreshed:task);
    record.updatedAt=new Date().toISOString()
   }
   previousTask=refreshed;
   previousRecord=record;
   if(isCoordinationTaskCompleted(refreshed))stopped=true;
   return
  }

  const carried=carriedCoordinationTask(previousTask,previousRecord);
  record.tasks.push(carried);
  record.updatedAt=new Date().toISOString();
  previousTask=carried;
  previousRecord=record
 })
}
function statusClass(v){return v==="Splnené"?"status-done":v==="Po termíne"?"status-overdue":v==="Prebieha"?"status-progress":"status-open"}
function controlDayRecords(){return state.controlDays.filter(x=>x.projectId===state.selectedProjectId&&coordinationRecordKind(x)===selectedCoordinationKind).sort((a,b)=>a.date.localeCompare(b.date))}
function controlDayRecord(date=selectedControlDayDate,create=true){
 let record=state.controlDays.find(x=>x.projectId===state.selectedProjectId&&coordinationRecordKind(x)===selectedCoordinationKind&&x.date===date);
 if(!record&&create){
  const maxNumber=Math.max(0,...controlDayRecords().map(x=>Number(String(x.number||"").match(/\d+/)?.[0]||0)));
  const isControlDay=selectedCoordinationKind==="controlDay";
  record={
   id:uid("kd"),projectId:state.selectedProjectId,date,kind:selectedCoordinationKind,
   number:`${isControlDay?"KD":"KP"} č. ${maxNumber+1}`,time:"09:00",place:"Zariadenie staveniska",
   chairperson:activeProject()?.manager||"",recorder:"Jakub Varga",
   nextDate:addDaysISO(date,7),status:"Plánovaný",
   agenda:isControlDay?"1. Otvorené otázky na investora a technický dozor\n2. Rozhodnutia a stanoviská potrebné od investora\n3. Projektové zmeny, materiály a vzorkovanie\n4. Harmonogram, míľniky a termíny odovzdania\n5. Kvalita, preberanie prác a ďalší postup":"1. Kontrola plnenia úloh z predchádzajúcej koordinačnej porady\n2. Aktuálny postup prác\n3. Koordinácia profesií a nadväznosti prác\n4. Kvalita, BOZP a poriadok na stavenisku\n5. Rôzne",
   generalNotes:"",
   tasks:[],dismissedTaskRoots:[],
   attendees:[],savedToDocuments:false,lastSavedAt:"",
   createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
  };
  state.controlDays.push(record);
  syncControlDayCarry(record);
  commitDirectState()
 }else if(record&&syncControlDayCarry(record)){
  commitDirectState()
 }
 return record
}
function prepareControlDay(){
 selectedControlDayDate=selectedCoordinationKind==="controlDay"?(selectedControlDayDate||todayISO()):forceTuesdayISO(selectedControlDayDate||nextTuesdayISO(todayISO()));
 $("controlDayDate").value=selectedControlDayDate;
 controlDayRecord(selectedControlDayDate,true);
 renderSiteMeetings()
}
function attendeeCompanyName(a){return a.customCompany||company(a.companyId)?.name||""}
function controlDayTaskResponsible(t){return t.responsible||company(t.companyId)?.name||"—"}
function coordinationAttendeeCompany(a){return a.customCompany||company(a.companyId)?.name||""}
function renderSiteMeetings(){
 const record=controlDayRecord(selectedControlDayDate,true),
       p=activeProject(),
       tasks=coordinationTasks(record),isControlDay=selectedCoordinationKind==="controlDay",label=coordinationKindLabel(),title=coordinationKindTitle();

 if($("coordinationPageKicker"))$("coordinationPageKicker").textContent=isControlDay?"OTÁZKY A BODY NA PREROKOVANIE S INVESTOROM":"KAŽDÝ TÝŽDEŇ V UTOROK";
 if($("coordinationPageTitle"))$("coordinationPageTitle").textContent=title;
 if($("coordinationDateLabel"))$("coordinationDateLabel").textContent=isControlDay?"Termín kontrolného dňa":"Termín koordinačnej porady";
 if($("coordinationMetricLabel"))$("coordinationMetricLabel").textContent=label;
 if($("coordinationInfoKicker"))$("coordinationInfoKicker").textContent=title.toUpperCase();
 if($("coordinationNumberLabel"))$("coordinationNumberLabel").textContent=isControlDay?"Číslo kontrolného dňa":"Číslo koordinačnej porady";
 if($("coordinationNextDateLabel"))$("coordinationNextDateLabel").textContent=isControlDay?"Nasledujúci kontrolný deň":"Nasledujúca koordinačná porada";
 if($("carryPreviousControlDayTasks"))$("carryPreviousControlDayTasks").textContent=isControlDay?"↩ Preniesť / aktualizovať z minulého KD":"↩ Preniesť / aktualizovať z minulého týždňa";
 if($("addControlDayTask"))$("addControlDayTask").textContent=isControlDay?"+ Pridať otázku / bod":"+ Pridať viac úloh firme";
 const taskPanel=$("controlDayTaskTable")?.closest("article");
 if(taskPanel?.querySelector("h2"))taskPanel.querySelector("h2").textContent=isControlDay?"Otázky a body na prerokovanie":"Dohodnuté úlohy";
 if(taskPanel?.querySelector(".eyebrow"))taskPanel.querySelector(".eyebrow").textContent=isControlDay?"PRÍPRAVA KONTROLNÉHO DŇA":"BODY ZÁPISU A ÚLOHY";
 const taskMetric=$("controlDayTaskCount")?.closest("article")?.querySelector("span");
 if(taskMetric)taskMetric.textContent=isControlDay?"Bodov":"Úloh";
 const taskHeaders=$("controlDayTaskTable")?.closest("table")?.querySelectorAll("th")||[];
 if(taskHeaders[1])taskHeaders[1].textContent=isControlDay?"Otázka / bod na prerokovanie":"Úloha / zápis";
 if(taskHeaders[3])taskHeaders[3].textContent=isControlDay?"Strana / zodpovedný":"Zodpovedný";
 if(taskHeaders[6])taskHeaders[6].textContent=isControlDay?"Výsledok / poznámka":"Poznámka";
 const attendancePanel=$("coordinationAttendanceTable")?.closest("article");
 if(attendancePanel?.querySelector("h2"))attendancePanel.querySelector("h2").textContent=isControlDay?"BETPRES, investor a prizvaní účastníci":"Firmy a účastníci";
 if($("addCoordinationAttendee"))$("addCoordinationAttendee").textContent=isControlDay?"+ Pridať účastníka":"+ Pridať firmu z databázy";
 const attendanceHeaders=$("coordinationAttendanceTable")?.closest("table")?.querySelectorAll("th")||[];
 if(attendanceHeaders[2])attendanceHeaders[2].textContent=isControlDay?"Strana / organizácia":"Firma";
 const attendanceMetric=$("controlDayAttendanceCount")?.closest("article")?.querySelector("span");
 if(attendanceMetric)attendanceMetric.textContent=isControlDay?"Účastníkov":"Firiem na prezenčnej listine";
 if($("previousControlTuesday"))$("previousControlTuesday").textContent=isControlDay?"← Predchádzajúci termín":"← Predchádzajúci utorok";
 if($("nextControlTuesday"))$("nextControlTuesday").textContent=isControlDay?"Ďalší termín →":"Ďalší utorok →";

 record.attendees=Array.isArray(record.attendees)?record.attendees:[];

 $("controlDayDate").value=record.date;
 $("controlDayNumberMetric").textContent=record.number||"—";
 $("controlDayDateMetric").textContent=fmtDateISO(record.date);
 $("controlDayTaskCount").textContent=tasks.length;
 $("controlDayAttendanceCount").textContent=record.attendees.length;
 $("controlDayExportMetric").textContent=record.lastExportedAt?formatDateTimeISO(record.lastExportedAt):"Zatiaľ nie";
 $("controlDaySaveMetric").textContent=record.savedToDocuments
  ?`Uložené ${record.lastSavedAt?formatDateTimeISO(record.lastSavedAt):""}`.trim()
  :"Rozpracovaný";
 $("controlDaySaveMetric").className=record.savedToDocuments?"control-save-stored":"control-save-draft";
 $("controlDayHeading").textContent=`${record.number} – ${p?.name||""}`;

 $("controlDayInfoSummary").innerHTML=`
  <div><span>Dátum a čas</span><strong>${esc(fmtDateISO(record.date))} o ${esc(record.time||"—")}</strong></div>
  <div><span>Miesto</span><strong>${esc(record.place||"—")}</strong></div>
  <div><span>Viedol</span><strong>${esc(record.chairperson||"—")}</strong></div>
  <div><span>Zápis vyhotovil</span><strong>${esc(record.recorder||"—")}</strong></div>
  <div><span>Nasledujúci termín – ${esc(label.toLowerCase())}</span><strong>${esc(fmtDateISO(record.nextDate))}</strong></div>
  <div><span>Stav zápisu</span><strong>${esc(record.status||"—")}</strong></div>
  <div><span>Uloženie v Dokumentoch</span><strong>${esc(record.savedToDocuments?(record.lastSavedAt?formatDateTimeISO(record.lastSavedAt):"Uložené"):"Zatiaľ neuložené")}</strong></div>
  <div><span>Posledný export PDF</span><strong>${esc(record.lastExportedAt?formatDateTimeISO(record.lastExportedAt):"Zatiaľ neexportované")}</strong></div>`;

 $("controlDayTaskTable").innerHTML=(isControlDay?[{name:"Otázky a body na prerokovanie",tasks}]:groupedCoordinationTasks(tasks)).map(group=>{
  const taskRows=group.tasks.map((t,index)=>{
   const coordinationTaskNumber=index+1;
   const originalDate=t.enteredDate||record.date,
         originalMeeting=t.enteredMeetingNumber||record.number||"",
         carried=originalDate!==record.date||t.carried,
         isLast=index===group.tasks.length-1;
   return`<tr class="coord-task-row ${isLast?"company-group-last":""}" data-coordination-task-row="${t.id}">
    <td><strong>${coordinationTaskNumber}</strong></td>
    <td>${esc(t.text||"")}${carried?`<span class="task-carry-note">Úloha sa prenáša až do označenia stavu „Splnené“.</span>`:""}</td>
    <td class="control-task-date">
     <strong>${esc(fmtDateISO(originalDate))}</strong>
     <span class="original-meeting">${esc(originalMeeting)}</span>
     ${carried?`<span class="carried-task-badge">Prenesená úloha</span>`:""}
    </td>
    <td>${esc(controlDayTaskResponsible(t))}</td>
    <td>${esc(t.deadline?fmtDateISO(t.deadline):"—")}</td>
    <td><span class="status-badge ${statusClass(t.status)}">${esc(t.status||"Bez vyjadrenia")}</span></td>
    <td>${esc(t.note||"—")}</td>
    <td><div class="row-actions"><button class="ghost" data-edit-control-task="${t.id}">Upraviť</button><button class="danger" data-delete-control-task="${t.id}">Vymazať</button></div></td>
   </tr>`
  }).join("");
  return`${isControlDay?"":`<tr class="coord-company-group">
   <td colspan="8"><div class="coord-company-group-content"><span>🏢 ${esc(group.name)}</span><div class="coord-company-group-actions"><small>${group.tasks.length} ${group.tasks.length===1?"úloha":"úloh"}</small><button type="button" data-edit-control-company="${esc(group.key)}">Upraviť celú firmu</button></div></div></td>
  </tr>`}${taskRows}`
 }).join("")||`<tr><td colspan="8" class="coordination-empty">${isControlDay?"Zatiaľ nie sú zapísané žiadne otázky ani body na prerokovanie.":"Zatiaľ nie sú zapísané žiadne úlohy."}</td></tr>`;

 $("coordinationAttendanceTable").innerHTML=record.attendees.map((a,i)=>`<tr>
  <td>${i+1}</td><td><strong>${esc(a.name||"")}</strong></td>
  <td>${esc(coordinationAttendeeCompany(a)||"—")}</td><td>${esc(a.role||"—")}</td>
  <td>${esc(a.contact||"—")}</td>
  <td><div class="row-actions"><button class="ghost" data-edit-coordination-attendee="${a.id}">Upraviť</button><button class="danger" data-delete-coordination-attendee="${a.id}">Vymazať</button></div></td>
 </tr>`).join("")||`<tr><td colspan="6" class="coordination-empty">${isControlDay?"Doplň účastníkov za BETPRES, investora, stavebný dozor alebo projektanta. Subdodávateľa pridaj iba vtedy, keď je k bodu prizvaný.":"Prezenčná listina zatiaľ nemá doplnené firmy. Pri exporte zostanú riadky prázdne."}</td></tr>`;

 document.querySelectorAll("[data-edit-control-task]").forEach(b=>b.onclick=()=>openControlDayTask(b.dataset.editControlTask));
 document.querySelectorAll("[data-edit-control-company]").forEach(b=>b.onclick=()=>openBulkControlDayCompany(b.dataset.editControlCompany));
 document.querySelectorAll("[data-delete-control-task]").forEach(b=>b.onclick=()=>{
  if(confirm("Vymazať túto úlohu aj z ďalších koordinačných porád?")){
   const task=tasks.find(item=>item.id===b.dataset.deleteControlTask),
         root=coordinationTaskRoot(task);
   record.tasks=tasks.filter(item=>coordinationTaskRoot(item)!==root);
   record.dismissedTaskRoots=[...new Set([...(record.dismissedTaskRoots||[]),root])];
   state.controlDays
    .filter(item=>item.projectId===record.projectId&&coordinationRecordKind(item)===coordinationRecordKind(record)&&item.date>record.date)
    .forEach(item=>{
     item.tasks=coordinationTasks(item).filter(futureTask=>coordinationTaskRoot(futureTask)!==root);
     item.dismissedTaskRoots=[...new Set([...(item.dismissedTaskRoots||[]),root])]
    });
   record.updatedAt=new Date().toISOString();
   save("Úloha bola odstránená aj z ďalších koordinačných porád.")
  }
 });

 document.querySelectorAll("[data-edit-coordination-attendee]").forEach(b=>b.onclick=()=>openCoordinationAttendee(b.dataset.editCoordinationAttendee));
 document.querySelectorAll("[data-delete-coordination-attendee]").forEach(b=>b.onclick=()=>{
  if(confirm("Vymazať účastníka z prezenčnej listiny?")){
   record.attendees=record.attendees.filter(x=>x.id!==b.dataset.deleteCoordinationAttendee);
   record.updatedAt=new Date().toISOString();
   save("Účastník bol odstránený z rozpracovaného zápisu.")
  }
 });

 if($("controlDayPreview"))$("controlDayPreview").innerHTML=""
}
function controlDocumentHeader(record,page){return `<div class="control-letterhead-top"><span>${esc(record.number||"")}</span><span>Strana ${page}/2</span></div>`}

$("controlDayDate").onchange=()=>{
 const chosen=$("controlDayDate").value||(selectedCoordinationKind==="controlDay"?todayISO():nextTuesdayISO(todayISO())),normalized=selectedCoordinationKind==="controlDay"?chosen:forceTuesdayISO(chosen);
 if(chosen!==normalized)toast("Dátum bol nastavený na najbližší utorok.");
 selectedControlDayDate=normalized;prepareControlDay()
};
$("previousControlTuesday").onclick=()=>{selectedControlDayDate=addDaysISO(selectedControlDayDate,-7);prepareControlDay()};
$("nextControlTuesday").onclick=()=>{selectedControlDayDate=addDaysISO(selectedControlDayDate,7);prepareControlDay()};
$("editControlDayInfo").onclick=()=>openControlDayInfo();
$("editControlDayInfoInline").onclick=()=>openControlDayInfo();
function openControlDayInfo(){
 const r=controlDayRecord();
 const dateLabel=$("controlDayInfoDate")?.closest("label");
 if(dateLabel?.firstChild)dateLabel.firstChild.nodeValue=selectedCoordinationKind==="controlDay"?"Dátum kontrolného dňa":"Dátum – utorok";
 $("controlDayNumber").value=r.number||"";$("controlDayInfoDate").value=r.date;$("controlDayTime").value=r.time||"";$("controlDayPlace").value=r.place||"";
 $("controlDayChairperson").value=r.chairperson||"";$("controlDayRecorder").value=r.recorder||"";$("controlDayNextDate").value=r.nextDate||addDaysISO(r.date,7);
 $("controlDayStatus").value=r.status||"Plánovaný";$("controlDayAgenda").value=r.agenda||richHtmlToText(coordinationAgendaHtml(r));$("controlDayGeneralNotes").value=r.generalNotes||richHtmlToText(coordinationNotesHtml(r));
 $("controlDayInfoModal").classList.remove("hidden")
}
$("controlDayInfoForm").onsubmit=e=>{
 e.preventDefault();const r=controlDayRecord(),requestedDate=$("controlDayInfoDate").value,newDate=selectedCoordinationKind==="controlDay"?requestedDate:forceTuesdayISO(requestedDate);
 if(newDate!==r.date&&state.controlDays.some(x=>x.projectId===state.selectedProjectId&&coordinationRecordKind(x)===selectedCoordinationKind&&x.date===newDate&&x.id!==r.id)){alert(`Pre tento utorok už existuje ${coordinationKindLabel().toLowerCase()}.`);return}
 r.number=$("controlDayNumber").value.trim();r.date=newDate;r.time=$("controlDayTime").value;r.place=$("controlDayPlace").value.trim();r.chairperson=$("controlDayChairperson").value.trim();r.recorder=$("controlDayRecorder").value.trim();r.nextDate=$("controlDayNextDate").value||addDaysISO(newDate,7);r.status=$("controlDayStatus").value;if(!r.agendaHtml)r.agenda=$("controlDayAgenda").value.trim();if(!r.generalNotesHtml)r.generalNotes=$("controlDayGeneralNotes").value.trim();r.updatedAt=new Date().toISOString();selectedControlDayDate=newDate;$("controlDayInfoModal").classList.add("hidden");save("Základné údaje rozpracovaného zápisu boli aktualizované.")
};


function openCoordinationTextEditor(){
 const record=controlDayRecord();
 $("coordinationAgendaEditor").innerHTML=coordinationAgendaHtml(record);
 $("coordinationNotesEditor").innerHTML=coordinationNotesHtml(record);
 $("coordinationTextModal").classList.remove("hidden");
 setTimeout(()=>$("coordinationAgendaEditor").focus(),60)
}
$("editCoordinationText").onclick=openCoordinationTextEditor;
document.querySelectorAll("[data-editor-toolbar]").forEach(toolbar=>{
 toolbar.querySelectorAll("[data-rich-command]").forEach(button=>{
  button.onclick=()=>{
   const editor=$(toolbar.dataset.editorToolbar);
   editor.focus();
   document.execCommand(button.dataset.richCommand,false,null)
  }
 })
});
$("saveCoordinationText").onclick=()=>{
 const record=controlDayRecord(),
       agendaHtml=sanitizeCoordinationHtml($("coordinationAgendaEditor").innerHTML),
       notesHtml=sanitizeCoordinationHtml($("coordinationNotesEditor").innerHTML);
 record.agendaHtml=agendaHtml;
 record.generalNotesHtml=notesHtml;
 record.agenda=richHtmlToText(agendaHtml);
 record.generalNotes=richHtmlToText(notesHtml);
 record.updatedAt=new Date().toISOString();
 
 $("coordinationTextModal").classList.add("hidden");
 save("Text rozpracovaného zápisu bol aktualizovaný.")
};

$("addControlDayTask").onclick=()=>selectedCoordinationKind==="controlDay"?openControlDayTask():openBulkControlDayTasks();
function previousCoordinationRecordFor(record){
 return state.controlDays
  .filter(item=>item.projectId===record.projectId&&coordinationRecordKind(item)===coordinationRecordKind(record)&&item.date<record.date)
  .sort((a,b)=>b.date.localeCompare(a.date))[0]||null
}
function manualCarryPreviousControlDayTasks(){
 const record=controlDayRecord(selectedControlDayDate,true),
       previousRecord=previousCoordinationRecordFor(record);
 if(!previousRecord){
  alert(selectedCoordinationKind==="controlDay"?"Nie je nájdený predchádzajúci kontrolný deň, z ktorého by sa dali preniesť otvorené body.":"Nie je nájdená predchádzajúca koordinačná porada, z ktorej by sa dali preniesť úlohy.");
  return
 }
 const tasksToCarry=coordinationTasks(previousRecord)
        .filter(task=>!isCoordinationTaskCompleted(task));
 if(!tasksToCarry.length){
  alert(`V porade ${previousRecord.number||""} zo dňa ${fmtDateISO(previousRecord.date)} nie sú žiadne nesplnené úlohy na prenos.`);
  return
 }
 const addedRoots=[];
 let added=0,updated=0;
 tasksToCarry.forEach(task=>{
  const root=coordinationTaskRoot(task),existing=record.tasks.find(item=>coordinationTaskRoot(item)===root),
        carried=existing?refreshedCarriedCoordinationTask(existing,task,previousRecord):carriedCoordinationTask(task,previousRecord);
  if(existing){record.tasks=record.tasks.map(item=>item.id===existing.id?carried:item);updated++}
  else{record.tasks.push(carried);added++}
  addedRoots.push(coordinationTaskRoot(carried));
  syncFutureCoordinationTask(record,carried)
 });
 record.dismissedTaskRoots=(record.dismissedTaskRoots||[]).filter(root=>!addedRoots.includes(root));
 record.updatedAt=new Date().toISOString();
 save(selectedCoordinationKind==="controlDay"
  ?`Otvorené body z ${previousRecord.number||""} boli zosúladené presne: ${added} pridaných, ${updated} aktualizovaných.`
  :`Úlohy z ${previousRecord.number||""} boli zosúladené presne: ${added} pridaných, ${updated} aktualizovaných. Preniesli sa text, firma, zodpovedný, termín, stav aj poznámka.`);
 renderSiteMeetings()
}
if($("carryPreviousControlDayTasks"))$("carryPreviousControlDayTasks").onclick=manualCarryPreviousControlDayTasks;


let bulkControlDayTaskRows=[],
    bulkControlDayTaskMode="create",
    bulkControlDayEditingGroupKey="";

function bulkCompanyOptions(selected=""){
 const assignedIds=state.assignments
  .filter(assignment=>assignment.projectId===state.selectedProjectId)
  .map(assignment=>assignment.companyId);
 const assigned=assignedIds.map(company).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 const others=state.companies.filter(item=>!assignedIds.includes(item.id)).sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 let options=`<option value="">Vyber firmu</option>`;
 if(assigned.length){
  options+=`<optgroup label="Firmy priradené k stavbe">${assigned.map(item=>`<option value="${item.id}" ${item.id===selected?"selected":""}>${esc(item.name)}</option>`).join("")}</optgroup>`
 }
 if(others.length){
  options+=`<optgroup label="Ostatné firmy">${others.map(item=>`<option value="${item.id}" ${item.id===selected?"selected":""}>${esc(item.name)}</option>`).join("")}</optgroup>`
 }
 return options
}
function bulkTaskStatusOptions(selected="Bez vyjadrenia"){
 return["Bez vyjadrenia","Otvorené","Prebieha","Nesplnené","Po termíne","Splnené"]
  .map(status=>`<option ${status===selected?"selected":""}>${status}</option>`).join("")
}
function createBulkControlDayTaskRow(source={}){
 return{
  id:source.id||uid("bkt"),
  sourceId:source.id||"",
  rootTaskId:source.rootTaskId||source.id||"",
  text:source.text||"",
  responsible:source.responsible||"",
  deadline:source.deadline||"",
  status:source.status||"Bez vyjadrenia",
  note:source.note||"",
  enteredDate:source.enteredDate||"",
  enteredMeetingNumber:source.enteredMeetingNumber||"",
  originNumber:source.originNumber||"",
  originDate:source.originDate||"",
  carried:Boolean(source.carried),
  carriedFromDate:source.carriedFromDate||"",
  carriedFromMeetingNumber:source.carriedFromMeetingNumber||""
 }
}
function renderBulkControlDayTaskRows(){
 $("bulkControlDayTaskRows").innerHTML=bulkControlDayTaskRows.map((row,index)=>`
  <div class="bulk-task-row" data-bulk-task-row="${row.id}">
   <span class="bulk-task-row-number">${index+1}</span>
   <label>Úloha / zápis
    <textarea data-bulk-task-field="text" data-bulk-task-id="${row.id}" placeholder="Čo má firma vykonať">${esc(row.text||"")}</textarea>
   </label>
   <label>Zodpovedný
    <input data-bulk-task-field="responsible" data-bulk-task-id="${row.id}" value="${esc(row.responsible||"")}" placeholder="Osoba alebo firma">
   </label>
   <label>Termín
    <input type="date" data-bulk-task-field="deadline" data-bulk-task-id="${row.id}" value="${esc(row.deadline||"")}">
   </label>
   <label>Stav
    <select data-bulk-task-field="status" data-bulk-task-id="${row.id}">${bulkTaskStatusOptions(row.status)}</select>
   </label>
   <label>Poznámka
    <textarea data-bulk-task-field="note" data-bulk-task-id="${row.id}" placeholder="Voliteľná poznámka">${esc(row.note||"")}</textarea>
   </label>
   <button type="button" class="danger bulk-task-remove" data-remove-bulk-task="${row.id}" title="Odstrániť riadok">×</button>
  </div>`).join("");

 document.querySelectorAll("[data-bulk-task-field]").forEach(field=>{
  field.oninput=()=>{
   const row=bulkControlDayTaskRows.find(item=>item.id===field.dataset.bulkTaskId);
   if(row)row[field.dataset.bulkTaskField]=field.value
  }
 });
 document.querySelectorAll("[data-remove-bulk-task]").forEach(button=>{
  button.onclick=()=>{
   if(bulkControlDayTaskRows.length===1){
    bulkControlDayTaskRows=[createBulkControlDayTaskRow()];
   }else{
    bulkControlDayTaskRows=bulkControlDayTaskRows.filter(row=>row.id!==button.dataset.removeBulkTask)
   }
   renderBulkControlDayTaskRows()
  }
 })
}
function openBulkControlDayTasks(){
 bulkControlDayTaskMode="create";
 bulkControlDayEditingGroupKey="";
 $("bulkControlDayTaskKicker").textContent="VIAC ÚLOH PRE JEDNU FIRMU";
 $("bulkControlDayTaskTitle").textContent="Pridať úlohy z koordinačnej porady";
 $("saveBulkControlDayTasks").textContent="Uložiť všetky úlohy";
 $("bulkControlDayTaskCompany").innerHTML=bulkCompanyOptions();
 $("bulkControlDayTaskCompany").disabled=false;
 $("bulkControlDayTaskResponsible").value="";
 $("bulkControlDayTaskStatus").value="Bez vyjadrenia";
 bulkControlDayTaskRows=[createBulkControlDayTaskRow(),createBulkControlDayTaskRow()];
 renderBulkControlDayTaskRows();
 $("bulkControlDayTaskModal").classList.remove("hidden");
 setTimeout(()=>$("bulkControlDayTaskCompany").focus(),50)
}
function openBulkControlDayCompany(groupKey){
 const record=controlDayRecord(),group=groupedCoordinationTasks(coordinationTasks(record)).find(item=>item.key===groupKey);
 if(!group)return;
 bulkControlDayTaskMode="edit";
 bulkControlDayEditingGroupKey=group.key;
 const companyId=group.tasks[0]?.companyId||"",
       responsibles=[...new Set(group.tasks.map(task=>task.responsible||""))],
       statuses=[...new Set(group.tasks.map(task=>task.status||"Bez vyjadrenia"))];
 $("bulkControlDayTaskKicker").textContent="HROMADNÁ ÚPRAVA FIRMY";
 $("bulkControlDayTaskTitle").textContent=`Upraviť firmu ${group.name}`;
 $("saveBulkControlDayTasks").textContent="Uložiť celú firmu";
 $("bulkControlDayTaskCompany").innerHTML=bulkCompanyOptions(companyId);
 $("bulkControlDayTaskCompany").value=companyId;
 $("bulkControlDayTaskCompany").disabled=true;
 $("bulkControlDayTaskResponsible").value=responsibles.length===1?responsibles[0]:"";
 $("bulkControlDayTaskResponsible").placeholder=responsibles.length>1?"Rôzne osoby – uprav ich v riadkoch":"Konkrétna osoba alebo vedúci firmy";
 $("bulkControlDayTaskStatus").value=statuses.length===1?statuses[0]:statuses[0]||"Bez vyjadrenia";
 bulkControlDayTaskRows=group.tasks.map(createBulkControlDayTaskRow);
 renderBulkControlDayTaskRows();
 $("bulkControlDayTaskModal").classList.remove("hidden");
 setTimeout(()=>document.querySelector("[data-bulk-task-field='text']")?.focus(),50)
}
$("bulkControlDayTaskCompany").onchange=()=>{
 const selected=company($("bulkControlDayTaskCompany").value);
 if(selected&&!$("bulkControlDayTaskResponsible").value.trim()){
  $("bulkControlDayTaskResponsible").value=selected.name||""
 }
};
$("bulkControlDayTaskResponsible").onchange=()=>{
 const value=$("bulkControlDayTaskResponsible").value.trim();
 if(!value)return;
 bulkControlDayTaskRows.forEach(row=>row.responsible=value);
 renderBulkControlDayTaskRows()
};
$("bulkControlDayTaskStatus").onchange=()=>{
 const value=$("bulkControlDayTaskStatus").value||"Bez vyjadrenia";
 bulkControlDayTaskRows.forEach(row=>row.status=value);
 renderBulkControlDayTaskRows()
};
$("addBulkControlDayTaskRow").onclick=()=>{
 bulkControlDayTaskRows.push(createBulkControlDayTaskRow({
  responsible:$("bulkControlDayTaskResponsible").value.trim(),
  status:$("bulkControlDayTaskStatus").value||"Bez vyjadrenia"
 }));
 renderBulkControlDayTaskRows();
 const last=document.querySelector(`[data-bulk-task-row="${bulkControlDayTaskRows.at(-1).id}"] textarea`);
 if(last)last.focus()
};
$("bulkControlDayTaskForm").onsubmit=event=>{
 event.preventDefault();
 document.querySelectorAll("[data-bulk-task-field]").forEach(field=>{
  const row=bulkControlDayTaskRows.find(item=>item.id===field.dataset.bulkTaskId);
  if(row)row[field.dataset.bulkTaskField]=field.value
 });
 const companyId=$("bulkControlDayTaskCompany").value,
       selectedCompany=company(companyId),
       defaultResponsible=$("bulkControlDayTaskResponsible").value.trim()||selectedCompany?.name||"",
       defaultStatus=$("bulkControlDayTaskStatus").value||"Bez vyjadrenia",
       validRows=bulkControlDayTaskRows
        .map(row=>({...row,
         text:String(row.text||"").trim(),
         responsible:String(row.responsible||defaultResponsible).trim(),
         status:String(row.status||defaultStatus).trim()||"Bez vyjadrenia",
         note:String(row.note||"").trim()
        }))
        .filter(row=>row.text);
 if(!companyId&&bulkControlDayTaskMode!=="edit"){alert("Najprv vyber firmu.");return}
 if(!validRows.length){alert("Zadaj aspoň jednu úlohu.");return}

 const record=controlDayRecord(selectedControlDayDate,true),
       existingTasks=coordinationTasks(record),
       newTasks=validRows.map(row=>{
        const existing=row.sourceId?existingTasks.find(task=>task.id===row.sourceId):null,
              id=existing?.id||uid("ktu");
        return{
         id,
         rootTaskId:existing?.rootTaskId||row.rootTaskId||id,
         text:row.text,
         companyId:bulkControlDayTaskMode==="edit"?(existing?.companyId||companyId):companyId,
         responsible:row.responsible,
         deadline:row.deadline||"",
         status:row.status,
         note:row.note,
         enteredDate:existing?.enteredDate||row.enteredDate||record.date,
         enteredMeetingNumber:existing?.enteredMeetingNumber||row.enteredMeetingNumber||record.number,
         originNumber:existing?.originNumber||row.originNumber||"",
         originDate:existing?.originDate||row.originDate||"",
         carried:existing?.carried||row.carried||false,
         carriedFromDate:existing?.carriedFromDate||row.carriedFromDate||"",
         carriedFromMeetingNumber:existing?.carriedFromMeetingNumber||row.carriedFromMeetingNumber||""
        }
       });

 if(bulkControlDayTaskMode==="edit"){
  const originalGroupTasks=existingTasks.filter(task=>coordinationTaskGroupKey(task)===bulkControlDayEditingGroupKey),
        keptRoots=new Set(newTasks.map(coordinationTaskRoot)),
        removedRoots=originalGroupTasks.map(coordinationTaskRoot).filter(root=>!keptRoots.has(root));
  record.tasks=[...existingTasks.filter(task=>coordinationTaskGroupKey(task)!==bulkControlDayEditingGroupKey),...newTasks];
  if(removedRoots.length){
   record.dismissedTaskRoots=[...new Set([...(record.dismissedTaskRoots||[]),...removedRoots])];
   state.controlDays
    .filter(item=>item.projectId===record.projectId&&coordinationRecordKind(item)===coordinationRecordKind(record)&&item.date>record.date)
    .forEach(item=>{
     item.tasks=coordinationTasks(item).filter(task=>!removedRoots.includes(coordinationTaskRoot(task)));
     item.dismissedTaskRoots=[...new Set([...(item.dismissedTaskRoots||[]),...removedRoots])];
     item.updatedAt=new Date().toISOString()
    })
  }
 }else record.tasks=[...existingTasks,...newTasks];
 newTasks.forEach(task=>syncFutureCoordinationTask(record,task));
 record.updatedAt=new Date().toISOString();
 $("bulkControlDayTaskModal").classList.add("hidden");
 const savedCompanyName=selectedCompany?.name||coordinationTaskCompanyName(newTasks[0]);
 save(bulkControlDayTaskMode==="edit"
  ?`Firma ${savedCompanyName} bola upravená naraz. Uložilo sa ${newTasks.length} úloh.`
  :`${newTasks.length} úloh bolo pridaných firme ${savedCompanyName}.`);
 renderSiteMeetings();
 requestAnimationFrame(()=>{
  const first=document.querySelector(`[data-coordination-task-row="${newTasks[0].id}"]`);
  if(first)first.scrollIntoView({block:"nearest",behavior:"smooth"})
 })
};


function openControlDayTask(id=""){
 const r=controlDayRecord(),t=id?r.tasks.find(x=>x.id===id):null,isControlDay=selectedCoordinationKind==="controlDay";
 $("controlDayTaskModalTitle").textContent=id?(isControlDay?"Upraviť otázku / bod":"Upraviť úlohu"):(isControlDay?"Pridať otázku / bod na prerokovanie":"Pridať úlohu");$("controlDayTaskId").value=id;
 const modalKicker=$("controlDayTaskModal")?.querySelector(".modal-head p"),textLabel=$("controlDayTaskText")?.closest("label"),companyLabel=$("controlDayTaskCompany")?.closest("label"),responsibleLabel=$("controlDayTaskResponsible")?.closest("label"),noteLabel=$("controlDayTaskNote")?.closest("label");
 if(modalKicker)modalKicker.textContent=isControlDay?"OTÁZKA ALEBO BOD KONTROLNÉHO DŇA":"ÚLOHA Z KOORDINAČNEJ PORADY";
 if(textLabel?.firstChild)textLabel.firstChild.nodeValue=isControlDay?"Otázka / bod na prerokovanie":"Úloha / zápis";
 if(companyLabel){companyLabel.hidden=isControlDay;if(companyLabel.firstChild)companyLabel.firstChild.nodeValue="Firma"}
 if(responsibleLabel?.firstChild)responsibleLabel.firstChild.nodeValue=isControlDay?"Strana / zodpovedná osoba":"Zodpovedná osoba";
 if(noteLabel?.firstChild)noteLabel.firstChild.nodeValue=isControlDay?"Výsledok rokovania / poznámka":"Poznámka";
 $("controlDayTaskText").placeholder=isControlDay?"Čo treba prediskutovať, rozhodnúť alebo potvrdiť s investorom":"Čo bolo dohodnuté alebo čo je potrebné vykonať";
 $("controlDayTaskResponsible").placeholder=isControlDay?"Investor, BETPRES, stavebný dozor, projektant alebo konkrétna osoba":"Firma alebo konkrétna osoba";
 $("controlDayTaskNote").placeholder=isControlDay?"Dohodnuté stanovisko, rozhodnutie alebo ďalší postup":"";
 $("controlDayTaskText").value=t?.text||"";$("controlDayTaskResponsible").value=t?.responsible||"";$("controlDayTaskDeadline").value=t?.deadline||"";
 $("controlDayTaskStatus").value=t?.status||"Bez vyjadrenia";$("controlDayTaskNote").value=t?.note||"";
 $("controlDayTaskCompany").innerHTML=`<option value="">Bez priradenej firmy</option>`+[...state.companies].sort((a,b)=>a.name.localeCompare(b.name,"sk")).map(c=>`<option value="${c.id}" ${c.id===t?.companyId?"selected":""}>${esc(c.name)}</option>`).join("");
 $("controlDayTaskModal").classList.remove("hidden")
}
$("controlDayTaskForm").onsubmit=e=>{
 e.preventDefault();
 const r=controlDayRecord(selectedControlDayDate,true),tasks=coordinationTasks(r),
       editingId=$("controlDayTaskId").value,
       id=editingId||uid("ktu"),
       existing=tasks.find(x=>x.id===id),
       text=$("controlDayTaskText").value.trim();
 if(!text){alert("Zadaj text úlohy.");return}
 const task={
  id,
  rootTaskId:existing?.rootTaskId||id,
  text,
  companyId:selectedCoordinationKind==="controlDay"?"":$("controlDayTaskCompany").value,
  responsible:$("controlDayTaskResponsible").value.trim(),
  deadline:$("controlDayTaskDeadline").value,
  status:$("controlDayTaskStatus").value||"Bez vyjadrenia",
  note:$("controlDayTaskNote").value.trim(),
  enteredDate:existing?.enteredDate||r.date,
  enteredMeetingNumber:existing?.enteredMeetingNumber||r.number,
  originNumber:existing?.originNumber||"",
  originDate:existing?.originDate||"",
  carried:existing?.carried||false,
  carriedFromDate:existing?.carriedFromDate||"",
  carriedFromMeetingNumber:existing?.carriedFromMeetingNumber||""
 };
 if(editingId)r.tasks=tasks.map(x=>x.id===id?task:x);
 else r.tasks=[...tasks,task];
 syncFutureCoordinationTask(r,task);
 r.updatedAt=new Date().toISOString();
 
 $("controlDayTaskModal").classList.add("hidden");
 save(editingId?(selectedCoordinationKind==="controlDay"?"Otázka alebo bod boli upravené.":"Úloha v rozpracovanom zápise bola upravená."):(selectedCoordinationKind==="controlDay"?"Otázka alebo bod boli pridané do kontrolného dňa.":"Úloha bola pridaná do rozpracovaného zápisu."));
 renderSiteMeetings();
 requestAnimationFrame(()=>{
  const row=document.querySelector(`[data-coordination-task-row="${id}"]`);
  if(row){row.classList.add("coord-task-added");row.scrollIntoView({block:"nearest",behavior:"smooth"})}
 })
};


$("addCoordinationAttendee").onclick=()=>openCoordinationAttendee();
function openCoordinationAttendee(id=""){
 const r=controlDayRecord(),a=id?r.attendees.find(x=>x.id===id):null,isControlDay=selectedCoordinationKind==="controlDay",
       companySelect=$("coordinationAttendeeCompany"),companyLabel=companySelect.closest("label"),customInput=$("coordinationAttendeeCustomCompany"),customLabel=customInput.closest("label"),roleInput=$("coordinationAttendeeRole");
 $("coordinationAttendeeTitle").textContent=id?"Upraviť účastníka":"Pridať účastníka";
 $("coordinationAttendeeId").value=id;
 companySelect.innerHTML=`<option value="">${isControlDay?"Bez databázy – zadám stranu ručne":"Bez firmy / vlastný názov"}</option>`+[...state.companies].sort((x,y)=>x.name.localeCompare(y.name,"sk")).map(c=>`<option value="${c.id}" ${c.id===a?.companyId?"selected":""}>${esc(c.name)}</option>`).join("");
 if(companyLabel?.firstChild)companyLabel.firstChild.nodeValue=isControlDay?"Organizácia z databázy (voliteľné)":"Firma zo spoločnej databázy";
 if(customLabel?.firstChild)customLabel.firstChild.nodeValue=isControlDay?"Strana / organizácia":"Vlastný názov firmy";
 customInput.placeholder=isControlDay?"Investor, BETPRES, stavebný dozor alebo projektant":"";
 roleInput.placeholder=isControlDay?"Zástupca investora, stavbyvedúci, stavebný dozor…":"Stavbyvedúci, majster, dozor…";
 $("coordinationAttendeeName").placeholder=isControlDay?"Meno účastníka":"Kontaktná osoba firmy";
 $("coordinationAttendeeName").value=a?.name||"";customInput.value=a?.customCompany||"";roleInput.value=a?.role||"";$("coordinationAttendeeContact").value=a?.contact||"";
 $("coordinationAttendeeModal").classList.remove("hidden")
}
$("coordinationAttendeeCompany").onchange=()=>{const c=company($("coordinationAttendeeCompany").value);if(!c)return;if(!$("coordinationAttendeeName").value)$("coordinationAttendeeName").value=c.contact||"";if(!$("coordinationAttendeeContact").value)$("coordinationAttendeeContact").value=c.phone||c.email||""};
$("coordinationAttendeeForm").onsubmit=e=>{e.preventDefault();const r=controlDayRecord(),id=$("coordinationAttendeeId").value||uid("kat"),companyId=$("coordinationAttendeeCompany").value,custom=$("coordinationAttendeeCustomCompany").value.trim(),name=$("coordinationAttendeeName").value.trim();if(!companyId&&!custom&&!name){alert(selectedCoordinationKind==="controlDay"?"Zadaj meno účastníka alebo stranu, ktorú zastupuje.":"Vyber firmu alebo zadaj meno účastníka.");return}const attendee={id,companyId,customCompany:custom,name,role:$("coordinationAttendeeRole").value.trim(),contact:$("coordinationAttendeeContact").value.trim()};if($("coordinationAttendeeId").value)r.attendees=r.attendees.map(x=>x.id===id?attendee:x);else r.attendees.push(attendee);r.attendees.sort((a,b)=>coordinationAttendeeCompany(a).localeCompare(coordinationAttendeeCompany(b),"sk")||a.name.localeCompare(b.name,"sk"));r.updatedAt=new Date().toISOString();$("coordinationAttendeeModal").classList.add("hidden");save("Prezenčná listina rozpracovaného zápisu bola aktualizovaná.")};

function printSiteMeetingList(){
 const record=controlDayRecord(selectedControlDayDate,false);
 if(!record){alert(`${coordinationKindLabel()} nie je pripravený.`);return}

 const isControlDay=coordinationRecordKind(record)==="controlDay",
       tasks=isControlDay?coordinationTasks(record):groupedCoordinationTasks(coordinationTasks(record)).flatMap(group=>group.tasks),
       project=activeProject(),
       exportTime=new Date(),documentTitle=(isControlDay?"ZÁPIS Z KONTROLNÉHO DŇA":"ZÁPIS Z KOORDINAČNEJ PORADY"),shortLabel=isControlDay?"KD":"KP";

 record.lastExportedAt=exportTime.toISOString();
 record.updatedAt=exportTime.toISOString();
 
 commitDirectState();
 renderSiteMeetings();

 const exportText=formatDateTimeISO(record.lastExportedAt),
       taskWeight=task=>{
        const text=String(task.text||""),
              note=String(task.note||""),
              responsible=String(controlDayTaskResponsible(task)||""),
              originalDate=task.enteredDate||record.date,
              carried=originalDate!==record.date||task.carried,
              textLines=Math.max(1,Math.ceil(text.length/76)),
              noteLines=note?Math.ceil(note.length/52)*.45:0,
              responsibleLines=responsible?Math.max(0,Math.ceil(responsible.length/28)-1)*.25:0,
              carryLine=carried?.55:0;
        return Math.max(1,textLines+noteLines+responsibleLines+carryLine)
       },
       chunks=[];

 /* HOTFIX 5.0.18 – koordinačná porada využíva celú A4: väčšia kapacita strán a prezenčná listina roztiahnutá po spodný okraj.
    HOTFIX 5.0.1 – bezpečnejší zlom strán PDF KP.
    Predchádza tomu, aby sa posledný riadok firmy skryl pod zlomom strany.
    HOTFIX 4.9.6 – písmo v PDF koordinačnej porady min. 10 px.
    Kapacity strán sú upravené konzervatívnejšie, aby sa väčší text nezrezal.
    HOTFIX 4.9.5 – rozloženie PDF KP podľa náhľadu.
    HOTFIX 4.9.4 – číslovanie úloh sa začína od 1 pre každú firmu.
    HOTFIX 4.9.3 – opravuje predčasné odseknutie 1. strany a zobrazenie celého programu. */
 const agendaTextForCapacity=richHtmlToText(coordinationAgendaHtml(record)),
       agendaLineEstimate=Math.max(
        1,
        (agendaTextForCapacity.match(/\n/g)||[]).length+1,
        Math.ceil(agendaTextForCapacity.length/95)
       ),
       firstPageCapacity=Math.max(16.5,24.5-Math.max(0,agendaLineEstimate-8)*.9),
       nextPageCapacity=28.5,
       companyHeaderWeight=isControlDay?0:.85;
 let current=[],used=0,capacity=firstPageCapacity,lastCompanyForChunk="";
 tasks.forEach(task=>{
  const companyName=coordinationTaskCompanyName(task);
  let headerWeight=companyName!==lastCompanyForChunk?companyHeaderWeight:0,
      weight=taskWeight(task)+headerWeight;
  if(current.length&&used+weight>capacity){
   chunks.push(current);
   current=[];used=0;capacity=nextPageCapacity;lastCompanyForChunk="";
   headerWeight=companyHeaderWeight;
   weight=taskWeight(task)+headerWeight
  }
  current.push(task);
  used+=weight;
  lastCompanyForChunk=companyName
 });
 if(current.length||!chunks.length)chunks.push(current);

 const companyTaskCounters=new Map();
 let controlDayTaskCounter=0;
 const taskRows=(chunk)=>{
  let lastCompany="";
  const rows=chunk.map(task=>{
   const companyName=coordinationTaskCompanyName(task),
         companyKey=isControlDay?"control-day":(task.companyId||`custom:${companyName}`),
         groupRow=!isControlDay&&companyName!==lastCompany
          ?`<tr class="kp-company-row"><td colspan="7">FIRMA: ${esc(companyName)}</td></tr>`
          :"",
         originalDate=task.enteredDate||record.date,
         originalMeeting=task.enteredMeetingNumber||record.number||"",
         carried=originalDate!==record.date||task.carried,
         companyTaskNumber=isControlDay?(++controlDayTaskCounter):(companyTaskCounters.get(companyKey)||0)+1;
   companyTaskCounters.set(companyKey,companyTaskNumber);
   lastCompany=companyName;
   return`${groupRow}<tr>
    <td class="n">${companyTaskNumber}</td>
    <td class="task">${esc(task.text||"")}${carried?`<small>Úloha sa prenáša až do splnenia.</small>`:""}</td>
    <td class="kp-original-date"><strong>${esc(fmtDateISO(originalDate))}</strong><small>${esc(originalMeeting)}</small></td>
    <td>${esc(controlDayTaskResponsible(task))}</td>
    <td>${esc(task.deadline?fmtDateISO(task.deadline):"")}</td>
    <td>${esc(task.status||"Bez vyjadrenia")}</td>
    <td>${esc(task.note||"")}</td>
   </tr>`
  }).join("");
  return rows||`<tr><td class="n">1</td><td colspan="6">Bez zapísaných úloh.</td></tr>`
 };

 const meetingPages=chunks.map((chunk,pageIndex)=>{
  const first=pageIndex===0,
        last=pageIndex===chunks.length-1;

  return `<section class="kp-page kp-meeting-page">
   <img class="kp-bg" src="${LETTERHEAD_IMAGE}" alt="">
   <div class="kp-band">
    <span>${esc(record.number||"")}</span>
    <strong>${first?documentTitle:documentTitle+" – POKRAČOVANIE"}</strong>
    <span>${pageIndex+1} / ${chunks.length+1}</span>
   </div>

   <main class="kp-content">
    ${first?`
    <div class="kp-meta">
     <div><span>Stavba</span><b>${esc(project?.name||"")}</b></div>
     <div><span>Číslo ${shortLabel}</span><b>${esc(record.number||"")}</b></div>
     <div><span>Dátum a čas</span><b>${esc(fmtDateISO(record.date))} · ${esc(record.time||"")}</b></div>
     <div><span>Miesto</span><b>${esc(record.place||"")}</b></div>
     <div><span>Viedol</span><b>${esc(record.chairperson||"")}</b></div>
     <div><span>Zápis vyhotovil</span><b>${esc(record.recorder||"")}</b></div>
    </div>

    <div class="kp-section-title">${isControlDay?"Program a témy kontrolného dňa":"Program koordinačnej porady"}</div>
    <div class="kp-rich kp-agenda">${coordinationAgendaHtml(record)||"Bez uvedeného programu."}</div>
    `:`
    <div class="kp-continue-meta">
     <span><b>Stavba:</b> ${esc(project?.name||"")}</span>
     <span><b>Dátum:</b> ${esc(fmtDateISO(record.date))}</span>
     <span><b>${shortLabel}:</b> ${esc(record.number||"")}</span>
    </div>`}

    <div class="kp-section-title">${isControlDay?"Otázky, body na prerokovanie a dohodnuté závery":"Dohodnuté úlohy a body zápisu"}</div>
    <table class="kp-table kp-task-table">
     <thead><tr>
      <th style="width:4%">Č.</th>
      <th style="width:29%">${isControlDay?"Otázka / bod na prerokovanie":"Úloha / zápis"}</th>
      <th style="width:11%">Pôvodne zapísaná</th>
      <th style="width:15%">${isControlDay?"Strana / zodpovedný":"Zodpovedný"}</th>
      <th style="width:11%">Termín</th>
      <th style="width:11%">Stav</th>
      <th>${isControlDay?"Výsledok / poznámka":"Poznámka"}</th>
     </tr></thead>
     <tbody>${taskRows(chunk)}</tbody>
    </table>

    ${last?`
    <div class="kp-section-title">Všeobecné poznámky a záver</div>
    <div class="kp-rich kp-notes">${coordinationNotesHtml(record)||"Bez ďalších poznámok."}</div>
    <div class="kp-meta kp-bottom-meta">
     <div><span>${isControlDay?"Nasledujúci kontrolný deň":"Nasledujúca koordinačná porada"}</span><b>${esc(fmtDateISO(record.nextDate))}</b></div>
     <div><span>Stav zápisu</span><b>${esc(record.status||"")}</b></div>
    </div>`:""}

    <div class="kp-export">PDF vytvorené ${esc(exportText)}</div>
   </main>
  </section>`
 }).join("");

 const attendees=[...(record.attendees||[])];
 while(attendees.length<22)attendees.push(null);

 const attendanceRows=attendees.map((attendee,index)=>`<tr>
  <td>${index+1}</td>
  <td>${esc(attendee?.name||"")}</td>
  <td>${esc(attendee?coordinationAttendeeCompany(attendee):"")}</td>
  <td>${esc(attendee?.role||"")}</td>
  <td>${esc(attendee?.contact||"")}</td>
  <td></td>
 </tr>`).join("");

 const attendancePage=`<section class="kp-page kp-attendance-page">
  <img class="kp-bg" src="${LETTERHEAD_IMAGE}" alt="">
  <div class="kp-band">
   <span>${esc(record.number||"")}</span>
   <strong>PREZENČNÁ LISTINA – ${isControlDay?"KONTROLNÝ DEŇ":"KOORDINAČNÁ PORADA"}</strong>
   <span>${chunks.length+1} / ${chunks.length+1}</span>
  </div>

  <main class="kp-content">
   <div class="kp-meta">
    <div><span>Stavba</span><b>${esc(project?.name||"")}</b></div>
    <div><span>Číslo ${shortLabel}</span><b>${esc(record.number||"")}</b></div>
    <div><span>Dátum</span><b>${esc(fmtDateISO(record.date))}</b></div>
    <div><span>Miesto</span><b>${esc(record.place||"")}</b></div>
   </div>

   <table class="kp-table kp-attendance">
    <thead><tr>
     <th style="width:5%">Č.</th>
     <th style="width:23%">Meno a priezvisko</th>
     <th style="width:22%">${isControlDay?"Strana / organizácia":"Firma"}</th>
     <th style="width:18%">Funkcia</th>
     <th style="width:17%">Kontakt</th>
     <th>Podpis</th>
    </tr></thead>
    <tbody>${attendanceRows}</tbody>
   </table>

   <div class="kp-export">PDF vytvorené ${esc(exportText)}</div>
  </main>
 </section>`;

 const w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač. Povoľ vyskakovacie okná.");return}

 w.document.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8">
 <title>${esc(record.number||coordinationKindLabel(coordinationRecordKind(record)))} – ${esc(project?.name||"")}</title>
 <style>
 @page{size:A4 portrait;margin:0}
 *{box-sizing:border-box}
 html,body{
  margin:0;padding:0;background:#fff;font-family:Arial,sans-serif;color:#111;
  -webkit-print-color-adjust:exact;print-color-adjust:exact
 }
 .kp-page{
  position:relative;width:210mm;height:297mm;overflow:hidden;background:#fff;
  page-break-after:always;break-after:page
 }
 .kp-page:last-child{page-break-after:auto;break-after:auto}
 .kp-bg{
  position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill;z-index:0
 }
 .kp-band{
  position:absolute;z-index:2;top:8mm;left:10mm;right:10mm;height:17mm;
  display:grid;grid-template-columns:1fr 5fr 1fr;align-items:start;
  color:#fff;font-size:10px;text-shadow:0 1px 1px rgba(0,0,0,.25)
 }
 .kp-band strong{
  text-align:center;color:#fff;font-size:14px;line-height:1.08
 }
 .kp-band span:last-child{text-align:right}
 .kp-content{
  position:relative;z-index:2;width:100%;height:297mm;
  padding:33.5mm 10.2mm 11mm;font-size:10px;overflow:hidden
 }
 .kp-attendance-page .kp-content{
  display:flex;flex-direction:column;gap:0
 }
 .kp-meta{
  display:grid;grid-template-columns:1fr 1fr;border:0.25mm solid #465159;
  background:#fff;margin-bottom:2.2mm
 }
 .kp-meta>div{
  min-height:10.2mm;padding:1.0mm 1.55mm;border-bottom:0.25mm solid #91999f
 }
 .kp-meta>div:nth-child(odd){border-right:0.25mm solid #91999f}
 .kp-meta>div:nth-last-child(-n+2){border-bottom:0}
 .kp-meta span{
  display:block;font-size:10px;text-transform:uppercase;color:#536773;margin-bottom:.7mm
 }
 .kp-meta b{font-size:10.5px}
 .kp-continue-meta{
  display:flex;justify-content:space-between;gap:4mm;background:#fff;
  border:0.25mm solid #465159;padding:1.8mm 2.2mm;margin-bottom:2mm
 }
 .kp-section-title{
  background:#e5edf3;border:0.25mm solid #465159;padding:1.05mm 1.45mm;
  font-size:10.5px;font-weight:800;margin-top:1.25mm
 }
 .kp-rich{
  border:0.25mm solid #465159;border-top:0;padding:1.0mm 1.45mm;background:#fff;
  line-height:1.12;overflow:hidden
 }
 .kp-rich p{margin:0 0 .55mm}
 .kp-rich ul,.kp-rich ol{margin:.45mm 0 .45mm 4.2mm;padding:0}
 .kp-rich li{margin:0 0 .25mm}
 .kp-agenda{max-height:none;font-size:10px;line-height:1.12;overflow:visible}
 .kp-notes{max-height:34mm;font-size:10px;line-height:1.12}
 .kp-table{
  width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;
  font-size:10px;page-break-inside:auto;break-inside:auto
 }
 .kp-table thead{display:table-header-group}
 .kp-table tr{page-break-inside:avoid;break-inside:avoid}
 .kp-company-row{page-break-after:avoid;break-after:avoid}
 .kp-table th,.kp-table td{
  border:0.25mm solid #465159;padding:.8mm 1.0mm;vertical-align:top;
  line-height:1.12;overflow-wrap:anywhere
 }
 .kp-table th{background:#e5edf3;font-size:10px;text-align:center}
 .kp-table td.n{text-align:center;font-weight:700}
 .kp-table td.task small{
  display:block;margin-top:.8mm;color:#5d6c76;font-size:10px
 }
 .kp-company-row td{
  background:#173f63!important;color:#fff!important;font-weight:900;
  font-size:10px!important;padding:.75mm 1.05mm!important;
  letter-spacing:.035em
 }
 .kp-original-date strong{
  display:block;font-size:10px;white-space:nowrap;color:#173f63
 }
 .kp-original-date small{
  display:block;margin-top:.5mm;font-size:10px;color:#60717c
 }

 .kp-bottom-meta{margin-top:2mm}
 .kp-attendance{
  flex:1 1 auto;height:auto;min-height:0;margin-bottom:4mm
 }
 .kp-attendance thead{height:7mm}
 .kp-attendance tbody tr{height:auto}
 .kp-attendance td{height:auto;vertical-align:middle}
 .kp-export{
  position:absolute;right:10.2mm;bottom:8.5mm;font-size:10px;color:#5a6d79
 }
 @media print{
  .kp-page{margin:0}
 }
 </style></head><body>
 ${meetingPages}${attendancePage}
 <script>
 window.onload=()=>{
  const images=[...document.images];
  Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
   img.onload=resolve;img.onerror=resolve
  }))).then(()=>setTimeout(()=>window.print(),250))
 };
 <\/script>
 </body></html>`);
 w.document.close()
}
function saveControlDayDocument(){
 const record=controlDayRecord(selectedControlDayDate,true),
       now=new Date().toISOString(),
       wasSaved=Boolean(record.savedToDocuments);

 record.savedToDocuments=true;
 record.lastSavedAt=now;
 record.updatedAt=now;
 saveDocumentVersion(
  "controlDay",
  record,
  wasSaved?"Ručné uloženie aktualizovaného zápisu":"Ručné uloženie zápisu"
 );
 save(wasSaved
  ?"Aktualizovaná verzia zápisu bola uložená do Dokumentov."
  :"Zápis bol uložený do Dokumentov.");
 renderSiteMeetings();
 renderDocuments()
}
$("saveControlDayDocument").onclick=saveControlDayDocument;
$("saveControlDayDocumentBottom").onclick=saveControlDayDocument;
$("printSiteMeetings").onclick=printSiteMeetingList;$("printSiteMeetingsBottom").onclick=printSiteMeetingList;



let excelImportRows=[];
function normalizeHeader(v){return String(v||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ")}
function parseCsv(text){const rows=[];let row=[],cell="",quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++}else quoted=!quoted}else if((ch===';'||ch===',')&&!quoted){row.push(cell);cell=""}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);if(row.some(v=>String(v).trim()!==""))rows.push(row);row=[];cell=""}else cell+=ch}row.push(cell);if(row.some(v=>String(v).trim()!==""))rows.push(row);return rows}
function colIndex(ref){const letters=String(ref).match(/[A-Z]+/)?.[0]||"A";let n=0;for(const ch of letters)n=n*26+(ch.charCodeAt(0)-64);return n-1}
async function parseXlsx(file){const zip=await JSZip.loadAsync(file),shared=[];const sharedFile=zip.file("xl/sharedStrings.xml");if(sharedFile){const doc=new DOMParser().parseFromString(await sharedFile.async("text"),"application/xml");doc.querySelectorAll("si").forEach(si=>shared.push([...si.querySelectorAll("t")].map(t=>t.textContent).join("")))}let sheetFile=zip.file("xl/worksheets/sheet1.xml");if(!sheetFile){const names=Object.keys(zip.files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();sheetFile=zip.file(names[0])}if(!sheetFile)throw new Error("V Exceli sa nenašiel pracovný hárok.");const doc=new DOMParser().parseFromString(await sheetFile.async("text"),"application/xml"),rows=[];doc.querySelectorAll("sheetData > row").forEach(r=>{const arr=[];r.querySelectorAll("c").forEach(c=>{const idx=colIndex(c.getAttribute("r")),type=c.getAttribute("t"),v=c.querySelector("v")?.textContent??"",inline=[...c.querySelectorAll("is t")].map(t=>t.textContent).join("");arr[idx]=type==="s"?shared[Number(v)]??"":type==="inlineStr"?inline:v});rows.push(arr.map(v=>v??""))});return rows}
function rowsToObjects(rows){if(!rows.length)return[];const headers=rows[0].map(v=>String(v||"").trim());return rows.slice(1).filter(r=>r.some(v=>String(v||"").trim()!=="")).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??""])))}
function headerValue(obj,names){const map=Object.fromEntries(Object.entries(obj).map(([k,v])=>[normalizeHeader(k),v]));for(const n of names){const v=map[normalizeHeader(n)];if(v!==undefined)return String(v).trim()}return""}
function renderExcelPreview(){if(!$("excelImportPreview"))return;const rows=excelImportRows.slice(0,20),table=$("excelImportPreview");$("excelImportCount").textContent=`${excelImportRows.length} riadkov`;if(!rows.length){table.innerHTML=`<tbody><tr><td style="padding:30px;text-align:center;color:#789">Bez údajov.</td></tr></tbody>`;return}const headers=[...new Set(rows.flatMap(r=>Object.keys(r)))];table.innerHTML=`<thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${headers.map(h=>`<td>${esc(r[h]??"")}</td>`).join("")}</tr>`).join("")}</tbody>`}
$("excelImportTarget").onchange=()=>{$("excelImportMonthWrap").style.display=$("excelImportTarget").value==="workers"?"grid":"none"};$("excelImportMonth").value=todayMonthValue();$("excelImportTarget").dispatchEvent(new Event("change"));
$("readExcelImport").onclick=async()=>{const file=$("excelImportFile").files[0],status=$("excelImportStatus");if(!file){status.className="import-status error";status.textContent="Vyber súbor.";return}try{status.className="import-status";status.textContent="Načítavam súbor…";const rows=file.name.toLowerCase().endsWith(".csv")?parseCsv(await file.text()):await parseXlsx(file);excelImportRows=rowsToObjects(rows);renderExcelPreview();$("executeExcelImport").disabled=!excelImportRows.length;status.className="import-status success";status.textContent=`Načítaných ${excelImportRows.length} riadkov. Skontroluj náhľad a spusti import.`}catch(err){excelImportRows=[];renderExcelPreview();$("executeExcelImport").disabled=true;status.className="import-status error";status.textContent=`Súbor sa nepodarilo načítať: ${err.message}`}};
$("executeExcelImport").onclick=()=>{if(!excelImportRows.length)return;const target=$("excelImportTarget").value,status=$("excelImportStatus");let added=0,updated=0,skipped=0;if(target==="companies"){for(const r of excelImportRows){const name=headerValue(r,["Firma","Názov firmy"]);if(!name){skipped++;continue}const ico=headerValue(r,["IČO","ICO"]),existing=state.companies.find(c=>(ico&&String(c.ico).replace(/\s/g,"")===ico.replace(/\s/g,""))||c.name.toLowerCase()===name.toLowerCase());const data={name,address:headerValue(r,["Adresa"]),postalCity:headerValue(r,["PSČ","PSČ a mesto","PSC"]),ico,dic:headerValue(r,["DIČ","DIC"]),icdph:headerValue(r,["IČ DPH","IC DPH"]),contact:headerValue(r,["Kontakt","Kontaktná osoba"]),phone:headerValue(r,["Telefón","Telefon"]),scope:headerValue(r,["Predmet činnosti"])};let c=existing;if(existing){Object.assign(existing,data);updated++}else{c={id:uid("c"),...data};state.companies.push(c);added++}const contract=headerValue(r,["Zmluva","Číslo zmluvy"]);if(contract&&c&&!assignment(state.selectedProjectId,c.id))state.assignments.push({id:uid("a"),projectId:state.selectedProjectId,companyId:c.id,contractType:(headerValue(r,["Typ dokladu","Typ zmluvy","ZoD/Obj"]).toLowerCase().includes("obj")?"Obj":"ZoD"),contractNo:contract,scope:headerValue(r,["Predmet činnosti na stavbe","Predmet činnosti"])})}}if(target==="billing"){for(const r of excelImportRows){const name=headerValue(r,["Firma","Názov firmy"]),c=state.companies.find(c=>c.name.toLowerCase()===name.toLowerCase()),month=headerValue(r,["Mesiac","Obdobie"]),amount=Number(headerValue(r,["Suma","Suma bez DPH","Fakturácia"]).replace(/\s/g,"").replace(",","."));if(!c||!month||!Number.isFinite(amount)){skipped++;continue}let normalized=/^\d{4}-\d{2}$/.test(month)?month:"";if(!normalized){const m=month.match(/(\d{1,2})[.\/-](\d{4})/);if(m)normalized=`${m[2]}-${String(Number(m[1])).padStart(2,"0")}`}if(!normalized){skipped++;continue}state.billings.push({id:uid("b"),projectId:state.selectedProjectId,companyId:c.id,month:normalized,amount});added++}}if(target==="purchases"){skipped+=excelImportRows.length}if(target==="workers"){const month=$("excelImportMonth").value||todayMonthValue(),sheet=workerSheet(month,true);for(const r of excelImportRows){const name=headerValue(r,["Firma","Firma / skupina","Názov"]);if(!name){skipped++;continue}let row=sheet.rows.find(x=>workerRowLabel(x).toLowerCase()===name.toLowerCase());if(!row){row={id:uid("wr"),name,alias:name,companyId:"",actualName:"",values:{}};sheet.rows.push(row);added++}else updated++;for(let d=1;d<=31;d++){const val=headerValue(r,[String(d),`${d}.`,`Deň ${d}`]);if(val!=="")row.values[d]=Number(val)||0}}sortWorkerRows(sheet)}save(`Import dokončený: ${added} pridaných, ${updated} aktualizovaných, ${skipped} preskočených.`);status.className="import-status success";status.textContent=`Import dokončený. Pridané: ${added}, aktualizované: ${updated}, preskočené: ${skipped}.`};

const executeExcelImportDefault=$("executeExcelImport").onclick;
$("executeExcelImport").onclick=()=>{
 if($("excelImportTarget").value!=="purchases")return executeExcelImportDefault();
 if(!excelImportRows.length)return;
 let added=0,skipped=0,next=Number(deliveryNoteNextSequence());
 excelImportRows.forEach(row=>{
  const date=parseExcelDate(headerValue(row,["Dátum","Datum","Dátum dodania"])),supplier=headerValue(row,["Dodávateľ","Dodavatel","Firma"]),documentNo=headerValue(row,["Číslo dokladu","Číslo dodacieho listu","Dodací list"]),invoiceNo=headerValue(row,["Faktúra číslo","Číslo faktúry","Faktúra"]),material=headerValue(row,["Názov materiálu","Materiál","Material"]),estimatedPrice=headerValue(row,["Orientačná cena","Cena","Suma"]),sequence=headerValue(row,["P. č.","PČ","Č."])||String(next++);
  if(!date&&!supplier&&!documentNo&&!material){skipped++;return}
  state.purchases.push({id:uid("pd"),projectId:state.selectedProjectId,date:date||todayISO(),supplier,documentNo,invoiceNo,material,estimatedPrice,sequence,source:"Import Excel",createdAt:new Date().toISOString()});added++
 });
 save(`Import pasportu dokončený: ${added} dodacích listov pridaných, ${skipped} preskočených.`);$("excelImportStatus").className="import-status success";$("excelImportStatus").textContent=`Pasport skladu: pridané ${added}, preskočené ${skipped}.`
};

function renderQuickEntry(){if(!$("quickWorkersList"))return;const today=todayISO(),month=today.slice(0,7),day=Number(today.slice(8,10));$("quickDateLabel").textContent=fmtDateISO(today);const sheet=workerSheet(month,true);sortWorkerRows(sheet);$("quickWorkersList").innerHTML=sheet.rows.map(r=>`<div class="quick-worker-row"><strong>${esc(workerRowLabel(r))}</strong><input type="number" min="0" inputmode="numeric" data-quick-worker="${r.id}" value="${esc(r.values?.[day]??"")}"></div>`).join("")||`<div style="color:#789;padding:12px 0">Najprv pridaj firmy alebo skupiny v module Stav pracovníkov.</div>`;document.querySelectorAll("[data-quick-worker]").forEach(inp=>{inp.onfocus=()=>beginDirectUndo("Rýchla úprava pracovníkov");inp.oninput=()=>{const row=sheet.rows.find(r=>r.id===inp.dataset.quickWorker);if(!row)return;row.values=row.values||{};if(inp.value==="")delete row.values[day];else row.values[day]=Number(inp.value);commitDirectState();renderDashboard()};inp.onblur=endDirectUndo})}
if($("quickPurchaseForm"))$("quickPurchaseForm").onsubmit=e=>{e.preventDefault();alert("Evidencia materiálu bola z aplikácie odstránená.")};
$("quickTaskForm").onsubmit=e=>{e.preventDefault();const previousKind=selectedCoordinationKind;selectedCoordinationKind="coordination";const date=nextTuesdayISO(todayISO()),r=controlDayRecord(date,true);selectedCoordinationKind=previousKind;r.tasks.push({id:uid("ktu"),text:$("quickTaskText").value.trim(),companyId:"",responsible:$("quickTaskResponsible").value.trim(),deadline:$("quickTaskDeadline").value,status:"Bez vyjadrenia",note:"",enteredDate:r.date,enteredMeetingNumber:r.number,originNumber:"",originDate:""});r.updatedAt=new Date().toISOString();e.target.reset();save("Úloha bola pridaná do najbližšej koordinačnej porady.")};

function calendarEventClass(type){return type==="Koordinačná porada"||type==="Kontrolný deň"?"type-coordination":"type-meeting"}
function normalizeCalendarColor(value,fallback="#2563eb"){
 const color=String(value||"").trim();
 return /^#[0-9a-f]{6}$/i.test(color)?color:fallback
}
function calendarTextColor(color){
 const value=normalizeCalendarColor(color).slice(1),
       r=parseInt(value.slice(0,2),16),
       g=parseInt(value.slice(2,4),16),
       b=parseInt(value.slice(4,6),16),
       luminance=(0.299*r+0.587*g+0.114*b);
 return luminance>165?"#10283a":"#ffffff"
}
function updateCalendarColorPreview(){
 if(!$("calendarEventColor")||!$("calendarEventColorPreview"))return;
 const color=normalizeCalendarColor($("calendarEventColor").value);
 $("calendarEventColorPreview").style.background=color;
 $("calendarEventColorPreview").style.color=calendarTextColor(color)
}
function calendarStoredEvents(){return state.calendarEvents.filter(x=>x.projectId===state.selectedProjectId)}
function calendarDerivedEvents(){return state.controlDays.filter(x=>x.projectId===state.selectedProjectId).map(x=>{const label=coordinationKindLabel(coordinationRecordKind(x));return{id:`derived:${x.id}`,date:x.date,title:x.number||label,type:label,start:x.time||"",color:coordinationRecordKind(x)==="controlDay"?"#14805e":"#2563eb",derived:true,recordId:x.id}})}
function renderCalendar(){
 if(!$("calendarGrid"))return;
 $("calendarMonth").value=selectedCalendarMonth;
 const [y,m]=selectedCalendarMonth.split("-").map(Number),
       first=new Date(y,m-1,1),
       offset=(first.getDay()+6)%7,
       events=[...calendarStoredEvents(),...calendarDerivedEvents()];
 let calendarHtml="";
 for(let i=0;i<42;i++){
  const d=new Date(y,m-1,1-offset+i),
        key=localDateISO(d),
        outside=d.getMonth()!==m-1,
        today=key===todayISO(),
        dayEvents=events.filter(e=>e.date===key).sort((a,b)=>(a.start||"").localeCompare(b.start||""));
  calendarHtml+=`<div class="calendar-day ${outside?"outside":""} ${today?"today":""}" data-calendar-date="${key}" title="Kliknutím pridáš udalosť">
   <div class="calendar-day-number">${d.getDate()}</div>
   ${dayEvents.map(e=>{
    const eventColor=normalizeCalendarColor(e.color,e.derived?"#2563eb":"#176aa5"),
          eventText=calendarTextColor(eventColor);
    return `<button class="calendar-event-chip ${calendarEventClass(e.type)} ${e.derived?"derived":""}" data-calendar-id="${e.id}" style="background:${eventColor};color:${eventText}">
     ${esc(e.start?e.start+" ":"")}${esc(e.title)}
     ${!e.derived&&e.companyId?`<small>${esc(company(e.companyId)?.name||"")}</small>`:""}
    </button>`
   }).join("")}
  </div>`
 }
 $("calendarGrid").innerHTML=calendarHtml;

 document.querySelectorAll("[data-calendar-date]").forEach(day=>{
  day.onclick=event=>{
   if(event.target.closest("[data-calendar-id]"))return;
   openCalendarEvent("",day.dataset.calendarDate)
  }
 });

 document.querySelectorAll("[data-calendar-id]").forEach(button=>{
  button.onclick=event=>{
   event.stopPropagation();
   const id=button.dataset.calendarId;
   if(id.startsWith("derived:")){
    const record=state.controlDays.find(x=>x.id===id.slice(8));
    if(record){selectedControlDayDate=record.date;showView(coordinationRecordKind(record)==="controlDay"?"controlDays":"siteMeetings")}
   }else openCalendarEvent(id)
  }
 })
}
function openCalendarEvent(id="",date=""){
 const event=id?state.calendarEvents.find(x=>x.id===id):null;
 $("calendarEventModalTitle").textContent=event?"Upraviť udalosť":"Nová udalosť";
 $("calendarEventId").value=event?.id||"";
 $("calendarEventDate").value=event?.date||date||todayISO();
 $("calendarEventTitle").value=event?.title||"";
 $("calendarEventStart").value=event?.start||"";
 $("calendarEventNote").value=event?.note||"";
 $("calendarEventColor").value=normalizeCalendarColor(event?.color,"#2563eb");
 $("calendarEventCompany").innerHTML=`<option value="">Bez firmy</option>`+[...state.companies].sort((a,b)=>a.name.localeCompare(b.name,"sk")).map(c=>`<option value="${c.id}" ${c.id===event?.companyId?"selected":""}>${esc(c.name)}</option>`).join("");
 $("deleteCalendarEvent").classList.toggle("hidden",!event);
 $("calendarEventModal").classList.remove("hidden");
 updateCalendarColorPreview();
 setTimeout(()=>$("calendarEventTitle").focus(),50)
}
$("calendarPrev").onclick=()=>{selectedCalendarMonth=shiftMonth(selectedCalendarMonth,-1);renderCalendar()};
$("calendarNext").onclick=()=>{selectedCalendarMonth=shiftMonth(selectedCalendarMonth,1);renderCalendar()};
$("calendarToday").onclick=()=>{selectedCalendarMonth=todayMonthValue();renderCalendar()};
$("calendarMonth").onchange=()=>{selectedCalendarMonth=$("calendarMonth").value||todayMonthValue();renderCalendar()};
$("calendarEventColor").oninput=updateCalendarColorPreview;
$("calendarEventForm").onsubmit=event=>{
 event.preventDefault();
 const id=$("calendarEventId").value||uid("cal"),
       existing=state.calendarEvents.find(x=>x.id===id),
       record={
        id,
        projectId:state.selectedProjectId,
        title:$("calendarEventTitle").value.trim(),
        type:existing?.type||"Iné",
        date:$("calendarEventDate").value,
        start:$("calendarEventStart").value,
        end:existing?.end||"",
        companyId:$("calendarEventCompany").value,
        location:existing?.location||"",
        color:normalizeCalendarColor($("calendarEventColor").value,"#2563eb"),
        note:$("calendarEventNote").value.trim(),
        updatedAt:new Date().toISOString()
       };
 if($("calendarEventId").value)state.calendarEvents=state.calendarEvents.map(x=>x.id===id?record:x);
 else state.calendarEvents.push(record);
 $("calendarEventModal").classList.add("hidden");
 selectedCalendarMonth=record.date.slice(0,7);
 save("Kalendár bol aktualizovaný.")
};
$("deleteCalendarEvent").onclick=()=>{
 const id=$("calendarEventId").value;
 if(!id||!confirm("Vymazať túto udalosť?"))return;
 state.calendarEvents=state.calendarEvents.filter(x=>x.id!==id);
 $("calendarEventModal").classList.add("hidden");
 save("Udalosť bola vymazaná.")
};

function renderDocuments(){const handovers=[...state.handovers].map(x=>({...x,docKind:"handover"}));const protocols=[...state.acceptanceProtocols].map(x=>({...x,docKind:"acceptance",contractNo:assignment(x.projectId,x.companyId)?.contractNo||"",type:"Preberací protokol",content:true}));const controlDays=state.controlDays.filter(x=>x.savedToDocuments).map(x=>({...x,docKind:"controlDay",companyId:"",contractNo:"",type:"Zápis z koordinačnej porady"}));const rows=[...handovers,...protocols,...controlDays].sort((a,b)=>(b.updatedAt||b.date).localeCompare(a.updatedAt||a.date));$("documentsTable").innerHTML=rows.map(h=>`<tr><td>${esc(fmtDateISO(h.date))}</td><td>${esc(project(h.projectId)?.name||"")}</td><td><strong>${esc(h.docKind==="controlDay"?(h.number||"Koordinačná porada"):(company(h.companyId)?.name||""))}</strong></td><td>${esc(h.contractNo||"")}</td><td>${esc(h.type)}</td><td>${documentVersions(h.docKind,h.id).length} verzií</td><td><div class="row-actions"><button data-open-doc="${h.docKind}:${h.id}">Otvoriť</button><button class="ghost" data-history-doc="${h.docKind}:${h.id}">História</button><button class="danger" data-delete-doc="${h.docKind}:${h.id}">Vymazať</button></div></td></tr>`).join("")||`<tr><td colspan="7" style="text-align:center;padding:30px;color:#789">Zatiaľ nie sú uložené žiadne dokumenty.</td></tr>`;document.querySelectorAll("[data-history-doc]").forEach(b=>b.onclick=()=>{const [kind,id]=b.dataset.historyDoc.split(":");openHistory(kind,id)});document.querySelectorAll("[data-open-doc]").forEach(b=>b.onclick=()=>{const [kind,id]=b.dataset.openDoc.split(":");if(kind==="controlDay"){const r=state.controlDays.find(x=>x.id===id);if(!r)return;state.selectedProjectId=r.projectId;selectedControlDayDate=r.date;showView("siteMeetings");return}if(kind==="acceptance"){state.selectedProjectId=state.acceptanceProtocols.find(x=>x.id===id)?.projectId||state.selectedProjectId;showView("acceptance");openAcceptance(id);return}const h=state.handovers.find(x=>x.id===id);if(!h)return;state.selectedProjectId=h.projectId;showView("handover");$("handoverProject").value=h.projectId;renderHandoverCompanies(h.companyId);$("handoverCompany").value=h.companyId;handoverDraft=h.content?clone(h.content):defaultHandoverDraft(h.projectId,h.companyId);handoverDraft.date=h.date;handoverDraft.entryDate=h.entryDate;handoverDraft.contract=h.contractNo;handoverDraftKey=`${h.projectId}|${h.companyId}`;editingHandoverId=h.id;$("handoverDate").value=h.date;$("entryDate").value=h.entryDate;renderHandover()});document.querySelectorAll("[data-delete-doc]").forEach(b=>b.onclick=()=>{const [kind,id]=b.dataset.deleteDoc.split(":");if(!confirm("Vymazať tento dokument z archívu?"))return;if(kind==="controlDay")state.controlDays=state.controlDays.filter(x=>x.id!==id);else if(kind==="acceptance")state.acceptanceProtocols=state.acceptanceProtocols.filter(x=>x.id!==id);else state.handovers=state.handovers.filter(x=>x.id!==id);save("Dokument bol vymazaný.")})}
$("exportJson").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`betpres-evidencia-${todayISO()}.json`;a.click();URL.revokeObjectURL(url)};$("importJson").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save("Záloha bola importovaná.")}catch{alert("Neplatná záloha.")}};r.readAsText(f)};$("restoreAutoBackup").onclick=()=>{const backup=localStorage.getItem(AUTO_BACKUP_KEY);if(!backup){alert("Automatická záloha zatiaľ neexistuje.");return}if(!confirm("Obnoviť poslednú automatickú zálohu? Aktuálne údaje sa nahradia."))return;try{state=JSON.parse(backup);const current=JSON.stringify(state);localStorage.setItem(KEY,current);lastCommittedState=current;renderAll();toast("Automatická záloha bola obnovená.")}catch{alert("Automatická záloha je poškodená.")}};
$("resetData").onclick=()=>{if(confirm("Obnoviť demo údaje? Aktuálne údaje sa vymažú.")){state=clone(seed);save("Demo údaje boli obnovené.")}};

function creditNumber(v){const m=String(v||"").replace(/\s/g,"").replace("€","").replace(",",".").match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):0}
function purchaseMonths(){return [...new Set(state.purchases.filter(x=>x.projectId===state.selectedProjectId).map(x=>x.date.slice(0,7)))].sort().reverse()}
function excelDate(v){if(!v)return"";const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return v;return `${Number(m[3])}.${Number(m[2])}.${String(m[1]).slice(2)}`}
function parseExcelDate(v){const x=String(v||"").trim();if(!x)return"";if(/^\d{4}-\d{2}-\d{2}$/.test(x))return x;const m=x.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);if(!m)return x;let y=Number(m[3]);if(y<100)y+=2000;return `${y}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[1])).padStart(2,"0")}`}
function purchaseColumns(){return [["date","A"],["supplier","B"],["documentNo","C"],["invoiceNo","D"],["material","E"],["estimatedPrice","F"],["sequence","G"]]}
function purchaseMonths(){return [...new Set(state.purchases.map(x=>String(x.date||"").slice(0,7)).filter(x=>/^\d{4}-\d{2}$/.test(x)))].sort().reverse()}
function purchaseRows(){
 const q=$("purchaseSearch")?.value.trim().toLowerCase()||"",month=$("purchaseMonthFilter")?.value||"",
       supplier=$("purchaseSupplierFilter")?.value||"",material=$("purchaseMaterialSearch")?.value.trim().toLowerCase()||"";
 return state.purchases.filter(x=>x.projectId===state.selectedProjectId&&(!month||String(x.date).startsWith(month))&&(!supplier||String(x.supplier||"")===supplier)&&(!material||`${x.material||""} ${x.materialCategory||""} ${x.quantitySummary||""}`.toLowerCase().includes(material))&&`${x.date} ${x.supplier} ${x.documentNo} ${x.invoiceNo} ${x.material} ${x.materialCategory||""} ${x.quantitySummary||""} ${x.estimatedPrice||x.credit||""} ${x.sequence}`.toLowerCase().includes(q)).sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0))
}

function ensureWorkBudgetState(){
 if(!Array.isArray(state.workBudgets))state.workBudgets=[];
 state.workBudgets.forEach(b=>{if(!Array.isArray(b.items))b.items=[]})
}
function workBudgetDocLabel(type="ZoD",number=""){
 const t=String(type||"ZoD").trim();
 const n=String(number||"").trim();
 if(t.toLowerCase().includes("dodat"))return n?`Dodatok č. ${n}`:"Dodatok";
 return "ZoD"
}
function workBudgetDocClass(label){return /dodat/i.test(String(label||""))?"addendum":""}
function workBudgetList(companyId=selectedWorkCompanyId){
 ensureWorkBudgetState();
 return state.workBudgets.filter(b=>b.projectId===state.selectedProjectId&&b.companyId===companyId).sort((a,b)=>{
  const ao=/^ZoD$/i.test(a.label||"")?"000":String(a.label||"");
  const bo=/^ZoD$/i.test(b.label||"")?"000":String(b.label||"");
  return ao.localeCompare(bo,"sk",{numeric:true})
 })
}
function workBudgetOptions(companyId=selectedWorkCompanyId){
 const docs=new Map();
 const companyAssignment=assignment(state.selectedProjectId,companyId);
 docs.set(workDocumentId("ZoD"),{id:workDocumentId("ZoD"),label:"ZoD",title:companyAssignment?.contractNo||""});
 assignmentAddenda(companyAssignment).forEach(addendum=>{
  const label=assignmentAddendumLabel(addendum),price=parseWorkNumber(addendum.price||0),title=[addendum.name,price?`${eur.format(price)} bez DPH`:""].filter(Boolean).join(" · ");
  docs.set(`assignment-addendum:${addendum.id}`,{id:`assignment-addendum:${addendum.id}`,label,title})
 });
 workBudgetList(companyId).forEach(b=>{const label=b.label||"Rozpočet",id=canonicalWorkDocumentId(companyId,label,b.id);docs.set(id,{id,label,title:b.title||""})});
 const statement=state.workStatements?.find(x=>x.projectId===state.selectedProjectId&&x.companyId===companyId&&x.period===selectedWorkPeriod);
 ensureWorkStatementDocuments(statement);
 (statement?.items||[]).forEach(item=>{
  const id=workItemSourceId(item),label=workItemSourceLabel(item);
  if(id&&label&&!docs.has(id))docs.set(id,{id,label,title:""})
 });
 const labels=[...docs.values()].sort((a,b)=>{
  const ao=/^ZoD$/i.test(a.label||"")?"000":String(a.label||"");
  const bo=/^ZoD$/i.test(b.label||"")?"000":String(b.label||"");
  return ao.localeCompare(bo,"sk",{numeric:true})
 });
 return labels.map(b=>`<option value="${esc(b.id)}">${esc(b.label||"Doklad")}${b.title?` – ${esc(b.title)}`:""}</option>`).join("")
}
function workItemSourceLabel(item){return item.sourceDocLabel||item.budgetDocLabel||""}
function workItemSourceId(item){return item.sourceDocId||item.budgetDocId||""}
function workDocumentId(label="ZoD"){
 return `manual:${String(label||"ZoD").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"zod"}`
}
function normalizeWorkDocumentLabel(value,defaultToAddendum=false){
 const raw=String(value||"").trim();
 if(!raw)return defaultToAddendum?"":"ZoD";
 if(/^zod$/i.test(raw)||/zmluv/i.test(raw))return"ZoD";
 const number=raw.replace(/^dodatok\s*(?:č\.?|cislo|číslo)?\s*/i,"").trim();
 return number?`Dodatok č. ${number}`:(defaultToAddendum?"":"ZoD")
}
function canonicalWorkDocumentId(companyId,label,preferredId=""){
 const normalized=normalizeWorkDocumentLabel(label)||"ZoD";
 if(/^ZoD$/i.test(normalized))return workDocumentId("ZoD");
 const number=normalized.replace(/^Dodatok\s*č\.\s*/i,"").trim().toLowerCase(),known=assignmentAddenda(assignment(state.selectedProjectId,companyId)).find(addendum=>String(addendum.number||"").trim().toLowerCase()===number);
 return known?`assignment-addendum:${known.id}`:(preferredId||workDocumentId(normalized))
}
function selectedWorkDocument(){
 const id=selectedWorkDocFilter||workDocumentId("ZoD"),companyId=selectedWorkCompanyId,companyAssignment=assignment(state.selectedProjectId,companyId);
 if(id===workDocumentId("ZoD"))return{id,label:"ZoD"};
 if(id.startsWith("assignment-addendum:")){
  const addendum=assignmentAddenda(companyAssignment).find(item=>`assignment-addendum:${item.id}`===id);
  if(addendum)return{id,label:assignmentAddendumLabel(addendum)}
 }
 const budget=workBudgetList(companyId).find(item=>canonicalWorkDocumentId(companyId,item.label||"",item.id)===id);
 if(budget)return{id,label:budget.label||workBudgetDocLabel(budget.docType,budget.docNumber)};
 const statement=getWorkStatement(false),item=statement?.items?.find(row=>workItemSourceId(row)===id);
 return{id,label:workItemSourceLabel(item)||"ZoD"}
}
function ensureWorkStatementDocuments(statement){
 (statement?.items||[]).forEach(item=>{
  if(isWorkDocSectionItem(item))return;
  if(!workItemSourceLabel(item))item.sourceDocLabel="ZoD";
  item.sourceDocId=canonicalWorkDocumentId(statement.companyId,workItemSourceLabel(item),workItemSourceId(item))
 });
 return statement
}
function setWorkItemDocument(item,label,sourceDocId=""){
 const normalized=normalizeWorkDocumentLabel(label)||"ZoD";
 item.sourceDocLabel=normalized;
 item.sourceDocId=sourceDocId||workDocumentId(normalized)
}
function isWorkDocSectionItem(item){return String(item?.type||"").toUpperCase()==="D"&&/^DOKLAD:/i.test(String(item?.description||"").trim())}
function workSectionForDoc(sourceDocId,label){
 return{id:uid("wi"),budgetItemId:`section:${sourceDocId||label}:${uid("s")}`,sourceDocId:sourceDocId||"",sourceDocLabel:label||"",pc:"",type:"D",code:"",description:`DOKLAD: ${label||"Rozpočet"}`,unit:"",contractQty:"",unitPrice:"",contractTotal:"",currentQty:""}
}
function addBudgetItemsToStatement(statement,budget,{replace=false}={}){
 if(!statement||!budget)return 0;
 const label=budget.label||workBudgetDocLabel(budget.docType,budget.docNumber),docId=canonicalWorkDocumentId(statement.companyId,label,budget.id);
 if(replace)statement.items=statement.items.filter(x=>workItemSourceId(x)!==docId);
 let added=0;
 (budget.items||[]).forEach(src=>{
  const exists=statement.items.some(x=>x.budgetItemId===src.id||(
   workItemSourceId(x)===docId&&String(x.pc||"").trim()===String(src.pc||"").trim()&&String(x.code||"").trim()===String(src.code||"").trim()&&String(x.description||"").trim()===String(src.description||"").trim()
  ));
  if(exists)return;
  statement.items.push({id:uid("wi"),budgetItemId:src.id,sourceDocId:docId,sourceDocLabel:label,pc:src.pc||"",type:src.type||"K",code:src.code||"",description:src.description||"",unit:src.unit||"",contractQty:src.contractQty||"",unitPrice:src.unitPrice||"",contractTotal:src.contractTotal||"",currentQty:""});
  added++
 });
 statement.status="draft";statement.updatedAt=new Date().toISOString();
 return added
}
function addManualRowsToStatement(statement,rows,label,preferredDocId=""){
 if(!statement)return 0;
 const docId=canonicalWorkDocumentId(statement.companyId,label||"ZoD",preferredDocId);
 rows.forEach(cols=>{
  const item=createBlankWorkItem();
  item.sourceDocId=docId;item.sourceDocLabel=label||"";
  cols.forEach((v,i)=>{if(workPasteFields[i])item[workPasteFields[i]]=v});
  statement.items.push(item)
 });
 statement.status="draft";statement.updatedAt=new Date().toISOString();
 return rows.length
}
function budgetHeaderAliases(){return{
 pc:["p. č.","pč","por. č.","poradie","poradové číslo","č.","c.","pol.","polozka c","položka č"],
 type:["typ","druh","t","k/d"],
 code:["kód položky","kod polozky","kód","kod","kód ceny","kod ceny","položka","polozka","cenová sústava","cenník"],
 description:["popis položky","popis polozky","popis","názov položky","nazov polozky","názov","nazov","text","popis prác","popis prac","popis dodávky","dodávka","položka text"],
 unit:["mj","m.j.","merná jednotka","merna jednotka","jednotka","m.j"],
 contractQty:["množstvo","mnozstvo","výmera","vymera","výkaz výmer","vykaz vymer","zmluvné množstvo","zmluvne mnozstvo","množstvo celkom","mnozstvo celkom","výmera celkom"],
 unitPrice:["j. cena","jc","j.cena","jednotková cena","jednotkova cena","cena/mj","cena za mj","j. cena [eur]","jedn. cena","j.cena eur"],
 contractTotal:["cena celkom","celkom","suma","cena spolu","cena","cena celkom [eur]","celkom eur","spolu bez dph","bez dph"]
}}
function budgetFieldLabels(){return{pc:"P. č.",type:"Typ",code:"Kód položky",description:"Popis položky",unit:"MJ",contractQty:"Množstvo",unitPrice:"J. cena",contractTotal:"Cena celkom"}}
function columnLetters(index){let n=Number(index)+1,out="";while(n>0){const r=(n-1)%26;out=String.fromCharCode(65+r)+out;n=Math.floor((n-1)/26)}return out||"A"}
function budgetRawColumnCount(rows){return Math.max(0,...(rows||[]).slice(0,80).map(r=>(r||[]).length))}
function budgetHeaderText(row,index){const raw=String((row||[])[index]??"").trim();return raw||`Stĺpec ${columnLetters(index)}`}
function budgetColumnOptions(selected=""){
 const headerIndex=Number.parseInt($("budgetImportHeaderRow")?.value||"1",10)-1,
       header=budgetImportRowsRaw[headerIndex]||[],
       count=budgetRawColumnCount(budgetImportRowsRaw),
       opts=[`<option value="">— nepoužiť —</option>`];
 for(let i=0;i<count;i++)opts.push(`<option value="${i}" ${String(selected)===String(i)?"selected":""}>${columnLetters(i)} – ${esc(budgetHeaderText(header,i))}</option>`);
 return opts.join("")
}
function detectBudgetHeaderRow(rows){
 const aliases=budgetHeaderAliases(),wanted=Object.values(aliases).flat().map(normalizeHeader);
 let best={index:0,score:0};
 rows.slice(0,80).forEach((row,index)=>{
  const cells=(row||[]).map(normalizeHeader);
  let score=0;
  cells.forEach(c=>{if(!c)return;if(wanted.includes(c))score+=3;else if(c.includes("popis")||c.includes("mnoz")||c.includes("cena")||c==="mj"||c.includes("kod"))score++});
  if(score>best.score)best={index,score}
 });
 return best.score>=3?best.index:0
}
function inferBudgetMapping(rows,headerIndex){
 const aliases=budgetHeaderAliases(),header=(rows[headerIndex]||[]).map(normalizeHeader),mapping={headerRow:headerIndex,columns:{}};
 Object.entries(aliases).forEach(([field,names])=>{
  const normalized=names.map(normalizeHeader);
  let idx=header.findIndex(h=>normalized.includes(h));
  if(idx<0)idx=header.findIndex(h=>normalized.some(a=>h&&a&&(h.includes(a)||a.includes(h))));
  if(idx>=0)mapping.columns[field]=idx
 });
 return mapping
}
function budgetMappingFromControls(){
 const headerRow=Math.max(0,Number.parseInt($("budgetImportHeaderRow")?.value||"1",10)-1),columns={};
 Object.keys(budgetFieldLabels()).forEach(field=>{
  const id=`budgetMap${field.charAt(0).toUpperCase()}${field.slice(1)}`,
        value=$(id)?.value;
  if(value!==undefined&&value!=="")columns[field]=Number(value)
 });
 return{headerRow,columns}
}
function applyBudgetMappingToControls(mapping){
 budgetImportMapping=mapping||{headerRow:0,columns:{}};
 const headerSelect=$("budgetImportHeaderRow"),rows=budgetImportRowsRaw||[];
 if(headerSelect){
  const max=Math.min(rows.length,80)||1;
  headerSelect.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}" ${i===budgetImportMapping.headerRow?"selected":""}>Riadok ${i+1}${rows[i]?.some(v=>String(v||"").trim())?` – ${esc((rows[i]||[]).slice(0,5).map(v=>String(v||"").trim()).filter(Boolean).join(" | ").slice(0,80))}`:""}</option>`).join("")
 }
 Object.keys(budgetFieldLabels()).forEach(field=>{
  const id=`budgetMap${field.charAt(0).toUpperCase()}${field.slice(1)}`,
        sel=$(id);
  if(sel)sel.innerHTML=budgetColumnOptions(budgetImportMapping.columns?.[field]??"")
 })
}
function readBudgetCell(row,index){return index===undefined||index===null||index===""?"":String((row||[])[Number(index)]??"").trim()}
function parseBudgetItemsFromMapping(rawRows,mapping){
 if(!rawRows.length)return[];
 const m=mapping||budgetMappingFromControls(),c=m.columns||{},items=[];
 rawRows.slice((m.headerRow||0)+1).forEach(row=>{
  if(!(row||[]).some(v=>String(v||"").trim()!==""))return;
  const pc=readBudgetCell(row,c.pc),code=readBudgetCell(row,c.code),description=readBudgetCell(row,c.description),unit=readBudgetCell(row,c.unit),qty=readBudgetCell(row,c.contractQty),unitPrice=readBudgetCell(row,c.unitPrice),total=readBudgetCell(row,c.contractTotal),typeRaw=readBudgetCell(row,c.type);
  if(!description&&!code&&!pc)return;
  const isSection=!unit&&!qty&&!unitPrice&&!total&&description;
  const type=isSection?"D":(typeRaw||"K");
  items.push({id:uid("wbi"),pc,type,code,description:description||code||pc,unit,contractQty:qty,unitPrice,contractTotal:total})
 });
 return items
}
function updateBudgetImportButtonsAndStatus(message){
 const ok=budgetImportItems.length>0&&budgetImportMapping.columns?.description!==undefined;
 if($("executeBudgetImport"))$("executeBudgetImport").disabled=!ok;
 if($("executeBudgetImportBottom"))$("executeBudgetImportBottom").disabled=!ok;
 if(message&&$("budgetImportStatus"))$("budgetImportStatus").textContent=message
}
function renderBudgetRawPreview(){
 const box=$("budgetImportRawPreview");if(!box)return;
 const rows=(budgetImportRowsRaw||[]).slice(0,18),count=budgetRawColumnCount(budgetImportRowsRaw);
 if(!rows.length){box.innerHTML="";return}
 const head=`<tr><th class="row-no">#</th>${Array.from({length:count},(_,i)=>`<th>${columnLetters(i)}</th>`).join("")}</tr>`;
 const body=rows.map((r,ri)=>`<tr><td class="row-no">${ri+1}</td>${Array.from({length:count},(_,i)=>`<td title="${esc(String((r||[])[i]??""))}">${esc(String((r||[])[i]??""))}</td>`).join("")}</tr>`).join("");
 box.innerHTML=`<table><thead>${head}</thead><tbody>${body}</tbody></table>`
}
function refreshBudgetImportFromMapping(showStatus=false){
 budgetImportMapping=budgetMappingFromControls();
 budgetImportItems=parseBudgetItemsFromMapping(budgetImportRowsRaw,budgetImportMapping);
 renderBudgetImportPreview();
 updateBudgetImportButtonsAndStatus();
 if(showStatus&&$("budgetImportStatus")){
  const hasDescription=budgetImportMapping.columns.description!==undefined;
  $("budgetImportStatus").className=(budgetImportItems.length&&hasDescription)?"import-status success":(hasDescription?"import-status warning":"import-status error");
  $("budgetImportStatus").textContent=(budgetImportItems.length&&hasDescription)?`Namapovaných ${budgetImportItems.length} položiek. Skontroluj náhľad a importuj.`:(hasDescription?"Mapovanie zatiaľ nenašlo položky. Skontroluj riadok hlavičky alebo stĺpec Popis položky.":"Vyber stĺpec Popis položky – bez neho sa rozpočet nedá spoľahlivo importovať.")
 }
}
function attachBudgetMappingEvents(){
 const header=$("budgetImportHeaderRow");
 if(header)header.onchange=()=>{budgetImportMapping=inferBudgetMapping(budgetImportRowsRaw,Math.max(0,Number.parseInt(header.value,10)-1));applyBudgetMappingToControls(budgetImportMapping);renderBudgetRawPreview();refreshBudgetImportFromMapping(true)};
 Object.keys(budgetFieldLabels()).forEach(field=>{
  const id=`budgetMap${field.charAt(0).toUpperCase()}${field.slice(1)}`,
        sel=$(id);
  if(sel)sel.onchange=()=>refreshBudgetImportFromMapping(true)
 })
}
function renderBudgetImportPreview(){
 const table=$("budgetImportPreview"),summary=$("budgetImportSummary");
 if(!table||!summary)return;
 const label=workBudgetDocLabel($("budgetImportDocType")?.value,$("budgetImportDocNumber")?.value);
 const total=budgetImportItems.reduce((s,x)=>s+(parseWorkNumber(x.contractTotal)||workRound(parseWorkNumber(x.contractQty)*parseWorkNumber(x.unitPrice),2)),0);
 const mapped=budgetImportRowsRaw.length?` · hlavička riadok ${(budgetImportMapping.headerRow||0)+1}`:"";
 summary.innerHTML=`<div><span>Položky</span><strong>${budgetImportItems.length}</strong></div><div><span>Rozpočet bez DPH</span><strong>${eur.format(total)}</strong></div><div><span>Doklad</span><strong>${esc(label)}${esc(mapped)}</strong></div>`;
 if(!budgetImportItems.length){table.innerHTML=`<tbody><tr><td style="padding:26px;text-align:center;color:#789">Bez načítaných položiek. Načítaj Excel a skontroluj mapovanie stĺpcov.</td></tr></tbody>`;return}
 const rows=budgetImportItems.slice(0,35);
 table.innerHTML=`<thead><tr><th>P. č.</th><th>Typ</th><th>Kód</th><th>Popis</th><th>MJ</th><th>Množstvo</th><th>J. cena</th><th>Cena celkom</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.pc)}</td><td>${esc(r.type)}</td><td>${esc(r.code)}</td><td class="desc">${esc(r.description)}</td><td>${esc(r.unit)}</td><td>${esc(r.contractQty)}</td><td>${esc(r.unitPrice)}</td><td>${esc(r.contractTotal)}</td></tr>`).join("")}${budgetImportItems.length>rows.length?`<tr><td colspan="8" style="text-align:center;color:#789;padding:10px">Náhľad zobrazuje prvých ${rows.length} z ${budgetImportItems.length} položiek.</td></tr>`:""}</tbody>`
}
function openBudgetImportModal(){
 prepareWorkStatements();
 $("budgetImportCompany").innerHTML=optionList(workStatementCompanies(),selectedWorkCompanyId,x=>x.name,"Vyber firmu");
 $("budgetImportCompany").value=selectedWorkCompanyId||"";
 $("budgetImportDocType").value="ZoD";$("budgetImportDocNumber").value="";$("budgetImportTitle").value="";
 $("budgetImportFile").value="";budgetImportRowsRaw=[];budgetImportItems=[];budgetImportMapping={headerRow:0,columns:{}};
 if($("budgetImportMappingWrap"))$("budgetImportMappingWrap").classList.add("hidden");
 if($("budgetImportRawPreview"))$("budgetImportRawPreview").innerHTML="";
 $("executeBudgetImport").disabled=true;$("executeBudgetImportBottom").disabled=true;
 $("budgetImportStatus").className="import-status";$("budgetImportStatus").textContent="";
 renderBudgetImportPreview();$("budgetImportModal").classList.remove("hidden")
}
async function readBudgetImportFile(){
 const file=$("budgetImportFile").files[0],status=$("budgetImportStatus");
 if(!file){status.className="import-status error";status.textContent="Vyber Excel alebo CSV súbor s rozpočtom.";return}
 try{
  status.className="import-status";status.textContent="Načítavam rozpočet…";
  budgetImportRowsRaw=file.name.toLowerCase().endsWith(".csv")?parseCsv(await file.text()):await parseXlsx(file);
  const headerIndex=detectBudgetHeaderRow(budgetImportRowsRaw);
  budgetImportMapping=inferBudgetMapping(budgetImportRowsRaw,headerIndex);
  applyBudgetMappingToControls(budgetImportMapping);
  attachBudgetMappingEvents();
  if($("budgetImportMappingWrap"))$("budgetImportMappingWrap").classList.remove("hidden");
  renderBudgetRawPreview();
  budgetImportItems=parseBudgetItemsFromMapping(budgetImportRowsRaw,budgetImportMapping);
  renderBudgetImportPreview();
  updateBudgetImportButtonsAndStatus();
  const hasDescription=budgetImportMapping.columns.description!==undefined;
  status.className=(budgetImportItems.length&&hasDescription)?"import-status success":(hasDescription?"import-status warning":"import-status error");
  status.textContent=(budgetImportItems.length&&hasDescription)?`Načítaných ${budgetImportItems.length} položiek. Aplikácia navrhla mapovanie stĺpcov – skontroluj ho a importuj.`:(hasDescription?"Súbor sa načítal, ale položky sa nenašli. Skontroluj mapovanie stĺpcov.":"Súbor sa načítal, ale neviem nájsť stĺpec Popis položky. Vyber ho ručne v mapovaní.")
 }catch(err){budgetImportRowsRaw=[];budgetImportItems=[];budgetImportMapping={headerRow:0,columns:{}};if($("budgetImportMappingWrap"))$("budgetImportMappingWrap").classList.add("hidden");renderBudgetImportPreview();$("executeBudgetImport").disabled=true;$("executeBudgetImportBottom").disabled=true;status.className="import-status error";status.textContent=`Súbor sa nepodarilo načítať: ${err.message}`}
}
function executeBudgetImport(){
 if(!budgetImportItems.length)return;
 if(budgetImportMapping.columns?.description===undefined){alert("Vyber stĺpec Popis položky v mapovaní. Bez neho sa rozpočet nedá bezpečne importovať.");return}
 const companyId=$("budgetImportCompany").value||selectedWorkCompanyId;
 if(!companyId){alert("Vyber firmu/subdodávku.");return}
 const docType=$("budgetImportDocType").value||"ZoD",docNumber=$("budgetImportDocNumber").value.trim(),label=workBudgetDocLabel(docType,docNumber),title=$("budgetImportTitle").value.trim()||label,file=$("budgetImportFile").files[0];
 ensureWorkBudgetState();
 const existing=state.workBudgets.find(b=>b.projectId===state.selectedProjectId&&b.companyId===companyId&&String(b.label||"").toLowerCase()===label.toLowerCase());
 if(existing&&!confirm(`Rozpočet ${label} pre túto firmu už existuje. Nahradiť ho novým importom?`))return;
 const id=existing?.id||uid("wb");
 const budget={id,projectId:state.selectedProjectId,companyId,docType,docNumber,label,title,fileName:file?.name||"",importedAt:new Date().toISOString(),items:budgetImportItems.map(x=>({...x,id:x.id||uid("wbi"),sourceDocId:id,sourceDocLabel:label}))};
 if(existing)Object.assign(existing,budget);else state.workBudgets.push(budget);
 let addedToStatement=0;
 if($("budgetImportAddToStatement").checked){
  selectedWorkCompanyId=companyId;
  const statement=getWorkStatement(true);
  addedToStatement=addBudgetItemsToStatement(statement,budget,{replace:Boolean(existing)})
 }
 $("budgetImportModal").classList.add("hidden");
 selectedWorkDocFilter="";
 save(`Rozpočet ${label} bol importovaný (${budget.items.length} položiek). Do aktuálneho súpisu pridané: ${addedToStatement}.`)
}
function loadSelectedBudgetToStatement(){
 const budgets=workBudgetList(selectedWorkCompanyId);
 if(!budgets.length){alert("Pre vybranú firmu zatiaľ nie je importovaný žiadny rozpočet.");return}
 const list=budgets.map((b,i)=>`${i+1}. ${b.label}${b.title&&b.title!==b.label?` – ${b.title}`:""} (${(b.items||[]).length} položiek)`).join("\n");
 const answer=prompt(`Ktorý rozpočet chceš vložiť do aktuálneho súpisu?\n\n${list}\n\nZadaj číslo:`);
 if(answer===null)return;
 const idx=Number(answer)-1,budget=budgets[idx];
 if(!budget){alert("Neplatné číslo rozpočtu.");return}
 const statement=getWorkStatement(true),added=addBudgetItemsToStatement(statement,budget,{replace:false});
 save(`Do súpisu bolo pridaných ${added} položiek z ${budget.label}.`)
}
let budgetImportRowsRaw=[];let budgetImportItems=[];let budgetImportMapping={headerRow:0,columns:{}};
function isWorkFormula(value){return String(value??"").trim().startsWith("=")}
function normalizeWorkFormulaExpression(value){
 let expr=String(value??"").trim();
 if(expr.startsWith("="))expr=expr.slice(1);
 expr=expr.replace(/€/g,"").replace(/\s+/g,"").replace(/,/g,".").replace(/[×x]/gi,"*").replace(/[÷:]/g,"/");
 expr=expr.replace(/(SUM|SUMA)\(([^()]*)\)/gi,(_,fn,args)=>`(${args.replace(/[;]/g,"+")})`);
 if(!expr)return"0";
 if(!/^[0-9+\-*/().]+$/.test(expr))return null;
 return expr
}
function evalWorkFormula(value){
 const expr=normalizeWorkFormulaExpression(value);
 if(expr===null)return{ok:false,value:0,error:"Nepodporovaný znak vo vzorci"};
 try{
  const result=Function(`"use strict";return (${expr})`)();
  return Number.isFinite(result)?{ok:true,value:result,error:""}:{ok:false,value:0,error:"Neplatný výsledok"}
 }catch(error){return{ok:false,value:0,error:"Neplatný vzorec"}}
}
function parseWorkNumber(value){
 const raw=String(value??"").trim();if(!raw)return 0;
 if(isWorkFormula(raw))return evalWorkFormula(raw).value;
 let expr=raw.replace(/€/g,"").replace(/\s/g,"").replace(/,/g,".");
 if(!/^[0-9+\-*/().]+$/.test(expr))return Number(expr)||0;
 try{const result=Function(`"use strict";return (${expr})`)();return Number.isFinite(result)?result:0}catch{return Number(expr)||0}
}
function workPeriodBounds(period){
 const [year,month]=String(period||todayMonthValue()).split("-").map(Number),
       lastDay=new Date(year,month,0).getDate();
 return{
  from:`${year}-${String(month).padStart(2,"0")}-01`,
  to:`${year}-${String(month).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`
 }
}
function ensureWorkStatementDates(statement){
 const bounds=workPeriodBounds(statement.period),
       a=assignment(statement.projectId,statement.companyId);
 if(!statement.dateFrom)statement.dateFrom=bounds.from;
 if(!statement.dateTo)statement.dateTo=bounds.to;
 if(!statement.statementDate)statement.statementDate=statement.dateTo||bounds.to;
 if(!statement.scope)statement.scope=statement.part||a?.scope||"";
 return statement
}
function workRound(value,decimals=2){const p=10**decimals;return Math.round((Number(value)+Number.EPSILON)*p)/p}
function workQty(value){return Number(value||0).toLocaleString("sk-SK",{minimumFractionDigits:3,maximumFractionDigits:3})}
function workMoney(value){return Number(value||0).toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})}
function isWorkPriceOnlyItem(item){return item&&(item.priceOnly===true||item.priceOnly==="true")}
function workQtyOrBlank(value,item){return isWorkPriceOnlyItem(item)?"":workQty(value)}
function workStatementCompanies(){
 const assigned=activeAssignments().map(a=>company(a.companyId)).filter(Boolean);
 const hourCompanyIds=(state.companyHourTimesheets||[]).filter(x=>x.projectId===state.selectedProjectId).flatMap(x=>(x.rows||[]).map(r=>r.companyId)).filter(Boolean);
 const hourCompanies=hourCompanyIds.map(id=>company(id)).filter(Boolean);
 const source=assigned.length?[...assigned,...hourCompanies]:[...state.companies,...hourCompanies];
 return [...new Map(source.map(c=>[c.id,c])).values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"))
}
function workStatementList(projectId=state.selectedProjectId,companyId=selectedWorkCompanyId){
 return state.workStatements.filter(x=>x.projectId===projectId&&x.companyId===companyId).sort((a,b)=>a.period.localeCompare(b.period))
}
function workItemKey(item){return item.budgetItemId||`${item.pc}|${item.code}|${item.description}`}
function priorWorkStatements(statement){return state.workStatements.filter(x=>x.projectId===statement.projectId&&x.companyId===statement.companyId&&x.period<statement.period).sort((a,b)=>a.period.localeCompare(b.period))}
function previousWorkStatement(statement){
 const previousPeriod=shiftMonth(statement.period,-1);
 return state.workStatements
  .filter(x=>x.projectId===statement.projectId&&x.companyId===statement.companyId&&x.period===previousPeriod&&x.id!==statement.id)
  .sort((a,b)=>String(a.updatedAt||a.createdAt||"").localeCompare(String(b.updatedAt||b.createdAt||"")))
  .at(-1)||null
}
function matchingPreviousWorkItem(previous,item){
 if(!previous)return null;
 const index=workPreviousItemIndex(previous);
 const budgetKey=String(item.budgetItemId||"").trim(),pcCodeKey=`${String(item.pc||"").trim()}|${String(item.code||"").trim()}`,codeDescKey=`${String(item.code||"").trim()}|${String(item.description||"").trim()}`;
 return (budgetKey&&index.byBudget.get(budgetKey))||index.byPcCode.get(pcCodeKey)||(String(item.code||"").trim()&&index.byCodeDesc.get(codeDescKey))||null
}
function workPreviousItemIndex(previous){
 if(!previous)return{byBudget:new Map(),byPcCode:new Map(),byCodeDesc:new Map(),count:0,updatedAt:""};
 const cached=workPreviousIndexCache.get(previous),count=(previous.items||[]).length,updatedAt=String(previous.updatedAt||"");
 if(cached&&cached.count===count&&cached.updatedAt===updatedAt)return cached;
 const index={byBudget:new Map(),byPcCode:new Map(),byCodeDesc:new Map(),count,updatedAt};
 (previous.items||[]).filter(x=>!isWorkDocSectionItem(x)).forEach(x=>{
  const budgetKey=String(x.budgetItemId||"").trim(),pcCodeKey=`${String(x.pc||"").trim()}|${String(x.code||"").trim()}`,codeDescKey=`${String(x.code||"").trim()}|${String(x.description||"").trim()}`;
  if(budgetKey&&!index.byBudget.has(budgetKey))index.byBudget.set(budgetKey,x);
  if((String(x.pc||"").trim()||String(x.code||"").trim())&&!index.byPcCode.has(pcCodeKey))index.byPcCode.set(pcCodeKey,x);
  if(String(x.code||"").trim()&&!index.byCodeDesc.has(codeDescKey))index.byCodeDesc.set(codeDescKey,x)
 });
 workPreviousIndexCache.set(previous,index);
 return index
}
function previousWorkQty(statement,item){
 const previous=previousWorkStatement(statement),old=matchingPreviousWorkItem(previous,item);
 if(!previous||!old)return 0;
 return workItemCalc(previous,old).totalQty
}
function workItemCalc(statement,item){
 if(String(item.type||"").toUpperCase()==="D")return{section:true,priceOnly:false,contractQty:0,unitPrice:0,contractTotal:0,currentQty:0,currentPrice:0,previousQty:0,previousPrice:0,totalQty:0,totalPrice:0,remainingQty:0,remainingPrice:0,difference:0,over:false};
 if(isWorkPriceOnlyItem(item)){
  const explicit=String(item.contractTotal??item.currentPriceOverride??"").trim(),
        contractTotal=explicit!==""?parseWorkNumber(explicit):parseWorkNumber(item.currentPriceOverride),
        currentPrice=contractTotal;
  return{priceOnly:true,contractQty:0,unitPrice:0,contractTotal,currentQty:0,currentPrice,previousQty:0,previousPrice:0,totalQty:0,totalPrice:currentPrice,remainingQty:0,remainingPrice:0,difference:0,over:false}
 }
 const contractQty=parseWorkNumber(item.contractQty),unitPrice=parseWorkNumber(item.unitPrice),
       explicit=String(item.contractTotal??"").trim(),
       contractTotal=explicit!==""?parseWorkNumber(explicit):workRound(contractQty*unitPrice,2),
       currentQty=parseWorkNumber(item.currentQty),previousQty=previousWorkQty(statement,item),
       currentPrice=workRound(currentQty*unitPrice,2),previousPrice=workRound(previousQty*unitPrice,2),
       totalQty=workRound(currentQty+previousQty,6),totalPrice=workRound(totalQty*unitPrice,2),
       remainingQty=workRound(contractQty-totalQty,6),remainingPrice=workRound(contractTotal-totalPrice,2),
       difference=workRound(contractTotal-contractQty*unitPrice,2);
 return{priceOnly:false,contractQty,unitPrice,contractTotal,currentQty,currentPrice,previousQty,previousPrice,totalQty,totalPrice,remainingQty,remainingPrice,difference,over:remainingQty<-0.0005}
}
function createBlankWorkItem(documentLabel="ZoD",sourceDocId=""){
 const item={id:uid("wi"),budgetItemId:uid("budget"),pc:"",type:"K",code:"",description:"",unit:"",contractQty:"",unitPrice:"",contractTotal:"",currentQty:""};
 setWorkItemDocument(item,documentLabel,sourceDocId);
 return item
}
function defaultWorkExample(){return{id:uid("wi"),budgetItemId:uid("budget"),pc:"15",type:"K",code:"273321411.S",description:"Betón základových dosiek, železový (bez výstuže), tr. C 25/30, X0(SK), CL 0,4, Dmax 16",unit:"m3",contractQty:"405,871",unitPrice:"10,00",contractTotal:"4 058,61",currentQty:""}}
function getWorkStatement(create=true){
 if(!selectedWorkCompanyId)return null;
 let statement=state.workStatements.find(x=>x.projectId===state.selectedProjectId&&x.companyId===selectedWorkCompanyId&&x.period===selectedWorkPeriod);
 if(!statement&&create){
  const previousPeriod=shiftMonth(selectedWorkPeriod,-1);
  const previous=state.workStatements
   .filter(x=>x.projectId===state.selectedProjectId&&x.companyId===selectedWorkCompanyId&&x.period===previousPeriod)
   .sort((a,b)=>String(a.updatedAt||a.createdAt||"").localeCompare(String(b.updatedAt||b.createdAt||"")))
   .at(-1)||null;
  const items=previous?previous.items.filter(x=>!String(x.sourceKey||"").startsWith("company-hours:")).map(x=>({...clone(x),id:uid("wi"),currentQty:""})):[];
  const previousNumber=Number.parseInt(previous?.number,10);
  const bounds=workPeriodBounds(selectedWorkPeriod),
        currentAssignment=assignment(state.selectedProjectId,selectedWorkCompanyId);
  statement={id:uid("wsu"),projectId:state.selectedProjectId,companyId:selectedWorkCompanyId,period:selectedWorkPeriod,number:Number.isFinite(previousNumber)?previousNumber+1:1,object:previous?.object||"",scope:previous?.scope||currentAssignment?.scope||"",statementDate:bounds.to,dateFrom:bounds.from,dateTo:bounds.to,note:"",items,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  state.workStatements.push(statement);commitDirectState()
 }
 if(statement){ensureWorkStatementDates(statement);ensureWorkStatementDocuments(statement)}return statement
}
let workRowSearch="",workRowFilter="all",workOverviewMode=true,workDetailsVisible=true;
function workSearchKey(value){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("sk").replace(/[^a-z0-9]+/g,"")
}
function workItemNeedsAttention(statement,item){
 const calc=workItemCalc(statement,item),description=String(item.description||"").trim(),hasQuantity=String(item.contractQty||"").trim()!=="",hasPrice=String(item.unitPrice||"").trim()!=="";
 return !calc.section&&(calc.over||Math.abs(calc.difference)>.011||!description||(hasQuantity&&!hasPrice))
}
function applyWorkOverviewUI(){
 const table=$("workStatementTable"),details=$("workStatements")?.querySelector(".work-header-panel");
 if(table)table.classList.toggle("work-overview-mode",workOverviewMode);
 if(details)details.classList.toggle("work-details-collapsed",!workDetailsVisible);
 if($("toggleWorkOverview"))$("toggleWorkOverview").textContent=workOverviewMode?"Rozšírené stĺpce":"Prehľadné stĺpce";
 if($("toggleWorkDetails"))$("toggleWorkDetails").textContent=workDetailsVisible?"Skryť hlavičku":"Zobraziť hlavičku";
 if($("workSearch")&&$("workSearch").value!==workRowSearch)$("workSearch").value=workRowSearch;
 if($("workRowFilter"))$("workRowFilter").value=workRowFilter
}
function prepareWorkStatements(){
 const companies=workStatementCompanies();
 if(!companies.length){selectedWorkCompanyId="";renderWorkStatements();return}
 if(!companies.some(c=>c.id===selectedWorkCompanyId)){
  selectedWorkCompanyId=companies.find(c=>/J\.?B\.?\s*Trend/i.test(c.name))?.id||companies[0].id
 }
 selectedWorkPeriod=selectedWorkPeriod||todayMonthValue();
 getWorkStatement(true);renderWorkStatements()
}
function renderWorkStatements(){
 if(!$("workStatementBody"))return;
 const companies=workStatementCompanies();
 if(!companies.some(c=>c.id===selectedWorkCompanyId))selectedWorkCompanyId=companies[0]?.id||"";
 $("workStatementCompany").innerHTML=optionList(companies,selectedWorkCompanyId,x=>x.name,"Vyber firmu");
 if($("workStatementSourceFilter")){const current=selectedWorkDocFilter||workDocumentId("ZoD");$("workStatementSourceFilter").innerHTML=workBudgetOptions(selectedWorkCompanyId);if([...$("workStatementSourceFilter").options].some(o=>o.value===current)){$("workStatementSourceFilter").value=current;selectedWorkDocFilter=current}else{selectedWorkDocFilter=workDocumentId("ZoD");$("workStatementSourceFilter").value=selectedWorkDocFilter}}
 $("workStatementPeriod").value=selectedWorkPeriod||todayMonthValue();if($("workCurrentPeriodHead"))$("workCurrentPeriodHead").textContent=`Aktuálne obdobie (${selectedWorkPeriod})`;
 const statement=getWorkStatement(!!selectedWorkCompanyId),a=assignment(state.selectedProjectId,selectedWorkCompanyId);
 $("workStatementContract").value=a?assignmentDocRef(a):"";
 if($("workInvoiceContractNumber"))$("workInvoiceContractNumber").textContent=a?assignmentDocRef(a):"Bez čísla dokladu";
 if(!statement){
  $("workStatementBody").innerHTML=`<tr class="work-empty-row"><td colspan="17">Na stavbe nie je dostupná firma.</td></tr>`;
  if($("workInvoiceAmount"))$("workInvoiceAmount").textContent="0,00 €";
  if($("workInvoicePeriodName"))$("workInvoicePeriodName").textContent="—";
  if($("workInvoiceContractNumber"))$("workInvoiceContractNumber").textContent="—";
  if($("workInvoiceCompanyStatement"))$("workInvoiceCompanyStatement").textContent="—";
  applyWorkOverviewUI();
  return
 }
 $("workStatementNumber").value=statement.number;const previousStatement=previousWorkStatement(statement);if($("workPreviousPeriodHead"))$("workPreviousPeriodHead").textContent=previousStatement?`Prestavané minulé obdobia – stav k ${formatBillingMonth(previousStatement.period)}`:"Prestavané minulé obdobia";
 ensureWorkStatementDates(statement);
 if($("workInvoiceCompanyStatement"))$("workInvoiceCompanyStatement").textContent=`${company(selectedWorkCompanyId)?.name||"Bez firmy"} · súpis č. ${statement.number||"—"}`;
 $("workStatementObject").value=statement.object||"";
 $("workStatementDate").value=statement.statementDate||"";
 $("workStatementDateFrom").value=statement.dateFrom||"";
 $("workStatementDateTo").value=statement.dateTo||"";
 $("workStatementScope").value=statement.scope||a?.scope||"";
 $("workStatementNote").value=statement.note||"";
 const allRows=(statement.items||[]).filter(item=>!isWorkDocSectionItem(item));
 let rows=selectedWorkDocFilter?allRows.filter(item=>workItemSourceId(item)===selectedWorkDocFilter):allRows;
 const query=workSearchKey(workRowSearch);
 if(query)rows=rows.filter(item=>workSearchKey([item.pc,item.type,item.code,item.description,item.unit,workItemSourceLabel(item)].join(" ")).includes(query));
 if(workRowFilter==="current")rows=rows.filter(item=>{const calc=workItemCalc(statement,item);return Math.abs(calc.currentQty)>.000001||Math.abs(calc.currentPrice)>.005});
 else if(workRowFilter==="remaining")rows=rows.filter(item=>workItemCalc(statement,item).remainingPrice>.005);
 else if(workRowFilter==="issues")rows=rows.filter(item=>workItemNeedsAttention(statement,item));
 if($("workVisibleCount"))$("workVisibleCount").textContent=`${rows.length} / ${allRows.length}`;
 selectedWorkItemIds=new Set([...selectedWorkItemIds].filter(id=>rows.some(item=>item.id===id)));
 $("workStatementBody").innerHTML=rows.map(item=>{
  const c=workItemCalc(statement,item),section=c.section,selected=selectedWorkItemIds.has(item.id),needsAttention=workItemNeedsAttention(statement,item);
  const docLabel=workItemSourceLabel(item)||"ZoD",docClass=workBudgetDocClass(docLabel);
  return `<tr class="${section?"work-section-row":""} ${section&&docLabel?"work-section-doc":""} ${docClass?"work-doc-addendum":"work-doc-zod"} ${c.over?"work-over":""} ${needsAttention?"work-needs-attention":""} ${selected?"work-row-selected":""}" data-work-row="${item.id}">
   <td><input class="work-row-select" type="checkbox" value="${item.id}" ${selected?"checked":""}></td>
   ${workEditCell(item,"pc")}${workEditCell(item,"type")}${workEditCell(item,"code")}${workEditCell(item,"description")}${workEditCell(item,"unit")}
   ${workEditCell(item,"contractQty","numeric")}${workEditCell(item,"unitPrice","numeric")}${workEditCell(item,"contractTotal","numeric",Math.abs(c.difference)>.011?"work-difference":"")}
   ${workEditCell(item,"currentQty","numeric current-col")}
   ${workCalcCell(c.currentPrice,"current-col","money",section)}
   ${workCalcCell(c.previousQty,"previous-col","qty",c.priceOnly||section)}${workCalcCell(c.previousPrice,"previous-col","money",section)}
   ${workCalcCell(c.totalQty,"total-col","qty",c.priceOnly||section)}${workCalcCell(c.totalPrice,"total-col","money",section)}
   ${workCalcCell(c.remainingQty,"remain-col","qty",c.priceOnly||section)}${workCalcCell(c.remainingPrice,"remain-col","money",section)}
  </tr>`
 }).join("")||`<tr class="work-empty-row"><td colspan="17">Súpis je prázdny. Pridaj riadok alebo vlož položky z Excelu cez Ctrl + V.</td></tr>`;
 attachWorkTableEvents(statement);updateWorkSelectionUI(statement);updateWorkStatementSummary(statement);applyWorkOverviewUI()
}
function workEditCell(item,field,cls="",extra=""){
 const raw=item[field]??"",text=String(raw),value=esc(raw),desc=field==="description";
 let title=esc(text),formulaClass="";
 if(!desc&&isWorkFormula(text)){
  const result=evalWorkFormula(text);
  formulaClass=result.ok?"work-formula-field":"work-formula-field work-formula-error";
  title=esc(result.ok?`${text} = ${workRound(result.value,6)}`:`${text} – ${result.error}`)
 }
 if(desc){
  const rows=Math.max(2,Math.ceil(text.length/58)+String(text).split(/\n/).length-1);
  return `<td class="${cls} ${extra} work-desc-cell" title="${title}"><textarea data-work-item="${item.id}" data-work-field="${field}" rows="${rows}" title="${title}" autocomplete="off">${value}</textarea></td>`
 }
 return `<td class="${cls} ${extra} ${formulaClass}" title="${title}"><input data-work-item="${item.id}" data-work-field="${field}" value="${value}" title="${title}" autocomplete="off"></td>`
}
function workCalcCell(value,cls="",kind="money",blank=false){
 return `<td class="work-calculated work-readonly ${cls}">${blank?"":(kind==="qty"?workQty(value):workMoney(value))}</td>`
}
function scheduleWorkStatementSummary(statement){
 workSummaryPendingStatement=statement;
 if(workSummaryTimer)return;
 workSummaryTimer=requestAnimationFrame(()=>{
  workSummaryTimer=null;
  const target=workSummaryPendingStatement;
  workSummaryPendingStatement=null;
  if(target)updateWorkStatementSummary(target)
 })
}
function refreshWorkRowCalculations(statement,item,row){
 if(!row||!item)return;
 const c=workItemCalc(statement,item),cells=row.cells;
 if(cells.length<17)return;
 cells[8].classList.toggle("work-difference",Math.abs(c.difference)>.011);
 cells[10].textContent=workMoney(c.currentPrice);
 cells[11].textContent=c.priceOnly?"":workQty(c.previousQty);
 cells[12].textContent=workMoney(c.previousPrice);
 cells[13].textContent=c.priceOnly?"":workQty(c.totalQty);
 cells[14].textContent=workMoney(c.totalPrice);
 cells[15].textContent=c.priceOnly?"":workQty(c.remainingQty);
 cells[16].textContent=workMoney(c.remainingPrice);
 row.classList.toggle("work-over",c.over);
 scheduleWorkStatementSummary(statement)
}
function updateWorkSelectionUI(statement){
 const checks=[...document.querySelectorAll(".work-row-select[value]")],count=selectedWorkItemIds.size,
       selectAll=$("workSelectAll"),deleteBtn=$("deleteWorkRow"),copyBtn=$("copyWorkRow");
 checks.forEach(check=>{
  check.checked=selectedWorkItemIds.has(check.value);
  check.closest("tr")?.classList.toggle("work-row-selected",check.checked)
 });
 if(selectAll){
  selectAll.checked=checks.length>0&&count===checks.length;
  selectAll.indeterminate=count>0&&count<checks.length
 }
 if(deleteBtn){deleteBtn.disabled=count===0;deleteBtn.textContent=count?`Vymazať označené (${count})`:"Vymazať označené"}
 if(copyBtn)copyBtn.disabled=count!==1;
 selectedWorkItemId=count?[...selectedWorkItemIds][0]:""
}
function attachWorkTableEvents(statement){
 const checks=[...document.querySelectorAll(".work-row-select[value]")];
 checks.forEach((check,index)=>{
  check.onclick=event=>{
   if(event.shiftKey&&lastWorkSelectionIndex>=0){
    const from=Math.min(lastWorkSelectionIndex,index),to=Math.max(lastWorkSelectionIndex,index),select=check.checked;
    for(let i=from;i<=to;i++){
     if(select)selectedWorkItemIds.add(checks[i].value);
     else selectedWorkItemIds.delete(checks[i].value)
    }
   }else{
    if(check.checked)selectedWorkItemIds.add(check.value);
    else selectedWorkItemIds.delete(check.value)
   }
   lastWorkSelectionIndex=index;updateWorkSelectionUI(statement)
  }
 });
 if($("workSelectAll"))$("workSelectAll").onchange=()=>{
  if($("workSelectAll").checked)statement.items.forEach(item=>selectedWorkItemIds.add(item.id));
  else selectedWorkItemIds.clear();
  updateWorkSelectionUI(statement)
 };
 document.querySelectorAll("[data-work-item]").forEach(inp=>{
  const fit=()=>{if(inp.tagName==="TEXTAREA"){inp.style.height="auto";inp.style.height=(inp.scrollHeight+2)+"px"}};
  fit();
  inp.onfocus=()=>{beginDirectUndo("Úprava súpisu prác");fit()};
  inp.oninput=()=>{const item=statement.items.find(x=>x.id===inp.dataset.workItem);if(!item)return;item[inp.dataset.workField]=inp.value;const cell=inp.closest("td");if(cell){cell.classList.toggle("work-formula-field",isWorkFormula(inp.value));cell.classList.toggle("work-formula-error",isWorkFormula(inp.value)&&!evalWorkFormula(inp.value).ok)}fit();statement.status="draft";statement.updatedAt=new Date().toISOString();commitDirectState();refreshWorkRowCalculations(statement,item,inp.closest("tr"))};
  inp.onblur=()=>{const v=inp.value.trim(),rerender=inp.dataset.workField==="type";if(isWorkFormula(v)&&!evalWorkFormula(v).ok)toast("Vzorec v súpise nie je platný.");endDirectUndo();if(rerender)renderWorkStatements()};
  inp.onpaste=e=>handleWorkGridPaste(e,statement,inp.dataset.workItem,inp.dataset.workField)
 })
}
const workPasteFields=["pc","type","code","description","unit","contractQty","unitPrice","contractTotal","currentQty"];
function handleWorkGridPaste(event,statement,itemId,field){
 const text=event.clipboardData?.getData("text")||"";
 if(!text.includes("\t")&&!text.includes("\n")&&!text.includes(";"))return;
 event.preventDefault();const rows=parseWorkRows(text),startRow=statement.items.findIndex(x=>x.id===itemId),startCol=Math.max(0,workPasteFields.indexOf(field));
 rows.forEach((cols,r)=>{
  while(statement.items.length<=startRow+r)statement.items.push(createBlankWorkItem());
  const item=statement.items[startRow+r];cols.forEach((value,c)=>{const target=workPasteFields[startCol+c];if(target)item[target]=value})
 });
 statement.updatedAt=new Date().toISOString();save("Riadky boli vložené do súpisu.")
}
function parseWorkRows(text){
 const lines=String(text).replace(/\r/g,"").split("\n").filter(x=>x.trim()!=="");
 return lines.map(line=>{
  if(line.includes("\t"))return line.split("\t").map(x=>x.trim());
  if(line.includes(";"))return line.split(";").map(x=>x.trim());
  return line.trim().split(/\s{2,}/).map(x=>x.trim())
 })
}
function updateWorkStatementSummary(statement){
 const currentAssignment=assignment(
  statement?.projectId||state.selectedProjectId,
  statement?.companyId||selectedWorkCompanyId
 );
 const calculations=statement.items.filter(x=>!isWorkDocSectionItem(x)&&String(x.type||"").toUpperCase()!=="D").map(x=>workItemCalc(statement,x));
 const sum=k=>calculations.reduce((a,c)=>a+Number(c[k]||0),0);
 $("workContractTotal").textContent=eur.format(sum("contractTotal"));
 $("workPreviousTotal").textContent=eur.format(sum("previousPrice"));
 const currentInvoiceTotal=sum("currentPrice");
 $("workCurrentTotal").textContent=eur.format(currentInvoiceTotal);
 $("workInvoiceAmount").textContent=eur.format(currentInvoiceTotal);
 $("workInvoicePeriod").textContent="bez DPH · vystaviť faktúru";
 $("workInvoicePeriodName").textContent=formatBillingMonth(statement.period);
 if($("workInvoiceCompanyStatement"))$("workInvoiceCompanyStatement").textContent=`${company(statement.companyId)?.name||company(selectedWorkCompanyId)?.name||"Bez firmy"} · súpis č. ${statement.number||"—"}`;
 $("workInvoiceContractNumber").textContent=currentAssignment?.contractNo||"Bez čísla zmluvy";
 $("workBuiltTotal").textContent=eur.format(sum("totalPrice"));
 $("workRemainingTotal").textContent=eur.format(sum("remainingPrice"));
 $("workItemCount").textContent=calculations.length;
 const over=calculations.filter(x=>x.over).length,diffs=calculations.filter(x=>Math.abs(x.difference)>.011).length;
 $("workOverCount").textContent=over;$("workDifferenceCount").textContent=diffs;
 const msg=$("workCheckMessage");msg.className="";
 if(over){msg.className="error";msg.textContent=`${over} položiek prekračuje zmluvné množstvo.`}
 else if(diffs){msg.className="warning";msg.textContent=`${diffs} položiek má ručne upravenú zmluvnú cenu.`}
 else msg.textContent="Súpis je v poriadku.";
 const linkedBilling=state.billings.find(record=>record.workStatementId===statement.id),stateEl=$("workStatementState");
 if(stateEl){
  stateEl.className=linkedBilling?"is-billed":statement.savedAt?"is-saved":"is-draft";
  stateEl.textContent=linkedBilling?"Vo fakturácii":statement.savedAt?"Uložený":"Rozpracovaný"
 }
 $("workAutoSaveLabel").textContent=`Automaticky uložené ${new Date().toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"})}`
}
$("workStatementNumber").onchange=()=>{
 const statement=getWorkStatement(false);if(!statement)return;
 const oldNumber=Number.parseInt(statement.number,10)||1,newNumber=Number.parseInt($("workStatementNumber").value,10);
 if(!Number.isFinite(newNumber)||newNumber<1){alert("Číslo súpisu musí byť celé číslo od 1.");$("workStatementNumber").value=oldNumber;return}
 const list=workStatementList(),earlier=list.filter(x=>x.period<statement.period&&x.id!==statement.id);
 if(earlier.some(x=>Number.parseInt(x.number,10)===newNumber)){alert(`Súpis č. ${newNumber} už existuje v staršom období.`);$("workStatementNumber").value=oldNumber;return}
 const following=list.filter(x=>x.period>statement.period).sort((a,b)=>a.period.localeCompare(b.period));
 if(following.length&&!confirm(`Zmeniť tento súpis na číslo ${newNumber} a prečíslovať ${following.length} nasledujúcich súpisov?`)){$("workStatementNumber").value=oldNumber;return}
 statement.number=newNumber;following.forEach((x,i)=>x.number=newNumber+i+1);
 save(`Číslo súpisu bolo zmenené na ${newNumber}.`)
};

$("workStatementCompany").onchange=()=>{selectedWorkCompanyId=$("workStatementCompany").value;selectedWorkDocFilter=workDocumentId("ZoD");selectedWorkItemIds.clear();lastWorkSelectionIndex=-1;getWorkStatement(true);renderWorkStatements()};
if($("workStatementSourceFilter"))$("workStatementSourceFilter").onchange=()=>{selectedWorkDocFilter=$("workStatementSourceFilter").value;selectedWorkItemIds.clear();lastWorkSelectionIndex=-1;renderWorkStatements()};
$("workStatementPeriod").onchange=()=>{selectedWorkPeriod=$("workStatementPeriod").value||todayMonthValue();selectedWorkItemIds.clear();lastWorkSelectionIndex=-1;getWorkStatement(true);renderWorkStatements()};
if($("toggleWorkDetails"))$("toggleWorkDetails").onclick=()=>{workDetailsVisible=!workDetailsVisible;applyWorkOverviewUI()};
if($("toggleWorkOverview"))$("toggleWorkOverview").onclick=()=>{workOverviewMode=!workOverviewMode;applyWorkOverviewUI()};
if($("workSearch"))$("workSearch").oninput=()=>{workRowSearch=$("workSearch").value;renderWorkStatements()};
if($("workRowFilter"))$("workRowFilter").onchange=()=>{workRowFilter=$("workRowFilter").value;renderWorkStatements()};
["workStatementObject","workStatementDate","workStatementDateFrom","workStatementDateTo","workStatementScope","workStatementNote"].forEach(id=>{
 $(id).oninput=()=>{
  const s=getWorkStatement(false);if(!s)return;
  const map={workStatementObject:"object",workStatementDate:"statementDate",workStatementDateFrom:"dateFrom",workStatementDateTo:"dateTo",workStatementScope:"scope",workStatementNote:"note"};
  s[map[id]]=$(id).value;s.status="draft";s.updatedAt=new Date().toISOString();commitDirectState()
 }
});
$("addWorkRow").onclick=()=>{
 const s=getWorkStatement(true),doc=selectedWorkDocument(),item=createBlankWorkItem(doc.label,doc.id);s.items.push(item);s.status="draft";
 selectedWorkDocFilter=item.sourceDocId;
 selectedWorkItemIds.clear();selectedWorkItemIds.add(item.id);save(`Položka bola pridaná do dokladu ${doc.label}.`)
};
if(false&&$("addWorkAddendum"))$("addWorkAddendum").onclick=()=>{
 const companyAssignment=assignment(state.selectedProjectId,selectedWorkCompanyId),addenda=assignmentAddenda(companyAssignment);
 let sourceDocId="",label="";
 const selected=addenda.find(addendum=>`assignment-addendum:${addendum.id}`===selectedWorkDocFilter);
 if(selected){sourceDocId=`assignment-addendum:${selected.id}`;label=assignmentAddendumLabel(selected)}
 else if(addenda.length){
  const list=addenda.map((addendum,index)=>`${index+1}. ${assignmentAddendumLabel(addendum)} – ${addendum.name} – ${eur.format(parseWorkNumber(addendum.price||0))}`).join("\n"),answer=prompt(`Vyber dodatok firmy:\n\n${list}\n\nZadaj číslo riadku:`,"1");
  if(answer===null)return;const chosen=addenda[Number(answer)-1];if(!chosen){alert("Vyber platné číslo dodatku.");return}
  sourceDocId=`assignment-addendum:${chosen.id}`;label=assignmentAddendumLabel(chosen)
 }else{
  const answer=prompt("Firma ešte nemá evidovaný dodatok. Zadaj číslo dodatku (napr. 1 alebo 1/2026):","");if(answer===null)return;
  label=normalizeWorkDocumentLabel(answer,true);if(!label){alert("Doplň číslo dodatku.");return};sourceDocId=workDocumentId(label)
 }
 const s=getWorkStatement(true),item=createBlankWorkItem(label,sourceDocId);s.items.push(item);s.status="draft";
 selectedWorkDocFilter=item.sourceDocId;
 selectedWorkItemIds.clear();selectedWorkItemIds.add(item.id);
 save(`${label}: nová položka bola pridaná a doklad je otvorený vo filtri.`)
};
if(false&&$("assignWorkDocument"))$("assignWorkDocument").onclick=()=>{
 const s=getWorkStatement(false);
 if(!s||!selectedWorkItemIds.size){alert("Najprv označ aspoň jednu položku.");return}
 const answer=prompt("Napíš ZoD alebo číslo dodatku (napr. 2 alebo 2/2026):","ZoD");
 if(answer===null)return;
 const known=assignmentAddenda(assignment(state.selectedProjectId,selectedWorkCompanyId)).find(addendum=>String(addendum.number||"").trim().toLowerCase()===String(answer).trim().replace(/^dodatok\s*(?:č\.)?\s*/i,"").toLowerCase()),
       label=known?assignmentAddendumLabel(known):normalizeWorkDocumentLabel(answer,!/^zod$/i.test(String(answer).trim())),sourceDocId=known?`assignment-addendum:${known.id}`:workDocumentId(label);
 if(!label){alert("Doplň ZoD alebo číslo dodatku.");return}
 let count=0;
 s.items.forEach(item=>{if(selectedWorkItemIds.has(item.id)){setWorkItemDocument(item,label,sourceDocId);count++}});
 selectedWorkDocFilter=sourceDocId;s.status="draft";s.updatedAt=new Date().toISOString();
 selectedWorkItemIds.clear();save(`${count} položiek bolo priradených k dokladu ${label}.`)
};
$("copyWorkRow").onclick=()=>{
 const s=getWorkStatement(false);
 if(selectedWorkItemIds.size!==1){alert("Na kopírovanie označ presne jeden riadok.");return}
 const item=s?.items.find(x=>selectedWorkItemIds.has(x.id));if(!item)return;
 const copy={...clone(item),id:uid("wi"),budgetItemId:uid("budget"),pc:"",currentQty:""},
       index=s.items.indexOf(item);
 s.items.splice(index+1,0,copy);s.status="draft";selectedWorkItemIds.clear();selectedWorkItemIds.add(copy.id);save("Riadok bol skopírovaný.")
};
$("deleteWorkRow").onclick=()=>{
 const s=getWorkStatement(false),count=selectedWorkItemIds.size;
 if(!s||!count){alert("Označ riadky, ktoré chceš vymazať.");return}
 if(!confirm(`Vymazať označené riadky (${count})?`))return;
 s.items=s.items.filter(item=>!selectedWorkItemIds.has(item.id));s.status="draft";
 selectedWorkItemIds.clear();selectedWorkItemId="";lastWorkSelectionIndex=-1;save(`${count} riadkov bolo vymazaných.`)
};

function workTemplateColumn(headers,aliases,start=0){
 const norm=headers.map(x=>normalizeHeader(x));
 const normalizedAliases=aliases.map(x=>normalizeHeader(x));
 for(const alias of normalizedAliases){
  const exact=norm.findIndex((h,i)=>i>=start&&h===alias);
  if(exact>=0)return exact
 }
 for(const alias of normalizedAliases){
  const partial=norm.findIndex((h,i)=>i>=start&&h&&alias&&h.includes(alias));
  if(partial>=0)return partial
 }
 return -1
}
function findWorkTemplateHeaderRow(rows){
 for(let i=0;i<Math.min(rows.length,60);i++){
  const norm=(rows[i]||[]).map(x=>normalizeHeader(x));
  const hasPc=norm.some(x=>x==="pc"||x==="p c"||x==="p. c."||x==="p. c"||x==="polozka c"||x==="polozka č");
  const hasType=norm.some(x=>x==="typ");
  const hasDesc=norm.some(x=>x.includes("popis"));
  const hasUnit=norm.some(x=>x==="mj"||x==="m.j."||x==="merna jednotka");
  const hasPrice=norm.some(x=>x.includes("j.cena")||x.includes("j cena")||x.includes("jednotkova cena"));
  if((hasPc||hasType)&&hasDesc&&hasUnit&&hasPrice)return i
 }
 return -1
}
function valueForWorkPaste(v){
 const s=String(v??"").trim();
 if(!s)return"";
 if(/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(s)){
  const n=Number(s);
  if(Number.isFinite(n))return String(Math.round(n*1000000)/1000000).replace(".",",")
 }
 return s
}
function parseWorkTemplateRows(rawRows){
 const headerRow=findWorkTemplateHeaderRow(rawRows);
 if(headerRow<0)return{headerRow:-1,rows:[],message:"V súbore som nenašiel hlavičku šablóny súpisu."};
 const headers=rawRows[headerRow]||[],aliases=budgetHeaderAliases();
 const cols={
  pc:workTemplateColumn(headers,aliases.pc),
  type:workTemplateColumn(headers,aliases.type),
  code:workTemplateColumn(headers,aliases.code),
  description:workTemplateColumn(headers,aliases.description),
  unit:workTemplateColumn(headers,aliases.unit),
  contractQty:workTemplateColumn(headers,aliases.contractQty),
  unitPrice:workTemplateColumn(headers,aliases.unitPrice),
  contractTotal:workTemplateColumn(headers,aliases.contractTotal)
 };
 const startAfterTotal=cols.contractTotal>=0?cols.contractTotal+1:0;
 let currentQty=workTemplateColumn(headers,["aktuálne množstvo","aktualne mnozstvo","aktuálne obdobie množstvo","aktualne obdobie mnozstvo"],startAfterTotal);
 if(currentQty<0&&cols.contractTotal>=0){
  const norm=headers.map(x=>normalizeHeader(x));
  currentQty=norm.findIndex((h,i)=>i>cols.contractTotal&&(h==="mnozstvo"||h==="množstvo"))
 }
 cols.currentQty=currentQty;
 if(cols.description<0)return{headerRow,rows:[],message:"V šablóne chýba alebo sa nedal nájsť stĺpec Popis."};
 const output=[];
 for(let i=headerRow+1;i<rawRows.length;i++){
  const r=rawRows[i]||[];
  const get=(key)=>cols[key]>=0?valueForWorkPaste(r[cols[key]]):"";
  const pc=get("pc"),type=get("type"),code=get("code"),description=get("description"),unit=get("unit"),qty=get("contractQty"),price=get("unitPrice"),total=get("contractTotal"),current=get("currentQty");
  const typeUpper=String(type||"").trim().toUpperCase();
  const hasContent=[type,code,description,unit,qty,price,total,current].some(x=>String(x||"").trim()!=="");
  if(!hasContent)continue;
  if(!description&&!(typeUpper==="D"&&code))continue;
  if(!typeUpper&&!description)continue;
  if(/^naklady z rozpoctu$/i.test(normalizeHeader(pc))&&!description)continue;
  output.push([pc,type||(/^(hsv|psv|m|vrn|2|3|4|5|6|7|8|9)$/i.test(code)?"D":"K"),code,description,unit,qty,price,total,current])
 }
 return{headerRow,rows:output,message:`Načítaná hlavička na riadku ${headerRow+1}.`}
}
async function readWorkPasteFile(){
 const file=$("workPasteFile")?.files?.[0],status=$("workPasteFileStatus");
 if(!file){if(status){status.className="work-paste-file-status error";status.textContent="Vyber Excel alebo CSV súbor."}return}
 try{
  if(status){status.className="work-paste-file-status";status.textContent="Načítavam šablónu…"}
  const rawRows=file.name.toLowerCase().endsWith(".csv")?parseCsv(await file.text()):await parseXlsx(file);
  const parsed=parseWorkTemplateRows(rawRows);
  if(!parsed.rows.length){
   if(status){status.className="work-paste-file-status error";status.textContent=parsed.message||"Zo súboru sa nepodarilo načítať žiadne položky."}
   return
  }
  $("workPasteTextarea").value=parsed.rows.map(row=>row.join("\t")).join("\n");
  if(status){status.className="work-paste-file-status success";status.textContent=`${parsed.message} Načítaných ${parsed.rows.length} riadkov. Skontroluj ich a stlač „Vložiť riadky“. `}
 }catch(error){
  if(status){status.className="work-paste-file-status error";status.textContent=`Súbor sa nepodarilo načítať: ${error.message}`}
 }
}

function updateWorkPasteDocNumber(){
 const type=$("workPasteDocType")?.value||"ZoD",wrap=$("workPasteDocNumberLabel"),input=$("workPasteDocNumber");
 const isAddendum=/dodat/i.test(type);
 if(wrap)wrap.classList.toggle("work-paste-doc-number-hidden",!isAddendum);
 if(input){input.required=isAddendum;if(!isAddendum)input.value=""}
}
$("pasteWorkRows").onclick=()=>{
 const doc=selectedWorkDocument();
 $("workPasteTextarea").value="";
 if($("workPasteFile"))$("workPasteFile").value="";
 if($("workPasteFileStatus")){ $("workPasteFileStatus").className="work-paste-file-status";$("workPasteFileStatus").textContent="Súbor sa len načíta do poľa nižšie; samotné vloženie spravíš tlačidlom „Vložiť riadky“."}
 if($("workPasteSelectedDoc"))$("workPasteSelectedDoc").textContent=doc.label;
 $("workPasteModal").classList.remove("hidden");setTimeout(()=>$("workPasteTextarea").focus(),50)
};
if($("workPasteDocType"))$("workPasteDocType").onchange=updateWorkPasteDocNumber;
if($("readWorkPasteFile"))$("readWorkPasteFile").onclick=readWorkPasteFile;
$("confirmWorkPaste").onclick=()=>{
 const rows=parseWorkRows($("workPasteTextarea").value);
 if(!rows.length){alert("Vlož najprv riadky z Excelu.");return}
 const doc=selectedWorkDocument(),s=getWorkStatement(true),label=doc.label;
 addManualRowsToStatement(s,rows,label,doc.id);
 selectedWorkDocFilter=doc.id;
 $("workPasteModal").classList.add("hidden");save(`${rows.length} riadkov bolo vložených do ${label}. Medzi dokladmi prepínaš filtrom hore.`)
};
if($("openBudgetImport"))$("openBudgetImport").onclick=openBudgetImportModal;
if($("loadBudgetToStatement"))$("loadBudgetToStatement").onclick=loadSelectedBudgetToStatement;
if($("readBudgetImport"))$("readBudgetImport").onclick=readBudgetImportFile;
if($("executeBudgetImport"))$("executeBudgetImport").onclick=executeBudgetImport;
if($("executeBudgetImportBottom"))$("executeBudgetImportBottom").onclick=executeBudgetImport;
["budgetImportDocType","budgetImportDocNumber"].forEach(id=>{if($(id))$(id).oninput=renderBudgetImportPreview;if($(id))$(id).onchange=renderBudgetImportPreview});
$("saveWorkStatement").onclick=()=>{
 const s=getWorkStatement(false);if(!s)return;
 s.status="saved";s.savedAt=new Date().toISOString();s.updatedAt=s.savedAt;
 save(`Súpis č. ${s.number} bol uložený.`)
};
if($("saveAndBillWorkStatement"))$("saveAndBillWorkStatement").onclick=()=>{
 const s=getWorkStatement(false);if(!s)return;
 const amount=workItemSummary(s,"currentPrice");
 if(amount<=0){alert("V aktuálnom období nie je suma na fakturáciu. Doplň množstvá alebo ceny položiek.");return}
 const a=assignment(s.projectId,s.companyId),activeDocs=[...new Set((s.items||[]).filter(item=>String(item.type||"").toUpperCase()!=="D"&&Math.abs(workItemCalc(s,item).currentPrice)>.005).map(item=>workItemSourceLabel(item)||"ZoD"))],
       addenda=activeDocs.filter(label=>/dodat/i.test(label)),existing=state.billings.find(record=>record.workStatementId===s.id),now=new Date().toISOString(),
       contractPrice=parseWorkNumber(a?.contractPrice||a?.billingContractPrice||savedBillingContractPrice(s.companyId)||0),
       record={
        id:existing?.id||uid("b"),projectId:s.projectId,companyId:s.companyId,month:s.period,amount:workRound(amount,2),
        contractPrice:contractPrice||"",amendmentNo:addenda.join(", "),workStatementId:s.id,workStatementNo:s.number,
        source:"work-statement",sourceLabel:`Súpis č. ${s.number}`,documents:activeDocs,updatedAt:now
       };
 if(existing)Object.assign(existing,record);else state.billings.push(record);
 storeBillingContractPrice(record.companyId,record.contractPrice,record.projectId);
 s.status="billed";s.savedAt=s.savedAt||now;s.billedAt=now;s.billingId=record.id;s.updatedAt=now;
 save(existing?`Fakturácia zo súpisu č. ${s.number} bola aktualizovaná.`:`Súpis č. ${s.number} bol uložený a pridaný do fakturácie.`);
 showView("billing");
 $("billingCompanyFilter").value=s.companyId;$("billingMonthFilter").value=s.period;$("billingYearFilter").value=s.period.slice(0,4);renderBilling()
};
$("refreshPreviousWork").onclick=()=>{
 const statement=getWorkStatement(false),previous=previousWorkStatement(statement);
 if(!statement||!previous){alert("Pre tento súpis neexistuje predchádzajúci mesačný súpis.");return}
 let matched=0;
 statement.items.forEach(item=>{if(matchingPreviousWorkItem(previous,item))matched++});
 statement.updatedAt=new Date().toISOString();
 save(`Minulé obdobia boli prepočítané z hodnoty Prestavané spolu v ${formatBillingMonth(previous.period)} pre ${matched} položiek.`)
};
$("previousWorkStatement").onclick=()=>{
 const previous=shiftMonth(selectedWorkPeriod||todayMonthValue(),-1),
       exists=state.workStatements.some(x=>x.projectId===state.selectedProjectId&&x.companyId===selectedWorkCompanyId&&x.period===previous);
 selectedWorkPeriod=previous;selectedWorkItemId="";selectedWorkItemIds.clear();lastWorkSelectionIndex=-1;
 if(exists){renderWorkStatements();toast(`Otvorený súpis pre ${formatBillingMonth(previous)}.`)}
 else{
  const create=confirm(`Súpis pre ${formatBillingMonth(previous)} ešte neexistuje. Vytvoriť ho?`);
  if(create){getWorkStatement(true);save(`Vytvorený súpis pre ${formatBillingMonth(previous)}.`)}
  else{selectedWorkPeriod=shiftMonth(previous,1);renderWorkStatements()}
 }
};
$("newWorkStatement").onclick=()=>{
 const current=getWorkStatement(false);
 if(current){
  current.updatedAt=new Date().toISOString();
  commitDirectState()
 }
 const next=shiftMonth(selectedWorkPeriod||todayMonthValue(),1),
       existed=state.workStatements.some(x=>x.projectId===state.selectedProjectId&&x.companyId===selectedWorkCompanyId&&x.period===next);
 selectedWorkPeriod=next;
 const nextStatement=getWorkStatement(true);
 selectedWorkItemId="";selectedWorkItemIds.clear();lastWorkSelectionIndex=-1;
 if(nextStatement){
  nextStatement.updatedAt=new Date().toISOString();
  save(existed
   ?`Otvorený súpis pre ${formatBillingMonth(next)}. Minulé obdobia sú prevzaté z hodnoty Prestavané spolu v ${formatBillingMonth(shiftMonth(next,-1))}.`
   :`Vytvorený súpis pre ${formatBillingMonth(next)}. Do minulých období sa preniesla hodnota Prestavané spolu z ${formatBillingMonth(shiftMonth(next,-1))}.`)
 }else renderWorkStatements()
};
function workItemsWithDocumentSections(statement){
 const output=[];let lastDocument="";
 (statement.items||[]).filter(item=>!isWorkDocSectionItem(item)).forEach(item=>{
  const label=workItemSourceLabel(item)||"ZoD";
  if(label!==lastDocument){output.push(workSectionForDoc(workItemSourceId(item)||workDocumentId(label),label));lastDocument=label}
  output.push(item)
 });
 return output
}
function workExportRows(statement){
 return workItemsWithDocumentSections(statement).map(item=>{
  const c=workItemCalc(statement,item),section=String(item.type||"").toUpperCase()==="D",blankQty=c.priceOnly||section;
  if(section)return[item.pc,item.type,item.code,item.description,item.unit,"","","","","","","","","","",""];
  return[item.pc,item.type,item.code,item.description,item.unit,blankQty?"":c.contractQty,blankQty?"":c.unitPrice,c.contractTotal,blankQty?"":c.currentQty,c.currentPrice,blankQty?"":c.previousQty,c.previousPrice,blankQty?"":c.totalQty,c.totalPrice,blankQty?"":c.remainingQty,c.remainingPrice]
 })
}
function workFileBase(statement){
 const c=company(statement.companyId),safe=v=>String(v||"").replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-");
 return `supis-prac-${safe(c?.name)}-${statement.period}`
}
$("exportWorkCsv").onclick=()=>{
 const s=getWorkStatement(false);if(!s)return;const headers=["P. č.","Typ","Kód","Popis","MJ","Zmluvné množstvo","J. cena","Cena celkom","Aktuálne množstvo","Aktuálna cena","Predchádzajúce množstvo","Predchádzajúca cena","Prestavané spolu množstvo","Prestavané spolu cena","Zostatok množstvo","Zostatok cena"],escCsv=v=>`"${String(v??"").replace(/"/g,'""')}"`;
 const data="\uFEFF"+[headers,...workExportRows(s)].map(r=>r.map(escCsv).join(";")).join("\n"),blob=new Blob([data],{type:"text/csv;charset=utf-8"});downloadWorkBlob(blob,workFileBase(s)+".csv")
};
function downloadWorkBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function xlsxEscape(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function xlsxCol(n){let s="";while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s}
function xlsxCell(ref,value,style=0,formula=""){
 if(formula)return `<c r="${ref}" s="${style}"><f>${xlsxEscape(formula)}</f></c>`;
 if(typeof value==="number"&&Number.isFinite(value))return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
 return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${xlsxEscape(value)}</t></is></c>`
}
$("exportWorkXlsx").onclick=async()=>{
 const s=getWorkStatement(false);if(!s)return;
 const c=company(s.companyId),a=assignment(s.projectId,s.companyId),
       docShort=assignmentDocShort(a),
       zip=new JSZip(),
       dataRows=workExportRows(s),startRow=8,summaryRow=startRow+dataRows.length;
 const meta1=[`Stavba: ${activeProject()?.name||""}`,"","","",`Firma: ${c?.name||""}`,"","","",`${docShort}: ${a?.contractNo||""}`,"","","",`Obdobie: ${formatBillingMonth(s.period)}`,"","",""];
 const meta2=[`Objekt: ${s.object||""}`,"","","",`Súpis č.: ${s.number}`,"","","",`Dátum súpisu: ${fmtDateISO(s.statementDate)}`,"","","",`Trvanie: ${fmtDateISO(s.dateFrom)} – ${fmtDateISO(s.dateTo)}`,"","",""];
 const meta3=[`${docShort} č.: ${a?.contractNo||""}`,"","","",`Predmet činnosti: ${s.scope||a?.scope||""}`,"","","","","","","","","","",""]; 
 const group=[`Rozpočet (${docShort})`,"","","","","","","","Aktuálne obdobie","","Prestavané minulé obdobia","","Prestavané spolu","","Zostatok",""];
 const headers=["P. č.","Typ","Kód položky","Popis položky","MJ","Zmluvné množstvo","J. cena [EUR]","Cena celkom [EUR]","Množstvo","Cena [EUR]","Množstvo","Cena [EUR]","Množstvo","Cena [EUR]","Množstvo","Cena [EUR]"];
 const rows=[["SÚPIS PRÁC"],meta1,meta2,meta3,[],group,headers,...dataRows,
  ["","","","","","REKAPITULÁCIA / SUMA NA FAKTÚRU","",workItemSummary(s,"contractTotal"),"",workItemSummary(s,"currentPrice"),"",workItemSummary(s,"previousPrice"),"",workItemSummary(s,"totalPrice"),"",workItemSummary(s,"remainingPrice")]];
 const styleFor=(ri,ci)=>{
  if(ri===0)return 1;
  if(ri===1||ri===2||ri===3)return 2;
  if(ri===5){
   if(ci<=7)return 3;if(ci<=9)return 4;if(ci<=11)return 5;if(ci<=13)return 6;return 7
  }
  if(ri===6)return 8;
  if(ri===summaryRow)return ci===5?13:([7,9,11,13,15].includes(ci)?14:9);
  if(ci===3)return 15;
  if([5,8,10,12,14].includes(ci))return 10;
  if([6,7,9,11,13,15].includes(ci))return 11;
  return 9
 };
 const sheetRows=rows.map((row,ri)=>`<row r="${ri+1}" ${ri===0?'ht="28" customHeight="1"':ri===5?'ht="36" customHeight="1"':""}>${row.map((v,ci)=>xlsxCell(`${xlsxCol(ci+1)}${ri+1}`,v,styleFor(ri,ci))).join("")}</row>`).join("");
 const merges=["A1:P1","A2:D2","E2:H2","I2:L2","M2:P2","A3:D3","E3:H3","I3:L3","M3:P3","A4:P4","A6:H6","I6:J6","K6:L6","M6:N6","O6:P6"];
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="8" customWidth="1"/><col min="2" max="2" width="7" customWidth="1"/><col min="3" max="3" width="19" customWidth="1"/><col min="4" max="4" width="92" customWidth="1"/><col min="5" max="5" width="8" customWidth="1"/><col min="6" max="16" width="15" customWidth="1"/></cols><sheetData>${sheetRows}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells><pageMargins left="0.25" right="0.25" top="0.6" bottom="0.55" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="8" fitToWidth="1" fitToHeight="0"/><headerFooter><oddHeader>&amp;L&amp;BBetpres s.r.o.&amp;C&amp;BSÚPIS PRÁC&amp;R${xlsxEscape(c?.name||"")}</oddHeader><oddFooter>&amp;L${xlsxEscape(activeProject()?.name||"")}&amp;CStrana &amp;P / &amp;N&amp;R${xlsxEscape(formatBillingMonth(s.period))}</oddFooter></headerFooter></worksheet>`;
 const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.000"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="17"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FF173753"/><name val="Calibri"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF173753"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF2F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F3E7"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F0F8"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF0F5"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF3D8"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FF9FB0BC"/></left><right style="thin"><color rgb="FF9FB0BC"/></right><top style="thin"><color rgb="FF9FB0BC"/></top><bottom style="thin"><color rgb="FF9FB0BC"/></bottom></border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="16"><xf/><xf fontId="1" fillId="2" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="3" fillId="3" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf><xf fontId="2" fillId="2" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="3" fillId="4" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf><xf fontId="3" fillId="5" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf><xf fontId="3" fillId="6" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf><xf fontId="3" fillId="7" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center"/></xf><xf fontId="2" fillId="2" borderId="1" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf borderId="1" applyBorder="1"><alignment vertical="top"/></xf><xf numFmtId="164" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf><xf numFmtId="165" borderId="1" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right"/></xf><xf fontId="3" fillId="3" borderId="1" applyFill="1" applyFont="1" applyBorder="1"/><xf fontId="2" fillId="2" borderId="1" applyFill="1" applyFont="1" applyBorder="1"/><xf fontId="2" fillId="2" borderId="1" numFmtId="165" applyFill="1" applyFont="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right"/></xf><xf borderId="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;
 zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
 zip.folder("_rels").file(".rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
 zip.folder("xl").file("workbook.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Súpis prác" sheetId="1" r:id="rId1"/></sheets></workbook>`);
 zip.folder("xl").folder("_rels").file("workbook.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
 zip.folder("xl").folder("worksheets").file("sheet1.xml",sheet);zip.folder("xl").file("styles.xml",styles);
 const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});downloadWorkBlob(blob,workFileBase(s)+".xlsx")
};
function workItemSummary(statement,key){return statement.items.filter(x=>String(x.type||"").toUpperCase()!=="D").reduce((sum,x)=>sum+Number(workItemCalc(statement,x)[key]||0),0)}
function workItemSummaryQtyDisplay(statement,key){const items=statement.items.filter(x=>String(x.type||"").toUpperCase()!=="D"),hasQty=items.some(x=>!isWorkPriceOnlyItem(x));return hasQty?workQty(workItemSummary(statement,key)):""}
$("exportWorkPdf").onclick=async()=>{
 const s=getWorkStatement(false);if(!s)return;
 ensureWorkStatementDates(s);
 const project=activeProject(),
       c=company(s.companyId),
       a=assignment(s.projectId,s.companyId),
       previous=previousWorkStatement(s),
       managerFull=project?.manager||"Ing. Peter Baláž – stavbyvedúci",
       managerSigner=managerFull.replace(/\s*[–-]\s*stavbyvedúci.*$/i,"").trim()||"Ing. Peter Baláž",
       supplierSigner=a?.contact||"",
       previousLabel=previous?formatBillingMonth(previous.period):"bez predchádzajúceho obdobia",
       allItems=workItemsWithDocumentSections(s);

 function printRowHtml(item){
  const x=workItemCalc(s,item);
  if(x.section)return`<tr class="section"><td>${esc(item.pc)}</td><td>${esc(item.type)}</td><td>${esc(item.code)}</td><td class="desc" colspan="10">${esc(item.description)}</td></tr>`;
  const q=v=>x.priceOnly?"":workQty(v),m=v=>workMoney(v);
  return`<tr>
   <td>${esc(item.pc)}</td>
   <td>${esc(item.type)}</td>
   <td>${esc(item.code)}</td>
   <td class="desc">${esc(item.description)}</td>
   <td>${esc(item.unit)}</td>
   <td>${q(x.contractQty)}</td>
   <td>${x.priceOnly?"":m(x.unitPrice)}</td>
   <td>${m(x.contractTotal)}</td>
   <td class="current-col">${q(x.currentQty)}</td>
   <td class="current-col">${m(x.currentPrice)}</td>
   <td>${q(x.previousQty)}</td>
   <td>${m(x.previousPrice)}</td>
   <td>${q(x.remainingQty)}</td>
   <td>${m(x.remainingPrice)}</td>
  </tr>`
 }

 function chunkPrintItems(items){
  const regularCapacity=42,
        finalCapacity=36,
        minimumFinalWeight=3,
        rowWeight=item=>String(item?.type||"").toUpperCase()==="D"?1:Math.max(1,Math.ceil(String(item?.description||"").length/70)),
        totalWeight=list=>list.reduce((sum,item)=>sum+rowWeight(item),0);
  if(!items.length)return[[]];
  if(totalWeight(items)<=finalCapacity)return[items];
  const chunks=[],remaining=[...items];
  while(totalWeight(remaining)>finalCapacity){
   const part=[];
   let used=0;
   while(remaining.length){
    const nextWeight=rowWeight(remaining[0]),weightAfter=totalWeight(remaining)-nextWeight;
    if(part.length&&(used+nextWeight>regularCapacity||weightAfter<minimumFinalWeight))break;
    part.push(remaining.shift());
    used+=nextWeight
   }
   if(!part.length)part.push(remaining.shift());
   if(part.length>1&&String(part[part.length-1]?.type||"").toUpperCase()==="D")remaining.unshift(part.pop());
   chunks.push(part)
  }
  chunks.push(remaining);
  return chunks
 }

 const chunks=chunkPrintItems(allItems),
       totalPages=chunks.length,
       printDate=fmtDateISO(s.statementDate),
       periodBounds=`${fmtDateISO(s.dateFrom)} – ${fmtDateISO(s.dateTo)}`,
       scopeText=s.scope||a?.scope||"",
       contractNumber=a?.contractNo||"",
       documentShort=assignmentDocShort(a),
        currentInvoiceTotal=workItemSummary(s,"currentPrice");

 const pages=chunks.map((chunk,index)=>{
  const rows=chunk.map(printRowHtml).join("");
  const isLast=index===totalPages-1;
  const currentRows=chunk.filter(item=>String(item.type||"").toUpperCase()!=="D");
  const currentSummary=(key)=>currentRows.reduce((sum,item)=>sum+Number(workItemCalc(s,item)[key]||0),0);

  return `<section class="ws-page ${index>0?"ws-continuation":""}">
   <div class="ws-sheet">
    <div class="ws-continue-head">
     <strong>SÚPIS VYKONANÝCH PRÁC</strong>
     <span>SVP ${esc(s.number)} · ${esc(c?.name||"")} · ${esc(periodBounds)} · List ${index+1}/${totalPages}</span>
    </div>
    <header class="ws-header">
     <div class="ws-brand">
      <img src="${BETPRES_LOGO_IMAGE}" alt="Betpres">
      <div>
       <div class="ws-brand-name">BETPRES</div>
       <div class="ws-brand-sub">stavebná evidencia</div>
      </div>
     </div>
     <div class="ws-title-wrap">
      <h1>SÚPIS VYKONANÝCH PRÁC</h1>
      <div class="ws-period"><strong>Mesačné čerpanie</strong> &nbsp;·&nbsp; ${esc(periodBounds)} &nbsp;·&nbsp; SVP ${esc(s.number)}</div>
     </div>
     <div class="ws-doc-meta ws-invoice-meta">
      <span class="ws-invoice-label">AKTUÁLNE OBDOBIE</span>
      <strong class="ws-invoice-value">${workMoney(currentInvoiceTotal)}</strong>
      <span class="ws-invoice-note">bez DPH · suma na faktúru</span>
      <div class="ws-doc-detail">
       <span>SVP–${esc(String(s.number||"").replace(/\s+/g,""))} · List ${index+1}/${totalPages}</span>
       <strong>${esc(documentShort)} č. ${esc(contractNumber||"—")}</strong>
      </div>
     </div>
    </header>

    <div class="ws-divider"></div>

    <div class="ws-party-grid">
     <div class="ws-party-box">
      <span class="ws-party-label">OBJEDNÁVATEĽ</span>
      <strong class="ws-party-name">BETPRES, s.r.o.</strong>
      <span class="ws-party-id">IČO 31684343</span>
     </div>
     <div class="ws-party-box">
      <span class="ws-party-label">ZHOTOVITEĽ</span>
      <strong class="ws-party-name" title="${esc(c?.name||"")}">${esc(c?.name||"")}</strong>
      <span class="ws-party-id">IČO ${esc(c?.ico||"")} · DIČ ${esc(c?.dic||"")} · ${esc(documentShort)} č. ${esc(contractNumber||"—")}</span>
     </div>
    </div>

    <div class="ws-project-line"><strong>Stavba:</strong> <span class="ws-project-name">${esc(project?.name||"")}</span> ${scopeText?`<span class="ws-scope">· ${esc(scopeText)}</span>`:""}</div>

    <table class="ws-table">
     <colgroup>
      <col style="width:2.5%">
      <col style="width:3.5%">
      <col style="width:7%">
      <col style="width:23.7%">
      <col style="width:3%">
      <col style="width:6.4%">
      <col style="width:7%">
      <col style="width:7.3%">
      <col style="width:6.2%">
      <col style="width:7%">
      <col style="width:6.2%">
      <col style="width:7%">
      <col style="width:6.2%">
      <col style="width:7%">
     </colgroup>
     <thead>
      <tr class="group-head-row">
       <th rowspan="2">TYP</th>
       <th rowspan="2">KÓD</th>
       <th rowspan="2">PODKÓD</th>
       <th rowspan="2" class="left">POPIS POLOŽKY</th>
       <th rowspan="2">MJ</th>
       <th colspan="3"><span class="group-title">ROZPOČET (${esc(documentShort)})</span></th>
       <th colspan="2"><span class="group-title">AKTUÁLNY MESIAC</span><small>${esc(formatBillingMonth(s.period))}</small></th>
       <th colspan="2"><span class="group-title">DOTERAZ ČERPANÉ</span></th>
       <th colspan="2"><span class="group-title">ZOSTÁVA ČERPAŤ</span></th>
      </tr>
      <tr class="sub-head-row">
       <th><span class="sub-head-label">MNOŽSTVO</span></th>
       <th><span class="sub-head-label">J. CENA €</span></th>
       <th><span class="sub-head-label">CENA €</span></th>
       <th><span class="sub-head-label">MNOŽSTVO</span></th>
       <th><span class="sub-head-label">CENA €</span></th>
       <th><span class="sub-head-label">MNOŽSTVO</span></th>
       <th><span class="sub-head-label">CENA €</span></th>
       <th><span class="sub-head-label">MNOŽSTVO</span></th>
       <th><span class="sub-head-label">CENA €</span></th>
      </tr>
     </thead>
     <tbody>${rows}</tbody>
     ${isLast?`<tfoot>
      <tr>
       <td colspan="7" class="left total-label">CELKOM (bez DPH)</td>
       <td class="total-number">${workMoney(workItemSummary(s,"contractTotal"))}</td>
       <td class="total-number invoice-current-qty">${workItemSummaryQtyDisplay(s,"currentQty")}</td>
       <td class="total-number invoice-current-total">${workMoney(workItemSummary(s,"currentPrice"))}</td>
       <td class="total-number">${workItemSummaryQtyDisplay(s,"previousQty")}</td>
       <td class="total-number">${workMoney(workItemSummary(s,"previousPrice"))}</td>
       <td class="total-number">${workItemSummaryQtyDisplay(s,"remainingQty")}</td>
       <td class="total-number">${workMoney(workItemSummary(s,"remainingPrice"))}</td>
      </tr>
     </tfoot>`:""}
    </table>

    ${isLast?`<div class="ws-bottom">
      ${String(s.note||"").trim()?`<div class="ws-billing-note"><strong>Poznámka k fakturácii:</strong><span>${nl2br(s.note)}</span></div>`:""}
      <div class="ws-city-date">V Košiciach, dňa ${esc(printDate)}</div>
      <div class="ws-sign-grid">
       <div class="ws-sign-box">
        <div class="ws-sign-line"></div>
        <strong>Za zhotoviteľa — ${esc(c?.name||"")}</strong>
        <span>meno, podpis a pečiatka</span>
       </div>
       <div class="ws-sign-box">
        <div class="ws-sign-line"></div>
        <strong>Za objednávateľa — BETPRES, s.r.o.</strong>
        <span>${esc(managerSigner)} · podpis a pečiatka</span>
       </div>
      </div>
     </div>`:`<div class="ws-page-foot"><span>Pokračovanie súpisu na ďalšej strane</span></div>`}
   </div>
  </section>`
 }).join("");

 const pdfHtml=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Súpis prác č. ${s.number}</title>
 <style>
 @page{size:A4 landscape;margin:0}
 *{box-sizing:border-box}
 html,body{margin:0;padding:0;background:#dfe3e7;font-family:Arial,sans-serif;color:#1a2430;-webkit-print-color-adjust:exact;print-color-adjust:exact}
 .ws-page{width:297mm;height:210mm;margin:0 auto 8mm;page-break-after:always;display:flex;align-items:center;justify-content:center}
 .ws-page:last-child{page-break-after:auto}
 .ws-sheet{width:287mm;height:200mm;background:#fff;padding:4mm 4.5mm 5.5mm;position:relative;overflow:hidden}
 .ws-header{display:grid;grid-template-columns:38mm 1fr 48mm;gap:3mm;align-items:center}
 .ws-brand{display:flex;align-items:center;gap:2.5mm}
 .ws-brand img{width:13mm;height:7.5mm;object-fit:contain}
 .ws-brand-name{font-size:4.8mm;font-weight:900;letter-spacing:.1px;color:#26323d;line-height:1}
 .ws-brand-sub{font-size:2.25mm;color:#66707b;font-weight:700;margin-top:.1mm}
 .ws-title-wrap{text-align:center}
 .ws-title-wrap h1{margin:0;font-size:5.7mm;letter-spacing:.15px;color:#283240;line-height:1}
 .ws-subtitle{display:none}
 .ws-period{margin-top:.7mm;font-size:2.45mm;color:#6f7882;line-height:1.05}
 .ws-doc-meta{text-align:right;font-size:2.6mm;color:#6a727c;line-height:1.12}
 .ws-doc-meta strong{display:block;margin:.5mm 0;font-size:3.7mm;color:#2d3642}

 .ws-invoice-meta{
  padding:1.2mm 1.8mm;
  border:.35mm solid #0b3f68;
  border-radius:2.2mm;
  background:#eaf4fa;
  color:#153f5d!important
 }
 .ws-invoice-label{
  display:block;
  font-size:2.25mm;
  font-weight:900;
  letter-spacing:.08em;
  color:#3b6680
 }
 .ws-invoice-value{
  display:block!important;
  margin:.7mm 0 .45mm!important;
  font-size:4.35mm!important;
  line-height:1!important;
  color:#0a365a!important;
  font-variant-numeric:tabular-nums
 }
 .ws-invoice-note{
  display:block;
  font-size:2.15mm;
  color:#52758b;
  font-weight:800
 }
 .ws-doc-detail{
  margin-top:1mm;
  padding-top:.8mm;
  border-top:.25mm solid #b9d0de;
  font-size:2.15mm;
  color:#547184;
  display:grid;
  gap:.45mm
 }
 .ws-doc-detail strong{
  margin:0!important;
  font-size:2.5mm!important;
  line-height:1.05!important;
  color:#123f61!important;
  white-space:nowrap
 }

 .ws-divider{height:.4mm;background:#dadde1;margin:1.2mm 0}
 .ws-party-grid{display:grid;grid-template-columns:1fr 1fr;gap:2mm}
 .ws-party-box{border:.25mm solid #c5c9ce;border-radius:1.8mm;padding:1mm 1.6mm;min-height:9.2mm;overflow:hidden;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:1.6mm;align-items:center}
 .ws-party-label{font-size:2.05mm;font-weight:900;color:#6c7178;letter-spacing:.08mm;white-space:nowrap}
 .ws-party-name{font-size:2.95mm;font-weight:900;line-height:1.02;overflow-wrap:anywhere;word-break:normal;min-width:0}
 .ws-party-id{font-size:2.15mm;color:#6d757e;line-height:1.02;white-space:nowrap}
 .ws-project-line{margin:1.1mm 0 .9mm;font-size:2.55mm;color:#2f3742;line-height:1.05;display:flex;flex-wrap:wrap;gap:.5mm;align-items:baseline}
 .ws-project-line strong{font-size:2.7mm;flex:0 0 auto}.ws-project-name,.ws-scope{overflow-wrap:anywhere;word-break:normal}
 .ws-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.28mm;position:relative;z-index:1}
 .ws-table th,.ws-table td{border:.22mm solid #cfc7b8;padding:.38mm .28mm;vertical-align:top;overflow:visible}
 .ws-table th{background:#f3f3f4;color:#333c46;font-weight:900;text-align:center;font-size:2.08mm;line-height:1.02;vertical-align:middle;white-space:normal;overflow-wrap:anywhere}
 .ws-table td{text-align:right;line-height:1.08;font-variant-numeric:tabular-nums;white-space:nowrap;font-size:2.12mm;letter-spacing:-.055mm}
 .ws-table td.left,.ws-table th.left{text-align:left}
 .ws-table td.desc{text-align:left;white-space:normal!important;overflow-wrap:anywhere;word-break:normal;letter-spacing:0;font-size:2.18mm;line-height:1.12}
 .ws-table tbody tr{height:auto;min-height:6.4mm;break-inside:avoid;page-break-inside:avoid}
 .ws-table tbody tr.section td{background:#eceff3;font-weight:900;text-align:left;white-space:normal;overflow-wrap:anywhere;letter-spacing:0}
 .ws-table .group-head-row th{height:5mm;padding:.35mm .25mm}
 .ws-table .group-title{display:block;font-size:2.1mm;line-height:1}
 .ws-table .group-head-row small{display:block;margin-top:.18mm;font-size:1.72mm;font-weight:800;line-height:1}
 .ws-table .sub-head-row th{height:4.6mm;padding:.28mm .12mm}
 .ws-table .sub-head-label{display:block;font-size:1.82mm;line-height:1;letter-spacing:-.04mm;white-space:normal;overflow-wrap:anywhere}
 .ws-table tfoot td{font-weight:900;background:#f6f1e8;height:5.2mm;padding:.35mm .2mm;line-height:1;vertical-align:middle}
 .ws-table tfoot .total-number{
  font-size:2.12mm!important;
  letter-spacing:-.08mm;
  text-align:right!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
  font-variant-numeric:tabular-nums
 }

 .ws-table tfoot .invoice-current-qty,
 .ws-table tfoot .invoice-current-total{
  background:#cfe8f7!important;
  color:#0a3c62!important;
  border-color:#74aaca!important
 }
 .ws-table tfoot .invoice-current-total{
  font-size:2.55mm!important;
  font-weight:950!important;
  outline:.35mm solid #0b4f7d;
  outline-offset:-.35mm
 }

 
 .total-label{text-align:left!important;font-size:2.18mm!important;padding-left:.8mm!important;white-space:nowrap!important}
 .ws-bottom{position:static;margin-top:2.1mm;padding-top:.8mm;background:#fff;break-inside:avoid;page-break-inside:avoid}
 .ws-billing-note{display:grid;grid-template-columns:38mm minmax(0,1fr);gap:2mm;align-items:start;margin:0 0 2.2mm;padding:1.5mm 2mm;border:.25mm solid #b7c8d4;border-left:1.3mm solid #0b4f7d;border-radius:1.4mm;background:#f3f8fb;font-size:2.45mm;line-height:1.2;color:#2f4657}
 .ws-billing-note strong{color:#0b3f68;text-transform:uppercase;letter-spacing:.04em}
 .ws-billing-note span{white-space:normal;overflow-wrap:anywhere}
 .ws-city-date{font-size:2.55mm;color:#4d5560;margin:0 0 5mm .4mm;line-height:1.1}
 .ws-sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:12mm;break-inside:avoid;page-break-inside:avoid}
 .ws-sign-box{text-align:center}
 .ws-sign-line{height:0;border-top:0.3mm solid #5e6670;margin:0 auto 1.2mm;width:86%}
 .ws-sign-box strong{display:block;font-size:3mm;color:#26303b}
 .ws-sign-box span{display:block;font-size:2.4mm;color:#5c6470}
 .ws-page-foot{position:absolute;left:5mm;right:5mm;bottom:3.5mm;display:flex;justify-content:flex-end;font-size:2.65mm;color:#7a828c}

 .ws-continue-head{display:none}
 .ws-continuation .ws-header,
 .ws-continuation .ws-divider,
 .ws-continuation .ws-party-grid,
 .ws-continuation .ws-project-line{display:none!important}
 .ws-continuation .ws-sheet{padding-top:4mm}
 .ws-continuation .ws-continue-head{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:6mm;
  margin:0 0 2mm;
  padding:1.4mm 2mm;
  border:.25mm solid #b8c6d1;
  border-radius:1.6mm;
  background:#f4f8fb;
  color:#27475d;
  font-size:2.35mm;
  line-height:1.05
 }
 .ws-continuation .ws-continue-head strong{
  color:#123c59;
  font-size:2.8mm;
  white-space:nowrap
 }
 .ws-continuation .ws-continue-head span{
  text-align:right;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap
 }
 .ws-continuation .ws-table{margin-top:0}

 @media print{
  html,body{background:#fff}
  .ws-page{margin:0}
 }
 </style></head><body>${pages}</body></html>`;
 if(window.showPdfPreview||window.betpresDesktop?.exportPdf){
  try{
   const payload={html:pdfHtml,fileName:workFileBase(s)+".pdf",landscape:true,title:`Súpis prác č. ${s.number}`};
   const result=window.showPdfPreview?await window.showPdfPreview(payload):await window.betpresDesktop.exportPdf(payload);
   if(result?.ok)toast("PDF súpisu prác bolo uložené.");
   return result
  }catch(error){alert(`PDF súpisu sa nepodarilo vytvoriť: ${error?.message||error}`)}
  return
 }
 const w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač.");return}
 w.document.write(pdfHtml.replace("</body>","<script>window.onload=()=>setTimeout(()=>window.print(),280)<\\/script></body>"));
 w.document.close()
};


function purchasePriceNumber(value){
 const raw=String(value??"").trim().replace(/[^0-9,.-]/g,"");
 if(!raw)return 0;
 const comma=raw.lastIndexOf(","),dot=raw.lastIndexOf("."),decimal=Math.max(comma,dot);
 let normalized=raw;
 if(comma>=0&&dot>=0)normalized=decimal===comma?raw.replace(/\./g,"").replace(",","."):raw.replace(/,/g,"");
 else if(comma>=0)normalized=raw.replace(/\./g,"").replace(",",".");
 const number=Number(normalized);
 return Number.isFinite(number)?number:0
}
function renderPurchaseFinancialSummary(rows=purchaseRows()){
 const invoiced=rows.filter(row=>String(row.invoiceNo||"").trim()),uninvoiced=rows.filter(row=>!String(row.invoiceNo||"").trim()),
       amount=row=>purchasePriceNumber(row.estimatedPrice||row.credit||""),
       invoicedTotal=invoiced.reduce((sum,row)=>sum+amount(row),0),uninvoicedTotal=uninvoiced.reduce((sum,row)=>sum+amount(row),0),
       missingPrice=rows.filter(row=>!amount(row)).length;
 if($("purchaseAmountTotal"))$("purchaseAmountTotal").textContent=eur.format(invoicedTotal+uninvoicedTotal);
 if($("purchaseAmountInvoiced"))$("purchaseAmountInvoiced").textContent=eur.format(invoicedTotal);
 if($("purchaseAmountUninvoiced"))$("purchaseAmountUninvoiced").textContent=eur.format(uninvoicedTotal);
 if($("purchaseCountInvoiced"))$("purchaseCountInvoiced").textContent=`${invoiced.length} ${invoiced.length===1?"dodací list":"dodacích listov"} s faktúrou`;
 if($("purchaseCountUninvoiced"))$("purchaseCountUninvoiced").textContent=`${uninvoiced.length} ${uninvoiced.length===1?"dodací list":"dodacích listov"} bez faktúry`;
 if($("purchaseCountMissingPrice"))$("purchaseCountMissingPrice").textContent=String(missingPrice)
}
function renderPurchases(){
 if(!$("purchaseTable"))return;
 const months=purchaseMonths(),current=$("purchaseMonthFilter").value,projectRows=state.purchases.filter(x=>x.projectId===state.selectedProjectId),selectedSupplier=$("purchaseSupplierFilter")?.value||"",
       suppliers=[...new Set(projectRows.map(x=>String(x.supplier||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sk"));
 $("purchaseMonthFilter").innerHTML=`<option value="">Všetky mesiace</option>`+months.map(m=>`<option value="${m}" ${m===current?"selected":""}>${m.slice(5)} / ${m.slice(0,4)}</option>`).join("");
 if($("purchaseSupplierFilter"))$("purchaseSupplierFilter").innerHTML=`<option value="">Všetci dodávatelia</option>`+suppliers.map(name=>`<option value="${esc(name)}" ${name===selectedSupplier?"selected":""}>${esc(name)}</option>`).join("");
 if($("materialList"))$("materialList").innerHTML=[...new Set(projectRows.map(x=>String(x.material||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"sk")).map(name=>`<option value="${esc(name)}"></option>`).join("");
 const filterPanel=$("purchaseMaterialSearch")?.closest(".purchase-filter-panel"),filtersActive=Boolean($("purchaseSearch")?.value.trim()||$("purchaseMaterialSearch")?.value.trim()||$("purchaseSupplierFilter")?.value||$("purchaseMonthFilter")?.value);
 filterPanel?.classList.toggle("has-active-filters",filtersActive);

 const allRows=purchaseRows(),pages=Math.max(1,Math.ceil(allRows.length/PURCHASE_PAGE_SIZE));
 renderPurchaseFinancialSummary(allRows);
 purchasePage=Math.min(Math.max(1,purchasePage),pages);
 const start=(purchasePage-1)*PURCHASE_PAGE_SIZE,
       rows=allRows.slice(start,start+PURCHASE_PAGE_SIZE);

 $("purchaseResultCount").textContent=`${allRows.length} riadkov`;
 if($("materialPassportSummary")){
  const last=Math.max(0,...projectRows.map(x=>Number(x.sequence)||0));
  $("materialPassportSummary").textContent=`Pasport skladu: ${projectRows.length} dodacích listov · posledné P. č. ${last||"—"}`
 }
 $("purchasePageInfo").textContent=`Strana ${purchasePage} / ${pages}`;
 $("purchasePrevPage").disabled=purchasePage<=1;
 $("purchaseNextPage").disabled=purchasePage>=pages;

 $("supplierList").innerHTML=[...new Set([...state.purchases.map(x=>x.supplier),...state.companies.map(x=>x.name)].filter(Boolean))]
  .sort((a,b)=>a.localeCompare(b,"sk"))
  .map(x=>`<option value="${esc(x)}"></option>`).join("");

 $("purchaseTable").innerHTML=rows.map((x,i)=>{
  const rowNo=x.sequence||start+i+1,
        source=x.source==="Pasport materiálu"?`<span class="passport-source-mark">pasport</span>`:String(x.source||"").includes("Codex")?`<span class="passport-source-mark">AI</span>`:"";
  return `<tr data-purchase-row="${x.id}">
   <td class="excel-row-number">${esc(rowNo)}</td>
   <td class="excel-cell"><input data-field="date" data-id="${x.id}" data-col="A" value="${esc(excelDate(x.date))}"></td>
   <td class="excel-cell"><input list="supplierList" data-field="supplier" data-id="${x.id}" data-col="B" value="${esc(x.supplier||"")}"></td>
   <td class="excel-cell"><input data-field="documentNo" data-id="${x.id}" data-col="C" value="${esc(x.documentNo||"")}"></td>
   <td class="excel-cell purchase-invoice-cell ${String(x.invoiceNo||"").trim()?"is-invoiced":"is-uninvoiced"}"><input data-field="invoiceNo" data-id="${x.id}" data-col="D" value="${esc(x.invoiceNo||"")}" placeholder="Bez faktúry"></td>
   <td class="excel-cell"><div style="display:flex;align-items:center"><input data-field="material" data-id="${x.id}" data-col="E" value="${esc(x.material||"")}">${source}</div></td>
   <td class="excel-cell"><input data-field="estimatedPrice" data-id="${x.id}" data-col="F" value="${esc(x.estimatedPrice||x.credit||"")}"></td>
   <td class="excel-cell"><div style="display:grid;grid-template-columns:1fr 26px"><input data-field="sequence" data-id="${x.id}" data-col="G" value="${esc(x.sequence||"")}"><button class="excel-delete" title="Vymazať riadok" data-del-purchase="${x.id}">×</button></div></td>
  </tr>`
 }).join("")||`<tr><td class="excel-row-number">1</td><td colspan="7" style="padding:18px;color:#789">Odfotografuj dodací list alebo klikni na „Pridať riadok“.</td></tr>`;

 document.querySelectorAll("#purchaseTable input[data-field]").forEach(inp=>{
  inp.onfocus=()=>{
   beginDirectUndo("Úprava evidencie materiálu");
   document.querySelectorAll(".excel-cell.active").forEach(c=>c.classList.remove("active"));
   inp.closest(".excel-cell").classList.add("active");
   const row=inp.closest("tr"),idx=start+[...$("purchaseTable").children].indexOf(row)+2;
   $("excelCellName").textContent=`${inp.dataset.col}${idx}`;
   $("excelFormula").textContent=inp.value||""
  };
  inp.oninput=()=>{$("excelFormula").textContent=inp.value};
  inp.onchange=()=>savePurchaseCell(inp);
  inp.onblur=()=>{savePurchaseCell(inp);endDirectUndo()};
  inp.onkeydown=e=>{
   if(e.key==="Enter"){
    e.preventDefault();
    const all=[...document.querySelectorAll("#purchaseTable input[data-field]")],i=all.indexOf(inp);
    if(e.shiftKey)all[Math.max(0,i-7)]?.focus();
    else all[Math.min(all.length-1,i+7)]?.focus()
   }
  }
 });

 document.querySelectorAll("[data-del-purchase]").forEach(b=>b.onclick=()=>{
  if(confirm("Vymazať tento riadok?")){
   state.purchases=state.purchases.filter(x=>x.id!==b.dataset.delPurchase);
   save("Riadok bol vymazaný.")
  }
 })
}
function savePurchaseCell(inp){const x=state.purchases.find(v=>v.id===inp.dataset.id);if(!x)return;let value=inp.value.trim();if(inp.dataset.field==="date"){value=parseExcelDate(value);inp.value=excelDate(value)}x[inp.dataset.field]=value;commitDirectState();$("excelStatus").textContent=`Uložené ${new Date().toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"})}`;if(inp.dataset.field==="invoiceNo"){const cell=inp.closest(".purchase-invoice-cell");cell?.classList.toggle("is-invoiced",Boolean(value));cell?.classList.toggle("is-uninvoiced",!value)}renderPurchaseFinancialSummary(purchaseRows());renderDashboard()}
function deliveryNoteNextSequence(){return String(Math.max(0,...state.purchases.filter(x=>x.projectId===state.selectedProjectId).map(x=>Number(x.sequence)||0))+1)}
function deliveryOcrNormalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
function deliveryOcrPrice(text){
 const values=[];
 String(text||"").split(/\r?\n/).forEach(line=>{
  if(!/(?:€|eur|celkom|spolu|suma)/i.test(line))return;
  const matches=line.match(/\d{1,3}(?:[ .]\d{3})*(?:[,.]\d{2})|\d+[,.]\d{2}/g)||[];
  matches.forEach(raw=>{const n=Number(raw.replace(/[ .](?=\d{3}(?:\D|$))/g,"").replace(",","."));if(Number.isFinite(n)&&n>0&&n<10000000)values.push(n)})
 });
 const value=values.length?Math.max(...values):0;
 return value?value.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":""
}
function deliveryOcrMaterial(text){
 const value=deliveryOcrNormalize(text),categories=[];
 const add=(pattern,label)=>{if(pattern.test(value)&&!categories.includes(label))categories.push(label)};
 add(/vata|mineraln|izolac|isover|ursa|rockwool/,"Vata / tepelná izolácia");
 add(/eps|xps|polystyren/,"EPS / XPS izolácia");
 add(/cement|beton|malta|poter/,"Cement / malta / stavebné zmesi");
 add(/sadrokarton|sdk|profil cw|profil uw/,"Sadrokartónový materiál");
 add(/tehl|tvarnic|ytong|porfix/,"Murivo / tvárnice");
 add(/obrubnik/,"Obrubníky");
 add(/kanal|potrub|rura|koleno|odtok|vpust|poklop/,"Potrubie / kanalizácia");
 add(/kabel|vodic|zasuv|svietid|elektro/,"Elektroinštalačný materiál");
 add(/dlaz|obklad|keram/,"Dlažba / obklad");
 add(/omietk|farb|penetr|stierk/,"Omietky / nátery");
 add(/hydroizol|lepenk|asfalt|ipa/,"Hydroizolačný materiál");
 add(/silikon|tmel|pena|pask|lepid|skrut|kotv|vrtak|foli|rukavic|uter|sprej/,"Spotrebný materiál");
 add(/roxor|vystuz|kari|ocel|profil/,"Oceľ / výstuž / profily");
 add(/drevo|dosk|osb|preglej/,"Drevo / doskový materiál");
 if(categories.length>3)return"Stavebný a spotrebný materiál";
 if(categories.length)return categories.join(", ");
 return"Materiál podľa dodacieho listu"
}
function deliveryOcrDocumentCandidates(line){return(line.match(/\b[A-Z0-9][A-Z0-9._\/-]{2,25}\b/gi)||[]).map(value=>value.replace(/^[._\/-]+|[._\/-]+$/g,"")).filter(value=>/\d/.test(value)&&value.length>=3)}
function deliveryOcrDocumentNumber(text){
 const lines=String(text||"").split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean),
       label=/(dodaci\s*(?:list|doklad)|dod\.?\s*list|cislo\s*(?:dodacieho\s*listu|dokladu)|doklad\s*(?:c|cislo)|delivery\s*note|lieferschein|vydajka|vydajovy\s*doklad|expedicny\s*list)/;
 for(let index=0;index<lines.length;index++){
  if(!label.test(deliveryOcrNormalize(lines[index])))continue;
  const candidates=[lines[index],lines[index+1]||""].flatMap(deliveryOcrDocumentCandidates).filter(value=>!/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(value));
  if(candidates.length)return candidates.sort((a,b)=>(/\d{4,}/.test(b)?1:0)-(/\d{4,}/.test(a)?1:0)||b.length-a.length)[0]
 }
 const scored=[];
 lines.forEach((line,index)=>{
  const normalized=deliveryOcrNormalize(line);
  if(/ico|ic dph|dic|faktur|objednav|iban|telefon|zakaznik|odberatel|prijemca|variabilny|strana/.test(normalized))return;
  deliveryOcrDocumentCandidates(line).forEach(value=>{
   const digits=value.replace(/\D/g,"");
   if(digits.length<5||(/^20\d{6}$/.test(digits)&&!/[A-Za-z]/.test(value)))return;
   scored.push({value,score:(digits.length>=7?4:0)+(index<18?2:0)+(/[A-Za-z]/.test(value)?1:0)-Math.max(0,value.length-20)})
  })
 });
 return scored.sort((a,b)=>b.score-a.score||b.value.length-a.value.length)[0]?.value||""
}
function deliveryOcrDate(text){
 const matches=[...String(text||"").matchAll(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2}|\d{2})\b/g)];
 for(const match of matches){const day=Number(match[1]),month=Number(match[2]),year=Number(match[3])+(match[3].length===2?2000:0);if(day>=1&&day<=31&&month>=1&&month<=12)return`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`}
 return todayISO()
}
function deliveryOcrSupplier(text){
 const lines=String(text||"").split(/\r?\n/).map(value=>value.replace(/\s+/g," ").trim()).filter(Boolean),supplierLabel=/(dodavatel|predavajuci|odosielatel|vystavitel|supplier|vendor)/,
       known=[...new Set([...state.purchases.map(x=>x.supplier),...state.companies.map(x=>x.name)].map(v=>String(v||"").trim()).filter(Boolean))].sort((a,b)=>b.length-a.length),
       found=known.find(name=>lines.slice(0,35).some((line,index)=>deliveryOcrNormalize(line).includes(deliveryOcrNormalize(name))&&!/(odberatel|prijemca|miesto dodania)/.test(deliveryOcrNormalize(`${lines[index-1]||""} ${line}`))));
 if(found)return found;
 for(let index=0;index<lines.length;index++){
  if(!supplierLabel.test(deliveryOcrNormalize(lines[index])))continue;
  const after=lines[index].replace(/^(?:dodávateľ|dodavatel|predávajúci|predavajuci|odosielateľ|odosielatel|vystaviteľ|vystavitel|supplier|vendor)\s*[:.-]?\s*/i,"").trim(),candidates=[after,lines[index+1],lines[index+2]].filter(Boolean);
  const explicit=candidates.find(value=>/[A-Za-zÁ-ž]{3}/.test(value)&&!/(odberateľ|odberatel|príjemca|prijemca|dodací list|dodaci list|číslo|cislo|dátum|datum|ulica|street)/i.test(value)&&value.length<=90);
  if(explicit)return explicit
 }
 const candidates=lines.slice(0,30).map((value,index)=>{
  const item=deliveryOcrNormalize(value);let score=0;
  if(/\b(s\.?\s*r\.?\s*o\.?|a\.?\s*s\.?|spol|gmbh|se|k\.?\s*s\.?)\b/.test(item))score+=8;
  if(/ico|ic dph|dic/.test(deliveryOcrNormalize([lines[index+1],lines[index+2]].filter(Boolean).join(" "))))score+=3;
  if(index<12)score+=2;if(/odberatel|prijemca|miesto dodania|dodaci list|faktura|objednavka|datum|strana|telefon|email|www\./.test(item))score-=12;
  if(!/[A-Za-zÁ-ž]{3}/.test(value)||value.length>90)score-=10;
  return{value,score}
 });
 const best=candidates.sort((a,b)=>b.score-a.score)[0];
 return best?.score>0?best.value:""
}
function parseDeliveryOcr(text){return{date:deliveryOcrDate(text),supplier:deliveryOcrSupplier(text),documentNo:deliveryOcrDocumentNumber(text),invoiceNo:"",material:deliveryOcrMaterial(text),estimatedPrice:deliveryOcrPrice(text),sequence:deliveryNoteNextSequence()}}
function deliveryImageDataUrl(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{const max=2400,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL("image/jpeg",.9))}catch(error){URL.revokeObjectURL(url);reject(error)}};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Fotografiu sa nepodarilo načítať."))};img.src=url})}
let currentDeliveryImageDataUrl="",currentDeliveryAiAnalysis=null;
function deliveryAiMoney(value){const number=Number(value)||0;return number?number.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" €":""}
function deliveryAiCategoryLabel(value){const labels={"Tepelne izolacie":"Tepelné izolácie","Hydroizolacie":"Hydroizolácie","Beton a kamenivo":"Betón a kamenivo","Murivo":"Murivo","Sucha vystavba":"Suchá výstavba","Ocel a vystuz":"Oceľ a výstuž","Stresne materialy":"Strešné materiály","Fasada":"Fasáda","Stavebna chemia":"Stavebná chémia","Drevo a dosky":"Drevo a dosky","Elektro":"Elektro","TZB a instalacie":"TZB a inštalácie","Spojovaci material":"Spojovací materiál","Naradie a spotrebny material":"Náradie a spotrebný materiál","Ostatne":"Ostatné"};return labels[String(value||"")]||String(value||"")}
function fillDeliveryOcrForm(data){
 $("deliveryOcrDate").value=data.date||todayISO();$("deliveryOcrSupplier").value=data.supplier||"";$("deliveryOcrDocumentNo").value=data.documentNo||"";$("deliveryOcrInvoiceNo").value=data.invoiceNo||"";$("deliveryOcrMaterial").value=data.material||"Materiál podľa dodacieho listu";$("deliveryOcrCategory").value=data.category||"";$("deliveryOcrQuantity").value=data.quantity||"";$("deliveryOcrPrice").value=data.estimatedPrice||"";$("deliveryOcrSequence").value=data.sequence||deliveryNoteNextSequence()
}
function resetDeliveryAiReview(){
 currentDeliveryAiAnalysis=null;
 $("deliveryAiConfidence").textContent="Čakám na AI vyhodnotenie.";
 $("deliveryAiMaterialLines").textContent="Po rozpoznaní tu uvidíš materiály, množstvá, prepočet ceny a použité zdroje.";
 $("deliveryAiPriceBasis").textContent=""
}
function renderDeliveryAiReview(result){
 const materials=Array.isArray(result?.materials)?result.materials:[];
 $("deliveryAiConfidence").textContent=`Firma ${Math.round(Number(result?.supplier_confidence)||0)} % · cena ${Math.round(Number(result?.price_confidence)||0)} %`;
 $("deliveryAiMaterialLines").innerHTML=materials.length?materials.map(item=>{
  const quantity=[Number(item.quantity)>0?`${Number(item.quantity).toLocaleString("sk-SK")} ${item.unit||""}`:"",Number(item.pieces)>0?`${Number(item.pieces).toLocaleString("sk-SK")} ks`:"",item.package_description||""].filter(Boolean).join(" · "),
        amount=deliveryAiMoney(item.estimated_total_eur),source=item.source_url?`<a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">${esc(item.source_title||"Zdroj orientačnej ceny")}</a>`:"<small>Bez spoľahlivého online zdroja</small>";
  return`<div class="delivery-ai-line"><strong>${esc(item.normalized_name||item.raw_name||"Neurčený materiál")}</strong><span class="delivery-ai-amount">${esc(amount||"cena neurčená")}</span><small>${esc([deliveryAiCategoryLabel(item.category),quantity,item.product_code?`kód ${item.product_code}`:""].filter(Boolean).join(" · "))}</small>${source}</div>`
 }).join(""):`<div class="delivery-ai-line"><strong>Materiál sa nepodarilo spoľahlivo rozlíšiť.</strong><span></span><small>Skontroluj fotografiu alebo doplň údaje ručne.</small></div>`;
 const range=result?.total_estimate_eur?`Odhad spolu ${deliveryAiMoney(result.total_estimate_eur)} · rozsah ${deliveryAiMoney(result.total_low_eur)} – ${deliveryAiMoney(result.total_high_eur)}.`:"Cena nebola určená.";
 const warnings=(result?.warnings||[]).map(value=>`<div class="delivery-ai-warning">⚠ ${esc(value)}</div>`).join("");
 $("deliveryAiPriceBasis").innerHTML=`<strong>${esc(range)}</strong> ${esc(result?.price_basis||"")}${warnings}`
}
function knownDeliverySuppliers(){return[...new Set([...state.companies.map(x=>x.name),...state.purchases.map(x=>x.supplier)].map(value=>String(value||"").trim()).filter(Boolean))]}
async function analyzeCurrentDeliveryNote(){
 if(!window.betpresDesktop?.analyzeDeliveryNote)throw new Error("Codex AI analýza nie je v tejto verzii dostupná.");
 if(!currentDeliveryImageDataUrl&&!$("deliveryOcrRawText").value.trim())throw new Error("Najprv vyber fotografiu dodacieho listu.");
 $("deliveryOcrStatus").textContent="Codex rozlišuje firmu a materiály a overuje orientačné ceny…";
 const result=await window.betpresDesktop.analyzeDeliveryNote({dataUrl:currentDeliveryImageDataUrl,ocrText:$("deliveryOcrRawText").value,knownSuppliers:knownDeliverySuppliers(),projectName:activeProject()?.name||""});
 currentDeliveryAiAnalysis=result;
 const current={date:$("deliveryOcrDate").value,supplier:$("deliveryOcrSupplier").value,documentNo:$("deliveryOcrDocumentNo").value,invoiceNo:$("deliveryOcrInvoiceNo").value,material:$("deliveryOcrMaterial").value,category:$("deliveryOcrCategory").value,quantity:$("deliveryOcrQuantity").value,estimatedPrice:$("deliveryOcrPrice").value,sequence:$("deliveryOcrSequence").value};
 fillDeliveryOcrForm({date:result.date||current.date,supplier:result.supplier||current.supplier,documentNo:result.delivery_note_number||current.documentNo,invoiceNo:result.invoice_number||current.invoiceNo,material:result.material_summary||current.material,category:deliveryAiCategoryLabel(result.primary_category)||current.category,quantity:result.quantity_summary||current.quantity,estimatedPrice:deliveryAiMoney(result.total_estimate_eur)||current.estimatedPrice,sequence:current.sequence});
 renderDeliveryAiReview(result);
 $("deliveryOcrStatus").textContent=`AI vyhodnotenie dokončené · firma ${Math.round(Number(result.supplier_confidence)||0)} % · cena ${Math.round(Number(result.price_confidence)||0)} % · pred uložením údaje skontroluj.`;
 return result
}
if($("scanDeliveryNote"))$("scanDeliveryNote").onclick=()=>$("deliveryNoteImageInput").click();
if($("deliveryNoteImageInput"))$("deliveryNoteImageInput").onchange=async()=>{
 const file=$("deliveryNoteImageInput").files?.[0];if(!file)return;
 try{
  currentDeliveryImageDataUrl=await deliveryImageDataUrl(file);$("deliveryNotePreview").src=currentDeliveryImageDataUrl;fillDeliveryOcrForm({date:todayISO(),sequence:deliveryNoteNextSequence()});$("deliveryOcrRawText").value="";resetDeliveryAiReview();$("deliveryOcrStatus").textContent="Rozpoznávam text z dodacieho listu…";$("deliveryNoteOcrModal").classList.remove("hidden");
  try{
   if(!window.betpresDesktop?.recognizeDeliveryNote)throw new Error("Lokálne OCR nie je v tejto verzii dostupné.");
   const result=await window.betpresDesktop.recognizeDeliveryNote({dataUrl:currentDeliveryImageDataUrl}),parsed=parseDeliveryOcr(result.text||"");fillDeliveryOcrForm(parsed);$("deliveryOcrRawText").value=result.text||"";$("deliveryOcrStatus").textContent=`Lokálne OCR dokončené · istota ${Math.round(result.confidence||0)} % · spúšťam presnejšiu AI kontrolu…`
  }catch(error){$("deliveryOcrStatus").textContent=`Lokálne OCR sa nepodarilo: ${error?.message||error}. Codex skúsi prečítať priamo fotografiu…`}
  try{await analyzeCurrentDeliveryNote()}catch(error){$("deliveryOcrStatus").textContent=`AI vyhodnotenie sa nepodarilo: ${error?.message||error}. Údaje z OCR môžeš skontrolovať a doplniť ručne.`;$("deliveryAiConfidence").textContent="AI nie je dostupná · zostalo lokálne OCR"}
 }catch(error){$("deliveryOcrStatus").textContent=`Fotografiu sa nepodarilo pripraviť: ${error?.message||error}.`}
 finally{$("deliveryNoteImageInput").value=""}
};
if($("deliveryAiRetry"))$("deliveryAiRetry").onclick=async()=>{try{await analyzeCurrentDeliveryNote()}catch(error){$("deliveryOcrStatus").textContent=`AI vyhodnotenie sa nepodarilo: ${error?.message||error}.`} };
if($("deliveryNoteOcrForm"))$("deliveryNoteOcrForm").onsubmit=event=>{
 event.preventDefault();const documentNo=$("deliveryOcrDocumentNo").value.trim();
 const duplicate=state.purchases.find(x=>x.projectId===state.selectedProjectId&&documentNo&&String(x.documentNo||"").trim().toLowerCase()===documentNo.toLowerCase());
 if(duplicate&&!confirm(`Dodací list ${documentNo} už v pasporte existuje pod P. č. ${duplicate.sequence}. Uložiť ho aj tak?`))return;
 const item={id:uid("pd"),projectId:state.selectedProjectId,date:$("deliveryOcrDate").value||todayISO(),supplier:$("deliveryOcrSupplier").value.trim(),documentNo,invoiceNo:$("deliveryOcrInvoiceNo").value.trim(),material:$("deliveryOcrMaterial").value.trim(),materialCategory:$("deliveryOcrCategory").value.trim(),quantitySummary:$("deliveryOcrQuantity").value.trim(),estimatedPrice:$("deliveryOcrPrice").value.trim(),sequence:$("deliveryOcrSequence").value||deliveryNoteNextSequence(),source:currentDeliveryAiAnalysis?"Codex AI + OCR":"OCR dodací list",ocrText:$("deliveryOcrRawText").value,aiAnalysis:currentDeliveryAiAnalysis,createdAt:new Date().toISOString()};
 state.purchases.push(item);$("deliveryNoteOcrModal").classList.add("hidden");$("purchaseSearch").value="";$("purchaseMaterialSearch").value="";$("purchaseSupplierFilter").value="";$("purchaseMonthFilter").value="";purchasePage=Math.max(1,Math.ceil(purchaseRows().length/PURCHASE_PAGE_SIZE));save(`Dodací list ${documentNo||item.sequence} bol zapísaný do pasportu.`)
};
function addPurchaseRow(){const max=Math.max(0,...state.purchases.filter(x=>x.projectId===state.selectedProjectId).map(x=>Number(x.sequence)||0));const item={id:uid("pd"),projectId:state.selectedProjectId,date:todayISO(),supplier:"",documentNo:"",invoiceNo:"",material:"",estimatedPrice:"",sequence:String(max+1),note:""};state.purchases.push(item);localStorage.setItem(KEY,JSON.stringify(state));$("purchaseSearch").value="";$("purchaseMaterialSearch").value="";$("purchaseSupplierFilter").value="";$("purchaseMonthFilter").value="";purchasePage=Math.max(1,Math.ceil(purchaseRows().length/PURCHASE_PAGE_SIZE));renderPurchases();setTimeout(()=>document.querySelector(`[data-id="${item.id}"][data-field="date"]`)?.focus(),30)}
$("addPurchaseRow").onclick=addPurchaseRow;
[$("purchaseSearch"),$("purchaseMaterialSearch")].forEach(input=>input.oninput=()=>{purchasePage=1;renderPurchases()});
[$("purchaseMonthFilter"),$("purchaseSupplierFilter")].forEach(select=>select.onchange=()=>{purchasePage=1;renderPurchases()});
$("resetPurchaseFilters").onclick=()=>{$("purchaseSearch").value="";$("purchaseMaterialSearch").value="";$("purchaseSupplierFilter").value="";$("purchaseMonthFilter").value="";purchasePage=1;renderPurchases()};
$("purchasePrevPage").onclick=()=>{purchasePage=Math.max(1,purchasePage-1);renderPurchases()};$("purchaseNextPage").onclick=()=>{purchasePage++;renderPurchases()};$("openPurchaseImport").onclick=()=>{showView("excelImport");$("excelImportTarget").value="purchases";$("excelImportTarget").dispatchEvent(new Event("change"))};

$("exportPurchasesPdf").onclick=()=>{
 const rows=purchaseRows();
 if(!rows.length){alert("Nie sú dostupné žiadne riadky na export.");return}

 const project=activeProject(),
       month=$("purchaseMonthFilter").value||"",
       search=$("purchaseSearch").value.trim(),
       perPage=40,
       pageCount=Math.max(1,Math.ceil(rows.length/perPage));

 const projectHeader=(()=>{
  const name=(project?.name||"").toUpperCase();
  if(name.includes("MEDICKÁ"))return "Medická KE";
  return project?.name||"Stavba"
 })();

 const cell=value=>`<div class="cell-clip">${esc(value??"")}</div>`;
 const pages=[];

 for(let pageIndex=0;pageIndex<pageCount;pageIndex++){
  const chunk=rows.slice(pageIndex*perPage,(pageIndex+1)*perPage);
  const body=chunk.map((x,i)=>`<tr>
   <td class="date">${cell(excelDate(x.date))}</td>
   <td>${cell(x.supplier||"")}</td>
   <td>${cell(x.documentNo||"")}</td>
   <td>${cell(x.invoiceNo||"")}</td>
   <td class="material">${cell(x.material||"")}</td>
   <td class="value">${cell(x.estimatedPrice||x.credit||"")}</td>
   <td class="pc">${cell(x.sequence||pageIndex*perPage+i+1)}</td>
  </tr>`).join("");

  pages.push(`<section class="passport-sheet">
   <div class="passport-topline">
    <div class="passport-project">${esc(projectHeader)}</div>
    <div class="passport-name">Pasport materiálu</div>
   </div>

   ${month||search?`<div class="passport-subline">${
      month?`Obdobie: ${esc(formatBillingMonth(month))}`:""
     }${
      month&&search?" &nbsp;&nbsp; ":""
     }${
      search?`Filter: ${esc(search)}`:""
     }</div>`:""}

   <table class="passport-table">
    <colgroup>
     <col style="width:10%">
     <col style="width:18%">
     <col style="width:15%">
     <col style="width:14%">
     <col style="width:28%">
     <col style="width:10%">
     <col style="width:5%">
    </colgroup>
    <thead><tr>
     <th>Dátum</th>
     <th>Dodávateľ</th>
     <th>Číslo<br>dokladu</th>
     <th>Faktúra<br>číslo</th>
     <th>Názov materiálu</th>
     <th>Orientačná<br>cena</th>
     <th>P. č.</th>
    </tr></thead>
    <tbody>${body}</tbody>
   </table>

   <div class="passport-page-number">Strana ${pageIndex+1} / ${pageCount}</div>
  </section>`)
 }

 const w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač. Povoľ vyskakovacie okná.");return}

 w.document.write(`<!doctype html><html lang="sk"><head><meta charset="utf-8">
 <title>Pasport materiálu – ${esc(project?.name||"")}</title>
 <style>
 @page{size:A4 portrait;margin:0}
 *{box-sizing:border-box}
 html,body{
  margin:0;padding:0;background:#dfe2e5;font-family:Arial,sans-serif;color:#111;
  -webkit-print-color-adjust:exact;print-color-adjust:exact
 }
 .passport-sheet{
  position:relative;width:210mm;height:297mm;background:#fff;margin:0 auto 6mm;
  padding:10mm 10mm 13mm;page-break-after:always;overflow:hidden
 }
 .passport-sheet:last-child{page-break-after:auto}
 .passport-topline{
  height:13mm;display:flex;justify-content:space-between;align-items:flex-start;
  font-weight:700;padding:0 6mm;margin:0
 }
 .passport-project,.passport-name{font-size:12px;font-weight:700;line-height:1.1}
 .passport-subline{
  height:5mm;margin:0 6mm 2mm;font-size:8px;color:#555;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis
 }
 .passport-table{
  width:calc(100% - 20mm);margin:0 auto;border-collapse:collapse;
  table-layout:fixed;font-size:8.2px
 }
 .passport-table thead tr{height:10mm}
 .passport-table tbody tr{height:5.75mm;max-height:5.75mm}
 .passport-table th,.passport-table td{
  border:0.25mm solid #222;padding:0.65mm 0.8mm;vertical-align:middle;
  line-height:1.08;overflow:hidden
 }
 .passport-table th{
  height:10mm;text-align:center;font-weight:700;background:#fff;font-size:7.7px
 }
 .passport-table td{
  height:5.75mm;max-height:5.75mm
 }
 .cell-clip{
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;
  max-height:4.35mm;overflow:hidden;word-break:break-word;overflow-wrap:anywhere
 }
 .passport-table td.date,
 .passport-table td.pc{text-align:center;white-space:nowrap}
 .passport-table td.value{text-align:right}
 .passport-table td.pc{
  font-weight:700;font-variant-numeric:tabular-nums
 }
 .passport-table td.material .cell-clip{font-size:8px}
 .passport-page-number{
  position:absolute;right:9mm;bottom:5mm;font-size:9px;color:#333;
  font-variant-numeric:tabular-nums
 }
 @media print{
  html,body{background:#fff}
  .passport-sheet{margin:0}
 }
 </style></head><body>${pages.join("")}
 <script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script>
 </body></html>`);
 w.document.close()
};
$("exportPurchasesCsv").onclick=()=>{const rows=purchaseRows(),escCsv=v=>`"${String(v??"").replace(/"/g,'""')}"`;const data="\uFEFF"+[["Dátum","Dodávateľ","Číslo dodacieho listu","Faktúra číslo","Názov materiálu","Orientačná cena","P. č."],...rows.map(x=>[excelDate(x.date),x.supplier,x.documentNo,x.invoiceNo,x.material,x.estimatedPrice||x.credit||"",x.sequence])].map(r=>r.map(escCsv).join(";")).join("\n");const blob=new Blob([data],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`pasport-skladu-${todayISO()}.csv`;a.click();URL.revokeObjectURL(url)};

$("workerMonth").value=selectedWorkerMonth;
$("undoBtn").onclick=undoLast;
document.addEventListener("keydown",e=>{
 const key=e.key.toLowerCase();
 if((e.ctrlKey||e.metaKey)&&key==="z"){
  const tag=document.activeElement?.tagName;
  if(!["INPUT","TEXTAREA"].includes(tag)){e.preventDefault();undoLast()}
 }
 if((e.ctrlKey||e.metaKey)&&key==="p"){
  const active=document.querySelector(".view.active")?.id;
  if(active==="handover"){e.preventDefault();printDoc()}
  if(active==="siteMeetings"){e.preventDefault();printSiteMeetingList()}
 }
});
window.addEventListener("afterprint",()=>document.body.classList.remove("printing-handover"));

let siteDeskUiObserverFrame=0;
const siteDeskUiObserver=new MutationObserver(changes=>{
 if(!changes.some(change=>change.addedNodes.length)||siteDeskUiObserverFrame)return;
 siteDeskUiObserverFrame=requestAnimationFrame(()=>{
  siteDeskUiObserverFrame=0;
  applySiteDesk3UI()
 })
});
siteDeskUiObserver.observe(document.body,{childList:true,subtree:true});



$("saveCloudConfig").onclick=()=>{
 cloudConfig.url=normalizeCloudUrl($("cloudProjectUrl").value);
 cloudConfig.key=$("cloudPublishableKey").value.trim();
 cloudConfig.workspaceName=$("cloudWorkspaceName").value.trim()||"Medická – pilot";
 cloudConfig.displayName=$("cloudDisplayName").value.trim()||cloudConfig.displayName||"";
 saveCloudConfig();
 renderCloudPanel();
 toast("Nastavenie cloudu bolo uložené.")
};
$("exportCloudConnection").onclick=()=>{
 if(!cloudConfigured())return toast("Najprv ulož cloudové pripojenie.");
 const configFile={
  type:"BETPRES_SITEDESK_CONNECTION",
  version:"4.4",
  url:cloudConfig.url,
  publishableKey:cloudConfig.key,
  workspaceName:cloudConfig.workspaceName,
  email:cloudSessionUser()?.email||cloudConfig.lastEmail||""
 };
 const blob=new Blob([JSON.stringify(configFile,null,2)],{type:"application/json"}),
       url=URL.createObjectURL(blob),
       link=document.createElement("a");
 link.href=url;
 link.download="BETPRES_SiteDesk_pripojenie_Medicka.json";
 link.click();
 URL.revokeObjectURL(url)
};
$("importCloudConnection").onchange=event=>{
 const file=event.target.files[0];
 if(!file)return;
 const reader=new FileReader();
 reader.onload=()=>{
  try{
   const data=JSON.parse(reader.result);
   if(data.type!=="BETPRES_SITEDESK_CONNECTION"||!data.url||!data.publishableKey)throw new Error("Neplatný súbor");
   cloudConfig.url=normalizeCloudUrl(data.url);
   cloudConfig.key=String(data.publishableKey);
   cloudConfig.workspaceName=data.workspaceName||"Medická – pilot";
   cloudConfig.lastEmail=String(data.email||cloudConfig.lastEmail||"");
   saveCloudConfig();
   renderCloudPanel();
   toast("Pripojenie bolo importované.")
  }catch{alert("Súbor nie je platné pripojenie BETPRES SiteDesk.")}
 };
 reader.readAsText(file);
 event.target.value=""
};
$("testCloudConnection").onclick=testCloudConnection;
$("pairMobileDevice").onclick=openMobilePairing;
$("copyMobilePairingLink").onclick=copyMobilePairingLink;
$("openMobilePairingLink").onclick=()=>window.open($("mobilePairingLink").value,"_blank","noopener");
$("cloudSignIn").onclick=cloudSignIn;
$("cloudSignUp").onclick=cloudSignUp;
$("cloudSignOut").onclick=cloudSignOut;
$("cloudPushData").onclick=()=>cloudPush();
$("cloudForcePush").onclick=()=>{
 if(confirm("Naozaj prepísať cloud aktuálnymi lokálnymi dátami?"))cloudPush({force:true})
};
$("cloudPullData").onclick=()=>{
 if(confirm("Načítať cloudové dáta a nahradiť nimi aktuálne lokálne údaje? Lokálna záloha sa vytvorí automaticky."))cloudPull()
};
$("cloudRefreshStatus").onclick=async()=>{await cloudRefreshWorkspaceStatus();await cloudLoadTeamContext()};
$("teamAddMember").onclick=cloudAddTeamMember;
$("refreshTeamActivity").onclick=()=>cloudLoadTeamContext();
$("submitPilotFeedback").onclick=cloudSubmitPilotFeedback;
$("cloudAutoSync").onchange=event=>{
 if(!["owner","editor"].includes(cloudConfig.currentRole)){
  event.target.checked=false;
  return toast("Účet s prístupom na čítanie nemôže zapnúť automatické ukladanie.")
 }
 cloudConfig.autoSync=event.target.checked;
 saveCloudConfig();
 startCloudPolling();
 if(cloudConfig.autoSync)queueCloudPush();
 renderCloudPanel()
};

$("addDefectBtn").onclick=()=>openDefectEditor();
$("defectCompany").onchange=()=>{
 $("defectResponsible").value=defectCompanyResponsible($("defectCompany").value)
};
$("defectForm").onsubmit=event=>{
 event.preventDefault();
 const existing=state.defects.find(item=>item.id===editingDefectId),
       record={
        id:editingDefectId||uid("defect"),
        projectId:state.selectedProjectId,
        companyId:$("defectCompany").value,
        number:$("defectNumber").value.trim()||nextDefectNumber(),
        location:$("defectLocation").value.trim(),
        description:$("defectDescription").value.trim(),
        dueDate:$("defectDueDate").value,
        severity:$("defectSeverity").value,
        status:$("defectStatus").value,
        responsible:$("defectResponsible").value.trim()||defectCompanyResponsible($("defectCompany").value),
        photos:clone(pendingDefectPhotos),
        createdAt:existing?.createdAt||new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        sentAt:$("defectStatus").value==="Odoslaná firme"?(existing?.sentAt||new Date().toISOString()):(existing?.sentAt||"")
       };
 if(existing)Object.assign(existing,record);
 else state.defects.push(record);
 $("defectModal").classList.add("hidden");
 editingDefectId="";
 pendingDefectPhotos=[];
 save(existing?"Vada bola upravená.":"Vada bola pridaná.")
};
$("defectPhotoFiles").onchange=async event=>{
 const files=[...event.target.files].slice(0,8-pendingDefectPhotos.length);
 for(const file of files){
  try{pendingDefectPhotos.push(await compressDefectPhoto(file))}
  catch(error){console.error(error);toast("Fotografiu sa nepodarilo načítať.")}
 }
 event.target.value="";
 renderDefectPhotoEditor()
};
[$("defectSearch"),$("defectCompanyFilter"),$("defectStatusFilter"),$("defectDeadlineFilter")].forEach(element=>{
 element.oninput=renderDefects;
 element.onchange=renderDefects
});
$("selectAllDefects").onchange=event=>{
 const visible=filteredDefects();
 visible.forEach(item=>event.target.checked?selectedDefectIds.add(item.id):selectedDefectIds.delete(item.id));
 renderDefects()
};
$("clearDefectSelection").onclick=()=>{selectedDefectIds.clear();renderDefects()};
$("markDefectsSent").onclick=()=>{
 state.defects.forEach(item=>{
  if(selectedDefectIds.has(item.id)){
   item.status="Odoslaná firme";
   item.sentAt=item.sentAt||new Date().toISOString();
   item.updatedAt=new Date().toISOString()
  }
 });
 selectedDefectIds.clear();
 save("Vybrané vady boli označené ako odoslané.")
};
$("exportSelectedDefectsPdf").onclick=exportDefectsPdf;


/* BETPRES SiteDesk 5.0.36 – preberacie protokoly */
function acceptanceNumberValue(value){
 const raw=String(value||"").replace(/€/g,"").replace(/bez DPH/gi,"").replace(/\s+/g,"").replace(/,/g,".");
 const matches=raw.match(/[+-]?\d+(?:\.\d+)?/g);
 if(!matches||!matches.length)return 0;
 return Number(matches[matches.length-1])||0
}
function acceptanceMoney(value){
 const n=Number(value)||0;
 return n.toLocaleString("sk-SK",{minimumFractionDigits:2,maximumFractionDigits:2})+" € bez DPH"
}
function acceptanceAdditionsSum(text){
 return String(text||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).reduce((sum,line)=>sum+acceptanceNumberValue(line),0)
}
function acceptanceProtocolNoFromContract(contract){
 const value=String(contract||"").trim();
 return value?`PP-${value}`:""
}
function acceptanceRecalculatePrices(){
 if(!$("acceptanceContractPrice")||!$("acceptanceActualPrice"))return;
 const base=acceptanceNumberValue($("acceptanceContractPrice").value);
 const add=acceptanceAdditionsSum($("acceptanceAdditions")?.value||"");
 if($("acceptanceAdditionsPrice"))$("acceptanceAdditionsPrice").value=acceptanceMoney(add);
 $("acceptanceActualPrice").value=base||add?acceptanceMoney(base+add):""
}
function acceptanceFillFromAssignment(companyId,force=false){
 const a=assignment(state.selectedProjectId,companyId),c=company(companyId);
 if(!a&&!c)return;
 if((force||!$("acceptanceSupplierRep").value))$("acceptanceSupplierRep").value=a?.contact||c?.contact||"";
 if((force||!$("acceptanceContractNo").value))$("acceptanceContractNo").value=a?.contractNo||"";
 if((force||!$("acceptanceProtocolNo").value))$("acceptanceProtocolNo").value=acceptanceProtocolNoFromContract(a?.contractNo||"");
 if((force||!$("acceptanceSubject").value))$("acceptanceSubject").value=a?.scope||"";
 if((force||!$("acceptanceContractStart").value))$("acceptanceContractStart").value=a?.contractStart||"";
 if((force||!$("acceptanceContractEnd").value))$("acceptanceContractEnd").value=a?.contractEnd||"";
 if((force||!$("acceptanceContractPrice").value))$("acceptanceContractPrice").value=a?.contractPrice||"";
 acceptanceRecalculatePrices()
}
const betpresOpenAssignmentOriginal=typeof openAssignment==="function"?openAssignment:null;
openAssignment=function(companyId=""){
 const existing=companyId?assignment(state.selectedProjectId,companyId):null;
 const list=availableCompanies(companyId);
 $("assignmentId").value=existing?.id||"";
 $("assignCompanyTitle").textContent=existing?"Zmeniť doklad a predmet činnosti":"Priradiť existujúcu firmu";
 $("assignProjectName").textContent=activeProject()?.name||"";
 $("assignCompanySelect").innerHTML=optionList(list,companyId,x=>x.name,"Vyber firmu");
 $("assignCompanySelect").disabled=!!existing;
 $("assignContractType").value=assignmentDocType(existing||{});
 $("assignContract").value=existing?.contractNo||"";
 if($("assignContractStart"))$("assignContractStart").value=existing?.contractStart||"";
 if($("assignContractEnd"))$("assignContractEnd").value=existing?.contractEnd||"";
 if($("assignContractPrice"))$("assignContractPrice").value=existing?.contractPrice||"";
 $("assignScope").value=existing?.scope||company(companyId)?.scope||"";
 $("assignCompanyModal").classList.remove("hidden");
 renderAssignmentPreview();
 setTimeout(()=>existing?$("assignContract").focus():$("assignCompanySelect").focus(),60)
};
if($("assignCompanyForm"))$("assignCompanyForm").onsubmit=e=>{
 e.preventDefault();
 const assignmentId=$("assignmentId").value,companyId=$("assignCompanySelect").value;
 if(!companyId)return;
 let a=assignmentId?state.assignments.find(x=>x.id===assignmentId):assignment(state.selectedProjectId,companyId);
 if(!a){a={id:uid("a"),projectId:state.selectedProjectId,companyId};state.assignments.push(a)}
 a.contractType=$("assignContractType").value||"ZoD";
 a.contractNo=$("assignContract").value.trim();
 a.contractStart=$("assignContractStart")?.value||"";
 a.contractEnd=$("assignContractEnd")?.value||"";
 a.contractPrice=$("assignContractPrice")?.value.trim()||"";
 a.scope=$("assignScope").value.trim();
 $("assignCompanySelect").disabled=false;
 $("assignCompanyModal").classList.add("hidden");
 save(assignmentId?"Doklad, termíny a cena boli upravené.":"Firma bola priradená ku stavbe.")
};
openAcceptance=function(id="",prefillCompanyId=""){
 const x=id?state.acceptanceProtocols.find(v=>v.id===id):null;
 currentAcceptanceId=id;
 $("acceptanceModalTitle").textContent=id?"Upraviť preberací protokol":"Nový preberací protokol";
 $("acceptanceId").value=id;
 const selectedCompanyId=x?.companyId||prefillCompanyId||"";
 const baseAssignment=selectedCompanyId?assignment(state.selectedProjectId,selectedCompanyId):null;
 const companies=projectCompanies();
 $("acceptanceCompany").innerHTML=optionList(companies,selectedCompanyId,v=>v.name,"Vyber firmu");
 $("acceptanceDate").value=x?.date||todayISO();
 $("acceptanceProtocolNo").value=x?.protocolNo||acceptanceProtocolNoFromContract(baseAssignment?.contractNo||"");
 $("acceptanceContractNo").value=x?.contractNo||baseAssignment?.contractNo||"";
 $("acceptanceSubject").value=x?.subject||baseAssignment?.scope||"";
 $("acceptanceAdditions").value=x?.additions||"";
 $("acceptanceLocation").value=x?.location||"";
 $("acceptanceContractStart").value=x?.contractStart||baseAssignment?.contractStart||"";
 $("acceptanceContractEnd").value=x?.contractEnd||baseAssignment?.contractEnd||"";
 $("acceptanceActualStart").value=x?.actualStart||"";
 $("acceptanceActualEnd").value=x?.actualEnd||"";
 $("acceptanceContractPrice").value=x?.contractPrice||baseAssignment?.contractPrice||"";
 $("acceptanceResult").value=x?.result||"Prevzaté bez vád";
 $("acceptanceDocuments").value=Array.isArray(x?.documents)?x.documents.join("\n"):(x?.documentsText||"");
 $("acceptanceNotes").value=x?.notes||"";
 $("acceptanceClientRep").value=x?.clientRep||activeProject()?.manager||"";
 $("acceptanceSupplierRep").value=x?.supplierRep||baseAssignment?.contact||company(selectedCompanyId)?.contact||"";
 acceptanceRecalculatePrices();
 $("acceptanceModal").classList.remove("hidden")
};
if($("acceptanceCompany"))$("acceptanceCompany").onchange=()=>acceptanceFillFromAssignment($("acceptanceCompany").value,true);
["acceptanceContractPrice","acceptanceAdditions"].forEach(id=>{if($(id))$(id).addEventListener("input",acceptanceRecalculatePrices)});
if($("acceptanceForm"))$("acceptanceForm").onsubmit=e=>{
 e.preventDefault();
 acceptanceRecalculatePrices();
 const id=$("acceptanceId").value||uid("ap");
 const docs=$("acceptanceDocuments").value.split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const record={id,projectId:state.selectedProjectId,companyId:$("acceptanceCompany").value,date:$("acceptanceDate").value,protocolNo:$("acceptanceProtocolNo").value.trim()||acceptanceProtocolNoFromContract($("acceptanceContractNo").value),contractNo:$("acceptanceContractNo").value.trim(),subject:$("acceptanceSubject").value.trim(),additions:$("acceptanceAdditions").value.trim(),additionsPrice:$("acceptanceAdditionsPrice")?.value||"",location:$("acceptanceLocation").value.trim(),contractStart:$("acceptanceContractStart").value||"",contractEnd:$("acceptanceContractEnd").value||"",actualStart:$("acceptanceActualStart").value||"",actualEnd:$("acceptanceActualEnd").value||"",contractPrice:$("acceptanceContractPrice").value.trim(),actualPrice:$("acceptanceActualPrice").value.trim(),result:$("acceptanceResult").value,documents:docs,documentsText:docs.join("\n"),notes:$("acceptanceNotes").value.trim(),clientRep:$("acceptanceClientRep").value.trim(),supplierRep:$("acceptanceSupplierRep").value.trim(),updatedAt:new Date().toISOString()};
 if($("acceptanceId").value)state.acceptanceProtocols=state.acceptanceProtocols.map(x=>x.id===id?record:x);else state.acceptanceProtocols.push(record);
 saveDocumentVersion("acceptance",record,$("acceptanceId").value?"Úprava preberacieho protokolu":"Vytvorenie preberacieho protokolu");
 $("acceptanceModal").classList.add("hidden");save("Uloženie preberacieho protokolu")
};
function acceptancePartiesHtml(p,c,a,x){
 const client={org:"BETPRES, s.r.o.",addr:"Boženy Němcovej 1698, 093 01 Vranov nad Topľou",ico:"31684343",dic:"SK 2020527861",rep:x.clientRep||p?.manager||""};
 const contractor={org:c?.name||"",addr:[c?.address,c?.postalCity].filter(Boolean).join(", "),ico:c?.ico||"",dic:c?.icdph||c?.dic||"",rep:x.supplierRep||a?.contact||c?.contact||""};
 const group=(label,obj)=>`<tr><td class="vertical" rowspan="5"><span>${label}</span></td><td>Organizácia</td><td><b>${esc(obj.org)}</b></td></tr><tr><td>Adresa</td><td><b>${esc(obj.addr||"—")}</b></td></tr><tr><td>IČO</td><td><b>${esc(obj.ico||"—")}</b></td></tr><tr><td>DIČ / IČ DPH</td><td><b>${esc(obj.dic||"—")}</b></td></tr><tr><td>Oprávnený zástupca</td><td><b>${esc(obj.rep||"—")}</b></td></tr>`;
 return `<table class="ap-table ap-parties"><tr><td class="lbl">Názov stavby</td><td colspan="2"><b>„ ${esc(p?.name||"")} “</b></td></tr>${group("Objednávateľ",client)}${group("Zhotoviteľ",contractor)}</table>`
}
printAcceptance=function(id){
 const x=state.acceptanceProtocols.find(v=>v.id===id);if(!x)return;
 const p=project(x.projectId),c=company(x.companyId),a=assignment(x.projectId,x.companyId),w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač.");return}
 const docs=(Array.isArray(x.documents)?x.documents:[]).filter(Boolean);
 const docRows=(docs.length?docs:["Kópie stavebného denníka","Doklady k odovzdaniu diela"]).concat(["-","-","-"]).slice(0,6).map((d,i)=>`<tr><td>${i<docs.length?i+1:"-"}. ${esc(d)}</td></tr>`).join("");
 const additions=String(x.additions||"").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const addRows=(additions.length?additions:["-"]).map((line,i)=>`<tr><td>${i+1}</td><td>${esc(line)}</td></tr>`).join("");
 const defectRows=String(x.notes||"Bez vád a nedorobkov.").split(/\r?\n/).map(v=>v.trim()).filter(Boolean).map(v=>`<div>• ${esc(v)}</div>`).join("");
 const parties=acceptancePartiesHtml(p,c,a,x);
 const protocolNo=esc(x.protocolNo||acceptanceProtocolNoFromContract(x.contractNo||a?.contractNo)||"PREBERACÍ PROTOKOL");
 const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Preberací protokol</title><style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#111}.ap-page{position:relative;width:210mm;min-height:297mm;overflow:hidden;page-break-after:always}.ap-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.ap-content{position:relative;z-index:1;padding:38mm 16mm 38mm;font-size:10.5px}.ap-title{width:100%;border-collapse:collapse;margin-bottom:6mm}.ap-title td{border:1.5px solid #111;padding:3mm;font-size:12px}.ap-title .main{text-align:center;font-size:14px}.ap-table{width:100%;border-collapse:collapse;margin-bottom:5mm}.ap-table td,.ap-table th{border:1px solid #111;padding:2.1mm;vertical-align:middle}.ap-table .lbl,.ap-table th{background:#f2f5f8;font-weight:700}.ap-parties .vertical{width:13mm;text-align:center;background:#f7f7f7}.ap-parties .vertical span{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700}.ap-section-title{border:1px solid #111;background:#f2f5f8;font-weight:700;padding:2.2mm;margin-top:3mm}.ap-docs{border-collapse:collapse;width:100%}.ap-docs td{border:1px solid #111;padding:2mm}.ap-docwrap{display:grid;grid-template-columns:18mm 1fr}.ap-vlabel{border:1px solid #111;border-right:0;text-align:center;background:#f7f7f7}.ap-vlabel span{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700}.red{color:#d01818;font-weight:700}.ap-sign{height:76mm}.ap-sign td{width:50%;vertical-align:top;padding:4mm}.ap-sign .line{margin-top:20mm}.ap-small{font-size:9.2px;color:#333}.ap-check{font-size:13px}.ap-defects{min-height:82mm;border:1px solid #111;padding:4mm;line-height:1.45}.ap-remarks td{height:12mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.ap-page{margin:0}}</style></head><body>
<section class="ap-page"><img class="ap-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="ap-content"><table class="ap-title"><tr><td class="main"><b>PROTOKOL O ODOVZDANÍ A PREVZATÍ STAVEBNÉHO DIELA</b></td><td style="width:35mm;text-align:center">${protocolNo}</td><td style="width:24mm;text-align:center">str.1/3</td></tr></table>${parties}<table class="ap-table"><tr><td class="lbl" style="width:45mm">Zmluva o dielo/obj. č.</td><td>${esc(x.contractNo||a?.contractNo||"—")}</td></tr><tr><td class="lbl">Predmet Zmluvy o dielo</td><td><i>${esc(x.subject||a?.scope||"—")}</i></td></tr><tr><td class="lbl">Začiatok realizácie podľa ZoD</td><td>${esc(x.contractStart?fmtDateISO(x.contractStart):"—")}</td><td class="lbl">Skutočný začiatok realizácie</td><td>${esc(x.actualStart?fmtDateISO(x.actualStart):"—")}</td></tr><tr><td class="lbl">Dokončenie podľa ZoD</td><td>${esc(x.contractEnd?fmtDateISO(x.contractEnd):"—")}</td><td class="lbl">Skutočný termín dokončenia</td><td class="red">${esc(x.actualEnd?fmtDateISO(x.actualEnd):"—")}</td></tr><tr><td class="lbl">Cena diela podľa ZoD</td><td colspan="3">${esc(x.contractPrice||a?.contractPrice||"—")}</td></tr><tr><td class="lbl">Cena dodatkov spolu</td><td colspan="3">${esc(x.additionsPrice||acceptanceMoney(acceptanceAdditionsSum(x.additions||"")))}</td></tr><tr><td class="lbl">Skutočná cena diela</td><td colspan="3" class="red">${esc(x.actualPrice||"—")}</td></tr></table><div class="ap-section-title">Dodatky k zmluve</div><table class="ap-table"><tr><th style="width:20mm">Č.</th><th>Popis / cena dodatku</th></tr>${addRows}</table><div class="ap-section-title">Po prehliadke diela a technickej dokumentácie vykonali vyššie uvedení zástupcovia objednávateľa a zhotoviteľa preberacie konanie.</div><div class="ap-docwrap"><div class="ap-vlabel"><span>Odovzdané listinné doklady</span></div><table class="ap-docs">${docRows}</table></div></div></section>
<section class="ap-page"><img class="ap-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="ap-content"><table class="ap-title"><tr><td class="main"><b>PROTOKOL O ODOVZDANÍ A PREVZATÍ STAVEBNÉHO DIELA</b></td><td style="width:35mm;text-align:center">${protocolNo}</td><td style="width:24mm;text-align:center">str.2/3</td></tr></table>${parties}<div class="ap-docwrap"><div class="ap-vlabel"><span>Zistené závady a nedorobky – termín odstránenia</span></div><div class="ap-defects">${defectRows}</div></div><table class="ap-table"><tr><td class="lbl" colspan="2">Zmluvné pokuty sa:</td></tr><tr><td class="ap-check">☒ Neuplatňujú</td><td class="ap-check">☐ Uplatňujú</td></tr><tr><td class="lbl" colspan="2">Zrážka za zníženú kvalitu sa:</td></tr><tr><td class="ap-check">☒ Neuplatňuje</td><td class="ap-check">☐ Uplatňuje</td></tr><tr><td class="lbl" colspan="2">Dôvod udelenia zmluvnej pokuty / zrážky:</td></tr><tr><td colspan="2"><b>Nie je</b></td></tr><tr><td class="lbl" colspan="2">Záručná lehota:</td></tr><tr><td colspan="2"><i>Za akosť Diela je 60 mesiacov. Záručná doba začína plynúť odo dňa odovzdania celej stavby Objednávateľom Investorovi.</i></td></tr></table></div></section>
<section class="ap-page"><img class="ap-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="ap-content"><table class="ap-title"><tr><td class="main"><b>PROTOKOL O ODOVZDANÍ A PREVZATÍ STAVEBNÉHO DIELA</b></td><td style="width:35mm;text-align:center">${protocolNo}</td><td style="width:24mm;text-align:center">str.3/3</td></tr></table>${parties}<table class="ap-table ap-remarks"><tr><td class="lbl" style="width:38mm">Objednávateľ</td><td>Prípadné požiadavky investora budú riešené formou reklamácie v záruke.</td></tr><tr><td class="lbl">Zhotoviteľ</td><td>Bez výhrad</td></tr></table><div class="ap-section-title">Tento protokol potvrdzujú svojimi podpismi</div><table class="ap-table ap-sign"><tr><td><b>Za zhotoviteľa:</b><br><br><i>${esc(x.supplierRep||a?.contact||"")}</i><div class="line">podpis</div><div class="line">pečiatka</div><div style="margin-top:25mm"><b>Dátum ${esc(x.date?fmtDateISO(x.date):"")}</b></div></td><td><b>Za objednávateľa:</b><br><br><i>${esc(x.clientRep||p?.manager||"")}</i><div class="line">podpis</div><div class="line">pečiatka</div><div style="margin-top:25mm"><b>Dátum ${esc(x.date?fmtDateISO(x.date):"")}</b></div></td></tr></table></div></section><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
 w.document.write(html);w.document.close()
};


/* BETPRES SiteDesk 5.0.36 – finálne polia a export preberacieho protokolu */
const acceptanceDefaultWarrantyText="Za akosť Diela je 60 mesiacov. Záručná doba začína plynúť odo dňa odovzdania celej stavby Objednávateľom Investorovi.";
const acceptanceDefaultClientStatement="Prípadné požiadavky investora budú riešené formou reklamácie v záruke.";
const acceptanceDefaultSupplierStatement="Bez výhrad";
function acceptanceSetValue(id,value){if($(id))$(id).value=value??""}
function acceptanceGetValue(id){return $(id)?$(id).value:""}
function acceptanceAssignmentAdditionLines(a){
 return assignmentAddenda(a).map(addendum=>`${assignmentAddendumLabel(addendum)} – ${String(addendum.name||"Dodatok k zmluve").trim()} | ${acceptanceMoney(parseWorkNumber(addendum.price||0))}`)
}
function acceptanceMergedAdditions(a,current=""){
 const automatic=acceptanceAssignmentAdditionLines(a),knownNumbers=assignmentAddenda(a).map(item=>String(item.number||"").trim().toLowerCase()).filter(Boolean),manual=String(current||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).filter(line=>{
  const normalized=line.toLowerCase();
  return !knownNumbers.some(number=>normalized.includes("dodatok")&&normalized.includes(number))
 });
 return [...automatic,...manual].join("\n")
}
function acceptanceAdditionItems(text){
 return String(text||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{
  const amount=acceptanceNumberValue(line);
  let no=String(index+1),desc=line,priceText=amount?acceptanceMoney(amount):"";
  const noMatch=line.match(/(?:dodatok\s*č\.?|č\.?|dod\.?)[\s:.-]*([\w\/.-]+)/i);
  if(noMatch)no=noMatch[1];
  if(line.includes("|")){
   const parts=line.split("|").map(v=>v.trim()).filter(Boolean);
   desc=parts.slice(0,-1).join(" | ")||parts[0]||line;
   if(parts.length>1)priceText=acceptanceMoney(acceptanceNumberValue(parts.at(-1)))
  }else{
   desc=line.replace(/[+-]?\s*\d[\d\s.,]*\s*€?(?:\s*bez\s*DPH)?\s*$/i,"").trim()||line
  }
  return{no,desc,amount,priceText}
 })
}
function acceptancePenaltyChecks(value){
 const applied=String(value||"").toLowerCase().includes("uplat")&&!String(value||"").toLowerCase().includes("neuplat");
 return{no:applied?"☐":"☒",yes:applied?"☒":"☐"}
}
function acceptanceQualityChecks(value){
 const applied=String(value||"").toLowerCase().includes("uplat")&&!String(value||"").toLowerCase().includes("neuplat");
 return{no:applied?"☐":"☒",yes:applied?"☒":"☐"}
}
function acceptanceFillFromAssignment(companyId,force=false){
 const a=assignment(state.selectedProjectId,companyId),c=company(companyId);
 if(!a&&!c)return;
 if((force||!acceptanceGetValue("acceptanceSupplierRep")))acceptanceSetValue("acceptanceSupplierRep",a?.contact||c?.contact||"");
 if((force||!acceptanceGetValue("acceptanceContractNo")))acceptanceSetValue("acceptanceContractNo",a?.contractNo||"");
 if((force||!acceptanceGetValue("acceptanceProtocolNo")))acceptanceSetValue("acceptanceProtocolNo",acceptanceProtocolNoFromContract(a?.contractNo||""));
 if((force||!acceptanceGetValue("acceptanceSubject")))acceptanceSetValue("acceptanceSubject",a?.scope||"");
 if((force||!acceptanceGetValue("acceptanceContractStart")))acceptanceSetValue("acceptanceContractStart",a?.contractStart||"");
 if((force||!acceptanceGetValue("acceptanceContractEnd")))acceptanceSetValue("acceptanceContractEnd",a?.contractEnd||"");
 if((force||!acceptanceGetValue("acceptanceActualStart")))acceptanceSetValue("acceptanceActualStart",a?.actualStart||"");
 if((force||!acceptanceGetValue("acceptanceContractPrice")))acceptanceSetValue("acceptanceContractPrice",a?.contractPrice||"");
 if(force||!acceptanceGetValue("acceptanceAdditions"))acceptanceSetValue("acceptanceAdditions",acceptanceMergedAdditions(a,""));
 acceptanceRecalculatePrices()
}
openAcceptance=function(id="",prefillCompanyId=""){
 const x=id?state.acceptanceProtocols.find(v=>v.id===id):null;
 currentAcceptanceId=id;
 $("acceptanceModalTitle").textContent=id?"Upraviť preberací protokol":"Nový preberací protokol";
 $("acceptanceId").value=id;
 const selectedCompanyId=x?.companyId||prefillCompanyId||"";
 const baseAssignment=selectedCompanyId?assignment(state.selectedProjectId,selectedCompanyId):null;
 const companies=projectCompanies();
 $("acceptanceCompany").innerHTML=optionList(companies,selectedCompanyId,v=>v.name,"Vyber firmu");
 acceptanceSetValue("acceptanceDate",x?.date||todayISO());
 acceptanceSetValue("acceptanceProtocolNo",x?.protocolNo||acceptanceProtocolNoFromContract(baseAssignment?.contractNo||""));
 acceptanceSetValue("acceptanceContractNo",x?.contractNo||baseAssignment?.contractNo||"");
 acceptanceSetValue("acceptanceSubject",x?.subject||baseAssignment?.scope||"");
 acceptanceSetValue("acceptanceAdditions",acceptanceMergedAdditions(baseAssignment,x?.additions||""));
 acceptanceSetValue("acceptanceLocation",x?.location||"");
 acceptanceSetValue("acceptanceContractStart",x?.contractStart||baseAssignment?.contractStart||"");
 acceptanceSetValue("acceptanceContractEnd",x?.contractEnd||baseAssignment?.contractEnd||"");
 acceptanceSetValue("acceptanceActualStart",x?.actualStart||baseAssignment?.actualStart||"");
 acceptanceSetValue("acceptanceActualEnd",x?.actualEnd||"");
 acceptanceSetValue("acceptanceContractPrice",x?.contractPrice||baseAssignment?.contractPrice||"");
 acceptanceSetValue("acceptanceResult",x?.result||"Prevzaté bez vád");
 acceptanceSetValue("acceptanceDocuments",Array.isArray(x?.documents)?x.documents.join("\n"):(x?.documentsText||""));
 acceptanceSetValue("acceptanceNotes",x?.notes||"");
 acceptanceSetValue("acceptancePenalty",x?.penalty||"Neuplatňujú");
 acceptanceSetValue("acceptanceQualityDeduction",x?.qualityDeduction||"Neuplatňuje");
 acceptanceSetValue("acceptancePenaltyReason",x?.penaltyReason||"Nie je");
 acceptanceSetValue("acceptanceWarranty",x?.warranty||acceptanceDefaultWarrantyText);
 acceptanceSetValue("acceptanceClientStatement",x?.clientStatement||acceptanceDefaultClientStatement);
 acceptanceSetValue("acceptanceSupplierStatement",x?.supplierStatement||acceptanceDefaultSupplierStatement);
 acceptanceSetValue("acceptanceClientRep",x?.clientRep||activeProject()?.manager||"");
 acceptanceSetValue("acceptanceSupplierRep",x?.supplierRep||baseAssignment?.contact||company(selectedCompanyId)?.contact||"");
 acceptanceRecalculatePrices();
 $("acceptanceModal").classList.remove("hidden")
};
if($("acceptanceCompany"))$("acceptanceCompany").onchange=()=>acceptanceFillFromAssignment($("acceptanceCompany").value,true);
["acceptanceContractPrice","acceptanceAdditions"].forEach(id=>{if($(id))$(id).addEventListener("input",acceptanceRecalculatePrices)});
if($("acceptanceForm"))$("acceptanceForm").onsubmit=e=>{
 e.preventDefault();
 acceptanceRecalculatePrices();
 const id=$("acceptanceId").value||uid("ap");
 const docs=acceptanceGetValue("acceptanceDocuments").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const record={
  id,projectId:state.selectedProjectId,companyId:acceptanceGetValue("acceptanceCompany"),date:acceptanceGetValue("acceptanceDate"),
  protocolNo:acceptanceGetValue("acceptanceProtocolNo").trim()||acceptanceProtocolNoFromContract(acceptanceGetValue("acceptanceContractNo")),
  contractNo:acceptanceGetValue("acceptanceContractNo").trim(),subject:acceptanceGetValue("acceptanceSubject").trim(),
  additions:acceptanceGetValue("acceptanceAdditions").trim(),additionsPrice:acceptanceGetValue("acceptanceAdditionsPrice"),
  location:acceptanceGetValue("acceptanceLocation").trim(),contractStart:acceptanceGetValue("acceptanceContractStart")||"",contractEnd:acceptanceGetValue("acceptanceContractEnd")||"",
  actualStart:acceptanceGetValue("acceptanceActualStart")||"",actualEnd:acceptanceGetValue("acceptanceActualEnd")||"",
  contractPrice:acceptanceGetValue("acceptanceContractPrice").trim(),actualPrice:acceptanceGetValue("acceptanceActualPrice").trim(),
  result:acceptanceGetValue("acceptanceResult"),documents:docs,documentsText:docs.join("\n"),notes:acceptanceGetValue("acceptanceNotes").trim(),
  penalty:acceptanceGetValue("acceptancePenalty")||"Neuplatňujú",qualityDeduction:acceptanceGetValue("acceptanceQualityDeduction")||"Neuplatňuje",
  penaltyReason:acceptanceGetValue("acceptancePenaltyReason").trim()||"Nie je",warranty:acceptanceGetValue("acceptanceWarranty").trim()||acceptanceDefaultWarrantyText,
  clientStatement:acceptanceGetValue("acceptanceClientStatement").trim()||acceptanceDefaultClientStatement,
  supplierStatement:acceptanceGetValue("acceptanceSupplierStatement").trim()||acceptanceDefaultSupplierStatement,
  clientRep:acceptanceGetValue("acceptanceClientRep").trim(),supplierRep:acceptanceGetValue("acceptanceSupplierRep").trim(),updatedAt:new Date().toISOString()
 };
 if($("acceptanceId").value)state.acceptanceProtocols=state.acceptanceProtocols.map(x=>x.id===id?record:x);else state.acceptanceProtocols.push(record);
 saveDocumentVersion("acceptance",record,$("acceptanceId").value?"Úprava preberacieho protokolu":"Vytvorenie preberacieho protokolu");
 $("acceptanceModal").classList.add("hidden");save("Uloženie preberacieho protokolu")
};
printAcceptance=function(id){
 const x=state.acceptanceProtocols.find(v=>v.id===id);if(!x)return;
 const p=project(x.projectId),c=company(x.companyId),a=assignment(x.projectId,x.companyId),w=window.open("","_blank");
 if(!w){alert("Prehliadač zablokoval okno pre tlač.");return}
 const docs=(Array.isArray(x.documents)?x.documents:[]).filter(Boolean);
 const maxDocs=6;
 const docRows=(docs.length?docs:["Kópie stavebného denníka","Doklady k odovzdaniu diela"]).concat(["-","-","-"]).slice(0,maxDocs).map((d,i)=>`<tr><td>${i<docs.length?i+1:"-"}. ${esc(d)}</td></tr>`).join("");
 const additions=acceptanceAdditionItems(x.additions||"");
 const addRows=(additions.length?additions:[{no:"-",desc:"Bez dodatkov",priceText:"0,00 € bez DPH"}]).slice(0,5).map(item=>`<tr><td style="width:20mm;text-align:center">${esc(item.no)}</td><td>${esc(item.desc)}</td><td style="width:40mm;text-align:right"><b>${esc(item.priceText||"")}</b></td></tr>`).join("");
 const rawDefects=String(x.notes||"Bez vád a nedorobkov.").split(/\r?\n/).map(v=>v.trim()).filter(Boolean);
 const defectLimit=22;
 const shownDefects=rawDefects.slice(0,defectLimit);
 if(rawDefects.length>defectLimit)shownDefects.push(`Ďalšie vady sú uvedené v prílohe k protokolu (${rawDefects.length-defectLimit} položiek).`);
 const defectClass=shownDefects.length>14?"compact":shownDefects.length>8?"medium":"";
 const defectRows=shownDefects.map(v=>`<div>• ${esc(v)}</div>`).join("");
 const parties=acceptancePartiesHtml(p,c,a,x);
 const protocolNo=esc(x.protocolNo||acceptanceProtocolNoFromContract(x.contractNo||a?.contractNo)||"PREBERACÍ PROTOKOL");
 const penalty=acceptancePenaltyChecks(x.penalty||"Neuplatňujú"),quality=acceptanceQualityChecks(x.qualityDeduction||"Neuplatňuje");
 const basePrice=esc(x.contractPrice||a?.contractPrice||"—"), additionsPrice=esc(x.additionsPrice||acceptanceMoney(acceptanceAdditionsSum(x.additions||""))), actualPrice=esc(x.actualPrice||"—");
 const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Preberací protokol</title><style>
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#111}.ap-page{position:relative;width:210mm;height:297mm;overflow:hidden;page-break-after:always}.ap-page:last-child{page-break-after:auto}.ap-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.ap-content{position:relative;z-index:1;padding:36mm 15mm 31mm;font-size:9.5px;line-height:1.18}.ap-title{width:100%;border-collapse:collapse;margin-bottom:3.2mm;table-layout:fixed}.ap-title td{border:1.2px solid #111;padding:2mm;font-size:10.2px}.ap-title .main{text-align:center;font-size:11.5px}.ap-table{width:100%;border-collapse:collapse;margin-bottom:2.4mm;table-layout:fixed}.ap-table td,.ap-table th{border:1px solid #111;padding:1.35mm 1.65mm;vertical-align:middle;overflow-wrap:anywhere}.ap-table .lbl,.ap-table th{background:#f2f5f8;font-weight:700}.ap-parties{table-layout:fixed}.ap-parties .vertical{width:12mm;text-align:center;background:#f7f7f7}.ap-parties .vertical span{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700}.ap-section-title{border:1px solid #111;background:#f2f5f8;font-weight:700;padding:1.55mm 1.8mm;margin-top:1.9mm}.ap-docs{border-collapse:collapse;width:100%;height:auto}.ap-docs td{border:1px solid #111;padding:1.25mm 1.6mm}.ap-docwrap{display:grid;grid-template-columns:16mm 1fr;margin-bottom:2.4mm}.ap-vlabel{border:1px solid #111;border-right:0;text-align:center;background:#f7f7f7}.ap-vlabel span{writing-mode:vertical-rl;transform:rotate(180deg);font-weight:700}.red{color:#d01818;font-weight:700}.ap-check{font-size:11px}.ap-defects{height:68mm;border:1px solid #111;padding:2.5mm 3mm;line-height:1.32;font-size:9.4px;overflow:hidden}.ap-defects.medium{font-size:8.2px;line-height:1.22}.ap-defects.compact{font-size:7.3px;line-height:1.13}.ap-remarks td{height:11mm}.ap-sign{height:52mm;margin-top:2.2mm}.ap-sign td{width:50%;vertical-align:top;padding:3mm 3.5mm}.ap-sign .line{margin-top:13mm}.ap-note{font-size:7.4px;color:#666;margin-top:1mm}.ap-page2 .ap-content{padding-top:38mm} .ap-page2 .ap-title{margin-bottom:4mm}.ap-footer-note{font-size:8px;color:#666} @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.ap-page{margin:0}}
</style></head><body>
<section class="ap-page"><img class="ap-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="ap-content"><table class="ap-title"><tr><td class="main"><b>PROTOKOL O ODOVZDANÍ A PREVZATÍ STAVEBNÉHO DIELA</b></td><td style="width:35mm;text-align:center">${protocolNo}</td><td style="width:22mm;text-align:center">str.1/2</td></tr></table>${parties}<table class="ap-table"><colgroup><col style="width:40mm"><col><col style="width:40mm"><col></colgroup><tr><td class="lbl">Zmluva o dielo/obj. č.</td><td colspan="3">${esc(x.contractNo||a?.contractNo||"—")}</td></tr><tr><td class="lbl">Predmet Zmluvy o dielo</td><td colspan="3"><i>${esc(x.subject||a?.scope||"—")}</i></td></tr><tr><td class="lbl">Začiatok realizácie podľa ZoD</td><td>${esc(x.contractStart?fmtDateISO(x.contractStart):"—")}</td><td class="lbl">Skutočný začiatok realizácie</td><td>${esc(x.actualStart?fmtDateISO(x.actualStart):"—")}</td></tr><tr><td class="lbl">Dokončenie podľa ZoD</td><td>${esc(x.contractEnd?fmtDateISO(x.contractEnd):"—")}</td><td class="lbl">Skutočný termín dokončenia</td><td class="red">${esc(x.actualEnd?fmtDateISO(x.actualEnd):"—")}</td></tr><tr><td class="lbl">Cena diela podľa ZoD</td><td colspan="3">${basePrice}</td></tr><tr><td class="lbl">Cena dodatkov spolu</td><td colspan="3">${additionsPrice}</td></tr><tr><td class="lbl">Skutočná cena diela</td><td colspan="3" class="red">${actualPrice}</td></tr></table><div class="ap-section-title">Dodatky k zmluve</div><table class="ap-table"><tr><th style="width:20mm">Dodatok č.</th><th>Popis dodatku</th><th style="width:40mm">Cena dodatku bez DPH</th></tr>${addRows}</table><div class="ap-section-title">Po prehliadke diela a technickej dokumentácie vykonali vyššie uvedení zástupcovia objednávateľa a zhotoviteľa preberacie konanie.</div><div class="ap-docwrap"><div class="ap-vlabel"><span>Odovzdané listinné doklady</span></div><table class="ap-docs">${docRows}</table></div>${docs.length>maxDocs?`<div class="ap-note">Ďalšie odovzdané doklady sú uvedené v prílohe protokolu.</div>`:""}</div></section>
<section class="ap-page ap-page2"><img class="ap-bg" src="${LETTERHEAD_IMAGE}" alt=""><div class="ap-content"><table class="ap-title"><tr><td class="main"><b>PROTOKOL O ODOVZDANÍ A PREVZATÍ STAVEBNÉHO DIELA</b></td><td style="width:35mm;text-align:center">${protocolNo}</td><td style="width:22mm;text-align:center">str.2/2</td></tr></table><div class="ap-docwrap"><div class="ap-vlabel"><span>Zistené závady a nedorobky – termín odstránenia</span></div><div class="ap-defects ${defectClass}">${defectRows}</div></div><table class="ap-table"><tr><td class="lbl" colspan="2">Zmluvné pokuty sa:</td></tr><tr><td class="ap-check">${penalty.no} Neuplatňujú</td><td class="ap-check">${penalty.yes} Uplatňujú</td></tr><tr><td class="lbl" colspan="2">Zrážka za zníženú kvalitu sa:</td></tr><tr><td class="ap-check">${quality.no} Neuplatňuje</td><td class="ap-check">${quality.yes} Uplatňuje</td></tr><tr><td class="lbl" colspan="2">Dôvod udelenia zmluvnej pokuty / zrážky:</td></tr><tr><td colspan="2"><b>${esc(x.penaltyReason||"Nie je")}</b></td></tr><tr><td class="lbl" colspan="2">Záručná lehota:</td></tr><tr><td colspan="2"><i>${esc(x.warranty||acceptanceDefaultWarrantyText)}</i></td></tr></table><table class="ap-table ap-remarks"><tr><td class="lbl" style="width:34mm">Objednávateľ</td><td>${esc(x.clientStatement||acceptanceDefaultClientStatement)}</td></tr><tr><td class="lbl">Zhotoviteľ</td><td>${esc(x.supplierStatement||acceptanceDefaultSupplierStatement)}</td></tr></table><div class="ap-section-title">Tento protokol potvrdzujú svojimi podpismi</div><table class="ap-table ap-sign"><tr><td><b>Za zhotoviteľa:</b><br><br><i>${esc(x.supplierRep||a?.contact||"")}</i><div class="line">podpis</div><div class="line">pečiatka</div><div style="margin-top:10mm"><b>Dátum ${esc(x.date?fmtDateISO(x.date):"")}</b></div></td><td><b>Za objednávateľa:</b><br><br><i>${esc(x.clientRep||p?.manager||"")}</i><div class="line">podpis</div><div class="line">pečiatka</div><div style="margin-top:10mm"><b>Dátum ${esc(x.date?fmtDateISO(x.date):"")}</b></div></td></tr></table><div class="ap-footer-note">Hlavný protokol je dvojstranový. Dlhé zoznamy vád, fotodokumentácia a ďalšie doklady sa exportujú ako príloha.</div></div></section><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`;
 w.document.write(html);w.document.close()
};

const renderDocumentsWithCoordinationKinds=renderDocuments;
renderDocuments=function(){
 renderDocumentsWithCoordinationKinds();
 document.querySelectorAll('[data-open-doc^="controlDay:"]').forEach(button=>{
  const id=button.dataset.openDoc.split(":")[1],record=state.controlDays.find(item=>item.id===id),row=button.closest("tr");
  if(record&&row?.children?.[4])row.children[4].textContent=coordinationKindTitle(coordinationRecordKind(record));
  button.onclick=()=>{if(!record)return;state.selectedProjectId=record.projectId;selectedControlDayDate=record.date;showView(coordinationRecordKind(record)==="controlDay"?"controlDays":"siteMeetings")}
 })
};

async function initializeCloudPilot(){
 renderCloudPanel();
 if(cloudConfigured()&&cloudSession?.access_token){
  try{
   await cloudEnsureSession();
   await cloudRefreshWorkspaceStatus();
   await cloudLoadTeamContext();
   setCloudMessage("cloudAuthMessage","Prihlásenie bolo obnovené. Na tomto počítači ostávaš prihlásený.","success")
  }catch(error){
   const message=String(error?.message||error||"");
   if(/invalid.*refresh|refresh.*invalid|token.*expired|not authorized|unauthorized|HTTP 401|HTTP 403/i.test(message)){
    saveCloudSession(null);
    setCloudMessage("cloudAuthMessage","Prihlásenie vypršalo. Prihlás sa znova.","error")
   }else{
    setCloudMessage("cloudAuthMessage","Prihlásenie je uložené. Cloud sa obnoví po pripojení k internetu.","")
   }
  }
 }
}

initializeCloudPilot();
function removeHandoverPrintFrame(){const frame=document.getElementById("handoverPrintFrame");if(frame)frame.remove()}
removeHandoverPrintFrame();renderAll();window.__BETPRES_APP_READY__=true;window.__BETPRES_APP_VERSION__=SITE_DESK_APP_VERSION;updateSiteDeskSaveState("Automaticky uložené",false);document.documentElement.setAttribute("data-betpres-ready","true");document.documentElement.setAttribute("data-betpres-version",SITE_DESK_APP_VERSION);
