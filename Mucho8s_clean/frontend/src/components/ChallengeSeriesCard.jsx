import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Lock, RotateCcw, ShieldCheck } from "lucide-react";

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
  discordPlayer,
  busy,
  onRechallenge,
  onClose,
  onPaymentSent,
  onPaymentReceived,
}) {
  const [amount, setAmount] = useState(String(Number(challenge?.amount_cents || 0) / 100 || 5));
  const rounds = Array.isArray(series?.rounds) ? series.rounds : [];

  const currentWinner = series?.current_winner_player_id
    ? playerMap[series.current_winner_player_id]
    : null;
  const settlementWinner = series?.settlement_winner_player_id
    ? playerMap[series.settlement_winner_player_id]
    : null;

  const currentAmountCents = Number(series?.current_amount_cents || 0);
  const settlementAmountCents = Number(series?.settlement_amount_cents || 0);
  const balanceAmount = series?.status === "open" ? currentAmountCents : settlementAmountCents;
  const balanceWinner = series?.status === "open" ? currentWinner : settlementWinner;

  const iReceive = Boolean(
    series?.settlement_winner_player_id &&
    series.settlement_winner_player_id === discordPlayer?.id
  );

  const netByPlayer = rounds.reduce((acc, round) => {
    if (round.status !== "completed" || !round.reported_winner_player_id) return acc;

    const playerAId = series?.player_a_player_id;
    const playerBId = series?.player_b_player_id;
    if (!playerAId || !playerBId) return acc;

    const amount = Number(round.amount_cents || 0);
    const winnerId = round.reported_winner_player_id;
    const loserId = winnerId === playerAId ? playerBId : playerAId;

    acc[winnerId] = Number(acc[winnerId] || 0) + amount;
    acc[loserId] = Number(acc[loserId] || 0) - amount;
    return acc;
  }, {});

  const playerA = series?.player_a_player_id ? playerMap[series.player_a_player_id] : null;
  const playerB = series?.player_b_player_id ? playerMap[series.player_b_player_id] : null;
  const playerANet = Number(netByPlayer[series?.player_a_player_id] || 0);
  const playerBNet = Number(netByPlayer[series?.player_b_player_id] || 0);
  const platformLabel = String(series?.platform || "paypal").toUpperCase();

  return (
    <div className="m8-panel rounded-[22px] p-5 sm:p-6" data-testid="chall-series-card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Match Series</div>
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-display text-2xl font-black tracking-[-0.025em]">
              {rounds.length} {rounds.length === 1 ? "match" : "matches"}
            </h3>
            <span className="m8-pill">
              {series?.status === "open" ? "OPEN" : String(series?.status || "").toUpperCase()}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-[#0F1218] border border-[#242A35] px-4 py-3 min-w-[205px]">
          <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">
            {series?.status === "open" ? "Current Balance" : "Final Payment"}
          </div>
          <div className="font-display text-lg font-black mt-1">
            {balanceAmount === 0 ? (
              <span className="text-emerald-400">EVEN · €0</span>
            ) : (
              <span className="text-[#D5A33A]">
                {balanceWinner?.name || "Player"} +{money(balanceAmount, series?.currency || "EUR")}
              </span>
            )}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">
            {platformLabel}
          </div>
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

      {series?.status === "open" && challenge?.status === "completed" && (
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
              <Lock size={16} className="mr-2" /> SETTLE NOW
            </Button>
          </div>

          <div className="text-[10px] text-muted-foreground mt-2">
            Rematch keeps the same players and payment method. Change only the amount if needed.
          </div>
        </div>
      )}

      {series?.status === "settled" && (
        <div className="mt-5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-emerald-400 font-semibold">
          <ShieldCheck size={18} className="inline mr-2" />
          {settlementAmountCents === 0
            ? "Series even — no payment required."
            : "Series settlement completed."}
        </div>
      )}

      {series?.status === "closed" && settlementAmountCents > 0 && (
        <div className="mt-5 pt-5 border-t border-[#1D222C]">
          <div className="brand-kicker mb-1">Payment</div>
          <h4 className="font-display font-bold text-lg">
            {settlementWinner?.name || "Winner"} receives {money(settlementAmountCents, series.currency)}
          </h4>

          {series.payment_sent_at ? (
            iReceive ? (
              <Button
                onClick={onPaymentReceived}
                disabled={Boolean(busy)}
                className="w-full mt-4 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold"
              >
                <ShieldCheck size={17} className="mr-2" /> PAYMENT RECEIVED
              </Button>
            ) : (
              <div className="mt-4 rounded-xl bg-[#D5A33A]/10 border border-[#D5A33A]/25 p-4 text-[#D5A33A] font-semibold">
                Payment sent · waiting for confirmation.
              </div>
            )
          ) : iReceive ? (
            <div className="mt-4 rounded-xl bg-[#0F1218] border border-[#1D222C] p-4 text-sm text-muted-foreground">
              Waiting for the payment.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {series.settlement_payout_url && (
                <a
                  href={series.settlement_payout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold inline-flex items-center justify-center gap-2"
                >
                  PAY {money(settlementAmountCents, series.currency)} · {platformLabel}
                  <ExternalLink size={15} />
                </a>
              )}
              <Button
                onClick={onPaymentSent}
                disabled={Boolean(busy)}
                className="w-full h-12 rounded-xl bg-[#181B26] border border-[#2A303B] text-white font-bold hover:bg-white/[0.05]"
              >
                <Check size={16} className="mr-2" /> I HAVE PAID
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
