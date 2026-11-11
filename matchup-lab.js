/* Matchup-level historical similarity and hit-rate reporting. */
(() => {
 const $=id=>document.getElementById(id),num=x=>x===null||x===undefined||x===""?null:Number(x),mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open("cbb-lab-db",2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 async function read(store){const db=await openDB();const v=await new Promise((ok,no)=>{const r=db.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)});db.close();return v}
 function paceProfiles(games){const m=new Map();games.forEach(g=>{for(const side of ["home","away"]){const team=g[side+"Team"],pace=num(g[side+"_pace"]);if(!team||pace===null)continue;const k=g.season+"|"+team;if(!m.has(k))m.set(k,[]);m.get(k).push(pace)}});return new Map([...m].map(([k,v])=>[k,mean(v)]))}
 function ratingMap(rows){return new Map(rows.map(r=>[r.season+"|"+r.team,r]))}
 function lineSummary(g){const lines=(g.lines||[]).filter(x=>num(x.spread)!==null||num(x.overUnder)!==null);return {spread:mean(lines.map(x=>num(x.spread)).filter(Number.isFinite)),total:mean(lines.map(x=>num(x.overUnder)).filter(Number.isFinite)),providers:lines.length}}
 function vectors(g,rm,pm){const h=rm.get(g.season+"|"+g.homeTeam),a=rm.get(g.season+"|"+g.awayTeam);if(!h||!a)return null;const hp=pm.get(g.season+"|"+g.homeTeam),ap=pm.get(g.season+"|"+g.awayTeam);if(![num(h.offensiveRating),num(h.defensiveRating),num(a.offensiveRating),num(a.defensiveRating),hp,ap].every(Number.isFinite))return null;return {home:[num(h.offensiveRating),num(a.defensiveRating),num(a.offensiveRating),num(h.defensiveRating),hp,ap],away:[num(a.offensiveRating),num(h.defensiveRating),num(h.offensiveRating),num(a.defensiveRating),ap,hp]}}
 function run(queryA,queryB,seasonLimit,count,games,ratings,lines){
   const rm=ratingMap(ratings),pm=paceProfiles(games),lineMap=new Map(lines.map(x=>[String(x.gameId),x]));
   const latestSeason=Math.max(...ratings.map(x=>Number(x.season)||0)),minSeason=seasonLimit==="all"?0:latestSeason-(Number(seasonLimit)||5);
   const qa=rm.get(latestSeason+"|"+queryA)||[...ratings].filter(x=>x.team===queryA).sort((x,y)=>y.season-x.season)[0];
   const qb=rm.get(latestSeason+"|"+queryB)||[...ratings].filter(x=>x.team===queryB).sort((x,y)=>y.season-x.season)[0];
   const qpa=pm.get(qa.season+"|"+queryA),qpb=pm.get(qb.season+"|"+queryB);
   if(!qa||!qb||![qpa,qpb].every(Number.isFinite))throw Error("Missing adjusted ratings or pace for one of the selected teams. Import the team game dataset and ratings first.");
   const q=[num(qa.offensiveRating),num(qb.defensiveRating),num(qb.offensiveRating),num(qa.defensiveRating),qpa,qpb];
   const candidates=[];
   for(const g of games){const s=Number(g.season);if(s<minSeason||s>=latestSeason)continue;const v=vectors(g,rm,pm);if(!v)continue;const l=lineSummary(lineMap.get(String(g.sourceGameId||String(g.id||"").replace("cbbd-","")) )||{});
     for(const orient of ["home","away"]){const z=v[orient];const keys=[0,1,2,3,4,5];let sum=0,w=0;keys.forEach(i=>{const all=[];for(const x of games){const vv=vectors(x,rm,pm);if(vv)all.push(vv.home[i],vv.away[i])}const mu=mean(all),sd=Math.sqrt(mean(all.map(x=>(x-mu)**2))||0)||1;sum+=((q[i]-z[i])/sd)**2;w++});candidates.push({g,orient,distance:Math.sqrt(sum/w),line:l})}
   }
   const best=new Map();candidates.sort((a,b)=>a.distance-b.distance).forEach(x=>{const id=x.g.id;if(!best.has(id))best.set(id,x)});return [...best.values()].sort((a,b)=>a.distance-b.distance).slice(0,count);
 }
 function render(rows,teamA,teamB){
   const el=$("matchupCompsResults");if(!rows.length){el.className="results empty";el.textContent="No historical games have complete adjusted ratings and pace for both teams.";return}
   let atsW=0,atsL=0,atsP=0,ouO=0,ouU=0,ouP=0,teamW=0,teamL=0;
   const html=rows.map(x=>{const g=x.g,l=x.line,swapped=x.orient==="away",scoreA=swapped?g.awayScore:g.homeScore,scoreB=swapped?g.homeScore:g.awayScore,margin=scoreA-scoreB,total=scoreA+scoreB;let result="";if(margin>0)teamW++;else if(margin<0)teamL++;
     if(l.spread!==null){const homeMargin=num(g.homeScore)-num(g.awayScore),homeCover=homeMargin+l.spread,teamACover=swapped?homeCover<0:homeCover>0;if(Math.abs(homeCover)<0.001){atsP++;result+=" ATS push"}else if(teamACover){atsW++;result+=" Team A ATS win"}else{atsL++;result+=" Team A ATS loss"}}
     if(l.total!==null){const diff=total-l.total;if(Math.abs(diff)<0.001){ouP++;result+=" · push"}else if(diff>0){ouO++;result+=" · over";}else{ouU++;result+=" · under"}}
     return '<div class="result-row"><div><b>'+g.homeTeam+' vs '+g.awayTeam+'</b><small>'+g.season+' · '+String(g.gameDate||"").slice(0,10)+' · score '+g.homeScore+'–'+g.awayScore+'</small></div><span class="score">'+(100/(1+x.distance)).toFixed(0)+'%</span><span>'+result+'</span></div>';
   }).join("");
   const pct=(w,l)=>w+l?(100*w/(w+l)).toFixed(1)+"% · "+(w+l)+" graded":"— · no lines";
   el.className="results";el.innerHTML='<div class="profilegrid"><div><small>Team A win rate</small><b>'+pct(teamW,teamL)+'</b></div><div><small>Team A ATS hit rate</small><b>'+pct(atsW,atsL)+'</b><small>Pushes '+atsP+'</small></div><div><small>Over hit rate</small><b>'+pct(ouO,ouU)+'</b><small>Pushes '+ouP+'</small></div><div><small>Games matched</small><b>'+rows.length+'</b><small>Top historical comps</small></div></div><p class="muted small">Similarity is a distance-based ranking, not a win probability. ATS uses the CBBD home spread convention; market lines are averaged across available provider records. Missing lines are excluded. Hit rates are descriptive and based only on the displayed comparable games.</p>'+html;
 }
 async function populate(){try{const ratings=await read("ratings");const names=[...new Set(ratings.map(x=>x.team))].sort();["hmTeamA","hmTeamB"].forEach(id=>{const e=$(id),old=e.value;e.innerHTML='<option value="">Select a team</option>'+names.map(n=>'<option>'+n.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</option>').join("");if(names.includes(old))e.value=old})}catch(e){}}
 const btn=$("runMatchupComps");if(btn){btn.addEventListener("click",async()=>{const a=$("hmTeamA").value,b=$("hmTeamB").value;if(!a||!b||a===b){$("matchupCompsResults").textContent="Choose two different teams.";return}btn.disabled=true;btn.textContent="Analyzing…";try{const [games,ratings,lines]=await Promise.all([read("games"),read("ratings"),read("lines")]);const rows=run(a,b,$("hmYears").value,Number($("hmCount").value),games,ratings,lines);render(rows,a,b)}catch(e){$("matchupCompsResults").className="results empty";$("matchupCompsResults").textContent=e.message}finally{btn.disabled=false;btn.textContent="Find similar matchups"}});populate()}
 const importBtn=$("importRatingsLines");if(importBtn){importBtn.addEventListener("click",()=>setTimeout(populate,1500))}
})();
