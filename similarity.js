/* Shared CBB LAB similarity scale and team-level fingerprint comparison.
   Uses the same 15-feature set, units, weights and strict coverage gate as Matchup Lab. */
(function(g){
 const K=["adjOff","adjDef","pace","efg","tov","orb","ftr","threeRate","threePct","twoPct","oppEfg","oppTov","oppThreeRate","oppThreePct","oppTwoPct"];
 const W=[1.5,1.5,2.0,1.15,.9,.85,.65,.8,1,.9,1.15,.75,.75,.9,.8],S=[6,6,3,5,4,6,8,8,5,5,5,4,8,5,5];
 const score=d=>d===0?100:Math.min(99.9,100*Math.exp(-1.5*d*d));
 function dist(a,b){let sum=0,w=0,used=0;for(let i=0;i<K.length;i++){const x=a[K[i]],y=b[K[i]];if(!Number.isFinite(x)||!Number.isFinite(y))continue;const z=(x-y)/S[i];sum+=W[i]*z*z;w+=W[i];used++}return used>=12&&w?Math.sqrt(sum/w):null}
 function profiles(games){if(!g.CBBTeamProfiles?.build)return[];return g.CBBTeamProfiles.build(games).filter(p=>p.games>=5).map(p=>({...p,team:p.team,season:p.season}))}
 function similar(a,all,o={}){return all.filter(p=>p!==a&&(!o.otherTeams||p.team!==a.team)&&(!o.season||p.season===o.season)).map(p=>({profile:p,distance:dist(a,p)})).filter(x=>x.distance!==null).map(x=>({...x,similarity:score(x.distance)})).filter(x=>x.similarity>=(o.floor||60)).sort((x,y)=>y.similarity-x.similarity).slice(0,o.count||10)}
 g.CBBLabSimilarityScale={floor:60,strong:80,elite:90,score,grade:s=>s>=95?"Nearly identical":s>=90?"Elite match":s>=80?"Strong match":s>=70?"Above average":s>=60?"Moderate similarity":s>=50?"Weak resemblance":"Poor match",distanceFromScore:s=>Math.sqrt(-Math.log(Math.max(s,.000001)/100)/1.5),weight:(s,max)=>Math.pow(s/Math.max(max,1),4)};
 g.CBBAnalytics={profiles,dist,similar};
})(window);