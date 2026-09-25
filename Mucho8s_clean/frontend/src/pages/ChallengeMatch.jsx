import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  ShieldCheck,
  Swords,
  Trophy,
  WalletCards,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";

const money = (challenge) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: challenge?.currency || "EUR",
  }).format(Number(challenge?.amount_cents || 0) / 100);

const statusLabel = {
  pending: "Waiting for acceptance",
  accepted: "Challenge accepted",
  declined: "Challenge declined",
  result_pending: "Result verification",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

export default function ChallengeMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    challenges,
    refreshChallenges,
    discordSession,
    discordAccount,
    discordPlayer,
    playerMap,
    playerAvatars,
    markChallengePaymentSent,
    confirmChallengePaymentReceived,
    reportChallengeResult,
    verifyChallengeResult,
    markChallengeSeen,
  } = useData();

  const [busy, setBusy] = useState("");
  const challenge = challenges.find((item) => item.id === id);

  useEffect(() => {
    void refreshChallenges();
  }, [id, refreshChallenges]);

  useEffect(() => {
    if (challenge && discordAccount?.id) void markChallengeSeen(challenge.id);
  }, [challenge?.id, challenge?.status, discordAccount?.id, markChallengeSeen]);

  const participant = useMemo(() => {
    if (!challenge || !discordAccount?.id) return false;
    return (
      challenge.challenger_account_id === discordAccount.id ||
      challenge.challenged_account_id === discordAccount.id
    );
  }, [challenge, discordAccount]);

  if (!discordSession || !discordPlayer) {
    return (
      <div className="card-surface rounded-2xl p-10 text-center max-w-xl mx-auto">
        <Swords size={34} className="text-magma mx-auto mb-3" />
        <h2 className="font-display text-2xl font-bold">Discord login required</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Login with Discord from the sidebar to open this challenge.
        </p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="card-surface rounded-2xl p-10 text-center max-w-xl mx-auto">
        <Clock3 size={32} className="text-[#697181] mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">Loading challenge...</h2>
        <Button onClick={() => refreshChallenges()} className="mt-4 bg-[#171B23] border border-[#2A303B]">
          Refresh
        </Button>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="card-surface rounded-2xl p-10 text-center max-w-xl mx-auto">
        <AlertTriangle size={32} className="text-orange-400 mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">Private challenge</h2>
        <p className="text-sm text-muted-foreground mt-2">Only the two players involved can open this page.</p>
      </div>
    );
  }

  const challenger = playerMap[challenge.challenger_player_id];
  const challenged = playerMap[challenge.challenged_player_id];
  const isChallenger = challenge.challenger_account_id === discordAccount.id;
  const opponent = isChallenger ? challenged : challenger;
  const winner = playerMap[challenge.reported_winner_player_id];
  const iReported = challenge.reporter_account_id === discordAccount.id;
  const paymentReady = Boolean(challenge.payment_received_at);
  const platform = String(challenge.platform || "").toUpperCase();

  const markSent = async () => {
    setBusy("payment-sent");
    const updated = await markChallengePaymentSent(challenge.id);
    setBusy("");
    if (updated) toast.success("Payment marked as sent");
  };

  const confirmReceived = async () => {
    setBusy("payment-received");
    const updated = await confirmChallengePaymentReceived(challenge.id);
    setBusy("");
    if (updated) toast.success(`${money(challenge)} payment confirmed`);
  };

  const reportWinner = async (winnerPlayerId) => {
    setBusy(`winner:${winnerPlayerId}`);
    const updated = await reportChallengeResult(challenge.id, winnerPlayerId);
    setBusy("");
    if (updated) toast.success("Result sent for opponent verification");
  };

  const verify = async (decision) => {
    setBusy(decision);
    const updated = await verifyChallengeResult(challenge.id, decision);
    setBusy("");
    if (!updated) return;
    if (decision === "confirm") toast.success("Result verified");
    else toast.error("Result disputed");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-xs uppercase tracking-[0.18em] text-[#697181]">
          Challenge #{challenge.id.slice(0, 8)}
        </div>
      </div>

      <div className="brand-card rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <PlayerAvatar
              name={challenger?.name || "Player"}
              elo={challenger?.currentElo || 1000}
              size={68}
              avatarUrl={playerAvatars[challenge.challenger_player_id]}
            />
            <div className="min-w-0">
              <div className="brand-kicker mb-1">Challenger</div>
              <div className="font-display text-2xl font-extrabold truncate">{challenger?.name || "Player"}</div>
              {challenger && <EloBadge elo={challenger.currentElo} />}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-4">
            <Swords size={25} className="text-magma" />
            <div className="font-display text-3xl font-black mt-2">{money(challenge)}</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">{platform}</div>
          </div>

          <div className="flex items-center gap-4 flex-1 lg:justify-end">
            <div className="min-w-0 text-right">
              <div className="brand-kicker mb-1">Challenged</div>
              <div className="font-display text-2xl font-extrabold truncate">{challenged?.name || "Player"}</div>
              {challenged && <div className="flex justify-end"><EloBadge elo={challenged.currentElo} /></div>}
            </div>
            <PlayerAvatar
              name={challenged?.name || "Player"}
              elo={challenged?.currentElo || 1000}
              size={68}
              avatarUrl={playerAvatars[challenge.challenged_player_id]}
            />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</div>
            <div className="font-semibold mt-1">{statusLabel[challenge.status] || challenge.status}</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {isChallenger ? "Stake" : "Expected incoming"}
            </div>
            <div className="font-mono font-bold text-lg mt-1">{money(challenge)}</div>
          </div>
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Payment</div>
            <div className={`font-semibold mt-1 ${paymentReady ? "text-emerald-400" : "text-[#D5A33A]"}`}>
              {challenge.payment_received_at
                ? "Received & verified"
                : challenge.payment_sent_at
                  ? "Sent · waiting confirmation"
                  : "Not confirmed"}
            </div>
          </div>
        </div>
      </div>

      {challenge.status === "accepted" && (
        <div className="card-surface rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="brand-kicker mb-1">Payment Check</div>
              <h3 className="font-display text-xl font-bold">Verify {money(challenge)}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                MuchoMoney8s tracks the confirmation, but does not automatically read PayPal, Revolut or CMG transactions.
              </p>
            </div>
            <WalletCards size={20} className="text-[#697181]" />
          </div>

          {isChallenger ? (
            <div className="flex flex-col sm:flex-row gap-3">
              {challenge.target_url && (
                <a
                  href={challenge.target_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-4 rounded-xl bg-[#171B23] border border-[#2A303B] text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  Open {platform} <ExternalLink size={14} />
                </a>
              )}
              {!challenge.payment_sent_at ? (
                <Button
                  onClick={markSent}
                  disabled={Boolean(busy)}
                  className="h-11 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
                >
                  <Check size={16} className="mr-2" /> I SENT {money(challenge)}
                </Button>
              ) : (
                <div className="h-11 px-4 rounded-xl bg-[#D5A33A]/10 border border-[#D5A33A]/25 text-[#D5A33A] text-sm font-semibold flex items-center">
                  Payment marked as sent
                </div>
              )}
            </div>
          ) : (
            <div>
              {!challenge.payment_sent_at ? (
                <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-4 text-sm text-muted-foreground">
                  Waiting for {challenger?.name || "the challenger"} to mark the payment as sent.
                </div>
              ) : !challenge.payment_received_at ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 rounded-xl bg-[#0F1218] border border-[#1D222C] p-4">
                    <div className="text-xs text-muted-foreground">Verify your {platform} account before confirming.</div>
                    <div className="font-display text-2xl font-extrabold mt-1">{money(challenge)}</div>
                  </div>
                  <Button
                    onClick={confirmReceived}
                    disabled={Boolean(busy)}
                    className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                  >
                    <ShieldCheck size={17} className="mr-2" /> PAYMENT RECEIVED
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-emerald-400 font-semibold flex items-center gap-2">
                  <ShieldCheck size={18} /> Payment verified. The challenge can be played and reported.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {challenge.status === "accepted" && paymentReady && (
        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Match Result</div>
          <h3 className="font-display text-xl font-bold">Who won?</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Either player can report the result. The other player must verify it before it becomes official.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={() => reportWinner(discordPlayer.id)}
              disabled={Boolean(busy)}
              className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold"
            >
              <Trophy size={18} className="mr-2" /> I WON
            </Button>
            <Button
              onClick={() => reportWinner(opponent?.id)}
              disabled={Boolean(busy) || !opponent?.id}
              className="h-14 rounded-xl bg-[#171B23] border border-[#2A303B] text-white font-bold hover:bg-white/[0.05]"
            >
              {opponent?.name || "Opponent"} WON
            </Button>
          </div>
        </div>
      )}

      {challenge.status === "result_pending" && (
        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Result Verification</div>
          <h3 className="font-display text-xl font-bold">Reported winner: {winner?.name || "Unknown"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {iReported
              ? "Waiting for the other player to verify this result."
              : "Confirm the result only if it is correct."}
          </p>

          {!iReported && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                onClick={() => verify("dispute")}
                disabled={Boolean(busy)}
                className="h-12 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15"
              >
                <AlertTriangle size={16} className="mr-2" /> Dispute
              </Button>
              <Button
                onClick={() => verify("confirm")}
                disabled={Boolean(busy)}
                className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
              >
                <ShieldCheck size={16} className="mr-2" /> Confirm
              </Button>
            </div>
          )}
        </div>
      )}

      {challenge.status === "completed" && (
        <div className="card-surface rounded-2xl p-6 text-center">
          <Trophy size={36} className="text-[#D5A33A] mx-auto mb-3" />
          <div className="brand-kicker mb-1">Official Result</div>
          <h3 className="font-display text-2xl font-extrabold">{winner?.name || "Player"} WON</h3>
          <p className="text-sm text-emerald-400 mt-2">Result verified by both players.</p>
        </div>
      )}

      {challenge.status === "disputed" && (
        <div className="card-surface rounded-2xl p-6 text-center border-orange-500/20">
          <AlertTriangle size={34} className="text-orange-400 mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">Result disputed</h3>
          <p className="text-sm text-muted-foreground mt-2">
            This challenge is not considered completed until the dispute is resolved.
          </p>
        </div>
      )}

      <div className="text-center">
        <Link to={`/players/${discordPlayer.id}`} className="text-sm text-muted-foreground hover:text-white">
          Back to My Profile
        </Link>
      </div>
    </div>
  );
}
