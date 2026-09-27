import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Flame,
  Search,
  Swords,
  Trophy,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { buildRivalries } from "@/lib/rivalries";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const RivalryBadge = ({ children, tone = "neutral", icon: Icon = null }) => {
  const classes =
    tone === "hot"
      ? "border-orange-500/20 bg-orange-500/[0.06] text-orange-400"
      : tone === "money"
        ? "border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] text-[#D5A33A]"
        : "border-[#2A303B] bg-[#151923] text-[#AAB1BE]";

  return (
    <span
      className={`h-7 px-2.5 rounded-lg border inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] ${classes}`}
    >
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
};

const FormStrip = ({ items, playerAId, playerAName, playerBName }) => (
  <div className="flex items-center gap-1.5">
    {items.length === 0 ? (
      <span className="text-[10px] text-[#697181]">No form yet</span>
    ) : (
      items.map((item, index) => {
        const aWon = String(item.winnerId) === String(playerAId);
        return (
          <span
            key={`${item.id}-${index}`}
            title={`${aWon ? playerAName : playerBName} won`}
            aria-label={`${aWon ? playerAName : playerBName} won`}
            className={`w-7 h-7 rounded-lg border inline-flex items-center justify-center text-[9px] font-black ${
              aWon
                ? "border-magma/25 bg-magma/[0.08] text-magma"
                : "border-[#65D5D3]/25 bg-[#65D5D3]/[0.06] text-[#65D5D3]"
            }`}
          >
            {aWon ? "A" : "B"}
          </span>
        );
      })
    )}
  </div>
);

export default function Rivalries() {
  const { matches, publicChallenges, playerMap, playerAvatars } = useData();
  const [query, setQuery] = useState("");

  const rivalries = useMemo(
    () =>
      buildRivalries(matches, publicChallenges).filter(
        (row) => Number(row.meetings || 0) >= 2
      ),
    [matches, publicChallenges]
  );

  const maxMeetings = useMemo(
    () => Math.max(0, ...rivalries.map((row) => Number(row.meetings || 0))),
    [rivalries]
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rivalries;

    return rivalries.filter((row) => {
      const a = playerMap[row.playerAId]?.name || "";
      const b = playerMap[row.playerBId]?.name || "";
      return a.toLowerCase().includes(term) || b.toLowerCase().includes(term);
    });
  }, [query, rivalries, playerMap]);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Competition</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
              Rivalries
            </h1>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              The most played head-to-head matchups, form, streaks and money history.
            </p>
          </div>

          <div className="relative w-full lg:w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player..."
              className="h-10 pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
            />
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="m8-panel rounded-2xl p-10 text-center">
          <UsersRound size={28} className="mx-auto text-[#697181]" />
          <h2 className="font-display font-bold text-xl mt-3">No rivalries yet</h2>
          <p className="text-sm text-muted-foreground mt-2">
            A rivalry appears after the same two players meet at least twice.
          </p>
        </section>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {visible.map((row) => {
            const playerA = playerMap[row.playerAId];
            const playerB = playerMap[row.playerBId];
            const playerAName = playerA?.name || "Player";
            const playerBName = playerB?.name || "Player";
            const netA = Number(row.playerANet || 0);
            const moneyLeader =
              netA > 0 ? playerAName : netA < 0 ? playerBName : "Even";
            const moneyEdge = Math.abs(netA);
            const streakName =
              row.streakWinnerId === row.playerAId
                ? playerAName
                : row.streakWinnerId === row.playerBId
                  ? playerBName
                  : "";
            const isMostPlayed = row.meetings === maxMeetings && maxMeetings > 0;
            const isHot = row.meetings >= 8 && row.scoreDiff <= 2;
            const isMoneyRivalry = row.moneyVolume >= 20;

            return (
              <article
                key={row.key}
                className="m8-panel rounded-2xl p-4 sm:p-5"
                data-testid={`rivalry-${row.key}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isMostPlayed && (
                      <RivalryBadge icon={Trophy}>Most Played</RivalryBadge>
                    )}
                    {isHot && (
                      <RivalryBadge tone="hot" icon={Flame}>Hot Rivalry</RivalryBadge>
                    )}
                    {isMoneyRivalry && (
                      <RivalryBadge tone="money" icon={WalletCards}>
                        Money Rivalry
                      </RivalryBadge>
                    )}
                  </div>

                  {row.lastMeetingAt && (
                    <div className="text-[10px] text-[#697181]">
                      Last · {new Date(row.lastMeetingAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Link
                    to={`/players/${row.playerAId}`}
                    className="min-w-0 flex items-center gap-2.5 hover:opacity-90"
                  >
                    <PlayerAvatar
                      name={playerAName}
                      elo={playerA?.currentElo || 1000}
                      size={42}
                      avatarUrl={playerAvatars[row.playerAId]}
                    />
                    <div className="min-w-0">
                      <div className="font-display font-black text-base sm:text-lg truncate">
                        {playerAName}
                      </div>
                      <div className="font-mono text-[10px] text-[#697181] mt-0.5">
                        {Number(playerA?.currentElo || 1000)} Elo
                      </div>
                    </div>
                  </Link>

                  <div className="text-center px-1">
                    <div className="font-display font-black text-2xl sm:text-3xl tracking-[-0.04em]">
                      {row.playerAWins}
                      <span className="text-[#596170] mx-2">-</span>
                      {row.playerBWins}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181] mt-1">
                      {row.meetings} meetings
                    </div>
                  </div>

                  <Link
                    to={`/players/${row.playerBId}`}
                    className="min-w-0 flex items-center justify-end gap-2.5 hover:opacity-90"
                  >
                    <div className="min-w-0 text-right">
                      <div className="font-display font-black text-base sm:text-lg truncate">
                        {playerBName}
                      </div>
                      <div className="font-mono text-[10px] text-[#697181] mt-0.5">
                        {Number(playerB?.currentElo || 1000)} Elo
                      </div>
                    </div>
                    <PlayerAvatar
                      name={playerBName}
                      elo={playerB?.currentElo || 1000}
                      size={42}
                      avatarUrl={playerAvatars[row.playerBId]}
                    />
                  </Link>
                </div>

                <div className="mt-4 pt-4 border-t border-[#202631] grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181] mb-2">
                      Last 5
                    </div>
                    <FormStrip
                      items={row.recentFive}
                      playerAId={row.playerAId}
                      playerAName={playerAName}
                      playerBName={playerBName}
                    />
                  </div>

                  <div className="sm:text-right">
                    <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">
                      Current streak
                    </div>
                    <div className="font-mono font-black text-sm mt-1">
                      {streakName ? `${streakName} W${row.currentStreak}` : "—"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 text-[11px] text-[#8A93A1]">
                  <span>
                    Team <strong className="text-white">{row.teamMeetings}</strong>
                  </span>
                  <span>
                    1v1 <strong className="text-white">{row.directMeetings}</strong>
                  </span>
                  <span>
                    Played <strong className="text-[#D5A33A]">{euro(row.moneyVolume)}</strong>
                  </span>
                  {row.moneyVolume > 0 && (
                    <span>
                      Money edge{" "}
                      <strong className={moneyEdge > 0 ? "text-emerald-400" : "text-white"}>
                        {moneyLeader === "Even"
                          ? "Even"
                          : `${moneyLeader} +${euro(moneyEdge)}`}
                      </strong>
                    </span>
                  )}
                </div>

                <Link
                  to={`/rivalries/${row.playerAId}/${row.playerBId}`}
                  className="mt-4 h-10 rounded-xl border border-[#2A303B] bg-[#0F1218] hover:bg-[#151A22] hover:border-[#394150] flex items-center justify-center gap-2 text-xs font-bold transition-all"
                >
                  <Swords size={14} className="text-[#D5A33A]" />
                  View Rivalry
                  <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
