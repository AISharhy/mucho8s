import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { computeContextStats, playerForContext } from "@/lib/elo";
import { GAMES } from "@/lib/demoData";
import { detectLobbyBounties } from "@/lib/bountyAchievements";
import {
  analyzeManualTeams,
  duoChemistry,
  draftTeamsByChemistry,
  draftTeamsBalanced,
} from "@/lib/chemistry";
import {
  Check,
  FlaskConical,
  Gauge,
  RotateCcw,
  Search,
  Sparkles,
  Swords,
  UsersRound,
  WalletCards,
  Zap,
  MessageCircle,
  Trophy,
  Target,
} from "lucide-react";
import { toast } from "sonner";

const MATCH_MODES = ["Hardpoint", "Search & Destroy"];

const FORMATS = [
  { key: 4, label: "2v2" },
  { key: 6, label: "3v3" },
  { key: 8, label: "4v4" },
];

const ChemistryBadge = ({ score }) => {
  const className =
    score >= 80
      ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
      : score >= 65
        ? "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/10"
        : "text-[#AAB1BE] border-[#343B48] bg-[#151923]";

  return (
    <span className={`inline-flex items-center h-7 px-2 rounded-lg border text-xs font-mono font-bold ${className}`}>
      {score}% Chemistry
    </span>
  );
};

const BalanceBadge = ({ score, verdict }) => {
  const className =
    score >= 94
      ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/10"
      : score >= 88
        ? "text-[#65D5D3] border-[#65D5D3]/25 bg-[#65D5D3]/10"
        : score >= 78
          ? "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/10"
          : "text-red-400 border-red-500/25 bg-red-500/10";

  return (
    <span className={`inline-flex items-center h-8 px-3 rounded-lg border text-xs font-bold ${className}`}>
      {score}% · {verdict}
    </span>
  );
};

const TeamCard = ({ label, team, chemistry, playerAvatars, game, matchMode }) => (
  <div className="m8-panel rounded-2xl p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <div className="brand-kicker mb-1">Draft Team</div>
        <h3 className="font-display text-xl font-extrabold">{label}</h3>
      </div>
      <ChemistryBadge score={chemistry.score} />
    </div>

    <div className="space-y-2">
      {team.map((player) => (
        <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
          <PlayerAvatar
            name={player.name}
            elo={player.currentElo}
            size={40}
            avatarUrl={playerAvatars[player.id]}
          />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{player.name}</div>
            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
              <span>
                {player.currentElo} {game === "ALL" && matchMode === "ALL" ? "Elo" : "context rating"}
              </span>
              {player.role && <span>· {player.role}</span>}
              {Number.isFinite(Number(player.contextConfidence)) && (game !== "ALL" || matchMode !== "ALL") && (
                <span>· {player.contextConfidence}% confidence</span>
              )}
            </div>
          </div>
          <EloBadge elo={player.currentElo} />
        </div>
      ))}
    </div>

    {chemistry.pairs.length > 0 && (
      <div className="mt-4 pt-4 border-t border-[#1D222C]">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Chemistry pairs</div>
        <div className="space-y-2">
          {chemistry.pairs.slice(0, 4).map((pair) => (
            <div key={`${pair.a.id}:${pair.b.id}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{pair.a.name} + {pair.b.name}</span>
              <div className="text-right shrink-0">
                <span className="font-mono font-bold">{pair.score}%</span>
                <span className="text-[10px] text-muted-foreground ml-2">{pair.matchesTogether} GP</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default function TeamBuilder() {
  const {
    players,
    matches,
    playerAvatars,
    isAdmin,
    adminCreateChallengePairings,
    sendDiscordTeams,
  } = useData();

  const [mode, setMode] = useState("balance");
  const [required, setRequired] = useState(4);
  const [selected, setSelected] = useState([]);
  const [manualA, setManualA] = useState([]);
  const [manualB, setManualB] = useState([]);
  const [query, setQuery] = useState("");
  const [autoResult, setAutoResult] = useState(null);
  const [stake, setStake] = useState("5");
  const [platform, setPlatform] = useState("cmg");
  const [sending, setSending] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [game, setGame] = useState("ALL");
  const [matchMode, setMatchMode] = useState("ALL");
  const [whyOpen, setWhyOpen] = useState(false);

  const perTeam = required / 2;

  const context = useMemo(
    () => computeContextStats(matches, { game, mode: matchMode }),
    [matches, game, matchMode]
  );

  const contextMatches = context.matches;

  const contextualPlayerMap = useMemo(() => {
    const map = {};
    players.forEach((player) => {
      map[player.id] =
        game === "ALL" && matchMode === "ALL"
          ? player
          : playerForContext(player, context.stats || {});
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

  const manualResult = useMemo(
    () =>
      manualTeamA.length === perTeam && manualTeamB.length === perTeam
        ? analyzeManualTeams(manualTeamA, manualTeamB, contextMatches)
        : null,
    [manualTeamA, manualTeamB, contextMatches, perTeam]
  );

  const result = mode === "manual" ? manualResult : autoResult;

  const matchBounties = useMemo(
    () => result ? detectLobbyBounties(result.teamA, result.teamB, contextMatches) : [],
    [result, contextMatches]
  );

  const chemistryPreview = useMemo(() => {
    const pool = mode === "manual"
      ? [...manualTeamA, ...manualTeamB]
      : selectedPlayers;

    const pairs = [];
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        pairs.push({
          a: pool[i],
          b: pool[j],
          ...duoChemistry(pool[i], pool[j], contextMatches),
        });
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }, [mode, selectedPlayers, manualTeamA, manualTeamB, contextMatches]);

  const filtered = useMemo(
    () => players.filter((player) => player.name.toLowerCase().includes(query.toLowerCase())),
    [players, query]
  );

  const resetDraft = () => {
    setSelected([]);
    setManualA([]);
    setManualB([]);
    setAutoResult(null);
  };

  const changeFormat = (count) => {
    setRequired(count);
    resetDraft();
  };

  const changeMode = (nextMode) => {
    setMode(nextMode);
    resetDraft();
  };

  const changeGame = (nextGame) => {
    setGame(nextGame);
    setAutoResult(null);
    setWhyOpen(false);
  };

  const changeMatchMode = (nextMode) => {
    setMatchMode(nextMode);
    setAutoResult(null);
    setWhyOpen(false);
  };

  const toggleAutoPlayer = (id) => {
    setAutoResult(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= required) {
        toast.error(`This draft allows ${required} players`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const assignManual = (id, team) => {
    setAutoResult(null);

    if (team === "A") {
      if (manualA.includes(id)) {
        setManualA((prev) => prev.filter((item) => item !== id));
        return;
      }
      if (manualA.length >= perTeam) {
        toast.error(`Team A already has ${perTeam} players`);
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
      toast.error(`Team B already has ${perTeam} players`);
      return;
    }
    setManualA((prev) => prev.filter((item) => item !== id));
    setManualB((prev) => [...prev, id]);
  };

  const generateDraft = () => {
    if (selectedPlayers.length !== required) {
      toast.error(`Select exactly ${required} players`);
      return;
    }

    let draft = null;

    if (mode === "balance") {
      draft = draftTeamsBalanced(selectedPlayers, contextMatches);
    } else {
      draft = draftTeamsByChemistry(selectedPlayers, contextMatches);
    }

    if (!draft) {
      toast.error("Unable to generate these teams");
      return;
    }

    setAutoResult(draft);
    setWhyOpen(false);
    toast.success(
      game === "ALL"
        ? `${mode === "balance" ? "Balanced teams" : "Chemistry draft"} generated · ${draft.balanceScore}% balance`
        : `${mode === "balance" ? "Balanced teams" : "Chemistry draft"} for ${game} · ${draft.balanceScore}% balance`
    );
  };

  const autoPick = () => {
    const ids = [...players]
      .sort((a, b) =>
        Number(contextualPlayerMap[b.id]?.totalMatches || 0) -
        Number(contextualPlayerMap[a.id]?.totalMatches || 0)
      )
      .slice(0, required)
      .map((player) => player.id);

    if (mode !== "manual") {
      setSelected(ids);
      setAutoResult(null);
      return;
    }

    setManualA(ids.slice(0, perTeam));
    setManualB(ids.slice(perTeam, required));
  };

  const createChalls = async () => {
    if (!result || !isAdmin) return;

    const amount = Number(String(stake).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid chall amount");
      return;
    }

    setSending(true);
    const created = await adminCreateChallengePairings(
      result.pairings.map((pair) => ({
        challengerPlayerId: pair.playerA.id,
        challengedPlayerId: pair.playerB.id,
        amount,
        platform,
      }))
    );
    setSending(false);

    if (!created) return;
    toast.success(`${created.length} chall pairings created from this team build`);
  };

  const sendCurrentTeamsToDiscord = async () => {
    if (!result) return;
    const ok = await sendDiscordTeams({
      teamA: result.teamA.map((player) => player.name),
      teamB: result.teamB.map((player) => player.name),
      game: game === "ALL" ? "All Games" : game,
      mode: matchMode === "ALL" ? "All Modes" : matchMode,
      balanceScore: result.balanceScore,
      pairings: result.pairings.map((pair) => ({
        playerA: pair.playerA.name,
        playerB: pair.playerB.name,
        amount: Number(String(stake).replace(",", ".")) || 0,
      })),
    });
    if (ok) toast.success("Teams sent to Discord");
  };

  const reportPairings = result
    ? result.pairings.map((pair) => ({
        playerAId: pair.playerA.id,
        playerBId: pair.playerB.id,
        amount: Number(String(stake).replace(",", ".")) || 0,
        platform,
      }))
    : [];

  const autoCount = selected.length;
  const manualCount = manualA.length + manualB.length;

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Play</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Team Builder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select the lobby, choose how to split it, then generate the teams.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={autoPick}
              className="m8-action border border-[#222834] bg-[#0F1218] hover:border-[#394150]"
            >
              <Sparkles size={15} className="mr-2" /> Auto-pick
            </Button>
            <Button
              variant="ghost"
              onClick={resetDraft}
              className="m8-action border border-[#222834] bg-[#0F1218] hover:border-[#394150]"
            >
              <RotateCcw size={15} className="mr-2" /> Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 mt-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Format</div>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((format) => (
                <button
                  type="button"
                  key={format.key}
                  aria-pressed={required === format.key}
                  onClick={() => changeFormat(format.key)}
                  className={`h-11 rounded-xl border text-sm font-bold transition-all ${
                    required === format.key
                      ? "bg-white text-black border-white"
                      : "bg-[#0F1218] border-[#222834] text-muted-foreground hover:text-white"
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Team method</div>
            <select
              value={mode}
              onChange={(event) => changeMode(event.target.value)}
              className="w-full h-11 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm font-semibold"
              aria-label="Team method"
            >
              <option value="balance">Auto Balance</option>
              <option value="chemistry">Chemistry Draft</option>
              <option value="manual">Manual Draft</option>
            </select>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Lobby</div>
            <h3 className="font-display text-xl font-black">Choose players</h3>
          </div>
          <span className={`font-mono font-bold ${
            (mode === "manual" ? manualCount === required : autoCount === required)
              ? "text-emerald-400"
              : "text-[#D5A33A]"
          }`}>
            {mode === "manual" ? manualCount : autoCount}/{required}
          </span>
        </div>

        {mode === "manual" && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-xl bg-magma/[0.06] border border-magma/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">Alpha</span>
              <span className="float-right font-mono font-bold">{manualA.length}/{perTeam}</span>
            </div>
            <div className="rounded-xl bg-[#65D5D3]/[0.05] border border-[#65D5D3]/20 px-3 py-2">
              <span className="text-xs text-muted-foreground">Bravo</span>
              <span className="float-right font-mono font-bold">{manualB.length}/{perTeam}</span>
            </div>
          </div>
        )}

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
            const inA = manualA.includes(player.id);
            const inB = manualB.includes(player.id);

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                  active || inA || inB
                    ? "bg-white/[0.04] border-[#343B48]"
                    : "m8-panel-quiet"
                }`}
              >
                {mode !== "manual" ? (
                  <button
                    type="button"
                    onClick={() => toggleAutoPlayer(player.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      active ? "bg-magma border-magma" : "border-[#343B48]"
                    }`}
                    aria-label={active ? "Remove player" : "Add player"}
                  >
                    {active && <Check size={13} />}
                  </button>
                ) : (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => assignManual(player.id, "A")}
                      aria-pressed={inA}
                      className={`w-8 h-8 rounded-lg border text-xs font-black ${
                        inA
                          ? "bg-magma border-magma text-white"
                          : "bg-[#151923] border-[#343B48] text-muted-foreground"
                      }`}
                    >
                      A
                    </button>
                    <button
                      type="button"
                      onClick={() => assignManual(player.id, "B")}
                      aria-pressed={inB}
                      className={`w-8 h-8 rounded-lg border text-xs font-black ${
                        inB
                          ? "bg-[#65D5D3] border-[#65D5D3] text-black"
                          : "bg-[#151923] border-[#343B48] text-muted-foreground"
                      }`}
                    >
                      B
                    </button>
                  </div>
                )}

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
              </div>
            );
          })}
        </div>

        {mode !== "manual" ? (
          <Button
            onClick={generateDraft}
            disabled={selected.length !== required}
            className="w-full h-12 mt-4 bg-magma hover:bg-[#ff3c4c] font-bold rounded-xl"
          >
            <Swords size={17} className="mr-2" /> Generate Teams
          </Button>
        ) : (
          <div className="mt-4 rounded-xl bg-[#0F1218] border border-[#1D222C] px-4 py-3 text-xs text-muted-foreground text-center">
            Teams appear automatically when Alpha and Bravo are complete.
          </div>
        )}
      </section>

      {result && (
        <section className="m8-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <div className="brand-kicker mb-1">Ready</div>
              <h3 className="font-display text-2xl font-black">Alpha vs Bravo</h3>
            </div>
            <BalanceBadge score={result.balanceScore} verdict={result.balanceVerdict} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 lg:items-center">
            <div className="rounded-2xl bg-magma/[0.04] border border-magma/15 p-4">
              <div className="text-xs uppercase tracking-widest text-magma font-black mb-3">Alpha</div>
              <div className="space-y-2">
                {result.teamA.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1">{player.name}</div>
                    <span className="font-mono text-xs text-muted-foreground">{player.currentElo}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex w-12 h-12 rounded-full border border-[#2A303B] bg-[#0F1218] items-center justify-center font-display font-black text-muted-foreground">
              VS
            </div>

            <div className="rounded-2xl bg-[#65D5D3]/[0.035] border border-[#65D5D3]/15 p-4">
              <div className="text-xs uppercase tracking-widest text-[#65D5D3] font-black mb-3">Bravo</div>
              <div className="space-y-2">
                {result.teamB.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={36} avatarUrl={playerAvatars[player.id]} />
                    <div className="font-semibold truncate flex-1">{player.name}</div>
                    <span className="font-mono text-xs text-muted-foreground">{player.currentElo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
              <Button
                onClick={sendCurrentTeamsToDiscord}
                className="h-11 bg-[#5865F2] hover:bg-[#6875F5] text-white font-semibold"
              >
                <MessageCircle size={16} className="mr-2" /> Send to Discord
              </Button>
              <Button
                onClick={() => setRecordOpen(true)}
                className="h-11 bg-magma hover:bg-[#ff3c4c] text-white font-semibold"
              >
                <Trophy size={16} className="mr-2" /> Report Result
              </Button>
            </div>
          )}
        </section>
      )}

      <button
        type="button"
        onClick={() => setWhyOpen((open) => !open)}
        className="w-full h-11 rounded-xl border border-[#222834] bg-[#0F1218] text-sm font-bold text-[#AAB1BE] hover:text-white hover:border-[#394150] transition-all"
      >
        {whyOpen ? "Hide advanced details" : "Advanced details"}
      </button>

      {whyOpen && (
        <section className="m8-panel rounded-2xl p-5 space-y-5">
          <div>
            <div className="brand-kicker mb-1">Context</div>
            <h3 className="font-display text-xl font-black">Game & mode</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Optional: use a specific game or mode history when calculating balance and chemistry.
            </p>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Game</div>
              <div className="flex flex-wrap gap-1.5" data-testid="team-builder-game">
                <button
                  type="button"
                  data-testid="team-builder-game-ALL"
                  aria-pressed={game === "ALL"}
                  onClick={() => changeGame("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    game === "ALL"
                      ? "bg-white text-black border-white"
                      : "bg-[#0F1218] text-muted-foreground border-[#222834] hover:text-white"
                  }`}
                >
                  All Games
                </button>
                {GAMES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    data-testid={`team-builder-game-${item}`}
                    aria-pressed={game === item}
                    onClick={() => changeGame(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      game === item
                        ? "bg-white text-black border-white"
                        : "bg-[#0F1218] text-muted-foreground border-[#222834] hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Mode</div>
              <div className="flex flex-wrap gap-1.5" data-testid="team-builder-mode">
                <button
                  type="button"
                  aria-pressed={matchMode === "ALL"}
                  onClick={() => changeMatchMode("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    matchMode === "ALL"
                      ? "bg-white text-black border-white"
                      : "bg-[#0F1218] text-muted-foreground border-[#222834] hover:text-white"
                  }`}
                >
                  All Modes
                </button>
                {MATCH_MODES.map((item) => (
                  <button
                    type="button"
                    key={item}
                    aria-pressed={matchMode === item}
                    onClick={() => changeMatchMode(item)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      matchMode === item
                        ? "bg-white text-black border-white"
                        : "bg-[#0F1218] text-muted-foreground border-[#222834] hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {chemistryPreview.length > 0 && (
            <div className="pt-5 border-t border-[#1D222C]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="brand-kicker mb-1">Chemistry</div>
                  <h3 className="font-display text-xl font-black">Compatibility</h3>
                </div>
                <Zap size={18} className="text-[#D5A33A]" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                {chemistryPreview.slice(0, 6).map((pair) => (
                  <div key={`${pair.a.id}:${pair.b.id}`} className="m8-panel-quiet rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold truncate">{pair.a.name} + {pair.b.name}</div>
                      <ChemistryBadge score={pair.score} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pair.matchesTogether
                        ? `${pair.matchesTogether} together · ${pair.winRate}% duo WR`
                        : "No shared matches yet"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <>
              <div className="pt-5 border-t border-[#1D222C]">
                <div className="brand-kicker mb-1">Analytics</div>
                <h3 className="font-display text-xl font-black">Lobby details</h3>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
                  {[
                    ["Lobby Quality", result.lobbyQuality],
                    ["Balance", result.balanceScore],
                    ["Role Balance", result.roleBalanceScore],
                    ["Freshness", result.freshnessScore],
                  ].map(([label, value]) => (
                    <div key={label} className="m8-stat-card">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
                      <div className="font-mono font-bold text-lg mt-1">{value}%</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="m8-stat-card">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Alpha Power</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthA}</div>
                  </div>
                  <div className="m8-stat-card">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Power Gap</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthDiff}</div>
                  </div>
                  <div className="m8-stat-card">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Bravo Power</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthB}</div>
                  </div>
                </div>

                {(result.why || []).length > 0 && (
                  <div className="m8-panel-quiet rounded-xl p-4 mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(result.why || []).map((reason) => (
                      <div key={reason} className="text-xs text-muted-foreground">
                        <span className="text-emerald-400 mr-2">✓</span>{reason}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-[#1D222C]">
                <div className="brand-kicker mb-1">Detailed teams</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
                  <TeamCard
                    label="Alpha"
                    team={result.teamA}
                    chemistry={result.chemistryA}
                    playerAvatars={playerAvatars}
                    game={game}
                    matchMode={matchMode}
                  />
                  <TeamCard
                    label="Bravo"
                    team={result.teamB}
                    chemistry={result.chemistryB}
                    playerAvatars={playerAvatars}
                    game={game}
                    matchMode={matchMode}
                  />
                </div>
              </div>

              <div className="pt-5 border-t border-[#1D222C]" data-testid="match-bounties">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="brand-kicker mb-1">Objectives</div>
                    <h3 className="font-display text-xl font-black">Match Bounties</h3>
                  </div>
                  <Target size={19} className="text-[#D5A33A]" />
                </div>

                {matchBounties.length === 0 ? (
                  <div className="m8-panel-quiet rounded-xl py-6 text-center text-sm text-muted-foreground mt-3">
                    No special bounty for this lobby.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    {matchBounties.map((bounty) => (
                      <div key={bounty.key} className="m8-panel-quiet rounded-xl p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="font-display font-bold">{bounty.title}</div>
                          <span className="font-mono text-sm font-black text-[#D5A33A]">+{bounty.reward}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{bounty.detail}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-[#1D222C]">
                <div>
                  <div className="brand-kicker mb-1">Pairings</div>
                  <h3 className="font-display text-xl font-black">Cross-team matchups</h3>
                </div>

                <div className="space-y-2 mt-3">
                  {result.pairings.map((pair) => (
                    <div key={pair.playerA.id} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                      <div className="font-semibold truncate">{pair.playerA.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">gap {pair.ratingGap}</div>
                      <div className="font-semibold truncate text-right">{pair.playerB.name}</div>
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr] gap-3 mt-4">
                    <select
                      value={platform}
                      onChange={(event) => setPlatform(event.target.value)}
                      className="h-11 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
                    >
                      <option value="cmg">CMG</option>
                      <option value="paypal">PayPal</option>
                      <option value="revolut">Revolut</option>
                    </select>

                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                      <Input
                        value={stake}
                        onChange={(event) => setStake(event.target.value)}
                        className="pl-7 bg-[#0F1218] border-[#222834]"
                        inputMode="decimal"
                      />
                    </div>

                    <Button
                      onClick={createChalls}
                      disabled={sending}
                      className="h-11 bg-magma hover:bg-[#ff3c4c] font-bold"
                    >
                      <WalletCards size={16} className="mr-2" />
                      {sending ? "Creating..." : "Create Chall Pairings"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <RecordMatchDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        title="Report Match Result"
        initialTeams={result ? {
          teamA: result.teamA.map((player) => player.id),
          teamB: result.teamB.map((player) => player.id),
          pairings: reportPairings,
        } : null}
        defaultGame={game !== "ALL" ? game : undefined}
        defaultMode={matchMode !== "ALL" ? matchMode : undefined}
      />
    </div>
  );
}
