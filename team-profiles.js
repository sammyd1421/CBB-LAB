/* Shared CBB LAB team-profile engine. Missing source fields remain null; no synthetic stats. */
(function(g){
 const N=x=>x===null||x===undefined||x===""?null:(Number.isFinite(Number(x))?Number(x):null);
 const mean=a=>{const v=a.filter(Number.isFinite);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 const pctValue=x=>x!==null&&Math.abs(x)<=1.5?x*100:x;
 const pct=(x,arr,higher=true)=>{const v=arr.filter(Number.isFinite);if(!Number.isFinite(x)||!v.length)return null;const below=v.filter(y=>higher?y<x:y>x).length;const equal=v.filter(y=>y===x).length;return 100*(below+.5*equal)/v.length};
 function build(games){
  const groups=new Map();
  const add=(team,opp,season,game,side,score,oppScore)=>{
   if(!team||!opp||score===null||oppScore===null)return;
   const own=k=>pctValue(N(game[side+"_"+k])),other=k=>pctValue(N(game[(side==="home"?"away":"home")+"_"+k]));
   const pace=own("pace")??N(game[side+"_pace"]);
   const row={team,opp,season:String(season),score,oppScore,pace,
    efg:own("efg"),tov:own("tov"),orb:own("orb"),ftr:own("ftr"),threeRate:own("threeRate"),threePct:own("threePct"),twoPct:own("twoPct"),
    oppEfg:other("efg"),oppTov:other("tov"),oppThreeRate:other("threeRate"),oppThreePct:other("threePct"),oppTwoPct:other("twoPct"),
    off:pace>0?score/pace*100:null,def:pace>0?oppScore/pace*100:null};
   const key=team+"||"+season;if(!groups.has(key))groups.set(key,{team,season:String(season),rows:[]});groups.get(key).rows.push(row);
  };
  games.forEach(x=>{const h=N(x.homeScore),a=N(x.awayScore);if(h===null||a===null)return;add(x.homeTeam,x.awayTeam,x.season,x,"home",h,a);add(x.awayTeam,x.homeTeam,x.season,x,"away",a,h)});
  const out=[...groups.values()].map(p=>{
   const r=p.rows, n=r.length, vals=k=>r.map(x=>x[k]).filter(Number.isFinite);
   const rawOff=mean(vals("off")),rawDef=mean(vals("def")),pace=mean(vals("pace"));
   const profile={team:p.team,season:p.season,games:n,ppg:mean(r.map(x=>x.score)),oppg:mean(r.map(x=>x.oppScore)),margin:mean(r.map(x=>x.score-x.oppScore)),total:mean(r.map(x=>x.score+x.oppScore)),pace,
    offEff:rawOff,defEff:rawDef,adjOff:rawOff,adjDef:rawDef,
    efg:mean(vals("efg")),tov:mean(vals("tov")),orb:mean(vals("orb")),ftr:mean(vals("ftr")),threeRate:mean(vals("threeRate")),threePct:mean(vals("threePct")),twoPct:mean(vals("twoPct")),
    oppEfg:mean(vals("oppEfg")),oppTov:mean(vals("oppTov")),oppThreeRate:mean(vals("oppThreeRate")),oppThreePct:mean(vals("oppThreePct")),oppTwoPct:mean(vals("oppTwoPct"))};
   return profile;
  });
  // Same schedule-adjusted neutral-court efficiency and opponent-adjusted tempo
  // engine used by Matchup Lab; Team Explorer retains its existing presentation.
  const seasons=[...new Set(out.map(p=>p.season))];
  seasons.forEach(season=>{
   const seasonGames=games.filter(x=>String(x.season)===season);
   const ratings=g.CBBAdjustedRatings.build(seasonGames,{maxPerTeam:Infinity,paceGames:seasonGames});
   const values=[...ratings.values()],leagueOff=mean(values.map(x=>x.o)),leagueDef=mean(values.map(x=>x.d));
   out.filter(p=>p.season===season).forEach(p=>{const q=ratings.get(p.team);if(q){p.adjOff=q.o;p.adjDef=q.d;p.pace=q.p;p.offEff=q.rawO;p.defEff=q.rawD;p.homeCourtEstimate=q.homeCourtEstimate;p.leagueOff=leagueOff;p.leagueDef=leagueDef}});
  });
  seasons.forEach(season=>{
   const ps=out.filter(p=>p.season===season);
   const directions={adjOff:true,adjDef:false,pace:true,efg:true,tov:false,orb:true,ftr:true,threeRate:true,threePct:true,twoPct:true,oppEfg:false,oppTov:true,oppThreeRate:false,oppThreePct:false,oppTwoPct:false};
   Object.entries(directions).forEach(([k,higher])=>{const arr=ps.map(p=>p[k]);ps.forEach(p=>{p[k+"Pctile"]=pct(p[k],arr,higher)})});
  });
  return out;
 }
 const groups={
  overall:[["Adjusted offense","adjOffPctile"],["Adjusted defense","adjDefPctile"],["eFG%","efgPctile"],["3P%","threePctPctile"],["Turnover control","tovPctile"],["Off. rebounding","orbPctile"],["Free-throw rate","ftrPctile"],["2P%","twoPctPctile"]],
  offense:[["Adjusted offense","adjOffPctile"],["eFG%","efgPctile"],["3P%","threePctPctile"],["3P attempt rate","threeRatePctile"],["2P%","twoPctPctile"],["Off. rebounding","orbPctile"],["Free-throw rate","ftrPctile"],["Turnover control","tovPctile"]],
  defense:[["Adjusted defense","adjDefPctile"],["Opponent eFG%","oppEfgPctile"],["Opponent 3P%","oppThreePctPctile"],["Opponent 2P%","oppTwoPctPctile"],["Turnovers forced","oppTovPctile"],["Opponent 3P volume","oppThreeRatePctile"]]
 };
 g.CBBTeamProfiles={build,groups};
})(window);
