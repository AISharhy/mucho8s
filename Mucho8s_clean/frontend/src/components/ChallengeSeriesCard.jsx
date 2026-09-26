import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Lock, Plus, ShieldCheck } from "lucide-react";

const money = (cents, currency = "EUR") =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(Number(cents || 0) / 100);

const statusLabel = {
  pending: "Waiting for acceptance",
  accepted: "Match live",
  declined: "Challenge declined",
  result_pending: "Result verification",
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
  const iReceive = Boolean(
    series?.settlement_winner_player_id &&
    series.settlement_winner_player_id === discordPlayer?.id
  );

  return (
    <div className="card-surface rounded-2xl p-5" data-testid="chall-series-card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Chall Series</div>
          <h3 className="font-display text-xl font-bold">
            {rounds.length} {rounds.length === 1 ? "Round" : "Rounds"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Every round still counts for stats and Chall Points. Only the final net balance is paid.
          </p>
        </div>

        <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-4 py-3 min-w-[190px]">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {series?.status === "open" ? "Current Balance" : "Final Settlement"}
          </div>
          <div className="font-display text-xl font-black mt-1">
            {(series?.status === "open" ? currentAmountCents : settlementAmountCents) === 0 ? (
              <span className="text-emerald-400">EVEN · €0</span>
            ) : (
              <span className="text-[#D5A33A]">
                {(series?.status === "open" ? currentWinner : settlementWinner)?.name || "Player"}{" "}
                +{money(
                  series?.status === "open" ? currentAmountCents : settlementAmountCents,
                  series?.currency || "EUR"
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {rounds.map((round) => {
          const winner = round.reported_winner_player_id
            ? playerMap[round.reported_winner_player_id]
            : null;

          return (
            <div
              key={round.id}
              className="grid grid-cols-[52px_1fr_auto] gap-3 items-center rounded-xl bg-[#0F1218] border border-[#1D222C] px-3 py-2.5"
            >
              <div className="font-mono text-xs font-bold text-[#697181]">
                #{round.series_round || "—"}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {round.status === "completed"
                    ? (winner?.name || "Player") + " won"
                    : statusLabel[round.status] || round.status}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {round.status === "completed" ? "Verified round" : "Series round"}
                </div>
              </div>
              <div className="font-mono font-bold text-sm">
                {money(round.amount_cents, round.currency || series?.currency || "EUR")}
              </div>
            </div>
          );
        })}
      </div>

      {series?.status === "open" && challenge?.status === "completed" && (
        <div className="mt-5 pt-5 border-t border-[#1D222C]">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">€</span>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full h-11 rounded-xl bg-[#0F1218] border border-[#2A303B] pl-8 pr-3 font-mono font-bold"
                aria-label="ReChall amount"
              />
            </div>
            <Button
              onClick={() => onRechallenge(Number(amount))}
              disabled={Boolean(busy) || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
              className="h-11 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <Plus size={16} className="mr-2" /> RECHALL
            </Button>
            <Button
              onClick={onClose}
              disabled={Boolean(busy)}
              className="h-11 rounded-xl bg-[#181B26] border border-[#2A303B] text-white font-bold hover:bg-white/[0.05]"
            >
              <Lock size={16} className="mr-2" /> CLOSE SERIES
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">
            ReChall can use a different amount. No payment is requested until the series is closed.
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
          <div className="brand-kicker mb-1">One Final Payment</div>
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
                Payment marked as sent. Waiting for confirmation.
              </div>
            )
          ) : iReceive ? (
            <div className="mt-4 rounded-xl bg-[#0F1218] border border-[#1D222C] p-4 text-sm text-muted-foreground">
              Waiting for the other player to pay the final series balance.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {series.settlement_payout_url && (
                <a
                  href={series.settlement_payout_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold inline-flex items-center justify-center gap-2"
                >
                  PAY {money(settlementAmountCents, series.currency)} · {String(series.platform || "").toUpperCase()}
                  <ExternalLink size={15} />
                </a>
              )}
              <Button
                onClick={onPaymentSent}
                disabled={Boolean(busy)}
                className="w-full h-12 rounded-xl bg-[#181B26] border border-[#2A303B] text-white font-bold hover:bg-white/[0.05]"
              >
                <Check size={16} className="mr-2" /> I HAVE PAID {money(settlementAmountCents, series.currency)}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
