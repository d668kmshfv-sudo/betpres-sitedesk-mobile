(function(){
 "use strict";
 const VERSION="1.0.3";
 const CONNECTION_KEY="betpres-subcontract-connection-v1";
 const SESSION_KEY="betpres-subcontract-session-v1";
 const PREFERRED_SCOPE_KEY="betpres-subcontract-preferred-scope-v1";
 const DRAFT_PREFIX="betpres-subcontract-local-draft-v1:";
 const $=id=>document.getElementById(id);
 const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const currency=new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"});
 const decimal=new Intl.NumberFormat("sk-SK",{maximumFractionDigits:3});
 const today=()=>{const date=new Date();return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`};
 const monthNow=()=>today().slice(0,7);
 const viewNames={overview:"overviewView",diary:"diaryView",crew:"crewView",statement:"statementView"};
 const state={connection:null,session:null,scopes:[],scopeId:"",view:"overview",day:today(),month:monthNow(),diary:null,crew:null,ownerNotes:[],attachments:[],pendingAttachments:[],items:[],statement:null,statementRows:[],requestId:0,loading:false};
 let toastTimer=0,refreshPromise=null,draftStorageWarningShown=false;

 function showToast(message){const node=$("toast");node.textContent=message;node.classList.add("visible");clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove("visible"),3500)}
 function message(id,value,success=false){const node=$(id);node.textContent=value||"";node.classList.toggle("success",success)}
 function safeRead(key){try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}}
 function safeStore(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
 function safeRemove(key){try{localStorage.removeItem(key)}catch{}}
 function draftKey(kind,scopeId=state.scopeId,period=kind==="statement"?state.month:state.day){return `${DRAFT_PREFIX}${state.session?.user?.id||"none"}:${scopeId}:${kind}:${period}`}
 function readDraft(kind,scopeId,period){const value=safeRead(draftKey(kind,scopeId,period));return value&&typeof value==="object"?value:null}
 function writeDraft(kind,value,scopeId,period){
  const key=draftKey(kind,scopeId,period);
  if(!safeStore(key,{...value,savedAt:Date.now()})&&!draftStorageWarningShown){draftStorageWarningShown=true;showToast("Miestny návrh sa nepodarilo uložiť. Skontroluj voľné miesto v telefóne.")}
 }
 function removeDraft(kind,scopeId,period){safeRemove(draftKey(kind,scopeId,period))}
 const pendingPrefix="betpres-subcontract-pending-attachment-v1:";
 function pendingKey(scopeId=state.scopeId,day=state.day){return `${pendingPrefix}${state.session?.user?.id||"none"}:${scopeId}:${day}`}
 function readPending(scopeId=state.scopeId,day=state.day){try{const value=JSON.parse(sessionStorage.getItem(pendingKey(scopeId,day))||"[]");return Array.isArray(value)?value:[]}catch{return[]}}
 function writePending(value,scopeId=state.scopeId,day=state.day){try{if(value.length)sessionStorage.setItem(pendingKey(scopeId,day),JSON.stringify(value));else sessionStorage.removeItem(pendingKey(scopeId,day))}catch{}}
 function clearPendingOnLogout(){try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith(pendingPrefix))sessionStorage.removeItem(key)}}catch{}}
 function normalizeUrl(raw){
  let url;
  try{url=new URL(String(raw||"").trim())}catch{throw new Error("Zadaj platnú Supabase Project URL.")}
  if(url.protocol!=="https:"||!url.hostname.endsWith(".supabase.co")||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw new Error("Použi HTTPS Project URL končiacu na .supabase.co.");
  return url.origin
 }
 function publicKey(raw){
  const value=String(raw||"").trim();
  if(/^sb_secret_/i.test(value)||/service_role/i.test(value))throw new Error("Tajný kľúč do prehliadača nepatrí. Použi verejný publishable alebo anon kľúč.");
  if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(value))return value;
  if(value.split(".").length===3){
   try{const part=value.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");const payload=JSON.parse(atob(part+"=".repeat((4-part.length%4)%4)));if(payload.role==="anon")return value}catch{}
  }
  throw new Error("Kľúč musí byť verejný Supabase publishable alebo anon kľúč.")
 }
 function parseInvite(){
  const url=new URL(location.href),rawUrl=url.searchParams.get("project_url"),rawKey=url.searchParams.get("publishable_key"),scope=url.searchParams.get("scope");
  if(rawUrl===null&&rawKey===null&&scope===null)return"";
  let error="";
  try{
   if(rawUrl&&rawKey){const connection={url:normalizeUrl(rawUrl),key:publicKey(rawKey)};safeStore(CONNECTION_KEY,connection);state.connection=connection}
   else if(rawUrl||rawKey)throw new Error("Pozývací odkaz nemá úplné údaje pripojenia.");
   if(scope&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope))safeStore(PREFERRED_SCOPE_KEY,scope)
  }catch(caught){error=caught.message}
  for(const key of ["project_url","publishable_key","scope"])url.searchParams.delete(key);
  history.replaceState(null,"",url.pathname+(url.search||"")+(url.hash||""));
  return error
 }
 function loadConnection(){const data=safeRead(CONNECTION_KEY);try{return data?{url:normalizeUrl(data.url),key:publicKey(data.key)}:null}catch{return null}}
 function loadSession(){const data=safeRead(SESSION_KEY);return data?.access_token&&data?.refresh_token?data:null}
 function saveSession(data){state.session=data||null;if(data)safeStore(SESSION_KEY,data);else safeRemove(SESSION_KEY)}
 function clearPrivateView(){
  state.scopes=[];state.scopeId="";state.diary=null;state.crew=null;state.ownerNotes=[];state.attachments=[];state.pendingAttachments=[];state.items=[];state.statement=null;state.statementRows=[];
  $("scopeSelect").innerHTML="";$("statementRows").innerHTML="";$("ownerNotes").innerHTML="";$("attachmentList").innerHTML="";$("diaryWorks").value="";$("diaryMachinery").value="";$("crewCount").value="0";
 }
 function showGate(){
  $("appShell").hidden=true;$("gate").hidden=false;
  $("connectionCard").hidden=Boolean(state.connection);
  $("authCard").hidden=!state.connection;
  if(state.connection){$("projectUrl").value=state.connection.url;$("publishableKey").value=state.connection.key}
 }
 function showApp(){
  $("gate").hidden=true;$("appShell").hidden=false;
  $("signedInEmail").textContent=state.session?.user?.email||"Prihlásený účet";
 }
 async function authRequest(path,body){
  if(!state.connection)throw new Error("Najprv pripoj databázu.");
  let response;
  try{response=await fetch(state.connection.url+path,{method:"POST",cache:"no-store",headers:{apikey:state.connection.key,"Content-Type":"application/json"},body:JSON.stringify(body)})}
  catch{throw new Error("Nepodarilo sa pripojiť k Supabase. Skontroluj internet.")}
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.msg||data.error_description||data.message||data.error||`Prihlásenie zlyhalo (${response.status}).`);
  return data
 }
 async function ensureSession(){
  const current=state.session;
  if(!current?.access_token)throw new Error("Najprv sa prihlás.");
  if(Number(current.expires_at||0)-Date.now()/1000>90)return current.access_token;
  if(!current.refresh_token)throw new Error("Prihlásenie vypršalo. Prihlás sa znova.");
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
   const data=await authRequest("/auth/v1/token?grant_type=refresh_token",{refresh_token:current.refresh_token});
   if(!data.access_token)throw new Error("Prihlásenie sa nepodarilo obnoviť.");
   data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in||3600);saveSession(data);return data.access_token
  })();
  try{return await refreshPromise}finally{refreshPromise=null}
 }
 async function rest(path,{method="GET",body=null,prefer=""}={}){
  const token=await ensureSession();let response;
  const headers={apikey:state.connection.key,Authorization:`Bearer ${token}`,Accept:"application/json"};
  if(body!==null)headers["Content-Type"]="application/json";
  if(prefer)headers.Prefer=prefer;
  try{response=await fetch(state.connection.url+path,{method,cache:"no-store",headers,body:body===null?undefined:JSON.stringify(body)})}
  catch{throw new Error("Spojenie sa prerušilo. Zmeny zostali vo formulári; skús to znova.")}
  if(!response.ok){
   let detail="";try{const data=await response.json();detail=data.message||data.error||data.hint||""}catch{}
   if(response.status===401)detail="Prihlásenie vypršalo. Prihlás sa znova.";
   if(response.status===403)detail="Na tento záznam nemáš prístup alebo je už uzatvorený.";
   throw new Error(detail||`Databáza odmietla požiadavku (${response.status}).`)
  }
  if(response.status===204)return null;
  const contentType=response.headers.get("content-type")||"";
  return contentType.includes("application/json")?response.json():null
 }
 const attachmentTypes={jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",pdf:"application/pdf",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",txt:"text/plain"};
 function attachmentMime(file){
  const extension=String(file?.name||"").split(".").pop().toLowerCase(),expected=attachmentTypes[extension];
  if(!expected)throw new Error("Podporované sú JPG, PNG, WebP, PDF, DOCX, XLSX a TXT.");
  if(file.type&&file.type!==expected&&!(expected==="image/jpeg"&&file.type==="image/jpg"))throw new Error("Typ súboru nezodpovedá jeho prípone.");
  if(!file.size||file.size>20971520)throw new Error("Súbor musí mať najviac 20 MB a nesmie byť prázdny.");
  return expected
 }
 function safeAttachmentName(name){
  const value=String(name||"subor").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^[^a-z0-9]+/,"").slice(0,180);
  return value||"subor"
 }
 function encodedStoragePath(path){return String(path).split("/").map(encodeURIComponent).join("/")}
 async function storageRequest(path,{method="GET",body=null,mime=""}={}){
  const token=await ensureSession(),headers={apikey:state.connection.key,Authorization:`Bearer ${token}`};
  if(mime)headers["Content-Type"]=mime;
  if(method==="POST")headers["x-upsert"]="false";
  let response;
  try{response=await fetch(`${state.connection.url}/storage/v1/object/${method==="GET"?"authenticated/":""}subcontract-private/${encodedStoragePath(path)}`,{method,headers,body,cache:"no-store"})}
  catch{throw new Error("Spojenie pri prenose súboru zlyhalo. Skontroluj internet.")}
  if(!response.ok){let detail="";try{const error=await response.json();detail=error.message||error.error||""}catch{}throw new Error(detail||`Úložisko odmietlo súbor (${response.status}).`)}
  return method==="GET"?response.blob():response
 }
 const filter=value=>encodeURIComponent(value);
 const activeScope=()=>state.scopes.find(scope=>scope.id===state.scopeId)||null;
 const diaryLocked=()=>Boolean(activeScope()?.diary_closed_at||state.diary?.status==="closed");
 const statementLocked=()=>Boolean(state.statement&&state.statement.status!=="draft");
 function dayLabel(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const[y,m,d]=value.split("-").map(Number);return new Intl.DateTimeFormat("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(y,m-1,d))}
 function monthLabel(value){if(!/^\d{4}-\d{2}$/.test(value))return value;const[y,m]=value.split("-").map(Number);return new Intl.DateTimeFormat("sk-SK",{month:"long",year:"numeric"}).format(new Date(y,m-1,1))}
 function addDays(value,delta){const date=new Date(`${value}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+delta);return date.toISOString().slice(0,10)}
 function addMonths(value,delta){const[y,m]=value.split("-").map(Number),date=new Date(Date.UTC(y,m-1+delta,1));return date.toISOString().slice(0,7)}
 function numberValue(value){const raw=String(value??"").replace(/[\s\u00a0\u202f]/g,"").replace(",",".");const number=Number(raw);return Number.isFinite(number)&&number>=0?number:null}
 function valueText(value){return value===null||value===undefined||value===""?"—":decimal.format(Number(value))}
 function formBusy(id,busy){$(id).disabled=busy;$(id).classList.toggle("busy",busy)}

 async function connect(event){
  event.preventDefault();message("connectionMessage","");
  try{
   const connection={url:normalizeUrl($("projectUrl").value),key:publicKey($("publishableKey").value)};
   const response=await fetch(connection.url+"/auth/v1/settings",{headers:{apikey:connection.key},cache:"no-store"});
   if(!response.ok)throw new Error("Project URL alebo verejný kľúč nie je platný.");
   state.connection=connection;safeStore(CONNECTION_KEY,connection);message("connectionMessage","Pripojenie je pripravené.",true);showGate();$("authEmail").focus()
  }catch(error){message("connectionMessage",error.message)}
 }
 async function signIn(event){
  event.preventDefault();message("authMessage","");formBusy("signInButton",true);
  try{
   const email=$("authEmail").value.trim(),password=$("authPassword").value;
   const session=await authRequest("/auth/v1/token?grant_type=password",{email,password});
   session.expires_at=Math.floor(Date.now()/1000)+Number(session.expires_in||3600);
   clearPrivateView();saveSession(session);$("authPassword").value="";
   await enterPortal()
  }catch(error){message("authMessage",/invalid login credentials/i.test(error.message)?"Nesprávny e-mail alebo heslo.":error.message)}
  finally{formBusy("signInButton",false)}
 }
 async function signUp(){
  message("authMessage","");
  try{
   const email=$("authEmail").value.trim(),password=$("authPassword").value;
   if(!email||password.length<6){message("authMessage","Zadaj e-mail a heslo s aspoň 6 znakmi.");return}
   const data=await authRequest("/auth/v1/signup",{email,password,data:{display_name:email.split("@")[0]}});
   if(data.session?.access_token){const session=data.session;session.expires_at=Math.floor(Date.now()/1000)+Number(session.expires_in||3600);saveSession(session);$("authPassword").value="";await enterPortal()}
   else message("authMessage","Účet bol vytvorený. Potvrď e-mail a potom sa prihlás.",true)
  }catch(error){message("authMessage",error.message)}
 }
 async function signOut(){
  try{if(state.session?.access_token)await rest("/auth/v1/logout?scope=local",{method:"POST"})}catch{}
  clearPendingOnLogout();saveSession(null);clearPrivateView();showGate();message("authMessage","Bol si odhlásený.",true)
 }
 async function claimPreferredInvite(){
  const preferred=safeRead(PREFERRED_SCOPE_KEY);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(preferred||"")))return;
  await rest("/rest/v1/rpc/subcontract_claim_invite",{method:"POST",body:{p_scope_id:preferred}})
 }
 async function enterPortal(){
  try{await claimPreferredInvite();await loadScopes();showApp();showView(state.view)}
  catch(error){saveSession(null);clearPrivateView();showGate();message("authMessage",error.message)}
 }
 async function loadScopes(){
  const rows=await rest("/rest/v1/subcontract_scopes?select=id,workspace_id,project_id,company_id,project_name,company_name,diary_closed_at&order=project_name.asc,company_name.asc");
  state.scopes=Array.isArray(rows)?rows:[];
  const preferred=safeRead(PREFERRED_SCOPE_KEY);
  if(!state.scopes.some(row=>row.id===state.scopeId))state.scopeId=state.scopes.find(row=>row.id===preferred)?.id||state.scopes[0]?.id||"";
  $("scopeSelect").innerHTML=state.scopes.map(scope=>`<option value="${escapeHtml(scope.id)}">${escapeHtml(scope.project_name)} · ${escapeHtml(scope.company_name)}</option>`).join("");
  $("scopeSelect").value=state.scopeId;
  $("noScope").hidden=Boolean(state.scopeId);
  $("scopeClosedBanner").hidden=!activeScope()?.diary_closed_at;
  for(const view of document.querySelectorAll(".view"))view.hidden=!state.scopeId||view.id!==viewNames[state.view];
  return state.scopes
 }
 function showView(name){
  state.view=viewNames[name]?name:"overview";
  for(const view of document.querySelectorAll(".view")){view.classList.toggle("active",view.id===viewNames[state.view]);view.hidden=!state.scopeId||view.id!==viewNames[state.view]}
  for(const button of document.querySelectorAll("[data-view]"))button.classList.toggle("active",button.dataset.view===state.view);
  $("dayStrip").hidden=!state.scopeId||!["diary","crew"].includes(state.view);
  $("noScope").hidden=Boolean(state.scopeId);
  $("dayInput").value=state.day;$("selectedDayLabel").textContent=dayLabel(state.day);
  $("monthInput").value=state.month;$("selectedMonthLabel").textContent=monthLabel(state.month);
  if(!state.scopeId)return;
  if(state.view==="overview")void loadOverview();
  if(state.view==="diary"||state.view==="crew")void loadDay();
  if(state.view==="statement")void loadStatement();
 }
 async function refresh(){
  if(!state.session)return;
  try{await claimPreferredInvite();await loadScopes();showView(state.view);showToast("Načítané najnovšie údaje.")}
  catch(error){showToast(error.message)}
 }
 function setDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;state.day=value;$("dayInput").value=value;$("selectedDayLabel").textContent=dayLabel(value);void loadDay()}
 function setMonth(value){if(!/^\d{4}-\d{2}$/.test(value))return;state.month=value;$("monthInput").value=value;$("selectedMonthLabel").textContent=monthLabel(value);void loadStatement()}

 async function loadOverview(){
  const id=state.scopeId,request=++state.requestId,day=today(),month=monthNow();
  $("overviewDate").textContent=dayLabel(day);$("overviewDiary").textContent="…";$("overviewCrew").textContent="…";$("overviewStatement").textContent="…";
  try{
   const [diary,crew,statement]=await Promise.all([
    rest(`/rest/v1/subcontract_diary_days?scope_id=eq.${filter(id)}&day=eq.${day}&select=id,status,works&limit=1`),
    rest(`/rest/v1/subcontract_daily_crew?scope_id=eq.${filter(id)}&day=eq.${day}&select=worker_count&limit=1`),
    rest(`/rest/v1/subcontract_statements?scope_id=eq.${filter(id)}&period=eq.${month}&select=status&limit=1`)
   ]);
   if(request!==state.requestId||id!==state.scopeId)return;
   $("overviewDiary").textContent=diary?.[0]?.works?.trim()?"Zapísaný":"Bez zápisu";
   $("overviewCrew").textContent=crew?.[0]?.worker_count??"Nezadané";
   $("overviewStatement").textContent=statement?.[0]?.status==="closed"?"Uzatvorený":statement?.[0]?.status==="submitted"?"Odoslaný":statement?.[0]?"Rozpracovaný":"Bez súpisu"
  }catch(error){showToast(error.message)}
 }
 function renderDay(){
  const locked=diaryLocked(),dayStatus=state.diary?.status==="closed"?"Deň uzatvorený":activeScope()?.diary_closed_at?"Denník uzatvorený":"Otvorený";
  for(const id of ["diaryStatus","crewStatus"]){$(id).textContent=dayStatus;$(id).classList.toggle("locked",locked)}
  for(const id of ["diaryLockMessage","crewLockMessage"]){$(id).hidden=!locked;$(id).textContent=locked?"Tento zápis uzatvoril hlavný zhotoviteľ. Môžeš ho čítať, ale už ho nemôžeš upraviť.":""}
  $("diaryWorks").value=state.diary?.works||"";$("diaryMachinery").value=state.diary?.machinery||"";
  $("diarySavedAt").textContent=state.diary?.updated_at?`Uložené ${new Intl.DateTimeFormat("sk-SK",{dateStyle:"short",timeStyle:"short"}).format(new Date(state.diary.updated_at))}`:"Nový zápis";
  $("crewCount").value=state.crew?.worker_count??0;
  const diaryDraft=readDraft("diary"),crewDraft=readDraft("crew");
  const diaryIsFresh=diaryDraft&&Number(diaryDraft.savedAt)>(Date.parse(state.diary?.updated_at||"")||0);
  const crewIsFresh=crewDraft&&Number(crewDraft.savedAt)>(Date.parse(state.crew?.updated_at||"")||0);
  if(!locked&&diaryIsFresh){$("diaryWorks").value=String(diaryDraft.works??"");$("diaryMachinery").value=String(diaryDraft.machinery??"")}
  if(!locked&&crewIsFresh)$("crewCount").value=String(crewDraft.count??0);
  $("diaryDraftHint").textContent=diaryDraft?(locked?"Miestny neodoslaný návrh ostal v tomto zariadení. Deň je už uzatvorený.":diaryIsFresh?"Neodoslaný návrh z tohto zariadenia bol obnovený. Ulož ho na server.":"Na serveri je novší zápis. Starší miestny návrh môžeš obnoviť ručne."):"";
  $("crewDraftHint").textContent=crewDraft?(locked?"Miestny neodoslaný stav ostal v tomto zariadení. Deň je už uzatvorený.":crewIsFresh?"Neodoslaný počet z tohto zariadenia bol obnovený. Ulož ho na server.":"Na serveri je novší stav. Starší miestny návrh môžeš obnoviť ručne."):"";
  $("restoreDiaryDraft").hidden=!diaryDraft||locked||diaryIsFresh;
  $("restoreCrewDraft").hidden=!crewDraft||locked||crewIsFresh;
  for(const id of ["diaryWorks","diaryMachinery","saveDiaryButton","crewCount","crewMinus","crewPlus","saveCrewButton"])$(id).disabled=locked;
  $("ownerNotes").innerHTML=state.ownerNotes.length?state.ownerNotes.map(note=>`<article class="owner-note"><time>${escapeHtml(note.created_at?new Intl.DateTimeFormat("sk-SK",{dateStyle:"short",timeStyle:"short"}).format(new Date(note.created_at)):"")}</time><p>${escapeHtml(note.body)}</p></article>`).join(""):'<p class="muted">Hlavný zhotoviteľ tu zatiaľ nezanechal záznam.</p>';
  $("attachmentInput").disabled=locked||!state.diary?.id;
  $("attachmentCount").textContent=`${state.attachments.length} ${state.attachments.length===1?"súbor":"súborov"}`;
  $("attachmentList").innerHTML=state.attachments.length?state.attachments.map(item=>`<div class="attachment-item"><span>${escapeHtml(item.name)}<small>${Math.ceil((Number(item.size_bytes)||0)/1024)} kB</small></span><button type="button" class="secondary" data-open-attachment="${escapeHtml(item.id)}">Otvoriť</button></div>`).join(""):'<p class="muted">K tomuto dňu zatiaľ nie je pridaný súbor.</p>';
  $("attachmentMessage").textContent=state.pendingAttachments.length?`${state.pendingAttachments.length} nahraný súbor čaká na pripojenie k tomuto dňu. Klikni na „Skúsiť pripojiť znova“.`:!state.diary?.id?"Najprv ulož denný zápis.":locked?"Uzatvorený deň už neprijíma nové prílohy.":"";
  $("attachmentMessage").classList.toggle("error",Boolean(state.pendingAttachments.length));
  $("retryAttachment").hidden=!state.pendingAttachments.length;
  $("retryAttachment").disabled=locked||!state.diary?.id;
  $("exportFrom").value=state.day;$("exportTo").value=state.day
 }
 async function loadDay(){
  if(!state.scopeId)return;
  const id=state.scopeId,day=state.day,request=++state.requestId;
  state.diary=null;state.crew=null;state.ownerNotes=[];state.attachments=[];$("diaryWorks").value="";$("diaryMachinery").value="";$("crewCount").value="0";$("attachmentList").innerHTML="";
  for(const field of ["diaryWorks","diaryMachinery","crewCount","saveDiaryButton","saveCrewButton"])$(field).disabled=true;
  try{
   const [diary,crew,notes]=await Promise.all([
    rest(`/rest/v1/subcontract_diary_days?scope_id=eq.${filter(id)}&day=eq.${day}&select=id,scope_id,day,works,machinery,status,updated_at&limit=1`),
    rest(`/rest/v1/subcontract_daily_crew?scope_id=eq.${filter(id)}&day=eq.${day}&select=id,scope_id,day,worker_count,updated_at&limit=1`),
    rest(`/rest/v1/subcontract_owner_notes?scope_id=eq.${filter(id)}&day=eq.${day}&select=id,day,body,created_at&order=created_at.asc`)
   ]);
   if(request!==state.requestId||id!==state.scopeId||day!==state.day)return;
   state.diary=diary?.[0]||null;state.crew=crew?.[0]||null;state.ownerNotes=Array.isArray(notes)?notes:[];
   state.attachments=state.diary?.id?await rest(`/rest/v1/subcontract_attachments?scope_id=eq.${filter(id)}&diary_day_id=eq.${filter(state.diary.id)}&select=id,scope_id,diary_day_id,path,name,mime_type,size_bytes,created_at&order=created_at.asc`):[];
   state.pendingAttachments=readPending().filter(item=>item.scope_id===id&&item.diary_day_id===state.diary?.id);
   if(request!==state.requestId||id!==state.scopeId||day!==state.day)return;
   renderDay()
  }catch(error){if(request===state.requestId)showToast(error.message)}
 }
 async function saveDiary(event){
  event.preventDefault();if(diaryLocked())return;
  const id=state.scopeId,day=state.day,works=$("diaryWorks").value.trim(),machinery=$("diaryMachinery").value.trim();formBusy("saveDiaryButton",true);
  try{
   const method=state.diary?.id?"PATCH":"POST",path=state.diary?.id?`/rest/v1/subcontract_diary_days?id=eq.${filter(state.diary.id)}`:"/rest/v1/subcontract_diary_days";
   const body=state.diary?.id?{works,machinery}:{scope_id:id,day,works,machinery};
   const rows=await rest(path,{method,body,prefer:"return=representation"});
   if(id===state.scopeId&&day===state.day){
    const changed=$("diaryWorks").value.trim()!==works||$("diaryMachinery").value.trim()!==machinery;
    if(changed)writeDraft("diary",{works:$("diaryWorks").value,machinery:$("diaryMachinery").value},id,day);
    else removeDraft("diary",id,day);
    state.diary=rows?.[0]||state.diary;renderDay()
   }
   showToast("Denník bol uložený.")
  }catch(error){showToast(error.message)}finally{formBusy("saveDiaryButton",false)}
 }
 async function saveCrew(event){
  event.preventDefault();if(diaryLocked())return;
  const count=Number($("crewCount").value);if(!Number.isInteger(count)||count<0||count>9999){showToast("Zadaj celý počet pracovníkov od 0 do 9999.");return}
  const id=state.scopeId,day=state.day;formBusy("saveCrewButton",true);
  try{
   const method=state.crew?.id?"PATCH":"POST",path=state.crew?.id?`/rest/v1/subcontract_daily_crew?id=eq.${filter(state.crew.id)}`:"/rest/v1/subcontract_daily_crew";
   const body=state.crew?.id?{worker_count:count}:{scope_id:id,day,worker_count:count};
   const rows=await rest(path,{method,body,prefer:"return=representation"});
   if(id===state.scopeId&&day===state.day){
    if(Number($("crewCount").value)!==count)writeDraft("crew",{count:$("crewCount").value},id,day);
    else removeDraft("crew",id,day);
    state.crew=rows?.[0]||state.crew;renderDay()
   }
   showToast("Stav pracovníkov bol uložený.")
  }catch(error){showToast(error.message)}finally{formBusy("saveCrewButton",false)}
 }
 async function attachMetadata(payload){
  try{
   const rows=await rest("/rest/v1/subcontract_attachments?select=id,scope_id,diary_day_id,path,name,mime_type,size_bytes,created_at",{method:"POST",body:payload,prefer:"return=representation"});
   if(Array.isArray(rows)&&rows[0]?.id)return rows[0];
   throw new Error("Databáza nepotvrdila zápis prílohy.")
  }catch(error){
   const existing=await rest(`/rest/v1/subcontract_attachments?id=eq.${filter(payload.id)}&select=id,scope_id,diary_day_id,path,name,mime_type,size_bytes,created_at`);
   if(Array.isArray(existing)&&existing[0]?.path===payload.path)return existing[0];
   throw error
  }
 }
 async function uploadAttachment(event){
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  const scope=activeScope(),diary=state.diary,day=state.day;
  if(!scope||!diary?.id||diaryLocked()){showToast("Najprv ulož otvorený denný zápis.");return}
  let mime;
  try{mime=attachmentMime(file)}catch(error){showToast(error.message);return}
  const attachmentId=crypto.randomUUID(),path=`${scope.id}/${diary.id}/${attachmentId}/${safeAttachmentName(file.name)}`;
  $("attachmentInput").disabled=true;$("attachmentMessage").classList.remove("error");$("attachmentMessage").textContent=`Nahrávam ${file.name}…`;
  let uploaded=false;
  try{
   await storageRequest(path,{method:"POST",body:file,mime});uploaded=true;
   const payload={id:attachmentId,scope_id:scope.id,diary_day_id:diary.id,path,name:file.name,mime_type:mime,size_bytes:file.size};
   const saved=await attachMetadata(payload);
   if(scope.id===state.scopeId&&day===state.day){state.attachments.push(saved);renderDay()}
   showToast("Príloha bola bezpečne uložená.")
  }catch(error){
   if(uploaded){const pending={id:attachmentId,scope_id:scope.id,diary_day_id:diary.id,path,name:file.name,mime_type:mime,size_bytes:file.size};const list=[...readPending(scope.id,day),pending];writePending(list,scope.id,day);if(scope.id===state.scopeId&&day===state.day)state.pendingAttachments=list}
   const detail=uploaded?`Súbor sa nahral, ale nepripojil k denníku. Použi „Skúsiť pripojiť znova“; súbor nenahrávaj druhýkrát. ${error.message}`:error.message;
   $("attachmentMessage").textContent=detail;$("attachmentMessage").classList.add("error");showToast(detail)
   $("retryAttachment").hidden=!state.pendingAttachments.length;
  }finally{$("attachmentInput").disabled=diaryLocked()||!state.diary?.id}
 }
 async function retryPendingAttachment(){
  const pending=state.pendingAttachments[0];if(!pending||diaryLocked()||pending.scope_id!==state.scopeId||pending.diary_day_id!==state.diary?.id)return;
  $("retryAttachment").disabled=true;
  try{
   const saved=await attachMetadata(pending);
   state.pendingAttachments.shift();writePending(state.pendingAttachments);
   if(!state.attachments.some(item=>item.id===saved.id))state.attachments.push(saved);
   renderDay();showToast("Príloha bola pripojená k denníku.")
  }catch(error){$("attachmentMessage").textContent=`Pripojenie stále zlyháva: ${error.message}`;$("attachmentMessage").classList.add("error");showToast(error.message)}
  finally{$("retryAttachment").disabled=diaryLocked()||!state.pendingAttachments.length}
 }
 async function openAttachment(id){
  const item=state.attachments.find(row=>row.id===id);if(!item)return;
  const popup=window.open("about:blank","_blank");if(!popup){showToast("Prehliadač zablokoval otvorenie súboru.");return}
  try{
   const blob=await storageRequest(item.path),url=URL.createObjectURL(blob);
   popup.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),300000)
  }catch(error){popup.close();showToast(`Súbor sa nepodarilo otvoriť: ${error.message}`)}
 }

 function renderStatement(){
  const status=state.statement?.status||"draft",locked=statementLocked(),hasItems=state.items.length>0;
  $("statementStatus").textContent=status==="closed"?"Uzatvorený":status==="submitted"?"Odoslaný na schválenie":"Rozpracovaný";
  $("statementStatus").classList.toggle("locked",status==="closed");$("statementStatus").classList.toggle("submitted",status==="submitted");
  $("statementLockMessage").hidden=!locked;$("statementLockMessage").textContent=status==="closed"?"Hlavný zhotoviteľ tento súpis uzatvoril. Množstvá zostávajú viditeľné bez možnosti zmeny.":"Súpis je odoslaný na schválenie. Množstvá už nemôžeš meniť.";
  $("statementEmpty").hidden=hasItems;$("statementForm").hidden=!hasItems;
  const rowsByItem=new Map(state.statementRows.map(row=>[row.work_item_id,row]));
  $("statementRows").innerHTML=state.items.map(item=>{
   const savedRow=rowsByItem.get(item.id),qty=savedRow?.quantity??0,reviewed=savedRow?.reviewed_quantity,changed=reviewed!==null&&reviewed!==undefined&&Math.abs(Number(reviewed)-Number(qty))>.0005,price=Number(savedRow?.unit_price_snapshot??item.unit_price)||0;
   return `<div class="statement-row ${changed?"is-revised":""}" data-work-item="${escapeHtml(item.id)}"><div class="statement-item"><code>${escapeHtml(item.code||"")}</code><strong>${escapeHtml(item.description||"Položka")}</strong></div><div class="value"><span class="mobile-field-label">Zmluvné množstvo</span>${escapeHtml(valueText(item.contract_qty))} ${escapeHtml(item.unit||"")}</div><div class="value"><span class="mobile-field-label">Cena / MJ</span>${escapeHtml(currency.format(price))}</div><label class="quantity-wrap"><span class="mobile-field-label">Tento mesiac · ${escapeHtml(item.unit||"")}</span><input type="text" inputmode="decimal" autocomplete="off" data-quantity-for="${escapeHtml(item.id)}" value="${escapeHtml(String(qty))}" ${locked?"disabled":""} aria-label="Množstvo tento mesiac: ${escapeHtml(item.description)}">${changed?`<strong class="reviewed-quantity">Upravené BETPRES: ${escapeHtml(valueText(reviewed))} ${escapeHtml(item.unit||"")}</strong>${savedRow?.review_note?`<small class="review-note">${escapeHtml(savedRow.review_note)}</small>`:""}`:""}</label><div class="amount"><span class="mobile-field-label">${changed?"Schválená suma bez DPH":"Suma bez DPH"}</span><span data-amount-for="${escapeHtml(item.id)}">${escapeHtml(currency.format((Number(changed?reviewed:qty)||0)*price))}</span></div></div>`
  }).join("");
  $("saveStatementButton").disabled=locked;$("submitStatementButton").disabled=locked;
  const draft=readDraft("statement"),serverTime=Math.max(Date.parse(state.statement?.updated_at||"")||0,...state.statementRows.map(row=>Date.parse(row.updated_at||"")||0));
  const fresh=draft&&Number(draft.savedAt)>serverTime;
  if(draft&&!locked&&fresh)applyStatementDraft(draft);
  $("statementDraftHint").textContent=draft?(locked?"Miestny neodoslaný návrh zostal v tomto zariadení. Súpis je už uzatvorený.":fresh?"Neodoslané množstvá z tohto zariadenia boli obnovené. Ulož súpis na server.":"Na serveri je novší súpis. Starší miestny návrh môžeš obnoviť ručne."):"";
  $("restoreStatementDraft").hidden=!draft||locked||fresh;
  $("statementRows").querySelectorAll("[data-quantity-for]").forEach(input=>input.addEventListener("input",()=>{captureStatementDraft();recalculateStatement()}));
  recalculateStatement()
 }
 async function loadStatement(){
  if(!state.scopeId)return;
  const id=state.scopeId,period=state.month,request=++state.requestId;
  state.items=[];state.statement=null;state.statementRows=[];$("statementRows").innerHTML="";$("statementTotal").textContent="…";
  try{
   const [items,statements]=await Promise.all([
    rest(`/rest/v1/subcontract_work_items?scope_id=eq.${filter(id)}&select=id,scope_id,code,description,unit,contract_qty,unit_price,sort_order,is_active&order=sort_order.asc,code.asc`),
    rest(`/rest/v1/subcontract_statements?scope_id=eq.${filter(id)}&period=eq.${period}&select=id,scope_id,period,status,closed_at,updated_at&limit=1`)
   ]);
   const statement=statements?.[0]||null;
   const rows=statement?await rest(`/rest/v1/subcontract_statement_rows?statement_id=eq.${filter(statement.id)}&select=id,statement_id,work_item_id,quantity,reviewed_quantity,review_note,reviewed_at,unit_price_snapshot,contract_qty_snapshot,line_total,updated_at`):[];
   if(request!==state.requestId||id!==state.scopeId||period!==state.month)return;
   const usedIds=new Set((rows||[]).map(row=>row.work_item_id));
   state.items=Array.isArray(items)?items.filter(item=>item.is_active!==false||usedIds.has(item.id)):[];state.statement=statement;state.statementRows=Array.isArray(rows)?rows:[];renderStatement()
  }catch(error){if(request===state.requestId)showToast(error.message)}
 }
 function quantityInputs(){return [...$("statementRows").querySelectorAll("[data-quantity-for]")]}
 function statementDraftSnapshot(){return Object.fromEntries(quantityInputs().map(input=>[input.dataset.quantityFor,input.value]))}
 function applyStatementDraft(draft){for(const input of quantityInputs())if(Object.hasOwn(draft.quantities||{},input.dataset.quantityFor))input.value=String(draft.quantities[input.dataset.quantityFor])}
 function captureStatementDraft(){
  if(statementLocked()||!state.scopeId)return;
  const quantities=statementDraftSnapshot(),rows=new Map(state.statementRows.map(row=>[row.work_item_id,row]));
  if(state.items.every(item=>String(quantities[item.id]??"0")===String(rows.get(item.id)?.quantity??0)))removeDraft("statement");
  else writeDraft("statement",{quantities});
  const draft=readDraft("statement");$("statementDraftHint").textContent=draft?"Neodoslané množstvá sú uložené v tomto zariadení. Ulož súpis na server.":"";$("restoreStatementDraft").hidden=true
 }
 function recalculateStatement(){
  let total=0;
  for(const input of quantityInputs()){
   const item=state.items.find(row=>row.id===input.dataset.quantityFor),saved=state.statementRows.find(row=>row.work_item_id===input.dataset.quantityFor),quantity=statementLocked()&&saved?.reviewed_quantity!==null&&saved?.reviewed_quantity!==undefined?Number(saved.reviewed_quantity):numberValue(input.value),amount=(quantity??0)*(Number(saved?.unit_price_snapshot??item?.unit_price)||0);
   const amountNode=$("statementRows").querySelector(`[data-amount-for="${input.dataset.quantityFor}"]`);
   if(amountNode)amountNode.textContent=currency.format(amount);
   input.classList.toggle("invalid",quantity===null);total+=amount
  }
  $("statementTotal").textContent=currency.format(total)
 }
 async function persistStatement(){
  if(statementLocked())throw new Error("Tento súpis je už uzamknutý.");
  const quantities=quantityInputs().map(input=>({work_item_id:input.dataset.quantityFor,quantity:numberValue(input.value)}));
  if(quantities.some(row=>row.quantity===null))throw new Error("Skontroluj množstvá. Použi nezáporné čísla.");
  const scopeId=state.scopeId,period=state.month;
  let statement=state.statement;
  if(!statement){
   const records=await rest("/rest/v1/subcontract_statements?on_conflict=scope_id,period",{method:"POST",body:{scope_id:scopeId,period,status:"draft"},prefer:"resolution=merge-duplicates,return=representation"});
   statement=records?.[0];if(!statement?.id)throw new Error("Súpis sa nepodarilo vytvoriť.");if(scopeId===state.scopeId&&period===state.month)state.statement=statement
  }
  const payload=quantities.map(row=>({statement_id:statement.id,work_item_id:row.work_item_id,quantity:row.quantity}));
  if(payload.length){
   const records=await rest("/rest/v1/subcontract_statement_rows?on_conflict=statement_id,work_item_id",{method:"POST",body:payload,prefer:"resolution=merge-duplicates,return=representation"});
   if(scopeId===state.scopeId&&period===state.month)state.statementRows=Array.isArray(records)?records:state.statementRows
  }
  return statement
 }
 async function saveStatement(event){
  event.preventDefault();const id=state.scopeId,period=state.month,before=JSON.stringify(statementDraftSnapshot());formBusy("saveStatementButton",true);
  try{
   await persistStatement();
   if(id===state.scopeId&&period===state.month){
    if(JSON.stringify(statementDraftSnapshot())===before)removeDraft("statement",id,period);
    else writeDraft("statement",{quantities:statementDraftSnapshot()},id,period);
    renderStatement()
   }
   showToast("Mesačný súpis bol uložený.")
  }
  catch(error){showToast(error.message)}finally{formBusy("saveStatementButton",false)}
 }
 async function submitStatement(){
  if(statementLocked()||!state.items.length)return;
  if(!confirm("Odoslať tento súpis na schválenie? Po odoslaní už množstvá nebude možné meniť."))return;
  const id=state.scopeId,period=state.month;
  formBusy("submitStatementButton",true);$("saveStatementButton").disabled=true;quantityInputs().forEach(input=>input.disabled=true);
  try{
   const statement=await persistStatement();
   await rest("/rest/v1/rpc/subcontract_submit_statement",{method:"POST",body:{p_statement_id:statement.id},prefer:"return=representation"});
   removeDraft("statement",id,period);
   await loadStatement();showToast("Súpis bol odoslaný na schválenie.")
  }catch(error){showToast(error.message)}finally{
   formBusy("submitStatementButton",false);
   if(id===state.scopeId&&period===state.month){$("saveStatementButton").disabled=statementLocked();quantityInputs().forEach(input=>input.disabled=statementLocked())}
  }
 }

 function exportMode(){return document.querySelector('input[name="diaryExportMode"]:checked')?.value||"day"}
 function dateRange(){
  if(exportMode()==="day")return[state.day,state.day];
  const from=$("exportFrom").value,to=$("exportTo").value;
  if(!from||!to)throw new Error("Vyber začiatok aj koniec obdobia.");
  if(from>to)throw new Error("Dátum „Od“ musí byť pred dátumom „Do“.");
  const days=Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000)+1;
  if(days>366)throw new Error("Naraz môžeš exportovať najviac 366 dní. Vyber kratšie obdobie.");
  return[from,to]
 }
 function printDay(day,scope,entry,crew,notes,index,total){
  const works=entry?.works?.trim()||"Bez zápisu vykonaných prác.",machinery=entry?.machinery?.trim()||"—";
  const letterhead=new URL("assets/betpres-letterhead-2026.jpg",location.href).href;
  return `<section class="print-page"><img class="print-letterhead" src="${escapeHtml(letterhead)}" alt=""><div class="print-content"><div class="print-kicker">DENNÝ ZÁPIS · DEŇ ${index+1} / ${total}</div><h1>STAVEBNÝ DENNÍK SUBDODÁVATEĽA</h1><div class="print-meta"><div><span>Stavba</span><strong>${escapeHtml(scope.project_name)}</strong></div><div><span>Subdodávateľ</span><strong>${escapeHtml(scope.company_name)}</strong></div><div><span>Dátum</span><strong>${escapeHtml(dayLabel(day))}</strong></div><div><span>Stav zápisu</span><strong>${escapeHtml(entry?.status==="closed"?"Uzatvorený":"Rozpracovaný")}</strong></div></div><h2>Vykonané práce</h2><div class="print-text">${escapeHtml(works)}</div><div class="print-row"><div><h2>Pracovníci</h2><p>${escapeHtml(crew?.worker_count??"Nezadané")}</p></div><div><h2>Mechanizmy a poznámky</h2><p>${escapeHtml(machinery)}</p></div></div><h2>Záznamy hlavného zhotoviteľa</h2><div class="print-notes">${notes.length?notes.map(note=>`<p>${escapeHtml(note.body)}</p>`).join(""):"<p>Bez ďalšieho záznamu.</p>"}</div><div class="print-signatures"><div><span>Hlavný zhotoviteľ · BETPRES</span><i>Podpis a dátum</i></div><div><span>Subdodávateľ · ${escapeHtml(scope.company_name)}</span><i>Podpis a dátum</i></div></div></div></section>`
 }
 function splitPrintableText(value,maxLength){
  const chunks=[];let remaining=String(value||"").trim();
  while(remaining.length>maxLength){
   let cut=remaining.lastIndexOf(" ",maxLength);
   if(cut<Math.floor(maxLength/2))cut=maxLength;
   chunks.push(remaining.slice(0,cut).trim());
   remaining=remaining.slice(cut).trim();
  }
  if(remaining)chunks.push(remaining);
  return chunks;
 }
 function renderPrintPage(day,scope,entry,part,index,total,pageNumber,pageTotal,hasOwnerNotes){
  const e=escapeHtml,letterhead=new URL("assets/betpres-letterhead-2026.jpg",location.href).href;
  const status=entry?.status==="closed"?"Uzatvorený":"Rozpracovaný";
  let html='<section class="print-page"><img class="print-letterhead" src="'+e(letterhead)+'" alt=""><div class="print-content">';
  html+='<div class="print-kicker">DENNÝ ZÁPIS · DEŇ '+(index+1)+' / '+total+(pageTotal>1?' · STRANA '+pageNumber+' / '+pageTotal:"")+'</div>';
  html+='<h1>STAVEBNÝ DENNÍK SUBDODÁVATEĽA</h1><div class="print-meta">';
  html+='<div><span>Stavba</span><strong>'+e(scope.project_name)+'</strong></div>';
  html+='<div><span>Subdodávateľ</span><strong>'+e(scope.company_name)+'</strong></div>';
  html+='<div><span>Dátum</span><strong>'+e(dayLabel(day))+'</strong></div>';
  html+='<div><span>Stav zápisu</span><strong>'+e(status)+'</strong></div></div>';
  if(part.works)html+='<h2>Vykonané práce'+(pageNumber>1?" · pokračovanie":"")+'</h2><div class="print-text">'+e(part.works)+'</div>';
  if(part.crew!==null)html+='<h2>Pracovníci</h2><div class="print-text">'+e(part.crew)+'</div>';
  if(part.machinery)html+='<h2>Mechanizmy a poznámky</h2><div class="print-text">'+e(part.machinery)+'</div>';
  if(part.notes.length||part.final&&!hasOwnerNotes){
   html+='<h2>Záznamy hlavného zhotoviteľa</h2><div class="print-notes">';
   html+=part.notes.length?part.notes.map(note=>'<p>'+e(note.body)+'</p>').join(""):'<p>Bez ďalšieho záznamu.</p>';
   html+='</div>';
  }
  if(part.attachments.length)html+='<h2>Prílohy</h2><div class="print-notes">'+part.attachments.map(name=>'<p>'+e(name)+'</p>').join("")+'</div>';
  if(part.final)html+='<div class="print-signatures"><div><span>Hlavný zhotoviteľ · BETPRES</span><i>Podpis a dátum</i></div><div><span>Subdodávateľ · '+e(scope.company_name)+'</span><i>Podpis a dátum</i></div></div>';
  return html+'</div></section>';
 }
 function printMeasure(popup){
  const doc=popup.document,host=doc.createElement("div"),ruler=doc.createElement("div");
  host.style.cssText="position:fixed;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none";
  ruler.style.cssText="position:fixed;left:-10000px;top:0;height:297mm;width:1px;visibility:hidden";
  doc.body.append(host,ruler);
  const fits=html=>{
   host.innerHTML=html;
   const content=host.querySelector(".print-content");
   return Boolean(content)&&content.getBoundingClientRect().height<=ruler.getBoundingClientRect().height+1;
  };
  fits.dispose=()=>{host.remove();ruler.remove()};
  return fits;
 }
 function buildPrintPages(day,scope,entry,crew,notes,attachments,index,total,fits){
  const parts=[{works:"",crew:null,machinery:"",notes:[],attachments:[],final:true}],hasOwnerNotes=notes.length>0;
  const pieces=[];
  for(const text of splitPrintableText(entry?.works?.trim()||"Bez zápisu vykonaných prác.",400))pieces.push({field:"works",text});
  pieces.push({field:"crew",text:String(crew?.worker_count??"Nezadané")});
  for(const text of splitPrintableText(entry?.machinery?.trim()||"—",400))pieces.push({field:"machinery",text});
  for(const note of notes)for(const text of splitPrintableText(note.body,360))pieces.push({field:"notes",text});
  for(const attachment of attachments)pieces.push({field:"attachment",text:attachment.name});
  function addPiece(piece){
   const current=parts[parts.length-1],candidate={...current,notes:[...current.notes],attachments:[...current.attachments],final:true};
   if(piece.field==="notes")candidate.notes.push({body:piece.text});
   else if(piece.field==="attachment")candidate.attachments.push(piece.text);
   else if(piece.field==="crew")candidate.crew=piece.text;
   else candidate[piece.field]+=(candidate[piece.field]?"\n":"")+piece.text;
   if(fits(renderPrintPage(day,scope,entry,candidate,index,total,parts.length,parts.length,hasOwnerNotes))){
    parts[parts.length-1]=candidate;return;
   }
   if(current.works||current.crew!==null||current.machinery||current.notes.length||current.attachments.length){
    current.final=false;parts.push({works:"",crew:null,machinery:"",notes:[],attachments:[],final:true});
    addPiece(piece);return;
   }
   if(piece.field!=="crew"&&piece.text.length>80){
    const halves=splitPrintableText(piece.text,Math.max(80,Math.floor(piece.text.length/2)));
    if(halves.length>1){for(const half of halves)addPiece({field:piece.field,text:half});return}
   }
   throw new Error("Text denníka sa nezmestí na stranu A4. Skráť dlhý súvislý text.");
  }
  for(const piece of pieces)addPiece(piece);
  return parts.map((part,page)=>renderPrintPage(day,scope,entry,part,index,total,page+1,parts.length,hasOwnerNotes)).join("");
 }
 let pdfLibraryPromise;
 async function pdfLibrary(){
  if(!pdfLibraryPromise)pdfLibraryPromise=import(new URL("assets/pdfjs/pdf.mjs",location.href).href).then(library=>{
   library.GlobalWorkerOptions.workerSrc=new URL("assets/pdfjs/pdf.worker.mjs",location.href).href;
   return library
  }).catch(error=>{pdfLibraryPromise=null;throw new Error(`PDF knižnica sa nenačítala: ${error.message}`)});
  return pdfLibraryPromise
 }
 function blobDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error("Obrázok sa nepodarilo prečítať."));reader.readAsDataURL(blob)})}
 function printAttachmentPage(day,item,imageUrl,number,total){
  const letterhead=new URL("assets/betpres-letterhead-2026.jpg",location.href).href;
  return `<section class="print-page print-attachment-page"><img class="print-letterhead" src="${escapeHtml(letterhead)}" alt=""><div class="print-content"><div class="print-kicker">PRÍLOHA STAVEBNÉHO DENNÍKA · ${escapeHtml(dayLabel(day))}</div><h1>${escapeHtml(item.name)}</h1><img class="print-attachment-image" src="${escapeHtml(imageUrl)}" alt="Strana ${number} prílohy ${escapeHtml(item.name)}"><div class="print-attachment-caption">${total>1?`Strana prílohy ${number} / ${total}`:"Fotografia"} · ${escapeHtml(item.name)}</div></div></section>`
 }
 async function visibleAttachmentPages(day,items){
  const result=[];
  for(const item of items){
   if(!item.mime_type?.startsWith("image/")&&item.mime_type!=="application/pdf")continue;
   let blob;try{blob=await storageRequest(item.path)}catch(error){throw new Error(`Príloha ${item.name} nie je dostupná: ${error.message}`)}
   if(item.mime_type?.startsWith("image/")){result.push(printAttachmentPage(day,item,await blobDataUrl(blob),1,1));continue}
   const library=await pdfLibrary(),task=library.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
   task.onPassword=updatePassword=>{const password=window.prompt(`Zadaj heslo pre PDF ${item.name}:`);if(password===null){void task.destroy();return}updatePassword(password)};
   let pdf;
   try{
    pdf=await task.promise;
    for(let number=1;number<=pdf.numPages;number++){
     const source=await pdf.getPage(number),size=source.getViewport({scale:1}),scale=Math.min(2,1600/size.width,2200/size.height),viewport=source.getViewport({scale}),canvas=document.createElement("canvas");
     canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
     const context=canvas.getContext("2d",{alpha:false});if(!context)throw new Error("Prehliadač nevie vykresliť PDF.");
     context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
     try{await source.render({canvasContext:context,viewport,background:"#fff"}).promise;result.push(printAttachmentPage(day,item,canvas.toDataURL("image/jpeg",.9),number,pdf.numPages))}
     finally{canvas.width=0;canvas.height=0;source.cleanup()}
    }
   }catch(error){throw new Error(`PDF prílohu ${item.name} sa nepodarilo vložiť do exportu: ${error.message}`)}
   finally{if(pdf)await pdf.destroy();else await task.destroy()}
  }
  return result
 }
 async function waitPrintPreview(popup){
  await new Promise((resolve,reject)=>{
   const started=Date.now();
   function check(){
    if(popup.closed){reject(new Error("Náhľad tlače bol zatvorený."));return}
    try{if(popup.document.getElementById("printPages")){resolve();return}}catch(_){}
    if(Date.now()-started>10000){reject(new Error("Náhľad tlače sa nenačítal."));return}
    setTimeout(check,40);
   }
   check();
  });
  const sheet=popup.document.querySelector('link[href*="print.css"]');
  if(!sheet)throw new Error("Štýl tlače sa nepodarilo nájsť.");
  if(!sheet.sheet)await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error("Štýl tlače sa nenačítal.")),10000);
   sheet.addEventListener("load",()=>{clearTimeout(timer);resolve()},{once:true});
   sheet.addEventListener("error",()=>{clearTimeout(timer);reject(new Error("Štýl tlače sa nenačítal."))},{once:true});
   if(sheet.sheet){clearTimeout(timer);resolve()}
  });
  if(popup.document.fonts?.ready)await popup.document.fonts.ready;
 }
 async function exportDiary(event){
  event.preventDefault();let dates;
  try{dates=dateRange()}catch(error){showToast(error.message);return}
  const scope=activeScope();if(!scope)return;
  const popup=window.open(new URL("print-preview.html",location.href).href,"_blank");
  if(!popup){showToast("Prehliadač zablokoval nové okno. Povoľ otváranie náhľadov a skús to znova.");return}
  formBusy("exportDiaryButton",true);
  try{
   const [from,to]=dates,id=scope.id;
   const [entries,crew,notes]=await Promise.all([
    rest(`/rest/v1/subcontract_diary_days?scope_id=eq.${filter(id)}&day=gte.${from}&day=lte.${to}&select=id,day,works,machinery,status&order=day.asc`),
    rest(`/rest/v1/subcontract_daily_crew?scope_id=eq.${filter(id)}&day=gte.${from}&day=lte.${to}&select=day,worker_count`),
    rest(`/rest/v1/subcontract_owner_notes?scope_id=eq.${filter(id)}&day=gte.${from}&day=lte.${to}&select=day,body,created_at&order=day.asc,created_at.asc`)
   ]);
   const byDay=new Map((entries||[]).map(item=>[item.day,item])),crewByDay=new Map((crew||[]).map(item=>[item.day,item])),notesByDay=new Map();
   for(const note of notes||[]){if(!notesByDay.has(note.day))notesByDay.set(note.day,[]);notesByDay.get(note.day).push(note)}
   const dayIds=(entries||[]).map(item=>item.id).filter(value=>/^[0-9a-f-]{36}$/i.test(String(value)));
   const attachmentRows=dayIds.length?await rest(`/rest/v1/subcontract_attachments?scope_id=eq.${filter(id)}&diary_day_id=in.(${dayIds.map(filter).join(",")})&select=id,diary_day_id,path,name,mime_type,size_bytes,created_at&order=created_at.asc`):[];
   const dayById=new Map((entries||[]).map(item=>[item.id,item.day])),attachmentsByDay=new Map();
   for(const item of attachmentRows||[]){const attachmentDay=dayById.get(item.diary_day_id);if(!attachmentDay)continue;if(!attachmentsByDay.has(attachmentDay))attachmentsByDay.set(attachmentDay,[]);attachmentsByDay.get(attachmentDay).push(item)}
   const days=[];for(let date=from;date<=to;date=addDays(date,1))days.push(date);
   await waitPrintPreview(popup);
   const fits=printMeasure(popup);
   let body;
   try{
    const pageHtml=[];
    for(const [index,day] of days.entries()){
     const dayAttachments=attachmentsByDay.get(day)||[];
     pageHtml.push(buildPrintPages(day,scope,byDay.get(day),crewByDay.get(day),notesByDay.get(day)||[],dayAttachments,index,days.length,fits));
     pageHtml.push(...await visibleAttachmentPages(day,dayAttachments));
    }
    body=pageHtml.join("");
   }finally{fits.dispose()}
   popup.document.title="Denník "+scope.company_name+" "+from+" – "+to;
   popup.document.getElementById("printTitle").textContent="Denník "+scope.company_name+" · "+from+" – "+to;
   popup.document.getElementById("printStatus").remove();
   popup.document.getElementById("printPages").innerHTML=body;
   popup.focus();showToast("Náhľad denníka je pripravený. Zvoľ „Tlačiť / uložiť PDF“.");
  }catch(error){
   try{
    await waitPrintPreview(popup);
    popup.document.getElementById("printStatus").textContent="Export zlyhal: "+error.message;
    popup.document.getElementById("printNow").hidden=true;
   }catch(_){}
   showToast(error.message);
  }  finally{formBusy("exportDiaryButton",false)}
 }

 function wire(){
  const editingField=node=>node?.matches?.('textarea,input:not([type="radio"]):not([type="checkbox"]):not([type="file"]),select');
  document.addEventListener("focusin",event=>{if(editingField(event.target))document.body.classList.add("is-editing")});
  document.addEventListener("focusout",()=>setTimeout(()=>{if(!editingField(document.activeElement))document.body.classList.remove("is-editing")},80));
  window.visualViewport?.addEventListener("resize",()=>{const field=document.activeElement;if(editingField(field)&&window.innerWidth<=760)setTimeout(()=>field.scrollIntoView({block:"center",behavior:"auto"}),90)});
  $("connectionForm").addEventListener("submit",event=>void connect(event));
  $("authForm").addEventListener("submit",event=>void signIn(event));
  $("signUpButton").addEventListener("click",()=>void signUp());
  $("editConnectionButton").addEventListener("click",()=>{$("connectionCard").hidden=false;$("authCard").hidden=true});
  $("signOutButton").addEventListener("click",()=>void signOut());
  $("refreshButton").addEventListener("click",()=>void refresh());
  $("scopeSelect").addEventListener("change",event=>{state.scopeId=event.target.value;safeStore(PREFERRED_SCOPE_KEY,state.scopeId);state.requestId++;state.diary=null;state.crew=null;state.statement=null;showView(state.view)});
  for(const button of document.querySelectorAll("[data-view]"))button.addEventListener("click",()=>showView(button.dataset.view));
  for(const button of document.querySelectorAll("[data-go]"))button.addEventListener("click",()=>showView(button.dataset.go));
  $("previousDay").addEventListener("click",()=>setDay(addDays(state.day,-1)));
  $("nextDay").addEventListener("click",()=>setDay(addDays(state.day,1)));
  $("dayInput").addEventListener("change",event=>setDay(event.target.value));
  $("previousMonth").addEventListener("click",()=>setMonth(addMonths(state.month,-1)));
  $("nextMonth").addEventListener("click",()=>setMonth(addMonths(state.month,1)));
  $("monthInput").addEventListener("change",event=>setMonth(event.target.value));
  $("diaryForm").addEventListener("submit",event=>void saveDiary(event));
  for(const id of ["diaryWorks","diaryMachinery"])$(id).addEventListener("input",()=>{
   const works=$("diaryWorks").value,machinery=$("diaryMachinery").value;
   if(works===(state.diary?.works||"")&&machinery===(state.diary?.machinery||""))removeDraft("diary");
   else writeDraft("diary",{works,machinery});
   $("diaryDraftHint").textContent=readDraft("diary")?"Neodoslaný návrh je uložený v tomto zariadení. Ulož deň na server.":"";
   $("restoreDiaryDraft").hidden=true
  });
  $("restoreDiaryDraft").addEventListener("click",()=>{
   const draft=readDraft("diary");if(!draft||diaryLocked())return;
   $("diaryWorks").value=String(draft.works??"");$("diaryMachinery").value=String(draft.machinery??"");
   writeDraft("diary",{works:$("diaryWorks").value,machinery:$("diaryMachinery").value});
   $("diaryDraftHint").textContent="Miestny návrh bol obnovený. Ulož deň na server.";$("restoreDiaryDraft").hidden=true
  });
  $("attachmentInput").addEventListener("change",event=>void uploadAttachment(event));
  $("retryAttachment").addEventListener("click",()=>void retryPendingAttachment());
  $("attachmentList").addEventListener("click",event=>{const button=event.target.closest("[data-open-attachment]");if(button)void openAttachment(button.dataset.openAttachment)});
  $("crewForm").addEventListener("submit",event=>void saveCrew(event));
  $("crewCount").addEventListener("input",()=>{
   const count=$("crewCount").value;
   if(count===String(state.crew?.worker_count??0))removeDraft("crew");else writeDraft("crew",{count});
   $("crewDraftHint").textContent=readDraft("crew")?"Neodoslaný počet je uložený v tomto zariadení. Ulož stav na server.":"";
   $("restoreCrewDraft").hidden=true
  });
  $("restoreCrewDraft").addEventListener("click",()=>{
   const draft=readDraft("crew");if(!draft||diaryLocked())return;
   $("crewCount").value=String(draft.count??0);writeDraft("crew",{count:$("crewCount").value});
   $("crewDraftHint").textContent="Miestny návrh bol obnovený. Ulož stav na server.";$("restoreCrewDraft").hidden=true
  });
  $("crewMinus").addEventListener("click",()=>{$("crewCount").value=Math.max(0,(Number($("crewCount").value)||0)-1);$("crewCount").dispatchEvent(new Event("input",{bubbles:true}))});
  $("crewPlus").addEventListener("click",()=>{$("crewCount").value=Math.min(9999,(Number($("crewCount").value)||0)+1);$("crewCount").dispatchEvent(new Event("input",{bubbles:true}))});
  $("statementForm").addEventListener("submit",event=>void saveStatement(event));
  $("restoreStatementDraft").addEventListener("click",()=>{
   const draft=readDraft("statement");if(!draft||statementLocked())return;
   applyStatementDraft(draft);writeDraft("statement",{quantities:statementDraftSnapshot()});recalculateStatement();
   $("statementDraftHint").textContent="Miestny návrh bol obnovený. Ulož súpis na server.";$("restoreStatementDraft").hidden=true
  });
  $("submitStatementButton").addEventListener("click",()=>void submitStatement());
  $("diaryExportForm").addEventListener("submit",event=>void exportDiary(event));
  document.querySelectorAll('input[name="diaryExportMode"]').forEach(input=>input.addEventListener("change",()=>{$("exportRange").hidden=exportMode()!=="range"}));
  window.addEventListener("online",()=>{if(state.session)void refresh()});
 }
 async function start(){
  wire();const inviteError=parseInvite();state.connection=state.connection||loadConnection();state.session=loadSession();showGate();
  if(inviteError)message("connectionMessage",inviteError);
  if(state.connection&&state.session)await enterPortal();
  if("serviceWorker" in navigator&&window.isSecureContext)navigator.serviceWorker.register("sw.js",{scope:"./",updateViaCache:"none"}).catch(()=>{});
  window.__SUBCONTRACTOR_PORTAL_READY__=true
 }
 window.__SUBCONTRACTOR_PORTAL_TEST__={state,normalizeUrl,publicKey,rest,loadScopes,showView,loadDay,loadStatement,dateRange,printDay};
 void start()
})();
