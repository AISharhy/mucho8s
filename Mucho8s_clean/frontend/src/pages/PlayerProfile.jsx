import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, tierOf, rankProgress } from "@/lib/elo";
import { duoChemistry } from "@/lib/chemistry";
import { analyzeBountyHistory, buildBountyAchievementCatalog } from "@/lib/bountyAchievements";
import { PlayerAvatar, EloBadge, Last10, StreakBadge, MvpBadge, MerdaBadge, RankBadge, RankProgress } from "@/components/shared";
import { RankEmblem } from "@/components/RankGuide";
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
  ArrowLeft,
  Crown,
  Gamepad2,
  Target,
  Trophy,
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const profileTab = isOwnProfile && searchParams.get("tab") === "challenges" ? "challenges" : "overview";

  const setProfileTab = (tab) => {
    if (!isOwnProfile) return;
    if (tab === "challenges") {
      setSearchParams({ tab: "challenges" }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [links, setLinks] = useState({
    paypalUrl: "",
    revolutUrl: "",
  });
  const [savingLinks, setSavingLinks] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState("");
  const [challengePlatform, setChallengePlatform] = useState("");
  const [challengeAmount, setChallengeAmount] = useState("5");

  useEffect(() => {
    setLinks({
      paypalUrl: publicProfile.paypalUrl || "",
      revolutUrl: publicProfile.revolutUrl || "",
    });
  }, [id, publicProfile.paypalUrl, publicProfile.revolutUrl]);

  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter((m) => m.teamA.includes(player.id) || m.teamB.includes(player.id))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [matches, player]);

  const challengeStats = useMemo(() => {
    const completed = publicChallenges
      .filter((challenge) => {
        const belongsToPlayer =
          challenge.challenger_player_id === id ||
          challenge.challenged_player_id === id;
        const verified = Boolean(
          challenge.status === "completed" &&
          challenge.verified_at &&
          challenge.reported_winner_player_id
        );
        const openDispute = Boolean(
          challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
        );

        return belongsToPlayer && verified && !openDispute;
      })
      .sort((a, b) => new Date(b.verified_at || b.created_at) - new Date(a.verified_at || a.created_at));

    let wins = 0;
    let losses = 0;
    let wonValue = 0;
    let lostValue = 0;

    completed.forEach((challenge) => {
      const amount = Number(challenge.amount_cents || 0) / 100;

      if (challenge.reported_winner_player_id === id) {
        wins += 1;
        wonValue += amount;
      } else {
        losses += 1;
        lostValue += amount;
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
      points: completed.reduce((total, challenge) => {
        const amount = Number(challenge.amount_cents || 0) / 100;
        return total + (challenge.reported_winner_player_id === id ? amount : -amount);
      }, 0),
      matchPairings: completed.filter((challenge) => challenge.source === "match_pairing").length,
    };
  }, [publicChallenges, id]);

  const bountyHistory = useMemo(
    () => analyzeBountyHistory(id, players, matches),
    [id, players, matches]
  );

  const bountyAchievements = useMemo(
    () => buildBountyAchievementCatalog(bountyHistory),
    [bountyHistory]
  );

  const unlockedBountyAchievements = useMemo(
    () => bountyAchievements.filter((achievement) => achievement.unlocked),
    [bountyAchievements]
  );

  const challengeInsights = useMemo(() => {
    const completed = challengeStats.completed.filter(
      (challenge) => !(challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
    );
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
      const row = h2h.get(opponentId) || { opponentId, wins: 0, losses: 0, played: 0 };
      const amount = Number(challenge.amount_cents || 0) / 100;
      const won = challenge.reported_winner_player_id === id;
      row.played += 1;
      if (won) {
        row.wins += 1;
      } else {
        row.losses += 1;
      }
      h2h.set(opponentId, row);
    });

    const headToHead = [...h2h.values()]
      .sort((a, b) => b.played - a.played || b.wins - a.wins)
      .slice(0, 5);

    const achievementCatalog = [
      { label: "First Match", detail: "Play 1 match", icon: Gamepad2, unlocked: (player?.totalMatches || 0) >= 1 },
      { label: "Regular", detail: "Play 10 matches", icon: Gamepad2, unlocked: (player?.totalMatches || 0) >= 10 },
      { label: "Veteran", detail: "Play 25 matches", icon: Medal, unlocked: (player?.totalMatches || 0) >= 25 },
      { label: "Grinder", detail: "Play 50 matches", icon: Flame, unlocked: (player?.totalMatches || 0) >= 50 },
      { label: "Centurion", detail: "Play 100 matches", icon: Award, unlocked: (player?.totalMatches || 0) >= 100 },

      { label: "First Blood", detail: "Win 1 match", icon: Trophy, unlocked: (player?.wins || 0) >= 1 },
      { label: "Winner", detail: "Win 10 matches", icon: Trophy, unlocked: (player?.wins || 0) >= 10 },
      { label: "Elite Winner", detail: "Win 25 matches", icon: Crown, unlocked: (player?.wins || 0) >= 25 },
      { label: "Dominant", detail: "Win 50 matches", icon: Star, unlocked: (player?.wins || 0) >= 50 },

      { label: "MVP", detail: "Earn 1 MVP", icon: Crown, unlocked: (player?.mvpCount || 0) >= 1 },
      { label: "MVP x5", detail: "Earn 5 MVPs", icon: Crown, unlocked: (player?.mvpCount || 0) >= 5 },
      { label: "MVP x10", detail: "Earn 10 MVPs", icon: Award, unlocked: (player?.mvpCount || 0) >= 10 },

      { label: "Hot Streak", detail: "3 wins in a row", icon: Flame, unlocked: bestWinStreak >= 3 },
      { label: "On Fire", detail: "5 wins in a row", icon: Flame, unlocked: bestWinStreak >= 5 },
      { label: "Untouchable", detail: "10 wins in a row", icon: Rocket, unlocked: bestWinStreak >= 10 },

      { label: "First Chall", detail: "Win 1 money chall", icon: Swords, unlocked: challengeStats.wins >= 1 },
      { label: "Chall Grinder", detail: "Win 5 money challs", icon: Swords, unlocked: challengeStats.wins >= 5 },
      { label: "Chall Veteran", detail: "Win 10 money challs", icon: Medal, unlocked: challengeStats.wins >= 10 },
      { label: "Chall King", detail: "Win 25 money challs", icon: Crown, unlocked: challengeStats.wins >= 25 },

      { label: "In The Money", detail: "Win €25 in verified challs", icon: Coins, unlocked: challengeStats.wonValue >= 25 },
      { label: "Money Maker", detail: "Win €50 in verified challs", icon: CreditCard, unlocked: challengeStats.wonValue >= 50 },
      { label: "Big Earner", detail: "Win €100 in verified challs", icon: Award, unlocked: challengeStats.wonValue >= 100 },
      { label: "High Roller", detail: "Win €250 in verified challs", icon: Crown, unlocked: challengeStats.wonValue >= 250 },

      { label: "Clean Payout", detail: "3 clean settled payouts", icon: ShieldCheck, unlocked: reputation === 100 && settled.length >= 3 },
      { label: "Trusted", detail: "10 clean settled payouts", icon: Shield, unlocked: reputation === 100 && settled.length >= 10 },

      { label: "Bronze Rank", detail: "Reach 900 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 900 },
      { label: "Silver Rank", detail: "Reach 1000 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 1000 },
      { label: "Gold Rank", detail: "Reach 1100 Elo", icon: Trophy, unlocked: (player?.peakElo || 0) >= 1100 },
      { label: "Platinum Rank", detail: "Reach 1200 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 1200 },
      { label: "Masters", detail: "Reach 1350 Elo", icon: Crown, unlocked: (player?.peakElo || 0) >= 1350 },
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

  const trophyCabinet = useMemo(() => {
    if (!player) return [];

    const awards = [];

    if (Number(player.mvpCount || 0) > 0) {
      awards.push({
        id: "mvp",
        type: "mvp",
        title: "MVP",
        detail: `Received ${player.mvpCount} ${player.mvpCount === 1 ? "time" : "times"}`,
        count: Number(player.mvpCount || 0),
        emoji: "🏆",
      });
    }

    if (Number(player.merdaCount || 0) > 0) {
      awards.push({
        id: "merda",
        type: "merda",
        title: "MERDA",
        detail: `Received ${player.merdaCount} ${player.merdaCount === 1 ? "time" : "times"}`,
        count: Number(player.merdaCount || 0),
        emoji: "💩",
      });
    }

    return awards;
  }, [player]);

  if (!player) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <div className="text-xl font-display font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-magma hover:underline">Back to players</Link>
      </div>
    );
  }

  const tier = tierOf(player.currentElo);
  const rankPreview = rankProgress(player.currentElo);
  const saveLinks = async () => {
    setSavingLinks(true);
    const ok = await saveMyChallengeLinks(links);
    setSavingLinks(false);
    if (ok) toast.success("Challenge links updated");
  };

  const openChallengeAmount = () => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord and link your player before sending a challenge");
      return;
    }
    setChallengePlatform("paypal");
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
    <div className="m8-page-stack">
      <Link to="/players" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white self-start m8-pill order-0">
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
            <Label className="text-xs text-muted-foreground">Payment method</Label>
            <div className="grid grid-cols-2 gap-2 mt-1 mb-4">
              {[
                ["paypal", "PayPal"],
                ["revolut", "Revolut"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChallengePlatform(key)}
                  className={`h-10 rounded-lg border text-xs font-bold ${
                    challengePlatform === key
                      ? "bg-[#D5A33A] text-black border-[#D5A33A]"
                      : "bg-[#151923] border-[#2A303B] text-[#C8CED8]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <Label className="text-xs text-muted-foreground">Amount (€)</Label>
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

      <section className="m8-profile-hero rounded-[24px] overflow-hidden relative order-1">
        <div className="m8-profile-banner">
          <div className="m8-profile-grid" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#10151D] to-transparent" />
        </div>

        <div className="relative z-10 px-5 sm:px-7 pb-6">
          <div className="-mt-10 sm:-mt-12 flex flex-col lg:flex-row lg:items-end gap-5">
            <div className="relative shrink-0 self-start">
              <div className="absolute -inset-2 rounded-[26px] bg-magma/10 blur-xl" />
              <div className="relative rounded-[24px] border-4 border-[#10151D] shadow-2xl overflow-hidden">
                <PlayerAvatar
                  name={player.name}
                  elo={player.currentElo}
                  size={104}
                  avatarUrl={playerAvatars[player.id]}
                />
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <div className="brand-kicker mb-1">{isOwnProfile ? "My Competitive Profile" : "Competitive Player Profile"}</div>
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-4">
                <h2 className="font-display text-3xl sm:text-[42px] leading-none font-black tracking-[-0.045em] truncate">
                  {player.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 pb-0.5">
                  <RankBadge elo={player.currentElo} />
                  <StreakBadge streak={player.currentStreak} />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-[#8A94A4]">
                <span><strong className="text-white font-mono">{player.currentElo}</strong> Elo</span>
                <span>{player.totalMatches || 0} matches</span>
                <span>{challengeStats.wins + challengeStats.losses} challs</span>
                <span>{player.mvpCount || 0} MVP</span>
                <span>{player.merdaCount || 0} 💩</span>
              </div>
            </div>

            {!isOwnProfile && (
              <Button
                onClick={openChallengeAmount}
                className="m8-action m8-action-primary h-11 px-6 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold tracking-wide"
                data-testid="challenge-me-btn"
              >
                <Swords size={17} className="mr-2" /> CHALL ME
              </Button>
            )}
          </div>

          <div className="m8-profile-stat-strip mt-6">
            {[
              { label: "Current Elo", value: player.currentElo, tone: "text-white" },
              { label: "Peak Elo", value: player.peakElo, tone: "text-[#D5A33A]" },
              { label: "Match Record", value: `${player.wins || 0}W - ${player.losses || 0}L`, tone: "text-white" },
              { label: "Win Rate", value: `${winRate(player)}%`, tone: "text-white" },
              { label: "Money Won", value: `€${challengeStats.wonValue.toFixed(2)}`, tone: "text-emerald-400" },
              { label: "Chall Record", value: `${challengeStats.wins}W - ${challengeStats.losses}L`, tone: "text-white" },
            ].map((item) => (
              <div key={item.label} className="m8-profile-stat">
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181] font-bold">{item.label}</div>
                <div className={`font-mono font-black text-base sm:text-lg mt-1 ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-[#697181]">Recent form</span>
            <Last10 record={player.last10} />
            <MvpBadge count={player.mvpCount} />
            <MerdaBadge count={player.merdaCount} />
            <span className="ml-auto hidden sm:inline-flex m8-pill">
              {tier.name} · {player.currentElo} Elo
            </span>
          </div>
        </div>
      </section>

      {isOwnProfile && (
        <div className="m8-profile-tabs order-2" role="tablist" aria-label="My Profile sections">
          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "overview"}
            onClick={() => setProfileTab("overview")}
            className={`m8-profile-tab ${profileTab === "overview" ? "is-active" : ""}`}
            data-testid="profile-tab-overview"
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "challenges"}
            onClick={() => setProfileTab("challenges")}
            className={`m8-profile-tab ${profileTab === "challenges" ? "is-active" : ""}`}
            data-testid="profile-tab-challenges"
          >
            My Challenges
            {myChallenges.some((challenge) =>
              ["pending", "accepted", "result_pending", "disputed"].includes(challenge.status)
            ) && (
              <span className="w-1.5 h-1.5 rounded-full bg-magma shadow-[0_0_10px_rgba(255,42,59,.65)]" />
            )}
          </button>
        </div>
      )}

      {(!isOwnProfile || profileTab === "overview") && (
      <section className="m8-rank-spotlight rounded-[22px] p-5 sm:p-7 overflow-hidden relative order-3" data-testid="player-rank-preview">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center">
          <div>
            <div className="brand-kicker mb-2">Rank Preview</div>
            <h3 className="font-display text-2xl sm:text-4xl font-black tracking-[-0.035em]">
              {player.name} is{" "}
              <span style={{ color: rankPreview.rank.color }}>{rankPreview.rank.name}</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">
              Competitive division based directly on {isOwnProfile ? "your" : player.name + "'s"} current Elo.
            </p>

            <div className="mt-5 max-w-xl">
              <RankProgress elo={player.currentElo} />
            </div>

            <div className="mt-3 text-sm text-muted-foreground">
              {rankPreview.next
                ? rankPreview.eloNeeded + " Elo to reach " + rankPreview.next.name + "."
                : "Highest competitive division reached."}
            </div>
          </div>

          <div className="rounded-2xl bg-[#090C11]/75 border border-[#2A303B] p-6 flex items-center justify-center min-h-[210px] shadow-[inset_0_0_40px_rgba(255,255,255,0.018)]">
            <div className="w-full max-w-[280px]">
              <RankEmblem elo={player.currentElo} />
            </div>
          </div>
        </div>
      </section>
      )}

      {(!isOwnProfile) && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-4" data-testid="challenge-profile-stats">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Competitive Stats</div>
            <h3 className="font-display text-xl font-black tracking-[-0.02em]">Chall Performance · {challengeStats.wins}W - {challengeStats.losses}L</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Every verified match keeps its real win/loss value. ReChall settlement is tracked separately.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            <div className="m8-stat-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Rate</div>
              <div className="font-mono font-bold text-lg mt-1">{challengeStats.winRate}%</div>
            </div>
            <div className="m8-stat-card border-emerald-500/15">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Money Won</div>
              <div className="font-mono font-bold text-lg mt-1 text-emerald-400">€{challengeStats.wonValue.toFixed(2)}</div>
            </div>
            <div className="m8-stat-card border-red-500/15">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Money Lost</div>
              <div className="font-mono font-bold text-lg mt-1 text-red-400">€{challengeStats.lostValue.toFixed(2)}</div>
            </div>
            <div className="m8-stat-card">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Match Pairings</div>
              <div className="font-mono font-bold text-lg mt-1 text-magma">{challengeStats.matchPairings}</div>
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
      )}

      {!isOwnProfile && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 order-5" data-testid="challenge-insights">
        <div className="m8-panel rounded-2xl p-5">
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

        <div className="m8-panel rounded-2xl p-5">
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

        <div className="m8-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="brand-kicker mb-1">Milestones</div>
              <h3 className="font-display font-black text-lg">Achievements</h3>
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
      )}

      {!isOwnProfile && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-7" data-testid="bounty-achievements">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div>
            <div className="brand-kicker mb-1">Match Bounties</div>
            <h3 className="font-display font-bold text-xl">Bounty Achievements</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Special achievements earned by breaking streaks, undefeated duos, underdog matchups and rivalries.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-4 py-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Unlocked</div>
              <div className="font-mono font-bold text-[#D5A33A] mt-0.5">
                {unlockedBountyAchievements.length}/{bountyAchievements.length}
              </div>
            </div>
            <div className="rounded-xl bg-[#D5A33A]/[0.06] border border-[#D5A33A]/20 px-4 py-2 text-center">
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Bounty Points</div>
              <div className="font-mono font-bold text-[#D5A33A] mt-0.5">{bountyHistory.points}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {bountyAchievements.map((achievement) => {
            const progressPct = achievement.target
              ? Math.min(100, Math.round((achievement.progress / achievement.target) * 100))
              : 0;

            return (
              <div
                key={achievement.key}
                className={`rounded-xl border p-3 transition-all ${
                  achievement.unlocked
                    ? "bg-[#D5A33A]/[0.06] border-[#D5A33A]/25"
                    : "bg-[#0F1218] border-[#1D222C]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    achievement.unlocked
                      ? "bg-[#D5A33A]/10 text-[#D5A33A]"
                      : "bg-white/[0.03] text-[#596170]"
                  }`}>
                    {achievement.category === "Duo"
                      ? <UsersRound size={16} />
                      : achievement.category === "Streak"
                        ? <Flame size={16} />
                        : achievement.category === "Upset"
                          ? <Rocket size={16} />
                          : achievement.category === "Rivalry"
                            ? <Swords size={16} />
                            : achievement.category === "Points"
                              ? <Coins size={16} />
                              : <Target size={16} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm truncate">{achievement.label}</div>
                      {achievement.unlocked && <BadgeCheck size={14} className="text-emerald-400 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{achievement.detail}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    <span>{achievement.category}</span>
                    <span>{achievement.progress}/{achievement.target}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1D222C] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        achievement.unlocked ? "bg-[#D5A33A]" : "bg-[#596170]"
                      }`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {bountyHistory.events.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[#1D222C]">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Latest completed bounties</div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {bountyHistory.events.slice(0, 3).map((event) => (
                <div key={event.id} className="m8-stat-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{event.title}</div>
                    <div className="font-mono text-xs font-bold text-[#D5A33A]">+{event.points}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{event.detail}</div>
                  {event.date && (
                    <div className="text-[9px] uppercase tracking-widest text-[#596170] mt-2">
                      {new Date(event.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      )}

      {!isOwnProfile && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-6">
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

                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      )}

      {(!isOwnProfile || profileTab === "overview") && (
      <div className="m8-showcase rounded-[22px] p-4 sm:p-6 order-4" data-testid="trophy-cabinet">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Awards</div>
            <h3 className="font-display font-black text-xl tracking-[-0.02em]">Trophy Cabinet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Only MVP 🏆 and MERDA 💩 awards count here.
            </p>
          </div>
          <Trophy size={20} className="text-[#D5A33A]" />
        </div>

        {trophyCabinet.length === 0 ? (
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-9 px-4 text-center">
            <Trophy size={28} className="text-[#3D4654] mx-auto mb-2" />
            <div className="font-semibold">No awards yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Earn an MVP 🏆 or a MERDA 💩 to appear here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {trophyCabinet.map((trophy) => (
              <div
                key={trophy.id}
                className="rounded-2xl bg-gradient-to-b from-[#171C25] to-[#0D1118] border border-[#D5A33A]/20 p-4 relative overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:border-[#D5A33A]/35"
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: trophy.type === "mvp"
                      ? "linear-gradient(90deg, transparent, #D5A33A, transparent)"
                      : "linear-gradient(90deg, transparent, #8B5E3C, transparent)",
                  }}
                />
                <div className="w-12 h-12 rounded-xl border border-[#2A303B] bg-[#0F1218] flex items-center justify-center text-2xl shadow-[0_8px_24px_rgba(0,0,0,.22)]">
                  <span aria-hidden="true">{trophy.emoji}</span>
                </div>
                <div className="absolute top-3 right-3 px-2 py-1 rounded-lg border border-[#343B48] bg-[#101319] text-xs font-mono font-black">
                  ×{trophy.count}
                </div>
                <div className="font-display font-bold mt-3">{trophy.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{trophy.detail}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {isOwnProfile && profileTab === "challenges" && (
        <div className="m8-panel rounded-2xl p-4 sm:p-5 order-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="brand-kicker mb-1">Payments</div>
              <h3 className="font-display font-bold text-lg">Payment Accounts</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add your PayPal and/or Revolut username. A full link also works.
              </p>
            </div>
            <Link2 size={18} className="text-[#697181] shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-3">
              <Label className="text-xs font-semibold">PayPal</Label>
              <Input
                value={links.paypalUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, paypalUrl: e.target.value }))}
                placeholder="username or paypal.me/username"
                className="mt-2 bg-[#151923] border-[#2A303B]"
                data-testid="my-paypal-link"
              />
              <div className="text-[10px] text-muted-foreground mt-2">
                You can paste only your PayPal.Me username.
              </div>
            </div>

            <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-3">
              <Label className="text-xs font-semibold">Revolut</Label>
              <Input
                value={links.revolutUrl}
                onChange={(e) => setLinks((prev) => ({ ...prev, revolutUrl: e.target.value }))}
                placeholder="username or revolut.me/username"
                className="mt-2 bg-[#151923] border-[#2A303B]"
                data-testid="my-revolut-link"
              />
              <div className="text-[10px] text-muted-foreground mt-2">
                You can paste only your Revolut.me username.
              </div>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <Button
                onClick={saveLinks}
                disabled={savingLinks}
                className="w-full sm:w-auto bg-magma hover:bg-[#ff3c4c] text-white rounded-xl"
                data-testid="save-challenge-links"
              >
                <Save size={15} className="mr-1.5" />
                {savingLinks ? "Saving..." : "Save Payment Accounts"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && profileTab === "challenges" && (
        <div className="m8-panel rounded-2xl p-4 sm:p-5 order-3" data-testid="my-challenges-panel">
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

      {!isOwnProfile && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-8">
        <div className="brand-kicker mb-1">Progression</div>
        <h3 className="font-display font-black text-xl tracking-[-0.02em] mb-4">Elo History</h3>
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
      )}

      {(!isOwnProfile || profileTab === "overview") && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-5">
        <div className="brand-kicker mb-1">Recent Activity</div>
        <h3 className="font-display font-black text-xl tracking-[-0.02em] mb-4">Recent Matches</h3>
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
                  {m.mvpId === player.id && <span title="MVP" aria-label="MVP">🏆</span>}
                  {m.merdaId === player.id && <span title="MERDA">💩</span>}
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
      )}
    </div>
  );
}
