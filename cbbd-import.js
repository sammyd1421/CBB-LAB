/* CBB LAB resumable historical CBBD importer. Runs in-browser; API key stays server-side. */
(() => {
  const button = document.getElementById("importCbbd");
  if (!button) return;
  const status = document.getElementById("cbbdProgress");
  const PROGRESS_KEY = "cbb-lab-cbbd-import-v2";
  const FIRST_SEASON = 2023; // CBBD season year: 2023 = 2022-23
  const LAST_SEASON = 2027;  // 2027 = 2026-27 (through today's date)
  const D1 = new Set([
    "A-10","ACC","Am. East","America East","American","American Athletic","AAC","ASUN","Atlantic Sun",
    "Big 12","Big East","Big Sky","Big South","Big Ten","Big West","CAA","CUSA","Conference USA",
    "Horizon","Horizon League","Ivy","MAAC","Metro Atlantic","MAC","Mid-American","MEAC","MVC",
    "Missouri Valley","Mountain West","NEC","Northeast","OVC","Ohio Valley","Pac-12","Patriot",
    "SEC","SoCon","Southern","WCC","West Coast","Southland","Summit","Sun Belt","SWAC","UAC",
    "United Athletic","WAC"
  ]);
  const isD1 = value => {
    const c=String(value||"").trim().replace(/\s+conference$/i,"").replace(/\s+league$/i,"");
    return D1.has(c);
  };
  const dbOpen = () => new Promise((resolve,reject) => {
    const req=indexedDB.open("cbb-lab-db",2);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains("games"))req.result.createObjectStore("games",{keyPath:"id"});
      if(!req.result.objectStoreNames.contains("ratings"))req.result.createObjectStore("ratings",{keyPath:"id"});
      if(!req.result.objectStoreNames.contains("lines"))req.result.createObjectStore("lines",{keyPath:"gameId"});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const date=d=>d.toISOString().slice(0,10);
  const isoStart=d=>date(d)+"T00:00:00Z";
  const isoEnd=d=>date(d)+"T23:59:59Z";
  const addDays=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x;};
  const num=x=>Number.isFinite(Number(x))?Number(x):null;
  const metric=(row,key)=>{
    const s=row.teamStats||{},f=s.fourFactors||{};
    if(key==="pace")return num(row.pace);
    if(key==="efg")return num(f.effectiveFieldGoalPct);
    if(key==="tov")return num(f.turnoverRatio);
    if(key==="orb")return num(f.offensiveReboundPct);
    if(key==="ftr")return num(f.freeThrowRate);
    if(key==="threePct"){const x=s.threePointFieldGoals||{},m=num(x.made),a=num(x.attempted);return m!==null&&a>0?m/a*100:null;}
    if(key==="twoPct"){const f=s.fieldGoals||{},t=s.threePointFieldGoals||{},m=num(f.made),a=num(f.attempted),tm=num(t.made),ta=num(t.attempted);return m!==null&&a!==null&&ta!==null&&a>ta?(m-tm)/(a-ta)*100:null;}
    if(key==="threeRate"){const a=num(s.threePointFieldGoals?.attempted),fga=num(s.fieldGoals?.attempted);return a!==null&&fga>0?a/fga*100:null;}
    return null;
  };
  const saveBatch=async rows=>{
    if(!rows.length)return;
    const db=await dbOpen();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("games","readwrite"),store=tx.objectStore("games");
      rows.forEach(g=>store.put(g));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
  };
  const fetchWindow=async(season,start,end)=>{
    const qs=new URLSearchParams({resource:"games/teams",season:String(season),seasonType:"regular",startDateRange:isoStart(start),endDateRange:isoEnd(end)});
    const response=await fetch("/api/cbbd?"+qs.toString(),{headers:{Accept:"application/json"}});
    if(!response.ok){let message="HTTP "+response.status;try{const e=await response.json();message=e.error||message;}catch{}throw new Error("Season "+season+" ("+(season-1)+"-"+String(season).slice(-2)+"): "+message);}
    const rows=await response.json();
    if(!Array.isArray(rows))throw new Error("Unexpected provider response for season "+season+".");
    if(rows.length>=3000){
      if((end-start)/86400000<2)throw new Error("Provider's 3,000-row cap reached in a two-day window.");
      const mid=addDays(start,Math.floor((end-start)/172800000));
      return (await fetchWindow(season,start,mid)).concat(await fetchWindow(season,addDays(mid,1),end));
    }
    return rows;
  };
  const assemble=(rows,season)=>{
    const grouped=new Map();
    rows.forEach(r=>{
      if(!r||!r.gameId||!isD1(r.conference))return;
      const x=grouped.get(String(r.gameId))||{id:"cbbd-"+r.gameId,source:"CBBD",sourceGameId:String(r.gameId),season:String(season),gameDate:r.startDate||"",neutralSite:!!r.neutralSite};
      const stats=r.teamStats||{},opp=r.opponentStats||{};
      const team={score:num(stats.points?.total),pace:num(r.pace),efg:metric(r,"efg"),tov:metric(r,"tov"),orb:metric(r,"orb"),ftr:metric(r,"ftr"),threeRate:metric(r,"threeRate"),threePct:metric(r,"threePct"),twoPct:metric(r,"twoPct")};
      if(r.isHome){x.homeTeam=r.team;x.homeScore=team.score;x.home_pace=team.pace;x.home_efg=team.efg;x.home_tov=team.tov;x.home_orb=team.orb;x.home_ftr=team.ftr;x.home_threeRate=team.threeRate;x.home_threePct=team.threePct;x.home_twoPct=team.twoPct;x.awayScore=num(opp.points?.total);}
      else{x.awayTeam=r.team;x.awayScore=team.score;x.away_pace=team.pace;x.away_efg=team.efg;x.away_tov=team.tov;x.away_orb=team.orb;x.away_ftr=team.ftr;x.away_threeRate=team.threeRate;x.away_threePct=team.threePct;x.away_twoPct=team.twoPct;x.homeScore=num(opp.points?.total);}
      grouped.set(String(r.gameId),x);
    });
    return [...grouped.values()].filter(g=>g.homeTeam&&g.awayTeam&&g.homeScore!==null&&g.awayScore!==null);
  };
  const readProgress=()=>{try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}");}catch{return {};}};
  const writeProgress=p=>localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));
  const countBySeason=async()=>{
    const db=await dbOpen(),rows=await new Promise((resolve,reject)=>{const q=db.transaction("games","readonly").objectStore("games").getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});
    db.close();const counts={};rows.forEach(g=>counts[g.season]=(counts[g.season]||0)+1);return {total:rows.length,counts};
  };
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    if(!confirm("Import men's Division I regular-season games for CBBD seasons 2023–2027 (2022-23 through 2026-27 to date)? Completed date windows are saved and skipped on retry. This may use roughly 50–70 API calls from your shared monthly quota. Keep this page open."))return;
    button.disabled=true;button.textContent="Importing…";
    const progress=readProgress();let windows=0,added=0;
    try{
      for(let season=FIRST_SEASON;season<=LAST_SEASON;season++){
        const start=new Date(Date.UTC(season-1,10,1));
        const now=new Date();
        const localToday=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));\n        const seasonEnd=season===LAST_SEASON?localToday:new Date(Date.UTC(season,3,30));
        let cursor=start;
        while(cursor<=seasonEnd){
          const end=new Date(Math.min(addDays(cursor,13).getTime(),seasonEnd.getTime()));
          const key=season+":"+date(cursor)+":"+date(end);
          if(progress[key]){cursor=addDays(end,1);continue;}
          status.textContent="Importing "+(season-1)+"–"+String(season).slice(-2)+" · "+date(cursor)+" to "+date(end)+" · "+windows+" new windows this run";
          const raw=await fetchWindow(season,cursor,end);
          const games=assemble(raw,season);
          await saveBatch(games);
          progress[key]=true;writeProgress(progress);
          added+=games.length;windows++;
          cursor=addDays(end,1);
        }
        const coverage=await countBySeason();
        status.textContent="Finished "+(season-1)+"–"+String(season).slice(-2)+": "+(coverage.counts[String(season)]||0).toLocaleString()+" games stored. Overall: "+coverage.total.toLocaleString()+".";
      }
      const coverage=await countBySeason();
      const summary=Array.from({length:LAST_SEASON-FIRST_SEASON+1},(_,i)=>{const s=String(FIRST_SEASON+i);return (Number(s)-1)+"–"+s.slice(-2)+": "+(coverage.counts[s]||0).toLocaleString();}).join(" · ");
      status.textContent="Import complete · "+coverage.total.toLocaleString()+" total games · "+summary+". Refreshing workspace…";
      button.textContent="Import complete";
      setTimeout(()=>location.reload(),1300);
    }catch(error){
      const coverage=await countBySeason().catch(()=>({total:0,counts:{}}));
      status.textContent="Import paused safely after "+windows+" new windows ("+added.toLocaleString()+" games this run). Stored: "+coverage.total.toLocaleString()+". "+error.message+" Completed windows are saved; tap Resume / retry later.";
      button.disabled=false;button.textContent="Resume / retry import";
    }
  });
})();
