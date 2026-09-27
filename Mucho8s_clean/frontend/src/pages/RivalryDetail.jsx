import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Flame,
  Gamepad2,
  Swords,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { buildRivalries } from "@/lib/rivalries";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const ResultDot = ({ item, playerAId, playerAName, playerBName }) => {
  const aWon = String(item.winnerId) === String(playerAId);
  return (
    <span
      title={`${aWon ? playerAName : playerBName} won`}
      className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center text-[10px] font-black ${
        aWon
          ? "border-magma/25 bg-magma/[0.08] text-magma"
          : "border-[#65D5D3]/25 bg-[#65D5D3]/[0.06] text-[#65D5D3]"
      }`}
    >
      {aWon ? "A" : "B"}
    </span>
  );
};

export default function RivalryDetail() {
  const { playerAId, playerBId } = useParams();
  const { matches, publicChallenges, playerMap, playerAvatars } = useData();

  const rivalry = useMemo(
    () =>
      buildRivalries(matches, publicChallenges).find(
        (row) =>
          (String(row.playerAId) === String(playerAId) &&
            String(row.playerBId) === String(playerBId)) ||
          (String(row.playerAId) === String(playerBId) &&
            String(row.playerBId) === String(playerAId))
      ) || null,
    [matches, publicChallenges, playerAId, playerBId]
  );

  if (!rivalry) {
    return (
      <div className="m8-page-stack">
        <section className="m8-panel rounded-[22px] p-10 text-center">
          <Swords size={30} className="mx-auto text-[#697181]" />
          <h1 className="font-display text-2xl font-black mt-3">Rivalry not found</h1>
          <p className="text-sm text-muted-foreground mt-2">
            These players do not have enough verified history yet.
          </p>
          <Link
            to="/rivalries"
            className="mt-5 inline-flex h-10 px-4 rounded-xl bg-white text-black items-center justify-center font-bold text-sm"
          >
            Back to Rivalries
          </Link>
        </section>
      </div>
    );
  }

  const playerA = playerMap[rivalry.playerAId];
  const playerB = playerMap[rivalry.playerBId];
  const playerAName = playerA?.name || "Player";
  const playerBName = playerB?.name || "Player";
  const netA = Number(rivalry.playerANet || 0);
  const moneyLeader =
    netA > 0 ? playerAName : netA < 0 ? playerBName : "Even";
  const moneyEdge = Math.abs(netA);
  const streakName =
    rivalry.streakWinnerId === rivalry.playerAId
      ? playerAName
      : rivalry.streakWinnerId === rivalry.playerBId
        ? playerBName
        : "";

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <Link
          to="/rivalries"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
        >
          <ArrowLeft size={14} /> Rivalries
        </Link>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <Link
            to={`/players/${rivalry.playerAId}`}
            className="min-w-0 flex flex-col sm:flex-row items-center gap-3"
          >
            <PlayerAvatar
              name={playerAName}
              elo={playerA?.currentElo || 1000}
              size={60}
              avatarUrl={playerAvatars[rivalry.playerAId]}
            />
            <div className="min-w-0 text-center sm:text-left">
              <div className="font-display font-black text-lg sm:text-2xl truncate">
                {playerAName}
              </div>
              <div className="font-mono text-xs text-[#697181] mt-1">
                {Number(playerA?.currentElo || 1000)} Elo
              </div>
            </div>
          </Link>

          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181]">
              Head to Head
            </div>
            <div className="font-display font-black text-4xl sm:text-5xl tracking-[-0.05em] mt-1">
              {rivalry.playerAWins}
              <span className="text-[#596170] mx-2 sm:mx-3">-</span>
              {rivalry.playerBWins}
            </div>
            <div className="text-[10px] text-[#697181] mt-1">
              {rivalry.meetings} meetings
            </div>
          </div>

          <Link
            to={`/players/${rivalry.playerBId}`}
            className="min-w-0 flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3"
          >
            <div className="min-w-0 text-center sm:text-right">
              <div className="font-display font-black text-lg sm:text-2xl truncate">
                {playerBName}
              </div>
              <div className="font-mono text-xs text-[#697181] mt-1">
                {Number(playerB?.currentElo || 1000)} Elo
              </div>
            </div>
            <PlayerAvatar
              name={playerBName}
              elo={playerB?.currentElo || 1000}
              size={60}
              avatarUrl={playerAvatars[rivalry.playerBId]}
            />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-6">
          <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              Team H2H
            </div>
            <div className="font-mono font-black text-lg mt-1">{rivalry.teamMeetings}</div>
          </div>

          <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              1v1 H2H
            </div>
            <div className="font-mono font-black text-lg mt-1">{rivalry.directMeetings}</div>
          </div>

          <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              Money played
            </div>
            <div className="font-mono font-black text-lg mt-1 text-[#D5A33A]">
              {euro(rivalry.moneyVolume)}
            </div>
          </div>

          <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">
              Money edge
            </div>
            <div className="font-mono font-black text-sm mt-1">
              {moneyLeader === "Even" ? "Even" : `${moneyLeader} +${euro(moneyEdge)}`}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="m8-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-[#D5A33A]" />
            <div>
              <div className="brand-kicker mb-1">Recent form</div>
              <h2 className="font-display font-bold text-lg">Last 5 H2H</h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {rivalry.recentFive.map((item, index) => (
              <ResultDot
                key={`${item.id}-${index}`}
                item={item}
                playerAId={rivalry.playerAId}
                playerAName={playerAName}
                playerBName={playerBName}
              />
            ))}
          </div>

          <div className="text-[10px] text-[#697181] mt-3">
            A = {playerAName} · B = {playerBName}
          </div>
        </div>

        <div className="m8-panel rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-orange-400" />
            <div>
              <div className="brand-kicker mb-1">Momentum</div>
              <h2 className="font-display font-bold text-lg">Current streak</h2>
            </div>
          </div>

          <div className="font-display text-3xl font-black mt-4">
            {streakName ? `${streakName} W${rivalry.currentStreak}` : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Consecutive wins in this head-to-head.
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">History</div>
            <h2 className="font-display font-bold text-xl">All meetings</h2>
          </div>
          <div className="text-xs text-muted-foreground">
            {rivalry.history.length} results
          </div>
        </div>

        <div className="space-y-2">
          {rivalry.history.map((item, index) => {
            const winnerName =
              String(item.winnerId) === String(rivalry.playerAId)
                ? playerAName
                : playerBName;

            return (
              <div
                key={`${item.id}-${index}`}
                className="rounded-xl border border-[#202631] bg-[#0F1218] px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="w-9 h-9 rounded-lg border border-[#2A303B] bg-[#151923] flex items-center justify-center shrink-0">
                  {item.type === "1v1" ? (
                    <Swords size={15} className="text-[#D5A33A]" />
                  ) : (
                    <Gamepad2 size={15} className="text-[#8E98FF]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">
                    <span className="text-emerald-400">{winnerName}</span> won
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                    <span>{item.type === "1v1" ? "1v1 Chall" : "Team Match"}</span>
                    {item.format && <><span>·</span><span>{item.format}</span></>}
                    {item.game && <><span>·</span><span>{item.game}</span></>}
                    {item.mode && <><span>·</span><span>{item.mode}</span></>}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  {Number(item.amount || 0) > 0 && (
                    <div className="inline-flex items-center gap-1.5 font-mono font-black text-sm text-[#D5A33A]">
                      <WalletCards size={13} />
                      {euro(item.amount)}
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 text-[10px] text-[#697181] whitespace-nowrap">
                    <CalendarDays size={12} />
                    {item.date ? new Date(item.date).toLocaleDateString() : "—"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
