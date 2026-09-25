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
  X,
  Gamepad2,
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
    respondToChallenge,
    markChallengePaymentSent,
    confirmChallengePaymentReceived,
    setChallengeReady,
    reportChallengeResult,
    verifyChallengeResult,
    markChallengeSeen,
  } = useData();

  const [busy, setBusy] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");
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
  const myReady = Boolean(isChallenger ? challenge.challenger_ready_at : challenge.challenged_ready_at);
  const opponentReady = Boolean(isChallenger ? challenge.challenged_ready_at : challenge.challenger_ready_at);
  const bothReady = myReady && opponentReady;
  const platform = String(challenge.platform || "").toUpperCase();
  const completedWon = challenge.status === "completed" && challenge.reported_winner_player_id === discordPlayer.id;

  const respond = async (decision) => {
    setBusy(decision);
    const updated = await respondToChallenge(challenge.id, decision);
    setBusy("");
    if (!updated) return;
    if (decision === "accept") toast.success("Challenge accepted");
    else toast("Challenge declined");
  };

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

  const toggleReady = async () => {
    setBusy("ready");
    const updated = await setChallengeReady(challenge.id, !myReady);
    setBusy("");
    if (updated) toast.success(!myReady ? "You are READY" : "Ready removed");
  };

  const reportWinner = async (winnerPlayerId) => {
    setBusy(`winner:${winnerPlayerId}`);
    const updated = await reportChallengeResult(challenge.id, winnerPlayerId);
    setBusy("");
    if (updated) toast.success("Result sent for opponent verification");
  };

  const verify = async (decision) => {
    setBusy(decision);
    const updated = await verifyChallengeResult(
      challenge.id,
      decision,
      decision === "dispute" ? disputeNote : "",
    );
    setBusy("");
    if (!updated) return;

    if (decision === "confirm") {
      toast.success("Result verified");
    } else {
      toast.error("Result disputed — Admin can review it");
      setShowDispute(false);
      setDisputeNote("");
    }
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/challenges")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
        >
          <ArrowLeft size={16} /> Challenge Inbox
        </button>
        <div className="text-xs uppercase tracking-[0.18em] text-[#697181]">
          #{challenge.id.slice(0, 8)}
        </div>
      </div>

      <div className={`brand-card rounded-3xl p-5 sm:p-7 ${
        challenge.status === "completed"
          ? completedWon
            ? "border-emerald-500/25"
            : "border-red-500/25"
          : ""
      }`}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 min-w-0">
            <PlayerAvatar
              name={challenger?.name || "Player"}
              elo={challenger?.currentElo || 1000}
              size={64}
              avatarUrl={playerAvatars[challenge.challenger_player_id]}
            />
            <div className="min-w-0 text-center sm:text-left">
              <div className="font-display font-extrabold text-lg sm:text-2xl truncate">{challenger?.name || "Player"}</div>
              {challenger && <EloBadge elo={challenger.currentElo} />}
            </div>
          </div>

          <div className="text-center">
            <Swords size={22} className="text-magma mx-auto" />
            <div className="font-display text-3xl font-black mt-1">{money(challenge)}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{platform}</div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center sm:justify-end gap-3 min-w-0">
            <div className="min-w-0 text-center sm:text-right">
              <div className="font-display font-extrabold text-lg sm:text-2xl truncate">{challenged?.name || "Player"}</div>
              {challenged && <div className="flex justify-center sm:justify-end"><EloBadge elo={challenged.currentElo} /></div>}
            </div>
            <PlayerAvatar
              name={challenged?.name || "Player"}
              elo={challenged?.currentElo || 1000}
              size={64}
              avatarUrl={playerAvatars[challenge.challenged_player_id]}
            />
          </div>
        </div>

        <div className="mt-6 text-center">
          {challenge.status === "completed" ? (
            <div className={`font-display text-3xl font-black ${completedWon ? "text-emerald-400" : "text-red-400"}`}>
              {completedWon ? "VINTA" : "PERSA"}
            </div>
          ) : (
            <span className="inline-flex h-9 items-center px-3 rounded-xl bg-[#0F1218] border border-[#242A35] text-xs font-bold uppercase tracking-wider">
              {statusLabel[challenge.status] || challenge.status}
            </span>
          )}
        </div>
      </div>

      {challenge.status === "pending" && (
        <div className="card-surface rounded-2xl p-5">
          {isChallenger ? (
            <div className="text-center py-4">
              <Clock3 size={28} className="text-[#D5A33A] mx-auto mb-3" />
              <h3 className="font-display text-xl font-bold">Waiting for {challenged?.name || "player"}</h3>
              <p className="text-sm text-muted-foreground mt-1">They must accept the {money(challenge)} challenge first.</p>
            </div>
          ) : (
            <div>
              <div className="brand-kicker mb-1">Step 1</div>
              <h3 className="font-display text-xl font-bold">Accept this challenge?</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {challenger?.name || "Player"} challenged you for {money(challenge)} via {platform}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  disabled={Boolean(busy)}
                  onClick={() => respond("decline")}
                  className="h-12 bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15"
                >
                  <X size={16} className="mr-2" /> Decline
                </Button>
                <Button
                  disabled={Boolean(busy)}
                  onClick={() => respond("accept")}
                  className="h-12 bg-magma hover:bg-[#ff3c4c] text-white font-bold"
                >
                  <Check size={16} className="mr-2" /> Accept
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {challenge.status === "accepted" && (
        <>
          <div className="card-surface rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="brand-kicker mb-1">Step 2 · Payment</div>
                <h3 className="font-display text-xl font-bold">{money(challenge)}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Confirm the payment manually before the Ready Check.
                </p>
              </div>
              <WalletCards size={20} className={paymentReady ? "text-emerald-400" : "text-[#697181]"} />
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
                    Waiting for payment confirmation
                  </div>
                )}
              </div>
            ) : !challenge.payment_sent_at ? (
              <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-4 text-sm text-muted-foreground">
                Waiting for {challenger?.name || "the challenger"} to mark the payment as sent.
              </div>
            ) : !challenge.payment_received_at ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 rounded-xl bg-[#0F1218] border border-[#1D222C] p-4">
                  <div className="text-xs text-muted-foreground">Check your {platform} account.</div>
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
                <ShieldCheck size={18} /> Payment verified
              </div>
            )}
          </div>

          {paymentReady && (
            <div className="card-surface rounded-2xl p-5">
              <div className="brand-kicker mb-1">Step 3 · Ready Check</div>
              <h3 className="font-display text-xl font-bold">Both players must be ready</h3>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className={`rounded-xl border p-4 text-center ${
                  challenge.challenger_ready_at
                    ? "bg-emerald-500/10 border-emerald-500/25"
                    : "bg-[#0F1218] border-[#1D222C]"
                }`}>
                  <div className="font-semibold">{challenger?.name || "Challenger"}</div>
                  <div className={`text-xs font-bold mt-1 ${challenge.challenger_ready_at ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {challenge.challenger_ready_at ? "READY" : "NOT READY"}
                  </div>
                </div>
                <div className={`rounded-xl border p-4 text-center ${
                  challenge.challenged_ready_at
                    ? "bg-emerald-500/10 border-emerald-500/25"
                    : "bg-[#0F1218] border-[#1D222C]"
                }`}>
                  <div className="font-semibold">{challenged?.name || "Challenged"}</div>
                  <div className={`text-xs font-bold mt-1 ${challenge.challenged_ready_at ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {challenge.challenged_ready_at ? "READY" : "NOT READY"}
                  </div>
                </div>
              </div>

              <Button
                onClick={toggleReady}
                disabled={Boolean(busy)}
                className={`w-full h-12 mt-3 rounded-xl font-extrabold ${
                  myReady
                    ? "bg-[#171B23] border border-[#2A303B] text-white hover:bg-white/[0.05]"
                    : "bg-emerald-500 hover:bg-emerald-400 text-black"
                }`}
              >
                <Gamepad2 size={17} className="mr-2" />
                {myReady ? "I'M NOT READY" : "I'M READY"}
              </Button>

              {bothReady && (
                <div className="mt-3 rounded-xl bg-magma/10 border border-magma/25 p-4 text-center">
                  <div className="brand-kicker mb-1">Match Ready</div>
                  <div className="font-display text-xl font-extrabold">PLAY THE CHALLENGE</div>
                </div>
              )}
            </div>
          )}

          {paymentReady && bothReady && (
            <div className="card-surface rounded-2xl p-5">
              <div className="brand-kicker mb-1">Step 4 · Result</div>
              <h3 className="font-display text-xl font-bold">Who won?</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                The other player must verify the result before it becomes official.
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
        </>
      )}

      {challenge.status === "result_pending" && (
        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Result Verification</div>
          <h3 className="font-display text-xl font-bold">Reported winner: {winner?.name || "Unknown"}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {iReported
              ? "Waiting for the other player to verify this result."
              : "Confirm only if the reported result is correct."}
          </p>

          {!iReported && !showDispute && (
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button
                onClick={() => setShowDispute(true)}
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

          {!iReported && showDispute && (
            <div className="mt-4 rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
              <label className="text-xs uppercase tracking-widest text-orange-300">Why is the result wrong?</label>
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                maxLength={240}
                placeholder="Example: I won the match, the reported result is incorrect."
                className="mt-2 w-full min-h-24 rounded-xl bg-[#0F1218] border border-[#2A303B] px-3 py-2 text-sm outline-none focus:border-orange-500/40"
              />
              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDispute(false)}
                  className="flex-1 bg-[#171B23] border border-[#2A303B]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => verify("dispute")}
                  disabled={Boolean(busy) || !disputeNote.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-400 text-black font-bold"
                >
                  Send Dispute
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {challenge.status === "completed" && (
        <div className={`card-surface rounded-2xl p-7 text-center ${
          completedWon ? "border-emerald-500/25" : "border-red-500/25"
        }`}>
          <Trophy size={38} className={`${completedWon ? "text-emerald-400" : "text-red-400"} mx-auto mb-3`} />
          <div className="brand-kicker mb-1">Official Result</div>
          <h3 className={`font-display text-3xl font-black ${completedWon ? "text-emerald-400" : "text-red-400"}`}>
            {completedWon ? "VINTA" : "PERSA"}
          </h3>
          <p className="text-sm text-muted-foreground mt-2">
            {winner?.name || "Player"} won · {money(challenge)} · result verified.
          </p>
        </div>
      )}

      {challenge.status === "disputed" && (
        <div className="card-surface rounded-2xl p-6 text-center border-orange-500/20">
          <AlertTriangle size={34} className="text-orange-400 mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">Result disputed</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {challenge.dispute_note || "The challenge is waiting for Admin review."}
          </p>
        </div>
      )}

      {["declined", "cancelled"].includes(challenge.status) && (
        <div className="card-surface rounded-2xl p-6 text-center border-red-500/20">
          <X size={32} className="text-red-400 mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">
            {challenge.status === "declined" ? "Challenge declined" : "Challenge cancelled"}
          </h3>
        </div>
      )}

      <div className="text-center">
        <Link to="/challenges" className="text-sm text-muted-foreground hover:text-white">
          Back to Challenge Inbox
        </Link>
      </div>
    </div>
  );
}
