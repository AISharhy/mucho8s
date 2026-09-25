import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Bell,
  Check,
  Clock3,
  History,
  ShieldCheck,
  Swords,
  X,
  AlertTriangle,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

const money = (challenge) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: challenge?.currency || "EUR",
  }).format(Number(challenge?.amount_cents || 0) / 100);

const statusText = {
  pending: "PENDING",
  accepted: "IN CORSO",
  declined: "RIFIUTATA",
  result_pending: "DA VERIFICARE",
  completed: "CONCLUSA",
  disputed: "CONTESTATA",
  cancelled: "ANNULLATA",
};

export default function ChallengeInbox() {
  const navigate = useNavigate();
  const {
    challenges,
    discordSession,
    discordAccount,
    discordPlayer,
    playerMap,
    playerAvatars,
    respondToChallenge,
    challengeNotificationCount,
  } = useData();

  const [tab, setTab] = useState("action");
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(() => {
    if (!discordAccount?.id) return [];

    return challenges.map((challenge) => {
      const isChallenger = challenge.challenger_account_id === discordAccount.id;
      const opponentId = isChallenger
        ? challenge.challenged_player_id
        : challenge.challenger_player_id;
      const opponent = playerMap[opponentId];

      const needsAction =
        (challenge.status === "pending" && !isChallenger) ||
        (challenge.status === "result_pending" && challenge.reporter_account_id !== discordAccount.id) ||
        (challenge.status === "accepted" && !isChallenger && challenge.payment_sent_at && !challenge.payment_received_at) ||
        (challenge.status === "accepted" &&
          challenge.payment_received_at &&
          !(isChallenger ? challenge.challenger_ready_at : challenge.challenged_ready_at));

      const active = ["pending", "accepted", "result_pending", "disputed"].includes(challenge.status);

      return { challenge, isChallenger, opponentId, opponent, needsAction, active };
    });
  }, [challenges, discordAccount, playerMap]);

  const visible = rows.filter((row) => {
    if (tab === "action") return row.needsAction;
    if (tab === "active") return row.active;
    return !row.active;
  });

  const respond = async (challenge, decision) => {
    setBusyId(challenge.id);
    const updated = await respondToChallenge(challenge.id, decision);
    setBusyId("");
    if (!updated) return;

    if (decision === "accept") {
      toast.success("Challenge accepted");
      navigate(`/challenges/${challenge.id}`);
    } else {
      toast("Challenge declined");
    }
  };

  if (!discordSession || !discordPlayer) {
    return (
      <div className="card-surface rounded-2xl p-10 text-center max-w-xl mx-auto">
        <Bell size={34} className="text-[#697181] mx-auto mb-3" />
        <h2 className="font-display text-2xl font-bold">Challenge Inbox</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Login with Discord to see your challenges and notifications.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">Challenge Center</div>
          <h2 className="font-display text-3xl font-extrabold">Challenge Inbox</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Accept requests, follow active challs and verify results.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            ["action", `Action${challengeNotificationCount ? ` (${challengeNotificationCount})` : ""}`],
            ["active", "Active"],
            ["history", "History"],
          ].map(([key, label]) => (
            <Button
              key={key}
              onClick={() => setTab(key)}
              variant="ghost"
              className={`rounded-xl border ${
                tab === key
                  ? "bg-white text-black border-white hover:bg-white"
                  : "bg-[#0F1218] border-[#222834] text-[#AAB1BE] hover:text-white"
              }`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card-surface rounded-2xl p-10 text-center">
          <ShieldCheck size={34} className="text-[#596170] mx-auto mb-3" />
          <div className="font-display font-bold">Nothing here</div>
          <div className="text-sm text-muted-foreground mt-1">
            {tab === "action" ? "You have no challenge actions waiting." : "No challenges in this section."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(({ challenge, isChallenger, opponentId, opponent, needsAction }) => {
            const completed = challenge.status === "completed";
            const won = completed && challenge.reported_winner_player_id === discordPlayer.id;
            const lost = completed && challenge.reported_winner_player_id && !won;

            return (
              <div
                key={challenge.id}
                className={`card-surface rounded-2xl p-4 sm:p-5 ${
                  won ? "border-emerald-500/25" : lost ? "border-red-500/25" : ""
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <PlayerAvatar
                      name={opponent?.name || "Player"}
                      elo={opponent?.currentElo || 1000}
                      size={46}
                      avatarUrl={playerAvatars[opponentId]}
                    />
                    <div className="min-w-0">
                      <div className="font-display font-bold text-lg truncate">vs {opponent?.name || "Player"}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {String(challenge.platform || "").toUpperCase()} · {money(challenge)} · {new Date(challenge.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap md:justify-end">
                    {won && (
                      <span className="h-10 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-extrabold inline-flex items-center">
                        <Trophy size={14} className="mr-1.5" /> VINTA
                      </span>
                    )}
                    {lost && (
                      <span className="h-10 px-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-extrabold inline-flex items-center">
                        PERSA
                      </span>
                    )}
                    {!completed && (
                      <span className={`h-10 px-3 rounded-xl border text-xs font-bold inline-flex items-center ${
                        challenge.status === "disputed"
                          ? "text-orange-400 border-orange-500/25 bg-orange-500/5"
                          : challenge.status === "declined" || challenge.status === "cancelled"
                            ? "text-red-400 border-red-500/20 bg-red-500/5"
                            : challenge.status === "accepted"
                              ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                              : "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/5"
                      }`}>
                        {statusText[challenge.status] || challenge.status}
                      </span>
                    )}

                    {challenge.status === "pending" && !isChallenger ? (
                      <>
                        <Button
                          disabled={busyId === challenge.id}
                          onClick={() => respond(challenge, "decline")}
                          variant="ghost"
                          className="h-10 rounded-xl bg-red-500/5 border border-red-500/20 text-red-400"
                        >
                          <X size={15} className="mr-1.5" /> Decline
                        </Button>
                        <Button
                          disabled={busyId === challenge.id}
                          onClick={() => respond(challenge, "accept")}
                          className="h-10 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white"
                        >
                          <Check size={15} className="mr-1.5" /> Accept
                        </Button>
                      </>
                    ) : (
                      <Link
                        to={`/challenges/${challenge.id}`}
                        className="h-10 px-4 rounded-xl bg-[#171B23] border border-[#2A303B] text-sm font-semibold text-white inline-flex items-center justify-center hover:bg-white/[0.05]"
                      >
                        {needsAction ? <AlertTriangle size={14} className="mr-1.5 text-[#D5A33A]" /> : <Swords size={14} className="mr-1.5" />}
                        Open Match
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
