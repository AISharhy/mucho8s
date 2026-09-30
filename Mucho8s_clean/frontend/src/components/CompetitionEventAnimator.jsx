import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useData } from "@/context/DataContext";
import { tierOf } from "@/lib/elo";
import { RankArtwork } from "@/components/shared";

const family = (elo) => String(tierOf(elo)?.id || "iron").split("-")[0];
const rankOrder = ["iron", "bronze", "silver", "gold", "platinum", "diamond", "masters"];

const playerName = (playerMap, id) => playerMap?.[id]?.name || "Opponent";

const playEventSound = (type) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    master.connect(ctx.destination);

    const tone = (freq, at, duration, wave = "sine", gain = 0.28, endFreq = null) => {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + at);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + at + duration);
      amp.gain.setValueAtTime(0.0001, now + at);
      amp.gain.exponentialRampToValueAtTime(gain, now + at + 0.015);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + at + duration);
      osc.connect(amp); amp.connect(master);
      osc.start(now + at); osc.stop(now + at + duration + 0.03);
    };

    if (["rank-up", "placement"].includes(type)) {
      tone(220, 0, .42, "sawtooth", .18, 440); tone(440, .34, .48, "sine", .3, 880); tone(880, .72, .55, "triangle", .24, 1320);
    } else if (type === "rank-down") {
      tone(420, 0, .5, "sawtooth", .2, 180); tone(180, .38, .75, "triangle", .28, 80);
    } else if (type === "season") {
      tone(110, 0, 1.3, "sine", .32, 220); tone(330, .5, 1, "triangle", .18, 660);
    } else if (type === "trophy") {
      tone(660, 0, .18, "square", .12); tone(990, .16, .25, "triangle", .22); tone(1320, .38, .6, "sine", .2);
    } else if (type === "bounty") {
      tone(130, 0, .22, "square", .25, 90); tone(740, .2, .28, "sawtooth", .18, 370);
    } else if (type === "nemesis") {
      tone(95, 0, .6, "sawtooth", .25, 55); tone(520, .38, .55, "triangle", .2, 260);
    } else if (type === "mvp") {
      tone(520, 0, .18, "triangle", .18); tone(780, .14, .28, "triangle", .22); tone(1040, .3, .35, "sine", .2);
    } else if (type === "upset") {
      tone(180, 0, .18, "square", .2, 120); tone(620, .15, .35, "sawtooth", .18, 900);
    } else if (type === "merda") {
      tone(150, 0, .45, "sawtooth", .22, 55); tone(72, .28, .65, "square", .18, 42);
    }
    window.setTimeout(() => ctx.close().catch(() => {}), 1900);
  } catch {}
};

const eventCopy = (event) => {
  const map = {
    mvp: ["MVP ACQUIRED", "Three-win pressure converted."],
    merda: ["MERDA ACQUIRED", "The lobby will remember this."],
    bounty: ["BOUNTY CLAIMED", "The streak has been stopped."],
    upset: ["GIANT KILLER", "Higher-rated opposition defeated."],
    nemesis: ["NEMESIS DEFEATED", "A bad matchup has been broken."],
    placement: ["RANK REVEALED", "Placements complete."],
    season: ["NEW SEASON", "The climb starts again."],
    trophy: ["TROPHY UNLOCKED", "Added permanently to your collection."],
  };
  return map[event?.type] || ["MUCHO EVENT", ""];
};

export default function CompetitionEventAnimator() {
  const { discordPlayer, matches, competitionData, playerMap } = useData();
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

      const mineA = (latestMatch.teamA || []).map(String).includes(me);
      const enemies = (mineA ? latestMatch.teamB : latestMatch.teamA || []).map(String);
      if (enemies.length) {
        const history = [...(matches || [])]
          .filter((match) => String(match?.id) !== String(latestMatch.id))
          .filter((match) => (match.teamA || []).map(String).includes(me) || (match.teamB || []).map(String).includes(me))
          .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

        const h2h = {};
        history.forEach((match) => {
          const inA = (match.teamA || []).map(String).includes(me);
          const opponents = (inA ? match.teamB : match.teamA || []).map(String);
          const won = (inA && match.winner === "A") || (!inA && match.winner === "B");
          opponents.forEach((enemy) => {
            h2h[enemy] ||= { wins: 0, losses: 0 };
            if (won) h2h[enemy].wins += 1;
            else h2h[enemy].losses += 1;
          });
        });

        const nemesis = Object.entries(h2h)
          .filter(([, record]) => record.losses >= 2 && record.losses > record.wins)
          .sort((a, b) => (b[1].losses - b[1].wins) - (a[1].losses - a[1].wins))[0];

        const wonLatest = (mineA && latestMatch.winner === "A") || (!mineA && latestMatch.winner === "B");
        if (wonLatest && nemesis && enemies.includes(String(nemesis[0]))) {
          events.push({ type: "nemesis", opponent: playerName(playerMap, nemesis[0]) });
        }
      }
    }

    previous.current = snapshot;
    if (events.length) setQueue((current) => [...current, ...events]);
  }, [discordPlayer, latestMatch, competitionData?.season_number, competitionData?.seasonNumber]);

  useEffect(() => {
    const preview = (event) => setQueue((current) => [...current, event]);
    const handler = (e) => preview(e.detail || {});
    window.addEventListener("mucho:preview-animation", handler);
    return () => window.removeEventListener("mucho:preview-animation", handler);
  }, []);

  useEffect(() => {
    if (!active && queue.length) {
      setActive(queue[0]);
      setQueue((current) => current.slice(1));
    }
  }, [active, queue]);

  useEffect(() => {
    if (!active) return undefined;
    playEventSound(active.type);
    const premium = ["season", "placement", "rank-up", "rank-down", "trophy"].includes(active.type);
    const timer = window.setTimeout(() => setActive(null), premium ? 4300 : 2600);
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

          {active.type === "mvp" && <motion.div className="mb-5 text-8xl" animate={{ y: [30,-12,0], scale: [0.5,1.2,1] }} transition={{ duration: .65 }}>🏆</motion.div>}
          {active.type === "merda" && <motion.div className="mb-5 text-8xl" animate={{ y: [-160,18,0], rotate: [0,420,360], scale: [.4,1.4,1] }} transition={{ duration: .9, ease: "easeOut" }}>💩</motion.div>}
          {active.type === "bounty" && <motion.div className="mb-5 text-8xl" animate={{ scale: [2.2,.75,1], rotate: [18,-5,0] }} transition={{ duration: .55 }}>🎯</motion.div>}
          {active.type === "upset" && <motion.div className="mb-5 text-8xl" animate={{ x: [-80,15,0], rotate: [-25,8,0] }} transition={{ duration: .55 }}>⚔️</motion.div>}
          {active.type === "nemesis" && <motion.div className="mb-5 text-8xl" animate={{ rotate: [0,-8,8,0], scale: [0.5,1.25,1] }}>☠️</motion.div>}
          {active.type === "trophy" && <motion.div className="mb-5 text-8xl" animate={{ rotateY: [90,0,360], scale: [0.4,1.25,1] }} transition={{ duration: 1.1 }}>🏆</motion.div>}
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
          {active.type === "nemesis" && active.opponent && <div className="mt-3 font-mono font-black text-magma">VS {active.opponent}</div>}
          <div className="mt-8 text-[10px] font-bold uppercase tracking-[.24em] text-white/25">Tap anywhere to continue</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
