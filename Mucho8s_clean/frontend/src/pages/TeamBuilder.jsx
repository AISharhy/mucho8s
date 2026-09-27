import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeContextStats, playerForContext } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import {
  analyzeManualTeams,
  draftTeamsByPriority,
} from "@/lib/chemistry";
import {
  Check,
  Crown,
  Gamepad2,
  RotateCcw,
  Scale,
  Search,
  Swords,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

const MATCH_MODES = ["Hardpoint", "Search & Destroy"];
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
    playerAvatars,
    discordPlayer,
    dashboardData,
    isAdmin,
    createLiveMatch,
  } = useData();

  const [game, setGame] = useState("");
  const [matchMode, setMatchMode] = useState("");
  const [teamMethod, setTeamMethod] = useState("auto");
  const [autoPriority, setAutoPriority] = useState("elo");
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

  const selectedCount = selected.length;
  const inferredFormat = formatForCount(selectedCount);
  const validLobby = VALID_LOBBY_SIZES.includes(selectedCount);
  const perTeam = validLobby ? selectedCount / 2 : 0;
  const nextSize = nextLobbySize(selectedCount);

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
    return map;
  }, [players, game, matchMode, context.stats]);

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
  const canConfirm = Boolean(result && (isAdmin || matchCaptainId));

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
    setGame(nextGame);
    setMatchMode("");
    resetLobby({ keepGame: true });
  };

  const changeMatchMode = (nextMode) => {
    setMatchMode(nextMode);
    resetLobby({ keepGame: true });
  };

  const changeTeamMethod = (nextMethod) => {
    setTeamMethod(nextMethod);
    setManualA([]);
    setManualB([]);
    resetCaptainDraft();
    setResult(null);
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

    const analysis = analyzeManualTeams(teamAPlayers, teamBPlayers, context.matches);
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

    setResult(draft);

    toast.success(
      `${formatForCount(draft.teamA.length + draft.teamB.length)} teams ready · confirm the match to go live`
    );
  };

  const confirmMatch = async () => {
    if (!result || confirmBusy) return;

    if (!canConfirm) {
      toast.error("Only the match creator or Admin can confirm this match");
      return;
    }

    const pairings = (Array.isArray(result.pairings) ? result.pairings : []).map((pair) => ({
      playerAId: pair.playerA?.id || pair.playerAId || "",
      playerBId: pair.playerB?.id || pair.playerBId || "",
      amount: 5,
      platform: "paypal",
    }));

    setConfirmBusy(true);
    const created = await createLiveMatch({
      teamA: result.teamA.map((player) => player.id),
      teamB: result.teamB.map((player) => player.id),
      game,
      mode: matchMode,
      format: formatForCount(result.teamA.length + result.teamB.length),
      pairings,
    });
    setConfirmBusy(false);

    if (!created) return;

    toast.success("Match confirmed — now visible in Live Matches");
    navigate("/matches");
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
      void lockResult(analyzeManualTeams(manualTeamA, manualTeamB, context.matches));
      return;
    }

    if (teamMethod === "draft") {
      startCaptainDraft();
      return;
    }

    void lockResult(
      draftTeamsByPriority(selectedPlayers, context.matches, autoPriority)
    );
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Play</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Team Builder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Game first. Build the teams, confirm the match and manage it from Live Matches.
            </p>
          </div>

          <Button
            variant="ghost"
            onClick={() => resetLobby({ keepGame: true })}
            className="m8-action border border-[#222834] bg-[#0F1218] hover:border-[#394150]"
          >
            <RotateCcw size={15} className="mr-2" /> Clear Lobby
          </Button>
        </div>
      </section>

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-black text-sm">1</div>
          <div>
            <div className="brand-kicker">Setup</div>
            <h3 className="font-display text-xl font-black">Choose the game first</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2" data-testid="team-builder-game">
          {GAMES.map((item) => (
            <button
              type="button"
              key={item}
              aria-pressed={game === item}
              onClick={() => changeGame(item)}
              className={`h-11 rounded-xl border text-sm font-black transition-all ${
                game === item
                  ? "bg-white text-black border-white"
                  : "bg-[#0F1218] border-[#222834] text-[#AAB1BE] hover:text-white"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {game && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Mode</div>
            <div className="grid grid-cols-2 gap-2 max-w-xl">
              {MATCH_MODES.map((item) => (
                <button
                  type="button"
                  key={item}
                  aria-pressed={matchMode === item}
                  onClick={() => changeMatchMode(item)}
                  className={`h-11 rounded-xl border text-sm font-bold transition-all ${
                    matchMode === item
                      ? "bg-[#D5A33A] text-black border-[#D5A33A]"
                      : "bg-[#0F1218] border-[#222834] text-[#AAB1BE] hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {game && matchMode && (
        <section className="m8-panel rounded-[22px] p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-black text-sm">2</div>
            <div>
              <div className="brand-kicker">Teams</div>
              <h3 className="font-display text-xl font-black">Choose the team method</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              {
                key: "auto",
                title: "Auto Balance",
                text: "System creates the best split for the selected priority.",
                icon: Scale,
              },
              {
                key: "draft",
                title: "Captain Draft",
                text: "Two draft captains pick the lobby with a snake order.",
                icon: Crown,
              },
              {
                key: "manual",
                title: "Manual",
                text: "Build Alpha and Bravo yourself with full control.",
                icon: UsersRound,
              },
            ].map(({ key, title, text, icon: Icon }) => {
              const active = teamMethod === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => changeTeamMethod(key)}
                  aria-pressed={active}
                  className={`rounded-2xl border p-3.5 text-left transition-all ${
                    active
                      ? "bg-white/[0.055] border-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,.03)]"
                      : "bg-[#0F1218] border-[#222834] hover:border-[#394150]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                        active
                          ? "bg-white text-black border-white"
                          : "bg-[#151923] border-[#2A303B] text-[#9AA2AF]"
                      }`}
                    >
                      <Icon size={16} />
                    </span>
                    <div>
                      <div className={`text-sm font-black ${active ? "text-white" : "text-[#C2C8D1]"}`}>
                        {title}
                      </div>
                      <div className="text-[10px] text-[#697181] mt-0.5 leading-4">
                        {text}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {teamMethod === "auto" && (
            <div className="mt-3 rounded-xl border border-[#222834] bg-[#0F1218] p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181]">
                    Balance priority
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Choose what the auto builder should value most.
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    ["elo", "Elo"],
                    ["chemistry", "Chemistry"],
                    ["mixed", "Mixed"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setAutoPriority(key);
                        setResult(null);
                      }}
                      className={`h-9 px-3 rounded-lg border text-[10px] font-black transition-all ${
                        autoPriority === key
                          ? "bg-white text-black border-white"
                          : "bg-[#151923] border-[#2A303B] text-[#AAB1BE] hover:border-[#3A424F]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {teamMethod === "draft" && (
            <div className="mt-3 rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                Snake order <span className="text-white font-mono font-black ml-1">A → B → B → A</span>
              </div>
              <span className="text-[9px] uppercase tracking-widest text-[#D5A33A]">
                Best for 3v3 / 4v4
              </span>
            </div>
          )}
        </section>
      )}

      {game && matchMode && (
        <section className="m8-panel rounded-[22px] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-black text-sm">3</div>
              <div>
                <div className="brand-kicker">Lobby</div>
                <h3 className="font-display text-xl font-black">Select players</h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {inferredFormat && (
                <span className="m8-pill text-emerald-400 border-emerald-500/25">
                  {inferredFormat}
                </span>
              )}
              <span className="font-mono font-black text-[#D5A33A]">{selectedCount}/8</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#0F1218] border border-[#222834] px-3 py-2.5 mb-3 text-xs text-muted-foreground flex items-center justify-between gap-3">
            <span>
              {validLobby
                ? `${inferredFormat} detected automatically. Add more players to move to the next format.`
                : nextSize
                  ? `Select ${nextSize - selectedCount} more player${nextSize - selectedCount === 1 ? "" : "s"} for ${formatForCount(nextSize)}.`
                  : "Maximum lobby size reached."}
            </span>
            <UsersRound size={16} className="shrink-0" />
          </div>

          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search players..."
              className="pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[390px] overflow-y-auto pr-1">
            {filtered.map((player) => {
              const active = selected.includes(player.id);
              return (
                <button
                  type="button"
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                    active
                      ? "bg-white/[0.05] border-[#4A5362]"
                      : "bg-[#0F1218] border-[#222834] hover:border-[#343B48]"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    active ? "bg-magma border-magma" : "border-[#343B48]"
                  }`}>
                    {active && <Check size={13} />}
                  </span>
                  <PlayerAvatar
                    name={player.name}
                    elo={player.currentElo}
                    size={34}
                    avatarUrl={playerAvatars[player.id]}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate flex items-center gap-2">
                      <span className="truncate">{player.name}</span>
                      {onlinePlayerIds.has(String(player.id)) && (
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                          title="Online"
                          aria-label="Online"
                        />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {player.currentElo} Elo{player.role ? ` · ${player.role}` : ""}
                      {onlinePlayerIds.has(String(player.id)) ? " · Online" : ""}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {teamMethod === "manual" && validLobby && (
            <div className="mt-4 pt-4 border-t border-[#222834]">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="brand-kicker mb-1">Manual split</div>
                  <div className="text-sm font-bold">Assign {perTeam} players to each team</div>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  A {manualA.length}/{perTeam} · B {manualB.length}/{perTeam}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {selected.map((id) => {
                  const player = contextualPlayerMap[id];
                  if (!player) return null;
                  const inA = manualA.includes(id);
                  const inB = manualB.includes(id);

                  return (
                    <div key={id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#222834] p-2.5">
                      <PlayerAvatar
                        name={player.name}
                        elo={player.currentElo}
                        size={32}
                        avatarUrl={playerAvatars[player.id]}
                      />
                      <span className="font-semibold text-sm truncate flex-1">{player.name}</span>
                      <button
                        type="button"
                        onClick={() => assignManual(id, "A")}
                        className={`w-9 h-9 rounded-lg border text-xs font-black ${
                          inA
                            ? "bg-magma border-magma text-white"
                            : "border-[#343B48] text-muted-foreground"
                        }`}
                      >
                        A
                      </button>
                      <button
                        type="button"
                        onClick={() => assignManual(id, "B")}
                        className={`w-9 h-9 rounded-lg border text-xs font-black ${
                          inB
                            ? "bg-[#65D5D3] border-[#65D5D3] text-black"
                            : "border-[#343B48] text-muted-foreground"
                        }`}
                      >
                        B
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {teamMethod === "draft" && validLobby && (
            <div className="mt-4 pt-4 border-t border-[#222834]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div>
                  <div className="brand-kicker mb-1">Captain Draft</div>
                  <div className="text-sm font-bold">
                    {draftStarted ? "Draft the teams" : "Choose the two draft captains"}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={draftStarted}
                    onClick={() => changeDraftCaptainMode("auto")}
                    className={`h-8 px-3 rounded-lg border text-[10px] font-black ${
                      draftCaptainMode === "auto"
                        ? "bg-white text-black border-white"
                        : "bg-[#151923] border-[#2A303B] text-[#AAB1BE]"
                    } disabled:opacity-40`}
                  >
                    Auto Captains
                  </button>
                  <button
                    type="button"
                    disabled={draftStarted}
                    onClick={() => changeDraftCaptainMode("manual")}
                    className={`h-8 px-3 rounded-lg border text-[10px] font-black ${
                      draftCaptainMode === "manual"
                        ? "bg-white text-black border-white"
                        : "bg-[#151923] border-[#2A303B] text-[#AAB1BE]"
                    } disabled:opacity-40`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {!draftStarted ? (
                <>
                  {draftCaptainMode === "auto" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        ["A", autoDraftCaptains[0]],
                        ["B", autoDraftCaptains[1]],
                      ].map(([side, captain]) => (
                        <div
                          key={side}
                          className="rounded-xl border border-[#222834] bg-[#0F1218] p-3 flex items-center gap-3"
                        >
                          <span className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center font-black text-xs ${
                            side === "A"
                              ? "border-magma/25 bg-magma/[0.06] text-magma"
                              : "border-[#65D5D3]/25 bg-[#65D5D3]/[0.05] text-[#65D5D3]"
                          }`}>
                            {side}
                          </span>
                          {captain ? (
                            <>
                              <PlayerAvatar
                                name={captain.name}
                                elo={captain.currentElo}
                                size={34}
                                avatarUrl={playerAvatars[captain.id]}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                                  <Crown size={12} className="text-[#D5A33A]" />
                                  {captain.name}
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                  {captain.currentElo} Elo · auto selected
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Select the full lobby first.
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        ["A", draftCaptainA, setDraftCaptainA, draftCaptainB],
                        ["B", draftCaptainB, setDraftCaptainB, draftCaptainA],
                      ].map(([side, value, setter, other]) => (
                        <label
                          key={side}
                          className="rounded-xl border border-[#222834] bg-[#0F1218] p-3"
                        >
                          <div className="text-[9px] uppercase tracking-widest text-[#697181] mb-2">
                            {side === "A" ? "Alpha" : "Bravo"} Draft Captain
                          </div>
                          <select
                            value={value}
                            onChange={(event) => {
                              setter(event.target.value);
                              clearDraftProgress();
                              setResult(null);
                            }}
                            className="h-10 w-full rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                          >
                            <option value="">Choose captain</option>
                            {selected.map((id) => {
                              const player = contextualPlayerMap[id];
                              if (!player || id === other) return null;
                              return (
                                <option key={id} value={id}>
                                  {player.name} · {player.currentElo} Elo
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={startCaptainDraft}
                    disabled={!resolvedDraftCaptainA || !resolvedDraftCaptainB}
                    className="w-full h-11 mt-3 bg-[#D5A33A] hover:bg-[#e1b34b] text-black font-black rounded-xl"
                  >
                    <Crown size={15} className="mr-2" />
                    Start Snake Draft
                  </Button>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] gap-3 items-stretch">

                    <div
                      className={`min-w-0 rounded-xl border p-3 ${
                        currentDraftSide === "A"
                          ? "border-magma/35 bg-magma/[0.04]"
                          : "border-[#222834] bg-[#0F1218]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-black text-magma">
                          Alpha
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {draftTeamA.length}/{perTeam}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {draftTeamA.map((id) => {
                          const player = contextualPlayerMap[id];
                          return (
                            <div
                              key={id}
                              className="h-10 min-w-0 px-2 rounded-lg border border-[#202631] bg-[#12161D] flex items-center gap-2"
                            >
                              <PlayerAvatar
                                name={player?.name || "Player"}
                                elo={player?.currentElo || 1000}
                                size={26}
                                avatarUrl={playerAvatars[id]}
                              />
                              <span className="text-xs font-semibold truncate flex-1 min-w-0">
                                {player?.name || "Player"}
                              </span>
                              {id === resolvedDraftCaptainA && (
                                <Crown size={11} className="text-[#D5A33A] shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="hidden lg:flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border border-[#2A303B] bg-[#0F1218] flex items-center justify-center font-display font-black text-xs text-muted-foreground">
                        VS
                      </div>
                    </div>


                    <div
                      className={`min-w-0 rounded-xl border p-3 ${
                        currentDraftSide === "B"
                          ? "border-[#65D5D3]/35 bg-[#65D5D3]/[0.035]"
                          : "border-[#222834] bg-[#0F1218]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] uppercase tracking-widest font-black text-[#65D5D3]">
                          Bravo
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {draftTeamB.length}/{perTeam}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {draftTeamB.map((id) => {
                          const player = contextualPlayerMap[id];
                          return (
                            <div
                              key={id}
                              className="h-10 min-w-0 px-2 rounded-lg border border-[#202631] bg-[#12161D] flex items-center gap-2"
                            >
                              <PlayerAvatar
                                name={player?.name || "Player"}
                                elo={player?.currentElo || 1000}
                                size={26}
                                avatarUrl={playerAvatars[id]}
                              />
                              <span className="text-xs font-semibold truncate flex-1 min-w-0">
                                {player?.name || "Player"}
                              </span>
                              {id === resolvedDraftCaptainB && (
                                <Crown size={11} className="text-[#D5A33A] shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {!draftComplete && (
                    <>
                      <div className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 ${
                        currentDraftSide === "A"
                          ? "border-magma/25 bg-magma/[0.04]"
                          : "border-[#65D5D3]/25 bg-[#65D5D3]/[0.035]"
                      }`}>
                        <div>
                          <div className="text-[9px] uppercase tracking-widest text-[#697181]">
                            Pick {draftPickIndex + 1}
                          </div>
                          <div className="text-sm font-black mt-0.5">
                            {currentDraftSide === "A" ? "Alpha" : "Bravo"} picks now
                          </div>
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          A → B → B → A
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {draftAvailable.map((id) => {
                          const player = contextualPlayerMap[id];
                          if (!player) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => pickDraftPlayer(id)}
                              className="rounded-xl border border-[#222834] bg-[#0F1218] p-2.5 flex items-center gap-2.5 text-left hover:border-[#3A424F] transition-all"
                            >
                              <PlayerAvatar
                                name={player.name}
                                elo={player.currentElo}
                                size={30}
                                avatarUrl={playerAvatars[id]}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs truncate">
                                  {player.name}
                                </div>
                                <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                  {player.currentElo} Elo
                                </div>
                              </div>
                              <span className="text-[10px] font-black text-[#D5A33A]">
                                PICK
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={clearDraftProgress}
                    className="h-9 px-3 rounded-lg border border-[#2A303B] bg-[#151923] text-[10px] font-bold text-muted-foreground hover:text-white"
                  >
                    <RotateCcw size={12} className="inline mr-1.5" />
                    Restart Draft
                  </button>
                </div>
              )}
            </div>
          )}

          {teamMethod !== "draft" && (
            <Button
              onClick={generateTeams}
              disabled={
                !validLobby ||
                (teamMethod === "manual" && (manualA.length !== perTeam || manualB.length !== perTeam))
              }
              className="w-full h-12 mt-4 bg-magma hover:bg-[#ff3c4c] font-black rounded-xl"
            >
              <Swords size={17} className="mr-2" />
              {validLobby
                ? teamMethod === "auto"
                  ? `Create ${inferredFormat} · ${autoPriority === "elo" ? "Elo" : autoPriority === "chemistry" ? "Chemistry" : "Mixed"}`
                  : `Create ${inferredFormat} Teams`
                : "Select 4, 6 or 8 players"}
            </Button>
          )}
        </section>
      )}

      {result && (
        <section className="m8-panel rounded-[22px] p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <div>
              <div className="brand-kicker mb-1">Ready</div>
              <h3 className="font-display text-2xl font-black">Alpha vs Bravo</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Teams ready. Review balance, Elo and chemistry before confirming the Live Match.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full lg:w-auto lg:min-w-[620px]">
              <Metric label="Balance" value={`${result.balanceScore}%`} tone="text-emerald-400" />
              <Metric label="Alpha Elo" value={averageElo(result.teamA)} />
              <Metric label="Bravo Elo" value={averageElo(result.teamB)} />
              <Metric label="Alpha Chem" value={`${result.chemistryA.score}%`} />
              <Metric label="Bravo Chem" value={`${result.chemistryB.score}%`} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 lg:items-center">
            <div className="rounded-2xl bg-magma/[0.04] border border-magma/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-magma font-black">Alpha</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {result?.draftCaptains?.A
                    ? `Draft Captain · ${contextualPlayerMap[result.draftCaptains.A]?.name || "Player"}`
                    : captainSide === "A" && matchCaptain
                      ? `Captain · ${matchCaptain.name}`
                      : ""}
                </span>
              </div>
              <div className="space-y-2">
                {result.teamA.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1 flex items-center gap-2">
                      {player.name}
                      {result?.draftCaptains?.A === player.id && (
                        <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1">
                          <Crown size={11} /> Draft
                        </span>
                      )}
                      {player.id === matchCaptainId && (
                        <span className="text-[9px] uppercase tracking-wider text-emerald-400">
                          Creator
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{player.currentElo}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex w-12 h-12 rounded-full border border-[#2A303B] bg-[#0F1218] items-center justify-center font-display font-black text-muted-foreground">
              VS
            </div>

            <div className="rounded-2xl bg-[#65D5D3]/[0.035] border border-[#65D5D3]/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-[#65D5D3] font-black">Bravo</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {result?.draftCaptains?.B
                    ? `Draft Captain · ${contextualPlayerMap[result.draftCaptains.B]?.name || "Player"}`
                    : captainSide === "B" && matchCaptain
                      ? `Captain · ${matchCaptain.name}`
                      : ""}
                </span>
              </div>
              <div className="space-y-2">
                {result.teamB.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1 flex items-center gap-2">
                      {player.name}
                      {result?.draftCaptains?.B === player.id && (
                        <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1">
                          <Crown size={11} /> Draft
                        </span>
                      )}
                      {player.id === matchCaptainId && (
                        <span className="text-[9px] uppercase tracking-wider text-emerald-400">
                          Creator
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{player.currentElo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Button
              onClick={() => void confirmMatch()}
              disabled={!canConfirm || confirmBusy}
              className="w-full h-11 bg-magma hover:bg-[#ff3c4c] text-white font-semibold"
              title={canConfirm ? "" : "Only the match creator or Admin can confirm the match"}
            >
              <Check size={16} className="mr-2" />
              {confirmBusy ? "Confirming..." : "Confirm Match"}
            </Button>
          </div>

          {!canConfirm && (
            <div className="text-[11px] text-muted-foreground text-center mt-2">
              Match confirmation is limited to the match creator or Admin.
            </div>
          )}
        </section>
      )}

    </div>
  );
}
