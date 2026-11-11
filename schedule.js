/* CBB LAB: local 2026-27 season schedule import and date/matchup picker. */
(()=>{
 const $=id=>document.getElementById(id),KEY="cbb-lab-schedule-2027-v1";
 const iso=d=>d.toISOString().slice(0,10);
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}};
 const save=a=>localStorage.setItem(KEY,JSON.stringify(a));
 let schedule=read();
 const dateKey=g=>{const d=new Date(g.startDate);if(!Number.isFinite(d.getTime()))return "";return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const sorted=()=>schedule.filter(g=>g.homeTeam&&g.awayTeam&&g.startDate&&g.status!=="cancelled").sort((a,b)=>a.startDate.localeCompare(b.startDate));
 function refreshDates(){
   const d=$("scheduleDate"),select=$("scheduleGame");if(!d||!select)return;
   const days=[...new Set(sorted().map(dateKey))].sort(),today=iso(new Date());
   if(!d.value)d.value=days.includes(today)?today:(days.find(x=>x>=today)||days[0]||today);
   if(days.length&&!days.includes(d.value))d.value=days.find(x=>x>=today)||days[0];
   const games=sorted().filter(g=>dateKey(g)===d.value);
   select.innerHTML='<option value="">Select a game ('+games.length+')</option>'+games.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.awayTeam)+' at '+esc(g.homeTeam)+(g.startTimeTbd?' · Time TBD':' · '+new Date(g.startDate).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}))+'</option>').join("");
   $("scheduleStatus").textContent=schedule.length?schedule.length.toLocaleString()+" schedule games saved on this device · "+days.length+" dates available. Choose a matchup to load the teams.":"Import the season schedule once. Choose a date and matchup to fill Team A, Team B and site automatically; enter your own spread and total below.";
 }
 function applyGame(){
   const g=schedule.find(x=>String(x.id)===$("scheduleGame").value);if(!g)return;
   const a=$("hmTeamA"),b=$("hmTeamB"),site=$("hmSite");
   if(a){a.value=g.homeTeam;a.dispatchEvent(new Event("change",{bubbles:true}))}
   if(b){b.value=g.awayTeam;b.dispatchEvent(new Event("change",{bubbles:true}))}
   if(site)site.value=g.neutralSite?"neutral":"home";
   $("scheduleStatus").textContent=g.awayTeam+" at "+g.homeTeam+" loaded. "+(g.neutralSite?"Neutral site":"Home court")+". Enter your spread and total, then generate matchup distributions.";
 }
 $("scheduleDate")?.addEventListener("change",refreshDates);
 $("scheduleGame")?.addEventListener("change",applyGame);
 const button=$("importSchedule");
 if(button)button.addEventListener("click",async()=>{
   if(button.disabled)return;
   if(!confirm("Import or refresh the 2026–27 men's college basketball schedule? The schedule is saved locally and does not replace historical game results."))return;
   button.disabled=true;button.textContent="Importing schedule…";
   const status=$("scheduleImportStatus"),start=new Date("2026-10-01T00:00:00Z"),finish=new Date("2027-05-15T00:00:00Z");
   let windows=0;const incoming=new Map();
   const addDays=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x};
   async function windowFetch(from,to){
     const q=new URLSearchParams({resource:"games",season:"2027",startDateRange:from.toISOString(),endDateRange:to.toISOString()});
     const r=await fetch("/api/cbbd?"+q.toString(),{headers:{Accept:"application/json"}});
     if(!r.ok){let m="HTTP "+r.status;try{const e=await r.json();m=e.error||e.message||m}catch{}throw Error(m)}
     const rows=await r.json();if(!Array.isArray(rows))throw Error("Provider returned an unexpected schedule response.");
     if(rows.length>=3000&&to-from>86400000){const mid=addDays(from,Math.floor((to-from)/172800000));return (await windowFetch(from,mid)).concat(await windowFetch(addDays(mid,1),to))}
     return rows;
   }
   try{
     let cursor=start;
     while(cursor<=finish){
       const end=new Date(Math.min(addDays(cursor,44).getTime(),finish.getTime()));
       status.textContent="Fetching schedule · "+iso(cursor)+" to "+iso(end);
       const rows=await windowFetch(cursor,end);windows++;
       rows.forEach(g=>{
         if(!g||g.id===null||!g.homeTeam||!g.awayTeam||!g.startDate)return;
         const row={id:String(g.id),season:2027,startDate:g.startDate,startTimeTbd:!!g.startTimeTbd,homeTeam:g.homeTeam,awayTeam:g.awayTeam,neutralSite:!!g.neutralSite,status:g.status||"scheduled",seasonType:g.seasonType||"",venue:g.venue||"",city:g.city||"",state:g.state||""};
         incoming.set(row.id,row);
       });
       cursor=addDays(end,1);
     }
     if(!incoming.size)throw Error("No schedule games were returned. Check API access and season coverage.");
     schedule=[...incoming.values()].sort((a,b)=>a.startDate.localeCompare(b.startDate));save(schedule);refreshDates();
     status.textContent="Schedule refreshed: "+schedule.length.toLocaleString()+" games saved locally across "+new Set(schedule.map(dateKey)).size+" dates ("+windows+" date windows). Re-import to refresh changes.";
     button.textContent="Refresh schedule";
   }catch(e){status.textContent="Schedule import paused: "+e.message+(schedule.length?" Existing saved schedule was kept.":"");button.textContent="Retry schedule import"}
   finally{button.disabled=false}
 });
 if(schedule.length){$("scheduleImportStatus").textContent=schedule.length.toLocaleString()+" schedule games already saved on this device. Refresh when you want updated dates or times.";button.textContent="Refresh schedule"}
 refreshDates();
})();