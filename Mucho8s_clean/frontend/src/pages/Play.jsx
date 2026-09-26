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
              title="8s / Team Builder"
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
          <div className="absolute w-72 h-72 -top-40 -right-24 rounded-full bg-[#D5A33A]/10 blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <ModeHeader
              kicker="Challenge"
              title="Chall Singola"
              description="Choose one opponent, the amount and how the payment will be handled."
              icon={Swords}
              accent="#D5A33A"
            />

            <div className="mt-6 space-y-2.5">
              <StepRow number="1" title="Choose opponent">
                <div className="relative mt-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-[132px] overflow-y-auto pr-1">
                  {opponents.map((player) => {
                    const selected = targetId === player.id;

                    return (
                      <button
                        type="button"
                        key={player.id}
                        onClick={() => setTargetId(player.id)}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${
                          selected
                            ? "border-[#D5A33A]/70 bg-[#D5A33A]/10"
                            : "border-[#242A35] bg-[#11151C] hover:border-[#3A424F]"
                        }`}
                        data-testid={`quick-chall-player-${player.id}`}
                      >
                        <PlayerAvatar
                          name={player.name}
                          elo={player.currentElo}
                          size={29}
                          avatarUrl={playerAvatars[player.id]}
                        />
                        <span className="font-semibold text-xs truncate flex-1">
                          {player.name}
                        </span>
                        <EloBadge elo={player.currentElo} />
                      </button>
                    );
                  })}
                </div>

                {target && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlayerAvatar
                        name={target.name}
                        elo={target.currentElo}
                        size={28}
                        avatarUrl={playerAvatars[target.id]}
                      />
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-widest text-[#9D854B]">
                          Selected
                        </div>
                        <div className="text-xs font-bold truncate">{target.name}</div>
                      </div>
                    </div>
                    <EloBadge elo={target.currentElo} />
                  </div>
                )}
              </StepRow>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <StepRow number="2" title="Stake">
                  <div className="flex gap-1.5 mt-3">
                    {[5, 10, 20].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAmount(String(value))}
                        className={`h-9 min-w-11 px-2 rounded-lg border text-[11px] font-black ${
                          String(amount) === String(value)
                            ? "bg-white text-black border-white"
                            : "bg-[#151923] border-[#2A303B] text-[#C8CED8]"
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
                        className="h-9 pl-6 bg-[#151923] border-[#2A303B] text-xs font-mono"
                        aria-label="Challenge amount"
                      />
                    </div>
                  </div>
                </StepRow>

                <StepRow number="3" title="Payment">
                  <div className="grid grid-cols-2 gap-1.5 mt-3">
                    {[
                      ["paypal", "PayPal"],
                      ["revolut", "Revolut"],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPlatform(key)}
                        className={`h-9 rounded-lg border text-[11px] font-black ${
                          platform === key
                            ? "bg-[#D5A33A] text-black border-[#D5A33A]"
                            : "bg-[#151923] border-[#2A303B] text-[#C8CED8]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </StepRow>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-6">
            <Button
              onClick={sendQuickChallenge}
              disabled={Boolean(sending) || (Boolean(discordSession) && !canSend)}
              className="w-full h-12 bg-[#D5A33A] hover:bg-[#e1b34b] text-black font-black rounded-xl"
              data-testid="quick-chall-send"
            >
              <WalletCards size={16} className="mr-2" />
              {!discordSession
                ? "CONNECT DISCORD"
                : sending
                  ? "SENDING..."
                  : target
                    ? `CHALL ${target.name} · €${Number.isFinite(numericAmount) ? numericAmount.toFixed(2) : "0.00"}`
                    : "SELECT AN OPPONENT"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
