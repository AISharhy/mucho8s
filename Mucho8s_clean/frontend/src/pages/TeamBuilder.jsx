import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { balanceTeams } from "@/lib/elo";
import {
  analyzeManualTeams,
  duoChemistry,
  draftTeamsByChemistry,
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
} from "lucide-react";
import { toast } from "sonner";

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

const TeamCard = ({ label, team, chemistry, playerAvatars }) => (
  <div className="card-surface rounded-2xl p-5">
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
            <div className="text-xs text-muted-foreground">{player.currentElo} Elo</div>
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

  const perTeam = required / 2;

  const selectedPlayers = useMemo(
    () => selected.map((id) => players.find((player) => player.id === id)).filter(Boolean),
    [selected, players]
  );

  const manualTeamA = useMemo(
    () => manualA.map((id) => players.find((player) => player.id === id)).filter(Boolean),
    [manualA, players]
  );

  const manualTeamB = useMemo(
    () => manualB.map((id) => players.find((player) => player.id === id)).filter(Boolean),
    [manualB, players]
  );

  const manualResult = useMemo(
    () =>
      manualTeamA.length === perTeam && manualTeamB.length === perTeam
        ? analyzeManualTeams(manualTeamA, manualTeamB, matches)
        : null,
    [manualTeamA, manualTeamB, matches, perTeam]
  );

  const result = mode === "manual" ? manualResult : autoResult;

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
          ...duoChemistry(pool[i], pool[j], matches),
        });
      }
    }
    return pairs.sort((a, b) => b.score - a.score);
  }, [mode, selectedPlayers, manualTeamA, manualTeamB, matches]);

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
      const balanced = balanceTeams(selectedPlayers);
      if (balanced) draft = analyzeManualTeams(balanced.teamA, balanced.teamB, matches);
    } else {
      draft = draftTeamsByChemistry(selectedPlayers, matches);
    }

    if (!draft) {
      toast.error("Unable to generate these teams");
      return;
    }

    setAutoResult(draft);
    toast.success(`${mode === "balance" ? "Balanced teams" : "Chemistry draft"} generated · ${draft.balanceScore}% balance`);
  };

  const autoPick = () => {
    const ids = [...players]
      .sort((a, b) => Number(b.totalMatches || 0) - Number(a.totalMatches || 0))
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
      game: "Team Builder",
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
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Competition Lab</div>
          <h2 className="font-display text-3xl font-extrabold">Team Builder</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Build teams with pure balance, chemistry-based drafting or complete manual control.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={autoPick} className="border border-[#222834] bg-[#0F1218]">
            <Sparkles size={15} className="mr-2" /> Auto-pick players
          </Button>
          <Button variant="ghost" onClick={resetDraft} className="border border-[#222834] bg-[#0F1218]">
            <RotateCcw size={15} className="mr-2" /> Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-3xl">
        <button
          type="button"
          onClick={() => changeMode("balance")}
          className={`rounded-xl border p-4 text-left transition-all ${
            mode === "balance"
              ? "bg-magma/10 border-magma/40"
              : "bg-[#0F1218] border-[#222834] text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            <Gauge size={17} /> Auto Balance
          </div>
          <div className="text-xs mt-1">Creates the fairest possible teams.</div>
        </button>

        <button
          type="button"
          onClick={() => changeMode("chemistry")}
          className={`rounded-xl border p-4 text-left transition-all ${
            mode === "chemistry"
              ? "bg-[#D5A33A]/10 border-[#D5A33A]/35"
              : "bg-[#0F1218] border-[#222834] text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            <FlaskConical size={17} /> Chemistry Draft
          </div>
          <div className="text-xs mt-1">Mixes compatibility and competitive balance.</div>
        </button>

        <button
          type="button"
          onClick={() => changeMode("manual")}
          className={`rounded-xl border p-4 text-left transition-all ${
            mode === "manual"
              ? "bg-white/[0.06] border-white/25"
              : "bg-[#0F1218] border-[#222834] text-muted-foreground"
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            <UsersRound size={17} /> Manual Draft
          </div>
          <div className="text-xs mt-1">You choose both teams; the engine evaluates them.</div>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-5 card-surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <UsersRound size={18} className="text-magma" />
              <h3 className="font-display font-bold text-lg">
                {mode === "manual" ? "Build Teams" : "Player Pool"}
              </h3>
            </div>
            <span className={`font-mono font-bold ${
              (mode === "manual" ? manualCount === required : autoCount === required)
                ? "text-emerald-400"
                : "text-[#D5A33A]"
            }`}>
              {mode === "manual" ? manualCount : autoCount}/{required}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {FORMATS.map((format) => (
              <button
                key={format.key}
                onClick={() => changeFormat(format.key)}
                className={`h-10 rounded-xl border text-sm font-bold transition-all ${
                  required === format.key
                    ? "bg-white text-black border-white"
                    : "bg-[#0F1218] border-[#222834] text-muted-foreground hover:text-white"
                }`}
              >
                {format.label}
              </button>
            ))}
          </div>

          {mode === "manual" && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl bg-magma/[0.06] border border-magma/20 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team A</div>
                <div className="font-mono font-bold mt-1">{manualA.length}/{perTeam}</div>
              </div>
              <div className="rounded-xl bg-[#65D5D3]/[0.05] border border-[#65D5D3]/20 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team B</div>
                <div className="font-mono font-bold mt-1">{manualB.length}/{perTeam}</div>
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

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((player) => {
              const active = selected.includes(player.id);
              const inA = manualA.includes(player.id);
              const inB = manualB.includes(player.id);

              return (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                    active || inA || inB
                      ? "bg-white/[0.04] border-[#343B48]"
                      : "bg-[#0F1218] border-[#1D222C]"
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
                    size={36}
                    avatarUrl={playerAvatars[player.id]}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{player.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {player.totalMatches || 0} matches · {player.currentElo} Elo
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {mode === "auto" ? (
            <Button
              onClick={generateDraft}
              disabled={selected.length !== required}
              className="w-full h-12 mt-4 bg-magma hover:bg-[#ff3c4c] font-bold rounded-xl"
            >
              {mode === "balance" ? <Gauge size={17} className="mr-2" /> : <FlaskConical size={17} className="mr-2" />}
              {mode === "balance" ? "Generate Balanced Teams" : "Generate Chemistry Draft"}
            </Button>
          ) : (
            <div className="mt-4 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3 text-xs text-muted-foreground">
              Manual mode updates automatically as soon as both teams are complete.
            </div>
          )}
        </div>

        <div className="xl:col-span-7 space-y-5">
          <div className="card-surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="brand-kicker mb-1">Chemistry Scan</div>
                <h3 className="font-display text-xl font-bold">Compatibility</h3>
              </div>
              <Zap size={19} className="text-[#D5A33A]" />
            </div>

            {chemistryPreview.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Select at least two players to compare their history.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {chemistryPreview.slice(0, 6).map((pair) => (
                  <div key={`${pair.a.id}:${pair.b.id}`} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold truncate">{pair.a.name} + {pair.b.name}</div>
                      <ChemistryBadge score={pair.score} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {pair.matchesTogether
                        ? `${pair.matchesTogether} together · ${pair.winsTogether} wins · ${pair.winRate}% duo WR`
                        : "No shared matches yet · neutral starting chemistry"}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-[#697181] mt-2">
                      {pair.label} · {pair.eloGap} Elo gap
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!result ? (
            <div className="card-surface rounded-2xl min-h-[330px] flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#0F1218] border border-[#282E39] flex items-center justify-center">
                <Gauge size={24} className="text-magma" />
              </div>
              <h3 className="font-display text-2xl font-bold mt-4">
                {mode === "manual" ? "Build both teams" : "Team Builder Ready"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">
                {mode === "manual"
                  ? `Assign ${perTeam} players to Team A and ${perTeam} to Team B. The balance score will appear automatically.`
                  : mode === "balance"
                    ? "The engine searches every split to create the fairest matchup."
                    : "The engine searches possible splits and combines chemistry with competitive balance."}
              </p>
            </div>
          ) : (
            <>
              <div className="card-surface rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="brand-kicker mb-1">
                      {mode === "manual" ? "Manual Team Analysis" : mode === "balance" ? "Balanced Teams" : "Chemistry Draft"}
                    </div>
                    <h3 className="font-display text-2xl font-extrabold">
                      {result.balanceVerdict}
                    </h3>
                    <div className="text-sm text-muted-foreground mt-1">
                      Overall fit {result.draftScore}% · Team chemistry {result.chemistryScore}%
                    </div>
                  </div>
                  <BalanceBadge score={result.balanceScore} verdict={result.balanceVerdict} />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team A Power</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthA}</div>
                  </div>
                  <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Power Gap</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthDiff}</div>
                  </div>
                  <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Team B Power</div>
                    <div className="font-mono font-bold text-lg mt-1">{result.strengthB}</div>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-[#1D222C] overflow-hidden mt-4">
                  <div
                    className="h-full bg-gradient-to-r from-[#FF2A3B] to-[#65D5D3]"
                    style={{ width: `${result.balanceScore}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamCard
                  label="Team A"
                  team={result.teamA}
                  chemistry={result.chemistryA}
                  playerAvatars={playerAvatars}
                />
                <TeamCard
                  label="Team B"
                  team={result.teamB}
                  chemistry={result.chemistryB}
                  playerAvatars={playerAvatars}
                />
              </div>

              <div className="card-surface rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="brand-kicker mb-1">Suggested Matchups</div>
                    <h3 className="font-display text-xl font-bold">Cross-team pairings</h3>
                  </div>
                  <Swords size={19} className="text-magma" />
                </div>

                <div className="space-y-2">
                  {result.pairings.map((pair) => (
                    <div key={pair.playerA.id} className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                      <div className="font-semibold truncate">{pair.playerA.name}</div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        gap {pair.ratingGap}
                      </div>
                      <div className="font-semibold truncate text-right">{pair.playerB.name}</div>
                    </div>
                  ))}
                </div>

                {isAdmin && (
                  <div className="mt-5 pt-5 border-t border-[#1D222C]">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1.2fr] gap-3">
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
                    <p className="text-xs text-muted-foreground mt-2">
                      Challs are created only after this confirmation; the Team Builder never sends them automatically.
                    </p>
                  </div>
                )}

                {isAdmin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 pt-4 border-t border-[#1D222C]">
                    <Button
                      onClick={sendCurrentTeamsToDiscord}
                      className="h-11 bg-[#5865F2] hover:bg-[#6875F5] text-white font-semibold"
                    >
                      <MessageCircle size={16} className="mr-2" /> Send Teams to Discord
                    </Button>
                    <Button
                      onClick={() => setRecordOpen(true)}
                      className="h-11 bg-[#0F1218] border border-magma/30 text-magma hover:bg-magma/10 font-semibold"
                    >
                      <Trophy size={16} className="mr-2" /> Report Match Result
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <RecordMatchDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        title="Report Match Result"
        initialTeams={result ? {
          teamA: result.teamA.map((player) => player.id),
          teamB: result.teamB.map((player) => player.id),
          pairings: reportPairings,
        } : null}
      />
    </div>
  );
}
