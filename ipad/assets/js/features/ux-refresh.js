(function(){
  "use strict";

  const NAV_KEY="betpres:nav-compact";
  const body=document.body;
  const byId=id=>document.getElementById(id);

  function desktopNav(){return window.matchMedia("(min-width: 801px)").matches}

  function setCompactNav(compact,persist=true){
    const enabled=desktopNav()&&Boolean(compact);
    body.classList.toggle("nav-compact",enabled);
    const button=byId("sidebarCollapse");
    if(button){
      button.setAttribute("aria-expanded",String(!enabled));
      button.setAttribute("aria-label",enabled?"Rozšíriť bočné menu":"Zúžiť bočné menu");
      button.title=enabled?"Rozšíriť bočné menu":"Zúžiť bočné menu";
    }
    if(persist)try{localStorage.setItem(NAV_KEY,enabled?"1":"0")}catch(_error){}
  }

  function activeWorkspace(){
    if(byId("workStatements")?.classList.contains("active"))return "work";
    if(byId("workers")?.classList.contains("active"))return "workers";
    return "";
  }

  function updateFocusButtons(){
    const zen=body.classList.contains("ux-zen");
    [byId("toggleWorkFocus"),byId("toggleWorkersFocus")].forEach(button=>{
      if(!button)return;
      button.setAttribute("aria-pressed",String(zen));
      button.textContent=zen?"× Ukončiť pracovný režim":"⛶ Pracovný režim";
      button.title=zen?"Zobraziť späť menu a horný panel":"Skryť menu a zväčšiť pracovnú tabuľku";
    });
  }

  function setZen(next){
    if(next&&!activeWorkspace())return;
    body.classList.toggle("ux-zen",Boolean(next));
    updateFocusButtons();
    requestAnimationFrame(()=>window.dispatchEvent(new Event("resize")));
  }

  function updateScrollState(element){
    if(!element)return;
    const max=Math.max(0,element.scrollWidth-element.clientWidth);
    element.classList.toggle("is-scrolled-x",element.scrollLeft>3);
    element.classList.toggle("has-more-x",element.scrollLeft<max-3);
  }

  function enhanceScrollableTables(){
    document.querySelectorAll(".worker-table-wrap,.work-sheet-wrap,.table-wrap").forEach(element=>{
      if(element.dataset.uxScrollReady)return;
      element.dataset.uxScrollReady="1";
      const refresh=()=>updateScrollState(element);
      element.addEventListener("scroll",refresh,{passive:true});
      refresh();
    });
  }

  function labelWorkerContext(){
    const active=document.querySelector("[data-worker-mode].active strong")?.textContent?.trim();
    const heading=document.querySelector("#workers .page-title h1");
    if(heading)heading.textContent=active&&active!=="Firmy na stavbe"?active:"Stav pracovníkov";
  }

  function init(){
    let saved=false;
    try{saved=localStorage.getItem(NAV_KEY)==="1"}catch(_error){}
    setCompactNav(saved,false);
    byId("sidebarCollapse")?.addEventListener("click",()=>setCompactNav(!body.classList.contains("nav-compact")));
    byId("toggleWorkFocus")?.addEventListener("click",()=>setZen(!body.classList.contains("ux-zen")));
    byId("toggleWorkersFocus")?.addEventListener("click",()=>setZen(!body.classList.contains("ux-zen")));

    document.querySelectorAll(".nav-btn").forEach(button=>{
      const label=button.querySelector("span:last-child")?.textContent?.trim();
      if(label&&!button.title)button.title=label;
      button.addEventListener("click",()=>{
        if(body.classList.contains("ux-zen"))setZen(false);
      });
    });
    document.querySelectorAll("[data-worker-mode]").forEach(button=>button.addEventListener("click",()=>setTimeout(labelWorkerContext,0)));

    document.addEventListener("keydown",event=>{
      if(event.key==="Escape"&&body.classList.contains("ux-zen")){event.preventDefault();setZen(false)}
      if(String(event.key||"").toLowerCase()==="f"&&event.ctrlKey&&event.shiftKey&&activeWorkspace()){
        event.preventDefault();setZen(!body.classList.contains("ux-zen"));
      }
    });
    window.addEventListener("resize",()=>{
      if(!desktopNav())body.classList.remove("nav-compact");
      else {
        let preference=false;
        try{preference=localStorage.getItem(NAV_KEY)==="1"}catch(_error){}
        body.classList.toggle("nav-compact",preference);
      }
      enhanceScrollableTables();
    },{passive:true});

    const activeObserver=new MutationObserver(()=>{
      if(body.classList.contains("ux-zen")&&!activeWorkspace())setZen(false);
      enhanceScrollableTables();
    });
    document.querySelectorAll(".view").forEach(view=>activeObserver.observe(view,{attributes:true,attributeFilter:["class"]}));

    labelWorkerContext();
    updateFocusButtons();
    enhanceScrollableTables();
    document.documentElement.classList.add("ux-refresh-ready");
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
