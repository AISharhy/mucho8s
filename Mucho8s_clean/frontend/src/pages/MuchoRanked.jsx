import React,{useCallback,useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {ShieldCheck,Users,Trophy,Gamepad2,RefreshCw} from "lucide-react";
import {useData} from "@/context/DataContext";
import {tierOf} from "@/lib/elo";
import {rankedRequest} from "@/lib/rankedApi";
import {toast} from "sonner";
import {playUiSound} from "@/lib/uiAudio";
import RankedDemo from "@/components/RankedDemo";

export default function MuchoRanked(){
 const {discordPlayer,discordSession,signInWithDiscord,playerMap,players=[]}=useData();
 const [demoMode,setDemoMode]=useState(false);
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[lobbyCodeInput,setLobbyCodeInput]=useState("");
 const refresh=useCallback(async()=>{if(!discordPlayer?.id||!discordSession)return;try{const s=await rankedRequest("status");setState(s);setError("");}catch(e){setError(e.message)}},[discordPlayer?.id,discordSession]);
 useEffect(()=>{refresh();if(!discordPlayer?.id||!discordSession)return;const interval=setInterval(refresh,4000);return()=>clearInterval(interval)},[refresh,discordPlayer?.id,discordSession]);
 const run=async(action,payload={})=>{setBusy(true);try{const result=await rankedRequest(action,payload);setState(result);setError("");
  const cues={join:"search",leave:"back",ready:"ready","set-lobby-code":"code",report:"confirm"};
  if(cues[action]) void playUiSound(cues[action],"ranked");}catch(e){toast.error(e.message);setError(e.message);}finally{setBusy(false)}};
 const previousStatus=useRef(null);
 useEffect(()=>{
   const lobby=state?.lobby, queue=state?.queue;
   const next=lobby ? `${lobby.id}:${lobby.status}` : queue ? "queued" : "idle";
   const previous=previousStatus.current;
   if(previous && previous!==next){
     if(lobby?.status==="ready" && !previous.startsWith(lobby.id+":")) void playUiSound("found","ranked");
     else if(lobby?.status==="live" && previous.startsWith(lobby.id+":ready")) void playUiSound("confirm","ranked");
   }
   previousStatus.current=next;
 },[state?.lobby?.id,state?.lobby?.status,state?.queue?.mode]);
 const previousCode=useRef(null);
 useEffect(()=>{
   const current=state?.lobby?.lobby_code||null;
   if(current && previousCode.current!==null && previousCode.current!==current) void playUiSound("code","ranked");
   previousCode.current=current;
 },[state?.lobby?.lobby_code]);
 const lobby=state?.lobby, queue=state?.queue, member=state?.member;
 const participants=state?.players||[];
 const myElo=Number(discordPlayer?.currentElo??1000);
 const label=id=>playerMap?.[id]?.name||players.find(p=>p.id===id)?.name||id;
 return <div className="m8-page-stack" data-testid="mucho-ranked-page">
  <section className="m8-panel p-6 md:p-9 rounded-[24px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.12] via-[#101720] to-[#0B1018]">
    <div className="text-xs uppercase tracking-[0.2em] text-blue-400 font-black">MUCHO RANKED · 4V4</div>
    <div className="flex flex-wrap items-center justify-between gap-4 mt-3"><h1 className="font-display font-black text-4xl">Play Ranked</h1><button type="button" data-testid="ranked-demo-start" className="rounded-xl border border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20 px-5 py-3 text-blue-200 font-black text-sm" onClick={()=>setDemoMode(s=>!s)}>{demoMode?"CHIUDI DEMO":"SIMULA RANKED · 8 BOT"}</button></div>
    <p className="text-sm text-[#9CA6B6] mt-3">Hardpoint BO1 · 4v4 · One shared Mucho8s Elo · No stakes, no earnings.</p>
    <div className="mt-5 flex flex-wrap gap-3"><span className="text-xs rounded-full border border-blue-500/30 text-blue-300 px-3 py-1.5">Same Elo & Ranking</span><span className="text-xs rounded-full border border-white/10 px-3 py-1.5">Discord verified players</span><span className="text-xs rounded-full border border-white/10 px-3 py-1.5">8-player ready check</span></div>
  </section>
  {demoMode?<RankedDemo onClose={()=>setDemoMode(false)}/>:<div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
  <section className="m8-panel p-6 rounded-[22px]">
   <div className="flex items-center gap-2"><Gamepad2 className="text-blue-400" size={20}/><h2 className="font-bold text-xl">Matchmaking</h2></div>
   {!discordSession?<button onClick={signInWithDiscord} className="mt-6 rounded-xl bg-[#5865F2] px-5 py-3 font-bold">Connect Discord</button>:
   !discordPlayer?<p className="mt-6 text-amber-300">Your Discord account must be linked to an approved player profile.</p>:
   lobby?<div className="mt-5">
      <div className="text-blue-300 font-bold text-lg">{lobby.status==="ready"?"MATCH FOUND · READY CHECK":lobby.status==="vote"?"VOTAZIONE MAPPA":lobby.status==="live"?"MATCH LIVE":"RESULT DISPUTED"}</div>
      <p className="text-xs text-muted-foreground mt-1">Hardpoint BO1 · {lobby.map_name ? `${lobby.map_name} · ` : ""}{lobby.status==="ready"?"Confirm before the 90-second deadline":"Submit a result after the match"}</p>
      {lobby.status==="vote"&&<div className="mt-6"><h3 className="text-xl font-black text-center text-blue-300">SCEGLI LA MAPPA · 1 VOTO</h3><p className="text-sm text-center text-slate-400 mt-2">{(state?.mapVotes||[]).length}/8 voti ricevuti · vince la mappa più votata</p><div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">{["Colossus","Den","Gridlock","Frequency","Scar","Hacienda"].map(map=><button key={map} disabled={busy||state?.voted} onClick={()=>run("vote-map",{map})} className="p-5 border border-blue-400/30 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-60 text-left"><span className="block font-bold">{map}</span><span className="text-xs text-blue-300">{(state?.mapVotes||[]).filter(v=>v.map_name===map).length} voti</span></button>)}</div>{state?.voted&&<p className="text-sm text-emerald-300 text-center mt-4">Voto inviato. Attendi gli altri giocatori.</p>}</div>}
      {["live","disputed"].includes(lobby.status)&&<div className="mt-5 rounded-2xl border border-blue-400/40 bg-gradient-to-b from-blue-600/20 to-[#0b1426] px-5 py-7 text-center" data-testid="ranked-lobby-code">
        <div className="text-xs font-black tracking-[0.24em] uppercase text-blue-300">Lobby code · Join the captain</div>
        {lobby.lobby_code?<div className="mt-4 text-3xl sm:text-5xl font-black font-mono tracking-[0.15em] break-all select-all text-white" data-testid="ranked-lobby-code-value">{lobby.lobby_code}</div>:<div className="mt-4 text-lg text-white/70">Waiting for captain to enter the lobby code</div>}
        {discordPlayer?.id===lobby.team_a?.[0]&&<form className="mt-5 max-w-sm mx-auto flex gap-2" onSubmit={e=>{e.preventDefault();run("set-lobby-code",{code:lobbyCodeInput});}}>
          <input aria-label="Lobby code" maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" required value={lobbyCodeInput} onChange={e=>setLobbyCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g,""))} placeholder="Enter lobby code" className="min-w-0 flex-1 h-11 px-3 rounded-xl bg-[#101A2A] border border-blue-400/40 text-white font-mono"/>
          <button type="submit" disabled={busy} className="rounded-xl bg-blue-600 hover:bg-blue-500 px-4 font-bold">Publish</button>
        </form>}
      </div>}
      <div className="grid sm:grid-cols-2 gap-3 mt-5">{[["ALPHA",lobby.team_a],["BRAVO",lobby.team_b]].map(([side,team])=><div key={side} className="rounded-xl bg-black/20 border border-white/10 p-4"><div className="font-black text-sm mb-3">{side}</div>{(team||[]).map(id=><div key={id} className="flex justify-between gap-2 text-sm py-1"><span>{label(id)}</span><span className="text-xs text-muted-foreground">{participants.find(p=>p.player_id===id)?.ready?"✓ Ready":lobby.status==="ready"?"Waiting":""}</span></div>)}</div>)}</div>
      {lobby.status==="ready"&&<button disabled={busy||member?.ready} onClick={()=>run("ready",{ready:true})} className="mt-5 rounded-xl px-5 py-3 bg-blue-600 disabled:opacity-50 font-bold">{member?.ready?"Ready confirmed":"I'M READY"}</button>}
      {["live","disputed"].includes(lobby.status)&&<div className="mt-5"><p className="text-sm text-muted-foreground mb-3">Report the winning team. All 8 players must confirm the same result before Elo changes.</p><div className="flex gap-2"><button disabled={busy} onClick={()=>run("report",{winner:"A"})} className="px-5 py-3 bg-blue-600 rounded-xl font-bold">Alpha won</button><button disabled={busy} onClick={()=>run("report",{winner:"B"})} className="px-5 py-3 bg-slate-700 rounded-xl font-bold">Bravo won</button></div>{member?.report&&<div className="text-xs text-muted-foreground mt-3">You reported {member.report}. Confirmations: {participants.filter(p=>p.report===member.report).length}/8</div>}{lobby.status==="disputed"&&<p className="mt-3 text-amber-300 text-xs">Conflicting reports. No Elo will be changed until all votes agree.</p>}</div>}
   </div>:queue?<div className="mt-8 text-center"><div className="w-52 h-52 rounded-full border-[5px] border-blue-400/70 bg-blue-500/10 animate-pulse mx-auto flex items-center justify-center"><span className="font-black text-4xl text-blue-200">{state?.queuedPlayers||1}/8</span></div><div className="font-black text-xl text-blue-300 mt-5">RICERCA MATCH...</div><p className="mt-2 text-sm text-muted-foreground">Hardpoint BO1 · Mantieni aperta questa pagina</p><button onClick={()=>run("leave")} disabled={busy} className="mt-5 px-5 py-3 border border-white/20 rounded-xl">Leave queue</button></div>:
   <div className="mt-8 text-center"><button disabled={busy} onClick={()=>run("join",{mode:"hp"})} className="mx-auto w-52 h-52 sm:w-60 sm:h-60 rounded-full border-[5px] border-blue-400/70 bg-blue-600/15 hover:bg-blue-500/30 hover:scale-[1.03] transition-all shadow-[0_0_70px_rgba(37,99,235,.19)] flex flex-col items-center justify-center gap-2 font-black text-xl" data-testid="ranked-queue-enter"><ShieldCheck size={35} className="text-blue-300"/>ENTRA IN CODA</button><p className="text-slate-400 mt-6 text-sm">Hardpoint BO1 · 4v4</p><p className="text-blue-300 text-sm mt-2">Giocatori in coda: {state?.queuedPlayers??0}</p></div>}
   {error&&<p role="alert" className="text-red-300 text-xs mt-4">{error}</p>}
   {discordPlayer&&<button onClick={refresh} className="text-xs flex gap-2 items-center mt-5 text-blue-300"><RefreshCw size={14}/> Refresh status</button>}
  </section>
  <section className="m8-panel p-6 rounded-[22px]"><div className="flex gap-2 items-center"><Trophy size={20} className="text-blue-300"/><h2 className="text-xl font-bold">Your Elo</h2></div><div className="text-sm mt-5">{discordPlayer?.name||"Guest"}</div><div className="font-black text-4xl mt-2">{discordPlayer?myElo:"—"}</div><div className="text-xs text-muted-foreground">{discordPlayer?tierOf(myElo)?.name:"Connect Discord"}</div><p className="text-xs text-muted-foreground mt-6 leading-5"><ShieldCheck size={14} className="inline text-emerald-400 mr-1"/>Ranked uses the same Mucho8s rating, rank, achievements and leaderboard. Money is excluded.</p><div className="mt-5 text-xs text-muted-foreground flex gap-2 items-center"><Users size={15}/>{players.length} registered players</div><Link to="/ranking" className="mt-4 inline-block text-blue-300 text-sm font-bold">View leaderboard →</Link></section>
  </div>}
 </div>;
}
