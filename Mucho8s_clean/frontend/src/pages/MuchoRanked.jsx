import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gamepad2, ShieldCheck, Users, Trophy, ArrowRight, LockKeyhole } from "lucide-react";
import { useData } from "@/context/DataContext";
import { tierOf } from "@/lib/elo";

const FORMAT_OPTIONS = [
  { id: "snd", label: "Search & Destroy", detail: "BO7 · 4v4" },
  { id: "hp", label: "Hardpoint", detail: "BO5 · 4v4" },
  { id: "mixed", label: "Mixed", detail: "S&D / HP · 4v4" },
];

export default function MuchoRanked() {
  const { discordPlayer, discordSession, signInWithDiscord, players = [] } = useData();
  const [format, setFormat] = useState("snd");
  const [infoOpen, setInfoOpen] = useState(false);
  const current = useMemo(() => FORMAT_OPTIONS.find((item) => item.id === format), [format]);
  const elo = Number(discordPlayer?.currentElo ?? 1000);
  const tier = tierOf(elo);
  const eligible = Boolean(discordSession && discordPlayer?.id);

  return (
    <div className="m8-page-stack" data-testid="mucho-ranked-page">
      <section className="m8-panel rounded-[24px] p-6 md:p-9 border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.10] via-[#101720] to-[#0B1018]">
        <div className="text-xs uppercase tracking-[0.23em] font-black text-blue-400">Mucho Ranked · Development Preview</div>
        <h1 className="font-display font-black text-4xl md:text-5xl mt-3">Play Ranked</h1>
        <p className="text-sm text-[#A2ACBB] mt-3 max-w-2xl">Una coda competitiva 4v4 dedicata alla community: matchmaking bilanciato, Ready Check, lobby e progressione stagionale. Questa schermata è un'anteprima: la coda reale non è ancora attiva.</p>
        <div className="flex flex-wrap gap-2 mt-5 text-xs font-bold">
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 px-3 py-1.5">4v4</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/70">Solo queue · pianificata</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5 text-white/70">Zero entry fee</span>
        </div>
      </section>

      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
        <section className="m8-panel rounded-[22px] p-6">
          <div className="flex items-center gap-2 mb-5"><Gamepad2 size={20} className="text-blue-400" /><h2 className="font-display text-xl font-extrabold">Select playlist</h2></div>
          <div role="group" aria-label="Ranked playlist" className="grid sm:grid-cols-3 gap-3">
            {FORMAT_OPTIONS.map(item => (
              <button key={item.id} type="button" aria-pressed={format === item.id} onClick={() => setFormat(item.id)}
                className={`text-left p-4 rounded-xl border transition-colors ${format === item.id ? "border-blue-400/70 bg-blue-500/10" : "border-white/10 bg-black/10 hover:border-white/30"}`}>
                <div className="text-sm font-extrabold">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-2">{item.detail}</div>
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-[#0A1019] border border-white/10 p-4">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Selected</div>
            <div className="font-bold mt-1">{current.label} <span className="text-blue-400">· {current.detail}</span></div>
            <p className="text-xs text-muted-foreground mt-2">Il sistema abbinerà otto giocatori e formerà due team da quattro in base all'Elo e ai vincoli di matchmaking. Nessun punteggio viene modificato in questa anteprima.</p>
          </div>
          {!discordSession ? (
            <button type="button" onClick={signInWithDiscord} className="mt-5 w-full rounded-xl bg-[#5865F2] py-3 font-bold text-white">Connect Discord</button>
          ) : !eligible ? (
            <div className="mt-5 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-200">Associa un profilo giocatore approvato per poter accedere alla futura coda Ranked.</div>
          ) : (
            <div className="mt-5 border border-blue-500/20 rounded-xl p-4 flex gap-3 items-start">
              <LockKeyhole size={18} className="text-blue-400 shrink-0" />
              <div><div className="font-bold text-sm">Matchmaking non ancora aperto</div><div className="text-xs text-muted-foreground mt-1">La coda sarà abilitata dopo la realizzazione delle regole server-side, delle lobby e del sistema di conferma match.</div></div>
            </div>
          )}
          <Link className="mt-4 inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 font-bold" to="/team-builder">Gioca nella modalità Mucho8s attuale <ArrowRight size={15}/></Link>
        </section>
        <section className="m8-panel rounded-[22px] p-6">
          <div className="flex items-center gap-2 mb-5"><Trophy size={19} className="text-blue-400"/><h2 className="font-display text-xl font-extrabold">Your progression</h2></div>
          <div className="text-sm font-bold">{discordPlayer?.name || "Guest"}</div>
          <div className="mt-4 text-4xl font-black font-display">{eligible ? elo : "—"} <span className="text-sm text-muted-foreground">Elo 8s</span></div>
          <div className="text-xs text-muted-foreground mt-1">{eligible ? (tier?.name || "Unranked") : "Connect your player profile"}</div>
          <div className="border-t border-white/10 mt-6 pt-5 flex items-start gap-3"><ShieldCheck size={19} className="text-emerald-400 shrink-0"/><p className="text-xs text-muted-foreground">L'Elo visualizzato appartiene al sistema Mucho8s esistente. Per la nuova Ranked è prevista una progressione separata, per evitare alterazioni dello storico.</p></div>
          <div className="mt-5 flex gap-2 items-center text-xs text-muted-foreground"><Users size={16}/> {players.length} profili presenti nel database locale dell'app</div>
          <button type="button" aria-expanded={infoOpen} onClick={() => setInfoOpen(value => !value)} className="mt-5 text-xs font-bold text-blue-300 underline">{infoOpen ? "Hide" : "Show"} planned matchmaking rules</button>
          {infoOpen && <p className="mt-3 text-xs leading-6 text-muted-foreground">Una sola coda per giocatore. Otto partecipanti unici per lobby. Bilanciamento in base all'Elo. Ready Check di tutti gli otto giocatori. Risultati verificati prima della modifica dell'Elo. Nessun aggiornamento Elo eseguito dal browser.</p>}
        </section>
      </div>
    </div>
  );
}
