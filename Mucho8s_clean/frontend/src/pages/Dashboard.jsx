import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, RankBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Gamepad2,
  Flame,
  Swords,
  ArrowUpRight,
  Trophy,
  Radio,
  UserCheck,
  ShieldAlert,
  Send,
  Crown,
} from "lucide-react";
import { toast } from "sonner";

const money = (challenge) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: challenge?.currency || "EUR",
  }).format(Number(challenge?.amount_cents || 0) / 100);

const StatCard = ({ icon: Icon, label, value, sub, testid }) => (
  <div className="card-surface rounded-2xl p-4 sm:p-5" data-testid={testid}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="brand-kicker">{label}</div>
        <div className="font-display text-2xl sm:text-3xl font-black mt-2 truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div>}
      </div>
      <div className="w-10 h-10 rounded-xl bg-[#0F1218] border border-[#222834] flex items-center justify-center text-[#AAB1BE] shrink-0">
        <Icon size={18} />
      </div>
    </div>
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

  const highest = useMemo(
    () => [...players].sort((a, b) => b.currentElo - a.currentElo)[0],
    [players]
  );

  const topPlayers = useMemo(
    () => [...players].sort((a, b) => b.currentElo - a.currentElo).slice(0, 5),
    [players]
  );

  const activeChallenges = dashboardData?.activeChallenges || [];
  const onlineIds = new Set((dashboardData?.onlinePlayers || []).map((item) => item.player_id));
  const onlinePlayers = players.filter((player) => onlineIds.has(player.id)).slice(0, 7);
  const season = dashboardData?.competition || { season_number: 1, season_name: "Season 1" };
  const recentMatches = matches.slice(0, 5);

  const quickCandidates = players.filter((player) => player.id !== discordPlayer?.id);
  const targetProfile = quickTarget ? playerProfiles?.[quickTarget] : null;

  const sendQuickChallenge = async () => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord first");
      return;
    }

    if (!quickTarget) {
      toast.error("Choose a player");
      return;
    }

    const amount = Number(String(quickAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    const platformUrl =
      quickPlatform === "paypal"
        ? targetProfile?.paypalUrl
        : quickPlatform === "revolut"
          ? targetProfile?.revolutUrl
          : targetProfile?.cmgUrl;

    if (!platformUrl) {
      toast.error("This player has not configured " + quickPlatform.toUpperCase());
      return;
    }

    setQuickBusy(true);
    const challenge = await createChallenge(quickTarget, quickPlatform, amount);
    setQuickBusy(false);

    if (!challenge) return;

    setQuickTarget("");
    toast.success("Challenge sent");
  };

  return (
    <div className="space-y-5">
      <section className="brand-card rounded-2xl p-6 sm:p-8 min-h-[220px]">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-center">
          <div>
            <div className="brand-kicker mb-2">
              MuchoMoney8s · {season.season_name || "Season " + season.season_number}
            </div>

            <h2 className="font-display text-3xl sm:text-[42px] leading-tight font-black tracking-tight max-w-2xl">
              Competitive 8s. <span className="text-magma">One place.</span>
            </h2>

            <p className="text-sm sm:text-base text-[#9199A7] mt-3 max-w-xl leading-6">
              Balance teams, run money challs and track every result without clutter.
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              <Link
                to="/balancer"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
              >
                <Swords size={17} /> Team Balancer
              </Link>
              <Link
                to="/ranking"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0F1218] border border-[#2A303B] text-[#D7DBE2] hover:text-white"
              >
                <Trophy size={16} /> Ranking
              </Link>
            </div>
          </div>

          <div className="hidden sm:flex justify-center lg:justify-end">
            <div className="dashboard-logo-stage">
              <div className="dashboard-logo-orbit" />
              <img
                src={process.env.PUBLIC_URL + "/logo-mark.svg"}
                alt="MuchoMoney8s"
                className="dashboard-logo-mark"
              />
              <div className="dashboard-logo-wordmark">
                <span>MUCHO</span><strong>MONEY</strong><span>8s</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isAdmin && adminChallengeAlertCount > 0 && (
        <Link
          to="/admin"
          className="rounded-xl border border-orange-500/25 bg-orange-500/[0.07] px-4 py-3 flex items-center gap-3 hover:bg-orange-500/[0.10]"
        >
          <ShieldAlert size={18} className="text-orange-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-orange-300">
              {adminChallengeAlertCount} {adminChallengeAlertCount === 1 ? "disputa da controllare" : "dispute da controllare"}
            </div>
          </div>
          <ArrowUpRight size={15} className="text-orange-400" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Players" value={players.length} sub="Active roster" />
        <StatCard icon={Gamepad2} label="Matches" value={matches.length} sub="Recorded lobbies" />
        <StatCard icon={Flame} label="Top Elo" value={highest?.currentElo ?? "—"} sub={highest?.name || "—"} />
        <StatCard icon={Radio} label="Live Chall" value={activeChallenges.length} sub={onlinePlayers.length + " players online"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <section className="card-surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1">Live Now</div>
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <Radio size={17} className="text-magma" /> Active Challs
              </h3>
            </div>
            <Link to="/challenge-ranking" className="text-xs text-muted-foreground hover:text-white">
              Chall Ranking →
            </Link>
          </div>

          {activeChallenges.length === 0 ? (
            <div className="panel-muted rounded-xl py-10 text-center text-sm text-muted-foreground">
              No active challs right now.
            </div>
          ) : (
            <div className="space-y-2">
              {activeChallenges.slice(0, 4).map((challenge) => {
                const challenger = playerMap[challenge.challenger_player_id];
                const challenged = playerMap[challenge.challenged_player_id];
                const belongsToMe =
                  discordPlayer &&
                  [challenge.challenger_player_id, challenge.challenged_player_id].includes(discordPlayer.id);

                return (
                  <Link
                    key={challenge.id}
                    to={belongsToMe ? "/challenges/" + challenge.id : "/challenge-ranking"}
                    className="interactive-row rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="flex -space-x-2 shrink-0">
                      <PlayerAvatar
                        name={challenger?.name || "A"}
                        elo={challenger?.currentElo || 1000}
                        size={36}
                        avatarUrl={playerAvatars[challenge.challenger_player_id]}
                      />
                      <PlayerAvatar
                        name={challenged?.name || "B"}
                        elo={challenged?.currentElo || 1000}
                        size={36}
                        avatarUrl={playerAvatars[challenge.challenged_player_id]}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">
                        {challenger?.name || "Player"} <span className="text-muted-foreground font-normal">vs</span> {challenged?.name || "Player"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {String(challenge.platform || "").toUpperCase()} · {money(challenge)}
                      </div>
                    </div>

                    <span className="text-[10px] uppercase tracking-widest font-black text-magma">Live</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card-surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1">Presence</div>
              <h3 className="font-display font-bold text-lg flex items-center gap-2">
                <UserCheck size={17} className="text-emerald-400" /> Online
              </h3>
            </div>
            <span className="font-mono text-xs text-emerald-400">{onlinePlayers.length}</span>
          </div>

          {onlinePlayers.length === 0 ? (
            <div className="panel-muted rounded-xl py-10 text-center text-sm text-muted-foreground">
              No players online.
            </div>
          ) : (
            <div className="space-y-1.5">
              {onlinePlayers.map((player) => (
                <Link
                  key={player.id}
                  to={"/players/" + player.id}
                  className="interactive-row rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  <div className="relative">
                    <PlayerAvatar name={player.name} elo={player.currentElo} size={34} avatarUrl={playerAvatars[player.id]} />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#12151C]" />
                  </div>
                  <div className="flex-1 min-w-0 font-medium text-sm truncate">{player.name}</div>
                  <EloBadge elo={player.currentElo} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {discordSession && discordPlayer && (
        <section className="card-surface rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col xl:flex-row xl:items-end gap-3">
            <div className="xl:w-48">
              <div className="brand-kicker mb-1">Quick Chall</div>
              <div className="font-display font-bold">Send a challenge</div>
            </div>

            <select
              value={quickTarget}
              onChange={(e) => setQuickTarget(e.target.value)}
              className="h-11 flex-1 min-w-0 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
            >
              <option value="">Choose player</option>
              {quickCandidates.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>

            <select
              value={quickPlatform}
              onChange={(e) => setQuickPlatform(e.target.value)}
              className="h-11 xl:w-32 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
            >
              <option value="cmg">CMG</option>
              <option value="paypal">PayPal</option>
              <option value="revolut">Revolut</option>
            </select>

            <div className="relative xl:w-28">
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

            <Button
              onClick={sendQuickChallenge}
              disabled={quickBusy || !quickTarget}
              className="h-11 xl:w-40 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <Send size={15} className="mr-2" /> {quickBusy ? "Sending..." : "CHALL"}
            </Button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.4fr] gap-4">
        <section className="card-surface rounded-2xl p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1">Competition</div>
              <h3 className="font-display font-bold text-lg">Top Ranked</h3>
            </div>
            <Trophy size={17} className="text-[#D5A33A]" />
          </div>

          <div className="space-y-1.5">
            {topPlayers.map((player, index) => (
              <Link
                key={player.id}
                to={"/players/" + player.id}
                className="interactive-row rounded-xl p-2.5 flex items-center gap-3"
              >
                <div className="font-mono text-xs font-bold text-muted-foreground w-5">#{index + 1}</div>
                <PlayerAvatar name={player.name} elo={player.currentElo} size={34} avatarUrl={playerAvatars[player.id]} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{player.name}</div>
                  <div className="mt-1"><RankBadge elo={player.currentElo} compact /></div>
                </div>
                <EloBadge elo={player.currentElo} />
              </Link>
            ))}
          </div>
        </section>

        <section className="card-surface rounded-2xl p-5">
          <div className="mb-4">
            <div className="brand-kicker mb-1">Latest</div>
            <h3 className="font-display font-bold text-lg">Recent Matches</h3>
          </div>

          {recentMatches.length === 0 ? (
            <div className="panel-muted rounded-xl py-10 text-center text-sm text-muted-foreground">
              No matches yet.
            </div>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((match) => {
                const winnerIds = match.winner === "A" ? match.teamA : match.teamB;
                const mvp = playerMap[match.mvpId];

                return (
                  <Link
                    to="/matches"
                    key={match.id}
                    className="interactive-row rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-lg bg-magma/10 border border-magma/20 flex items-center justify-center shrink-0">
                      <Trophy size={15} className="text-magma" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">
                        {match.winner === "A" ? "Alpha" : "Bravo"} won · {match.game || "Game"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {winnerIds.map((id) => playerMap[id]?.name).filter(Boolean).join(", ")}
                      </div>
                    </div>
                    {mvp && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-[#D5A33A]">
                        <Crown size={12} /> {mvp.name}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(match.date).toLocaleDateString()}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
