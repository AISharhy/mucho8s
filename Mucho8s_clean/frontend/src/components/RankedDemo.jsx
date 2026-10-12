import React, { useEffect, useState } from "react";
import { playUiSound } from "@/lib/uiAudio";

const MAPS = ["Colossus", "Den", "Gridlock", "Frequency", "Scar", "Hacienda"];
const BOT_NAMES = ["Sharhy", "Sysma", "Dante", "Akashi", "Krama", "Macha", "Tadok", "Ciaba"];
const INITIAL = () => ({phase:"queue", elapsed:0, count:1, alpha:["Sharhy"], bravo:["Sysma"], pool:BOT_NAMES.slice(2), picks:0, votes:{}, voted:false, selected:null, code:"", ready:0, winner:null});
const steps = ["queue", "found", "draft", "vote", "lobby", "ready", "live", "result"];
const buttonClass = "rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-3 font-black text-white disabled:opacity-40";
export default function RankedDemo({onClose}) {
 const [demo,setDemo] = useState(INITIAL);
 const advance = phase => setDemo(s=>({...s,phase}));
 const preparation = ["draft","vote","lobby"].includes(demo.phase);
 const remaining = Math.max(0,120-demo.elapsed);
 const formattedRemaining = `${String(Math.floor(remaining/60)).padStart(2,"0")}:${String(remaining%60).padStart(2,"0")}`;
 useEffect(()=>{if(!preparation)return;const timer=setInterval(()=>setDemo(s=>({...s,elapsed:Math.min(120,s.elapsed+1)})),1000);return()=>clearInterval(timer)},[preparation]);
 useEffect(()=>{if(!preparation)return;if(demo.phase==="draft"&&demo.elapsed>=30){setDemo(s=>({...s,alpha:[...s.alpha,...s.pool.filter((_,i)=>i%2===0)],bravo:[...s.bravo,...s.pool.filter((_,i)=>i%2!==0)],pool:[],picks:6,phase:"vote"}));void playUiSound("confirm","ranked")};if(demo.phase==="vote"&&demo.elapsed>=45){const winner=MAPS[0];setDemo(s=>({...s,selected:s.voted?[...MAPS].sort((a,b)=>(s.votes[b]||0)-(s.votes[a]||0)||a.localeCompare(b))[0]:winner,phase:"lobby"}));}if(demo.phase==="lobby"&&demo.elapsed>=120){setDemo(s=>({...s,phase:"timeout"}))}},[demo.phase,demo.elapsed,preparation]);
 useEffect(()=>{
   if(demo.phase!=="queue" || demo.count===8)return;
   const timer=setTimeout(()=>setDemo(s=>s.phase==="queue"?{...s,count:Math.min(8,s.count+1)}:s),360);
   return()=>clearTimeout(timer);
 },[demo.phase,demo.count]);
 useEffect(()=>{
   if(demo.phase==="queue"&&demo.count===8){void playUiSound("found","ranked");const timer=setTimeout(()=>advance("found"),500);return()=>clearTimeout(timer);}
 },[demo.phase,demo.count]);
 const pick = id => {
   if(demo.phase!=="draft"||demo.elapsed>=30||!demo.pool.includes(id))return;
   void playUiSound("select","ranked");
   const team=demo.picks % 2===0?"alpha":"bravo";
   const next={...demo,[team]:[...demo[team],id],pool:demo.pool.filter(p=>p!==id),picks:demo.picks+1};
   if(!next.pool.length){next.phase="vote";void playUiSound("confirm","ranked");}
   setDemo(next);
 };
 const castVote = map => {
   if(demo.voted||demo.elapsed>=45)return;
   void playUiSound("select","ranked");
   const voteCount={...demo.votes,[map]:(demo.votes[map]||0)+1};
   // Six deterministic bot votes + the player's vote; the eighth is added in the next step.
   const scripted=["Den","Frequency","Den","Scar","Frequency","Den","Gridlock"];
   scripted.forEach(choice=>{voteCount[choice]=(voteCount[choice]||0)+1});
   setDemo(s=>({...s,votes:voteCount,voted:true}));
 };
 const finishVote=()=>{
  const choice=[...MAPS].sort((a,b)=>(demo.votes[b]||0)-(demo.votes[a]||0)||a.localeCompare(b))[0];
  setDemo(s=>({...s,selected:choice,phase:"lobby"}));void playUiSound("confirm","ranked");
 };
 return <div className="rounded-3xl border border-blue-500/40 bg-[#101829] p-5 sm:p-8 space-y-6" data-testid="ranked-demo">
   <div className="flex justify-between gap-3 items-start"><div><div className="text-xs text-blue-300 font-black tracking-[.2em]">SIMULAZIONE · 8 GIOCATORI BOT</div><h2 className="text-2xl sm:text-3xl font-black mt-2">MuchoRanked Demo</h2><p className="text-xs text-slate-400 mt-2">Nessun dato viene inviato al server. Elo, risultati e statistiche reali non cambiano.</p></div><button onClick={onClose} className="rounded-lg border border-white/20 px-3 py-2 text-xs">Chiudi</button></div>
   <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">{steps.map((step,i)=><div key={step} className={`h-1.5 rounded-full ${i<=steps.indexOf(demo.phase)?"bg-blue-500":"bg-slate-700"}`}/>)}</div>
   {preparation&&<div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3 flex justify-between items-center"><span className="font-bold text-blue-300 text-sm">PRE-MATCH · 02:00 TOTALI</span><span className="font-mono text-2xl font-black tabular-nums">{formattedRemaining}</span></div>}
   {demo.phase==="timeout"&&<div className="text-center py-9 space-y-4"><h3 className="text-2xl font-black text-amber-300">Tempo preparazione scaduto</h3><p className="text-sm text-slate-400">Nessun codice lobby inventato. In una partita reale occorre una procedura di cambio host o annullamento controllato.</p><button className={buttonClass} onClick={()=>setDemo(INITIAL())}>Ricomincia demo</button></div>}
   {demo.phase==="queue"&&<div className="text-center py-10"><div className="w-44 h-44 mx-auto rounded-full border-4 border-blue-500/70 bg-blue-500/10 animate-pulse grid place-items-center text-3xl font-black">{demo.count}/8</div><h3 className="text-xl font-black mt-7">RICERCA IN CORSO</h3><p className="text-slate-400 mt-2">I giocatori simulati stanno entrando in coda…</p></div>}
   {demo.phase==="found"&&<div className="text-center py-12"><div className="mx-auto w-36 h-36 rounded-full bg-blue-500/15 border-4 border-blue-400 animate-pulse grid place-items-center text-5xl">✓</div><h3 className="font-black text-4xl text-blue-300 mt-6">MATCH FOUND</h3><p className="text-slate-400 mt-3">8/8 giocatori trovati · Hardpoint BO1</p><button className={buttonClass+" mt-7"} onClick={()=>{advance("draft");void playUiSound("next","ranked")}}>Inizia Captain Draft</button></div>}
   {["draft","vote","lobby","ready","live","result"].includes(demo.phase)&&<div className="grid grid-cols-2 gap-3">{[["TEAM ALPHA",demo.alpha],["TEAM BRAVO",demo.bravo]].map(([name,team])=><div key={name} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><div className="text-blue-300 text-xs font-black mb-3">{name}</div>{team.map(p=><div className="text-sm py-1" key={p}>{p}</div>)}</div>)}</div>}
   {demo.phase==="draft"&&<div className="space-y-4"><div className="text-center"><h3 className="font-black text-2xl">CAPTAIN DRAFT</h3><p className="text-sm text-blue-300 mt-2">Turno del capitano {demo.picks%2===0?"Alpha (Sharhy)":"Bravo (Sysma)"}</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{demo.pool.map(p=><button className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-4 hover:bg-blue-500/25 font-bold" key={p} onClick={()=>pick(p)}>{p} <span className="text-blue-300">+</span></button>)}</div><p className="text-xs text-slate-400">Nella demo scegli tu per entrambi i capitani. Nella Ranked reale potranno scegliere solo i capitani designati.</p></div>}
   {demo.phase==="vote"&&<div className="space-y-5"><div className="text-center"><h3 className="font-black text-2xl">VOTAZIONE MAPPA</h3><p className="text-sm text-slate-400 mt-1">Un voto per giocatore · Hardpoint BO1</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{MAPS.map(map=><button key={map} disabled={demo.voted} onClick={()=>castVote(map)} className="rounded-xl border border-blue-400/30 bg-[#15243D] p-5 text-left disabled:opacity-75"><span className="block font-bold">{map}</span><span className="text-xs text-blue-300">{demo.voted?(demo.votes[map]||0)+" voti":"Vota questa mappa"}</span></button>)}</div>{demo.voted&&<button className={buttonClass+" w-full"} onClick={finishVote}>Conferma risultato votazione</button>}</div>}
   {demo.phase==="lobby"&&<div className="space-y-4 text-center"><div className="text-blue-300 uppercase text-xs font-bold">Mappa più votata</div><h3 className="text-3xl font-black">{demo.selected}</h3><p className="text-slate-400">Il capitano Alpha inserisce il codice lobby</p><form onSubmit={e=>{e.preventDefault();if(demo.code.length>=3){advance("ready");void playUiSound("code","ranked")}}} className="max-w-md mx-auto flex gap-2"><input value={demo.code} maxLength={32} required minLength={3} onChange={e=>setDemo(s=>({...s,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,"")}))} className="min-w-0 flex-1 rounded-xl bg-[#0B1220] border border-blue-500/40 p-3 font-mono" placeholder="Codice lobby (es. HP123)"/><button className={buttonClass}>Pubblica</button></form></div>}
   {demo.phase==="ready"&&<div className="text-center space-y-5"><p className="text-blue-300 text-sm font-bold">CODICE LOBBY</p><div className="font-mono font-black text-4xl sm:text-5xl tracking-widest break-all">{demo.code}</div><div className="text-xl font-black">READY CHECK · {demo.ready}/8</div><p className="text-slate-400 text-sm">Simula la conferma dei giocatori</p><button className={buttonClass} onClick={()=>{const next=demo.ready+1;setDemo(s=>({...s,ready:next,phase:next===8?"live":"ready"}));void playUiSound(next===8?"confirm":"ready","ranked")}}>{demo.ready===0?"Sono pronto":"Conferma prossimo giocatore"}</button></div>}
   {demo.phase==="live"&&<div className="text-center space-y-5 py-6"><h3 className="text-4xl font-black text-blue-300">MATCH LIVE</h3><p>Hardpoint BO1 · {demo.selected}</p><p className="font-mono text-3xl">{demo.code}</p><button className={buttonClass} onClick={()=>advance("result")}>Simula fine partita</button></div>}
   {demo.phase==="result"&&<div className="text-center space-y-5"><h3 className="text-2xl font-black">RISULTATO DEMO</h3><p className="text-sm text-slate-400">Simula la conferma del vincitore senza assegnare Elo.</p><div className="flex justify-center gap-3"><button className={buttonClass} onClick={()=>{setDemo(s=>({...s,winner:"Alpha"}));void playUiSound("victory","ranked")}}>Vince Alpha</button><button className={buttonClass} onClick={()=>{setDemo(s=>({...s,winner:"Bravo"}));void playUiSound("defeat","ranked")}}>Vince Bravo</button></div>{demo.winner&&<div className="text-xl font-black text-blue-300">Vittoria {demo.winner}! · Nessun Elo modificato</div>}<button className="text-sm underline text-slate-300" onClick={()=>setDemo(INITIAL())}>Ricomincia simulazione</button></div>}
 </div>;
}
