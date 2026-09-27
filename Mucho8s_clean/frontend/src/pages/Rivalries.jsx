import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Swords, UsersRound, WalletCards } from "lucide-react";
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
              Head-to-head history built from verified team matches and direct 1v1 challs.
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
            const netA = Number(row.playerANet || 0);

            return (
              <article
                key={row.key}
                className="m8-panel rounded-2xl p-4 sm:p-5"
                data-testid={`rivalry-${row.key}`}
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#697181]">
                    <Swords size={14} className="text-[#D5A33A]" />
                    {row.meetings} meetings
                  </div>

                  {row.lastMeetingAt && (
                    <div className="text-[10px] text-[#697181]">
                      Last · {new Date(row.lastMeetingAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <Link
                    to={`/players/${row.playerAId}`}
                    className="min-w-0 rounded-xl border border-[#222834] bg-[#0F1218] p-3 hover:border-[#353D49] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        name={playerA?.name || "Player"}
                        elo={playerA?.currentElo || 1000}
                        size={36}
                        avatarUrl={playerAvatars[row.playerAId]}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {playerA?.name || "Player"}
                        </div>
                        <div className="font-mono text-xs text-emerald-400 mt-0.5">
                          {row.playerAWins}W
                        </div>
                      </div>
                    </div>
                  </Link>

                  <div className="text-center">
                    <div className="font-display font-black text-lg">
                      {row.playerAWins}
                      <span className="text-[#596170] mx-1.5">-</span>
                      {row.playerBWins}
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-[#697181] mt-1">
                      H2H
                    </div>
                  </div>

                  <Link
                    to={`/players/${row.playerBId}`}
                    className="min-w-0 rounded-xl border border-[#222834] bg-[#0F1218] p-3 hover:border-[#353D49] transition-all"
                  >
                    <div className="flex items-center justify-end gap-2.5 min-w-0">
                      <div className="min-w-0 text-right">
                        <div className="font-semibold truncate">
                          {playerB?.name || "Player"}
                        </div>
                        <div className="font-mono text-xs text-emerald-400 mt-0.5">
                          {row.playerBWins}W
                        </div>
                      </div>
                      <PlayerAvatar
                        name={playerB?.name || "Player"}
                        elo={playerB?.currentElo || 1000}
                        size={36}
                        avatarUrl={playerAvatars[row.playerBId]}
                      />
                    </div>
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5">
                    <div className="text-[9px] uppercase tracking-widest text-[#697181]">
                      Team
                    </div>
                    <div className="font-mono font-black text-sm mt-1">
                      {row.teamMeetings}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5">
                    <div className="text-[9px] uppercase tracking-widest text-[#697181]">
                      1v1
                    </div>
                    <div className="font-mono font-black text-sm mt-1">
                      {row.directMeetings}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5">
                    <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-[#697181]">
                      <WalletCards size={11} /> Stake
                    </div>
                    <div className="font-mono font-black text-sm mt-1 text-[#D5A33A]">
                      {euro(row.moneyVolume)}
                    </div>
                  </div>
                </div>

                {row.moneyVolume > 0 && (
                  <div className="mt-3 text-[10px] text-[#697181] text-center">
                    Money H2H · {playerA?.name || "Player"}{" "}
                    <span className={netA >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {netA >= 0 ? "+" : "-"}{euro(Math.abs(netA))}
                    </span>
                    {" · "}
                    {playerB?.name || "Player"}{" "}
                    <span className={netA <= 0 ? "text-emerald-400" : "text-red-400"}>
                      {netA <= 0 ? "+" : "-"}{euro(Math.abs(netA))}
                    </span>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
