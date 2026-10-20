(function(){
  "use strict";

  const byId=id=>document.getElementById(id);
  const modal=byId("mobileWorkerDayModal");
  const list=byId("mobileWorkerDayList");
  if(!modal||!list)return;

  let selectedDay=1;
  let changeSession=false;

  function activeMonth(){return byId("workerMonth")?.value||selectedWorkerMonth||todayMonthValue()}
  function activeSheet(){
    const month=activeMonth(),sheet=workerSheet(month,true);
    syncBetpresWorkerRow(month,sheet);sortWorkerRows(sheet);return sheet
  }
  function dayLimit(){return daysInMonth(activeMonth())}
  function clampDay(day){return Math.max(1,Math.min(dayLimit(),Number(day)||1))}
  function dayDate(day=selectedDay){
    const [year,month]=activeMonth().split("-").map(Number);return new Date(year,month-1,clampDay(day))
  }
  function dateValue(day=selectedDay){return dateKey(dayDate(day))}
  function longDate(day=selectedDay){return new Intl.DateTimeFormat("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(dayDate(day))}
  function ensureChangeSession(){if(changeSession)return;beginDirectUndo("Mobilné zadanie stavu pracovníkov");changeSession=true}
  function dayTotal(sheet=activeSheet()){return sheet.rows.reduce((sum,row)=>sum+(Number(row.values?.[selectedDay])||0),0)}

  function updateSummary(sheet){
    const total=dayTotal(sheet),totalNode=byId("mobileWorkerDayTotal"),filledNode=byId("mobileWorkerDayFilled");
    if(totalNode)totalNode.textContent=String(total);
    if(filledNode){
      const editable=sheet.rows.filter(row=>!isBetpresWorkerRow(row));
      const filled=editable.filter(row=>Number(row.values?.[selectedDay])>0).length;
      filledNode.textContent=`${filled} z ${editable.length} firiem vyplnených`
    }
    const pageTotal=document.querySelector(`[data-worker-total-day="${selectedDay}"]`);
    if(pageTotal)pageTotal.textContent=formatWorkHoursCell(total)
  }

  function renderDay(){
    const month=activeMonth(),sheet=activeSheet(),date=dayDate(),holiday=slovakHoliday(date),weekend=[0,6].includes(date.getDay()),today=dateKey(date)===todayISO();
    selectedDay=clampDay(selectedDay);
    byId("mobileWorkerDayTitle").textContent=longDate();
    const note=byId("mobileWorkerDayNote");
    if(note)note.textContent=holiday||`${today?"Dnes · ":""}${weekend?"Víkend":"Pracovný deň"}`;
    const dateInput=byId("mobileWorkerDate");
    dateInput.min=`${month}-01`;dateInput.max=`${month}-${String(dayLimit()).padStart(2,"0")}`;dateInput.value=dateValue();
    byId("mobileWorkerPrevDay").disabled=selectedDay<=1;
    byId("mobileWorkerNextDay").disabled=selectedDay>=dayLimit();
    modal.classList.toggle("mobile-worker-weekend",weekend);
    modal.classList.toggle("mobile-worker-holiday",Boolean(holiday));

    list.innerHTML=sheet.rows.map(row=>{
      const automatic=isBetpresWorkerRow(row),value=Math.max(0,Number(row.values?.[selectedDay])||0),custom=workerRowCustomLabel(row);
      return `<article class="mobile-worker-card ${automatic?"is-automatic":""} ${value>0?"has-value":""}" data-mobile-worker-card="${esc(row.id)}">
       <div class="mobile-worker-company">
        <strong>${esc(workerRowMainLabel(row))}</strong>
        ${custom?`<small>${esc(custom)}</small>`:""}
        ${automatic?`<span>Automaticky z podsmenoviek</span>`:""}
       </div>
       ${automatic
        ?`<output class="mobile-worker-auto-value" aria-label="BETPRES pracovníci">${value}</output>`
        :`<div class="mobile-worker-stepper">
          <button type="button" class="mobile-worker-minus" data-mobile-worker-step="-1" data-mobile-worker-row="${esc(row.id)}" aria-label="Odobrať jedného pracovníka">−</button>
          <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" enterkeyhint="next" value="${value}" data-mobile-worker-count="${esc(row.id)}" aria-label="Počet pracovníkov firmy ${esc(workerRowMainLabel(row))}">
          <button type="button" class="mobile-worker-plus" data-mobile-worker-step="1" data-mobile-worker-row="${esc(row.id)}" aria-label="Pridať jedného pracovníka">+</button>
         </div>`}
      </article>`
    }).join("")||`<div class="mobile-worker-empty">V tomto mesiaci ešte nie sú pridané žiadne firmy.</div>`;
    updateSummary(sheet)
  }

  function setCount(rowId,rawValue,{focus=false}={}){
    const sheet=activeSheet(),row=sheet.rows.find(item=>item.id===rowId);
    if(!row||isBetpresWorkerRow(row))return;
    const value=Math.max(0,Math.min(999,Number(String(rawValue).replace(/\D/g,""))||0));
    ensureChangeSession();row.values=row.values||{};row.values[selectedDay]=value;commitDirectState();
    const input=list.querySelector(`[data-mobile-worker-count="${CSS.escape(rowId)}"]`),card=input?.closest(".mobile-worker-card");
    if(input&&input.value!==String(value))input.value=String(value);
    card?.classList.toggle("has-value",value>0);
    if(input){input.classList.remove("did-change");void input.offsetWidth;input.classList.add("did-change");setTimeout(()=>input.classList.remove("did-change"),260);if(focus){input.focus({preventScroll:true});input.select()}}
    const tableInput=document.querySelector(`[data-worker-row="${CSS.escape(rowId)}"][data-worker-day="${selectedDay}"]`);
    if(tableInput)tableInput.value=String(value);
    updateSummary(sheet);
    if(dateValue()===todayISO())renderDashboard()
  }

  function openDay(day){
    const month=activeMonth(),today=todayISO();
    selectedDay=clampDay(day||(today.slice(0,7)===month?Number(today.slice(8,10)):1));
    changeSession=false;renderDay();modal.classList.remove("hidden");
    setTimeout(()=>list.querySelector("[data-mobile-worker-count]")?.focus({preventScroll:true}),260)
  }

  function finishSession(){
    if(changeSession){endDirectUndo();changeSession=false}
    if(typeof renderWorkers==="function"&&selectedWorkerMode==="companies")renderWorkers();
    if(typeof renderDashboard==="function")renderDashboard()
  }

  byId("openMobileWorkerDay").addEventListener("click",()=>openDay());
  byId("mobileWorkerPrevDay").addEventListener("click",()=>{selectedDay=clampDay(selectedDay-1);renderDay()});
  byId("mobileWorkerNextDay").addEventListener("click",()=>{selectedDay=clampDay(selectedDay+1);renderDay()});
  byId("mobileWorkerDate").addEventListener("change",event=>{selectedDay=clampDay(Number(event.target.value.slice(8,10)));renderDay()});
  byId("mobileWorkerDone").addEventListener("click",()=>modal.classList.add("hidden"));
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-mobile-worker-step]");if(!button)return;
    const input=list.querySelector(`[data-mobile-worker-count="${CSS.escape(button.dataset.mobileWorkerRow)}"]`),current=Number(input?.value)||0;
    setCount(button.dataset.mobileWorkerRow,current+Number(button.dataset.mobileWorkerStep))
  });
  list.addEventListener("focusin",event=>{if(event.target.matches("[data-mobile-worker-count]"))event.target.select()});
  list.addEventListener("input",event=>{
    const input=event.target.closest("[data-mobile-worker-count]");if(!input)return;
    const clean=input.value.replace(/\D/g,"").slice(0,3);if(input.value!==clean)input.value=clean;
    setCount(input.dataset.mobileWorkerCount,clean)
  });
  document.addEventListener("click",event=>{
    const dayButton=event.target.closest("[data-worker-open-day]");if(dayButton)openDay(Number(dayButton.dataset.workerOpenDay))
  });
  new MutationObserver(()=>{if(modal.classList.contains("hidden"))finishSession()}).observe(modal,{attributes:true,attributeFilter:["class"]});

  window.openMobileWorkerDay=openDay;
  window.__BETPRES_MOBILE_WORKERS_READY__=true
})();
