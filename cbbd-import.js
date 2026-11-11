/* CBBD importer: parses documented GameBoxScoreTeam rows and persists idempotently in IndexedDB. */
(() => {
  const button=document.getElementById("importCbbd"); if(!button)return;
  const status=document.getElementById("cbbdProgress");
  const PROGRESS_KEY="cbb-lab-cbbd-import-v3";
  const FIRST_SEASON=2022, LAST_SEASON=2027;
  const D1=new Set([
    "a10","atlantic10","acc","atlanticcoast","atlanticcoastconference",
    "americaeast","ameast","americanathletic","american","aac",
    "asun","atlanticsun","big12","big12conference","bigeast","bigsky","bigsouth",
    "bigten","big10","bigwest","colonial","caa","conferenceusa","cusa",
    "horizon","horizonleague","ivy","maac","metroatlantic","mac","midamerican",
    "meac","missourivalley","mvc","mountainwest","mw","northeast","nec",
    "ohiovalley","ovc","pac12","pac10","patriot","sec","southeastern",
    "southeasternconference","socon","southern","wcc","westcoast",
    "southland","summit","sunbelt","swac","uac","unitedathletic","wac",
    "westernathletic","westernathleticconference"
  ]);
  const norm=s=>String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"").replace(/(conference|league)$/,"");
  const isD1=s=>D1.has(norm(s));
  const num=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
  const dbOpen=()=>new Promise((resolve,reject)=>{
    const r=indexedDB.open("cbb-lab-db",2);
    r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("games"))d.createObjectStore("games",{keyPath:"id"});if(!d.objectStoreNames.contains("ratings"))d.createObjectStore("ratings",{keyPath:"id"});if(!d.objectStoreNames.contains("lines"))d.createObjectStore("lines",{keyPath:"gameId"});};
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  const date=d=>d.toISOString().slice(0,10);
  const isoStart=d=>date(d)+"T00:00:00Z",isoEnd=d=>date(d)+"T23:59:59Z";
  const addDays=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x;};
  const metric=(stats,key)=>{
    const f=stats?.fourFactors||{};
    if(key==="efg")return num(f.effectiveFieldGoalPct);
    if(key==="tov")return num(f.turnoverRatio);
    if(key==="orb")return num(f.offensiveReboundPct);
    if(key==="ftr")return num(f.freeThrowRate);
    if(key==="threePct")return num(stats?.threePointFieldGoals?.pct) ?? (()=>{const x=stats?.threePointFieldGoals||{};return num(x.made)!==null&&num(x.attempted)>0?num(x.made)/num(x.attempted)*100:null;})();
    if(key==="twoPct")return num(stats?.twoPointFieldGoals?.pct) ?? (()=>{const x=stats?.twoPointFieldGoals||{};return num(x.made)!==null&&num(x.attempted)>0?num(x.made)/num(x.attempted)*100:null;})();
    if(key==="threeRate"){const a=num(stats?.threePointFieldGoals?.attempted),fga=num(stats?.fieldGoals?.attempted);return a!==null&&fga>0?a/fga*100:null;}
    return null;
  };
  const saveBatch=async rows=>{
    if(!rows.length)return;
    const db=await dbOpen();
    await new Promise((resolve,reject)=>{const tx=db.transaction("games","readwrite"),s=tx.objectStore("games");rows.forEach(g=>s.put(g));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
    db.close();
  };
  const fetchWindow=async(season,start,end)=>{
    const q=new URLSearchParams({resource:"games/teams",season:String(season),seasonType:"regular",startDateRange:isoStart(start),endDateRange:isoEnd(end)});
    const response=await fetch("/api/cbbd?"+q.toString(),{headers:{Accept:"application/json"}});
    if(!response.ok){let detail="HTTP "+response.status;try{const e=await response.json();detail=e.error||e.message||detail;}catch{}throw Error("CBBD request failed ("+detail+"). Check the server API key and quota.");}
    const rows=await response.json();
    if(!Array.isArray(rows))throw Error("CBBD returned a non-array response; import stopped without marking this window complete.");
    if(rows.length>=3000){
      if((end-start)/86400000<1)throw Error("CBBD's 3,000-row response cap was reached in a one-day window.");
      const mid=addDays(start,Math.floor((end-start)/172800000));
      return (await fetchWindow(season,start,mid)).concat(await fetchWindow(season,addDays(mid,1),end));
    }
    return rows;
  };
  // CBBD /games/teams returns one GameBoxScoreTeam record per team, with
  // gameId, team/opponent, isHome, teamStats and opponentStats.
  const assemble=(rows,season)=>{
    const games=new Map();
    rows.forEach(r=>{
      if(!r||r.gameId===null||r.gameId===undefined||!isD1(r.conference))return;
      const own=r.teamStats||{},opp=r.opponentStats||{};
      const ownScore=num(own.points?.total),oppScore=num(opp.points?.total);
      if(ownScore===null||oppScore===null||!r.team||!r.opponent)return;
      const home=!!r.isHome, homeTeam=home?r.team:r.opponent, awayTeam=home?r.opponent:r.team;
      const homeStats=home?own:opp,awayStats=home?opp:own;
      const stats=(s,prefix)=>({
        [prefix+"pace"]:num(r.pace),
        [prefix+"efg"]:metric(s,"efg"),[prefix+"tov"]:metric(s,"tov"),
        [prefix+"orb"]:metric(s,"orb"),[prefix+"ftr"]:metric(s,"ftr"),
        [prefix+"threeRate"]:metric(s,"threeRate"),[prefix+"threePct"]:metric(s,"threePct"),
        [prefix+"twoPct"]:metric(s,"twoPct")
      });
      const game={
        id:"cbbd-"+r.gameId,source:"CBBD",sourceGameId:String(r.gameId),season:String(season),
        gameDate:r.startDate||"",neutralSite:!!r.neutralSite,homeTeam,awayTeam,
        homeScore:home?ownScore:oppScore,awayScore:home?oppScore:ownScore,
        ...stats(homeStats,"home_"),...stats(awayStats,"away_")
      };
      // Preserve a previously stored record if a later row is less complete.
      const old=games.get(game.id);
      if(!old||Object.keys(game).filter(k=>game[k]!==null&&game[k]!==undefined&&game[k]!=="").length>
        Object.keys(old).filter(k=>old[k]!==null&&old[k]!==undefined&&old[k]!=="").length)games.set(game.id,game);
    });
    return [...games.values()];
  };
  const readProgress=()=>{try{return JSON.parse(localStorage.getItem(PROGRESS_KEY)||"{}");}catch{return {};}};
  const writeProgress=p=>localStorage.setItem(PROGRESS_KEY,JSON.stringify(p));
  const countBySeason=async()=>{
    const db=await dbOpen(),rows=await new Promise((resolve,reject)=>{const q=db.transaction("games","readonly").objectStore("games").getAll();q.onsuccess=()=>resolve(q.result||[]);q.onerror=()=>reject(q.error);});
    db.close();const counts={};rows.forEach(g=>counts[String(g.season)]=(counts[String(g.season)]||0)+1);return {total:rows.length,counts};
  };
  button.addEventListener("click",async()=>{
    if(button.disabled)return;
    if(!confirm("Import men's Division I regular-season games for 2022–23 through 2026–27 to date? Saved windows are skipped on retry; games are stored on this device. Historical responses are cached to reduce repeat API calls."))return;
    button.disabled=true;button.textContent="Importing…";
    const progress=readProgress();let windows=0,received=0,saved=0;
    try{
      for(let season=FIRST_SEASON;season<=LAST_SEASON;season++){
        const start=new Date(Date.UTC(season-1,10,1));
        const now=new Date(),today=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()));
        const seasonEnd=season===LAST_SEASON?today:new Date(Date.UTC(season,3,30));
        let cursor=start;
        while(cursor<=seasonEnd){
          const end=new Date(Math.min(addDays(cursor,13).getTime(),seasonEnd.getTime()));
          const key=season+":"+date(cursor)+":"+date(end);
          if(progress[key]){cursor=addDays(end,1);continue;}
          status.textContent="Season "+(season-1)+"–"+String(season).slice(-2)+" · "+date(cursor)+" to "+date(end)+" · fetching";
          const raw=await fetchWindow(season,cursor,end);received+=raw.length;
          const games=assemble(raw,season);
          await saveBatch(games);saved+=games.length;
          progress[key]=true;writeProgress(progress);windows++;
          status.textContent="Saved "+saved.toLocaleString()+" games this run · "+received.toLocaleString()+" source rows received";
          cursor=addDays(end,1);
        }
      }
      const coverage=await countBySeason();
      if(!coverage.total)throw Error("The API returned no usable Division I games. No successful import was recorded. Check API access and conference labels.");
      const summary=Array.from({length:LAST_SEASON-FIRST_SEASON+1},(_,i)=>{const s=String(FIRST_SEASON+i);return (Number(s)-1)+"–"+s.slice(-2)+": "+(coverage.counts[s]||0).toLocaleString();}).join(" · ");
      status.textContent="Import complete · "+coverage.total.toLocaleString()+" games stored on this device · "+summary+". Refreshing workspace…";
      button.textContent="Import complete";setTimeout(()=>location.reload(),1000);
    }catch(error){
      const coverage=await countBySeason().catch(()=>({total:0,counts:{}}));
      status.textContent="Import paused safely · "+windows+" windows completed · "+coverage.total.toLocaleString()+" games saved. "+error.message+" Tap Resume / retry; completed windows will be skipped.";
      button.disabled=false;button.textContent="Resume / retry import";
    }
  });
})();
