(function(){
 "use strict";
 const diary=document.getElementById("mobileDiary");
 const dateInput=document.getElementById("siteDiaryDate");
 const dayList=document.getElementById("siteDiaryDayList");
 const daybar=diary?.querySelector(".site-diary-daybar");
 if(!diary||!dateInput||!dayList||!daybar)return;

 const host=document.createElement("section");
 host.className="site-diary-missing-days";
 host.setAttribute("aria-label","Kontrola zápisov stavebného denníka");
 host.innerHTML=[
  '<div class="site-diary-missing-week-head"><span>Prehľad týždňa</span><small><i aria-hidden="true"></i> Červená = deň bez zápisu</small></div>',
  '<div class="site-diary-missing-week" id="siteDiaryMissingWeek"></div>',
  '<details class="site-diary-missing-month"><summary id="siteDiaryMissingMonthSummary">Zobraziť celý mesiac</summary>',
  '<div class="site-diary-missing-month-labels" aria-hidden="true"><span>Po</span><span>Ut</span><span>St</span><span>Št</span><span>Pi</span><span>So</span><span>Ne</span></div>',
  '<div class="site-diary-missing-month-grid" id="siteDiaryMissingMonthGrid"></div>',
  '</details>'
 ].join("");
 (diary.querySelector(".site-diary-copybar")||daybar).after(host);

 const get=id=>document.getElementById(id);
 const localDate=value=>{
  const match=String(value||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12):new Date()
 };
 const key=date=>String(date.getFullYear()).padStart(4,"0")+"-"+String(date.getMonth()+1).padStart(2,"0")+"-"+String(date.getDate()).padStart(2,"0");
 const move=(date,days)=>{const next=new Date(date);next.setDate(next.getDate()+days);return next};
 const monthName=date=>new Intl.DateTimeFormat("sk-SK",{month:"long",year:"numeric"}).format(date);
 const fullDate=date=>new Intl.DateTimeFormat("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(date);
 const writtenDates=()=>new Set((state.mobileDiary||[]).filter(item=>item?.kind==="siteLog"&&item.projectId===state.selectedProjectId&&item.date).map(item=>item.date));
 const startDate=()=>state.projects?.find(project=>project.id===state.selectedProjectId)?.startDate||"";
 const escape=value=>String(value).replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));

 function dayStatus(date,selected,today,recorded,start){
  const value=key(date);
  if(value<start)return "before";
  if(recorded.has(value))return "recorded";
  if(value<today)return "missing";
  if(value===today)return "today";
  return "future"
 }
 function dayButton(date,selected,today,recorded,start,compact=false){
  const value=key(date),status=dayStatus(date,selected,today,recorded,start);
  const labels={missing:"denník nezapísaný",recorded:"zápis denníka existuje",today:"dnes",future:"budúci deň",before:"pred začiatkom stavby"};
  const weekday=new Intl.DateTimeFormat("sk-SK",{weekday:"short"}).format(date).replace(".","");
  const label=fullDate(date)+", "+labels[status];
  return '<button type="button" class="site-diary-day-chip '+status+(value===selected?" selected":"")+'" data-site-diary-open-day="'+value+'" aria-label="'+escape(label)+'" aria-pressed="'+(value===selected)+'">'+
   (compact?'<span class="site-diary-chip-weekday">'+escape(weekday)+'</span>':"")+
   '<strong>'+date.getDate()+'</strong></button>'
 }
 function render(){
  const selected=/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)?dateInput.value:(typeof todayISO==="function"?todayISO():key(new Date()));
  const current=localDate(selected),today=typeof todayISO==="function"?todayISO():key(new Date()),recorded=writtenDates(),start=startDate();
  const weekStart=move(current,-((current.getDay()+6)%7));
  get("siteDiaryMissingWeek").innerHTML=Array.from({length:7},(_,index)=>dayButton(move(weekStart,index),selected,today,recorded,start,true)).join("");
  const first=new Date(current.getFullYear(),current.getMonth(),1,12),last=new Date(current.getFullYear(),current.getMonth()+1,0,12);
  const offset=(first.getDay()+6)%7,days=last.getDate();
  let missing=0;
  const cells=Array.from({length:offset},()=>'<span class="site-diary-month-gap" aria-hidden="true"></span>');
  for(let day=1;day<=days;day++){
   const value=new Date(current.getFullYear(),current.getMonth(),day,12);
   if(dayStatus(value,selected,today,recorded,start)==="missing")missing++;
   cells.push(dayButton(value,selected,today,recorded,start))
  }
  get("siteDiaryMissingMonthGrid").innerHTML=cells.join("");
  get("siteDiaryMissingMonthSummary").innerHTML='<span>'+escape(monthName(first))+'</span><strong class="'+(missing?"has-missing":"")+'">'+(missing?missing+" dní bez zápisu":"Všetky minulé dni zapísané")+'</strong>';
 }
 host.addEventListener("click",event=>{
  const button=event.target.closest("[data-site-diary-open-day]");
  if(!button)return;
  const selected=button.dataset.siteDiaryOpenDay;
  if(!selected||dateInput.value===selected)return;
  dateInput.value=selected;
  dateInput.dispatchEvent(new Event("change",{bubbles:true}));
  render()
 });
 dateInput.addEventListener("change",render);
 new MutationObserver(render).observe(dayList,{childList:true});
 window.renderSiteDiaryMissingDays=render;
 window.__BETPRES_DIARY_MISSING_DAYS_READY__=true;
 render()
})();
