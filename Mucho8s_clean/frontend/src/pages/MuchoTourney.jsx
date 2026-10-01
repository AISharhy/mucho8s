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
import {
  fetchTourney,
  reviewTourneyEntryPayment,
  reviewTourneyPayment,
  saveTourney,
  subscribeTourney,
} from "@/lib/tourneyLive";
import SwitcherooWheel from "@/components/SwitcherooWheel";
import SwitcherooDrawOverlay from "@/components/SwitcherooDrawOverlay";
import TourneySetupWizard from "@/components/TourneySetupWizard";
import TournamentPlayerPicker from "@/components/TournamentPlayerPicker";

export const TOURNEY_STORE = "mucho8s-tourney-admin-v1";
const STORE = TOURNEY_STORE;

const switcherooDefaults = {
  pool: [],
  reviewMinutes: 5,
  entryFee: 5,
  registrationMode: "manual",
  maxTeams: 4,
  entryPaid: [],
  entryPendingPayments: [],
  rerollBaseGoal: 20,
  rerollGoal: 20,
  rerollStep: 10,
  rerollStepGrowth: 5,
  rerollsUsed: 0,
  generation: 0,
  phase: "idle",
  setupStage: "settings",
  publishedAt: null,
  liveDraw: null,
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
  setupConfigured: false,
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

const roundUpToFive = (value) =>
  Math.max(5, Math.ceil(Math.max(0, Number(value) || 0) / 5) * 5);

const switcherooEconomyFor = (entryFee, playerCount) => {
  const fee = Math.max(1, Math.round(Number(entryFee) || 1));
  const count = Math.max(0, Number(playerCount) || 0);
  const entryPot = fee * count;
  const baseGoal = roundUpToFive(entryPot * 0.5);
  const firstMargin = roundUpToFive(baseGoal * 0.5);
  return {
    entryFee: fee,
    entryPot,
    baseGoal,
    firstMargin,
    marginGrowth: 5,
  };
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
  const [entryPaymentBusyId, setEntryPaymentBusyId] = useState("");
  const [switcherooDraw, setSwitcherooDraw] = useState(null);
  const [editSetupOpen, setEditSetupOpen] = useState(false);

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
      t.status !== "review" ||
      !t.switcheroo?.reviewEndsAt ||
      reviewRemaining > 0 ||
      t.switcheroo?.phase === "locked"
    ) {
      return;
    }

    fetchTourney()
      .then((remote) => {
        if (!remote) return;
        setT(normalize(remote));
        if (remote.status === "ready") {
          toast.success("Switcheroo review ended · teams locked");
        }
      })
      .catch(() => {});
  }, [reviewRemaining, t.status, t.switcheroo?.reviewEndsAt, t.switcheroo?.phase]);

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
    reviewRemaining > 0;

  const switcherooRosterSize = rosterSizeFor(t.format);
  const switcherooPoolSize = Array.isArray(t.switcheroo?.pool) ? t.switcheroo.pool.length : 0;
  const switcherooRegistrationMode =
    t.switcheroo?.registrationMode === "open" ? "open" : "manual";
  const switcherooMaxTeams = Math.min(
    8,
    Math.max(2, Number(t.switcheroo?.maxTeams || 4))
  );
  const switcherooEconomy = switcherooEconomyFor(
    t.switcheroo?.entryFee || 5,
    switcherooPoolSize
  );
  const currentRerollStep = Math.max(5, Number(t.switcheroo?.rerollStep || switcherooEconomy.firstMargin));
  const rerollStepGrowth = Math.max(5, Number(t.switcheroo?.rerollStepGrowth || 5));
  const nextRerollGoal = Number(t.switcheroo?.rerollGoal || switcherooEconomy.baseGoal) + currentRerollStep;
  const afterNextRerollGoal = nextRerollGoal + currentRerollStep + rerollStepGrowth;
  const entryPaidIds = new Set(
    (t.switcheroo?.entryPaid || []).map((row) => String(row?.playerId || ""))
  );
  const entryPendingIds = new Set(
    (t.switcheroo?.entryPendingPayments || []).map((row) => String(row?.playerId || ""))
  );
  const allEntryPaid =
    switcherooPoolSize > 0 &&
    (t.switcheroo?.pool || []).every((player) => entryPaidIds.has(String(player.id)));
  const switcherooStructureReady =
    switcherooPoolSize >= switcherooRosterSize * 2 &&
    switcherooPoolSize % switcherooRosterSize === 0 &&
    switcherooPoolSize / switcherooRosterSize <= 8;
  const switcherooPoolReady = switcherooStructureReady && allEntryPaid;
  const unpaidEntryPlayers = (t.switcheroo?.pool || []).filter(
    (player) => !entryPaidIds.has(String(player.id))
  );

  const switcherooSetupStage = t.switcheroo?.setupStage || "settings";

  const patchSwitcheroo = (value) => {
    const nextEntryFee =
      value?.entryFee !== undefined
        ? Math.max(1, Number(value.entryFee) || 1)
        : Number(t.switcheroo?.entryFee || 5);
    const economy = switcherooEconomyFor(nextEntryFee, switcherooPoolSize);

    save({
      ...t,
      switcheroo: {
        ...t.switcheroo,
        ...value,
        ...(value?.entryFee !== undefined
          ? {
              entryFee: nextEntryFee,
              rerollBaseGoal: economy.baseGoal,
              rerollGoal: economy.baseGoal,
              rerollStep: economy.firstMargin,
              rerollStepGrowth: economy.marginGrowth,
            }
          : {}),
      },
    });
  };

  const changeTeamBuild = (value) => {
    if (value === t.teamBuild) return;
    if (
      (t.switcheroo?.entryPaid || []).length > 0 ||
      (t.switcheroo?.entryPendingPayments || []).length > 0
    ) {
      toast.error("Resolve existing tournament entry payments before changing Team Build");
      return;
    }

    save({
      ...t,
      teamBuild: value,
      teams: [],
      bracket: [],
      champion: null,
      status: "setup",
      setupConfigured: false,
      switcheroo: {
        ...t.switcheroo,
        phase: "idle",
        setupStage: "settings",
        publishedAt: null,
        liveDraw: null,
        reviewEndsAt: null,
        contributedTotal: 0,
        contributions: [],
        pendingPayments: [],
        rerollsUsed: 0,
        generation: 0,
      },
    });
  };

  const setSwitcherooPool = (nextPool) => {
    const economy = switcherooEconomyFor(
      t.switcheroo?.entryFee || 5,
      nextPool.length
    );
    save({
      ...t,
      teams: [],
      bracket: [],
      champion: null,
      status: "setup",
      switcheroo: {
        ...t.switcheroo,
        pool: nextPool,
        phase: "idle",
        reviewEndsAt: null,
        entryPaid: (t.switcheroo?.entryPaid || []).filter((row) =>
          nextPool.some((player) => String(player.id) === String(row.playerId))
        ),
        entryPendingPayments: (t.switcheroo?.entryPendingPayments || []).filter((row) =>
          nextPool.some((player) => String(player.id) === String(row.playerId))
        ),
        rerollBaseGoal: economy.baseGoal,
        rerollGoal: economy.baseGoal,
        rerollStep: economy.firstMargin,
        rerollStepGrowth: economy.marginGrowth,
        contributedTotal: 0,
        contributions: [],
        pendingPayments: [],
        rerollsUsed: 0,
        generation: 0,
      },
    });
  };

  const goToSwitcherooPlayers = () => {
    save({
      ...t,
      switcheroo: {
        ...t.switcheroo,
        setupStage: "players",
        phase: "idle",
      },
    });
  };

  const publishSwitcheroo = () => {
    if (
      switcherooRegistrationMode !== "open" &&
      !switcherooStructureReady
    ) {
      toast.error(`Select a valid ${t.format} player pool before publishing`);
      return;
    }

    save({
      ...t,
      status: "setup",
      switcheroo: {
        ...t.switcheroo,
        registrationMode: switcherooRegistrationMode,
        maxTeams: switcherooMaxTeams,
        setupStage: "published",
        phase: "published",
        publishedAt: t.switcheroo?.publishedAt || new Date().toISOString(),
      },
    });
    setEditSetupOpen(false);
    toast.success(
      switcherooRegistrationMode === "open"
        ? "MuchoTourney published · registration is open"
        : "MuchoTourney is online · public Switcheroo wheel is now visible"
    );
  };

  const finishSetupWizard = () => {
    if (editSetupOpen) {
      setEditSetupOpen(false);
      toast.success("Tournament settings updated");
      return;
    }

    if (t.teamBuild === "switcheroo") {
      if (switcherooRegistrationMode === "open") publishSwitcheroo();
      else goToSwitcherooPlayers();
      return;
    }

    save({ ...t, setupConfigured: true });
    toast.success("Tournament settings saved · create the teams below");
  };

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
    if (t.status !== "setup" || switcherooSetupStage === "published") return;
    const pool = Array.isArray(t.switcheroo?.pool) ? t.switcheroo.pool : [];
    const exists = pool.some((row) => String(row.id) === String(player.id));
    if (exists && entryPaidIds.has(String(player.id))) {
      toast.error("This player already has a confirmed entry payment. Refund/resolve it before removing the player.");
      return;
    }
    if (exists && entryPendingIds.has(String(player.id))) {
      toast.error("This player has an entry payment waiting for confirmation. Confirm or reject it first.");
      return;
    }

    const nextPool = exists
      ? pool.filter((row) => String(row.id) !== String(player.id))
      : [...pool, { id: player.id, name: player.name }];

    setSwitcherooPool(nextPool);
  };

  const compUnpaidEntries = () => {
    if (!unpaidEntryPlayers.length) {
      return {
        entryPaid: t.switcheroo?.entryPaid || [],
        entryPendingPayments: t.switcheroo?.entryPendingPayments || [],
      };
    }

    const ok = window.confirm(
      `${unpaidEntryPlayers.length} player${unpaidEntryPlayers.length === 1 ? " has" : "s have"} not paid the entry fee. Start anyway and mark them as ADMIN COMP?`
    );
    if (!ok) return null;

    const existing = Array.isArray(t.switcheroo?.entryPaid)
      ? t.switcheroo.entryPaid
      : [];
    const nowIso = new Date().toISOString();
    const comped = unpaidEntryPlayers.map((player) => ({
      id: `admin-comp-${player.id}-${Date.now()}`,
      playerId: player.id,
      name: player.name,
      amount: 0,
      paidAt: nowIso,
      confirmedBy: admin?.username || "admin",
      comped: true,
    }));
    const entryPaid = [...existing, ...comped];
    const entryPendingPayments = (t.switcheroo?.entryPendingPayments || []).filter(
      (row) => !unpaidEntryPlayers.some(
        (player) => String(player.id) === String(row.playerId)
      )
    );

    save({
      ...t,
      switcheroo: {
        ...t.switcheroo,
        entryPaid,
        entryPendingPayments,
      },
    });

    return { entryPaid, entryPendingPayments };
  };

  const openSwitcherooDraw = () => {
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
    const unpaid = pool.filter((player) => !entryPaidIds.has(String(player.id)));
    const compResult = unpaid.length ? compUnpaidEntries() : null;
    if (unpaid.length && !compResult) return;

    const teamCount = pool.length / rosterSize;
    if (teamCount > 8) {
      toast.error("Switcheroo supports a maximum of 8 teams");
      return;
    }

    const initialTeams = Array.from({ length: teamCount }, (_, index) => ({
      id: globalThis.crypto?.randomUUID?.() || `switcheroo-1-${index}-${Date.now()}`,
      name: `Team ${teamLabels[index] || index + 1}`,
      seed: index + 1,
      roster: [],
      switcherooGeneration: 1,
    }));

    save({
      ...t,
      status: "setup",
      teams: [],
      bracket: [],
      champion: null,
      switcheroo: {
        ...t.switcheroo,
        entryPaid: compResult?.entryPaid || t.switcheroo?.entryPaid || [],
        entryPendingPayments:
          compResult?.entryPendingPayments || t.switcheroo?.entryPendingPayments || [],
        setupStage: "published",
        phase: "drawing",
        generation: 1,
        liveDraw: {
          generation: 1,
          teams: initialTeams,
          remaining: pool,
          drawIndex: 0,
          lastPlayer: null,
          targetTeamIndex: 0,
          complete: false,
        },
      },
    });

    setSwitcherooDraw({
      mode: "new",
      generation: 1,
      players: pool,
      presetTeams: null,
    });
  };

  const finalizeSwitcherooDraw = (teams) => {
    const reviewMinutes = Math.max(1, Number(t.switcheroo?.reviewMinutes || 5));
    const reviewEndsAt = new Date(Date.now() + reviewMinutes * 60 * 1000).toISOString();
    const economy = switcherooEconomyFor(
      t.switcheroo?.entryFee || 5,
      (t.switcheroo?.pool || []).length
    );

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
        setupStage: "published",
        generation: 1,
        liveDraw: null,
        reviewEndsAt,
        rerollBaseGoal: economy.baseGoal,
        rerollGoal: economy.baseGoal,
        rerollStep: economy.firstMargin,
        rerollStepGrowth: economy.marginGrowth,
        contributedTotal: 0,
        contributions: [],
        pendingPayments: [],
        rerollsUsed: 0,
      },
    });

    setSwitcherooDraw(null);
    toast.success("Switcheroo complete · review phase started");
  };

  const syncSwitcherooSpinStart = (spinState) => {
    if (!spinState || switcherooDraw?.mode !== "new") return;

    const currentLiveDraw = t.switcheroo?.liveDraw || {};
    save({
      ...t,
      status: "setup",
      switcheroo: {
        ...t.switcheroo,
        setupStage: "published",
        phase: "drawing",
        generation: 1,
        liveDraw: {
          ...currentLiveDraw,
          spinSignal: Number(currentLiveDraw.spinSignal || 0) + 1,
          spinning: true,
          pendingPlayerId: spinState.player?.id || null,
          targetTeamIndex: spinState.targetTeamIndex,
          spinStartedAt: new Date().toISOString(),
        },
      },
    });
  };

  const syncSwitcherooDrawProgress = (progressState) => {
    if (!progressState || switcherooDraw?.mode !== "new") return;

    save({
      ...t,
      status: "setup",
      switcheroo: {
        ...t.switcheroo,
        setupStage: "published",
        phase: "drawing",
        generation: 1,
        liveDraw: {
          generation: 1,
          teams: progressState.teams,
          remaining: progressState.remaining,
          drawIndex: progressState.drawIndex,
          lastPlayer: progressState.lastPlayer,
          targetTeamIndex: progressState.targetTeamIndex,
          complete: progressState.complete,
          spinSignal: Number(t.switcheroo?.liveDraw?.spinSignal || progressState.drawIndex || 0),
          spinning: false,
          pendingPlayerId: null,
        },
      },
    });
  };

  const reviewEntryPayment = async (paymentId, decision) => {
    if (!paymentId || !admin?.sessionToken || entryPaymentBusyId) return;
    setEntryPaymentBusyId(paymentId);
    try {
      const data = await reviewTourneyEntryPayment(paymentId, decision, admin.sessionToken);
      if (data?.tourney) setT(normalize(data.tourney));
      toast.success(
        decision === "confirm"
          ? "Tournament entry payment confirmed"
          : "Tournament entry payment rejected"
      );
    } catch (error) {
      toast.error(error?.message || "Unable to review tournament entry payment");
    } finally {
      setEntryPaymentBusyId("");
    }
  };

  const reviewPayment = async (paymentId, decision) => {
    if (!paymentId || !admin?.sessionToken || paymentBusyId) return;
    setPaymentBusyId(paymentId);
    try {
      const data = await reviewTourneyPayment(paymentId, decision, admin.sessionToken);
      if (data?.tourney) setT(normalize(data.tourney));
      if (data?.rerolled) {
        const next = normalize(data.tourney);
        setSwitcherooDraw({
          mode: "reveal",
          generation: Number(next?.switcheroo?.generation || 1),
          players: next?.switcheroo?.pool || [],
          presetTeams: next?.teams || [],
        });
        toast.success(
          `Goal reached · re-spin activated · next target €${Number(next?.switcheroo?.rerollGoal || 0)}`
        );
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
            {(t.status !== "setup" ||
              t.setupConfigured ||
              (t.teamBuild === "switcheroo" && switcherooSetupStage === "published")) && (
              <button
                type="button"
                onClick={() => setEditSetupOpen(true)}
                className={
                  "h-10 px-3 rounded-xl border flex items-center gap-2 text-xs font-black " +
                  (t.teamBuild === "switcheroo"
                    ? "border-[#FF4FA3]/30 bg-[#FF4FA3]/[0.07] text-[#FF9DCE]"
                    : "border-[#D5A33A]/25 bg-[#D5A33A]/[.06] text-[#D5A33A]")
                }
              >
                EDIT TOURNAMENT
              </button>
            )}
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

        {t.status === "setup" &&
          (
            t.teamBuild === "switcheroo"
              ? switcherooSetupStage === "settings"
              : !t.setupConfigured && !t.teams.length
          ) && (
            <section className="m8-panel rounded-[26px] p-3 sm:p-4">
              <TourneySetupWizard
                tournament={t}
                economy={switcherooEconomy}
                paymentsLocked={
                  (t.switcheroo?.entryPaid || []).length > 0 ||
                  (t.switcheroo?.entryPendingPayments || []).length > 0
                }
                onPatch={(value) => patch(value)}
                onPatchSwitcheroo={patchSwitcheroo}
                onChangeTeamBuild={changeTeamBuild}
                onFinish={finishSetupWizard}
              />
            </section>
          )}

        {editSetupOpen && (
          <div className="fixed inset-0 z-[240] bg-[#03050A]/90 backdrop-blur-xl overflow-y-auto p-3 sm:p-6">
            <div className="max-w-5xl mx-auto min-h-full flex items-center">
              <TourneySetupWizard
                tournament={t}
                economy={switcherooEconomy}
                paymentsLocked={
                  (t.switcheroo?.entryPaid || []).length > 0 ||
                  (t.switcheroo?.entryPendingPayments || []).length > 0
                }
                published
                onPatch={(value) => patch(value)}
                onPatchSwitcheroo={patchSwitcheroo}
                onChangeTeamBuild={changeTeamBuild}
                onFinish={finishSetupWizard}
                onClose={() => setEditSetupOpen(false)}
              />
            </div>
          </div>
        )}

        {t.teamBuild === "switcheroo" && t.status === "setup" && switcherooSetupStage === "settings" ? null : t.teamBuild === "switcheroo" ? (
          <>
          {t.status === "setup" && (
            <section className="m8-panel rounded-[22px] p-5 border border-[#FF4FA3]/20">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-4 border-b border-[#FF4FA3]/15">
                <div>
                  <div className="text-[9px] tracking-[.16em] text-[#FF4FA3] font-black">
                    {switcherooSetupStage === "published" ? "TOURNAMENT ONLINE" : "STEP 2 · PLAYER SELECTION"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {switcherooSetupStage === "published"
                      ? "The public MuchoTourney page is now showing the Switcheroo wheel."
                      : "Choose the players, verify entry payments, then publish the tournament."}
                  </div>
                </div>
                <div className="flex gap-2">
                  {switcherooSetupStage === "players" && (
                    <button
                      type="button"
                      onClick={() =>
                        save({
                          ...t,
                          switcheroo: { ...t.switcheroo, setupStage: "settings", phase: "idle" },
                        })
                      }
                      className="h-9 px-3 rounded-lg border border-[#2A303B] text-[9px] font-black"
                    >
                      BACK TO SETTINGS
                    </button>
                  )}
                  {switcherooSetupStage === "players" && (
                    <button
                      type="button"
                      onClick={publishSwitcheroo}
                      disabled={!switcherooStructureReady}
                      className="h-9 px-4 rounded-lg bg-[#FF4FA3] text-black text-[9px] font-black disabled:opacity-35"
                    >
                      PUBLISH TOURNAMENT
                    </button>
                  )}
                  {switcherooSetupStage === "published" && (
                    <span className="h-9 px-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 text-[9px] font-black flex items-center">
                      ● ONLINE
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-[9px] tracking-[.16em] text-[#FF4FA3] font-black">TOURNAMENT ENTRY</div>
                  <h2 className="font-display text-lg font-black mt-1">
                    €{Number(t.switcheroo.entryFee || 5)} per player
                  </h2>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {entryPaidIds.size}/{switcherooPoolSize} confirmed · starting re-spin goal €{switcherooEconomy.baseGoal}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-sm font-black text-[#FF8BC5]">
                    POT €{switcherooEconomy.entryPot}
                  </div>
                  {unpaidEntryPlayers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => compUnpaidEntries()}
                      className="h-8 px-3 rounded-lg border border-[#FF4FA3]/30 bg-[#FF4FA3]/10 text-[#FF8BC5] text-[9px] font-black"
                    >
                      ADMIN COMP {unpaidEntryPlayers.length}
                    </button>
                  )}
                </div>
              </div>

              {(t.switcheroo.entryPendingPayments || []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#FF4FA3]/15">
                  <div className="text-[9px] tracking-widest text-[#697181] mb-2">ENTRY PAYMENTS TO VERIFY</div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {t.switcheroo.entryPendingPayments.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.04] px-3 py-2 flex items-center gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black truncate">{row.name || "Player"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            Entry <span className="text-[#FF8BC5] font-black">€{row.amount}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={entryPaymentBusyId === row.id}
                          onClick={() => reviewEntryPayment(row.id, "reject")}
                          className="h-8 px-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-red-300 text-[9px] font-black disabled:opacity-40"
                        >
                          REJECT
                        </button>
                        <button
                          type="button"
                          disabled={entryPaymentBusyId === row.id}
                          onClick={() => reviewEntryPayment(row.id, "confirm")}
                          className="h-8 px-2.5 rounded-lg border border-[#FF4FA3]/30 bg-[#FF4FA3]/10 text-[#FF8BC5] text-[9px] font-black disabled:opacity-40"
                        >
                          CONFIRM PAID
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {switcherooSetupStage === "players" && t.status === "setup" ? (
            <TournamentPlayerPicker
              players={players || []}
              selected={t.switcheroo?.pool || []}
              paidIds={entryPaidIds}
              pendingIds={entryPendingIds}
              entryFee={Number(t.switcheroo?.entryFee || 5)}
              onChange={setSwitcherooPool}
            />
          ) : (
          <section className="grid lg:grid-cols-[430px_1fr] gap-3">
            <div className="m8-panel rounded-[22px] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shuffle size={17} className="text-[#FF4FA3]" />
                  <h2 className="font-display font-black text-[#FFD1E8]">Switcheroo Pool</h2>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {(t.switcheroo.pool || []).length} players
                </span>
              </div>

              {(t.status !== "setup" || switcherooSetupStage === "published") && (
              <div className="mt-4 rounded-2xl border border-[#FF4FA3]/20 bg-[#0B0F15] p-4">
                <SwitcherooWheel
                  players={t.switcheroo.pool || []}
                  disabled={!switcherooStructureReady && t.status === "setup"}
                  onActivate={() => {
                    if (t.status === "setup") {
                      openSwitcherooDraw();
                      return;
                    }
                    if (t.teams?.length) {
                      setSwitcherooDraw({
                        mode: "reveal",
                        generation: Number(t.switcheroo?.generation || 1),
                        players: t.switcheroo?.pool || [],
                        presetTeams: t.teams,
                      });
                    }
                  }}
                  label="SPIN"
                  hint={
                    t.status === "setup"
                      ? switcherooPoolReady
                        ? "All entry fees confirmed · click to open Switcheroo fullscreen"
                        : !switcherooStructureReady
                          ? `Select a valid ${t.format} pool first`
                          : `${unpaidEntryPlayers.length} unpaid · click to start with Admin Comp override`
                      : "Click to replay this Switcheroo fullscreen"
                  }
                  sizeClass="w-[250px] h-[250px] sm:w-[300px] sm:h-[300px]"
                />
              </div>
              )}

              <p className="text-[11px] text-muted-foreground mt-3">
                {switcherooSetupStage === "published"
                  ? "Tournament published. Start the live draw from the wheel when entries are ready."
                  : `Select the tournament players for ${t.format}. The wheel becomes public only after you publish the tournament.`}
              </p>

              <div className="mt-3 max-h-[430px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
                {(players || []).map((player) => {
                  const active = poolIds.has(String(player.id));
                  const paid = entryPaidIds.has(String(player.id));
                  const pending = entryPendingIds.has(String(player.id));
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => toggleSwitcherooPlayer(player)}
                      disabled={t.status !== "setup" || switcherooSetupStage !== "players"}
                      className={
                        "h-11 px-3 rounded-lg border text-left text-xs font-bold flex items-center justify-between gap-2 transition-all disabled:cursor-not-allowed " +
                        (active
                          ? "border-[#FF4FA3]/55 bg-[#FF4FA3]/[0.08] text-[#FFD1E8]"
                          : "border-[#252B36] bg-[#0D1219] hover:border-[#FF4FA3]/25")
                      }
                    >
                      <span className="truncate">{player.name}</span>
                      <span className="font-mono text-[9px] shrink-0">
                        {active
                          ? paid
                            ? "✓ PAID"
                            : pending
                              ? "PAYMENT PENDING"
                              : `€${Number(t.switcheroo.entryFee || 5)} DUE`
                          : player.currentElo + " ELO"}
                      </span>
                    </button>
                  );
                })}
              </div>

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
                      <div className="brand-kicker text-[#FF4FA3]">Switcheroo review</div>
                      <h2 className="font-display text-xl font-black mt-1">
                        Teams are provisional
                      </h2>
                      <p className="text-xs text-muted-foreground mt-1">
                        Players can fund a full re-spin from the public MuchoTourney page.
                      </p>
                    </div>
                    <div className="h-11 px-3 rounded-xl border border-[#2A303B] bg-[#111720] flex items-center gap-2">
                      <Clock3 size={15} className={reviewRemaining <= 30000 ? "text-magma" : "text-[#FF4FA3]"} />
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
                        <div>Re-spins completed: {Number(t.switcheroo.rerollsUsed || 0)}</div>
                        <div className="mt-0.5 text-[#FF4FA3]">
                          Next target after this: €{nextRerollGoal}
                        </div>
                      </div>
                    </div>

                    <div className="h-3 rounded-full bg-[#0B0F15] border border-[#252B36] overflow-hidden">
                      <motion.div
                        animate={{ width: switcherooProgress + "%" }}
                        className="h-full bg-[#FF4FA3]"
                      />
                    </div>

                    <div className="mt-3 text-[10px] text-muted-foreground">
                      {switcherooCanFund
                        ? `Reach €${Number(t.switcheroo.rerollGoal || 0)} before the timer ends to trigger a full re-spin. Then the target becomes €${nextRerollGoal}; after that €${afterNextRerollGoal} because the re-spin margin keeps increasing.`
                        : "Time is over: these teams are final and Switcheroo is closed."}
                    </div>
                  </div>

                  {(t.switcheroo.contributions || []).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#222834]">
                      <div className="text-[9px] tracking-widest text-[#697181] mb-2">LATEST CONTRIBUTIONS</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(t.switcheroo.contributions || []).slice(-8).reverse().map((row) => (
                          <span key={row.id || row.at} className="h-7 px-2 rounded-lg border border-[#2A303B] bg-[#111720] text-[10px] inline-flex items-center gap-1.5">
                            <strong>{row.name || "Player"}</strong>
                            <span className="text-[#FF4FA3]">+€{row.amount}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(t.switcheroo.pendingPayments || []).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#222834]">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-[9px] tracking-widest text-[#697181]">PAYPAL PAYMENTS TO VERIFY</div>
                        <span className="font-mono text-[9px] text-[#FF4FA3]">
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
                                Declared payment <span className="text-[#FF4FA3] font-black">€{row.amount}</span>
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
                    <div className="brand-kicker text-[#FF4FA3]">Generation {t.switcheroo.generation || 0}</div>
                    <h2 className="font-display font-black text-lg text-[#FFD1E8]">Switcheroo Teams</h2>
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
                      <div key={team.id} className="rounded-xl border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.045] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-black">
                            <span className="text-[#FF4FA3] mr-2">#{index + 1}</span>
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
          )}
          </>
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
        {switcherooDraw && (
          <SwitcherooDrawOverlay
            open
            players={switcherooDraw.players}
            format={t.format}
            generation={switcherooDraw.generation}
            presetTeams={switcherooDraw.presetTeams}
            title={switcherooDraw.mode === "new" ? "SWITCHEROO DRAW" : "RE-SWITCHEROO"}
            onProgress={
              switcherooDraw.mode === "new" ? syncSwitcherooDrawProgress : undefined
            }
            onSpinStart={
              switcherooDraw.mode === "new" ? syncSwitcherooSpinStart : undefined
            }
            onClose={() => {
              if (switcherooDraw.mode === "new") {
                save({
                  ...t,
                  status: "setup",
                  switcheroo: {
                    ...t.switcheroo,
                    setupStage: "published",
                    phase: "published",
                    liveDraw: null,
                  },
                });
              }
              setSwitcherooDraw(null);
            }}
            onComplete={(teams) => {
              if (switcherooDraw.mode === "new") {
                finalizeSwitcherooDraw(teams);
              } else {
                setSwitcherooDraw(null);
              }
            }}
          />
        )}
      </AnimatePresence>

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
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
