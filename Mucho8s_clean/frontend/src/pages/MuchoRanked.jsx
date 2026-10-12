import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {ShieldCheck,Trophy} from 'lucide-react';
import {useData} from '@/context/DataContext';
import {rankedRequest} from '@/lib/rankedApi';
import {toast} from 'sonner';
import {playUiSound} from '@/lib/uiAudio';
import RankedDemo from '@/components/RankedDemo';
import RankedRoom from '@/components/RankedRoom';
import RankedQueueOverlay from '@/components/RankedQueueOverlay';

export default function MuchoRanked(){
 const {discordPlayer,discordSession,signInWithDiscord,playerMap,playerAvatars,refreshMatchReports}=useData();
 const location=useLocation(), navigate=useNavigate();
 const demoMode=new URLSearchParams(location.search).get('demo')==='1';
 const [state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receivedAt,setReceivedAt]=useState(Date.now());
 const sequence=useRef(0), previousLobby=useRef(null), mounted=useRef(true), mutating=useRef(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;}},[]);
 const accept=useCallback((result,seq)=>{if(!mounted.current||seq!==sequence.current)return;setState(result);setReceivedAt(Date.now());setError('');},[]);
 const refresh=useCallback(async()=>{
  if(demoMode||!discordPlayer?.id||!discordSession||mutating.current)return;
  const seq=++sequence.current;
  try{accept(await rankedRequest('status'),seq);}catch(e){if(mounted.current&&seq===sequence.current)setError(e.message);}
 },[demoMode,discordPlayer?.id,discordSession,accept]);
 useEffect(()=>{refresh();if(demoMode||!discordPlayer?.id||!discordSession)return;const interval=setInterval(refresh,2000);return()=>clearInterval(interval)},[refresh,demoMode,discordPlayer?.id,discordSession]);
 const run=async(action,payload={})=>{
  if(demoMode||mutating.current)return;mutating.current=true;setBusy(true);const seq=++sequence.current;
  try{const result=await rankedRequest(action,payload);accept(result,seq);if(action==='report')await refreshMatchReports();void playUiSound(action==='join'?'search':action==='ready'?'ready':'confirm','ranked');}
  catch(e){toast.error(e.message);if(mounted.current)setError(e.message);}finally{mutating.current=false;if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{const id=state?.lobby?.id;if(id&&previousLobby.current!==id)void playUiSound('found','ranked');previousLobby.current=id;},[state?.lobby?.id]);
 return <div className="m8-page-stack" data-testid="mucho-ranked-page">
  <section className="m8-panel p-6 md:p-9 rounded-[24px] border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.12] via-[#101720] to-[#0B1018]"><div className="text-xs uppercase tracking-[0.2em] text-blue-400 font-black">MUCHO RANKED · HARDPOINT</div><h1 className="font-display font-black text-4xl mt-3">Play Ranked</h1><p className="text-sm text-[#9CA6B6] mt-3">Captain Draft · Map Vote · Ready Check · 02:00 totali · Elo condiviso con Mucho8s</p></section>
  {demoMode?<RankedDemo onClose={()=>navigate('/play')}/>:<div className="grid lg:grid-cols-[1.6fr_1fr] gap-5"><div>
   {!discordSession?<section className="m8-panel rounded-2xl p-6"><button onClick={signInWithDiscord} className="rounded-xl bg-[#5865F2] px-5 py-3 font-bold">Connect Discord</button></section>:!discordPlayer?<p className="text-amber-300">Collega il tuo account Discord a un profilo autorizzato.</p>:state?.lobby?<RankedRoom state={state} receivedAt={receivedAt} playerMap={playerMap} playerAvatars={playerAvatars} run={run} busy={busy}/>:<section className="m8-panel rounded-[22px] p-6 text-center">
    {state?.cancellationReason&&<p className="text-amber-300 mb-4">{state.cancellationReason}</p>}
    {state?.queue?<RankedQueueOverlay queue={state.queue} queuedPlayers={state.queuedPlayers} busy={busy} onLeave={()=>run('leave')}/>:<><div className="flex justify-center gap-2 mb-6"><span className="rounded-xl px-4 py-3 text-sm font-bold border border-blue-400 bg-blue-500/20 text-blue-200">HARDPOINT · HP</span></div><button disabled={busy||!state} onClick={()=>run('join',{mode:'hp'})} className="w-52 h-52 mx-auto rounded-full border-[5px] border-blue-400/70 bg-blue-600/15 hover:bg-blue-500/30 transition-all grid place-items-center font-black text-xl disabled:opacity-40" data-testid="ranked-queue-enter"><span><ShieldCheck size={35} className="text-blue-300 mx-auto mb-2"/>ENTRA IN CODA</span></button><p className="text-slate-400 mt-5 text-sm">Hardpoint · BO1 · 4v4 · Nessuna puntata</p></>}
   </section>}{error&&<p role="alert" className="text-red-300 text-xs mt-4">{error}</p>}
  </div><section className="m8-panel p-6 rounded-[22px] h-fit"><Trophy size={20} className="text-blue-300"/><h2 className="text-xl font-bold mt-2">Your Elo</h2><div className="text-sm mt-5">{discordPlayer?.name||'Guest'}</div><div className="font-black text-4xl mt-2">{discordPlayer?.currentElo??'—'}</div><p className="text-xs text-slate-400 mt-5">Stesso Elo, MVP, streak e classifica degli 8s. Un risultato contestato resta Live fino alla risoluzione admin.</p><Link to="/ranking" className="mt-4 inline-block text-blue-300 text-sm font-bold">Classifica →</Link></section></div>}
 </div>;
}
