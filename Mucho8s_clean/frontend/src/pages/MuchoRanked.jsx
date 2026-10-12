import React,{useCallback,useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {ShieldCheck,Users,Trophy,Gamepad2,RefreshCw} from "lucide-react";
import {useData} from "@/context/DataContext";
import {tierOf} from "@/lib/elo";
import {rankedRequest} from "@/lib/rankedApi";
import {toast} from "sonner";
const MODES=[{id:"snd",name:"Search & Destroy"},{id:"hp",name:"Hardpoint"},{id:"mixed",name:"Mixed CDL"}];
export default function MuchoRanked(){
 const {discordPlayer,discordSession,signInWithDiscord,playerMap,players=[]}=useData();
 const [mode,setMode]=useState("snd"),[state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refresh=useCallback(async()=>{if(!discordPlayer?.id||!discordSession)return;try{const s=await rankedRequest("status");setState(s);setError("");}catch(e){setError(e.message)}},[discordPlayer?.id,discordSession]);
 useEffect(()=>{refresh();if(!discordPlayer?.id||!discordSession)return;const interval=setInterval(refresh,4000);return()=>clearInterval(interval)},[refresh,discordPlayer?.id,discordSession]);
 const run=async(action,payload={})=>{setBusy(true);try{const result=await rankedRequest(action,payload);setState(result);setError("");}catch(e){toast.error(e.message);setError(e.message);}finally{setBusy(false)}};
 const lobby=state?.lobby, queue=state?.queue, member=state?.member;
 const participants=state?.players||[];
 const myElo=Number(discordPlayer?.currentElo??1000);
 const label=id=>playerMap?.[id]?.name||players.find(p=>p.id===id)?.name||id;
 return <div className="m8-page-stack" data-testid="mucho-ranked-page">
  <section className="m8-panel p-6 md:p-9 rounded-[24px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.12] via-[#101720] to-[#0B1018]">
    <div className="text-xs uppercase tracking-[0.2em] text-blue-400 font-black">MUCHO RANKED · 4V4</div>
    <h1 className="font-display font-black text-4xl mt-3">Play Ranked</h1>
    <p className="text-sm text-[#9CA6B6] mt-3">Automatic matchmaking · One shared Mucho8s Elo · No stakes, no earnings.</p>
    <div className="mt-5 flex flex-wrap gap-3"><span className="text-xs rounded-full border border-blue-500/30 text-blue-300 px-3 py-1.5">Same Elo & Ranking</span><span className="text-xs rounded-full border border-white/10 px-3 py-1.5">Discord verified players</span><span className="text-xs rounded-full border border-white/10 px-3 py-1.5">8-player ready check</span></div>
  </section>
  <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
  <section className="m8-panel p-6 rounded-[22px]">
   <div className="flex items-center gap-2"><Gamepad2 className="text-blue-400" size={20}/><h2 className="font-bold text-xl">Matchmaking</h2></div>
   {!discordSession?<button onClick={signInWithDiscord} className="mt-6 rounded-xl bg-[#5865F2] px-5 py-3 font-bold">Connect Discord</button>:
   !discordPlayer?<p className="mt-6 text-amber-300">Your Discord account must be linked to an approved player profile.</p>:
   lobby?<div className="mt-5">
      <div className="text-blue-300 font-bold text-lg">{lobby.status==="ready"?"MATCH FOUND · READY CHECK":lobby.status==="live"?"MATCH LIVE":"RESULT DISPUTED"}</div>
      <p className="text-xs text-muted-foreground mt-1">{lobby.mode?.toUpperCase()} · {lobby.status==="ready"?"Confirm before the 90-second deadline":"Submit a result after the match"}</p>
      <div className="grid sm:grid-cols-2 gap-3 mt-5">{[["ALPHA",lobby.team_a],["BRAVO",lobby.team_b]].map(([side,team])=><div key={side} className="rounded-xl bg-black/20 border border-white/10 p-4"><div className="font-black text-sm mb-3">{side}</div>{(team||[]).map(id=><div key={id} className="flex justify-between gap-2 text-sm py-1"><span>{label(id)}</span><span className="text-xs text-muted-foreground">{participants.find(p=>p.player_id===id)?.ready?"✓ Ready":lobby.status==="ready"?"Waiting":""}</span></div>)}</div>)}</div>
      {lobby.status==="ready"&&<button disabled={busy||member?.ready} onClick={()=>run("ready",{ready:true})} className="mt-5 rounded-xl px-5 py-3 bg-blue-600 disabled:opacity-50 font-bold">{member?.ready?"Ready confirmed":"I'M READY"}</button>}
      {["live","disputed"].includes(lobby.status)&&<div className="mt-5"><p className="text-sm text-muted-foreground mb-3">Report the winning team. All 8 players must confirm the same result before Elo changes.</p><div className="flex gap-2"><button disabled={busy} onClick={()=>run("report",{winner:"A"})} className="px-5 py-3 bg-blue-600 rounded-xl font-bold">Alpha won</button><button disabled={busy} onClick={()=>run("report",{winner:"B"})} className="px-5 py-3 bg-slate-700 rounded-xl font-bold">Bravo won</button></div>{member?.report&&<div className="text-xs text-muted-foreground mt-3">You reported {member.report}. Confirmations: {participants.filter(p=>p.report===member.report).length}/8</div>}{lobby.status==="disputed"&&<p className="mt-3 text-amber-300 text-xs">Conflicting reports. No Elo will be changed until all votes agree.</p>}</div>}
   </div>:queue?<div className="mt-6"><div className="font-black text-xl text-blue-300">SEARCHING FOR MATCH...</div><p className="mt-2 text-sm text-muted-foreground">{state?.queuedPlayers||1}/8 queued in {queue.mode?.toUpperCase()} · keep this page open</p><button onClick={()=>run("leave")} disabled={busy} className="mt-5 px-5 py-3 border border-white/20 rounded-xl">Leave queue</button></div>:
   <div className="mt-5"><div className="grid sm:grid-cols-3 gap-3">{MODES.map(item=><button key={item.id} disabled={busy} onClick={()=>setMode(item.id)} className={`rounded-xl border p-4 text-left text-sm font-bold ${mode===item.id?"border-blue-400 bg-blue-500/10":"border-white/10"}`}>{item.name}</button>)}</div><button disabled={busy} onClick={()=>run("join",{mode})} className="w-full mt-5 rounded-xl py-3 bg-blue-600 hover:bg-blue-500 font-black">FIND MATCH</button></div>}
   {error&&<p role="alert" className="text-red-300 text-xs mt-4">{error}</p>}
   {discordPlayer&&<button onClick={refresh} className="text-xs flex gap-2 items-center mt-5 text-blue-300"><RefreshCw size={14}/> Refresh status</button>}
  </section>
  <section className="m8-panel p-6 rounded-[22px]"><div className="flex gap-2 items-center"><Trophy size={20} className="text-blue-300"/><h2 className="text-xl font-bold">Your Elo</h2></div><div className="text-sm mt-5">{discordPlayer?.name||"Guest"}</div><div className="font-black text-4xl mt-2">{discordPlayer?myElo:"—"}</div><div className="text-xs text-muted-foreground">{discordPlayer?tierOf(myElo)?.name:"Connect Discord"}</div><p className="text-xs text-muted-foreground mt-6 leading-5"><ShieldCheck size={14} className="inline text-emerald-400 mr-1"/>Ranked uses the same Mucho8s rating, rank, achievements and leaderboard. Money is excluded.</p><div className="mt-5 text-xs text-muted-foreground flex gap-2 items-center"><Users size={15}/>{players.length} registered players</div><Link to="/ranking" className="mt-4 inline-block text-blue-300 text-sm font-bold">View leaderboard →</Link></section>
  </div>
 </div>;
}
