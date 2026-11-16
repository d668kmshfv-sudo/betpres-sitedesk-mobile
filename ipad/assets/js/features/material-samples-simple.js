(function(){
 "use strict";
 const app=document.getElementById("materialSamplesApp");
 if(!app||typeof state==="undefined")return;
 const roles=[
  ["contractor","Zhotoviteľ"],
  ["gds","GDS · generálny dodávateľ stavby"],
  ["investor","Investor"],
  ["supervisor","Stavebný dozor"],
  ["designer","Projektant"]
 ];
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
 const fold=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("sk").trim();
 const today=()=>typeof todayISO==="function"?todayISO():new Date().toISOString().slice(0,10);
 const dateLabel=value=>value&&typeof fmtDateISO==="function"?fmtDateISO(value):value||"—";
 const samples=()=>Array.isArray(state.materialSamples)?state.materialSamples.filter(item=>item.projectId===state.selectedProjectId):[];
 const description=item=>String(item?.description||item?.intendedUse||item?.decisionNote||item?.keyParameters||"").trim();
 const signatures=item=>item?.signatures&&typeof item.signatures==="object"?item.signatures:{};
 const countSigned=item=>roles.filter(([key])=>String(signatures(item)[key]||"").trim()).length;
 let currentId="",searchText="",pendingPhoto=null,photoRemoved=false,photoLoadToken=0;
 const PHOTO_DB="betpres-sitedesk-material-files",PHOTO_STORE="files";
 function photoDb(){
  return new Promise(resolve=>{
   if(!window.indexedDB)return resolve(null);
   const request=indexedDB.open(PHOTO_DB,1);
   request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(PHOTO_STORE))request.result.createObjectStore(PHOTO_STORE,{keyPath:"key"})};
   request.onsuccess=()=>resolve(request.result);request.onerror=()=>resolve(null)
  })
 }
 async function legacyPhotoDataUrl(id){
  if(!id)return"";const db=await photoDb();if(!db)return"";
  return new Promise(resolve=>{try{const request=db.transaction(PHOTO_STORE,"readonly").objectStore(PHOTO_STORE).get(`${id}:photo`);request.onsuccess=()=>{db.close();resolve(request.result?.dataUrl||"")};request.onerror=()=>{db.close();resolve("")}}catch{db.close();resolve("")}})
 }
 async function storeLegacyPhoto(id,photo){
  const db=await photoDb();if(!db)return false;
  return new Promise(resolve=>{try{const tx=db.transaction(PHOTO_STORE,"readwrite");tx.objectStore(PHOTO_STORE).put({key:`${id}:photo`,dataUrl:photo.dataUrl,meta:{name:photo.name,type:photo.type},updatedAt:new Date().toISOString()});tx.oncomplete=()=>{db.close();resolve(true)};tx.onerror=()=>{db.close();resolve(false)}}catch{db.close();resolve(false)}})
 }
 async function removeLegacyPhoto(id){
  const db=await photoDb();if(!db)return;
  await new Promise(resolve=>{try{const tx=db.transaction(PHOTO_STORE,"readwrite");tx.objectStore(PHOTO_STORE).delete(`${id}:photo`);tx.oncomplete=resolve;tx.onerror=resolve}catch{resolve()}});db.close()
 }
 async function resolvePhoto(item){
  if(item?.photo?.dataUrl)return item.photo.dataUrl;
  if(item?.photo?.path&&typeof cloudPhotoObjectUrl==="function"){
   const remote=await cloudPhotoObjectUrl(item.photo.path);if(remote)return remote
  }
  return legacyPhotoDataUrl(item?.id)
 }
 function showPhoto(preview,src){
  preview.replaceChildren();
  if(!src){preview.textContent="Bez fotografie";return}
  const image=document.createElement("img");image.src=src;image.alt="Fotografia vzorky";preview.appendChild(image)
 }
 async function renderEditorPhoto(item){
  const token=++photoLoadToken,preview=document.getElementById("simpleSamplePhotoPreview");if(!preview)return;
  const src=photoRemoved?"":pendingPhoto?.dataUrl||await resolvePhoto(item);
  if(token!==photoLoadToken)return;
  showPhoto(preview,src);document.getElementById("simpleSampleRemovePhoto").hidden=!src
 }

 function ensureEditor(){
  if(document.getElementById("simpleSampleModal"))return;
  const modal=document.createElement("div");
  modal.id="simpleSampleModal";modal.className="modal simple-sample-modal hidden";
  modal.innerHTML=`<div class="modal-card simple-sample-dialog" role="dialog" aria-modal="true" aria-labelledby="simpleSampleDialogTitle">
   <div class="modal-head"><div><p>VZORKOVANIE MATERIÁLOV</p><h2 id="simpleSampleDialogTitle">Nová vzorka</h2></div><button class="close" type="button" id="simpleSampleClose" aria-label="Zavrieť">×</button></div>
   <form id="simpleSampleForm"><label>Názov vzorky<input id="simpleSampleName" required maxlength="240" placeholder="napr. Fasádna omietka"></label>
   <div class="simple-sample-meta-fields"><div class="simple-sample-project-field"><span>Stavba</span><strong id="simpleSampleProject">—</strong></div><label>Dátum vzorky<input id="simpleSampleDate" type="date" required></label></div>
   <label>Popis vzorky<textarea id="simpleSampleDescription" rows="7" placeholder="Napíš, čo sa predkladá na odsúhlasenie"></textarea></label>
   <div class="simple-sample-photo-field"><label for="simpleSamplePhotoFile">Fotografia vzorky</label><input id="simpleSamplePhotoFile" type="file" accept="image/*"><small>Fotografiu zmenšíme a priložíme k vzorke aj k PDF.</small><div id="simpleSamplePhotoPreview" class="simple-sample-photo-preview">Bez fotografie</div><button type="button" class="ghost" id="simpleSampleRemovePhoto" hidden>Odstrániť fotografiu</button></div>
   <fieldset class="simple-sample-signers"><legend>Podpisy</legend><p>Mená sú voliteľné. Dokument obsahuje miesto na podpis každej osoby.</p>
   ${roles.map(([key,label])=>`<label>${escape(label)}<input id="simpleSampleSigner-${key}" autocomplete="name" placeholder="Meno podpisujúceho"></label>`).join("")}</fieldset>
   <div class="simple-sample-form-actions"><button type="button" class="danger" id="simpleSampleDelete" hidden>Vymazať vzorku</button><div><button type="button" class="ghost" id="simpleSampleCancel">Zrušiť</button><button type="submit">Uložiť vzorku</button></div></div></form>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#simpleSampleClose").onclick=closeEditor;
  modal.querySelector("#simpleSampleCancel").onclick=closeEditor;
  modal.querySelector("#simpleSampleDelete").onclick=deleteSample;
  modal.querySelector("#simpleSampleForm").onsubmit=event=>void saveSample(event);
  modal.querySelector("#simpleSamplePhotoFile").onchange=async event=>{
   const file=event.target.files?.[0];if(!file)return;
   if(!file.type.startsWith("image/")){alert("Vyber fotografiu vo formáte obrázka.");event.target.value="";return}
   try{pendingPhoto=await compressDefectPhoto(file);photoRemoved=false;await renderEditorPhoto(null)}
   catch(error){alert(`Fotografiu sa nepodarilo načítať: ${error.message||error}`);event.target.value=""}
  };
  modal.querySelector("#simpleSampleRemovePhoto").onclick=()=>{pendingPhoto=null;photoRemoved=true;modal.querySelector("#simpleSamplePhotoFile").value="";void renderEditorPhoto(null)};
  modal.addEventListener("click",event=>{if(event.target===modal)closeEditor()});
  modal.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();closeEditor()}});
 }
 function closeEditor(){document.getElementById("simpleSampleModal")?.classList.add("hidden")}
 function openEditor(id=""){
  ensureEditor();currentId=id;pendingPhoto=null;photoRemoved=false;
  const item=samples().find(row=>row.id===id)||null,modal=document.getElementById("simpleSampleModal");
  modal.querySelector("#simpleSampleDialogTitle").textContent=item?"Upraviť vzorku č. "+(item.sequence||""):"Nová vzorka";
  modal.querySelector("#simpleSampleName").value=item?.materialName||"";
  modal.querySelector("#simpleSampleProject").textContent=typeof activeProject==="function"?activeProject()?.name||"—":"—";
  modal.querySelector("#simpleSampleDate").value=item?.submittedDate||today();
  modal.querySelector("#simpleSamplePhotoFile").value="";
  modal.querySelector("#simpleSampleDescription").value=description(item);
  for(const [key] of roles)modal.querySelector(`#simpleSampleSigner-${key}`).value=signatures(item)[key]||"";
  modal.querySelector("#simpleSampleDelete").hidden=!item;
  modal.classList.remove("hidden");
  void renderEditorPhoto(item);
  setTimeout(()=>modal.querySelector("#simpleSampleName").focus(),20);
 }
 async function saveSample(event){
  event.preventDefault();
  const name=document.getElementById("simpleSampleName").value.trim();
  if(!name){document.getElementById("simpleSampleName").reportValidity();return}
  const existing=samples().find(row=>row.id===currentId)||null;
  const sequence=existing?.sequence||Math.max(0,...samples().map(row=>Number(row.sequence)||0))+1;
  const names=Object.fromEntries(roles.map(([key])=>[key,document.getElementById(`simpleSampleSigner-${key}`).value.trim()]));
  const now=new Date().toISOString();
  const item={...(existing||{}),id:existing?.id||uid("sample"),projectId:state.selectedProjectId,sequence,
   protocolNumber:existing?.protocolNumber||`VZ-${today().slice(0,4)}-${String(sequence).padStart(3,"0")}`,
   materialName:name,description:document.getElementById("simpleSampleDescription").value.trim(),signatures:names,
   submittedDate:document.getElementById("simpleSampleDate").value||today(),createdAt:existing?.createdAt||now,updatedAt:now};
  if(photoRemoved){delete item.photo;await removeLegacyPhoto(item.id)}
  else if(pendingPhoto){item.photo={...pendingPhoto};await storeLegacyPhoto(item.id,pendingPhoto)}
  else if(existing?.photo&&!existing.photo.dataUrl&&!existing.photo.path){
   const legacy=await legacyPhotoDataUrl(item.id);if(legacy)item.photo={...existing.photo,dataUrl:legacy}
  }
  if(!Array.isArray(state.materialSamples))state.materialSamples=[];
  if(existing)Object.assign(existing,item);else state.materialSamples.push(item);
  closeEditor();render();save("Vzorka bola uložená.");
 }
 async function deleteLegacyFiles(id){
  if(!window.indexedDB)return;
  try{
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open("betpres-sitedesk-material-files",1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
   await new Promise(resolve=>{const tx=db.transaction("files","readwrite");tx.objectStore("files").delete(`${id}:technical`);tx.objectStore("files").delete(`${id}:photo`);tx.oncomplete=resolve;tx.onerror=resolve});db.close()
  }catch(_){ }
 }
 function deleteSample(){
  const item=samples().find(row=>row.id===currentId);if(!item||!confirm(`Vymazať vzorku „${item.materialName||item.sequence}“?`))return;
  state.materialSamples=state.materialSamples.filter(row=>row.id!==item.id);
  void deleteLegacyFiles(item.id);closeEditor();render();save("Vzorka bola vymazaná.")
 }
 function itemHtml(item){
  const text=description(item),signed=countSigned(item);
  return `<article class="simple-sample-row" data-simple-sample-id="${escape(item.id)}"><span class="simple-sample-number">${escape(item.sequence||"—")}</span><div class="simple-sample-main"><strong>${escape(item.materialName||"Bez názvu")}</strong><small>${escape(item.protocolNumber||"")} · ${escape(item.submittedDate||"Bez dátumu")}${item.photo?" · Fotografia priložená":""}</small><p>${escape(text||"Popis zatiaľ nie je vyplnený.")}</p></div><span class="simple-sample-sign-count">${signed} / 5 mien</span><div class="simple-sample-row-actions"><button type="button" class="ghost" data-simple-sample-pdf="${escape(item.id)}">PDF</button><button type="button" data-simple-sample-edit="${escape(item.id)}">Upraviť</button></div></article>`
 }
 function applySearch(){
  const query=fold(searchText),rows=[...app.querySelectorAll("[data-simple-sample-id]")];let count=0;
  for(const row of rows){const item=samples().find(sample=>sample.id===row.dataset.simpleSampleId),match=!query||fold([item?.materialName,description(item),item?.protocolNumber].join(" ")).includes(query);row.hidden=!match;if(match)count++}
  const countEl=app.querySelector("#simpleSampleCount");if(countEl)countEl.textContent=`${count} z ${rows.length} vzoriek`;
  const empty=app.querySelector("#simpleSampleFilterEmpty");if(empty)empty.hidden=!query||count>0||!rows.length
 }
 function render(){
  const items=samples().slice().sort((a,b)=>(Number(b.sequence)||0)-(Number(a.sequence)||0));
  app.innerHTML=`<div class="simple-samples-page"><div class="page-title"><div><p>EVIDENCIA VZORIEK</p><h1>Vzorkovanie materiálov</h1></div><div class="simple-sample-top-actions"><button type="button" class="ghost" id="simpleSampleExportAll">PDF všetkých vzoriek</button><button type="button" id="simpleSampleAdd">+ Nová vzorka</button></div></div>
   <div class="panel simple-sample-toolbar"><label for="simpleSampleSearch">Hľadať vzorku<input type="search" id="simpleSampleSearch" autocomplete="off" placeholder="Názov alebo popis" value="${escape(searchText)}"></label><span id="simpleSampleCount"></span></div>
   <div class="simple-sample-list">${items.map(itemHtml).join("")||'<div class="panel simple-sample-empty">Zatiaľ nie je pridaná žiadna vzorka. Klikni na „Nová vzorka“.</div>'}</div><div class="panel simple-sample-empty" id="simpleSampleFilterEmpty" hidden>Žiadna vzorka nezodpovedá hľadaniu.</div></div>`;
  app.querySelector("#simpleSampleAdd").onclick=()=>openEditor();
  app.querySelector("#simpleSampleExportAll").onclick=()=>void exportAll();
  app.querySelector("#simpleSampleSearch").oninput=event=>{searchText=event.target.value;applySearch()};
  app.querySelectorAll("[data-simple-sample-edit]").forEach(button=>button.onclick=()=>openEditor(button.dataset.simpleSampleEdit));
  app.querySelectorAll("[data-simple-sample-pdf]").forEach(button=>button.onclick=()=>void exportProtocol(button.dataset.simpleSamplePdf));
  applySearch()
 }
 function theme(){
  const current=window.betpresDocumentTheme?.()||{};
  const accent=/^#[0-9a-f]{6}$/i.test(current.accentColor||"")?current.accentColor:"#123b68";
  const letterhead=current.letterheadImage||typeof LETTERHEAD_IMAGE!=="undefined"&&LETTERHEAD_IMAGE||"";
  return{accent,letterhead}
 }
 function pageChunks(value,hasPhoto=false){
  let remaining=String(value||"—").trim()||"—";const chunks=[];
  const firstLimit=hasPhoto?360:850;
  if(remaining.length>firstLimit){let cut=remaining.lastIndexOf(" ",firstLimit);if(cut<firstLimit/2)cut=firstLimit;chunks.push(remaining.slice(0,cut).trim());remaining=remaining.slice(cut).trim()}
  while(remaining.length>850){let cut=remaining.lastIndexOf(" ",850);if(cut<450)cut=850;chunks.push(remaining.slice(0,cut).trim());remaining=remaining.slice(cut).trim()}
  chunks.push(remaining);return chunks
 }
 function pageHtml(item,part,partIndex,partTotal,number,total,style,photoUrl){
  const signer=signatures(item),projectName=typeof activeProject==="function"?activeProject()?.name||"":"";
  const signHtml=partIndex===partTotal-1?`<div class="simple-sample-pdf-signatures">${roles.map(([key,label])=>`<div class="simple-sample-pdf-sign"><span>${escape(label)}</span><strong>${escape(signer[key]||" ")}</strong></div>`).join("")}</div>`:"";
  return `<section class="simple-sample-pdf-page">${style.letterhead?`<img class="simple-sample-pdf-letterhead" src="${escape(style.letterhead)}" alt="">`:""}<div class="simple-sample-pdf-content"><div class="simple-sample-pdf-kicker">BETPRES · VZORKOVANIE MATERIÁLOV</div><h1>PROTOKOL O VZORKE${partIndex?" · POKRAČOVANIE":""}</h1><div class="simple-sample-pdf-meta"><span><b>Stavba:</b> ${escape(projectName||"—")}</span><span><b>Dátum:</b> ${escape(dateLabel(item.submittedDate))}</span><span><b>Číslo:</b> ${escape(item.protocolNumber||"—")}</span></div><h2>${escape(item.materialName||"Bez názvu")}</h2><div class="simple-sample-pdf-label">Popis vzorky</div><div class="simple-sample-pdf-description">${escape(part)}</div>${partIndex===0&&photoUrl?`<img class="simple-sample-pdf-photo" src="${escape(photoUrl)}" alt="Fotografia vzorky">`:""}${signHtml}<div class="simple-sample-pdf-footer"><span>${escape(item.protocolNumber||"")}</span><span>Strana ${number} / ${total}</span></div></div></section>`
 }
 function pdfStyles(accent){return `@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#173248;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.simple-sample-pdf-page{position:relative;width:210mm;height:297mm;overflow:hidden;break-after:page;page-break-after:always}.simple-sample-pdf-page:last-child{break-after:auto;page-break-after:auto}.simple-sample-pdf-letterhead{position:absolute;inset:0;width:210mm;height:297mm;object-fit:fill}.simple-sample-pdf-content{position:relative;z-index:1;display:flex;flex-direction:column;width:100%;height:100%;padding:47mm 15mm 30mm}.simple-sample-pdf-kicker{color:${accent};font-size:9px;font-weight:800;letter-spacing:.13em}.simple-sample-pdf-content h1{margin:2mm 0 5mm;color:${accent};font-size:19px;line-height:1.15}.simple-sample-pdf-meta{display:flex;justify-content:space-between;gap:8mm;padding:3mm 0;border-top:1px solid #becbd5;border-bottom:1px solid #becbd5;font-size:10px;overflow-wrap:anywhere}.simple-sample-pdf-content h2{margin:6mm 0 2mm;color:#1a3650;font-size:17px;overflow-wrap:anywhere}.simple-sample-pdf-label{color:#5d7484;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.simple-sample-pdf-description{margin-top:2mm;font-size:12px;line-height:1.48;white-space:pre-wrap;overflow-wrap:anywhere}.simple-sample-pdf-signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15mm 10mm;margin-top:auto;padding-top:14mm}.simple-sample-pdf-sign{min-height:19mm;border-top:1px solid #5e7382;padding-top:2mm;font-size:10px}.simple-sample-pdf-sign span{display:block;color:#516b7c;font-weight:800}.simple-sample-pdf-sign strong{display:block;margin-top:1mm;color:#1a3650;font-size:10px}.simple-sample-pdf-footer{position:absolute;left:15mm;right:15mm;bottom:19mm;display:flex;justify-content:space-between;color:#738694;font-size:9px}`}
 async function exportItems(items,fileName,title){
  if(!items.length){alert("Zatiaľ nie sú pridané žiadne vzorky.");return}
  const style=theme(),photos=await Promise.all(items.map(resolvePhoto));
  const parts=items.flatMap((item,itemIndex)=>pageChunks(description(item),Boolean(photos[itemIndex])).map((part,index,array)=>({item,part,index,total:array.length,photoUrl:photos[itemIndex]})));
  const body=parts.map(({item,part,index,total,photoUrl},pageIndex)=>pageHtml(item,part,index,total,pageIndex+1,parts.length,style,photoUrl)).join("");
  const html=`<!doctype html><html lang="sk"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${pdfStyles(style.accent)}.simple-sample-pdf-photo{display:block;max-width:100%;max-height:62mm;margin-top:5mm;object-fit:contain;align-self:flex-start;border:1px solid #d8e4ec}</style></head><body>${body}</body></html>`;
  const payload={html,fileName,landscape:false,title};
  if(typeof window.showPdfPreview==="function")return window.showPdfPreview(payload);
  if(window.betpresDesktop?.exportPdf)return window.betpresDesktop.exportPdf(payload);
  const preview=window.open("","_blank");if(!preview)throw new Error("Náhľad PDF bol zablokovaný.");preview.document.write(html);preview.document.close();return payload
 }
 async function exportProtocol(id){
  const item=samples().find(row=>row.id===id);if(!item)return;
  return exportItems([item],`vzorka-${item.protocolNumber||item.sequence}.pdf`,`Vzorka ${item.protocolNumber||item.sequence}`)
 }
 async function exportAll(){
  return exportItems(samples().slice().sort((a,b)=>(Number(a.sequence)||0)-(Number(b.sequence)||0)),`vzorkovanie-${today()}.pdf`,"Vzorkovanie materiálov")
 }
 window.renderMaterialSamples=render;
 window.__BETPRES_SIMPLE_SAMPLES_TEST__={render,openEditor,exportProtocol,exportAll};
 ensureEditor();render();
})();
