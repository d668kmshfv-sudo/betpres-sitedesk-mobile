(function(){
 "use strict";
 const root=document.getElementById("subcontractAdmin");
 if(!root)return;
 const $=id=>document.getElementById(id);
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const today=()=>typeof todayISO==="function"?todayISO():new Date().toISOString().slice(0,10);
 const month=()=>today().slice(0,7);
 const money=value=>new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"}).format(Number(value)||0);
 const dateLabel=value=>value&&typeof fmtDateISO==="function"?fmtDateISO(value):value||"—";
 let contextKey="",workspaceId="",scopes=[],scope=null,companyId="",publishedItems=[],dayRecord=null,crewRecord=null,attachments=[],statement=null,statementRows=[],requestVersion=0,isOwner=false;

 function notify(message,tone="neutral"){
  const node=$("saStatus");node.textContent=message;node.dataset.tone=tone;
 }
 function showSetup(message){$("saSetup").classList.remove("hidden");$("saWorkspace").classList.add("hidden");$("saSetupText").textContent=message;notify(message,"warning")}
 function showWorkspace(){$("saSetup").classList.add("hidden");$("saWorkspace").classList.remove("hidden")}
 function isSetupError(error){return /PGRST205|PGRST202|could not find|does not exist|schema cache|relation .*subcontract_|404/i.test(String(error?.message||error))}
 function handleError(error,action="Načítanie"){
  const detail=String(error?.message||error||"Neznáma chyba");
  if(isSetupError(error))showSetup("Vyžaduje nastavenie databázy. Oddelené tabuľky a prístupové pravidlá subdodávok ešte neboli zapnuté. Kontaktuj správcu BETPRES.");
  else notify(`${action} zlyhalo: ${detail}`,"error")
 }
 function currentCompany(){return state.companies.find(item=>item.id===companyId)||null}
 function assignedCompanies(){return state.assignments.filter(item=>item.projectId===state.selectedProjectId).map(item=>state.companies.find(c=>c.id===item.companyId)).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"sk"))}
 function renderPicker(){
  const previous=companyId,companies=assignedCompanies();
  if(!companies.some(item=>item.id===companyId))companyId=companies[0]?.id||"";
  $("saCompany").innerHTML=companies.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("")||'<option value="">Najprv priraď firmu ku stavbe</option>';
  $("saCompany").value=companyId;
  $("saProjectName").textContent=activeProject()?.name||"Aktuálna stavba";
  $("saCompanyHelp").textContent=companies.length?`${companies.length} firiem priradených k tejto stavbe`:'Firmu pridáš v časti Firmy a zmluvy.';
  if(previous!==companyId)scope=null;
 }
 function sourceItems(){
  const byId=new Map();let sourceLabel="";
  const budgets=(state.workBudgets||[]).filter(item=>item.projectId===state.selectedProjectId&&item.companyId===companyId);
  for(const budget of budgets){
   sourceLabel="Úvodný súpis / rozpočet";
   for(const [index,item] of (budget.items||[]).entries()){
    if(String(item.type||"").toUpperCase()==="D"||!String(item.description||"").trim())continue;
    const sourceId=String(item.id||`budget:${budget.id}:${index}`);
    if(!byId.has(sourceId))byId.set(sourceId,{source_item_id:sourceId,code:String(item.code||item.pc||""),description:String(item.description||""),unit:String(item.unit||""),contract_qty:workNumber(item.contractQty),unit_price:workNumber(item.unitPrice),sort_order:byId.size+1,is_active:true})
   }
  }
  const latest=(state.workStatements||[]).filter(item=>item.projectId===state.selectedProjectId&&item.companyId===companyId).sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")))[0];
  if(latest){
   if(!byId.size)sourceLabel=`Existujúci súpis ${latest.period||""}`;
   for(const [index,item] of (latest.items||[]).entries()){
    if(String(item.type||"").toUpperCase()==="D"||!String(item.description||"").trim())continue;
    const sourceId=String(item.budgetItemId||item.id||`statement:${latest.id}:${index}`);
    if(!byId.has(sourceId)){
     if(budgets.length)sourceLabel="Rozpočet a doplnené položky súpisu";
     byId.set(sourceId,{source_item_id:sourceId,code:String(item.code||item.pc||""),description:String(item.description||""),unit:String(item.unit||""),contract_qty:workNumber(item.contractQty),unit_price:workNumber(item.unitPrice),sort_order:byId.size+1,is_active:true})
    }
   }
  }
  return{items:[...byId.values()],sourceLabel};
 }
 function workNumber(value){
  if(typeof parseWorkNumber==="function")return Number(parseWorkNumber(value))||0;
  const n=Number(String(value??"").replace(/\s/g,"").replace(",","."));return Number.isFinite(n)?n:0
 }
 function renderSource(){
  const source=sourceItems(),hasScope=Boolean(scope);
  $("saBudgetSource").textContent=source.items.length?`${source.sourceLabel}: ${source.items.length} položiek iba pre ${currentCompany()?.name||"vybranú firmu"}.`:"Pre túto firmu ešte nie je pripravený rozpočet ani súpis. Najprv pridaj položky v časti Súpis prác.";
  $("saPublishBudget").disabled=!hasScope||!source.items.length;
 }
 function renderScope(){
  scope=scopes.find(item=>item.company_id===companyId)||null;
  $("saInviteForm").classList.toggle("hidden",!isOwner);
  $("saShare").classList.toggle("hidden",!isOwner);
  $("saOwnerOnlyHint").classList.toggle("hidden",isOwner);
  $("saCreateScope").classList.toggle("hidden",Boolean(scope)||!companyId);
  $("saScopeContent").classList.toggle("hidden",!scope);
  if(!companyId)notify("Na tejto stavbe zatiaľ nie je priradená firma.","warning");
  else if(!scope)notify(`Firma ${currentCompany()?.name||""} ešte nemá oddelený priestor. Zriaď ho, potom jej priraď účet.`,"neutral");
  else notify(`Oddelený priestor firmy ${scope.company_name||currentCompany()?.name||""} je pripravený.`,"success");
  renderSource();
  if(!scope)return;
  const share=portalLink(scope.id);
  $("saPortalLink").value=share;
  $("saDiaryLock").textContent=scope.diary_closed_at?"Celý denník uzatvorený":"Denník otvorený";
  $("saDiaryLock").classList.toggle("locked",Boolean(scope.diary_closed_at));
  $("saCloseDiary").disabled=Boolean(scope.diary_closed_at);
  void loadScopeDetails(scope.id)
 }
 function portalLink(id){
  if(!id||!cloudConfigured())return"";
  try{assertPublicCloudKey(cloudConfig.key)}catch{return""}
  const url=new URL("../subdodavatelia/",document.baseURI);
  url.searchParams.set("project_url",cloudConfig.url);
  url.searchParams.set("publishable_key",cloudConfig.key);
  url.searchParams.set("scope",id);
  return url.href
 }
 async function refresh(){
  const token=++requestVersion;
  renderPicker();
  if(!cloudConfigured()){showSetup("Najprv ulož Project URL a verejný publishable/anon kľúč v časti Cloud a databáza.");return}
  if(!cloudSessionUser()?.id){showSetup("Najprv sa prihlás do účtu hlavného zhotoviteľa v časti Cloud a databáza.");return}
  workspaceId=cloudConfig.lastCloudId||"";
  if(!workspaceId){showSetup("Najprv načítaj pracovný priestor v časti Cloud a databáza. Potom sa sem vráť.");return}
  notify("Načítavam oddelené priestory subdodávok…");
  try{
   const role=await cloudLoadCurrentRole(workspaceId);
   if(token!==requestVersion)return;
   if(!["owner","editor"].includes(role)){showSetup("Tento účet nemá oprávnenie hlavného zhotoviteľa na správu subdodávok.");return}
   isOwner=role==="owner";
   const rows=await cloudFetch(`/rest/v1/subcontract_scopes?workspace_id=eq.${encodeURIComponent(workspaceId)}&project_id=eq.${encodeURIComponent(state.selectedProjectId)}&select=*&order=company_name.asc`,{headers:{Accept:"application/json"}});
   if(token!==requestVersion)return;
   scopes=Array.isArray(rows)?rows:[];
   showWorkspace();renderScope()
  }catch(error){if(token===requestVersion)handleError(error,"Načítanie portálu")}
 }
 async function createScope(){
  if(!companyId||!assignedCompanies().some(item=>item.id===companyId))return;
  if(scopes.some(item=>item.company_id===companyId)){renderScope();return}
  const company=currentCompany(),project=activeProject();
  if(!company||!project)return;
  $("saCreateScope").disabled=true;
  try{
   const rows=await cloudFetch("/rest/v1/subcontract_scopes?select=*",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({workspace_id:workspaceId,project_id:project.id,company_id:company.id,project_name:project.name,company_name:company.name})});
   const created=Array.isArray(rows)?rows[0]:null;
   if(!created?.id)throw new Error("Databáza nevrátila nový priestor.");
   scopes.push(created);renderScope();notify(`Priestor firmy ${company.name} bol zriadený. Teraz priraď jej účet.`,"success")
  }catch(error){handleError(error,"Zriadenie priestoru")}
  finally{$("saCreateScope").disabled=false}
 }
 async function loadScopeDetails(id){
  const token=++requestVersion;
  try{
   const [members,items]=await Promise.all([
    cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${id}&select=*&order=created_at.asc`),
    cloudFetch(`/rest/v1/subcontract_work_items?scope_id=eq.${id}&select=*&order=sort_order.asc`)
   ]);
   if(token!==requestVersion||scope?.id!==id)return;
   publishedItems=Array.isArray(items)?items:[];
   renderMembers(Array.isArray(members)?members:[]);renderPublished();
   await Promise.all([loadDay(id),loadStatement(id)])
  }catch(error){if(token===requestVersion)handleError(error,"Načítanie údajov subdodávky")}
 }
 function renderMembers(rows){
  $("saMembers").innerHTML=rows.length?rows.map(row=>`<div class="subcontract-admin-list-row"><strong>${escape(row.email||row.user_id||"Účet")}</strong><small>${escape(row.role||"subdodávka")}${isOwner?`<button type="button" class="ghost" data-remove-subcontract-member="${escape(row.user_id)}" data-member-email="${escape(row.email||"")}">Odobrať prístup</button>`:""}</small></div>`).join(""):'<p class="subcontract-admin-empty">Zatiaľ nie je priradený žiadny účet.</p>'
 }
 async function removeMember(userId,email){
  if(!scope||!isOwner||!userId)return;
  if(!confirm(`Odobrať prístup účtu ${email||userId} k denníku a súpisom firmy ${currentCompany()?.name||""}?`))return;
  try{
   await cloudRpc("subcontract_remove_member",{p_scope_id:scope.id,p_user_id:userId});
   const rows=await cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`);
   renderMembers(Array.isArray(rows)?rows:[]);notify(`Prístup účtu ${email||userId} bol odobratý.`,"success")
  }catch(error){handleError(error,"Odobratie prístupu")}
 }
 function renderPublished(){
  const active=publishedItems.filter(item=>item.is_active!==false);
  $("saPublished").innerHTML=active.length?`<div class="subcontract-admin-count">Zverejnených ${active.length} položiek</div>${active.slice(0,8).map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.code||"")} ${escape(item.description||"")}</strong><small>${escape(item.unit||"")} · ${money(item.unit_price)} bez DPH</small></div>`).join("")}${active.length>8?`<small>+ ďalších ${active.length-8} položiek</small>`:""}`:'<p class="subcontract-admin-empty">Firma zatiaľ nemá zverejnené položky súpisu.</p>';
  renderSource()
 }
 async function publishBudget(){
  if(!scope||scope.project_id!==state.selectedProjectId||scope.company_id!==companyId)return;
  const {items}=sourceItems();if(!items.length)return;
  const confirmed=confirm(`Zverejniť ${items.length} položiek iba firme ${currentCompany()?.name||""}? Pridelené množstvá v uzatvorených mesiacoch zostanú zachované.`);
  if(!confirmed)return;
  $("saPublishBudget").disabled=true;
  try{
   const payload=items.map(item=>({...item,scope_id:scope.id}));
   const result=await cloudFetch("/rest/v1/subcontract_work_items?on_conflict=scope_id,source_item_id&select=*",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
   if(!Array.isArray(result))throw new Error("Databáza nepotvrdila zverejnenie položiek.");
   publishedItems=await cloudFetch(`/rest/v1/subcontract_work_items?scope_id=eq.${scope.id}&select=*&order=sort_order.asc`);
   renderPublished();notify(`${items.length} položiek bolo zverejnených firme ${currentCompany()?.name||""}.`,"success")
  }catch(error){handleError(error,"Zverejnenie súpisu")}
  finally{renderSource()}
 }
 async function invite(event){
  event.preventDefault();if(!scope||!isOwner)return;
  const email=$("saMemberEmail").value.trim();if(!email)return;
  const button=$("saInviteForm").querySelector("button");button.disabled=true;
  try{
   await cloudRpc("subcontract_add_member",{p_scope_id:scope.id,p_email:email});
   const rows=await cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`);
   renderMembers(Array.isArray(rows)?rows:[]);$("saMemberEmail").value="";
   notify(`Účet ${email} bol priradený iba firme ${currentCompany()?.name||""}.`,"success")
  }catch(error){handleError(error,"Pridanie účtu")}
  finally{button.disabled=false}
 }
 function nextDay(value,delta){const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)}
 async function loadDay(id){
  if(!scope||scope.id!==id)return;
  const date=$("saDiaryDate").value||today();
  const [days,crew,notes]=await Promise.all([
   cloudFetch(`/rest/v1/subcontract_diary_days?scope_id=eq.${id}&day=eq.${date}&select=*`),
   cloudFetch(`/rest/v1/subcontract_daily_crew?scope_id=eq.${id}&day=eq.${date}&select=*`),
   cloudFetch(`/rest/v1/subcontract_owner_notes?scope_id=eq.${id}&day=eq.${date}&select=*&order=created_at.asc`)
  ]);
  if(scope?.id!==id||$("saDiaryDate").value!==date)return;
  dayRecord=Array.isArray(days)?days[0]||null:null;crewRecord=Array.isArray(crew)?crew[0]||null:null;
  attachments=dayRecord?.id?await cloudFetch(`/rest/v1/subcontract_attachments?scope_id=eq.${id}&diary_day_id=eq.${dayRecord.id}&select=id,path,name,mime_type,size_bytes,created_at&order=created_at.asc`):[];
  if(scope?.id!==id||$("saDiaryDate").value!==date)return;
  renderDay(Array.isArray(notes)?notes:[])
 }
 function renderDay(notes){
  const locked=Boolean(scope?.diary_closed_at)||dayRecord?.status==="closed";
  $("saDiaryLock").textContent=scope?.diary_closed_at?"Celý denník uzatvorený":locked?"Deň uzatvorený":"Deň otvorený";
  $("saDiaryLock").classList.toggle("locked",locked);
  const professions=crewRecord?.professions&&typeof crewRecord.professions==="object"?Object.entries(crewRecord.professions).filter(([,count])=>Number(count)>0).map(([name,count])=>`${escape(name)}: ${escape(count)}`).join(" · "):"";
  $("saDiaryDetail").innerHTML=`<div class="subcontract-admin-record-date">${escape(dateLabel($("saDiaryDate").value))}</div><div class="subcontract-admin-record-block"><span>Vykonané práce</span><p>${escape(dayRecord?.works||"Zatiaľ bez zápisu.")}</p></div><div class="subcontract-admin-record-block"><span>Mechanizmy</span><p>${escape(dayRecord?.machinery||"—")}</p></div><div class="subcontract-admin-record-block"><span>Pracovníci</span><strong>${escape(crewRecord?.worker_count??"—")}</strong>${professions?`<small>${professions}</small>`:""}</div>`;
  $("saAttachments").innerHTML=attachments.length?attachments.map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.name)}</strong><small><button type="button" class="ghost" data-sa-open-attachment="${escape(item.id)}">Otvoriť</button></small></div>`).join(""):'<p class="subcontract-admin-empty">Bez príloh.</p>';
  $("saNotes").innerHTML=notes.length?notes.map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.body||"")}</strong><small>${escape(new Date(item.created_at).toLocaleString("sk-SK"))}</small></div>`).join(""):'<p class="subcontract-admin-empty">Bez záznamu hlavného zhotoviteľa.</p>';
  $("saCloseDay").disabled=locked;$("saCloseDiary").disabled=Boolean(scope?.diary_closed_at)
 }
 async function saveNote(event){
  event.preventDefault();if(!scope)return;
  const body=$("saNoteBody").value.trim();if(!body)return;
  const date=$("saDiaryDate").value;
  try{
   await cloudFetch("/rest/v1/subcontract_owner_notes",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({scope_id:scope.id,day:date,body})});
   $("saNoteBody").value="";await loadDay(scope.id);notify("Záznam hlavného zhotoviteľa bol pridaný do denníka.","success")
  }catch(error){handleError(error,"Zápis do denníka")}
 }
 async function openAttachment(id){
  const item=attachments.find(row=>row.id===id);if(!item)return;
  const popup=window.open("about:blank","_blank");if(!popup){notify("Prehliadač zablokoval otvorenie súboru.","error");return}
  try{
   await cloudEnsureSession();
   if(!cloudSession?.access_token)throw new Error("Prihlásenie vypršalo.");
   const response=await fetch(`${normalizeCloudUrl(cloudConfig.url)}/storage/v1/object/authenticated/subcontract-private/${encodeStoragePath(item.path)}`,{headers:{apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`},cache:"no-store"});
   if(!response.ok)throw new Error(`Úložisko odmietlo súbor (${response.status}).`);
   const url=URL.createObjectURL(await response.blob());popup.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),300000)
  }catch(error){popup.close();handleError(error,"Otvorenie prílohy")}
 }
 async function closeDay(){
  if(!scope||!$("saDiaryDate").value||scope.diary_closed_at||dayRecord?.status==="closed")return;
  const date=$("saDiaryDate").value;
  if(!confirm(`Uzatvoriť denník a stav pracovníkov za ${dateLabel(date)}? Subdodávateľ ich potom nebude môcť prepísať.`))return;
  try{await cloudRpc("subcontract_close_day",{p_scope_id:scope.id,p_day:date});await loadDay(scope.id);notify(`Deň ${dateLabel(date)} bol uzatvorený.`,"success")}
  catch(error){handleError(error,"Uzatvorenie dňa")}
 }
 async function closeDiary(){
  if(!scope||scope.diary_closed_at)return;
  if(!confirm(`Uzatvoriť celý denník firmy ${currentCompany()?.name||""}? Ide o trvalú uzávierku všetkých dní.`))return;
  try{
   await cloudRpc("subcontract_close_diary",{p_scope_id:scope.id});
   const fresh=await cloudFetch(`/rest/v1/subcontract_scopes?id=eq.${scope.id}&select=*`);
   scope=Array.isArray(fresh)?fresh[0]||scope:scope;
   scopes=scopes.map(item=>item.id===scope.id?scope:item);
   renderDay([]);await loadDay(scope.id);notify(`Denník firmy ${currentCompany()?.name||""} bol uzatvorený.`,"success")
  }catch(error){handleError(error,"Uzatvorenie denníka")}
 }
 async function loadStatement(id){
  if(!scope||scope.id!==id)return;
  const period=$("saStatementMonth").value||month();
  const rows=await cloudFetch(`/rest/v1/subcontract_statements?scope_id=eq.${id}&period=eq.${period}&select=*`);
  if(scope?.id!==id||$("saStatementMonth").value!==period)return;
  statement=Array.isArray(rows)?rows[0]||null:null;
  statementRows=statement?await cloudFetch(`/rest/v1/subcontract_statement_rows?statement_id=eq.${statement.id}&select=*`):[];
  if(scope?.id!==id||$("saStatementMonth").value!==period)return;
  renderStatement()
 }
 function renderStatement(){
  const status=statement?.status||"none",locked=status==="closed";
  $("saStatementLock").textContent=locked?"Uzatvorený":status==="submitted"?"Odoslaný na kontrolu":status==="draft"?"Rozpracovaný":"Bez súpisu";
  $("saStatementLock").classList.toggle("locked",locked);
  const byId=new Map(publishedItems.map(item=>[item.id,item]));
  const lines=statementRows.map(row=>({row,item:byId.get(row.work_item_id)}));
  const total=lines.reduce((sum,{row,item})=>sum+(Number(row.quantity)||0)*(Number(row.unit_price_snapshot??item?.unit_price)||0),0);
  $("saStatementDetail").innerHTML=statement?`<div class="subcontract-admin-record-date">${escape(statement.period)} · ${escape(status)}</div><div class="subcontract-admin-statement-list">${lines.map(({row,item})=>`<div><span>${escape(item?.code||"")} ${escape(item?.description||"Položka")}</span><strong>${escape(row.quantity??0)} ${escape(item?.unit||"")}</strong></div>`).join("")||'<p>Zatiaľ bez vykázaných množstiev.</p>'}</div><div class="subcontract-admin-statement-total"><span>Spolu bez DPH</span><strong>${money(total)}</strong></div>`:'<p class="subcontract-admin-empty">Firma zatiaľ nemá súpis za tento mesiac.</p>';
  $("saCloseStatement").disabled=!statement||locked||status!=="submitted"
 }
 async function closeStatement(){
  if(!scope||!statement||statement.status!=="submitted")return;
  if(!confirm(`Uzatvoriť súpis firmy ${currentCompany()?.name||""} za ${statement.period}? Subdodávateľ už množstvá spätne neupraví.`))return;
  try{await cloudRpc("subcontract_close_statement",{p_statement_id:statement.id});await loadStatement(scope.id);notify(`Súpis za ${statement.period} bol uzatvorený.`,"success")}
  catch(error){handleError(error,"Uzatvorenie súpisu")}
 }
 function render(){
  renderPicker();
  $("saDiaryDate").value=$("saDiaryDate").value||today();
  $("saStatementMonth").value=$("saStatementMonth").value||month();
  const key=[state.selectedProjectId,cloudConfig?.lastCloudId,cloudSessionUser()?.id,cloudConfig?.url].join("|");
  if(key!==contextKey){contextKey=key;void refresh()}
  else renderSource()
 }
 $("saRefresh").addEventListener("click",()=>void refresh());
 $("saOpenCloud").addEventListener("click",()=>showView("cloud"));
 $("saCompany").addEventListener("change",event=>{companyId=event.target.value;renderScope()});
 $("saCreateScope").addEventListener("click",()=>void createScope());
 $("saInviteForm").addEventListener("submit",event=>void invite(event));
 $("saMembers").addEventListener("click",event=>{const button=event.target.closest("[data-remove-subcontract-member]");if(button)void removeMember(button.dataset.removeSubcontractMember,button.dataset.memberEmail)});
 $("saPublishBudget").addEventListener("click",()=>void publishBudget());
 $("saOpenWork").addEventListener("click",()=>showView("workStatements"));
 $("saCopyLink").addEventListener("click",async()=>{const link=$("saPortalLink").value;if(!link||!isOwner)return;try{await navigator.clipboard.writeText(link);notify("Odkaz na portál bol skopírovaný.","success")}catch{$("saPortalLink").select();document.execCommand("copy");notify("Odkaz na portál bol skopírovaný.","success")}});
 $("saDiaryDate").addEventListener("change",()=>scope&&void loadDay(scope.id));
 $("saDayPrev").addEventListener("click",()=>{$("saDiaryDate").value=nextDay($("saDiaryDate").value,-1);scope&&void loadDay(scope.id)});
 $("saDayNext").addEventListener("click",()=>{$("saDiaryDate").value=nextDay($("saDiaryDate").value,1);scope&&void loadDay(scope.id)});
 $("saStatementMonth").addEventListener("change",()=>scope&&void loadStatement(scope.id));
 $("saNoteForm").addEventListener("submit",event=>void saveNote(event));
 $("saAttachments").addEventListener("click",event=>{const button=event.target.closest("[data-sa-open-attachment]");if(button)void openAttachment(button.dataset.saOpenAttachment)});
 $("saCloseDay").addEventListener("click",()=>void closeDay());
 $("saCloseDiary").addEventListener("click",()=>void closeDiary());
 $("saCloseStatement").addEventListener("click",()=>void closeStatement());
 window.renderSubcontractAdmin=render;
})();
