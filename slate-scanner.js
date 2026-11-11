/* CBB LAB: market-free daily slate historical pattern scanner. */
(()=>{
 const $=id=>document.getElementById(id), KEY="cbb-lab-schedule-2027-v1";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const median=a=>{const z=[...a].sort((x,y)=>x-y),m=Math.floor(z.length/2);return z.length?(z.length%2?z[m]:(z[m-1]+z[m])/2):null};
 const sd=a=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):null};
 const fmt=x=>x===null||!Number.isFinite(x)?"—":x.toFixed(1);
 const schedule=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}};
 const dayKey=g=>{const d=new Date(g.startDate);return Number.isFinite(d.getTime())?d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"):""};
 function dateInit(){const input=$("slateDate");if(!input)return;const today=new Date(),todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");input.value=todayKey}
 function summary(rows){
   const vals=rows.map(x=>({total:Number(x.g.homeScore)+Number(x.g.awayScore),home:x.orientation==="home"?Number(x.g.homeScore):Number(x.g.awayScore),away:x.orientation==="home"?Number(x.g.awayScore):Number(x.g.homeScore)}));
   const totals=vals.map(x=>x.total),homes=vals.map(x=>x.home),aways=vals.map(x=>x.away),margins=vals.map(x=>x.home-x.away);
   const wins=vals.filter(x=>x.home>x.away).length,losses=vals.filter(x=>x.home<x.away).length,ties=vals.length-wins-losses;
   const seasons=[...new Set(rows.map(x=>String(x.g.season)))].sort();
   const avgSim=mean(rows.map(x=>x.similarity));
   const allUnder150=totals.length>=5&&Math.max(...totals)<=150;
   const allHomeUnder80=homes.length>=5&&Math.max(...homes)<=80;
   const allAwayUnder80=aways.length>=5&&Math.max(...aways)<=80;
   const sdTotal=sd(totals),sdMargin=sd(margins);
   return {n:rows.length,seasons,avgSim,topSim:Math.max(...rows.map(x=>x.similarity)),totals,homes,aways,margins,wins,losses,ties,allUnder150,allHomeUnder80,allAwayUnder80,sdTotal,sdMargin,
     totalMean:mean(totals),totalMedian:median(totals),totalMin:Math.min(...totals),totalMax:Math.max(...totals),
     homeMean:mean(homes),awayMean:mean(aways),marginMean:mean(margins)};
 }
 function gameCard(g,s){
   const notes=[];
   if(s.allUnder150)notes.push("No qualifying game exceeded 150 combined points");
   if(s.allHomeUnder80)notes.push("Today's home team scored 80 or fewer in every qualifying comp");
   if(s.allAwayUnder80)notes.push("Today's away team scored 80 or fewer in every qualifying comp");
   const seasonText=s.seasons.map(x=>Number(x)-1+"–"+String(x).slice(-2)).join(", ");
   const stability=s.sdTotal===null?"—":s.sdTotal.toFixed(1)+" pts";
   return '<article class="panel slate-game"><div class="slate-game-head"><div><p class="eyebrow">'+(g.neutralSite?"NEUTRAL SITE":"HOME COURT")+'</p><h3>'+esc(g.awayTeam)+' at '+esc(g.homeTeam)+'</h3><p class="muted small">'+esc(new Date(g.startDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}))+' · '+s.n+' qualifying historical games · '+s.seasons.length+' seasons</p></div><div class="score">'+fmt(s.avgSim)+'%<small class="muted"> avg similarity</small></div></div>'+
   (notes.length?'<div class="slate-flags">'+notes.map(n=>'<p>• '+esc(n)+'</p>').join("")+'</div>':'<p class="muted small">No extreme all-game pattern met the minimum five-game sample rule. Review the distributions below.</p>')+
   '<div class="profilegrid"><div><small>Historical game total</small><b>'+fmt(s.totalMean)+'</b><small>Median '+fmt(s.totalMedian)+' · range '+s.totalMin+'–'+s.totalMax+'</small></div><div><small>Total volatility</small><b>'+stability+'</b><small>Standard deviation</small></div><div><small>Home team average</small><b>'+fmt(s.homeMean)+'</b><small>Points per game</small></div><div><small>Away team average</small><b>'+fmt(s.awayMean)+'</b><small>Points per game</small></div><div><small>Home team won</small><b>'+((100*s.wins/s.n).toFixed(1))+'%</b><small>'+s.wins+' wins · '+s.losses+' losses · '+s.ties+' ties</small></div><div><small>Average home margin</small><b>'+fmt(s.marginMean)+'</b><small>Positive = home team ahead</small></div></div>'+
   '<p class="muted small">Top similarity '+fmt(s.topSim)+'% · historical seasons '+esc(seasonText)+' · total standard deviation '+stability+'. All findings are descriptive historical frequencies, not guarantees or calibrated probabilities.</p></article>';
 }
 async function scan(){
   const btn=$("runSlateScan"),out=$("slateResults"),status=$("slateStatus"),date=$("slateDate").value;
   if(!date){status.textContent="Choose a slate date.";return}
   const slate=schedule().filter(g=>dayKey(g)===date&&g.homeTeam&&g.awayTeam&&g.status!=="cancelled").sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
   if(!slate.length){out.className="results empty";out.textContent="No scheduled games found for this date in the locally saved schedule. Import or refresh the schedule in Data Center.";return}
   btn.disabled=true;btn.textContent="Scanning slate…";out.className="results";out.innerHTML="";
   try{
     const games=await window.CBBLabScanner.loadGames();
     if(!games.length)throw Error("No historical games are saved in this browser. Import the historical dataset in Data Center first.");
     const years=$("slateYears").value,results=[];
     for(let i=0;i<slate.length;i++){
       const g=slate[i];status.textContent="Scanning "+(i+1)+" of "+slate.length+": "+g.awayTeam+" at "+g.homeTeam;
       try{
         const candidates=window.CBBLabScanner.compare(games,g.homeTeam,g.awayTeam,!!g.neutralSite,years);
         const qualifying=candidates.filter(x=>x.similarity>=60);
         if(qualifying.length<5){results.push({g,insufficient:true,n:qualifying.length});continue}
         results.push({g,s:summary(qualifying)});
       }catch(e){results.push({g,error:e.message})}
       await new Promise(resolve=>setTimeout(resolve,0));
     }
     const valid=results.filter(x=>x.s).sort((a,b)=>(b.s.n-a.s.n)||(b.s.avgSim-a.s.avgSim)||(a.s.sdTotal-b.s.sdTotal));
     const noData=results.filter(x=>!x.s);
     const intro='<div class="profilegrid"><div><small>Scheduled games scanned</small><b>'+slate.length+'</b></div><div><small>Games with usable history</small><b>'+valid.length+'</b></div><div><small>Similarity floor</small><b>60%</b></div><div><small>Historical line usage</small><b>None</b></div></div><p class="muted small">Ranked by qualifying sample size, then average similarity, then lower total volatility. Each historical matchup below 60% was discarded. A minimum of five qualifying games is required before a pattern is reported.</p>';
     out.innerHTML=intro+(valid.length?valid.map(x=>gameCard(x.g,x.s)).join(""):'<div class="empty">No games on this slate had at least five historical comparisons at or above 60% similarity. No patterns were manufactured.</div>')+
       (noData.length?'<h3>Insufficient historical comparisons</h3>'+noData.map(x=>'<div class="result-row"><div><b>'+esc(x.g.awayTeam)+' at '+esc(x.g.homeTeam)+'</b><small>'+(x.error?esc(x.error):x.n+' qualifying comparisons; fewer than the five-game minimum')+'</small></div></div>').join(""):"");
     status.textContent="Scan complete · "+slate.length+" games reviewed · "+valid.length+" produced reportable historical samples. No current market lines were used.";
   }catch(e){out.className="results empty";out.textContent=e.message;status.textContent="Scan could not complete."}
   finally{btn.disabled=false;btn.textContent="Scan this date"}
 }
 const btn=$("runSlateScan");if(btn)btn.addEventListener("click",scan);
 dateInit();
})();
