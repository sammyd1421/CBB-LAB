const CACHE_NAME="cbb-lab-shell-v30";
const APP_SHELL=[
  "/",
  "/index.html",
  "/style.css?v=20261112-team-profile-radars1",
  "/manifest.webmanifest",
  "/icons/cbb-lab.svg",
  "/similarity.js",
  "/ratings-engine.js?v=20261112-opponent-adjusted2",
  "/team-profiles.js?v=20261112-opponent-adjusted2",
  "/projections.js",
  "/app.js",
  "/cbbd-import.js",
  "/ratings-import.js",
  "/matchup-lab.js?v=20261112-team-profile-radars1",
  "/schedule.js",
  "/slate-scanner.js?v=20261112-shared-pace-engine1",
  "/similarity-backtest.js?v=20261112-adjusted-validation1",
  "/backtest.js"
];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("cbb-lab-shell-")&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request);
        const cache=await caches.open(CACHE_NAME);
        cache.put("/index.html",fresh.clone());
        return fresh;
      }catch(error){
        return (await caches.match(request))||(await caches.match("/index.html"));
      }
    })());
    return;
  }
  if(/\.(?:js|css|svg|webmanifest)$/.test(url.pathname)){
    event.respondWith((async()=>{
      const cached=await caches.match(request)||await caches.match(url.pathname,{ignoreSearch:true});
      const network=fetch(request).then(async response=>{
        if(response&&response.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,response.clone())}
        return response;
      }).catch(()=>null);
      return cached||await network||Response.error();
    })());
  }
});
