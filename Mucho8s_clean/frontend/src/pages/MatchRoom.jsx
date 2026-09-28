import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Crown,
  Gamepad2,
  ShieldCheck,
  Timer,
  Trash2,
  Trophy,
  WalletCards,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import {
  TROPHY8S_RULES,
  MAX_TROPHY_LEVEL,
  trophyGoalForLevel,
  trophyRewardForLevel,
} from "@/lib/trophyRules";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
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
import { toast } from "sonner";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const liveDuration = (createdAt, now) => {
  const started = new Date(createdAt || 0).getTime();
  if (!started || Number.isNaN(started)) return "—";

  const minutes = Math.max(0, Math.floor((now - started) / 60000));
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `${hours}h ${String(remaining).padStart(2, "0")}m`;
};

const TeamPanel = ({
  label,
  ids,
  accent,
  captainId,
  playerMap,
  playerAvatars,
}) => (
  <div className="rounded-2xl border border-[#222834] bg-[#0F1218] p-4">
    <div
      className="text-[10px] uppercase tracking-[0.18em] font-black mb-3"
      style={{ color: accent }}
    >
      {label}
    </div>

    <div className="space-y-2">
      {ids.map((id) => {
        const player = playerMap[id];

        return (
          <Link
            key={id}
            to={`/players/${id}`}
            className="min-h-[52px] rounded-xl border border-[#202631] bg-[#12161D] px-3 py-2.5 flex items-center gap-3 hover:border-[#353D49] transition-all"
          >
            <PlayerAvatar
              name={player?.name || "Player"}
              elo={player?.currentElo || 1000}
              size={34}
              avatarUrl={playerAvatars[id]}
            />

            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate flex items-center gap-2">
                {player?.name || "Player"}
                {String(id) === String(captainId || "") && (
                  <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1">
                    <Crown size={10} /> Captain
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {Number(player?.currentElo || 1000)} Elo
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </div>
);

export default function MatchRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    liveMatches,
    matches,
    discordPlayer,
    playerMap,
    playerAvatars,
    isAdmin,
    requestCancelLiveMatch,
    cancelLiveMatch,
  } = useData();

  const [now, setNow] = useState(Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const match = useMemo(
    () =>
      (Array.isArray(liveMatches) ? liveMatches : []).find(
        (item) => String(item?.id || "") === String(id || "")
      ) || null,
    [liveMatches, id]
  );

  const trophyOpportunities = useMemo(() => {
    const playerId = String(discordPlayer?.id || "");
    if (!match || !playerId) return [];

    const liveA = Array.isArray(match.team_a) ? match.team_a.map(String) : [];
    const liveB = Array.isArray(match.team_b) ? match.team_b.map(String) : [];
    if (![...liveA, ...liveB].includes(playerId)) return [];

    const history = (Array.isArray(matches) ? matches : [])
      .filter(
        (item) =>
          (item.teamA || []).map(String).includes(playerId) ||
          (item.teamB || []).map(String).includes(playerId)
      )
      .sort(
        (a, b) =>
          new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime()
      );

    const h2h = new Map();
    const lastByOpponent = new Map();
    let streak = 0;
    let wonValue = 0;
    let maxWonPairing = 0;
    let cleanSweepCount = 0;
    let runItBackCount = 0;

    history.forEach((item) => {
      const teamA = (item.teamA || []).map(String);
      const teamB = (item.teamB || []).map(String);
      const inA = teamA.includes(playerId);
      const opponents = inA ? teamB : teamA;
      const winnerSide = item.winner === "B" ? "B" : "A";
      const won = (inA && winnerSide === "A") || (!inA && winnerSide === "B");

      streak = won
        ? (streak > 0 ? streak + 1 : 1)
        : (streak < 0 ? streak - 1 : -1);

      if (won && streak > 0 && streak % 4 === 0) cleanSweepCount += 1;

      const pairing = (Array.isArray(item.pairings) ? item.pairings : []).find(
        (pair) =>
          String(pair?.playerAId || "") === playerId ||
          String(pair?.playerBId || "") === playerId
      );
      const amount = Math.max(0, Number(pairing?.amount) || 0);

      if (won && amount > 0) {
        wonValue += amount;
        maxWonPairing = Math.max(maxWonPairing, amount);
      }

      let didRunItBack = false;
      opponents.forEach((opponentId) => {
        const key = String(opponentId);
        const row = h2h.get(key) || { played: 0, wins: 0 };
        const previous = lastByOpponent.get(key);

        row.played += 1;
        if (won) row.wins += 1;
        h2h.set(key, row);

        if (won && previous === "L") didRunItBack = true;
        lastByOpponent.set(key, won ? "W" : "L");
      });
      if (didRunItBack) runItBackCount += 1;
    });

    let maxH2HPlayed = 0;
    let maxH2HWins = 0;
    h2h.forEach((row) => {
      maxH2HPlayed = Math.max(maxH2HPlayed, Number(row?.played || 0));
      maxH2HWins = Math.max(maxH2HWins, Number(row?.wins || 0));
    });

    const currentLevels = playerMap?.[playerId]?.trophy8sLevels || {};
    const opportunities = [];

    const addIfReached = (trophyId, potentialValue, detail) => {
      const rule = TROPHY8S_RULES[trophyId];
      const level = Math.max(0, Number(currentLevels?.[trophyId] || 0));
      if (!rule || level >= MAX_TROPHY_LEVEL) return;

      const nextLevel = level + 1;
      const goal = trophyGoalForLevel(rule, nextLevel);
      if (Number(potentialValue || 0) < goal) return;

      opportunities.push({
        id: trophyId,
        title: rule.title,
        level: nextLevel,
        goal,
        reward: trophyRewardForLevel(rule, nextLevel),
        detail,
      });
    };

    const nextWinStreak = streak > 0 ? streak + 1 : 1;
    const nextCleanSweepCount =
      nextWinStreak > 0 && nextWinStreak % 4 === 0
        ? cleanSweepCount + 1
        : cleanSweepCount;

    const livePairing = (Array.isArray(match.pairings) ? match.pairings : []).find(
      (pair) =>
        String(pair?.playerAId || "") === playerId ||
        String(pair?.playerBId || "") === playerId
    );
    const liveAmount = Math.max(0, Number(livePairing?.amount) || 0);

    const liveOpponents = liveA.includes(playerId) ? liveB : liveA;
    let nextMaxPlayed = maxH2HPlayed;
    let nextMaxWins = maxH2HWins;
    let canRunItBack = false;

    liveOpponents.forEach((opponentId) => {
      const key = String(opponentId);
      const row = h2h.get(key) || { played: 0, wins: 0 };
      nextMaxPlayed = Math.max(nextMaxPlayed, row.played + 1);
      nextMaxWins = Math.max(nextMaxWins, row.wins + 1);
      if (lastByOpponent.get(key) === "L") canRunItBack = true;
    });

    addIfReached(
      "veteran",
      history.length + 1,
      "Complete this Mucho8s · match #" + (history.length + 1)
    );
    addIfReached(
      "on-fire",
      nextWinStreak,
      "Win this Mucho8s · reach " + nextWinStreak + "W"
    );
    addIfReached(
      "unstoppable",
      nextWinStreak,
      "Win this Mucho8s · reach " + nextWinStreak + "W"
    );
    addIfReached(
      "clean-sweep",
      nextCleanSweepCount,
      "Win this Mucho8s · complete another 4W sweep"
    );
    addIfReached(
      "money-maker",
      wonValue + liveAmount,
      "Win this pairing · total €" + (wonValue + liveAmount).toFixed(0)
    );
    addIfReached(
      "high-roller",
      Math.max(maxWonPairing, liveAmount),
      "Win your €" + liveAmount.toFixed(0) + " pairing"
    );
    addIfReached(
      "rivalry",
      nextMaxPlayed,
      "Play this Mucho8s · rivalry meeting milestone"
    );
    addIfReached(
      "nemesis",
      nextMaxWins,
      "Win this Mucho8s · head-to-head win milestone"
    );
    if (canRunItBack) {
      addIfReached(
        "run-it-back",
        runItBackCount + 1,
        "Win this Mucho8s after the previous loss"
      );
    }

    return opportunities;
  }, [match, matches, discordPlayer?.id, playerMap]);

  if (!match) {
    return (
      <div className="m8-page-stack">
        <section className="m8-panel rounded-[22px] p-8 sm:p-10 text-center">
          <Gamepad2 size={30} className="mx-auto text-[#697181]" />
          <h1 className="font-display text-2xl font-black mt-3">Mucho8s Room unavailable</h1>
          <p className="text-sm text-muted-foreground mt-2">
            This Mucho8s is no longer live or could not be found.
          </p>
          <Link
            to="/matches"
            className="mt-5 inline-flex h-10 px-4 rounded-xl bg-white text-black items-center justify-center font-bold text-sm"
          >
            Back to Match Center
          </Link>
        </section>
      </div>
    );
  }

  const teamA = Array.isArray(match.team_a) ? match.team_a : [];
  const teamB = Array.isArray(match.team_b) ? match.team_b : [];
  const bo3Maps = Array.isArray(match.maps) ? match.maps.filter(Boolean).slice(0, 3) : [];
  const captainId = String(match.captain_player_id || "");
  const isCaptain =
    Boolean(discordPlayer?.id) &&
    String(discordPlayer.id) === captainId;
  const canReport = isAdmin || isCaptain;
  const cancelRequested = Boolean(match.cancel_requested_at);
  const pairings =
    Array.isArray(match.pairings) && match.pairings.length
      ? match.pairings
      : teamA.map((playerAId, index) => ({
          playerAId,
          playerBId: teamB[index] || "",
          amount: 5,
          platform: "paypal",
        }));

  const totalStake = pairings.reduce(
    (sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0),
    0
  );

  const requestCancel = async () => {
    if (!isCaptain || busy || cancelRequested) return;
    setBusy(true);
    const ok = await requestCancelLiveMatch(match.id);
    setBusy(false);
    if (!ok) return;
    toast.success("Cancellation request sent to Admin");
  };

  const cancelAsAdmin = async () => {
    if (!isAdmin || busy) return;
    setBusy(true);
    const ok = await cancelLiveMatch(match.id);
    setBusy(false);
    if (!ok) return;
    toast.success("Mucho8s cancelled");
    navigate("/matches");
  };

  const initialCaptains = {
    A: teamA.includes(captainId) ? captainId : teamA[0] || "",
    B: teamB.includes(captainId) ? captainId : teamB[0] || "",
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div className="min-w-0">
            <Link
              to="/matches"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
            >
              <ArrowLeft size={14} /> Match Center
            </Link>

            <div className="flex flex-wrap items-center gap-2 mt-4">
              <ModeBadge mode="mucho8s" compact />
              <span className="h-7 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              <span className="m8-pill">{match.format || `${teamA.length}v${teamB.length}`}</span>
              {match.game && <span className="m8-pill">{match.game}</span>}
              {match.mode && <span className="m8-pill">{match.mode}</span>}
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em] mt-3">
              Mucho8s Room
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Timer size={14} />
                {liveDuration(match.created_at, now)}
              </span>
              <span>
                Captain · <strong className="text-white">{playerMap[captainId]?.name || "Player"}</strong>
              </span>
              <span>
                Total stake · <strong className="text-emerald-400">{euro(totalStake)}</strong>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {cancelRequested && (
              <span className="h-10 px-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] text-orange-400 inline-flex items-center gap-1.5 text-xs font-bold">
                <AlertTriangle size={14} />
                Cancel requested
              </span>
            )}

            {isCaptain && !isAdmin && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy || cancelRequested}
                onClick={() => void requestCancel()}
                className="h-10 rounded-xl border border-orange-500/20 bg-orange-500/[0.04] text-orange-400 hover:bg-orange-500/[0.08] hover:text-orange-300"
              >
                <AlertTriangle size={14} className="mr-1.5" />
                {cancelRequested ? "Requested" : "Request Cancel"}
              </Button>
            )}

            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    className="h-10 rounded-xl border border-red-500/20 bg-red-500/[0.04] text-red-400 hover:bg-red-500/[0.08] hover:text-red-300"
                  >
                    <Trash2 size={14} className="mr-1.5" />
                    Cancel Mucho8s
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this Mucho8s?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The Mucho8s will close without recording a result.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-[#181B26] border-[#2A303B]">
                      Keep Mucho8s
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void cancelAsAdmin()}
                      className="bg-red-500 hover:bg-red-400 text-white"
                    >
                      Cancel Mucho8s
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              type="button"
              disabled={!canReport || busy}
              onClick={() => setReportOpen(true)}
              className="h-10 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-bold"
            >
              <Trophy size={15} className="mr-1.5" />
              Report Result
            </Button>
          </div>
        </div>
      </section>

      {bo3Maps.length === 3 && (
        <section className="m8-panel rounded-[22px] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="brand-kicker mb-1">BO3 Map Rotation</div>
              <div className="font-display font-black text-lg">Maps generated at confirmation</div>
            </div>
            <span className="m8-pill">Best of 3</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {bo3Maps.map((mapName, index) => (
              <div key={mapName} className="rounded-xl border border-[#2A303B] bg-[#0F1218] p-3.5">
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">Map {index + 1}</div>
                <div className="font-display font-black mt-1">{mapName}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{match.mode}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cancelRequested && (
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.04] px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-orange-400 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-orange-300">Cancellation awaiting Admin</div>
            <div className="text-xs text-orange-200/60 mt-1">
              The Mucho8s stays live until an Admin approves the cancellation or a result is reported.
            </div>
          </div>
        </section>
      )}

      {trophyOpportunities.length > 0 && (
        <section className="rounded-2xl border border-[#343B48] bg-[#11151C] px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl border border-[#343B48] bg-[#151923] flex items-center justify-center shrink-0">
                <Trophy size={17} className="text-[#C8CED8]" />
              </div>
              <div>
                <div className="brand-kicker text-[#AEB6C3]">Trophy Opportunity</div>
                <div className="text-sm font-bold mt-0.5">
                  This Mucho8s can level up{" "}
                  {trophyOpportunities.length === 1
                    ? "1 challenge"
                    : trophyOpportunities.length + " challenges"}
                </div>
              </div>
            </div>

            <div className="font-mono font-black text-[#C8CED8] text-sm shrink-0">
              +{trophyOpportunities.reduce((sum, item) => sum + item.reward, 0)} Elo potential
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {trophyOpportunities.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#2C333E] bg-[#0F1218] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm">
                    {item.title} · Lv {item.level}/{MAX_TROPHY_LEVEL}
                  </span>
                  <span className="font-mono text-[9px] font-black text-[#C8CED8]">
                    +{item.reward}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
        <TeamPanel
          label="Alpha"
          ids={teamA}
          accent="#FF2A3B"
          captainId={captainId}
          playerMap={playerMap}
          playerAvatars={playerAvatars}
        />

        <div className="hidden lg:flex items-center justify-center px-2">
          <div className="w-12 h-12 rounded-full border border-[#2A303B] bg-[#0F1218] flex items-center justify-center font-display font-black text-muted-foreground">
            VS
          </div>
        </div>

        <TeamPanel
          label="Bravo"
          ids={teamB}
          accent="#D5A33A"
          captainId={captainId}
          playerMap={playerMap}
          playerAvatars={playerAvatars}
        />
      </section>

      <section className="m8-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="brand-kicker mb-1 text-magma">Mucho8s</div>
            <h2 className="font-display font-bold text-lg">Money Pairings</h2>
          </div>
          <div className="inline-flex items-center gap-1.5 text-magma font-mono font-black text-sm">
            <WalletCards size={15} />
            {euro(totalStake)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {pairings.map((pair, index) => {
            const alpha = playerMap[pair.playerAId];
            const bravo = playerMap[pair.playerBId];

            return (
              <div
                key={`${pair.playerAId}-${pair.playerBId}-${index}`}
                className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold truncate flex-1">
                    {alpha?.name || "Alpha"}
                  </span>
                  <span className="text-[#596170]">↔</span>
                  <span className="font-semibold truncate flex-1 text-right">
                    {bravo?.name || "Bravo"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>{String(pair.platform || "paypal").toUpperCase()}</span>
                  <span className="font-mono font-black text-magma">
                    {euro(pair.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {!canReport && (
        <section className="rounded-2xl border border-[#222834] bg-[#0F1218] px-4 py-3 flex items-start gap-3">
          <ShieldCheck size={16} className="text-[#697181] mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            Only the Mucho8s captain or an Admin can report the final result.
          </div>
        </section>
      )}

      <RecordMatchDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report Mucho8s Result"
        lockTeams
        lockContext
        initialTeams={{ teamA, teamB, pairings }}
        initialCaptains={initialCaptains}
        creatorPlayerId={captainId}
        liveMatchId={match.id}
        defaultGame={match.game || undefined}
        defaultMode={match.mode || undefined}
        onReported={() => {
          setReportOpen(false);
          navigate("/matches");
        }}
      />
    </div>
  );
}
