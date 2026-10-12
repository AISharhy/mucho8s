import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Trophy, Plus, Swords, Users, ArrowRight, RefreshCw } from "lucide-react";
import { useData } from "@/context/DataContext";
import { fetchTourney, subscribeTourney } from "@/lib/tourneyLive";
import TourneyDemo from "@/components/TourneyDemo";

export default function TourneyHub() {
  const { isAdmin } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const [tourney, setTourney] = useState(null);
  const [loading, setLoading] = useState(true);
  const showDemo = new URLSearchParams(location.search).get("demo") === "1";
  const reload = async () => { setLoading(true); try { setTourney(await fetchTourney()); } finally { setLoading(false); } };
  useEffect(() => {
    if (showDemo) { setLoading(false); return undefined; }
    let active = true;
    fetchTourney().then(t => { if (active) setTourney(t); }).finally(() => { if (active) setLoading(false); });
    const unsubscribe = subscribeTourney(t => { if (active && t) setTourney(t); });
    return () => { active = false; if (typeof unsubscribe === "function") unsubscribe(); };
  }, [showDemo]);
  const published = Boolean(tourney?.switcheroo?.setupStage === "published" || tourney?.status === "live" || tourney?.status === "completed" || tourney?.bracket?.length);
  const teamCount = tourney?.teams?.length || 0;
  return <div className="m8-page-stack max-w-7xl mx-auto" data-testid="tourney-hub">
    <section className="m8-panel rounded-[24px] border border-[#D5A33A]/25 bg-gradient-to-br from-[#D5A33A]/10 to-[#0D1219] p-6 sm:p-9">
      <div className="text-[10px] tracking-[.23em] font-black text-[#D5A33A]">COMPETITION EVENTS</div>
      <div className="mt-3 flex flex-wrap justify-between items-center gap-5"><div><h1 className="font-display text-4xl font-black">MuchoTourney</h1><p className="text-sm text-muted-foreground mt-3">Tutti i giocatori possono partecipare ai tornei quando le iscrizioni sono aperte. Solo gli amministratori possono crearli e gestirli.</p></div>{isAdmin&&<Link to="/tourney/manage" className="rounded-xl bg-[#D5A33A] text-[#11151B] px-5 py-3 font-black text-sm inline-flex items-center gap-2"><Plus size={17}/> CREATE / MANAGE TOURNAMENT</Link>}</div>
    </section>
    
    {showDemo&&<TourneyDemo onClose={()=>navigate("/tourney")}/>}
    {!showDemo && <section className="m8-panel rounded-[22px] p-6">
      <div className="flex items-center justify-between gap-4"><h2 className="font-display text-xl font-black flex items-center gap-2"><Trophy size={19} className="text-[#D5A33A]"/> Tournament Lobby</h2><button type="button" onClick={reload} aria-label="Aggiorna tornei" className="rounded-lg border border-white/15 p-2"><RefreshCw size={16} className={loading?"animate-spin":""}/></button></div>
      {loading?<p className="text-sm text-muted-foreground mt-6">Caricamento torneo…</p>:
        !published?<div className="rounded-xl border border-dashed border-[#D5A33A]/25 p-10 text-center mt-5"><Trophy className="text-[#D5A33A] mx-auto" size={34}/><h3 className="font-bold text-lg mt-4">Nessun torneo pubblicato</h3><p className="text-sm text-muted-foreground mt-2">I tornei compariranno qui quando saranno pubblicati.</p>{isAdmin&&<Link to="/tourney/manage" className="inline-flex gap-2 items-center mt-5 text-[#D5A33A] font-bold text-sm">Configura torneo <ArrowRight size={16}/></Link>}</div>:
        <div className="mt-5 rounded-2xl border border-[#D5A33A]/25 bg-[#D5A33A]/[.035] p-5">
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#D5A33A]">{tourney.status==="completed"?"Concluso":tourney.status==="live"?"In corso":"Pubblicato"}</div>
          <h3 className="font-display text-2xl font-black mt-2">{tourney.name || "MuchoTourney"}</h3>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-3"><span className="inline-flex gap-1 items-center"><Swords size={15}/>{tourney.mode || "Competition"} · BO{tourney.bestOf || 3}</span><span className="inline-flex gap-1 items-center"><Users size={15}/>{teamCount} squadre</span></div>
          <Link to="/tourney/live" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#D5A33A] text-[#10151D] px-5 py-3 text-sm font-black">APRI TORNEO / ISCRIZIONI <ArrowRight size={17}/></Link>
        </div>}
    </section>}
  </div>;
}
