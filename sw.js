const CACHE="betpres-sitedesk-mobile-1.0.12";
const CACHE_PREFIX="betpres-sitedesk-mobile-";
const SHELL=[
 "./",
 "./index.html",
 "./styles.css?v=1.0.12",
 "./app.js?v=1.0.12",
 "./manifest.webmanifest",
 "./assets/betpres-logo.png",
 "./assets/app-icon.png",
 "./assets/app-icon.svg",
 "./vendor/tesseract.min.js",
 "./vendor/worker.min.js",
 "./vendor/tesseract-core/tesseract-core-lstm.wasm.js",
 "./vendor/tesseract-core/tesseract-core-lstm.wasm",
 "./vendor/lang/slk.traineddata.gz"
];

self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))
});

self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  const oldKeys=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE);
  await Promise.all(oldKeys.map(key=>caches.delete(key)));
  await self.clients.claim();
  if(oldKeys.length){
   const windows=await self.clients.matchAll({type:"window"});
   await Promise.all(windows.map(client=>client.navigate(client.url).catch(()=>undefined)))
  }
 })())
});

self.addEventListener("message",event=>{
 if(event.data?.type==="SKIP_WAITING")self.skipWaiting()
});

self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(event.request);
   if(response.ok)await cache.put(event.request,response.clone());
   return response
  }catch{
   const cached=await cache.match(event.request,{ignoreSearch:true});
   if(cached)return cached;
   if(event.request.mode==="navigate")return cache.match("./index.html");
   return Response.error()
  }
 })())
});

