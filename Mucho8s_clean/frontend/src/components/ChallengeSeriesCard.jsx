import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Lock, RotateCcw } from "lucide-react";

const money = (cents, currency = "EUR") =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(Number(cents || 0) / 100);

const statusLabel = {
  pending: "Waiting",
  accepted: "Live",
  declined: "Declined",
  result_pending: "Verification",
  completed: "Verified",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export default function ChallengeSeriesCard({
  challenge,
  series,
  playerMap,
  busy,
  onRechallenge,
  onClose,
}) {
  const [amount, setAmount] = useState(String(Number(challenge?.amount_cents || 0) / 100 || 5));
  const rounds = Array.isArray(series?.rounds) ? series.rounds : [];

  const netByPlayer = rounds.reduce((acc, round) => {
    if (round.status !== "completed" || !round.reported_winner_player_id) return acc;

    const playerAId = series?.player_a_player_id;
    const playerBId = series?.player_b_player_id;
    if (!playerAId || !playerBId) return acc;

    const amountCents = Number(round.amount_cents || 0);
    const winnerId = round.reported_winner_player_id;
    const loserId = winnerId === playerAId ? playerBId : playerAId;

    acc[winnerId] = Number(acc[winnerId] || 0) + amountCents;
    acc[loserId] = Number(acc[loserId] || 0) - amountCents;
    return acc;
  }, {});

  const playerA = series?.player_a_player_id ? playerMap[series.player_a_player_id] : null;
  const playerB = series?.player_b_player_id ? playerMap[series.player_b_player_id] : null;
  const playerANet = Number(netByPlayer[series?.player_a_player_id] || 0);
  const playerBNet = Number(netByPlayer[series?.player_b_player_id] || 0);
  const platformLabel = String(series?.platform || "paypal").toUpperCase();

  return (
    <div className="m8-panel rounded-[22px] p-5 sm:p-6" data-testid="chall-series-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="brand-kicker mb-1">Match Series</div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-2xl font-black tracking-[-0.025em]">
              {rounds.length} {rounds.length === 1 ? "match" : "matches"}
            </h3>
            <span className="m8-pill">
              {series?.status === "open" ? "OPEN" : "ENDED"}
            </span>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Each verified match is paid separately · {platformLabel}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center mt-5 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
        <div>
          <div className="text-xs font-bold truncate">{playerA?.name || "Player"}</div>
          <div className={`font-mono text-sm mt-0.5 ${playerANet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {playerANet > 0 ? "+" : ""}{money(playerANet, series?.currency || "EUR")} net
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-[0.2em] text-[#596170]">VS</div>

        <div className="text-right">
          <div className="text-xs font-bold truncate">{playerB?.name || "Player"}</div>
          <div className={`font-mono text-sm mt-0.5 ${playerBNet >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {playerBNet > 0 ? "+" : ""}{money(playerBNet, series?.currency || "EUR")} net
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181] font-bold mb-2">History</div>
        <div className="space-y-2">
          {rounds.map((round) => {
            const winner = round.reported_winner_player_id
              ? playerMap[round.reported_winner_player_id]
              : null;
            const completed = round.status === "completed";

            return (
              <div
                key={round.id}
                className="grid grid-cols-[auto_1fr_auto] gap-3 items-center rounded-xl bg-[#0F1218] border border-[#1D222C] px-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-[#151923] border border-[#252C37] flex items-center justify-center font-mono text-xs font-black">
                  {round.series_round || "—"}
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">
                    {completed
                      ? `${winner?.name || "Player"} won`
                      : statusLabel[round.status] || round.status}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-[#697181] mt-0.5">
                    {completed ? "Verified" : statusLabel[round.status] || "Match"}
                  </div>
                </div>

                <div className="font-mono text-sm font-black">
                  {money(round.amount_cents, round.currency || series?.currency || "EUR")}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {series?.status === "open" && challenge?.status === "completed" && challenge?.payment_received_at && (
        <div className="mt-5 pt-5 border-t border-[#232A35]">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181] font-bold mb-2">
            Next match
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr_auto] gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">€</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full h-11 rounded-xl bg-[#0F1218] border border-[#2A303B] pl-8 pr-3 font-mono font-bold"
                aria-label="Rematch amount"
              />
            </div>

            <Button
              onClick={() => onRechallenge(Number(amount))}
              disabled={Boolean(busy) || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
              className="m8-action m8-action-primary h-11 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <RotateCcw size={16} className="mr-2" /> REMATCH · {platformLabel}
            </Button>

            <Button
              onClick={onClose}
              disabled={Boolean(busy)}
              className="h-11 rounded-xl bg-[#181B26] border border-[#2A303B] text-white font-bold hover:bg-white/[0.05]"
            >
              <Lock size={16} className="mr-2" /> END SERIES
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground mt-2">
            The current match is already paid. Rematch creates the next one with the same player and payment method.
          </div>
        </div>
      )}

      {series?.status !== "open" && (
        <div className="mt-5 rounded-xl bg-[#0F1218] border border-[#242A35] p-4 text-sm text-muted-foreground">
          Series ended. Every verified match keeps its own result, money record and Elo change.
        </div>
      )}
    </div>
  );
}
