import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { balanceTeams, playerRating, computeGameStats, playerForGame } from "@/lib/elo";
import { PlayerAvatar, EloBadge, WinRatePill } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { GAMES } from "@/lib/demoData";
import { Swords, Search, Sparkles, RotateCcw, Trophy, Check, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const TeamPanel = ({ label, team, strength, color, prob, isFavored }) => (
  <div
    className="rounded-2xl p-5 relative overflow-hidden"
    style={{ background: `${color}0d`, border: `1px solid ${color}55`, boxShadow: `0 0 24px ${color}1a` }}
    data-testid={`team-panel-${label.toLowerCase()}`}
  >
    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
      <div className="flex items-center gap-2">
        <span className="w-4 h-4 rounded-sm" style={{ background: color }} />
        <h3 className="font-display font-extrabold text-xl" style={{ color }}>{label}</h3>
        {isFavored && <Trophy size={16} style={{ color }} />}
      </div>
      <div className="text-right">
        <div className="font-mono text-2xl font-extrabold text-white">{prob}%</div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Prob</div>
      </div>
    </div>
    <div className="space-y-2">
      {team.map((p) => (
        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-black/25">
          <PlayerAvatar name={p.name} elo={p.currentElo} size={34} />
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{p.name}</div>
            <div className="text-xs text-muted-foreground">WR <WinRatePill player={p} /></div>
          </div>
          <EloBadge elo={p.currentElo} />
        </div>
      ))}
    </div>
    <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: `${color}33` }}>
      <span className="text-xs uppercase tracking-widest text-muted-foreground">Squad Power</span>
      <span className="font-mono font-bold text-lg" style={{ color }}>{strength}</span>
    </div>
  </div>
);

const FORMATS = [
  { key: 4, label: "2v2" },
  { key: 6, label: "3v3" },
  { key: 8, label: "4v4" },
];

export default function TeamBalancer() {
  const { players, matches, isAdmin, sendDiscordTeams } = useData();
  const [required, setRequired] = useState(8);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [game, setGame] = useState("ALL");
  const [balancedGame, setBalancedGame] = useState("ALL");
  const [recordOpen, setRecordOpen] = useState(false);

  const changeFormat = (n) => {
    setRequired(n);
    setResult(null);
    setSelected((prev) => prev.slice(0, n));
  };

  const changeGame = (g) => {
    setGame(g);
    setResult(null);
  };

  const toggle = (id) => {
    setResult(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= required) {
        toast.error(`This format allows only ${required} players`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const filtered = useMemo(
    () => players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [players, query]
  );

  const generate = () => {
    if (selected.length !== required) {
      toast.error(`Select exactly ${required} players`);
      return;
    }
    let chosen = selected.map((id) => players.find((p) => p.id === id));
    if (game !== "ALL") {
      const gs = computeGameStats(matches, game);
      chosen = chosen.map((p) => playerForGame(p, gs));
    }
    const r = balanceTeams(chosen);
    setResult(r);
    setBalancedGame(game);
    toast.success(
      game === "ALL"
        ? `Balanced squads generated — ${r.balanceScore}% balance`
        : `Balanced for ${game} — ${r.balanceScore}% balance`
    );
  };

  const autoPick = () => {
    const top = [...players].sort((a, b) => b.totalMatches - a.totalMatches).slice(0, required).map((p) => p.id);
    setSelected(top);
    setResult(null);
    toast.success(`Auto-picked ${required} most active players`);
  };

  const clear = () => {
    setSelected([]);
    setResult(null);
  };

  const sendTeamsToDiscord = async () => {
    if (!result) return;
    const ok = await sendDiscordTeams({
      teamA: result.teamA.map((p) => p.name),
      teamB: result.teamB.map((p) => p.name),
      game: balancedGame === "ALL" ? "All Games" : balancedGame,
      balanceScore: result.balanceScore,
    });
    if (ok) toast.success("Teams sent to Discord");
  };

  const perTeam = required / 2;

  return (
    <div className="space-y-6">
      <div>
        <div className="brand-kicker mb-1">Matchmaking</div>
        <h2 className="font-display text-2xl font-extrabold">Team Balancer</h2>
        <p className="text-sm text-[#7F8795] mt-1">Choose the lobby and generate the most balanced split.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Selection */}
        <div className="lg:col-span-5 card-surface rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Swords size={18} className="text-magma" />
              <h3 className="font-display font-bold text-lg">Select {required} Players</h3>
            </div>
            <span className={`font-mono font-bold ${selected.length === required ? "text-emerald-400" : "text-[#D5A33A]"}`} data-testid="balancer-count">
              {selected.length}/{required}
            </span>
          </div>
          {/* Format selector */}
          <div className="flex items-center gap-2 mb-3" data-testid="balancer-format">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                data-testid={`balancer-format-${f.label}`}
                onClick={() => changeFormat(f.key)}
                className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                  required === f.key ? "bg-magma text-white magma-glow" : "bg-[#0F1218] text-muted-foreground border border-[#222834] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {/* Game selector — balance using that game's stats */}
          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Balance by game</div>
            <div className="flex flex-wrap gap-1.5" data-testid="balancer-game">
              <button
                data-testid="balancer-game-ALL"
                onClick={() => changeGame("ALL")}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                  game === "ALL" ? "bg-white text-black" : "bg-[#0F1218] text-muted-foreground border border-[#222834] hover:text-white"
                }`}
              >
                All Games
              </button>
              {GAMES.map((g) => (
                <button
                  key={g}
                  data-testid={`balancer-game-${g}`}
                  onClick={() => changeGame(g)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                    game === g ? "bg-white text-black" : "bg-[#0F1218] text-muted-foreground border border-[#222834] hover:text-white"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button variant="ghost" size="sm" onClick={autoPick} data-testid="balancer-autopick-btn" className="text-xs">
              <Sparkles size={14} className="mr-1" /> Auto-pick
            </Button>
            <Button variant="ghost" size="sm" onClick={clear} data-testid="balancer-clear-btn" className="text-xs">
              <RotateCcw size={14} className="mr-1" /> Clear
            </Button>
          </div>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="balancer-search"
              placeholder="Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
            />
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const isSel = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  data-testid={`balancer-player-${p.id}`}
                  onClick={() => toggle(p.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all"
                  style={{
                    background: isSel ? "rgba(255,42,59,0.12)" : "#181B26",
                    border: `1px solid ${isSel ? "rgba(255,42,59,0.5)" : "#222834"}`,
                  }}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: isSel ? "#FF2A3B" : "transparent", border: `1px solid ${isSel ? "#FF2A3B" : "#39414F"}` }}>
                    {isSel && <Check size={13} className="text-white" />}
                  </div>
                  <PlayerAvatar name={p.name} elo={p.currentElo} size={32} />
                  <span className="flex-1 font-medium truncate">{p.name}</span>
                  <span className="hidden sm:inline font-mono text-xs text-muted-foreground">{Math.round(playerRating(p))}</span>
                  <EloBadge elo={p.currentElo} />
                </button>
              );
            })}
          </div>
          <Button
            onClick={generate}
            disabled={selected.length !== required}
            data-testid="generate-teams-button"
            className="w-full mt-4 h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold text-base magma-glow"
          >
            <Swords size={18} className="mr-2" /> Generate Balanced Teams
          </Button>
        </div>

        {/* Result */}
        <div className="lg:col-span-7">
          {!result ? (
            <div className="card-surface rounded-xl p-10 h-full flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-[#0B0D12] border border-[#282E39] flex items-center justify-center mb-5">
                <img src={`${process.env.PUBLIC_URL}/logo-mark.svg`} alt="" className="w-14 h-14 object-contain" />
              </div>
              <h3 className="font-display text-2xl font-bold">Balance Engine Ready</h3>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                Choose a format (2v2, 3v3 or 4v4), pick your {required} players and the engine tests every
                possible split to find the fairest match — weighting 60% Peak Elo, 25% Current Elo, 15% Win Rate.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-up" data-testid="balancer-result">
              {/* Balance score */}
              <div className="card-surface rounded-2xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Match Balance</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#171B23] text-xs border border-[#2B313E] text-[#D5A33A] font-bold" data-testid="balance-game-badge">
                      {balancedGame === "ALL" ? "All Games" : balancedGame}
                    </span>
                    <span className="font-mono text-3xl font-extrabold text-emerald-400" data-testid="balance-score">
                      {result.balanceScore}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[#242938] overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${result.balanceScore}%`, background: "linear-gradient(90deg,#FF2A3B,#FF5967)" }} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3 text-sm">
                  <span className="text-muted-foreground">Projected Winner</span>
                  <span className="font-mono">
                    <span className="text-magma font-bold">Alpha {result.probA}%</span>
                    <span className="text-muted-foreground mx-1">-</span>
                    <span className="text-[#D5A33A] font-bold">{result.probB}% Bravo</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TeamPanel label="Alpha" team={result.teamA} strength={result.strengthA} color="#FF2A3B" prob={result.probA} isFavored={result.probA >= result.probB} />
                <TeamPanel label="Bravo" team={result.teamB} strength={result.strengthB} color="#D5A33A" prob={result.probB} isFavored={result.probB > result.probA} />
              </div>

              {isAdmin ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button
                    onClick={sendTeamsToDiscord}
                    data-testid="balancer-send-discord-btn"
                    className="w-full h-12 rounded-xl bg-[#5865F2] hover:bg-[#6875f5] text-white font-semibold"
                  >
                    <MessageCircle size={18} className="mr-2" /> Send to Discord
                  </Button>
                  <Button
                    onClick={() => setRecordOpen(true)}
                    data-testid="balancer-report-result-btn"
                    className="w-full h-12 rounded-xl bg-[#0F1218] border border-magma/30 text-magma hover:bg-magma/10 font-semibold"
                  >
                    <Trophy size={18} className="mr-2" /> Report Result & Update Elo
                  </Button>
                </div>
              ) : (
                <div className="w-full h-12 rounded-xl bg-[#0F1218] border border-[#222834] text-muted-foreground text-sm flex items-center justify-center" data-testid="balancer-readonly-note">
                  Sign in as Admin to send teams or report the result
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <RecordMatchDialog
        open={recordOpen}
        onOpenChange={setRecordOpen}
        title="Report Match Result"
        defaultGame={balancedGame !== "ALL" ? balancedGame : undefined}
        initialTeams={result ? { teamA: result.teamA.map((p) => p.id), teamB: result.teamB.map((p) => p.id) } : null}
      />
    </div>
  );
}
