import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, RankBadge, RankProgress } from "@/components/shared";
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
  <div className="m8-stat-card min-w-0">
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#737D8D] font-bold">{label}</div>
        <div className={"font-display text-[1.35rem] font-black mt-1 truncate " + tone}>{value}</div>
        {sub && <div className="text-[10px] text-[#697181] mt-1 truncate">{sub}</div>}
      </div>
      {Icon && (
        <div className="w-8 h-8 rounded-xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center shrink-0">
          <Icon size={15} className={tone || "text-[#7A8392]"} />
        </div>
      )}
    </div>
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
    () => [...(players || [])]
      .sort((a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0))
      .slice(0, 3),
    [players]
  );
  const recentMatches = (matches || []).slice(0, 3);
  const liveChallenges = (activeChallenges || []).slice(0, 3);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.08fr_1fr_1fr] gap-4">
      <section className="m8-panel rounded-2xl p-5">
        <div className="m8-section-head">
          <div>
            <div className="brand-kicker mb-1">Competition</div>
            <h3 className="m8-section-title">Top 3 players</h3>
          </div>
          <div className="w-9 h-9 rounded-xl border border-[#D5A33A]/20 bg-[#D5A33A]/[0.07] flex items-center justify-center">
            <Trophy size={16} className="text-[#D5A33A]" />
          </div>
        </div>

        <div className="space-y-2">
          {topThree.map((player, index) => (
            <Link
              key={player.id}
              to={"/players/" + player.id}
              className={"interactive-row rounded-xl p-3 flex items-center gap-3 " + (index === 0 ? "m8-podium-first" : "")}
            >
              <div className={"m8-podium-rank " + (index === 0 ? "text-[#D5A33A]" : "text-[#737D8D]")}>
                {index + 1}
              </div>
              <PlayerAvatar
                name={player.name}
                elo={player.currentElo}
                size={index === 0 ? 42 : 36}
                avatarUrl={playerAvatars[player.id]}
              />
              <div className="min-w-0 flex-1">
                <div className="font-display font-extrabold text-sm truncate">{player.name}</div>
                <div className="mt-1"><RankBadge elo={player.currentElo} compact /></div>
              </div>
              <EloBadge elo={player.currentElo} />
            </Link>
          ))}
          {topThree.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No ranking data yet.</div>
          )}
        </div>

        <Link to="/ranking" className="inline-flex items-center gap-1 text-xs font-semibold text-magma mt-4">
          Full ranking <ArrowUpRight size={13} />
        </Link>
      </section>

      <section className="m8-panel rounded-2xl p-5">
        <div className="m8-section-head">
          <div>
            <div className="brand-kicker mb-1">Latest</div>
            <h3 className="m8-section-title">Match results</h3>
          </div>
          <div className="w-9 h-9 rounded-xl border border-magma/20 bg-magma/[0.06] flex items-center justify-center">
            <Gamepad2 size={16} className="text-magma" />
          </div>
        </div>

        <div className="space-y-2">
          {recentMatches.map((match) => {
            const winnerIds = match.winner === "A" ? match.teamA : match.teamB;
            return (
              <Link
                to="/matches"
                key={match.id}
                className="interactive-row rounded-xl p-3.5 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 flex items-center justify-center shrink-0">
                  <Trophy size={14} className="text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">
                    {match.winner === "A" ? "Team A" : "Team B"} won
                    {(Number(match.scoreA || 0) > 0 || Number(match.scoreB || 0) > 0)
                      ? " · " + Number(match.scoreA || 0) + "-" + Number(match.scoreB || 0)
                      : ""}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {(winnerIds || []).map((id) => playerMap[id]?.name).filter(Boolean).join(", ")}
                  </div>
                </div>
                <ArrowUpRight size={13} className="text-[#596170]" />
              </Link>
            );
          })}
          {recentMatches.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No matches yet.</div>
          )}
        </div>

        <Link to="/matches" className="inline-flex items-center gap-1 text-xs font-semibold text-magma mt-4">
          View all matches <ArrowUpRight size={13} />
        </Link>
      </section>

      <section className="m8-panel rounded-2xl p-5">
        <div className="m8-section-head">
          <div>
            <div className="brand-kicker mb-1">Live</div>
            <h3 className="m8-section-title">Active challs</h3>
          </div>
          <div className="m8-pill"><span className="m8-live-dot" /> Live</div>
        </div>

        <div className="space-y-2">
          {liveChallenges.map((challenge) => {
            const challenger = playerMap[challenge.challenger_player_id];
            const challenged = playerMap[challenge.challenged_player_id];

            return (
              <div key={challenge.id} className="m8-panel-quiet rounded-xl p-3.5">
                <div className="text-sm font-display font-extrabold truncate">
                  {challenger?.name || "Player"} <span className="text-[#596170] font-medium">vs</span> {challenged?.name || "Player"}
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#737D8D] mt-2">
                  <span className="text-white font-mono font-bold">{euro(challengeAmount(challenge))}</span>
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
            <Link to="/challenges" className="inline-flex items-center gap-1 text-xs font-semibold text-magma">
              Manage challenges <ArrowUpRight size={13} />
            </Link>
          ) : (
            <div className="text-xs text-muted-foreground">
              Login with Discord to manage your challenges.
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
    <div className="m8-page-stack">
      <section className="m8-hero rounded-[22px] p-6 sm:p-8 lg:p-10">
        <span className="m8-hero-accent" />
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="m8-pill">MuchoMoney8s</span>
              <span className="m8-pill">{season.season_name || "Season " + season.season_number}</span>
            </div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-[56px] leading-[0.98] font-black tracking-[-0.045em] max-w-3xl">
              Your competitive hub
              <span className="block text-magma mt-1">for 8s and challs.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#9199A7] mt-5 max-w-xl leading-6">
              Ranking, verified results, live challenges and player progression in one place.
            </p>

            <div className="flex flex-wrap gap-2 mt-6">
              <Link
                to="/ranking"
                className="m8-action m8-action-primary inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
              >
                <Trophy size={16} /> View Ranking
              </Link>
              <Link
                to="/matches"
                className="m8-action inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0D1118]/85 border border-[#2A303B] text-[#D7DBE2] hover:border-[#3A4350] hover:text-white"
              >
                <Gamepad2 size={16} /> Match Results
              </Link>
              <Button
                type="button"
                onClick={signInWithDiscord}
                disabled={discordLoading}
                className="m8-action h-11 px-5 rounded-xl bg-[#5865F2] hover:bg-[#6875F5] text-white font-bold"
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
        (
          challenge.challenger_player_id === discordPlayer.id ||
          challenge.challenged_player_id === discordPlayer.id
        ) &&
        !(challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
      ),
    [challenges, discordPlayer.id]
  );

  const moneyWon = useMemo(
    () =>
      verifiedChallenges
        .filter((challenge) => challenge.reported_winner_player_id === discordPlayer.id)
        .reduce((sum, challenge) => sum + challengeAmount(challenge), 0),
    [verifiedChallenges, discordPlayer.id]
  );

  const challengeWins = verifiedChallenges.filter(
    (challenge) => challenge.reported_winner_player_id === discordPlayer.id
  ).length;
  const challengeLosses = Math.max(0, verifiedChallenges.length - challengeWins);

  const rankPosition = useMemo(() => {
    const sorted = [...(players || [])].sort(
      (a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0)
    );
    const index = sorted.findIndex((player) => player.id === discordPlayer.id);
    return index >= 0 ? index + 1 : null;
  }, [players, discordPlayer.id]);

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
    <div className="m8-page-stack">
      <section className="m8-hero rounded-[22px] p-5 sm:p-7 lg:p-8">
        <span className="m8-hero-accent" />
        <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1fr_390px] gap-7 items-stretch">
          <div className="flex flex-col justify-between min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="m8-pill">{season.season_name || "Season " + season.season_number}</span>
                {rankPosition && <span className="m8-pill">Global rank #{rankPosition}</span>}
              </div>

              <div className="flex items-center gap-4 sm:gap-5 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute -inset-2 rounded-2xl bg-magma/[0.07] blur-xl" />
                  <div className="relative">
                    <PlayerAvatar
                      name={discordPlayer.name}
                      elo={discordPlayer.currentElo}
                      size={88}
                      avatarUrl={playerAvatars[discordPlayer.id]}
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="brand-kicker mb-1">Your competitive profile</div>
                  <h2 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.035em] truncate">
                    {discordPlayer.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-3">
                    <RankBadge elo={discordPlayer.currentElo} />
                    <span className="text-sm text-[#8F98A8]">{record}</span>
                    {streak !== 0 && (
                      <span className={"inline-flex items-center gap-1 text-sm font-bold " + (streak > 0 ? "text-orange-400" : "text-red-400")}>
                        <Flame size={14} /> {Math.abs(streak)} {streak > 0 ? "win" : "loss"} streak
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <Link
                to="/team-builder"
                className="m8-action m8-action-primary inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
              >
                <Swords size={16} /> Build Teams
              </Link>
              <Link
                to="/challenges"
                className="m8-action inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0D1118]/85 border border-[#2A303B] text-[#D7DBE2] hover:border-[#3A4350] hover:text-white"
              >
                <WalletCards size={16} /> My Challenges
              </Link>
              <Link
                to={"/players/" + discordPlayer.id}
                className="m8-action inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[#0D1118]/85 border border-[#2A303B] text-[#D7DBE2] hover:border-[#3A4350] hover:text-white"
              >
                <UserCircle size={16} /> Full Profile
              </Link>
            </div>
          </div>

          <div className="m8-rank-spotlight rounded-2xl p-5 flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="brand-kicker mb-1">Current division</div>
                  <div className="font-display text-xl font-black">Rank progression</div>
                </div>
                <EloBadge elo={discordPlayer.currentElo} />
              </div>
              <div className="mt-5">
                <RankProgress elo={discordPlayer.currentElo} />
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-2 gap-2 mt-5">
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#697181]">Match record</div>
                <div className="font-mono font-bold mt-1">{record}</div>
              </div>
              <div className="m8-panel-quiet rounded-xl p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#697181]">Chall record</div>
                <div className="font-mono font-bold mt-1">
                  <span className="text-emerald-400">{challengeWins}W</span>
                  <span className="text-[#596170] mx-1">-</span>
                  <span className="text-red-400">{challengeLosses}L</span>
                </div>
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
              {adminChallengeAlertCount} {adminChallengeAlertCount === 1 ? "item needs Admin attention" : "items need Admin attention"}
            </div>
          </div>
          <ArrowUpRight size={15} className="text-orange-400" />
        </Link>
      )}

      <section className="m8-panel rounded-2xl p-5">
        <div className="m8-section-head">
          <div>
            <div className="brand-kicker mb-1">Snapshot</div>
            <h3 className="m8-section-title">Your competition status</h3>
          </div>
          <span className="m8-pill">Live profile</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <CompactMetric
            label="Elo"
            value={discordPlayer.currentElo}
            sub={rankPosition ? "Global #" + rankPosition : "Current rating"}
            icon={Trophy}
          />
          <CompactMetric
            label="Match Record"
            value={record}
            sub={(discordPlayer.totalMatches || 0) + " total matches"}
            icon={Gamepad2}
          />
          <CompactMetric
            label="Streak"
            value={streak === 0 ? "—" : (streak > 0 ? "+" : "-") + Math.abs(streak)}
            sub={streak > 0 ? "Win streak" : streak < 0 ? "Loss streak" : "No active streak"}
            icon={Flame}
            tone={streak > 0 ? "text-orange-400" : streak < 0 ? "text-red-400" : ""}
          />
          <CompactMetric
            label="Money Won"
            value={euro(moneyWon)}
            sub={challengeWins + " verified chall wins"}
            icon={WalletCards}
            tone="text-emerald-400"
          />
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-5">
        <div className="m8-section-head">
          <div>
            <div className="brand-kicker mb-1">Latest Activity</div>
            <h3 className="m8-section-title">Your recent results</h3>
          </div>
          <Link to="/matches" className="text-xs font-semibold text-magma inline-flex items-center gap-1">
            View all <ArrowUpRight size={13} />
          </Link>
        </div>

        {activity.length === 0 ? (
          <div className="m8-panel-quiet rounded-xl py-10 text-center text-sm text-muted-foreground">
            No activity yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
            {activity.map((item) => (
              <Link
                key={item.id}
                to={item.to}
                className="interactive-row rounded-xl p-3.5 flex items-center gap-3"
              >
                <div className={"w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 " + (
                  item.won
                    ? "bg-emerald-500/[0.07] border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/[0.06] border-red-500/20 text-red-400"
                )}>
                  {item.type === "chall" ? <WalletCards size={16} /> : <Trophy size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{item.title}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{item.detail}</div>
                </div>
                <div className="text-[10px] text-[#697181] shrink-0">
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
