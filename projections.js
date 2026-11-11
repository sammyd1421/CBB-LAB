/* Shared-profile projection baseline. Uses adjusted efficiency and pace when available. */
(function(g){
 function project(a,b,homeAdv=3,neutral=false){
  if(!a||!b)return null;
  const h=neutral?0:(Number(homeAdv)||0);
  if([a.adjOff,a.adjDef,b.adjOff,b.adjDef,a.pace,b.pace,a.leagueOff,b.leagueOff].every(Number.isFinite)){
   const poss=(a.pace+b.pace)/2,league=(a.leagueOff+b.leagueOff)/2;
   const aEff=a.adjOff+b.adjDef-league,bEff=b.adjOff+a.adjDef-league;
   const aPts=aEff*poss/100+h,bPts=bEff*poss/100;
   return{aPts,bPts,total:aPts+bPts,margin:aPts-bPts,possessions:poss,method:"Opponent-adjusted offense + opposing adjusted defense, scaled by projected pace; home-court added to Team A"};
  }
  if(![a.ppg,a.oppg,b.ppg,b.oppg].every(Number.isFinite))return null;
  const ap=(a.ppg+b.oppg)/2+h/2,bp=(b.ppg+a.oppg)/2-h/2;
  return{aPts:ap,bPts:bp,total:ap+bp,margin:ap-bp,method:"Fallback: average of team scoring and opponent scoring averages"};
 }
 g.CBBAnalytics.project=project;
})(window);
