import React, { useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/shared";
import { Check, X, Swords, ShieldCheck, AlertTriangle, ExternalLink } from "lucide-react";
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

export default function ChallengeCenter() {
  const {
    challenges,
    discordAccount,
    discordPlayer,
    playerMap,
    playerAvatars,
    respondToChallenge,
    verifyChallengeResult,
  } = useData();

  const [busy, setBusy] = useState(false);
  const lastAttentionRef = useRef("");

  const incoming = useMemo(() => {
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

    return null;
  }, [challenges, discordAccount]);

  useEffect(() => {
    if (!incoming) return;
    const key = `${incoming.type}:${incoming.challenge.id}:${incoming.challenge.status}`;
    if (lastAttentionRef.current === key) return;
    lastAttentionRef.current = key;
    playChallengeTone();
  }, [incoming]);

  if (!incoming || !discordPlayer) return null;

  const challenge = incoming.challenge;
  const opponentId =
    challenge.challenger_player_id === discordPlayer.id
      ? challenge.challenged_player_id
      : challenge.challenger_player_id;
  const opponent = playerMap[opponentId];
  const challenger = playerMap[challenge.challenger_player_id];
  const reportedWinner = playerMap[challenge.reported_winner_player_id];
  const platform = String(challenge.platform || "").toUpperCase();

  const respond = async (decision) => {
    setBusy(true);

    let newTab = null;
    if (decision === "accept" && challenge.target_url) {
      newTab = window.open("about:blank", "_blank", "noopener,noreferrer");
    }

    const updated = await respondToChallenge(challenge.id, decision);
    setBusy(false);

    if (!updated) {
      if (newTab) newTab.close();
      return;
    }

    if (decision === "accept") {
      toast.success("Challenge accepted — play it, then report the result.");
      if (newTab) newTab.location.href = challenge.target_url;
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
      toast.success("Result verified — challenge completed.");
    } else {
      toast.error("Result disputed — challenge needs review.");
    }
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
                {incoming.type === "incoming" ? (
                  <Swords size={30} className="text-magma" />
                ) : (
                  <ShieldCheck size={30} className="text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          {incoming.type === "incoming" ? (
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
                <Swords size={20} className="text-magma" />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <Button
                  disabled={busy}
                  onClick={() => respond("decline")}
                  className="h-12 rounded-xl bg-[#171B23] border border-[#2B313D] text-[#AAB1BE] hover:bg-red-500/10 hover:text-red-300"
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
          ) : (
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
                  onClick={() => verify("dispute")}
                  className="h-12 rounded-xl bg-[#171B23] border border-red-500/25 text-red-300 hover:bg-red-500/10"
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

          <div className="mt-4 text-center text-[11px] text-[#596170]">
            A win is official only after the other player verifies it.
          </div>
        </div>
      </div>
    </div>
  );
}
