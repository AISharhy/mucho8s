import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, MerdaBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import MatchResultCenter from "@/components/MatchResultCenter";
import { EmptyState } from "@/components/ProductState";
import ModeBadge, { isDirectMucho1v1 } from "@/components/ModeBadge";
import MapPreviewCard from "@/components/MapPreviewCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Trophy,
  Filter,
  Pencil,
  Trash2,
  WalletCards,
  ArrowRightLeft,
  Lock,
  Gamepad2,
  Swords,
} from "lucide-react";
import { GAMES } from "@/lib/demoData";
import { toast } from "sonner";

const signedElo = (value) => {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount}`;
};

const TeamList = ({
  ids,
  playerMap,
  playerAvatars,
  eloChanges,
  pairings = [],
  mvpId,
  mvpIds = [],
  merdaId,
  merdaIds = [],
  match,
  isWinner = false,
}) => (
  <div className="flex-1 space-y-2">
    {ids.map((id) => {
      const p = playerMap[id];
      if (!p) return null;

      const baseDelta = Number(eloChanges?.[id] ?? 0);
      const playerPairings = (Array.isArray(pairings) ? pairings : []).filter(
        (item) => item?.playerAId === id || item?.playerBId === id
      );
      const stakeValue = playerPairings.reduce(
        (sum, item) => sum + Math.max(0, Number(item?.amount) || 0),
        0
      );
      const stakeDelta = baseDelta === 0 ? 0 : (isWinner ? stakeValue : -stakeValue);
      const delta = baseDelta + stakeDelta;

      const isMvp =
        (Array.isArray(mvpIds) ? mvpIds : []).includes(id) || id === mvpId;
      const isMerda =
        (Array.isArray(merdaIds) ? merdaIds : []).includes(id) || id === merdaId;

      const breakdown = [
        {
          key: "result",
          label: isWinner ? "WIN" : "LOSS",
          value: isWinner ? 25 : -15,
        },
      ];

      if (match?.upsetApplied) {
        const upsetValue = isWinner
          ? Number(match?.upsetWinnerBonus || 0)
          : -Number(match?.upsetLoserPenalty || 0);
        if (upsetValue) {
          breakdown.push({ key: "upset", label: "UPSET", value: upsetValue });
        }
      }

      if (isMvp) {
        breakdown.push({ key: "mvp", label: "MVP", value: 5 });
      }

      const bountyRecipients = Array.isArray(match?.mvpBountyRecipientIds)
        ? match.mvpBountyRecipientIds
        : [];
      const bountyValue =
        isWinner &&
        Number(match?.mvpBountyBonus || 0) > 0 &&
        (!bountyRecipients.length || bountyRecipients.includes(id))
          ? Number(match.mvpBountyBonus)
          : 0;
      if (bountyValue) {
        breakdown.push({ key: "bounty", label: "BOUNTY", value: bountyValue });
      }

      const trophyEvents = Array.isArray(match?.trophyUnlockEvents?.[id])
        ? match.trophyUnlockEvents[id]
        : [];
      const trophyValue = trophyEvents.reduce(
        (sum, event) => sum + Number(event?.reward || 0),
        0
      );
      if (trophyValue) {
        breakdown.push({
          key: "trophy",
          label: "TROPHIES",
          value: trophyValue,
          title: trophyEvents
            .map((event) => {
              const name = String(event?.id || "trophy")
                .replaceAll("-", " ")
                .replace(/\b\w/g, (letter) => letter.toUpperCase());
              return `${name} Lv.${event?.level || "?"} ${signedElo(event?.reward || 0)}`;
            })
            .join(" · "),
        });
      }

      const explainedMatchDelta = breakdown.reduce(
        (sum, item) => sum + Number(item.value || 0),
        0
      );
      const adjustment = baseDelta - explainedMatchDelta;
      if (adjustment) {
        breakdown.push({
          key: "adjustment",
          label: "ADJUST",
          value: adjustment,
        });
      }

      if (stakeDelta) {
        breakdown.push({
          key: "stake",
          label: "STAKE",
          value: stakeDelta,
          title: `Money Chall €${stakeValue}`,
        });
      }

      const breakdownTitle = `${breakdown
        .map((item) => `${item.label} ${signedElo(item.value)}`)
        .join(" · ")} = ${signedElo(delta)} Elo`;

      return (
        <div key={id} className="flex items-start gap-2.5 min-w-0">
          <Link
            to={`/players/${id}`}
            className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[#9146FF]/60"
            aria-label={`Open ${p.name} profile`}
          >
            <PlayerAvatar
              name={p.name}
              elo={p.currentElo}
              size={30}
              avatarUrl={playerAvatars?.[id]}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate flex items-center gap-1.5">
              <Link
                to={`/players/${id}`}
                className="truncate hover:text-[#B88CFF] transition-colors"
                aria-label={`Open ${p.name} profile`}
              >
                {p.name}
              </Link>
              <MerdaBadge count={p.merdaCount} compact />
              {isMvp && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#D5A33A]/[0.08] border border-[#D5A33A]/20 text-[#D5A33A] text-[8px] font-black uppercase tracking-wider shrink-0">
                  <Trophy size={9} /> MVP
                </span>
              )}
              {isMerda && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#8B5E3C]/10 border border-[#8B5E3C]/25 text-[#C79A6B] text-[8px] font-black uppercase tracking-wider shrink-0">
                  💩 +1
                </span>
              )}
            </div>

            <div className="text-[9px] uppercase tracking-widest text-[#596170] mt-0.5">
              {p.currentElo} Elo
            </div>

          </div>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Show Elo breakdown for ${p.name}`}
                className={`min-w-[52px] h-7 px-2 rounded-lg border inline-flex items-center justify-center font-mono text-[11px] font-black transition-colors cursor-pointer ${ 
                  delta >= 0
                    ? "text-emerald-400 bg-emerald-500/[0.06] border-emerald-500/15 hover:bg-emerald-500/[0.12]"
                    : "text-red-400 bg-red-500/[0.06] border-red-500/15 hover:bg-red-500/[0.12]"
                }`}
              >
                {delta >= 0 ? "+" : ""}{delta}
              </button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-72 rounded-xl border border-[#2A303B] bg-[#0D1118] p-0 shadow-2xl"
            >
              <div className="px-3.5 py-3 border-b border-[#202630]">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181]">
                  Elo Breakdown
                </div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-display font-black text-sm truncate">
                    {p.name}
                  </span>
                  <span
                    className={`font-mono text-sm font-black ${
                      delta >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {signedElo(delta)} ELO
                  </span>
                </div>
              </div>

              <div className="p-2.5 space-y-1.5">
                {breakdown.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-lg border border-[#1D232C] bg-[#11161D] px-2.5 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-[#AAB1BE]">
                        {item.label}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-black ${
                          item.value >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {signedElo(item.value)}
                      </span>
                    </div>
                    {item.title && (
                      <div className="mt-1 text-[9px] leading-relaxed text-[#697181]">
                        {item.title}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-3.5 py-2.5 border-t border-[#202630] flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest text-[#697181]">
                  Total
                </span>
                <span
                  className={`font-mono text-xs font-black ${
                    delta >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {signedElo(delta)} ELO
                </span>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      );
    })}
  </div>
);

const money = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));

const liveDuration = (createdAt, now = Date.now()) => {
  const started = new Date(createdAt || 0).getTime();
  if (!Number.isFinite(started) || started <= 0) return "just started";

  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

const storedDuration = (minutes) => {
  const value = Math.max(0, Math.round(Number(minutes) || 0));
  if (!value) return "—";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const remaining = value % 60;
  return remaining ? `${hours}h ${String(remaining).padStart(2, "0")}m` : `${hours}h`;
};

export default function Matches({ finderMode = false }) {
  const [searchParams] = useSearchParams();
  const {
    matches,
    publicChallenges,
    matchReports,
    liveMatches,
    playerMap,
    playerAvatars,
    deleteMatch,
    isAdmin,
  } = useData();

  const safeMatches = useMemo(
    () => (Array.isArray(matches) ? matches.filter(Boolean) : []),
    [matches]
  );

  const safePlayerMap = useMemo(
    () => (playerMap && typeof playerMap === "object" ? playerMap : {}),
    [playerMap]
  );

  const [editData, setEditData] = useState(null);
  const [verificationReportId, setVerificationReportId] = useState("");
  const [liveNow, setLiveNow] = useState(Date.now());
  const view = finderMode ? "live" : "history";
  const [query, setQuery] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [modeFilter, setModeFilter] = useState("all");

  useEffect(() => {
    const timer = setInterval(() => setLiveNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const liveChallenges = useMemo(
    () =>
      (Array.isArray(publicChallenges) ? publicChallenges : [])
        .filter(
          (challenge) =>
            isDirectMucho1v1(challenge) &&
            ["pending", "accepted", "result_pending", "disputed"].includes(
              String(challenge?.status || "")
            )
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at)
        ),
    [publicChallenges]
  );

  const liveReports = useMemo(
    () =>
      (Array.isArray(matchReports) ? matchReports : [])
        .filter((report) =>
          ["pending", "disputed"].includes(String(report?.status || ""))
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at)
        ),
    [matchReports]
  );

  const liveTeamMatches = useMemo(
    () =>
      (Array.isArray(liveMatches) ? liveMatches : [])
        .filter((match) => String(match?.status || "") === "live")
        .sort(
          (a, b) =>
            new Date(b.created_at || 0) - new Date(a.created_at || 0)
        ),
    [liveMatches]
  );

  const liveCount =
    liveTeamMatches.length + liveChallenges.length + liveReports.length;

  const history = useMemo(() => {
    const matchIds = new Set(safeMatches.map((match) => String(match.id)));

    const matchRows = safeMatches.map((match) => ({
      type: "match",
      date: match.date,
      item: match,
    }));

    const challengeRows = (Array.isArray(publicChallenges) ? publicChallenges : [])
      .filter((challenge) => {
        const verified = Boolean(
          challenge?.status === "completed" &&
          challenge?.verified_at &&
          challenge?.reported_winner_player_id
        );
        if (!verified) return false;

        if (!isDirectMucho1v1(challenge)) return false;

        const alreadyInsideTeamMatch =
          String(challenge?.source || "") === "match_pairing" &&
          challenge?.match_id &&
          matchIds.has(String(challenge.match_id));

        return !alreadyInsideTeamMatch;
      })
      .map((challenge) => ({
        type: "chall",
        date: challenge.verified_at || challenge.created_at,
        item: challenge,
      }));

    return [...matchRows, ...challengeRows].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [safeMatches, publicChallenges]);

  useEffect(() => {
    const matchId = searchParams.get("match");
    if (view !== "history" || !matchId) return undefined;

    const timer = window.setTimeout(() => {
      document.getElementById(`match-history-${matchId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [view, searchParams, safeMatches.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return history.filter((row) => {
      if (modeFilter === "mucho8s" && row.type !== "match") return false;
      if (modeFilter === "mucho1v1" && row.type !== "chall") return false;

      if (row.type === "match") {
        const match = row.item;

        if (winnerFilter !== "all" && match.winner !== winnerFilter) return false;
        if (gameFilter !== "ALL" && match.game !== gameFilter) return false;
        if (!q) return true;

        const teamA = Array.isArray(match.teamA) ? match.teamA : [];
        const teamB = Array.isArray(match.teamB) ? match.teamB : [];
        const names = [...teamA, ...teamB].map(
          (id) => safePlayerMap[id]?.name?.toLowerCase() || ""
        );

        return (
          names.some((name) => name.includes(q)) ||
          String(match.game || "").toLowerCase().includes(q) ||
          String(match.mode || "").toLowerCase().includes(q) ||
          (Array.isArray(match.maps) ? match.maps : []).some((mapName) =>
            String(mapName || "").toLowerCase().includes(q)
          )
        );
      }

      if (winnerFilter !== "all" || gameFilter !== "ALL") return false;

      const challenge = row.item;
      const challenger =
        safePlayerMap[challenge.challenger_player_id]?.name || "";
      const challenged =
        safePlayerMap[challenge.challenged_player_id]?.name || "";

      return (
        !q ||
        challenger.toLowerCase().includes(q) ||
        challenged.toLowerCase().includes(q) ||
        String(challenge.platform || "").toLowerCase().includes(q)
      );
    });
  }, [history, query, winnerFilter, gameFilter, modeFilter, safePlayerMap]);

  const renderLiveTeamMatch = (match) => {
    const teamA = Array.isArray(match.team_a) ? match.team_a : [];
    const teamB = Array.isArray(match.team_b) ? match.team_b : [];
    const names = (ids) =>
      ids.map((id) => safePlayerMap[id]?.name || "Player").join(" · ");
    const captain = safePlayerMap[match.captain_player_id];
    const bo3Maps = Array.isArray(match.maps) ? match.maps.filter(Boolean).slice(0, 3) : [];
    const cancelRequested = Boolean(match.cancel_requested_at);
    const totalStake = (Array.isArray(match.pairings) ? match.pairings : []).reduce(
      (sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0),
      0
    );

    return (
      <Link
        key={`live-team-${match.id}`}
        to={`/matches/live/${match.id}`}
        className="m8-panel m8-mode-zone is-mucho8s rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 transition-all"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <ModeBadge mode="mucho8s" compact />
          <div className="min-w-0 flex-1">
            <div className="font-display font-bold truncate">
              {names(teamA)} <span className="text-[#596170]">vs</span> {names(teamB)}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {match.format ? match.format : ""}
              {match.game ? ` · ${match.game}` : ""}
              {match.mode ? ` · ${match.mode}` : ""}
              {bo3Maps.length === 3 ? ` · BO3 · ${bo3Maps.join(" / ")}` : ""}
              {captain?.name ? ` · Captain: ${captain.name}` : ""}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:justify-end shrink-0">
          <span className="h-8 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 inline-flex items-center text-[10px] font-black uppercase tracking-wider">
            Live · {liveDuration(match.created_at, liveNow)}
          </span>
          {cancelRequested && (
            <span className="h-8 px-2.5 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] text-orange-400 inline-flex items-center text-[10px] font-black uppercase tracking-wider">
              Cancel requested
            </span>
          )}

          {totalStake > 0 && (
            <span className="font-mono font-black text-sm text-emerald-400">
              {money(totalStake)}
            </span>
          )}

          <span className="h-9 px-3 rounded-lg bg-magma text-white inline-flex items-center text-xs font-bold">
            Open Match
          </span>
        </div>
      </Link>
    );
  };

  const renderLiveChallenge = (challenge) => {
    const challenger = safePlayerMap[challenge.challenger_player_id];
    const challenged = safePlayerMap[challenge.challenged_player_id];
    const amount = Number(challenge.amount_cents || 0) / 100;
    const status = String(challenge.status || "").replaceAll("_", " ").toUpperCase();

    return (
      <Link
        key={`live-chall-${challenge.id}`}
        to={`/challenges/${challenge.id}`}
        className="m8-panel m8-mode-zone is-mucho1v1 rounded-2xl p-4 flex items-center gap-4 transition-all"
      >
        <ModeBadge mode="mucho1v1" compact />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate">
            {challenger?.name || "Player"} <span className="text-[#596170]">vs</span> {challenged?.name || "Player"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {status} · {String(challenge.platform || "paypal").toUpperCase()}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-black text-emerald-400">{money(amount)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">OPEN</div>
        </div>
      </Link>
    );
  };

  const renderLiveReport = (report) => {
    const teamA = Array.isArray(report.team_a) ? report.team_a : [];
    const teamB = Array.isArray(report.team_b) ? report.team_b : [];
    const names = (ids) =>
      ids.map((id) => safePlayerMap[id]?.name || "Player").join(" · ");

    return (
      <button
        type="button"
        key={`live-report-${report.id}`}
        onClick={() => setVerificationReportId(String(report.id))}
        className="m8-panel m8-mode-zone is-mucho8s w-full rounded-2xl p-4 flex items-center gap-4 transition-all text-left"
      >
        <ModeBadge mode="mucho8s" compact />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate">
            {names(teamA)} <span className="text-[#596170]">vs</span> {names(teamB)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {String(report.status || "").replaceAll("_", " ").toUpperCase()}
            {report.game ? ` · ${report.game}` : ""}
            {report.mode ? ` · ${report.mode}` : ""}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0">OPEN REPORT</div>
      </button>
    );
  };

  const renderMoneyChall = (challenge) => {
    const challenger = safePlayerMap[challenge.challenger_player_id];
    const challenged = safePlayerMap[challenge.challenged_player_id];
    const winner = safePlayerMap[challenge.reported_winner_player_id];
    const loserId =
      challenge.reported_winner_player_id === challenge.challenger_player_id
        ? challenge.challenged_player_id
        : challenge.challenger_player_id;
    const loser = safePlayerMap[loserId];
    const amount = Number(challenge.amount_cents || 0) / 100;
    const eloEvent = challenge?.elo_event || null;
    const winnerEloDelta = Number(eloEvent?.winner_delta);
    const loserEloDelta = Number(eloEvent?.loser_delta);
    const hasExactElo = Number.isFinite(winnerEloDelta) && Number.isFinite(loserEloDelta);
    const stakeElo = Math.max(0, Math.round(amount));
    const dynamicElo = hasExactElo
      ? Math.max(0, Math.round(winnerEloDelta - stakeElo))
      : null;

    return (
      <div
        key={`chall-${challenge.id}`}
        className="m8-panel m8-mode-zone is-mucho1v1 rounded-[22px] p-5 animate-fade-up overflow-hidden relative"
        data-testid={`match-history-chall-${challenge.id}`}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <ModeBadge mode="mucho1v1" compact />
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(
                  challenge.verified_at || challenge.created_at
                ).toLocaleString()}
              </span>
            </div>

            <div className="font-display text-lg font-black mt-3">
              {challenger?.name || "Player"}{" "}
              <span className="text-[#596170]">vs</span>{" "}
              {challenged?.name || "Player"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {String(challenge.platform || "paypal").toUpperCase()} · verified
            </div>
          </div>

          <div className="sm:text-right">
            <div className="font-display text-2xl font-black text-emerald-400">
              {money(amount)}
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-1">
              {winner?.name || "Winner"} won
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Winner
            </div>
            <div className="flex items-end justify-between gap-3 mt-1">
              <div className="font-semibold">{winner?.name || "Player"}</div>
              {hasExactElo && (
                <div className="font-mono text-xl font-black text-emerald-400">
                  +{Math.round(winnerEloDelta)} ELO
                </div>
              )}
            </div>
            <div className="font-mono text-[11px] font-black text-emerald-400 mt-1">
              {hasExactElo
                ? `Dynamic +${dynamicElo} · Stake +${stakeElo}`
                : `Dynamic Elo + €${Math.max(0, Math.round(amount))} stake`}
            </div>
          </div>

          <div className="rounded-xl bg-red-500/[0.04] border border-red-500/15 p-3 text-right">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Loser
            </div>
            <div className="flex items-end justify-between gap-3 mt-1">
              <div className="font-semibold">{loser?.name || "Player"}</div>
              {hasExactElo && (
                <div className="font-mono text-xl font-black text-red-400">
                  {Math.round(loserEloDelta)} ELO
                </div>
              )}
            </div>
            <div className="font-mono text-[11px] font-black text-red-400 mt-1">
              {hasExactElo
                ? `Dynamic -${dynamicElo} · Stake -${stakeElo}`
                : "Dynamic Elo + stake"}
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <Link
            to={`/challenges/${challenge.id}`}
            className="h-9 px-3 rounded-lg bg-[#0F1218] border border-[#2A303B] inline-flex items-center justify-center text-xs font-bold text-[#C8CED8] hover:text-white"
          >
            Open Match
          </Link>
        </div>
      </div>
    );
  };

  const renderTeamMatch = (match) => (
    <div
      key={match.id}
      id={`match-history-${match.id}`}
      className={`m8-panel m8-mode-zone is-mucho8s rounded-[22px] p-5 animate-fade-up overflow-hidden relative ${
        searchParams.get("match") === String(match.id) ? "ring-1 ring-magma/50 border-magma/40" : ""
      }`}
      data-testid={`match-row-${match.id}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,42,59,.95), transparent)",
        }}
      />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <ModeBadge mode="mucho8s" compact />
          <span className="font-mono text-muted-foreground">
            {new Date(match.date).toLocaleString()}
          </span>
          {match.game && (
            <span
              className="px-2 py-0.5 rounded-md bg-[#171B23] text-xs border border-[#2B313E] text-[#D5A33A] font-bold"
              data-testid={`match-game-${match.id}`}
            >
              {match.game}
            </span>
          )}
          {match.mode && (
            <span className="px-2 py-0.5 rounded-md bg-[#0F1218] text-xs border border-[#222834] text-[#AAB1BE]">
              {match.mode}
            </span>
          )}
          {Array.isArray(match.maps) && [3, 5].includes(match.maps.length) && (
            <span className="px-2 py-0.5 rounded-md bg-[#11151C] text-[10px] border border-[#2C333E] text-[#C8CED8]">
              BO{match.maps.length} · {match.maps.join(" · ")}
            </span>
          )}
          {Number(match?.eloContext?.resultDelta) > 0 && (
            <span
              className="px-2 py-0.5 rounded-md bg-[#11151C] text-[10px] border border-[#2C333E] text-[#C8CED8] font-mono"
              title={`Alpha avg ${match.eloContext.teamAElo} · Bravo avg ${match.eloContext.teamBElo}`}
            >
              Elo base ±{match.eloContext.resultDelta}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400">
            <Trophy size={13} />
            {match.winner === "A" ? "Alpha" : "Bravo"} won
          </span>

          {match.locked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06]">
              <Lock size={12} /> LOCKED
            </span>
          )}

          {isAdmin && (
            <>
              <Button
                variant="ghost"
                data-testid={`match-edit-${match.id}`}
                onClick={() => setEditData(match)}
                className="h-9 px-3 rounded-lg bg-[#0F1218] border border-[#222834] text-[#C8CED8] hover:text-white hover:bg-white/[0.04]"
              >
                <Pencil size={14} className="mr-1.5" /> Edit
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    data-testid={`match-delete-${match.id}`}
                    className="h-9 px-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">
                      Delete this match?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The match will be removed and player stats will be recalculated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-[#0F1218] border-[#222834]">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const ok = await deleteMatch(match.id);
                        if (ok) toast.success("Match deleted — stats recalculated");
                      }}
                      className="bg-magma hover:bg-magma/90 text-white"
                    >
                      Delete Match
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-[#222834] bg-[#0D1118] p-3">
        <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181] mb-2">Match Summary</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">Winner</div>
            <div className="font-display font-black text-emerald-400 mt-1">
              {match.winner === "A" ? "Alpha" : "Bravo"}
            </div>
          </div>
          <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">Duration</div>
            <div className="font-mono font-black text-sky-300 mt-1">
              {storedDuration(match.durationMinutes)}
            </div>
          </div>
          <div className="rounded-xl border border-[#2A303B] bg-[#0F1218] px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">Total Stake</div>
            <div className="font-mono font-black text-white mt-1">
              {money((Array.isArray(match.pairings) ? match.pairings : []).reduce((sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0), 0))}
            </div>
          </div>
          <div className="rounded-xl border border-[#2A303B] bg-[#0F1218] px-3 py-2.5">
            <div className="text-[9px] uppercase tracking-widest text-[#697181]">Format</div>
            <div className="font-display font-black text-[#C8CED8] mt-1">
              {Array.isArray(match.maps) && [3, 5].includes(match.maps.length)
                ? `Best of ${match.maps.length}`
                : ((match.teamA?.length || 0) + "v" + (match.teamB?.length || 0))}
            </div>
          </div>
        </div>
      </div>

      {Array.isArray(match.maps) && [3, 5].includes(match.maps.length) && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">
              Saved BO{match.maps.length} rotation
            </div>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Generated at match confirmation
            </span>
          </div>
          <div className={match.maps.length === 5 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2" : "grid grid-cols-1 sm:grid-cols-3 gap-2"}>
            {match.maps.map((mapName, index) => {
              const storedMapResults = Array.isArray(match.mapResults) ? match.mapResults : [];
              const mapResult = storedMapResults[index];
              const hasRecordedMapResults = storedMapResults.length > 0;
              const mapWinner =
                mapResult?.winner === "A" ? "Alpha" : mapResult?.winner === "B" ? "Bravo" : "";
              const mapLoser =
                mapResult?.winner === "A" ? "Bravo" : mapResult?.winner === "B" ? "Alpha" : "";

              return (
                <div key={mapName + "-" + index} className="group">
                  {mapResult ? (
                    <div className="relative overflow-hidden rounded-t-xl border border-b-0 border-[#2A303B] bg-[#10151D] px-2.5 py-2">
                      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,185,129,.08),transparent_38%,transparent_62%,rgba(239,68,68,.07))]" />
                      <div className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 text-[8px] font-black uppercase tracking-wider ${
                            mapResult.winner === "A"
                              ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-300"
                              : "border-red-400/20 bg-red-500/10 text-red-300"
                          }`}>
                            {mapResult.winner === "A" ? "W" : "L"}
                          </span>
                          <span className={`truncate text-[9px] font-black uppercase tracking-[0.12em] ${
                            mapResult.winner === "A" ? "text-emerald-300" : "text-red-300"
                          }`}>
                            Alpha
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.16em] text-white/55">
                          <Trophy size={10} className="text-amber-300/80" />
                          Map {index + 1}
                        </div>

                        <div className="flex min-w-0 items-center justify-end gap-1.5">
                          <span className={`truncate text-right text-[9px] font-black uppercase tracking-[0.12em] ${
                            mapResult.winner === "B" ? "text-emerald-300" : "text-red-300"
                          }`}>
                            Bravo
                          </span>
                          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md border px-1.5 text-[8px] font-black uppercase tracking-wider ${
                            mapResult.winner === "B"
                              ? "border-emerald-400/25 bg-emerald-500/12 text-emerald-300"
                              : "border-red-400/20 bg-red-500/10 text-red-300"
                          }`}>
                            {mapResult.winner === "B" ? "W" : "L"}
                          </span>
                        </div>
                      </div>

                      <div className="relative z-10 mt-1 text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                        {mapWinner} won · {mapLoser} lost
                      </div>
                    </div>
                  ) : hasRecordedMapResults ? (
                    <div className="rounded-t-xl border border-b-0 border-[#2A303B] bg-[#10151D] px-3 py-2 text-center text-[8px] font-black uppercase tracking-[0.18em] text-white/35">
                      Map {index + 1} · Not played
                    </div>
                  ) : null}

                  <MapPreviewCard
                    mapName={mapName}
                    game={match.game}
                    mode={match.mode}
                    index={index}
                    compact
                    className={hasRecordedMapResults ? "rounded-t-none" : ""}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 items-stretch gap-3 sm:gap-4">
        <div
          className="rounded-xl p-4 border"
          style={{
            background:
              match.winner === "A"
                ? "rgba(16,185,129,0.055)"
                : "rgba(239,68,68,0.035)",
            borderColor:
              match.winner === "A" ? "rgba(16,185,129,.24)" : "rgba(239,68,68,.16)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-black uppercase tracking-widest text-[#C8CED8]">
              Alpha
            </div>
            {match.winner === "A" ? (
              <span className="px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                Winner
              </span>
            ) : (
              <span className="px-2 py-1 rounded-md border border-red-500/20 bg-red-500/[0.05] text-[9px] uppercase tracking-widest text-red-400 font-black">
                Loser
              </span>
            )}
          </div>
          <TeamList
            ids={Array.isArray(match.teamA) ? match.teamA : []}
            playerMap={safePlayerMap}
            playerAvatars={playerAvatars}
            eloChanges={match.eloChanges}
            pairings={match.pairings}
            mvpId={match.mvpId}
            mvpIds={match.mvpIds}
            merdaId={match.merdaId}
            merdaIds={match.merdaIds}
            match={match}
            isWinner={match.winner === "A"}
          />
        </div>

        <div
          className="rounded-xl p-4 border"
          style={{
            background:
              match.winner === "B"
                ? "rgba(16,185,129,0.055)"
                : "rgba(239,68,68,0.035)",
            borderColor:
              match.winner === "B" ? "rgba(16,185,129,.24)" : "rgba(239,68,68,.16)",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-black uppercase tracking-widest text-[#C8CED8]">
              Bravo
            </div>
            {match.winner === "B" ? (
              <span className="px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                Winner
              </span>
            ) : (
              <span className="px-2 py-1 rounded-md border border-red-500/20 bg-red-500/[0.05] text-[9px] uppercase tracking-widest text-red-400 font-black">
                Loser
              </span>
            )}
          </div>
          <TeamList
            ids={Array.isArray(match.teamB) ? match.teamB : []}
            playerMap={safePlayerMap}
            playerAvatars={playerAvatars}
            eloChanges={match.eloChanges}
            pairings={match.pairings}
            mvpId={match.mvpId}
            mvpIds={match.mvpIds}
            merdaId={match.merdaId}
            merdaIds={match.merdaIds}
            match={match}
            isWinner={match.winner === "B"}
          />
        </div>
      </div>

      {Array.isArray(match.pairings) &&
        match.pairings.filter(Boolean).length > 0 && (
          <div
            className="mt-4 pt-4 border-t border-[#1D222C]"
            data-testid={`match-money-pairings-${match.id}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <WalletCards size={15} className="text-emerald-400" />
              <span className="brand-kicker text-[#C8CED8]">Matchups & Stakes</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {match.pairings.length} pairings
                </span>
                <span className="font-mono text-[11px] font-black text-emerald-400">
                  {money(match.pairings.reduce((sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0), 0))}
                </span>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {match.pairings.filter(Boolean).map((pair, index) => {
                const alpha = safePlayerMap[pair.playerAId];
                const bravo = safePlayerMap[pair.playerBId];
                const winnerId =
                  match.winner === "A" ? pair.playerAId : pair.playerBId;
                const winner = safePlayerMap[winnerId];

                return (
                  <div
                    key={pair.playerAId + "-" + pair.playerBId + "-" + index}
                    className="rounded-xl border border-[#252C37] bg-[#0F1218] px-3 py-3"
                  >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm min-w-0">
                      <div className="min-w-0 flex items-center gap-1.5">
                        <Link
                          to={`/players/${pair.playerAId}`}
                          className={`font-bold truncate hover:underline ${winnerId === pair.playerAId ? "text-emerald-400" : "text-red-400"}`}
                          aria-label={`Open ${alpha?.name || "Alpha"} profile`}
                        >
                          {alpha?.name || "Alpha"}
                        </Link>
                        <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded ${winnerId === pair.playerAId ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {winnerId === pair.playerAId ? "W" : "L"}
                        </span>
                      </div>
                      <ArrowRightLeft size={13} className="text-[#596170] shrink-0" />
                      <div className="min-w-0 flex items-center justify-end gap-1.5">
                        <span className={`shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded ${winnerId === pair.playerBId ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {winnerId === pair.playerBId ? "W" : "L"}
                        </span>
                        <Link
                          to={`/players/${pair.playerBId}`}
                          className={`font-bold truncate hover:underline ${winnerId === pair.playerBId ? "text-emerald-400" : "text-red-400"}`}
                          aria-label={`Open ${bravo?.name || "Bravo"} profile`}
                        >
                          {bravo?.name || "Bravo"}
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2.5 pt-2 border-t border-[#1D222C]">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Stake <strong className="ml-1 font-mono text-white">€{Number(pair.amount || 0).toFixed(2)}</strong>
                      </span>
                      <span className="text-[10px] uppercase tracking-wider font-black text-emerald-400">
                        {winner?.name || "Winner"} won
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">{finderMode ? "Active Matches" : "Match Center"}</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">
              {finderMode ? "Match Finder" : "Match History"}
            </h2>
            <p className="text-sm text-[#7F8795] mt-1">
              {finderMode
                ? "Matches found from Play, live rooms and results waiting for verification appear here."
                : "Verified Mucho8s and Mucho1v1 results stay together in one timeline."}
            </p>
          </div>

          {finderMode && liveCount > 0 && (
            <div className="h-10 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 inline-flex items-center text-xs font-black uppercase tracking-wider self-start lg:self-auto">
              Active · {liveCount}
            </div>
          )}
        </div>

        {!finderMode && (
          <div className="flex flex-col gap-3 mt-5 pt-4 border-t border-[#1D222C]">
            <div className="flex flex-wrap items-center gap-2">
              {[
                ["all", "All"],
                ["mucho8s", "Mucho8s"],
                ["mucho1v1", "Mucho1v1"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => setModeFilter(key)}
                  className={`h-8 px-3 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${
                    modeFilter === key
                      ? key === "mucho8s"
                        ? "bg-magma text-white border-magma"
                        : key === "mucho1v1"
                          ? "bg-emerald-400 text-black border-emerald-400"
                          : "bg-white text-black border-white"
                      : "bg-[#0F1218] text-[#8D95A4] border-[#222834] hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  data-testid="matches-search-input"
                  placeholder="Search player, game or mode..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-10 bg-[#0F1218] border-[#222834] h-11 rounded-xl"
                />
              </div>

              <select
                value={gameFilter}
                onChange={(event) => setGameFilter(event.target.value)}
                className="h-11 w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] font-semibold px-3 text-sm"
              >
                <option value="ALL">All Games</option>
                {GAMES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <div className="flex flex-wrap items-center gap-2">
                <Filter size={16} className="text-muted-foreground" />
                {[
                  { key: "all", label: "All" },
                  { key: "A", label: "Alpha" },
                  { key: "B", label: "Bravo" },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    aria-pressed={winnerFilter === filter.key}
                    onClick={() => setWinnerFilter(filter.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      winnerFilter === filter.key
                        ? "bg-magma text-white border-magma"
                        : "bg-[#0F1218] text-[#8D95A4] border-[#222834] hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {view === "live" ? (
        <div className="space-y-3" data-testid="live-matches-list">
          {liveCount === 0 ? (
            <EmptyState
              icon={Gamepad2}
              title="No active matches"
              description="When a match is found or goes live from Play, it will appear here."
            />
          ) : (
            <>
              {liveTeamMatches.map(renderLiveTeamMatch)}
              {liveReports.map(renderLiveReport)}
              {liveChallenges.map(renderLiveChallenge)}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3" data-testid="matches-list">
          {filtered.length === 0 && (
            <EmptyState
              icon={Gamepad2}
              title={history.length === 0 ? "No match history yet" : "No matches found"}
              description={
                history.length === 0
                  ? "Verified Mucho8s and Mucho1v1 results will appear here."
                  : "Try changing the search or filters."
              }
            />
          )}

          {filtered.map((row) =>
            row.type === "chall"
              ? renderMoneyChall(row.item)
              : renderTeamMatch(row.item)
          )}
        </div>
      )}

      <Dialog
        open={Boolean(verificationReportId)}
        onOpenChange={(open) => !open && setVerificationReportId("")}
      >
        <DialogContent className="bg-[#101319] border-[#242A35] max-w-3xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Mucho8s Verification</DialogTitle>
          </DialogHeader>
          <MatchResultCenter
            reportId={verificationReportId}
            hideHeader
            onResolved={() => setVerificationReportId("")}
          />
        </DialogContent>
      </Dialog>

      <RecordMatchDialog
        open={!!editData}
        onOpenChange={(open) => !open && setEditData(null)}
        editData={editData}
        title="Edit Match"
      />
    </div>
  );
}
