import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, tierOf } from "@/lib/elo";
import { PlayerAvatar, EloBadge, Last10, StreakBadge, MvpBadge, RankBadge, RankProgress } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Crown,
  Gamepad2,
  Target,
  Trophy,
  TrendingUp,
  ExternalLink,
  Save,
  Link2,
  Swords,
  CreditCard,
  BadgeCheck,
  ShieldCheck,
  Flame,
  Award,
  UsersRound,
  Medal,
  Star,
  Coins,
  Shield,
  Rocket,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";

export default function PlayerProfile() {
  const { id } = useParams();
  const {
    players,
    matches,
    playerMap,
    playerAvatars,
    playerProfiles,
    discordPlayer,
    discordSession,
    saveMyChallengeLinks,
    challenges,
    publicChallenges,
    createChallenge,
  } = useData();

  const player = players.find((p) => p.id === id);
  const publicProfile = playerProfiles?.[id] || {};
  const isOwnProfile = Boolean(discordSession && discordPlayer?.id === id);

  const [links, setLinks] = useState({
    paypalUrl: "",
    revolutUrl: "",
    cmgUrl: "",
  });
  const [savingLinks, setSavingLinks] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState("");
  const [challengePlatform, setChallengePlatform] = useState("");
  const [challengeAmount, setChallengeAmount] = useState("5");

  useEffect(() => {
    setLinks({
      paypalUrl: publicProfile.paypalUrl || "",
      revolutUrl: publicProfile.revolutUrl || "",
      cmgUrl: publicProfile.cmgUrl || "",
    });
  }, [id, publicProfile.paypalUrl, publicProfile.revolutUrl, publicProfile.cmgUrl]);

  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter((m) => m.teamA.includes(player.id) || m.teamB.includes(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [matches, player]);

  const challengeStats = useMemo(() => {
    const completed = publicChallenges
      .filter((challenge) =>
        challenge.challenger_player_id === id ||
        challenge.challenged_player_id === id
      )
      .sort((a, b) => new Date(b.verified_at || b.created_at) - new Date(a.verified_at || a.created_at));

    let wins = 0;
    let losses = 0;
    let wonValue = 0;
    let lostValue = 0;

    completed.forEach((challenge) => {
      const amount = Number(challenge.amount_cents || 0) / 100;
      const settled = Boolean(challenge.payment_received_at);

      if (challenge.reported_winner_player_id === id) {
        wins += 1;
        if (settled) wonValue += amount;
      } else {
        losses += 1;
        if (settled) lostValue += amount;
      }
    });

    const played = wins + losses;
    return {
      completed,
      wins,
      losses,
      played,
      winRate: played ? Math.round((wins / played) * 100) : 0,
      wonValue,
      lostValue,
      profit: wonValue - lostValue,
    };
  }, [publicChallenges, id]);

  const challengeInsights = useMemo(() => {
    const completed = challengeStats.completed;
    let currentStreak = 0;
    let currentType = "";
    if (completed.length) {
      currentType = completed[0].reported_winner_player_id === id ? "W" : "L";
      for (const challenge of completed) {
        const result = challenge.reported_winner_player_id === id ? "W" : "L";
        if (result !== currentType) break;
        currentStreak += 1;
      }
    }

    let bestWinStreak = 0;
    let running = 0;
    [...completed].reverse().forEach((challenge) => {
      if (challenge.reported_winner_player_id === id) {
        running += 1;
        bestWinStreak = Math.max(bestWinStreak, running);
      } else {
        running = 0;
      }
    });

    const settled = completed.filter((challenge) => challenge.payment_received_at);
    const cleanSettled = settled.filter((challenge) => !challenge.payout_disputed_at).length;
    const payoutDisputes = completed.filter((challenge) => challenge.payout_disputed_at).length;
    const reputation = settled.length
      ? Math.max(0, Math.round((cleanSettled / settled.length) * 100))
      : 100;

    const h2h = new Map();
    completed.forEach((challenge) => {
      const opponentId =
        challenge.challenger_player_id === id
          ? challenge.challenged_player_id
          : challenge.challenger_player_id;
      if (!opponentId) return;
      const row = h2h.get(opponentId) || { opponentId, wins: 0, losses: 0, profit: 0, played: 0 };
      const amount = Number(challenge.amount_cents || 0) / 100;
      const won = challenge.reported_winner_player_id === id;
      row.played += 1;
      if (won) {
        row.wins += 1;
        if (challenge.payment_received_at) row.profit += amount;
      } else {
        row.losses += 1;
        if (challenge.payment_received_at) row.profit -= amount;
      }
      h2h.set(opponentId, row);
    });

    const headToHead = [...h2h.values()]
      .sort((a, b) => b.played - a.played || b.wins - a.wins)
      .slice(0, 5);

    const achievementCatalog = [
      { label: "First Match", detail: "Play 1 match", icon: Gamepad2, unlocked: player.totalMatches >= 1 },
      { label: "Regular", detail: "Play 10 matches", icon: Gamepad2, unlocked: player.totalMatches >= 10 },
      { label: "Veteran", detail: "Play 25 matches", icon: Medal, unlocked: player.totalMatches >= 25 },
      { label: "Grinder", detail: "Play 50 matches", icon: Flame, unlocked: player.totalMatches >= 50 },
      { label: "Centurion", detail: "Play 100 matches", icon: Award, unlocked: player.totalMatches >= 100 },

      { label: "First Blood", detail: "Win 1 match", icon: Trophy, unlocked: player.wins >= 1 },
      { label: "Winner", detail: "Win 10 matches", icon: Trophy, unlocked: player.wins >= 10 },
      { label: "Elite Winner", detail: "Win 25 matches", icon: Crown, unlocked: player.wins >= 25 },
      { label: "Dominant", detail: "Win 50 matches", icon: Star, unlocked: player.wins >= 50 },

      { label: "MVP", detail: "Earn 1 MVP", icon: Crown, unlocked: player.mvpCount >= 1 },
      { label: "MVP x5", detail: "Earn 5 MVPs", icon: Crown, unlocked: player.mvpCount >= 5 },
      { label: "MVP x10", detail: "Earn 10 MVPs", icon: Award, unlocked: player.mvpCount >= 10 },

      { label: "Hot Streak", detail: "3 wins in a row", icon: Flame, unlocked: bestWinStreak >= 3 },
      { label: "On Fire", detail: "5 wins in a row", icon: Flame, unlocked: bestWinStreak >= 5 },
      { label: "Untouchable", detail: "10 wins in a row", icon: Rocket, unlocked: bestWinStreak >= 10 },

      { label: "First Chall", detail: "Win 1 money chall", icon: Swords, unlocked: challengeStats.wins >= 1 },
      { label: "Chall Grinder", detail: "Win 5 money challs", icon: Swords, unlocked: challengeStats.wins >= 5 },
      { label: "Chall Veteran", detail: "Win 10 money challs", icon: Medal, unlocked: challengeStats.wins >= 10 },
      { label: "Chall King", detail: "Win 25 money challs", icon: Crown, unlocked: challengeStats.wins >= 25 },

      { label: "In The Money", detail: "Reach €25 net profit", icon: Coins, unlocked: challengeStats.profit >= 25 },
      { label: "Money Maker", detail: "Reach €50 net profit", icon: CreditCard, unlocked: challengeStats.profit >= 50 },
      { label: "Big Earner", detail: "Reach €100 net profit", icon: Award, unlocked: challengeStats.profit >= 100 },
      { label: "High Roller", detail: "Reach €250 net profit", icon: Crown, unlocked: challengeStats.profit >= 250 },

      { label: "Clean Payout", detail: "3 clean settled payouts", icon: ShieldCheck, unlocked: reputation === 100 && settled.length >= 3 },
      { label: "Trusted", detail: "10 clean settled payouts", icon: Shield, unlocked: reputation === 100 && settled.length >= 10 },

      { label: "Platinum", detail: "Reach 1200 Elo", icon: Medal, unlocked: player.currentElo >= 1200 },
      { label: "Masters", detail: "Reach 1350 Elo", icon: Crown, unlocked: player.currentElo >= 1350 },
    ];

    const achievements = achievementCatalog.filter((item) => item.unlocked);

    return {
      currentStreak,
      currentType,
      bestWinStreak,
      reputation,
      settled: settled.length,
      payoutDisputes,
      headToHead,
      achievements,
      achievementCatalog,
    };
  }, [challengeStats, id, player]);

  if (!player) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <div className="text-xl font-display font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-magma hover:underline">Back to players</Link>
      </div>
    );
  }

  const tier = tierOf(player.currentElo);
  const stats = [
    { label: "Current Elo", value: player.currentElo, icon: TrendingUp },
    { label: "Peak Elo", value: player.peakElo, icon: Trophy },
    { label: "Matches", value: player.totalMatches, icon: Gamepad2 },
    { label: "Win Rate", value: `${winRate(player)}%`, icon: Target },
    { label: "Wins", value: player.wins },
    { label: "Losses", value: player.losses },
    { label: "MVP", value: player.mvpCount, icon: Crown },
  ];

  const challengeLinks = [
    { key: "paypal", label: "PayPal", url: publicProfile.paypalUrl, className: "bg-[#0070BA] hover:bg-[#0a7bc7]", icon: CreditCard },
    { key: "revolut", label: "Revolut", url: publicProfile.revolutUrl, className: "bg-white hover:bg-[#eceef2] text-black", icon: CreditCard },
    { key: "cmg", label: "CMG", url: publicProfile.cmgUrl, className: "bg-magma hover:bg-[#ff3c4c]", icon: Swords },
  ].filter((item) => item.url);

  const saveLinks = async () => {
    setSavingLinks(true);
    const ok = await saveMyChallengeLinks(links);
    setSavingLinks(false);
    if (ok) toast.success("Challenge links updated");
  };

  const openChallengeAmount = (platform) => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord and link your player before sending a challenge");
      return;
    }
    setChallengePlatform(platform);
    setChallengeAmount("5");
  };

  const sendChallenge = async () => {
    const amount = Number(String(challengeAmount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSendingChallenge(challengePlatform);
    const created = await createChallenge(player.id, challengePlatform, amount);
    setSendingChallenge("");

    if (created) {
      setChallengePlatform("");
      toast.success(`€${amount.toFixed(2)} challenge sent to ${player.name}`);
    }
  };

  const myChallenges = isOwnProfile
    ? challenges.filter(
        (challenge) =>
          challenge.challenger_player_id === player.id ||
          challenge.challenged_player_id === player.id
      )
    : [];

  return (
    <div className="space-y-6">
      <Link to="/players" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white">
        <ArrowLeft size={16} /> Back to Players
      </Link>

      <Dialog open={Boolean(challengePlatform)} onOpenChange={(open) => !open && !sendingChallenge && setChallengePlatform("")}>
        <DialogContent
          className="bg-[#101319] border-[#242A35] rounded-2xl sm:max-w-md"
          data-testid="challenge-amount-dialog"
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl">CHALL {player.name}</DialogTitle>
            <DialogDescription>
              Choose how much you want to challenge for. The other player will see the amount before accepting.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-sm text-muted-foreground">Platform</span>
              <span className="text-sm font-bold uppercase">{challengePlatform || "—"}</span>
            </div>

            <Label className="text-xs text-muted-foreground">Challenge amount (€)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">€</span>
              <Input
                type="number"
                min="0.01"
                step="0.50"
                value={challengeAmount}
                onChange={(e) => setChallengeAmount(e.target.value)}
                className="pl-8 bg-[#151923] border-[#2A303B] h-12 text-lg font-mono font-bold"
                data-testid="challenge-amount-input"
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {[1, 2, 5, 10, 20].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setChallengeAmount(String(value))}
                  className="px-3 py-1.5 rounded-lg bg-[#171B23] border border-[#2A303B] text-xs font-semibold text-[#C8CED8] hover:text-white"
                >
                  €{value}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setChallengePlatform("")}
              disabled={Boolean(sendingChallenge)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={sendChallenge}
              disabled={Boolean(sendingChallenge)}
              className="w-full sm:w-auto bg-magma hover:bg-[#ff3c4c] text-white rounded-xl font-bold"
              data-testid="send-challenge-confirm"
            >
              <Swords size={16} className="mr-2" />
              {sendingChallenge ? "Sending..." : "Send Challenge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="brand-card rounded-2xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <PlayerAvatar
            name={player.name}
            elo={player.currentElo}
            size={82}
            avatarUrl={playerAvatars[player.id]}
          />
          <div className="min-w-0 flex-1">
            <div className="brand-kicker mb-1">{isOwnProfile ? "My Profile" : "Player Profile"}</div>
            <h2 className="font-display text-3xl font-extrabold truncate">{player.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <RankBadge elo={player.currentElo} />
              <StreakBadge streak={player.currentStreak} />
            </div>
            <div className="mt-4 max-w-lg">
              <RankProgress elo={player.currentElo} />
            </div>
          </div>

          {!isOwnProfile && challengeLinks.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="h-11 px-5 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold tracking-wide magma-glow"
                  data-testid="challenge-me-btn"
                >
                  <Swords size={17} className="mr-2" /> CHALL ME
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 rounded-xl border-[#2A303B] bg-[#101319] p-2 shadow-2xl"
              >
                <DropdownMenuLabel className="px-2 py-2">
                  <div className="brand-kicker mb-1">Challenge {player.name}</div>
                  <div className="text-sm font-semibold text-white">Choose platform</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#242A35]" />
                {challengeLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      onSelect={() => openChallengeAmount(item.key)}
                      disabled={Boolean(sendingChallenge)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#D7DBE2] focus:bg-white/[0.05] focus:text-white cursor-pointer"
                      data-testid={`challenge-link-${item.key}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#171B23] border border-[#2A303B] flex items-center justify-center">
                        <Icon size={15} />
                      </div>
                      <span className="flex-1">
                        {sendingChallenge === item.key ? "Sending..." : item.label}
                      </span>
                      <Swords size={13} className="text-[#697181]" />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6">
          {stats.map((item) => (
            <div key={item.label} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
              <div className="font-mono font-bold text-lg mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Last 10</span>
          <Last10 record={player.last10} />
          <MvpBadge count={player.mvpCount} />
        </div>
      </div>

      <div className="card-surface rounded-2xl p-4 sm:p-5" data-testid="challenge-profile-stats">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Challenge Record</div>
            <h3 className="font-display text-xl font-bold">{challengeStats.wins}W - {challengeStats.losses}L</h3>
            <p className="text-sm text-muted-foreground mt-1">Record: verified challs · € totals: confirmed payouts only.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto lg:min-w-[560px]">
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Rate</div>
              <div className="font-mono font-bold text-lg mt-1">{challengeStats.winRate}%</div>
            </div>
            <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">€ Won</div>
              <div className="font-mono font-bold text-lg mt-1 text-emerald-400">€{challengeStats.wonValue.toFixed(2)}</div>
            </div>
            <div className="rounded-xl bg-red-500/[0.05] border border-red-500/15 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">€ Lost</div>
              <div className="font-mono font-bold text-lg mt-1 text-red-400">€{challengeStats.lostValue.toFixed(2)}</div>
            </div>
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Net</div>
              <div className={`font-mono font-bold text-lg mt-1 ${challengeStats.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {challengeStats.profit >= 0 ? "+" : "-"}€{Math.abs(challengeStats.profit).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {challengeStats.completed.length > 0 && (
          <div className="flex items-center gap-1.5 mt-4">
            <span className="text-xs text-muted-foreground mr-1">Last 5</span>
            {challengeStats.completed.slice(0, 5).map((challenge) => {
              const won = challenge.reported_winner_player_id === id;
              return (
                <span
                  key={challenge.id}
                  title={won ? "Vinta" : "Persa"}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center text-[10px] font-black ${
                    won
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                      : "bg-red-500/10 border-red-500/25 text-red-400"
                  }`}
                >
                  {won ? "W" : "L"}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4" data-testid="challenge-insights">
        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Momentum</div>
          <h3 className="font-display font-bold text-lg">Challenge Streak</h3>
          <div className={`font-display text-4xl font-black mt-4 ${
            challengeInsights.currentType === "W"
              ? "text-emerald-400"
              : challengeInsights.currentType === "L"
                ? "text-red-400"
                : "text-white"
          }`}>
            {challengeInsights.currentStreak
              ? `${challengeInsights.currentStreak}${challengeInsights.currentType}`
              : "—"}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Best win streak: {challengeInsights.bestWinStreak}
          </div>
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="brand-kicker mb-1">Trust</div>
          <h3 className="font-display font-bold text-lg">Challenge Reputation</h3>
          <div className="flex items-end gap-2 mt-4">
            <div className={`font-display text-4xl font-black ${
              challengeInsights.reputation >= 90 ? "text-emerald-400" : challengeInsights.reputation >= 70 ? "text-[#D5A33A]" : "text-red-400"
            }`}>
              {challengeInsights.reputation}%
            </div>
            <BadgeCheck size={20} className="text-emerald-400 mb-1.5" />
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {challengeInsights.settled} settled payouts · {challengeInsights.payoutDisputes} payout disputes
          </div>
        </div>

        <div className="card-surface rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="brand-kicker mb-1">Milestones</div>
              <h3 className="font-display font-bold text-lg">Achievements</h3>
            </div>
            <span className="font-mono text-xs text-[#D5A33A]">
              {challengeInsights.achievements.length}/{challengeInsights.achievementCatalog.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 max-h-56 overflow-y-auto pr-1">
            {challengeInsights.achievementCatalog.map((achievement) => {
              const Icon = achievement.icon;
              return (
                <div
                  key={achievement.label}
                  title={achievement.detail}
                  className={`rounded-xl border p-2.5 flex items-center gap-2 transition-all ${
                    achievement.unlocked
                      ? "bg-[#D5A33A]/[0.06] border-[#D5A33A]/25"
                      : "bg-[#0F1218] border-[#1D222C] opacity-40"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    achievement.unlocked ? "bg-[#D5A33A]/10" : "bg-white/[0.03]"
                  }`}>
                    <Icon size={14} className={achievement.unlocked ? "text-[#D5A33A]" : "text-muted-foreground"} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold truncate">{achievement.label}</div>
                    <div className="text-[9px] text-muted-foreground truncate mt-0.5">{achievement.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card-surface rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Rivals</div>
            <h3 className="font-display font-bold text-lg">Head-to-Head</h3>
          </div>
          <UsersRound size={18} className="text-[#697181]" />
        </div>

        {challengeInsights.headToHead.length === 0 ? (
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 text-center text-sm text-muted-foreground">
            No verified challenge rivals yet.
          </div>
        ) : (
          <div className="space-y-2">
            {challengeInsights.headToHead.map((row) => {
              const opponent = playerMap[row.opponentId];
              return (
                <Link
                  key={row.opponentId}
                  to={`/players/${row.opponentId}`}
                  className="interactive-row rounded-xl p-3 flex items-center gap-3"
                >
                  <PlayerAvatar
                    name={opponent?.name || "Player"}
                    elo={opponent?.currentElo || 1000}
                    size={38}
                    avatarUrl={playerAvatars[row.opponentId]}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{opponent?.name || "Player"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{row.played} challs played</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">
                      <span className="text-emerald-400">{row.wins}W</span>
                      <span className="text-muted-foreground mx-1">-</span>
                      <span className="text-red-400">{row.losses}L</span>
                    </div>
                    <div className={`text-xs font-mono mt-0.5 ${row.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {row.profit >= 0 ? "+" : "-"}€{Math.abs(row.profit).toFixed(2)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div className="card-surface rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="brand-kicker mb-1">Challenge</div>
              <h3 className="font-display font-bold text-lg">Your Challenge Links</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add the pages other players should use when they press CHALL ME.
              </p>
            </div>
            <Link2 size={18} className="text-[#697181] shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">PayPal link</Label>
              <Input
                value={links.paypalUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, paypalUrl: e.target.value }))}
                placeholder="https://paypal.me/..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-paypal-link"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Revolut link</Label>
              <Input
                value={links.revolutUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, revolutUrl: e.target.value }))}
                placeholder="https://revolut.me/..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-revolut-link"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">CMG profile / challenge link</Label>
              <Input
                value={links.cmgUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, cmgUrl: e.target.value }))}
                placeholder="https://..."
                className="mt-1 bg-[#0F1218] border-[#222834]"
                data-testid="my-cmg-link"
              />
            </div>

            <div className="lg:col-span-3 flex justify-end">
              <Button
                onClick={saveLinks}
                disabled={savingLinks}
                className="w-full sm:w-auto bg-magma hover:bg-[#ff3c4c] text-white rounded-xl"
                data-testid="save-challenge-links"
              >
                <Save size={15} className="mr-1.5" />
                {savingLinks ? "Saving..." : "Save Challenge Links"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && (
        <div className="card-surface rounded-2xl p-4 sm:p-5" data-testid="my-challenges-panel">
          <div className="mb-4">
            <div className="brand-kicker mb-1">Challenge Center</div>
            <h3 className="font-display font-bold text-lg">My Challenges</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Results become official only after the other player verifies them.
            </p>
          </div>

          {myChallenges.length === 0 ? (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 px-4 text-center text-sm text-muted-foreground">
              No challenges yet.
            </div>
          ) : (
            <div className="space-y-2">
              {myChallenges.slice(0, 12).map((challenge) => {
                const opponentId =
                  challenge.challenger_player_id === player.id
                    ? challenge.challenged_player_id
                    : challenge.challenger_player_id;
                const opponent = playerMap[opponentId];
                const completed = challenge.status === "completed";
                const won = completed && challenge.reported_winner_player_id === player.id;
                const lost = completed && challenge.reported_winner_player_id && challenge.reported_winner_player_id !== player.id;
                const amount = new Intl.NumberFormat("it-IT", {
                  style: "currency",
                  currency: challenge.currency || "EUR",
                }).format(Number(challenge.amount_cents || 0) / 100);
                const canOpen = ["accepted", "result_pending", "completed", "disputed"].includes(challenge.status);

                return (
                  <div
                    key={challenge.id}
                    className={`rounded-xl p-3 sm:p-4 border transition-colors ${
                      won
                        ? "bg-emerald-500/[0.06] border-emerald-500/25"
                        : lost
                          ? "bg-red-500/[0.06] border-red-500/25"
                          : "bg-[#0F1218] border-[#1D222C]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <PlayerAvatar
                        name={opponent?.name || "Player"}
                        elo={opponent?.currentElo || 1000}
                        size={42}
                        avatarUrl={playerAvatars[opponentId]}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">vs {opponent?.name || "Player"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {String(challenge.platform || "").toUpperCase()} · {amount} · {new Date(challenge.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {won && (
                          <span className="inline-flex items-center h-9 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-extrabold tracking-wider">
                            VINTA
                          </span>
                        )}
                        {lost && (
                          <span className="inline-flex items-center h-9 px-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-extrabold tracking-wider">
                            PERSA
                          </span>
                        )}
                        {!completed && challenge.status === "pending" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-[#D5A33A]">Pending</span>
                        )}
                        {!completed && challenge.status === "accepted" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Accepted</span>
                        )}
                        {!completed && challenge.status === "result_pending" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-[#8E98FF]">Verification</span>
                        )}
                        {!completed && challenge.status === "declined" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-red-400">Declined</span>
                        )}
                        {!completed && challenge.status === "disputed" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-orange-400">Disputed</span>
                        )}
                        {!completed && challenge.status === "cancelled" && (
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cancelled</span>
                        )}

                        {canOpen && (
                          <Link
                            to={`/challenges/${challenge.id}`}
                            className={`inline-flex items-center justify-center h-9 px-3 rounded-lg text-xs font-bold border ${
                              won
                                ? "bg-emerald-500 text-black border-emerald-400"
                                : lost
                                  ? "bg-red-500 text-white border-red-400"
                                  : "bg-magma text-white border-magma hover:bg-[#ff3c4c]"
                            }`}
                            data-testid={`open-challenge-${challenge.id}`}
                          >
                            OPEN MATCH
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="card-surface rounded-2xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Elo History</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={player.eloHistory || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1D222C" vertical={false} />
              <XAxis dataKey="match" stroke="#4B5563" fontSize={11} />
              <YAxis domain={["dataMin - 30", "dataMax + 30"]} stroke="#4B5563" fontSize={11} width={45} />
              <Tooltip
                contentStyle={{ background: "#101319", border: "1px solid #242A35", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <Line type="monotone" dataKey="elo" stroke="#FF2A3B" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface rounded-2xl p-4 sm:p-5">
        <h3 className="font-display font-bold text-lg mb-4">Recent Matches</h3>
        <div className="space-y-2">
          {playerMatches.slice(0, 10).map((m) => {
            const winners = m.winner === "A" ? m.teamA : m.teamB;
            const won = winners.includes(player.id);
            const teammates = (m.teamA.includes(player.id) ? m.teamA : m.teamB)
              .filter((pid) => pid !== player.id)
              .map((pid) => playerMap[pid]?.name)
              .filter(Boolean);
            const delta = Number(m.eloChanges?.[player.id] || 0);

            return (
              <div key={m.id} className="interactive-row flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl p-3">
                <div className={`font-bold text-sm ${won ? "text-emerald-400" : "text-red-400"}`}>
                  {won ? "WIN" : "LOSS"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.game || "Game"} · {m.mode || "Mode"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    With {teammates.length ? teammates.join(", ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.mvpId === player.id && <Crown size={15} className="text-[#D5A33A]" />}
                  <span className={`font-mono text-sm ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}{delta} Elo
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}

          {playerMatches.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">No matches recorded for this player yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
