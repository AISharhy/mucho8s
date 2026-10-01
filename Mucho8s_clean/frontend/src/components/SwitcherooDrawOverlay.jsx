import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Shuffle, X, Check, ArrowRight } from "lucide-react";

const PALETTE = [
  "#FF4FA3",
  "#7C3AED",
  "#E11D48",
  "#0F766E",
  "#2563EB",
  "#B45309",
  "#9333EA",
  "#BE123C",
  "#0891B2",
  "#C2410C",
];

const TEAM_NAMES = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

const pointOnCircle = (cx, cy, radius, angleDeg) => {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
};

const slicePath = (startAngle, endAngle, radius = 48) => {
  const start = pointOnCircle(50, 50, radius, endAngle);
  const end = pointOnCircle(50, 50, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    "M 50 50",
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

const rosterSizeFor = (format) =>
  Math.max(1, Number(String(format || "4v4").split("v")[0]) || 4);

const randomIndex = (max) => {
  if (max <= 1) return 0;
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] % max;
  }
  return Math.floor(Math.random() * max);
};

const buildPresetQueue = (teams = []) => {
  const maxRoster = Math.max(0, ...teams.map((team) => (team.roster || []).length));
  const queue = [];
  for (let slot = 0; slot < maxRoster; slot += 1) {
    teams.forEach((team, teamIndex) => {
      const player = team.roster?.[slot];
      if (player) queue.push({ player, teamIndex });
    });
  }
  return queue;
};

export default function SwitcherooDrawOverlay({
  open,
  players = [],
  format = "4v4",
  generation = 1,
  presetTeams = null,
  onComplete,
  onProgress,
  onClose,
  title = "SWITCHEROO",
}) {
  const [remaining, setRemaining] = useState([]);
  const [teams, setTeams] = useState([]);
  const [queue, setQueue] = useState([]);
  const [drawIndex, setDrawIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [winner, setWinner] = useState(null);
  const [targetTeamIndex, setTargetTeamIndex] = useState(0);
  const spinTimer = useRef(null);
  const landTimer = useRef(null);

  useEffect(() => {
    if (!open) return;

    const cleanPlayers = (players || []).map((player, index) => ({
      id: String(player?.id || index),
      name: String(player?.name || "Player"),
    }));
    const rosterSize = rosterSizeFor(format);
    const teamCount = presetTeams?.length || Math.max(2, cleanPlayers.length / rosterSize);

    const initialTeams = presetTeams?.length
      ? presetTeams.map((team, index) => ({
          id: team.id || `preset-${index}`,
          name: team.name || `Team ${TEAM_NAMES[index] || index + 1}`,
          seed: team.seed || index + 1,
          roster: [],
          switcherooGeneration: generation,
        }))
      : Array.from({ length: teamCount }, (_, index) => ({
          id: globalThis.crypto?.randomUUID?.() || `switcheroo-${generation}-${index}-${Date.now()}`,
          name: `Team ${TEAM_NAMES[index] || index + 1}`,
          seed: index + 1,
          roster: [],
          switcherooGeneration: generation,
        }));

    setRemaining(cleanPlayers);
    setTeams(initialTeams);
    setQueue(presetTeams?.length ? buildPresetQueue(presetTeams) : []);
    setDrawIndex(0);
    setRotation(0);
    setPhase("idle");
    setWinner(null);
    setTargetTeamIndex(0);
  }, [open, players, format, generation, presetTeams]);

  useEffect(
    () => () => {
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
      if (landTimer.current) window.clearTimeout(landTimer.current);
    },
    []
  );

  const slices = useMemo(() => {
    const count = Math.max(1, remaining.length);
    const step = 360 / count;
    return remaining.map((player, index) => ({
      ...player,
      index,
      start: index * step,
      end: (index + 1) * step,
      middle: index * step + step / 2,
      fill: PALETTE[index % PALETTE.length],
    }));
  }, [remaining]);

  const progress = players.length
    ? Math.round(((players.length - remaining.length) / players.length) * 100)
    : 0;

  const commitWinner = (picked, teamIndex) => {
    const nextTeams = teams.map((team, index) =>
      index === teamIndex
        ? { ...team, roster: [...(team.roster || []), picked] }
        : team
    );
    const nextRemaining = remaining.filter(
      (player) => String(player.id) !== String(picked.id)
    );
    const nextDrawIndex = drawIndex + 1;
    const isLast = nextRemaining.length === 0;

    setTeams(nextTeams);
    setRemaining(nextRemaining);
    setQueue((current) => current.slice(1));
    setDrawIndex(nextDrawIndex);
    setWinner(null);
    setPhase(isLast ? "complete" : "idle");

    onProgress?.({
      teams: nextTeams,
      remaining: nextRemaining,
      drawIndex: nextDrawIndex,
      lastPlayer: picked,
      targetTeamIndex: teamIndex,
      complete: isLast,
    });
  };

  const spin = () => {
    if (phase !== "idle" || !remaining.length) return;

    let picked;
    let teamIndex;

    if (queue.length) {
      picked = queue[0].player;
      teamIndex = queue[0].teamIndex;
    } else {
      picked = remaining[randomIndex(remaining.length)];
      teamIndex = drawIndex % Math.max(1, teams.length);
    }

    const pickedIndex = Math.max(
      0,
      remaining.findIndex((player) => String(player.id) === String(picked.id))
    );
    const step = 360 / Math.max(1, remaining.length);
    const middle = pickedIndex * step + step / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const targetMod = ((360 - middle) % 360 + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;
    const turns = 6 + randomIndex(3);

    setTargetTeamIndex(teamIndex);
    setPhase("spinning");
    setRotation((current) => current + turns * 360 + delta);

    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    spinTimer.current = window.setTimeout(() => {
      setWinner(picked);
      setPhase("landed");

      if (landTimer.current) window.clearTimeout(landTimer.current);
      landTimer.current = window.setTimeout(() => {
        commitWinner(picked, teamIndex);
      }, 1250);
    }, 3200);
  };

  const finish = () => {
    if (phase !== "complete") return;
    onComplete?.(teams);
  };

  if (!open) return null;

  const rosterSize = rosterSizeFor(format);
  const currentTeam = teams[targetTeamIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-[#03050A] overflow-y-auto"
    >
      <div className="min-h-screen relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-56 left-1/2 -translate-x-1/2 w-[760px] h-[760px] rounded-full bg-[#FF4FA3]/[0.06] blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.025),transparent_60%)]" />
        </div>

        <header className="relative z-10 px-5 sm:px-8 py-5 flex items-center justify-between gap-4 border-b border-white/[0.06]">
          <div>
            <div className="text-[10px] tracking-[.22em] font-black text-[#FF4FA3]">
              MUCHOTOURNEY · GENERATION {generation}
            </div>
            <div className="font-display text-xl sm:text-2xl font-black mt-1">{title}</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="font-mono text-xs font-black">
                {players.length - remaining.length}/{players.length}
              </div>
              <div className="text-[9px] text-muted-foreground">PLAYERS ASSIGNED</div>
            </div>
            {drawIndex === 0 && phase === "idle" && (
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl border border-[#2A303B] bg-[#0F141C] flex items-center justify-center text-muted-foreground hover:text-white"
                aria-label="Close Switcheroo"
              >
                <X size={17} />
              </button>
            )}
          </div>
        </header>

        <div className="relative z-10 h-1 bg-[#111720]">
          <motion.div
            animate={{ width: progress + "%" }}
            className="h-full bg-[#FF4FA3]"
          />
        </div>

        <main className="relative z-10 max-w-[1500px] mx-auto px-4 sm:px-6 py-6 lg:py-8">
          <div className="grid xl:grid-cols-[minmax(520px,1.05fr)_minmax(520px,.95fr)] gap-6 xl:gap-10 items-center">
            <div className="flex flex-col items-center justify-center min-h-[560px]">
              <div className="relative">
                <div className="absolute left-1/2 -top-5 -translate-x-1/2 z-40">
                  <div className="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[34px] border-l-transparent border-r-transparent border-t-[#FFD1E8] drop-shadow-[0_5px_5px_rgba(0,0,0,.55)]" />
                </div>

                <div className="relative w-[82vw] h-[82vw] max-w-[580px] max-h-[580px] min-w-[310px] min-h-[310px] rounded-full border-[14px] border-[#242A33] bg-[#080B10] shadow-[inset_0_0_0_2px_rgba(255,79,163,.22),0_28px_90px_rgba(0,0,0,.55),0_0_80px_rgba(255,79,163,.08)]">
                  <motion.div
                    className="absolute inset-[12px] rounded-full overflow-hidden"
                    animate={{ rotate: rotation }}
                    transition={{ duration: 3.2, ease: [0.08, 0.72, 0.12, 1] }}
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {slices.length ? (
                        slices.map((slice) => (
                          <path
                            key={slice.id}
                            d={slicePath(slice.start, slice.end)}
                            fill={slice.fill}
                            stroke="rgba(255,255,255,.14)"
                            strokeWidth=".34"
                          />
                        ))
                      ) : (
                        <circle cx="50" cy="50" r="48" fill="#111720" />
                      )}

                      {slices.map((slice) => {
                        const point = pointOnCircle(
                          50,
                          50,
                          remaining.length > 16 ? 35 : 36,
                          slice.middle
                        );
                        const shortName =
                          slice.name.length > 12 ? slice.name.slice(0, 11) + "…" : slice.name;
                        const fontSize =
                          remaining.length > 20 ? 2.1 : remaining.length > 12 ? 2.8 : 3.7;

                        return (
                          <text
                            key={"label-" + slice.id}
                            x={point.x}
                            y={point.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize={fontSize}
                            fontWeight="900"
                            fill="#FFFFFF"
                            transform={`rotate(${slice.middle} ${point.x} ${point.y})`}
                            style={{
                              paintOrder: "stroke",
                              stroke: "rgba(0,0,0,.52)",
                              strokeWidth: 0.5,
                            }}
                          >
                            {shortName}
                          </text>
                        );
                      })}

                      <circle cx="50" cy="50" r="16.2" fill="#080B10" stroke="#FF4FA3" strokeWidth="1" />
                      <circle cx="50" cy="50" r="12.5" fill="#111720" stroke="rgba(255,255,255,.12)" strokeWidth=".55" />
                    </svg>
                  </motion.div>

                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-[#FF4FA3]/45 bg-[#080B10]/95 backdrop-blur flex flex-col items-center justify-center shadow-[0_0_42px_rgba(255,79,163,.18)]">
                      <Shuffle
                        size={25}
                        className={phase === "spinning" ? "text-[#FF9DCE] animate-pulse" : "text-[#FF4FA3]"}
                      />
                      <div className="font-display text-sm font-black tracking-[.14em] mt-1">
                        {phase === "spinning" ? "SPINNING" : "SWITCHEROO"}
                      </div>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {winner && (
                    <motion.div
                      key={winner.id}
                      layoutId={"switcheroo-player-" + winner.id}
                      initial={{ opacity: 0, scale: 0.55, y: 0 }}
                      animate={{ opacity: 1, scale: 1.08, y: 105 }}
                      exit={{ opacity: 0, scale: 0.8, y: 180 }}
                      transition={{ type: "spring", stiffness: 170, damping: 18 }}
                      className="absolute z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-[230px] rounded-2xl border border-[#FF4FA3]/60 bg-[#111720] px-5 py-4 text-center shadow-[0_18px_70px_rgba(0,0,0,.6),0_0_55px_rgba(255,79,163,.22)]"
                    >
                      <div className="text-[9px] tracking-[.2em] font-black text-[#FF4FA3]">
                        PLAYER DRAWN
                      </div>
                      <div className="font-display text-2xl font-black mt-1">{winner.name}</div>
                      <div className="mt-2 text-xs font-bold text-white/60 inline-flex items-center gap-2">
                        <ArrowRight size={13} />
                        {currentTeam?.name || "Team"}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-9 h-14 flex items-center justify-center">
                {phase === "idle" && remaining.length > 0 && (
                  <motion.button
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    type="button"
                    onClick={spin}
                    className="h-14 px-10 rounded-2xl bg-[#FF4FA3] hover:bg-[#E1B34C] text-black font-display font-black tracking-[.08em] shadow-[0_12px_45px_rgba(255,79,163,.2)]"
                  >
                    {drawIndex === 0 ? "SPIN" : "NEXT SPIN"}
                  </motion.button>
                )}

                {phase === "spinning" && (
                  <div className="text-sm font-black text-[#FF4FA3] animate-pulse">
                    THE WHEEL IS SPINNING…
                  </div>
                )}

                {phase === "landed" && winner && (
                  <div className="text-sm font-black">
                    {winner.name} <span className="text-[#FF4FA3]">→ {currentTeam?.name}</span>
                  </div>
                )}

                {phase === "complete" && (
                  <button
                    type="button"
                    onClick={finish}
                    className="h-14 px-9 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#06110B] font-display font-black inline-flex items-center gap-2"
                  >
                    <Check size={18} />
                    CONFIRM TEAMS
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between gap-3 mb-4">
                <div>
                  <div className="text-[10px] tracking-[.2em] font-black text-[#697181]">
                    LIVE TEAM DRAW
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-black mt-1">
                    {phase === "complete" ? "Teams complete" : "Building teams…"}
                  </h2>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {remaining.length} LEFT
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {teams.map((team, index) => {
                  const isTarget = phase === "landed" && index === targetTeamIndex;
                  return (
                    <motion.div
                      key={team.id}
                      animate={{
                        borderColor: isTarget
                          ? "rgba(255,79,163,.75)"
                          : "rgba(42,48,59,1)",
                        scale: isTarget ? 1.02 : 1,
                      }}
                      className="rounded-2xl border bg-[#0D1219] p-3 min-h-[170px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-display text-base font-black">
                          <span className="text-[#FF4FA3] mr-2">#{index + 1}</span>
                          {team.name}
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {(team.roster || []).length}/{rosterSize}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5">
                        {(team.roster || []).map((player) => (
                          <motion.div
                            layoutId={"switcheroo-player-" + player.id}
                            key={player.id}
                            className="h-9 rounded-lg border border-[#252B36] bg-[#111720] px-3 flex items-center text-xs font-bold"
                          >
                            {player.name}
                          </motion.div>
                        ))}

                        {Array.from({
                          length: Math.max(0, rosterSize - (team.roster || []).length),
                        }).map((_, slot) => (
                          <div
                            key={"slot-" + slot}
                            className="h-9 rounded-lg border border-dashed border-[#252B36] bg-black/[0.08] flex items-center justify-center text-[9px] uppercase tracking-[.14em] text-[#4E5866]"
                          >
                            Empty slot
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-4 rounded-xl border border-[#252B36] bg-[#0D1219] px-4 py-3 text-[11px] text-muted-foreground">
                Players are assigned in order: Team #1 → Team #2 → Team #3… then the cycle repeats until every roster is full.
              </div>
            </div>
          </div>
        </main>
      </div>
    </motion.div>
  );
}
