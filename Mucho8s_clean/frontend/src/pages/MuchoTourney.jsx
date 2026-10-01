import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Navigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import {
  Crown,
  Plus,
  RotateCcw,
  Shuffle,
  Swords,
  Trophy,
  UsersRound,
  X,
  Clock3,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { fetchTourney, reviewTourneyPayment, saveTourney, subscribeTourney } from "@/lib/tourneyLive";

export const TOURNEY_STORE = "mucho8s-tourney-admin-v1";
const STORE = TOURNEY_STORE;

const switcherooDefaults = {
  pool: [],
  reviewMinutes: 5,
  rerollGoal: 20,
  maxRerolls: 1,
  rerollsUsed: 0,
  generation: 0,
  phase: "idle",
  reviewEndsAt: null,
  contributedTotal: 0,
  contributions: [],
  pendingPayments: [],
  paypalUrl: "",
};

const blank = {
  name: "MuchoTourney Test Cup",
  game: "BO7",
  format: "4v4",
  bestOf: 5,
  finalBestOf: 5,
  mode: "CDL Mix",
  startMode: "Hardpoint",
  seeding: "manual",
  teamBuild: "manual",
  teams: [],
  bracket: [],
  champion: null,
  status: "setup",
  switcheroo: switcherooDefaults,
};

const normalize = (value = {}) => ({
  ...blank,
  ...value,
  switcheroo: {
    ...switcherooDefaults,
    ...(value?.switcheroo && typeof value.switcheroo === "object" ? value.switcheroo : {}),
  },
});

const load = () => {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORE) || "{}"));
  } catch {
    return normalize();
  }
};

const roundsFor = (n) =>
  n <= 2 ? ["Final"] : n <= 4 ? ["Semifinals", "Final"] : ["Quarterfinals", "Semifinals", "Final"];

const rosterSizeFor = (format) => Math.max(1, Number(String(format || "4v4").split("v")[0]) || 4);

const shuffleRows = (rows) => {
  const next = [...rows];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const teamLabels = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

const makeSwitcherooTeams = (pool, format, generation = 1) => {
  const rosterSize = rosterSizeFor(format);
  const teamCount = pool.length / rosterSize;
  const shuffled = shuffleRows(pool);
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: crypto.randomUUID?.() || `switcheroo-${generation}-${index}-${Date.now()}`,
    name: `Team ${teamLabels[index] || index + 1}`,
    seed: index + 1,
    roster: [],
    switcherooGeneration: generation,
  }));

  shuffled.forEach((player, index) => {
    const teamIndex = index % teamCount;
    teams[teamIndex].roster.push({ id: player.id, name: player.name });
  });

  return teams;
};

const makeBracket = (teams) => {
  const size = teams.length <= 2 ? 2 : teams.length <= 4 ? 4 : 8;
  const seeded = [...teams].slice(0, size);
  while (seeded.length < size) seeded.push(null);
  const order = size === 8 ? [0, 7, 3, 4, 1, 6, 2, 5] : size === 4 ? [0, 3, 1, 2] : [0, 1];
  const first = [];
  for (let i = 0; i < order.length; i += 2) {
    first.push({
      id: `r0m${i / 2}`,
      round: 0,
      a: seeded[order[i]],
      b: seeded[order[i + 1]],
      winner: null,
      scoreA: 0,
      scoreB: 0,
    });
  }
  const rounds = [first];
  let count = first.length / 2;
  let round = 1;
  while (count >= 1) {
    rounds.push(
      Array.from({ length: count }, (_, index) => ({
        id: `r${round}m${index}`,
        round,
        a: null,
        b: null,
        winner: null,
        scoreA: 0,
        scoreB: 0,
      }))
    );
    count /= 2;
    round += 1;
  }
  return rounds;
};

const formatClock = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

export default function MuchoTourney() {
  const { isAdmin, admin, players } = useData();
  const [t, setT] = useState(load);
  const [teamName, setTeamName] = useState("");
  const [fx, setFx] = useState(null);
  const [editingRoster, setEditingRoster] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [paymentBusyId, setPaymentBusyId] = useState("");

  const fireFx = (type, data = {}) => setFx({ type, ...data, key: Date.now() });

  useEffect(() => {
    let alive = true;
    fetchTourney().then((remote) => {
      if (alive && remote && Object.keys(remote).length) setT(normalize(remote));
    });
    const off = subscribeTourney((remote) => {
      if (remote) setT(normalize(remote));
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (!fx) return undefined;
    const duration = fx.type === "champion" ? 4200 : fx.type === "switcheroo" ? 4600 : 2200;
    const id = setTimeout(() => setFx(null), duration);
    return () => clearTimeout(id);
  }, [fx]);

  useEffect(() => {
    if (t.status !== "review") return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t.status]);

  const save = (nextValue) => {
    const next = normalize(nextValue);
    setT(next);
    localStorage.setItem(STORE, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("mucho:tourney-update", { detail: next }));
    if (admin?.sessionToken) {
      saveTourney(next, admin.sessionToken).catch((error) =>
        toast.error(error.message || "Live tournament sync failed")
      );
    }
  };

  const patch = (value) => save({ ...t, ...value });

  const reviewRemaining = Math.max(
    0,
    new Date(t.switcheroo?.reviewEndsAt || 0).getTime() - now
  );

  useEffect(() => {
    if (
      t.status === "review" &&
      t.switcheroo?.reviewEndsAt &&
      reviewRemaining <= 0 &&
      t.switcheroo?.phase !== "locked"
    ) {
      save({
        ...t,
        status: "ready",
        switcheroo: { ...t.switcheroo, phase: "locked" },
      });
      toast.success("Switcheroo review ended · teams locked");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRemaining, t.status, t.switcheroo?.phase]);

  const switcherooProgress = Math.min(
    100,
    Math.round(
      (Number(t.switcheroo?.contributedTotal || 0) /
        Math.max(1, Number(t.switcheroo?.rerollGoal || 1))) *
        100
    )
  );

  const switcherooCanFund =
    t.status === "review" &&
    reviewRemaining > 0 &&
    Number(t.switcheroo?.rerollsUsed || 0) < Number(t.switcheroo?.maxRerolls || 0);

  const addTeam = () => {
    const name = teamName.trim();
    if (!name) return;
    if (t.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Team already registered");
      return;
    }
    if (t.teams.length >= 8) {
      toast.error("Maximum 8 teams in this bracket");
      return;
    }
    save({
      ...t,
      teams: [
        ...t.teams,
        {
          id: crypto.randomUUID?.() || String(Date.now()),
          name,
          seed: t.teams.length + 1,
          roster: [],
        },
      ],
      bracket: [],
      champion: null,
      status: "setup",
    });
    setTeamName("");
  };

  const toggleRosterPlayer = (teamId, player) => {
    const teams = t.teams.map((team) => {
      if (team.id !== teamId) return team;
      const roster = Array.isArray(team.roster) ? team.roster : [];
      const exists = roster.some((row) => String(row.id) === String(player.id));
      const max = rosterSizeFor(t.format);
      if (!exists && roster.length >= max) {
        toast.error(`Roster ${t.format}: maximum ${max} players`);
        return team;
      }
      return {
        ...team,
        roster: exists
          ? roster.filter((row) => String(row.id) !== String(player.id))
          : [...roster, { id: player.id, name: player.name }],
      };
    });

    const byId = new Map(teams.map((team) => [team.id, team]));
    const bracket = (t.bracket || []).map((round) =>
      round.map((match) => ({
        ...match,
        a: match.a ? byId.get(match.a.id) || match.a : null,
        b: match.b ? byId.get(match.b.id) || match.b : null,
      }))
    );
    const champion = t.champion ? byId.get(t.champion.id) || t.champion : null;
    save({ ...t, teams, bracket, champion });
  };

  const toggleSwitcherooPlayer = (player) => {
    if (t.status === "review" || t.status === "live") return;
    const pool = Array.isArray(t.switcheroo?.pool) ? t.switcheroo.pool : [];
    const exists = pool.some((row) => String(row.id) === String(player.id));
    const nextPool = exists
      ? pool.filter((row) => String(row.id) !== String(player.id))
      : [...pool, { id: player.id, name: player.name }];

    save({
      ...t,
      teams: t.teamBuild === "switcheroo" ? [] : t.teams,
      bracket: [],
      champion: null,
      status: "setup",
      switcheroo: {
        ...t.switcheroo,
        pool: nextPool,
        phase: "idle",
        reviewEndsAt: null,
        contributedTotal: 0,
        contributions: [],
        rerollsUsed: 0,
        generation: 0,
      },
    });
  };

  const startSwitcheroo = () => {
    const pool = Array.isArray(t.switcheroo?.pool) ? t.switcheroo.pool : [];
    const rosterSize = rosterSizeFor(t.format);

    if (pool.length < rosterSize * 2) {
      toast.error(`Select at least ${rosterSize * 2} players for ${t.format}`);
      return;
    }
    if (pool.length % rosterSize !== 0) {
      toast.error(`Player count must be divisible by ${rosterSize} for ${t.format}`);
      return;
    }
    const teamCount = pool.length / rosterSize;
    if (teamCount > 8) {
      toast.error("Switcheroo supports a maximum of 8 teams");
      return;
    }

    const generation = 1;
    const teams = makeSwitcherooTeams(pool, t.format, generation);
    const reviewMinutes = Math.max(1, Number(t.switcheroo?.reviewMinutes || 5));
    const reviewEndsAt = new Date(Date.now() + reviewMinutes * 60 * 1000).toISOString();

    save({
      ...t,
      teamBuild: "switcheroo",
      teams,
      bracket: [],
      champion: null,
      status: "review",
      switcheroo: {
        ...t.switcheroo,
        phase: "review",
        generation,
        reviewEndsAt,
        contributedTotal: 0,
        contributions: [],
        rerollsUsed: 0,
      },
    });

    fireFx("switcheroo", {
      title: "SWITCHEROO",
      sub: `${pool.length} PLAYERS · ${teams.length} TEAMS GENERATED`,
      pool,
    });
    toast.success("Switcheroo complete · review phase started");
  };

  const forceReroll = () => {
    const pool = Array.isArray(t.switcheroo?.pool) ? t.switcheroo.pool : [];
    if (!pool.length) return;
    const nextUsed = Number(t.switcheroo?.rerollsUsed || 0) + 1;
    if (nextUsed > Number(t.switcheroo?.maxRerolls || 0)) {
      toast.error("Maximum rerolls reached");
      return;
    }

    const generation = Number(t.switcheroo?.generation || 1) + 1;
    const teams = makeSwitcherooTeams(pool, t.format, generation);
    const reviewMinutes = Math.max(1, Number(t.switcheroo?.reviewMinutes || 5));

    save({
      ...t,
      teams,
      bracket: [],
      champion: null,
      status: "review",
      switcheroo: {
        ...t.switcheroo,
        phase: "review",
        generation,
        rerollsUsed: nextUsed,
        reviewEndsAt: new Date(Date.now() + reviewMinutes * 60 * 1000).toISOString(),
        contributedTotal: 0,
        contributions: [],
      },
    });

    fireFx("switcheroo", {
      title: "RE-SWITCHEROO",
      sub: `REROLL ${nextUsed}/${t.switcheroo.maxRerolls}`,
      pool,
    });
  };

  const reviewPayment = async (paymentId, decision) => {
    if (!paymentId || !admin?.sessionToken || paymentBusyId) return;
    setPaymentBusyId(paymentId);
    try {
      const data = await reviewTourneyPayment(paymentId, decision, admin.sessionToken);
      if (data?.tourney) setT(normalize(data.tourney));
      if (data?.rerolled) {
        fireFx("switcheroo", {
          title: "RE-SWITCHEROO",
          sub: "PAYPAL GOAL REACHED · NEW TEAMS GENERATED",
          pool: data?.tourney?.switcheroo?.pool || [],
        });
        toast.success("Goal reached · Switcheroo re-spin started");
      } else {
        toast.success(decision === "confirm" ? "PayPal contribution confirmed" : "PayPal contribution rejected");
      }
    } catch (error) {
      toast.error(error?.message || "Unable to review payment");
    } finally {
      setPaymentBusyId("");
    }
  };

  const generate = () => {
    if (t.status === "review") {
      toast.error("Wait for the Switcheroo review to finish");
      return;
    }
    if (t.teams.length < 2) {
      toast.error("Add at least 2 teams");
      return;
    }

    const rosterSize = rosterSizeFor(t.format);
    const incomplete = t.teams.find((team) => (team.roster || []).length !== rosterSize);
    if (incomplete) {
      toast.error(`${incomplete.name} needs exactly ${rosterSize} players`);
      return;
    }

    let teams = [...t.teams];
    if (t.seeding === "random") teams = shuffleRows(teams);
    teams = teams.map((team, index) => ({ ...team, seed: index + 1 }));

    save({
      ...t,
      teams,
      bracket: makeBracket(teams),
      champion: null,
      status: "live",
      switcheroo: {
        ...t.switcheroo,
        phase: t.teamBuild === "switcheroo" ? "locked" : t.switcheroo.phase,
      },
    });
    fireFx("bracket", {
      title: "BRACKET LOCKED",
      sub: `${teams.length} TEAMS · THE ROAD STARTS NOW`,
    });
    toast.success("Bracket generated");
  };

  const report = (roundIndex, matchIndex, winner) => {
    const bracket = t.bracket.map((round) => round.map((match) => ({ ...match })));
    const match = bracket[roundIndex][matchIndex];
    const series = roundIndex === bracket.length - 1 ? t.finalBestOf : t.bestOf;
    const wins = Math.ceil(series / 2);
    const loserMax = Math.max(0, wins - 1);
    const raw = window.prompt(
      `Final score? Winner needs ${wins} map wins. Enter loser maps (0-${loserMax})`,
      String(Math.min(Number(winner === "a" ? match.scoreB : match.scoreA) || 0, loserMax))
    );
    if (raw === null) return;
    const loserScore = Number(raw);
    if (!Number.isInteger(loserScore) || loserScore < 0 || loserScore > loserMax) {
      toast.error(`Loser score must be between 0 and ${loserMax}`);
      return;
    }

    match.winner = winner;
    match.scoreA = winner === "a" ? wins : loserScore;
    match.scoreB = winner === "b" ? wins : loserScore;
    const won = winner === "a" ? match.a : match.b;

    if (roundIndex < bracket.length - 1) {
      const next = bracket[roundIndex + 1][Math.floor(matchIndex / 2)];
      if (matchIndex % 2 === 0) next.a = won;
      else next.b = won;
      next.winner = null;
      next.scoreA = 0;
      next.scoreB = 0;
    }

    const champion = roundIndex === bracket.length - 1 ? won : null;
    save({
      ...t,
      bracket,
      champion: champion || t.champion,
      status: champion ? "completed" : "live",
    });

    if (champion) {
      fireFx("champion", { title: "MUCHOTOURNEY CHAMPION", sub: won?.name || "CHAMPION" });
    } else if (roundIndex === bracket.length - 2) {
      fireFx("final", {
        title: "FINALIST LOCKED",
        sub: `${won?.name || "TEAM"} ADVANCES TO THE FINAL`,
      });
    } else {
      fireFx("advance", {
        title: "TEAM ADVANCES",
        sub: `${won?.name || "TEAM"} SURVIVES THE ROUND`,
      });
    }
  };

  const reset = () => {
    if (!window.confirm("Reset MuchoTourney test data?")) return;
    save(normalize());
  };

  const labels = useMemo(
    () =>
      roundsFor(
        t.bracket?.[0]?.length ? t.bracket[0].length * 2 : Math.max(2, t.teams.length)
      ),
    [t.bracket, t.teams.length]
  );

  const poolIds = new Set((t.switcheroo?.pool || []).map((player) => String(player.id)));

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <>
      <div className="m8-page-stack gap-3 max-w-7xl mx-auto">
        <section className="m8-panel rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div>
            <div className="brand-kicker text-[#D5A33A] mb-1">Admin test environment</div>
            <h1 className="font-display text-3xl font-black tracking-[-.04em]">MuchoTourney</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Private tournament control room · single elimination + Switcheroo.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="h-10 px-3 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[.06] text-[#D5A33A] flex items-center gap-2 text-xs font-black">
              <Trophy size={15} />
              ADMIN ONLY
            </span>
            <button
              type="button"
              onClick={reset}
              className="h-10 w-10 rounded-xl border border-[#2A303B] flex items-center justify-center"
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ["STATUS", t.status.toUpperCase()],
            ["TEAMS", t.teams.length + "/8"],
            ["FORMAT", t.format + " · BO" + t.bestOf],
            ["CHAMPION", t.champion?.name || "—"],
          ].map(([label, value]) => (
            <div key={label} className="m8-panel rounded-2xl p-4">
              <div className="text-[9px] tracking-[.16em] text-[#697181]">{label}</div>
              <div className="text-lg font-black mt-1">{value}</div>
            </div>
          ))}
        </section>

        <section className="m8-panel rounded-[22px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Swords size={17} className="text-[#D5A33A]" />
            <h2 className="font-display font-black">Tournament Settings</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="col-span-2">
              <span className="text-[9px] tracking-widest text-[#697181]">NAME</span>
              <input
                value={t.name}
                onChange={(event) => patch({ name: event.target.value })}
                className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
              />
            </label>

            {[
              ["GAME", "game", ["BO7", "BO6", "MW3", "CW", "BO2"]],
              ["FORMAT", "format", ["2v2", "3v3", "4v4"]],
              ["MODE", "mode", ["CDL Mix", "Hardpoint", "Search & Destroy"]],
              ["SERIES", "bestOf", [3, 5, 7]],
              ["FINAL", "finalBestOf", [3, 5, 7]],
              ["SEEDING", "seeding", ["manual", "random"]],
              ["TEAM BUILD", "teamBuild", ["manual", "switcheroo"]],
            ].map(([label, key, options]) => (
              <label key={key}>
                <span className="text-[9px] tracking-widest text-[#697181]">{label}</span>
                <select
                  value={t[key]}
                  onChange={(event) => {
                    const value = ["bestOf", "finalBestOf"].includes(key)
                      ? Number(event.target.value)
                      : event.target.value;
                    if (key === "teamBuild") {
                      save({
                        ...t,
                        teamBuild: value,
                        teams: [],
                        bracket: [],
                        champion: null,
                        status: "setup",
                        switcheroo: {
                          ...t.switcheroo,
                          phase: "idle",
                          reviewEndsAt: null,
                          contributedTotal: 0,
                          contributions: [],
                          rerollsUsed: 0,
                          generation: 0,
                        },
                      });
                    } else {
                      patch({ [key]: value });
                    }
                  }}
                  disabled={t.status === "live" || t.status === "completed" || t.status === "review"}
                  className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold disabled:opacity-40"
                >
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {String(option).toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            {t.mode === "CDL Mix" && (
              <label>
                <span className="text-[9px] tracking-widest text-[#697181]">MIX START</span>
                <select
                  value={t.startMode}
                  onChange={(event) => patch({ startMode: event.target.value })}
                  disabled={t.status === "live" || t.status === "completed" || t.status === "review"}
                  className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold disabled:opacity-40"
                >
                  <option>Hardpoint</option>
                  <option>Search & Destroy</option>
                </select>
              </label>
            )}
          </div>

          {t.teamBuild === "switcheroo" && (
            <div className="mt-4 pt-4 border-t border-[#222834]">
              <div className="text-[9px] tracking-[.16em] text-[#D5A33A] font-black mb-3">
                SWITCHEROO SETTINGS
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label>
                  <span className="text-[9px] tracking-widest text-[#697181]">REVIEW TIME</span>
                  <select
                    value={t.switcheroo.reviewMinutes}
                    onChange={(event) =>
                      save({
                        ...t,
                        switcheroo: {
                          ...t.switcheroo,
                          reviewMinutes: Number(event.target.value),
                        },
                      })
                    }
                    disabled={t.status === "review"}
                    className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold disabled:opacity-40"
                  >
                    {[1, 3, 5, 10, 15].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="text-[9px] tracking-widest text-[#697181]">RE-ROLL GOAL</span>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-white/40">€</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={t.switcheroo.rerollGoal}
                      onChange={(event) =>
                        save({
                          ...t,
                          switcheroo: {
                            ...t.switcheroo,
                            rerollGoal: Math.max(1, Number(event.target.value) || 1),
                          },
                        })
                      }
                      disabled={t.status === "review"}
                      className="w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] pl-7 pr-3 text-sm disabled:opacity-40"
                    />
                  </div>
                </label>

                <label>
                  <span className="text-[9px] tracking-widest text-[#697181]">MAX RE-ROLLS</span>
                  <select
                    value={t.switcheroo.maxRerolls}
                    onChange={(event) =>
                      save({
                        ...t,
                        switcheroo: {
                          ...t.switcheroo,
                          maxRerolls: Number(event.target.value),
                        },
                      })
                    }
                    disabled={t.status === "review"}
                    className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-2 text-xs font-semibold disabled:opacity-40"
                  >
                    {[1, 2, 3].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block mt-3">
                <span className="text-[9px] tracking-widest text-[#697181]">PAYPAL LINK</span>
                <input
                  value={t.switcheroo.paypalUrl || ""}
                  onChange={(event) =>
                    save({
                      ...t,
                      switcheroo: {
                        ...t.switcheroo,
                        paypalUrl: event.target.value,
                      },
                    })
                  }
                  disabled={t.status === "review"}
                  placeholder="https://paypal.me/tuonome"
                  className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm disabled:opacity-40"
                />
                <div className="text-[9px] text-muted-foreground mt-1.5">
                  Players are sent here to pay. The progress bar increases only after Admin confirms the payment.
                </div>
              </label>
            </div>
          )}
        </section>

        {t.teamBuild === "switcheroo" ? (
          <section className="grid lg:grid-cols-[430px_1fr] gap-3">
            <div className="m8-panel rounded-[22px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shuffle size={17} className="text-[#D5A33A]" />
                  <h2 className="font-display font-black">Switcheroo Pool</h2>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(t.switcheroo.pool || []).length} players
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground mt-2">
                Select the tournament players. Switcheroo randomly builds complete {t.format} teams.
              </p>

              <div className="mt-3 max-h-[430px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {(players || []).map((player) => {
                  const active = poolIds.has(String(player.id));
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => toggleSwitcherooPlayer(player)}
                      disabled={t.status === "review" || t.status === "live" || t.status === "completed"}
                      className={
                        "h-10 px-3 rounded-lg border text-left text-xs font-bold flex items-center justify-between transition-all disabled:cursor-not-allowed " +
                        (active
                          ? "border-[#D5A33A] bg-[#D5A33A]/10 text-[#F4CE70]"
                          : "border-[#252B36] bg-[#0D1219] hover:border-[#3B4554]")
                      }
                    >
                      <span className="truncate">{player.name}</span>
                      <span className="font-mono text-[9px]">{active ? "✓ IN" : player.currentElo + " ELO"}</span>
                    </button>
                  );
                })}
              </div>

              {t.status === "setup" && (
                <button
                  type="button"
                  onClick={startSwitcheroo}
                  className="mt-4 w-full h-11 rounded-xl bg-[#D5A33A] hover:bg-[#E0B247] text-black font-black flex items-center justify-center gap-2"
                >
                  <Shuffle size={15} />
                  START SWITCHEROO
                </button>
              )}

              {t.status === "ready" && (
                <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-3 py-3 text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <Lock size={14} />
                  Teams locked · ready to generate bracket
                </div>
              )}
            </div>

            <div className="space-y-3">
              {t.status === "review" && (
                <section className="m8-panel rounded-[22px] p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="brand-kicker text-[#D5A33A]">Switcheroo review</div>
                      <h2 className="font-display text-xl font-black mt-1">
                        Teams are provisional
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Players can fund a full re-spin from the public MuchoTourney page.
                      </p>
                    </div>
                    <div className="h-11 px-3 rounded-xl border border-[#2A303B] bg-[#111720] flex items-center gap-2">
                      <Clock3 size={15} className={reviewRemaining <= 30000 ? "text-magma" : "text-[#D5A33A]"} />
                      <span className={"font-mono font-black " + (reviewRemaining <= 30000 ? "text-magma" : "")}>
                        {formatClock(reviewRemaining)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-end justify-between gap-3 mb-2">
                      <div>
                        <div className="text-[9px] uppercase tracking-[.16em] text-[#697181]">RE-ROLL FUND</div>
                        <div className="font-mono text-xl font-black mt-0.5">
                          €{Number(t.switcheroo.contributedTotal || 0).toFixed(0)}
                          <span className="text-sm text-muted-foreground">
                            {" "} / €{Number(t.switcheroo.rerollGoal || 0).toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-muted-foreground">
                        Re-rolls {t.switcheroo.rerollsUsed}/{t.switcheroo.maxRerolls}
                      </div>
                    </div>

                    <div className="h-3 rounded-full bg-[#0B0F15] border border-[#252B36] overflow-hidden">
                      <motion.div
                        animate={{ width: switcherooProgress + "%" }}
                        className="h-full bg-[#D5A33A]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                      <div className="text-[10px] text-muted-foreground">
                        {switcherooCanFund
                          ? "Goal reached = automatic full Switcheroo re-spin."
                          : Number(t.switcheroo.rerollsUsed || 0) >= Number(t.switcheroo.maxRerolls || 0)
                            ? "Re-roll limit reached. Final review only."
                            : "Review ending · teams will lock."}
                      </div>
                      <button
                        type="button"
                        onClick={forceReroll}
                        disabled={Number(t.switcheroo.rerollsUsed || 0) >= Number(t.switcheroo.maxRerolls || 0)}
                        className="h-8 px-3 rounded-lg border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] text-[#D5A33A] text-[9px] font-black disabled:opacity-30"
                      >
                        ADMIN FORCE RE-SPIN
                      </button>
                    </div>
                  </div>

                  {(t.switcheroo.contributions || []).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#222834]">
                      <div className="text-[9px] tracking-widest text-[#697181] mb-2">LATEST CONTRIBUTIONS</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(t.switcheroo.contributions || []).slice(-8).reverse().map((row) => (
                          <span key={row.id || row.at} className="h-7 px-2 rounded-lg border border-[#2A303B] bg-[#111720] text-[10px] inline-flex items-center gap-1.5">
                            <strong>{row.name || "Player"}</strong>
                            <span className="text-[#D5A33A]">+€{row.amount}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(t.switcheroo.pendingPayments || []).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#222834]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-[9px] tracking-widest text-[#697181]">PAYPAL PAYMENTS TO VERIFY</div>
                        <span className="font-mono text-[9px] text-[#D5A33A]">
                          {t.switcheroo.pendingPayments.length} pending
                        </span>
                      </div>
                      <div className="space-y-2">
                        {t.switcheroo.pendingPayments.map((row) => (
                          <div
                            key={row.id}
                            className="rounded-lg border border-[#2A303B] bg-[#111720] px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-black truncate">{row.name || "Player"}</div>
                              <div className="text-[10px] text-muted-foreground">
                                Declared payment <span className="text-[#D5A33A] font-black">€{row.amount}</span>
                              </div>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={paymentBusyId === row.id}
                                onClick={() => reviewPayment(row.id, "reject")}
                                className="h-8 px-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-red-300 text-[9px] font-black disabled:opacity-40"
                              >
                                REJECT
                              </button>
                              <button
                                type="button"
                                disabled={paymentBusyId === row.id}
                                onClick={() => reviewPayment(row.id, "confirm")}
                                className="h-8 px-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-300 text-[9px] font-black disabled:opacity-40"
                              >
                                CONFIRM PAID
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              <section className="m8-panel rounded-[22px] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="brand-kicker text-[#D5A33A]">Generation {t.switcheroo.generation || 0}</div>
                    <h2 className="font-display font-black text-lg">Switcheroo Teams</h2>
                  </div>
                  {t.status === "ready" && (
                    <span className="m8-pill text-emerald-400 border-emerald-500/25">LOCKED</span>
                  )}
                </div>

                {!t.teams.length ? (
                  <div className="min-h-[260px] flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Shuffle size={34} className="mb-3 opacity-40" />
                    <div className="font-bold text-white">No Switcheroo yet</div>
                    <div className="text-xs mt-1">Select the pool and start the wheel.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
                    {t.teams.map((team, index) => (
                      <div key={team.id} className="rounded-xl border border-[#252B36] bg-[#10151D] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-black">
                            <span className="text-[#D5A33A] mr-2">#{index + 1}</span>
                            {team.name}
                          </div>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {(team.roster || []).length}/{rosterSizeFor(t.format)}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {(team.roster || []).map((player) => (
                            <div key={player.id} className="h-8 rounded-lg border border-[#202631] bg-[#0D1219] px-2.5 flex items-center text-[11px] font-semibold">
                              {player.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {t.status === "ready" && (
                  <button
                    type="button"
                    onClick={generate}
                    className="mt-4 w-full h-11 rounded-xl bg-magma text-white font-black flex items-center justify-center gap-2"
                  >
                    <Shuffle size={15} />
                    GENERATE BRACKET
                  </button>
                )}
              </section>
            </div>
          </section>
        ) : (
          <section className="grid lg:grid-cols-[360px_1fr] gap-3">
            <div className="m8-panel rounded-[22px] p-5">
              <div className="flex items-center gap-2">
                <UsersRound size={17} />
                <h2 className="font-display font-black">Teams / Seeding</h2>
              </div>

              <div className="flex gap-2 mt-4">
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addTeam()}
                  placeholder="Team name"
                  className="h-10 min-w-0 flex-1 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                />
                <button
                  type="button"
                  onClick={addTeam}
                  className="w-10 h-10 rounded-xl bg-[#D5A33A] text-black flex items-center justify-center"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {t.teams.map((team, index) => (
                  <div key={team.id} className="rounded-xl border border-[#252B36] bg-[#10151D] overflow-hidden">
                    <div className="h-11 px-3 flex items-center gap-3">
                      <span className="font-mono text-[#D5A33A] text-xs">#{index + 1}</span>
                      <span className="font-bold text-sm flex-1 truncate">{team.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingRoster(editingRoster === team.id ? null : team.id)}
                        className="h-7 px-2 rounded-lg border border-[#D5A33A]/25 text-[#D5A33A] text-[9px] font-black"
                      >
                        EDIT ROSTER · {(team.roster || []).length}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          save({
                            ...t,
                            teams: t.teams.filter((row) => row.id !== team.id),
                            bracket: [],
                            champion: null,
                            status: "setup",
                          })
                        }
                        className="text-[#697181] hover:text-red-400"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {editingRoster === team.id && (
                      <div className="border-t border-[#252B36] p-3">
                        <div className="text-[9px] text-[#697181] tracking-widest mb-2">
                          SELECT {t.format} ROSTER
                        </div>
                        <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {(players || []).map((player) => {
                            const active = (team.roster || []).some(
                              (row) => String(row.id) === String(player.id)
                            );
                            const usedBy = t.teams.find(
                              (other) =>
                                other.id !== team.id &&
                                (other.roster || []).some(
                                  (row) => String(row.id) === String(player.id)
                                )
                            );
                            return (
                              <button
                                key={player.id}
                                type="button"
                                disabled={Boolean(usedBy) && !active}
                                onClick={() => toggleRosterPlayer(team.id, player)}
                                className={
                                  `h-9 px-3 rounded-lg border text-left text-xs font-bold flex items-center justify-between ${active
                                    ? "border-[#D5A33A] bg-[#D5A33A]/10 text-[#F4CE70]"
                                    : "border-[#252B36] bg-[#0D1219]"} ${usedBy && !active ? "opacity-30 cursor-not-allowed" : ""}`
                                }
                              >
                                <span className="truncate">{player.name}</span>
                                <span className="text-[9px]">
                                  {active ? "✓" : usedBy ? "IN TEAM" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-2">
                          {(team.roster || []).length}/{rosterSizeFor(t.format)} players selected
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={generate}
                className="mt-4 w-full h-11 rounded-xl bg-magma text-white font-black flex items-center justify-center gap-2"
              >
                <Shuffle size={15} />
                Generate Bracket
              </button>
            </div>

            <div className="m8-panel rounded-[22px] p-5 overflow-x-auto">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-black">Bracket</h2>
                <span className="text-[10px] text-muted-foreground">Click winner to advance</span>
              </div>

              {!t.bracket.length ? (
                <div className="min-h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground">
                  <Trophy size={34} className="mb-3 opacity-40" />
                  <div className="font-bold text-white">Bracket not generated</div>
                  <div className="text-xs mt-1">Add teams and generate the test bracket.</div>
                </div>
              ) : (
                <div className="flex gap-6 min-w-[760px] mt-5">
                  {t.bracket.map((round, roundIndex) => (
                    <div key={roundIndex} className="flex-1 min-w-[220px]">
                      <div className="text-[10px] tracking-[.18em] text-[#D5A33A] font-black mb-3">
                        {labels[roundIndex] || `ROUND ${roundIndex + 1}`}
                      </div>
                      <div className="flex flex-col justify-around h-[420px]">
                        {round.map((match, matchIndex) => (
                          <div key={match.id} className="rounded-xl border border-[#252B36] bg-[#0F141C] overflow-hidden">
                            <div className="text-[9px] text-[#697181] px-3 pt-2">
                              BO{roundIndex === t.bracket.length - 1 ? t.finalBestOf : t.bestOf} · {t.mode}
                            </div>
                            {[
                              ["a", match.a],
                              ["b", match.b],
                            ].map(([side, team]) => (
                              <button
                                key={side}
                                type="button"
                                disabled={!team || Boolean(match.winner)}
                                onClick={() => report(roundIndex, matchIndex, side)}
                                className={
                                  `w-full h-10 px-3 flex items-center gap-2 text-left text-xs font-bold border-t border-[#202631] ${match.winner === side
                                    ? "bg-emerald-500/10 text-emerald-300"
                                    : match.winner
                                      ? "opacity-40"
                                      : "hover:bg-white/[.04]"}`
                                }
                              >
                                <span className="flex-1 truncate">{team?.name || "TBD"}</span>
                                {match.winner && (
                                  <span
                                    className={
                                      `font-mono text-sm font-black ${match.winner === side ? "text-emerald-300" : "text-[#697181]"}`
                                    }
                                  >
                                    {side === "a" ? match.scoreA : match.scoreB}
                                  </span>
                                )}
                                {match.winner === side && <Crown size={13} />}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {t.teamBuild === "switcheroo" && t.bracket.length > 0 && (
          <section className="m8-panel rounded-[22px] p-5 overflow-x-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="brand-kicker text-[#D5A33A]">Switcheroo locked</div>
                <h2 className="font-display font-black">Bracket</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">Click winner to advance</span>
            </div>
            <div className="flex gap-6 min-w-[760px] mt-5">
              {t.bracket.map((round, roundIndex) => (
                <div key={roundIndex} className="flex-1 min-w-[220px]">
                  <div className="text-[10px] tracking-[.18em] text-[#D5A33A] font-black mb-3">
                    {labels[roundIndex] || `ROUND ${roundIndex + 1}`}
                  </div>
                  <div className="flex flex-col justify-around h-[420px]">
                    {round.map((match, matchIndex) => (
                      <div key={match.id} className="rounded-xl border border-[#252B36] bg-[#0F141C] overflow-hidden">
                        <div className="text-[9px] text-[#697181] px-3 pt-2">
                          BO{roundIndex === t.bracket.length - 1 ? t.finalBestOf : t.bestOf} · {t.mode}
                        </div>
                        {[
                          ["a", match.a],
                          ["b", match.b],
                        ].map(([side, team]) => (
                          <button
                            key={side}
                            type="button"
                            disabled={!team || Boolean(match.winner)}
                            onClick={() => report(roundIndex, matchIndex, side)}
                            className={
                              `w-full h-10 px-3 flex items-center gap-2 text-left text-xs font-bold border-t border-[#202631] ${match.winner === side
                                ? "bg-emerald-500/10 text-emerald-300"
                                : match.winner
                                  ? "opacity-40"
                                  : "hover:bg-white/[.04]"}`
                            }
                          >
                            <span className="flex-1 truncate">{team?.name || "TBD"}</span>
                            {match.winner && (
                              <span className="font-mono text-sm font-black">
                                {side === "a" ? match.scoreA : match.scoreB}
                              </span>
                            )}
                            {match.winner === side && <Crown size={13} />}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {t.champion && (
          <section className="rounded-[22px] border border-[#D5A33A]/30 bg-[#D5A33A]/[.06] p-7 text-center">
            <Crown size={34} className="text-[#D5A33A] mx-auto" />
            <div className="brand-kicker text-[#D5A33A] mt-3">MuchoTourney Champion</div>
            <div className="font-display text-3xl font-black mt-1">{t.champion.name}</div>
            <div className="text-xs text-muted-foreground mt-2">
              Champion card / trophy hook ready for the final production flow.
            </div>
          </section>
        )}
      </div>

      <AnimatePresence>
        {fx && (
          <motion.div
            key={fx.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[180] bg-[#03050a]/90 backdrop-blur-xl flex items-center justify-center overflow-hidden"
            onClick={() => setFx(null)}
          >
            {fx.type === "switcheroo" ? (
              <div className="relative text-center px-6 w-full max-w-3xl">
                <motion.div
                  initial={{ rotate: 0, scale: 0.82 }}
                  animate={{ rotate: 1620, scale: 1 }}
                  transition={{ duration: 3.3, ease: [0.12, 0.8, 0.18, 1] }}
                  className="mx-auto relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border-[10px] border-[#D5A33A]/75 bg-[conic-gradient(from_0deg,#19140a_0deg_45deg,#2a1115_45deg_90deg,#101822_90deg_135deg,#211329_135deg_180deg,#19140a_180deg_225deg,#2a1115_225deg_270deg,#101822_270deg_315deg,#211329_315deg_360deg)] shadow-[0_0_90px_rgba(213,163,58,.25)]"
                >
                  <div className="absolute inset-[22%] rounded-full bg-[#080B10] border border-[#D5A33A]/50 flex items-center justify-center">
                    <div>
                      <Shuffle size={32} className="text-[#D5A33A] mx-auto" />
                      <div className="font-display font-black text-xl mt-2">SWITCHEROO</div>
                    </div>
                  </div>
                  {Array.from({ length: 8 }, (_, index) => (
                    <span
                      key={index}
                      className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-white/75"
                      style={{
                        transform: `translate(-50%,-50%) rotate(${index * 45}deg) translateY(-122px)`,
                      }}
                    />
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.7 }}
                  className="mt-7"
                >
                  <div className="text-[11px] tracking-[.22em] font-black text-[#D5A33A]">MUCHOTOURNEY</div>
                  <div className="font-display text-4xl sm:text-6xl font-black mt-2 tracking-[-.05em]">
                    {fx.title}
                  </div>
                  <div className="mt-2 text-sm sm:text-lg font-black text-white/65">{fx.sub}</div>
                </motion.div>
              </div>
            ) : (
              <motion.div
                initial={{
                  scale: fx.type === "champion" ? 0.55 : 0.82,
                  y: fx.type === "champion" ? 40 : 18,
                  rotateX: fx.type === "champion" ? 18 : 0,
                }}
                animate={{ scale: 1, y: 0, rotateX: 0 }}
                transition={{ type: "spring", stiffness: 170, damping: 16 }}
                className="relative text-center px-8"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.12, type: "spring" }}
                  className={
                    `mx-auto w-24 h-24 rounded-[28px] border flex items-center justify-center ${fx.type === "champion"
                      ? "border-[#D5A33A]/60 bg-[#D5A33A]/10 shadow-[0_0_90px_rgba(213,163,58,.35)]"
                      : fx.type === "final"
                        ? "border-purple-400/50 bg-purple-500/10 shadow-[0_0_80px_rgba(168,85,247,.28)]"
                        : "border-magma/50 bg-magma/10 shadow-[0_0_70px_rgba(255,42,59,.25)]"}`
                  }
                >
                  <Trophy
                    size={45}
                    className={
                      fx.type === "champion"
                        ? "text-[#D5A33A]"
                        : fx.type === "final"
                          ? "text-purple-300"
                          : "text-magma"
                    }
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, letterSpacing: ".5em" }}
                  animate={{ opacity: 1, letterSpacing: ".18em" }}
                  transition={{ delay: 0.2 }}
                  className="mt-6 text-[11px] font-black text-[#D5A33A]"
                >
                  MUCHOTOURNEY
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, scale: 1.18 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.28 }}
                  className="font-display text-4xl sm:text-6xl font-black mt-2 tracking-[-.05em]"
                >
                  {fx.title}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42 }}
                  className="mt-3 text-sm sm:text-lg font-black text-white/70"
                >
                  {fx.sub}
                </motion.div>
                {fx.type === "champion" && (
                  <>
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-px w-72 max-w-full mx-auto mt-6 bg-gradient-to-r from-transparent via-[#D5A33A] to-transparent"
                    />
                    <motion.div
                      animate={{ opacity: [0.15, 0.55, 0.15], scale: [0.9, 1.15, 0.9] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                      className="absolute -inset-32 -z-10 rounded-full border border-[#D5A33A]/20"
                    />
                  </>
                )}
                <div className="mt-7 text-[9px] tracking-[.2em] text-white/30">
                  TAP ANYWHERE TO CONTINUE
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
