/* Import CBBD adjusted team ratings and historical lines into browser IndexedDB. */
(() => {
  const button=document.getElementById("importRatingsLines");
  if(!button)return;
  const status=document.getElementById("ratingsProgress");
  const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open("cbb-lab-db",2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("games"))d.createObjectStore("games",{keyPath:"id"});if(!d.objectStoreNames.contains("ratings"))d.createObjectStore("ratings",{keyPath:"id"});if(!d.objectStoreNames.contains("lines"))d.createObjectStore("lines",{keyPath:"gameId"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const date=d=>d.toISOString().slice(0,10),add=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x};
  async function request(resource,params){const q=new URLSearchParams({resource,...params});const r=await fetch("/api/cbbd?"+q.toString());if(!r.ok){let msg="HTTP "+r.status;try{msg=(await r.json()).error||msg}catch{}throw Error(msg)}const x=await r.json();if(!Array.isArray(x))throw Error("Unexpected "+resource+" response");return x}
  async function put(storeName,rows,key){const db=await openDB();await new Promise((ok,no)=>{const tx=db.transaction(storeName,"readwrite"),s=tx.objectStore(storeName);rows.forEach(x=>s.put(x));tx.oncomplete=ok;tx.onerror=()=>no(tx.error)});db.close()}
  button.addEventListener("click",async()=>{if(button.disabled)return;if(!confirm("Import adjusted ratings for 2022–2027 and available regular-season betting lines for 2022–2026? This uses approximately 35–45 additional API calls. Keep this page open."))return;button.disabled=true;button.textContent="Importing…";let calls=0,ratingsN=0,linesN=0;
    try{
      const allRatings=[];
      for(let s=2022;s<=2027;s++){status.textContent="Loading adjusted ratings · season "+s;const rows=await request("ratings/adjusted",{season:String(s)});allRatings.push(...rows.map(r=>({...r,id:String(r.season)+"|"+r.team})));calls++;}
      await put("ratings",allRatings);ratingsN=allRatings.length;
      for(let s=2022;s<=2026;s++){
        let cursor=new Date(Date.UTC(s-1,10,1)),endSeason=new Date(Date.UTC(s,3,30));
        while(cursor<=endSeason){const end=new Date(Math.min(add(cursor,27).getTime(),endSeason.getTime()));status.textContent="Loading market lines · season "+s+" · "+date(cursor)+" to "+date(end)+" · "+calls+" calls";
          const rows=await request("lines",{season:String(s),startDateRange:date(cursor)+"T00:00:00Z",endDateRange:date(end)+"T23:59:59Z"});
          await put("lines",rows.map(g=>({gameId:String(g.gameId),...g})));linesN+=rows.length;calls++;cursor=add(end,1);
        }
      }
      status.textContent="Complete · "+ratingsN.toLocaleString()+" team-season ratings · "+linesN.toLocaleString()+" game-line records · "+calls+" API calls. Refreshing…";
      button.textContent="Import complete";setTimeout(()=>location.reload(),800);
    }catch(e){status.textContent="Paused after "+calls+" API calls. "+e.message+" Completed records are saved; retry is safe.";button.disabled=false;button.textContent="Resume / retry ratings + lines";}
  });
})();