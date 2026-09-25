import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, WinRatePill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Gamepad2, Flame, Zap, Swords, ArrowUpRight, Crown, Trophy,
  Radio, CircleDollarSign, UserCheck, Send, ShieldAlert, Activity, BadgeCheck
} from "lucide-react";
import { toast } from "sonner";

const money = (c) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: c?.currency || "EUR",
  }).format(Number(c?.amount_cents || 0) / 100);

const StatCard = ({ icon: Icon, label, value, sub, testid }) => (
  <div className="card-surface rounded-2xl p-5 animate-fade-up" data-testid={testid}>
    <div className="flex items-center justify-between mb-5">
      <span className="brand-kicker">{label}</span>
      <div className="w-9 h-9 rounded-lg bg-[#0F1218] border border-[#222834] flex items-center justify-center text-[#AAB1BE]">
        <Icon size={17} />
      </div>
    </div>
    <div className="font-mono text-[30px] leading-none font-bold text-white">{value}</div>
    {sub && <div className="text-xs text-[#7F8795] mt-2 truncate">{sub}</div>}
  </div>
);

export default function Dashboard() {
  const {
    players,
    matches,
    playerMap,
    playerAvatars,
    playerProfiles,
    dashboardData,
    discordSession,
    discordPlayer,
    createChallenge,
    isAdmin,
    adminChallengeAlertCount,
  } = useData();

  const [quickTarget, setQuickTarget] = useState("");
  const [quickAmount, setQuickAmount] = useState("5");
  const [quickPlatform, setQuickPlatform] = useState("cmg");
  const [quickBusy, setQuickBusy] = useState(false);

  const stats = useMemo(() => {
    const highest = [...players].sort((a, b) => b.currentElo - a.currentElo)[0];
    const mostActive = [...players].sort((a, b) => b.totalMatches - a.totalMatches)[0];
    return { highest, mostActive };
  }, [players]);

  const topPlayers = useMemo(
    () => [...players].sort((a, b) => b.currentElo - a.currentElo).slice(0, 5),
    [players]
  );

  const feed = matches.slice(0, 6);
  const activeChallenges = dashboardData?.activeChallenges || [];
  const recentChallenges = dashboardData?.recentChallenges || [];
  const onlineIds = new Set((dashboardData?.onlinePlayers || []).map((item) => item.player_id));
  const onlinePlayers = players.filter((player) => onlineIds.has(player.id));
  const season = dashboardData?.competition || { season_number: 1, season_name: "Season 1" };

  const challengeHighlights = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

    const weekly = recentChallenges.filter((challenge) => {
      const ts = new Date(challenge.verified_at || challenge.created_at).getTime();
      return Number.isFinite(ts) && ts >= weekAgo;
    });

    const byPlayer = new Map();
    weekly.forEach((challenge) => {
      const winnerId = challenge.reported_winner_player_id;
      if (!winnerId) return;
      const row = byPlayer.get(winnerId) || { wins: 0, profit: 0 };
      row.wins += 1;
      if (challenge.payment_received_at) {
        row.profit += Number(challenge.amount_cents || 0) / 100;
      }
      byPlayer.set(winnerId, row);
    });

    const topEntry = [...byPlayer.entries()]
      .sort((a, b) => b[1].wins - a[1].wins || b[1].profit - a[1].profit)[0];

    const myToday = discordPlayer
      ? recentChallenges.filter((challenge) => {
          const date = new Date(challenge.verified_at || challenge.created_at);
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          return key === todayKey &&
            [challenge.challenger_player_id, challenge.challenged_player_id].includes(discordPlayer.id);
        })
      : [];

    let myWins = 0;
    let myLosses = 0;
    let myNet = 0;
    myToday.forEach((challenge) => {
      const amount = Number(challenge.amount_cents || 0) / 100;
      const won = challenge.reported_winner_player_id === discordPlayer?.id;
      if (won) {
        myWins += 1;
        if (challenge.payment_received_at) myNet += amount;
      } else {
        myLosses += 1;
        if (challenge.payment_received_at) myNet -= amount;
      }
    });

    return {
      topPlayer: topEntry ? playerMap[topEntry[0]] : null,
      topStats: topEntry ? topEntry[1] : null,
      weeklyCount: weekly.length,
      weeklyVolume: weekly
        .filter((challenge) => challenge.payment_received_at)
        .reduce((sum, challenge) => sum + Number(challenge.amount_cents || 0) / 100, 0),
      myToday: { wins: myWins, losses: myLosses, net: myNet, total: myToday.length },
    };
  }, [recentChallenges, discordPlayer, playerMap]);

  const quickCandidates = players.filter((p) => p.id !== discordPlayer?.id);
  const targetProfile = quickTarget ? playerProfiles?.[quickTarget] : null;

  const quickSend = async () => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord first");
      return;
    }
    if (!quickTarget) return toast.error("Choose a player");
    const amount = Number(String(quickAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount");

    const methodLink =
      quickPlatform === "paypal"
        ? targetProfile?.paypalUrl
        : quickPlatform === "revolut"
          ? targetProfile?.revolutUrl
          : targetProfile?.cmgUrl;

    if (!methodLink) {
      toast.error(`This player has not configured ${quickPlatform.toUpperCase()}`);
      return;
    }

    setQuickBusy(true);
    const challenge = await createChallenge(quickTarget, quickPlatform, amount);
    setQuickBusy(false);
    if (!challenge) return;

    toast.success("Challenge sent");
    setQuickTarget("");
  };

  return (
    <div className="space-y-6">
      <section className="brand-card rounded-2xl p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-7">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-[#0B0D12] border border-[#282E39] items-center justify-center shrink-0">
              <img src={`${process.env.PUBLIC_URL}/logo-mark.svg`} alt="" className="w-14 h-14 object-contain" />
            </div>
            <div>
              <div className="brand-kicker mb-2">MuchoMoney8s · {season.season_name || `Season ${season.season_number}`}</div>
              <h2 className="font-display text-3xl sm:text-[40px] leading-tight font-extrabold tracking-tight">
                Build a better <span className="text-magma">8s lobby.</span>
              </h2>
              <p className="text-[#9199A7] mt-3 max-w-xl text-sm leading-6">
                Balance teams, run money challs, track Elo and keep every competitive result in one place.
              </p>
            </div>
          </div>

          <Link
            to="/balancer"
            data-testid="dashboard-balance-cta"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-semibold transition-all magma-glow self-start md:self-center"
          >
            <Swords size={17} /> Balance Teams <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      {isAdmin && adminChallengeAlertCount > 0 && (
        <Link
          to="/admin"
          data-testid="dashboard-admin-dispute-banner"
          className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3 flex items-center gap-3 hover:bg-orange-500/[0.10] transition-colors"
        >
          <ShieldAlert size={19} className="text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-orange-300">
              {adminChallengeAlertCount} {adminChallengeAlertCount === 1 ? "disputa richiede" : "dispute richiedono"} controllo Admin
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Apri il Control Room per verificare risultato, pagamento e prove.</div>
          </div>
          <ArrowUpRight size={16} className="text-orange-400 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Players" value={players.length} sub="Active roster" testid="kpi-total-players" />
        <StatCard icon={Gamepad2} label="Matches" value={matches.length} sub="Recorded games" testid="kpi-total-matches" />
        <StatCard icon={Flame} label="Highest Elo" value={stats.highest?.currentElo ?? "—"} sub={stats.highest?.name} testid="kpi-highest-elo" />
        <StatCard icon={Zap} label="Most Active" value={stats.mostActive?.totalMatches ?? "—"} sub={stats.mostActive?.name} testid="kpi-most-active" />
      </div>

      {(activeChallenges.length > 0 || onlinePlayers.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <section className="xl:col-span-3 card-surface rounded-2xl p-5" data-testid="dashboard-live-challs">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="brand-kicker mb-1">Live Now</div>
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <Radio size={17} className="text-magma" /> Live Chall
                </h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{activeChallenges.length} live</span>
            </div>

            {activeChallenges.length === 0 ? (
              <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 text-center text-sm text-muted-foreground">
                No live challs right now.
              </div>
            ) : (
              <div className="space-y-2">
                {activeChallenges.slice(0, 6).map((challenge) => {
                  const a = playerMap[challenge.challenger_player_id];
                  const b = playerMap[challenge.challenged_player_id];
                  return (
                    <Link
                      key={challenge.id}
                      to={discordPlayer && [challenge.challenger_player_id, challenge.challenged_player_id].includes(discordPlayer.id) ? `/challenges/${challenge.id}` : "/challenge-ranking"}
                      className="interactive-row rounded-xl p-3 flex items-center gap-3"
                    >
                      <div className="relative flex -space-x-2 shrink-0">
                        <PlayerAvatar name={a?.name || "A"} elo={a?.currentElo || 1000} size={34} avatarUrl={playerAvatars[challenge.challenger_player_id]} />
                        <PlayerAvatar name={b?.name || "B"} elo={b?.currentElo || 1000} size={34} avatarUrl={playerAvatars[challenge.challenged_player_id]} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {a?.name || "Player"} <span className="text-muted-foreground font-normal">vs</span> {b?.name || "Player"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {String(challenge.platform || "").toUpperCase()} · {money(challenge)}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold tracking-wider text-magma">
                        <span className="w-1.5 h-1.5 rounded-full bg-magma animate-pulse" /> LIVE
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="xl:col-span-2 card-surface rounded-2xl p-5" data-testid="dashboard-online-players">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="brand-kicker mb-1">Presence</div>
                <h3 className="font-display font-bold text-lg flex items-center gap-2">
                  <UserCheck size={17} className="text-emerald-400" /> Players Online
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400">{onlinePlayers.length}</span>
            </div>

            {onlinePlayers.length === 0 ? (
              <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 text-center text-sm text-muted-foreground">
                No linked players online.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                {onlinePlayers.slice(0, 8).map((player) => (
                  <Link key={player.id} to={`/players/${player.id}`} className="interactive-row rounded-xl p-2.5 flex items-center gap-3">
                    <div className="relative">
                      <PlayerAvatar name={player.name} elo={player.currentElo} size={34} avatarUrl={playerAvatars[player.id]} />
                      <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#12151C]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{player.name}</div>
                      <div className="text-[11px] text-emerald-400">Online</div>
                    </div>
                    <EloBadge elo={player.currentElo} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="xl:col-span-2 card-surface rounded-2xl p-5" data-testid="dashboard-quick-chall">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="brand-kicker mb-1">Fast Action</div>
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <CircleDollarSign size={18} className="text-[#D5A33A]" /> Quick Chall
              </h3>
            </div>
            <Send size={16} className="text-[#697181]" />
          </div>

          {!discordSession || !discordPlayer ? (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-5 text-center">
              <div className="text-sm text-muted-foreground">Login with Discord to send a Quick Chall.</div>
            </div>
          ) : (
            <div className="space-y-3">
              <select
                value={quickTarget}
                onChange={(e) => setQuickTarget(e.target.value)}
                className="w-full h-11 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
              >
                <option value="">Choose player</option>
                {quickCandidates.map((player) => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>

              <div className="grid grid-cols-[1fr_120px] gap-2">
                <select
                  value={quickPlatform}
                  onChange={(e) => setQuickPlatform(e.target.value)}
                  className="h-11 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
                >
                  <option value="cmg">CMG</option>
                  <option value="paypal">PayPal</option>
                  <option value="revolut">Revolut</option>
                </select>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={quickAmount}
                    onChange={(e) => setQuickAmount(e.target.value)}
                    className="h-11 pl-7 bg-[#0F1218] border-[#222834]"
                  />
                </div>
              </div>

              <Button
                onClick={quickSend}
                disabled={quickBusy || !quickTarget}
                className="w-full h-11 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold"
              >
                <Swords size={16} className="mr-2" /> {quickBusy ? "Sending..." : "CHALL ME"}
              </Button>
            </div>
          )}
        </section>

        <section className="xl:col-span-3 card-surface rounded-2xl p-5" data-testid="dashboard-challenge-activity">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1">Money Feed</div>
              <h3 className="font-display font-bold text-lg">Latest Verified Challs</h3>
            </div>
            <Activity size={17} className="text-magma" />
          </div>

          <div className="space-y-2">
            {recentChallenges.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">No verified challs yet.</div>
            ) : recentChallenges.slice(0, 6).map((challenge) => {
              const winner = playerMap[challenge.reported_winner_player_id];
              const loserId = challenge.challenger_player_id === challenge.reported_winner_player_id
                ? challenge.challenged_player_id
                : challenge.challenger_player_id;
              const loser = playerMap[loserId];

              return (
                <div key={challenge.id} className="interactive-row flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Trophy size={15} className="text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      <span className="text-white">{winner?.name || "Player"}</span>
                      <span className="text-[#717988]"> beat {loser?.name || "Player"} · {money(challenge)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {String(challenge.platform || "").toUpperCase()} · {challenge.payment_received_at ? "Payout verified" : "Payout pending"}
                    </div>
                  </div>
                  {challenge.payment_received_at
                    ? <BadgeCheck size={16} className="text-emerald-400 shrink-0" />
                    : <ShieldAlert size={16} className="text-[#D5A33A] shrink-0" />}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="dashboard-challenge-highlights">
        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">This Week</div>
          <h3 className="font-display font-bold text-lg">Top Chall Player</h3>
          {challengeHighlights.topPlayer ? (
            <div className="flex items-center gap-3 mt-4">
              <PlayerAvatar
                name={challengeHighlights.topPlayer.name}
                elo={challengeHighlights.topPlayer.currentElo}
                size={42}
                avatarUrl={playerAvatars[challengeHighlights.topPlayer.id]}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{challengeHighlights.topPlayer.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {challengeHighlights.topStats?.wins || 0} wins · +€{Number(challengeHighlights.topStats?.profit || 0).toFixed(2)}
                </div>
              </div>
              <Trophy size={18} className="text-[#D5A33A]" />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-4">No verified challs this week.</div>
          )}
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Weekly Volume</div>
          <h3 className="font-display font-bold text-lg">Challenge Activity</h3>
          <div className="font-display text-3xl font-black mt-4">€{challengeHighlights.weeklyVolume.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {challengeHighlights.weeklyCount} verified challs in the last 7 days
          </div>
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Your Night</div>
          <h3 className="font-display font-bold text-lg">Today</h3>
          {discordPlayer ? (
            <>
              <div className="font-display text-3xl font-black mt-4">
                <span className="text-emerald-400">{challengeHighlights.myToday.wins}W</span>
                <span className="text-muted-foreground mx-1.5">-</span>
                <span className="text-red-400">{challengeHighlights.myToday.losses}L</span>
              </div>
              <div className={`text-sm font-mono mt-1 ${
                challengeHighlights.myToday.net >= 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {challengeHighlights.myToday.net >= 0 ? "+" : "-"}€{Math.abs(challengeHighlights.myToday.net).toFixed(2)}
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground mt-4">Login with Discord to see your night.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section className="lg:col-span-2 card-surface rounded-2xl p-5" data-testid="dashboard-top-players">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="brand-kicker mb-1">Competition</div>
              <h3 className="font-display font-bold text-lg">Top Ranked</h3>
            </div>
            <Trophy size={18} className="text-[#D5A33A]" />
          </div>

          <div className="space-y-1">
            {topPlayers.map((p, i) => (
              <Link
                to={`/players/${p.id}`}
                key={p.id}
                className="interactive-row flex items-center gap-3 p-2.5 rounded-xl"
              >
                <span className={`font-mono text-xs font-bold w-5 text-center ${i === 0 ? "text-[#D5A33A]" : "text-[#697181]"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={34} avatarUrl={playerAvatars[p.id]} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">WR <WinRatePill player={p} /></div>
                </div>
                <EloBadge elo={p.currentElo} />
              </Link>
            ))}
          </div>
        </section>

        <section className="lg:col-span-3 card-surface rounded-2xl p-5" data-testid="dashboard-activity-feed">
          <div className="mb-4">
            <div className="brand-kicker mb-1">Timeline</div>
            <h3 className="font-display font-bold text-lg">Recent 8s Activity</h3>
          </div>

          <div className="space-y-2">
            {feed.length === 0 && (
              <div className="text-sm text-muted-foreground py-10 text-center">No matches yet.</div>
            )}

            {feed.map((m) => {
              const winIds = m.winner === "A" ? m.teamA : m.teamB;
              const mvp = playerMap[m.mvpId];

              return (
                <div key={m.id} className="interactive-row flex items-center gap-3 p-3 rounded-xl">
                  <div className="w-9 h-9 rounded-lg bg-magma/10 border border-magma/20 flex items-center justify-center shrink-0">
                    <Trophy size={15} className="text-magma" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      <span className="text-white">{m.winner === "A" ? "Alpha" : "Bravo"}</span>
                      <span className="text-[#717988]"> won · {m.mode || "Match"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {winIds.map((id) => playerMap[id]?.name).filter(Boolean).join(", ")}
                    </div>
                  </div>
                  {mvp && (
                    <div className="hidden sm:flex text-xs items-center gap-1 text-[#D5A33A] shrink-0">
                      <Crown size={12} /> {mvp.name}
                    </div>
                  )}
                  <span className="text-[11px] text-[#697181] shrink-0">
                    {new Date(m.date).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {isAdmin && (
        <div className="text-xs text-muted-foreground text-center">
          Admin mode active · live dashboard updates every 15 seconds.
        </div>
      )}
    </div>
  );
}
