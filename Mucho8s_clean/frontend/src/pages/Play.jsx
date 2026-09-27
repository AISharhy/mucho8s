import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Gamepad2,
  Search,
  Swords,
  WalletCards,
  Link2Off,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const StepRow = ({ number, title, text, children }) => (
  <div className="rounded-2xl border border-[#222834] bg-[#0F1218] p-3.5">
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 shrink-0 rounded-lg border border-[#303744] bg-[#151923] flex items-center justify-center text-[11px] font-black text-[#C8CED8]">
        {number}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{title}</div>
        {text && <div className="text-[11px] text-muted-foreground mt-0.5">{text}</div>}
        {children}
      </div>
    </div>
  </div>
);

const PaymentLinks = ({ profile, compact = false }) => {
  const hasPayPal = Boolean(String(profile?.paypalUrl || "").trim());
  const hasRevolut = Boolean(String(profile?.revolutUrl || "").trim());

  if (!hasPayPal && !hasRevolut) {
    return (
      <span
        title="No payment method linked"
        aria-label="No payment method linked"
        className={`${compact ? "w-6 h-6" : "h-7 px-2"} rounded-lg border border-red-500/15 bg-red-500/[0.04] text-red-400/80 inline-flex items-center justify-center`}
      >
        <Link2Off size={compact ? 11 : 12} />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {hasPayPal && (
        <span
          title="PayPal linked"
          aria-label="PayPal linked"
          className={`${compact ? "w-6 h-6" : "h-7 px-2"} rounded-lg border border-[#61A8FF]/20 bg-[#61A8FF]/[0.06] text-[#61A8FF] inline-flex items-center justify-center font-mono text-[9px] font-black`}
        >
          P
        </span>
      )}
      {hasRevolut && (
        <span
          title="Revolut linked"
          aria-label="Revolut linked"
          className={`${compact ? "w-6 h-6" : "h-7 px-2"} rounded-lg border border-white/15 bg-white/[0.04] text-white inline-flex items-center justify-center font-mono text-[9px] font-black`}
        >
          R
        </span>
      )}
    </span>
  );
};

const ModeHeader = ({ kicker, title, description, icon: Icon, accent }) => (
  <div className="flex items-start justify-between gap-4">
    <div>
      <div className="brand-kicker mb-2">{kicker}</div>
      <h2 className="font-display text-2xl sm:text-[30px] font-black tracking-[-0.035em]">
        {title}
      </h2>
      <p className="text-sm text-[#8D95A4] mt-2 leading-6 max-w-md">
        {description}
      </p>
    </div>

    <div
      className="w-12 h-12 rounded-xl border flex items-center justify-center shrink-0"
      style={{
        color: accent,
        borderColor: accent + "38",
        background: accent + "0D",
        boxShadow: `0 0 28px ${accent}12`,
      }}
    >
      <Icon size={22} strokeWidth={2.2} />
    </div>
  </div>
);

export default function Play() {
  const navigate = useNavigate();
  const {
    players,
    playerAvatars,
    playerProfiles,
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
        return (
          Math.abs(Number(a.currentElo || 1000) - myElo) -
          Math.abs(Number(b.currentElo || 1000) - myElo)
        );
      })
      .slice(0, 6);
  }, [players, discordPlayer, query]);

  const target = players.find((player) => player.id === targetId) || null;
  const targetProfile = target ? playerProfiles?.[target.id] || null : null;
  const targetHasPayPal = Boolean(String(targetProfile?.paypalUrl || "").trim());
  const targetHasRevolut = Boolean(String(targetProfile?.revolutUrl || "").trim());
  const selectedPaymentAvailable =
    platform === "paypal" ? targetHasPayPal : targetHasRevolut;
  const numericAmount = Number(String(amount).replace(",", "."));

  const chooseTarget = (playerId) => {
    setTargetId(playerId);

    const profile = playerProfiles?.[playerId] || null;
    const hasPayPal = Boolean(String(profile?.paypalUrl || "").trim());
    const hasRevolut = Boolean(String(profile?.revolutUrl || "").trim());

    if (platform === "paypal" && !hasPayPal && hasRevolut) {
      setPlatform("revolut");
    } else if (platform === "revolut" && !hasRevolut && hasPayPal) {
      setPlatform("paypal");
    }
  };

  const canSend = Boolean(
    target &&
    selectedPaymentAvailable &&
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
      toast.error(
        target && !selectedPaymentAvailable
          ? "This player has not linked the selected payment method"
          : "Choose an opponent and a valid amount"
      );
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
      <section className="m8-panel rounded-[22px] p-5 sm:p-6">
        <div className="brand-kicker mb-1">Play</div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
              Choose your mode
            </h1>
            <p className="text-sm text-[#7F8795] mt-2">
              Team lobby or direct 1v1 Money Chall. Two clear paths, no extra steps.
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-[#697181]">
            <span className="m8-pill">8s</span>
            <span className="m8-pill">1v1</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <div
          className="relative overflow-hidden rounded-[22px] border border-[#2A313D] bg-[#10151D] p-5 sm:p-6 flex flex-col min-h-[500px]"
          data-testid="play-8s-card"
        >
          <div className="absolute w-72 h-72 -top-40 -right-24 rounded-full bg-magma/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <ModeHeader
              kicker="Competitive 8s"
              title="8s"
              description="Create the lobby first, then let the system build the matchup."
              icon={Gamepad2}
              accent="#FF2A3B"
            />

            <div className="mt-6 space-y-2.5">
              <StepRow
                number="1"
                title="Choose game & mode"
                text="Select the title first, then Hardpoint or Search & Destroy."
              />

              <StepRow
                number="2"
                title="Choose team method"
                text="Auto Balance or Manual. Chemistry becomes an information score after the teams are created."
              />

              <StepRow
                number="3"
                title="Select the lobby"
                text="Pick 4, 6 or 8 players. The system detects 2v2, 3v3 or 4v4 automatically."
              />
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-6">
            <Link
              to="/team-builder"
              className="w-full h-12 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-black inline-flex items-center justify-between px-4 transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <Gamepad2 size={17} />
                OPEN TEAM BUILDER
              </span>
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-[22px] border border-[#2A313D] bg-[#10151D] p-5 sm:p-6 flex flex-col min-h-[500px]"
          data-testid="play-money-chall-card"
        >
          <div className="absolute w-64 h-64 -top-40 -right-24 rounded-full bg-[#D5A33A]/8 blur-3xl pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="brand-kicker mb-1">1v1 Challenge</div>
              <h2 className="font-display text-2xl sm:text-[28px] font-black tracking-[-0.035em]">
                Chall Singola
              </h2>
              <p className="text-xs sm:text-sm text-[#7F8795] mt-1.5">
                Pick an opponent, choose the stake and send the chall.
              </p>
            </div>

            <div className="w-10 h-10 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] flex items-center justify-center shrink-0">
              <Swords size={18} className="text-[#D5A33A]" />
            </div>
          </div>

          <div className="relative z-10 mt-5 rounded-2xl border border-[#222834] bg-[#0F1218] p-3.5">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181]">
                  Opponent
                </div>
                <div className="text-sm font-bold mt-0.5">
                  {target ? target.name : "Choose a player"}
                </div>
              </div>

              {target && (
                <div className="flex items-center gap-2">
                  <PaymentLinks profile={targetProfile} />
                  <PlayerAvatar
                    name={target.name}
                    elo={target.currentElo}
                    size={30}
                    avatarUrl={playerAvatars[target.id]}
                  />
                  <EloBadge elo={target.currentElo} />
                </div>
              )}
            </div>

            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search opponent..."
                className="h-10 pl-9 bg-[#151923] border-[#2A303B] rounded-xl"
                data-testid="quick-chall-search"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 max-h-[154px] overflow-y-auto pr-1">
              {opponents.map((player) => {
                const selected = targetId === player.id;

                return (
                  <button
                    type="button"
                    key={player.id}
                    onClick={() => chooseTarget(player.id)}
                    className={`group h-11 flex items-center gap-2.5 rounded-xl border px-2.5 text-left transition-all ${
                      selected
                        ? "border-[#D5A33A]/60 bg-[#D5A33A]/[0.08]"
                        : "border-[#202631] bg-[#11151C] hover:border-[#343C49] hover:bg-[#141923]"
                    }`}
                    data-testid={`quick-chall-player-${player.id}`}
                  >
                    <PlayerAvatar
                      name={player.name}
                      elo={player.currentElo}
                      size={28}
                      avatarUrl={playerAvatars[player.id]}
                    />
                    <span className="font-semibold text-xs truncate flex-1">
                      {player.name}
                    </span>
                    <PaymentLinks
                      profile={playerProfiles?.[player.id] || null}
                      compact
                    />
                    <span className={`font-mono text-[11px] font-bold ${
                      selected ? "text-[#D5A33A]" : "text-[#9AA2AF]"
                    }`}>
                      {Number(player.currentElo || 0)}
                    </span>
                  </button>
                );
              })}

              {opponents.length === 0 && (
                <div className="sm:col-span-2 h-16 rounded-xl border border-dashed border-[#2A303B] flex items-center justify-center text-xs text-muted-foreground">
                  No players found
                </div>
              )}
            </div>
          </div>

          <div className="relative z-10 mt-3 rounded-2xl border border-[#222834] bg-[#0F1218] p-3.5">
            <div className="grid grid-cols-1 md:grid-cols-[1.35fr_0.9fr] gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181] mb-2">
                  Stake
                </div>

                <div className="flex items-center gap-1.5">
                  {[5, 10, 20].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(String(value))}
                      className={`h-9 min-w-12 px-3 rounded-lg border text-[11px] font-black transition-all ${
                        String(amount) === String(value)
                          ? "bg-white text-black border-white"
                          : "bg-[#151923] border-[#2A303B] text-[#B8C0CD] hover:border-[#3A424F]"
                      }`}
                    >
                      €{value}
                    </button>
                  ))}

                  <div className="relative min-w-0 flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      €
                    </span>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="h-9 pl-6 bg-[#151923] border-[#2A303B] text-xs font-mono rounded-lg"
                      aria-label="Challenge amount"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181] mb-2">
                  Payment
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    ["paypal", "PayPal", targetHasPayPal],
                    ["revolut", "Revolut", targetHasRevolut],
                  ].map(([key, label, available]) => {
                    const unavailable = Boolean(target) && !available;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setPlatform(key)}
                        title={
                          unavailable
                            ? `${target?.name || "Player"} has not linked ${label}`
                            : label
                        }
                        className={`h-9 rounded-lg border text-[11px] font-black transition-all ${
                          unavailable
                            ? "bg-[#11151C] border-[#202631] text-[#555E6B] cursor-not-allowed"
                            : platform === key
                              ? "bg-[#D5A33A] text-black border-[#D5A33A]"
                              : "bg-[#151923] border-[#2A303B] text-[#B8C0CD] hover:border-[#3A424F]"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {target && !targetHasPayPal && !targetHasRevolut && (
            <div className="relative z-10 mt-2.5 rounded-xl border border-red-500/15 bg-red-500/[0.04] px-3 py-2 text-[10px] text-red-300/80 flex items-center gap-2">
              <Link2Off size={12} />
              {target.name} has not linked PayPal or Revolut yet.
            </div>
          )}

          <div className="relative z-10 mt-auto pt-4">
            <Button
              onClick={sendQuickChallenge}
              disabled={Boolean(sending) || (Boolean(discordSession) && !canSend)}
              className="w-full h-11 bg-[#D5A33A] hover:bg-[#e1b34b] disabled:bg-[#6F5A29] disabled:text-black/60 text-black font-black rounded-xl"
              data-testid="quick-chall-send"
            >
              <WalletCards size={15} className="mr-2" />
              {!discordSession
                ? "CONNECT DISCORD"
                : sending
                  ? "SENDING..."
                  : target
                    ? `SEND CHALL · €${Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : "0.00"}`
                    : "CHOOSE AN OPPONENT"}
            </Button>

            {target && (
              <div className="text-[10px] text-center text-[#697181] mt-2">
                vs {target.name} · {platform === "paypal" ? "PayPal" : "Revolut"}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
