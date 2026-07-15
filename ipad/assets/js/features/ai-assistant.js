(function initSiteDeskAiAssistant(){
 "use strict";

 const allowedViews=new Set([
  "dashboard","calendar","workers","defects","siteMeetings","controlDays","billing",
  "workStatements","purchases","documents","handover","acceptance","companies"
 ]);
 const conversation=[];
 let requestRunning=false;
 let localCodex={checked:false,checkedAt:0,available:false,loggedIn:false,authMode:"",text:"Kontrolujem lokálny Codex…"};

 const clean=(value,max=500)=>String(value??"").replace(/\s+/g," ").trim().slice(0,max);
 const html=(value)=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
 const list=(value)=>Array.isArray(value)?value:[];
 const dateValue=(value)=>String(value||"").slice(0,10);
 const today=()=>new Date().toISOString().slice(0,10);
 const currentMonth=()=>today().slice(0,7);
 const byNewest=(a,b)=>String(b.updatedAt||b.date||b.createdAt||"").localeCompare(String(a.updatedAt||a.date||a.createdAt||""));
 const money=(value)=>Number.isFinite(Number(value))?Number(value):0;

 function aiCompanyName(companyId){
  return clean(list(state.companies).find(item=>item.id===companyId)?.name||"Nepriradená firma",180)
 }

 function activeProjectContext(){
  const projectRecord=list(state.projects).find(item=>item.id===state.selectedProjectId)||list(state.projects)[0]||{};
  const projectId=projectRecord.id||state.selectedProjectId||"";
  const assignments=list(state.assignments).filter(item=>item.projectId===projectId);
  const assignmentCompanies=assignments.map(item=>({
   company:aiCompanyName(item.companyId),
   scope:clean(item.scope||list(state.companies).find(companyRecord=>companyRecord.id===item.companyId)?.scope,240),
   contractNumber:clean(item.contractNo||item.orderNo,100),
   responsible:clean(item.responsible||item.contactPerson||list(state.companies).find(companyRecord=>companyRecord.id===item.companyId)?.contactPerson,140),
   plannedStart:dateValue(item.startDate||item.plannedStart),
   plannedEnd:dateValue(item.endDate||item.plannedEnd),
  })).slice(0,80);

  const defects=list(state.defects)
   .filter(item=>item.projectId===projectId)
   .sort((a,b)=>String(a.dueDate||"9999-12-31").localeCompare(String(b.dueDate||"9999-12-31")))
   .slice(0,50)
   .map(item=>({
    number:clean(item.number,40),company:aiCompanyName(item.companyId),location:clean(item.location,160),
    description:clean(item.description,360),responsible:clean(item.responsible,140),
    severity:clean(item.severity,60),status:clean(item.status||"Nová",60),dueDate:dateValue(item.dueDate),
    photoCount:list(item.photos).length,
   }));

  const meetingSource=[...list(state.controlDays),...list(state.siteMeetings)]
   .filter(item=>item.projectId===projectId);
  const uniqueMeetings=[...new Map(meetingSource.map(item=>[item.id||`${item.date}-${item.number}`,item])).values()]
   .sort(byNewest).slice(0,8);
  const meetings=uniqueMeetings.map(record=>({
   kind:clean(record.kind||record.type||"koordinačná porada",60),number:clean(record.number,60),date:dateValue(record.date),
   status:clean(record.status,60),nextDate:dateValue(record.nextDate),
   openTasks:list(record.tasks).filter(task=>clean(task.status)!=="Splnené").slice(0,30).map(task=>({
    text:clean(task.text,360),company:aiCompanyName(task.companyId),responsible:clean(task.responsible,140),
    deadline:dateValue(task.deadline),status:clean(task.status||"Bez vyjadrenia",60),note:clean(task.note,240),
   })),
  }));

  const purchases=list(state.purchases).filter(item=>item.projectId===projectId).sort(byNewest).slice(0,35).map(item=>({
   date:dateValue(item.date),supplier:clean(item.supplier,160),deliveryNote:clean(item.documentNo,100),
   invoiceNumber:clean(item.invoiceNo,100),material:clean(item.material,280),estimatedPrice:clean(item.estimatedPrice||item.credit,80),
  }));

  const statements=list(state.workStatements).filter(item=>item.projectId===projectId).sort(byNewest).slice(0,24).map(item=>({
   company:aiCompanyName(item.companyId),period:clean(item.period,20),number:clean(item.number||item.statementNo,60),
   status:clean(item.status||"rozpracovaný",60),document:clean(item.selectedDocumentLabel||item.documentLabel,140),
   itemCount:list(item.items).length,note:clean(item.note,260),
  }));

  const billing=list(state.billings).filter(item=>item.projectId===projectId).sort(byNewest).slice(0,30).map(item=>({
   company:aiCompanyName(item.companyId),month:clean(item.month,20),amountWithoutVat:money(item.amount),
   contractPrice:money(item.contractPrice),amendmentNumber:clean(item.amendmentNo,80),
  }));

  const sheet=list(state.workerSheets).find(item=>item.projectId===projectId&&item.month===currentMonth());
  const day=Number(today().slice(8,10));
  const workerRows=list(sheet?.rows);
  const workersToday=workerRows.reduce((sum,row)=>sum+(Number(row.values?.[day])||0),0);
  const companiesToday=workerRows.filter(row=>Number(row.values?.[day])>0).map(row=>({
   company:aiCompanyName(row.companyId),workers:Number(row.values?.[day])||0,
  })).slice(0,80);

  const calendar=list(state.calendarEvents).filter(item=>item.projectId===projectId&&dateValue(item.date)>=today()).sort((a,b)=>dateValue(a.date).localeCompare(dateValue(b.date))).slice(0,20).map(item=>({
   date:dateValue(item.date),title:clean(item.title||item.name,220),company:aiCompanyName(item.companyId),type:clean(item.type,80),
  }));

  const handovers=list(state.handovers).filter(item=>item.projectId===projectId);
  const acceptance=list(state.acceptanceProtocols).filter(item=>item.projectId===projectId);
  const materialSamples=list(state.materialSamples).filter(item=>item.projectId===projectId).sort(byNewest).slice(0,40).map(item=>({
   sequence:Number(item.sequence)||0,protocolNumber:clean(item.protocolNumber,80),material:clean(item.materialName,220),
   manufacturer:clean(item.manufacturer,160),use:clean(item.intendedUse||item.location,240),status:clean(item.status,80),
   submittedDate:dateValue(item.submittedDate),approvalDate:dateValue(item.approvalDate),approvedBy:clean(item.approvedBy,140),
  }));
  const openDefects=defects.filter(item=>!["Odstránená","Skontrolovaná","Uzavretá"].includes(item.status));
  const overdueDefects=openDefects.filter(item=>item.dueDate&&item.dueDate<today());
  const openTasks=meetings.flatMap(item=>item.openTasks);
  const overdueTasks=openTasks.filter(item=>item.deadline&&item.deadline<today());
  const uninvoiced=purchases.filter(item=>!item.invoiceNumber);

  return {
   generatedAt:new Date().toISOString(),currentView:document.querySelector(".view.active")?.id||"dashboard",
   project:{
    id:projectId,name:clean(projectRecord.name,220),address:clean(projectRecord.address,260),
    manager:clean(projectRecord.manager||projectRecord.projectManager,140),client:clean(projectRecord.client,180),
   },
   overview:{
    assignedCompanies:assignmentCompanies.length,workersToday,companiesPresentToday:companiesToday.length,
    openDefects:openDefects.length,overdueDefects:overdueDefects.length,openTasks:openTasks.length,
    overdueTasks:overdueTasks.length,deliveryNotes:purchases.length,deliveryNotesWithoutInvoice:uninvoiced.length,
    workStatements:statements.length,billingRecords:billing.length,handovers:handovers.length,acceptanceProtocols:acceptance.length,
    materialSamples:materialSamples.length,materialSamplesPending:materialSamples.filter(item=>item.status==="Odovzdaná investorovi").length,
   },
   companies:assignmentCompanies,workers:{date:today(),total:workersToday,companies:companiesToday},
   defects,meetings,upcomingCalendar:calendar,materialPassport:purchases,materialSamples,workStatements:statements,billing,
  }
 }

 function mountAssistant(){
  const actionBar=document.querySelector(".site-topbar-actions");
  const commandButton=document.getElementById("openCommandPalette");
  if(actionBar&&!document.getElementById("openAiAssistant")){
   const button=document.createElement("button");
   button.id="openAiAssistant";
   button.className="site-ai-open";
   button.type="button";
   button.title="AI pomocník pre aktívnu stavbu (Ctrl + Shift + A)";
   button.innerHTML='<span class="site-ai-spark">✦</span><span>AI pomocník</span>';
   actionBar.insertBefore(button,commandButton||actionBar.firstChild)
  }

  if(!document.getElementById("siteDeskAiLayer")){
   document.body.insertAdjacentHTML("beforeend",`
    <div class="site-ai-layer" id="siteDeskAiLayer" aria-hidden="true">
     <button class="site-ai-scrim" id="siteAiScrim" type="button" aria-label="Zavrieť AI pomocníka"></button>
     <aside class="site-ai-drawer" role="dialog" aria-modal="true" aria-labelledby="siteAiTitle">
      <header class="site-ai-header">
       <div class="site-ai-brand"><img src="assets/images/navigation-logo.png" alt="BETPRES"><div><small>BETPRES SITEDESK</small><h2 id="siteAiTitle">AI pomocník</h2></div></div>
       <button class="site-ai-close" id="closeAiAssistant" type="button" aria-label="Zavrieť">×</button>
      </header>
      <div class="site-ai-project"><span>Aktívna stavba</span><strong id="siteAiProjectName">—</strong><small id="siteAiConnectionState">Kontrolujem pripojenie…</small></div>
      <div class="site-ai-body">
       <section class="site-ai-intro">
        <strong>Čo potrebuješ pripraviť?</strong>
        <span>Pomocník číta iba aktuálne údaje otvorenej stavby. Nič sám neprepíše.</span>
       </section>
       <div class="site-ai-quick-actions">
        <button type="button" data-ai-action="daily_summary"><span>☀</span><strong>Denný prehľad</strong><small>Pracovníci, vady a termíny</small></button>
        <button type="button" data-ai-action="missing_data"><span>✓</span><strong>Kontrola údajov</strong><small>Čo chýba alebo treba preveriť</small></button>
        <button type="button" data-ai-action="meeting_brief"><span>◫</span><strong>Podklad na poradu</strong><small>Otvorené úlohy podľa firiem</small></button>
        <button type="button" data-ai-action="invoicing_review"><span>€</span><strong>Súpisy a fakturácia</strong><small>Kontrolný finančný prehľad</small></button>
       </div>
       <section class="site-ai-result" id="siteAiResult" aria-live="polite">
        <div class="site-ai-empty"><span>✦</span><strong>Som pripravený pracovať s otvorenou stavbou.</strong><p>Vyber jednu z úloh alebo napíš vlastnú otázku.</p></div>
       </section>
      </div>
      <form class="site-ai-composer" id="siteAiForm">
       <label for="siteAiQuestion">Otázka k aktívnej stavbe</label>
       <div><textarea id="siteAiQuestion" rows="2" maxlength="1600" placeholder="Napr. Ktoré firmy majú úlohy po termíne?"></textarea><button id="siteAiSend" type="submit" title="Odoslať otázku">➜</button></div>
       <small>AI môže urobiť chybu. Dôležité údaje, ceny a termíny vždy skontroluj.</small>
      </form>
     </aside>
    </div>`)
  }

  document.getElementById("openAiAssistant")?.addEventListener("click",openAssistant);
  document.getElementById("closeAiAssistant")?.addEventListener("click",closeAssistant);
  document.getElementById("siteAiScrim")?.addEventListener("click",closeAssistant);
  document.getElementById("siteAiForm")?.addEventListener("submit",event=>{
   event.preventDefault();
   const question=document.getElementById("siteAiQuestion")?.value.trim()||"";
   if(question)runAssistant("question",question)
  });
  document.querySelectorAll("[data-ai-action]").forEach(button=>button.addEventListener("click",()=>runAssistant(button.dataset.aiAction,"")));
  document.addEventListener("keydown",event=>{
   if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==="a"){
    event.preventDefault();
    document.getElementById("siteDeskAiLayer")?.classList.contains("open")?closeAssistant():openAssistant()
   }else if(event.key==="Escape"&&document.getElementById("siteDeskAiLayer")?.classList.contains("open"))closeAssistant()
  })
 }

 function cloudState(){
  try{
   if(!cloudConfigured())return{ready:false,text:"Cloud nie je nastavený",reason:"config"};
   if(!cloudSession?.access_token)return{ready:false,text:"Cloud je nastavený, ale nie si prihlásený",reason:"auth"};
   return{ready:true,text:"Bezpečne pripojené cez BETPRES Cloud",reason:""}
  }catch{return{ready:false,text:"Cloudové pripojenie nie je dostupné",reason:"config"}}
 }

 async function refreshLocalCodex(force=false){
  if(!window.betpresDesktop?.codexStatus||!window.betpresDesktop?.runCodexAssistant){
   localCodex={checked:true,checkedAt:Date.now(),available:false,loggedIn:false,authMode:"",text:"Lokálny Codex nie je súčasťou tejto verzie"};
   updateHeader();
   return localCodex
  }
  if(!force&&localCodex.checked&&Date.now()-localCodex.checkedAt<60000)return localCodex;
  try{
   const result=await window.betpresDesktop.codexStatus();
   localCodex={checked:true,checkedAt:Date.now(),available:Boolean(result?.available),loggedIn:Boolean(result?.loggedIn),authMode:result?.authMode||"",text:result?.text||"Lokálny Codex nie je dostupný"}
  }catch(error){
   localCodex={checked:true,checkedAt:Date.now(),available:false,loggedIn:false,authMode:"",text:clean(error?.message||error,300)||"Lokálny Codex nie je dostupný"}
  }
  updateHeader();
  return localCodex
 }

 function providerState(){
  if(localCodex.available&&localCodex.loggedIn)return{ready:true,provider:"codex",text:localCodex.text||"Codex je pripojený cez ChatGPT",reason:""};
  const cloud=cloudState();
  if(cloud.ready)return{...cloud,provider:"cloud"};
  if(localCodex.available)return{ready:false,provider:"codex",text:localCodex.text||"Codex čaká na prihlásenie",reason:"codex-auth"};
  return{ready:false,provider:"",text:`${localCodex.text}. ${cloud.text}.`,reason:cloud.reason||"config"}
 }

 function updateHeader(){
  const context=activeProjectContext(),status=providerState();
  document.getElementById("siteAiProjectName").textContent=context.project.name||"Bez aktívnej stavby";
  const stateNode=document.getElementById("siteAiConnectionState");
  stateNode.textContent=status.text;
  stateNode.className=status.ready?"ready":"not-ready"
 }

 function openAssistant(){
  updateHeader();
  void refreshLocalCodex();
  const layer=document.getElementById("siteDeskAiLayer");
  layer?.classList.add("open");
  layer?.setAttribute("aria-hidden","false");
  document.body.classList.add("site-ai-opened");
  setTimeout(()=>document.getElementById("siteAiQuestion")?.focus(),180)
 }

 function closeAssistant(){
  const layer=document.getElementById("siteDeskAiLayer");
  layer?.classList.remove("open");
  layer?.setAttribute("aria-hidden","true");
  document.body.classList.remove("site-ai-opened")
 }

 function setLoading(action){
  const labels={daily_summary:"Pripravujem denný prehľad",missing_data:"Kontrolujem údaje",meeting_brief:"Pripravujem podklad na poradu",invoicing_review:"Kontrolujem súpisy a fakturáciu",question:"Hľadám odpoveď"};
  document.getElementById("siteAiResult").innerHTML=`<div class="site-ai-loading"><span class="site-ai-loader">✦</span><strong>${html(labels[action]||"Pracujem s údajmi stavby")}</strong><small>AI prechádza iba podklady z aktívnej stavby…</small></div>`
 }

 function renderConnectionRequired(status){
  const codexLogin=status.reason==="codex-auth";
  const actionLabel=codexLogin?"Skontrolovať prihlásenie":status.reason==="config"?"Otvoriť nastavenie cloudu":"Prihlásiť sa do cloudu";
  document.getElementById("siteAiResult").innerHTML=`
   <div class="site-ai-required"><span>✦</span><h3>Pripoj Codex alebo BETPRES Cloud</h3><p>${html(status.text)}</p><button type="button" id="siteAiOpenCloud">${actionLabel}</button></div>`;
  document.getElementById("siteAiOpenCloud")?.addEventListener("click",async()=>{
   if(codexLogin){
    localCodex.checked=false;
    const refreshed=await refreshLocalCodex(true);
    if(refreshed.loggedIn){updateHeader();document.getElementById("siteAiQuestion")?.focus();return}
   }
   closeAssistant();
   if(typeof showView==="function")showView("cloud")
  })
 }

 function renderError(error){
  const text=clean(error?.message||error,500);
  const deployMissing=/404|not found|Function not found/i.test(text);
  document.getElementById("siteAiResult").innerHTML=`
   <div class="site-ai-error"><span>!</span><h3>${deployMissing?"AI pomocník ešte nie je aktivovaný":"AI odpoveď sa nepodarila"}</h3><p>${html(deployMissing?"Serverová funkcia sitedesk-assistant ešte nie je nasadená v Supabase.":text||"Skús to o chvíľu znova.")}</p><button type="button" id="siteAiRetry">Skúsiť znova</button></div>`;
  document.getElementById("siteAiRetry")?.addEventListener("click",()=>document.getElementById("siteAiQuestion")?.focus())
 }

 function renderAnswer(data){
  const facts=list(data.facts),warnings=list(data.warnings),steps=list(data.next_steps),suggested=clean(data.suggested_text,8000);
  const provider=data.provider==="codex-chatgpt"?"AI POMOCNÍK · CODEX CEZ CHATGPT":"AI POMOCNÍK · BETPRES CLOUD";
  document.getElementById("siteAiResult").innerHTML=`
   <article class="site-ai-answer">
    <div class="site-ai-answer-head"><span>✦</span><div><small>${provider}</small><h3>${html(data.title||"Odpoveď")}</h3></div></div>
    <p class="site-ai-answer-text">${html(data.answer||"")}</p>
    ${facts.length?`<section><h4>Zistené z evidencie</h4><ul class="site-ai-facts">${facts.map(item=>`<li>${html(item)}</li>`).join("")}</ul></section>`:""}
    ${warnings.length?`<section><h4>Na kontrolu</h4><div class="site-ai-warnings">${warnings.map(item=>`<div class="${html(item.severity||"low")}"><span>!</span><p><strong>${html(item.label)}</strong><small>${html(item.detail)}</small></p></div>`).join("")}</div></section>`:""}
    ${steps.length?`<section><h4>Odporúčané kroky</h4><div class="site-ai-next">${steps.map((item,index)=>`<button type="button" data-ai-view="${html(item.target_view||"")}"><span>${index+1}</span><p><strong>${html(item.label)}</strong><small>${html(item.detail)}</small></p>${item.target_view?"<b>Otvoriť →</b>":""}</button>`).join("")}</div></section>`:""}
    ${suggested?`<section class="site-ai-copy"><div><h4>Návrh textu</h4><button type="button" id="siteAiCopyText">Kopírovať</button></div><textarea id="siteAiSuggestedText" readonly>${html(suggested)}</textarea></section>`:""}
    <footer>Výsledok je návrh AI. Pred použitím skontroluj mená, termíny, ceny a zmluvné údaje.</footer>
   </article>`;
  document.querySelectorAll("[data-ai-view]").forEach(button=>button.addEventListener("click",()=>{
   const view=button.dataset.aiView;
   if(view&&allowedViews.has(view)&&typeof showView==="function"){
    closeAssistant();
    showView(view)
   }
  }));
  document.getElementById("siteAiCopyText")?.addEventListener("click",async()=>{
   const button=document.getElementById("siteAiCopyText");
   try{await navigator.clipboard.writeText(suggested);button.textContent="Skopírované"}catch{document.getElementById("siteAiSuggestedText")?.select()}
  })
 }

 async function runAssistant(action,question){
  if(requestRunning)return;
  requestRunning=true;
  document.querySelectorAll("[data-ai-action]").forEach(button=>button.disabled=true);
  const send=document.getElementById("siteAiSend");
  if(send)send.disabled=true;
  setLoading(action);
  try{
   const payload={action,question,projectContext:activeProjectContext(),history:conversation.slice(-6)};
   const local=await refreshLocalCodex();
   const cloud=cloudState();
   let result=null,localError=null;
   if(local.available&&local.loggedIn){
    try{result=await window.betpresDesktop.runCodexAssistant(payload)}catch(error){localError=error}
   }
   if(!result&&cloud.ready){
    try{
     result=await cloudFetch("/functions/v1/sitedesk-assistant",{method:"POST",body:JSON.stringify(payload)});
     if(result&&typeof result==="object")result.provider="betpres-cloud"
    }catch(error){
     if(localError)throw new Error(`Lokálny Codex: ${clean(localError?.message||localError,260)} · Cloud: ${clean(error?.message||error,260)}`);
     throw error
    }
   }
   if(!result){
    if(localError)throw localError;
    renderConnectionRequired(providerState());
    return
   }
   if(question)conversation.push({role:"user",text:question});
   conversation.push({role:"assistant",text:`${result.title||""}\n${result.answer||""}`.trim()});
   renderAnswer(result);
   const questionNode=document.getElementById("siteAiQuestion");
   if(questionNode)questionNode.value=""
  }catch(error){renderError(error)}finally{
   requestRunning=false;
   document.querySelectorAll("[data-ai-action]").forEach(button=>button.disabled=false);
   if(send)send.disabled=false
  }
 }

 mountAssistant();
 void refreshLocalCodex();
 window.__BETPRES_AI_ASSISTANT_TEST__=()=>({
  mounted:Boolean(document.getElementById("siteDeskAiLayer")),
  button:Boolean(document.getElementById("openAiAssistant")),
  project:activeProjectContext().project,
  overview:activeProjectContext().overview,
  cloud:cloudState(),
  localCodex:{...localCodex},
  provider:providerState(),
 });
 window.__BETPRES_AI_ASSISTANT_RUN_TEST__=async(action="daily_summary",question="")=>{
  openAssistant();
  await runAssistant(action,question);
  return{
   answer:Boolean(document.querySelector(".site-ai-answer")),
   error:document.querySelector(".site-ai-error p")?.textContent||"",
   connectionRequired:Boolean(document.querySelector(".site-ai-required")),
   title:document.querySelector(".site-ai-answer h3")?.textContent||"",
  }
 };
 window.__BETPRES_AI_ASSISTANT_RENDER_SAMPLE__=()=>{
  openAssistant();
  const context=activeProjectContext(),overview=context.overview;
  renderAnswer({
   title:"Denný prehľad stavby",
   answer:`Na stavbe ${context.project.name||"bez názvu"} je dnes evidovaných ${overview.workersToday} pracovníkov v ${overview.companiesPresentToday} firmách. Prioritou sú otvorené úlohy a vady po termíne.`,
   facts:[
    `Dnešný stav: ${overview.workersToday} pracovníkov, ${overview.companiesPresentToday} prítomných firiem.`,
    `Otvorené vady: ${overview.openDefects}, z toho ${overview.overdueDefects} po termíne.`,
    `Otvorené úlohy z porád: ${overview.openTasks}, z toho ${overview.overdueTasks} po termíne.`,
   ],
   warnings:overview.overdueTasks?[{severity:"high",label:"Úlohy po termíne",detail:`V evidencii je ${overview.overdueTasks} otvorených úloh po termíne. Pred poradou skontroluj ich aktuálny stav.`}]:[],
   next_steps:[
    {label:"Skontrolovať otvorené vady",detail:"Prejdi zodpovedné firmy, fotografie a termíny.",target_view:"defects"},
    {label:"Pripraviť koordinačnú poradu",detail:"Over úlohy po termíne a doplň vyjadrenia firiem.",target_view:"siteMeetings"},
   ],
   suggested_text:"Prosím o kontrolu otvorených úloh a potvrdenie aktuálneho termínu splnenia pred najbližšou koordinačnou poradou.",
  });
  return true
 };
})();
