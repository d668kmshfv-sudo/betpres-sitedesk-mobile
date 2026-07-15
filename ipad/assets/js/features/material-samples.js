(function(){
 "use strict";

 var FILE_DB="betpres-sitedesk-material-files",FILE_STORE="files",editorId="",pendingTechnicalFile=null,pendingTechnicalDataUrl="",pendingPhoto=null,pendingAi=null;
 var BETPRES_SUBMITTER="__betpres__",CUSTOM_SUBMITTER="__custom__";
 var STATUS_OPTIONS=["Rozpracovaná","Odovzdaná investorovi","Schválená","Schválená s podmienkami","Zamietnutá"];

 function openFileDb(){
  return new Promise(function(resolve){
   if(!window.indexedDB){resolve(null);return}
   var request=indexedDB.open(FILE_DB,1);
   request.onupgradeneeded=function(){if(!request.result.objectStoreNames.contains(FILE_STORE))request.result.createObjectStore(FILE_STORE,{keyPath:"key"})};
   request.onsuccess=function(){resolve(request.result)};
   request.onerror=function(){resolve(null)}
  })
 }
 async function fileDbPut(key,dataUrl,meta){
  var db=await openFileDb();if(!db)return false;
  return new Promise(function(resolve){try{var tx=db.transaction(FILE_STORE,"readwrite");tx.objectStore(FILE_STORE).put({key:key,dataUrl:dataUrl,meta:meta||{},updatedAt:new Date().toISOString()});tx.oncomplete=function(){resolve(true)};tx.onerror=function(){resolve(false)}}catch(_){resolve(false)}})
 }
 async function fileDbGet(key){
  var db=await openFileDb();if(!db)return null;
  return new Promise(function(resolve){try{var req=db.transaction(FILE_STORE,"readonly").objectStore(FILE_STORE).get(key);req.onsuccess=function(){resolve(req.result||null)};req.onerror=function(){resolve(null)}}catch(_){resolve(null)}})
 }
 async function fileDbDelete(key){
  var db=await openFileDb();if(!db)return;
  try{db.transaction(FILE_STORE,"readwrite").objectStore(FILE_STORE).delete(key)}catch(_){ }
 }
 function fileToDataUrl(file){return new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(String(reader.result||""))};reader.onerror=function(){reject(reader.error||new Error("Súbor sa nepodarilo načítať."))};reader.readAsDataURL(file)})}
 function sampleKey(id,kind){return id+":"+kind}
 function projectSamples(){return (state.materialSamples||[]).filter(function(item){return item.projectId===state.selectedProjectId})}
 function nextSequence(){return Math.max.apply(Math,[0].concat(projectSamples().map(function(item){return Number(item.sequence)||0})))+1}
 function protocolNumber(sequence,date){var year=String(date||todayISO()).slice(0,4);return "VZ-"+year+"-"+String(sequence).padStart(3,"0")}
 function isApproved(status){return status==="Schválená"||status==="Schválená s podmienkami"}
 function statusClass(status){if(status==="Schválená")return"approved";if(status==="Schválená s podmienkami")return"conditional";if(status==="Zamietnutá")return"rejected";if(status==="Odovzdaná investorovi")return"sent";return"draft"}
 function formatFileSize(size){var n=Number(size)||0;if(!n)return"";return n>1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" kB"}
 function sampleCompanyName(item){return company(item.companyId)?.name||item.submittedBy||"BETPRES, s.r.o."}
 function formValue(id){return document.getElementById(id)?.value.trim()||""}
 function setValue(id,value,onlyEmpty){var el=document.getElementById(id);if(el&&(!onlyEmpty||!el.value.trim()))el.value=value||""}
 function isBetpresSubmitter(value){return !value||/^BETPRES(?:,|\s|$)/i.test(String(value).trim())}
 function toggleCustomSubmitter(){var select=document.getElementById("sampleCompanyId"),label=document.getElementById("sampleCustomSubmitterLabel"),input=document.getElementById("sampleSubmittedBy"),custom=select?.value===CUSTOM_SUBMITTER;if(label){label.hidden=!custom;label.style.display=custom?"grid":"none"}if(input){input.required=custom;if(!custom)input.setCustomValidity("")}}

 function mountEditor(){
  if(document.getElementById("materialSampleModal"))return;
  var wrapper=document.createElement("div");
  wrapper.innerHTML=`<div class="modal hidden" id="materialSampleModal"><div class="modal-card material-sample-modal-card">
   <div class="modal-head"><div><p>MATERIÁLOVÁ VZORKA PRE INVESTORA</p><h2 id="sampleModalTitle">Nová vzorka</h2><small>AI predvyplní údaje z technického listu. Schválenie vždy potvrdí človek.</small></div><button class="close" type="button" data-close-material-sample>×</button></div>
   <form id="materialSampleForm">
    <div class="sample-editor-layout">
     <div class="sample-editor-section"><h3>Údaje vzorky a rozhodnutie investora</h3><div class="sample-editor-fields">
      <label>Poradové číslo<input id="sampleSequence" readonly></label>
      <label>Číslo protokolu<input id="sampleProtocolNumber" readonly></label>
      <label class="span2">Názov materiálu *<input id="sampleMaterialName" required placeholder="napr. Fasádna minerálna vlna 160 mm"></label>
      <label>Výrobca<input id="sampleManufacturer" placeholder="Výrobca alebo značka"></label>
      <label>Typ výrobku<input id="sampleProductType" placeholder="napr. tepelná izolácia"></label>
      <label class="span2">Navrhované použitie<input id="sampleIntendedUse" placeholder="Miesto a účel zabudovania"></label>
      <label>Objekt / miesto<input id="sampleLocation" placeholder="SO 101, fasáda"></label>
      <label class="span2">Firma, ktorá predložila vzorku<select id="sampleCompanyId"><option value="${BETPRES_SUBMITTER}">BETPRES, s.r.o.</option></select><small>Vo výbere sú iba firmy priradené k aktuálnej stavbe.</small></label>
      <label class="span2" id="sampleCustomSubmitterLabel" hidden style="display:none">Vlastný názov firmy<input id="sampleSubmittedBy" placeholder="Napíš celý názov firmy"></label>
      <label>Dátum predloženia<input id="sampleSubmittedDate" type="date"></label>
      <label>Stav<select id="sampleStatus">${STATUS_OPTIONS.map(function(x){return`<option>${esc(x)}</option>`}).join("")}</select></label>
      <label>Dátum odsúhlasenia<input id="sampleApprovalDate" type="date"></label>
      <label>Za investora odsúhlasil<input id="sampleApprovedBy" placeholder="Meno a funkcia"></label>
      <label class="span2">Norma / certifikácia<input id="sampleTechnicalStandard" placeholder="STN, EN, CE, DoP..."></label>
      <label class="span2">Farba / povrch / variant<input id="sampleColorSurface" placeholder="Presná farebnosť alebo variant vzorky"></label>
      <label class="span2">Kľúčové technické parametre<textarea id="sampleKeyParameters" placeholder="Hrúbka, trieda, reakcia na oheň, lambda..."></textarea></label>
      <label class="span2">Doklady a vyhlásenia<textarea id="sampleCertificates" placeholder="Technický list, DoP, certifikát..."></textarea></label>
      <label class="span2">Podmienky montáže / skladovania<textarea id="sampleInstallationNotes"></textarea></label>
      <label class="span2">Kontrolné body z technického listu<textarea id="sampleReviewPoints" placeholder="AI návrh bodov, ktoré má investor preveriť"></textarea></label>
      <label class="span2">Vyjadrenie investora / podmienky schválenia<textarea id="sampleDecisionNote" placeholder="Bez výhrad alebo konkrétne podmienky"></textarea></label>
      <label class="span2">Interná poznámka<textarea id="sampleInternalNote" placeholder="Poznámka do pasportu"></textarea></label>
     </div></div>
     <aside class="sample-files-panel">
      <div class="sample-file-card"><h3>Technický list</h3><p>PDF alebo fotografia. Súbor ostáva prílohou vzorky a AI z neho pripraví návrh údajov.</p><input id="sampleTechnicalFile" type="file" accept="application/pdf,image/*"><div id="sampleTechnicalName" class="sample-file-name">Technický list zatiaľ nie je priložený.</div><div class="material-sample-actions"><button id="sampleOpenTechnical" class="ghost" type="button" hidden>Otvoriť</button></div><button id="sampleAnalyzeTechnical" class="sample-ai-button" type="button">✦ Prečítať technický list cez Codex AI</button><div id="sampleAiState" class="sample-ai-state">AI nemení stav schválenia ani dátum odsúhlasenia.</div><div id="sampleAiReview" class="sample-ai-review" hidden></div></div>
      <div class="sample-file-card"><h3>Fotografia vzorky</h3><p>Fotografia sa zobrazí v protokole a v pasporte vzoriek.</p><input id="samplePhotoFile" type="file" accept="image/*"><div id="samplePhotoPreview" class="sample-photo-preview"><span>Bez fotografie</span></div><button id="sampleRemovePhoto" class="ghost" type="button" hidden>Odstrániť fotografiu</button></div>
     </aside>
    </div>
    <div class="sample-editor-footer"><button id="sampleDelete" class="danger" type="button" hidden>Vymazať vzorku</button><div><button class="ghost" type="button" data-close-material-sample>Zrušiť</button><button type="submit">Uložiť vzorku</button></div></div>
   </form>
  </div></div>`;
  document.body.appendChild(wrapper.firstElementChild);
  var technicalInput=document.getElementById("sampleTechnicalFile"),photoInput=document.getElementById("samplePhotoFile");
  technicalInput.closest(".sample-file-card").dataset.sampleAttachment="technical";
  photoInput.closest(".sample-file-card").dataset.sampleAttachment="photo";
  technicalInput.insertAdjacentHTML("afterend",'<div class="sample-clipboard-actions"><button id="samplePasteTechnical" class="ghost" type="button">Vložiť zo schránky</button><small id="sampleTechnicalClipboardState">Ctrl+V alebo skopírovaný PDF/obrázok</small></div>');
  photoInput.insertAdjacentHTML("afterend",'<div class="sample-clipboard-actions"><button id="samplePastePhoto" class="ghost" type="button">Vložiť zo schránky</button><small id="samplePhotoClipboardState">Ctrl+V alebo skopírovaná fotografia</small></div>');
  document.querySelectorAll("[data-close-material-sample]").forEach(function(button){button.onclick=closeEditor});
  document.getElementById("materialSampleForm").onsubmit=saveEditor;
  document.getElementById("sampleTechnicalFile").onchange=technicalChanged;
  document.getElementById("samplePhotoFile").onchange=photoChanged;
  document.getElementById("sampleAnalyzeTechnical").onclick=analyzeTechnical;
  document.getElementById("sampleOpenTechnical").onclick=openTechnical;
  document.getElementById("sampleRemovePhoto").onclick=removePendingPhoto;
  document.getElementById("samplePasteTechnical").onclick=function(){pasteClipboardAttachment("technical")};
  document.getElementById("samplePastePhoto").onclick=function(){pasteClipboardAttachment("photo")};
  document.getElementById("sampleDelete").onclick=deleteFromEditor;
  document.getElementById("sampleStatus").onchange=function(){if(isApproved(this.value)&&!formValue("sampleApprovalDate"))document.getElementById("sampleApprovalDate").value=todayISO()}
  document.getElementById("sampleCompanyId").onchange=toggleCustomSubmitter;
  document.getElementById("materialSampleModal").addEventListener("paste",handleSamplePaste);
 }

 function render(){
  var app=document.getElementById("materialSamplesApp");if(!app)return;
  var all=projectSamples(),query=String(app.dataset.query||"").toLowerCase(),status=app.dataset.status||"";
  var visible=all.filter(function(item){return(!status||item.status===status)&&(!query||[item.materialName,item.manufacturer,item.protocolNumber,item.location,sampleCompanyName(item)].some(function(v){return String(v||"").toLowerCase().includes(query)}))}).sort(function(a,b){return(Number(b.sequence)||0)-(Number(a.sequence)||0)});
  var approved=all.filter(function(x){return isApproved(x.status)}).length,pending=all.filter(function(x){return x.status==="Odovzdaná investorovi"}).length,rejected=all.filter(function(x){return x.status==="Zamietnutá"}).length;
  app.innerHTML=`<div class="material-samples-page">
   <div class="page-title"><div><p>TECHNICKÉ LISTY A SCHVAĽOVANIE INVESTOROM</p><h1>Vzorkovanie materiálov</h1></div><div class="material-sample-actions"><button class="ghost" type="button" data-sample-passport>Exportovať pasport</button><button type="button" data-add-material-sample>+ Nová vzorka</button></div></div>
   <div class="metrics compact material-sample-metrics"><article><span>Všetky vzorky</span><strong>${all.length}</strong></article><article><span>Čakajú na investora</span><strong>${pending}</strong></article><article><span>Schválené</span><strong>${approved}</strong></article><article><span>Zamietnuté</span><strong>${rejected}</strong></article></div>
   <article class="panel material-sample-toolbar"><label>Hľadať<input data-sample-search value="${esc(app.dataset.query||"")}" placeholder="Materiál, výrobca, firma alebo číslo"></label><label>Stav<select data-sample-status><option value="">Všetky stavy</option>${STATUS_OPTIONS.map(function(x){return`<option ${x===status?"selected":""}>${esc(x)}</option>`}).join("")}</select></label><div class="sample-count">${visible.length} záznamov · ďalšie č. ${nextSequence()}</div></article>
   <article class="panel no-pad"><div class="material-sample-table-wrap">${visible.length?`<table class="material-sample-table"><thead><tr><th>P. č.</th><th>Materiál a fotografia</th><th>Technický list / výrobca</th><th>Predložené</th><th>Stav schválenia</th><th>Odsúhlasené</th><th></th></tr></thead><tbody>${visible.map(rowHtml).join("")}</tbody></table>`:`<div class="sample-empty-state"><div><span>◇</span><strong>${all.length?"Filter nenašiel žiadnu vzorku.":"Zatiaľ nie je pridaná žiadna vzorka."}</strong><p>Pridaj technický list a fotografiu. AI pripraví údaje pre protokol.</p></div></div>`}</div></article>
  </div>`;
  app.querySelector("[data-add-material-sample]").onclick=function(){openEditor("")};
  app.querySelector("[data-sample-passport]").onclick=exportPassport;
  app.querySelector("[data-sample-search]").oninput=function(){app.dataset.query=this.value;render()};
  app.querySelector("[data-sample-status]").onchange=function(){app.dataset.status=this.value;render()};
  app.querySelectorAll("[data-edit-sample]").forEach(function(b){b.onclick=function(){openEditor(b.dataset.editSample)}});
  app.querySelectorAll("[data-export-sample]").forEach(function(b){b.onclick=function(){exportProtocol(b.dataset.exportSample)}});
  app.querySelectorAll("[data-approve-sample]").forEach(function(b){b.onclick=function(){quickApprove(b.dataset.approveSample)}});
  requestAnimationFrame(hydrateListPhotos)
 }
 function rowHtml(item){
  var tech=item.technicalSheet||{},approval=isApproved(item.status)&&item.approvalDate?fmtDateISO(item.approvalDate):"—";
  return`<tr><td><span class="sample-sequence">${Number(item.sequence)||"—"}</span></td><td><div class="sample-material-cell"><div class="sample-thumb empty" data-sample-photo-box="${esc(item.id)}">◇</div><div><strong>${esc(item.materialName||"Bez názvu")}</strong><small>${esc(item.protocolNumber||"")} · ${esc(item.location||"Miesto neuvedené")}</small></div></div></td><td><strong>${esc(tech.name||"Bez technického listu")}</strong><span class="sample-table-note">${esc(item.manufacturer||item.productType||"Výrobca neuvedený")}</span></td><td><strong>${esc(item.submittedDate?fmtDateISO(item.submittedDate):"—")}</strong><span class="sample-table-note">${esc(sampleCompanyName(item))}</span></td><td><span class="sample-status ${statusClass(item.status)}">${esc(item.status||"Rozpracovaná")}</span></td><td><strong>${esc(approval)}</strong><span class="sample-table-note">${esc(item.approvedBy||"")}</span></td><td><div class="material-sample-row-actions">${!isApproved(item.status)?`<button class="ghost" data-approve-sample="${esc(item.id)}">Schváliť</button>`:""}<button class="ghost" data-export-sample="${esc(item.id)}">PDF</button><button data-edit-sample="${esc(item.id)}">Upraviť</button></div></td></tr>`
 }

 async function resolvePhoto(item){
  if(!item?.id)return"";
  if(item?.photo?.dataUrl)return item.photo.dataUrl;
  if(item?.photo?.path&&typeof cloudPhotoObjectUrl==="function"){var remote=await cloudPhotoObjectUrl(item.photo.path);if(remote)return remote}
  try{var local=await fileDbGet(sampleKey(item.id,"photo"));return local?.dataUrl||""}catch(error){console.warn("Fotografia vzorky sa nenačítala.",error);return""}
 }
 async function hydrateListPhotos(){
  var boxes=[].slice.call(document.querySelectorAll("[data-sample-photo-box]"));
  await Promise.all(boxes.map(async function(box){var item=state.materialSamples.find(function(x){return x.id===box.dataset.samplePhotoBox});var src=await resolvePhoto(item);if(!src)return;var img=document.createElement("img");img.className="sample-thumb";img.src=src;img.alt="Fotografia vzorky";box.replaceWith(img)}))
 }

 async function openEditor(id){
  mountEditor();editorId=id||"";pendingTechnicalFile=null;pendingTechnicalDataUrl="";pendingPhoto=null;pendingAi=null;
  clipboardState("technical","Ctrl+V alebo skopírovaný PDF/obrázok",false);clipboardState("photo","Ctrl+V alebo skopírovaná fotografia",false);
  var item=state.materialSamples.find(function(x){return x.id===id})||null,sequence=item?.sequence||nextSequence(),submitted=item?.submittedDate||todayISO();
  document.getElementById("sampleModalTitle").textContent=item?"Upraviť vzorku č. "+sequence:"Nová materiálová vzorka";
  setValue("sampleSequence",String(sequence));setValue("sampleProtocolNumber",item?.protocolNumber||protocolNumber(sequence,submitted));setValue("sampleMaterialName",item?.materialName||"");setValue("sampleManufacturer",item?.manufacturer||"");setValue("sampleProductType",item?.productType||"");setValue("sampleIntendedUse",item?.intendedUse||"");setValue("sampleLocation",item?.location||"");setValue("sampleSubmittedBy",item?.submittedBy||"");setValue("sampleSubmittedDate",submitted);setValue("sampleStatus",item?.status||"Rozpracovaná");setValue("sampleApprovalDate",item?.approvalDate||"");setValue("sampleApprovedBy",item?.approvedBy||"");setValue("sampleTechnicalStandard",item?.technicalStandard||"");setValue("sampleColorSurface",item?.colorSurface||"");setValue("sampleKeyParameters",item?.keyParameters||"");setValue("sampleCertificates",item?.certificates||"");setValue("sampleInstallationNotes",item?.installationNotes||"");setValue("sampleReviewPoints",item?.reviewPoints||"");setValue("sampleDecisionNote",item?.decisionNote||"");setValue("sampleInternalNote",item?.internalNote||"");
  var companyMap=new Map();activeAssignments().map(function(a){return company(a.companyId)}).filter(Boolean).forEach(function(c){companyMap.set(c.id,c)});var companies=Array.from(companyMap.values()).sort(function(a,b){return a.name.localeCompare(b.name,"sk")});
  var selectedSubmitter=item?.companyId&&companyMap.has(item.companyId)?item.companyId:(item?.submittedBy&&!isBetpresSubmitter(item.submittedBy)?CUSTOM_SUBMITTER:BETPRES_SUBMITTER);
  var submitterSelect=document.getElementById("sampleCompanyId");submitterSelect.innerHTML=`<option value="${BETPRES_SUBMITTER}">BETPRES, s.r.o.</option>`+companies.map(function(c){return`<option value="${esc(c.id)}">${esc(c.name)}</option>`}).join("")+`<option value="${CUSTOM_SUBMITTER}">Iná firma – dopísať názov</option>`;submitterSelect.value=selectedSubmitter;toggleCustomSubmitter();
  var tech=item?.technicalSheet||null;document.getElementById("sampleTechnicalName").innerHTML=tech?`<strong>Príloha:</strong> ${esc(tech.name||"technický-list")} ${formatFileSize(tech.size)?`· ${formatFileSize(tech.size)}`:""}`:"Technický list zatiaľ nie je priložený.";document.getElementById("sampleOpenTechnical").hidden=!tech;
  document.getElementById("sampleAiState").className="sample-ai-state";document.getElementById("sampleAiState").textContent=item?.ai?.confidence?`Posledné AI čítanie: istota ${item.ai.confidence} %. Skontroluj pred uložením.`:"AI nemení stav schválenia ani dátum odsúhlasenia.";renderAiReview(item?.ai||null);
  document.getElementById("sampleDelete").hidden=!item;
  await renderEditorPhoto(item);
  document.getElementById("materialSampleModal").classList.remove("hidden");setTimeout(function(){document.getElementById("sampleMaterialName").focus()},40)
 }
 function closeEditor(){document.getElementById("materialSampleModal")?.classList.add("hidden")}
 function clipboardState(kind,message,error){var box=document.getElementById(kind==="technical"?"sampleTechnicalClipboardState":"samplePhotoClipboardState");if(!box)return;box.textContent=message;box.classList.toggle("error",Boolean(error))}
 function clipboardFile(payload){var blob=dataUrlToBlob(payload.dataUrl);return new File([blob],payload.name||"priloha-zo-schranky",{type:payload.type||blob.type||"application/octet-stream"})}
 async function applyTechnicalFile(file,source){
  if(!file)return false;
  if(file.size>6*1024*1024){clipboardState("technical","Súbor je väčší ako 6 MB.",true);return false}
  if(file.type!=="application/pdf"&&!String(file.type).startsWith("image/")){clipboardState("technical","Použi PDF alebo fotografiu.",true);return false}
  pendingTechnicalFile=file;pendingTechnicalDataUrl="";document.getElementById("sampleTechnicalName").innerHTML=`<strong>${source?"Zo schránky":"Nová príloha"}:</strong> ${esc(file.name)} · ${formatFileSize(file.size)}`;document.getElementById("sampleOpenTechnical").hidden=true;clipboardState("technical","Príloha zo schránky je pripravená na uloženie.");return true
 }
 async function applyPhotoFile(file,source){
  if(!file||!String(file.type).startsWith("image/")){clipboardState("photo","V schránke nie je fotografia.",true);return false}
  try{pendingPhoto=await compressDefectPhoto(file);await renderEditorPhoto(null,pendingPhoto.dataUrl);clipboardState("photo",source?"Fotografia zo schránky je pripravená na uloženie.":"Fotografia je pripravená na uloženie.");return true}catch(error){clipboardState("photo","Fotografiu sa nepodarilo načítať.",true);alert("Fotografiu sa nepodarilo načítať: "+(error?.message||error));return false}
 }
 async function pasteClipboardAttachment(kind,payload){
  try{var result=payload||await window.betpresDesktop?.readClipboardAttachment?.();if(!result?.ok){clipboardState(kind,result?.error||"Schránku sa nepodarilo prečítať.",true);return false}var file=clipboardFile(result);return kind==="technical"?applyTechnicalFile(file,true):applyPhotoFile(file,true)}catch(error){clipboardState(kind,"Schránku sa nepodarilo prečítať.",true);return false}
 }
 async function handleSamplePaste(event){
  if(document.getElementById("materialSampleModal")?.classList.contains("hidden"))return;
  var files=[].slice.call(event.clipboardData?.files||[]);if(!files.length)files=[].slice.call(event.clipboardData?.items||[]).map(function(item){return item.kind==="file"?item.getAsFile():null}).filter(Boolean);if(!files.length)return;
  var file=files.find(function(item){return item.type==="application/pdf"})||files.find(function(item){return String(item.type).startsWith("image/")});if(!file)return;
  event.preventDefault();var focusedKind=document.activeElement?.closest?.("[data-sample-attachment]")?.dataset.sampleAttachment;var kind=file.type==="application/pdf"?"technical":(focusedKind||"photo");if(kind==="technical")await applyTechnicalFile(file,true);else await applyPhotoFile(file,true)
 }
 async function technicalChanged(event){
  var file=event.target.files?.[0];if(!file)return;if(!await applyTechnicalFile(file,false))event.target.value=""
 }
 async function photoChanged(event){
  var file=event.target.files?.[0];if(!file)return;await applyPhotoFile(file,false)
 }
 async function renderEditorPhoto(item,forced){
  var preview=document.getElementById("samplePhotoPreview");if(!preview)return;var src=forced||await resolvePhoto(item);preview.innerHTML=src?`<img src="${src}" alt="Fotografia vzorky">`:`<span>Bez fotografie</span>`;document.getElementById("sampleRemovePhoto").hidden=!src
 }
 function removePendingPhoto(){pendingPhoto={remove:true};document.getElementById("samplePhotoPreview").innerHTML="<span>Bez fotografie</span>";document.getElementById("sampleRemovePhoto").hidden=true;document.getElementById("samplePhotoFile").value=""}

 async function uploadAttachment(id,kind,dataUrl,fileName,mimeType){
  if(!cloudConfigured()||!cloudSession?.access_token||!cloudConfig.lastCloudId)return"";
  await cloudEnsureSession();var clean=String(fileName||"").split(".").pop().replace(/[^a-z0-9]/gi,"").toLowerCase()||((mimeType||"").includes("pdf")?"pdf":"jpg");var path=`${cloudConfig.lastCloudId}/material-samples/${id}/${kind}.${clean}`;
  var response=await fetch(`${normalizeCloudUrl(cloudConfig.url)}/storage/v1/object/sitedesk-files/${encodeStoragePath(path)}`,{method:"POST",headers:{apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`,"Content-Type":mimeType||dataUrlToBlob(dataUrl).type,"x-upsert":"true"},body:dataUrlToBlob(dataUrl)});
  if(!response.ok)throw new Error("Prílohu sa nepodarilo nahrať do cloudu ("+response.status+").");return path
 }
 async function saveEditor(event){
  event.preventDefault();var submitterChoice=formValue("sampleCompanyId"),companyId="",submittedBy="";if(submitterChoice===BETPRES_SUBMITTER){submittedBy="BETPRES, s.r.o."}else if(submitterChoice===CUSTOM_SUBMITTER){submittedBy=formValue("sampleSubmittedBy");if(!submittedBy){var customInput=document.getElementById("sampleSubmittedBy");customInput.setCustomValidity("Doplň názov firmy.");customInput.reportValidity();customInput.focus();return}}else{companyId=submitterChoice;submittedBy=company(companyId)?.name||""}var existing=state.materialSamples.find(function(x){return x.id===editorId})||null,id=existing?.id||uid("sample"),sequence=Number(formValue("sampleSequence"))||nextSequence(),submittedDate=formValue("sampleSubmittedDate")||todayISO(),warnings=[];
  var technicalSheet=existing?.technicalSheet?clone(existing.technicalSheet):null,photo=existing?.photo?clone(existing.photo):null;
  try{
   if(pendingTechnicalFile){var techData=pendingTechnicalDataUrl||await fileToDataUrl(pendingTechnicalFile);await fileDbPut(sampleKey(id,"technical"),techData,{name:pendingTechnicalFile.name,type:pendingTechnicalFile.type,size:pendingTechnicalFile.size});var techPath="";try{techPath=await uploadAttachment(id,"technical",techData,pendingTechnicalFile.name,pendingTechnicalFile.type)}catch(error){warnings.push(error.message)}technicalSheet={name:pendingTechnicalFile.name,type:pendingTechnicalFile.type,size:pendingTechnicalFile.size,path:techPath,storedLocally:true}}
   if(pendingPhoto?.remove){photo=null;await fileDbDelete(sampleKey(id,"photo"))}
   else if(pendingPhoto?.dataUrl){await fileDbPut(sampleKey(id,"photo"),pendingPhoto.dataUrl,{name:pendingPhoto.name,type:pendingPhoto.type,size:pendingPhoto.dataUrl.length});var photoPath="";try{photoPath=await uploadAttachment(id,"photo",pendingPhoto.dataUrl,"vzorka.jpg",pendingPhoto.type)}catch(error){warnings.push(error.message)}photo={name:pendingPhoto.name,type:pendingPhoto.type,path:photoPath,dataUrl:photoPath?"":pendingPhoto.dataUrl}}
  }catch(error){alert("Vzorku sa nepodarilo uložiť: "+(error?.message||error));return}
  var status=formValue("sampleStatus"),item={id:id,projectId:state.selectedProjectId,sequence:sequence,protocolNumber:formValue("sampleProtocolNumber")||protocolNumber(sequence,submittedDate),materialName:formValue("sampleMaterialName"),manufacturer:formValue("sampleManufacturer"),productType:formValue("sampleProductType"),intendedUse:formValue("sampleIntendedUse"),location:formValue("sampleLocation"),companyId:companyId,submittedBy:submittedBy,submittedDate:submittedDate,status:status,approvalDate:formValue("sampleApprovalDate"),approvedBy:formValue("sampleApprovedBy"),technicalStandard:formValue("sampleTechnicalStandard"),colorSurface:formValue("sampleColorSurface"),keyParameters:formValue("sampleKeyParameters"),certificates:formValue("sampleCertificates"),installationNotes:formValue("sampleInstallationNotes"),reviewPoints:formValue("sampleReviewPoints"),decisionNote:formValue("sampleDecisionNote"),internalNote:formValue("sampleInternalNote"),technicalSheet:technicalSheet,photo:photo,ai:pendingAi||existing?.ai||null,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  if(existing)Object.assign(existing,item);else state.materialSamples.push(item);closeEditor();save("Materiálová vzorka bola uložená.");if(warnings.length)setTimeout(function(){alert("Vzorka je uložená lokálne, ale niektoré prílohy sa nenahrali do cloudu:\n\n"+warnings.join("\n"))},150)
 }

 async function attachmentData(item,kind){
  if(kind==="technical"&&pendingTechnicalFile)return pendingTechnicalDataUrl||(pendingTechnicalDataUrl=await fileToDataUrl(pendingTechnicalFile));
  var attachment=kind==="technical"?item?.technicalSheet:item?.photo;if(attachment?.dataUrl)return attachment.dataUrl;
  var local=await fileDbGet(sampleKey(item?.id||editorId,kind));if(local?.dataUrl)return local.dataUrl;
  if(attachment?.path&&cloudConfigured()&&cloudSession?.access_token){await cloudEnsureSession();var base=normalizeCloudUrl(cloudConfig.url),headers={apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`},encoded=encodeStoragePath(attachment.path),urls=[`${base}/storage/v1/object/authenticated/sitedesk-files/${encoded}`,`${base}/storage/v1/object/sitedesk-files/${encoded}`];for(var i=0;i<urls.length;i++){var response=await fetch(urls[i],{headers:headers,cache:"no-store"});if(response.ok){var blob=await response.blob();return await cloudBlobDataUrl(blob)}}}
  return""
 }
 function renderAiReview(ai){
  var panel=document.getElementById("sampleAiReview");if(!panel)return;
  if(!ai||(!ai.summary&&!(ai.warnings||[]).length&&!(ai.sources||[]).length)){panel.hidden=true;panel.innerHTML="";return}
  var warnings=Array.isArray(ai.warnings)?ai.warnings:[],sources=Array.isArray(ai.sources)?ai.sources:[];
  panel.hidden=false;panel.innerHTML=`${ai.summary?`<div class="sample-ai-summary"><strong>Čo AI vyčítala</strong><p>${esc(ai.summary)}</p></div>`:""}${ai.productCode?`<div class="sample-ai-code"><span>Kód / variant</span><strong>${esc(ai.productCode)}</strong></div>`:""}${warnings.length?`<div class="sample-ai-warnings"><strong>Skontrolovať</strong><ul>${warnings.map(function(item){return`<li>${esc(item)}</li>`}).join("")}</ul></div>`:""}${sources.length?`<div class="sample-ai-sources"><strong>Zdroje overenia</strong>${sources.map(function(source){return`<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title||source.url)}</a>`}).join("")}</div>`:""}`
 }
 async function analyzeTechnical(){
  var item=state.materialSamples.find(function(x){return x.id===editorId})||{id:editorId};var box=document.getElementById("sampleAiState"),button=document.getElementById("sampleAnalyzeTechnical");
  try{button.disabled=true;box.className="sample-ai-state working";box.textContent="Codex AI číta technický list, fotografie strán a overuje výrobok…";renderAiReview(null);var dataUrl=await attachmentData(item,"technical");if(!dataUrl)throw new Error("Najprv vyber technický list PDF alebo fotografiu.");if(dataUrl.length>18_000_000)throw new Error("Technický list je pre AI prenos príliš veľký. Zmenši ho približne pod 12 MB.");if(!window.betpresDesktop?.analyzeMaterialSample)throw new Error("AI čítanie je dostupné v nainštalovanej aplikácii BETPRES SiteDesk.");var fileName=pendingTechnicalFile?.name||item.technicalSheet?.name||"technicky-list.pdf",mimeType=pendingTechnicalFile?.type||item.technicalSheet?.type||String(dataUrl.match(/^data:([^;]+)/)?.[1]||"application/pdf");var result=await window.betpresDesktop.analyzeMaterialSample({fileDataUrl:dataUrl,fileName:fileName,mimeType:mimeType,projectName:activeProject()?.name||"",today:todayISO()});
   setValue("sampleMaterialName",result.material_name,true);setValue("sampleManufacturer",result.manufacturer,true);setValue("sampleProductType",result.product_type,true);setValue("sampleIntendedUse",result.intended_use,true);setValue("sampleTechnicalStandard",result.technical_standard,true);setValue("sampleColorSurface",result.color_surface,true);setValue("sampleKeyParameters",result.key_parameters,true);setValue("sampleCertificates",result.certificates,true);setValue("sampleInstallationNotes",result.installation_notes,true);setValue("sampleReviewPoints",result.review_points,true);
   pendingAi={confidence:Number(result.confidence_percent)||0,productCode:result.product_code||"",summary:result.summary||"",warnings:result.warnings||[],sources:result.sources||[],provider:result.provider||"codex-chatgpt",analyzedAt:new Date().toISOString()};renderAiReview(pendingAi);box.className="sample-ai-state ok";box.textContent=`AI návrh je pripravený (istota ${Number(result.confidence_percent)||0} %). Doplnené boli iba prázdne polia; všetko skontroluj.`;return result
  }catch(error){box.className="sample-ai-state error";var message=error?.message||String(error);box.textContent=message;renderAiReview(null);return{error:message}}finally{button.disabled=false}
 }
 async function openTechnical(){var item=state.materialSamples.find(function(x){return x.id===editorId});try{var data=await attachmentData(item,"technical");if(!data)throw new Error("Technický list sa nenašiel v tomto počítači ani v cloude.");var blob=dataUrlToBlob(data),url=URL.createObjectURL(blob);window.open(url,"_blank");setTimeout(function(){URL.revokeObjectURL(url)},60000)}catch(error){alert(error?.message||error)}}
 async function deleteFromEditor(){var item=state.materialSamples.find(function(x){return x.id===editorId});if(!item||!confirm("Vymazať materiálovú vzorku č. "+item.sequence+"?"))return;state.materialSamples=state.materialSamples.filter(function(x){return x.id!==item.id});await fileDbDelete(sampleKey(item.id,"technical"));await fileDbDelete(sampleKey(item.id,"photo"));closeEditor();save("Materiálová vzorka bola vymazaná.")}
 function quickApprove(id){var item=state.materialSamples.find(function(x){return x.id===id});if(!item)return;item.status="Schválená";item.approvalDate=item.approvalDate||todayISO();item.decisionNote=item.decisionNote||"Bez výhrad";item.updatedAt=new Date().toISOString();save("Vzorka bola označená ako schválená. Doplň meno investora v detaile vzorky.")}

 function protocolStyles(){return`@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#173248;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sample-protocol{position:relative;width:210mm;height:297mm;overflow:hidden;page-break-after:always}.sample-protocol:last-child{page-break-after:auto}.letterhead{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.content{position:relative;z-index:1;height:100%;padding:47mm 14mm 29mm}.doc-head{display:grid;grid-template-columns:minmax(0,1fr) 34mm;gap:5mm;align-items:end;border-bottom:1.2mm solid #0b315d;padding:0 40mm 3mm 0;margin-bottom:4mm}.kicker{font-size:2.2mm;font-weight:900;letter-spacing:.13em;color:#6b8292}.doc-head h1{margin:1mm 0 0;color:#0b315d;font-size:5.7mm;line-height:1}.doc-number{text-align:right;white-space:nowrap}.doc-number small{display:block;color:#728795;font-size:2.1mm}.doc-number strong{font-size:4.2mm;color:#0b315d}.intro-grid{display:grid;grid-template-columns:1fr 1fr;border:0.25mm solid #bdccd6;border-radius:2mm;overflow:hidden;margin-bottom:3mm}.intro-grid div{padding:2.2mm 3mm;border-bottom:.2mm solid #d4dfe6}.intro-grid div:nth-child(odd){border-right:.2mm solid #d4dfe6}.intro-grid div:nth-last-child(-n+2){border-bottom:0}.intro-grid span,.section-label{display:block;color:#6a7f8e;font-size:2mm;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.intro-grid strong{display:block;margin-top:.7mm;color:#163c59;font-size:3.1mm}.material-title{padding:3mm 4mm;border-left:1.5mm solid #0b315d;background:#eef5f9;margin-bottom:3mm}.material-title span{font-size:2.1mm;color:#607786;font-weight:800}.material-title h2{margin:.8mm 0 0;color:#092d55;font-size:5mm}.protocol-body{display:grid;grid-template-columns:minmax(0,1fr) 69mm;gap:4mm}.detail-table{width:100%;border-collapse:collapse;font-size:2.55mm}.detail-table th,.detail-table td{border:.2mm solid #c2d0d9;padding:1.55mm 2mm;vertical-align:top}.detail-table th{width:33%;text-align:left;background:#edf4f8;color:#34556c;font-size:2.15mm;text-transform:uppercase}.detail-table td{white-space:pre-wrap}.sample-photo{height:72mm;border:.25mm solid #bdccd6;border-radius:2mm;overflow:hidden;background:#f0f4f6;display:grid;place-items:center;color:#718593;font-size:2.4mm}.sample-photo img{width:100%;height:100%;object-fit:contain;background:#fff}.decision{margin-top:4mm;border:.3mm solid #0b315d;border-radius:2mm;overflow:hidden}.decision-head{display:grid;grid-template-columns:1fr auto;gap:4mm;align-items:center;background:#0b315d;color:#fff;padding:2.5mm 3mm}.decision-head strong{font-size:3.4mm}.decision-head span{font-size:2.5mm}.decision-note{min-height:15mm;padding:2.5mm 3mm;font-size:2.7mm;white-space:pre-wrap}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:8mm}.sign{padding-top:8mm;border-top:.25mm solid #526a7a;text-align:center}.sign strong{display:block;color:#153d59;font-size:2.8mm}.sign span{font-size:2.2mm;color:#6b7f8d}.footnote{position:absolute;left:14mm;right:14mm;bottom:31.5mm;display:flex;justify-content:space-between;font-size:2mm;color:#718492}`}
 function documentShell(title,body,landscape){return`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${landscape?passportStyles():protocolStyles()}</style></head><body>${body}</body></html>`}
 async function exportProtocol(id){
  var item=state.materialSamples.find(function(x){return x.id===id});if(!item)return;var photo=await resolvePhoto(item),projectData=activeProject(),approvalDate=item.approvalDate?fmtDateISO(item.approvalDate):"—";
  var body=`<section class="sample-protocol"><img class="letterhead" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><header class="doc-head"><div><span class="kicker">BETPRES · SCHVAĽOVANIE MATERIÁLOV</span><h1>PROTOKOL O MATERIÁLOVEJ VZORKE</h1></div><div class="doc-number"><small>ČÍSLO PROTOKOLU</small><strong>${esc(item.protocolNumber||"")}</strong></div></header><div class="intro-grid"><div><span>Stavba</span><strong>${esc(projectData?.name||"")}</strong></div><div><span>Objekt / miesto</span><strong>${esc(item.location||"—")}</strong></div><div><span>Predložil</span><strong>${esc(sampleCompanyName(item))}</strong></div><div><span>Dátum predloženia</span><strong>${esc(item.submittedDate?fmtDateISO(item.submittedDate):"—")}</strong></div></div><div class="material-title"><span>MATERIÁLOVÁ VZORKA Č. ${Number(item.sequence)||"—"}</span><h2>${esc(item.materialName||"Bez názvu")}</h2></div><div class="protocol-body"><table class="detail-table"><tr><th>Výrobca</th><td>${esc(item.manufacturer||"—")}</td></tr><tr><th>Typ výrobku</th><td>${esc(item.productType||"—")}</td></tr><tr><th>Navrhované použitie</th><td>${esc(item.intendedUse||"—")}</td></tr><tr><th>Farba / variant</th><td>${esc(item.colorSurface||"—")}</td></tr><tr><th>Norma / certifikácia</th><td>${esc(item.technicalStandard||"—")}</td></tr><tr><th>Kľúčové parametre</th><td>${esc(item.keyParameters||"—")}</td></tr><tr><th>Doklady</th><td>${esc(item.certificates||item.technicalSheet?.name||"—")}</td></tr><tr><th>Montáž / skladovanie</th><td>${esc(item.installationNotes||"—")}</td></tr><tr><th>Kontrolné body</th><td>${esc(item.reviewPoints||"—")}</td></tr></table><div><span class="section-label">Fotografia predloženej vzorky</span><div class="sample-photo">${photo?`<img src="${photo}" alt="Materiálová vzorka">`:`Bez fotografie`}</div></div></div><section class="decision"><div class="decision-head"><strong>${esc(item.status||"Rozpracovaná")}</strong><span>Dátum odsúhlasenia: ${esc(approvalDate)}</span></div><div class="decision-note">${esc(item.decisionNote||"Vyjadrenie investora nebolo zapísané.")}</div></section><div class="signatures"><div class="sign"><strong>${esc(sampleCompanyName(item))}</strong><span>predložil za zhotoviteľa</span></div><div class="sign"><strong>${esc(item.approvedBy||"Investor / technický dozor")}</strong><span>odsúhlasil za investora</span></div></div><div class="footnote"><span>Príloha: ${esc(item.technicalSheet?.name||"bez technického listu")}</span><span>BETPRES SiteDesk 5.0.60</span></div></div></section>`;
  body=body.replace(/BETPRES SiteDesk 5\.0\.60/g,"BETPRES SiteDesk "+(window.__BETPRES_APP_VERSION__||"5.0.76"));
  return showPdf(documentShell("Materiálová vzorka "+item.protocolNumber,body,false),`materialova-vzorka-${item.protocolNumber||item.sequence}.pdf`,false,"Materiálová vzorka "+(item.protocolNumber||""))
 }
 function passportStyles(){return`@page{size:A4 landscape;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;font-family:Arial,sans-serif;color:#173248;-webkit-print-color-adjust:exact;print-color-adjust:exact}.passport-page{position:relative;width:297mm;height:210mm;overflow:hidden;page-break-after:always}.passport-page:last-child{page-break-after:auto}.letterhead{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.content{position:relative;z-index:1;height:100%;padding:34mm 13mm 22mm}.head{display:flex;justify-content:space-between;align-items:end;border-bottom:1mm solid #0b315d;padding-bottom:2.5mm;margin-bottom:3mm}.head span{font-size:2mm;color:#6c8190;font-weight:900;letter-spacing:.12em}.head h1{margin:.7mm 0 0;color:#0b315d;font-size:5.7mm}.head strong{font-size:2.7mm;color:#34566d}.passport-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:2.35mm}.passport-table th,.passport-table td{border:.2mm solid #b8c8d2;padding:1.3mm 1.5mm;vertical-align:middle}.passport-table th{height:8mm;background:#0b315d;color:#fff;text-transform:uppercase;font-size:2mm;letter-spacing:.04em}.passport-table tbody tr:nth-child(even) td{background:#f0f5f8}.no{width:10mm;text-align:center;font-weight:900}.photo{width:19mm;text-align:center}.photo img{display:block;width:15mm;height:11mm;object-fit:cover;margin:auto;border-radius:1mm}.material{width:52mm}.material strong{display:block;color:#0b315d;font-size:2.6mm}.material small,.date small{display:block;color:#6f8290;margin-top:.6mm;line-height:1.15}.manufacturer{width:34mm}.use{width:49mm}.date{width:24mm;text-align:center}.status{width:38mm}.person{width:42mm}.badge{display:inline-block;padding:1mm 1.6mm;border-radius:4mm;background:#e6f2f8;color:#155b87;font-weight:900}.badge.approved{background:#e2f4e8;color:#216c40}.badge.rejected{background:#fee6e4;color:#9b3f38}.page-foot{position:absolute;left:13mm;right:13mm;bottom:19mm;display:flex;justify-content:space-between;color:#6d8190;font-size:2mm}`}
 async function exportPassport(){
  var items=projectSamples().sort(function(a,b){return(Number(a.sequence)||0)-(Number(b.sequence)||0)});if(!items.length){alert("V pasporte zatiaľ nie sú žiadne materiálové vzorky.");return}
  var photos=new Map();await Promise.all(items.map(async function(item){photos.set(item.id,await resolvePhoto(item))}));var chunks=[];for(var i=0;i<items.length;i+=14)chunks.push(items.slice(i,i+14));var projectData=activeProject();var body=chunks.map(function(rows,pageIndex){return`<section class="passport-page"><img class="letterhead" src="${LETTERHEAD_IMAGE}" alt=""><div class="content"><header class="head"><div><span>BETPRES · EVIDENCIA SCHVAĽOVANIA INVESTOROM</span><h1>PASPORT MATERIÁLOVÝCH VZORIEK</h1></div><strong>${esc(projectData?.name||"")}</strong></header><table class="passport-table"><thead><tr><th class="no">P. č.</th><th class="photo">Foto</th><th class="material">Názov materiálu</th><th class="manufacturer">Výrobca</th><th class="use">Použitie / miesto</th><th class="date">Predložené</th><th class="status">Stav</th><th class="date">Odsúhlasené</th><th class="person">Za investora</th></tr></thead><tbody>${rows.map(function(item){var photo=photos.get(item.id)||"";return`<tr><td class="no">${Number(item.sequence)||"—"}</td><td class="photo">${photo?`<img src="${photo}" alt="">`:"—"}</td><td class="material"><strong>${esc(item.materialName||"—")}</strong><small>${esc(item.protocolNumber||"")}</small></td><td class="manufacturer">${esc(item.manufacturer||"—")}</td><td class="use">${esc(item.intendedUse||item.location||"—")}${item.internalNote?`<small>${esc(item.internalNote)}</small>`:""}</td><td class="date">${esc(item.submittedDate?fmtDateISO(item.submittedDate):"—")}<small>${esc(sampleCompanyName(item))}</small></td><td class="status"><span class="badge ${statusClass(item.status)}">${esc(item.status||"Rozpracovaná")}</span></td><td class="date">${esc(item.approvalDate?fmtDateISO(item.approvalDate):"—")}</td><td class="person">${esc(item.approvedBy||"—")}</td></tr>`}).join("")}</tbody></table><div class="page-foot"><span>Vytvorené ${fmtDateISO(todayISO())} · BETPRES SiteDesk 5.0.60</span><span>Strana ${pageIndex+1} / ${chunks.length}</span></div></div></section>`}).join("");
  body=body.replace(/BETPRES SiteDesk 5\.0\.60/g,"BETPRES SiteDesk "+(window.__BETPRES_APP_VERSION__||"5.0.76"));
  return showPdf(documentShell("Pasport materiálových vzoriek",body,true),`pasport-materialovych-vzoriek-${todayISO()}.pdf`,true,"Pasport materiálových vzoriek")
 }
 async function showPdf(html,fileName,landscape,title){try{if(window.showPdfPreview||window.betpresDesktop?.exportPdf){return window.showPdfPreview?await window.showPdfPreview({html:html,fileName:fileName,landscape:landscape,title:title}):await window.betpresDesktop.exportPdf({html:html,fileName:fileName,landscape:landscape,title:title})}var w=window.open("","_blank");if(!w)throw new Error("Otvorenie náhľadu bolo zablokované.");w.document.write(html.replace("</body>","<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\\/script></body>"));w.document.close();return{ok:true,fallback:true}}catch(error){alert("PDF sa nepodarilo vytvoriť: "+(error?.message||error));return{ok:false,error:String(error?.message||error)}}}

 window.renderMaterialSamples=render;
 window.__BETPRES_MATERIAL_SAMPLES_TEST__={render:render,openEditor:openEditor,exportProtocol:exportProtocol,exportPassport:exportPassport,protocolNumber:protocolNumber,pasteClipboardAttachment:pasteClipboardAttachment,analyzeTechnical:analyzeTechnical,setTechnicalAttachment:async function(payload){return pasteClipboardAttachment("technical",payload)}};
 var previousExportTests=window.__BETPRES_RUN_EXPORT_TESTS__;
 if(typeof previousExportTests==="function")window.__BETPRES_RUN_EXPORT_TESTS__=async function(){
  var results=await previousExportTests();
  var testId=uid("test-material-sample"),photo="data:image/svg+xml;charset=utf-8,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480"><rect width="720" height="480" fill="#ddd0b2"/><path d="M0 120h720M0 240h720M0 360h720M180 0v480M360 0v480M540 0v480" stroke="#b59a70" stroke-width="8"/><text x="360" y="260" text-anchor="middle" font-family="Arial" font-size="54" fill="#0b315d">VZORKA</text></svg>');
  state.materialSamples.push({id:testId,projectId:state.selectedProjectId,sequence:999,protocolNumber:"VZ-TEST-999",materialName:"Testovacia materiálová vzorka",manufacturer:"BETPRES test",productType:"Stavebný materiál",intendedUse:"Automatický test protokolu a pasportu",location:"Testovací objekt",submittedBy:"BETPRES, s.r.o.",submittedDate:todayISO(),status:"Schválená",approvalDate:todayISO(),approvedBy:"Testovací investor",technicalStandard:"STN EN TEST",keyParameters:"Parameter A · Parameter B",certificates:"Technický list",installationNotes:"Podľa pokynov výrobcu",reviewPoints:"Skontrolovať zhodu vzorky s projektom.",decisionNote:"Schválené bez výhrad.",technicalSheet:{name:"technicky-list-test.pdf",type:"application/pdf",size:120000,path:""},photo:{name:"vzorka.svg",type:"image/svg+xml",path:"",dataUrl:photo}});
  try{
   var protocol=await exportProtocol(testId);protocol=protocol||{ok:false};protocol.export="materialova-vzorka-protokol";results.push(protocol);
   var passport=await exportPassport();passport=passport||{ok:false};passport.export="pasport-materialovych-vzoriek";results.push(passport)
  }finally{state.materialSamples=state.materialSamples.filter(function(item){return item.id!==testId})}
  return results
 };
 mountEditor();render()
})();
