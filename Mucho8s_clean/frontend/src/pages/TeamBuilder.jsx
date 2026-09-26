import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import MatchResultCenter from "@/components/MatchResultCenter";
import { computeContextStats, playerForContext } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import {
  analyzeManualTeams,
  draftTeamsBalanced,
} from "@/lib/chemistry";
import {
  Check,
  Crown,
  Gamepad2,
  MessageCircle,
  RotateCcw,
  Search,
  Swords,
  Trophy,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

const MATCH_MODES = ["Hardpoint", "Search & Destroy"];
const VALID_LOBBY_SIZES = [4, 6, 8];

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

const Metric = ({ label, value, tone = "" }) => (
  <div className="rounded-xl bg-[#0F1218] border border-[#222834] px-3 py-2.5">
    <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">{label}</div>
    <div className={`font-mono font-black text-lg mt-0.5 ${tone}`}>{value}</div>
  </div>
);

const pickRandomCaptain = (team = []) => {
  if (!team.length) return "";
  return team[Math.floor(Math.random() * team.length)]?.id || "";
};

export default function TeamBuilder() {
  const {
    players,
    matches,
    playerAvatars,
    discordPlayer,
    isAdmin,
    sendDiscordTeams,
  } = useData();

  const [game, setGame] = useState("");
  const [matchMode, setMatchMode] = useState("");
  const [teamMethod, setTeamMethod] = useState("auto");
  const [selected, setSelected] = useState([]);
  const [manualA, setManualA] = useState([]);
  const [manualB, setManualB] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [captains, setCaptains] = useState({ A: "", B: "" });
  const [recordOpen, setRecordOpen] = useState(false);

  const selectedCount = selected.length;
  const inferredFormat = formatForCount(selectedCount);
  const validLobby = VALID_LOBBY_SIZES.includes(selectedCount);
  const perTeam = validLobby ? selectedCount / 2 : 0;
  const nextSize = nextLobbySize(selectedCount);

  const context = useMemo(
    () => computeContextStats(matches, { game: game || "ALL", mode: matchMode || "ALL" }),
    [matches, game, matchMode]
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

  const captainA = result?.teamA?.find((player) => player.id === captains.A) || null;
  const captainB = result?.teamB?.find((player) => player.id === captains.B) || null;
  const canReport = Boolean(
    result &&
    (isAdmin || [captains.A, captains.B].includes(discordPlayer?.id))
  );

  const currentTeamIds = result
    ? [...result.teamA, ...result.teamB].map((player) => player.id)
    : null;

  const resetLobby = ({ keepGame = true } = {}) => {
    setSelected([]);
    setManualA([]);
    setManualB([]);
    setResult(null);
    setCaptains({ A: "", B: "" });
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
    setResult(null);
    setCaptains({ A: "", B: "" });
  };

  const togglePlayer = (id) => {
    setResult(null);
    setCaptains({ A: "", B: "" });

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
    setCaptains({ A: "", B: "" });

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

  const lockResult = (draft) => {
    if (!draft) {
      toast.error("Unable to create these teams");
      return;
    }

    setResult(draft);
    setCaptains({
      A: pickRandomCaptain(draft.teamA),
      B: pickRandomCaptain(draft.teamB),
    });

    toast.success(
      `${formatForCount(draft.teamA.length + draft.teamB.length)} ready · ${draft.balanceScore}% balance`
    );
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
      lockResult(analyzeManualTeams(manualTeamA, manualTeamB, context.matches));
      return;
    }

    lockResult(draftTeamsBalanced(selectedPlayers, context.matches));
  };

  const sendCurrentTeamsToDiscord = async () => {
    if (!result) return;
    const ok = await sendDiscordTeams({
      teamA: result.teamA.map((player) => player.name),
      teamB: result.teamB.map((player) => player.name),
      game,
      mode: matchMode,
      balanceScore: result.balanceScore,
    });
    if (ok) toast.success("Teams sent to Discord");
  };

  const reportPairings = result
    ? result.pairings.map((pair) => ({
        playerAId: pair.playerA.id,
        playerBId: pair.playerB.id,
        amount: 5,
        platform: "paypal",
      }))
    : [];

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Play</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Team Builder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Game first. Then choose the team method, select the lobby and report the result here.
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

      <MatchResultCenter teamPlayerIds={currentTeamIds} />

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

          <div className="grid grid-cols-2 gap-2 max-w-xl">
            <button
              type="button"
              onClick={() => changeTeamMethod("auto")}
              aria-pressed={teamMethod === "auto"}
              className={`h-12 rounded-xl border font-bold transition-all ${
                teamMethod === "auto"
                  ? "bg-white text-black border-white"
                  : "bg-[#0F1218] border-[#222834] text-[#AAB1BE]"
              }`}
            >
              Auto Balance
            </button>
            <button
              type="button"
              onClick={() => changeTeamMethod("manual")}
              aria-pressed={teamMethod === "manual"}
              className={`h-12 rounded-xl border font-bold transition-all ${
                teamMethod === "manual"
                  ? "bg-white text-black border-white"
                  : "bg-[#0F1218] border-[#222834] text-[#AAB1BE]"
              }`}
            >
              Manual
            </button>
          </div>
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
                    <div className="font-semibold truncate">{player.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {player.currentElo} Elo{player.role ? ` · ${player.role}` : ""}
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

          <Button
            onClick={generateTeams}
            disabled={
              !validLobby ||
              (teamMethod === "manual" && (manualA.length !== perTeam || manualB.length !== perTeam))
            }
            className="w-full h-12 mt-4 bg-magma hover:bg-[#ff3c4c] font-black rounded-xl"
          >
            <Swords size={17} className="mr-2" />
            {validLobby ? `Create ${inferredFormat} Teams` : "Select 4, 6 or 8 players"}
          </Button>
        </section>
      )}

      {result && (
        <section className="m8-panel rounded-[22px] p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <div>
              <div className="brand-kicker mb-1">Ready</div>
              <h3 className="font-display text-2xl font-black">Alpha vs Bravo</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Captains are assigned automatically. Chemistry is informational only.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full lg:w-auto lg:min-w-[390px]">
              <Metric label="Balance" value={`${result.balanceScore}%`} tone="text-emerald-400" />
              <Metric label="Alpha Chem" value={`${result.chemistryA.score}%`} />
              <Metric label="Bravo Chem" value={`${result.chemistryB.score}%`} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 lg:items-center">
            <div className="rounded-2xl bg-magma/[0.04] border border-magma/15 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-widest text-magma font-black">Alpha</div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {captainA ? `Captain · ${captainA.name}` : ""}
                </span>
              </div>
              <div className="space-y-2">
                {result.teamA.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1 flex items-center gap-2">
                      {player.name}
                      {player.id === captains.A && (
                        <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1">
                          <Crown size={11} /> Captain
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
                  {captainB ? `Captain · ${captainB.name}` : ""}
                </span>
              </div>
              <div className="space-y-2">
                {result.teamB.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1 flex items-center gap-2">
                      {player.name}
                      {player.id === captains.B && (
                        <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1">
                          <Crown size={11} /> Captain
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{player.currentElo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4 mt-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Cross-team matchups</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.pairings.map((pair) => (
                <div key={`${pair.playerA.id}:${pair.playerB.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#1D222C] px-3 py-2">
                  <span className="font-semibold text-sm truncate">{pair.playerA.name}</span>
                  <span className="text-[10px] text-muted-foreground">↔</span>
                  <span className="font-semibold text-sm truncate text-right">{pair.playerB.name}</span>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Money amounts and PayPal/Revolut are set in the result report.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
            {isAdmin && (
              <Button
                onClick={sendCurrentTeamsToDiscord}
                className="h-11 bg-[#5865F2] hover:bg-[#6875F5] text-white font-semibold"
              >
                <MessageCircle size={16} className="mr-2" /> Send to Discord
              </Button>
            )}

            <Button
              onClick={() => setRecordOpen(true)}
              disabled={!canReport}
              className={`h-11 bg-magma hover:bg-[#ff3c4c] text-white font-semibold ${isAdmin ? "" : "sm:col-span-2"}`}
              title={canReport ? "" : "Only an assigned captain or Admin can report the result"}
            >
              <Trophy size={16} className="mr-2" /> Report Result
            </Button>
          </div>

          {!canReport && (
            <div className="text-[11px] text-muted-foreground text-center mt-2">
              Result reporting is limited to the assigned captains or Admin.
            </div>
          )}
        </section>
      )}

      <RecordMatchDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        title="Report Match Result"
        lockTeams
        lockContext
        initialTeams={result ? {
          teamA: result.teamA.map((player) => player.id),
          teamB: result.teamB.map((player) => player.id),
          pairings: reportPairings,
        } : null}
        initialCaptains={captains}
        defaultGame={game || undefined}
        defaultMode={matchMode || undefined}
      />
    </div>
  );
}
