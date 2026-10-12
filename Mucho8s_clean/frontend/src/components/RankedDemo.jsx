import React,{useEffect,useState} from 'react';
import RankedRoom from '@/components/RankedRoom';
import {RANKED_MAPS,SNAKE_DRAFT,validLobbyCode} from '@/lib/rankedFlow';
import {playUiSound} from '@/lib/uiAudio';
const bots=Array.from({length:8},(_,i)=>({id:`demo-ranked-${i}`,name:`Bot ${i+1}`,currentElo:1200-i*55}));
const playerMap=Object.fromEntries(bots.map(p=>[p.id,p]));
function initial(mode){const now=Date.now();return {ok:true,serverNow:new Date(now).toISOString(),playerId:bots[0].id,member:{ready:false},players:bots.map(p=>({player_id:p.id,ready:false,online:true})),mapVotes:[],voted:false,lobby:{id:'demo-ranked',status:'draft',mode,team_a:[bots[0].id],team_b:[bots[1].id],player_ids:bots.map(p=>p.id),draft_pick:0,host_player_id:bots[0].id,preparation_started_at:new Date(now).toISOString(),preparation_deadline:new Date(now+120000).toISOString(),phase_deadline:new Date(now+30000).toISOString(),lobby_code:null}};}
export default function RankedDemo({onClose}){
 const [mode,setMode]=useState('hp'),[state,setState]=useState(null),[receivedAt,setReceivedAt]=useState(Date.now()),[messages,setMessages]=useState([]);
 const run=(action,payload={})=>setState(s=>{
  if(!s)return s;const n={...s,lobby:{...s.lobby},players:s.players.map(p=>({...p}))},l=n.lobby,now=Date.now();
  if(action==='pick'&&l.status==='draft'){
   const side=SNAKE_DRAFT[l.draft_pick],key=side==='A'?'team_a':'team_b';
   if(!l.player_ids.includes(payload.playerId)||[...l.team_a,...l.team_b].includes(payload.playerId))return s;
   l[key]=[...l[key],payload.playerId];l.draft_pick++;
   if(l.draft_pick===6){l.status='vote';l.phase_deadline=new Date(now+15000).toISOString();}
  }
  if(action==='tick'&&now>=Date.parse(l.preparation_deadline)&&['draft','vote','lobby','ready'].includes(l.status)){return {...n,lobby:null,cancellationReason:'Preparazione scaduta: codice lobby o Ready Check incompleto'};}
  if(action==='tick'&&l.status==='draft'&&now>=Date.parse(l.phase_deadline)){
   let pool=l.player_ids.filter(id=>![...l.team_a,...l.team_b].includes(id));
   while(l.draft_pick<6){const key=SNAKE_DRAFT[l.draft_pick]==='A'?'team_a':'team_b';l[key]=[...l[key],pool.shift()];l.draft_pick++;}
   l.status='vote';l.phase_deadline=new Date(Date.parse(l.phase_deadline)+15000).toISOString();
  }
  if(action==='vote-map'&&l.status==='vote'&&!n.voted){n.mapVotes=[{map_name:payload.map},...bots.slice(1).map((_,i)=>({map_name:RANKED_MAPS[l.mode][i%RANKED_MAPS[l.mode].length]}))];n.voted=true;}
  if(l.status==='vote'&&(n.mapVotes.length===8||now>=Date.parse(l.phase_deadline))){const counts={};n.mapVotes.forEach(v=>counts[v.map_name]=(counts[v.map_name]||0)+1);l.map_name=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||a.localeCompare(b))[0]||RANKED_MAPS[l.mode][0];l.status='lobby';l.phase_deadline=l.preparation_deadline;}
  if(action==='set-lobby-code'&&l.status==='lobby'&&validLobbyCode(payload.code)){l.lobby_code=payload.code.trim().toUpperCase();l.status='ready';}
  if(action==='ready'&&l.status==='ready'){n.players=n.players.map(p=>({...p,ready:true}));n.member={ready:true};l.status='live';}
  if(action==='report'&&l.status==='live'){l.status='pending';l.reported_winner=payload.winner;}
  if(action==='demo-dispute'&&l.status==='pending')l.status='disputed';
  if(action==='demo-confirm'&&['pending','disputed'].includes(l.status))l.status='completed';
  n.playerId=l.status==='draft'?(SNAKE_DRAFT[l.draft_pick]==='A'?l.team_a[0]:l.team_b[0]):l.host_player_id;
  n.serverNow=new Date(now).toISOString();setReceivedAt(now);if(action!=='tick')void playUiSound('confirm','ranked');return n;
 });
 const status=state?.lobby?.status;
 useEffect(()=>{if(!['draft','vote','lobby','ready'].includes(status))return;const timer=setInterval(()=>run('tick'),250);return()=>clearInterval(timer);},[status]);
 return <div data-testid="ranked-demo" className="space-y-4"><div className="m8-panel rounded-2xl p-4 flex flex-wrap justify-between gap-3"><div><p className="text-blue-300 text-xs font-black">SIMULAZIONE · DATI BOT ISOLATI</p><p className="text-xs text-slate-400 mt-1">Stessa Match Room del Ranked. Controlli entrambi i capitani; i bot confermano Ready Check. Nessuna scrittura al server.</p></div><button onClick={onClose} className="text-sm">Chiudi ×</button></div>{!state?.lobby?<section className="m8-panel rounded-2xl p-6 text-center">{state?.cancellationReason&&<p className="text-amber-300 mb-3">{state.cancellationReason}</p>}<div className="flex gap-2 justify-center mb-4">{['hp','snd'].map(m=><button key={m} onClick={()=>setMode(m)} className={`rounded-xl border px-4 py-2 ${mode===m?'border-blue-400 text-blue-300':'border-white/10'}`}>{m==='hp'?'Hardpoint':'Search & Destroy'}</button>)}</div><button className="rounded-xl bg-blue-600 px-5 py-3 font-black" onClick={()=>{setState(initial(mode));setReceivedAt(Date.now());setMessages([]);void playUiSound('found','ranked');}}>Trova 8 bot e avvia il draft</button></section>:<><RankedRoom state={state} receivedAt={receivedAt} playerMap={playerMap} run={run} demo demoMessages={messages} onDemoMessage={m=>setMessages(v=>[...v,`Bot: ${m}`])}/><button className="text-sm underline text-slate-400" onClick={()=>setState(null)}>Ricomincia</button></>}</div>;
}
