// BETPRES SiteDesk – spoločný denník úloh pre počítač a mobil
(function(){
 "use strict";
 function e(v){return String(v??"").replace(/[&<>"']/g,function(s){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]})}
 function isDone(item){return Boolean(item?.completed||item?.completedAt)||/splnen|hotov|vybaven/i.test(String(item?.status||""))}
 function ensure(){
  var grid=document.querySelector('.site-dashboard-grid');
  if(!grid||document.getElementById('dashboardMobileDiaryList'))return;
  var card=document.createElement('article');
  card.className='panel site-focus-card';
  card.innerHTML='<div class="panel-head"><div><p class="eyebrow">SPOLOČNÉ ÚLOHY</p><h2>Denník z mobilu</h2><small id="mobileDiaryActiveCount">Aktívne zápisy zo stavby</small></div><button class="link-btn" type="button" id="mobileDiaryRefreshBtn">Načítať z cloudu</button></div><div id="dashboardMobileDiaryList" class="site-task-list"></div>';
  grid.insertBefore(card,grid.firstChild);
  var btn=document.getElementById('mobileDiaryRefreshBtn');
  if(btn)btn.onclick=refreshMobileDiary
 }
 async function refreshMobileDiary(){
  var btn=document.getElementById('mobileDiaryRefreshBtn');
  try{
   if(btn){btn.disabled=true;btn.textContent='Načítavam…'}
   if(typeof cloudPull==='function'&&typeof cloudConfigured==='function'&&cloudConfigured()){
    if(typeof cloudLocalDirty!=='undefined'&&cloudLocalDirty)toast('Najprv počkaj na uloženie lokálnych zmien do cloudu.');
    else await cloudPull({silent:true})
   }
  }catch(error){console.warn('Denník sa nepodarilo obnoviť.',error)}finally{
   if(btn){btn.disabled=false;btn.textContent='Načítať z cloudu'}
   renderMobileDiaryDashboard()
  }
 }
 function completeDiaryItem(id){
  if(typeof state==='undefined'||!Array.isArray(state.mobileDiary))return;
  var item=state.mobileDiary.find(function(row){return row.id===id});if(!item||isDone(item))return;
  var now=new Date().toISOString();item.completed=true;item.completedAt=now;item.updatedAt=now;item.status='Splnené';
  if(typeof save==='function')save('Úloha z mobilného denníka bola dokončená.');
  renderMobileDiaryDashboard()
 }
 function renderMobileDiaryDashboard(){
  try{
   ensure();var box=document.getElementById('dashboardMobileDiaryList');if(!box||typeof state==='undefined')return;
   if(!Array.isArray(state.mobileDiary))state.mobileDiary=[];
   var pid=state.selectedProjectId;
   var all=state.mobileDiary.filter(function(x){return(!pid||x.projectId===pid)&&!isDone(x)}).sort(function(a,b){return String(b.createdAt||'').localeCompare(String(a.createdAt||''))});
   var items=all.slice(0,8),count=document.getElementById('mobileDiaryActiveCount');if(count)count.textContent=all.length?all.length+' aktívnych zápisov · odkliknuté zmiznú':'Bez aktívnych zápisov';
   box.innerHTML=items.length?items.map(function(x){var pri=x.priority||'Stredná',cls=pri==='Vysoká'?'danger':(pri==='Nízka'?'ok':'warn'),place=x.place||x.object||'Bez určeného miesta',due=x.dueDate||'Bez termínu';return '<article class="site-task-item mobile-diary-item"><button class="mobile-diary-complete" type="button" data-complete-mobile-diary="'+e(x.id)+'" title="Označiť ako hotové" aria-label="Označiť úlohu ako hotovú">✓</button><div class="mobile-diary-content"><strong class="mobile-diary-title">'+e(x.title||'Zápis z mobilu')+'</strong>'+(x.text?'<p class="mobile-diary-text">'+e(x.text)+'</p>':'')+'<div class="mobile-diary-meta"><span title="Miesto alebo objekt">⌖ '+e(place)+'</span><span title="Termín">Termín: '+e(due)+'</span></div></div><span class="task-status '+cls+'">'+e(pri)+'</span></article>'}).join(''):'<div class="empty-state">Všetko je hotové. Nový zápis z mobilu sa po synchronizácii zobrazí tu.</div>';
   box.querySelectorAll('[data-complete-mobile-diary]').forEach(function(button){button.onclick=function(){completeDiaryItem(button.dataset.completeMobileDiary)}})
  }catch(err){console.warn('Denník z mobilu sa nepodarilo vykresliť.',err)}
 }
 function hook(){if(typeof renderDashboard==='function'&&!renderDashboard.__mobileDiaryPatched){var o=renderDashboard;renderDashboard=function(){o.apply(this,arguments);renderMobileDiaryDashboard()};renderDashboard.__mobileDiaryPatched=true}renderMobileDiaryDashboard()}
 document.addEventListener('DOMContentLoaded',function(){setTimeout(hook,700);setTimeout(hook,1800)});window.addEventListener('hashchange',function(){setTimeout(renderMobileDiaryDashboard,200)});
 window.renderMobileDiaryDashboard=renderMobileDiaryDashboard;
 window.__BETPRES_MOBILE_DIARY_TEST__={render:renderMobileDiaryDashboard,complete:completeDiaryItem,isDone:isDone};
})();
