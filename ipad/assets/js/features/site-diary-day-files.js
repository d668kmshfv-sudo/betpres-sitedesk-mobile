(function(){
 "use strict";
 const get=id=>document.getElementById(id),list=get("siteDiaryDayFilesList"),dateInput=get("siteDiaryDate"),photoInput=get("siteDiaryDayPhotoInput"),documentInput=get("siteDiaryDayDocumentInput");
 if(!list||!dateInput||!photoInput||!documentInput)return;
 const escape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
 const currentDate=()=>dateInput.value||todayISO();
 const records=()=>Array.isArray(state.siteDiaryDayAttachments)?state.siteDiaryDayAttachments:(state.siteDiaryDayAttachments=[]);
 const current=()=>records().find(item=>item.projectId===state.selectedProjectId&&item.date===currentDate());
 const oldEntries=()=>Array.isArray(state.mobileDiary)?state.mobileDiary.filter(item=>item.kind==="siteLog"&&item.projectId===state.selectedProjectId&&item.date===currentDate()):[];
 const alertUser=message=>typeof toast==="function"?toast(message):alert(message);
 const makeId=prefix=>typeof uid==="function"?uid(prefix):`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
 function ensureRecord(){
  let record=current();if(record)return record;
  const now=new Date().toISOString();record={id:makeId("site-day-files"),projectId:state.selectedProjectId,date:currentDate(),photos:[],attachments:[],createdAt:now,updatedAt:now};records().push(record);return record
 }
 function render(){
  const record=current(),items=[];
  for(const photo of record?.photos||[])items.push(`<div class="site-diary-day-file"><span class="site-diary-day-file-icon">▧</span><span class="site-diary-day-file-name">${escape(photo.name||"Fotografia")}</span><button type="button" data-day-file-open="${escape(record.id)}:${escape(photo.id)}" data-day-file-type="photo">Otvoriť</button><button type="button" class="site-diary-day-file-remove" data-day-file-remove="${escape(photo.id)}" data-day-file-type="photo" aria-label="Odstrániť fotografiu">×</button></div>`);
  for(const file of record?.attachments||[])items.push(`<div class="site-diary-day-file"><span class="site-diary-day-file-icon">▤</span><span class="site-diary-day-file-name">${escape(file.name||"Dokument")}</span><button type="button" data-day-file-open="${escape(record.id)}:${escape(file.id)}" data-day-file-type="document">Otvoriť</button><button type="button" class="site-diary-day-file-remove" data-day-file-remove="${escape(file.id)}" data-day-file-type="document" aria-label="Odstrániť dokument">×</button></div>`);
  for(const entry of oldEntries()){
   for(const photo of entry.photos||[])items.push(`<div class="site-diary-day-file"><span class="site-diary-day-file-icon">▧</span><span class="site-diary-day-file-name">${escape(photo.name||"Fotografia")} <small>starší zápis</small></span><button type="button" data-day-file-open="${escape(entry.id)}:${escape(photo.id)}" data-day-file-type="legacy-photo">Otvoriť</button></div>`);
   for(const file of entry.attachments||[])items.push(`<div class="site-diary-day-file"><span class="site-diary-day-file-icon">▤</span><span class="site-diary-day-file-name">${escape(file.name||"PDF dokument")} <small>starší zápis</small></span><button type="button" data-day-file-open="${escape(entry.id)}:${escape(file.id)}" data-day-file-type="legacy-document">Otvoriť</button></div>`)
  }
  list.innerHTML=items.join("")||'<p class="site-diary-data-empty">K tomuto dňu ešte nie sú priložené súbory.</p>';
  const count=items.length;get("siteDiaryDayFilesCount").textContent=`${count} ${count===1?"súbor":count<5?"súbory":"súborov"}`
 }
 async function compressPhoto(file){
  if(!file.type.startsWith("image/"))throw new Error("Vyber fotografiu.");
  const url=URL.createObjectURL(file),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error("Fotografiu sa nepodarilo načítať."));image.src=url});
   const scale=Math.min(1,1400/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   const dataUrl=canvas.toDataURL("image/jpeg",.72);return{id:makeId("site-photo"),name:file.name,type:"image/jpeg",size:Math.round(dataUrl.length*.75),dataUrl,path:""}
  }finally{URL.revokeObjectURL(url)}
 }
 photoInput.addEventListener("change",async event=>{
  const files=[...(event.target.files||[])];event.target.value="";
  for(const file of files)try{const photo=await compressPhoto(file),record=ensureRecord();record.photos.push(photo);record.updatedAt=new Date().toISOString();save("Fotografia bola priložená k dňu.");render()}catch(error){alertUser(error.message||"Fotografiu sa nepodarilo priložiť.")}
 });
 documentInput.addEventListener("change",async event=>{
  const files=[...(event.target.files||[])];event.target.value="";
  for(const file of files)try{
   if(!/\.(pdf|docx?|xlsx?|txt)$/i.test(file.name))throw new Error("Vyber PDF, Word, Excel alebo textový dokument.");
   const record=ensureRecord(),attachment={id:makeId("site-doc"),name:file.name,type:file.type||"application/octet-stream",size:file.size,path:""};
   await siteDeskPutAttachment(`${record.id}:${attachment.id}`,file);
   record.attachments.push(attachment);record.updatedAt=new Date().toISOString();save("Dokument bol priložený k dňu.");render()
  }catch(error){alertUser(error.message||"Dokument sa nepodarilo priložiť.")}
 });
 async function cloudBlob(path){
  if(!path||!cloudConfigured()||!cloudSession?.access_token)throw new Error("Súbor nie je dostupný v tomto zariadení. Skontroluj synchronizáciu.");
  await cloudEnsureSession();
  const base=normalizeCloudUrl(cloudConfig.url),headers={apikey:cloudConfig.key,Authorization:`Bearer ${cloudSession.access_token}`},encoded=encodeStoragePath(path);
  for(const prefix of ["authenticated/",""]){const response=await fetch(`${base}/storage/v1/object/${prefix}sitedesk-files/${encoded}`,{headers,cache:"no-store"});if(response.ok)return response.blob()}
  throw new Error("Súbor sa nepodarilo načítať z cloudu.")
 }
 async function openFile(recordId,fileId,type){
  const record=[...records(),...oldEntries()].find(item=>item.id===recordId),file=(type.includes("photo")?record?.photos:record?.attachments||[])?.find(item=>item.id===fileId);
  if(!file)return;
  try{
   const blob=type.includes("photo")?(file.dataUrl?dataUrlToBlob(file.dataUrl):await cloudBlob(file.path)):(await siteDeskGetAttachment(`${record.id}:${file.id}`))||await cloudBlob(file.path);
   const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=file.name||"priloha";link.rel="noopener";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
  }catch(error){alertUser(error.message||"Súbor sa nepodarilo otvoriť.")}
 }
 list.addEventListener("click",event=>{
  const button=event.target.closest("button");if(!button)return;
  if(button.dataset.dayFileOpen){const [recordId,fileId]=button.dataset.dayFileOpen.split(":");void openFile(recordId,fileId,button.dataset.dayFileType||"document");return}
  const id=button.dataset.dayFileRemove,type=button.dataset.dayFileType,record=current();if(!id||!record)return;
  if(!confirm(`Odstrániť ${type==="photo"?"fotografiu":"dokument"} z vybraného dňa?`))return;
  const key=type==="photo"?"photos":"attachments";record[key]=record[key].filter(item=>item.id!==id);record.updatedAt=new Date().toISOString();save("Príloha bola odstránená z dňa.");render()
 });
 dateInput.addEventListener("change",render);
 new MutationObserver(render).observe(get("siteDiaryDayList"),{childList:true});
 window.renderSiteDiaryDayFiles=render;window.__BETPRES_DIARY_DAY_FILES_READY__=true;render()
})();
