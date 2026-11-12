/* Shared opponent-adjusted CBB ratings.
   Offense/defense are neutral-court, per-100-possession estimates adjusted iteratively
   for opponent quality. Tempo is estimated independently from opponent pace. */
(function(g){
 const N=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
 const mean=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 const pct=x=>x!==null&&Math.abs(x)<=1.5?x*100:x;
 const KEYS=["efg","tov","orb","ftr","threeRate","threePct","twoPct","oppEfg","oppTov","oppThreeRate","oppThreePct","oppTwoPct"];
 function rowsFrom(games){return games.flatMap(g=>{
  const hs=N(g.homeScore),as=N(g.awayScore),hp=N(g.home_pace),ap=N(g.away_pace);
  if(!g.homeTeam||!g.awayTeam||hs===null||as===null||!(hp>0)||!(ap>0))return[];
  const make=(side,team,opp,score,against,pace)=>{
   const other=side==="home"?"away":"home",v=k=>pct(N(g[side+"_"+k])),ov=k=>pct(N(g[other+"_"+k]));
   return{team,opp,gameId:String(g.id??g.sourceGameId??g.gameDate??""),gameDate:g.gameDate||g.startDate||g.date||"",home:side==="home",neutral:!!g.neutralSite,off:score/pace*100,def:against/pace*100,pace,
    efg:v("efg"),tov:v("tov"),orb:v("orb"),ftr:v("ftr"),threeRate:v("threeRate"),threePct:v("threePct"),twoPct:v("twoPct"),
    oppEfg:ov("efg"),oppTov:ov("tov"),oppThreeRate:ov("threeRate"),oppThreePct:ov("threePct"),oppTwoPct:ov("twoPct")};
  };
  return[make("home",g.homeTeam,g.awayTeam,hs,as,hp),make("away",g.awayTeam,g.homeTeam,as,hs,ap)];
 })}
 function build(games,options={}){
  const max=options.maxPerTeam??10,paceGames=options.paceGames||games,all=rowsFrom(games),paceRows=rowsFrom(paceGames),by=new Map(),paceBy=new Map();
  all.forEach(r=>{if(!by.has(r.team))by.set(r.team,[]);by.get(r.team).push(r)});
  paceRows.forEach(r=>{if(!paceBy.has(r.team))paceBy.set(r.team,[]);paceBy.get(r.team).push(r)});
  for(const [t,a] of by){a.sort((x,y)=>String(x.gameDate||"").localeCompare(String(y.gameDate||"")));if(a.length>max)by.set(t,a.slice(-max))}
  if(!by.size)return new Map();
  const model=[...by.values()].flat(),teams=[...by.keys()],homeDiff=[],paired=new Map();
  all.forEach(r=>{if(!r.neutral){if(!paired.has(r.gameId))paired.set(r.gameId,[]);paired.get(r.gameId).push(r)}});
  for(const pair of paired.values()){const h=pair.find(r=>r.home),a=pair.find(r=>!r.home);if(h&&a)homeDiff.push(h.off-a.off)}
  const hca=mean(homeDiff)||0,half=hca/2;
  model.forEach(r=>{r.no=r.off-(r.neutral?0:(r.home?half:-half));r.nd=r.def+(r.neutral?0:(r.home?half:-half))});
  const lgO=mean(model.map(r=>r.no)),lgD=mean(model.map(r=>r.nd)),lgP=mean(paceRows.map(r=>r.pace)),league={};
  KEYS.forEach(k=>league[k]=mean(model.map(r=>r[k]).filter(Number.isFinite)));
  let cur=new Map(teams.map(t=>{const a=by.get(t);return[t,{o:mean(a.map(r=>r.no)),d:mean(a.map(r=>r.nd)),n:a.length}]}));
  const paceTeams=[...paceBy.keys()];let tempo=new Map(paceTeams.map(t=>[t,mean(paceBy.get(t).map(r=>r.pace))]));
  for(let iter=0;iter<20;iter++){
   const next=new Map();
   for(const t of teams){const a=by.get(t),w=a.length/(a.length+6);
    const o=mean(a.map(r=>r.no-((cur.get(r.opp)?.d??lgD)-lgD))),d=mean(a.map(r=>r.nd-((cur.get(r.opp)?.o??lgO)-lgO)));
    next.set(t,{o:w*o+(1-w)*lgO,d:w*d+(1-w)*lgD,n:a.length})}
   cur=next;const nextTempo=new Map();
   for(const t of paceTeams){const a=paceBy.get(t),w=a.length/(a.length+6),p=mean(a.map(r=>r.pace-((tempo.get(r.opp)??lgP)-lgP)));nextTempo.set(t,w*p+(1-w)*lgP)}
   tempo=nextTempo;
  }
  const result=new Map();
  for(const t of teams){const a=by.get(t),q=cur.get(t),w=a.length/(a.length+6),v={n:a.length,o:q.o,d:q.d,p:tempo.get(t)??mean(a.map(r=>r.pace)),rawO:mean(a.map(r=>r.off)),rawD:mean(a.map(r=>r.def)),rawP:mean((paceBy.get(t)||[]).map(r=>r.pace)),homeCourtEstimate:hca};
   KEYS.forEach(k=>{const z=mean(a.map(r=>r[k]).filter(Number.isFinite)),prior=league[k];v[k]=z===null?null:(prior===null?z:w*z+(1-w)*prior)});result.set(t,v)}
  return result;
 }
 g.CBBAdjustedRatings={build,rowsFrom};
})(window);
