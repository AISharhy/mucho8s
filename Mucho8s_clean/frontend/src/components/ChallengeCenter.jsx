import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/shared";
import { Check, X, Swords, ShieldCheck, AlertTriangle, Trophy } from "lucide-react";
import { toast } from "sonner";

const playChallengeTone = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    gain.connect(ctx.destination);

    [440, 660].forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, now + index * 0.12);
      osc.connect(gain);
      osc.start(now + index * 0.12);
      osc.stop(now + 0.42 + index * 0.12);
    });

    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    // Browsers may block audio before a user interaction.
  }
};

const money = (challenge) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: challenge?.currency || "EUR",
  }).format(Number(challenge?.amount_cents || 0) / 100);

const payoutUrlFor = (challenge, profiles = {}) => {
  const winnerId = challenge?.reported_winner_player_id;
  const platform = String(challenge?.platform || "").toLowerCase();
  const profile = profiles?.[winnerId] || {};
  const profileUrl =
    platform === "paypal"
      ? profile.paypalUrl
      : platform === "revolut"
        ? profile.revolutUrl
        : platform === "cmg"
          ? profile.cmgUrl
          : "";

  if (winnerId === challenge?.challenger_player_id) {
    return challenge?.challenger_payout_url || profileUrl || "";
  }
  return challenge?.challenged_payout_url || profileUrl || challenge?.target_url || "";
};

export default function ChallengeCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    challenges,
    discordAccount,
    discordPlayer,
    playerMap,
    playerAvatars,
    playerProfiles,
    respondToChallenge,
    verifyChallengeResult,
    markChallengeSeen,
  } = useData();

  const [busy, setBusy] = useState(false);
  const lastAttentionRef = useRef("");

  const attention = useMemo(() => {
    if (!discordAccount?.id) return null;

    const verification = challenges.find(
      (c) =>
        c.status === "result_pending" &&
        c.reporter_account_id !== discordAccount.id &&
        (c.challenger_account_id === discordAccount.id || c.challenged_account_id === discordAccount.id)
    );
    if (verification) return { type: "verify", challenge: verification };

    const request = challenges.find(
      (c) => c.status === "pending" && c.challenged_account_id === discordAccount.id
    );
    if (request) return { type: "incoming", challenge: request };

    const acceptedForSender = challenges.find((c) => {
      const isSender = c.challenger_account_id === discordAccount.id;
      return (
        isSender &&
        c.status === "accepted" &&
        c.last_event === "accepted" &&
        c.challenger_seen_event !== "accepted"
      );
    });
    if (acceptedForSender) return { type: "accepted", challenge: acceptedForSender };

    const eventNotice = challenges.find((c) => {
      const isChallenger = c.challenger_account_id === discordAccount.id;
      const isChallenged = c.challenged_account_id === discordAccount.id;
      if (!isChallenger && !isChallenged) return false;
      if (!c.last_event || ["created", "result_reported", "accepted"].includes(c.last_event)) return false;
      const seenEvent = isChallenger ? c.challenger_seen_event : c.challenged_seen_event;
      return seenEvent !== c.last_event;
    });
    if (eventNotice) return { type: "event", challenge: eventNotice };

    return null;
  }, [challenges, discordAccount]);

  useEffect(() => {
    if (!attention) return;
    const key = `${attention.type}:${attention.challenge.id}:${attention.challenge.status}:${attention.challenge.last_event || ""}`;
    if (lastAttentionRef.current === key) return;
    lastAttentionRef.current = key;
    playChallengeTone();

    if (attention.type === "accepted") {
      void markChallengeSeen(attention.challenge.id);
      const target = `/challenges/${attention.challenge.id}`;
      if (location.pathname !== target) navigate(target);
      return;
    }

    if (
      attention.type === "event" &&
      attention.challenge.status === "completed" &&
      attention.challenge.reported_winner_player_id !== discordPlayer?.id &&
      !attention.challenge.payment_sent_at
    ) {
      const payoutUrl = payoutUrlFor(attention.challenge, playerProfiles);
      const key = `m8-payout-redirect-${attention.challenge.id}`;
      if (payoutUrl && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        void markChallengeSeen(attention.challenge.id);
        window.location.assign(payoutUrl);
      }
    }
  }, [attention, location.pathname, markChallengeSeen, navigate, discordPlayer, playerProfiles]);

  if (!attention || !discordPlayer) return null;
  if (attention.type === "accepted") return null;

  const challenge = attention.challenge;
  const challenger = playerMap[challenge.challenger_player_id];
  const challenged = playerMap[challenge.challenged_player_id];
  const reportedWinner = playerMap[challenge.reported_winner_player_id];
  const platform = String(challenge.platform || "").toUpperCase();
  const currentWon =
    challenge.status === "completed" &&
    challenge.reported_winner_player_id === discordPlayer.id;

  const respond = async (decision) => {
    setBusy(true);
    const updated = await respondToChallenge(challenge.id, decision);
    setBusy(false);
    if (!updated) return;

    if (decision === "accept") {
      toast.success("Challenge accepted");
      navigate(`/challenges/${challenge.id}`);
    } else {
      toast("Challenge declined");
    }
  };

  const verify = async (decision) => {
    setBusy(true);
    const updated = await verifyChallengeResult(challenge.id, decision);
    setBusy(false);
    if (!updated) return;

    if (decision === "confirm") {
      toast.success("Result verified");
      navigate(`/challenges/${challenge.id}`);
    } else {
      toast.error("Result disputed");
      navigate(`/challenges/${challenge.id}`);
    }
  };

  const closeStatus = async () => {
    setBusy(true);
    await markChallengeSeen(challenge.id);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="challenge-pop w-full max-w-md rounded-3xl border border-[#343A46] bg-[#0E1117] shadow-2xl overflow-hidden">
        <div className="h-1 gradient-bar" />

        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-magma/20 blur-xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-[#151923] border border-magma/30 flex items-center justify-center">
                {attention.type === "incoming" ? (
                  <Swords size={30} className="text-magma" />
                ) : attention.type === "verify" ? (
                  <ShieldCheck size={30} className="text-emerald-400" />
                ) : challenge.status === "completed" ? (
                  <Trophy size={30} className={currentWon ? "text-emerald-400" : "text-red-400"} />
                ) : (
                  <AlertTriangle size={30} className="text-orange-400" />
                )}
              </div>
            </div>
          </div>

          {attention.type === "incoming" && (
            <>
              <div className="text-center">
                <div className="brand-kicker mb-2">Incoming Challenge</div>
                <h2 className="font-display text-2xl font-extrabold">YOU'VE BEEN CHALLENGED</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {challenger?.name || "A player"} wants to challenge you via {platform}.
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-[#151923] border border-[#252B36] p-4 flex items-center gap-3">
                <PlayerAvatar
                  name={challenger?.name || "Player"}
                  elo={challenger?.currentElo || 1000}
                  size={48}
                  avatarUrl={playerAvatars[challenge.challenger_player_id]}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-lg truncate">{challenger?.name || "Player"}</div>
                  <div className="text-xs text-muted-foreground">{platform} challenge</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Stake</div>
                  <div className="font-display font-extrabold text-xl">{money(challenge)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Button
                  disabled={busy}
                  onClick={() => respond("decline")}
                  className="h-12 rounded-xl bg-[#181B26] border border-[#2B313D] text-[#AAB1BE] hover:bg-red-500/10 hover:text-red-300"
                >
                  <X size={17} className="mr-2" /> Decline
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => respond("accept")}
                  className="h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold magma-glow"
                >
                  <Check size={17} className="mr-2" /> Accept
                </Button>
              </div>
            </>
          )}

          {attention.type === "verify" && (
            <>
              <div className="text-center">
                <div className="brand-kicker mb-2">Result Verification</div>
                <h2 className="font-display text-2xl font-extrabold">VERIFY THE RESULT</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  The other player reported the winner. Confirm only if the result is correct.
                </p>
              </div>

              <div className="mt-5 rounded-2xl bg-[#151923] border border-[#252B36] p-4 text-center">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Reported winner</div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <PlayerAvatar
                    name={reportedWinner?.name || "Player"}
                    elo={reportedWinner?.currentElo || 1000}
                    size={46}
                    avatarUrl={playerAvatars[challenge.reported_winner_player_id]}
                  />
                  <div className="font-display text-xl font-extrabold">{reportedWinner?.name || "Unknown"}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Button
                  disabled={busy}
                  onClick={() => navigate(`/challenges/${challenge.id}`)}
                  className="h-12 rounded-xl bg-[#181B26] border border-red-500/25 text-red-300 hover:bg-red-500/10"
                >
                  <AlertTriangle size={17} className="mr-2" /> Dispute
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => verify("confirm")}
                  className="h-12 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                  <ShieldCheck size={17} className="mr-2" /> Confirm
                </Button>
              </div>
            </>
          )}

          {attention.type === "event" && (
            <>
              <div className="text-center">
                <div className="brand-kicker mb-2">Challenge Update</div>
                {challenge.last_event === "pairing_assigned" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-magma">MONEY MATCHUP ASSIGNED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      You have been paired vs {challenge.challenger_player_id === discordPlayer.id ? challenged?.name : challenger?.name} for {money(challenge)} via {platform}.
                    </p>
                  </>
                ) : challenge.last_event === "match_pairing_verified" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-emerald-400">MONEY MATCHUP VERIFIED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      The match result is official and now counts in Chall Ranking and money statistics.
                    </p>
                  </>
                ) : challenge.last_event === "payout_disputed" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-orange-400">PAYMENT DISPUTE</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      The payout has been disputed and is waiting for Admin review.
                    </p>
                  </>
                ) : challenge.last_event === "payout_sent" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-[#D5A33A]">PAYOUT SENT</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      The losing player marked {money(challenge)} as paid. Confirm it from the match room if you received it.
                    </p>
                  </>
                ) : challenge.last_event === "payout_received" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-emerald-400">PAYMENT RECEIVED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      {money(challenge)} has been confirmed by the winner.
                    </p>
                  </>
                ) : challenge.status === "completed" ? (
                  <>
                    <h2 className={`font-display text-3xl font-black ${currentWon ? "text-emerald-400" : "text-red-400"}`}>
                      {currentWon ? "HAI VINTO" : "HAI PERSO"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Final verified result vs {challenge.challenger_player_id === discordPlayer.id ? challenged?.name : challenger?.name}.
                    </p>
                  </>
                ) : challenge.status === "declined" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-red-400">CHALLENGE DECLINED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      {challenged?.name || "The player"} declined your challenge.
                    </p>
                  </>
                ) : challenge.status === "disputed" ? (
                  <>
                    <h2 className="font-display text-2xl font-extrabold text-orange-400">RESULT DISPUTED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      The challenge needs Admin review.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-2xl font-extrabold">CHALLENGE UPDATED</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Open the match room to see the latest update.
                    </p>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 mt-5">
                {challenge.status !== "declined" && (
                  <Button
                    onClick={() => {
                      void markChallengeSeen(challenge.id);
                      navigate(`/challenges/${challenge.id}`);
                    }}
                    className="h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
                  >
                    OPEN MATCH
                  </Button>
                )}
                <Button
                  disabled={busy}
                  onClick={closeStatus}
                  variant="ghost"
                  className="h-11 rounded-xl bg-[#181B26] border border-[#2B313D] text-[#AAB1BE]"
                >
                  Close
                </Button>
              </div>
            </>
          )}

          {attention.type !== "event" && (
            <div className="mt-4 text-center text-[11px] text-[#596170]">
              A win is official only after the other player verifies it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
