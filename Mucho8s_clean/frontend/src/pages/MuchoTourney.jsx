import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Trophy, Plus, Swords, UsersRound } from "lucide-react";

export default function MuchoTourney() {
  const { isAdmin } = useData();
  const [format, setFormat] = useState("4v4");
  const [bestOf, setBestOf] = useState(5);

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="m8-page-stack gap-3 max-w-6xl mx-auto">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="brand-kicker text-[#D5A33A] mb-1">Admin test environment</div>
            <h1 className="font-display text-3xl font-black tracking-[-0.04em]">MuchoTourney</h1>
            <p className="text-sm text-muted-foreground mt-1">Build and test tournaments privately before opening them to players.</p>
          </div>
          <div className="h-12 px-4 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] flex items-center gap-2 text-[#D5A33A] font-black">
            <Trophy size={19}/> ADMIN ONLY
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="m8-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181]">Status</div>
          <div className="text-xl font-black mt-1">Test Season</div>
          <div className="text-xs text-emerald-400 mt-2">Private · Admin access</div>
        </div>
        <div className="m8-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181]">Teams</div>
          <div className="text-xl font-black mt-1">0</div>
          <div className="text-xs text-muted-foreground mt-2">No registrations yet</div>
        </div>
        <div className="m8-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181]">Bracket</div>
          <div className="text-xl font-black mt-1">Not generated</div>
          <div className="text-xs text-muted-foreground mt-2">Ready for testing</div>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5">
        <div className="flex items-center gap-2 mb-4"><Swords size={18} className="text-[#D5A33A]"/><h2 className="font-display text-lg font-black">Create Test Tournament</h2></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label><span className="text-[10px] uppercase tracking-widest text-[#697181]">Format</span><select value={format} onChange={e=>setFormat(e.target.value)} className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"><option>2v2</option><option>3v3</option><option>4v4</option></select></label>
          <label><span className="text-[10px] uppercase tracking-widest text-[#697181]">Series</span><select value={bestOf} onChange={e=>setBestOf(Number(e.target.value))} className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"><option value={3}>BO3</option><option value={5}>BO5</option></select></label>
          <label><span className="text-[10px] uppercase tracking-widest text-[#697181]">Mode</span><select className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"><option>CDL Mix</option><option>Hardpoint</option><option>Search & Destroy</option></select></label>
        </div>
        <button type="button" className="mt-5 h-11 px-5 rounded-xl bg-[#D5A33A] text-black font-black inline-flex items-center gap-2"><Plus size={16}/> Create test bracket</button>
      </section>

      <section className="m8-panel rounded-[22px] min-h-[280px] p-6 flex flex-col items-center justify-center text-center">
        <UsersRound size={34} className="text-[#697181] mb-3"/>
        <h2 className="font-display text-xl font-black">Tournament workspace is open</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">This is the private MuchoTourney test area. Next we can build registration, seeding, bracket, rounds, results and Tourney trophies here without exposing it publicly.</p>
      </section>
    </div>
  );
}
