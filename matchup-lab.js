/* CBB LAB: pregame, opponent-adjusted matchup similarity.
   All historical snapshots use only games completed before the target game's date. */
(() => {
 const $=id=>document.getElementById(id), N=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const pct=x=>x!==null&&Math.abs(x)<=1.5?x*100:x;
 const db=()=>new Promise((ok,no)=>{const r=indexedDB.open("cbb-lab-db",2);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
 async function read(store){const d=await db();const a=await new Promise((ok,no)=>{const r=d.transaction(store,"readonly").objectStore(store).getAll();r.onsuccess=()=>ok(r.result||[]);r.onerror=()=>no(r.error)});d.close();return a}
 // Export the scanner interface immediately. Function declarations are hoisted,
 // so candidates() is available here without waiting for UI setup/render code.
 window.CBBLabScanner={
   loadGames:()=>read("games"),
   compare:(games,home,away,neutral,years,targetDate)=>candidates(games,home,away,years,50000,null,null,neutral,targetDate)
 };
 const FEATURE_KEYS=["o","d","p","efg","tov","orb","ftr","threeRate","threePct","twoPct","oppEfg","oppTov","oppThreeRate","oppThreePct","oppTwoPct"];
 const FEATURE_LABELS=["Adj offense","Adj defense","Pace","eFG%","Turnover rate","Off. rebound rate","Free-throw rate","3PA rate","3P%","2P%","Opp. eFG%","Opp. turnover rate","Opp. 3PA rate","Opp. 3P%","Opp. 2P%"];
 const FEATURE_GROUPS=["efficiency","efficiency","pace","shooting","ball security","rebounding","shot profile","shot profile","shooting","shooting","defense","defense","defense","defense","defense"];
 const FEATURE_WEIGHTS=[1.5,1.5,2.0,1.15,.9,.85,.65,.8,1.0,.9,1.15,.75,.75,.9,.8];
 function gameRows(g){
   const hs=N(g.homeScore),as=N(g.awayScore),hp=N(g.home_pace),ap=N(g.away_pace);
   const pace=mean([hp,ap]);
   if(!g.homeTeam||!g.awayTeam||hs===null||as===null||!Number.isFinite(hp)||!Number.isFinite(ap)||hp<=0||ap<=0||!Number.isFinite(pace))return [];
   const row=(side,team,opp,score,oppScore,ownP,oppP)=>{
     const other=side==="home"?"away":"home",v=k=>pct(N(g[side+"_"+k])),ov=k=>pct(N(g[other+"_"+k]));
     return {team,opp,season:String(g.season),date:String(g.gameDate||""),game:g,side,
       off:score/ownP*100,def:oppScore/ownP*100,pace:ownP,
       efg:v("efg"),tov:v("tov"),orb:v("orb"),ftr:v("ftr"),threeRate:v("threeRate"),threePct:v("threePct"),twoPct:v("twoPct"),
       oppEfg:ov("efg"),oppTov:ov("tov"),oppThreeRate:ov("threeRate"),oppThreePct:ov("threePct"),oppTwoPct:ov("twoPct")};
   };
   return [row("home",g.homeTeam,g.awayTeam,hs,as,hp,ap),row("away",g.awayTeam,g.homeTeam,as,hs,ap,hp)];
 }
 function adjustedSnapshot(history,maxPerTeam=Infinity){
   const rows=history.flatMap(gameRows),byTeam=new Map();
   if(!rows.length)return new Map();
   rows.forEach(r=>{if(!byTeam.has(r.team))byTeam.set(r.team,[]);byTeam.get(r.team).push(r)});
   for(const [team,list] of byTeam){list.sort((a,b)=>String(a.game.gameDate||"").localeCompare(String(b.game.gameDate||"")));if(list.length>maxPerTeam)byTeam.set(team,list.slice(-maxPerTeam));}
   const modelRows=[...byTeam.values()].flat();
   const teams=[...byTeam.keys()],lgO=mean(modelRows.map(r=>r.off)),lgD=mean(modelRows.map(r=>r.def)),lgP=mean(modelRows.map(r=>r.pace));
   const league={};FEATURE_KEYS.slice(3).forEach(k=>league[k]=mean(modelRows.map(r=>r[k]).filter(Number.isFinite)));
   let cur=new Map(teams.map(t=>{const a=byTeam.get(t),v={n:a.length,o:mean(a.map(x=>x.off)),d:mean(a.map(x=>x.def)),p:mean(a.map(x=>x.pace))};FEATURE_KEYS.slice(3).forEach(k=>v[k]=mean(a.map(x=>x[k]).filter(Number.isFinite)));return [t,v]}));
   for(let k=0;k<10;k++){
     const next=new Map();
     for(const t of teams){
       const a=byTeam.get(t),n=a.length,w=n/(n+5);
       const o=mean(a.map(r=>r.off-((cur.get(r.opp)?.d??lgD)-lgD)));
       const d=mean(a.map(r=>r.def-((cur.get(r.opp)?.o??lgO)-lgO)));
       // Pace is a shared game-environment outcome, not an opponent-adjusted team strength.
       const p=mean(a.map(r=>r.pace));
       // Pace is observed possessions, not team strength: never shrink it toward league pace.
       const v={o:w*o+(1-w)*lgO,d:w*d+(1-w)*lgD,p,n};
       FEATURE_KEYS.slice(3).forEach(f=>{const z=mean(a.map(r=>r[f]).filter(Number.isFinite)),prior=league[f];v[f]=z===null?null:(prior===null?z:w*z+(1-w)*prior)});
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
 const FEATURE_SCALES=[6,6,3,5,4,6,8,8,5,5,5,4,8,5,5];
 function distance(v1,v2){
   let sum=0,weight=0,used=0;
   const details={efficiency:{sum:0,w:0},pace:{sum:0,w:0},shooting:{sum:0,w:0},rebounding:{sum:0,w:0},ballSecurity:{sum:0,w:0},defense:{sum:0,w:0},shotProfile:{sum:0,w:0}};
   for(let i=0;i<v1.length;i++){
     if(!Number.isFinite(v1[i])||!Number.isFinite(v2[i])||!FEATURE_SCALES[i%FEATURE_KEYS.length])continue;
     const j=i%FEATURE_KEYS.length,k=FEATURE_KEYS[j],w=FEATURE_WEIGHTS[j];
     const scale=FEATURE_SCALES[j],z=Math.pow((v1[i]-v2[i])/scale,2),group=({o:"efficiency",d:"efficiency",p:"pace",efg:"shooting",tov:"ballSecurity",orb:"rebounding",ftr:"shotProfile",threeRate:"shotProfile",threePct:"shooting",twoPct:"shooting",oppEfg:"defense",oppTov:"defense",oppThreeRate:"defense",oppThreePct:"defense",oppTwoPct:"defense"})[k];
     sum+=w*z;weight+=w;used++;details[group].sum+=w*z;details[group].w+=w;
   }
   const usedA=v1.slice(0,FEATURE_KEYS.length).reduce((n,x,i)=>n+(Number.isFinite(x)&&Number.isFinite(v2[i])?1:0),0);
   const usedB=v1.slice(FEATURE_KEYS.length).reduce((n,x,i)=>n+(Number.isFinite(x)&&Number.isFinite(v2[FEATURE_KEYS.length+i])?1:0),0);
   if(used<24||usedA<12||usedB<12||weight===0)return null;
   Object.keys(details).forEach(k=>details[k]=details[k].w?Math.sqrt(details[k].sum/details[k].w):null);
   return {distance:Math.sqrt(sum/weight),details,coverage:used/v1.length,used};
 }
 function buildSnapshots(games){
   // One chronological history across seasons: early-season teams retain their
   // most recent prior-season form, while every snapshot remains strictly pregame.
   const ordered=games.filter(g=>N(g.homeScore)!==null&&N(g.awayScore)!==null&&g.gameDate)
     .slice().sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   const snapshots=new Map(),seasonFinal=new Map();let prior=[];
   for(let i=0;i<ordered.length;){
     const date=String(ordered[i].gameDate).slice(0,10),day=[];
     let j=i;while(j<ordered.length&&String(ordered[j].gameDate).slice(0,10)===date){day.push(ordered[j]);j++}
     const seasons=[...new Set(day.map(g=>String(g.season)))];
     seasons.forEach(season=>snapshots.set(season+"|"+date,adjustedSnapshot(prior,10)));
     prior.push(...day);
     seasons.forEach(season=>seasonFinal.set(season,adjustedSnapshot(prior,10)));
     i=j;
   }
   return {snapshots,seasonFinal};
 }
 function marketFor(g,lines){
   const rec=lines.find(x=>String(x.gameId)===String(g.sourceGameId||String(g.id||"").replace("cbbd-","")));
   const entries=(rec?.lines||[]).filter(x=>N(x.spread)!==null||N(x.overUnder)!==null);
   return {spread:entries.length?mean(entries.map(x=>N(x.spread)).filter(Number.isFinite)):null,total:entries.length?mean(entries.map(x=>N(x.overUnder)).filter(Number.isFinite)):null,providers:entries.length};
 }
 let snapshotCacheGames=null,snapshotCache=new Map();
 function candidates(games,teamA,teamB,years,count,spread,total,neutral,targetDate){
   const seasons=[...new Set(games.map(g=>Number(g.season)).filter(Number.isFinite))].sort((a,b)=>a-b);
   const currentSeason=seasons[seasons.length-1];if(!currentSeason)throw Error("No imported season data found.");
   const targetSeasons=years==="all"?seasons.filter(s=>s<currentSeason):seasons.filter(s=>s<currentSeason&&s>=currentSeason-Number(years));
   const relevantGames=games.filter(g=>targetSeasons.includes(Number(g.season))||Number(g.season)===currentSeason);
   if(snapshotCacheGames!==games){snapshotCacheGames=games;snapshotCache.clear()}
   const cacheKey=years;
   if(!snapshotCache.has(cacheKey))snapshotCache.set(cacheKey,buildSnapshots(relevantGames));
   const built=snapshotCache.get(cacheKey);
   const localNow=new Date(),today=localNow.getFullYear()+"-"+String(localNow.getMonth()+1).padStart(2,"0")+"-"+String(localNow.getDate()).padStart(2,"0");
   const cutoffDate=String(targetDate||today).slice(0,10);
   // Never let results from the target date or a future date influence the
   // live profile. Carry forward up to ten most recent prior games per team.
   const currentHistory=relevantGames.filter(g=>N(g.homeScore)!==null&&N(g.awayScore)!==null&&String(g.gameDate||"").slice(0,10)<cutoffDate)
     .sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   if(!currentHistory.length)throw Error("No completed games exist before "+cutoffDate+". Import earlier game results first.");
   const currentSnap=adjustedSnapshot(currentHistory,10);
   const current=vector(currentSnap,teamA,teamB,5);
   if(!current)throw Error("A reliable pregame profile needs at least five completed games with pace data for each team before "+cutoffDate+". The model can carry forward up to ten recent games from prior seasons.");
   const environment=p=>({pace:(p.a.p+p.b.p)/2,paceA:p.a.p,paceB:p.b.p});
   const currentEnvironment=environment(current);
   const historical=relevantGames.filter(g=>targetSeasons.includes(Number(g.season))&&N(g.homeScore)!==null&&N(g.awayScore)!==null).sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   const raw=[];
   // Rebuild a strictly pregame snapshot for each historical matchup.
   for(const g of historical){
     const cutoff=String(g.gameDate||"").slice(0,10);if(!cutoff)continue;
     const snap=built.snapshots.get(String(g.season)+"|"+cutoff)||new Map();
     const h=vector(snap,g.homeTeam,g.awayTeam,5),a=vector(snap,g.awayTeam,g.homeTeam,5);
     if(h)raw.push({g,orientation:"home",v:h.v,profile:h});
     if(a)raw.push({g,orientation:"away",v:a.v,profile:a});
   }
   const siteMatches=raw.filter(x=>!!x.g.neutralSite===!!neutral);
   if(siteMatches.length>=5){raw.splice(0,raw.length,...siteMatches)}
   if(!raw.length)throw Error("No historical games have sufficient prior-game data for this venue. Try the other site setting or import more history.");
   const unique=new Map();
   for(const x of raw){const scored=distance(current.v,x.v);if(!scored)continue;const env=environment(x.profile);const old=unique.get(String(x.g.id));if(!old||scored.distance<old.distance)unique.set(String(x.g.id),{...x,...scored,expectedPace:env.pace,expectedPaceA:env.paceA,expectedPaceB:env.paceB,paceGapA:Math.abs(env.paceA-currentEnvironment.paceA),paceGapB:Math.abs(env.paceB-currentEnvironment.paceB),paceGap:Math.abs(env.pace-currentEnvironment.pace)})}
   const allRanked=[...unique.values()].sort((a,b)=>a.distance-b.distance).map(x=>({...x,market:{spread,total,providers:0},similarity:(window.CBBLabSimilarityScale?.score||((d)=>d===0?100:Math.min(99.9,100*Math.exp(-1.5*d*d))))(x.distance),current}));
   const compatible=allRanked.filter(x=>x.paceGapA<=2&&x.paceGapB<=2);
   const tier=(lo,hi)=>compatible.filter(x=>x.similarity>=lo&&x.similarity<hi).length;
   const audit={eligible:compatible.length,environmentRejected:allRanked.length-compatible.length,currentExpectedPace:currentEnvironment.pace,seasons:targetSeasons.slice().sort((a,b)=>a-b),tier50_59:tier(50,60),tier60_69:tier(60,70),tier70_79:tier(70,80),tier80_89:tier(80,90),tier90_94:tier(90,95),tier95_100:tier(95,100.000001),atLeast60:tier(60,100.000001),pctAtLeast60:compatible.length?100*tier(60,100.000001)/compatible.length:0,max:compatible[0]?.similarity??null,meanCoverage:compatible.length?100*mean(compatible.map(x=>x.coverage)):0};
   const eligible=compatible.filter(x=>x.similarity>=60);const result=eligible.slice(0,Number.isFinite(count)?count:eligible.length);result.audit=audit;result.allMatches=eligible;return result;
 }
 // Publish the scanner API immediately after the engine is defined, before UI initialization.
 window.CBBLabScanner={
   loadGames:()=>read("games"),
   compare:(games,home,away,neutral,years,targetDate)=>candidates(games,home,away,years,50000,null,null,neutral,targetDate)
 };
 function render(rows){
   const el=$("matchupCompsResults");
   if(!rows.length){const a=rows.audit;el.className="results empty";el.textContent=a?("No historical matches met the 60% fingerprint-similarity floor and both-team pace screen. "+a.eligible+" games passed the pace screen; "+a.environmentRejected+" were screened out. Best fingerprint similarity before the pace screen: "+(a.max===null?"—":a.max.toFixed(1)+"%")+". Current average pace: "+a.currentExpectedPace.toFixed(1)+" possessions."):"No sufficiently complete historical matchups found.";return}
   let win=0,loss=0,tie=0,atsW=0,atsL=0,atsP=0,ouW=0,ouL=0,ouP=0,atsN=0,ouN=0;
   const cards=rows.map(x=>{
     const g=x.g,homeMargin=N(g.homeScore)-N(g.awayScore),total=N(g.homeScore)+N(g.awayScore);
     const teamAMargin=x.orientation==="home"?homeMargin:-homeMargin;
     let outcome="Team A lost";
     if(teamAMargin>0){win++;outcome="Team A won"}else if(teamAMargin<0)loss++;else{tie++;outcome="Tie"};
     let result=[];
     if(x.market.spread!==null){atsN++;const aCover=teamAMargin+x.market.spread;if(Math.abs(aCover)<.001){atsP++;result.push("ATS push")}else if(aCover>0){atsW++;result.push("Team A covered")}else{atsL++;result.push("Team A did not cover")}}
     if(x.market.total!==null){ouN++;const d=total-x.market.total;if(Math.abs(d)<.001){ouP++;result.push("total push")}else if(d>0){ouW++;result.push("over")}else{ouL++;result.push("under")}}
     const lineContext=(x.market.spread!==null||x.market.total!==null)?" · graded against your entered line(s)":"";
     return '<div class="result-row"><div><b>'+g.homeTeam+' vs '+g.awayTeam+'</b><small>'+g.season+' · '+String(g.gameDate||"").slice(0,10)+' · '+g.homeScore+'–'+g.awayScore+'</small><small>'+outcome+(result.length?" · "+result.join(" · "):"")+lineContext+'</small><small>Matched pace · Team A '+x.expectedPaceA.toFixed(1)+' (Δ '+x.paceGapA.toFixed(1)+') / Team B '+x.expectedPaceB.toFixed(1)+' (Δ '+x.paceGapB.toFixed(1)+') possessions · target '+x.current.a.p.toFixed(1)+' / '+x.current.b.p.toFixed(1)+'</small></div><span class="score '+(x.similarity>=80?"strongmatch":"")+'">'+x.similarity.toFixed(1)+'%'+(x.similarity>=95?' · NEARLY IDENTICAL':x.similarity>=90?' · ELITE':x.similarity>=80?' · STRONG':x.similarity>=70?' · ABOVE AVG':x.similarity>=60?' · MODERATE':' · WEAK')+'</span></div>';
   }).join("");
   const rate=(w,l,n)=>n?(100*w/n).toFixed(1)+"% · "+n+" graded":"— · no lines";
   const c=rows[0].current,top=rows[0];
   const breakdown=Object.entries(top.details||{}).map(([k,v])=>'<div><small>'+({efficiency:"Efficiency",pace:"Pace",shooting:"Shooting",rebounding:"Rebounding",ballSecurity:"Ball security",defense:"Defense",shotProfile:"Shot profile"}[k]||k)+'</small><b>'+(v===null?"Not available":v.toFixed(2)+" distance")+'</b></div>').join("");
   const maxSimilarity=Math.max(...rows.map(x=>x.similarity));
   const outcomeRows=rows.map(x=>{
     const home=N(x.g.homeScore),away=N(x.g.awayScore),total=home+away;
     const aPts=x.orientation==="home"?home:away,bPts=x.orientation==="home"?away:home;
     const aSpread=x.market.spread;
     const ats=aSpread===null?null:aPts-bPts+aSpread;
     const ou=x.market.total===null?null:total-x.market.total;
     const aLine=aSpread===null||x.market.total===null?null:(x.market.total-aSpread)/2;
     const bLine=aSpread===null||x.market.total===null?null:(x.market.total+aSpread)/2;
     return {ats,ou,aTT:aLine===null?null:aPts-aLine,bTT:bLine===null?null:bPts-bLine,w:Math.pow(x.similarity/Math.max(maxSimilarity,1),4)};
   });
   const dist=(title,key,meaning)=>{
     const a=outcomeRows.filter(x=>Number.isFinite(x[key]));
     if(!a.length)return '<div class="dist-block"><h4>'+title+'</h4><p class="muted small">Enter a spread and total above to generate this distribution.</p></div>';
     const bins=[["10+ below",v=>v<=-10],["6–10 below",v=>v>-10&&v<=-6],["3–6 below",v=>v>-6&&v<=-3],["Within 3",v=>v>-3&&v<3],["3–6 above",v=>v>=3&&v<6],["6–10 above",v=>v>=6&&v<10],["10+ above",v=>v>=10]];
     const den=a.reduce((z,x)=>z+x.w,0);
     return '<div class="dist-block"><h4>'+title+'</h4><p class="muted small">'+meaning+' · similarity-weighted</p>'+bins.map(([label,test])=>{const hit=a.filter(x=>test(x[key])),p=100*hit.reduce((z,x)=>z+x.w,0)/den;return '<div class="dist-row"><span>'+label+'</span><div class="dist-track"><i style="width:'+p.toFixed(1)+'%"></i></div><b>'+p.toFixed(1)+'%</b><small>'+hit.length+'/'+a.length+'</small></div>'}).join("")+'<small class="muted">'+a.length+' line-graded comps</small></div>';
   };
   const weightedRate=(key)=>{const a=outcomeRows.filter(x=>Number.isFinite(x[key])&&Math.abs(x[key])>.001);if(!a.length)return "—";const den=a.reduce((z,x)=>z+x.w,0);return (100*a.reduce((z,x)=>z+x.w*(x[key]>0?1:0),0)/den).toFixed(1)+"%";}
   const median=a=>{const z=a.filter(Number.isFinite).sort((x,y)=>x-y);if(!z.length)return null;const m=Math.floor(z.length/2);return z.length%2?z[m]:(z[m-1]+z[m])/2;};
   const volatility=(label,values)=>{const a=values.filter(Number.isFinite);if(!a.length)return '<tr><td>'+label+'</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>0</td></tr>';const avg=mean(a),med=median(a),sd=Math.sqrt(mean(a.map(x=>(x-avg)**2))),q=p=>{const z=a.slice().sort((x,y)=>x-y),i=(z.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return z[l]+(z[h]-z[l])*(i-l)};return '<tr><td>'+label+'</td><td>'+avg.toFixed(1)+'</td><td>'+med.toFixed(1)+'</td><td>'+sd.toFixed(1)+'</td><td>'+q(.1).toFixed(1)+'–'+q(.9).toFixed(1)+'</td><td>'+Math.min(...a).toFixed(1)+' to '+Math.max(...a).toFixed(1)+'</td><td>'+a.length+'</td></tr>';};
   const marginValues=rows.map(x=>{const h=N(x.g.homeScore),a=N(x.g.awayScore);return x.orientation==="home"?h-a:a-h;});
   const totalValues=rows.map(x=>N(x.g.homeScore)+N(x.g.awayScore));
   const teamAValues=rows.map(x=>x.orientation==="home"?N(x.g.homeScore):N(x.g.awayScore));
   const teamBValues=rows.map(x=>x.orientation==="home"?N(x.g.awayScore):N(x.g.homeScore));
   const volatilityPanel='<h4>Outcome consistency & volatility</h4><p class="muted small">These measurements describe how repeatable the historical outcomes were across the selected stylistic comps. High similarity does not imply low outcome volatility.</p><div class="tablewrap"><table><thead><tr><th>Outcome</th><th>Average</th><th>Median</th><th>Std. dev.</th><th>10th–90th pct.</th><th>Historical range</th><th>Games</th></tr></thead><tbody>'+volatility("Team A scoring margin",marginValues)+volatility("Combined points",totalValues)+volatility("Team A points",teamAValues)+volatility("Team B points",teamBValues)+'</tbody></table></div><p class="muted small">Large standard deviations and wide ranges indicate inconsistent outcomes, even when the stylistic similarity score is high.</p>';
   const outcomePanel='<h4>Similarity-weighted outcome distributions</h4><p class="muted small">Closer historical matches carry more weight (similarity relative to the top match, raised to the fourth power). These are historical frequencies, not calibrated probabilities. Positive ATS margin means Team A covered; positive total difference means over.</p><div class="profilegrid"><div><small>Team A ATS hit rate</small><b>'+weightedRate("ats")+'</b><small>Non-push comps with spread lines</small></div><div><small>Over hit rate</small><b>'+weightedRate("ou")+'</b><small>Non-push comps with total lines</small></div><div><small>Team A over implied team total</small><b>'+weightedRate("aTT")+'</b><small>Derived from spread + total</small></div><div><small>Team B over implied team total</small><b>'+weightedRate("bTT")+'</b><small>Derived from spread + total</small></div></div><div class="dist-grid">'+dist("Team A ATS margin","ats","Cover margin") +dist("Game total vs your line","ou","Points above/below total") +dist("Team A points vs implied team total","aTT","Points above/below derived team total") +dist("Team B points vs implied team total","bTT","Points above/below derived team total")+'</div>';
   const patternRows=(rows.allMatches||rows).filter(x=>x&&x.g&&N(x.g.homeScore)!==null&&N(x.g.awayScore)!==null&&Number.isFinite(x.similarity));
   const strongRows=patternRows.filter(x=>x.similarity>=80);
   const scoreOf=x=>N(x.g.homeScore)+N(x.g.awayScore);
   const weightedPct=(subset,test)=>{const w=subset.reduce((s,x)=>s+Math.pow(x.similarity/100,4),0);return w?100*subset.reduce((s,x)=>s+(test(x)?Math.pow(x.similarity/100,4):0),0)/w:null;};
   const autoThresholds=Array.from({length:12},(_,i)=>125+i*5);
   // Rank systems on genuinely strong analogs (80%+). The broader 60%+ pool is context only.
   const autoSystems=autoThresholds.flatMap(t=>{
     const over=x=>scoreOf(x)>t,under=x=>scoreOf(x)<t;
     return [{cutoff:t,direction:"Over",test:over},{cutoff:t,direction:"Under",test:under}].map(s=>{
       const strongHits=strongRows.filter(s.test),broadHits=patternRows.filter(s.test);
       const seasons=new Set(strongRows.map(x=>String(x.g.season)));
       const weights=strongRows.map(x=>Math.pow(x.similarity/100,4)),sum=weights.reduce((a,b)=>a+b,0);
       const effective=sum?sum*sum/weights.reduce((a,b)=>a+b*b,0):0;
       return {...s,n:strongRows.length,hits:strongHits.length,strongN:strongRows.length,strongHits:strongHits.length,
         raw:strongRows.length?100*strongHits.length/strongRows.length:null,
         weighted:weightedPct(strongRows,s.test),strongRaw:strongRows.length?100*strongHits.length/strongRows.length:null,
         strongWeighted:weightedPct(strongRows,s.test),broadN:patternRows.length,broadHits:broadHits.length,
         broadRaw:patternRows.length?100*broadHits.length/patternRows.length:null,broadWeighted:weightedPct(patternRows,s.test),
         effective,seasons:seasons.size,seasonList:[...seasons].sort()};
     });
   });
   const rankedSystems=autoSystems.filter(x=>x.n>=8&&x.seasons>=2&&x.effective>=5&&x.weighted!==null).sort((a,b)=>b.weighted-a.weighted||b.n-a.n);
   const topOver=rankedSystems.filter(x=>x.direction==="Over").slice(0,5),topUnder=rankedSystems.filter(x=>x.direction==="Under").slice(0,5);
   const systemRows=list=>list.length?list.map(x=>'<tr><td><b>'+x.direction+' '+x.cutoff+'</b></td><td>'+x.weighted.toFixed(1)+'%</td><td>'+x.raw.toFixed(1)+'%</td><td>'+(x.broadWeighted===null?'—':x.broadWeighted.toFixed(1)+'%')+'</td><td>'+x.hits+'/'+x.n+' ('+x.broadN+' broad)'+'</td><td>'+x.seasons+'</td></tr>').join(""):'<tr><td colspan="6">No pattern met the strong-match evidence rule (8+ 80%+ comps, effective sample 5+, across 2+ seasons).</td></tr>';
   const autoFinderPanel='<h4>Automatic historical scoring-system finder</h4><p class="muted small">Rankings now use only genuinely strong historical comps (80%+ absolute similarity). The 60%+ weighted rate is shown as context, never as the ranking basis. The model scans game-total cutoffs from 125 to 180 in five-point steps. A pattern must have at least 8 strong comps, effective weighted sample of 5+, and 2+ seasons to qualify.</p><div class="tablewrap"><table><thead><tr><th>Historical system</th><th>80%+ weighted</th><th>80%+ raw</th><th>60%+ context</th><th>Strong games</th><th>Seasons</th></tr></thead><tbody>'+systemRows(topOver)+'</tbody></table></div><h4>Best historical under systems</h4><div class="tablewrap"><table><thead><tr><th>Historical system</th><th>80%+ weighted</th><th>80%+ raw</th><th>60%+ context</th><th>Strong games</th><th>Seasons</th></tr></thead><tbody>'+systemRows(topUnder)+'</tbody></table></div><p class="muted small">These are historical frequencies, not future win probabilities. If the strong-match sample is too small, CBB LAB will say so rather than promote a broad or thin 85% pattern.</p><h4>Complete scoring-cutoff scan · strong matches only</h4><div class="tablewrap"><table><thead><tr><th>Cutoff</th><th>Over weighted</th><th>Over raw</th><th>Under weighted</th><th>Under raw</th><th>80%+ games / seasons</th></tr></thead><tbody>'+autoSystems.map(x=>{const pair=autoSystems.find(y=>y.cutoff===x.cutoff&&y.direction!=="Over");return x.direction==="Over"?'<tr><td>'+x.cutoff+'</td><td>'+(x.weighted===null?'—':x.weighted.toFixed(1)+'%')+'</td><td>'+(x.raw===null?'—':x.raw.toFixed(1)+'%')+'</td><td>'+(pair?.weighted===null?'—':pair?.weighted.toFixed(1)+'%')+'</td><td>'+(pair?.raw===null?'—':pair?.raw.toFixed(1)+'%')+'</td><td>'+x.n+' / '+x.seasons+'</td></tr>':''}).join("")+'</tbody></table></div>';
   const histogram=(title,values,bins,description)=>{
     const data=patternRows.map(x=>({value:values(x),weight:Math.pow(x.similarity/100,4)})).filter(x=>Number.isFinite(x.value)&&Number.isFinite(x.weight)&&x.weight>0);
     const rawDen=data.length,weightDen=data.reduce((s,x)=>s+x.weight,0);
     const stats=bins.map(([label,test])=>{const hits=data.filter(x=>test(x.value)),w=hits.reduce((s,x)=>s+x.weight,0);return{label,n:hits.length,raw:rawDen?100*hits.length/rawDen:0,weighted:weightDen?100*w/weightDen:0};});
     const max=Math.max(1,...stats.map(x=>Math.max(x.raw,x.weighted)));
     const effective=weightDen?Math.pow(weightDen,2)/data.reduce((s,x)=>s+x.weight*x.weight,0):0;
     return '<section class="score-dist-section"><h4>'+title+'</h4><p class="muted small">'+description+' Each pair shows raw frequency and similarity⁴-weighted frequency.</p><div class="score-histogram">'+stats.map(x=>'<div class="score-bin"><div class="score-bin-bars"><div class="score-bin-bar raw" style="height:'+Math.max(2,100*x.raw/max)+'%" title="Raw '+x.raw.toFixed(1)+'%"></div><div class="score-bin-bar weighted" style="height:'+Math.max(2,100*x.weighted/max)+'%" title="Weighted '+x.weighted.toFixed(1)+'%"></div></div><b>'+x.label+'</b><small>Raw '+x.raw.toFixed(1)+'%</small><small>Weighted '+x.weighted.toFixed(1)+'%</small><small>'+x.n+' games</small></div>').join("")+'</div><p class="muted tiny">n='+rawDen+' historical games · effective weighted sample '+effective.toFixed(1)+'</p></section>';
   };
   const scoreDistributionPanel='<h4>Historical outcome frequency distributions</h4><p class="muted small">Actual results from all qualifying historical games (60%+ similarity), independent of sportsbook lines. Team A is the first team in your matchup; Team B is the second. Positive margin means Team A won. These are observed frequencies, not future probabilities.</p><div class="score-histogram-legend"><span><i class="raw"></i> Raw historical frequency</span><span><i class="weighted"></i> Similarity-weighted frequency</span></div><div class="score-dist-grid">'+
     histogram("Combined game points",x=>scoreOf(x),[["<120",v=>v<120],["120–129",v=>v>=120&&v<130],["130–139",v=>v>=130&&v<140],["140–149",v=>v>=140&&v<150],["150–159",v=>v>=150&&v<160],["160–169",v=>v>=160&&v<170],["170+",v=>v>=170]],"The full-game scoring environment.")+
     histogram("Team A points",x=>x.orientation==="home"?N(x.g.homeScore):N(x.g.awayScore),[["<50",v=>v<50],["50–59",v=>v>=50&&v<60],["60–69",v=>v>=60&&v<70],["70–79",v=>v>=70&&v<80],["80–89",v=>v>=80&&v<90],["90+",v=>v>=90]],"Scoring frequency for the first team in your selected matchup.")+
     histogram("Team B points",x=>x.orientation==="home"?N(x.g.awayScore):N(x.g.homeScore),[["<50",v=>v<50],["50–59",v=>v>=50&&v<60],["60–69",v=>v>=60&&v<70],["70–79",v=>v>=70&&v<80],["80–89",v=>v>=80&&v<90],["90+",v=>v>=90]],"Scoring frequency for the second team in your selected matchup.")+
     histogram("Team A scoring margin",x=>x.orientation==="home"?N(x.g.homeScore)-N(x.g.awayScore):N(x.g.awayScore)-N(x.g.homeScore),[["≤−20",v=>v<=-20],["−19 to −10",v=>v>=-19&&v<=-10],["−9 to −1",v=>v>=-9&&v<0],["Tie",v=>v===0],["+1 to +9",v=>v>0&&v<=9],["+10 to +19",v=>v>=10&&v<=19],["+20+",v=>v>=20]],"How comparable games finished relative to Team A.")+
     '</div><p class="muted small">Compare raw and weighted bars: a pattern appearing in both is more robust than one driven by only a few closest analogs.</p>';
   const tierDefs=[["95–100% · Nearly identical",95,100.000001],["90–94% · Elite",90,95],["80–89% · Strong",80,90],["70–79% · Above average",70,80],["60–69% · Moderate",60,70],["50–59% · Weak",50,60],["Below 50% · Poor",0,50]];
   const tierStats=tierDefs.map(([label,lo,hi])=>{
     const a=rows.filter(x=>x.similarity>=lo&&x.similarity<hi);
     const ml=a.map(x=>{const h=N(x.g.homeScore),v=N(x.g.awayScore),m=x.orientation==="home"?h-v:v-h;return m===0?null:m>0?1:0}).filter(x=>x!==null);
     const ats=a.map(x=>{if(x.market.spread===null)return null;const h=N(x.g.homeScore),v=N(x.g.awayScore),hm=h-v;const teamAMargin=x.orientation==="home"?hm:-hm;const cover=teamAMargin+x.market.spread;return Math.abs(cover)<.001?null:cover>0?1:0}).filter(x=>x!==null);
     const totals=a.map(x=>{if(x.market.total===null)return null;const d=N(x.g.homeScore)+N(x.g.awayScore)-x.market.total;return Math.abs(d)<.001?null:d>0?1:0}).filter(x=>x!==null);
     const pct=z=>z.length?(100*z.reduce((p,q)=>p+q,0)/z.length).toFixed(1)+"%":"—";
     return {label,n:a.length,ml,ats,totals,pml:pct(ml),pats:pct(ats),ptot:pct(totals)};
   }).filter(x=>x.n);
   const tierTable='<h4>Historical hit rates by similarity tier</h4><p class="muted small">Unweighted historical hit rates for the comparable games returned in this search. Moneyline is Team A winning outright; ATS is Team A covering; totals is the over rate. Pushes and ties are excluded. Samples may overlap across separate searches.</p><div class="tablewrap"><table><thead><tr><th>Similarity</th><th>Games</th><th>ML hit rate</th><th>ATS hit rate</th><th>Over hit rate</th></tr></thead><tbody>'+tierStats.map(x=>'<tr><td>'+x.label+'</td><td>'+x.n+'</td><td>'+x.pml+' <small>('+x.ml.length+')</small></td><td>'+x.pats+' <small>('+x.ats.length+')</small></td><td>'+x.ptot+' <small>('+x.totals.length+')</small></td></tr>').join("")+'</tbody></table></div>';
   const currentCoverage=(c.coverage*100).toFixed(0);
   const similarities=rows.map(x=>x.similarity),avgSimilarity=mean(similarities),weights=similarities.map(x=>Math.pow(x/100,4)),weightSum=weights.reduce((a,b)=>a+b,0),effectiveN=weightSum?weightSum*weightSum/weights.reduce((a,b)=>a+b*b,0):0;
   const evidence=rows.length>=30&&avgSimilarity>=75?"Strong":rows.length>=15&&avgSimilarity>=70?"Moderate":rows.length>=5?"Limited":"Very limited";
   const evidencePanel='<h4>Evidence quality · separate from predictability</h4><p class="muted small">This describes the amount and closeness of historical evidence, not the chance of a bet winning or the consistency of outcomes.</p><div class="profilegrid"><div><small>Evidence quality</small><b>'+evidence+'</b><small>'+rows.length+' displayed comps</small></div><div><small>Average similarity</small><b>'+avgSimilarity.toFixed(1)+'%</b><small>Resemblance, not probability</small></div><div><small>Effective weighted sample</small><b>'+effectiveN.toFixed(1)+'</b><small>After similarity weighting</small></div><div><small>Highest similarity</small><b>'+Math.max(...similarities).toFixed(1)+'%</b><small>'+rows.filter(x=>x.similarity>=80).length+' comparisons at 80%+</small></div></div>';
   const audit=rows.audit||{eligible:rows.length,seasons:[],tier80_89:0,tier90_94:0,tier95_100:0,atLeast80:0,pctAtLeast80:0,max:rows[0]?.similarity??null,meanCoverage:0};
   const strongCount=audit.tier80_89+audit.tier90_94+audit.tier95_100; const auditPanel='<h4>Historical candidate funnel & similarity coverage</h4><p class="muted small">The environment-compatible pool is only the first screen; it is NOT the count of strong matches. Actual similarity tiers below are calculated after strict 24/30 feature coverage (at least 12 per team).</p><div class="profilegrid"><div><small>Environment-compatible pool · pre-similarity</small><b>'+audit.eligible+'</b><small>Across '+audit.seasons.length+' seasons: '+audit.seasons.join(", ")+'</small></div><div><small>Actual 80%+ strong matches</small><b>'+strongCount+'</b><small>After feature and similarity filters</small></div><div><small>60%+ primary matches</small><b>'+audit.atLeast60+'</b><small>After similarity floor</small></div><div><small>Best absolute similarity</small><b>'+(audit.max===null?"—":audit.max.toFixed(1)+"%")+'</b><small>Highest score after environment screen</small></div><div><small>60%+ matches</small><b>'+audit.atLeast60+'</b><small>'+audit.pctAtLeast60.toFixed(1)+'% of eligible pool</small></div><div><small>Average feature coverage</small><b>'+audit.meanCoverage.toFixed(1)+'%</b><small>Across eligible comparisons</small></div></div><div class="tablewrap"><table><thead><tr><th>Absolute similarity tier</th><th>Environment-compatible games</th></tr></thead><tbody><tr><td>95–100% · Nearly identical</td><td>'+audit.tier95_100+'</td></tr><tr><td>90–94% · Elite</td><td>'+audit.tier90_94+'</td></tr><tr><td>80–89% · Strong</td><td>'+audit.tier80_89+'</td></tr><tr><td>70–79% · Above average</td><td>'+audit.tier70_79+'</td></tr><tr><td>60–69% · Moderate</td><td>'+audit.tier60_69+'</td></tr></tbody></table></div><p class="muted small">A high percentile within the candidate pool for a matchup is not the same as an 80%+ absolute similarity score. This audit reports absolute scores and does not manufacture high matches.</p>';
   el.className="results";
   el.innerHTML=autoFinderPanel+scoreDistributionPanel+auditPanel+evidencePanel+volatilityPanel+'<div class="profilegrid"><div><small>Team A adjusted offense</small><b>'+c.a.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.a.n+' recent games (rolling)</small></div><div><small>Team A adjusted defense</small><b>'+c.a.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.a.n+' GP</small></div><div><small>Team A adjusted pace</small><b>'+c.a.p.toFixed(1)+'</b><small>Possessions / game</small></div><div><small>Team B adjusted offense</small><b>'+c.b.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.b.n+' recent games (rolling)</small></div><div><small>Team B adjusted defense</small><b>'+c.b.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.b.n+' GP</small></div><div><small>Team B adjusted pace</small><b>'+c.b.p.toFixed(1)+'</b><small>Possessions / game</small></div></div><div class="profilegrid"><div><small>Team A win rate</small><b>'+rate(win,loss,win+loss)+'</b><small>Ties '+tie+'</small></div><div><small>Team A ATS hit rate</small><b>'+rate(atsW,atsL,atsW+atsL)+'</b><small>Pushes '+atsP+' · no-line '+(rows.length-atsN)+'</small></div><div><small>Over hit rate</small><b>'+rate(ouW,ouL,ouW+ouL)+'</b><small>Pushes '+ouP+' · no-line '+(rows.length-ouN)+'</small></div><div><small>Historical comps</small><b>'+rows.length+'</b><small>Top closest matches</small></div></div>'+tierTable+outcomePanel+'<h4>Closest matchup fingerprint breakdown</h4><div class="profilegrid">'+breakdown+'</div><p class="muted small">Strict filter: current teams and historical teams each need at least five completed prior games. At least 24 of 30 team-feature comparisons must be present, with at least 12 from each team. This prevents incomplete profiles from receiving inflated similarity scores. Small samples are regressed toward league averages. Feature differences use fixed basketball-unit tolerances rather than being rescaled against the historical comparison pool; missing metrics are excluded, never zero-filled. Qualifying comparisons require each team’s pace to be within two possessions of its matching target team and 60%+ absolute radar-fingerprint similarity; 80%+ denotes a strong match. All 15 metrics per team contribute when available: adjusted offense, adjusted defense, pace, eFG%, turnover rate, offensive rebound rate, free-throw rate, 3PA rate, 3P%, 2P%, opponent eFG%, opponent turnover rate, opponent 3PA rate, opponent 3P% and opponent 2P%. The two-team fingerprint therefore contains up to 30 weighted features; missing values are excluded rather than treated as zero. Similarity is a statistical distance, not a win probability. Historical snapshots use only games completed before each matchup. Current fingerprint data coverage: '+currentCoverage+'%. The spread and total you enter are applied only after matching to grade historical outcomes; they never select, filter, rank or score comparable games. Historical closing-line imports are not used for these percentages. Search results include 60%+ matches; 80%+ is the strong-match tier. Venue matching uses same-site historical games when at least five qualify; otherwise it broadens to both venue types.</p>'+cards;
 }
 async function init(){
   let savedGames=[];
   const refreshTeams=async()=>{
     const games=await read("games");savedGames=games;
     const teams=[...new Set(games.flatMap(g=>[g.homeTeam,g.awayTeam]).filter(Boolean))].sort();
     ["hmTeamA","hmTeamB"].forEach((id,i)=>{
       const e=$(id),oldValue=e.value;
       e.innerHTML='<option value="">Select a team</option>'+teams.map(t=>'<option>'+t.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</option>').join("");
       if(teams.includes(oldValue))e.value=oldValue;
       else {const preferred=i===0?"Kentucky":"Kansas";if(teams.includes(preferred))e.value=preferred;}
     });
     return {games,teams};
   };
   const btn=$("runMatchupComps");if(!btn)return;
   // Bind immediately so a slow first IndexedDB read cannot leave a dead button.
   btn.addEventListener("click",async()=>{
     const el=$("matchupCompsResults");
     btn.disabled=true;btn.textContent="Loading saved game data…";
     el.className="results empty";el.textContent="Refreshing saved games and building the matchup profile…";
     try{
       const {games,teams}=await refreshTeams();
       const a=$("hmTeamA").value,b=$("hmTeamB").value;
       if(!games.length)throw Error("No historical games are saved in this browser yet. Open Data Center, confirm the imported game count, and try again.");
       if(!a||!b||a===b)throw Error("Choose two different teams. Your saved teams have been refreshed above.");
       if(!teams.includes(a)||!teams.includes(b))throw Error("The selected teams were not found in the saved dataset. Choose them again.");
       btn.textContent="Building pregame ratings…";
       const spread=N($("hmSpread").value),total=N($("hmTotal").value),neutral=$("hmSite").value==="neutral";
       const now=new Date(),localDate=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0"),targetDate=$("scheduleDate")?.value||localDate;
      const rows=candidates(games,a,b,$("hmYears").value,$("hmCount").value==="all"?Infinity:Number($("hmCount").value),spread,total,neutral,targetDate);
       rows.forEach(x=>{x.market={spread,total,providers:0}});
       render(rows);
     }catch(e){
       el.className="results empty";
       el.textContent="Matchup generation could not complete: "+(e?.message||String(e));
       console.error("CBB LAB matchup generation failed",e);
     }finally{
       btn.disabled=false;btn.textContent="Generate matchup distributions";
     }
   });
   try{await refreshTeams();}
   catch(e){
     const el=$("matchupCompsResults");
     if(el){el.className="results empty";el.textContent="Saved games are still loading. Tap Generate matchup distributions again in a moment. Details: "+(e?.message||String(e));}
     console.error("CBB LAB matchup team initialization failed",e);
   }
 }

 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>init().catch(e=>console.error(e)));else init().catch(e=>console.error(e));
})();