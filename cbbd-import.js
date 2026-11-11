/* CBB LAB historical CBBD importer. Runs in the user's browser; API key stays server-side. */
(() => {
  const button = document.getElementById("importCbbd");
  if (!button) return;
  const status = document.getElementById("cbbdProgress");
  const D1 = new Set([
    "A-10","ACC","Am. East","America East","American","American Athletic","AAC","ASUN","Atlantic Sun","Atlantic 10","Big 12","Big East","Big Sky",
    "Big South","Big Ten","Big West","CAA","Colonial","CUSA","Conference USA","Horizon","Horizon League","Ivy","MAAC","Metro","Metro Atlantic","MAC","Mid-American",
    "MEAC","MVC","Missouri Valley","Mountain West","NEC","Northeast","OVC","Ohio Valley","Pac-12","Patriot","SEC","SoCon","Southern","WCC","West Coast",
    "Southland","Summit","Sun Belt","SWAC","UAC","United Athletic","WAC"
  ]);
  const dbOpen = () => new Promise((resolve,reject) => {
    const req = indexedDB.open("cbb-lab-db",2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("games")) req.result.createObjectStore("games",{keyPath:"id"});
      if (!req.result.objectStoreNames.contains("ratings")) req.result.createObjectStore("ratings",{keyPath:"id"});
      if (!req.result.objectStoreNames.contains("lines")) req.result.createObjectStore("lines",{keyPath:"gameId"});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const date = d => d.toISOString().slice(0,10);
  const isoStart = d => date(d)+"T00:00:00Z";
  const isoEnd = d => date(d)+"T23:59:59Z";
  const addDays = (d,n) => { const x=new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; };
  const num = x => Number.isFinite(Number(x)) ? Number(x) : null;
  const metric = (row,key) => {
    const s=row.teamStats||{}, f=s.fourFactors||{};
    if(key==="pace") return num(row.pace);
    if(key==="efg") return num(f.effectiveFieldGoalPct);
    if(key==="tov") return num(f.turnoverRatio);
    if(key==="orb") return num(f.offensiveReboundPct);
    if(key==="ftr") return num(f.freeThrowRate);
    if(key==="threePct") { const x=s.threePointFieldGoals||{}; const made=num(x.made),att=num(x.attempted); return made!==null&&att>0?made/att*100:null; }\n    if(key==="twoPct") { const f=s.fieldGoals||{},t=s.threePointFieldGoals||{}; const made=num(f.made),att=num(f.attempted),tm=num(t.made),ta=num(t.attempted); return made!==null&&att!==null&&ta!==null&&att>ta?(made-tm)/(att-ta)*100:null; }\n    if(key==="threeRate") {
      const att=num(s.threePointFieldGoals?.attempted), fga=num(s.fieldGoals?.attempted);
      return att!==null&&fga>0?att/fga*100:null;
    }
    return null;
  };
  const saveBatch = async rows => {
    const db=await dbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("games","readwrite"), store=tx.objectStore("games");
      rows.forEach(g=>store.put(g));
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
    db.close();
  };
  const fetchWindow = async (season,start,end) => {
    const qs=new URLSearchParams({
      resource:"games/teams",season:String(season),seasonType:"regular",
      startDateRange:isoStart(start),endDateRange:isoEnd(end)
    });
    const response=await fetch("/api/cbbd?"+qs.toString(),{headers:{Accept:"application/json"}});
    if(!response.ok) {
      let message="HTTP "+response.status;
      try { const e=await response.json(); message=e.error||message; } catch {}
      throw new Error(message);
    }
    const rows=await response.json();
    if(!Array.isArray(rows)) throw new Error("Unexpected response from basketball data provider.");
    if(rows.length>=3000) {
      if((end-start)/86400000<2) throw new Error("A two-day data window still reached the provider's 3,000-row cap.");
      const mid=addDays(start,Math.floor((end-start)/172800000));
      const left=await fetchWindow(season,start,mid);
      const right=await fetchWindow(season,addDays(mid,1),end);
      return left.concat(right);
    }
    return rows;
  };
  const assemble = (rows,season) => {
    const grouped=new Map();
    rows.forEach(r=>{
      if(!r || !r.gameId || !r.conference || !D1.has(r.conference)) return;
      const x=grouped.get(String(r.gameId))||{id:"cbbd-"+r.gameId,source:"CBBD",sourceGameId:String(r.gameId),season:String(season),gameDate:r.startDate||"",neutralSite:!!r.neutralSite};
      const stats=r.teamStats||{};
      const opp=r.opponentStats||{};
      const team={
        name:r.team,score:num(stats.points?.total),pace:num(r.pace),
        efg:metric(r,"efg"),tov:metric(r,"tov"),orb:metric(r,"orb"),
        ftr:metric(r,"ftr"),threeRate:metric(r,"threeRate"),threePct:metric(r,"threePct"),twoPct:metric(r,"twoPct")
      };
      if(r.isHome) {
        x.homeTeam=r.team; x.homeScore=team.score; x.home_pace=team.pace;
        x.home_efg=team.efg; x.home_tov=team.tov; x.home_orb=team.orb;
        x.home_ftr=team.ftr; x.home_threeRate=team.threeRate; x.home_threePct=team.threePct; x.home_twoPct=team.twoPct;
        x.awayScore=num(opp.points?.total);
      } else {
        x.awayTeam=r.team; x.awayScore=team.score; x.away_pace=team.pace;
        x.away_efg=team.efg; x.away_tov=team.tov; x.away_orb=team.orb;
        x.away_ftr=team.ftr; x.away_threeRate=team.threeRate; x.away_threePct=team.threePct; x.away_twoPct=team.twoPct;
        x.homeScore=num(opp.points?.total);
      }
      grouped.set(String(r.gameId),x);
    });
    return [...grouped.values()].filter(g=>g.homeTeam&&g.awayTeam&&g.homeScore!==null&&g.awayScore!==null);
  };
  button.addEventListener("click",async()=>{
    if(button.disabled) return;
    if(!confirm("Import CBBD regular-season team game data for seasons 2022–2027? This may use roughly 80–100 API calls from your shared monthly quota. Keep this page open while it runs.")) return;
    button.disabled=true; button.textContent="Importing…";
    let imported=0,windows=0;
    try {
      const all=[];
      for(let season=2022;season<=2027;season++) {
        const start=new Date(Date.UTC(season-1,10,1));
        const seasonEnd=season===2027?new Date(Date.UTC(2026,10,10)):new Date(Date.UTC(season,3,30));
        let cursor=start;
        while(cursor<=seasonEnd) {
          const end=new Date(Math.min(addDays(cursor,13).getTime(),seasonEnd.getTime()));
          status.textContent="Season "+season+" · "+date(cursor)+" to "+date(end)+" · "+windows+" windows completed";
          const raw=await fetchWindow(season,cursor,end);
          const games=assemble(raw,season);
          if(games.length) { await saveBatch(games); imported+=games.length; }
          windows++;
          cursor=addDays(end,1);
        }
      }
      const db=await dbOpen();
      const count=await new Promise((resolve,reject)=>{const req=db.transaction("games","readonly").objectStore("games").count();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
      db.close();
      status.textContent="Import complete · "+count.toLocaleString()+" unique games stored · "+windows+" date windows checked. Refreshing the analytics workspace…";
      button.textContent="Import complete";
      setTimeout(()=>location.reload(),900);
    } catch(error) {
      status.textContent="Import paused after "+windows+" windows and "+imported.toLocaleString()+" new/updated games: "+error.message+". Your completed windows are saved; you can retry safely.";
      button.disabled=false; button.textContent="Resume / retry CBBD import";
    }
  });
})();