/* CBB LAB opponent-adjusted ratings engine v3.
   Quality layer: season-weighted, game-level joint opponent adjustment with
   ridge-style shrinkage. Style layer: recent team-game fingerprint metrics.
   Pace is a separate opponent-adjusted model of shared game possessions.
   All inputs must be strictly pregame when used for historical snapshots. */
(function(g){
 const N=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
 const mean=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 const wmean=a=>{let sw=0,s=0;for(const x of a)if(Number.isFinite(x.v)&&Number.isFinite(x.w)&&x.w>0){sw+=x.w;s+=x.v*x.w}return sw?s/sw:null};
 const pct=x=>x!==null&&Math.abs(x)<=1.5?x*100:x;
 const KEYS=["efg","tov","orb","ftr","threeRate","threePct","twoPct","oppEfg","oppTov","oppOrb","oppFtr","oppThreeRate","oppThreePct","oppTwoPct"];
 function rowsFrom(games){
  const out=[];
  for(const g of games){
   const hs=N(g.homeScore),as=N(g.awayScore),hp=N(g.home_pace),ap=N(g.away_pace);
   if(!g.homeTeam||!g.awayTeam||hs===null||as===null||!(hp>0)||!(ap>0))continue;
   const id=String(g.id??g.sourceGameId??g.gameDate??out.length),date=String(g.gameDate||g.startDate||g.date||"");
   const make=(side,team,opp,score,against,pace)=>{
    const other=side==="home"?"away":"home",v=k=>pct(N(g[side+"_"+k])),ov=k=>pct(N(g[other+"_"+k]));
    return{team,opp,gameId:id,gameDate:date,season:String(g.season||""),home:side==="home",neutral:!!g.neutralSite,
     off:score/pace*100,def:against/pace*100,pace,
     efg:v("efg"),tov:v("tov"),orb:v("orb"),ftr:v("ftr"),threeRate:v("threeRate"),threePct:v("threePct"),twoPct:v("twoPct"),
     oppEfg:ov("efg"),oppTov:ov("tov"),oppOrb:ov("orb")===null?null:100-ov("orb"),oppFtr:ov("ftr"),oppThreeRate:ov("threeRate"),oppThreePct:ov("threePct"),oppTwoPct:ov("twoPct")};
   };
   out.push(make("home",g.homeTeam,g.awayTeam,hs,as,hp),make("away",g.awayTeam,g.homeTeam,as,hs,ap));
  }
  return out;
 }
 function build(games,options={}){
  const max=options.maxPerTeam??10,paceGames=options.paceGames||games;
  const all=rowsFrom(games),paceRows=rowsFrom(paceGames);
  if(!all.length)return new Map();
  const seasons=games.map(x=>Number(x.season)).filter(Number.isFinite),currentSeason=seasons.length?Math.max(...seasons):null;
  // Current-season games carry full weight. Prior seasons act only as a weak,
  // decaying preseason prior rather than being pooled as if they were current.
  const seasonWeight=s=>{const n=Number(s);if(!Number.isFinite(currentSeason)||!Number.isFinite(n))return .1;if(n===currentSeason)return 1;const age=Math.max(1,currentSeason-n);return .12*Math.pow(.45,age-1)};
  const quality=all.map(r=>({...r,weight:seasonWeight(r.season)}));
  const byQuality=new Map(),byStyle=new Map(),byPace=new Map();
  for(const r of quality){if(!byQuality.has(r.team))byQuality.set(r.team,[]);byQuality.get(r.team).push(r)}
  const styleRows=rowsFrom(games);
  for(const r of styleRows){if(!byStyle.has(r.team))byStyle.set(r.team,[]);byStyle.get(r.team).push(r)}
  for(const [t,a] of byStyle){a.sort((x,y)=>x.gameDate.localeCompare(y.gameDate));if(Number.isFinite(max)&&a.length>max)byStyle.set(t,a.slice(-max))}
  for(const r of paceRows){if(!byPace.has(r.team))byPace.set(r.team,[]);byPace.get(r.team).push(r)}
  const teams=[...byQuality.keys()];
  const currentRows=quality.filter(r=>!Number.isFinite(currentSeason)||Number(r.season)===currentSeason);
  const baseRows=currentRows.length?currentRows:quality;
  const leagueO=wmean(baseRows.map(r=>({v:r.off,w:r.weight})))??mean(all.map(r=>r.off));
  const leagueD=wmean(baseRows.map(r=>({v:r.def,w:r.weight})))??mean(all.map(r=>r.def));
  const paceBase=mean(paceRows.map(r=>r.pace))??mean(all.map(r=>r.pace));
  // Estimate home-court effect from paired game efficiencies, not point totals.
  const paired=new Map();for(const r of quality){if(!r.neutral){if(!paired.has(r.gameId))paired.set(r.gameId,[]);paired.get(r.gameId).push(r)}}
  const hcaPairs=[];for(const p of paired.values()){const h=p.find(x=>x.home),a=p.find(x=>!x.home);if(h&&a)hcaPairs.push({v:h.off-a.off,w:Math.min(h.weight,a.weight)})}
  const hca=wmean(hcaPairs)??0;
  const half=hca/2;
  const adjRows=quality.map(r=>({...r,no:r.off-(r.neutral?0:r.home?half:-half),nd:r.def+(r.neutral?0:r.home?half:-half)}));
  const qBy=new Map();for(const r of adjRows){if(!qBy.has(r.team))qBy.set(r.team,[]);qBy.get(r.team).push(r)}
  let offense=new Map(teams.map(t=>[t,0])),defense=new Map(teams.map(t=>[t,0]));
  const lambda=5;
  for(let iter=0;iter<100;iter++){
   const nextO=new Map(),nextD=new Map();
   for(const t of teams){
    const a=qBy.get(t)||[],o=wmean(a.map(r=>({v:r.no-leagueO-(defense.get(r.opp)||0),w:r.weight}))),d=wmean(a.map(r=>({v:r.nd-leagueD-(offense.get(r.opp)||0),w:r.weight})));
    const sw=a.reduce((s,r)=>s+r.weight,0),shrink=sw/(sw+lambda);
    nextO.set(t,(o??0)*shrink);nextD.set(t,(d??0)*shrink);
   }
   offense=nextO;defense=nextD;
  }
  // Center team effects so league baseline remains interpretable.
  const centerO=mean([...offense.values()])||0,centerD=mean([...defense.values()])||0;
  for(const t of teams){offense.set(t,offense.get(t)-centerO);defense.set(t,defense.get(t)-centerD)}
  // Opponent-adjusted tempo: shared game pace = league tempo + both team effects.
  let tempoEffect=new Map([...byPace.keys()].map(t=>[t,0]));
  const pTeams=[...tempoEffect.keys()];
  for(let iter=0;iter<100;iter++){
   const next=new Map();
   for(const t of pTeams){
    const a=byPace.get(t)||[],obs=a.map(r=>({v:r.pace-paceBase-(tempoEffect.get(r.opp)||0),w:1}));
    const avg=wmean(obs)??0,shrink=a.length/(a.length+4);
    next.set(t,avg*shrink);
   }
   tempoEffect=next;
  }
  const centerP=mean([...tempoEffect.values()])||0;
  for(const t of pTeams)tempoEffect.set(t,tempoEffect.get(t)-centerP);
  // Style fingerprints are recent observations, with joint opponent correction.
  const styleTeams=[...byStyle.keys()],league={};
  KEYS.forEach(k=>league[k]=mean(styleTeams.flatMap(t=>(byStyle.get(t)||[]).map(r=>r[k]).filter(Number.isFinite))));
  const styleResults=new Map(styleTeams.map(t=>[t,{}]));
  const pairs=[["efg","oppEfg"],["tov","oppTov"],["orb","oppOrb"],["ftr","oppFtr"],["threeRate","oppThreeRate"],["threePct","oppThreePct"],["twoPct","oppTwoPct"]];
  for(const [ownKey,allowedKey] of pairs){
   const lo=league[ownKey],la=league[allowedKey];
   let own=new Map(styleTeams.map(t=>[t,mean(byStyle.get(t).map(r=>r[ownKey]).filter(Number.isFinite))??lo]));
   let allowed=new Map(styleTeams.map(t=>[t,mean(byStyle.get(t).map(r=>r[allowedKey]).filter(Number.isFinite))??la]));
   for(let iter=0;iter<30;iter++){
    const no=new Map(),na=new Map();
    for(const t of styleTeams){const a=byStyle.get(t),n=a.length,w=n/(n+8);
     const x=mean(a.map(r=>Number.isFinite(r[ownKey])?r[ownKey]-((allowed.get(r.opp)??la)-la):null).filter(Number.isFinite));
     const y=mean(a.map(r=>Number.isFinite(r[allowedKey])?r[allowedKey]-((own.get(r.opp)??lo)-lo):null).filter(Number.isFinite));
     no.set(t,x===null?lo:w*x+(1-w)*lo);na.set(t,y===null?la:w*y+(1-w)*la);
    }own=no;allowed=na;
   }
   for(const t of styleTeams){styleResults.get(t)[ownKey]=own.get(t);styleResults.get(t)[allowedKey]=allowed.get(t)}
  }
  const result=new Map();
  for(const t of teams){
   const qa=qBy.get(t)||[],sa=byStyle.get(t)||[],pa=byPace.get(t)||[];
   const current=qa.filter(r=>!Number.isFinite(currentSeason)||Number(r.season)===currentSeason);
   const v={n:sa.length,o:leagueO+(offense.get(t)||0),d:leagueD+(defense.get(t)||0),p:paceBase+(tempoEffect.get(t)||0),
    rawO:wmean(current.map(r=>({v:r.off,w:r.weight}))),rawD:wmean(current.map(r=>({v:r.def,w:r.weight}))),rawP:mean(pa.map(r=>r.pace)),
    homeCourtEstimate:hca,qualityGames:current.length,qualityMethod:"season-weighted joint opponent adjustment",paceMethod:"opponent-adjusted shared-game tempo"};
   const a=sa;
   Object.assign(v,styleResults.get(t)||{});
   result.set(t,v);
  }
  return result;
 }
 g.CBBAdjustedRatings={build,rowsFrom};
})(window);
