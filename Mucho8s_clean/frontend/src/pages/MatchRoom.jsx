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
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, MerdaBadge, merdaSurfaceClass } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import MapPreviewCard from "@/components/MapPreviewCard";
import LiveMatchChat from "@/components/LiveMatchChat";
import { analyzeManualTeams } from "@/lib/chemistry";
import { buildRivalries } from "@/lib/rivalries";
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
  stakeByPlayer,
}) => (
  <div className="rounded-2xl border border-[#222834] bg-[#0F1218] p-3">
    <div
      className="text-[10px] uppercase tracking-[0.18em] font-black mb-2"
      style={{ color: accent }}
    >
      {label}
    </div>

    <div className="space-y-1.5">
      {ids.map((id) => {
        const player = playerMap[id];
        const stake = Math.max(0, Number(stakeByPlayer?.[String(id)] || 0));

        return (
          <Link
            key={id}
            to={`/players/${id}`}
            className={`min-h-[44px] rounded-lg border border-[#202631] bg-[#12161D] px-2.5 py-2 flex items-center gap-2.5 hover:border-[#353D49] transition-all ${merdaSurfaceClass(player?.merdaCount)}`}
          >
            <div className={Number(player?.merdaCount || 0) >= 5 ? "merda-avatar-critical" : ""}>
              <PlayerAvatar
                name={player?.name || "Player"}
                elo={player?.currentElo || 1000}
                size={30}
                avatarUrl={playerAvatars[id]}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm flex items-center gap-2 min-w-0">
                <span className="truncate">{player?.name || "Player"}</span>
                <MerdaBadge count={player?.merdaCount} compact />
                {String(id) === String(captainId || "") && (
                  <span className="text-[9px] uppercase tracking-wider text-[#D5A33A] inline-flex items-center gap-1 shrink-0">
                    <Crown size={10} /> Captain
                  </span>
                )}
                {stake > 0 && (
                  <span className="ml-auto shrink-0 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] px-2 py-1 font-mono text-[10px] font-black text-emerald-400">
                    {euro(stake)}
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
    challenges,
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

  const liveTeamIntel = useMemo(() => {
    if (!match) return null;

    const aIds = Array.isArray(match.team_a) ? match.team_a.map(String) : [];
    const bIds = Array.isArray(match.team_b) ? match.team_b.map(String) : [];
    const teamAPlayers = aIds.map((playerId) => playerMap?.[playerId]).filter(Boolean);
    const teamBPlayers = bIds.map((playerId) => playerMap?.[playerId]).filter(Boolean);
    if (!teamAPlayers.length || teamAPlayers.length !== teamBPlayers.length) return null;

    const contextMatches = (Array.isArray(matches) ? matches : []).filter((item) => {
      if (match.game && item.game && item.game !== match.game) return false;
      if (match.mode && item.mode && item.mode !== match.mode) return false;
      return true;
    });

    const analysis = analyzeManualTeams(teamAPlayers, teamBPlayers, contextMatches);
    if (!analysis) return null;

    const setA = new Set(aIds);
    const setB = new Set(bIds);
    const rivalries = buildRivalries(contextMatches, challenges || [])
      .filter((row) =>
        (setA.has(String(row.playerAId)) && setB.has(String(row.playerBId))) ||
        (setA.has(String(row.playerBId)) && setB.has(String(row.playerAId)))
      )
      .slice(0, 6);

    return {
      ...analysis,
      rivalries,
      avgEloA: Math.round(teamAPlayers.reduce((sum, player) => sum + Number(player.currentElo || 0), 0) / teamAPlayers.length),
      avgEloB: Math.round(teamBPlayers.reduce((sum, player) => sum + Number(player.currentElo || 0), 0) / teamBPlayers.length),
    };
  }, [match, matches, challenges, playerMap]);

  const streakWatch = useMemo(() => {
    if (!match) return [];

    const alphaIds = Array.isArray(match.team_a) ? match.team_a.map(String) : [];
    const bravoIds = Array.isArray(match.team_b) ? match.team_b.map(String) : [];

    return [...alphaIds, ...bravoIds]
      .map((playerId) => {
        const player = playerMap?.[playerId];
        const streak = Number(player?.currentStreak || 0);
        const merdaCount = Math.max(0, Number(player?.merdaCount || 0));

        // Streak Watch is intentionally "critical only":
        // - MVP: the next win completes a 3-win milestone (2, 5, 8...).
        // - MERDA: the next loss triggers/stacks MERDA once the player is at 2L or worse.
        const oneWinFromMvp = streak > 0 && (streak + 1) % 3 === 0;
        const oneLossFromMerda = streak <= -2;

        if (!oneWinFromMvp && !oneLossFromMerda) return null;

        const isAlpha = alphaIds.includes(playerId);

        return {
          id: playerId,
          name: player?.name || "Player",
          streak,
          merdaCount,
          oneWinFromMvp,
          oneLossFromMerda,
          side: isAlpha ? "Alpha" : "Bravo",
          opposingSide: isAlpha ? "Bravo" : "Alpha",
          bounty: oneWinFromMvp ? 3 : 0,
          nextCount: Math.max(
            1,
            Number((oneWinFromMvp ? player?.mvpCount : player?.merdaCount) || 0) + 1
          ),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.oneWinFromMvp !== b.oneWinFromMvp) return a.oneWinFromMvp ? -1 : 1;
        return Math.abs(b.streak) - Math.abs(a.streak);
      });
  }, [match, playerMap]);

  if (!match) {
    return (
      <div className="m8-page-stack gap-3">
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
  const seriesMaps = Array.isArray(match.maps) ? match.maps.filter(Boolean).slice(0, 5) : [];
  const seriesBestOf = seriesMaps.length >= 5 ? 5 : 3;
  const captainId = String(match.captain_player_id || "");
  const isCaptain =
    Boolean(discordPlayer?.id) &&
    String(discordPlayer.id) === captainId;
  const canReport = isAdmin || isCaptain;
  const canChat =
    isAdmin ||
    (Boolean(discordPlayer?.id) &&
      [...teamA, ...teamB].map(String).includes(String(discordPlayer.id)));
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

  const stakeByPlayer = pairings.reduce((acc, pair) => {
    const amount = Math.max(0, Number(pair?.amount) || 0);
    const alphaId = String(pair?.playerAId || "");
    const bravoId = String(pair?.playerBId || "");
    if (alphaId) acc[alphaId] = Math.max(0, Number(acc[alphaId] || 0)) + amount;
    if (bravoId) acc[bravoId] = Math.max(0, Number(acc[bravoId] || 0)) + amount;
    return acc;
  }, {});

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
    <div className="m8-page-stack gap-3">
      <section className="m8-panel m8-mode-zone is-mucho8s rounded-[22px] p-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/matches"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"
            >
              <ArrowLeft size={14} /> Match Center
            </Link>

            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              <ModeBadge mode="mucho8s" compact />
              <span className="h-7 px-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Timer size={12} />
                Live · {liveDuration(match.created_at, now)}
              </span>
              <span className="m8-pill">{match.format || `${teamA.length}v${teamB.length}`}</span>
              {match.game && <span className="m8-pill">{match.game}</span>}
              {match.mode && <span className="m8-pill">{match.mode}</span>}
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.04em] mt-2">
              Mucho8s Room
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
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

      {[3, 5].includes(seriesMaps.length) && (
        <section className="m8-panel rounded-[22px] p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div>
              <div className="brand-kicker mb-1">BO{seriesBestOf} Map Rotation</div>
              <div className="font-display font-black text-sm">Maps generated at confirmation</div>
            </div>
            <span className="m8-pill">Best of {seriesBestOf}</span>
          </div>
          <div className={seriesBestOf === 5 ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2" : "grid grid-cols-1 sm:grid-cols-3 gap-2"}>
            {seriesMaps.map((mapName, index) => (
              <MapPreviewCard
                key={mapName + "-" + index}
                mapName={mapName}
                game={match.game}
                mode={match.mode}
                index={index}
                compact
              />
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

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
        <TeamPanel
          label="Alpha"
          ids={teamA}
          accent="#FF2A3B"
          captainId={captainId}
          playerMap={playerMap}
          playerAvatars={playerAvatars}
          stakeByPlayer={stakeByPlayer}
        />

        <div className="hidden lg:flex items-center justify-center px-2">
          <div className="w-10 h-10 rounded-full border border-[#2A303B] bg-[#0F1218] flex items-center justify-center font-display font-black text-xs text-muted-foreground">
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
          stakeByPlayer={stakeByPlayer}
        />
      </section>

      <section className="rounded-xl border border-[#343B48] bg-[#11151C] px-3 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="brand-kicker text-[#AEB6C3]">Streak Watch</div>
            <span className="hidden sm:inline text-[9px] uppercase tracking-widest text-[#697181]">
              MVP & MERDA pressure
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1 lg:justify-end">
            {streakWatch.length === 0 ? (
              <span className="h-7 px-2.5 rounded-lg border border-[#222834] bg-[#0D1117] inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#697181]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#596170]" />
                No pressure detected
              </span>
            ) : (
              streakWatch.map((item) => (
                <div
                  key={item.id}
                  className={`min-h-7 rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-[10px] ${
                    item.oneWinFromMvp
                      ? "border-[#D5A33A]/35 bg-[#D5A33A]/[0.055]"
                      : "border-[#8B5E3C]/35 bg-[#8B5E3C]/[0.055]"
                  }`}
                >
                  <span className="font-display font-black">{item.name}</span>
                  <span className={item.oneWinFromMvp ? "text-[#D5A33A] font-black" : "text-[#C79A6B] font-black"}>
                    {item.oneWinFromMvp
                      ? `🏆 1 WIN FROM MVP #${item.nextCount}`
                      : `💩 1 LOSS FROM MERDA #${item.nextCount}`}
                  </span>
                  <span className="font-mono font-black text-[#AEB6C3]">
                    {item.streak > 0 ? `+${item.streak}W` : `${Math.abs(item.streak)}L`}
                  </span>
                  {item.bounty > 0 && (
                    <span className="text-magma font-black whitespace-nowrap">
                      Stop → {item.opposingSide} +{item.bounty} Elo
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {liveTeamIntel && (
        <details className="rounded-2xl border border-[#222834] bg-[#0B0F15] overflow-hidden group">
          <summary className="list-none cursor-pointer px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.025] transition-colors">
            <div>
              <div className="brand-kicker mb-1">Match Intel · Advanced</div>
              <div className="font-display font-black">Chemistry, balance & rivalry data</div>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-[#697181]">
              Open analysis ⌄
            </span>
          </summary>

          <div className="border-t border-[#1D222C] p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
              {[
                ["Quality", String(liveTeamIntel.lobbyQuality) + "%"],
                ["Balance", String(liveTeamIntel.balanceScore) + "%"],
                ["Chemistry", String(liveTeamIntel.chemistryScore) + "%"],
                ["Freshness", String(liveTeamIntel.freshnessScore) + "%"],
                ["Alpha Elo", liveTeamIntel.avgEloA],
                ["Bravo Elo", liveTeamIntel.avgEloB],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-[#697181]">{label}</div>
                  <div className="font-mono font-black mt-1">{value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {[
                ["Alpha", liveTeamIntel.chemistryA, "text-magma"],
                ["Bravo", liveTeamIntel.chemistryB, "text-[#65D5D3]"],
              ].map(([label, chemistry, tone]) => (
                <div key={label} className="rounded-xl border border-[#222834] bg-[#0F1218] p-3.5">
                  <div className={"text-[10px] uppercase tracking-widest font-black mb-2 " + tone}>
                    {label} duo chemistry
                  </div>
                  <div className="space-y-2">
                    {(chemistry?.pairs || []).slice(0, 4).map((pair) => (
                      <div key={label + pair.a.id + pair.b.id} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate">{pair.a.name} + {pair.b.name}</span>
                        <span className="text-muted-foreground text-[10px]">{pair.matchesTogether} matches</span>
                        <strong className="font-mono">{pair.score}%</strong>
                      </div>
                    ))}
                    {!chemistry?.pairs?.length && (
                      <div className="text-xs text-muted-foreground">No duo history yet.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-[#2A2520] bg-[#120F0D] p-3.5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-[#8E7662]">Rivalry Heat</div>
                  <div className="font-display font-black text-sm">Best cross-team storylines</div>
                </div>
                <span className="text-[10px] text-muted-foreground">{liveTeamIntel.rivalries.length} active</span>
              </div>
              {liveTeamIntel.rivalries.length ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {liveTeamIntel.rivalries.map((row) => (
                    <div key={row.key} className="rounded-lg border border-[#2B251F] bg-black/10 px-3 py-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold truncate">
                          {playerMap[row.playerAId]?.name || "Player"} vs {playerMap[row.playerBId]?.name || "Player"}
                        </span>
                        <span className="font-mono font-black text-[#D5A33A]">{row.meetings}x</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        H2H {row.playerAWins}-{row.playerBWins}
                        {row.currentStreak > 1 ? " · streak " + row.currentStreak : ""}
                        {row.moneyVolume > 0 ? " · €" + Number(row.moneyVolume).toFixed(0) + " volume" : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No rivalry history between these teams yet.</div>
              )}
            </div>
          </div>
        </details>
      )}

      {!canReport && (
        <section className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5 flex items-start gap-3">
          <ShieldCheck size={16} className="text-[#697181] mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground">
            Only the Mucho8s captain or an Admin can report the final result.
          </div>
        </section>
      )}

      <section>
        {canChat ? (
          <LiveMatchChat liveMatchId={match.id} />
        ) : (
          <div className="m8-panel rounded-xl px-3 py-2.5 flex items-center gap-2 min-h-11">
            <ShieldCheck size={15} className="text-[#394150] shrink-0" />
            <div className="font-display font-black text-xs">PRIVATE MATCH CHAT</div>
            <div className="text-[10px] text-muted-foreground">
              Available only to lobby players and Admin.
            </div>
          </div>
        )}
      </section>

      <RecordMatchDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title="Report Mucho8s Result"
        lockTeams
        lockContext
        initialTeams={{ teamA, teamB, pairings, maps: seriesMaps }}
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
