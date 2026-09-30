import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw, Save, Search, Sparkles, Volume2, WandSparkles } from "lucide-react";
import { toast } from "sonner";

const VFX = [
  ["BigHit","Impact"],["Impact","Impact"],["SmallHit","Impact"],["Charged","Energy"],
  ["ElectricShield","Energy"],["Explosion","Explosion"],["Explosion2","Explosion"],["Kabooms","Explosion"],
  ["Magma","Fire"],["DitheredFire","Fire"],["FastPixelFire","Fire"],["PuffAndStars","Achievement"],
  ["Constellation","Achievement"],["TheVortex","Energy"],["Hyperspeed","Energy"],["PowerChords","Energy"],
  ["Anima","Particles"],["Wheel","Particles"],["Worm","Particles"],["Tentacles","Particles"],["EldenRing","Achievement"],
].map(([name,category])=>({id:name,name,category,source:"VFX Free Pack"}));

const SOUNDS = [
  ["ui-confirm","UI"],["ui-back","UI"],["ui-notification","Notification"],["impact-heavy","Impact"],
  ["impact-light","Impact"],["victory","Victory"],["defeat","Defeat"],["rank-up","Rank"],
  ["rank-down","Rank"],["achievement","Achievement"],["warning","Warning"],["money-win","Money"],
  ["shield","Defense"],["streak","Streak"],["match-found","Cinematic"],
].map(([name,category])=>({id:name,name:name.replaceAll("-"," "),category,source:"Kenney / Mucho"}));

const EVENTS = [
  ["mvp","MVP","BigHit","achievement"],["merda","Merda","Explosion2","defeat"],
  ["bounty","Bounty Claimed","Impact","impact-heavy"],["upset","Giant Killer","Kabooms","victory"],
  ["nemesis","Nemesis Defeated","TheVortex","impact-heavy"],["rank-up","Rank Up","Charged","rank-up"],
  ["rank-down","Rank Down","TheVortex","rank-down"],["placement","Placement Reveal","Constellation","achievement"],
  ["season","New Season","Hyperspeed","victory"],["trophy","Trophy Unlocked","PuffAndStars","achievement"],
  ["streak","Win Streak","Magma","streak"],["defense","Rank Defense","ElectricShield","shield"],
  ["promotion","Promotion Match","Charged","warning"],["revenge","Revenge Complete","BigHit","victory"],
  ["king","King of Lobby","EldenRing","achievement"],["money","Money Chall Won","PuffAndStars","money-win"],
  ["rivalry","Rivalry Heated","PowerChords","warning"],["mastery","Map Mastery","Constellation","achievement"],
  ["record","Personal Record","Hyperspeed","achievement"],["shutdown","Streak Ended","Explosion","defeat"],
  ["match-found","Match Found / VS","Hyperspeed","match-found"],
].map(([type,label,vfx,sound])=>({type,label,vfx,sound,volume:80,duration:2600}));

const STORAGE_KEY="mucho8s-media-lab-v1";

export default function AnimationLab() {
  const [section,setSection]=useState("events");
  const [query,setQuery]=useState("");
  const [vfxCategory,setVfxCategory]=useState("All");
  const [soundCategory,setSoundCategory]=useState("All");
  const [config,setConfig]=useState(()=>{
    try { return {...Object.fromEntries(EVENTS.map(e=>[e.type,e])),...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}; }
    catch { return Object.fromEntries(EVENTS.map(e=>[e.type,e])); }
  });

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify(config)); },[config]);

  const play=(type)=>{
    const item=config[type]||EVENTS.find(e=>e.type===type);
    if(!item)return;
    window.dispatchEvent(new CustomEvent("mucho:preview-animation",{detail:{
      type,
      count:5, bonus:15, amount:25, opponent:"Sysma", map:"RAID", value:"NEW PEAK ELO",
      teamA:"TEAM ALPHA",teamB:"TEAM BRAVO",meta:"BO5 • BLACK OPS 7 • MONEY CHALL €5",
      media:{vfx:item.vfx,sound:item.sound,volume:item.volume,duration:item.duration}
    }}));
  };

  const update=(type,field,value)=>setConfig(prev=>({...prev,[type]:{...prev[type],type,[field]:value}}));
  const reset=()=>{ const next=Object.fromEntries(EVENTS.map(e=>[e.type,{...e}])); setConfig(next); toast.success("Media mappings reset"); };
  const save=()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify(config)); toast.success("Media Library saved"); };

  const filteredEvents=EVENTS.filter(e=>e.label.toLowerCase().includes(query.toLowerCase()));
  const vfxCats=["All",...new Set(VFX.map(x=>x.category))];
  const soundCats=["All",...new Set(SOUNDS.map(x=>x.category))];
  const filteredVfx=VFX.filter(x=>(vfxCategory==="All"||x.category===vfxCategory)&&x.name.toLowerCase().includes(query.toLowerCase()));
  const filteredSounds=SOUNDS.filter(x=>(soundCategory==="All"||x.category===soundCategory)&&x.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section className="space-y-5">
      <div className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="brand-kicker mb-2">ADMIN • MEDIA SYSTEM</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">Media Lab</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Gestisci VFX, sound e combinazioni evento senza modificare ELO, match o statistiche.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="h-10 rounded-xl border border-white/10 px-3 text-xs font-black uppercase tracking-wider text-white/60 hover:text-white"><RotateCcw size={14} className="inline mr-2"/>Reset</button>
            <button onClick={save} className="h-10 rounded-xl bg-magma px-4 text-xs font-black uppercase tracking-wider text-white"><Save size={14} className="inline mr-2"/>Save</button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {[["events","Event Mapping",WandSparkles],["vfx","VFX Library",Sparkles],["sounds","Sound Library",Volume2]].map(([key,label,Icon])=>(
            <button key={key} onClick={()=>{setSection(key);setQuery("");}} className={"h-10 rounded-xl border px-4 text-xs font-black uppercase tracking-wider "+(section===key?"border-magma/60 bg-magma/10 text-white":"border-white/10 bg-white/[.02] text-white/45")}>
              <Icon size={14} className="inline mr-2"/>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={"Search "+(section==="events"?"events":section==="vfx"?"VFX":"sounds")+"..."} className="h-11 w-full rounded-xl border border-white/10 bg-[#0F1218] pl-10 pr-3 text-sm outline-none focus:border-magma/50"/>
      </div>

      {section==="events" && (
        <div className="space-y-3">
          {filteredEvents.map(base=>{const row=config[base.type]||base; return (
            <div key={base.type} className="m8-panel rounded-2xl p-4 grid gap-3 lg:grid-cols-[minmax(160px,1.2fr)_1fr_1fr_110px_100px_auto] lg:items-center">
              <div><div className="text-[9px] uppercase tracking-[.2em] text-white/25">Event</div><div className="mt-1 font-black uppercase">{base.label}</div></div>
              <label className="text-[9px] uppercase tracking-wider text-white/35">VFX<select value={row.vfx||""} onChange={e=>update(base.type,"vfx",e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-[#0F1218] px-2 text-xs normal-case text-white">{VFX.map(x=><option key={x.id}>{x.id}</option>)}</select></label>
              <label className="text-[9px] uppercase tracking-wider text-white/35">Sound<select value={row.sound||""} onChange={e=>update(base.type,"sound",e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-[#0F1218] px-2 text-xs normal-case text-white">{SOUNDS.map(x=><option key={x.id}>{x.id}</option>)}</select></label>
              <label className="text-[9px] uppercase tracking-wider text-white/35">Volume<div className="mt-1 flex h-9 items-center gap-2"><input type="range" min="0" max="100" value={row.volume??80} onChange={e=>update(base.type,"volume",Number(e.target.value))} className="min-w-0 w-full"/><span className="font-mono text-[10px]">{row.volume??80}%</span></div></label>
              <label className="text-[9px] uppercase tracking-wider text-white/35">Duration<select value={row.duration||2600} onChange={e=>update(base.type,"duration",Number(e.target.value))} className="mt-1 block h-9 w-full rounded-lg border border-white/10 bg-[#0F1218] px-2 text-xs normal-case text-white"><option value={1800}>1.8s</option><option value={2600}>2.6s</option><option value={3400}>3.4s</option><option value={4300}>4.3s</option></select></label>
              <button onClick={()=>play(base.type)} className="h-10 rounded-xl border border-emerald-500/25 bg-emerald-500/[.06] px-4 text-xs font-black uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/[.12]"><Play size={14} className="inline mr-1.5"/>Preview</button>
            </div>
          )})}
        </div>
      )}

      {section==="vfx" && <Library items={filteredVfx} categories={vfxCats} active={vfxCategory} setActive={setVfxCategory} kind="VFX" />}
      {section==="sounds" && <Library items={filteredSounds} categories={soundCats} active={soundCategory} setActive={setSoundCategory} kind="SOUND" />}
    </section>
  );
}

function Library({items,categories,active,setActive,kind}){
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">{categories.map(cat=><button key={cat} onClick={()=>setActive(cat)} className={"rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider "+(active===cat?"border-magma/50 bg-magma/10 text-white":"border-white/10 text-white/40")}>{cat}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(item=><div key={item.id} className="m8-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="text-[9px] font-black uppercase tracking-[.2em] text-white/25">{item.category}</div><div className="mt-2 font-black">{item.name}</div><div className="mt-1 text-[10px] text-white/30">{item.source}</div></div><div className="rounded-lg border border-white/10 bg-white/[.03] px-2 py-1 text-[9px] font-black text-white/35">{kind}</div></div>
      <div className="mt-4 h-20 rounded-xl border border-white/5 bg-[radial-gradient(circle_at_center,rgba(255,42,59,.16),transparent_65%)] flex items-center justify-center"><span className="text-[10px] font-black uppercase tracking-[.2em] text-white/25">{kind==="VFX"?"Asset slot ready":"Audio slot ready"}</span></div>
    </div>)}</div>
  </div>
}
