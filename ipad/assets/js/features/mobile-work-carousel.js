(function(){
 "use strict";
 const root=document.getElementById("mobileWorkItems"),reduceMotion=matchMedia("(prefers-reduced-motion: reduce)"),phone=matchMedia("(max-width: 800px)");
 if(!root)return;
 let activeId="",enhancing=false,drag=null,animation=null;

 const cards=()=>[...root.querySelectorAll(".mobile-work-card")];
 const activeCard=()=>cards().find(card=>card.dataset.mobileWorkCard===activeId)||cards()[0]||null;
 const itemLabel=card=>{
  const code=card.querySelector(".mobile-work-card-code")?.textContent.trim()||"Položka";
  const description=card.querySelector('[data-mobile-work-field="description"]')?.value.trim()||"Bez popisu";
  return `${code} — ${description}`
 };
 const monthLabel=()=>{
  const value=document.getElementById("workStatementPeriod")?.value||"";
  if(!/^\d{4}-\d{2}$/.test(value))return"aktuálny mesiac";
  const [year,month]=value.split("-").map(Number);
  return new Intl.DateTimeFormat("sk-SK",{month:"long",year:"numeric"}).format(new Date(year,month-1,1))
 };
 function springX(element,from,to,velocity=0,complete){
  if(animation)cancelAnimationFrame(animation.frame);
  if(reduceMotion.matches){element.style.transform="";complete?.();return}
  const state={value:from,velocity,frame:0,last:performance.now()},response=.34,damping=1,omega=Math.PI*2/response;
  element.style.willChange="transform, opacity";
  const tick=now=>{
   const elapsed=Math.min(.05,Math.max(.001,(now-state.last)/1000)),steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;state.last=now;
   for(let index=0;index<steps;index++){const acceleration=-2*damping*omega*state.velocity-(omega*omega)*(state.value-to);state.velocity+=acceleration*dt;state.value+=state.velocity*dt}
   element.style.transform=`translate3d(${state.value}px,0,0)`;element.style.opacity=String(Math.max(.35,1-Math.abs(state.value)/(innerWidth*1.6)));
   if(Math.abs(state.value-to)<.25&&Math.abs(state.velocity)<3){element.style.transform="";element.style.opacity="";element.style.willChange="";animation=null;complete?.();return}
   state.frame=requestAnimationFrame(tick)
  };
  animation=state;state.frame=requestAnimationFrame(tick)
 }
 function paintActive(){
  const list=cards();if(!list.length)return;
  if(!list.some(card=>card.dataset.mobileWorkCard===activeId))activeId=list[0].dataset.mobileWorkCard;
  list.forEach(card=>{const active=card.dataset.mobileWorkCard===activeId;card.hidden=!active;card.classList.toggle("mobile-work-active",active);if(!active){card.style.transform="";card.style.opacity=""}});
  const index=list.findIndex(card=>card.dataset.mobileWorkCard===activeId),picker=root.querySelector("#mobileWorkPicker");
  root.querySelector("#mobileWorkPosition").textContent=`Položka ${index+1} z ${list.length}`;
  root.querySelector("#mobileWorkPrev").disabled=index<=0;root.querySelector("#mobileWorkNext").disabled=index>=list.length-1;
  if(picker)picker.value=activeId
 }
 function goTo(index,direction=0,velocity=0){
  const list=cards();if(!list.length)return;
  const next=Math.max(0,Math.min(list.length-1,index)),current=activeCard();if(list[next]===current)return springX(current,Number(current?.dataset.dragX||0),0,velocity);
  const target=list[next],sign=direction||Math.sign(next-list.indexOf(current))||1,width=Math.max(280,root.clientWidth);
  const reveal=()=>{activeId=target.dataset.mobileWorkCard;paintActive();const incoming=activeCard();springX(incoming,sign*42,0,velocity*.12);incoming.scrollIntoView({block:"nearest"});navigator.vibrate?.(7)};
  if(!current||reduceMotion.matches){reveal();return}
  springX(current,Number(current.dataset.dragX||0),-sign*width,velocity,reveal)
 }
 function shift(delta,velocity=0){const list=cards(),index=list.indexOf(activeCard()),next=index+delta;if(next<0||next>=list.length){const card=activeCard();springX(card,Number(card?.dataset.dragX||0),0,velocity);navigator.vibrate?.(4);return}goTo(next,delta,velocity)}
 function stepQuantity(button){
  const card=button.closest(".mobile-work-card"),input=card?.querySelector('[data-mobile-work-field="currentQty"], [data-mobile-work-field="contractQty"]');if(!input)return;
  const formula=typeof window.evalWorkFormula==="function"?window.evalWorkFormula(input.value):null,parsed=formula?.ok?formula.value:Number(String(input.value||0).replace(/\s/g,"").replace(",",".")),value=Math.max(0,(Number.isFinite(parsed)?parsed:0)+Number(button.dataset.mobileWorkQtyStep||0));
  input.value=String(Math.round((value+Number.EPSILON)*1000)/1000).replace(".",",");input.dispatchEvent(new Event("input",{bubbles:true}));input.focus({preventScroll:true});input.select();navigator.vibrate?.(6)
 }
 function enhance(){
  if(enhancing||!phone.matches)return;enhancing=true;
  try{
   const list=cards();if(!list.length)return;
   const previous=activeId;if(!list.some(card=>card.dataset.mobileWorkCard===activeId))activeId=list.find(card=>card.querySelector('[data-mobile-work-field="currentQty"]'))?.dataset.mobileWorkCard||list[0].dataset.mobileWorkCard;
   let nav=root.querySelector(".mobile-work-navigator");
   if(!nav){nav=document.createElement("section");nav.className="mobile-work-navigator";nav.innerHTML='<button type="button" id="mobileWorkPrev" aria-label="Predchádzajúca položka">‹</button><label><span id="mobileWorkPosition">Položka</span><select id="mobileWorkPicker" aria-label="Vybrať položku súpisu"></select><small>Potiahni kartu do strán alebo použi šípky</small></label><button type="button" id="mobileWorkNext" aria-label="Nasledujúca položka">›</button>';root.prepend(nav)}
   const picker=nav.querySelector("#mobileWorkPicker");picker.innerHTML=list.map(card=>`<option value="${card.dataset.mobileWorkCard}">${itemLabel(card).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]))}</option>`).join("");
   picker.onchange=()=>goTo(list.findIndex(card=>card.dataset.mobileWorkCard===picker.value),Math.sign(list.findIndex(card=>card.dataset.mobileWorkCard===picker.value)-list.findIndex(card=>card.dataset.mobileWorkCard===activeId)));
   nav.querySelector("#mobileWorkPrev").onclick=()=>shift(-1);nav.querySelector("#mobileWorkNext").onclick=()=>shift(1);
   const month=monthLabel(),orderMode=document.getElementById("workStatements")?.classList.contains("work-order-statement");
   list.forEach(card=>{
    const current=card.querySelector(".mobile-work-current"),input=current?.querySelector('[data-mobile-work-field="currentQty"], [data-mobile-work-field="contractQty"]');if(!current||!input)return;
    current.querySelector(".mobile-work-field>span").textContent=orderMode?"Množstvo":`Množstvo · ${month}`;
    current.querySelector(".mobile-work-current-total>span").textContent=orderMode?"Cena celkom":`Cena · ${month}`;
    if(!input.closest(".mobile-work-qty-stepper")){
     const stepper=document.createElement("div");stepper.className="mobile-work-qty-stepper";stepper.innerHTML='<button type="button" data-mobile-work-qty-step="-1" aria-label="Odobrať množstvo">−</button><span class="mobile-work-input-slot"></span><button type="button" class="mobile-work-qty-plus" data-mobile-work-qty-step="1" aria-label="Pridať množstvo">+</button>';
     input.replaceWith(stepper);stepper.querySelector(".mobile-work-input-slot").replaceWith(input);stepper.querySelectorAll("[data-mobile-work-qty-step]").forEach(button=>button.onclick=()=>stepQuantity(button));input.addEventListener("focus",()=>setTimeout(()=>input.select(),0))
    }
   });
   paintActive();if(previous&&previous!==activeId)activeCard()?.scrollIntoView({block:"start",behavior:"smooth"})
  }finally{enhancing=false}
 }
 root.addEventListener("pointerdown",event=>{
  const card=event.target.closest(".mobile-work-card.mobile-work-active");if(!card||event.target.closest("input,textarea,select,button,summary,details"))return;
  if(animation){cancelAnimationFrame(animation.frame);animation=null}
  drag={id:event.pointerId,card,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastTime:performance.now(),velocity:0,x:0,committed:false};card.dataset.dragX="0"
 });
 root.addEventListener("pointermove",event=>{
  if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  if(!drag.committed){if(Math.abs(dx)<10&&Math.abs(dy)<10)return;if(Math.abs(dy)>Math.abs(dx)*1.1){drag=null;return}drag.committed=true;try{drag.card.setPointerCapture(event.pointerId)}catch{}}
  event.preventDefault();const list=cards(),index=list.indexOf(drag.card),atEdge=(dx>0&&index===0)||(dx<0&&index===list.length-1),x=atEdge?(dx*root.clientWidth*.55)/(root.clientWidth+.55*Math.abs(dx)):dx,now=performance.now(),dt=Math.max(8,now-drag.lastTime);drag.velocity=(event.clientX-drag.lastX)/dt*1000;drag.lastX=event.clientX;drag.lastTime=now;drag.x=x;drag.card.dataset.dragX=String(x);drag.card.style.transform=`translate3d(${x}px,0,0)`;drag.card.style.opacity=String(Math.max(.55,1-Math.abs(x)/(root.clientWidth*1.5)))
 },{passive:false});
 const finish=event=>{if(!drag||drag.id!==event.pointerId)return;const state=drag;drag=null;if(!state.committed){state.card.style.transform="";state.card.style.opacity="";return}const projected=state.x+(state.velocity/1000)*.998/(1-.998),commit=Math.abs(state.x)>55||Math.abs(projected)>root.clientWidth*.42;if(commit)shift(projected<0?1:-1,state.velocity);else springX(state.card,state.x,0,state.velocity)};
 root.addEventListener("pointerup",finish);root.addEventListener("pointercancel",finish);
 new MutationObserver(()=>{if(!enhancing)queueMicrotask(enhance)}).observe(root,{childList:true});
 phone.addEventListener("change",()=>{if(phone.matches)enhance();else cards().forEach(card=>card.hidden=false)});enhance()
})();
