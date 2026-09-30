import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "@/context/DataContext";
import { tierOf } from "@/lib/elo";
import { RankArtwork } from "@/components/shared";

const family = (elo) => String(tierOf(elo)?.id || "iron").split("-")[0];
const rankOrder = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "masters"];

const eventCopy = (event) => {
  const map = {
    mvp: ["MVP ACQUIRED", "Three-win pressure converted."],
    merda: ["MERDA ACQUIRED", "The lobby will remember this."],
    bounty: ["BOUNTY CLAIMED", "The streak has been stopped."],
    upset: ["GIANT KILLER", "Higher-rated opposition defeated."],
    placement: ["RANK REVEALED", "Placements complete."],
    season: ["NEW SEASON", "The climb starts again."],
  };
  return map[event?.type] || ["MUCHO EVENT", ""];
};

export default function CompetitionEventAnimator() {
  const { discordPlayer, matches, competitionData } = useData();
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);
  const hydrated = useRef(false);
  const previous = useRef(null);

  const latestMatch = useMemo(
    () => [...(matches || [])].sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0))[0] || null,
    [matches]
  );

  useEffect(() => {
    if (!discordPlayer?.id) return;
    const p = discordPlayer;
    const snapshot = {
      elo: Number(p.currentElo || 0),
      family: family(p.currentElo),
      mvp: Number(p.mvpCount || 0),
      merda: Number(p.merdaCount || 0),
      placementComplete: p.placementComplete === true,
      season: Number(competitionData?.season_number || competitionData?.seasonNumber || 1),
      matchId: latestMatch?.id || "",
    };

    if (!hydrated.current) {
      previous.current = snapshot;
      hydrated.current = true;
      return;
    }

    const before = previous.current;
    const events = [];
    const fromRank = rankOrder.indexOf(before.family);
    const toRank = rankOrder.indexOf(snapshot.family);

    if (before.season !== snapshot.season) {
      events.push({ type: "season", season: snapshot.season });
    }
    if (!before.placementComplete && snapshot.placementComplete) {
      events.push({ type: "placement", elo: snapshot.elo, rank: snapshot.family });
    } else if (before.family !== snapshot.family && fromRank >= 0 && toRank >= 0) {
      events.push({
        type: toRank > fromRank ? "rank-up" : "rank-down",
        from: before.family,
        to: snapshot.family,
        elo: snapshot.elo,
      });
    }
    if (snapshot.mvp > before.mvp) events.push({ type: "mvp", count: snapshot.mvp });
    if (snapshot.merda > before.merda) events.push({ type: "merda", count: snapshot.merda });

    if (latestMatch?.id && latestMatch.id !== before.matchId) {
      const me = String(p.id);
      if ((latestMatch.mvpBountyRecipientIds || []).map(String).includes(me)) {
        events.push({ type: "bounty", bonus: Number(latestMatch.mvpBountyBonus || 0) });
      }
      const winners = latestMatch.winner === "B" ? latestMatch.teamB : latestMatch.teamA;
      if (latestMatch.upsetApplied && (winners || []).map(String).includes(me)) {
        events.push({ type: "upset", bonus: Number(latestMatch.upsetWinnerBonus || 0) });
      }
    }

    previous.current = snapshot;
    if (events.length) setQueue((current) => [...current, ...events]);
  }, [discordPlayer, latestMatch, competitionData?.season_number, competitionData?.seasonNumber]);

  useEffect(() => {
    if (!active && queue.length) {
      setActive(queue[0]);
      setQueue((current) => current.slice(1));
    }
  }, [active, queue]);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setActive(null), active.type === "season" ? 4200 : 3300);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  const isRank = ["rank-up", "rank-down", "placement"].includes(active.type);
  const rankTier = isRank ? tierOf(active.elo) : null;
  const [title, subtitle] = eventCopy(active);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[150] flex items-center justify-center overflow-hidden bg-[#05070b]/95 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setActive(null)}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0, .65, .3], scale: [0.8, 1.12, 1] }}
          transition={{ duration: 1.15 }}
          style={{ background: `radial-gradient(circle at 50% 48%, ${active.type === "merda" ? "#8b5a2b55" : rankTier?.color ? rankTier.color + "55" : "#ff2a3b44"} 0%, transparent 45%)` }}
        />

        {Array.from({ length: active.type === "merda" ? 34 : 22 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
            animate={{
              x: Math.cos((i / 22) * Math.PI * 2) * (130 + (i % 6) * 34),
              y: Math.sin((i / 22) * Math.PI * 2) * (130 + (i % 6) * 34),
              opacity: [0, 1, 0],
              scale: [0, 1.3, 0],
              rotate: i * 37,
            }}
            transition={{ delay: .35 + (i % 5) * .04, duration: 1.15 }}
          >
            {active.type === "merda" ? <span className="text-3xl">💩</span> : <span className="block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_12px_white]" />}
          </motion.div>
        ))}

        <motion.div
          className="relative z-10 flex flex-col items-center px-6 text-center"
          initial={{ scale: .55, opacity: 0, filter: "blur(16px)" }}
          animate={{ scale: [0.55, 1.08, 1], opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: .85, ease: [0.16, 1, 0.3, 1] }}
        >
          {isRank && (
            <motion.div
              className="mb-7"
              initial={{ rotate: -14, scale: .3 }}
              animate={{ rotate: [ -14, 5, 0 ], scale: [ .3, 1.25, 1 ] }}
              transition={{ delay: .25, duration: .9 }}
            >
              <RankArtwork elo={active.elo} size="xl" />
            </motion.div>
          )}

          {active.type === "mvp" && <div className="mb-5 text-8xl">🏆</div>}
          {active.type === "merda" && <div className="mb-5 text-8xl">💩</div>}
          {active.type === "bounty" && <div className="mb-5 text-8xl">🎯</div>}
          {active.type === "upset" && <div className="mb-5 text-8xl">⚔️</div>}
          {active.type === "season" && <div className="mb-4 text-sm font-black uppercase tracking-[.55em] text-white/45">MUCHO RANKED</div>}

          <motion.div className="text-xs font-black uppercase tracking-[.38em] text-white/45">
            {active.type === "rank-up" ? "RANK UP" : active.type === "rank-down" ? "RANK DOWN" : title}
          </motion.div>
          <motion.h2
            className="mt-3 text-5xl font-black uppercase tracking-tight text-white sm:text-7xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: .55 }}
          >
            {active.type === "rank-up" || active.type === "rank-down"
              ? active.to
              : active.type === "placement"
                ? active.rank
                : active.type === "season"
                  ? `SEASON ${active.season}`
                  : title}
          </motion.h2>
          <div className="mt-3 text-sm font-semibold uppercase tracking-[.18em] text-white/45">
            {isRank ? `${active.elo} ELO` : subtitle}
          </div>
          {active.type === "bounty" && active.bonus > 0 && <div className="mt-3 font-mono font-black text-magma">+{active.bonus} ELO BOUNTY</div>}
          {active.type === "upset" && active.bonus > 0 && <div className="mt-3 font-mono font-black text-magma">+{active.bonus} ELO UPSET</div>}
          <div className="mt-8 text-[10px] font-bold uppercase tracking-[.24em] text-white/25">Tap anywhere to continue</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
