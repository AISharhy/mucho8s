import React, { useEffect, useRef, useState } from "react";
import { RANKS, rankProgress } from "@/lib/elo";
import { RankArtwork } from "@/components/shared";

export const RankEmblem = ({ elo = 1000, compact = false }) => {
  const info = rankProgress(elo);
  const rank = info.rank;

  return (
    <div
      className={`relative overflow-hidden border bg-[#0D1016] ${compact ? "rounded-xl px-3 py-2" : "rounded-2xl p-4"}`}
      style={{ borderColor: rank.color + "44" }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px opacity-80"
        style={{ background: `linear-gradient(90deg, transparent, ${rank.color}, transparent)` }}
      />

      <div className="flex items-center gap-3">
        <RankArtwork rank={rank} size={compact ? 40 : 50} />

        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Division {rank.roman}
          </div>
          <div
            className={`font-display font-black uppercase ${compact ? "text-sm" : "text-lg"}`}
            style={{ color: rank.color }}
          >
            {rank.name}
          </div>
          {!compact && info.next && (
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {info.eloNeeded} Elo to {info.next.name}
            </div>
          )}
        </div>

        <div className="font-mono font-black text-sm">{elo}</div>
      </div>

      {!compact && (
        <div className="mt-3 h-1 rounded-full bg-[#1D222C] overflow-hidden">
          <div
            className="h-full"
            style={{
              width: `${info.progress}%`,
              background: `linear-gradient(90deg, ${rank.accent}, ${rank.color})`,
              boxShadow: `0 0 10px ${rank.color}55`,
            }}
          />
        </div>
      )}

    </div>
  );
};

const RANK_FAMILIES = [
  {
    id: "masters",
    label: "Masters",
    color: "#FF4F68",
    accent: "#8A1730",
    glow: "rgba(255,79,104,.34)",
    min: 2300,
    max: Infinity,
    divisions: ["M"],
  },
  {
    id: "diamond",
    label: "Diamond",
    color: "#9B99FF",
    accent: "#514DB4",
    glow: "rgba(142,140,255,.30)",
    min: 2000,
    max: 2299,
    divisions: ["I", "II", "III"],
  },
  {
    id: "platinum",
    label: "Platinum",
    color: "#5FE2D8",
    accent: "#176A70",
    glow: "rgba(82,200,198,.28)",
    min: 1700,
    max: 1999,
    divisions: ["I", "II", "III"],
  },
  {
    id: "gold",
    label: "Gold",
    color: "#FFD05A",
    accent: "#9B6510",
    glow: "rgba(232,184,63,.30)",
    min: 1400,
    max: 1699,
    divisions: ["I", "II", "III"],
  },
  {
    id: "silver",
    label: "Silver",
    color: "#D6DEE8",
    accent: "#65717F",
    glow: "rgba(185,194,206,.22)",
    min: 1100,
    max: 1399,
    divisions: ["I", "II", "III"],
  },
  {
    id: "bronze",
    label: "Bronze",
    color: "#E18B55",
    accent: "#6C3B22",
    glow: "rgba(193,120,69,.26)",
    min: 800,
    max: 1099,
    divisions: ["I", "II", "III"],
  },
  {
    id: "iron",
    label: "Iron",
    color: "#94A0B1",
    accent: "#434D5C",
    glow: "rgba(124,135,152,.20)",
    min: 500,
    max: 799,
    divisions: ["I", "II", "III"],
  },
];

const PyramidTier = ({ family, index, onOpen }) => {
  const width = 48 + index * 7.5;

  return (
    <button type="button" className="rank-pyramid-step text-left cursor-pointer transition-transform active:scale-[.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-xl" style={{ width: `${width}%` }} onClick={() => onOpen(family)} aria-label={`Apri dettagli ${family.label}`}>
      <div
        className={`rank-pyramid-tier rank-pyramid-${family.id}`}
        style={{
          "--rank-color": family.color,
          "--rank-accent": family.accent,
          "--rank-glow": family.glow,
        }}
      >
        <div className="rank-pyramid-shine" />
        <div className="rank-pyramid-icon rank-pyramid-icon-artwork">
          <RankArtwork family={family.id} size={family.id === "masters" ? 48 : 44} />
        </div>

        <div className="rank-pyramid-copy">
          <div className="rank-pyramid-title">{family.label}</div>
          <div className="rank-pyramid-meta">
            <span>{family.divisions.join(" · ")}</span>
            <span className="rank-pyramid-dot">•</span>
            <span>{Number.isFinite(family.max) ? `${family.min}–${family.max} Elo` : `${family.min}+ Elo`}</span>
          </div>
        </div>

        <div className="rank-pyramid-arrow" aria-hidden="true">⌃</div>
      </div>
    </button>
  );
};

export default function RankGuide() {
  const [selectedRank, setSelectedRank] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => () => { if (audioRef.current) audioRef.current.close?.(); }, []);

  const playRankSound = (family) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = audioRef.current || new AudioCtx(); audioRef.current = ctx;
      const now = ctx.currentTime;
      const presets = { iron:[95,0.12,"square"], bronze:[135,0.16,"triangle"], silver:[520,0.18,"sine"], gold:[740,0.28,"sine"], platinum:[420,0.34,"triangle"], diamond:[920,0.42,"sine"], masters:[110,0.52,"sawtooth"] };
      const [freq,dur,type] = presets[family.id];
      [1, family.id === "diamond" ? 1.5 : family.id === "gold" ? 1.25 : family.id === "masters" ? 2 : 1.08].forEach((mul,i) => {
        const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.setValueAtTime(freq*mul,now+i*.045); g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(i ? .035 : .07,now+.015+i*.045); g.gain.exponentialRampToValueAtTime(.0001,now+dur+i*.06); o.connect(g).connect(ctx.destination); o.start(now+i*.045); o.stop(now+dur+i*.08);
      });
    } catch (_) {}
  };

  const openRank = (family) => { setSelectedRank(family); playRankSound(family); };
  const closeRank = () => setSelectedRank(null);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Ranks</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Rank System
        </h1>
        <p className="text-sm text-[#8D95A4] mt-2 max-w-2xl leading-6">
          Parti da Iron I e scala la piramide fino a Masters. Ogni divisione vale 100 Elo: più sali, più il rank diventa raro e prestigioso.
        </p>
      </section>

      <section className="rank-pyramid-stage rounded-[26px] overflow-hidden">
        <div className="rank-pyramid-ambient rank-pyramid-ambient-left" />
        <div className="rank-pyramid-ambient rank-pyramid-ambient-right" />
        <div className="rank-pyramid-grid" />

        <div className="relative z-10 px-3 sm:px-6 lg:px-10 py-7 sm:py-9">
          <div className="text-center mb-6">
            <div className="brand-kicker text-[#C9AF7A] mb-1">Rank Ladder</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em]">
              Scala la piramide
            </h2>
            <p className="text-xs sm:text-sm text-[#818A99] mt-1.5">
              Da Iron a Masters. Ogni gradino ti porta più vicino alla cima.
            </p>
          </div>

          <div className="rank-pyramid-wrap">
            {RANK_FAMILIES.map((family, index) => (
              <React.Fragment key={family.id}>
                <PyramidTier family={family} index={index} onOpen={openRank} />
                {index < RANK_FAMILIES.length - 1 && (
                  <div className="rank-pyramid-connector" aria-hidden="true">
                    <span />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="rank-pyramid-base-glow" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-8">
            <div className="rank-guide-info-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Start</div>
              <div className="font-display font-black text-lg mt-1">500 Elo · Iron I</div>
              <div className="text-xs text-muted-foreground mt-1">Il punto di partenza della ladder.</div>
            </div>

            <div className="rank-guide-info-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Promozione</div>
              <div className="font-display font-black text-lg mt-1">+100 Elo</div>
              <div className="text-xs text-muted-foreground mt-1">Ogni 100 Elo sali di una divisione.</div>
            </div>

            <div className="rank-guide-info-card rank-guide-info-card-top">
              <div className="text-[10px] uppercase tracking-widest text-[#D5A33A]">Cima</div>
              <div className="font-display font-black text-lg mt-1 text-[#FF6A7F]">Masters · 2300+</div>
              <div className="text-xs text-muted-foreground mt-1">Il rank massimo della ladder Mucho8s.</div>
            </div>
          </div>
        </div>
      </section>

      {selectedRank && (() => {
        const r = selectedRank;
        const next = RANK_FAMILIES[RANK_FAMILIES.findIndex(x => x.id === r.id) - 1];
        return <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={`Dettagli rank ${r.label}`} onClick={closeRank}>
          <div onClick={e => e.stopPropagation()} className={`rank-detail-modal rank-detail-${r.id} relative w-full max-w-xl overflow-hidden rounded-[28px] border p-5 sm:p-7 animate-in fade-in zoom-in-95 duration-300`} style={{"--rank-fx":r.glow,borderColor:r.color+"70",background:`linear-gradient(145deg, ${r.color}24, rgba(10,12,18,.96) 42%, ${r.accent}22)`,boxShadow:`0 0 70px ${r.glow}, inset 0 1px 0 ${r.color}55`}}>
            <div className="absolute inset-0 opacity-30 pointer-events-none" style={{background:`radial-gradient(circle at 22% 18%, ${r.color}55, transparent 32%)`}} />
            <button type="button" onClick={closeRank} className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/30 text-xl text-white/70 hover:text-white" aria-label="Chiudi">×</button>
            <div className="relative z-10 flex items-center gap-5"><div className={`rank-detail-emblem rank-detail-emblem-${r.id} shrink-0`} style={{filter:`drop-shadow(0 0 18px ${r.color}88)`}}><RankArtwork family={r.id} size={96} /></div><div className="min-w-0"><div className="text-[10px] uppercase tracking-[.28em] text-white/45">Mucho8s rank</div><h3 className="font-display text-3xl sm:text-4xl font-black uppercase mt-1" style={{color:r.color}}>{r.label}</h3><div className="font-mono text-xs sm:text-sm text-white/65 mt-1">{r.divisions.join(" · ")} <span style={{color:r.color}}>•</span> {Number.isFinite(r.max)?`${r.min}–${r.max} Elo`:`${r.min}+ Elo`}</div></div></div>
            <div className="relative z-10 mt-6 grid grid-cols-3 gap-2">{r.divisions.map((d,i) => <div key={d} className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center"><div className="text-[10px] uppercase tracking-widest text-white/40">Divisione</div><div className="font-display text-xl font-black mt-1" style={{color:r.color}}>{d}</div>{r.id!=="masters" && <div className="font-mono text-[10px] text-white/45 mt-1">{r.min + Math.max(0,(r.divisions.length-1-i))*100}+</div>}</div>)}</div>
            <div className="relative z-10 mt-5 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex justify-between gap-3 text-xs"><span className="text-white/50">{next ? "Prossimo rank" : "Rank massimo"}</span><span className="font-bold" style={{color:r.color}}>{next ? next.label : "MASTERS"}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-full rank-detail-progress" style={{background:`linear-gradient(90deg,${r.accent},${r.color})`,boxShadow:`0 0 14px ${r.color}`}} /></div><p className="mt-3 text-xs leading-5 text-white/55">{next ? `Raggiungi ${next.min} Elo per entrare in ${next.label}.` : "Hai raggiunto la cima della ladder competitiva Mucho8s."}</p></div>
            <div className="relative z-10 mt-4 text-center text-[10px] uppercase tracking-[.22em] text-white/30">Tocca fuori dalla scheda per chiudere</div>
          </div>
        </div>;
      })()}

    </div>
  );
}
