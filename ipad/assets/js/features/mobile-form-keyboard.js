(function(){
 "use strict";
 const phone=matchMedia("(max-width: 800px) and (pointer: coarse)"),selectors=["#calendarEventModal","#mobileDiaryModal"],timers=new WeakMap();
 const textField=element=>element?.matches?.('textarea,input:not([type="hidden"]):not([type="date"]):not([type="time"]):not([type="color"]):not([type="file"]):not([type="checkbox"]):not([type="radio"])');
 function reveal(modal,field){
  if(!modal||!field||!modal.contains(field))return;const card=modal.querySelector(":scope > .modal-card"),label=field.closest("label")||field;if(!card)return;
  const cardRect=card.getBoundingClientRect(),fieldRect=label.getBoundingClientRect(),viewportBottom=Math.min(cardRect.bottom,(visualViewport?.height||innerHeight)+(visualViewport?.offsetTop||0))-18,visibleTop=cardRect.top+16;
  let delta=0;if(fieldRect.top<visibleTop)delta=fieldRect.top-visibleTop;else if(fieldRect.bottom>viewportBottom)delta=fieldRect.bottom-viewportBottom;
  if(Math.abs(delta)>1)card.scrollBy({top:delta,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"})
 }
 function sync(modal){
  const field=modal.contains(document.activeElement)&&textField(document.activeElement)?document.activeElement:null,active=Boolean(phone.matches&&field&&!modal.classList.contains("hidden"));
  modal.classList.toggle("mobile-form-keyboard-open",active);(timers.get(modal)||[]).forEach(clearTimeout);const next=[];timers.set(modal,next);
  if(active)[0,90,280].forEach(delay=>next.push(setTimeout(()=>reveal(modal,field),delay)))
 }
 function bind(modal){
  if(!modal||modal.dataset.mobileKeyboardReady)return;modal.dataset.mobileKeyboardReady="1";
  modal.addEventListener("focusin",event=>{if(textField(event.target)){event.target.classList.add("mobile-form-active-field");sync(modal)}});
  modal.addEventListener("focusout",event=>{event.target.classList.remove("mobile-form-active-field");setTimeout(()=>sync(modal),70)});
  new MutationObserver(()=>{if(modal.classList.contains("hidden"))modal.classList.remove("mobile-form-keyboard-open")}).observe(modal,{attributes:true,attributeFilter:["class"]});
  visualViewport?.addEventListener("resize",()=>{if(modal.classList.contains("mobile-form-keyboard-open"))sync(modal)},{passive:true});visualViewport?.addEventListener("scroll",()=>{if(modal.classList.contains("mobile-form-keyboard-open"))sync(modal)},{passive:true})
 }
 selectors.forEach(selector=>bind(document.querySelector(selector)));window.__BETPRES_MOBILE_FORM_KEYBOARD_READY__=true
})();
