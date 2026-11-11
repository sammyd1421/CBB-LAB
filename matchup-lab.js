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
   const usedA=v1.slice(0,FEATURE_KEYS.length).reduce((n,x,i)=>n+(Number.isFinite(x)&&Number.isFinite(v2[i])?1:0),0);
   const usedB=v1.slice(FEATURE_KEYS.length).reduce((n,x,i)=>n+(Number.isFinite(x)&&Number.isFinite(v2[FEATURE_KEYS.length+i])?1:0),0);
   if(used<12||usedA<5||usedB<5||weight===0)return null;
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
 function marketFor(g,lines){
   const rec=lines.find(x=>String(x.gameId)===String(g.sourceGameId||String(g.id||"").replace("cbbd-","")));
   const entries=(rec?.lines||[]).filter(x=>N(x.spread)!==null||N(x.overUnder)!==null);
   return {spread:entries.length?mean(entries.map(x=>N(x.spread)).filter(Number.isFinite)):null,total:entries.length?mean(entries.map(x=>N(x.overUnder)).filter(Number.isFinite)):null,providers:entries.length};
 }
 let snapshotCacheGames=null,snapshotCache=new Map();
 function candidates(games,teamA,teamB,years,count,spread,total,neutral){
   const seasons=[...new Set(games.map(g=>Number(g.season)).filter(Number.isFinite))].sort((a,b)=>a-b);
   const currentSeason=seasons[seasons.length-1];if(!currentSeason)throw Error("No imported season data found.");
   const targetSeasons=years==="all"?seasons.filter(s=>s<currentSeason):seasons.filter(s=>s<currentSeason&&s>=currentSeason-Number(years));
   const relevantGames=games.filter(g=>targetSeasons.includes(Number(g.season))||Number(g.season)===currentSeason);
   if(snapshotCacheGames!==games){snapshotCacheGames=games;snapshotCache.clear()}
   const cacheKey=years;
   if(!snapshotCache.has(cacheKey))snapshotCache.set(cacheKey,buildSnapshots(relevantGames));
   const built=snapshotCache.get(cacheKey);
   const currentGames=relevantGames.filter(g=>Number(g.season)===currentSeason&&N(g.homeScore)!==null&&N(g.awayScore)!==null).sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   if(!currentGames.length)throw Error("No completed games in the current season. Import current-season game data first.");
   const currentSnap=built.seasonFinal.get(String(currentSeason))||new Map();
   const current=vector(currentSnap,teamA,teamB,1);
   if(!current)throw Error("Could not build a matchup profile. Each team needs at least one completed game with pace data.");
   const historical=relevantGames.filter(g=>targetSeasons.includes(Number(g.season))&&N(g.homeScore)!==null&&N(g.awayScore)!==null).sort((a,b)=>String(a.gameDate).localeCompare(String(b.gameDate)));
   const raw=[];
   // Rebuild a strictly pregame snapshot for each historical matchup.
   for(const g of historical){
     const cutoff=String(g.gameDate||"");if(!cutoff)continue;
     const snap=built.snapshots.get(String(g.season)+"|"+cutoff)||new Map();
     const h=vector(snap,g.homeTeam,g.awayTeam,3),a=vector(snap,g.awayTeam,g.homeTeam,3);
     if(h)raw.push({g,orientation:"home",v:h.v});
     if(a)raw.push({g,orientation:"away",v:a.v});
   }
   const siteMatches=raw.filter(x=>!!x.g.neutralSite===!!neutral);
   if(siteMatches.length>=5){raw.splice(0,raw.length,...siteMatches)}
   if(!raw.length)throw Error("No historical games have sufficient prior-game data for this venue. Try the other site setting or import more history.");
   const scales=current.v.map((_,i)=>std(raw.map(x=>x.v[i]).filter(Number.isFinite)));
   const unique=new Map();
   for(const x of raw){const scored=distance(current.v,x.v,scales);if(!scored)continue;const old=unique.get(String(x.g.id));if(!old||scored.distance<old.distance)unique.set(String(x.g.id),{...x,...scored})}
   const ranked=[...unique.values()].sort((a,b)=>a.distance-b.distance).map(x=>({...x,market:{spread,total,providers:0},similarity:100/(1+x.distance),current}));
   const tier=(lo,hi)=>ranked.filter(x=>x.similarity>=lo&&x.similarity<hi).length;
   const audit={eligible:ranked.length,seasons:targetSeasons.slice().sort((a,b)=>a-b),tier80_89:tier(80,90),tier90_94:tier(90,95),tier95_100:tier(95,100.000001),atLeast80:tier(80,100.000001),pctAtLeast80:ranked.length?100*tier(80,100.000001)/ranked.length:0,max:ranked[0]?.similarity??null,meanCoverage:ranked.length?100*mean(ranked.map(x=>x.coverage)):0};
   const result=ranked.slice(0,count);result.audit=audit;return result;
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
     if(x.market.spread!==null){atsN++;const aCover=teamAMargin+x.market.spread;if(Math.abs(aCover)<.001){atsP++;result.push("ATS push")}else if(aCover>0){atsW++;result.push("Team A covered")}else{atsL++;result.push("Team A did not cover")}}
     if(x.market.total!==null){ouN++;const d=total-x.market.total;if(Math.abs(d)<.001){ouP++;result.push("total push")}else if(d>0){ouW++;result.push("over")}else{ouL++;result.push("under")}}
     const spread=x.market.spread===null?"No spread":"Team A spread "+x.market.spread.toFixed(1);
     const marketTotal=x.market.total===null?"No total":"Total "+x.market.total.toFixed(1);
     return '<div class="result-row"><div><b>'+g.homeTeam+' vs '+g.awayTeam+'</b><small>'+g.season+' · '+String(g.gameDate||"").slice(0,10)+' · '+g.homeScore+'–'+g.awayScore+' · '+spread+' · '+marketTotal+'</small><small>'+outcome+(result.length?" · "+result.join(" · "):"")+'</small></div><span class="score '+(x.similarity>=80?"strongmatch":"")+'">'+x.similarity.toFixed(0)+'%'+(x.similarity>=80?' · STRONG':'')+'</span></div>';
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
   const volatility=(label,values)=>{const a=values.filter(Number.isFinite);if(!a.length)return '<tr><td>'+label+'</td><td>—</td><td>—</td><td>—</td><td>—</td><td>0</td></tr>';const avg=mean(a),med=median(a),sd=Math.sqrt(mean(a.map(x=>(x-avg)**2)));return '<tr><td>'+label+'</td><td>'+avg.toFixed(1)+'</td><td>'+med.toFixed(1)+'</td><td>'+sd.toFixed(1)+'</td><td>'+Math.min(...a).toFixed(1)+' to '+Math.max(...a).toFixed(1)+'</td><td>'+a.length+'</td></tr>';};
   const marginValues=rows.map(x=>{const h=N(x.g.homeScore),a=N(x.g.awayScore);return x.orientation==="home"?h-a:a-h;});
   const totalValues=rows.map(x=>N(x.g.homeScore)+N(x.g.awayScore));
   const teamAValues=rows.map(x=>x.orientation==="home"?N(x.g.homeScore):N(x.g.awayScore));
   const teamBValues=rows.map(x=>x.orientation==="home"?N(x.g.awayScore):N(x.g.homeScore));
   const volatilityPanel='<h4>Outcome consistency & volatility</h4><p class="muted small">These measurements describe how repeatable the historical outcomes were across the selected stylistic comps. High similarity does not imply low outcome volatility.</p><div class="tablewrap"><table><thead><tr><th>Outcome</th><th>Average</th><th>Median</th><th>Std. dev.</th><th>Historical range</th><th>Games</th></tr></thead><tbody>'+volatility("Team A scoring margin",marginValues)+volatility("Combined points",totalValues)+volatility("Team A points",teamAValues)+volatility("Team B points",teamBValues)+'</tbody></table></div><p class="muted small">Large standard deviations and wide ranges indicate inconsistent outcomes, even when the stylistic similarity score is high.</p>';
   const outcomePanel='<h4>Similarity-weighted outcome distributions</h4><p class="muted small">Closer historical matches carry more weight (similarity relative to the top match, raised to the fourth power). These are historical frequencies, not calibrated probabilities. Positive ATS margin means Team A covered; positive total difference means over.</p><div class="profilegrid"><div><small>Team A ATS hit rate</small><b>'+weightedRate("ats")+'</b><small>Non-push comps with spread lines</small></div><div><small>Over hit rate</small><b>'+weightedRate("ou")+'</b><small>Non-push comps with total lines</small></div><div><small>Team A over implied team total</small><b>'+weightedRate("aTT")+'</b><small>Derived from spread + total</small></div><div><small>Team B over implied team total</small><b>'+weightedRate("bTT")+'</b><small>Derived from spread + total</small></div></div><div class="dist-grid">'+dist("Team A ATS margin","ats","Cover margin") +dist("Game total vs your line","ou","Points above/below total") +dist("Team A points vs implied team total","aTT","Points above/below derived team total") +dist("Team B points vs implied team total","bTT","Points above/below derived team total")+'</div>';
   const tierDefs=[["90–100%",90,100],["80–89%",80,90],["70–79%",70,80],["60–69%",60,70],["50–59%",50,60],["Below 50%",0,50]];
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
   const audit=rows.audit||{eligible:rows.length,seasons:[],tier80_89:0,tier90_94:0,tier95_100:0,atLeast80:0,pctAtLeast80:0,max:rows[0]?.similarity??null,meanCoverage:0};
   const auditPanel='<h4>Five-season similarity coverage audit</h4><p class="muted small">This checks every eligible historical matchup before the display limit is applied. No score thresholds are relaxed.</p><div class="profilegrid"><div><small>Eligible historical comparisons</small><b>'+audit.eligible+'</b><small>Across '+audit.seasons.length+' seasons: '+audit.seasons.join(", ")+'</small></div><div><small>Best absolute similarity</small><b>'+(audit.max===null?"—":audit.max.toFixed(1)+"%")+'</b><small>Highest score in the full eligible pool</small></div><div><small>80%+ matches</small><b>'+audit.atLeast80+'</b><small>'+audit.pctAtLeast80.toFixed(1)+'% of eligible pool</small></div><div><small>Average feature coverage</small><b>'+audit.meanCoverage.toFixed(1)+'%</b><small>Across eligible comparisons</small></div></div><div class="tablewrap"><table><thead><tr><th>Absolute similarity tier</th><th>All eligible games</th></tr></thead><tbody><tr><td>95–100%</td><td>'+audit.tier95_100+'</td></tr><tr><td>90–94%</td><td>'+audit.tier90_94+'</td></tr><tr><td>80–89%</td><td>'+audit.tier80_89+'</td></tr></tbody></table></div><p class="muted small">A high percentile within a matchup's candidate pool is not the same as an 80%+ absolute similarity score. This audit reports absolute scores and does not manufacture high matches.</p>';
   el.className="results";
   el.innerHTML=auditPanel+volatilityPanel+'<div class="profilegrid"><div><small>Team A adjusted offense</small><b>'+c.a.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.a.n+' GP</small></div><div><small>Team A adjusted defense</small><b>'+c.a.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.a.n+' GP</small></div><div><small>Team A adjusted pace</small><b>'+c.a.p.toFixed(1)+'</b><small>Possessions / game</small></div><div><small>Team B adjusted offense</small><b>'+c.b.o.toFixed(1)+'</b><small>Pts / 100 poss · '+c.b.n+' GP</small></div><div><small>Team B adjusted defense</small><b>'+c.b.d.toFixed(1)+'</b><small>Pts allowed / 100 poss · '+c.b.n+' GP</small></div><div><small>Team B adjusted pace</small><b>'+c.b.p.toFixed(1)+'</b><small>Possessions / game</small></div></div><div class="profilegrid"><div><small>Team A win rate</small><b>'+rate(win,loss,win+loss)+'</b><small>Ties '+tie+'</small></div><div><small>Team A ATS hit rate</small><b>'+rate(atsW,atsL,atsW+atsL)+'</b><small>Pushes '+atsP+' · no-line '+(rows.length-atsN)+'</small></div><div><small>Over hit rate</small><b>'+rate(ouW,ouL,ouW+ouL)+'</b><small>Pushes '+ouP+' · no-line '+(rows.length-ouN)+'</small></div><div><small>Historical comps</small><b>'+rows.length+'</b><small>Top closest matches</small></div></div>'+tierTable+outcomePanel+'<h4>Closest matchup fingerprint breakdown</h4><div class="profilegrid">'+breakdown+'</div><p class="muted small">Adaptive filter: current teams can qualify with one completed game; historical comparisons need at least three prior games per team. At least 12 of 30 team-feature comparisons must be present, with at least five from each team. Small samples are regressed toward league averages. All available profile features are standardized against the historical comparison pool; missing metrics are excluded, never zero-filled. All 15 metrics per team contribute when available: adjusted offense, adjusted defense, pace, eFG%, turnover rate, offensive rebound rate, free-throw rate, 3PA rate, 3P%, 2P%, opponent eFG%, opponent turnover rate, opponent 3PA rate, opponent 3P% and opponent 2P%. The two-team fingerprint therefore contains up to 30 weighted features; missing values are excluded rather than treated as zero. Similarity is a statistical distance, not a win probability. Historical snapshots use only games completed before each matchup. Current fingerprint data coverage: '+currentCoverage+'%. The spread and total are the values you entered; historical closing-line imports are not used for these percentages. Venue matching uses same-site historical games when at least five qualify; otherwise it broadens to both venue types.</p>'+cards;
 }
 async function init(){
   let savedGames=[];
   const refreshTeams=async()=>{
     const games=await read("games");savedGames=games;
     const teams=[...new Set(games.flatMap(g=>[g.homeTeam,g.awayTeam]).filter(Boolean))].sort();
     ["hmTeamA","hmTeamB"].forEach((id,i)=>{const e=$(id),old=e.value;e.innerHTML='<option value="">Select a team</option>'+teams.map(t=>'<option>'+t.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</option>').join("");const preferred=i===0?"Kentucky":"Kansas";if(teams.includes(old))e.value=old;else if(teams.includes(preferred))e.value=preferred});
     return {games,teams};
   };
   await refreshTeams();
   const btn=$("runMatchupComps");if(!btn)return;
   btn.addEventListener("click",async()=>{
     const a=$("hmTeamA").value,b=$("hmTeamB").value;
     if(!a||!b||a===b){$("matchupCompsResults").textContent="Choose two different teams.";return}
     btn.disabled=true;btn.textContent="Using saved game data…";
     try{
       const games=savedGames,teams=[...new Set(games.flatMap(g=>[g.homeTeam,g.awayTeam]).filter(Boolean))];
       if(!games.length)throw Error("No games are saved in this browser yet. Open Data Center and check the imported game count.");
       if(!teams.includes(a)||!teams.includes(b))throw Error("The selected teams were not found in the refreshed saved dataset. Choose them again.");
       btn.textContent="Building pregame ratings…";
       const spread=N($("hmSpread").value),total=N($("hmTotal").value),neutral=$("hmSite").value==="neutral";
       const rows=candidates(games,a,b,$("hmYears").value,Number($("hmCount").value),spread,total,neutral);
       rows.forEach(x=>{x.market={spread,total,providers:0}});
       render(rows);
     }catch(e){$("matchupCompsResults").className="results empty";$("matchupCompsResults").textContent=e.message}
     finally{btn.disabled=false;btn.textContent="Generate matchup distributions"}
   });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>init().catch(e=>console.error(e)));else init().catch(e=>console.error(e));
})();