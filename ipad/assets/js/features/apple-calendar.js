(function(){
  "use strict";

  const grid=document.getElementById("calendarGrid"),prev=document.getElementById("calendarPrev"),next=document.getElementById("calendarNext");
  if(!grid||!prev||!next)return;
  const reduceMotion=matchMedia("(prefers-reduced-motion: reduce)");
  let gesture=null,pendingDirection=0,pendingVelocity=0,frame=0;

  function springToZero(from,velocity=0,complete){
    cancelAnimationFrame(frame);
    if(reduceMotion.matches){grid.style.removeProperty("transform");grid.style.removeProperty("opacity");complete?.();return}
    let value=from,speed=velocity,last=performance.now();
    const response=.34,damping=1,omega=Math.PI*2/response;
    const tick=now=>{
      const elapsed=Math.min(.04,Math.max(.001,(now-last)/1000));last=now;
      const steps=Math.max(1,Math.ceil(elapsed/(1/120))),dt=elapsed/steps;
      for(let index=0;index<steps;index++){const acceleration=-2*damping*omega*speed-(omega*omega)*value;speed+=acceleration*dt;value+=speed*dt}
      grid.style.transform=`translate3d(${value}px,0,0)`;
      grid.style.opacity=String(Math.max(.65,1-Math.abs(value)/240));
      if(Math.abs(value)<.08&&Math.abs(speed)<1){grid.style.removeProperty("transform");grid.style.removeProperty("opacity");complete?.();return}
      frame=requestAnimationFrame(tick)
    };
    frame=requestAnimationFrame(tick)
  }

  function prepare(direction,velocity=0){pendingDirection=direction;pendingVelocity=velocity}
  prev.addEventListener("pointerdown",()=>prepare(-1),{passive:true});
  next.addEventListener("pointerdown",()=>prepare(1),{passive:true});
  prev.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" ")prepare(-1)});
  next.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" ")prepare(1)});

  new MutationObserver(()=>{
    if(!pendingDirection)return;
    const start=pendingDirection*22,direction=pendingDirection,velocity=pendingVelocity;
    pendingDirection=0;pendingVelocity=0;
    grid.style.transform=`translate3d(${start}px,0,0)`;grid.style.opacity=".72";
    springToZero(start,Math.max(-900,Math.min(900,-velocity*.18*direction)))
  }).observe(grid,{childList:true});

  grid.addEventListener("pointerdown",event=>{
    if(event.target.closest("button")||event.button>0)return;
    cancelAnimationFrame(frame);
    gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastTime:performance.now(),velocity:0,x:0,committed:false,cancelled:false};
    try{grid.setPointerCapture(event.pointerId)}catch(_error){}
  });
  grid.addEventListener("pointermove",event=>{
    if(!gesture||gesture.id!==event.pointerId||gesture.cancelled)return;
    const dx=event.clientX-gesture.startX,dy=event.clientY-gesture.startY;
    if(!gesture.committed){
      if(Math.abs(dx)<10&&Math.abs(dy)<10)return;
      if(Math.abs(dy)>Math.abs(dx)*1.15){gesture.cancelled=true;return}
      gesture.committed=true
    }
    event.preventDefault();
    const now=performance.now(),dt=Math.max(8,now-gesture.lastTime);
    gesture.velocity=(event.clientX-gesture.lastX)/dt*1000;gesture.lastX=event.clientX;gesture.lastTime=now;gesture.x=dx;
    grid.style.transform=`translate3d(${dx}px,0,0)`;grid.style.opacity=String(Math.max(.7,1-Math.abs(dx)/500))
  },{passive:false});
  function finish(event){
    if(!gesture||gesture.id!==event.pointerId)return;
    const current=gesture,projected=current.x+(current.velocity/1000)*.99/(1-.99),commit=current.committed&&Math.abs(projected)>72;
    gesture=null;
    if(!commit){springToZero(current.x,current.velocity);return}
    const direction=projected<0?1:-1;
    grid.style.removeProperty("transform");grid.style.removeProperty("opacity");prepare(direction,current.velocity);
    (direction>0?next:prev).click()
  }
  grid.addEventListener("pointerup",finish);grid.addEventListener("pointercancel",finish);grid.addEventListener("lostpointercapture",event=>{if(gesture&&gesture.id===event.pointerId)finish(event)});
  window.__BETPRES_APPLE_CALENDAR_READY__=true
})();
