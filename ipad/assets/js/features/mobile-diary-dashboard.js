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
    return '<article class="mobile-diary-page-item '+(done?"is-done":"")+'"><div class="mobile-diary-page-state '+(done?"done":"active")+'">'+(done?"✓":"•")+'</div><div class="mobile-diary-page-body"><div class="mobile-diary-page-title"><div><strong>'+e(item.title||"Zápis z mobilu")+'</strong><small>'+e(author)+" · "+e(created)+'</small></div><span class="task-status '+priorityClass(priority)+'">'+e(priority)+"</span></div>"+(item.text?'<p>'+e(item.text)+"</p>":"")+'<div class="mobile-diary-page-meta"><span>⌖ '+e(place)+'</span><span>Termín: '+e(due)+'</span><span>'+(done?"Dokončené":"Aktívne")+'</span></div></div><button class="ghost mobile-diary-page-toggle" type="button" data-toggle-mobile-diary="'+e(item.id)+'" data-done="'+(done?"1":"0")+'">'+(done?"Obnoviť":"Označiť hotové")+"</button></article>"
   }).join("")||'<div class="mobile-diary-page-empty"><strong>Žiadne záznamy</strong><span>Po synchronizácii sa tu zobrazia zápisy z mobilu pre aktívnu stavbu.</span></div>';
   box.querySelectorAll("[data-toggle-mobile-diary]").forEach(function(button){
    button.onclick=function(){setDiaryItemDone(button.dataset.toggleMobileDiary,button.dataset.done!=="1")}
   })
  }catch(error){console.warn("Stránku denníka z mobilu sa nepodarilo vykresliť.",error)}
 }
 function bindPage(){
  var search=document.getElementById("mobileDiarySearch"),
      status=document.getElementById("mobileDiaryStatusFilter"),
      refresh=document.getElementById("mobileDiaryPageRefresh");
  if(search&&!search.dataset.diaryBound){search.dataset.diaryBound="1";search.oninput=renderMobileDiaryPage}
  if(status&&!status.dataset.diaryBound){status.dataset.diaryBound="1";status.onchange=renderMobileDiaryPage}
  if(refresh&&!refresh.dataset.diaryBound){refresh.dataset.diaryBound="1";refresh.onclick=refreshMobileDiary}
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
 window.__BETPRES_MOBILE_DIARY_TEST__={render:renderMobileDiaryPage,renderDashboard:renderMobileDiaryDashboard,setDone:setDiaryItemDone,isDone:isDone}
})();
