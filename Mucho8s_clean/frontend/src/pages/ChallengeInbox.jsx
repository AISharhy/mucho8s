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

    const seriesSeen = new Set();
    const result = [];

    challenges.forEach((challenge) => {
      if (challenge.series_id) {
        if (seriesSeen.has(challenge.series_id)) return;
        seriesSeen.add(challenge.series_id);

        const group = challenges
          .filter((item) => item.series_id === challenge.series_id)
          .sort((a, b) => Number(b.series_round || 0) - Number(a.series_round || 0));
        const latest = group[0] || challenge;
        const series = latest.series || challenge.series || null;
        const isChallenger = latest.challenger_account_id === discordAccount.id;
        const opponentId = isChallenger
          ? latest.challenged_player_id
          : latest.challenger_player_id;
        const opponent = playerMap[opponentId];
        const iReceive = Boolean(
          series?.settlement_winner_player_id === discordAccount.player_id
        );

        const roundNeedsAction =
          (latest.status === "pending" && !isChallenger) ||
          (latest.status === "result_pending" && latest.reporter_account_id !== discordAccount.id);

        const settlementNeedsAction = Boolean(
          series?.status === "closed" &&
          Number(series?.settlement_amount_cents || 0) > 0 &&
          (
            (!iReceive && !series?.payment_sent_at) ||
            (iReceive && series?.payment_sent_at && !series?.payment_received_at)
          )
        );

        const active = Boolean(
          series?.status === "open" ||
          (series?.status === "closed" && !series?.payment_received_at)
        );

        result.push({
          challenge: latest,
          isChallenger,
          opponentId,
          opponent,
          needsAction: roundNeedsAction || settlementNeedsAction,
          active,
          series,
          roundCount: Number(series?.round_count || group.length),
        });
        return;
      }

      const isChallenger = challenge.challenger_account_id === discordAccount.id;
      const opponentId = isChallenger
        ? challenge.challenged_player_id
        : challenge.challenger_player_id;
      const opponent = playerMap[opponentId];

      const iWon =
        challenge.status === "completed" &&
        challenge.reported_winner_player_id === discordAccount.player_id;

      const needsAction =
        (challenge.status === "pending" && !isChallenger) ||
        (challenge.status === "result_pending" && challenge.reporter_account_id !== discordAccount.id) ||
        (challenge.status === "completed" && !iWon && !challenge.payment_sent_at) ||
        (challenge.status === "completed" && iWon && challenge.payment_sent_at && !challenge.payment_received_at);

      const active =
        ["pending", "accepted", "result_pending", "disputed"].includes(challenge.status) ||
        (challenge.status === "completed" && !challenge.payment_received_at);

      result.push({ challenge, isChallenger, opponentId, opponent, needsAction, active, series: null, roundCount: 0 });
    });

    return result;
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
          {visible.map(({ challenge, isChallenger, opponentId, opponent, needsAction, series, roundCount }) => {
            const completed = challenge.status === "completed";
            const won = completed && challenge.reported_winner_player_id === discordPlayer.id;
            const lost = completed && challenge.reported_winner_player_id && !won;
            const iReceiveSeries = Boolean(series?.settlement_winner_player_id === discordPlayer.id);
            const payoutPending = series
              ? Boolean(
                  series.status === "closed" &&
                  Number(series.settlement_amount_cents || 0) > 0 &&
                  !series.payment_received_at
                )
              : completed && !challenge.payment_received_at;
            const payoutDisputed = series
              ? Boolean(series.payout_disputed_at && !series.payout_dispute_resolved_at)
              : Boolean(challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at);
            const payoutLabel = payoutDisputed
              ? "DISPUTA APERTA"
              : series
                ? iReceiveSeries
                  ? series.payment_sent_at
                    ? "CONFERMA RICEZIONE"
                    : "IN ATTESA PAGAMENTO"
                  : series.payment_sent_at
                    ? "PAGAMENTO INVIATO"
                    : "SALDO DA PAGARE"
                : won
                  ? challenge.payment_sent_at
                    ? "CONFERMA RICEZIONE"
                    : "IN ATTESA PAGAMENTO"
                  : challenge.payment_sent_at
                    ? "PAGAMENTO INVIATO"
                    : "DA PAGARE";

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
                        {series ? (
                          <>
                            CHALL SERIES · {roundCount} {roundCount === 1 ? "round" : "rounds"} ·{" "}
                            {series.status === "open"
                              ? Number(series.current_amount_cents || 0) === 0
                                ? "da regolare €0"
                                : "da regolare " + new Intl.NumberFormat("it-IT", { style: "currency", currency: series.currency || "EUR" }).format(Number(series.current_amount_cents || 0) / 100) + " a " + (playerMap[series.current_winner_player_id]?.name || "Player")
                              : series.status === "settled"
                                ? "chiusa"
                                : "pagamento finale " + new Intl.NumberFormat("it-IT", { style: "currency", currency: series.currency || "EUR" }).format(Number(series.settlement_amount_cents || 0) / 100)}
                          </>
                        ) : (
                          <>
                            {String(challenge.platform || "").toUpperCase()} · {money(challenge)} · {new Date(challenge.created_at).toLocaleString()}
                          </>
                        )}
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
                    {series?.status === "open" && challenge.status === "completed" && (
                      <span className="h-10 px-3 rounded-xl bg-[#5865F2]/10 border border-[#5865F2]/25 text-[#8993FF] text-[10px] font-bold inline-flex items-center">
                        SERIES OPEN
                      </span>
                    )}
                    {series?.status === "settled" && (
                      <span className="h-10 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-bold inline-flex items-center">
                        SERIES SETTLED
                      </span>
                    )}
                    {payoutPending && (
                      <span className={`h-10 px-3 rounded-xl text-[10px] font-bold inline-flex items-center ${
                        payoutDisputed
                          ? "bg-orange-500/10 border border-orange-500/25 text-orange-400"
                          : "bg-[#D5A33A]/10 border border-[#D5A33A]/25 text-[#D5A33A]"
                      }`}>
                        {payoutLabel}
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
                        className="h-10 px-4 rounded-xl bg-[#181B26] border border-[#2A303B] text-sm font-semibold text-white inline-flex items-center justify-center hover:bg-white/[0.05]"
                      >
                        {needsAction ? <AlertTriangle size={14} className="mr-1.5 text-[#D5A33A]" /> : <Swords size={14} className="mr-1.5" />}
                        {series ? "Open Series" : "Open Match"}
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
