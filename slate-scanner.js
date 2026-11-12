/* "CBB LAB": market-free daily slate historical pattern scanner. */
(()=>{
 const $=id=>document.getElementById(id), KEY="cbb-lab-schedule-2027-v1";
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const median=a=>{const z=[...a].sort((x,y)=>x-y),m=Math.floor(z.length/2);return z.length?(z.length%2?z[m]:(z[m-1]+z[m])/2):null};
 const sd=a=>{const m=mean(a);return a.length?Math.sqrt(mean(a.map(x=>(x-m)**2))):null};
 const quantile=(a,q)=>{const z=[...a].sort((x,y)=>x-y);if(!z.length)return null;const p=(z.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return z[lo]+(z[hi]-z[lo])*(p-lo)};
 const fmt=x=>x===null||!Number.isFinite(x)?"—":x.toFixed(1);
 const schedule=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}};
 window.CBBLabSlate={refresh:()=>{lastValid=[];const out=$("slateResults");if(out&&!out.querySelector(".slate-table-wrap"))out.textContent="Ready to scan the selected date.";}};

 const stateZones={AL:"America/Chicago",AK:"America/Anchorage",HI:"Pacific/Honolulu",AZ:"America/Phoenix",AR:"America/Chicago",CA:"America/Los_Angeles",CO:"America/Denver",CT:"America/New_York",DE:"America/New_York",FL:"America/New_York",GA:"America/New_York",IA:"America/Chicago",ID:"America/Boise",IL:"America/Chicago",IN:"America/Indiana/Indianapolis",KS:"America/Chicago",KY:"America/New_York",LA:"America/Chicago",MA:"America/New_York",MD:"America/New_York",ME:"America/New_York",MI:"America/Detroit",MN:"America/Chicago",MO:"America/Chicago",MS:"America/Chicago",MT:"America/Denver",NC:"America/New_York",ND:"America/Chicago",NE:"America/Chicago",NH:"America/New_York",NJ:"America/New_York",NM:"America/Denver",NV:"America/Los_Angeles",NY:"America/New_York",OH:"America/New_York",OK:"America/Chicago",OR:"America/Los_Angeles",PA:"America/New_York",RI:"America/New_York",SC:"America/New_York",SD:"America/Chicago",TN:"America/Chicago",TX:"America/Chicago",UT:"America/Denver",VA:"America/New_York",VT:"America/New_York",WA:"America/Los_Angeles",WI:"America/Chicago",WV:"America/New_York",WY:"America/Denver",DC:"America/New_York"};
 const zoneFor=g=>{let st=String(g.state||"").trim().toUpperCase();const full={IOWA:"IA","NORTH CAROLINA":"NC","SOUTH CAROLINA":"SC",FLORIDA:"FL",TENNESSEE:"TN",INDIANA:"IN",KENTUCKY:"KY",IDAHO:"ID",TEXAS:"TX",CALIFORNIA:"CA","NEW YORK":"NY",ILLINOIS:"IL",MISSOURI:"MO",KANSAS:"KS",OKLAHOMA:"OK",ARIZONA:"AZ",NEVADA:"NV",UTAH:"UT",COLORADO:"CO",MINNESOTA:"MN",WISCONSIN:"WI",MICHIGAN:"MI",OHIO:"OH",GEORGIA:"GA",ALABAMA:"AL",MISSISSIPPI:"MS",LOUISIANA:"LA",ARKANSAS:"AR",VIRGINIA:"VA",WASHINGTON:"WA",OREGON:"OR",PENNSYLVANIA:"PA",MARYLAND:"MD",MASSACHUSETTS:"MA",CONNECTICUT:"CT","NEW JERSEY":"NJ",DELAWARE:"DE","RHODE ISLAND":"RI",VERMONT:"VT","NEW HAMPSHIRE":"NH",MAINE:"ME","NEW MEXICO":"NM",MONTANA:"MT",WYOMING:"WY","NORTH DAKOTA":"ND","SOUTH DAKOTA":"SD",NEBRASKA:"NE","WEST VIRGINIA":"WV",ALASKA:"AK",HAWAII:"HI","DISTRICT OF COLUMBIA":"DC"};st=full[st]||st;let z=stateZones[st];const city=String(g.city||"").toLowerCase();if(st==="FL"&&/pensacola|tallahassee|panama city/.test(city))z="America/Chicago";if(st==="TN"&&/memphis|nashville|clarksville|jackson/.test(city))z="America/Chicago";if(st==="IN"&&/evansville|gary|hammond|south bend|fort wayne/.test(city))z="America/Indiana/Indianapolis";if(st==="KY"&&/bowling green|paducah|owensboro/.test(city))z="America/Chicago";if(st==="ID"&&/boise|twin falls|pocatello|idaho falls/.test(city))z="America/Boise";return z||null};
 const gameDateKey=g=>{const raw=String(g.startDate||"");if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=new Date(raw);if(!Number.isFinite(d.getTime()))return "";const zone=zoneFor(g);if(!zone)return raw.slice(0,10);const p=new Intl.DateTimeFormat("en-US",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);const v=Object.fromEntries(p.map(x=>[x.type,x.value]));return v.year+"-"+v.month+"-"+v.day};
 const gameTimeLabel=g=>{const raw=String(g.startDate||"");if(!raw||g.startTimeTbd)return "Time TBD";const d=new Date(raw);if(!Number.isFinite(d.getTime()))return "Time TBD";const zone=zoneFor(g);return new Intl.DateTimeFormat("en-US",{timeZone:zone||undefined,hour:"numeric",minute:"2-digit"}).format(d)};
 const isFinished=g=>/^(final|completed|complete|cancelled|canceled|postponed)$/i.test(String(g.status||"").trim());

 const dayKey=gameDateKey;
 function dateInit(){const input=$("slateDate");if(!input)return;const today=new Date(),todayKey=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");if(!input.value)input.value=todayKey;}
 function summary(rows){
   const vals=rows.map(x=>({total:Number(x.g.homeScore)+Number(x.g.awayScore),home:x.orientation==="home"?Number(x.g.homeScore):Number(x.g.awayScore),away:x.orientation==="home"?Number(x.g.awayScore):Number(x.g.homeScore)}));
   const totals=vals.map(x=>x.total),homes=vals.map(x=>x.home),aways=vals.map(x=>x.away),margins=vals.map(x=>x.home-x.away);
   const wins=vals.filter(x=>x.home>x.away).length,losses=vals.filter(x=>x.home<x.away).length,ties=vals.length-wins-losses;
   const seasons=[...new Set(rows.map(x=>String(x.g.season)))].sort();
   const avgSim=mean(rows.map(x=>x.similarity));
   const allUnder150=totals.length>=5&&Math.max(...totals)<=150;
   const allHomeUnder80=homes.length>=5&&Math.max(...homes)<=80;
   const allAwayUnder80=aways.length>=5&&Math.max(...aways)<=80;
   const sdTotal=sd(totals),sdMargin=sd(margins),sdHome=sd(homes),sdAway=sd(aways);
   const twins=rows.filter(x=>x.similarity>=80).sort((a,b)=>b.similarity-a.similarity);
   const closest=rows.slice().sort((a,b)=>b.similarity-a.similarity).slice(0,5);
   const weights=rows.map(x=>Math.pow(x.similarity/100,4)),sw=weights.reduce((a,b)=>a+b,0),ess=sw?sw*sw/weights.reduce((a,b)=>a+b*b,0):0;
   const tierCounts={"95–100":rows.filter(x=>x.similarity>=95).length,"90–94":rows.filter(x=>x.similarity>=90&&x.similarity<95).length,"80–89":rows.filter(x=>x.similarity>=80&&x.similarity<90).length,"70–79":rows.filter(x=>x.similarity>=70&&x.similarity<80).length,"60–69":rows.filter(x=>x.similarity>=60&&x.similarity<70).length};
   const evidence=rows.length>=30&&avgSim>=75?"Strong":rows.length>=15&&avgSim>=70?"Moderate":rows.length>=5?"Limited":"Very limited";
   return {n:rows.length,seasons,avgSim,topSim:Math.max(...rows.map(x=>x.similarity)),twins,closest,totals,homes,aways,margins,wins,losses,ties,allUnder150,allHomeUnder80,allAwayUnder80,sdTotal,sdMargin,sdHome,sdAway,ess,tierCounts,evidence,
     totalMean:mean(totals),totalMedian:median(totals),totalP10:quantile(totals,.10),totalP90:quantile(totals,.90),totalMin:Math.min(...totals),totalMax:Math.max(...totals),
     marginMean:mean(margins),marginMedian:median(margins),marginP10:quantile(margins,.10),marginP90:quantile(margins,.90),marginMin:Math.min(...margins),marginMax:Math.max(...margins),
     homeMean:mean(homes),homeMedian:median(homes),homeP10:quantile(homes,.10),homeP90:quantile(homes,.90),homeMin:Math.min(...homes),homeMax:Math.max(...homes),
     awayMean:mean(aways),awayMedian:median(aways),awayP10:quantile(aways,.10),awayP90:quantile(aways,.90),awayMin:Math.min(...aways),awayMax:Math.max(...aways)};
 }
 function gameCard(g,s,index){
   const notes=[];
   if(s.allUnder150)notes.push("No qualifying game exceeded 150 combined points");
   if(s.allHomeUnder80)notes.push("Today's home team scored 80 or fewer in every qualifying comp");
   if(s.allAwayUnder80)notes.push("Today's away team scored 80 or fewer in every qualifying comp");
   const seasonText=s.seasons.map(x=>Number(x)-1+"–"+String(x).slice(-2)).join(", ");
   const twinBlock=s.twins.length
     ? '<div class="twin-callout"><b>80%+ historical twin found</b><span>'+s.twins.length+' comparison'+(s.twins.length===1?'':'s')+' at 80% similarity or higher</span></div>'
     : '<div class="no-twin"><b>No 80%+ historical twin</b><span>Closest match: '+fmt(s.topSim)+'%</span></div>';
   const compRows=s.closest.map(x=>{
     const h=Number(x.g.homeScore),a=Number(x.g.awayScore);
     const aPts=x.orientation==="home"?h:a,bPts=x.orientation==="home"?a:h;
     return '<tr><td>'+esc(String(x.g.gameDate||"").slice(0,10))+'</td><td>'+esc(x.g.homeTeam)+' vs '+esc(x.g.awayTeam)+'</td><td>'+aPts+'–'+bPts+'</td><td>'+fmt(x.similarity)+'%</td></tr>';
   }).join("");
   const totalHist='<div class="volatility-detail"><h4>Game total distribution</h4><div class="volatility-stats"><span>Mean <b>'+fmt(s.totalMean)+'</b></span><span>Median <b>'+fmt(s.totalMedian)+'</b></span><span>Std. dev. <b>'+fmt(s.sdTotal)+'</b></span><span>10th–90th pct. <b>'+fmt(s.totalP10)+'–'+fmt(s.totalP90)+'</b></span><span>Full range <b>'+s.totalMin+'–'+s.totalMax+'</b></span></div></div>';
   const marginHist='<div class="volatility-detail"><h4>Scoring margin distribution (home team)</h4><div class="volatility-stats"><span>Mean <b>'+fmt(s.marginMean)+'</b></span><span>Median <b>'+fmt(s.marginMedian)+'</b></span><span>Std. dev. <b>'+fmt(s.sdMargin)+'</b></span><span>10th–90th pct. <b>'+fmt(s.marginP10)+'–'+fmt(s.marginP90)+'</b></span><span>Range <b>'+fmt(s.marginMin)+' to '+fmt(s.marginMax)+'</b></span></div></div>';
   const teamHist='<div class="volatility-detail"><h4>Team scoring distributions</h4><div class="volatility-stats"><span>Home mean / median <b>'+fmt(s.homeMean)+' / '+fmt(s.homeMedian)+'</b></span><span>Home SD <b>'+fmt(s.sdHome)+'</b></span><span>Home 10th–90th <b>'+fmt(s.homeP10)+'–'+fmt(s.homeP90)+'</b></span><span>Home full range <b>'+s.homeMin+'–'+s.homeMax+'</b></span><span>Away mean / median <b>'+fmt(s.awayMean)+' / '+fmt(s.awayMedian)+'</b></span><span>Away SD <b>'+fmt(s.sdAway)+'</b></span><span>Away 10th–90th <b>'+fmt(s.awayP10)+'–'+fmt(s.awayP90)+'</b></span><span>Away full range <b>'+s.awayMin+'–'+s.awayMax+'</b></span></div></div>';
   const evidencePanel='<div class="profilegrid"><div><small>Historical evidence quality</small><b>'+s.evidence+'</b><small>'+s.n+' comps · effective weighted sample '+fmt(s.ess,1)+'</small></div><div><small>Total consistency rank</small><b>'+fmt(s.totalStability,0)+'/100</b><small>Relative to this slate; higher = less volatile</small></div><div><small>Margin consistency rank</small><b>'+fmt(s.marginStability,0)+'/100</b><small>Relative to this slate; higher = less volatile</small></div><div><small>Similarity tiers</small><b>95+ '+s.tierCounts["95–100"]+' · 90s '+s.tierCounts["90–94"]+' · 80s '+s.tierCounts["80–89"]+'</b><small>70s '+s.tierCounts["70–79"]+' · 60s '+s.tierCounts["60–69"]+'</small></div></div>';
   return '<article class="panel slate-game"><div class="slate-game-head"><div><p class="eyebrow">'+(g.neutralSite?"NEUTRAL SITE":"HOME COURT")+' · RANK #'+(index+1)+'</p><h3>'+esc(g.awayTeam)+' at '+esc(g.homeTeam)+'</h3><p class="muted small">'+esc(new Date(g.startDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}))+' · '+s.n+' qualifying historical games · '+s.seasons.length+' seasons</p></div><div class="score">'+fmt(s.avgSim)+'%<small class="muted"> avg similarity</small></div></div>'+
   twinBlock+(notes.length?'<div class="slate-flags">'+notes.map(n=>'<p>• '+esc(n)+'</p>').join("")+'</div>':'')+
   '<div class="profilegrid"><div><small>Total volatility · SD</small><b>'+fmt(s.sdTotal)+'</b><small>Lower = tighter totals</small></div><div><small>Margin volatility · SD</small><b>'+fmt(s.sdMargin)+'</b><small>Lower = tighter margins</small></div><div><small>Average historical total</small><b>'+fmt(s.totalMean)+'</b><small>Median '+fmt(s.totalMedian)+' · 10th–90th pct. '+fmt(s.totalP10)+'–'+fmt(s.totalP90)+' · full range '+s.totalMin+'–'+s.totalMax+'</small></div><div><small>Average home margin</small><b>'+fmt(s.marginMean)+'</b><small>Median '+fmt(s.marginMedian)+'</small></div><div><small>Home team win rate</small><b>'+((100*s.wins/s.n).toFixed(1))+'%</b><small>'+s.wins+' wins · '+s.losses+' losses · '+s.ties+' ties</small></div><div><small>Best historical match</small><b>'+fmt(s.topSim)+'%</b><small>'+s.twins.length+' comparisons at 80%+</small></div><div><small>Overall balance score</small><b>'+fmt(s.balanceScore)+'/100</b><small>40% similarity · 30% each volatility</small></div></div>'+
   '<details class="slate-expand"><summary>Expand historical breakdown <span>'+s.n+' games · '+s.twins.length+' strong twins</span></summary>'+
   '<div class="slate-expanded">'+evidencePanel+totalHist+marginHist+teamHist+
   '<p class="muted small">Average similarity '+fmt(s.avgSim)+'% · historical seasons '+esc(seasonText)+'. Standard deviation measures game-to-game volatility; it is not a prediction interval.</p>'+
   (s.twins.length?'<h4>80%+ historical twins</h4><div class="tablewrap"><table><thead><tr><th>Date</th><th>Historical matchup</th><th>Score aligned to today\'s home/away</th><th>Similarity</th></tr></thead><tbody>'+s.twins.slice(0,10).map(x=>{const h=Number(x.g.homeScore),a=Number(x.g.awayScore),hp=x.orientation==="home"?h:a,ap=x.orientation==="home"?a:h;return '<tr><td>'+esc(String(x.g.gameDate||"").slice(0,10))+'</td><td>'+esc(x.g.homeTeam)+' vs '+esc(x.g.awayTeam)+'</td><td>'+hp+'–'+ap+'</td><td><b>'+fmt(x.similarity)+'%</b></td></tr>'}).join("")+'</tbody></table></div>':'<p class="muted small">No comparison reached 80% similarity. The closest matches are listed below.</p>')+
   '<h4>Closest historical comparisons</h4><div class="tablewrap"><table><thead><tr><th>Date</th><th>Historical matchup</th><th>Score aligned to today\'s home/away</th><th>Similarity</th></tr></thead><tbody>'+compRows+'</tbody></table></div></div></details>'+
   '<p class="muted small">All findings are descriptive historical frequencies, not guarantees or calibrated probabilities. No current or historical sportsbook lines are used.</p></article>';
 }
 function percentile(values,value,lowerBetter){
   const sorted=values.slice().sort((a,b)=>a-b);
   if(sorted.length<=1)return 100;
   const below=sorted.filter(x=>lowerBetter?x>value:x<value).length;
   const equal=sorted.filter(x=>x===value).length;
   return 100*(below+equal/2)/sorted.length;
 }
 function rankGames(valid,mode){
   const totals=valid.map(x=>x.s.sdTotal),margins=valid.map(x=>x.s.sdMargin),sims=valid.map(x=>x.s.avgSim);
   valid.forEach(x=>{
     const s=x.s;
     s.totalStability=percentile(totals,s.sdTotal,true);
     s.marginStability=percentile(margins,s.sdMargin,true);
     s.similarityRank=percentile(sims,s.avgSim,false);
     s.balanceScore=.30*s.totalStability+.30*s.marginStability+.40*s.similarityRank;
   });
   const sorters={
     balanced:(a,b)=>b.s.balanceScore-a.s.balanceScore,
     total:(a,b)=>a.s.sdTotal-b.s.sdTotal||b.s.avgSim-a.s.avgSim,
     margin:(a,b)=>a.s.sdMargin-b.s.sdMargin||b.s.avgSim-a.s.avgSim,
     similarity:(a,b)=>b.s.avgSim-a.s.avgSim
   };
   valid.sort(sorters[mode]||sorters.balanced);
   return valid;
 }

 let lastValid=[],sortKey="balanceScore",sortDir="desc";
 const columns=[["home","Matchup"],["n","Comps"],["avgSim","Avg similarity"],["topSim","Highest similarity"],["twins","80%+ twins"],["sdTotal","Total SD"],["sdMargin","Margin SD"],["totalMean","Avg total"],["totalMedian","Median total"],["totalRange","Total range"],["marginMean","Avg home margin"],["winsPct","Home win %"],["balanceScore","Balance score"]];
 function sortTable(key){if(sortKey===key)sortDir=sortDir==="asc"?"desc":"asc";else{sortKey=key;sortDir=key==="home"?"asc":"desc"}renderTable()}
 function renderTable(){
  const out=$("slateResults");if(!out||!lastValid.length)return;
  const rows=lastValid.slice().sort((a,b)=>{
   const val=x=>{const z=x.s;switch(sortKey){case"home":return x.g.awayTeam+" at "+x.g.homeTeam;case"twins":return z.twins.length;case"totalRange":return z.totalMax-z.totalMin;case"winsPct":return 100*z.wins/z.n;default:return z[sortKey]}};
   const av=val(a),bv=val(b);return typeof av==="string"?(sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av)):(sortDir==="asc"?av-bv:bv-av);
  });
  const heads=columns.map(([k,l])=>'<th><button class="slate-sort-head" data-sort="'+k+'">'+l+(sortKey===k?(sortDir==="asc"?" ↑":" ↓"):" ↕")+'</button></th>').join("");
  const body=rows.map((x,i)=>{const z=x.s,g=x.g;const v={home:esc(g.awayTeam+" at "+g.homeTeam),n:z.n,avgSim:fmt(z.avgSim)+"%",topSim:fmt(z.topSim)+"%",twins:z.twins.length,sdTotal:fmt(z.sdTotal),sdMargin:fmt(z.sdMargin),totalMean:fmt(z.totalMean),totalMedian:fmt(z.totalMedian),totalRange:z.totalMin+"–"+z.totalMax,marginMean:fmt(z.marginMean),winsPct:(100*z.wins/z.n).toFixed(1)+"%",balanceScore:fmt(z.balanceScore)+"/100"};
   return '<tr>'+columns.map(([k])=>'<td>'+(k==="home"?"<b>"+v[k]+"</b>":v[k])+'</td>').join("")+'</tr><tr class="slate-expand-row"><td colspan="'+columns.length+'"><details><summary>Expand matchup details · '+esc(g.awayTeam)+' at '+esc(g.homeTeam)+'</summary>'+gameCard(g,z,i)+'</details></td></tr>';
  }).join("");
  const table='<div class="tablewrap slate-table-wrap"><table class="slate-metrics-table"><thead><tr>'+heads+'</tr></thead><tbody>'+body+'</tbody></table></div>';
  const existing=out.querySelector(".slate-table-wrap");if(existing)existing.outerHTML=table;else out.insertAdjacentHTML("beforeend",table);
 }
 async function scan(){
   const btn=$("runSlateScan"),out=$("slateResults"),status=$("slateStatus"),date=$("slateDate").value;
   if(!date){status.textContent="Choose a slate date.";return}
   const savedSchedule=schedule();
   if(!savedSchedule.length){out.className="results empty";out.textContent="No schedule is saved on this device. Open Data Center and tap Import / refresh 2026–27 schedule first.";return}
   const slate=savedSchedule.filter(g=>dayKey(g)===date&&g.homeTeam&&g.awayTeam&&!isFinished(g)).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)));
   if(!slate.length){out.className="results empty";out.textContent="No scheduled games found for this date in the locally saved schedule. Import or refresh the schedule in Data Center.";return}
   btn.disabled=true;btn.textContent="Scanning slate…";out.className="results";out.innerHTML="";
   try{
     if(!window.CBBLabScanner||typeof window.CBBLabScanner.loadGames!=="function")throw Error("The matchup engine did not initialize. Reload CBB LAB; if this persists, contact support.");
     const games=await window.CBBLabScanner.loadGames();
     if(!games.length)throw Error("No historical games are saved in this browser. Import the historical dataset in Data Center first.");
     const years=$("slateYears").value,results=[];
     for(let i=0;i<slate.length;i++){
       const g=slate[i];status.textContent="Scanning "+(i+1)+" of "+slate.length+": "+g.awayTeam+" at "+g.homeTeam;
       try{
         const candidates=window.CBBLabScanner.compare(games,g.homeTeam,g.awayTeam,!!g.neutralSite,years,dayKey(g));
         const qualifying=candidates.filter(x=>Number.isFinite(x.similarity)&&x.similarity>=60);
         if(qualifying.length<5){results.push({g,insufficient:true,n:qualifying.length});continue}
         results.push({g,s:summary(qualifying)});
       }catch(e){results.push({g,error:e.message})}
       await new Promise(resolve=>setTimeout(resolve,0));
     }
     const valid=rankGames(results.filter(x=>x.s),$("slateSort")?.value||"balanced");
     lastValid=valid;sortKey="balanceScore";sortDir="desc";
     const noData=results.filter(x=>!x.s);
     const intro='<div class="profilegrid"><div><small>Scheduled games scanned</small><b>'+slate.length+'</b></div><div><small>Games with usable history</small><b>'+valid.length+'</b></div><div><small>Similarity floor</small><b>60%</b></div><div><small>80%+ historical twins</small><b>'+valid.filter(x=>x.s.twins.length).length+'</b></div></div><p class="muted small">Default ranking weights average similarity 40%, total stability 30% and margin stability 30%. Volatility is measured by standard deviation; lower is more consistent. Scores are relative to the games on this slate, not probabilities. Only 60%+ absolute matches that pass the three-possession per-team and combined pace screens; no scoring-total or market-line screen are included; each team needs at least five completed games, with at least five qualifying historical comps required.</p>';
     out.innerHTML=intro+(valid.length?'<p class="muted small">Tap any column heading to sort. Expand a matchup row for distributions, historical twins and closest comparisons.</p>':'<div class="empty">No games on this slate had at least five historical comparisons at or above 60% similarity after fingerprint-similarity and two-team pace filters. No patterns were manufactured.</div>')+
       (noData.length?'<h3>Insufficient historical comparisons</h3>'+noData.map(x=>'<div class="result-row"><div><b>'+esc(x.g.awayTeam)+' at '+esc(x.g.homeTeam)+'</b><small>'+(x.error?esc(x.error):x.n+' comparisons at 60%+; fewer than the five-game minimum')+'</small></div></div>').join(""):"");
     renderTable();
     status.textContent="Scan complete · "+slate.length+" games reviewed · "+valid.length+" reportable samples. Sorted by "+($("slateSort")?.selectedOptions[0]?.textContent||"overall balance")+". No market lines used.";
   }catch(e){out.className="results empty";out.textContent=e.message;status.textContent="Scan could not complete."}
   finally{btn.disabled=false;btn.textContent="Scan this date"}
 }
 const btn=$("runSlateScan");if(btn)btn.addEventListener("click",scan);
 const out=$("slateResults");if(out)out.addEventListener("click",e=>{const b=e.target.closest("[data-sort]");if(b){e.preventDefault();sortTable(b.dataset.sort)}});
 dateInit();
})();
