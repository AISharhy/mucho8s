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

  const winningsByPlayer = rounds.reduce((acc, round) => {
    if (round.status !== "completed" || !round.reported_winner_player_id) return acc;
    const id = round.reported_winner_player_id;
    acc[id] = Number(acc[id] || 0) + Number(round.amount_cents || 0);
    return acc;
  }, {});

  const playerA = series?.player_a_player_id ? playerMap[series.player_a_player_id] : null;
  const playerB = series?.player_b_player_id ? playerMap[series.player_b_player_id] : null;
  const playerAWinnings = Number(winningsByPlayer[series?.player_a_player_id] || 0);
  const playerBWinnings = Number(winningsByPlayer[series?.player_b_player_id] || 0);

  return (
    <div className="m8-panel rounded-[22px] p-5 sm:p-6" data-testid="chall-series-card">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Chall Series</div>
          <h3 className="font-display text-2xl font-black tracking-[-0.025em]">
            {rounds.length} {rounds.length === 1 ? "Match" : "Matches"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Every match keeps its full winnings for stats. The settlement only decides how much money still has to move between the two players.
          </p>
        </div>

        <div className="m8-rank-spotlight rounded-xl px-4 py-3 min-w-[205px]">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {series?.status === "open" ? "Amount To Settle" : "Final Payment"}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-5">
        <div className="m8-stat-card">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Money Won</div>
          <div className="font-display font-bold mt-1">
            {playerA?.name || "Player"} <span className="text-emerald-400">{money(playerAWinnings, series?.currency || "EUR")}</span>
          </div>
        </div>
        <div className="m8-stat-card">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Money Won</div>
          <div className="font-display font-bold mt-1">
            {playerB?.name || "Player"} <span className="text-emerald-400">{money(playerBWinnings, series?.currency || "EUR")}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="brand-kicker mb-3">Series timeline</div>
        <div className="relative">
          <div className="absolute left-[17px] top-5 bottom-5 w-px bg-[#252C37]" />
          <div className="space-y-2.5">
            {rounds.map((round) => {
              const winner = round.reported_winner_player_id
                ? playerMap[round.reported_winner_player_id]
                : null;
              const completed = round.status === "completed";
              const wonByMe = completed && round.reported_winner_player_id === discordPlayer?.id;

              return (
                <div key={round.id} className="relative pl-11">
                  <div className={
                    "absolute left-[9px] top-4 w-[17px] h-[17px] rounded-full border-4 border-[#11151D] z-10 " +
                    (completed
                      ? wonByMe
                        ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.35)]"
                        : "bg-magma shadow-[0_0_14px_rgba(255,42,59,.28)]"
                      : "bg-[#596170]")
                  } />
                  <div className="m8-panel-quiet rounded-xl px-3.5 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#090C11] border border-[#252C37] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[8px] uppercase tracking-wider text-[#697181]">Match</span>
                      <span className="font-mono text-xs font-black">{round.series_round || "—"}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">
                        {completed
                          ? (winner?.name || "Player") + " won"
                          : statusLabel[round.status] || round.status}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-[#697181] mt-0.5">
                        {completed ? "Verified result" : "Series match"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-sm">
                        {money(round.amount_cents, round.currency || series?.currency || "EUR")}
                      </div>
                      {completed && (
                        <div className={"text-[9px] uppercase tracking-wider font-bold mt-0.5 " + (wonByMe ? "text-emerald-400" : "text-[#737D8D]")}>
                          {wonByMe ? "Your win" : "Result"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {series?.status === "open" && challenge?.status === "completed" && (
        <div className="mt-6 pt-5 border-t border-[#232A35]">
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
              className="m8-action m8-action-primary h-11 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
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
            ReChall can use a different amount. Winnings stay intact; only opposite debts are compensated when the series is closed.
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
          <div className="brand-kicker mb-1">Settlement Only</div>
          <h4 className="font-display font-bold text-lg">
            Remaining payment: {settlementWinner?.name || "Winner"} receives {money(settlementAmountCents, series.currency)}
          </h4>
          <p className="text-sm text-muted-foreground mt-1">
            This does not change the money won in each match; it only offsets what the two players owe each other.
          </p>

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
