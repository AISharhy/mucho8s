import React from "react";
import { Link } from "react-router-dom";
import { Gamepad2, Swords, ArrowRight, UsersRound, Scale, Trophy, WalletCards } from "lucide-react";

const PlayCard = ({
  to,
  kicker,
  title,
  description,
  icon: Icon,
  accent,
  button,
  meta,
  testId,
}) => (
  <Link
    to={to}
    data-testid={testId}
    className="m8-play-card group"
  >
    <div className="m8-play-card-glow" style={{ "--play-accent": accent }} />
    <div
      className="m8-play-icon"
      style={{
        color: accent,
        borderColor: accent + "33",
        background: accent + "0D",
      }}
    >
      <Icon size={26} strokeWidth={2.1} />
    </div>

    <div className="relative z-10 mt-7">
      <div className="brand-kicker mb-2">{kicker}</div>
      <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">
        {title}
      </h2>
      <p className="text-sm text-[#8D95A4] leading-6 mt-3 max-w-md">
        {description}
      </p>

      <div className="flex flex-wrap gap-2 mt-5">
        {meta.map((item) => (
          <span key={item} className="m8-pill normal-case tracking-normal">
            {item}
          </span>
        ))}
      </div>
    </div>

    <div className="relative z-10 mt-8 pt-5 border-t border-white/[0.06] flex items-center justify-between gap-4">
      <span
        className="font-display text-sm font-black uppercase tracking-[0.08em]"
        style={{ color: accent }}
      >
        {button}
      </span>
      <div
        className="w-10 h-10 rounded-xl border flex items-center justify-center transition-transform duration-200 group-hover:translate-x-1"
        style={{
          color: accent,
          borderColor: accent + "33",
          background: accent + "0D",
        }}
      >
        <ArrowRight size={18} />
      </div>
    </div>
  </Link>
);

export default function Play() {
  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-7">
        <div className="brand-kicker mb-1">Play</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Choose how you want to play.
        </h1>
        <p className="text-sm text-[#7F8795] mt-2 max-w-2xl leading-6">
          Two ways to compete in MuchoMoney8s: build an 8s lobby or challenge another player for money.
        </p>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlayCard
          to="/team-builder"
          kicker="Competitive 8s"
          title="8s / Team Builder"
          description="Create balanced teams using the players already in the ladder. Choose Auto Balance, Chemistry Draft or Manual Draft."
          icon={Gamepad2}
          accent="#FF2A3B"
          button="Play 8s"
          meta={["Auto Balance", "Chemistry Draft", "Manual Draft"]}
          testId="play-8s-card"
        />

        <PlayCard
          to="/players"
          kicker="1v1 Challenge"
          title="Money Chall"
          description="Choose a player, set the amount and send a verified Money Chall. If you keep playing, continue the same matchup with ReChall."
          icon={Swords}
          accent="#D5A33A"
          button="Find a Player"
          meta={["Money Chall", "Verified Result", "ReChall"]}
          testId="play-money-chall-card"
        />
      </section>

      <section className="m8-panel-quiet rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#737D8D]">
        <span className="inline-flex items-center gap-1.5"><UsersRound size={13} /> 8s uses the existing Team Builder</span>
        <span className="inline-flex items-center gap-1.5"><WalletCards size={13} /> Money Chall uses the existing player challenge flow</span>
        <span className="inline-flex items-center gap-1.5"><Scale size={13} /> No new game modes added</span>
      </section>
    </div>
  );
}
