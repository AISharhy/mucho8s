import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, MerdaBadge, merdaSurfaceClass } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeContextStats, playerForContext } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import {
  analyzeManualTeams,
  draftTeamsByPriority,
} from "@/lib/chemistry";
import { mergeMatchHistory, computeMatchmakingRatings } from "@/lib/matchmakingHistory";
import { buildRivalries } from "@/lib/rivalries";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  Gamepad2,
  MapPinned,
  RotateCcw,
  Scale,
  Search,
  Shuffle,
  Swords,
  UsersRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  isUiSoundEnabled,
  playUiSound,
  setUiSoundEnabled,
} from "@/lib/uiAudio";
import { toast } from "sonner";

const MATCH_MODES = ["Hardpoint", "Search & Destroy", "CDL Mix"];

const COMPETITIVE_MAP_POOLS = {
  BO7: {
    "Search & Destroy": ["Den", "Frequency", "Gridlock", "Raid", "Scar", "Standoff", "Hacienda"],
    Hardpoint: ["Colossus", "Den", "Gridlock", "Frequency", "Scar", "Hacienda"],
  },
  BO6: {
    "Search & Destroy": ["Protocol", "Rewind", "Skyline", "Vault", "Hacienda", "Firing Range", "Fringe"],
    Hardpoint: ["Hacienda", "Protocol", "Red Card", "Skyline", "Vault"],
  },
  MW3: {
    "Search & Destroy": ["Highrise", "Invasion", "Karachi", "Rio", "6 Star", "Scrapyard"],
    Hardpoint: ["Sub Base", "Vista", "6 Star", "Karachi", "Rio"],
  },
  VG: {
    "Search & Destroy": ["Tuscan", "Berlin", "Bocage", "USS Texas", "Demyansk"],
    Hardpoint: ["Tuscan", "Gavutu", "Berlin", "Bocage"],
  },
  CW: {
    "Search & Destroy": ["Checkmate", "Moscow", "Raid", "Express", "Standoff", "Miami"],
    Hardpoint: ["Apocalypse", "Checkmate", "Garrison", "Moscow", "Raid"],
  },
  WW2: {
    Hardpoint: ["Ardennes Forest", "Gibraltar", "London Docks", "Sainte Marie du Mont"],
    "Search & Destroy": ["Ardennes Forest", "London Docks", "Sainte Marie du Mont", "USS Texas"],
  },
  BO2: {
    "Search & Destroy": ["Cargo", "Express", "Raid", "Slums", "Standoff", "Meltdown"],
    Hardpoint: ["Raid", "Standoff", "Slums", "Yemen"],
  },
};

const competitiveMapPool = (game, mode, format = "") => {
  let pool = mode === "CDL Mix"
    ? [
        ...(COMPETITIVE_MAP_POOLS?.[game]?.Hardpoint || []),
        ...(COMPETITIVE_MAP_POOLS?.[game]?.["Search & Destroy"] || []),
      ]
    : [...(COMPETITIVE_MAP_POOLS?.[game]?.[mode] || [])];

  if (game === "MW3" && ["Search & Destroy", "CDL Mix"].includes(mode) && format !== "2v2") {
    pool = pool.filter((map) => map !== "Scrapyard");
  }
  if (game === "CW" && ["Search & Destroy", "CDL Mix"].includes(mode) && format === "2v2") {
    pool = pool.filter((map) => map !== "Miami");
  }

  return [...new Set(pool)];
};

const mixRotationModes = (bestOf, startMode = "Hardpoint") => {
  const first = startMode === "Search & Destroy" ? "Search & Destroy" : "Hardpoint";
  const second = first === "Hardpoint" ? "Search & Destroy" : "Hardpoint";
  return Array.from({length: [3,5,7].includes(Number(bestOf)) ? Number(bestOf) : 3}, (_, index) => index % 2 ? second : first);
};

const buildRandomRotation = (game, mode, format, bestOf, mixStartMode = "Hardpoint", recentMaps = []) => {
  const count = [3,5,7].includes(Number(bestOf)) ? Number(bestOf) : 3;
  if (mode !== "CDL Mix") {
    const pool = competitiveMapPool(game, mode, format);
    const recent = new Set(recentMaps);
    const fresh = pool.filter((map) => !recent.has(map));
    const used = new Set();
    return Array.from({length:count}, () => {
      const unusedFresh = fresh.filter((map) => !used.has(map));
      const unusedAny = pool.filter((map) => !used.has(map) && !recent.has(map));
      const unusedFallback = pool.filter((map) => !used.has(map));
      const source = unusedFresh.length ? unusedFresh : unusedAny.length ? unusedAny : unusedFallback.length ? unusedFallback : pool;
      const map = source[Math.floor(Math.random() * source.length)] || "";
      if (map) used.add(map);
      return map;
    }).filter(Boolean);
  }

  const used = new Set();
  return mixRotationModes(count, mixStartMode).map((slotMode) => {
    const recent = new Set(recentMaps);
    const base = competitiveMapPool(game, slotMode, format);
    const fresh = base.filter((map) => !used.has(map) && !recent.has(map));
    const unused = base.filter((map) => !used.has(map));
    const source = fresh.length ? fresh : unused.length ? unused : base;
    const map = source[Math.floor(Math.random() * source.length)] || "";
    if (map) used.add(map);
    return map;
  });
};

const VALID_LOBBY_SIZES = [4, 6, 8];
const SNAKE_DRAFT_ORDER = ["A", "B", "B", "A"];

const formatForCount = (count) => {
  if (count === 4) return "2v2";
  if (count === 6) return "3v3";
  if (count === 8) return "4v4";
  return "";
};

const nextLobbySize = (count) => {
  if (count < 4) return 4;
  if (count === 5) return 6;
  if (count === 7) return 8;
  return null;
};

const averageElo = (team = []) =>
  team.length
    ? Math.round(
        team.reduce((sum, player) => sum + Number(player?.currentElo || 0), 0) /
          team.length
      )
    : 0;

const Metric = ({ label, value, tone = "" }) => (
  <div className="rounded-xl bg-[#0F1218] border border-[#222834] px-3 py-2.5">
    <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">{label}</div>
    <div className={`font-mono font-black text-lg mt-0.5 ${tone}`}>{value}</div>
  </div>
);

export default function TeamBuilder() {
  const navigate = useNavigate();
  const {
    players,
    matches,
    challenges,
    playerAvatars,
    discordPlayer,
    discordSession,
    signInWithDiscord,
    dashboardData,
    competitionData,
    isAdmin,
    createLiveMatch,
  } = useData();

  const [wizardStep, setWizardStep] = useState(1);
  const [game, setGame] = useState("");
  const [matchMode, setMatchMode] = useState("");
  const [mixStartMode, setMixStartMode] = useState("Hardpoint");
  const [bestOf, setBestOf] = useState(3);
  const [mapMode, setMapMode] = useState("random");
  const [manualMaps, setManualMaps] = useState([]);
  const [teamMethod, setTeamMethod] = useState("auto");
  const [autoPriority, setAutoPriority] = useState("mixed");
  const [draftCaptainMode, setDraftCaptainMode] = useState("auto");
  const [draftCaptainA, setDraftCaptainA] = useState("");
  const [draftCaptainB, setDraftCaptainB] = useState("");
  const [draftTeamA, setDraftTeamA] = useState([]);
  const [draftTeamB, setDraftTeamB] = useState([]);
  const [draftPickIndex, setDraftPickIndex] = useState(0);
  const [draftStarted, setDraftStarted] = useState(false);
  const [selected, setSelected] = useState([]);
  const [manualA, setManualA] = useState([]);
  const [manualB, setManualB] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [moneyPairings, setMoneyPairings] = useState([]);
  const [soundOn, setSoundOn] = useState(isUiSoundEnabled);

  const selectedCount = selected.length;
  const inferredFormat = formatForCount(selectedCount);
  const validLobby = VALID_LOBBY_SIZES.includes(selectedCount);
  const perTeam = validLobby ? selectedCount / 2 : 0;
  const nextSize = nextLobbySize(selectedCount);
  const mapPool = useMemo(
    () => competitiveMapPool(game, matchMode, inferredFormat || "4v4"),
    [game, matchMode, inferredFormat]
  );
  const mapPoolConfigured = mapPool.length > 0 && (matchMode !== "CDL Mix" || ["Hardpoint","Search & Destroy"].every(mode => competitiveMapPool(game, mode, inferredFormat || "4v4").length > 0));
  const manualMapSelectionValid =
    mapMode !== "manual" ||
    (
      manualMaps.length === bestOf &&
      manualMaps.every(Boolean) &&
      (bestOf === 7 || new Set(manualMaps).size === bestOf) &&
      manualMaps.every((map,index) => (matchMode === "CDL Mix" ? competitiveMapPool(game, mixRotationModes(bestOf,mixStartMode)[index], inferredFormat || "4v4") : mapPool).includes(map))
    );
  const setupValid = Boolean(game && matchMode && mapPoolConfigured && manualMapSelectionValid);

  const matchmakingHistory = useMemo(
    () => mergeMatchHistory(matches, competitionData?.archives || []),
    [matches, competitionData?.archives]
  );
  const historicalContext = useMemo(
    () => computeContextStats(matchmakingHistory, { game: game || "ALL", mode: matchMode || "ALL" }),
    [matchmakingHistory, game, matchMode]
  );
  const hiddenRatings = useMemo(
    () => computeMatchmakingRatings(historicalContext.matches),
    [historicalContext.matches]
  );

  const context = useMemo(
    () => computeContextStats(matches, { game: game || "ALL", mode: matchMode || "ALL" }),
    [matches, game, matchMode]
  );

  const onlinePlayerIds = useMemo(
    () =>
      new Set(
        (Array.isArray(dashboardData?.onlinePlayers) ? dashboardData.onlinePlayers : [])
          .map((row) => String(row?.player_id || "").trim())
          .filter(Boolean)
      ),
    [dashboardData?.onlinePlayers]
  );

  const contextualPlayerMap = useMemo(() => {
    const map = {};
    players.forEach((player) => {
      map[player.id] =
        game && matchMode
          ? playerForContext(player, context.stats || {})
          : player;
    });
    players.forEach((player) => {
      const hidden = hiddenRatings[player.id];
      if (hidden?.played) map[player.id] = { ...map[player.id], matchmakingRating: hidden.rating };
    });
    return map;
  }, [players, game, matchMode, context.stats, hiddenRatings]);

  const selectedPlayers = useMemo(
    () => selected.map((id) => contextualPlayerMap[id]).filter(Boolean),
    [selected, contextualPlayerMap]
  );

  const manualTeamA = useMemo(
    () => manualA.map((id) => contextualPlayerMap[id]).filter(Boolean),
    [manualA, contextualPlayerMap]
  );

  const manualTeamB = useMemo(
    () => manualB.map((id) => contextualPlayerMap[id]).filter(Boolean),
    [manualB, contextualPlayerMap]
  );

  const manualUnassigned = useMemo(
    () => selected.filter((id) => !manualA.includes(id) && !manualB.includes(id)),
    [selected, manualA, manualB]
  );

  const filtered = useMemo(
    () =>
      players.filter((player) =>
        player.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [players, query]
  );

  const autoDraftCaptains = useMemo(
    () =>
      [...selectedPlayers]
        .sort(
          (left, right) =>
            Number(right?.currentElo || 0) - Number(left?.currentElo || 0)
        )
        .slice(0, 2),
    [selectedPlayers]
  );

  const resolvedDraftCaptainA =
    draftCaptainMode === "auto" ? autoDraftCaptains[0]?.id || "" : draftCaptainA;
  const resolvedDraftCaptainB =
    draftCaptainMode === "auto" ? autoDraftCaptains[1]?.id || "" : draftCaptainB;

  const draftAvailable = useMemo(
    () =>
      selected.filter(
        (id) => !draftTeamA.includes(id) && !draftTeamB.includes(id)
      ),
    [selected, draftTeamA, draftTeamB]
  );

  const draftComplete =
    Boolean(validLobby) &&
    draftTeamA.length === perTeam &&
    draftTeamB.length === perTeam;

  const currentDraftSide =
    draftStarted && !draftComplete
      ? SNAKE_DRAFT_ORDER[draftPickIndex % SNAKE_DRAFT_ORDER.length]
      : "";

  const matchCaptainId = result && discordPlayer?.id &&
    [...result.teamA, ...result.teamB].some((player) => player.id === discordPlayer.id)
      ? discordPlayer.id
      : "";
  const matchCaptain = result
    ? [...result.teamA, ...result.teamB].find((player) => player.id === matchCaptainId) || null
    : null;
  const captainSide = result?.teamA?.some((player) => player.id === matchCaptainId)
    ? "A"
    : result?.teamB?.some((player) => player.id === matchCaptainId)
      ? "B"
      : "";
  const canConfirm = Boolean(
    result &&
    (isAdmin || matchCaptainId) &&
    mapPoolConfigured &&
    manualMapSelectionValid
  );

  const teamIntel = useMemo(() => {
    if (!result) return null;

    const teamAIds = new Set(result.teamA.map((player) => String(player.id)));
    const teamBIds = new Set(result.teamB.map((player) => String(player.id)));

    const exactRecord = (team) => {
      const ids = team.map((player) => String(player.id)).sort();
      let wins = 0;
      let losses = 0;

      (historicalContext.matches || []).forEach((match) => {
        const sideA = (match.teamA || []).map(String).sort();
        const sideB = (match.teamB || []).map(String).sort();
        const same = (left, right) =>
          left.length === right.length && left.every((id, index) => id === right[index]);

        if (same(sideA, ids)) {
          if (match.winner === "A") wins += 1;
          else losses += 1;
        } else if (same(sideB, ids)) {
          if (match.winner === "B") wins += 1;
          else losses += 1;
        }
      });

      return { wins, losses, played: wins + losses };
    };

    const rivalries = buildRivalries(historicalContext.matches || [], challenges || [])
      .filter((row) =>
        (teamAIds.has(String(row.playerAId)) && teamBIds.has(String(row.playerBId))) ||
        (teamAIds.has(String(row.playerBId)) && teamBIds.has(String(row.playerAId)))
      )
      .slice(0, 6);

    return {
      recordA: exactRecord(result.teamA),
      recordB: exactRecord(result.teamB),
      rivalries,
      avgEloGap: Math.abs(averageElo(result.teamA) - averageElo(result.teamB)),
    };
  }, [result, historicalContext.matches, challenges]);

  const clearDraftProgress = () => {
    setDraftTeamA([]);
    setDraftTeamB([]);
    setDraftPickIndex(0);
    setDraftStarted(false);
  };

  const resetCaptainDraft = () => {
    clearDraftProgress();
    setDraftCaptainA("");
    setDraftCaptainB("");
  };

  const resetLobby = ({ keepGame = true } = {}) => {
    setSelected([]);
    setManualA([]);
    setManualB([]);
    resetCaptainDraft();
    setResult(null);
    setQuery("");
    if (!keepGame) {
      setGame("");
      setMatchMode("");
    }
  };

  const changeGame = (nextGame) => {
    void playUiSound("select", "mucho8s");
    setGame(nextGame);
    setMatchMode("");
    setManualMaps([]);
    resetLobby({ keepGame: true });
  };

  const changeMatchMode = (nextMode) => {
    void playUiSound("select", "mucho8s");
    setMatchMode(nextMode);
    setManualMaps([]);
    resetLobby({ keepGame: true });
  };

  const changeBestOf = (value) => {
    void playUiSound("select", "mucho8s");
    const next = [3,5,7].includes(Number(value)) ? Number(value) : 3;
    setBestOf(next);
    setManualMaps((prev) => prev.slice(0, next));
    setResult(null);
  };

  const changeMapMode = (value) => {
    const next = value === "manual" ? "manual" : "random";
    setMapMode(next);
    if (next === "random") setManualMaps([]);
    setResult(null);
  };

  const changeManualMap = (index, value) => {
    setManualMaps((prev) => {
      const next = Array.from({ length: bestOf }, (_, slot) => prev[slot] || "");
      next[index] = value;
      return next;
    });
    setResult(null);
  };

  const startOver = () => {
    setWizardStep(1);
    setGame("");
    setMatchMode("");
    setMixStartMode("Hardpoint");
    setBestOf(3);
    setMapMode("random");
    setManualMaps([]);
    setTeamMethod("auto");
    setAutoPriority("mixed");
    setDraftCaptainMode("auto");
    resetLobby({ keepGame: false });
  };

  const changeTeamMethod = (nextMethod) => {
    void playUiSound("select", "mucho8s");
    setTeamMethod(nextMethod);
    setManualA([]);
    setManualB([]);
    if (nextMethod === "manual") setSelected([]);
    resetCaptainDraft();
    setResult(null);
  };

  const goWizardStep = (nextStep) => {
    const next = Math.max(1, Math.min(4, Number(nextStep) || 1));
    if (next === wizardStep) return;
    void playUiSound(next > wizardStep ? "next" : "back", "mucho8s");
    setWizardStep(next);
  };

  const togglePlayer = (id) => {
    setResult(null);
    resetCaptainDraft();

    setSelected((prev) => {
      if (prev.includes(id)) {
        setManualA((team) => team.filter((item) => item !== id));
        setManualB((team) => team.filter((item) => item !== id));
        return prev.filter((item) => item !== id);
      }

      if (prev.length >= 8) {
        toast.error("Maximum lobby size is 4v4");
        return prev;
      }

      return [...prev, id];
    });
  };

  const assignManual = (id, team) => {
    if (!selected.includes(id) || !validLobby) return;

    setResult(null);

    if (team === "A") {
      if (manualA.includes(id)) {
        setManualA((prev) => prev.filter((item) => item !== id));
        return;
      }
      if (manualA.length >= perTeam) {
        toast.error(`Alpha already has ${perTeam} players`);
        return;
      }
      setManualB((prev) => prev.filter((item) => item !== id));
      setManualA((prev) => [...prev, id]);
      return;
    }

    if (manualB.includes(id)) {
      setManualB((prev) => prev.filter((item) => item !== id));
      return;
    }
    if (manualB.length >= perTeam) {
      toast.error(`Bravo already has ${perTeam} players`);
      return;
    }
    setManualA((prev) => prev.filter((item) => item !== id));
    setManualB((prev) => [...prev, id]);
  };

  const assignManualDirect = (id, side) => {
    setResult(null);
    resetCaptainDraft();

    const inA = manualA.includes(id);
    const inB = manualB.includes(id);
    const onTarget = side === "A" ? inA : inB;
    const targetCount = side === "A" ? manualA.length : manualB.length;

    // Clicking the current side again removes the player from the manual lobby.
    if (onTarget) {
      setManualA((prev) => prev.filter((item) => item !== id));
      setManualB((prev) => prev.filter((item) => item !== id));
      setSelected((prev) => prev.filter((item) => item !== id));
      return;
    }

    if (targetCount >= 4) {
      toast.error(side === "A" ? "Alpha is already full" : "Bravo is already full");
      return;
    }

    const alreadySelected = selected.includes(id);
    if (!alreadySelected && selected.length >= 8) {
      toast.error("Maximum lobby size is 4v4");
      return;
    }

    setManualA((prev) =>
      side === "A"
        ? [...prev.filter((item) => item !== id), id]
        : prev.filter((item) => item !== id)
    );
    setManualB((prev) =>
      side === "B"
        ? [...prev.filter((item) => item !== id), id]
        : prev.filter((item) => item !== id)
    );
    if (!alreadySelected) setSelected((prev) => [...prev, id]);
  };

  const changeDraftCaptainMode = (mode) => {
    setDraftCaptainMode(mode);
    clearDraftProgress();
    setResult(null);
  };

  const startCaptainDraft = () => {
    if (!validLobby) {
      toast.error("Select exactly 4, 6 or 8 players first");
      return;
    }

    const captainAId = resolvedDraftCaptainA;
    const captainBId = resolvedDraftCaptainB;

    if (!captainAId || !captainBId || captainAId === captainBId) {
      toast.error("Choose two different draft captains");
      return;
    }
    if (!selected.includes(captainAId) || !selected.includes(captainBId)) {
      toast.error("Draft captains must be inside the lobby");
      return;
    }

    setResult(null);
    setDraftTeamA([captainAId]);
    setDraftTeamB([captainBId]);
    setDraftPickIndex(0);
    setDraftStarted(true);
  };

  const pickDraftPlayer = (id) => {
    if (!draftStarted || draftComplete || !draftAvailable.includes(id)) return;

    const side = currentDraftSide;
    const nextA = side === "A" ? [...draftTeamA, id] : [...draftTeamA];
    const nextB = side === "B" ? [...draftTeamB, id] : [...draftTeamB];
    const nextIndex = draftPickIndex + 1;

    setDraftTeamA(nextA);
    setDraftTeamB(nextB);
    setDraftPickIndex(nextIndex);

    const complete = nextA.length === perTeam && nextB.length === perTeam;
    if (!complete) return;

    const teamAPlayers = nextA
      .map((playerId) => contextualPlayerMap[playerId])
      .filter(Boolean);
    const teamBPlayers = nextB
      .map((playerId) => contextualPlayerMap[playerId])
      .filter(Boolean);

    const analysis = analyzeManualTeams(teamAPlayers, teamBPlayers, historicalContext.matches);
    void lockResult(
      analysis
        ? {
            ...analysis,
            teamMethod: "draft",
            draftCaptains: {
              A: resolvedDraftCaptainA,
              B: resolvedDraftCaptainB,
            },
          }
        : null
    );
  };

  const lockResult = async (draft) => {
    if (!draft) {
      toast.error("Unable to create these teams");
      return;
    }

    const creatorId = String(discordPlayer?.id || "");
    const creatorOnA = draft.teamA.some((player) => player.id === creatorId);
    const creatorOnB = draft.teamB.some((player) => player.id === creatorId);

    if (!isAdmin && !creatorOnA && !creatorOnB) {
      toast.error("The match creator must be one of the players in the lobby");
      return;
    }

    const finalFormat = formatForCount(draft.teamA.length + draft.teamB.length);
    const finalPool = competitiveMapPool(game, matchMode, finalFormat);
    if (!finalPool.length || (matchMode === "CDL Mix" && !["Hardpoint","Search & Destroy"].every(mode => competitiveMapPool(game,mode,finalFormat).length))) {
      toast.error(`No BO${bestOf} competitive map pool is available for this setup`);
      setWizardStep(1);
      return;
    }
    if (
      mapMode === "manual" &&
      (
        manualMaps.length !== bestOf ||
        (bestOf !== 7 && new Set(manualMaps).size !== bestOf) ||
        manualMaps.some((map,index) => !(matchMode === "CDL Mix" ? competitiveMapPool(game,mixRotationModes(bestOf,mixStartMode)[index],finalFormat) : finalPool).includes(map))
      )
    ) {
      toast.error("One or more manual maps are not valid for the selected lobby format");
      setWizardStep(1);
      return;
    }

    const draftPairings = (Array.isArray(draft.pairings) ? draft.pairings : []).map((pair, index) => {
      const playerAId = pair.playerA?.id || pair.playerAId || draft.teamA[index]?.id || "";
      const playerBId = pair.playerB?.id || pair.playerBId || draft.teamB[index]?.id || "";
      return {
        playerAId,
        playerBId,
        amount: 5,
        platform: "paypal",
      };
    });
    setMoneyPairings(draftPairings);
    setResult(draft);
    void playUiSound("confirm", "mucho8s");
    setWizardStep(4);

    toast.success(
      `${finalFormat} teams ready · review and confirm`
    );
  };

  const randomizeReviewTeams = () => {
    if (!result?.teamA?.length || !result?.teamB?.length) return;

    const currentSignature = [
      result.teamA.map((player) => String(player.id)).sort().join(","),
      result.teamB.map((player) => String(player.id)).sort().join(","),
    ]
      .sort()
      .join("|");

    const pool = [...result.teamA, ...result.teamB];
    const teamSize = result.teamA.length;
    let nextPool = [...pool];
    let nextA = [];
    let nextB = [];

    for (let attempt = 0; attempt < 12; attempt += 1) {
      nextPool = [...pool];
      for (let index = nextPool.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [nextPool[index], nextPool[swapIndex]] = [nextPool[swapIndex], nextPool[index]];
      }

      nextA = nextPool.slice(0, teamSize);
      nextB = nextPool.slice(teamSize);
      const signature = [
        nextA.map((player) => String(player.id)).sort().join(","),
        nextB.map((player) => String(player.id)).sort().join(","),
      ]
        .sort()
        .join("|");

      if (signature !== currentSignature || pool.length <= 2) break;
    }

    const analysis = analyzeManualTeams(nextA, nextB, historicalContext.matches || []);
    if (!analysis) {
      toast.error("Unable to randomize these teams");
      return;
    }

    const nextPairings = (analysis.pairings || []).map((pair, index) => {
      const previous = moneyPairings[index] || {};
      return {
        playerAId: pair.playerA?.id || pair.playerAId || nextA[index]?.id || "",
        playerBId: pair.playerB?.id || pair.playerBId || nextB[index]?.id || "",
        amount: previous.amount ?? 5,
        platform: previous.platform || "paypal",
      };
    });

    setMoneyPairings(nextPairings);
    setResult({
      ...analysis,
      teamMethod: "random",
      draftCaptains: null,
    });

    void playUiSound("select", "mucho8s");
    toast.success("Teams randomized");
  };

  const updateReviewPairingOpponent = (rowIndex, nextPlayerBId) => {
    setMoneyPairings((prev) => {
      const current = prev[rowIndex];
      if (!current) return prev;
      const occupiedIndex = prev.findIndex(
        (row, index) => index !== rowIndex && String(row.playerBId) === String(nextPlayerBId)
      );
      return prev.map((row, index) => {
        if (index === rowIndex) return { ...row, playerBId: nextPlayerBId };
        if (index === occupiedIndex) return { ...row, playerBId: current.playerBId };
        return row;
      });
    });
  };

  const recentComparableMaps = useMemo(() => {
    const sameCompetition = [...(matches || [])]
      .filter((match) => match?.game === game && match?.mode === matchMode && Array.isArray(match?.maps) && match.maps.length)
      .sort((a,b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime());
    return sameCompetition[0]?.maps || [];
  }, [matches, game, matchMode]);

  const confirmMatch = async () => {
    if (!result || confirmBusy) return;

    if (!canConfirm) {
      toast.error("Only the match creator or Admin can confirm this match");
      return;
    }

    const pairings = moneyPairings.map((pair) => ({
      playerAId: pair.playerAId,
      playerBId: pair.playerBId,
      amount: Math.max(0, Number(pair.amount) || 0),
      platform: Number(pair.amount) > 0 ? pair.platform : "free",
    }));

    const invalidMoneySetup = pairings.some((pair) =>
      !pair.playerAId ||
      !pair.playerBId ||
      (pair.amount > 0 && !["paypal", "revolut"].includes(pair.platform))
    );
    if (!pairings.length || invalidMoneySetup) {
      toast.error("Check the Money Chall setup before going live");
      return;
    }

    setConfirmBusy(true);
    const created = await createLiveMatch({
      teamA: result.teamA.map((player) => player.id),
      teamB: result.teamB.map((player) => player.id),
      game,
      mode: matchMode,
      format: formatForCount(result.teamA.length + result.teamB.length),
      bestOf,
      maps: mapMode === "manual"
        ? manualMaps
        : buildRandomRotation(game, matchMode, formatForCount(result.teamA.length + result.teamB.length), bestOf, mixStartMode, recentComparableMaps),
      mapModes: matchMode === "CDL Mix" ? mixRotationModes(bestOf, mixStartMode) : undefined,
      pairings,
    });
    setConfirmBusy(false);

    if (!created) return;

    toast.success(
      mapMode === "manual"
        ? `Mucho8s confirmed — manual BO${bestOf} rotation locked`
        : `Mucho8s confirmed — random BO${bestOf} maps generated`
    );
    navigate(`/matches/live/${created.id}`);
  };

  const generateTeams = () => {
    if (!game) {
      toast.error("Select the game first");
      return;
    }
    if (!matchMode) {
      toast.error("Select the mode first");
      return;
    }
    if (!validLobby) {
      toast.error("Select exactly 4, 6 or 8 players");
      return;
    }

    if (teamMethod === "manual") {
      if (manualA.length !== perTeam || manualB.length !== perTeam) {
        toast.error(`Assign exactly ${perTeam} players to Alpha and ${perTeam} to Bravo`);
        return;
      }
      void lockResult(analyzeManualTeams(manualTeamA, manualTeamB, historicalContext.matches));
      return;
    }

    if (teamMethod === "draft") {
      startCaptainDraft();
      return;
    }

    void lockResult(
      draftTeamsByPriority(selectedPlayers, historicalContext.matches, autoPriority)
    );
  };

  if (!isAdmin && !discordSession) {
    return (
      <div className="m8-page-stack gap-3">
        <section className="m8-panel rounded-[22px] p-8 sm:p-10 max-w-2xl mx-auto w-full text-center">
          <div className="w-14 h-14 rounded-2xl border border-magma/25 bg-magma/[0.06] flex items-center justify-center mx-auto">
            <Gamepad2 size={25} className="text-magma" />
          </div>
          <div className="brand-kicker mt-5 mb-1 text-magma">Play · Mucho8s</div>
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">
            Connect Discord to play
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            You can browse Mucho8s as a guest, but creating a live match requires a Discord account linked to an active player.
          </p>
          <Button
            type="button"
            onClick={() => void signInWithDiscord()}
            className="mt-6 h-11 px-6 bg-magma hover:bg-[#ff3c4c] text-white font-black rounded-xl"
            data-testid="team-builder-discord-gate"
          >
            CONNECT DISCORD
          </Button>
        </section>
      </div>
    );
  }

  if (!isAdmin && discordSession && !discordPlayer) {
    return (
      <div className="m8-page-stack gap-3">
        <section className="m8-panel rounded-[22px] p-8 sm:p-10 max-w-2xl mx-auto w-full text-center">
          <div className="w-14 h-14 rounded-2xl border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] flex items-center justify-center mx-auto">
            <UsersRound size={25} className="text-[#D5A33A]" />
          </div>
          <div className="brand-kicker mt-5 mb-1 text-[#D5A33A]">Discord connected</div>
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">
            Link your player to play
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Complete the player-link request shown on screen. Mucho8s unlocks as soon as your Discord account is linked to an active player.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="m8-page-stack gap-3">
      <section className="m8-panel rounded-[22px] p-4 sm:p-5 max-w-6xl mx-auto w-full" data-testid="mucho8s-wizard">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#222834]">
          <div>
            <div className="brand-kicker mb-1">Play · Mucho8s</div>
            <h2 className="font-display text-2xl font-black tracking-[-0.03em]">
              Create Match
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              One step at a time. Your previous choices stay saved when you go back.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = setUiSoundEnabled(!soundOn);
                setSoundOn(next);
              }}
              className="h-9 px-2.5 rounded-xl border border-[#FF2A3B]/20 bg-[#FF2A3B]/[0.05] text-[#FF6B77] text-[9px] font-black inline-flex items-center gap-1.5"
              title={soundOn ? "UI sounds on" : "UI sounds off"}
            >
              {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {soundOn ? "SOUND" : "MUTED"}
            </button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void playUiSound("back", "mucho8s");
                startOver();
              }}
              className="h-9 px-3 border border-[#222834] bg-[#0F1218] text-xs"
            >
              <RotateCcw size={14} className="mr-1.5" />
              Start over
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 py-4">
          {[
            [1, "Setup"],
            [2, "Teams"],
            [3, "Lobby"],
            [4, "Review"],
          ].map(([step, label]) => {
            const active = wizardStep === step;
            const done = wizardStep > step;
            return (
              <div key={step} className="min-w-0">
                <div
                  className={
                    "h-1 rounded-full mb-2 " +
                    (active ? "bg-[#FF2A3B]" : done ? "bg-[#9E1D2A]" : "bg-[#242A35]")
                  }
                />
                <div
                  className={
                    "text-[9px] sm:text-[10px] uppercase tracking-[0.14em] font-black truncate " +
                    (active ? "text-[#FF6B77]" : done ? "text-[#C43A47]" : "text-[#606978]")
                  }
                >
                  {step}. {label}
                </div>
              </div>
            );
          })}
        </div>

        {wizardStep === 1 && (
          <div className="rounded-2xl border border-[#FF2A3B]/20 bg-[linear-gradient(135deg,#0D1117_0%,#120D11_64%,#1B0B10_100%)] p-4 sm:p-5 shadow-[0_18px_48px_rgba(255,42,59,.035)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl border border-[#FF2A3B]/45 bg-[#FF2A3B] text-white flex items-center justify-center font-black shadow-[0_0_24px_rgba(255,42,59,.16)]">1</span>
              <div>
                <div className="font-display font-black text-lg">Match setup</div>
                <div className="text-xs text-muted-foreground">Choose the basic rules, then continue.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="text-[10px] uppercase tracking-widest text-[#697181]">Game</span>
                <select
                  value={game}
                  onChange={(event) => changeGame(event.target.value)}
                  className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"
                  data-testid="wizard-game-select"
                >
                  <option value="">Choose game...</option>
                  {GAMES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-[10px] uppercase tracking-widest text-[#697181]">Mode</span>
                <select
                  value={matchMode}
                  onChange={(event) => changeMatchMode(event.target.value)}
                  disabled={!game}
                  className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold disabled:opacity-40"
                  data-testid="wizard-mode-select"
                >
                  <option value="">Choose mode...</option>
                  {MATCH_MODES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-[10px] uppercase tracking-widest text-[#697181]">Series</span>
                <select
                  value={bestOf}
                  onChange={(event) => changeBestOf(event.target.value)}
                  disabled={!matchMode}
                  className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold disabled:opacity-40"
                  data-testid="wizard-series-select"
                >
                  <option value={3}>BO3 · first to 2</option>
                  <option value={5}>BO5 · first to 3</option>
                  <option value={7}>BO7 · first to 4</option>
                </select>
              </label>

              {matchMode === "CDL Mix" && (
                <label>
                  <span className="text-[10px] uppercase tracking-widest text-[#697181]">Starting Mode</span>
                  <select
                    value={mixStartMode}
                    onChange={(event) => {
                      setMixStartMode(event.target.value === "Search & Destroy" ? "Search & Destroy" : "Hardpoint");
                      setManualMaps([]);
                      setResult(null);
                    }}
                    className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"
                    data-testid="wizard-mix-start-mode"
                  >
                    <option value="Hardpoint">HP Start · HP → S&D → HP</option>
                    <option value="Search & Destroy">S&D Start · S&D → HP → S&D</option>
                  </select>
                </label>
              )}

              <label>
                <span className="text-[10px] uppercase tracking-widest text-[#697181]">Map rotation</span>
                <select
                  value={mapMode}
                  onChange={(event) => changeMapMode(event.target.value)}
                  disabled={!matchMode}
                  className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold disabled:opacity-40"
                  data-testid="wizard-map-mode-select"
                >
                  <option value="random">Random competitive maps</option>
                  <option value="manual">Choose maps manually</option>
                </select>
              </label>
            </div>

            {game && matchMode && (
              <div className="mt-4 rounded-xl border border-[#222834] bg-[#10151D] p-3">
                <div className="flex items-center gap-2">
                  {mapMode === "random" ? (
                    <Shuffle size={15} className="text-[#A96DFF]" />
                  ) : (
                    <MapPinned size={15} className="text-[#D5A33A]" />
                  )}
                  <div className="text-xs font-bold">
                    {mapMode === "random" ? "Random rotation" : "Manual rotation"}
                  </div>
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {mapPool.length} maps in pool
                  </span>
                </div>

                {mapMode === "random" ? (
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {matchMode === "CDL Mix"
                      ? `CDL rotation: ${mixRotationModes(bestOf, mixStartMode).map((mode) => mode === "Hardpoint" ? "HP" : "S&D").join(" → ")}. Each slot draws a map from its own competitive pool.`
                      : `The system will draw ${bestOf} unique maps from the competitive pool when the match goes live.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                    {Array.from({ length: bestOf }, (_, index) => (
                      <label key={index}>
                        <span className="text-[10px] text-muted-foreground">Map {index + 1}</span>
                        <select
                          value={manualMaps[index] || ""}
                          onChange={(event) => changeManualMap(index, event.target.value)}
                          className="mt-1 w-full h-10 rounded-lg bg-[#151923] border border-[#2A303B] px-2.5 text-xs font-semibold"
                          data-testid={"manual-map-" + index}
                        >
                          <option value="">Choose map...</option>
                          {mapPool
                            .filter((mapName) => (bestOf === 7 || !manualMaps.includes(mapName) || manualMaps[index] === mapName) && (matchMode !== "CDL Mix" || competitiveMapPool(game,mixRotationModes(bestOf,mixStartMode)[index],inferredFormat || "4v4").includes(mapName)))
                            .map((mapName) => (
                              <option key={mapName} value={mapName}>{mapName}</option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}

                {!mapPoolConfigured && (
                  <div className="mt-3 text-[11px] text-orange-300">
                    This game/mode does not currently have enough competitive maps for BO{bestOf}.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <Button
                type="button"
                onClick={() => goWizardStep(2)}
                disabled={!setupValid}
                className="h-11 px-5 bg-[#FF2A3B] hover:bg-[#FF4352] text-white font-black rounded-xl shadow-[0_10px_30px_rgba(255,42,59,.12)]"
              >
                Continue
                <ArrowRight size={15} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="rounded-2xl border border-[#FF2A3B]/20 bg-[linear-gradient(135deg,#0D1117_0%,#120D11_64%,#1B0B10_100%)] p-4 sm:p-5 shadow-[0_18px_48px_rgba(255,42,59,.035)]">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-9 h-9 rounded-xl border border-[#FF2A3B]/45 bg-[#FF2A3B] text-white flex items-center justify-center font-black shadow-[0_0_24px_rgba(255,42,59,.16)]">2</span>
              <div>
                <div className="font-display font-black text-lg">Team method</div>
                <div className="text-xs text-muted-foreground">Keep it simple: choose how the teams should be built.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label>
                <span className="text-[10px] uppercase tracking-widest text-[#697181]">Build method</span>
                <select
                  value={teamMethod}
                  onChange={(event) => changeTeamMethod(event.target.value)}
                  className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"
                  data-testid="wizard-team-method"
                >
                  <option value="auto">Auto Balance</option>
                  <option value="draft">Captain Draft</option>
                  <option value="manual">Manual teams</option>
                </select>
              </label>

              {teamMethod === "auto" && (
                <label>
                  <span className="text-[10px] uppercase tracking-widest text-[#697181]">Balance priority</span>
                  <select
                    value={autoPriority}
                    onChange={(event) => {
                      setAutoPriority(event.target.value);
                      setResult(null);
                    }}
                    className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"
                  >
                    <option value="mixed">Mixed · Default</option>
                    <option value="elo">Elo</option>
                    <option value="chemistry">Chemistry</option>
                    <option value="recent">Recent Form</option>
                    <option value="freshness">Freshness</option>
                    <option value="random">Random Balanced</option>
                  </select>
                </label>
              )}

              {teamMethod === "draft" && (
                <label>
                  <span className="text-[10px] uppercase tracking-widest text-[#697181]">Draft captains</span>
                  <select
                    value={draftCaptainMode}
                    onChange={(event) => changeDraftCaptainMode(event.target.value)}
                    className="mt-1 w-full h-11 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm font-semibold"
                  >
                    <option value="auto">Auto · highest Elo</option>
                    <option value="manual">Choose manually</option>
                  </select>
                </label>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-[#222834] bg-[#10151D] px-3 py-3 flex items-start gap-3">
              {teamMethod === "auto" ? (
                <Scale size={17} className="text-emerald-400 mt-0.5" />
              ) : teamMethod === "draft" ? (
                <Crown size={17} className="text-[#D5A33A] mt-0.5" />
              ) : (
                <UsersRound size={17} className="text-[#65D5D3] mt-0.5" />
              )}
              <div>
                <div className="text-xs font-bold">
                  {teamMethod === "auto"
                    ? "Automatic balanced teams"
                    : teamMethod === "draft"
                      ? "Snake draft · A → B → B → A"
                      : "Full manual control"}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {teamMethod === "auto"
                    ? (
                        autoPriority === "mixed"
                          ? "Mixed · 50% Elo balance · 30% Chemistry · 20% Recent Form."
                          : autoPriority === "elo"
                            ? "Elo · prioritizes the smallest possible team strength difference."
                            : autoPriority === "chemistry"
                              ? "Chemistry · prioritizes teammates who historically perform well together."
                              : autoPriority === "recent"
                                ? "Recent Form · balances the last 10 matches, current win rate and streak."
                                : autoPriority === "freshness"
                                  ? "Freshness · avoids recently repeated teammates and opponent matchups."
                                  : "Random Balanced · creates a varied split but blocks clearly unbalanced teams."
                      )
                    : teamMethod === "draft"
                      ? "Two captains build the teams from the selected lobby."
                      : "You assign every selected player to Alpha or Bravo yourself."}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 mt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => goWizardStep(1)}
                className="h-10 px-3 border border-[#2A303B]"
              >
                <ArrowLeft size={15} className="mr-1.5" />
                Back
              </Button>

              <Button
                type="button"
                onClick={() => goWizardStep(3)}
                className="h-11 px-5 bg-[#FF2A3B] hover:bg-[#FF4352] text-white font-black rounded-xl shadow-[0_10px_30px_rgba(255,42,59,.12)]"
              >
                Select players
                <ArrowRight size={15} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {wizardStep === 3 && (
          <div className="rounded-2xl border border-[#FF2A3B]/20 bg-[linear-gradient(135deg,#0D1117_0%,#120D11_64%,#1B0B10_100%)] p-4 sm:p-5 shadow-[0_18px_48px_rgba(255,42,59,.035)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl border border-[#FF2A3B]/45 bg-[#FF2A3B] text-white flex items-center justify-center font-black shadow-[0_0_24px_rgba(255,42,59,.16)]">3</span>
                <div>
                  <div className="font-display font-black text-lg">Lobby</div>
                  <div className="text-xs text-muted-foreground">
                    {teamMethod === "manual"
                      ? "Assign players directly to Alpha or Bravo."
                      : "Check the players you want in the match."}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {inferredFormat && (
                  <span className="m8-pill text-emerald-400 border-emerald-500/25">
                    {inferredFormat}
                  </span>
                )}
                <span className="font-mono text-sm font-black text-[#D5A33A]">{selectedCount}/8</span>
              </div>
            </div>

            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search player..."
                className="h-10 pl-9 bg-[#151923] border-[#2A303B] rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-[350px] overflow-y-auto pr-1">
              {filtered.map((player) => {
                const active = selected.includes(player.id);
                const inAlpha = manualA.includes(player.id);
                const inBravo = manualB.includes(player.id);

                if (teamMethod === "manual") {
                  return (
                    <div
                      key={player.id}
                      className={
                        "min-h-[56px] rounded-xl border px-3 py-2 flex items-center gap-3 transition-all " +
                        (inAlpha
                          ? "border-magma/40 bg-magma/[0.06]"
                          : inBravo
                            ? "border-[#65D5D3]/40 bg-[#65D5D3]/[0.06]"
                            : "border-[#222834] bg-[#10151D] hover:border-[#353D49]") +
                        " " +
                        merdaSurfaceClass(player.merdaCount)
                      }
                    >
                      <PlayerAvatar
                        name={player.name}
                        elo={player.currentElo}
                        size={30}
                        avatarUrl={playerAvatars[player.id]}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate flex items-center gap-2">
                          <span className="truncate">{player.name}</span>
                          <MerdaBadge count={player.merdaCount} compact />
                          {onlinePlayerIds.has(String(player.id)) && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Online" />
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {player.currentElo} Elo
                          {inAlpha ? " · Alpha" : inBravo ? " · Bravo" : ""}
                          {onlinePlayerIds.has(String(player.id)) ? " · Online" : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => assignManualDirect(player.id, "A")}
                          disabled={!inAlpha && manualA.length >= 4}
                          className={
                            "w-9 h-9 rounded-lg border text-[11px] font-black transition-all " +
                            (inAlpha
                              ? "border-magma bg-magma text-white shadow-[0_0_18px_rgba(255,42,59,.18)]"
                              : "border-magma/30 bg-magma/[0.05] text-magma hover:bg-magma/[0.12]") +
                            " disabled:opacity-20 disabled:cursor-not-allowed"
                          }
                          title={inAlpha ? "Remove from Alpha" : "Assign to Alpha"}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => assignManualDirect(player.id, "B")}
                          disabled={!inBravo && manualB.length >= 4}
                          className={
                            "w-9 h-9 rounded-lg border text-[11px] font-black transition-all " +
                            (inBravo
                              ? "border-[#65D5D3] bg-[#65D5D3] text-[#071012] shadow-[0_0_18px_rgba(101,213,211,.14)]"
                              : "border-[#65D5D3]/30 bg-[#65D5D3]/[0.05] text-[#65D5D3] hover:bg-[#65D5D3]/[0.12]") +
                            " disabled:opacity-20 disabled:cursor-not-allowed"
                          }
                          title={inBravo ? "Remove from Bravo" : "Assign to Bravo"}
                        >
                          B
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <label
                    key={player.id}
                    className={
                      "min-h-[50px] rounded-xl border px-3 py-2 flex items-center gap-3 cursor-pointer transition-all " +
                      (active
                        ? "border-white/25 bg-white/[0.05]"
                        : "border-[#222834] bg-[#10151D] hover:border-[#353D49]") +
                      " " +
                      merdaSurfaceClass(player.merdaCount)
                    }
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => togglePlayer(player.id)}
                      className="w-4 h-4 accent-white shrink-0"
                    />
                    <PlayerAvatar
                      name={player.name}
                      elo={player.currentElo}
                      size={30}
                      avatarUrl={playerAvatars[player.id]}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate flex items-center gap-2">
                        <span className="truncate">{player.name}</span>
                        <MerdaBadge count={player.merdaCount} compact />
                        {onlinePlayerIds.has(String(player.id)) && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Online" />
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {player.currentElo} Elo{onlinePlayerIds.has(String(player.id)) ? " · Online" : ""}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 rounded-xl border border-[#222834] bg-[#10151D] px-3 py-2.5 text-[11px] text-muted-foreground">
              {teamMethod === "manual" ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Alpha <strong className="text-magma">{manualA.length}</strong>
                    <span className="mx-2 text-white/20">·</span>
                    Bravo <strong className="text-[#65D5D3]">{manualB.length}</strong>
                    <span className="mx-2 text-white/20">·</span>
                    {validLobby && manualA.length === manualB.length
                      ? inferredFormat + " ready"
                      : "Teams must have the same number of players"}
                  </span>
                  {(manualA.length > 0 || manualB.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setSelected([]);
                        setManualA([]);
                        setManualB([]);
                      }}
                      className="h-7 px-2 rounded-md border border-[#2A303B] bg-[#11151C] text-[9px] font-bold hover:text-white transition-colors inline-flex items-center gap-1"
                    >
                      <RotateCcw size={10} />
                      Reset
                    </button>
                  )}
                </div>
              ) : validLobby
                ? inferredFormat + " ready. You can build the teams now or select more players for a larger lobby."
                : nextSize
                  ? "Select " + (nextSize - selectedCount) + " more player" + (nextSize - selectedCount === 1 ? "" : "s") + " for " + formatForCount(nextSize) + "."
                  : "Maximum lobby size reached."}
            </div>

            {teamMethod === "draft" && validLobby && (
              <div className="mt-4 pt-4 border-t border-[#222834]">
                {!draftStarted ? (
                  <>
                    <div className="text-[10px] uppercase tracking-widest text-[#697181] mb-2">Draft captains</div>

                    {draftCaptainMode === "auto" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl border border-[#222834] bg-[#10151D] px-3 py-3">
                          <div className="text-[9px] text-magma uppercase tracking-widest mb-1">Alpha captain</div>
                          <div className="font-semibold text-sm">{autoDraftCaptains[0]?.name || "—"}</div>
                        </div>
                        <div className="rounded-xl border border-[#222834] bg-[#10151D] px-3 py-3">
                          <div className="text-[9px] text-[#65D5D3] uppercase tracking-widest mb-1">Bravo captain</div>
                          <div className="font-semibold text-sm">{autoDraftCaptains[1]?.name || "—"}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label>
                          <span className="text-[10px] text-muted-foreground">Alpha captain</span>
                          <select
                            value={draftCaptainA}
                            onChange={(event) => {
                              setDraftCaptainA(event.target.value);
                              clearDraftProgress();
                              setResult(null);
                            }}
                            className="mt-1 h-10 w-full rounded-lg bg-[#151923] border border-[#2A303B] px-2.5 text-xs font-semibold"
                          >
                            <option value="">Choose player...</option>
                            {selected
                              .filter((id) => id !== draftCaptainB)
                              .map((id) => (
                                <option key={id} value={id}>{contextualPlayerMap[id]?.name || "Player"}</option>
                              ))}
                          </select>
                        </label>

                        <label>
                          <span className="text-[10px] text-muted-foreground">Bravo captain</span>
                          <select
                            value={draftCaptainB}
                            onChange={(event) => {
                              setDraftCaptainB(event.target.value);
                              clearDraftProgress();
                              setResult(null);
                            }}
                            className="mt-1 h-10 w-full rounded-lg bg-[#151923] border border-[#2A303B] px-2.5 text-xs font-semibold"
                          >
                            <option value="">Choose player...</option>
                            {selected
                              .filter((id) => id !== draftCaptainA)
                              .map((id) => (
                                <option key={id} value={id}>{contextualPlayerMap[id]?.name || "Player"}</option>
                              ))}
                          </select>
                        </label>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                      {[
                        ["Alpha", draftTeamA, resolvedDraftCaptainA, "text-magma"],
                        ["Bravo", draftTeamB, resolvedDraftCaptainB, "text-[#65D5D3]"],
                      ].map(([label, ids, captainId, tone]) => (
                        <div key={label} className="rounded-xl border border-[#222834] bg-[#10151D] p-3">
                          <div className={"text-[10px] uppercase tracking-widest font-black mb-2 " + tone}>
                            {label}
                          </div>
                          <div className="space-y-1.5">
                            {ids.map((id) => (
                              <div key={id} className="h-9 rounded-lg border border-[#202631] bg-[#12161D] px-2 flex items-center gap-2">
                                <span className="text-xs font-semibold truncate flex-1">
                                  {contextualPlayerMap[id]?.name || "Player"}
                                </span>
                                {id === captainId && <Crown size={11} className="text-[#D5A33A]" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {!draftComplete && (
                      <div>
                        <div className="rounded-xl border border-[#2A303B] bg-[#111720] px-3 py-2 mb-2 text-xs">
                          <span className="text-muted-foreground">Now picking: </span>
                          <span className="font-black">{currentDraftSide === "A" ? "Alpha" : "Bravo"}</span>
                          <span className="text-muted-foreground ml-2">· A → B → B → A</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {draftAvailable.map((id) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => pickDraftPlayer(id)}
                              className="h-10 rounded-lg border border-[#222834] bg-[#10151D] px-3 text-left text-xs font-semibold hover:border-[#3A424F]"
                            >
                              {contextualPlayerMap[id]?.name || "Player"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={clearDraftProgress}
                      className="h-9 px-3 rounded-lg border border-[#2A303B] bg-[#151923] text-[10px] font-bold text-muted-foreground hover:text-white"
                    >
                      <RotateCcw size={12} className="inline mr-1.5" />
                      Restart draft
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => goWizardStep(2)}
                className="h-10 px-3 border border-[#2A303B]"
              >
                <ArrowLeft size={15} className="mr-1.5" />
                Back
              </Button>

              {teamMethod === "draft" ? (
                !draftStarted && (
                  <Button
                    type="button"
                    onClick={startCaptainDraft}
                    disabled={!validLobby || !resolvedDraftCaptainA || !resolvedDraftCaptainB}
                    className="h-11 px-5 bg-[#D5A33A] hover:bg-[#E0B247] text-black font-black rounded-xl"
                  >
                    <Crown size={15} className="mr-2" />
                    Start draft
                  </Button>
                )
              ) : (
                <Button
                  type="button"
                  onClick={generateTeams}
                  disabled={
                    !validLobby ||
                    (teamMethod === "manual" && (manualA.length !== perTeam || manualB.length !== perTeam))
                  }
                  className="h-11 px-5 bg-[#FF2A3B] hover:bg-[#FF4352] text-white font-black rounded-xl shadow-[0_10px_30px_rgba(255,42,59,.12)]"
                >
                  Build teams
                  <ArrowRight size={15} className="ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}

        {wizardStep === 4 && result && (
          <div className="rounded-2xl border border-[#FF2A3B]/20 bg-[linear-gradient(135deg,#0D1117_0%,#120D11_64%,#1B0B10_100%)] p-4 sm:p-5 shadow-[0_18px_48px_rgba(255,42,59,.035)]">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl border border-[#FF2A3B]/45 bg-[#FF2A3B] text-white flex items-center justify-center font-black shadow-[0_0_24px_rgba(255,42,59,.16)]">4</span>
                <div>
                  <div className="font-display font-black text-lg">Review</div>
                  <div className="text-xs text-muted-foreground">Everything in one place before the match goes live.</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-black">
                <span className="m8-pill">{game}</span>
                <span className="m8-pill">{matchMode}</span>
                <span className="m8-pill">BO{bestOf}</span>
                <span className="m8-pill">{formatForCount(result.teamA.length + result.teamB.length)}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[#222834] bg-[#10151D] p-3 mb-3">
              <div className="flex items-center gap-2 mb-2">
                {mapMode === "manual" ? (
                  <MapPinned size={14} className="text-[#D5A33A]" />
                ) : (
                  <Shuffle size={14} className="text-[#A96DFF]" />
                )}
                <span className="text-xs font-bold">
                  {mapMode === "manual" ? "Manual map rotation" : "Random map rotation"}
                </span>
              </div>

              {mapMode === "manual" ? (
                <div className="flex flex-wrap gap-1.5">
                  {manualMaps.map((mapName, index) => (
                    <span key={mapName + index} className="h-8 px-2.5 rounded-lg border border-[#3A3320] bg-[#17130B] text-[#D5A33A] inline-flex items-center text-[10px] font-black">
                      M{index + 1} · {mapName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-muted-foreground">
                  {matchMode === "CDL Mix"
                    ? `CDL Mix: ${mixRotationModes(bestOf, mixStartMode).map((mode) => mode === "Hardpoint" ? "HP" : "S&D").join(" → ")}. Maps are drawn from the correct mode pool.`
                    : `${bestOf} unique maps will be drawn automatically from the competitive pool when you confirm.`}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#2B303B] bg-[#10151D] p-3 mb-3">
              <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-[#8B94A3]">Money Chall</div>
              <div className="space-y-2">
                {moneyPairings.map((pair, index) => {
                  const playerA = contextualPlayerMap[pair.playerAId];
                  const playerB = contextualPlayerMap[pair.playerBId];
                  const free = Number(pair.amount) <= 0;
                  return (
                    <div key={pair.playerAId + ":" + pair.playerBId} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_130px] gap-2 items-center rounded-lg border border-[#222834] bg-[#0C1118] p-2">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 min-w-0">
                        <div className="text-[11px] font-semibold truncate">{playerA?.name || "Alpha"}</div>
                        <span className="text-white/30 text-xs">⚔</span>
                        <select
                          value={pair.playerBId}
                          onChange={(event) => updateReviewPairingOpponent(index, event.target.value)}
                          className="h-9 min-w-0 rounded-md border border-[#2A303B] bg-[#111720] px-2 text-[11px] font-semibold"
                          aria-label={`Chall opponent for ${playerA?.name || "Alpha"}`}
                        >
                          {result.teamB.map((opponent) => (
                            <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-white/35">€</span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={pair.amount}
                          onChange={(event) => setMoneyPairings((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, amount: event.target.value } : row))}
                          className="h-9 bg-[#111720] border-[#2A303B] pl-7"
                          aria-label="Money Chall amount"
                        />
                      </div>
                      <select
                        value={free ? "free" : pair.platform}
                        onChange={(event) => setMoneyPairings((prev) => prev.map((row, rowIndex) => rowIndex === index ? (event.target.value === "free" ? { ...row, amount: 0, platform: "free" } : { ...row, platform: event.target.value, amount: Number(row.amount) > 0 ? row.amount : 5 }) : row))}
                        className="h-9 rounded-md border border-[#2A303B] bg-[#111720] px-2 text-xs"
                        aria-label="Money Chall payment method"
                      >
                        <option value="free">Free</option>
                        <option value="paypal">PayPal</option>
                        <option value="revolut">Revolut</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
              <Metric label="Balance" value={String(result.balanceScore) + "%"} tone="text-emerald-400" />
              <Metric label="Alpha Elo" value={averageElo(result.teamA)} />
              <Metric label="Bravo Elo" value={averageElo(result.teamB)} />
              <Metric label="Alpha Chem" value={String(result.chemistryA.score) + "%"} />
              <Metric label="Bravo Chem" value={String(result.chemistryB.score) + "%"} />
            </div>

            <div className="relative">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {[
                  ["Alpha", result.teamA, "text-magma", result?.draftCaptains?.A],
                  ["Bravo", result.teamB, "text-[#65D5D3]", result?.draftCaptains?.B],
                ].map(([label, team, tone, draftCaptainId]) => (
                  <div key={label} className="rounded-xl border border-[#222834] bg-[#10151D] p-3">
                    <div className={"text-[10px] uppercase tracking-widest font-black mb-2 " + tone}>
                      {label}
                    </div>
                    <div className="space-y-1.5">
                      {team.map((player) => (
                        <div
                          key={player.id}
                          className={"min-h-[44px] rounded-lg border border-[#202631] bg-[#12161D] px-2.5 py-2 flex items-center gap-2 " + merdaSurfaceClass(player.merdaCount)}
                        >
                          <PlayerAvatar
                            name={player.name}
                            elo={player.currentElo}
                            size={28}
                            avatarUrl={playerAvatars[player.id]}
                          />
                          <span className="text-xs font-semibold truncate flex-1">{player.name}</span>
                          <MerdaBadge count={player.merdaCount} compact />
                          {draftCaptainId === player.id && <Crown size={11} className="text-[#D5A33A]" />}
                          {player.id === matchCaptainId && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-400">Creator</span>
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground">{player.currentElo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-center lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 mt-3 lg:mt-0 z-10">
                <button
                  type="button"
                  onClick={randomizeReviewTeams}
                  className="group w-11 h-11 rounded-full border border-[#FF2A3B]/40 bg-[#0B0F15] text-[#FF5968] shadow-[0_0_0_4px_rgba(5,7,10,.9),0_10px_30px_rgba(255,42,59,.13)] flex items-center justify-center hover:bg-[#FF2A3B] hover:text-white hover:border-[#FF2A3B] transition-all active:scale-90"
                  title="Randomize Alpha / Bravo"
                  aria-label="Randomize Alpha and Bravo teams"
                >
                  <Shuffle size={18} className="transition-transform duration-300 group-hover:rotate-180" />
                </button>
              </div>
            </div>

            <details className="mt-3 rounded-xl border border-[#222834] bg-[#0B0F15] overflow-hidden group">
              <summary className="list-none cursor-pointer px-3 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.025]">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">Advanced</div>
                  <div className="text-xs font-black">Chemistry, rivalries and match intel</div>
                </div>
                <span className="w-7 h-7 rounded-lg border border-[#2A303B] bg-[#111720] inline-flex items-center justify-center group-open:rotate-180 transition-transform">⌄</span>
              </summary>

              <div className="border-t border-[#1D222C] p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  <Metric label="Lobby Quality" value={String(result.lobbyQuality ?? result.balanceScore) + "%"} tone="text-emerald-400" />
                  <Metric label="Balance" value={String(result.balanceScore) + "%"} />
                  <Metric label="Chemistry" value={String(result.chemistryScore) + "%"} />
                  <Metric label="Recent Form" value={String(result.recentFormScore ?? 50) + "%"} />
                  <Metric label="Freshness" value={String(result.freshnessScore) + "%"} />
                  <Metric label="Avg Elo Gap" value={teamIntel?.avgEloGap ?? 0} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {[
                    ["Alpha", result.chemistryA, teamIntel?.recordA, "text-magma"],
                    ["Bravo", result.chemistryB, teamIntel?.recordB, "text-[#65D5D3]"],
                  ].map(([label, chemistry, record, tone]) => (
                    <div key={label} className="rounded-xl border border-[#222834] bg-[#10151D] p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className={"text-[10px] uppercase tracking-widest font-black " + tone}>{label} chemistry</div>
                        <div className="text-[9px] text-muted-foreground">
                          {record?.played ? String(record.wins) + "W " + String(record.losses) + "L" : "No previous lineup"}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {(chemistry?.pairs || []).slice(0, 4).map((pair) => (
                          <div key={label + pair.a.id + pair.b.id} className="flex items-center gap-2 text-[10px]">
                            <span className="min-w-0 flex-1 truncate">{pair.a.name} + {pair.b.name}</span>
                            <span className="text-muted-foreground">{pair.matchesTogether} together</span>
                            <span className="font-mono font-black">{pair.score}%</span>
                          </div>
                        ))}
                        {!chemistry?.pairs?.length && (
                          <div className="text-[10px] text-muted-foreground">Not enough duo data yet.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-[#2A2520] bg-[#120F0D] p-3">
                  <div className="text-[10px] uppercase tracking-widest text-[#8E7662] mb-2">
                    Cross-team rivalries
                  </div>
                  {teamIntel?.rivalries?.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {teamIntel.rivalries.map((row) => (
                        <div key={row.key} className="rounded-lg border border-[#2B251F] bg-black/10 px-2.5 py-2 text-[10px]">
                          <div className="font-semibold truncate">
                            {contextualPlayerMap[row.playerAId]?.name || "Player"} vs {contextualPlayerMap[row.playerBId]?.name || "Player"}
                          </div>
                          <div className="text-muted-foreground mt-0.5">
                            H2H {row.playerAWins}-{row.playerBWins} · {row.meetings} meetings
                            {row.currentStreak > 1 ? " · streak " + row.currentStreak : ""}
                            {row.moneyVolume > 0 ? " · €" + Number(row.moneyVolume).toFixed(0) + " volume" : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">No meaningful rivalry history yet.</div>
                  )}
                </div>

                {(result.why || []).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {(result.why || []).map((reason) => (
                      <div key={reason} className="rounded-lg border border-[#202631] bg-[#10151D] px-2.5 py-2 text-[10px] text-muted-foreground">
                        {reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 mt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setResult(null);
                  goWizardStep(3);
                }}
                className="h-10 px-3 border border-[#2A303B]"
              >
                <ArrowLeft size={15} className="mr-1.5" />
                Back to lobby
              </Button>

              <Button
                type="button"
                onClick={() => {
                  void playUiSound("confirm", "mucho8s");
                  void confirmMatch();
                }}
                disabled={!canConfirm || confirmBusy}
                className="h-11 px-6 bg-magma hover:bg-[#ff3c4c] text-white font-black rounded-xl"
                title={
                  canConfirm
                    ? ""
                    : !mapPoolConfigured
                      ? "Competitive map pool is not configured for this setup"
                      : !manualMapSelectionValid
                        ? "Fix the manual map rotation"
                        : "Only the Mucho8s creator or Admin can confirm"
                }
              >
                <Check size={16} className="mr-2" />
                {confirmBusy ? "Confirming..." : "Confirm Mucho8s"}
              </Button>
            </div>

            {!canConfirm && (
              <div className="text-[10px] text-muted-foreground text-center mt-2">
                {!mapPoolConfigured
                  ? "This game/mode does not have enough competitive maps for BO" + bestOf + "."
                  : !manualMapSelectionValid
                    ? "The selected manual map rotation is not valid for this lobby format."
                    : "Only the match creator or Admin can confirm this Mucho8s."}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
