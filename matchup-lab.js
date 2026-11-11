/* CBB LAB: pregame, opponent-adjusted matchup similarity.
   All historical snapshots use only games completed before the target game's date. */
(() => {
 const $=id=>document.getElementById(id), N=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const db=()=>new Promise((ok,no)=>{const r=indexedDB.open("cbb-lab-db",2);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 async function read(store){const d=await db();const a=await new Promise((ok,no)=>{const r=d.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)});d.close();return a}
 const FEATURE_KEYS=["o","d","p","efg","tov","orb","ftr","threeRate","threePct","twoPct","oppEfg","oppTov","oppThreeRate","oppThreePct","oppTwoPct"];
 const FEATURE_LABELS=["Adj offense","Adj defense","Pace","eFG%","Turnover rate","Off. rebound rate","Free-throw rate","3PA rate","3P%","2P%","Opp. eFG%","Opp. turnover rate","Opp. 3PA rate","Opp. 3P%","Opp. 2P%"];
 const FEATURE_GROUPS=["efficiency","efficiency","pace","shooting","ball security","rebounding","shot profile","shot profile","shooting","shooting","defense","defense","defense","defense","defense"];
 const FEATURE_WEIGHTS=[1.5,1.5,.9,1.15,.9,.85,.65,.8,1.0,.9,1.15,.75,.75,.9,.8];
 function gameRows(g){
   const hs=N(g.homeScore),as=N(g.awayScore),hp=N(g.home_pace),ap=N(g.away_pace);
   const pace=mean([hp,ap].filter(Number.isFinite));
   if(!g.homeTeam||!g.awayTeam||hs===null||as===null||pace===null||pace<=0)return [];
   const row=(side,team,opp,score,oppScore,ownP,oppP)=>{
     const other=side==="home"?"away":"home",v=k=>N(g[side+"_"+k]),ov=k=>N(g[other+"_"+k]);
     return {team,opp,season:String(g.season),date:String(g.gameDate||""),game:g,side,
       off:score/(ownP||pace)*100,def:oppScore/(ownP||pace)*100,pace:ownP||pace,
       efg:v("efg"),tov:v("tov"),orb:v("orb"),ftr:v("ftr"),threeRate:v("threeRate"),threePct:v("threePct"),twoPct:v("twoPct"),
       oppEfg:ov("efg"),oppTov:ov("tov"),oppThreeRate:ov("threeRate"),oppThreePct:ov("threePct"),oppTwoPct:ov("twoPct")};
   };
   return [row("home",g.homeTeam,g.awayTeam,hs,as,hp,ap),row("away",g.awayTeam,g.homeTeam,as,hs,ap,hp)];
 }
 function adjustedSnapshot(history){
   const rows=history.flatMap(gameRows),byTeam=new Map();
   if(!rows.length)return new Map();
   rows.forEach(r=>{if(!byTeam.has(r.team))byTeam.set(r.team,[]);byTeam.get(r.team).push(r)});
   const teams=[...byTeam.keys()],lgO=mean(rows.map(r=>r.off)),lgD=mean(rows.map(r=>r.def)),lgP=mean(rows.map(r=>r.pace));
   const league={};FEATURE_KEYS.slice(3).forEach(k=>league[k]=mean(rows.map(r=>r[k]).filter(Number.isFinite)));
   let cur=new Map(teams.map(t=>{const a=byTeam.get(t),v={n:a.length,o:mean(a.map(x=>x.off)),d:mean(a.map(x=>x.def)),p:mean(a.map(x=>x.pace))};FEATURE_KEYS.slice(3).forEach(k=>v[k]=mean(a.map(x=>x[k]).filter(Number.isFinite)));return [t,v]}));
   for(let k=0;k<10;k++){
     const next=new Map();
     for(const t of teams){
       const a=byTeam.get(t),n=a.length,w=n/(n+5);
       const o=mean(a.map(r=>r.off-((cur.get(r.opp)?.d??lgD)-lgD)));
       const d=mean(a.map(r=>r.def-((cur.get(r.opp)?.o??lgO)-lgO)));
       const p=mean(a.map(r=>r.pace-((cur.get(r.opp)?.p??lgP)-lgP)+lgP));
       const v={o:w*o+(1-w)*lgO,d:w*d+(1-w)*lgD,p:w*p+(1-w)*lgP,n};
       FEATURE_KEYS.slice(3).forEach(f=>{const z=mean(a.map(r=>r[f]).filter(Number.isFinite));v[f]=z===null?null:z});
       next.set(t,v);
     }
     cur=next;
   }
   return cur;
 }
 function vector(snap,teamA,teamB,minGames=5){
   const a=snap.get(teamA),b=snap.get(teamB);
   if(!a||!b||a.n<minGames||b.n<minGames)return null;
   const v=[...FEATURE_KEYS.map(k=>a[k]),...FEATURE_KEYS.map(k=>b[k])];
   return {v,a,b,coverage:v.filter(Number.isFinite).length/v.length};
 }
 function std(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2))||0)||1}
 function distance(v1,v2,scales){
   let sum=0,weight=0,used=0;
   const details={efficiency:{sum:0,w:0},pace:{sum:0,w:0},shooting:{sum:0,w:0},rebounding:{sum:0,w:0},ballSecurity:{sum:0,w:0},defense:{sum:0,w:0},shotProfile:{sum:0,w:0}};
   for(let i=0;i<v1.length;i++){
     if(!Number.isFinite(v1[i])||!Number.isFinite(v2[i])||!scales[i])continue;
     const j=i%FEATURE_KEYS.length,k=FEATURE_KEYS[j],w=FEATURE_WEIGHTS[j];
     const z=Math.pow((v1[i]-v2[i])/scales[i],2),group=({o:"efficiency",d:"efficiency",p:"pace",efg:"shooting",tov:"ballSecurity",orb:"rebounding",ftr:"shotProfile",threeRate:"shotProfile",threePct:"shooting",twoPct:"shooting",oppEfg:"defense",oppTov:"defense",oppThreeRate:"defense",oppThreePct:"defense",oppTwoPct:"defense"})[k];
     sum+=w*z;weight+=w;used++;details[group].sum+=w*z;details[group].w+=w;
   }
   if(used<18||weight===0)return null;
   Object.keys(details).forEach(k=>details[k]=details[k].w?Math.sqrt(details[k].sum/details[k].w):null);
   return {distance:Math.sqrt(sum/weight),details,coverage:used/v1.length,used};
 }
 function buildSnapshots(games){
   const bySeason=new Map();
   games.filter(g=>N(g.homeScore)!==null&&N(g.awayScore)!==null&&g.gameDate).forEach(g=>{const s=String(g.season);if(!bySeason.has(s))bySeason.set(s,[]);bySeason.get(s).push(g)});
   const snapshots=new Map(),seasonFinal=new Map();
   for(const [season,list] of bySeason){
     list.sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
     let prior=[];
     for(let i=0;i<list.length;){
       const date=String(list[i].gameDate),key=season+"|"+date;
       const snap=adjustedSnapshot(prior);
       snapshots.set(key,snap);
       let j=i;while(j<list.length&&String(list[j].gameDate)===date){prior.push(list[j]);j++}
       i=j;
     }
     seasonFinal.set(season,adjustedSnapshot(prior));
   }
   return {snapshots,seasonFinal};
 }
 function vector(snap,teamA,teamB,minGames=3){
   const a=snap.get(teamA),b=snap.get(teamB);
   if(!a||!b||a.n<minGames||b.n<minGames)return null;
   if(![a.o,a.d,a.p,b.o,b.d,b.p].every(Number.isFinite))return null;
   // A offense vs B defense; B offense vs A defense; both opponent-adjusted tempos.
   return {v:[a.o,b.d,b.o,a.d,a.p,b.p],a,b};
 }
 function distance(v1,v2,scales){
   const weights=[1.25,1.25,1.25,1.25,.8,.8];let sum=0,weight=0;
   for(let i=0;i<6;i++){if(!Number.isFinite(v1[i])||!Number.isFinite(v2[i])||!scales[i])continue;sum+=weights[i]*Math.pow((v1[i]-v2[i])/scales[i],2);weight+=weights[i]}
   return weight?Math.sqrt(sum/weight):null;
 }
 function std(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2))||0)||1}
 function marketFor(g,lines){
   const rec=lines.find(x=>String(x.gameId)===String(g.sourceGameId||String(g.id||"").replace("cbbd-","")));
   const entries=(rec?.lines||[]).filter(x=>N(x.spread)!==null||N(x.overUnder)!==null);
   return {spread:entries.length?mean(entries.map(x=>N(x.spread)).filter(Number.isFinite)):null,total:entries.length?mean(entries.map(x=>N(x.overUnder)).filter(Number.isFinite)):null,providers:entries.length};
 }
 function candidates(games,teamA,teamB,years,count,lines){
   const built=buildSnapshots(games);
   const seasons=[...new Set(games.map(g=>Number(g.season)).filter(Number.isFinite))].sort((a,b)=>a-b);
   const currentSeason=seasons[seasons.length-1];if(!currentSeason)throw Error("No imported season data found.");
   const currentGames=games.filter(g=>Number(g.season)===currentSeason&&N(g.homeScore)!==null&&N(g.awayScore)!==null).sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   if(!currentGames.length)throw Error("No completed games in the current season. Import current-season game data first.");
   const currentSnap=built.seasonFinal.get(String(currentSeason))||new Map();
   const current=vector(currentSnap,teamA,teamB,5);
   if(!current)throw Error("Need at least five completed games for each selected team to build a stable, full-detail matchup fingerprint.");
   const targetSeasons=years==="all"?seasons.filter(s=>s<currentSeason):seasons.filter(s=>s<currentSeason&&s>=currentSeason-Number(years));
   const historical=games.filter(g=>targetSeasons.includes(Number(g.season))&&N(g.homeScore)!==null&&N(g.awayScore)!==null).sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   const raw=[];
   // Rebuild a strictly pregame snapshot for each historical matchup.
   for(const g of historical){
     const cutoff=String(g.gameDate||"");if(!cutoff)continue;
     const snap=built.snapshots.get(String(g.season)+"|"+cutoff)||new Map();
     const h=vector(snap,g.homeTeam,g.awayTeam,5),a=vector(snap,g.awayTeam,g.homeTeam,5);
     if(h)raw.push({g,orientation:"home",v:h.v});
     if(a)raw.push({g,orientation:"away",v:a.v});
   }
   if(!raw.length)throw Error("No historical games have sufficient prior-game data to build pregame ratings.");
   const scales=current.v.map((_,i)=>std(raw.map(x=>x.v[i]).filter(Number.isFinite)));
   const unique=new Map();
   for(const x of raw){const scored=distance(current.v,x.v,scales);if(!scored)continue;const old=unique.get(String(x.g.id));if(!old||scored.distance<old.distance)unique.set(String(x.g.id),{...x,...scored})}
   return [...unique.values()].sort((a,b)=>a.distance-b.distance).slice(0,count).map(x=>({...x,market:marketFor(x.g,lines),similarity:100/(1+x.distance),current}));
 }
 function render(rows){
   const el=$("matchupCompsResults");
   if(!rows.length){el.className="results empty";el.textContent="No sufficiently complete historical matchups found.";return}
   let win=0,loss=0,tie=0,atsW=0,atsL=0,atsP=0,ouW=0,ouL=0,ouP=0,atsN=0,ouN=0;
   const cards=rows.map(x=>{
     const g=x.g,homeMargin=N(g.homeScore)-N(g.awayScore),total=N(g.homeScore)+N(g.awayScore);
     const teamAMargin=x.orientation==="home"?homeMargin:-homeMargin;
     let outcome="Team A lost";
     if(teamAMargin>0){win++;outcome="Team A won"}else if(teamAMargin<0)loss++;else{tie++;outcome="Tie"};
     let result=[];
     if(x.market.spread!==null){atsN++;const aCover=(x.orientation==="home"?homeMargin+x.market.spread:-(homeMargin+x.market.spread));if(Math.abs(aCover)<.001){atsP++;result.push("ATS push")}else if(aCover>0){atsW++;result.push("Team A covered")}else{atsL++;result.push("Team A did not cover")}}
     if(x.market.total!==null){ouN++;const d=total-x.market.total;if(Math.abs(d)<.001){ouP++;result.push("total push")}else if(d>0){ouW++;result.push("over")}else{ouL++;result.push("under")}}
     const spread=x.market.spread===null?"No spread":"Home spread "+x.market.spread.toFixed(1);
     const marketTotal=x.market.total===null?"No total":"Total "+x.market.total.toFixed(1);
     return '<div class="result-row"><div><b>'+g.homeTeam+' vs '+g.awayTeam+'</b><small>'+g.season+' · '+String(g.gameDate||"").slice(0,10)+' · '+g.homeScore+'–'+g.awayScore+' · '+spread+' · '+marketTotal+'</small><small>'+outcome+(result.length?" · "+result.join(" · "):"")+'</small></div><span class="score">'+x.similarity.toFixed(0)+'%</span></div>';
   }).join("");
   const rate=(w,l,n)=>n?(100*w/n).toFixed(1)+"% · "+n+" graded":"— · no lines";
   const c=rows[0].current,top=rows[0];
   const breakdown=Object.entries(top.details||{}).map(([k,v])=>'<div><small>'+({efficiency:"Efficiency",pace:"Pace",shooting:"Shooting",rebounding:"Rebounding",ballSecurity:"Ball security",defense:"Defense",shotProfile:"Shot profile"}[k]||k)+'</small><b>'+(v===null?"Not available":v.toFixed(2)+" distance")+'</b></div>').join("");
   const currentCoverage=(c.coverage*100).toFixed(0);
   el.className="results";
   el.innerHTML='<div class="profilegrid"><div><small>Team A adjusted offense</small><b>'+c.a.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.a.n+' GP</small></div><div><small>Team A adjusted defense</small><b>'+c.a.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.a.n+' GP</small></div><div><small>Team A adjusted pace</small><b>'+c.a.p.toFixed(1)+'</b><small>Possessions / game</small></div><div><small>Team B adjusted offense</small><b>'+c.b.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.b.n+' GP</small></div><div><small>Team B adjusted defense</small><b>'+c.b.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.b.n+' GP</small></div><div><small>Team B adjusted pace</small><b>'+c.b.p.toFixed(1)+'</b><small>Possessions / game</small></div></div><div class="profilegrid"><div><small>Team A win rate</small><b>'+rate(win,loss,win+loss)+'</b><small>Ties '+tie+'</small></div><div><small>Team A ATS hit rate</small><b>'+rate(atsW,atsL,atsW+atsL)+'</b><small>Pushes '+atsP+' · no-line '+(rows.length-atsN)+'</small></div><div><small>Over hit rate</small><b>'+rate(ouW,ouL,ouW+ouL)+'</b><small>Pushes '+ouP+' · no-line '+(rows.length-ouN)+'</small></div><div><small>Historical comps</small><b>'+rows.length+'</b><small>Top closest matches</small></div></div><h4>Closest matchup fingerprint breakdown</h4><div class="profilegrid">'+breakdown+'</div><p class="muted small">Strict filter: at least five prior games per team and at least 18 of 30 team-feature comparisons available. All available profile features are standardized against the historical comparison pool; missing metrics are excluded, never zero-filled. Efficiency, pace, shooting, rebounding, ball security, defense and shot profile all contribute with different weights. Similarity is a statistical distance, not a win probability. Historical snapshots use only games completed before each matchup. Current fingerprint data coverage: '+currentCoverage+'%. Hit rates use only available lines; provider snapshots may not be official closing lines.</p>'+cards;
 }
 async function init(){
   const refreshTeams=async()=>{
     const [games,lines]=await Promise.all([read("games"),read("lines")]);
     const teams=[...new Set(games.flatMap(g=>[g.homeTeam,g.awayTeam]).filter(Boolean))].sort();
     ["hmTeamA","hmTeamB"].forEach((id,i)=>{const e=$(id),old=e.value;e.innerHTML='<option value="">Select a team</option>'+teams.map(t=>'<option>'+t.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</option>').join("");const preferred=i===0?"Kentucky":"Kansas";if(teams.includes(old))e.value=old;else if(teams.includes(preferred))e.value=preferred});
     return {games,lines,teams};
   };
   await refreshTeams();
   const btn=$("runMatchupComps");if(!btn)return;
   btn.addEventListener("click",async()=>{
     const a=$("hmTeamA").value,b=$("hmTeamB").value;
     if(!a||!b||a===b){$("matchupCompsResults").textContent="Choose two different teams.";return}
     btn.disabled=true;btn.textContent="Refreshing saved data…";
     try{
       const {games,lines,teams}=await refreshTeams();
       if(!games.length)throw Error("No games are saved in this browser yet. Open Data Center and check the imported game count.");
       if(!teams.includes(a)||!teams.includes(b))throw Error("The selected teams were not found in the refreshed saved dataset. Choose them again.");
       btn.textContent="Building pregame ratings…";
       const rows=candidates(games,a,b,$("hmYears").value,Number($("hmCount").value),lines);render(rows);
     }catch(e){$("matchupCompsResults").className="results empty";$("matchupCompsResults").textContent=e.message}
     finally{btn.disabled=false;btn.textContent="Find similar matchups"}
   });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>init().catch(e=>console.error(e)));else init().catch(e=>console.error(e));
})();