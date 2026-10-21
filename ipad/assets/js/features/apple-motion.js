(function(){
  "use strict";

  const root=document.documentElement;
  const body=document.body;
  const reduceMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
  const phone=window.matchMedia("(max-width: 800px)");
  const springStore=new WeakMap();
  let lastTrigger=null;

  function syncVisualViewport(){
    const height=window.visualViewport?.height||window.innerHeight;
    root.style.setProperty("--apple-visual-height",`${Math.round(height)}px`)
  }

  function channelsFor(element){
    let channels=springStore.get(element);
    if(!channels){channels=new Map();springStore.set(element,channels)}
    return channels
  }

  function spring(element,name,options){
    if(!element)return null;
    const channels=channelsFor(element);
    let state=channels.get(name);
    if(!state){
      state={value:Number(options.from??0),velocity:Number(options.velocity??0),target:Number(options.to??0),running:false,frame:0,last:0,token:0,update:options.update,complete:options.complete};
      channels.set(name,state)
    }else{
      if(options.from!==undefined&&!state.running)state.value=Number(options.from);
      if(options.velocity!==undefined)state.velocity=Number(options.velocity);
      state.target=Number(options.to);
      state.update=options.update||state.update;
      state.complete=options.complete
    }
    state.response=Math.max(.08,Number(options.response||.36));
    state.damping=Math.max(.1,Number(options.damping??1));
    state.update?.(state.value);
    if(reduceMotion.matches){
      state.value=state.target;state.velocity=0;state.running=false;state.update?.(state.value);state.complete?.();return state
    }
    if(state.running)return state;
    state.running=true;state.last=performance.now();const token=++state.token;
    const tick=now=>{
      if(!state.running||token!==state.token)return;
      let elapsed=Math.min(.05,Math.max(.001,(now-state.last)/1000));state.last=now;
      const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
      for(let index=0;index<steps;index++){
        const omega=(Math.PI*2)/state.response;
        const acceleration=-2*state.damping*omega*state.velocity-(omega*omega)*(state.value-state.target);
        state.velocity+=acceleration*dt;
        state.value+=state.velocity*dt
      }
      state.update?.(state.value);
      if(Math.abs(state.value-state.target)<.001&&Math.abs(state.velocity)<.01){
        state.value=state.target;state.velocity=0;state.running=false;state.update?.(state.value);const complete=state.complete;state.complete=null;complete?.();return
      }
      state.frame=requestAnimationFrame(tick)
    };
    state.frame=requestAnimationFrame(tick);
    return state
  }

  function stopSpring(element,name){
    const state=springStore.get(element)?.get(name);if(!state)return null;
    state.running=false;state.token++;cancelAnimationFrame(state.frame);return state
  }

  function springValue(element,name,to,{from,velocity,response=.36,damping=1,update,complete}={}){
    return spring(element,name,{to,from,velocity,response,damping,update,complete})
  }

  function pressTarget(button,target,response,damping){
    springValue(button,"press-scale",target,{
      from:Number(button.dataset.appleScale||1),response,damping,
      update:value=>{button.dataset.appleScale=String(value);button.style.scale=String(value)},
      complete:()=>{if(target===1){button.style.removeProperty("scale");button.dataset.appleScale="1"}}
    })
  }

  function preparePressTarget(button){
    if(!button||button.dataset.applePressReady||button.closest(".pdf-page,.paper"))return;
    button.dataset.applePressReady="1";
    let pointerId=null;
    button.addEventListener("pointerdown",event=>{
      if(button.disabled||event.button>0)return;
      pointerId=event.pointerId;
      lastTrigger={x:event.clientX,y:event.clientY,element:button};
      try{button.setPointerCapture(pointerId)}catch(_error){}
      pressTarget(button,.968,.16,1)
    });
    button.addEventListener("pointermove",event=>{
      if(event.pointerId!==pointerId)return;
      const rect=button.getBoundingClientRect(),inside=event.clientX>=rect.left-10&&event.clientX<=rect.right+10&&event.clientY>=rect.top-10&&event.clientY<=rect.bottom+10;
      pressTarget(button,inside ? .968 : 1,.16,1)
    });
    const release=event=>{
      if(pointerId!==null&&event.pointerId!==undefined&&event.pointerId!==pointerId)return;
      pointerId=null;pressTarget(button,1,.30,.82)
    };
    button.addEventListener("pointerup",release);button.addEventListener("pointercancel",release);button.addEventListener("lostpointercapture",release);
    button.addEventListener("keydown",event=>{if((event.key===" "||event.key==="Enter")&&!button.disabled)pressTarget(button,.968,.14,1)});
    button.addEventListener("keyup",event=>{if(event.key===" "||event.key==="Enter")pressTarget(button,1,.28,.85)})
  }

  function enhancePressTargets(scope=document){
    if(scope.matches?.("button,.file-btn"))preparePressTarget(scope);
    scope.querySelectorAll?.("button,.file-btn").forEach(preparePressTarget)
  }

  function animateView(view){
    if(!view||!view.classList.contains("active"))return;
    if(reduceMotion.matches){
      view.animate([{opacity:.72},{opacity:1}],{duration:130,easing:"ease-out"});return
    }
    stopSpring(view,"view-y");stopSpring(view,"view-opacity");
    view.style.translate="0 12px";view.style.opacity=".35";view.style.willChange="translate, opacity";
    springValue(view,"view-y",0,{from:12,response:.38,damping:1,update:value=>view.style.translate=`0 ${value}px`,complete:()=>{view.style.removeProperty("translate");view.style.removeProperty("will-change")}});
    springValue(view,"view-opacity",1,{from:.35,response:.28,damping:1,update:value=>view.style.opacity=String(Math.max(0,Math.min(1,value))),complete:()=>view.style.removeProperty("opacity")})
  }

  function setModalOrigin(card){
    if(!lastTrigger||phone.matches){card.style.transformOrigin=phone.matches?"50% 100%":"50% 50%";return}
    const rect=card.getBoundingClientRect();
    const x=Math.max(0,Math.min(rect.width,lastTrigger.x-rect.left));
    const y=Math.max(0,Math.min(rect.height,lastTrigger.y-rect.top));
    card.style.transformOrigin=`${x}px ${y}px`
  }

  function animateModalOpen(modal){
    const card=modal.querySelector(":scope > .modal-card");if(!card)return;
    modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");setModalOrigin(card);
    const distance=phone.matches?46:16;
    stopSpring(modal,"modal-opacity");stopSpring(card,"modal-y");stopSpring(card,"modal-scale");
    modal.style.opacity="0";card.style.translate=`0 ${distance}px`;card.style.scale=phone.matches?"1":".965";
    springValue(modal,"modal-opacity",1,{from:0,response:.28,damping:1,update:value=>modal.style.opacity=String(Math.max(0,Math.min(1,value))),complete:()=>modal.style.removeProperty("opacity")});
    springValue(card,"modal-y",0,{from:distance,response:phone.matches?.36:.32,damping:1,update:value=>card.style.translate=`0 ${value}px`,complete:()=>card.style.removeProperty("translate")});
    springValue(card,"modal-scale",1,{from:phone.matches?1:.965,response:.34,damping:1,update:value=>card.style.scale=String(value),complete:()=>card.style.removeProperty("scale")})
  }

  function animateModalClose(modal,complete){
    const card=modal.querySelector(":scope > .modal-card");if(!card){complete();return}
    const distance=phone.matches?38:13;
    let remaining=2;const done=()=>{remaining--;if(remaining<=0)complete()};
    springValue(modal,"modal-opacity",0,{from:Number.parseFloat(getComputedStyle(modal).opacity)||1,response:.22,damping:1,update:value=>modal.style.opacity=String(Math.max(0,Math.min(1,value))),complete:done});
    springValue(card,"modal-y",distance,{from:0,response:.26,damping:1,update:value=>card.style.translate=`0 ${value}px`,complete:done});
    springValue(card,"modal-scale",phone.matches?1:.978,{from:1,response:.24,damping:1,update:value=>card.style.scale=String(value)})
  }

  function prepareModal(modal){
    if(modal.dataset.appleModalReady)return;
    modal.dataset.appleModalReady="1";
    const state={phase:modal.classList.contains("hidden")?"closed":"open",internal:false};
    const observer=new MutationObserver(()=>{
      if(state.internal){state.internal=false;return}
      const hidden=modal.classList.contains("hidden");
      if(!hidden&&state.phase!=="open"){
        state.phase="open";animateModalOpen(modal);return
      }
      if(hidden&&state.phase==="open"){
        state.internal=true;modal.classList.remove("hidden");state.phase="closing";
        animateModalClose(modal,()=>{
          state.internal=true;state.phase="closed";modal.classList.add("hidden");
          modal.style.removeProperty("opacity");
          const card=modal.querySelector(":scope > .modal-card");card?.style.removeProperty("translate");card?.style.removeProperty("scale")
        })
      }
    });
    observer.observe(modal,{attributes:true,attributeFilter:["class"]})
  }

  function setupSidebar(){
    const sidebar=document.getElementById("sidebar");if(!sidebar)return;
    const scrim=document.createElement("div");scrim.className="apple-sidebar-scrim";scrim.setAttribute("aria-hidden","true");
    const edge=document.createElement("div");edge.className="apple-edge-handle";edge.setAttribute("aria-hidden","true");
    body.append(scrim,edge);
    let drag=null,classGuard=false;

    const closedX=()=>-sidebar.getBoundingClientRect().width-18;
    const sidebarState=()=>springStore.get(sidebar)?.get("sidebar-x");
    const paint=x=>{
      sidebar.style.transform=`translate3d(${x}px,0,0)`;
      const closed=closedX(),progress=Math.max(0,Math.min(1,(x-closed)/(0-closed)));
      scrim.style.opacity=String(progress);
      scrim.classList.toggle("is-visible",progress>.025)
    };
    const currentX=()=>sidebarState()?.value??(sidebar.classList.contains("open")?0:closedX());
    const moveTo=(open,velocity=0)=>{
      if(!phone.matches)return;
      const target=open?0:closedX();
      springValue(sidebar,"sidebar-x",target,{from:currentX(),velocity,response:.34,damping:open ? .86 : 1,update:paint,complete:()=>{if(!open)scrim.classList.remove("is-visible")}})
    };
    const setOpen=open=>{
      classGuard=true;sidebar.classList.toggle("open",open);queueMicrotask(()=>classGuard=false);moveTo(open)
    };
    const syncMode=()=>{
      if(phone.matches){root.classList.add("apple-motion-ready");stopSpring(sidebar,"sidebar-x");const value=sidebar.classList.contains("open")?0:closedX();const state=sidebarState();if(state){state.value=value;state.velocity=0}paint(value)}
      else{root.classList.remove("apple-motion-ready");stopSpring(sidebar,"sidebar-x");sidebar.style.removeProperty("transform");scrim.style.removeProperty("opacity");scrim.classList.remove("is-visible");sidebar.classList.remove("open")}
    };
    new MutationObserver(()=>{if(phone.matches&&!classGuard)moveTo(sidebar.classList.contains("open"))}).observe(sidebar,{attributes:true,attributeFilter:["class"]});
    scrim.addEventListener("click",()=>setOpen(false));

    const startDrag=event=>{
      if(!phone.matches||event.pointerType==="mouse"&&event.button!==0)return;
      stopSpring(sidebar,"sidebar-x");
      drag={id:event.pointerId,startClientX:event.clientX,startClientY:event.clientY,startValue:currentX(),lastX:event.clientX,lastTime:performance.now(),velocity:0,committed:false,cancelled:false}
    };
    edge.addEventListener("pointerdown",event=>{if(!sidebar.classList.contains("open"))startDrag(event)});
    sidebar.addEventListener("pointerdown",event=>{if(sidebar.classList.contains("open"))startDrag(event)});
    window.addEventListener("pointermove",event=>{
      if(!drag||drag.id!==event.pointerId||drag.cancelled)return;
      const dx=event.clientX-drag.startClientX,dy=event.clientY-drag.startClientY;
      if(!drag.committed){
        if(Math.abs(dx)<9&&Math.abs(dy)<9)return;
        if(Math.abs(dy)>Math.abs(dx)*1.15){drag.cancelled=true;return}
        drag.committed=true
      }
      event.preventDefault();
      const lower=closedX(),upper=0,raw=drag.startValue+dx;
      let value=raw;
      if(raw<lower){const over=raw-lower;value=lower+(over*innerWidth*.55)/(innerWidth+.55*Math.abs(over))}
      if(raw>upper){const over=raw-upper;value=upper+(over*innerWidth*.55)/(innerWidth+.55*Math.abs(over))}
      const now=performance.now(),dt=Math.max(8,now-drag.lastTime);drag.velocity=(event.clientX-drag.lastX)/dt*1000;drag.lastX=event.clientX;drag.lastTime=now;
      const state=sidebarState();if(state){state.value=value;state.velocity=drag.velocity}else springValue(sidebar,"sidebar-x",value,{from:value,update:paint});paint(value)
    },{passive:false});
    const finishDrag=event=>{
      if(!drag||drag.id!==event.pointerId)return;
      if(drag.committed){
        event.preventDefault();
        const projected=currentX()+(drag.velocity/1000)*.998/(1-.998);
        const open=projected>closedX()*.52;
        classGuard=true;sidebar.classList.toggle("open",open);queueMicrotask(()=>classGuard=false);moveTo(open,drag.velocity)
      }else moveTo(sidebar.classList.contains("open"));
      drag=null
    };
    window.addEventListener("pointerup",finishDrag,{passive:false});window.addEventListener("pointercancel",finishDrag,{passive:false});
    phone.addEventListener("change",syncMode);window.addEventListener("resize",()=>{if(phone.matches&&!drag)moveTo(sidebar.classList.contains("open"))},{passive:true});
    syncMode()
  }

  function init(){
    syncVisualViewport();
    window.visualViewport?.addEventListener("resize",syncVisualViewport,{passive:true});
    window.visualViewport?.addEventListener("scroll",syncVisualViewport,{passive:true});
    window.addEventListener("orientationchange",syncVisualViewport,{passive:true});
    enhancePressTargets();
    document.querySelectorAll(".modal").forEach(prepareModal);
    document.querySelectorAll(".view").forEach(view=>{
      new MutationObserver(()=>{if(view.classList.contains("active"))animateView(view)}).observe(view,{attributes:true,attributeFilter:["class"]})
    });
    const additions=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>{if(node.nodeType===1){enhancePressTargets(node);if(node.matches?.(".modal"))prepareModal(node);node.querySelectorAll?.(".modal").forEach(prepareModal)}})));
    additions.observe(body,{childList:true,subtree:true});
    setupSidebar();
    root.classList.add("apple-design-ready")
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init()
})();
