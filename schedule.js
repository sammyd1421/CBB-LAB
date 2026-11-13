/* "CBB LAB": local 2026-27 season schedule import and date/matchup picker. */
(()=>{
 const $=id=>document.getElementById(id),KEY="cbb-lab-schedule-2027-v1";
 const iso=d=>d.toISOString().slice(0,10);
 const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return []}};
 const save=a=>localStorage.setItem(KEY,JSON.stringify(a));
 let schedule=read();

 const stateZones={AL:"America/Chicago",AK:"America/Anchorage",HI:"Pacific/Honolulu",AZ:"America/Phoenix",AR:"America/Chicago",CA:"America/Los_Angeles",CO:"America/Denver",CT:"America/New_York",DE:"America/New_York",FL:"America/New_York",GA:"America/New_York",IA:"America/Chicago",ID:"America/Boise",IL:"America/Chicago",IN:"America/Indiana/Indianapolis",KS:"America/Chicago",KY:"America/New_York",LA:"America/Chicago",MA:"America/New_York",MD:"America/New_York",ME:"America/New_York",MI:"America/Detroit",MN:"America/Chicago",MO:"America/Chicago",MS:"America/Chicago",MT:"America/Denver",NC:"America/New_York",ND:"America/Chicago",NE:"America/Chicago",NH:"America/New_York",NJ:"America/New_York",NM:"America/Denver",NV:"America/Los_Angeles",NY:"America/New_York",OH:"America/New_York",OK:"America/Chicago",OR:"America/Los_Angeles",PA:"America/New_York",RI:"America/New_York",SC:"America/New_York",SD:"America/Chicago",TN:"America/Chicago",TX:"America/Chicago",UT:"America/Denver",VA:"America/New_York",VT:"America/New_York",WA:"America/Los_Angeles",WI:"America/Chicago",WV:"America/New_York",WY:"America/Denver",DC:"America/New_York"};
 const zoneFor=g=>{let st=String(g.state||"").trim().toUpperCase();const full={IOWA:"IA","NORTH CAROLINA":"NC","SOUTH CAROLINA":"SC",FLORIDA:"FL",TENNESSEE:"TN",INDIANA:"IN",KENTUCKY:"KY",IDAHO:"ID",TEXAS:"TX",CALIFORNIA:"CA","NEW YORK":"NY",ILLINOIS:"IL",MISSOURI:"MO",KANSAS:"KS",OKLAHOMA:"OK",ARIZONA:"AZ",NEVADA:"NV",UTAH:"UT",COLORADO:"CO",MINNESOTA:"MN",WISCONSIN:"WI",MICHIGAN:"MI",OHIO:"OH",GEORGIA:"GA",ALABAMA:"AL",MISSISSIPPI:"MS",LOUISIANA:"LA",ARKANSAS:"AR",VIRGINIA:"VA",WASHINGTON:"WA",OREGON:"OR",PENNSYLVANIA:"PA",MARYLAND:"MD",MASSACHUSETTS:"MA",CONNECTICUT:"CT","NEW JERSEY":"NJ",DELAWARE:"DE","RHODE ISLAND":"RI",VERMONT:"VT","NEW HAMPSHIRE":"NH",MAINE:"ME","NEW MEXICO":"NM",MONTANA:"MT",WYOMING:"WY","NORTH DAKOTA":"ND","SOUTH DAKOTA":"SD",NEBRASKA:"NE","WEST VIRGINIA":"WV",ALASKA:"AK",HAWAII:"HI","DISTRICT OF COLUMBIA":"DC"};st=full[st]||st;let z=stateZones[st];const city=String(g.city||"").toLowerCase();if(st==="FL"&&/pensacola|tallahassee|panama city/.test(city))z="America/Chicago";if(st==="TN"&&/memphis|nashville|clarksville|jackson/.test(city))z="America/Chicago";if(st==="IN"&&/evansville|gary|hammond|south bend|fort wayne/.test(city))z="America/Indiana/Indianapolis";if(st==="KY"&&/bowling green|paducah|owensboro/.test(city))z="America/Chicago";if(st==="ID"&&/boise|twin falls|pocatello|idaho falls/.test(city))z="America/Boise";return z||null};
 const gameDateKey=g=>{const raw=String(g.startDate||"");if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=new Date(raw);if(!Number.isFinite(d.getTime()))return "";return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
 const gameTimeLabel=g=>{const raw=String(g.startDate||"");if(!raw||g.startTimeTbd)return "Time TBD";const d=new Date(raw);if(!Number.isFinite(d.getTime()))return "Time TBD";return new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(d)};
 const isFinished=g=>/^(final|completed|complete|cancelled|canceled|postponed)$/i.test(String(g.status||"").trim());

 const dateKey=gameDateKey;
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const sorted=()=>schedule.filter(g=>g.homeTeam&&g.awayTeam&&g.startDate&&!isFinished(g)).sort((a,b)=>a.startDate.localeCompare(b.startDate));
 function refreshDates(){
   const d=$("scheduleDate"),select=$("scheduleGame");if(!d||!select)return;
   const days=[...new Set(sorted().map(dateKey))].sort(),now=new Date(),today=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
   if(!d.value)d.value=days.includes(today)?today:(days.find(x=>x>=today)||days[days.length-1]||today);
   if(days.length&&!days.includes(d.value))d.value=days.find(x=>x>=today)||days[days.length-1];
   const games=sorted().filter(g=>dateKey(g)===d.value);
   select.innerHTML='<option value="">Select a game ('+games.length+')</option>'+games.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.awayTeam)+' at '+esc(g.homeTeam)+(g.startTimeTbd?' · Time TBD':' · '+gameTimeLabel(g))+'</option>').join("");
   $("scheduleStatus").textContent=schedule.length?schedule.length.toLocaleString()+" schedule games saved on this device · "+days.length+" dates available. Choose a matchup to load the teams.":"Import the season schedule once. Choose a date and matchup to fill Team A, Team B and site automatically; enter your own spread and total below.";
 }
 function setTeam(select,name){
   if(!select)return;
   let option=[...select.options].find(o=>o.value===name);
   if(!option){option=document.createElement("option");option.value=name;option.textContent=name;select.appendChild(option)}
   select.value=name;
   select.dispatchEvent(new Event("change",{bubbles:true}));
 }
 function applyGame(){
   const picker=$("scheduleGame");if(!picker)return;
   const g=schedule.find(x=>String(x.id)===String(picker.value));if(!g)return;
   setTeam($("hmTeamA"),g.homeTeam);
   setTeam($("hmTeamB"),g.awayTeam);
   const site=$("hmSite");if(site)site.value=g.neutralSite?"neutral":"home";
   const status=$("scheduleStatus");
   if(status)status.textContent="Loaded automatically — Team A (home): "+g.homeTeam+" · Team B (away): "+g.awayTeam+" · "+(g.neutralSite?"Neutral site":"Home court")+".";
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
         const row={id:String(g.id),season:2027,startDate:g.startDate,startTimeTbd:!!(g.startTimeTbd??g.startTimeTBD),homeTeam:g.homeTeam,awayTeam:g.awayTeam,neutralSite:!!g.neutralSite,status:g.status||((g.completed)?"completed":"scheduled"),completed:!!g.completed,seasonType:g.seasonType||"",venue:g.venue||"",city:g.city||"",state:g.state||"",homeTeamId:g.homeTeamId??g.homeId??null,awayTeamId:g.awayTeamId??g.awayId??null};
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