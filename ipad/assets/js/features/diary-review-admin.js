(function(){
 "use strict";
 const root=document.getElementById("diaryReviewAdmin");if(!root)return;
 const $=id=>document.getElementById(id);
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const today=()=>typeof todayISO==="function"?todayISO():new Date().toISOString().slice(0,10);
 const roles={supervisor:"Stavebný dozor",designer:"Projektant",investor:"Investor",reviewer:"Kontrolór"};
 let context="",scope=null,members=[],calls=[],replies=[],isOwner=false,loading=0;
 const timers=new Map();
 function notify(message,tone="neutral"){$("drStatus").textContent=message||"";$("drStatus").dataset.tone=tone}
 function setup(message){$("drSetup").classList.remove("hidden");$("drWorkspace").classList.add("hidden");$("drSetupText").textContent=message;notify(message,"warning")}
 function workspace(){ $("drSetup").classList.add("hidden");$("drWorkspace").classList.remove("hidden") }
 function handle(error,action="Načítanie"){
  const detail=String(error?.message||error||"Neznáma chyba");
  if(/PGRST205|PGRST202|could not find|does not exist|schema cache|relation .*diary_review_|404/i.test(detail))setup("Oddelené tabuľky dozoru ešte nie sú zapnuté v databáze. Správca musí spustiť migráciu denníka.");
  else notify(`${action} zlyhalo: ${detail}`,"error")
 }
 function project(){return state.projects.find(item=>item.id===state.selectedProjectId)||null}
 function link(){
  if(!scope||!cloudConfigured())return"";
  try{assertPublicCloudKey(cloudConfig.key)}catch{return""}
  const url=new URL("../dozor/",document.baseURI);
  url.searchParams.set("project_url",cloudConfig.url);url.searchParams.set("publishable_key",cloudConfig.key);url.searchParams.set("scope",scope.id);
  return url.href
 }
 function renderMembers(){
  $("drMemberForm").classList.toggle("hidden",!isOwner);
  $("drMembers").innerHTML=members.length?members.map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.email)}</strong><small>${escape(roles[item.role]||item.role)}${isOwner?` <button type="button" class="ghost" data-dr-remove="${escape(item.user_id)}">Odobrať</button>`:""}</small></div>`).join(""):'<p class="subcontract-admin-empty">Zatiaľ nie je pozvaný žiadny dozor ani projektant.</p>';
  $("drPortalLink").value=link()
 }
 function renderScope(){
  $("drProjectName").textContent=project()?.name||"Aktuálna stavba";
  $("drCreateScope").classList.toggle("hidden",Boolean(scope));
  $("drScopeContent").classList.toggle("hidden",!scope);
  $("drScopeHint").textContent=scope?"Oddelený prístup je pripravený. Denník a adresované výzvy môže čítať iba priradený účet.":"Najprv zriaď oddelený priestor pre denník aktuálnej stavby.";
  if(scope){renderMembers();void loadCalls();void loadDayCount()}
 }
 async function refresh(){
  const ticket=++loading;
  if(!cloudConfigured()){setup("Najprv ulož Project URL a verejný publishable/anon kľúč v časti Cloud a databáza.");return}
  if(!cloudSessionUser()?.id){setup("Najprv sa prihlás do svojho účtu v časti Cloud a databáza.");return}
  const workspaceId=cloudConfig.lastCloudId||"";
  if(!workspaceId){setup("Najprv načítaj pracovný priestor v časti Cloud a databáza.");return}
  try{
   const role=await cloudLoadCurrentRole(workspaceId);
   if(ticket!==loading)return;
   if(!["owner","editor"].includes(role)){setup("Tento účet nemá oprávnenie hlavného zhotoviteľa.");return}
   isOwner=role==="owner";
   const rows=await cloudFetch(`/rest/v1/diary_review_scopes?workspace_id=eq.${encodeURIComponent(workspaceId)}&project_id=eq.${encodeURIComponent(state.selectedProjectId)}&select=*&limit=1`);
   if(ticket!==loading)return;
   scope=Array.isArray(rows)?rows[0]||null:null;members=[];calls=[];replies=[];
   if(scope){const result=await cloudFetch(`/rest/v1/diary_review_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`);members=Array.isArray(result)?result:[]}
   if(ticket!==loading)return;
   workspace();renderScope();notify(scope?"Prístup k denníku je pripravený.":"Zriaď oddelený prístup k denníku aktuálnej stavby.")
  }catch(error){if(ticket===loading)handle(error,"Načítanie prístupu")}
 }
 async function createScope(){
  if(scope||!project())return;
  $("drCreateScope").disabled=true;
  try{
   const result=await cloudFetch("/rest/v1/diary_review_scopes?select=*",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({workspace_id:cloudConfig.lastCloudId,project_id:state.selectedProjectId,project_name:project().name})});
   if(!Array.isArray(result)||!result[0]?.id)throw new Error("Databáza nepotvrdila vytvorenie priestoru.");
   scope=result[0];renderScope();notify("Oddelený denník bol zriadený. Teraz pridaj účet dozoru a zverejni dni.","success")
  }catch(error){handle(error,"Zriadenie prístupu")}
  finally{$("drCreateScope").disabled=false}
 }
 async function addMember(event){
  event.preventDefault();if(!scope||!isOwner)return;
  const email=$("drMemberEmail").value.trim(),role=$("drMemberRole").value,button=$("drMemberForm").querySelector('button[type="submit"]');button.disabled=true;
  try{
   await cloudRpc("diary_review_add_member",{p_scope_id:scope.id,p_email:email,p_role:role});
   const result=await cloudFetch(`/rest/v1/diary_review_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`);members=Array.isArray(result)?result:[];
   $("drMemberEmail").value="";renderMembers();await loadCalls();notify(`Účet ${email} má prístup iba k denníku tejto stavby.`,"success")
  }catch(error){handle(error,"Pridanie účtu")}
  finally{button.disabled=false}
 }
 async function removeMember(userId){
  const member=members.find(item=>item.user_id===userId);if(!scope||!isOwner||!member)return;
  if(!confirm(`Odobrať účtu ${member.email} prístup k denníku a výzvam?`))return;
  try{await cloudRpc("diary_review_remove_member",{p_scope_id:scope.id,p_user_id:userId});members=members.filter(item=>item.user_id!==userId);renderMembers();await loadCalls();notify("Prístup bol odobratý.","success")}
  catch(error){handle(error,"Odobratie prístupu")}
 }
 function localInspections(date){return(state.siteDiaryInspections||[]).filter(item=>item.projectId===state.selectedProjectId&&item.date===date).sort((a,b)=>String(a.createdAt||"").localeCompare(String(b.createdAt||"")))}
 async function publishDay(date,{quiet=false}={}){
  if(!scope||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const snapshot=window.siteDiaryReviewSnapshot?.(date);
  if(!snapshot)throw new Error("Denník sa ešte nenačítal. Obnov stránku.");
  const result=await cloudFetch("/rest/v1/diary_review_days?on_conflict=scope_id,day&select=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({scope_id:scope.id,...snapshot})});
  if(!Array.isArray(result)||!result.length)throw new Error("Databáza nepotvrdila zverejnenie dňa.");
  const published=await cloudFetch(`/rest/v1/diary_review_calls?scope_id=eq.${scope.id}&day=eq.${date}&select=*`);
  const local=new Map(localInspections(date).map(item=>[item.id,item]));
  for(const call of published||[]){
   const source=local.get(call.source_id),status=source?.status==="done"||!source?"closed":"open";
   const changes=source?{recipient:source.recipient||"",subject:source.subject||"",note:source.note||"",due_at:source.dueAt?new Date(source.dueAt).toISOString():null,status}:{status};
   if(Object.entries(changes).some(([key,value])=>call[key]!==value))await cloudFetch(`/rest/v1/diary_review_calls?id=eq.${call.id}`,{method:"PATCH",body:JSON.stringify(changes)})
  }
  if(!quiet){notify(`Deň ${date} je zverejnený pre priradených používateľov.`,"success");void loadDayCount()}
 }
 function allDates(){
  const projectId=state.selectedProjectId,dates=new Set();
  for(const name of ["mobileDiary","siteDiaryWeather","siteDiaryCrew","siteDiaryMachinery","siteDiaryInspections"])
   for(const item of state[name]||[])if(item.projectId===projectId&&item.date&&(name!=="mobileDiary"||item.kind==="siteLog"))dates.add(item.date);
  return[...dates].sort()
 }
 async function publishAll(){
  if(!scope)return;const dates=allDates();if(!dates.length){notify("Na tejto stavbe zatiaľ nie sú uložené dni denníka.","warning");return}
  const button=$("drPublishAll");button.disabled=true;let completed=0;
  try{for(const date of dates){await publishDay(date,{quiet:true});completed++;notify(`Zverejňujem denník: ${completed} z ${dates.length} dní…`)}notify(`Zverejnených ${completed} dní denníka.`,"success");await loadDayCount()}
  catch(error){handle(error,`Zverejnenie po ${completed} dňoch`)}
  finally{button.disabled=false}
 }
 async function loadDayCount(){
  if(!scope)return;
  try{const result=await cloudFetch(`/rest/v1/diary_review_days?scope_id=eq.${scope.id}&select=id`,{headers:{Prefer:"count=exact"}});$("drPublishedCount").textContent=`Zverejnené dni: ${Array.isArray(result)?result.length:0}`}
  catch{$("drPublishedCount").textContent="Počet dní sa nepodarilo načítať."}
 }
 async function loadCalls(){
  if(!scope)return;
  const date=$("drDay").value||today();
  try{
   const rows=await cloudFetch(`/rest/v1/diary_review_calls?scope_id=eq.${scope.id}&day=eq.${date}&select=*&order=updated_at.desc`);
   if(date!==$("drDay").value)return;calls=Array.isArray(rows)?rows:[];
   const groups=await Promise.all(calls.map(item=>cloudFetch(`/rest/v1/diary_review_replies?call_id=eq.${item.id}&select=*&order=created_at.asc`)));
   replies=groups.flat();renderCalls()
  }catch(error){handle(error,"Načítanie výziev")}
 }
 function renderCalls(){
  const local=localInspections($("drDay").value||today()),bySource=new Map(calls.map(item=>[item.source_id,item]));
  $("drCalls").innerHTML=local.length?local.map(item=>{
   const published=bySource.get(item.id),person=members.find(member=>member.user_id===published?.assignee_user_id);
   const options='<option value="">Vyber príjemcu</option>'+members.map(member=>`<option value="${escape(member.user_id)}" ${member.user_id===published?.assignee_user_id?"selected":""}>${escape(member.email)} · ${escape(roles[member.role]||member.role)}</option>`).join("");
   const mail=published&&person?`<a class="ghost" href="mailto:${encodeURIComponent(person.email)}?subject=${encodeURIComponent(`Výzva na kontrolu · ${project()?.name||"Stavba"}`)}&body=${encodeURIComponent(`Dobrý deň,\n\nvo stavebnom denníku stavby ${project()?.name||""} je pre Vás výzva: ${item.subject}\nDeň: ${item.date}${item.dueAt?`\nTermín: ${item.dueAt}`:""}\n\nOtvorte denník, prihláste sa a odpovedzte na výzvu:\n${link()}\n`)}">Pripraviť e-mail</a>`:"";
   const answers=published?replies.filter(reply=>reply.call_id===published.id).map(reply=>`<div class="diary-review-reply"><strong>Odpoveď · ${escape(new Date(reply.created_at).toLocaleString("sk-SK"))}</strong><p>${escape(reply.body)}</p><small>${escape(reply.decision)}</small></div>`).join(""):"";
   return `<div class="diary-review-call"><strong>${escape(item.subject)}</strong><small>${escape(item.recipient||"")} ${item.dueAt?`· do ${escape(item.dueAt)}`:""}</small><div class="subcontract-admin-action-row"><select data-dr-assignee="${escape(item.id)}" aria-label="Príjemca výzvy ${escape(item.subject)}">${options}</select><button type="button" data-dr-assign="${escape(item.id)}">${published?"Aktualizovať príjemcu":"Priradiť výzvu"}</button>${mail}</div>${answers}</div>`
  }).join(""):'<p class="subcontract-admin-empty">V tento deň nie sú zapísané výzvy. Pridaj ich v stavebnom denníku.</p>'
 }
 async function assignCall(sourceId){
  if(!scope)return;
  const source=localInspections($("drDay").value).find(item=>item.id===sourceId),select=$("drCalls").querySelector(`[data-dr-assignee="${CSS.escape(sourceId)}"]`),userId=select?.value;
  if(!source||!userId){select?.focus();notify("Vyber príjemcu výzvy.","warning");return}
  try{
   await publishDay(source.date,{quiet:true});
   const payload={scope_id:scope.id,source_id:source.id,day:source.date,assignee_user_id:userId,recipient:source.recipient||"",subject:source.subject,note:source.note||"",due_at:source.dueAt?new Date(source.dueAt).toISOString():null,status:source.status==="done"?"closed":"open"};
   const result=await cloudFetch("/rest/v1/diary_review_calls?on_conflict=scope_id,source_id&select=*",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
   if(!Array.isArray(result)||!result.length)throw new Error("Databáza nepotvrdila priradenie výzvy.");
   await loadCalls();notify("Výzva je priradená. Klikni Pripraviť e-mail a odošli ho príjemcovi.","success")
  }catch(error){handle(error,"Priradenie výzvy")}
 }
 function render(){
  $("drDay").value=$("drDay").value||today();
  const key=[state.selectedProjectId,cloudConfig?.lastCloudId,cloudSessionUser()?.id,cloudConfig?.url].join("|");
  if(key!==context){context=key;scope=null;members=[];calls=[];replies=[];void refresh()}
  else if(scope)renderCalls()
 }
 window.queueDiaryReviewPublish=date=>{
  if(!cloudConfigured()||!cloudSessionUser()?.id||!cloudConfig.lastCloudId||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
  const projectId=state.selectedProjectId,workspaceId=cloudConfig.lastCloudId,key=`${projectId}:${date}`;clearTimeout(timers.get(key));
  timers.set(key,setTimeout(async()=>{
   timers.delete(key);
   try{
    if(state.selectedProjectId!==projectId||cloudConfig.lastCloudId!==workspaceId)return;
    if(!scope||scope.project_id!==state.selectedProjectId){
     const result=await cloudFetch(`/rest/v1/diary_review_scopes?workspace_id=eq.${encodeURIComponent(cloudConfig.lastCloudId)}&project_id=eq.${encodeURIComponent(state.selectedProjectId)}&select=*&limit=1`);
     if(!result?.[0])return;scope=result[0]
    }
    await publishDay(date,{quiet:true})
   }catch(error){notify(`Denník je uložený lokálne; zverejnenie pre dozor zlyhalo: ${error.message||error}`,"warning")}
  },900))
 };
 $("drRefresh").onclick=()=>void refresh();$("drOpenCloud").onclick=()=>showView("cloud");
 $("drCreateScope").onclick=()=>void createScope();$("drMemberForm").onsubmit=event=>void addMember(event);
 $("drMembers").onclick=event=>{const button=event.target.closest("[data-dr-remove]");if(button)void removeMember(button.dataset.drRemove)};
 $("drCopyLink").onclick=async()=>{try{await navigator.clipboard.writeText(link());notify("Odkaz bol skopírovaný.","success")}catch{$("drPortalLink").select();document.execCommand("copy");notify("Odkaz bol skopírovaný.","success")}};
 $("drPublishAll").onclick=()=>void publishAll();$("drPublishDay").onclick=()=>void publishDay($("drDay").value).catch(error=>handle(error,"Zverejnenie dňa"));
 $("drDay").onchange=()=>void loadCalls();$("drCalls").onclick=event=>{const button=event.target.closest("[data-dr-assign]");if(button)void assignCall(button.dataset.drAssign)};
 window.renderDiaryReviewAdmin=render
})();
