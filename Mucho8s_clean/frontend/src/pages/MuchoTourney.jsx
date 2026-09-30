import React, { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Crown, Plus, RotateCcw, Shuffle, Swords, Trophy, UsersRound, X } from "lucide-react";
import { toast } from "sonner";

const STORE = "mucho8s-tourney-admin-v1";
const blank = { name:"MuchoTourney Test Cup", game:"BO7", format:"4v4", bestOf:5, finalBestOf:5, mode:"CDL Mix", startMode:"Hardpoint", seeding:"manual", teams:[], bracket:[], champion:null, status:"setup" };
const load = () => { try { return {...blank,...JSON.parse(localStorage.getItem(STORE)||"{}")}; } catch { return blank; } };
const roundsFor = n => n<=2?["Final"]:n<=4?["Semifinals","Final"]:["Quarterfinals","Semifinals","Final"];
const makeBracket = teams => {
  const size=teams.length<=2?2:teams.length<=4?4:8, seeded=[...teams].slice(0,size);
  while(seeded.length<size) seeded.push(null);
  const order=size===8?[0,7,3,4,1,6,2,5]:size===4?[0,3,1,2]:[0,1];
  const first=[]; for(let i=0;i<order.length;i+=2) first.push({id:`r0m${i/2}`,round:0,a:seeded[order[i]],b:seeded[order[i+1]],winner:null,scoreA:0,scoreB:0});
  const rounds=[first]; let count=first.length/2, r=1; while(count>=1){rounds.push(Array.from({length:count},(_,i)=>({id:`r${r}m${i}`,round:r,a:null,b:null,winner:null,scoreA:0,scoreB:0}))); count/=2;r++;}
  return rounds;
};
export default function MuchoTourney(){
 const {isAdmin}=useData(); const [t,setT]=useState(load); const [teamName,setTeamName]=useState("");
 const save=next=>{setT(next);localStorage.setItem(STORE,JSON.stringify(next));};
 const patch=p=>save({...t,...p});
 const addTeam=()=>{const name=teamName.trim();if(!name)return;if(t.teams.some(x=>x.name.toLowerCase()===name.toLowerCase()))return toast.error("Team already registered"); if(t.teams.length>=8)return toast.error("Maximum 8 teams in this test bracket"); save({...t,teams:[...t.teams,{id:crypto.randomUUID?.()||String(Date.now()),name,seed:t.teams.length+1}],bracket:[],champion:null,status:"setup"});setTeamName("");};
 const generate=()=>{if(t.teams.length<2)return toast.error("Add at least 2 teams");let teams=[...t.teams];if(t.seeding==="random")teams.sort(()=>Math.random()-.5); teams=teams.map((x,i)=>({...x,seed:i+1}));save({...t,teams,bracket:makeBracket(teams),champion:null,status:"live"});toast.success("Bracket generated");};
 const report=(ri,mi,winner)=>{const br=t.bracket.map(r=>r.map(m=>({...m})));const m=br[ri][mi];m.winner=winner;m.scoreA=winner==="a"?Math.ceil((ri===br.length-1?t.finalBestOf:t.bestOf)/2):0;m.scoreB=winner==="b"?Math.ceil((ri===br.length-1?t.finalBestOf:t.bestOf)/2):0;const won=winner==="a"?m.a:m.b;if(ri<br.length-1){const next=br[ri+1][Math.floor(mi/2)]; if(mi%2===0)next.a=won;else next.b=won;next.winner=null;next.scoreA=0;next.scoreB=0;} const champion=ri===br.length-1?won:null;save({...t,bracket:br,champion:champion||t.champion,status:champion?"completed":"live"});};
 const reset=()=>{if(!window.confirm("Reset MuchoTourney test data?"))return;save({...blank});};
 const labels=useMemo(()=>roundsFor(t.bracket?.[0]?.length? t.bracket[0].length*2:Math.max(2,t.teams.length)),[t.bracket,t.teams.length]);
 if(!isAdmin)return <Navigate to="/" replace/>;
 return <div className="m8-page-stack gap-3 max-w-7xl mx-auto">
  <section className="m8-panel rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
   <div><div className="brand-kicker text-[#D5A33A] mb-1">Admin test environment</div><h1 className="font-display text-3xl font-black tracking-[-.04em]">MuchoTourney</h1><p className="text-sm text-muted-foreground mt-1">Private tournament control room · single elimination test build.</p></div>
   <div className="flex gap-2"><span className="h-10 px-3 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[.06] text-[#D5A33A] flex items-center gap-2 text-xs font-black"><Trophy size={15}/>ADMIN ONLY</span><button onClick={reset} className="h-10 w-10 rounded-xl border border-[#2A303B] flex items-center justify-center"><RotateCcw size={15}/></button></div>
  </section>
  <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[["STATUS",t.status.toUpperCase()],["TEAMS",t.teams.length+"/8"],["FORMAT",t.format+" · BO"+t.bestOf],["CHAMPION",t.champion?.name||"—"]].map(([a,b])=><div key={a} className="m8-panel rounded-2xl p-4"><div className="text-[9px] tracking-[.16em] text-[#697181]">{a}</div><div className="text-lg font-black mt-1">{b}</div></div>)}</section>
  <section className="m8-panel rounded-[22px] p-5"><div className="flex items-center gap-2 mb-4"><Swords size={17} className="text-[#D5A33A]"/><h2 className="font-display font-black">Tournament Settings</h2></div>
   <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <label className="col-span-2"><span className="text-[9px] tracking-widest text-[#697181]">NAME</span><input value={t.name} onChange={e=>patch({name:e.target.value})} className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"/></label>
    {[
     ["GAME","game",["BO7","BO6","MW3","CW","BO2"]],["FORMAT","format",["2v2","3v3","4v4"]],
     ["MODE","mode",["CDL Mix","Hardpoint","Search & Destroy"]],["SERIES","bestOf",[3,5]],
     ["FINAL","finalBestOf",[3,5]],["SEEDING","seeding",["manual","random"]]
    ].map(([l,k,opts])=><label key={k}><span className="text-[9px] tracking-widest text-[#697181]">{l}</span><select value={t[k]} onChange={e=>patch({[k]:["bestOf","finalBestOf"].includes(k)?Number(e.target.value):e.target.value})} className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold">{opts.map(o=><option key={o}>{o}</option>)}</select></label>)}
    {t.mode==="CDL Mix"&&<label><span className="text-[9px] tracking-widest text-[#697181]">MIX START</span><select value={t.startMode} onChange={e=>patch({startMode:e.target.value})} className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold"><option>Hardpoint</option><option>Search & Destroy</option></select></label>}
   </div>
  </section>
  <section className="grid lg:grid-cols-[360px_1fr] gap-3">
   <div className="m8-panel rounded-[22px] p-5"><div className="flex items-center gap-2"><UsersRound size={17}/><h2 className="font-display font-black">Teams / Seeding</h2></div>
    <div className="flex gap-2 mt-4"><input value={teamName} onChange={e=>setTeamName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTeam()} placeholder="Team name" className="h-10 min-w-0 flex-1 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"/><button onClick={addTeam} className="w-10 h-10 rounded-xl bg-[#D5A33A] text-black flex items-center justify-center"><Plus size={16}/></button></div>
    <div className="mt-3 space-y-2">{t.teams.map((team,i)=><div key={team.id} className="h-11 px-3 rounded-xl border border-[#252B36] bg-[#10151D] flex items-center gap-3"><span className="font-mono text-[#D5A33A] text-xs">#{i+1}</span><span className="font-bold text-sm flex-1 truncate">{team.name}</span><button onClick={()=>save({...t,teams:t.teams.filter(x=>x.id!==team.id),bracket:[],champion:null,status:"setup"})} className="text-[#697181] hover:text-red-400"><X size={14}/></button></div>)}</div>
    <button onClick={generate} className="mt-4 w-full h-11 rounded-xl bg-magma text-white font-black flex items-center justify-center gap-2"><Shuffle size={15}/> Generate Bracket</button>
   </div>
   <div className="m8-panel rounded-[22px] p-5 overflow-x-auto"><div className="flex items-center justify-between"><h2 className="font-display font-black">Bracket</h2><span className="text-[10px] text-muted-foreground">Click winner to advance</span></div>
    {!t.bracket.length?<div className="min-h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground"><Trophy size={34} className="mb-3 opacity-40"/><div className="font-bold text-white">Bracket not generated</div><div className="text-xs mt-1">Add teams and generate the test bracket.</div></div>:
    <div className="flex gap-6 min-w-[760px] mt-5">{t.bracket.map((round,ri)=><div key={ri} className="flex-1 min-w-[220px]"><div className="text-[10px] tracking-[.18em] text-[#D5A33A] font-black mb-3">{labels[ri]||`ROUND ${ri+1}`}</div><div className="flex flex-col justify-around h-[420px]">{round.map((m,mi)=><div key={m.id} className="rounded-xl border border-[#252B36] bg-[#0F141C] overflow-hidden"><div className="text-[9px] text-[#697181] px-3 pt-2">BO{ri===t.bracket.length-1?t.finalBestOf:t.bestOf} · {t.mode}</div>{[["a",m.a],["b",m.b]].map(([side,team])=><button key={side} disabled={!team||!!m.winner} onClick={()=>report(ri,mi,side)} className={`w-full h-10 px-3 flex items-center gap-2 text-left text-xs font-bold border-t border-[#202631] ${m.winner===side?"bg-emerald-500/10 text-emerald-300":m.winner?"opacity-40":"hover:bg-white/[.04]"}`}><span className="flex-1 truncate">{team?.name||"TBD"}</span>{m.winner===side&&<Crown size={13}/>}</button>)}</div>)}</div></div>)}</div>}
   </div>
  </section>
  {t.champion&&<section className="rounded-[22px] border border-[#D5A33A]/30 bg-[#D5A33A]/[.06] p-7 text-center"><Crown size={34} className="text-[#D5A33A] mx-auto"/><div className="brand-kicker text-[#D5A33A] mt-3">MuchoTourney Champion</div><div className="font-display text-3xl font-black mt-1">{t.champion.name}</div><div className="text-xs text-muted-foreground mt-2">Champion card / trophy hook ready for the final production flow.</div></section>}
 </div>;
}
