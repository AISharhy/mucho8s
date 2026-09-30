import React from "react";
import { motion } from "framer-motion";

const tests = [
  { label: "Rank Up", detail: { type: "rank-up", from: "gold", to: "platinum", elo: 1750 } },
  { label: "Rank Down", detail: { type: "rank-down", from: "platinum", to: "gold", elo: 1680 } },
  { label: "Placement Reveal", detail: { type: "placement", rank: "platinum", elo: 1785 } },
  { label: "New Season", detail: { type: "season", season: 2 } },
  { label: "MVP", detail: { type: "mvp", count: 3 } },
  { label: "Merda", detail: { type: "merda", count: 2 } },
  { label: "Bounty Claimed", detail: { type: "bounty", bonus: 15 } },
  { label: "Giant Killer", detail: { type: "upset", bonus: 12 } },
  { label: "Nemesis Defeated", detail: { type: "nemesis", opponent: "Sysma" } },
];

export default function AnimationLab() {
  const play = (detail) => window.dispatchEvent(new CustomEvent("mucho:preview-animation", { detail }));

  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="brand-kicker mb-2">DEV LAB</div>
        <h1 className="font-display text-4xl font-black tracking-[-0.04em]">Animation Lab</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Preview sicura: questi test non modificano ELO, match, trophy, placement o statistiche.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tests.map((test, i) => (
          <motion.button
            key={test.label}
            type="button"
            onClick={() => play(test.detail)}
            whileHover={{ y: -3, scale: 1.015 }}
            whileTap={{ scale: .97 }}
            className="m8-panel group min-h-32 rounded-2xl border border-white/10 p-5 text-left transition-colors hover:border-magma/45"
          >
            <div className="text-[10px] font-black uppercase tracking-[.28em] text-white/30">TEST {String(i + 1).padStart(2, "0")}</div>
            <div className="mt-5 text-lg font-black uppercase tracking-tight text-white">{test.label}</div>
            <div className="mt-1 text-xs text-white/35">Click to preview</div>
          </motion.button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => tests.forEach((test, index) => window.setTimeout(() => play(test.detail), index * 3500))}
        className="mt-6 h-12 rounded-xl bg-magma px-6 text-sm font-black uppercase tracking-[.16em] text-white hover:bg-[#ff3c4c]"
      >
        Play all
      </button>
    </section>
  );
}
