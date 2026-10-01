import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Gamepad2,
  Globe2,
  ListChecks,
  LockKeyhole,
  Shuffle,
  Swords,
  Trophy,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";

const GAME_OPTIONS = ["BO7", "BO6", "MW3", "CW", "BO2"];
const FORMAT_OPTIONS = ["2v2", "3v3", "4v4"];
const MODE_OPTIONS = ["CDL Mix", "Hardpoint", "Search & Destroy"];
const SERIES_OPTIONS = [3, 5, 7];

const ChoiceCard = ({
  active,
  title,
  subtitle,
  icon: Icon,
  accent = "gold",
  onClick,
  disabled = false,
}) => {
  const pink = accent === "pink";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "relative min-h-[96px] rounded-2xl border p-4 text-left transition-all disabled:opacity-35 disabled:cursor-not-allowed " +
        (active
          ? pink
            ? "border-[#FF4FA3]/60 bg-[#FF4FA3]/[0.09] shadow-[0_0_0_1px_rgba(255,79,163,.08),0_18px_45px_rgba(255,79,163,.08)]"
            : "border-[#D5A33A]/60 bg-[#D5A33A]/[0.08] shadow-[0_0_0_1px_rgba(213,163,58,.08),0_18px_45px_rgba(213,163,58,.08)]"
          : "border-[#252B36] bg-[#0D1219] hover:border-[#3A4351] hover:bg-white/[0.025]")
      }
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div
            className={
              "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 " +
              (active
                ? pink
                  ? "border-[#FF4FA3]/30 bg-[#FF4FA3]/10 text-[#FF8BC5]"
                  : "border-[#D5A33A]/30 bg-[#D5A33A]/10 text-[#D5A33A]"
                : "border-[#2A303B] bg-[#111720] text-[#697181]")
            }
          >
            <Icon size={16} />
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display text-sm font-black">{title}</div>
          {subtitle ? (
            <div className="text-[10px] text-muted-foreground mt-1 leading-4">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      {active && (
        <div
          className={
            "absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center " +
            (pink ? "bg-[#FF4FA3] text-black" : "bg-[#D5A33A] text-black")
          }
        >
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </button>
  );
};

const Segmented = ({
  value,
  options,
  onChange,
  accent = "gold",
  disabled = false,
  formatLabel,
}) => {
  const pink = accent === "pink";
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => {
        const active = String(value) === String(option);
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={
              "h-11 rounded-xl border text-xs font-black transition-all disabled:opacity-35 " +
              (active
                ? pink
                  ? "border-[#FF4FA3]/55 bg-[#FF4FA3]/10 text-[#FFB7D9]"
                  : "border-[#D5A33A]/55 bg-[#D5A33A]/10 text-[#F4CE70]"
                : "border-[#252B36] bg-[#0D1219] text-[#AAB1BE] hover:border-[#3B4554]")
            }
          >
            {formatLabel
              ? formatLabel(option)
              : typeof option === "number"
                ? `BO${option}`
                : String(option).toUpperCase()}
          </button>
        );
      })}
    </div>
  );
};

export default function TourneySetupWizard({
  tournament,
  economy,
  paymentsLocked = false,
  published = false,
  onPatch,
  onPatchSwitcheroo,
  onChangeTeamBuild,
  onFinish,
  onClose,
}) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const isSwitcheroo = tournament.teamBuild === "switcheroo";
  const accent = isSwitcheroo ? "pink" : "gold";

  const steps = useMemo(
    () => [
      { key: "identity", label: "BASICS" },
      { key: "format", label: "FORMAT" },
      { key: "series", label: "SERIES" },
      { key: "build", label: "TEAM BUILD" },
      ...(isSwitcheroo ? [{ key: "entry", label: "ENTRY" }] : []),
      { key: "review", label: "REVIEW" },
    ],
    [isSwitcheroo]
  );

  const current = steps[step] || steps[0];

  const go = (next) => {
    setDirection(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
  };

  const canContinue = (() => {
    if (current.key === "identity") return Boolean(String(tournament.name || "").trim());
    if (current.key === "entry" && isSwitcheroo) {
      return Boolean(String(tournament.switcheroo?.paypalUrl || "").trim());
    }
    return true;
  })();

  const pink = accent === "pink";

  const titleByStep = {
    identity: "Create your MuchoTourney",
    format: "How will the tournament be played?",
    series: "Set the competitive rules",
    build: "How should teams be created?",
    entry: "Choose registration & entry flow",
    review: "Review before moving on",
  };

  const subtitleByStep = {
    identity: "Start with the tournament identity. You can go back at any time.",
    format: "Pick format and game mode without crowding the page with every setting at once.",
    series: "Main series, final series and seeding stay together in one clear step.",
    build: "Manual teams keep the classic MuchoTourney look. Switcheroo changes the flow to pink.",
    entry: "Choose invited players or open registration, then set the entry fee and PayPal destination.",
    review: published
      ? "Changes are saved directly to the live MuchoTourney."
      : "Confirm the setup, then continue to players or publish registration.",
  };

  return (
    <div className="w-full">
      <div className="rounded-[26px] border border-[#252B36] bg-[#090E14] overflow-hidden shadow-[0_22px_70px_rgba(0,0,0,.28)]">
        <div className="px-4 sm:px-6 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div
                className={
                  "text-[9px] tracking-[.2em] font-black " +
                  (pink ? "text-[#FF4FA3]" : "text-[#D5A33A]")
                }
              >
                {published ? "EDIT LIVE TOURNAMENT" : "MUCHOTOURNEY SETUP"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Step {step + 1} of {steps.length}
              </div>
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl border border-[#2A303B] bg-[#111720] text-muted-foreground hover:text-white flex items-center justify-center"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((item, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => go(index)}
                  className="text-left"
                >
                  <div
                    className={
                      "h-1.5 rounded-full transition-all " +
                      (active || done
                        ? pink
                          ? "bg-[#FF4FA3]"
                          : "bg-[#D5A33A]"
                        : "bg-[#202631]")
                    }
                  />
                  <div
                    className={
                      "hidden sm:block mt-1.5 text-[8px] tracking-[.12em] font-black " +
                      (active
                        ? pink
                          ? "text-[#FF9DCE]"
                          : "text-[#F4CE70]"
                        : "text-[#596270]")
                    }
                  >
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-6 min-h-[430px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.key}
              initial={{ opacity: 0, x: direction * 44, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: direction * -36, scale: 0.985 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="max-w-3xl mx-auto">
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-.035em]">
                  {titleByStep[current.key]}
                </h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                  {subtitleByStep[current.key]}
                </p>

                {current.key === "identity" && (
                  <div className="mt-7 space-y-5">
                    <label className="block">
                      <span className="text-[9px] tracking-[.16em] text-[#697181] font-black">
                        TOURNAMENT NAME
                      </span>
                      <input
                        value={tournament.name}
                        onChange={(event) => onPatch({ name: event.target.value })}
                        className="mt-2 w-full h-14 rounded-2xl bg-[#111720] border border-[#2A303B] px-4 text-lg font-black focus:outline-none focus:border-[#D5A33A]/45"
                        placeholder="MuchoTourney Test Cup"
                      />
                    </label>

                    <div>
                      <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                        GAME
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {GAME_OPTIONS.map((game) => (
                          <button
                            key={game}
                            type="button"
                            onClick={() => onPatch({ game })}
                            className={
                              "h-12 rounded-xl border font-black text-xs transition-all " +
                              (tournament.game === game
                                ? "border-[#D5A33A]/55 bg-[#D5A33A]/10 text-[#F4CE70]"
                                : "border-[#252B36] bg-[#0D1219] text-[#AAB1BE] hover:border-[#3B4554]")
                            }
                          >
                            {game}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {current.key === "format" && (
                  <div className="mt-7 space-y-6">
                    <div>
                      <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                        TEAM FORMAT
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {FORMAT_OPTIONS.map((format) => (
                          <ChoiceCard
                            key={format}
                            active={tournament.format === format}
                            title={format}
                            subtitle={`${format.split("v")[0]} players per team`}
                            icon={UsersRound}
                            onClick={() => onPatch({ format })}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                        MODE
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        {MODE_OPTIONS.map((mode) => (
                          <ChoiceCard
                            key={mode}
                            active={tournament.mode === mode}
                            title={mode}
                            subtitle={
                              mode === "CDL Mix"
                                ? "Alternating HP / S&D"
                                : mode === "Hardpoint"
                                  ? "Hardpoint only"
                                  : "Search & Destroy only"
                            }
                            icon={mode === "Hardpoint" ? Crosshair : Swords}
                            onClick={() => onPatch({ mode })}
                          />
                        ))}
                      </div>
                    </div>

                    {tournament.mode === "CDL Mix" && (
                      <div>
                        <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                          MIX START
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {["Hardpoint", "Search & Destroy"].map((startMode) => (
                            <ChoiceCard
                              key={startMode}
                              active={tournament.startMode === startMode}
                              title={startMode}
                              subtitle="First map mode"
                              icon={Crosshair}
                              onClick={() => onPatch({ startMode })}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {current.key === "series" && (
                  <div className="mt-7 space-y-6">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                          MAIN SERIES
                        </div>
                        <Segmented
                          value={tournament.bestOf}
                          options={SERIES_OPTIONS}
                          onChange={(bestOf) => onPatch({ bestOf: Number(bestOf) })}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                          FINAL
                        </div>
                        <Segmented
                          value={tournament.finalBestOf}
                          options={SERIES_OPTIONS}
                          onChange={(finalBestOf) => onPatch({ finalBestOf: Number(finalBestOf) })}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                        SEEDING
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <ChoiceCard
                          active={tournament.seeding === "manual"}
                          title="Manual"
                          subtitle="You decide the bracket order."
                          icon={ListChecks}
                          onClick={() => onPatch({ seeding: "manual" })}
                        />
                        <ChoiceCard
                          active={tournament.seeding === "random"}
                          title="Random"
                          subtitle="MuchoTourney shuffles the teams."
                          icon={Shuffle}
                          onClick={() => onPatch({ seeding: "random" })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {current.key === "build" && (
                  <div className="mt-7 grid md:grid-cols-2 gap-3">
                    <ChoiceCard
                      active={tournament.teamBuild === "manual"}
                      title="Classic teams"
                      subtitle="Create teams manually and assign rosters yourself."
                      icon={UsersRound}
                      onClick={() => onChangeTeamBuild("manual")}
                    />
                    <ChoiceCard
                      active={tournament.teamBuild === "switcheroo"}
                      title="Switcheroo"
                      subtitle="Pink live wheel, paid entry, re-spins and animated team creation."
                      icon={Shuffle}
                      accent="pink"
                      onClick={() => onChangeTeamBuild("switcheroo")}
                    />
                  </div>
                )}

                {current.key === "entry" && isSwitcheroo && (
                  <div className="mt-7 space-y-6">
                    <div>
                      <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                        REGISTRATION
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <ChoiceCard
                          active={(tournament.switcheroo?.registrationMode || "manual") === "manual"}
                          title="Invite / select players"
                          subtitle="You pick players before publishing. Selected players then confirm and pay."
                          icon={LockKeyhole}
                          accent="pink"
                          onClick={() => onPatchSwitcheroo({ registrationMode: "manual" })}
                        />
                        <ChoiceCard
                          active={tournament.switcheroo?.registrationMode === "open"}
                          title="Open registration"
                          subtitle="Publish first. Players register themselves and PayPal opens after confirmation."
                          icon={Globe2}
                          accent="pink"
                          onClick={() => onPatchSwitcheroo({ registrationMode: "open" })}
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <label>
                        <span className="text-[9px] tracking-[.16em] text-[#697181] font-black">
                          ENTRY FEE / PLAYER
                        </span>
                        <div className="relative mt-2">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">€</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tournament.switcheroo?.entryFee || 5}
                            disabled={paymentsLocked}
                            onChange={(event) =>
                              onPatchSwitcheroo({
                                entryFee: Math.max(1, Number(event.target.value) || 1),
                              })
                            }
                            className="w-full h-12 rounded-xl bg-[#111720] border border-[#FF4FA3]/25 pl-9 pr-3 text-sm font-black disabled:opacity-35"
                          />
                        </div>
                      </label>

                      <label>
                        <span className="text-[9px] tracking-[.16em] text-[#697181] font-black">
                          REVIEW TIME
                        </span>
                        <select
                          value={tournament.switcheroo?.reviewMinutes || 5}
                          onChange={(event) =>
                            onPatchSwitcheroo({ reviewMinutes: Number(event.target.value) })
                          }
                          className="mt-2 w-full h-12 rounded-xl bg-[#111720] border border-[#FF4FA3]/25 px-3 text-sm font-black"
                        >
                          {[1, 3, 5, 10, 15].map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} min
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {tournament.switcheroo?.registrationMode === "open" && (
                      <div>
                        <div className="text-[9px] tracking-[.16em] text-[#697181] font-black mb-2">
                          TOURNAMENT CAPACITY
                        </div>
                        <Segmented
                          value={tournament.switcheroo?.maxTeams || 4}
                          options={[2, 4, 8]}
                          accent="pink"
                          formatLabel={(maxTeams) => `${maxTeams} TEAMS`}
                          onChange={(maxTeams) => onPatchSwitcheroo({ maxTeams: Number(maxTeams) })}
                        />
                        <div className="text-[10px] text-muted-foreground mt-2">
                          {Number(tournament.switcheroo?.maxTeams || 4) *
                            Math.max(1, Number(String(tournament.format).split("v")[0]) || 4)}{" "}
                          player slots maximum.
                        </div>
                      </div>
                    )}

                    <label className="block">
                      <span className="text-[9px] tracking-[.16em] text-[#697181] font-black">
                        PAYPAL LINK
                      </span>
                      <input
                        value={tournament.switcheroo?.paypalUrl || ""}
                        onChange={(event) => onPatchSwitcheroo({ paypalUrl: event.target.value })}
                        placeholder="https://paypal.me/tuonome"
                        className="mt-2 w-full h-12 rounded-xl bg-[#111720] border border-[#FF4FA3]/25 px-4 text-sm"
                      />
                    </label>

                    <div className="rounded-2xl border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.045] p-4">
                      <div className="flex items-center gap-2">
                        <WalletCards size={16} className="text-[#FF4FA3]" />
                        <div className="text-[9px] tracking-[.16em] text-[#FF4FA3] font-black">
                          SWITCHEROO ECONOMY
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        {[
                          ["ENTRY POT", `€${economy?.entryPot || 0}`],
                          ["START GOAL", `€${economy?.baseGoal || 0}`],
                          ["1ST MARGIN", `+€${economy?.firstMargin || 0}`],
                          ["GROWTH", `+€${economy?.marginGrowth || 5}`],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-[#FF4FA3]/15 bg-[#0D1219] p-3">
                            <div className="text-[8px] tracking-widest text-[#697181]">{label}</div>
                            <div className="font-mono text-base font-black text-[#FF9DCE] mt-1">{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {current.key === "review" && (
                  <div className="mt-7">
                    <div className="rounded-2xl border border-[#252B36] bg-[#0D1219] overflow-hidden">
                      {[
                        ["Tournament", tournament.name],
                        ["Game", tournament.game],
                        ["Format", tournament.format],
                        ["Mode", tournament.mode],
                        ["Series", `BO${tournament.bestOf} · Final BO${tournament.finalBestOf}`],
                        ["Seeding", String(tournament.seeding || "manual").toUpperCase()],
                        ["Team build", isSwitcheroo ? "SWITCHEROO" : "CLASSIC"],
                        ...(isSwitcheroo
                          ? [
                              [
                                "Registration",
                                tournament.switcheroo?.registrationMode === "open"
                                  ? "OPEN REGISTRATION"
                                  : "INVITED / SELECTED PLAYERS",
                              ],
                              ["Entry", `€${tournament.switcheroo?.entryFee || 5} / player`],
                              ["Review", `${tournament.switcheroo?.reviewMinutes || 5} min`],
                            ]
                          : []),
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="min-h-11 px-4 py-2.5 border-b last:border-b-0 border-[#202631] flex items-center justify-between gap-4"
                        >
                          <span className="text-[9px] tracking-[.13em] text-[#697181] font-black">{label}</span>
                          <span className="text-xs font-black text-right">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div
                      className={
                        "mt-4 rounded-xl border px-4 py-3 text-xs " +
                        (pink
                          ? "border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.045] text-[#FFB7D9]"
                          : "border-[#D5A33A]/20 bg-[#D5A33A]/[0.045] text-[#F4CE70]")
                      }
                    >
                      {published
                        ? "Saving here updates MuchoTourney directly. Fields tied to already received payments remain protected."
                        : isSwitcheroo && tournament.switcheroo?.registrationMode === "open"
                          ? "Next: publish the tournament and let players register themselves."
                          : isSwitcheroo
                            ? "Next: choose the player pool with drag & drop, then publish."
                            : "Next: create the teams and rosters."}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="border-t border-[#202631] px-4 sm:px-6 py-4 flex items-center justify-between gap-3 bg-[#0A0F15]">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="h-11 px-4 rounded-xl border border-[#2A303B] bg-[#111720] text-xs font-black inline-flex items-center gap-2 disabled:opacity-25"
          >
            <ArrowLeft size={14} />
            BACK
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => go(step + 1)}
              className={
                "h-11 px-5 rounded-xl text-xs font-black inline-flex items-center gap-2 disabled:opacity-30 " +
                (pink
                  ? "bg-[#FF4FA3] hover:bg-[#FF69B4] text-black"
                  : "bg-[#D5A33A] hover:bg-[#E0B247] text-black")
              }
            >
              CONTINUE
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={!canContinue}
              onClick={onFinish}
              className={
                "h-11 px-5 rounded-xl text-xs font-black inline-flex items-center gap-2 " +
                (pink
                  ? "bg-[#FF4FA3] hover:bg-[#FF69B4] text-black"
                  : "bg-[#D5A33A] hover:bg-[#E0B247] text-black")
              }
            >
              {published ? "SAVE CHANGES" : isSwitcheroo && tournament.switcheroo?.registrationMode === "open"
                ? "PUBLISH REGISTRATION"
                : "CONTINUE"}
              <Trophy size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
