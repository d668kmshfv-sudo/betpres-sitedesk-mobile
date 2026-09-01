// BETPRES SiteDesk – spoločný denník úloh pre počítač a mobil
(function(){
 "use strict";

 function e(value){
  return String(value??"").replace(/[&<>"']/g,function(character){
   return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character]
  })
 }
 function isDone(item){
  return Boolean(item?.completed||item?.completedAt)||/splnen|hotov|vybaven/i.test(String(item?.status||""))
 }
 function diaryRows(){
  if(typeof state==="undefined")return[];
  if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
  var projectId=state.selectedProjectId;
  return state.mobileDiary.filter(function(item){return!projectId||item.projectId===projectId})
 }
 function diaryDate(value){
  if(!value)return"Bez dátumu";
  var date=new Date(value);
  if(Number.isNaN(date.getTime()))return String(value);
  return new Intl.DateTimeFormat("sk-SK",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date)
 }
 function priorityClass(priority){
  var value=String(priority||"").toLowerCase();
  if(value.includes("vysok"))return"danger";
  if(value.includes("nízk")||value.includes("nizk"))return"ok";
  return"warn"
 }
 var diaryEditorPhotos=[];
 function diaryUid(){
  if(typeof uid==="function")return uid("diary");
  return"diary-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)
 }
 function diaryPhotoUid(){return"photo-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,9)}
 async function prepareDiaryPhoto(file){
  if(!file||!String(file.type||"").startsWith("image/"))throw new Error("Vyber fotografiu.");
  var url=URL.createObjectURL(file),picture=new Image();
  try{
   await new Promise(function(resolve,reject){picture.onload=resolve;picture.onerror=function(){reject(new Error("Fotografiu sa nepodarilo načítať."))};picture.src=url});
   var scale=Math.min(1,1400/Math.max(picture.naturalWidth,picture.naturalHeight)),canvas=document.createElement("canvas");
   canvas.width=Math.max(1,Math.round(picture.naturalWidth*scale));canvas.height=Math.max(1,Math.round(picture.naturalHeight*scale));
   var context=canvas.getContext("2d");context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(picture,0,0,canvas.width,canvas.height);
   var dataUrl=canvas.toDataURL("image/jpeg",.72);
   return{id:diaryPhotoUid(),name:file.name||"foto.jpg",type:"image/jpeg",size:Math.round(dataUrl.length*.75),dataUrl:dataUrl}
  }finally{URL.revokeObjectURL(url)}
 }
 function updateDiaryPhotoStatus(message){
  var status=document.getElementById("mobileDiaryPhotoStatus");
  if(status)status.textContent=message||("Fotografie: "+diaryEditorPhotos.length+" / 6. Pôvodné fotografie sa pri úprave zachovajú.")
 }
 function diaryAuthor(existing){
  if(existing?.author||existing?.createdBy)return existing.author||existing.createdBy;
  try{if(typeof cloudConfig!=="undefined"&&cloudConfig.displayName)return cloudConfig.displayName}catch(error){}
  try{if(typeof cloudSessionUser==="function")return cloudSessionUser()?.email||""}catch(error){}
  return"iPad / notebook"
 }
 function openDiaryEditor(id){
  if(typeof state==="undefined")return;
  if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
  var item=id?state.mobileDiary.find(function(row){return row.id===id}):null,done=item?isDone(item):false,modal=document.getElementById("mobileDiaryModal");
  if(!modal)return;
  document.getElementById("mobileDiaryModalTitle").textContent=item?"Upraviť denný zápis":"Nový denný zápis";
  document.getElementById("mobileDiaryId").value=item?.id||"";
  document.getElementById("mobileDiaryTitle").value=item?.title||"";
  document.getElementById("mobileDiaryText").value=item?.text||"";
  document.getElementById("mobileDiaryPlace").value=item?.place||item?.object||"";
  document.getElementById("mobileDiaryDueDate").value=item?.dueDate||"";
  document.getElementById("mobileDiaryPriority").value=item?.priority||"Stredná";
  document.getElementById("mobileDiaryStatus").value=done?"Splnené":"Aktívne";
  document.getElementById("mobileDiaryPhotos").value="";
  diaryEditorPhotos=Array.isArray(item?.photos)?item.photos.slice():[];
  updateDiaryPhotoStatus();modal.classList.remove("hidden");
  setTimeout(function(){document.getElementById("mobileDiaryTitle")?.focus()},40)
 }
 function saveDiaryEditor(event){
  event.preventDefault();
  if(typeof state==="undefined")return;
  if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
  var id=document.getElementById("mobileDiaryId").value,existing=id?state.mobileDiary.find(function(row){return row.id===id}):null,now=new Date().toISOString(),done=document.getElementById("mobileDiaryStatus").value==="Splnené";
  var record=Object.assign({},existing||{},{
   id:existing?.id||diaryUid(),projectId:existing?.projectId||state.selectedProjectId,title:document.getElementById("mobileDiaryTitle").value.trim(),text:document.getElementById("mobileDiaryText").value.trim(),place:document.getElementById("mobileDiaryPlace").value.trim(),dueDate:document.getElementById("mobileDiaryDueDate").value,priority:document.getElementById("mobileDiaryPriority").value,status:done?"Splnené":"Aktívne",completed:done,completedAt:done?(existing?.completedAt||now):"",photos:diaryEditorPhotos.slice(),author:diaryAuthor(existing),createdAt:existing?.createdAt||now,updatedAt:now
  });
  if(existing)state.mobileDiary[state.mobileDiary.indexOf(existing)]=record;else state.mobileDiary.push(record);
  document.getElementById("mobileDiaryModal")?.classList.add("hidden");
  if(typeof save==="function")save(existing?"Zmeny v denníku boli uložené.":"Denný zápis bol uložený.");
  renderMobileDiaryDashboard();renderMobileDiaryPage()
 }
 async function addDiaryEditorPhotos(event){
  var files=Array.from(event.target.files||[]),free=Math.max(0,6-diaryEditorPhotos.length),selected=files.slice(0,free);
  if(!free){updateDiaryPhotoStatus("V zázname je už maximálne 6 fotografií.");event.target.value="";return}
  updateDiaryPhotoStatus("Pripravujem fotografie…");
  try{for(var index=0;index<selected.length;index++)diaryEditorPhotos.push(await prepareDiaryPhoto(selected[index]));updateDiaryPhotoStatus(files.length>selected.length?"Fotografie: "+diaryEditorPhotos.length+" / 6. Ďalšie sa nezmestili.":"")}
  catch(error){updateDiaryPhotoStatus("Fotografiu sa nepodarilo pridať: "+error.message)}
  event.target.value=""
 }
 function ensureDashboardCard(){
  var grid=document.querySelector(".site-dashboard-grid");
  if(!grid||document.getElementById("dashboardMobileDiaryList"))return;
  var card=document.createElement("article");
  card.className="panel site-focus-card";
  card.innerHTML='<div class="panel-head"><div><p class="eyebrow">SPOLOČNÉ ÚLOHY</p><h2>Denník z mobilu</h2><small id="mobileDiaryActiveCount">Aktívne zápisy zo stavby</small></div><button class="link-btn" type="button" data-go-mobile-diary>Otvoriť denník</button></div><div id="dashboardMobileDiaryList" class="site-task-list"></div>';
  grid.insertBefore(card,grid.firstChild);
  card.querySelector("[data-go-mobile-diary]").onclick=function(){
   if(typeof showView==="function")showView("mobileDiary")
  }
 }
 async function refreshMobileDiary(){
  var buttons=[document.getElementById("mobileDiaryPageRefresh")].filter(Boolean);
  try{
   buttons.forEach(function(button){button.disabled=true;button.textContent="Načítavam…"});
   if(typeof cloudPull==="function"&&typeof cloudConfigured==="function"&&cloudConfigured()){
    if(typeof cloudLocalDirty!=="undefined"&&cloudLocalDirty)toast("Najprv počkaj na uloženie lokálnych zmien do cloudu.");
    else await cloudPull({silent:true})
   }else if(typeof toast==="function")toast("Cloud zatiaľ nie je nastavený.")
  }catch(error){
   console.warn("Denník sa nepodarilo obnoviť.",error);
   if(typeof toast==="function")toast("Denník sa nepodarilo načítať z cloudu.")
  }finally{
   buttons.forEach(function(button){button.disabled=false;button.textContent="Načítať z cloudu"});
   renderMobileDiaryDashboard();
   renderMobileDiaryPage()
  }
 }
 function setDiaryItemDone(id,done){
  if(typeof state==="undefined"||!Array.isArray(state.mobileDiary))return;
  var item=state.mobileDiary.find(function(row){return row.id===id});
  if(!item)return;
  var now=new Date().toISOString();
  item.completed=done;
  item.completedAt=done?now:"";
  item.updatedAt=now;
  item.status=done?"Splnené":"Aktívne";
  if(typeof save==="function")save(done?"Úloha z mobilného denníka bola dokončená.":"Úloha z mobilného denníka bola obnovená.");
  renderMobileDiaryDashboard();
  renderMobileDiaryPage()
 }
 function renderMobileDiaryDashboard(){
  try{
   ensureDashboardCard();
   var box=document.getElementById("dashboardMobileDiaryList");
   if(!box)return;
   var active=diaryRows().filter(function(item){return!isDone(item)}).sort(function(a,b){
    return String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""))
   });
   var count=document.getElementById("mobileDiaryActiveCount");
   if(count)count.textContent=active.length?active.length+" aktívnych zápisov · odkliknuté zmiznú":"Bez aktívnych zápisov";
   box.innerHTML=active.slice(0,8).map(function(item){
    var priority=item.priority||"Stredná",
        place=item.place||item.object||"Bez určeného miesta",
        due=item.dueDate||"Bez termínu";
    return '<article class="site-task-item mobile-diary-item"><button class="mobile-diary-complete" type="button" data-complete-mobile-diary="'+e(item.id)+'" title="Označiť ako hotové" aria-label="Označiť úlohu ako hotovú">✓</button><div class="mobile-diary-content"><strong class="mobile-diary-title">'+e(item.title||"Zápis z mobilu")+"</strong>"+(item.text?'<p class="mobile-diary-text">'+e(item.text)+"</p>":"")+'<div class="mobile-diary-meta"><span title="Miesto alebo objekt">⌖ '+e(place)+'</span><span title="Termín">Termín: '+e(due)+'</span></div></div><span class="task-status '+priorityClass(priority)+'">'+e(priority)+"</span></article>"
   }).join("")||'<div class="empty-state">Všetko je hotové. Nový zápis z mobilu sa po synchronizácii zobrazí tu.</div>';
   box.querySelectorAll("[data-complete-mobile-diary]").forEach(function(button){
    button.onclick=function(){setDiaryItemDone(button.dataset.completeMobileDiary,true)}
   })
  }catch(error){console.warn("Denník z mobilu sa nepodarilo vykresliť.",error)}
 }
 function renderMobileDiaryPage(){
  try{
   var box=document.getElementById("mobileDiaryPageList");
   if(!box)return;
   var search=String(document.getElementById("mobileDiarySearch")?.value||"").trim().toLowerCase(),
       status=document.getElementById("mobileDiaryStatusFilter")?.value||"active",
       rows=diaryRows().filter(function(item){
        var done=isDone(item);
        if(status==="active"&&done)return false;
        if(status==="done"&&!done)return false;
        if(!search)return true;
        return [item.title,item.text,item.place,item.object,item.priority,item.status,item.author,item.createdBy].some(function(value){
         return String(value||"").toLowerCase().includes(search)
        })
       }).sort(function(a,b){
        return String(b.updatedAt||b.createdAt||"").localeCompare(String(a.updatedAt||a.createdAt||""))
       }),
       count=document.getElementById("mobileDiaryPageCount");
   if(count)count.textContent=rows.length+" "+(rows.length===1?"záznam":rows.length>1&&rows.length<5?"záznamy":"záznamov");
   box.innerHTML=rows.map(function(item){
    var done=isDone(item),
        priority=item.priority||"Stredná",
        place=item.place||item.object||"Bez určeného miesta",
        author=item.author||item.createdBy||"Mobilný zápis",
        created=diaryDate(item.updatedAt||item.createdAt),
        due=item.dueDate||"Bez termínu";
    var photoCount=Array.isArray(item.photos)?item.photos.length:0;
    return '<article class="mobile-diary-page-item '+(done?"is-done":"")+'"><div class="mobile-diary-page-state '+(done?"done":"active")+'">'+(done?"✓":"•")+'</div><div class="mobile-diary-page-body"><div class="mobile-diary-page-title"><div><strong>'+e(item.title||"Zápis z mobilu")+'</strong><small>'+e(author)+" · "+e(created)+'</small></div><span class="task-status '+priorityClass(priority)+'">'+e(priority)+"</span></div>"+(item.text?'<p>'+e(item.text)+"</p>":"")+'<div class="mobile-diary-page-meta"><span>⌖ '+e(place)+'</span><span>Termín: '+e(due)+'</span><span>'+(done?"Dokončené":"Aktívne")+'</span>'+(photoCount?'<span>Fotografie: '+photoCount+'</span>':"")+'</div></div><div class="mobile-diary-page-actions"><button class="ghost" type="button" data-edit-mobile-diary="'+e(item.id)+'">Upraviť</button><button class="ghost mobile-diary-page-toggle" type="button" data-toggle-mobile-diary="'+e(item.id)+'" data-done="'+(done?"1":"0")+'">'+(done?"Obnoviť":"Označiť hotové")+"</button></div></article>"
   }).join("")||'<div class="mobile-diary-page-empty"><strong>Žiadne záznamy</strong><span>Po synchronizácii sa tu zobrazia zápisy z mobilu pre aktívnu stavbu.</span></div>';
   box.querySelectorAll("[data-toggle-mobile-diary]").forEach(function(button){
    button.onclick=function(){setDiaryItemDone(button.dataset.toggleMobileDiary,button.dataset.done!=="1")}
   });
   box.querySelectorAll("[data-edit-mobile-diary]").forEach(function(button){button.onclick=function(){openDiaryEditor(button.dataset.editMobileDiary)}})
  }catch(error){console.warn("Stránku denníka z mobilu sa nepodarilo vykresliť.",error)}
 }
 function bindPage(){
  var search=document.getElementById("mobileDiarySearch"),
      status=document.getElementById("mobileDiaryStatusFilter"),
      refresh=document.getElementById("mobileDiaryPageRefresh"),
      add=document.getElementById("addMobileDiaryEntry"),
      form=document.getElementById("mobileDiaryForm"),
      photos=document.getElementById("mobileDiaryPhotos");
  if(search&&!search.dataset.diaryBound){search.dataset.diaryBound="1";search.oninput=renderMobileDiaryPage}
  if(status&&!status.dataset.diaryBound){status.dataset.diaryBound="1";status.onchange=renderMobileDiaryPage}
  if(refresh&&!refresh.dataset.diaryBound){refresh.dataset.diaryBound="1";refresh.onclick=refreshMobileDiary}
  if(add&&!add.dataset.diaryBound){add.dataset.diaryBound="1";add.onclick=function(){openDiaryEditor("")}}
  if(form&&!form.dataset.diaryBound){form.dataset.diaryBound="1";form.onsubmit=saveDiaryEditor}
  if(photos&&!photos.dataset.diaryBound){photos.dataset.diaryBound="1";photos.onchange=addDiaryEditorPhotos}
 }
 function hook(){
  bindPage();
  if(typeof renderDashboard==="function"&&!renderDashboard.__mobileDiaryPatched){
   var original=renderDashboard;
   renderDashboard=function(){original.apply(this,arguments);renderMobileDiaryDashboard()};
   renderDashboard.__mobileDiaryPatched=true
  }
  renderMobileDiaryDashboard();
  renderMobileDiaryPage()
 }
 document.addEventListener("DOMContentLoaded",function(){setTimeout(hook,300);setTimeout(hook,1200)});
 window.addEventListener("hashchange",function(){setTimeout(function(){renderMobileDiaryDashboard();renderMobileDiaryPage()},100)});
 window.renderMobileDiaryDashboard=renderMobileDiaryDashboard;
 window.renderMobileDiaryPage=renderMobileDiaryPage;
 window.__BETPRES_MOBILE_DIARY_TEST__={render:renderMobileDiaryPage,renderDashboard:renderMobileDiaryDashboard,setDone:setDiaryItemDone,isDone:isDone,open:openDiaryEditor,save:saveDiaryEditor}
})();
