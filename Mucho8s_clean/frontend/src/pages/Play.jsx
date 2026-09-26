import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Gamepad2,
  Search,
  Swords,
  WalletCards,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const {
    players,
    playerAvatars,
    discordPlayer,
    discordSession,
    signInWithDiscord,
    createChallenge,
  } = useData();

  const [query, setQuery] = useState("");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("5");
  const [platform, setPlatform] = useState("paypal");
  const [sending, setSending] = useState(false);

  const opponents = useMemo(() => {
    const term = query.trim().toLowerCase();
    const myElo = Number(discordPlayer?.currentElo || 1000);

    return (players || [])
      .filter((player) => player.id !== discordPlayer?.id)
      .filter((player) => !term || player.name.toLowerCase().includes(term))
      .sort((a, b) => {
        if (term) return String(a.name).localeCompare(String(b.name));
        return Math.abs(Number(a.currentElo || 1000) - myElo) - Math.abs(Number(b.currentElo || 1000) - myElo);
      })
      .slice(0, 8);
  }, [players, discordPlayer, query]);

  const target = players.find((player) => player.id === targetId) || null;
  const numericAmount = Number(String(amount).replace(",", "."));
  const canSend = Boolean(
    target &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    ["paypal", "revolut"].includes(platform)
  );

  const sendQuickChallenge = async () => {
    if (!discordSession) {
      await signInWithDiscord();
      return;
    }
    if (!discordPlayer) {
      toast.error("Link your player account before sending a challenge");
      return;
    }
    if (!canSend || !target) {
      toast.error("Choose an opponent and a valid amount");
      return;
    }

    setSending(true);
    const created = await createChallenge(target.id, platform, numericAmount);
    setSending(false);

    if (!created) return;

    toast.success(`Challenge sent to ${target.name}`);
    navigate(`/challenges/${created.id}`);
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[22px] p-5 sm:p-7">
        <div className="brand-kicker mb-1">Play</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
          Choose how you want to play.
        </h1>
        <p className="text-sm text-[#7F8795] mt-2 max-w-2xl leading-6">
          Build an 8s lobby or send a Money Chall directly from here.
        </p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PlayCard
          to="/team-builder"
          kicker="Competitive 8s"
          title="8s / Team Builder"
          description="Create balanced teams using Auto Balance, Chemistry Draft or Manual Draft."
          icon={Gamepad2}
          accent="#FF2A3B"
          button="Play 8s"
          meta={["Auto Balance", "Chemistry", "Manual"]}
          testId="play-8s-card"
        />

        <div className="m8-play-card relative overflow-hidden" data-testid="play-money-chall-card">
          <div className="m8-play-card-glow" style={{ "--play-accent": "#D5A33A" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="brand-kicker mb-2">Quick Chall</div>
                <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">
                  Money Chall
                </h2>
                <p className="text-sm text-[#8D95A4] mt-2">
                  Pick a player, choose the stake and send it.
                </p>
              </div>
              <div
                className="m8-play-icon shrink-0"
                style={{
                  color: "#D5A33A",
                  borderColor: "#D5A33A33",
                  background: "#D5A33A0D",
                }}
              >
                <Swords size={25} />
              </div>
            </div>

            <div className="mt-5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search opponent..."
                  className="pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
                  data-testid="quick-chall-search"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-[210px] overflow-y-auto pr-1">
                {opponents.map((player) => {
                  const selected = targetId === player.id;
                  return (
                    <button
                      type="button"
                      key={player.id}
                      onClick={() => setTargetId(player.id)}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all ${
                        selected
                          ? "border-[#D5A33A]/60 bg-[#D5A33A]/10"
                          : "border-[#242A35] bg-[#0F1218] hover:border-[#3A424F]"
                      }`}
                      data-testid={`quick-chall-player-${player.id}`}
                    >
                      <PlayerAvatar
                        name={player.name}
                        elo={player.currentElo}
                        size={32}
                        avatarUrl={playerAvatars[player.id]}
                      />
                      <span className="font-semibold text-sm truncate flex-1">{player.name}</span>
                      <EloBadge elo={player.currentElo} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-3 mt-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Stake</div>
                <div className="flex gap-2">
                  {[5, 10, 20].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(String(value))}
                      className={`h-10 px-3 rounded-lg border text-xs font-bold ${
                        String(amount) === String(value)
                          ? "bg-white text-black border-white"
                          : "bg-[#0F1218] border-[#2A303B] text-[#C8CED8]"
                      }`}
                    >
                      €{value}
                    </button>
                  ))}
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="h-10 pl-6 bg-[#0F1218] border-[#2A303B] text-sm font-mono"
                      aria-label="Challenge amount"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Payment</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["paypal", "PayPal"],
                    ["revolut", "Revolut"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPlatform(key)}
                      className={`h-10 rounded-lg border text-xs font-bold ${
                        platform === key
                          ? "bg-[#D5A33A] text-black border-[#D5A33A]"
                          : "bg-[#0F1218] border-[#2A303B] text-[#C8CED8]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={sendQuickChallenge}
              disabled={Boolean(sending) || (Boolean(discordSession) && !canSend)}
              className="w-full h-12 mt-4 bg-[#D5A33A] hover:bg-[#e2b54e] text-black font-black rounded-xl"
              data-testid="quick-chall-send"
            >
              <WalletCards size={16} className="mr-2" />
              {!discordSession
                ? "Connect Discord to Chall"
                : sending
                  ? "Sending..."
                  : target
                    ? `CHALL ${target.name} · €${Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : "0.00"}`
                    : "Select an opponent"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
