import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge, RankBadge } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  Flame,
  Gamepad2,
  LogIn,
  Radio,
  ShieldAlert,
  Trophy,
  UserCircle,
  WalletCards,
} from "lucide-react";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));

const liveDuration = (createdAt, now = Date.now()) => {
  const started = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(started) || started <= 0) return "just started";

  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

const CompactMetric = ({ label, value, sub, icon: Icon, tone = "", to = "" }) => {
  const content = (
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#737D8D] font-bold">
          {label}
        </div>
        <div className={"font-display text-[1.35rem] font-black mt-1 truncate " + tone}>
          {value}
        </div>
        {sub && <div className="text-[10px] text-[#697181] mt-1 truncate">{sub}</div>}
      </div>
      {Icon && (
        <div className="w-8 h-8 rounded-xl border border-white/[0.06] bg-white/[0.025] flex items-center justify-center shrink-0">
          <Icon size={15} className={tone || "text-[#7A8392]"} />
        </div>
      )}
    </div>
  );

  if (!to) {
    return <div className="m8-stat-card min-w-0">{content}</div>;
  }

  return (
    <Link
      to={to}
      className="m8-stat-card min-w-0 transition-all hover:border-[#3A4350] hover:-translate-y-0.5"
    >
      {content}
    </Link>
  );
};

const CompetitionOverview = ({
  players,
  matches,
  playerMap,
  playerAvatars,
  liveMatches,
}) => {
  const [liveNow, setLiveNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const topThree = useMemo(
    () => [...(players || [])]
      .sort((a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0))
      .slice(0, 3),
    [players]
  );
  const recentMatches = (matches || []).slice(0, 3);
  const activeTeamMatches = (liveMatches || []).slice(0, 3);

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
                <ModeBadge mode="mucho8s" compact className="shrink-0" />
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
            <h3 className="m8-section-title">Live Matches</h3>
          </div>
          <div className="m8-pill"><span className="m8-live-dot" /> Live</div>
        </div>

        <div className="space-y-2">
          {activeTeamMatches.map((match) => {
            const alpha = (match.team_a || []).map((id) => playerMap[id]?.name).filter(Boolean);
            const bravo = (match.team_b || []).map((id) => playerMap[id]?.name).filter(Boolean);
            const captain = playerMap[match.captain_player_id];

            return (
              <Link key={match.id} to="/matches" className="interactive-row rounded-xl p-3.5 block">
                <div className="flex flex-wrap items-center gap-2">
                  <ModeBadge mode="mucho8s" compact />
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
                    <Radio size={12} /> {match.format || "MATCH"} · {match.game || "Game"}{match.mode ? ` · ${match.mode}` : ""} · {liveDuration(match.created_at, liveNow)}
                  </div>
                </div>
                <div className="text-sm font-display font-extrabold mt-2 truncate">
                  {alpha.join(", ") || "Alpha"} <span className="text-[#596170] font-medium">vs</span> {bravo.join(", ") || "Bravo"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Captain · {captain?.name || "Admin"}
                </div>
              </Link>
            );
          })}
          {activeTeamMatches.length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No live matches right now.</div>
          )}
        </div>

        <div className="mt-4">
          <Link to="/team-builder" className="inline-flex items-center gap-1 text-xs font-semibold text-magma">
            Open Team Builder <ArrowUpRight size={13} />
          </Link>
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
  liveMatches,
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
              <span className="block text-magma mt-1">for every Mucho mode.</span>
            </h2>
            <p className="text-sm sm:text-base text-[#9199A7] mt-5 max-w-xl leading-6">
              Mucho8s and Mucho1v1 are live. MuchoRanked and MuchoTourney are coming next.
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
        liveMatches={liveMatches}
      />
    </div>
  );
};

const PersonalDashboard = ({
  discordPlayer,
  playerAvatars,
  matches,
  season,
  isAdmin,
  adminChallengeAlertCount,
  players,
}) => {
  const allPersonalMatches = useMemo(
    () =>
      [...matches]
        .filter(
          (match) =>
            match.teamA?.includes(discordPlayer.id) ||
            match.teamB?.includes(discordPlayer.id)
        )
        .sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0)),
    [matches, discordPlayer.id]
  );

  const recentMatches = useMemo(
    () => allPersonalMatches.slice(0, 3),
    [allPersonalMatches]
  );

  const moneyWon = useMemo(
    () =>
      allPersonalMatches.reduce((sum, match) => {
        const inA = (match.teamA || []).includes(discordPlayer.id);
        const winnerSide = match.winner === "B" ? "B" : "A";
        const won =
          (inA && winnerSide === "A") ||
          (!inA && winnerSide === "B");

        if (!won) return sum;

        const pairing = (Array.isArray(match.pairings) ? match.pairings : []).find(
          (pair) =>
            pair?.playerAId === discordPlayer.id ||
            pair?.playerBId === discordPlayer.id
        );

        return sum + Math.max(0, Number(pairing?.amount) || 0);
      }, 0),
    [allPersonalMatches, discordPlayer.id]
  );

  const rankPosition = useMemo(() => {
    const sorted = [...(players || [])].sort(
      (a, b) => Number(b.currentElo || 0) - Number(a.currentElo || 0)
    );
    const index = sorted.findIndex((player) => player.id === discordPlayer.id);
    return index >= 0 ? index + 1 : null;
  }, [players, discordPlayer.id]);

  const activity = useMemo(
    () =>
      recentMatches.map((match) => {
        const winners = match.winner === "A" ? match.teamA : match.teamB;
        const won = winners.includes(discordPlayer.id);

        return {
          id: match.id,
          date: match.date,
          won,
          title: won ? "Match won" : "Match lost",
          detail:
            `${match.game || "Mucho8s"}${match.mode ? ` · ${match.mode}` : ""}` +
            ((Number(match.scoreA || 0) > 0 || Number(match.scoreB || 0) > 0)
              ? ` · ${Number(match.scoreA || 0)}-${Number(match.scoreB || 0)}`
              : ""),
        };
      }),
    [recentMatches, discordPlayer.id]
  );

  const record = `${discordPlayer.wins || 0}W - ${discordPlayer.losses || 0}L`;
  const streak = Number(discordPlayer.currentStreak || 0);

  return (
    <div className="m8-page-stack">
      <section className="m8-hero rounded-[22px] p-5 sm:p-7">
        <span className="m8-hero-accent" />

        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="m8-pill">
              {season.season_name || "Season " + season.season_number}
            </span>
            {rankPosition && (
              <span className="m8-pill">Global rank #{rankPosition}</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            <div className="relative shrink-0 self-start">
              <div className="absolute -inset-2 rounded-2xl bg-magma/[0.07] blur-xl" />
              <div className="relative">
                <PlayerAvatar
                  name={discordPlayer.name}
                  elo={discordPlayer.currentElo}
                  size={82}
                  avatarUrl={playerAvatars[discordPlayer.id]}
                />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="brand-kicker mb-1">Your competitive profile</div>
              <h2 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.035em] truncate">
                {discordPlayer.name}
              </h2>

              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <RankBadge elo={discordPlayer.currentElo} />
                <span className="font-mono text-xs font-black text-white">
                  {discordPlayer.currentElo} Elo
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            <Link
              to="/play"
              className="m8-action m8-action-primary inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <Gamepad2 size={16} /> Play
            </Link>

            <Link
              to={"/players/" + discordPlayer.id}
              className="m8-action inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-[#0D1118]/85 border border-[#2A303B] text-[#D7DBE2] hover:border-[#3A4350] hover:text-white"
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
              {adminChallengeAlertCount}{" "}
              {adminChallengeAlertCount === 1
                ? "item needs Admin attention"
                : "items need Admin attention"}
            </div>
          </div>
          <ArrowUpRight size={15} className="text-orange-400" />
        </Link>
      )}

      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Competitive Snapshot</div>
            <h3 className="font-display font-black text-xl tracking-[-0.02em]">
              Your current form
            </h3>
          </div>

          <Link
            to={"/players/" + discordPlayer.id}
            className="text-[10px] uppercase tracking-[0.16em] text-[#697181] hover:text-white inline-flex items-center gap-1"
          >
            Open full profile <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <CompactMetric
            label="Elo"
            value={discordPlayer.currentElo}
            sub={rankPosition ? "Global #" + rankPosition : "Current rating"}
            icon={Trophy}
            to="/ranking"
          />
          <CompactMetric
            label="Mucho8s Record"
            value={record}
            sub={(discordPlayer.totalMatches || 0) + " total matches"}
            icon={Gamepad2}
            to={"/players/" + discordPlayer.id}
          />
          <CompactMetric
            label="Streak"
            value={streak === 0 ? "—" : (streak > 0 ? "+" : "-") + Math.abs(streak)}
            sub={
              streak > 0
                ? "Win streak"
                : streak < 0
                  ? "Loss streak"
                  : "No active streak"
            }
            icon={Flame}
            tone={
              streak > 0
                ? "text-orange-400"
                : streak < 0
                  ? "text-red-400"
                  : ""
            }
            to={"/players/" + discordPlayer.id}
          />
          <CompactMetric
            label="Mucho8s Winnings"
            value={euro(moneyWon)}
            sub="Verified money pairings"
            icon={WalletCards}
            tone="text-emerald-400"
            to="/matches"
          />
        </div>

        <div className="mt-5 pt-4 border-t border-[#1D222C]">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">
                Recent activity
              </div>
              <div className="font-display font-bold text-base mt-0.5">
                Latest Mucho8s
              </div>
            </div>

            <Link
              to="/matches"
              className="text-xs font-semibold text-magma inline-flex items-center gap-1"
            >
              View all <ArrowUpRight size={13} />
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A303B] bg-[#0F1218] py-8 text-center text-sm text-muted-foreground">
              No Mucho8s activity yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
              {activity.map((item) => (
                <Link
                  key={item.id}
                  to="/matches"
                  className="group rounded-xl border border-[#222834] bg-[#0F1218] p-3.5 flex items-center gap-3 transition-all hover:border-[#3A4350] hover:bg-[#131820]"
                >
                  <ModeBadge mode="mucho8s" compact className="shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-1.5">
                      <span>{item.title}</span>
                      <ArrowUpRight
                        size={11}
                        className="text-[#596170] opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.detail}
                    </div>
                  </div>

                  <div className="text-[10px] text-[#697181] shrink-0">
                    {item.date ? new Date(item.date).toLocaleDateString() : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
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
    signInWithDiscord,
    isAdmin,
    adminChallengeAlertCount,
    liveMatches,
  } = useData();

  const season = dashboardData?.competition || { season_number: 1, season_name: "Season 1" };
  const loggedIn = Boolean(discordSession && discordPlayer);

  if (!loggedIn) {
    return (
      <GuestDashboard
        players={players}
        matches={matches}
        playerMap={playerMap}
        playerAvatars={playerAvatars}
        liveMatches={liveMatches}
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
      season={season}
      isAdmin={isAdmin}
      adminChallengeAlertCount={adminChallengeAlertCount}
      players={players}
    />
  );
}
