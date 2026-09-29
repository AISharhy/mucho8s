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
import ModeBadge from "@/components/ModeBadge";
import { buildRivalries } from "@/lib/rivalries";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const ResultDot = ({ item, focusPlayerId, focusPlayerName }) => {
  const won = String(item.winnerId) === String(focusPlayerId);
  return (
    <span
      title={`${focusPlayerName} ${won ? "won" : "lost"}`}
      className={`w-8 h-8 rounded-lg border inline-flex items-center justify-center text-[10px] font-black ring-1 ring-inset ${
        item.type === "1v1" ? "ring-emerald-500/35" : "ring-magma/35"
      } ${
        won
          ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400"
          : "border-red-500/20 bg-red-500/[0.06] text-red-400"
      }`}
    >
      {won ? "W" : "L"}
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
            to="/bacheca/rivalries"
            className="mt-5 inline-flex h-10 px-4 rounded-xl bg-white text-black items-center justify-center font-bold text-sm"
          >
            Back to Rivalries
          </Link>
        </section>
      </div>
    );
  }

  const swapSides =
    Number(rivalry.playerBWins || 0) > Number(rivalry.playerAWins || 0);
  const leftId = swapSides ? rivalry.playerBId : rivalry.playerAId;
  const rightId = swapSides ? rivalry.playerAId : rivalry.playerBId;
  const leftPlayer = playerMap[leftId];
  const rightPlayer = playerMap[rightId];
  const leftName = leftPlayer?.name || "Player";
  const rightName = rightPlayer?.name || "Player";
  const leftWins = swapSides ? rivalry.playerBWins : rivalry.playerAWins;
  const rightWins = swapSides ? rivalry.playerAWins : rivalry.playerBWins;
  const leadBy = Math.max(0, Number(leftWins || 0) - Number(rightWins || 0));
  const leftNet = swapSides
    ? -Number(rivalry.playerANet || 0)
    : Number(rivalry.playerANet || 0);
  const moneyLeader =
    leftNet > 0 ? leftName : leftNet < 0 ? rightName : "Even";
  const moneyEdge = Math.abs(leftNet);
  const streakName =
    rivalry.streakWinnerId === leftId
      ? leftName
      : rivalry.streakWinnerId === rightId
        ? rightName
        : "";

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <Link
          to="/bacheca/rivalries"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
        >
          <ArrowLeft size={14} /> Rivalries
        </Link>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <Link
            to={`/players/${leftId}`}
            className="min-w-0 flex flex-col sm:flex-row items-center gap-3"
          >
            <div className={`rounded-2xl ${leadBy > 0 ? "ring-1 ring-emerald-500/25" : ""}`}>
              <PlayerAvatar
                name={leftName}
                elo={leftPlayer?.currentElo || 1000}
                size={60}
                avatarUrl={playerAvatars[leftId]}
              />
            </div>
            <div className="min-w-0 text-center sm:text-left">
              <div className="font-display font-black text-lg sm:text-2xl truncate">
                {leftName}
              </div>
              <div className="font-mono text-xs text-[#697181] mt-1">
                {Number(leftPlayer?.currentElo || 1000)} Elo
              </div>
            </div>
          </Link>

          <div className="text-center">
            <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181]">
              Head to Head
            </div>
            <div className="font-display font-black text-4xl sm:text-5xl tracking-[-0.05em] mt-1">
              <span className={leadBy > 0 ? "text-emerald-400 drop-shadow-[0_0_14px_rgba(52,211,153,.2)]" : "text-white"}>
                {leftWins}
              </span>
              <span className="text-[#596170] mx-2 sm:mx-3">-</span>
              <span className={leadBy > 0 ? "text-[#7D8795]" : "text-white"}>
                {rightWins}
              </span>
            </div>
            <div className={`text-[10px] mt-1 font-semibold ${
              leadBy > 0 ? "text-emerald-400/80" : "text-[#697181]"
            }`}>
              {leadBy > 0 ? `${leftName} leads by ${leadBy}` : "Tied rivalry"}
            </div>
            <div className="text-[10px] text-[#596170] mt-0.5">
              {rivalry.meetings} meetings
            </div>
          </div>

          <Link
            to={`/players/${rightId}`}
            className="min-w-0 flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3"
          >
            <div className="min-w-0 text-center sm:text-right">
              <div className="font-display font-black text-lg sm:text-2xl truncate text-[#C5CBD4]">
                {rightName}
              </div>
              <div className="font-mono text-xs text-[#697181] mt-1">
                {Number(rightPlayer?.currentElo || 1000)} Elo
              </div>
            </div>
            <PlayerAvatar
              name={rightName}
              elo={rightPlayer?.currentElo || 1000}
              size={60}
              avatarUrl={playerAvatars[rightId]}
            />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-6">
          <div className="rounded-xl border border-magma/20 bg-magma/[0.025] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-magma">
              Mucho8s H2H
            </div>
            <div className="font-mono font-black text-lg mt-1">{rivalry.teamMeetings}</div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.025] px-3 py-3">
            <div className="text-[9px] uppercase tracking-widest text-emerald-400">
              Mucho1v1 H2H
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
                focusPlayerId={leftId}
                focusPlayerName={leftName}
              />
            ))}
          </div>

          <div className="text-[10px] text-[#697181] mt-3">
            W/L shown from {leftName}'s perspective
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
              String(item.winnerId) === String(leftId)
                ? leftName
                : rightName;

            return (
              <div
                key={`${item.id}-${index}`}
                className="rounded-xl border border-[#202631] bg-[#0F1218] px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <ModeBadge
                  mode={item.type === "1v1" ? "mucho1v1" : "mucho8s"}
                  compact
                  className="shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm">
                    <span className="text-emerald-400">{winnerName}</span> won
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                    {item.format && <span>{item.format}</span>}
                    {item.game && <><span>·</span><span>{item.game}</span></>}
                    {item.mode && <><span>·</span><span>{item.mode}</span></>}
                  </div>
                </div>

                <div className="flex items-center gap-4 sm:justify-end">
                  {Number(item.amount || 0) > 0 && (
                    <div className={`inline-flex items-center gap-1.5 font-mono font-black text-sm ${
                      item.type === "1v1" ? "text-emerald-400" : "text-magma"
                    }`}>
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
