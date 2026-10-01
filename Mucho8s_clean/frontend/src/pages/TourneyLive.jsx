import React, { useEffect, useMemo, useState } from "react";
import { Crown, Shield, Swords, Trophy, UsersRound, Clock3, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { fetchTourney, requestTourneyPayment, subscribeTourney } from "@/lib/tourneyLive";
import SwitcherooWheel from "@/components/SwitcherooWheel";

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
  const rerollStep = Math.max(1, Number(t?.switcheroo?.rerollStep || 10));

  const participantIds = useMemo(
    () =>
      new Set(
        (t?.switcheroo?.pool || [])
          .map((player) => String(player?.id || ""))
          .filter(Boolean)
      ),
    [t?.switcheroo?.pool]
  );

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
        <section className="rounded-[22px] border border-[#D5A33A]/25 bg-gradient-to-r from-[#15130c] to-[#0c1119] p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#D5A33A] text-[10px] font-black tracking-[.18em]">
                <span className="w-2 h-2 rounded-full bg-[#D5A33A] animate-pulse" />
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
              <div className="h-12 px-4 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] flex items-center gap-2">
                <Clock3 size={17} className={reviewRemaining <= 30000 ? "text-magma" : "text-[#D5A33A]"} />
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
          <section className="m8-panel rounded-[22px] p-5 sm:p-6">
            <div className="grid lg:grid-cols-[380px_1fr] gap-5 items-center">
              <SwitcherooWheel
                players={t.switcheroo?.pool || []}
                label="SPIN"
                hint={
                  t.status === "review"
                    ? "Click the wheel to replay the Switcheroo animation"
                    : "Teams are locked · wheel remains available as the tournament element"
                }
                sizeClass="w-[260px] h-[260px] sm:w-[320px] sm:h-[320px]"
              />
              <div>
                <div className="brand-kicker text-[#D5A33A]">Switcheroo wheel</div>
                <h2 className="font-display text-2xl font-black mt-1">
                  Click the wheel anytime
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  The player names stay on the wheel. During review, reaching the current fund target
                  triggers a completely new draw; if the timer reaches zero first, the current teams are final.
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
                <div className="brand-kicker text-[#D5A33A]">Re-roll fund</div>
                <div className="flex items-end justify-between gap-3 mt-1">
                  <div className="font-mono text-3xl font-black">
                    €{total.toFixed(0)}
                    <span className="text-base text-muted-foreground"> / €{goal.toFixed(0)}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-right">
                    <span className="block">Re-spins completed: {rerollsUsed}</span>
                    <span className="block text-[#D5A33A] mt-0.5">
                      Next target: €{goal + rerollStep}
                    </span>
                  </span>
                </div>

                <div className="h-4 rounded-full bg-[#0B0F15] border border-[#252B36] overflow-hidden mt-3">
                  <div
                    className="h-full bg-[#D5A33A] transition-[width] duration-500"
                    style={{ width: progress + "%" }}
                  />
                </div>

                <div className="text-[11px] text-muted-foreground mt-2">
                  If the goal is reached before the timer ends, all teams are drawn again and the next target increases by €{rerollStep}.
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
                          <span className="text-[#D5A33A]">+€{row.amount}</span>
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
                          className="h-10 rounded-lg border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] text-[#D5A33A] font-black hover:bg-[#D5A33A]/[0.12] disabled:opacity-40"
                        >
                          +€{amount}
                        </button>
                      ))}
                    </div>
                    <div className="text-[9px] text-muted-foreground mt-2 leading-4">
                      PayPal opens in a new tab. Your payment stays pending until the tournament Admin confirms it was received.
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
            <Shuffle size={17} className="text-[#D5A33A]" />
            <div>
              <div className="brand-kicker text-[#D5A33A]">
                Switcheroo generation {t.switcheroo?.generation || 1}
              </div>
              <h2 className="font-display font-black text-xl">Provisional Teams</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            {(t.teams || []).map((team, index) => (
              <div key={team.id} className="rounded-xl border border-[#252B36] bg-[#10151D] p-3">
                <div className="text-xs font-black">
                  <span className="text-[#D5A33A] mr-2">#{index + 1}</span>
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
      <section className="rounded-[22px] border border-[#D5A33A]/25 bg-gradient-to-r from-[#15130c] to-[#0c1119] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[#D5A33A] text-[10px] font-black tracking-[.18em]">
              <span className="w-2 h-2 rounded-full bg-[#D5A33A] animate-pulse" />
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
          <Trophy size={42} className="text-[#D5A33A]" />
        </div>
      </section>

      {t?.teamBuild === "switcheroo" && (
        <section className="m8-panel rounded-[22px] p-5">
          <div className="grid lg:grid-cols-[330px_1fr] gap-4 items-center">
            <SwitcherooWheel
              players={t.switcheroo?.pool || []}
              label="SPIN"
              hint="Switcheroo wheel · click to replay the animation"
              sizeClass="w-[230px] h-[230px] sm:w-[280px] sm:h-[280px]"
            />
            <div>
              <div className="brand-kicker text-[#D5A33A]">Switcheroo</div>
              <h2 className="font-display text-xl font-black mt-1">Tournament wheel</h2>
              <p className="text-xs text-muted-foreground mt-2">
                Final Switcheroo generation {t.switcheroo?.generation || 1} · {rerollsUsed} re-spins completed.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid lg:grid-cols-[1fr_300px] gap-3">
        <div className="m8-panel rounded-[22px] p-5 overflow-x-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="brand-kicker text-[#D5A33A]">Live progression</div>
              <h2 className="font-display text-xl font-black">Bracket</h2>
            </div>
            {t.champion && (
              <div className="text-right">
                <div className="text-[9px] text-[#D5A33A]">CHAMPION</div>
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
                        <div
                          key={side}
                          className={
                            `h-11 px-3 border-b border-[#202631] flex items-center gap-2 ${match.winner === side
                              ? "bg-[#D5A33A]/10 text-[#F4CE70]"
                              : match.winner
                                ? "opacity-45"
                                : ""}`
                          }
                        >
                          <span className="flex-1 text-xs font-black truncate">{team?.name || "TBD"}</span>
                          {match.winner && (
                            <span
                              className={
                                `font-mono text-base font-black ${match.winner === side ? "text-[#F4CE70]" : "text-[#697181]"}`
                              }
                            >
                              {side === "a" ? match.scoreA : match.scoreB}
                            </span>
                          )}
                          {match.winner === side && <Crown size={13} />}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <div className="m8-panel rounded-[22px] p-4">
            <div className="flex items-center gap-2">
              <UsersRound size={16} />
              <h2 className="font-display font-black">Teams</h2>
            </div>
            <div className="mt-3 space-y-2">
              {(t.teams || []).map((team, index) => (
                <div key={team.id} className="rounded-xl border border-[#252B36] bg-[#10151D] p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[#D5A33A] text-[10px]">#{index + 1}</span>
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
