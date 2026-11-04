(function(){
 "use strict";
 const diary=document.getElementById("mobileDiary"),anchor=diary?.querySelector(".site-diary-inspections");
 if(!diary||!anchor||!window.__BETPRES_SITE_DIARY_READY__)return;
 const get=id=>document.getElementById(id);
 const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
 const dateLabel=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)?new Intl.DateTimeFormat("sk-SK",{day:"numeric",month:"numeric",year:"numeric"}).format(new Date(value+"T12:00:00")):value;
 const makeId=prefix=>typeof uid==="function"?uid(prefix):prefix+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
 const records=()=>Array.isArray(state.siteDiarySubcontracts)?state.siteDiarySubcontracts:[];
 const projectRecords=()=>records().filter(item=>item.projectId===state.selectedProjectId);
 const mainDate=()=>get("siteDiaryDate").value||todayISO();
 const announce=message=>typeof toast==="function"?toast(message):alert(message);
 const html=[
  '<section class="site-diary-data-section site-diary-subcontractors" id="siteDiarySubcontracts" aria-labelledby="siteDiarySubcontractsHeading">',
  '<div class="site-diary-section-heading"><h2 id="siteDiarySubcontractsHeading">Denníky subdodávok</h2><span id="siteDiarySubcontractCount">0 zápisov</span></div>',
  '<div class="site-diary-subcontract-controls">',
  '<label>Firma <select id="siteDiarySubcontractCompany"><option value="">Všetky subdodávky</option></select></label>',
  '<label>Deň v denníku subdodávky <input type="date" id="siteDiarySubcontractDate"></label>',
  '</div>',
  '<label id="siteDiarySubcontractCustomWrap" class="site-diary-subcontract-custom hidden">Názov novej firmy<input id="siteDiarySubcontractCustomCompany" autocomplete="organization" placeholder="Napíš názov firmy"></label>',
  '<div id="siteDiarySubcontractList" class="site-diary-subcontract-list"></div>',
  '<button type="button" class="ghost site-diary-subcontract-import-all" id="siteDiarySubcontractImportAll">Pridať všetky záznamy do hlavného denníka</button>',
  '<details class="site-diary-subcontract-editor" id="siteDiarySubcontractEditor"><summary>+ Zapísať do denníka subdodávky</summary>',
  '<form id="siteDiarySubcontractForm"><input type="hidden" id="siteDiarySubcontractId">',
  '<label>Vykonané práce<textarea id="siteDiarySubcontractWork" rows="4" required placeholder="Čo subdodávka v tento deň urobila?"></textarea></label>',
  '<div class="site-diary-subcontract-form-actions"><button type="button" class="ghost" id="siteDiarySubcontractCancel">Zrušiť</button><button type="submit">Uložiť zápis subdodávky</button></div>',
  '</form></details>',
  '</section>'
 ].join("");
 anchor.insertAdjacentHTML("beforebegin",html);
 let followMainDate=true,lastMainDate="";

 function companies(){
  const byId=new Map();
  for(const assignment of state.assignments||[]){
   if(assignment.projectId!==state.selectedProjectId)continue;
   const company=state.companies.find(item=>item.id===assignment.companyId);
   if(company?.name)byId.set(company.id,{id:company.id,name:company.name});
  }
  for(const entry of projectRecords())if(entry.companyId&&entry.companyName&&!byId.has(entry.companyId))byId.set(entry.companyId,{id:entry.companyId,name:entry.companyName});
  return [...byId.values()].sort((a,b)=>a.name.localeCompare(b.name,"sk"));
 }
 function chosenCompany(){
  const id=get("siteDiarySubcontractCompany").value;
  if(id==="__custom__"){
   const name=get("siteDiarySubcontractCustomCompany").value.trim();
   if(!name)return null;
   const existing=companies().find(item=>norm(item.name)===norm(name));
   return existing||{id:"custom:"+norm(name).replace(/\s+/g,"-"),name};
  }
  return companies().find(item=>item.id===id)||null;
 }
 function sourceEntries(){
  const sourceDate=get("siteDiarySubcontractDate").value,companyId=get("siteDiarySubcontractCompany").value;
  return projectRecords().filter(item=>item.date===sourceDate&&(!companyId||companyId==="__custom__"||item.companyId===companyId)).sort((a,b)=>a.companyName.localeCompare(b.companyName,"sk")||a.createdAt.localeCompare(b.createdAt));
 }
 function importedVersion(source,targetDate){
  return (state.mobileDiary||[]).some(main=>main.kind==="siteLog"&&main.projectId===state.selectedProjectId&&main.date===targetDate&&(main.importedSubcontractorEntries||[]).some(item=>item.sourceId===source.id&&Number(item.version)===Number(source.version||1)));
 }
 function showCustomInput(){
  const custom=get("siteDiarySubcontractCompany").value==="__custom__";
  get("siteDiarySubcontractCustomWrap").classList.toggle("hidden",!custom);
  get("siteDiarySubcontractCustomCompany").required=custom;
 }
 function render(){
  const main=mainDate();
  if(main!==lastMainDate){if(followMainDate)get("siteDiarySubcontractDate").value=main;lastMainDate=main}
  const selector=get("siteDiarySubcontractCompany"),previous=selector.value;
  selector.innerHTML='<option value="">Všetky subdodávky</option>'+companies().map(item=>'<option value="'+esc(item.id)+'">'+esc(item.name)+'</option>').join("")+'<option value="__custom__">+ Nová firma</option>';
  selector.value=previous&&[...selector.options].some(item=>item.value===previous)?previous:"";
  showCustomInput();
  const source=sourceEntries(),target=mainDate(),count=source.length;
  get("siteDiarySubcontractCount").textContent=count+" "+(count===1?"zápis":count<5?"zápisy":"zápisov");
  get("siteDiarySubcontractList").innerHTML=count?source.map(item=>{
   const copied=importedVersion(item,target),version=Number(item.version||1);
   return '<article class="site-diary-subcontract-row"><div class="site-diary-subcontract-row-head"><strong>'+esc(item.companyName)+'</strong><small>'+esc(dateLabel(item.date))+' · verzia '+version+'</small></div><p>'+esc(item.work)+'</p><div class="site-diary-subcontract-row-actions"><button type="button" class="ghost" data-subcontract-edit="'+esc(item.id)+'">Upraviť zdroj</button><button type="button" data-subcontract-import="'+esc(item.id)+'"'+(copied?" disabled":"")+'>'+(copied?"Pridané do denníka":version>1?"Pridať aktualizáciu":"Pridať do hlavného denníka")+'</button></div></article>'
  }).join(""):'<p class="site-diary-data-empty">Pre tento deň zatiaľ nie je zápis subdodávky.</p>';
  get("siteDiarySubcontractImportAll").disabled=!source.some(item=>!importedVersion(item,target));
 }
 function clearForm(){
  get("siteDiarySubcontractId").value="";
  get("siteDiarySubcontractWork").value="";
  get("siteDiarySubcontractEditor").open=false;
  get("siteDiarySubcontractEditor").querySelector("summary").textContent="+ Zapísať do denníka subdodávky";
 }
 function editSource(id){
  const item=projectRecords().find(entry=>entry.id===id);if(!item)return;
  get("siteDiarySubcontractCompany").value=item.companyId;
  get("siteDiarySubcontractDate").value=item.date;
  get("siteDiarySubcontractId").value=item.id;
  get("siteDiarySubcontractWork").value=item.work;
  followMainDate=false;showCustomInput();
  get("siteDiarySubcontractEditor").querySelector("summary").textContent="Upraviť zápis subdodávky";
  get("siteDiarySubcontractEditor").open=true;
  get("siteDiarySubcontractWork").focus();
  render()
 }
 function saveSource(event){
  event.preventDefault();
  const company=chosenCompany(),date=get("siteDiarySubcontractDate").value,work=get("siteDiarySubcontractWork").value.trim(),id=get("siteDiarySubcontractId").value;
  if(!company){announce("Vyber firmu subdodávky.");get("siteDiarySubcontractCompany").focus();return}
  if(!date||!work){get("siteDiarySubcontractForm").reportValidity();return}
  const existing=projectRecords().find(item=>item.id===id);
  if(existing&&existing.date===date&&existing.companyId===company.id&&existing.work===work){clearForm();return}
  const now=new Date().toISOString(),editor=cloudSession?.user?.email||cloudConfig?.displayName||"BETPRES",item={
   id:existing?.id||makeId("sub-diary"),projectId:state.selectedProjectId,date,
   companyId:company.id,companyName:company.name,work,
   author:existing?.author||editor,updatedBy:editor,version:(existing?.version||0)+1,
   history:existing?[...(existing.history||[]),{version:existing.version||1,date:existing.date,companyId:existing.companyId,companyName:existing.companyName,work:existing.work,updatedAt:existing.updatedAt,updatedBy:existing.updatedBy||existing.author||""}]:[],
   createdAt:existing?.createdAt||now,updatedAt:now
  };
  if(!Array.isArray(state.siteDiarySubcontracts))state.siteDiarySubcontracts=[];
  if(existing)state.siteDiarySubcontracts[state.siteDiarySubcontracts.indexOf(existing)]=item;
  else state.siteDiarySubcontracts.push(item);
  save(existing?"Zápis subdodávky bol upravený.":"Zápis subdodávky bol uložený.");
  clearForm();render()
 }
 function appendToMain(source,targetDate){
  if(importedVersion(source,targetDate))return false;
  if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
  const now=new Date().toISOString(),existing=state.mobileDiary.find(item=>item.kind==="siteLog"&&item.projectId===state.selectedProjectId&&item.date===targetDate&&(item.companyId===source.companyId||norm(item.companyName)===norm(source.companyName)));
  const mark=source.date===targetDate?"Z denníka subdodávky":"Z denníka subdodávky z "+source.date;
  const text=mark+(Number(source.version||1)>1?" · aktualizácia "+source.version:"")+":\n"+source.work.trim();
  const provenance={sourceId:source.id,version:Number(source.version||1),sourceDate:source.date,targetDate,companyId:source.companyId,companyName:source.companyName,content:source.work,importedAt:now};
  if(existing){
   existing.work=[String(existing.work||"").trim(),text].filter(Boolean).join("\n\n");
   existing.importedSubcontractorEntries=[...(existing.importedSubcontractorEntries||[]),provenance];
   existing.updatedAt=now;
  }else{
   state.mobileDiary.push({
    id:makeId("site-day"),kind:"siteLog",projectId:state.selectedProjectId,date:targetDate,
    companyId:source.companyId,companyName:source.companyName,workersCount:0,workersManual:false,
    profession:"",place:"",work:text,photos:[],attachments:[],
    importedSubcontractorEntries:[provenance],author:cloudConfig?.displayName||"BETPRES",createdAt:now,updatedAt:now
   });
  }
  return true
 }
 function importSelected(id=""){
  const targetDate=mainDate(),sources=id?projectRecords().filter(item=>item.id===id):sourceEntries();
  let count=0;for(const source of sources)if(appendToMain(source,targetDate))count++;
  if(count){save(count===1?"Zápis subdodávky bol pridaný do hlavného denníka.":count+" zápisov subdodávok bolo pridaných do hlavného denníka.");window.renderSiteDiary?.()}
  else announce("Tieto verzie zápisov už sú v hlavnom denníku.");
  render()
 }
 get("siteDiarySubcontractDate").value=mainDate();
 get("siteDiarySubcontractCompany").addEventListener("change",()=>{showCustomInput();render()});
 get("siteDiarySubcontractDate").addEventListener("change",()=>{followMainDate=false;render()});
 get("siteDiarySubcontractForm").addEventListener("submit",saveSource);
 get("siteDiarySubcontractCancel").addEventListener("click",clearForm);
 get("siteDiarySubcontractImportAll").addEventListener("click",()=>importSelected());
 get("siteDiarySubcontractList").addEventListener("click",event=>{
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.subcontractEdit)editSource(button.dataset.subcontractEdit);
  if(button.dataset.subcontractImport)importSelected(button.dataset.subcontractImport)
 });
 new MutationObserver(render).observe(get("siteDiaryDayList"),{childList:true});
 window.renderSubcontractorDiaries=render;
 render()
})();
