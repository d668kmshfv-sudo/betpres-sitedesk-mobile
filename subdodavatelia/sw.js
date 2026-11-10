const CACHE="betpres-subcontract-portal-1.0.1";
const SHELL=[
 "./","index.html","styles.css?v=1.0.1","app.js?v=1.0.1",
 "print-preview.html","print.css?v=1.0.1","print.js?v=1.0.1",
 "manifest.webmanifest","assets/app-icon.png","assets/navigation-logo.png",
 "assets/betpres-letterhead-2026.jpg","assets/pdfjs/pdf.mjs","assets/pdfjs/pdf.worker.mjs"
];
const SCOPE_PATH=new URL(self.registration.scope).pathname;
self.addEventListener("install",event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())
));
self.addEventListener("activate",event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(keys
  .filter(key=>key.startsWith("betpres-subcontract-portal-")&&key!==CACHE)
  .map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(SCOPE_PATH))return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request);
   if(response.ok&&response.type==="basic"){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{}));
   }
   return response;
  }catch{
   const cached=await caches.match(request);
   if(cached)return cached;
   if(request.mode==="navigate")return await caches.match(new URL("index.html",self.registration.scope))||new Response("Offline page unavailable",{status:503});
   return new Response("Offline asset unavailable",{status:503,statusText:"Offline asset unavailable"});
  }
 })());
});
