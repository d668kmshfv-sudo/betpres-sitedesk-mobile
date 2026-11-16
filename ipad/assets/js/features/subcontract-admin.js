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
 let contextKey="",workspaceId="",scopes=[],scope=null,companyId="",publishedItems=[],invitations=[],dayRecord=null,crewRecord=null,attachments=[],statement=null,statementRows=[],requestVersion=0,isOwner=false;

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
  if(!companies.some(item=>item.id===companyId))companyId="";
  $("saCompany").innerHTML=`<option value="">${companies.length?"Vyber firmu":"Najprv priraď firmu ku stavbe"}</option>`+companies.map(item=>`<option value="${escape(item.id)}">${escape(item.name)}</option>`).join("");
  $("saCompany").value=companyId;
  $("saProjectName").textContent=activeProject()?.name||"Aktuálna stavba";
  $("saCompanyHelp").textContent=companies.length?`${companies.length} firiem priradených k tejto stavbe`:'Firmu pridáš v časti Firmy a zmluvy.';
  if(previous!==companyId){scope=null;publishedItems=[];invitations=[];statement=null;statementRows=[]}
 }
 function sourceItems(){
  const byId=new Map();let sourceLabel="";
  const latest=(state.workStatements||[]).filter(item=>item.projectId===state.selectedProjectId&&item.companyId===companyId).sort((a,b)=>String(b.period||"").localeCompare(String(a.period||"")))[0];
  if(latest){
   sourceLabel=`Tvoj súpis ${latest.period||""}`;
   for(const [index,item] of (latest.items||[]).entries()){
    if(String(item.type||"").toUpperCase()==="D"||!String(item.description||"").trim())continue;
    const sourceId=String(item.budgetItemId||item.id||`statement:${latest.id}:${index}`);
    if(!byId.has(sourceId))byId.set(sourceId,{source_item_id:sourceId,code:String(item.code||item.pc||""),description:String(item.description||""),unit:String(item.unit||""),contract_qty:workNumber(item.contractQty),unit_price:workNumber(item.unitPrice),sort_order:byId.size+1,is_active:true})
   }
  }else for(const budget of (state.workBudgets||[]).filter(item=>item.projectId===state.selectedProjectId&&item.companyId===companyId)){
   sourceLabel="Úvodný súpis / rozpočet";
   for(const [index,item] of (budget.items||[]).entries()){
    if(String(item.type||"").toUpperCase()==="D"||!String(item.description||"").trim())continue;
    const sourceId=String(item.id||`budget:${budget.id}:${index}`);
    if(!byId.has(sourceId))byId.set(sourceId,{source_item_id:sourceId,code:String(item.code||item.pc||""),description:String(item.description||""),unit:String(item.unit||""),contract_qty:workNumber(item.contractQty),unit_price:workNumber(item.unitPrice),sort_order:byId.size+1,is_active:true})
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
  const current=sourceIsCurrent(source.items);
  $("saBudgetSource").textContent=source.items.length?`${source.sourceLabel}: ${source.items.length} položiek. ${hasScope?(current?"Položky subdodávky sú zhodné s tvojím súpisom.":"Položky sa zmenili alebo ešte neboli zverejnené. Zverejni ich pred schválením mesiaca."):"Najprv zriaď priestor firmy."}`:"Pre túto firmu ešte nie je pripravený rozpočet ani súpis. Najprv pridaj položky v časti Súpis prác.";
  $("saBudgetSource").dataset.tone=current?"success":"warning";
  $("saPublishBudget").disabled=!hasScope||!source.items.length;
  if($("saCloseStatement"))$("saCloseStatement").disabled=!statement||statement.status!=="submitted"||!current;
 }
 function sourceIsCurrent(items=sourceItems().items){
  if(!items.length)return false;
  const active=publishedItems.filter(item=>item.is_active!==false);
  if(active.length!==items.length)return false;
  const existing=new Map(active.map(item=>[String(item.source_item_id),item]));
  return items.every(item=>{const saved=existing.get(String(item.source_item_id));return saved&&["code","description","unit"].every(key=>String(saved[key]||"")===String(item[key]||""))&&Number(saved.sort_order)===Number(item.sort_order)&&Math.abs(Number(saved.contract_qty)-Number(item.contract_qty))<.0001&&Math.abs(Number(saved.unit_price)-Number(item.unit_price))<.0001})
 }
 function renderScope(){
  scope=scopes.find(item=>item.company_id===companyId)||null;
  $("saInviteForm").classList.toggle("hidden",!isOwner);
  $("saShare").classList.toggle("hidden",!isOwner);
  $("saOwnerOnlyHint").classList.toggle("hidden",isOwner);
  if(!isOwner){
   const email=cloudSessionUser()?.email||"aktuálny účet";
   $("saOwnerOnlyHint").innerHTML=`Prihlásený účet <strong>${escape(email)}</strong> môže spravovať údaje firmy, ale pozvania vytvára vlastník pracovného priestoru. <button type="button" class="ghost" id="saSwitchOwnerAccount">Prepnúť účet v Cloud a databáza</button>`;
   $("saSwitchOwnerAccount").onclick=()=>showView("cloud")
  }
  $("saCreateScope").classList.toggle("hidden",Boolean(scope)||!companyId);
  $("saScopeContent").classList.toggle("hidden",!scope);
  $("saExportDiary").disabled=!scope;
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
  $("saExportDiary").disabled=false;
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
   const [members,items,invites]=await Promise.all([
    cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${id}&select=*&order=created_at.asc`),
    cloudFetch(`/rest/v1/subcontract_work_items?scope_id=eq.${id}&select=*&order=sort_order.asc`),
    cloudFetch(`/rest/v1/subcontract_invitations?scope_id=eq.${id}&status=eq.pending&select=email,status,created_at&order=created_at.asc`)
   ]);
   if(token!==requestVersion||scope?.id!==id)return;
   publishedItems=Array.isArray(items)?items:[];
   invitations=Array.isArray(invites)?invites:[];
   renderMembers(Array.isArray(members)?members:[]);renderPublished();
   await Promise.all([loadDay(id),loadStatement(id)])
  }catch(error){if(token===requestVersion)handleError(error,"Načítanie údajov subdodávky")}
 }
 function renderMembers(rows){
  const active=rows.map(row=>`<div class="subcontract-admin-list-row"><strong>${escape(row.email||row.user_id||"Účet")}</strong><small>Prístup aktívny${isOwner?`<button type="button" class="ghost" data-remove-subcontract-member="${escape(row.user_id)}" data-member-email="${escape(row.email||"")}">Odobrať prístup</button>`:""}</small></div>`).join("");
  const pending=invitations.filter(item=>!rows.some(row=>String(row.email||"").toLowerCase()===String(item.email||"").toLowerCase())).map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.email)}</strong><small>Pozvanie čaká na potvrdenie e-mailu${isOwner?`<button type="button" class="ghost" data-mail-subcontract-invite="${escape(item.email)}">Pripraviť e-mail</button><button type="button" class="ghost" data-revoke-subcontract-invite="${escape(item.email)}">Zrušiť pozvanie</button>`:""}</small></div>`).join("");
  $("saMembers").innerHTML=active+pending||'<p class="subcontract-admin-empty">Zatiaľ nie je priradený žiadny účet ani pozvanie.</p>'
 }
 function prepareInviteEmail(email){
  if(!isOwner||!scope||!email)return;
  const link=portalLink(scope.id);
  if(!link){notify("Najprv nastav cloudové pripojenie.","warning");return}
  const subject=`BETPRES · prístup k stavbe ${scope.project_name}`;
  const body=`Dobrý deň,\n\npre firmu ${scope.company_name} je pripravený mesačný súpis prác. Otvorte tento odkaz, vytvorte si účet s e-mailom ${email}, potvrďte ho cez správu od Supabase a prihláste sa:\n\n${link}\n\nPrístup platí iba pre súpisy tejto firmy a tejto stavby.`;
  location.href=`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
 }
 async function revokeInvite(email){
  if(!isOwner||!scope||!email)return;
  if(!confirm(`Zrušiť pozvanie pre ${email}?`))return;
  try{
   await cloudRpc("subcontract_revoke_invite",{p_scope_id:scope.id,p_email:email});
   invitations=invitations.filter(item=>item.email!==email);
   const rows=await cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`);
   renderMembers(Array.isArray(rows)?rows:[]);notify(`Pozvanie pre ${email} bolo zrušené.`,"success")
  }catch(error){handleError(error,"Zrušenie pozvania")}
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
  $("saPublished").innerHTML=active.length?`<div class="subcontract-admin-count">Zverejnených ${active.length} položiek</div>${active.map(item=>`<div class="subcontract-admin-list-row"><strong>${escape(item.code||"")} ${escape(item.description||"")}</strong><small>${escape(item.unit||"")} · ${money(item.unit_price)} bez DPH</small></div>`).join("")}`:'<p class="subcontract-admin-empty">Firma zatiaľ nemá zverejnené položky súpisu.</p>';
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
   const sourceIds=new Set(items.map(item=>item.source_item_id));
   for(const stale of publishedItems.filter(item=>item.is_active!==false&&!sourceIds.has(item.source_item_id))){
    await cloudFetch(`/rest/v1/subcontract_work_items?id=eq.${stale.id}`,{method:"PATCH",body:JSON.stringify({is_active:false})})
   }
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
   await cloudRpc("subcontract_invite",{p_scope_id:scope.id,p_email:email});
   const [rows,invites]=await Promise.all([
    cloudFetch(`/rest/v1/subcontract_scope_members?scope_id=eq.${scope.id}&select=*&order=created_at.asc`),
    cloudFetch(`/rest/v1/subcontract_invitations?scope_id=eq.${scope.id}&status=eq.pending&select=email,status,created_at&order=created_at.asc`)
   ]);
   invitations=Array.isArray(invites)?invites:[];
   renderMembers(Array.isArray(rows)?rows:[]);$("saMemberEmail").value="";
   notify(`Pozvanie pre ${email} je pripravené. Klikni na „Pripraviť e-mail“ a odošli odkaz.`,"success")
  }catch(error){handleError(error,"Pridanie účtu")}
  finally{button.disabled=false}
 }
 function nextDay(value,delta){const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10)}
 function splitDiaryText(value,limit=650){
  let rest=String(value||"").trim();const parts=[];
  while(rest.length>limit){let cut=Math.max(rest.lastIndexOf("\n",limit),rest.lastIndexOf(" ",limit));if(cut<limit/3)cut=limit;parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim()}
  if(rest)parts.push(rest);return parts
 }
 function diaryPageStyle(accent){return `@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;color:#173248;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sa-pdf-page{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}.sa-pdf-page:last-child{break-after:auto;page-break-after:auto}.sa-pdf-letterhead{position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill}.sa-pdf-content{position:relative;z-index:1;display:flex;flex-direction:column;height:100%;padding:47mm 15mm 25mm}.sa-pdf-kicker{font-size:9px;font-weight:800;letter-spacing:.1em;color:${accent}}.sa-pdf-content h1{margin:3mm 0 5mm;color:${accent};font-size:19px}.sa-pdf-meta{display:grid;grid-template-columns:1fr 1fr;gap:2mm 5mm;padding:3mm 0;border-top:1px solid #bacbd5;border-bottom:1px solid #bacbd5;font-size:10px}.sa-pdf-meta b{color:#587184}.sa-pdf-content h2{margin:7mm 0 2mm;padding:2mm 3mm;background:${accent};color:white;font-size:11px}.sa-pdf-text{font-size:11px;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.sa-pdf-signatures{display:grid;grid-template-columns:1fr 1fr;gap:10mm;margin-top:auto;padding-top:12mm}.sa-pdf-signatures div{min-height:18mm;padding-top:2mm;border-top:1px solid #8195a3;font-size:10px}.sa-pdf-signatures strong{display:block}.sa-pdf-footer{position:absolute;bottom:16mm;left:15mm;right:15mm;color:#6b8392;font-size:9px;display:flex;justify-content:space-between}.sa-pdf-attachment-image{display:block;max-width:100%;max-height:183mm;margin:8mm auto 0;object-fit:contain}.sa-pdf-attachment-name{font-size:11px;color:#526b7c;overflow-wrap:anywhere}`}
 function diaryPage({day,sections,pageNumber,pageTotal,attachmentName="",attachmentImage=""},company,project,style,dayIndex,dayCount){
  const content=attachmentImage?`<h2>Príloha denníka</h2><div class="sa-pdf-attachment-name">${escape(attachmentName)}</div><img class="sa-pdf-attachment-image" src="${escape(attachmentImage)}" alt="${escape(attachmentName)}">`:sections.map(section=>`<h2>${escape(section.title)}</h2><div class="sa-pdf-text">${escape(section.text)}</div>`).join("");
  return `<section class="sa-pdf-page">${style.letterhead?`<img class="sa-pdf-letterhead" src="${escape(style.letterhead)}" alt="">`:""}<div class="sa-pdf-content"><div class="sa-pdf-kicker">STAVEBNÝ DENNÍK SUBDODÁVATEĽA · DEŇ ${dayIndex+1} / ${dayCount}</div><h1>Denný zápis${pageTotal>1?` · strana ${pageNumber}/${pageTotal}`:""}</h1><div class="sa-pdf-meta"><span><b>Stavba:</b> ${escape(project)}</span><span><b>Dátum:</b> ${escape(dateLabel(day))}</span><span><b>Subdodávateľ:</b> ${escape(company)}</span><span><b>Stav:</b> ${escape(style.status)}</span></div>${content}<div class="sa-pdf-signatures"><div><strong>BETPRES · hlavný zhotoviteľ</strong>Podpis a dátum</div><div><strong>${escape(company)}</strong>Podpis a dátum</div></div><div class="sa-pdf-footer"><span>${escape(company)} · ${escape(dateLabel(day))}</span><span>BETPRES</span></div></div></section>`
 }
 async function attachmentImagePages(item){
  if(!item.path||!String(item.mime_type||"").startsWith("image/")&&item.mime_type!=="application/pdf")return[];
  await cloudEnsureSession();
  const url=`${normalizeCloudUrl(cloudConfig.url)}/storage/v1/object/authenticated/subcontract-private/${encodeStoragePath(item.path)}`;
  const response=await fetch(url,{headers:{apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`},cache:"no-store"});
  if(!response.ok)throw new Error(`Príloha ${item.name} sa nedá načítať (${response.status}).`);
  if(String(item.mime_type||"").startsWith("image/")){
   const blob=await response.blob();
   const source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error(`Fotografia ${item.name} sa nedá načítať.`));reader.readAsDataURL(blob)});
   return[{attachmentName:item.name,attachmentImage:source}]
  }
  const library=await import(new URL("assets/js/vendor/pdfjs/pdf.mjs",document.baseURI).href);
  library.GlobalWorkerOptions.workerSrc=new URL("assets/js/vendor/pdfjs/pdf.worker.mjs",document.baseURI).href;
  const task=library.getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});
  const pdf=await task.promise,pages=[];
  try{
   for(let number=1;number<=pdf.numPages;number++){
    const source=await pdf.getPage(number),size=source.getViewport({scale:1}),scale=Math.min(1.8,1500/size.width,2000/size.height),viewport=source.getViewport({scale}),canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(viewport.width));canvas.height=Math.max(1,Math.round(viewport.height));
    const context=canvas.getContext("2d",{alpha:false});if(!context)throw new Error("Prehliadač nevie vykresliť PDF prílohu.");
    context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
    await source.render({canvasContext:context,viewport,background:"#fff"}).promise;
    pages.push({attachmentName:`${item.name} · strana ${number}/${pdf.numPages}`,attachmentImage:canvas.toDataURL("image/jpeg",.86)});
    canvas.width=0;canvas.height=0;source.cleanup()
   }
  }finally{await pdf.destroy()}
  return pages
 }
 async function exportSubcontractDiary(){
  if(!scope)return;
  const from=$("saExportFrom").value,to=$("saExportTo").value;
  if(!from||!to||from>to){notify("Vyber platné obdobie denníka od – do.","warning");return}
  const span=Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000)+1;
  if(span>366){notify("Naraz možno exportovať najviac 366 dní.","warning");return}
  const button=$("saExportDiary"),selectedScope=scope;button.disabled=true;button.textContent="Pripravujem PDF…";
  try{
   const id=encodeURIComponent(selectedScope.id),daysFilter=`scope_id=eq.${id}&day=gte.${from}&day=lte.${to}&select=*`;
   const [days,crews,notes,files]=await Promise.all([
    cloudFetch(`/rest/v1/subcontract_diary_days?${daysFilter}&order=day.asc`),
    cloudFetch(`/rest/v1/subcontract_daily_crew?${daysFilter}&order=day.asc`),
    cloudFetch(`/rest/v1/subcontract_owner_notes?${daysFilter}&order=day.asc,created_at.asc`),
    cloudFetch(`/rest/v1/subcontract_attachments?scope_id=eq.${id}&select=diary_day_id,name,mime_type,path&order=created_at.asc`)
   ]);
   const dayMap=new Map((days||[]).map(item=>[item.day,item])),crewMap=new Map((crews||[]).map(item=>[item.day,item]));
   const noteMap=new Map(),fileMap=new Map();
   for(const note of notes||[]){if(!noteMap.has(note.day))noteMap.set(note.day,[]);noteMap.get(note.day).push(note)}
   for(const file of files||[]){if(!fileMap.has(file.diary_day_id))fileMap.set(file.diary_day_id,[]);fileMap.get(file.diary_day_id).push(file)}
   const dateKeys=[...new Set([...dayMap.keys(),...crewMap.keys(),...noteMap.keys()])].sort();
   if(!dateKeys.length){notify("V tomto období subdodávateľ nemá žiadny denný zápis.","warning");return}
   const theme=window.betpresDocumentTheme?.()||{},accent=/^#[0-9a-f]{6}$/i.test(theme.accentColor||"")?theme.accentColor:"#123b68";
   const style={accent,letterhead:theme.letterheadImage||typeof LETTERHEAD_IMAGE!=="undefined"&&LETTERHEAD_IMAGE||""};
   const pages=[];
   for(const [dayIndex,day] of dateKeys.entries()){
    const entry=dayMap.get(day),crew=crewMap.get(day),notesForDay=noteMap.get(day)||[],filesForDay=fileMap.get(entry?.id)||[];
    style.status=entry?.status==="closed"||selectedScope.diary_closed_at?"Uzatvorený":"Rozpracovaný";
    const sections=[];
    for(const part of splitDiaryText(entry?.works||"Bez zápisu vykonaných prác."))sections.push({title:"Vykonané práce",text:part});
    const professions=Object.entries(crew?.professions||{}).filter(([,count])=>Number(count)>0).map(([name,count])=>`${name}: ${count}`).join(" · ");
    sections.push({title:"Pracovníci",text:`${crew?.worker_count??"Nezadané"}${professions?`\n${professions}`:""}`});
    if(entry?.machinery)for(const part of splitDiaryText(entry.machinery))sections.push({title:"Mechanizmy a poznámky",text:part});
    for(const note of notesForDay)for(const part of splitDiaryText(note.body))sections.push({title:"Záznam hlavného zhotoviteľa",text:part});
    if(filesForDay.length)sections.push({title:"Prílohy dňa",text:filesForDay.map(item=>item.name).join("\n")});
    const textPages=[[]],measureStyle=document.createElement("style"),measureHost=document.createElement("div");
    measureStyle.textContent=diaryPageStyle(accent);
    measureHost.style.cssText="position:fixed;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none";
    document.head.appendChild(measureStyle);document.body.appendChild(measureHost);
    try{
     const fits=parts=>{
      measureHost.innerHTML=diaryPage({day,sections:parts,pageNumber:1,pageTotal:1},selectedScope.company_name,selectedScope.project_name,style,dayIndex,dateKeys.length);
      const content=measureHost.querySelector(".sa-pdf-content");
      return content&&content.scrollHeight<=content.clientHeight+2
     };
     const append=section=>{
      const current=textPages[textPages.length-1],candidate=[...current,section];
      if(fits(candidate)){current.push(section);return}
      if(current.length){textPages.push([]);append(section);return}
      if(section.text.length>60){
       const halves=splitDiaryText(section.text,Math.max(60,Math.floor(section.text.length/2)));
       if(halves.length>1){for(const half of halves)append({...section,text:half});return}
      }
      throw new Error(`Záznam ${dateLabel(day)} obsahuje text, ktorý sa nezmestí na A4.`)
     };
     for(const section of sections)append(section)
    }finally{measureHost.remove();measureStyle.remove()}
    const imagePages=[];
    for(const file of filesForDay)imagePages.push(...await attachmentImagePages(file));
    const pageTotal=textPages.length+imagePages.length;
    textPages.forEach((part,index)=>pages.push(diaryPage({day,sections:part,pageNumber:index+1,pageTotal},selectedScope.company_name,selectedScope.project_name,style,dayIndex,dateKeys.length)));
    imagePages.forEach((part,index)=>pages.push(diaryPage({day,sections:[],pageNumber:textPages.length+index+1,pageTotal,...part},selectedScope.company_name,selectedScope.project_name,style,dayIndex,dateKeys.length)))
   }
   const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>Denník ${escape(selectedScope.company_name)}</title><style>${diaryPageStyle(accent)}</style></head><body>${pages.join("")}</body></html>`;
   const fileName=`dennik-${String(selectedScope.company_name||"subdodavatel").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${from}-${to}.pdf`;
   notify(`Pripravený denník firmy ${selectedScope.company_name}: ${dateKeys.length} dní.`,"success");
   void window.showPdfPreview({html,fileName,title:`Denník ${selectedScope.company_name} · ${from} – ${to}`,landscape:false})
  }catch(error){handleError(error,"Export denníka")}
  finally{button.disabled=false;button.textContent="PDF denníka firmy"}
 }
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
  const total=lines.reduce((sum,{row,item})=>sum+approvedQuantity(row)*(Number(row.unit_price_snapshot??item?.unit_price)||0),0);
  $("saStatementDetail").innerHTML=statement?`<div class="subcontract-admin-record-date">${escape(statement.period)} · ${escape(status)}</div><div class="subcontract-admin-statement-list">${lines.map(({row,item})=>{
   const approved=approvedQuantity(row),changed=Math.abs(approved-Number(row.quantity||0))>.0005;
   return `<div class="sa-review-line ${changed?"is-revised":""}"><span>${escape(item?.code||"")} ${escape(item?.description||"Položka")}<small class="sa-proposed">Subdodávka: ${escape(row.quantity??0)} ${escape(item?.unit||"")}${changed?` · schválené: ${escape(approved)} ${escape(item?.unit||"")}`:""}</small></span>${status==="submitted"?`<span class="sa-review-fields"><input type="text" inputmode="decimal" data-sa-review-quantity="${escape(row.id)}" value="${escape(approved)}" aria-label="Schválené množstvo položky ${escape(item?.description||"")}"><button type="button" class="ghost" data-sa-review-save="${escape(row.id)}">Uložiť</button><input type="text" maxlength="2000" data-sa-review-note="${escape(row.id)}" value="${escape(row.review_note||"")}" placeholder="Dôvod úpravy (voliteľné)" aria-label="Dôvod úpravy"></span>`:`<strong>${escape(approved)} ${escape(item?.unit||"")}</strong>`}</div>`
  }).join("")||'<p>Zatiaľ bez vykázaných množstiev.</p>'}</div><div class="subcontract-admin-statement-total"><span>Schválená suma bez DPH</span><strong>${money(total)}</strong></div>`:'<p class="subcontract-admin-empty">Firma zatiaľ nemá súpis za tento mesiac.</p>';
  $("saCloseStatement").disabled=!statement||locked||status!=="submitted"||!sourceIsCurrent();
  $("saImportStatement").disabled=!statement||!locked
 }
 function approvedQuantity(row){return Number(row.reviewed_quantity??row.quantity)||0}
 async function saveReview(rowId){
  if(!scope||statement?.status!=="submitted")return;
  const row=statementRows.find(item=>item.id===rowId),input=$("saStatementDetail").querySelector(`[data-sa-review-quantity="${CSS.escape(rowId)}"]`),note=$("saStatementDetail").querySelector(`[data-sa-review-note="${CSS.escape(rowId)}"]`);
  if(!row||!input)return;
  const raw=input.value.trim(),quantity=workNumber(raw);
  if(!/^\d[\d\s]*(?:[.,]\d{1,3})?$/.test(raw)||!Number.isFinite(quantity)||quantity<0){input.focus();notify("Zadaj nezáporné množstvo s najviac tromi desatinnými miestami.","error");return}
  const rounded=Math.round(quantity*1000)/1000;
  if(Math.abs(quantity-rounded)>.0000001){input.focus();notify("Množstvo môže mať najviac tri desatinné miesta.","error");return}
  const button=$("saStatementDetail").querySelector(`[data-sa-review-save="${CSS.escape(rowId)}"]`);button.disabled=true;
  try{
   const updated=await cloudFetch(`/rest/v1/subcontract_statement_rows?id=eq.${rowId}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({reviewed_quantity:rounded,review_note:note?.value.trim()||""})});
   if(!Array.isArray(updated)||updated.length!==1)throw new Error("Databáza nepotvrdila úpravu riadku.");
   await loadStatement(scope.id);notify("Schválené množstvo je uložené. Subdodávka uvidí zmenu červenou.","success")
  }catch(error){handleError(error,"Úprava množstva");button.disabled=false}
 }
 function mainStatementFor(period){
  const current=state.workStatements.find(item=>item.projectId===state.selectedProjectId&&item.companyId===companyId&&item.period===period);
  if(current)return current;
  const previousCompany=selectedWorkCompanyId,previousPeriod=selectedWorkPeriod;
  try{selectedWorkCompanyId=companyId;selectedWorkPeriod=period;return getWorkStatement(true)}
  finally{selectedWorkCompanyId=previousCompany;selectedWorkPeriod=previousPeriod}
 }
 function importApprovedQuantities({silent=false}={}){
  if(!scope||statement?.status!=="closed")return;
  const target=mainStatementFor(statement.period);
  if(!target)throw new Error("Súpis v hlavnej aplikácii bol odstránený. Obnov ho pred prenosom.");
  if(target.status==="billed")throw new Error("Hlavný súpis je už fakturovaný. Schválené množstvá teraz nemožno prepísať.");
  const sources=new Map(publishedItems.map(item=>[item.id,item]));
  let changed=0,conflicts=0,missing=0;
  for(const submitted of statementRows){
   const source=sources.get(submitted.work_item_id);if(!source){missing++;continue}
   const key=String(source.source_item_id),quantity=approvedQuantity(submitted);
   let item=(target.items||[]).find(row=>String(row.budgetItemId||row.id)===key);
   if(!item)item=(target.items||[]).find(row=>String(row.code||row.pc||"")===String(source.code||"")&&String(row.description||"")===String(source.description||""));
   if(!item){
    const docId=workDocumentId("ZoD");
    item={...createBlankWorkItem("ZoD",docId),budgetItemId:key,code:source.code||"",description:source.description||"",unit:source.unit||"",contractQty:String(source.contract_qty??0),unitPrice:String(source.unit_price??0),currentQty:""};
    target.items.push(item)
   }
   const current=String(item.currentQty??"").trim(),last=String(item.subcontractSyncedQuantity??"").trim();
   if(current!==""&&Math.abs(workNumber(current)-quantity)>.0005&&(last===""||Math.abs(workNumber(current)-workNumber(last))>.0005)){conflicts++;continue}
   const next=String(quantity).replace(".",",");
   if(current!==next||item.subcontractSourceRowId!==submitted.id){item.currentQty=next;item.subcontractSourceRowId=submitted.id;item.subcontractSyncedQuantity=next;changed++}
  }
  if(changed){target.updatedAt=new Date().toISOString();target.status="draft";save(`Prenesených ${changed} množstiev zo schváleného súpisu ${statement.period}.`)}
  const message=`Prenesených ${changed} množstiev. ${conflicts?`${conflicts} ručne zadaných hodnôt ostalo v tvojom súpise bez zmeny. `:""}${missing?`${missing} položiek sa nenašlo v zverejnenom zozname.`:""}`;
  if(!silent||conflicts||missing)notify(message,conflicts||missing?"warning":"success");
  return{changed,conflicts,missing}
 }
 async function closeStatement(){
  if(!scope||!statement||statement.status!=="submitted")return;
  if(!sourceIsCurrent()){notify("Najprv zverejni aktuálne položky z tvojho súpisu.","warning");return}
  if(!confirm(`Schváliť a uzatvoriť súpis firmy ${currentCompany()?.name||""} za ${statement.period}? Subdodávateľ už množstvá spätne neupraví.`))return;
  try{await cloudRpc("subcontract_close_statement",{p_statement_id:statement.id});await loadStatement(scope.id)}
  catch(error){handleError(error,"Uzatvorenie súpisu");return}
  try{
   const result=importApprovedQuantities({silent:true});
   notify(`Súpis za ${statement.period} bol schválený a uzatvorený. ${result?.conflicts?`${result.conflicts} ručných hodnôt v tvojom súpise ostalo bez zmeny.`:"Schválené množstvá sú aj v tvojom súpise."}`,result?.conflicts?"warning":"success")
  }catch(error){notify(`Súpis je schválený a uzatvorený. Prenos do tvojho súpisu sa nepodaril: ${error.message||error}. Použi tlačidlo Preniesť schválené množstvá.`,"warning")}
 }
 function render(){
  renderPicker();
  $("saDiaryDate").value=$("saDiaryDate").value||today();
  $("saStatementMonth").value=$("saStatementMonth").value||month();
  const key=[state.selectedProjectId,cloudConfig?.lastCloudId,cloudSessionUser()?.id,cloudConfig?.url].join("|");
  if(key!==contextKey){contextKey=key;void refresh()}
  else renderSource()
 }
 const diaryExportControls=document.createElement("div");
 diaryExportControls.className="subcontract-admin-export-controls";
 diaryExportControls.innerHTML='<label>Od<input id="saExportFrom" type="date" aria-label="Export denníka od"></label><label>Do<input id="saExportTo" type="date" aria-label="Export denníka do"></label><button type="button" class="ghost" id="saExportCurrentDay">Vybraný deň</button><button type="button" id="saExportDiary" disabled>PDF denníka firmy</button>';
 $("saDiaryDetail").before(diaryExportControls);
 const diaryArchive=$("saDiaryDetail").closest("article");
 diaryArchive.querySelector(".panel-head h2").textContent="Archív denníka firmy";
 $("saDiaryLock").classList.add("hidden");
 $("saNoteForm").classList.add("hidden");
 $("saCloseDay").closest(".subcontract-admin-action-row").classList.add("hidden");
 $("saStatementDetail").closest("article").style.order="-1";
 $("saExportFrom").value=today();$("saExportTo").value=today();
 $("saExportCurrentDay").addEventListener("click",()=>{const day=$("saDiaryDate").value||today();$("saExportFrom").value=day;$("saExportTo").value=day});
 $("saExportDiary").addEventListener("click",()=>void exportSubcontractDiary());
 $("saRefresh").addEventListener("click",()=>void refresh());
 $("saOpenCloud").addEventListener("click",()=>showView("cloud"));
 $("saCompany").addEventListener("change",event=>{companyId=event.target.value;publishedItems=[];statement=null;statementRows=[];renderScope()});
 $("saCreateScope").addEventListener("click",()=>void createScope());
 $("saInviteForm").addEventListener("submit",event=>void invite(event));
 $("saMembers").addEventListener("click",event=>{
  const remove=event.target.closest("[data-remove-subcontract-member]");if(remove){void removeMember(remove.dataset.removeSubcontractMember,remove.dataset.memberEmail);return}
  const mail=event.target.closest("[data-mail-subcontract-invite]");if(mail){prepareInviteEmail(mail.dataset.mailSubcontractInvite);return}
  const revoke=event.target.closest("[data-revoke-subcontract-invite]");if(revoke)void revokeInvite(revoke.dataset.revokeSubcontractInvite)
 });
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
 $("saStatementDetail").addEventListener("click",event=>{const button=event.target.closest("[data-sa-review-save]");if(button)void saveReview(button.dataset.saReviewSave)});
 $("saImportStatement").addEventListener("click",()=>{try{importApprovedQuantities()}catch(error){handleError(error,"Prenos množstiev")}});
 window.renderSubcontractAdmin=render;
})();
