import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, RankBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Flame,
  Gamepad2,
  LogIn,
  Radio,
  ShieldAlert,
  Swords,
  Trophy,
  UserCircle,
  WalletCards,
} from "lucide-react";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));

const challengeAmount = (challenge) => Number(challenge?.amount_cents || 0) / 100;

const CompactMetric = ({ label, value, sub, icon: Icon, tone = "" }) => (
  <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3 min-w-0">
    <div className="flex items-center justify-between gap-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      {Icon && <Icon size={14} className={tone || "text-[#697181]"} />}
    </div>
    <div className={`font-display text-xl font-extrabold mt-1 truncate ${tone}`}>{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground mt-1 truncate">{sub}</div>}
  </div>
);

const CompetitionOverview = ({
  players,
  matches,
  playerMap,
  playerAvatars,
  activeChallenges,
  loggedIn = false,
}) => {
  const topThree = useMemo(
    () => [...(players || [])].sort((a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0)).slice(0, 3),
    [players]
  );
  const recentMatches = (matches || []).slice(0, 3);
  const liveChallenges = (activeChallenges || []).slice(0, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <section className="card-surface rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Competition</div>
            <h3 className="font-display font-bold text-lg">Top 3</h3>
          </div>
          <Trophy size={17} className="text-[#D5A33A]" />
        </div>

        <div className="space-y-2">
          {topThree.map((player, index) => (
            <Link
              key={player.id}
              to={`/players/${player.id}`}
              className="interactive-row rounded-xl p-3 flex items-center gap-3"
            >
              <div className="font-mono text-xs font-bold text-muted-foreground w-5">#{index + 1}</div>
              <PlayerAvatar
                name={player.name}
                elo={player.currentElo}
                size={36}
                avatarUrl={playerAvatars[player.id]}
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{player.name}</div>
                <div className="mt-1"><RankBadge elo={player.currentElo} compact /></div>
              </div>
              <EloBadge elo={player.currentElo} />
            </Link>
          ))}
          {topThree.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No ranking data yet.</div>
          )}
        </div>

        <Link to="/ranking" className="inline-flex items-center gap-1 text-xs text-magma mt-4">
          Full ranking <ArrowUpRight size={13} />
        </Link>
      </section>

      <section className="card-surface rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Latest</div>
            <h3 className="font-display font-bold text-lg">Results</h3>
          </div>
          <Gamepad2 size={17} className="text-magma" />
        </div>

        <div className="space-y-2">
          {recentMatches.map((match) => {
            const winnerIds = match.winner === "A" ? match.teamA : match.teamB;
            return (
              <Link
                to="/matches"
                key={match.id}
                className="interactive-row rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-magma/10 border border-magma/20 flex items-center justify-center shrink-0">
                  <Trophy size={15} className="text-magma" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {match.winner === "A" ? "Team A" : "Team B"} won
                    {(Number(match.scoreA || 0) > 0 || Number(match.scoreB || 0) > 0)
                      ? ` · ${Number(match.scoreA || 0)}-${Number(match.scoreB || 0)}`
                      : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {(winnerIds || []).map((id) => playerMap[id]?.name).filter(Boolean).join(", ")}
                  </div>
                </div>
              </Link>
            );
          })}
          {recentMatches.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No matches yet.</div>
          )}
        </div>

        <Link to="/matches" className="inline-flex items-center gap-1 text-xs text-magma mt-4">
          View all matches <ArrowUpRight size={13} />
        </Link>
      </section>

      <section className="card-surface rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Live</div>
            <h3 className="font-display font-bold text-lg">Active Chall</h3>
          </div>
          <Radio size={17} className="text-emerald-400" />
        </div>

        <div className="space-y-2">
          {liveChallenges.map((challenge) => {
            const challenger = playerMap[challenge.challenger_player_id];
            const challenged = playerMap[challenge.challenged_player_id];

            return (
              <div key={challenge.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                <div className="text-sm font-semibold truncate">
                  {challenger?.name || "Player"} <span className="text-[#596170]">vs</span> {challenged?.name || "Player"}
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
                  <span>{euro(challengeAmount(challenge))}</span>
                  <span>·</span>
                  <span>{String(challenge.platform || "").toUpperCase()}</span>
                  <span className="ml-auto text-emerald-400">{String(challenge.status || "").replace("_", " ")}</span>
                </div>
              </div>
            );
          })}
          {liveChallenges.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No active challs right now.</div>
          )}
        </div>

        <div className="mt-4">
          {loggedIn ? (
            <Link to="/challenges" className="inline-flex items-center gap-1 text-xs text-magma">
              Manage my challenges <ArrowUpRight size={13} />
            </Link>
          ) : (
            <div className="text-xs text-muted-foreground">
              Login with Discord to manage your own challenges.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const GuestDashboard = ({
  players,
  matches,
  playerMap,
  playerAvatars,
  activeChallenges,
  season,
  signInWithDiscord,
  discordLoading,
}) => {
  return (
    <div className="space-y-5">
      <section className="brand-card rounded-2xl p-6 sm:p-8">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-center">
          <div>
            <div className="brand-kicker mb-2">
              MuchoMoney8s · {season.season_name || `Season ${season.season_number}`}
            </div>
            <h2 className="font-display text-3xl sm:text-[42px] leading-tight font-black tracking-tight max-w-2xl">
              Competitive Hub. <span className="text-magma">Built for 8s.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#9199A7] mt-3 max-w-xl leading-6">
              Follow the ranking, recent results and active challenges. Log in with Discord to unlock your personal dashboard.
            </p>

            <div className="flex flex-wrap gap-2 mt-5">
              <Link
                to="/ranking"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
              >
                <Trophy size={16} /> View Ranking
              </Link>
              <Link
                to="/matches"
                className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0F1218] border border-[#2A303B] text-[#D7DBE2] hover:text-white"
              >
                <Gamepad2 size={16} /> View Matches
              </Link>
              <Button
                type="button"
                onClick={signInWithDiscord}
                disabled={discordLoading}
                className="h-11 px-5 rounded-xl bg-[#5865F2] hover:bg-[#6875F5] text-white font-bold"
              >
                <LogIn size={16} className="mr-2" />
                {discordLoading ? "Checking..." : "Login with Discord"}
              </Button>
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

      <CompetitionOverview
        players={players}
        matches={matches}
        playerMap={playerMap}
        playerAvatars={playerAvatars}
        activeChallenges={activeChallenges}
      />
    </div>
  );
};

const PersonalDashboard = ({
  discordPlayer,
  playerAvatars,
  matches,
  playerMap,
  challenges,
  season,
  isAdmin,
  adminChallengeAlertCount,
  players,
  activeChallenges,
}) => {
  const personalMatches = useMemo(
    () =>
      matches
        .filter((match) =>
          match.teamA?.includes(discordPlayer.id) ||
          match.teamB?.includes(discordPlayer.id)
        )
        .slice(0, 5),
    [matches, discordPlayer.id]
  );

  const verifiedChallenges = useMemo(
    () =>
      (challenges || []).filter((challenge) =>
        challenge.status === "completed" &&
        challenge.reported_winner_player_id &&
        !(challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
      ),
    [challenges]
  );

  const moneyWon = useMemo(
    () =>
      verifiedChallenges
        .filter((challenge) => challenge.reported_winner_player_id === discordPlayer.id)
        .reduce((sum, challenge) => sum + challengeAmount(challenge), 0),
    [verifiedChallenges, discordPlayer.id]
  );

  const received = useMemo(
    () =>
      verifiedChallenges
        .filter((challenge) =>
          challenge.reported_winner_player_id === discordPlayer.id &&
          challenge.payment_received_at
        )
        .reduce((sum, challenge) => sum + challengeAmount(challenge), 0),
    [verifiedChallenges, discordPlayer.id]
  );

  const pendingPayout = Math.max(0, moneyWon - received);

  const activity = useMemo(() => {
    const matchItems = personalMatches.map((match) => {
      const winners = match.winner === "A" ? match.teamA : match.teamB;
      const won = winners.includes(discordPlayer.id);
      return {
        id: `match:${match.id}`,
        type: "match",
        date: match.date,
        title: won ? "Match won" : "Match lost",
        detail:
          `${match.game || "Match"}${match.mode ? ` · ${match.mode}` : ""}` +
          ((Number(match.scoreA || 0) > 0 || Number(match.scoreB || 0) > 0)
            ? ` · ${Number(match.scoreA || 0)}-${Number(match.scoreB || 0)}`
            : ""),
        won,
        to: "/matches",
      };
    });

    const challengeItems = verifiedChallenges.map((challenge) => {
      const won = challenge.reported_winner_player_id === discordPlayer.id;
      const opponentId =
        challenge.challenger_player_id === discordPlayer.id
          ? challenge.challenged_player_id
          : challenge.challenger_player_id;

      return {
        id: `chall:${challenge.id}`,
        type: "chall",
        date: challenge.verified_at || challenge.created_at,
        title: won ? `+${euro(challengeAmount(challenge))} chall win` : `-${euro(challengeAmount(challenge))} chall loss`,
        detail: `vs ${playerMap[opponentId]?.name || "Player"}`,
        won,
        to: `/challenges/${challenge.id}`,
      };
    });

    return [...matchItems, ...challengeItems]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);
  }, [personalMatches, verifiedChallenges, discordPlayer.id, playerMap]);

  const record = `${discordPlayer.wins || 0}W - ${discordPlayer.losses || 0}L`;
  const streak = Number(discordPlayer.currentStreak || 0);

  return (
    <div className="space-y-5">
      <section className="brand-card rounded-2xl p-5 sm:p-7">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <PlayerAvatar
              name={discordPlayer.name}
              elo={discordPlayer.currentElo}
              size={72}
              avatarUrl={playerAvatars[discordPlayer.id]}
            />
            <div className="min-w-0">
              <div className="brand-kicker mb-1">
                {season.season_name || `Season ${season.season_number}`}
              </div>
              <h2 className="font-display text-3xl font-black truncate">{discordPlayer.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <RankBadge elo={discordPlayer.currentElo} />
                <EloBadge elo={discordPlayer.currentElo} />
                <span className="text-sm text-muted-foreground">{record}</span>
                {streak !== 0 && (
                  <span className={`inline-flex items-center gap-1 text-sm font-semibold ${streak > 0 ? "text-orange-400" : "text-red-400"}`}>
                    <Flame size={14} /> {Math.abs(streak)} {streak > 0 ? "win" : "loss"} streak
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/team-builder"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <Swords size={16} /> Team Builder
            </Link>
            <Link
              to="/challenges"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0F1218] border border-[#2A303B] text-[#D7DBE2] hover:text-white"
            >
              <WalletCards size={16} /> My Challenges
            </Link>
            <Link
              to={`/players/${discordPlayer.id}`}
              className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#0F1218] border border-[#2A303B] text-[#D7DBE2] hover:text-white"
            >
              <UserCircle size={16} /> Profile
            </Link>
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
              {adminChallengeAlertCount} {adminChallengeAlertCount === 1 ? "item needs Admin attention" : "items need Admin attention"}
            </div>
          </div>
          <ArrowUpRight size={15} className="text-orange-400" />
        </Link>
      )}

      <section className="card-surface rounded-2xl p-5">
        <div className="mb-4">
          <div className="brand-kicker mb-1">Your Competition</div>
          <h3 className="font-display font-bold text-lg">Current status</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <CompactMetric
            label="Elo"
            value={discordPlayer.currentElo}
            sub="Current rating"
            icon={Trophy}
          />
          <CompactMetric
            label="Record"
            value={record}
            sub={`${discordPlayer.totalMatches || 0} matches`}
            icon={Gamepad2}
          />
          <CompactMetric
            label="Streak"
            value={streak === 0 ? "—" : `${streak > 0 ? "+" : "-"}${Math.abs(streak)}`}
            sub={streak > 0 ? "Wins" : streak < 0 ? "Losses" : "No active streak"}
            icon={Flame}
            tone={streak > 0 ? "text-orange-400" : streak < 0 ? "text-red-400" : ""}
          />
          <CompactMetric
            label="Money Won"
            value={euro(moneyWon)}
            sub="Verified chall wins"
            icon={WalletCards}
            tone="text-emerald-400"
          />
          <CompactMetric
            label="Pending Payout"
            value={euro(pendingPayout)}
            sub={pendingPayout > 0 ? "Awaiting receipt" : "All settled"}
            icon={Radio}
            tone={pendingPayout > 0 ? "text-[#D5A33A]" : "text-emerald-400"}
          />
        </div>
      </section>

      <section className="card-surface rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Latest Activity</div>
            <h3 className="font-display font-bold text-lg">Your recent results</h3>
          </div>
          <Link to="/matches" className="text-xs text-magma inline-flex items-center gap-1">
            View all <ArrowUpRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-10 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="interactive-row rounded-xl p-3 flex items-center gap-3"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                  item.won
                    ? "bg-emerald-500/[0.07] border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/[0.06] border-red-500/20 text-red-400"
                }`}>
                  {item.type === "chall" ? <WalletCards size={16} /> : <Trophy size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{item.detail}</div>
                </div>
                <div className="text-[10px] text-muted-foreground shrink-0">
                  {item.date ? new Date(item.date).toLocaleDateString() : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <CompetitionOverview
        players={players}
        matches={matches}
        playerMap={playerMap}
        playerAvatars={playerAvatars}
        activeChallenges={activeChallenges}
        loggedIn
      />
    </div>
  );
};

export default function Dashboard() {
  const {
    players,
    matches,
    playerMap,
    playerAvatars,
    dashboardData,
    discordSession,
    discordPlayer,
    discordLoading,
    challenges,
    signInWithDiscord,
    isAdmin,
    adminChallengeAlertCount,
  } = useData();

  const season = dashboardData?.competition || { season_number: 1, season_name: "Season 1" };
  const activeChallenges = dashboardData?.activeChallenges || [];
  const loggedIn = Boolean(discordSession && discordPlayer);

  if (!loggedIn) {
    return (
      <GuestDashboard
        players={players}
        matches={matches}
        playerMap={playerMap}
        playerAvatars={playerAvatars}
        activeChallenges={activeChallenges}
        season={season}
        signInWithDiscord={signInWithDiscord}
        discordLoading={discordLoading}
      />
    );
  }

  return (
    <PersonalDashboard
      discordPlayer={discordPlayer}
      playerAvatars={playerAvatars}
      matches={matches}
      playerMap={playerMap}
      challenges={challenges}
      season={season}
      isAdmin={isAdmin}
      adminChallengeAlertCount={adminChallengeAlertCount}
      players={players}
      activeChallenges={activeChallenges}
    />
  );
}
