import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Shield, Swords, Trophy, UsersRound, Clock3, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import {
  fetchTourney,
  requestTourneyEntryPayment,
  requestTourneyPayment,
  subscribeTourney,
} from "@/lib/tourneyLive";
import SwitcherooWheel from "@/components/SwitcherooWheel";
import SwitcherooDrawOverlay from "@/components/SwitcherooDrawOverlay";
import TournamentTeamRosterModal from "@/components/TournamentTeamRosterModal";

const STORE = "mucho8s-tourney-admin-v1";

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "null");
  } catch {
    return null;
  }
};

const formatClock = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

export default function TourneyLive() {
  const { discordSession, discordPlayer } = useData();
  const [t, setT] = useState(read);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [entryBusy, setEntryBusy] = useState(false);
  const [replayOpen, setReplayOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [joinConfirmOpen, setJoinConfirmOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchTourney().then((remote) => {
      if (alive && remote) setT(remote);
    });
    const off = subscribeTourney((remote) => {
      if (remote) setT(remote);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    if (t?.status !== "review") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [t?.status]);

  const rounds = useMemo(() => t?.bracket || [], [t]);
  const reviewRemaining = Math.max(
    0,
    new Date(t?.switcheroo?.reviewEndsAt || 0).getTime() - now
  );
  const goal = Math.max(1, Number(t?.switcheroo?.rerollGoal || 1));
  const total = Math.max(0, Number(t?.switcheroo?.contributedTotal || 0));
  const progress = Math.min(100, Math.round((total / goal) * 100));
  const rerollsUsed = Number(t?.switcheroo?.rerollsUsed || 0);
  const rerollStep = Math.max(5, Number(t?.switcheroo?.rerollStep || 10));
  const rerollStepGrowth = Math.max(5, Number(t?.switcheroo?.rerollStepGrowth || 5));

  const participantIds = useMemo(
    () =>
      new Set(
        (t?.switcheroo?.pool || [])
          .map((player) => String(player?.id || ""))
          .filter(Boolean)
      ),
    [t?.switcheroo?.pool]
  );

  const entryPaidIds = useMemo(
    () =>
      new Set(
        (t?.switcheroo?.entryPaid || [])
          .map((row) => String(row?.playerId || ""))
          .filter(Boolean)
      ),
    [t?.switcheroo?.entryPaid]
  );

  const entryPendingIds = useMemo(
    () =>
      new Set(
        (t?.switcheroo?.entryPendingPayments || [])
          .map((row) => String(row?.playerId || ""))
          .filter(Boolean)
      ),
    [t?.switcheroo?.entryPendingPayments]
  );

  const currentPlayerId = String(discordPlayer?.id || "");
  const isTournamentPlayer = participantIds.has(currentPlayerId);
  const entryPaid = entryPaidIds.has(currentPlayerId);
  const entryPending = entryPendingIds.has(currentPlayerId);
  const entryFee = Math.max(1, Number(t?.switcheroo?.entryFee || 5));
  const openRegistration = t?.switcheroo?.registrationMode === "open";
  const maxTeams = Math.min(8, Math.max(2, Number(t?.switcheroo?.maxTeams || 4)));
  const rosterSize = Math.max(
    1,
    Number(String(t?.format || "4v4").split("v")[0]) || 4
  );
  const maxPlayers = maxTeams * rosterSize;

  const canContribute =
    Boolean(discordSession?.access_token && discordPlayer?.id) &&
    participantIds.has(String(discordPlayer?.id || "")) &&
    t?.status === "review" &&
    reviewRemaining > 0;

  useEffect(() => {
    if (t?.status !== "review" || reviewRemaining > 0) return;
    fetchTourney().then((remote) => {
      if (remote) setT(remote);
    });
  }, [reviewRemaining, t?.status]);

  const payEntry = async () => {
    if (entryBusy) return;
    if (!discordSession?.access_token) {
      toast.error("Connect Discord to pay the tournament entry");
      return;
    }
    if (!isTournamentPlayer && !openRegistration) {
      toast.error("You are not in this tournament pool");
      return;
    }

    setEntryBusy(true);
    try {
      const data = await requestTourneyEntryPayment(discordSession.access_token);
      if (data?.tourney) setT(data.tourney);
      if (data?.paymentUrl) {
        window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
      }
      toast.success(
        `Pay €${data?.amount || entryFee} on PayPal · entry activates after Admin confirmation`
      );
    } catch (error) {
      toast.error(error?.message || "Unable to open tournament entry payment");
    } finally {
      setEntryBusy(false);
    }
  };

  const contribute = async (amount) => {
    if (!canContribute || busy) {
      if (!discordSession?.access_token) toast.error("Connect Discord to contribute");
      else if (!participantIds.has(String(discordPlayer?.id || ""))) {
        toast.error("Only tournament players can contribute to this Switcheroo");
      }
      return;
    }

    setBusy(true);
    try {
      const data = await requestTourneyPayment(amount, discordSession.access_token);
      if (data?.tourney) setT(data.tourney);

      if (data?.paymentUrl) {
        window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
      }

      toast.success(
        `Pay €${data?.amount || amount} on PayPal · the bar updates after Admin confirms receipt`
      );
    } catch (error) {
      toast.error(error?.message || "Unable to open PayPal payment");
    } finally {
      setBusy(false);
    }
  };

  if (
    t?.status === "setup" &&
    t?.teamBuild === "switcheroo" &&
    t?.switcheroo?.setupStage === "published" &&
    ((t?.switcheroo?.pool || []).length > 0 || t?.switcheroo?.registrationMode === "open")
  ) {
    const pool = t.switcheroo.pool || [];
    const paidCount = pool.filter((player) => entryPaidIds.has(String(player.id))).length;
    const totalPot = entryFee * pool.length;
    const registrationFull = openRegistration && pool.length >= maxPlayers;
    const liveDraw = t.switcheroo?.liveDraw || null;
    const drawing = t.switcheroo?.phase === "drawing";
    const drawTeams = drawing ? liveDraw?.teams || [] : [];
    const remainingPlayers = drawing && Array.isArray(liveDraw?.remaining)
      ? liveDraw.remaining
      : pool;
    const drawIndex = Number(liveDraw?.drawIndex || 0);
    const spinSignal = Number(liveDraw?.spinSignal || 0);
    const assigned = Math.max(0, pool.length - remainingPlayers.length);

    return (
      <div className="min-h-[calc(100vh-88px)] -mx-2 sm:-mx-4 lg:-mx-6 bg-[#03050A]">
        <section className="min-h-[calc(100vh-88px)] relative overflow-hidden border-y border-[#FF4FA3]/15">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-72 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-[#FF4FA3]/[0.06] blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.025),transparent_62%)]" />
          </div>

          <div className="relative z-10 max-w-[1500px] mx-auto px-5 sm:px-7 py-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
              <div>
                <div className="text-[#FF4FA3] text-[10px] font-black tracking-[.2em] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FF4FA3] animate-pulse" />
                  {drawing ? "SWITCHEROO LIVE DRAW" : "SWITCHEROO TOURNAMENT ONLINE"}
                </div>
                <h1 className="font-display text-3xl sm:text-5xl font-black tracking-[-.04em] mt-2">
                  {t.name}
                </h1>
                <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-black text-[#AAB1BE]">
                  <span className="m8-pill">{t.game}</span>
                  <span className="m8-pill">{t.format}</span>
                  <span className="m8-pill">{t.mode}</span>
                  <span className="m8-pill">ENTRY €{entryFee}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="rounded-xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.05] px-3 py-2 text-right">
                  <div className="text-[8px] tracking-widest text-[#697181]">ENTRY POT</div>
                  <div className="font-mono text-lg font-black text-[#FF9DCE]">€{totalPot}</div>
                </div>
                <div className="rounded-xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.05] px-3 py-2 text-right">
                  <div className="text-[8px] tracking-widest text-[#697181]">START RE-SPIN</div>
                  <div className="font-mono text-lg font-black text-[#FF9DCE]">
                    €{Number(t.switcheroo?.rerollBaseGoal || t.switcheroo?.rerollGoal || 0)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid xl:grid-cols-[minmax(540px,1.08fr)_minmax(440px,.92fr)] gap-7 xl:gap-10 items-center">
              <div className="flex items-center justify-center min-h-[590px]">
                <SwitcherooWheel
                  players={remainingPlayers}
                  disabled
                  label={drawing ? "LIVE" : "SPIN"}
                  hint={
                    drawing
                      ? `Live draw · ${assigned}/${pool.length} players assigned`
                      : openRegistration
                        ? `Open registration · ${pool.length}/${maxPlayers} players joined`
                        : paidCount === pool.length
                          ? "All entry fees confirmed · waiting for Admin to start the live draw"
                          : "Tournament is online · entry payments are open"
                  }
                  spinSignal={drawing ? spinSignal : 0}
                  sizeClass="w-[82vw] h-[82vw] max-w-[580px] max-h-[580px] min-w-[310px] min-h-[310px]"
                />
              </div>

              <div className="space-y-3">
                {drawing ? (
                  <>
                    <div className="rounded-[22px] border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.05] p-5">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[9px] tracking-[.18em] text-[#FF4FA3] font-black">
                            LIVE TEAM DRAW
                          </div>
                          <div className="font-display text-2xl font-black mt-1">
                            Building the teams
                          </div>
                        </div>
                        <div className="text-right">
                        <div className="font-mono text-sm font-black text-[#FF9DCE]">
                          {assigned}/{pool.length}
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {liveDraw?.spinning ? "WHEEL SPINNING…" : "PLAYERS ASSIGNED"}
                        </div>
                      </div>
                      </div>

                      {liveDraw?.lastPlayer && (
                        <div className="mt-4 rounded-xl border border-[#FF4FA3]/25 bg-[#111720] px-4 py-3">
                          <div className="text-[9px] tracking-widest text-[#697181]">LAST PLAYER</div>
                          <div className="font-display text-xl font-black mt-1">
                            {liveDraw.lastPlayer.name}
                            <span className="text-[#FF4FA3]">
                              {" "}→ {drawTeams[liveDraw.targetTeamIndex]?.name || "Team"}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      {drawTeams.map((team, index) => (
                        <div
                          key={team.id || index}
                          className="rounded-xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.035] p-3 min-h-[125px]"
                        >
                          <div className="text-xs font-black">
                            <span className="text-[#FF4FA3] mr-2">#{index + 1}</span>
                            {team.name}
                          </div>
                          <div className="mt-2 space-y-1">
                            {(team.roster || []).map((player) => (
                              <div
                                key={player.id}
                                className="h-8 rounded-lg border border-[#252B36] bg-[#111720] px-2.5 flex items-center text-[11px] font-semibold"
                              >
                                {player.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[22px] border border-[#FF4FA3]/20 bg-[#0D1219] p-5">
                    <div className="brand-kicker text-[#FF4FA3]">Tournament Entry</div>
                    <h2 className="font-display text-2xl font-black mt-1">
                      {entryPaid
                        ? "Entry confirmed"
                        : entryPending
                          ? "Payment waiting for confirmation"
                          : isTournamentPlayer
                            ? `Pay €${entryFee} to enter`
                            : openRegistration
                              ? "Join MuchoTourney"
                              : "Switcheroo is online"}
                    </h2>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="rounded-xl border border-[#FF4FA3]/15 bg-[#FF4FA3]/[0.035] p-3">
                        <div className="text-[8px] tracking-widest text-[#697181]">
                          {openRegistration ? "REGISTERED" : "CONFIRMED"}
                        </div>
                        <div className="font-mono text-xl font-black text-[#FF9DCE] mt-1">
                          {openRegistration ? `${pool.length}/${maxPlayers}` : `${paidCount}/${pool.length}`}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#FF4FA3]/15 bg-[#FF4FA3]/[0.035] p-3">
                        <div className="text-[8px] tracking-widest text-[#697181]">FORMAT</div>
                        <div className="font-mono text-xl font-black text-[#FF9DCE] mt-1">
                          {t.format}
                        </div>
                      </div>
                    </div>

                    {(isTournamentPlayer || openRegistration) && !entryPaid && !entryPending && (
                      <div className="mt-4">
                        {!joinConfirmOpen ? (
                          <button
                            type="button"
                            disabled={entryBusy || registrationFull}
                            onClick={() => setJoinConfirmOpen(true)}
                            className="w-full h-12 rounded-xl bg-[#FF4FA3] hover:bg-[#FF69B4] text-black font-black disabled:opacity-40"
                          >
                            {registrationFull
                              ? "REGISTRATION FULL"
                              : openRegistration && !isTournamentPlayer
                                ? "JOIN TOURNAMENT"
                                : "CONFIRM ENTRY"}
                          </button>
                        ) : (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.05] p-4"
                          >
                            <div className="text-[9px] tracking-[.16em] text-[#FF4FA3] font-black">
                              CONFIRM REGISTRATION
                            </div>
                            <div className="text-sm font-black mt-1">
                              Entry fee €{entryFee}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              Confirm to register and open PayPal. Your place becomes active after the Admin verifies the payment.
                            </p>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                              <button
                                type="button"
                                onClick={() => setJoinConfirmOpen(false)}
                                className="h-10 rounded-lg border border-[#2A303B] bg-[#111720] text-xs font-black"
                              >
                                BACK
                              </button>
                              <button
                                type="button"
                                disabled={entryBusy}
                                onClick={() => {
                                  setJoinConfirmOpen(false);
                                  payEntry();
                                }}
                                className="h-10 rounded-lg bg-[#FF4FA3] text-black text-xs font-black disabled:opacity-40"
                              >
                                CONFIRM & PAY
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {entryPending && (
                      <div className="mt-4 rounded-xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.05] px-4 py-3 text-sm text-[#FFB7D9]">
                        Payment opened. Waiting for Admin confirmation.
                      </div>
                    )}

                    {entryPaid && (
                      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3 text-sm text-emerald-400 font-bold">
                        Entry confirmed · you are in the tournament.
                      </div>
                    )}

                    {!isTournamentPlayer && !openRegistration && (
                      <p className="text-sm text-muted-foreground mt-4">
                        The tournament is public. Only selected players can pay the entry fee.
                      </p>
                    )}

                    {!isTournamentPlayer && openRegistration && (
                      <p className="text-sm text-muted-foreground mt-4">
                        Registration is open. Confirm your place above and PayPal will open for the entry fee.
                      </p>
                    )}

                    <div className="grid sm:grid-cols-2 gap-1.5 mt-5 max-h-[260px] overflow-y-auto pr-1">
                      {pool.map((player) => {
                        const paid = entryPaidIds.has(String(player.id));
                        const pending = entryPendingIds.has(String(player.id));
                        return (
                          <div
                            key={player.id}
                            className={
                              "h-10 rounded-lg border px-3 flex items-center justify-between gap-2 " +
                              (paid
                                ? "border-emerald-500/20 bg-emerald-500/[0.04]"
                                : "border-[#FF4FA3]/15 bg-[#FF4FA3]/[0.025]")
                            }
                          >
                            <span className="text-xs font-black truncate">{player.name}</span>
                            <span className={"font-mono text-[9px] " + (paid ? "text-emerald-400" : "text-[#FF8BC5]")}>
                              {paid ? "PAID" : pending ? "PENDING" : `€${entryFee} DUE`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!t || !["review", "ready", "live", "completed"].includes(t.status)) {
    return (
      <section className="m8-panel rounded-[22px] min-h-[420px] flex flex-col items-center justify-center text-center p-8">
        <Trophy size={38} className="text-[#D5A33A] opacity-60" />
        <h1 className="font-display text-3xl font-black mt-4">MuchoTourney</h1>
        <p className="text-sm text-muted-foreground mt-2">No tournament is live right now.</p>
      </section>
    );
  }

  if (t.status === "review" || t.status === "ready") {
    return (
      <div className="m8-page-stack gap-3 max-w-7xl mx-auto">
      <TournamentTeamRosterModal
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        switcheroo={t.teamBuild === "switcheroo"}
      />
        {replayOpen && t?.teamBuild === "switcheroo" && (
          <SwitcherooDrawOverlay
            open
            players={t.switcheroo?.pool || []}
            format={t.format}
            generation={Number(t.switcheroo?.generation || 1)}
            presetTeams={t.teams || []}
            title="SWITCHEROO REPLAY"
            onClose={() => setReplayOpen(false)}
            onComplete={() => setReplayOpen(false)}
          />
        )}

        <section className="rounded-[22px] border border-[#FF4FA3]/25 bg-gradient-to-r from-[#1A0C15] to-[#0C1119] p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#FF4FA3] text-[10px] font-black tracking-[.18em]">
                <span className="w-2 h-2 rounded-full bg-[#FF4FA3] animate-pulse" />
                {t.status === "review" ? "SWITCHEROO REVIEW" : "TEAMS LOCKED"}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-black mt-2">{t.name}</h1>
              <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-bold text-[#AAB1BE]">
                <span className="m8-pill">{t.game}</span>
                <span className="m8-pill">{t.format}</span>
                <span className="m8-pill">{t.mode}</span>
                <span className="m8-pill">GEN {t.switcheroo?.generation || 1}</span>
              </div>
            </div>

            {t.status === "review" ? (
              <div className="h-12 px-4 rounded-xl border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.06] flex items-center gap-2">
                <Clock3 size={17} className={reviewRemaining <= 30000 ? "text-magma" : "text-[#FF4FA3]"} />
                <span className={"font-mono text-lg font-black " + (reviewRemaining <= 30000 ? "text-magma" : "")}>
                  {formatClock(reviewRemaining)}
                </span>
              </div>
            ) : (
              <div className="h-12 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 flex items-center gap-2 text-xs font-black">
                <Shield size={16} />
                LOCKED
              </div>
            )}
          </div>
        </section>

        {t?.teamBuild === "switcheroo" && (
          <section className="m8-panel rounded-[22px] p-5 sm:p-7 min-h-[640px] flex items-center">
            <div className="grid xl:grid-cols-[620px_1fr] gap-7 items-center w-full">
              <SwitcherooWheel
                players={t.switcheroo?.pool || []}
                label="SPIN"
                hint={
                  t.status === "review"
                    ? "Click the wheel to replay the Switcheroo animation"
                    : "Teams are locked · wheel remains available as the tournament element"
                }
                sizeClass="w-[82vw] h-[82vw] max-w-[560px] max-h-[560px] min-w-[300px] min-h-[300px]"
                onActivate={() => setReplayOpen(true)}
              />
              <div>
                <div className="brand-kicker text-[#FF4FA3]">Switcheroo wheel</div>
                <h2 className="font-display text-2xl font-black mt-1">
                  Switcheroo live
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  The draw is complete, but teams are still provisional during the review timer.
                  If the re-spin goal is reached, Switcheroo starts again. When the timer reaches zero,
                  the bracket is generated automatically and this wheel disappears from the public tournament page.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 text-[10px] font-black">
                  <span className="m8-pill">Generation {t.switcheroo?.generation || 1}</span>
                  <span className="m8-pill">Re-spins {rerollsUsed}</span>
                  <span className="m8-pill">
                    Current target €{Number(t.switcheroo?.rerollGoal || 0)}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {t.status === "review" && (
          <section className="m8-panel rounded-[22px] p-5 sm:p-6">
            <div className="grid lg:grid-cols-[1fr_280px] gap-5">
              <div>
                <div className="brand-kicker text-[#FF4FA3]">Re-roll fund</div>
                <div className="flex items-end justify-between gap-3 mt-1">
                  <div className="font-mono text-3xl font-black">
                    €{total.toFixed(0)}
                    <span className="text-base text-muted-foreground"> / €{goal.toFixed(0)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-right">
                    <span className="block">Re-spins completed: {rerollsUsed}</span>
                    <span className="block text-[#FF4FA3] mt-0.5">
                      Next target: €{goal + rerollStep}
                    </span>
                  </span>
                </div>

                <div className="h-4 rounded-full bg-[#0B0F15] border border-[#252B36] overflow-hidden mt-3">
                  <div
                    className="h-full bg-[#FF4FA3] transition-[width] duration-500"
                    style={{ width: progress + "%" }}
                  />
                </div>

                <div className="text-[11px] text-muted-foreground mt-2">
                  If the goal is reached before the timer ends, all teams are drawn again. The next target is €{goal + rerollStep}, and the following re-spin margin grows again to €{rerollStep + rerollStepGrowth}.
                </div>

                {(t.switcheroo?.contributions || []).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {(t.switcheroo.contributions || [])
                      .slice(-8)
                      .reverse()
                      .map((row) => (
                        <span
                          key={row.id || row.at}
                          className="h-7 px-2 rounded-lg border border-[#2A303B] bg-[#111720] text-[10px] inline-flex items-center gap-1.5"
                        >
                          <strong>{row.name || "Player"}</strong>
                          <span className="text-[#FF4FA3]">+€{row.amount}</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#252B36] bg-[#10151D] p-3">
                <div className="text-[9px] uppercase tracking-[.16em] text-[#697181]">CONTRIBUTE</div>

                {canContribute ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {[1, 2, 5].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          disabled={busy}
                          onClick={() => contribute(amount)}
                          className="h-10 rounded-lg border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.06] text-[#FF8BC5] font-black hover:bg-[#FF4FA3]/[0.13] disabled:opacity-40"
                        >
                          +€{amount}
                        </button>
                      ))}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-2 leading-4">
                      PayPal opens in a new tab. The payment counts only if the tournament Admin confirms it before the review timer reaches zero.
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-muted-foreground mt-3 leading-5">
                    {!discordSession?.access_token
                      ? "Connect Discord to contribute."
                      : !participantIds.has(String(discordPlayer?.id || ""))
                        ? "Only players in this tournament can contribute."
                        : "Contributions are closed."}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="m8-panel rounded-[22px] p-5">
          <div className="flex items-center gap-2">
            <Shuffle size={17} className="text-[#FF4FA3]" />
            <div>
              <div className="brand-kicker text-[#FF4FA3]">
                Switcheroo generation {t.switcheroo?.generation || 1}
              </div>
              <h2 className="font-display font-black text-xl">Provisional Teams</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(t.teams || []).map((team, index) => (
              <div key={team.id} className="rounded-xl border border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.045] p-3">
                <div className="text-xs font-black">
                  <span className="text-[#FF4FA3] mr-2">#{index + 1}</span>
                  {team.name}
                </div>
                <div className="mt-2 space-y-1.5">
                  {(team.roster || []).map((player) => (
                    <div
                      key={player.id}
                      className="h-9 rounded-lg border border-[#202631] bg-[#0D1219] px-2.5 flex items-center text-[11px] font-semibold"
                    >
                      {player.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="m8-page-stack gap-3 max-w-7xl mx-auto">
      <TournamentTeamRosterModal
        team={selectedTeam}
        onClose={() => setSelectedTeam(null)}
        switcheroo={t.teamBuild === "switcheroo"}
      />

      {replayOpen && t?.teamBuild === "switcheroo" && (
        <SwitcherooDrawOverlay
          open
          players={t.switcheroo?.pool || []}
          format={t.format}
          generation={Number(t.switcheroo?.generation || 1)}
          presetTeams={t.teams || []}
          title="SWITCHEROO REPLAY"
          onClose={() => setReplayOpen(false)}
          onComplete={() => setReplayOpen(false)}
        />
      )}

      <section
        className={
          "rounded-[22px] border p-5 sm:p-7 " +
          (t.teamBuild === "switcheroo"
            ? "border-[#FF4FA3]/25 bg-gradient-to-r from-[#1A0C15] to-[#0C1119]"
            : "border-[#D5A33A]/25 bg-gradient-to-r from-[#15130c] to-[#0c1119]")
        }
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className={
                "flex items-center gap-2 text-[10px] font-black tracking-[.18em] " +
                (t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]")
              }
            >
              <span
                className={
                  "w-2 h-2 rounded-full animate-pulse " +
                  (t.teamBuild === "switcheroo" ? "bg-[#FF4FA3]" : "bg-[#D5A33A]")
                }
              />
              LIVE TOURNAMENT
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-black mt-2">{t.name}</h1>
            <div className="flex flex-wrap gap-2 mt-3 text-[10px] font-bold text-[#AAB1BE]">
              <span className="m8-pill">{t.game}</span>
              <span className="m8-pill">{t.format}</span>
              <span className="m8-pill">{t.mode}</span>
              <span className="m8-pill">BO{t.bestOf}</span>
            </div>
          </div>
          <Trophy
            size={42}
            className={t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]"}
          />
        </div>
      </section>

      <section className={t.teamBuild === "switcheroo" ? "grid grid-cols-1 gap-3" : "grid lg:grid-cols-[1fr_300px] gap-3"}>
        <div className="m8-panel rounded-[22px] p-5 overflow-x-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className={"brand-kicker " + (t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]")}>Live progression</div>
              <h2 className="font-display text-xl font-black">Bracket</h2>
            </div>
            {t.champion && (
              <div className="text-right">
                <div className={"text-[9px] " + (t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]")}>CHAMPION</div>
                <div className="font-black">{t.champion.name}</div>
              </div>
            )}
          </div>

          <div className="flex gap-6 min-w-[760px] mt-5">
            {rounds.map((round, roundIndex) => (
              <div key={roundIndex} className="flex-1 min-w-[220px]">
                <div className="text-[10px] tracking-[.16em] text-[#D5A33A] font-black mb-3">
                  {roundIndex === rounds.length - 1
                    ? "FINAL"
                    : roundIndex === rounds.length - 2
                      ? "SEMIFINALS"
                      : "QUARTERFINALS"}
                </div>
                <div className="flex flex-col justify-around h-[430px]">
                  {round.map((match) => (
                    <div key={match.id} className="rounded-xl border border-[#252B36] bg-[#0F141C] overflow-hidden">
                      {[
                        ["a", match.a],
                        ["b", match.b],
                      ].map(([side, team]) => (
                        <button
                          key={side}
                          type="button"
                          disabled={!team}
                          onClick={() => team && setSelectedTeam(team)}
                          className={
                            `w-full h-11 px-3 border-b border-[#202631] flex items-center gap-2 text-left transition-colors disabled:cursor-default ${match.winner === side
                              ? t.teamBuild === "switcheroo"
                                ? "bg-[#FF4FA3]/10 text-[#FFB7D9]"
                                : "bg-[#D5A33A]/10 text-[#F4CE70]"
                              : match.winner
                                ? "opacity-45"
                                : team
                                  ? t.teamBuild === "switcheroo"
                                    ? "hover:bg-[#FF4FA3]/[0.06]"
                                    : "hover:bg-white/[.04]"
                                  : ""}`
                          }
                          title={team ? `View ${team.name} roster` : "TBD"}
                        >
                          <span className="flex-1 text-xs font-black truncate">{team?.name || "TBD"}</span>
                          {team && (
                            <UsersRound
                              size={12}
                              className={t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]"}
                            />
                          )}
                          {match.winner && (
                            <span
                              className={
                                `font-mono text-base font-black ${match.winner === side
                                  ? t.teamBuild === "switcheroo"
                                    ? "text-[#FFB7D9]"
                                    : "text-[#F4CE70]"
                                  : "text-[#697181]"}`
                              }
                            >
                              {side === "a" ? match.scoreA : match.scoreB}
                            </span>
                          )}
                          {match.winner === side && <Crown size={13} />}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {t.teamBuild !== "switcheroo" && (
        <aside className="space-y-3">
          <div className="m8-panel rounded-[22px] p-4">
            <div className="flex items-center gap-2">
              <UsersRound size={16} />
              <h2 className="font-display font-black">Teams</h2>
            </div>
            <div className="mt-3 space-y-2">
              {(t.teams || []).map((team, index) => (
                <div
                  key={team.id}
                  className={
                    "rounded-xl border p-3 " +
                    (t.teamBuild === "switcheroo"
                      ? "border-[#FF4FA3]/25 bg-[#FF4FA3]/[0.045]"
                      : "border-[#252B36] bg-[#10151D]")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className={"font-mono text-[10px] " + (t.teamBuild === "switcheroo" ? "text-[#FF4FA3]" : "text-[#D5A33A]")}>#{index + 1}</span>
                    <span className="font-black text-xs truncate">{team.name}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {(team.roster || []).map((player) => player.name).join(" · ") || "Roster TBD"}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="m8-panel rounded-[22px] p-4">
            <div className="flex items-center gap-2">
              <Swords size={16} />
              <h2 className="font-display font-black">Format</h2>
            </div>
            <div className="text-xs text-muted-foreground mt-3 leading-6">
              {t.format} · {t.mode}<br />
              Main rounds BO{t.bestOf}<br />
              Final BO{t.finalBestOf}
            </div>
          </div>
        </aside>
        )}
      </section>

      {t.champion && (
        <section className="rounded-[22px] border border-[#D5A33A]/30 bg-[#D5A33A]/[.06] p-7 text-center">
          <Crown size={34} className="text-[#D5A33A] mx-auto" />
          <div className="brand-kicker text-[#D5A33A] mt-3">MuchoTourney Champion</div>
          <div className="font-display text-3xl font-black mt-1">{t.champion.name}</div>
        </section>
      )}
    </div>
  );
}
