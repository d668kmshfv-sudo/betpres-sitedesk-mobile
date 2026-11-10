(function(){
 "use strict";
 const CONFIG_KEY="betpres-review-connection-v1",SESSION_KEY="betpres-review-session-v1",SCOPE_KEY="betpres-review-scope-v1";
 const $=id=>document.getElementById(id),escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const state={connection:null,session:null,scopes:[],scopeId:"",day:"",days:[],dayRecord:null,calls:[],replies:[],replyCall:null,signup:false};
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
 const dateLabel=value=>{if(!value)return"—";const d=new Date(`${value}T12:00:00`);return Number.isNaN(+d)?value:new Intl.DateTimeFormat("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(d)};
 const stored=key=>{try{return JSON.parse(localStorage.getItem(key)||"null")}catch{return null}};
 const store=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};
 function message(value,tone="neutral"){$("message").textContent=value||"";$("message").dataset.tone=tone;$("message").hidden=!value}
 function normalizeUrl(raw){const value=new URL(String(raw||"").trim());if(value.protocol!=="https:"||!value.hostname.endsWith(".supabase.co")||value.username||value.password||value.search||value.hash||value.pathname!=="/")throw new Error("Použi HTTPS Supabase Project URL.");return value.origin}
 function publicKey(raw){const value=String(raw||"").trim();if(/^sb_secret_/i.test(value)||/service_role/i.test(value))throw new Error("Tajný kľúč nemožno vložiť do odkazu.");if(/^sb_publishable_[A-Za-z0-9_-]+$/.test(value))return value;if(value.split(".").length===3){try{const part=value.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");if(JSON.parse(atob(part+"=".repeat((4-part.length%4)%4))).role==="anon")return value}catch{}}throw new Error("Potrebný je verejný publishable/anon kľúč.")}
 function connectionFromLink(){
  const url=new URL(location.href),projectUrl=url.searchParams.get("project_url"),key=url.searchParams.get("publishable_key"),scope=url.searchParams.get("scope");
  if(projectUrl||key){if(!projectUrl||!key)throw new Error("Odkaz na denník je neúplný.");state.connection={url:normalizeUrl(projectUrl),key:publicKey(key)};store(CONFIG_KEY,state.connection)}
  else state.connection=stored(CONFIG_KEY);
  if(scope&&/^[0-9a-f-]{36}$/i.test(scope)){state.scopeId=scope;store(SCOPE_KEY,scope)}else state.scopeId=stored(SCOPE_KEY)||"";
  for(const param of ["project_url","publishable_key","scope"])url.searchParams.delete(param);
  history.replaceState(null,"",url.pathname+url.search+url.hash)
 }
 async function request(path,{method="GET",body=null,auth=true,prefer=""}={}){
  if(!state.connection)throw new Error("Otvor pozývací odkaz od BETPRES.");
  if(auth)await ensureSession();
  const headers={apikey:state.connection.key,Accept:"application/json"};
  if(auth)headers.Authorization=`Bearer ${state.session.access_token}`;
  if(body!==null)headers["Content-Type"]="application/json";
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(state.connection.url+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:"no-store",credentials:"omit"});
  if(!response.ok){let detail="";try{const result=await response.json();detail=result.msg||result.message||result.error_description||result.error||""}catch{}throw new Error(detail||`Server vrátil ${response.status}.`)}
  if(response.status===204)return null;
  const content=await response.text();return content?JSON.parse(content):null
 }
 async function ensureSession(){
  if(!state.session?.access_token)throw new Error("Prihlás sa do denníka.");
  if(Number(state.session.expires_at||0)-Date.now()/1000>90)return;
  if(!state.session.refresh_token)throw new Error("Prihlásenie vypršalo.");
  const response=await fetch(state.connection.url+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{apikey:state.connection.key,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:state.session.refresh_token}),cache:"no-store",credentials:"omit"});
  if(!response.ok){state.session=null;localStorage.removeItem(SESSION_KEY);throw new Error("Prihlásenie vypršalo. Prihlás sa znova.")}
  const result=await response.json();state.session={...result,expires_at:Math.floor(Date.now()/1000)+Number(result.expires_in||3600)};store(SESSION_KEY,state.session)
 }
 function showLogin(){ $("loginView").hidden=false;$("appView").hidden=true;$("logout").hidden=true;$("userEmail").textContent="" }
 function showApp(){ $("loginView").hidden=true;$("appView").hidden=false;$("logout").hidden=false;$("userEmail").textContent=state.session?.user?.email||"" }
 async function signIn(event){
  event.preventDefault();const button=$("loginButton");button.disabled=true;
  try{
   if(!state.connection)throw new Error("Najprv otvor pozývací odkaz od BETPRES.");
   const email=$("email").value.trim(),password=$("password").value;
   if(state.signup){
    const result=await request("/auth/v1/signup",{method:"POST",body:{email,password},auth:false});
    if(!result?.access_token){message("Účet bol vytvorený. Potvrď e-mail, potom sa prihlás. Vlastník stavby ti musí udeliť prístup.","success");state.signup=false;syncAuthMode();return}
    state.session={...result,expires_at:Math.floor(Date.now()/1000)+Number(result.expires_in||3600)}
   }else{
    const result=await request("/auth/v1/token?grant_type=password",{method:"POST",body:{email,password},auth:false});
    state.session={...result,expires_at:Math.floor(Date.now()/1000)+Number(result.expires_in||3600)}
   }
   store(SESSION_KEY,state.session);$("password").value="";showApp();await refresh();message("Prihlásenie prebehlo úspešne.","success")
  }catch(error){message(error.message,"error")}
  finally{button.disabled=false}
 }
 function syncAuthMode(){$("loginButton").textContent=state.signup?"Vytvoriť účet":"Prihlásiť sa";$("toggleSignup").textContent=state.signup?"Mám účet · prihlásiť sa":"Vytvoriť nový účet";$("password").autocomplete=state.signup?"new-password":"current-password"}
 async function signOut(){
  try{if(state.session?.access_token)await request("/auth/v1/logout?scope=local",{method:"POST"})}catch{}
  state.session=null;state.scopes=[];state.dayRecord=null;state.calls=[];state.replies=[];localStorage.removeItem(SESSION_KEY);showLogin();message("Bol si odhlásený.")
 }
 async function refresh(){
  if(!state.session){showLogin();return}
  try{
   await ensureSession();showApp();
   const scopes=await request("/rest/v1/diary_review_scopes?select=id,project_name,project_id&order=project_name.asc");
   state.scopes=Array.isArray(scopes)?scopes:[];
   if(!state.scopes.length){$("scopeSelect").innerHTML="";$("projectTitle").textContent="Prístup zatiaľ nebol pridelený";message("Vlastník stavby musí najprv pridať tvoj potvrdený e-mail v časti Prístup dozoru.","warning");renderDay();renderCalls();return}
   if(!state.scopes.some(item=>item.id===state.scopeId))state.scopeId=state.scopes[0].id;
   store(SCOPE_KEY,state.scopeId);
   $("scopeSelect").innerHTML=state.scopes.map(item=>`<option value="${escape(item.id)}">${escape(item.project_name)}</option>`).join("");$("scopeSelect").value=state.scopeId;
   const selected=state.scopes.find(item=>item.id===state.scopeId);$("projectTitle").textContent=selected?.project_name||"Stavebný denník";$("dayProject").textContent=selected?.project_name||"";
   await loadScopeData()
  }catch(error){if(!state.session)showLogin();message(error.message,"error")}
 }
 async function loadScopeData(){
  if(!state.scopeId)return;
  const scopeId=state.scopeId;
  const [days,calls]=await Promise.all([
   request(`/rest/v1/diary_review_days?scope_id=eq.${scopeId}&select=id,day&order=day.desc&limit=500`),
   request(`/rest/v1/diary_review_calls?scope_id=eq.${scopeId}&select=id,day,subject,note,recipient,due_at,status,assignee_user_id&order=day.desc,updated_at.desc&limit=500`)
  ]);
  if(scopeId!==state.scopeId)return;
  state.days=Array.isArray(days)?days:[];state.calls=Array.isArray(calls)?calls:[];
  state.replies=state.calls.length?await request("/rest/v1/diary_review_replies?select=id,call_id,user_id,decision,body,created_at&order=created_at.asc&limit=1000"):[];
  if(!state.day)state.day=state.days[0]?.day||today();$("dayInput").value=state.day;
  await loadDay();renderCalls()
 }
 async function loadDay(){
  if(!state.scopeId||!state.day){state.dayRecord=null;renderDay();return}
  const scopeId=state.scopeId,date=state.day;
  const rows=await request(`/rest/v1/diary_review_days?scope_id=eq.${scopeId}&day=eq.${date}&select=*&limit=1`);
  if(scopeId!==state.scopeId||date!==state.day)return;
  state.dayRecord=rows?.[0]||null;renderDay();renderCalls()
 }
 function renderDay(){
  const record=state.dayRecord,weather=record?.weather||{},works=Array.isArray(record?.works)?record.works:[],crew=Array.isArray(record?.crew)?record.crew:[],machines=Array.isArray(record?.machines)?record.machines:[];
  $("dayHeading").textContent=dateLabel(state.day||today());
  const temperature=[weather.min,weather.max].filter(value=>value!==""&&value!==null&&value!==undefined).map(value=>`${Math.round(Number(value))} °C`).join(" až ");
  $("weatherContent").innerHTML=record&&weather.text?`<p>${escape(weather.text)}${temperature?` · ${escape(temperature)}`:""}</p><small>${escape(weather.source||"")}</small>`:'<p class="muted">Počasie nie je zapísané.</p>';
  $("crewContent").innerHTML=crew.length?crew.map(item=>`<div class="record-row"><span>${escape(item.profession||"Pracovník")}<small>${escape(item.companyName||"")}</small></span><strong>${escape(item.count||0)}</strong></div>`).join(""):'<p class="muted">Pracovníci nie sú zapísaní.</p>';
  $("machineContent").innerHTML=machines.length?machines.map(item=>`<div class="record-row"><span>${escape(item.name||"Mechanizmus")}<small>${escape(item.companyName||"")}</small></span><strong>${escape(item.count||0)}</strong></div>`).join(""):'<p class="muted">Mechanizmy nie sú zapísané.</p>';
  $("workContent").innerHTML=works.length?works.map(item=>`<div class="record-row"><p>${escape(item.work||"")}</p><strong>${Number(item.workersCount)||0} os.</strong></div>`).join(""):'<p class="muted">Vykonané práce nie sú zapísané.</p>'
 }
 function decisionName(value){return({acknowledged:"Vzaté na vedomie",accepted:"Potvrdené prevzatie / kontrola",needs_action:"Požadované doplnenie"})[value]||value}
 function callHtml(call){
  const answers=state.replies.filter(item=>item.call_id===call.id),closed=call.status==="closed";
  return `<article class="call-item ${closed?"is-closed":""}" data-call="${escape(call.id)}"><strong>${escape(call.subject)}</strong><small>${escape(dateLabel(call.day))}${call.due_at?` · termín ${escape(new Date(call.due_at).toLocaleString("sk-SK"))}`:""}${closed?" · uzatvorené":""}</small>${call.note?`<p>${escape(call.note)}</p>`:""}<div class="call-actions"><button type="button" class="quiet" data-call-day="${escape(call.day)}">Zobraziť deň</button>${closed?"":`<button type="button" class="primary" data-reply-call="${escape(call.id)}">Odpovedať</button>`}</div>${answers.map(reply=>`<div class="reply"><strong>${escape(decisionName(reply.decision))} · ${escape(new Date(reply.created_at).toLocaleString("sk-SK"))}</strong>${escape(reply.body)}</div>`).join("")}</article>`
 }
 function renderCalls(){
  const dayCalls=state.calls.filter(call=>call.day===state.day);
  $("callCount").textContent=String(dayCalls.filter(call=>call.status==="open").length);
  $("dayCalls").innerHTML=dayCalls.length?dayCalls.map(callHtml).join(""):'<p class="empty">Na vybraný deň nemáš adresovanú výzvu.</p>';
  const other=state.calls.filter(call=>call.day!==state.day);
  $("callList").innerHTML=other.length?other.map(callHtml).join(""):'<p class="empty">Žiadne ďalšie výzvy.</p>'
 }
 function setDay(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;state.day=value;$("dayInput").value=value;void loadDay().catch(error=>message(error.message,"error"))}
 function moveDay(delta){const date=new Date(`${state.day||today()}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+delta);setDay(date.toISOString().slice(0,10))}
 function openReply(id){const call=state.calls.find(item=>item.id===id);if(!call||call.status!=="open")return;state.replyCall=call;$("replyTitle").textContent=call.subject;$("replyContext").textContent=`${dateLabel(call.day)} · ${call.recipient||"výzva"}`;$("replyBody").value="";$("replyDecision").value="acknowledged";$("replyDialog").showModal();$("replyBody").focus()}
 async function submitReply(event){
  event.preventDefault();const call=state.replyCall,body=$("replyBody").value.trim(),button=$("sendReply");if(!call||!body)return;
  button.disabled=true;
  try{
   const result=await request("/rest/v1/diary_review_replies?select=*",{method:"POST",body:{call_id:call.id,decision:$("replyDecision").value,body},prefer:"return=representation"});
   if(!Array.isArray(result)||result.length!==1)throw new Error("Databáza nepotvrdila odpoveď.");
   $("replyDialog").close();state.replyCall=null;await loadScopeData();message("Odpoveď na výzvu bola uložená.","success")
  }catch(error){message(error.message,"error")}
  finally{button.disabled=false}
 }
 async function start(){
  try{connectionFromLink()}catch(error){message(error.message,"error")}
  state.session=stored(SESSION_KEY);state.day="";showLogin();
  if(state.session){try{await ensureSession();showApp();await refresh()}catch(error){showLogin();message(error.message,"error")}}
  else if(!state.connection)message("Otvor pozývací odkaz od BETPRES.","warning")
 }
 $("loginForm").onsubmit=event=>void signIn(event);$("toggleSignup").onclick=()=>{state.signup=!state.signup;syncAuthMode()};$("logout").onclick=()=>void signOut();$("refresh").onclick=()=>void refresh();
 $("scopeSelect").onchange=event=>{state.scopeId=event.target.value;store(SCOPE_KEY,state.scopeId);state.day="";void refresh()};
 $("dayInput").onchange=event=>setDay(event.target.value);$("previousDay").onclick=()=>moveDay(-1);$("nextDay").onclick=()=>moveDay(1);
 for(const id of ["callList","dayCalls"])$(id).onclick=event=>{const reply=event.target.closest("[data-reply-call]");if(reply){openReply(reply.dataset.replyCall);return}const date=event.target.closest("[data-call-day]");if(date)setDay(date.dataset.callDay)};
 $("closeReply").onclick=()=>$("replyDialog").close();$("cancelReply").onclick=()=>$("replyDialog").close();$("replyForm").onsubmit=event=>void submitReply(event);
 void start()
})();
