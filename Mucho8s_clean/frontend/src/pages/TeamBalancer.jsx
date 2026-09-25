import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { balanceTeams, playerRating, computeGameStats, playerForGame } from "@/lib/elo";
import { PlayerAvatar, EloBadge, WinRatePill } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { GAMES } from "@/lib/demoData";
import { Swords, Search, Sparkles, RotateCcw, Trophy, Check, MessageCircle, WalletCards, Shuffle, ArrowRightLeft } from "lucide-react";
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
  const { players, matches, isAdmin, sendDiscordTeams, adminCreateChallengePairings } = useData();
  const [required, setRequired] = useState(8);
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [game, setGame] = useState("ALL");
  const [balancedGame, setBalancedGame] = useState("ALL");
  const [recordOpen, setRecordOpen] = useState(false);
  const [moneyPairings, setMoneyPairings] = useState([]);
  const [defaultStake, setDefaultStake] = useState("5");
  const [defaultPlatform, setDefaultPlatform] = useState("cmg");
  const [sendingPairings, setSendingPairings] = useState(false);
  const [pairingsSent, setPairingsSent] = useState(false);

  const changeFormat = (n) => {
    setRequired(n);
    setResult(null);
    setMoneyPairings([]);
    setPairingsSent(false);
    setSelected((prev) => prev.slice(0, n));
  };

  const changeGame = (g) => {
    setGame(g);
    setResult(null);
    setMoneyPairings([]);
    setPairingsSent(false);
  };

  const toggle = (id) => {
    setResult(null);
    setMoneyPairings([]);
    setPairingsSent(false);
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
    setMoneyPairings([]);
    setPairingsSent(false);
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
    setMoneyPairings([]);
    setPairingsSent(false);
    toast.success(`Auto-picked ${required} most active players`);
  };

  const clear = () => {
    setSelected([]);
    setResult(null);
    setMoneyPairings([]);
    setPairingsSent(false);
  };

  const autoPairMoney = () => {
    if (!result) return;

    const stake = Math.max(0, Number(String(defaultStake).replace(",", ".")) || 0);
    const teamA = [...result.teamA];
    const teamB = [...result.teamB];
    const permutations = (arr) => {
      if (arr.length <= 1) return [arr];
      const out = [];
      arr.forEach((item, index) => {
        const rest = [...arr.slice(0, index), ...arr.slice(index + 1)];
        permutations(rest).forEach((perm) => out.push([item, ...perm]));
      });
      return out;
    };

    let best = null;
    permutations(teamB).forEach((orderedB) => {
      const pairs = teamA.map((a, index) => ({
        playerAId: a.id,
        playerBId: orderedB[index].id,
        amount: stake,
        platform: defaultPlatform,
      }));
      const totalGap = pairs.reduce((sum, pair) => {
        const a = teamA.find((p) => p.id === pair.playerAId);
        const b = teamB.find((p) => p.id === pair.playerBId);
        return sum + Math.abs(playerRating(a) - playerRating(b));
      }, 0);

      if (!best || totalGap < best.totalGap) best = { pairs, totalGap };
    });

    setMoneyPairings(best?.pairs || []);
    toast.success("Money chall pairings balanced automatically");
  };

  const setPairOpponent = (playerAId, playerBId) => {
    setMoneyPairings((prev) => {
      const withoutA = prev.filter((pair) => pair.playerAId !== playerAId);
      const withoutB = withoutA.filter((pair) => pair.playerBId !== playerBId);

      if (!playerBId) return withoutA;

      const existing = prev.find((pair) => pair.playerAId === playerAId);
      return [
        ...withoutB,
        {
          playerAId,
          playerBId,
          amount: existing?.amount ?? Math.max(0, Number(String(defaultStake).replace(",", ".")) || 0),
          platform: existing?.platform || defaultPlatform,
        },
      ];
    });
  };

  const setPairAmount = (playerAId, value) => {
    const amount = Math.max(0, Number(String(value).replace(",", ".")) || 0);
    setMoneyPairings((prev) =>
      prev.map((pair) => pair.playerAId === playerAId ? { ...pair, amount } : pair)
    );
  };

  const challBalance = useMemo(() => {
    if (!result || moneyPairings.length === 0) return null;

    const gaps = moneyPairings.map((pair) => {
      const a = result.teamA.find((p) => p.id === pair.playerAId);
      const b = result.teamB.find((p) => p.id === pair.playerBId);
      if (!a || !b) return 0;
      return Math.abs(playerRating(a) - playerRating(b));
    });

    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const score = Math.max(0, Math.min(100, Math.round(100 - (avgGap / 8))));
    const totalStake = moneyPairings.reduce((sum, pair) => sum + Number(pair.amount || 0), 0);
    return { score, avgGap: Math.round(avgGap), totalStake };
  }, [moneyPairings, result]);

  const setAllPairingPlatform = (platform) => {
    setDefaultPlatform(platform);
    setPairingsSent(false);
    setMoneyPairings((prev) => prev.map((pair) => ({ ...pair, platform })));
  };

  const sendPairingNotifications = async () => {
    if (!result) return;

    if (moneyPairings.length !== result.teamA.length) {
      toast.error("Complete every money pairing first");
      return;
    }

    if (moneyPairings.some((pair) => !pair.playerBId || Number(pair.amount || 0) <= 0)) {
      toast.error("Every pairing needs an opponent and an amount");
      return;
    }

    setSendingPairings(true);

    const created = await adminCreateChallengePairings(
      moneyPairings.map((pair) => ({
        challengerPlayerId: pair.playerAId,
        challengedPlayerId: pair.playerBId,
        amount: Number(pair.amount || 0),
        platform: pair.platform || defaultPlatform,
      }))
    );

    setSendingPairings(false);

    if (!created) return;

    setPairingsSent(true);
    toast.success(
      `Money challs sent — ${created.length * 2} players notified`
    );
  };

  const sendTeamsToDiscord = async () => {
    if (!result) return;
    const ok = await sendDiscordTeams({
      teamA: result.teamA.map((p) => p.name),
      teamB: result.teamB.map((p) => p.name),
      game: balancedGame === "ALL" ? "All Games" : balancedGame,
      balanceScore: result.balanceScore,
      pairings: moneyPairings.map((pair) => ({
        playerA: result.teamA.find((p) => p.id === pair.playerAId)?.name || "Alpha",
        playerB: result.teamB.find((p) => p.id === pair.playerBId)?.name || "Bravo",
        amount: Number(pair.amount || 0),
      })),
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
                    background: isSel ? "rgba(244,63,94,0.12)" : "#1A202B",
                    border: `1px solid ${isSel ? "rgba(244,63,94,0.5)" : "#2B3443"}`,
                  }}
                >
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: isSel ? "#F43F5E" : "transparent", border: `1px solid ${isSel ? "#F43F5E" : "#465264"}` }}>
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
                  <div className="h-full rounded-full transition-all" style={{ width: `${result.balanceScore}%`, background: "linear-gradient(90deg,#F43F5E,#FB7185)" }} />
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
                <TeamPanel label="Alpha" team={result.teamA} strength={result.strengthA} color="#F43F5E" prob={result.probA} isFavored={result.probA >= result.probB} />
                <TeamPanel label="Bravo" team={result.teamB} strength={result.strengthB} color="#C9A45C" prob={result.probB} isFavored={result.probB > result.probA} />
              </div>

              <div className="card-surface rounded-2xl p-5" data-testid="money-chall-pairings">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
                  <div>
                    <div className="brand-kicker mb-1">Money Matchups</div>
                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                      <WalletCards size={18} className="text-[#C9A45C]" />
                      Money Chall Pairings
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Decide who challenges who and for how much. Each Bravo player can be used only once.
                    </p>
                  </div>

                  <div className="flex items-end gap-2 flex-wrap">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Platform</div>
                      <select
                        value={defaultPlatform}
                        onChange={(e) => setAllPairingPlatform(e.target.value)}
                        className="w-28 h-10 rounded-xl bg-[#0E1219] border border-[#2B3443] px-3 text-sm font-semibold text-white"
                        data-testid="money-default-platform"
                      >
                        <option value="cmg">CMG</option>
                        <option value="paypal">PayPal</option>
                        <option value="revolut">Revolut</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Default €</div>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={defaultStake}
                        onChange={(e) => {
                          setDefaultStake(e.target.value);
                          setPairingsSent(false);
                        }}
                        className="w-24 h-10 bg-[#0E1219] border-[#2B3443] rounded-xl font-mono"
                        data-testid="money-default-stake"
                      />
                    </div>
                    <Button
                      onClick={autoPairMoney}
                      className="h-10 rounded-xl bg-[#171D27] border border-[#35404F] text-white hover:bg-white/[0.05]"
                      data-testid="money-auto-pair"
                    >
                      <Shuffle size={15} className="mr-1.5" /> Auto Pair
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {result.teamA.map((alpha) => {
                    const pairing = moneyPairings.find((pair) => pair.playerAId === alpha.id);
                    const usedBravoIds = moneyPairings
                      .filter((pair) => pair.playerAId !== alpha.id)
                      .map((pair) => pair.playerBId);

                    return (
                      <div
                        key={alpha.id}
                        className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_120px] gap-2 sm:items-center rounded-xl bg-[#0E1219] border border-[#252C39] p-3"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerAvatar name={alpha.name} elo={alpha.currentElo} size={34} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{alpha.name}</div>
                            <div className="text-[10px] uppercase tracking-wider text-[#F43F5E]">Alpha</div>
                          </div>
                        </div>

                        <ArrowRightLeft size={16} className="hidden sm:block text-[#697386]" />

                        <select
                          value={pairing?.playerBId || ""}
                          onChange={(e) => {
                            setPairingsSent(false);
                            setPairOpponent(alpha.id, e.target.value);
                          }}
                          className="h-10 rounded-xl bg-[#171D27] border border-[#35404F] px-3 text-sm text-white"
                          data-testid={`money-opponent-${alpha.id}`}
                        >
                          <option value="">Choose Bravo player</option>
                          {result.teamB.map((bravo) => (
                            <option
                              key={bravo.id}
                              value={bravo.id}
                              disabled={usedBravoIds.includes(bravo.id)}
                            >
                              {bravo.name} · {Math.round(playerRating(bravo))}
                            </option>
                          ))}
                        </select>

                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#697386] text-sm">€</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={pairing?.amount ?? ""}
                            disabled={!pairing}
                            onChange={(e) => {
                              setPairingsSent(false);
                              setPairAmount(alpha.id, e.target.value);
                            }}
                            placeholder="0"
                            className="h-10 pl-7 bg-[#171D27] border-[#35404F] rounded-xl font-mono"
                            data-testid={`money-amount-${alpha.id}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                  <div className="rounded-xl bg-[#0E1219] border border-[#252C39] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Pairings</div>
                    <div className="font-mono font-bold text-lg mt-1">{moneyPairings.length}/{result.teamA.length}</div>
                  </div>
                  <div className="rounded-xl bg-[#0E1219] border border-[#252C39] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Total €</div>
                    <div className="font-mono font-bold text-lg mt-1">€{(challBalance?.totalStake || 0).toFixed(2)}</div>
                  </div>
                  <div className="rounded-xl bg-[#0E1219] border border-[#252C39] p-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Avg Skill Gap</div>
                    <div className="font-mono font-bold text-lg mt-1">{challBalance?.avgGap ?? "—"}</div>
                  </div>
                  <div className={`rounded-xl border p-3 ${
                    (challBalance?.score || 0) >= 85
                      ? "bg-emerald-500/[0.06] border-emerald-500/20"
                      : "bg-[#0E1219] border-[#252C39]"
                  }`}>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Chall Balance</div>
                    <div className={`font-mono font-bold text-lg mt-1 ${
                      (challBalance?.score || 0) >= 85 ? "text-emerald-400" : "text-[#C9A45C]"
                    }`}>
                      {challBalance ? `${challBalance.score}%` : "—"}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <Button
                    onClick={sendPairingNotifications}
                    disabled={
                      sendingPairings ||
                      pairingsSent ||
                      moneyPairings.length !== result.teamA.length ||
                      moneyPairings.some((pair) => Number(pair.amount || 0) <= 0)
                    }
                    className={`w-full h-12 mt-4 rounded-xl font-extrabold ${
                      pairingsSent
                        ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                        : "bg-[#F43F5E] hover:bg-[#FB5A76] text-white"
                    }`}
                    data-testid="send-money-challs-all"
                  >
                    <MessageCircle size={17} className="mr-2" />
                    {sendingPairings
                      ? "Sending notifications..."
                      : pairingsSent
                        ? "All Players Notified"
                        : "Send Challs to All Players"}
                  </Button>
                )}
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
