import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import ChallengeSeriesCard from "@/components/ChallengeSeriesCard";
import { CHALL_LOSS_AUDIO_SRC } from "@/assets/challLossAudio";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  ShieldCheck,
  Swords,
  Trophy,
  AlertTriangle,
  Clock3,
  X,
  Banknote,
  Image as ImageIcon,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

const money = (challenge) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: challenge?.currency || "EUR",
  }).format(Number(challenge?.amount_cents || 0) / 100);

const statusLabel = {
  pending: "Waiting for acceptance",
  accepted: "Match live",
  declined: "Challenge declined",
  result_pending: "Result verification",
  completed: "Result verified",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

const profileLinkFor = (profile, platform) => {
  if (!profile) return "";
  if (platform === "paypal") return profile.paypalUrl || "";
  if (platform === "revolut") return profile.revolutUrl || "";
  if (platform === "cmg") return profile.cmgUrl || "";
  return "";
};

const LOSS_AUDIO_FEATURE_START = Date.parse("2026-09-26T10:40:00Z");

export default function ChallengeMatch() {
  const { id } = useParams();
  const navigate = useNavigate();
  const redirectRef = useRef(false);
  const lossAudioAttemptRef = useRef(new Set());
  const {
    challenges,
    refreshChallenges,
    discordSession,
    discordAccount,
    discordPlayer,
    playerMap,
    playerAvatars,
    playerProfiles,
    respondToChallenge,
    createRechallenge,
    closeChallengeSeries,
    confirmChallengePaymentReceived,
    disputeChallengePayout,
    uploadChallengeEvidence,
    reportChallengeResult,
    verifyChallengeResult,
    markChallengeSeen,
  } = useData();

  const [busy, setBusy] = useState("");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");
  const [disputeFile, setDisputeFile] = useState(null);
  const [showPayoutDispute, setShowPayoutDispute] = useState(false);
  const [payoutDisputeNote, setPayoutDisputeNote] = useState("");
  const [payoutDisputeFile, setPayoutDisputeFile] = useState(null);
  const challenge = challenges.find((item) => item.id === id);
  const series = challenge?.series || null;

  const playLossAudioOnce = useCallback((item) => {
    if (
      !item ||
      item.status !== "completed" ||
      !discordPlayer?.id ||
      !item.reported_winner_player_id ||
      item.reported_winner_player_id === discordPlayer.id
    ) {
      return;
    }

    const verifiedAt = Date.parse(item.verified_at || "");
    if (!Number.isFinite(verifiedAt) || verifiedAt < LOSS_AUDIO_FEATURE_START) return;

    const key = `m8-chall-loss-audio-${item.id}-${item.verified_at || "completed"}`;
    if (localStorage.getItem(key) || lossAudioAttemptRef.current.has(key)) return;

    lossAudioAttemptRef.current.add(key);

    try {
      const audio = new Audio(CHALL_LOSS_AUDIO_SRC);
      audio.volume = 0.9;
      const playback = audio.play();
      if (playback?.then) {
        playback
          .then(() => localStorage.setItem(key, "1"))
          .catch(() => {});
      } else {
        localStorage.setItem(key, "1");
      }
    } catch {
      // Audio is optional and must never block the challenge flow.
    }
  }, [discordPlayer?.id]);

  useEffect(() => {
    void refreshChallenges();
  }, [id, refreshChallenges]);

  useEffect(() => {
    if (challenge && discordAccount?.id) void markChallengeSeen(challenge.id);
  }, [challenge?.id, challenge?.status, challenge?.last_event, discordAccount?.id, markChallengeSeen]);

  useEffect(() => {
    if (challenge?.status === "completed") playLossAudioOnce(challenge);
  }, [
    challenge?.id,
    challenge?.status,
    challenge?.verified_at,
    challenge?.reported_winner_player_id,
    playLossAudioOnce,
  ]);

  const participant = useMemo(() => {
    if (!challenge || !discordAccount?.id) return false;
    return (
      challenge.challenger_account_id === discordAccount.id ||
      challenge.challenged_account_id === discordAccount.id
    );
  }, [challenge, discordAccount]);

  const winnerId = challenge?.reported_winner_player_id || "";
  const platform = String(challenge?.platform || "").toLowerCase();
  const winnerProfile = winnerId ? playerProfiles?.[winnerId] : null;
  const payoutUrl = challenge
    ? winnerId === challenge.challenger_player_id
      ? challenge.challenger_payout_url || profileLinkFor(winnerProfile, platform)
      : challenge.challenged_payout_url || profileLinkFor(winnerProfile, platform) || challenge.target_url
    : "";

  const completedLost = Boolean(
    challenge?.status === "completed" &&
    winnerId &&
    discordPlayer?.id &&
    winnerId !== discordPlayer.id &&
    !challenge?.payment_received_at
  );

  useEffect(() => {
    if (
      !challenge ||
      !completedLost ||
      !payoutUrl ||
      challenge.payment_received_at ||
      (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at) ||
      redirectRef.current
    ) return;

    const key = `m8-payout-redirect-${challenge.id}`;
    if (sessionStorage.getItem(key)) return;

    redirectRef.current = true;
    sessionStorage.setItem(key, "1");
    const timer = setTimeout(() => {
      window.location.assign(payoutUrl);
    }, 500);

    return () => clearTimeout(timer);
  }, [challenge, completedLost, payoutUrl]);

  if (!discordSession || !discordPlayer) {
    return (
      <div className="m8-panel rounded-2xl p-10 text-center max-w-xl mx-auto">
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
      <div className="m8-panel rounded-2xl p-10 text-center max-w-xl mx-auto">
        <Clock3 size={32} className="text-[#697181] mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold">Loading challenge...</h2>
        <Button onClick={() => refreshChallenges()} className="mt-4 bg-[#181B26] border border-[#2A303B]">
          Refresh
        </Button>
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="m8-panel rounded-2xl p-10 text-center max-w-xl mx-auto">
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
  const winner = playerMap[winnerId];
  const iReported = challenge.reporter_account_id === discordAccount.id;
  const completedWon = challenge.status === "completed" && winnerId === discordPlayer.id;
  const platformLabel = String(challenge.platform || "").toUpperCase();

  const respond = async (decision) => {
    setBusy(decision);
    const updated = await respondToChallenge(challenge.id, decision);
    setBusy("");
    if (!updated) return;

    if (decision === "accept") toast.success("Challenge accepted — match started");
    else toast("Challenge declined");
  };

  const reportWinner = async (reportedWinnerId) => {
    setBusy(`winner:${reportedWinnerId}`);
    const updated = await reportChallengeResult(challenge.id, reportedWinnerId);
    setBusy("");
    if (updated) toast.success("Result sent for opponent verification");
  };

  const verify = async (decision) => {
    const loserAfterConfirm =
      decision === "confirm" &&
      challenge.reported_winner_player_id &&
      challenge.reported_winner_player_id !== discordPlayer.id;

    let payoutTab = null;
    if (loserAfterConfirm && payoutUrl) {
      payoutTab = window.open("about:blank", "_blank");
    }

    setBusy(decision);

    if (decision === "dispute" && disputeFile) {
      const evidence = await uploadChallengeEvidence(challenge.id, disputeFile, "result_dispute");
      if (!evidence) {
        setBusy("");
        if (payoutTab) payoutTab.close();
        return;
      }
    }

    const updated = await verifyChallengeResult(
      challenge.id,
      decision,
      decision === "dispute" ? disputeNote : "",
    );
    setBusy("");

    if (!updated) {
      if (payoutTab) payoutTab.close();
      return;
    }

    if (decision === "confirm") {
      toast.success("Result verified");
      playLossAudioOnce(updated);
      if (payoutTab && payoutUrl) {
        sessionStorage.setItem(`m8-payout-redirect-${challenge.id}`, "1");
        payoutTab.location.href = payoutUrl;
      }
    } else {
      if (payoutTab) payoutTab.close();
      toast.error("Result disputed — Admin can review it");
      setShowDispute(false);
      setDisputeNote("");
      setDisputeFile(null);
    }
  };

  const rechallenge = async (amount) => {
    setBusy("rechallenge");
    const created = await createRechallenge(challenge.id, amount);
    setBusy("");
    if (!created) return;
    toast.success("Rematch created");
    navigate("/challenges/" + created.id);
  };

  const closeSeries = async () => {
    if (!challenge.series_id) return;
    setBusy("close-series");
    const updated = await closeChallengeSeries(challenge.series_id);
    setBusy("");
    if (updated) toast.success("Series ended");
  };

  const confirmPayoutReceived = async () => {
    setBusy("payout-received");
    const updated = await confirmChallengePaymentReceived(challenge.id);
    setBusy("");
    if (updated) toast.success(`${money(challenge)} received and confirmed`);
  };

  const openPayoutDispute = async () => {
    if (!payoutDisputeNote.trim()) {
      toast.error("Explain that the payment was not received");
      return;
    }

    setBusy("payout-dispute");

    if (payoutDisputeFile) {
      const evidence = await uploadChallengeEvidence(challenge.id, payoutDisputeFile, "payout_dispute");
      if (!evidence) {
        setBusy("");
        return;
      }
    }

    const updated = await disputeChallengePayout(challenge.id, payoutDisputeNote.trim());
    setBusy("");
    if (!updated) return;

    setShowPayoutDispute(false);
    setPayoutDisputeNote("");
    setPayoutDisputeFile(null);
    toast.error("Payment dispute sent to Admin");
  };

  return (
    <div className="m8-page-stack max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/challenges")}
          className="m8-pill hover:text-white"
        >
          <ArrowLeft size={16} /> Challenge Inbox
        </button>
        <div className="text-xs uppercase tracking-[0.18em] text-[#697181]">
          #{challenge.id.slice(0, 8)}
        </div>
      </div>

      <div className={`m8-hero rounded-[22px] p-5 sm:p-7 ${
        challenge.status === "completed"
          ? completedWon
            ? "border-emerald-500/25"
            : "border-red-500/25"
          : ""
      }`}>
        <span className="m8-hero-accent" />
        <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 min-w-0">
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
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{platformLabel}</div>
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
            <span className="m8-pill h-9 px-3">
              {statusLabel[challenge.status] || challenge.status}
            </span>
          )}
        </div>
      </div>

      {challenge.status === "pending" && (
        <div className="m8-panel rounded-2xl p-5">
          {isChallenger ? (
            <div className="text-center py-4">
              <Clock3 size={28} className="text-[#D5A33A] mx-auto mb-3" />
              <h3 className="font-display text-xl font-bold">Waiting for {challenged?.name || "player"}</h3>
              <p className="text-sm text-muted-foreground mt-1">They must accept the {money(challenge)} challenge.</p>
            </div>
          ) : (
            <div>
              <div className="brand-kicker mb-1">Incoming Chall</div>
              <h3 className="font-display text-xl font-bold">Accept this match?</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {challenger?.name || "Player"} challenged you for {money(challenge)} via {platformLabel}.
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
                  <Check size={16} className="mr-2" /> Accept & Start Match
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {challenge.status === "accepted" && (
        <div className="m8-panel rounded-2xl p-5 border-magma/20">
          <div className="text-center py-2">
            <div className="brand-kicker mb-1">Match Live</div>
            <h3 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em]">PLAY THE CHALLENGE</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When the match ends, report the winner below.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            <Button
              onClick={() => reportWinner(discordPlayer.id)}
              disabled={Boolean(busy)}
              className="h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold"
            >
              <Trophy size={18} className="mr-2" /> VITTORIA
            </Button>
            <Button
              onClick={() => reportWinner(opponent?.id)}
              disabled={Boolean(busy) || !opponent?.id}
              className="h-14 rounded-xl bg-red-500 hover:bg-red-400 text-white font-extrabold"
            >
              <X size={18} className="mr-2" /> SCONFITTA
            </Button>
          </div>
        </div>
      )}

      {challenge.status === "result_pending" && (
        <div className="m8-panel rounded-2xl p-5">
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
                <ShieldCheck size={16} className="mr-2" /> Confirm Result
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
              <label
                data-testid="result-dispute-evidence"
                className="mt-3 min-h-11 px-3 rounded-xl bg-[#0F1218] border border-[#2A303B] flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-white"
              >
                <Upload size={15} />
                {disputeFile ? disputeFile.name : "Add screenshot proof (optional)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setDisputeFile(e.target.files?.[0] || null)}
                />
              </label>
              <div className="flex gap-2 mt-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowDispute(false)}
                  className="flex-1 bg-[#181B26] border border-[#2A303B]"
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
        <>
          {challenge.series_id && (
            <ChallengeSeriesCard
              challenge={challenge}
              series={series}
              playerMap={playerMap}
              busy={busy}
              onRechallenge={rechallenge}
              onClose={closeSeries}
            />
          )}

          <div className="m8-panel rounded-2xl p-5" data-testid="simple-payout-panel">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="brand-kicker mb-1">Payment</div>
                <h3 className="font-display text-xl font-bold">
                  {challenge.payment_received_at
                    ? "Payment completed"
                    : completedWon
                      ? `Waiting for ${money(challenge)}`
                      : `Pay ${money(challenge)} to ${winner?.name || "the winner"}`}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {challenge.payment_received_at
                    ? `${winner?.name || "Winner"} confirmed the payment.`
                    : completedWon
                      ? `${opponent?.name || "The losing player"} pays you via ${platformLabel}. Confirm it only when the money arrives.`
                      : `The result is verified. Continue directly on ${platformLabel}.`}
                </p>
              </div>
              <Banknote
                size={20}
                className={challenge.payment_received_at ? "text-emerald-400" : "text-[#D5A33A]"}
              />
            </div>

            {challenge.payment_received_at ? (
              <div className="mt-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-emerald-400 font-semibold flex items-center gap-2">
                <ShieldCheck size={18} /> Payment received · chall closed.
              </div>
            ) : challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at ? (
              <div className="mt-4 rounded-xl bg-orange-500/10 border border-orange-500/25 p-4">
                <div className="flex items-center gap-2 text-orange-400 font-bold">
                  <AlertTriangle size={17} /> PAYMENT DISPUTE OPEN
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {challenge.payout_dispute_note || "Admin is reviewing this payment."}
                </div>
              </div>
            ) : completedWon ? (
              <div className="mt-4">
                {!showPayoutDispute ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      onClick={() => setShowPayoutDispute(true)}
                      disabled={Boolean(busy)}
                      className="h-12 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15 font-bold"
                    >
                      <AlertTriangle size={16} className="mr-2" /> DISPUTE
                    </Button>
                    <Button
                      onClick={confirmPayoutReceived}
                      disabled={Boolean(busy)}
                      className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold"
                    >
                      <ShieldCheck size={17} className="mr-2" /> PAYMENT RECEIVED
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-red-500/[0.04] border border-red-500/20 p-4">
                    <div className="text-xs uppercase tracking-widest text-red-300">Payment not received</div>
                    <textarea
                      value={payoutDisputeNote}
                      onChange={(e) => setPayoutDisputeNote(e.target.value)}
                      maxLength={240}
                      placeholder="What happened?"
                      className="mt-2 w-full min-h-24 rounded-xl bg-[#0F1218] border border-[#2A303B] px-3 py-2 text-sm outline-none focus:border-red-500/40"
                    />
                    <label className="mt-3 min-h-11 px-3 rounded-xl bg-[#0F1218] border border-[#2A303B] flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-white">
                      <ImageIcon size={15} />
                      {payoutDisputeFile ? payoutDisputeFile.name : "Add screenshot (optional)"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => setPayoutDisputeFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <Button
                        variant="ghost"
                        onClick={() => setShowPayoutDispute(false)}
                        className="bg-[#181B26] border border-[#2A303B]"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={openPayoutDispute}
                        disabled={Boolean(busy) || !payoutDisputeNote.trim()}
                        className="bg-red-500 hover:bg-red-400 text-white font-bold"
                      >
                        Send dispute
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {payoutUrl ? (
                  <a
                    href={payoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="m8-action m8-action-primary w-full h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold inline-flex items-center justify-center gap-2"
                  >
                    PAY {money(challenge)} · {platformLabel}
                    <ExternalLink size={15} />
                  </a>
                ) : (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4 text-red-300 text-sm">
                    {winner?.name || "The winner"} has not configured a {platformLabel} account yet.
                  </div>
                )}

                <div className="text-[11px] text-muted-foreground text-center">
                  The payment page opens automatically after the result is confirmed. No extra “I paid” step.
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {Array.isArray(challenge.evidence) && challenge.evidence.length > 0 && (
        <div className="m8-panel rounded-2xl p-5" data-testid="challenge-evidence-gallery">
          <div className="brand-kicker mb-1">Evidence</div>
          <h3 className="font-display text-xl font-black tracking-[-0.02em]">Screenshots</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
            {challenge.evidence.map((item) => (
              <a
                key={item.id || item.url}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group m8-panel-quiet rounded-xl overflow-hidden"
              >
                <img src={item.url} alt="Challenge evidence" className="w-full aspect-video object-cover group-hover:opacity-90 transition-opacity" />
                <div className="px-2.5 py-2 text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                  {String(item.kind || "evidence").replaceAll("_", " ")}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {challenge.status === "disputed" && (
        <div className="m8-panel rounded-2xl p-6 text-center border-orange-500/20">
          <AlertTriangle size={34} className="text-orange-400 mx-auto mb-3" />
          <h3 className="font-display text-2xl font-black tracking-[-0.02em]">Result disputed</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {challenge.dispute_note || "The challenge is waiting for Admin review."}
          </p>
        </div>
      )}

      {["declined", "cancelled"].includes(challenge.status) && (
        <div className="m8-panel rounded-2xl p-6 text-center border-red-500/20">
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
