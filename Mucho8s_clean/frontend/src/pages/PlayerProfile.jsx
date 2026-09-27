import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { winRate, tierOf } from "@/lib/elo";
import { duoChemistry } from "@/lib/chemistry";
import { analyzeBountyHistory, buildBountyAchievementCatalog } from "@/lib/bountyAchievements";
import { buildPlayerRivalries } from "@/lib/rivalries";
import {
  TROPHY8S_RULES,
  MAX_TROPHY_LEVEL,
  trophyNextTier,
} from "@/lib/trophyRules";
import { PlayerAvatar, EloBadge, Last10, MerdaBadge, RankProgress } from "@/components/shared";
import ModeBadge, { isDirectMucho1v1 } from "@/components/ModeBadge";
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
  Medal,
  Star,
  Coins,
  Shield,
  Rocket,
  UserCircle,
  Pencil,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";

const TROPHY_FAMILY_STYLES = {
  General: {
    text: "text-[#C8CED8]",
    border: "border-[#343B48]",
    bg: "bg-[#11151C]",
    hover: "hover:border-[#505A69]",
    focus: "focus:ring-[#596170]/30",
    hex: "#8D95A4",
  },
  Trophy8s: {
    text: "text-magma",
    border: "border-magma/25",
    bg: "bg-magma/[0.06]",
    hover: "hover:border-magma/45",
    focus: "focus:ring-magma/30",
    hex: "#FF2A3B",
  },
  Trophy1v1: {
    text: "text-emerald-400",
    border: "border-emerald-500/25",
    bg: "bg-emerald-500/[0.06]",
    hover: "hover:border-emerald-500/45",
    focus: "focus:ring-emerald-500/30",
    hex: "#34D399",
  },
  TrophyRanked: {
    text: "text-[#4F8CFF]",
    border: "border-[#4F8CFF]/25",
    bg: "bg-[#4F8CFF]/[0.06]",
    hover: "hover:border-[#4F8CFF]/45",
    focus: "focus:ring-[#4F8CFF]/30",
    hex: "#4F8CFF",
  },
  TrophyTourney: {
    text: "text-[#D5A33A]",
    border: "border-[#D5A33A]/25",
    bg: "bg-[#D5A33A]/[0.06]",
    hover: "hover:border-[#D5A33A]/45",
    focus: "focus:ring-[#D5A33A]/30",
    hex: "#D5A33A",
  },
};

const trophyFamilyStyle = (source) =>
  TROPHY_FAMILY_STYLES[source] || TROPHY_FAMILY_STYLES.General;

const trophySourceLabel = (trophy) => {
  if (trophy?.type === "mvp") {
    if (trophy?.source === "Trophy1v1") return "Mucho1v1 MVP";
    if (trophy?.source === "TrophyRanked") return "MuchoRanked MVP";
    if (trophy?.source === "TrophyTourney") return "MuchoTourney MVP";
    return "Mucho8s MVP";
  }

  if (trophy?.type === "merda") return "MERDA";
  return "General Trophy";
};

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
  const targetHasPayPal = Boolean(String(publicProfile.paypalUrl || "").trim());
  const targetHasRevolut = Boolean(String(publicProfile.revolutUrl || "").trim());
  const targetHasPayment = targetHasPayPal || targetHasRevolut;
  const isOwnProfile = Boolean(discordSession && discordPlayer?.id === id);
  const requestedTab = searchParams.get("tab");
  const profileTab =
    isOwnProfile && ["mucho8s", "edit", "challenges"].includes(requestedTab)
      ? requestedTab
      : "overview";

  const setProfileTab = (tab) => {
    if (!isOwnProfile) return;
    if (["mucho8s", "edit", "challenges"].includes(tab)) {
      setSearchParams({ tab }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const [links, setLinks] = useState({
    paypalUrl: "",
    revolutUrl: "",
  });
  const [savingLinks, setSavingLinks] = useState(false);
  const [profileRole, setProfileRole] = useState("");
  const [sendingChallenge, setSendingChallenge] = useState("");
  const [challengePlatform, setChallengePlatform] = useState("");
  const [challengeAmount, setChallengeAmount] = useState("5");
  const [selectedTrophyId, setSelectedTrophyId] = useState("");

  useEffect(() => {
    setLinks({
      paypalUrl: publicProfile.paypalUrl || "",
      revolutUrl: publicProfile.revolutUrl || "",
    });
    setProfileRole(["AR", "FLEX", "SMG"].includes(player?.role) ? player.role : "");
  }, [id, publicProfile.paypalUrl, publicProfile.revolutUrl, player?.role]);

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
        const source = String(challenge.source || "").toLowerCase();
        const isDirectMucho1v1 = !["match_pairing", "balancer_pairing"].includes(source);
        const verified = Boolean(
          challenge.status === "completed" &&
          challenge.verified_at &&
          challenge.reported_winner_player_id
        );
        const openDispute = Boolean(
          challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
        );

        return belongsToPlayer && isDirectMucho1v1 && verified && !openDispute;
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
      mvpCount: completed.filter((challenge) => challenge.mvp_awarded === true).length,
      matchPairings: completed.filter((challenge) => challenge.source === "match_pairing").length,
    };
  }, [publicChallenges, id]);

  const mucho8sInsights = useMemo(() => {
    const ordered = [...playerMatches].sort(
      (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
    );

    const resultFor = (match) => {
      const inA = (match.teamA || []).includes(id);
      const winnerSide = match.winner === "B" ? "B" : "A";
      return {
        inA,
        won: (inA && winnerSide === "A") || (!inA && winnerSide === "B"),
        opponents: (inA ? match.teamB : match.teamA) || [],
        pairing: (Array.isArray(match.pairings) ? match.pairings : []).find(
          (pair) => pair?.playerAId === id || pair?.playerBId === id
        ) || null,
      };
    };

    let currentStreak = 0;
    let currentType = "";
    if (ordered.length) {
      const latest = resultFor(ordered[ordered.length - 1]).won ? "W" : "L";
      currentType = latest;
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        const result = resultFor(ordered[index]).won ? "W" : "L";
        if (result !== latest) break;
        currentStreak += 1;
      }
    }

    let bestWinStreak = 0;
    let runningWins = 0;
    let cleanSweepTrigger = null;
    let cleanSweepCount = 0;
    let runItBackCount = 0;
    let wonValue = 0;
    let maxWonPairing = 0;
    let moneyMakerTrigger = null;
    let highRollerTrigger = null;
    let rivalryTrigger = null;
    let nemesisTrigger = null;
    let runItBackTrigger = null;

    const h2h = new Map();
    const lastByOpponent = new Map();

    ordered.forEach((match) => {
      const { won, opponents, pairing } = resultFor(match);

      runningWins = won ? runningWins + 1 : 0;
      bestWinStreak = Math.max(bestWinStreak, runningWins);
      if (runningWins > 0 && runningWins % 4 === 0) {
        cleanSweepCount += 1;
        if (!cleanSweepTrigger) {
          cleanSweepTrigger = { match };
        }
      }

      const amount = Math.max(0, Number(pairing?.amount) || 0);
      if (won && amount > 0) {
        wonValue += amount;
        maxWonPairing = Math.max(maxWonPairing, amount);

        if (!moneyMakerTrigger && wonValue >= 50) {
          moneyMakerTrigger = { match, cumulativeWonValue: wonValue };
        }
        if (!highRollerTrigger && amount >= 20) {
          highRollerTrigger = { match, amount };
        }
      }

      opponents.forEach((opponentId) => {
        const key = String(opponentId);
        const row = h2h.get(key) || {
          opponentId,
          played: 0,
          wins: 0,
          losses: 0,
        };

        row.played += 1;
        if (won) row.wins += 1;
        else row.losses += 1;
        h2h.set(key, row);

        if (!rivalryTrigger && row.played === 8) {
          rivalryTrigger = { match, opponentId };
        }
        if (!nemesisTrigger && row.wins === 4) {
          nemesisTrigger = { match, opponentId };
        }

        const previous = lastByOpponent.get(key);
        if (won && previous?.result === "L") {
          runItBackCount += 1;
          if (!runItBackTrigger) {
            runItBackTrigger = {
              match,
              opponentId,
              previousDate: previous.date,
            };
          }
        }
        lastByOpponent.set(key, {
          result: won ? "W" : "L",
          date: match.date || null,
        });
      });
    });

    const headToHead = [...h2h.values()];
    return {
      currentStreak,
      currentType,
      bestWinStreak,
      wonValue,
      maxWonPairing,
      maxH2HPlayed: headToHead.reduce(
        (best, row) => Math.max(best, Number(row.played || 0)),
        0
      ),
      maxH2HWins: headToHead.reduce(
        (best, row) => Math.max(best, Number(row.wins || 0)),
        0
      ),
      runItBack: Boolean(runItBackTrigger),
      runItBackCount,
      cleanSweepCount,
      triggers: {
        moneyMaker: moneyMakerTrigger,
        highRoller: highRollerTrigger,
        rivalry: rivalryTrigger,
        nemesis: nemesisTrigger,
        cleanSweep: cleanSweepTrigger,
        runItBack: runItBackTrigger,
      },
    };
  }, [playerMatches, id]);

  const rivalries = useMemo(
    () => buildPlayerRivalries(id, matches, publicChallenges),
    [id, matches, publicChallenges]
  );

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

    const allHeadToHead = [...h2h.values()];
    const headToHead = [...allHeadToHead]
      .sort((a, b) => b.played - a.played || b.wins - a.wins)
      .slice(0, 5);

    const maxH2HPlayed = allHeadToHead.reduce((best, row) => Math.max(best, row.played), 0);
    const maxH2HWins = allHeadToHead.reduce((best, row) => Math.max(best, row.wins), 0);
    const maxWonChallenge = completed.reduce((best, challenge) => {
      if (challenge.reported_winner_player_id !== id) return best;
      return Math.max(best, Number(challenge.amount_cents || 0) / 100);
    }, 0);

    let runItBack = false;
    const lastByOpponent = new Map();
    [...completed].reverse().forEach((challenge) => {
      const opponentId =
        challenge.challenger_player_id === id
          ? challenge.challenged_player_id
          : challenge.challenger_player_id;
      if (!opponentId) return;

      const won = challenge.reported_winner_player_id === id;
      const previous = lastByOpponent.get(opponentId);
      if (won && previous === "L") runItBack = true;
      lastByOpponent.set(opponentId, won ? "W" : "L");
    });

    const achievementCatalog = [
      { label: "First Match", detail: "Play 1 match", icon: Gamepad2, unlocked: (player?.totalMatches || 0) >= 1 },
      { label: "Regular", detail: "Play 8 matches", icon: Gamepad2, unlocked: (player?.totalMatches || 0) >= 8 },
      { label: "Veteran", detail: "Play 20 matches", icon: Medal, unlocked: (player?.totalMatches || 0) >= 20 },
      { label: "Grinder", detail: "Play 40 matches", icon: Flame, unlocked: (player?.totalMatches || 0) >= 40 },
      { label: "Centurion", detail: "Play 75 matches", icon: Award, unlocked: (player?.totalMatches || 0) >= 75 },

      { label: "First Blood", detail: "Win 1 match", icon: Trophy, unlocked: (player?.wins || 0) >= 1 },
      { label: "Winner", detail: "Win 8 matches", icon: Trophy, unlocked: (player?.wins || 0) >= 8 },
      { label: "Elite Winner", detail: "Win 20 matches", icon: Crown, unlocked: (player?.wins || 0) >= 20 },
      { label: "Dominant", detail: "Win 40 matches", icon: Star, unlocked: (player?.wins || 0) >= 40 },

      { label: "MVP", detail: "Earn 1 MVP", icon: Crown, unlocked: (player?.mvpCount || 0) >= 1 },
      { label: "MVP x3", detail: "Earn 3 MVPs", icon: Crown, unlocked: (player?.mvpCount || 0) >= 3 },
      { label: "MVP x7", detail: "Earn 7 MVPs", icon: Award, unlocked: (player?.mvpCount || 0) >= 7 },

      { label: "Hot Streak", detail: "3 wins in a row", icon: Flame, unlocked: bestWinStreak >= 3 },
      { label: "On Fire", detail: "4 wins in a row", icon: Flame, unlocked: bestWinStreak >= 4 },
      { label: "Untouchable", detail: "8 wins in a row", icon: Rocket, unlocked: bestWinStreak >= 8 },

      { label: "First Chall", detail: "Win 1 challenge", icon: Swords, unlocked: challengeStats.wins >= 1 },
      { label: "Chall Grinder", detail: "Win 4 challenges", icon: Swords, unlocked: challengeStats.wins >= 4 },
      { label: "Veteran challenges", detail: "Win 10 challenges", icon: Medal, unlocked: challengeStats.wins >= 10 },
      { label: "Chall King", detail: "Win 20 challenges", icon: Crown, unlocked: challengeStats.wins >= 20 },

      { label: "In The Money", detail: "Win 20 value in verified challenges", icon: Coins, unlocked: challengeStats.wonValue >= 20 },
      { label: "Money Maker", detail: "Win 50 value", icon: CreditCard, unlocked: challengeStats.wonValue >= 50 },
      { label: "Big Earner", detail: "Win 100 value", icon: Award, unlocked: challengeStats.wonValue >= 100 },
      { label: "High Roller", detail: "Win 200 value", icon: Crown, unlocked: challengeStats.wonValue >= 200 },

      { label: "Clean Payout", detail: "3 clean settled payouts", icon: ShieldCheck, unlocked: reputation === 100 && settled.length >= 3 },
      { label: "Trusted", detail: "8 clean settled payouts", icon: Shield, unlocked: reputation === 100 && settled.length >= 8 },

      { label: "Bronze Rank", detail: "Reach 900 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 900 },
      { label: "Silver Rank", detail: "Reach 1000 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 1000 },
      { label: "Gold Rank", detail: "Reach 1100 Elo", icon: Medal, unlocked: (player?.peakElo || 0) >= 1100 },
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
      maxH2HPlayed,
      maxH2HWins,
      maxWonChallenge,
      runItBack,
      achievements,
      achievementCatalog,
    };
  }, [challengeStats, id, player]);

  const trophyChallenges = useMemo(() => {
    if (!player) return [];

    const values = {
      "on-fire": mucho8sInsights.bestWinStreak,
      unstoppable: mucho8sInsights.bestWinStreak,
      "money-maker": mucho8sInsights.wonValue,
      "high-roller": mucho8sInsights.maxWonPairing,
      rivalry: mucho8sInsights.maxH2HPlayed,
      nemesis: mucho8sInsights.maxH2HWins,
      "clean-sweep": mucho8sInsights.cleanSweepCount,
      veteran: Number(player.totalMatches || 0),
      "run-it-back": mucho8sInsights.runItBackCount,
    };

    return Object.values(TROPHY8S_RULES).map((rule) => {
      const value = Number(values[rule.id] || 0);
      const tier = trophyNextTier(rule, value);

      return {
        ...rule,
        source: "General",
        value,
        level: tier.level,
        nextLevel: tier.nextLevel,
        goal: tier.goal,
        reward: tier.reward,
        complete: tier.complete,
        progress: tier.progress,
        unlocked: tier.level > 0,
        unit: rule.unit || "",
        description: tier.complete
          ? `${rule.description} · Level X complete`
          : `${rule.description} · Level ${tier.nextLevel}/${MAX_TROPHY_LEVEL}`,
      };
    });
  }, [player, mucho8sInsights]);

  const nextTrophyChallenges = useMemo(
    () =>
      trophyChallenges
        .filter((item) => !item.complete)
        .sort((a, b) => b.progress - a.progress || a.goal - b.goal)
        .slice(0, 3),
    [trophyChallenges]
  );

  const trophyCabinet = useMemo(() => {
    if (!player) return [];

    const awards = [];

    if (Number(player.mvpCount || 0) > 0) {
      awards.push({
        id: "mvp",
        type: "mvp",
        title: "MVP",
        detail: `Automatic every 3 wins in a row · ${player.mvpCount} ${player.mvpCount === 1 ? "MVP" : "MVP"}`,
        count: Number(player.mvpCount || 0),
        emoji: null,
        iconType: "trophy",
        source: "Trophy8s",
      });
    }

    if (Number(challengeStats.mvpCount || 0) > 0) {
      awards.push({
        id: "mvp-mucho1v1",
        type: "mvp",
        title: "MVP",
        detail: `Mucho1v1 MVP milestones · ${challengeStats.mvpCount} MVP`,
        count: Number(challengeStats.mvpCount || 0),
        emoji: null,
        iconType: "trophy",
        source: "Trophy1v1",
      });
    }

    if (Number(player.merdaCount || 0) > 0) {
      awards.push({
        id: "merda",
        type: "merda",
        title: "MERDA",
        detail: `Active x${player.merdaCount} · ogni 3 wins in a row ne elimini 1`,
        count: Number(player.merdaCount || 0),
        emoji: "💩",
        source: "General",
      });
    }

    trophyChallenges
      .filter((item) => item.level > 0)
      .forEach((item) => {
        awards.push({
          id: item.id,
          type: "achievement",
          title: `${item.title} ${item.level >= MAX_TROPHY_LEVEL ? "X" : item.level}`,
          detail: item.complete
            ? `Level X complete · ${item.description}`
            : `Level ${item.level}/${MAX_TROPHY_LEVEL} · next at ${item.goal}${item.unit}`,
          count: item.level,
          emoji: item.emoji,
          source: "General",
        });
      });

    return awards;
  }, [player, trophyChallenges]);

  const generalTrophyCount = useMemo(
    () =>
      trophyChallenges.reduce(
        (sum, trophy) => sum + Math.max(0, Number(trophy.level || 0)),
        0
      ),
    [trophyChallenges]
  );

  const mvpModeCounts = useMemo(
    () => ({
      Trophy8s: Math.max(0, Number(player?.mvpCount || 0)),
      Trophy1v1: Math.max(0, Number(challengeStats.mvpCount || 0)),
      TrophyRanked: Math.max(0, Number(player?.mvpRankedCount || 0)),
      TrophyTourney: Math.max(0, Number(player?.mvpTourneyCount || 0)),
    }),
    [
      player?.mvpCount,
      player?.mvpRankedCount,
      player?.mvpTourneyCount,
      challengeStats.mvpCount,
    ]
  );

  const myChallenges = isOwnProfile && player
    ? challenges.filter(
        (challenge) =>
          isDirectMucho1v1(challenge) &&
          (
            challenge.challenger_player_id === player.id ||
            challenge.challenged_player_id === player.id
          )
      )
    : [];

  const trophyEvidence = useMemo(() => {
    if (!player) return {};

    const byId = {};
    const chronologicalMatches = [...playerMatches].sort(
      (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
    );

    const opponentName = (opponentId) =>
      playerMap?.[opponentId]?.name || "Unknown player";

    const matchEvent = (match, extra = {}) => {
      const inA = (match.teamA || []).includes(id);
      const opponents = (inA ? match.teamB : match.teamA) || [];
      const winnerSide = match.winner === "B" ? "B" : "A";
      const won = (inA && winnerSide === "A") || (!inA && winnerSide === "B");
      const pairing = (Array.isArray(match.pairings) ? match.pairings : []).find(
        (pair) => pair?.playerAId === id || pair?.playerBId === id
      );

      return {
        id: String(match.id || `match-${match.date || "unknown"}`),
        date: match.date || null,
        opponent: opponents.map(opponentName).join(" · ") || "Opponent team",
        result: won ? "Win" : "Loss",
        context: ["Mucho8s", match.game, match.mode].filter(Boolean).join(" · "),
        stake: Math.max(0, Number(pairing?.amount) || 0),
        platform: String(pairing?.platform || "").toLowerCase(),
        ...extra,
      };
    };

    byId.mvp = chronologicalMatches
      .filter(
        (match) =>
          (Array.isArray(match.mvpIds) && match.mvpIds.includes(id)) ||
          match.mvpId === id
      )
      .map((match, index) =>
        matchEvent(match, {
          note: `MVP #${index + 1} · Mucho8s 3-win streak reward`,
        })
      );

    byId["mvp-mucho1v1"] = myChallenges
      .filter(
        (challenge) =>
          challenge.status === "completed" &&
          challenge.verified_at &&
          challenge.mvp_awarded === true
      )
      .map((challenge, index) => {
        const opponentId =
          challenge.challenger_player_id === id
            ? challenge.challenged_player_id
            : challenge.challenger_player_id;

        return {
          id: String(challenge.id || `mucho1v1-mvp-${index}`),
          date: challenge.verified_at || challenge.updated_at || challenge.created_at,
          opponent: opponentName(opponentId),
          result:
            challenge.reported_winner_player_id === id ? "Win" : "Loss",
          context: "Mucho1v1",
          stake: Math.max(0, Number(challenge.amount_cents || 0) / 100),
          platform: String(challenge.platform || "").toLowerCase(),
          note: `MVP #${index + 1} · Mucho1v1 3-win streak reward`,
        };
      });

    byId.merda = chronologicalMatches
      .filter(
        (match) =>
          (Array.isArray(match.merdaIds) && match.merdaIds.includes(id)) ||
          match.merdaId === id
      )
      .map((match, index) =>
        matchEvent(match, {
          note: `MERDA #${index + 1} · Mucho8s 3-loss streak penalty`,
        })
      );

    const findMatchStreakTrigger = (goal, note) => {
      let streak = 0;
      for (const match of chronologicalMatches) {
        const inA = (match.teamA || []).includes(id);
        const winnerSide = match.winner === "B" ? "B" : "A";
        const won = (inA && winnerSide === "A") || (!inA && winnerSide === "B");
        streak = won ? streak + 1 : 0;
        if (streak === goal) {
          return [matchEvent(match, { note })];
        }
      }
      return [];
    };

    byId["on-fire"] = findMatchStreakTrigger(
      4,
      "Unlocked after a 4-win Mucho8s streak"
    );
    byId.unstoppable = findMatchStreakTrigger(
      8,
      "Unlocked after an 8-win Mucho8s streak"
    );
    byId["clean-sweep"] = findMatchStreakTrigger(
      4,
      "Unlocked after 4 consecutive Mucho8s wins"
    );

    if (chronologicalMatches.length >= 40) {
      byId.veteran = [
        matchEvent(chronologicalMatches[39], {
          note: "This was the 40th recorded Mucho8s match",
        }),
      ];
    } else {
      byId.veteran = [];
    }

    const moneyMakerTrigger = mucho8sInsights.triggers.moneyMaker;
    byId["money-maker"] = moneyMakerTrigger
      ? [
          matchEvent(moneyMakerTrigger.match, {
            note: `This win pushed Mucho8s pairing winnings to €${Number(
              moneyMakerTrigger.cumulativeWonValue || 0
            ).toFixed(2)}`,
          }),
        ]
      : [];

    const highRollerTrigger = mucho8sInsights.triggers.highRoller;
    byId["high-roller"] = highRollerTrigger
      ? [
          matchEvent(highRollerTrigger.match, {
            note: `Won a Mucho8s pairing worth €${Number(
              highRollerTrigger.amount || 0
            ).toFixed(2)}`,
          }),
        ]
      : [];

    const rivalryTrigger = mucho8sInsights.triggers.rivalry;
    byId.rivalry = rivalryTrigger
      ? [
          matchEvent(rivalryTrigger.match, {
            opponent: opponentName(rivalryTrigger.opponentId),
            note: `8th Mucho8s meeting against ${opponentName(
              rivalryTrigger.opponentId
            )}`,
          }),
        ]
      : [];

    const nemesisTrigger = mucho8sInsights.triggers.nemesis;
    byId.nemesis = nemesisTrigger
      ? [
          matchEvent(nemesisTrigger.match, {
            opponent: opponentName(nemesisTrigger.opponentId),
            note: `4th Mucho8s win against ${opponentName(
              nemesisTrigger.opponentId
            )}`,
          }),
        ]
      : [];

    const runItBackTrigger = mucho8sInsights.triggers.runItBack;
    byId["run-it-back"] = runItBackTrigger
      ? [
          matchEvent(runItBackTrigger.match, {
            opponent: opponentName(runItBackTrigger.opponentId),
            note: `Beat ${opponentName(
              runItBackTrigger.opponentId
            )} in the next Mucho8s meeting after losing to them`,
            previousDate: runItBackTrigger.previousDate,
          }),
        ]
      : [];

    const tierHistory = {};
    chronologicalMatches.forEach((match) => {
      const events = Array.isArray(match?.trophyUnlockEvents?.[id])
        ? match.trophyUnlockEvents[id]
        : [];

      events.forEach((event) => {
        const trophyId = String(event?.id || "");
        if (!trophyId) return;
        if (!tierHistory[trophyId]) tierHistory[trophyId] = [];

        tierHistory[trophyId].push(
          matchEvent(match, {
            level: Number(event?.level || 1),
            reward: Number(event?.reward || 0),
            rewardApplied: event?.rewardApplied === true,
            note: `Level ${Number(event?.level || 1)} unlocked · target ${Number(
              event?.goal || 0
            )} · ${event?.rewardApplied === true ? `+${Number(event?.reward || 0)} Elo` : "legacy unlock"}`,
          })
        );
      });
    });

    Object.entries(tierHistory).forEach(([trophyId, events]) => {
      byId[trophyId] = events;
    });

    return byId;
  }, [player, playerMatches, playerMap, id, mucho8sInsights, myChallenges]);

  const selectedTrophy = trophyCabinet.find(
    (trophy) => trophy.id === selectedTrophyId
  ) || null;
  const selectedTrophyEvents = selectedTrophy
    ? trophyEvidence[selectedTrophy.id] || []
    : [];

  if (!player) {
    return (
      <div className="card-surface rounded-xl p-10 text-center">
        <div className="text-xl font-display font-bold mb-2">Player not found</div>
        <Link to="/players" className="text-magma hover:underline">Back to players</Link>
      </div>
    );
  }

  const tier = tierOf(player.currentElo);
  const saveLinks = async () => {
    setSavingLinks(true);
    const ok = await saveMyChallengeLinks({
      ...links,
      role: profileRole,
    });
    setSavingLinks(false);
    if (ok) toast.success("Profile updated");
  };

  const openChallengeAmount = () => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord and link your player before sending a challenge");
      return;
    }
    setChallengePlatform(
      targetHasPayPal ? "paypal" : targetHasRevolut ? "revolut" : "unavailable"
    );
    setChallengeAmount("5");
  };

  const sendChallenge = async () => {
    if (!targetHasPayment || !["paypal", "revolut"].includes(challengePlatform)) {
      toast.error("This player has not linked an available payment method");
      return;
    }

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
      toast.success(`Mucho1v1 sent to ${player.name} · €${amount.toFixed(2)}`);
    }
  };

  return (
    <div className="m8-page-stack">
      <Link to="/players" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-white self-start m8-pill order-0">
        <ArrowLeft size={16} /> Back to players
      </Link>

      <Dialog open={Boolean(challengePlatform)} onOpenChange={(open) => !open && !sendingChallenge && setChallengePlatform("")}>
        <DialogContent
          className="bg-[#101319] border-[#242A35] rounded-2xl sm:max-w-md"
          data-testid="challenge-amount-dialog"
        >
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <ModeBadge mode="mucho1v1" compact />
            </div>
            <DialogTitle className="font-display text-xl">Mucho1v1 · {player.name}</DialogTitle>
            <DialogDescription>
              Choose the stake and one of the payment methods linked by this player.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl bg-[#0F1218] border border-[#222834] p-4">
            <Label className="text-xs text-muted-foreground">Payment method</Label>
            <div className="grid grid-cols-2 gap-2 mt-1 mb-4">
              {[
                ["paypal", "PayPal", targetHasPayPal],
                ["revolut", "Revolut", targetHasRevolut],
              ].map(([key, label, available]) => (
                <button
                  key={key}
                  type="button"
                  disabled={!available}
                  onClick={() => setChallengePlatform(key)}
                  title={available ? `${label} linked` : `${label} not linked`}
                  className={`h-10 rounded-lg border text-xs font-bold transition-all ${
                    !available
                      ? "bg-[#11151C] border-[#202631] text-[#555E6B] cursor-not-allowed"
                      : challengePlatform === key
                        ? "bg-emerald-400 text-black border-emerald-400"
                        : "bg-[#151923] border-[#2A303B] text-[#C8CED8] hover:border-emerald-500/30"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={`text-[10px] mb-4 ${
              targetHasPayment ? "text-emerald-400" : "text-red-400"
            }`}>
              {targetHasPayPal && targetHasRevolut
                ? "Available: PayPal · Revolut"
                : targetHasPayPal
                  ? "Available: PayPal only"
                  : targetHasRevolut
                    ? "Available: Revolut only"
                    : "No payment method linked by this player"}
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
              disabled={
                Boolean(sendingChallenge) ||
                !targetHasPayment ||
                !["paypal", "revolut"].includes(challengePlatform)
              }
              className="w-full sm:w-auto bg-emerald-400 hover:bg-emerald-300 disabled:bg-emerald-900/60 disabled:text-emerald-200/40 text-black rounded-xl font-black"
              data-testid="send-challenge-confirm"
            >
              <Swords size={16} className="mr-2" />
              {sendingChallenge ? "Sending..." : "Send Mucho1v1"}
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
              <div className="brand-kicker mb-2">
                {isOwnProfile ? "My Competitive Profile" : "Competitive Player Profile"}
              </div>

              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181] font-bold">
                    Name
                  </div>
                  <div className="font-display text-3xl sm:text-[38px] leading-none font-black tracking-[-0.04em] truncate mt-1">
                    {player.name}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181] font-bold">
                    Rank
                  </div>
                  <div
                    className="font-display text-sm sm:text-base font-black uppercase mt-1"
                    style={{ color: tier.color }}
                  >
                    {tier.name}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181] font-bold">
                    Elo
                  </div>
                  <div className="font-mono text-sm sm:text-base font-black text-white mt-1">
                    {player.currentElo}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-[#697181] font-bold">
                    Role
                  </div>
                  <div className="font-display text-sm sm:text-base font-black uppercase text-white mt-1">
                    {player.role || "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-[#8A94A4]">
                <span className="text-[#C8CED8]">{player.totalMatches || 0} matches</span>
              </div>

              <div className="mt-4 max-w-xl">
                <RankProgress elo={player.currentElo} />
              </div>
            </div>

            {!isOwnProfile && (
              <Button
                onClick={openChallengeAmount}
                className="m8-action m8-action-primary h-11 px-6 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white font-extrabold tracking-wide"
                data-testid="challenge-me-btn"
              >
                <Swords size={17} className="mr-2" /> MUCHO1V1
              </Button>
            )}
          </div>

          <div className="m8-profile-stat-strip mt-6">
            {[
              {
                label: "Mucho8s Matches",
                value: Number(player.totalMatches || 0),
                tone: "text-white",
              },
              {
                label: "Peak Elo",
                value: player.peakElo,
                tone: "text-[#D5A33A]",
              },
              {
                label: "Mucho8s Record",
                value: `${player.wins || 0}W - ${player.losses || 0}L`,
                tone: "text-white",
              },
              {
                label: "Win Rate",
                value: `${winRate(player)}%`,
                tone: "text-white",
              },
              {
                label: "Total Winnings",
                value: `€${(
                  Number(mucho8sInsights.wonValue || 0) +
                  Number(challengeStats.wonValue || 0)
                ).toFixed(0)}`,
                tone: "text-emerald-400",
              },
              {
                label: "Best Win Streak",
                value: mucho8sInsights.bestWinStreak
                  ? `${mucho8sInsights.bestWinStreak}W`
                  : "—",
                tone: "text-magma",
              },
            ].map((item) => (
              <div key={item.label} className="m8-profile-stat">
                <div className="text-[9px] uppercase tracking-[0.16em] text-[#697181] font-bold">
                  {item.label}
                </div>
                <div className={`font-mono font-black text-base sm:text-lg mt-1 ${item.tone}`}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-[#697181]">Forma recente</span>
            <Last10 record={player.last10} />

            <span className="hidden sm:inline text-[#2F3743]">·</span>

            <div className="flex flex-wrap items-center gap-3">
              <span
                title="General Trophies"
                className="inline-flex items-center gap-1.5 text-[#C8CED8]"
              >
                <Trophy size={13} />
                <strong className="font-mono text-xs font-black">
                  {generalTrophyCount}
                </strong>
              </span>

              <span className="text-[9px] uppercase tracking-widest text-[#596170]">
                MVP
              </span>

              {[
                ["Trophy8s", "bg-magma", "text-magma", "Mucho8s MVP"],
                ["Trophy1v1", "bg-emerald-400", "text-emerald-400", "Mucho1v1 MVP"],
                ["TrophyRanked", "bg-[#4F8CFF]", "text-[#4F8CFF]", "MuchoRanked MVP"],
                ["TrophyTourney", "bg-[#D5A33A]", "text-[#D5A33A]", "MuchoTourney MVP"],
              ].map(([family, dotClass, textClass, label], index) => (
                <React.Fragment key={family}>
                  {index > 0 && <span className="text-[#3D4654]">·</span>}
                  <span
                    title={label}
                    aria-label={`${label}: ${mvpModeCounts[family] || 0}`}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${dotClass} shadow-[0_0_8px_currentColor]`}
                      aria-hidden="true"
                    />
                    <strong className={`font-mono text-xs font-black ${textClass}`}>
                      {mvpModeCounts[family] || 0}
                    </strong>
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div className="ml-auto pl-2 border-l border-[#242A35]">
              <MerdaBadge count={player.merdaCount} />
            </div>
          </div>
        </div>
      </section>

      {isOwnProfile && (
        <div
          className="order-2 grid grid-cols-2 sm:grid-cols-3 xl:inline-grid xl:grid-cols-6 gap-1 p-1 rounded-2xl bg-[#0F1218] border border-[#242A35] w-full xl:w-fit"
          role="tablist"
          aria-label="My Profile sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "overview"}
            onClick={() => setProfileTab("overview")}
            className={`h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              profileTab === "overview"
                ? "bg-white text-black shadow-sm"
                : "text-[#9DA5B4] hover:text-white hover:bg-white/[0.04]"
            }`}
            data-testid="profile-tab-overview"
          >
            <UserCircle size={16} />
            Profile
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "edit"}
            onClick={() => setProfileTab("edit")}
            className={`h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              profileTab === "edit"
                ? "bg-white text-black shadow-sm"
                : "text-[#9DA5B4] hover:text-white hover:bg-white/[0.04]"
            }`}
            data-testid="profile-tab-edit"
          >
            <Pencil size={15} />
            Edit Profile
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "mucho8s"}
            onClick={() => setProfileTab("mucho8s")}
            className={`h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold transition-all ${
              profileTab === "mucho8s"
                ? "bg-magma text-white shadow-sm"
                : "text-[#9DA5B4] hover:text-white hover:bg-white/[0.04]"
            }`}
            data-testid="profile-tab-mucho8s"
          >
            <Gamepad2 size={16} />
            Mucho8s
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={profileTab === "challenges"}
            onClick={() => setProfileTab("challenges")}
            className={`h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold transition-all relative ${
              profileTab === "challenges"
                ? "bg-emerald-400 text-black shadow-sm"
                : "text-[#9DA5B4] hover:text-white hover:bg-white/[0.04]"
            }`}
            data-testid="profile-tab-challenges"
          >
            <Swords size={16} />
            Mucho1v1
            {myChallenges.some((challenge) =>
              ["pending", "accepted", "result_pending", "disputed"].includes(challenge.status)
            ) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.55)]" />
            )}
          </button>

          <button
            type="button"
            role="tab"
            disabled
            title="MuchoRanked · Coming Soon"
            className="h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold text-[#4F8CFF]/65 border border-[#4F8CFF]/10 bg-[#4F8CFF]/[0.025] cursor-not-allowed"
            data-testid="profile-tab-ranked"
          >
            <Medal size={16} />
            <span>MuchoRanked</span>
            <span className="text-[7px] uppercase tracking-wider opacity-70">Soon</span>
          </button>

          <button
            type="button"
            role="tab"
            disabled
            title="MuchoTourney · Coming Soon"
            className="h-11 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold text-[#D5A33A]/65 border border-[#D5A33A]/10 bg-[#D5A33A]/[0.025] cursor-not-allowed"
            data-testid="profile-tab-tourney"
          >
            <Trophy size={16} />
            <span>MuchoTourney</span>
            <span className="text-[7px] uppercase tracking-wider opacity-70">Soon</span>
          </button>
        </div>
      )}

      {(!isOwnProfile || profileTab === "overview") && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 order-6">
            <div className="m8-panel rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="brand-kicker mb-1">Rivalries</div>
                  <h3 className="font-display font-bold text-lg">Head-to-Head</h3>
                </div>
                <Link
                  to="/rivalries"
                  className="text-[10px] uppercase tracking-widest text-[#697181] hover:text-white"
                >
                  View all
                </Link>
              </div>

              {rivalries.length === 0 ? (
                <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-6 text-center text-xs text-muted-foreground">
                  No verified rivals yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {rivalries.slice(0, 3).map((row) => {
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
                          size={34}
                          avatarUrl={playerAvatars[row.opponentId]}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm truncate">{opponent?.name || "Player"}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {row.meetings} meetings · {row.teamMeetings} Mucho8s · {row.directMeetings} Mucho1v1
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm font-black">
                            <span className="text-emerald-400">{row.wins}W</span>
                            <span className="text-muted-foreground mx-1">-</span>
                            <span className="text-red-400">{row.losses}L</span>
                          </div>
                          {row.moneyVolume > 0 && (
                            <div className="font-mono text-[10px] mt-1 text-emerald-400">
                              {row.moneyNet >= 0 ? "+" : "-"}€{Math.abs(row.moneyNet).toFixed(0)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="m8-panel rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="brand-kicker mb-1 text-magma">Mucho8s</div>
                  <h3 className="font-display font-bold text-lg">Mucho8s Points</h3>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-[#C8CED8]">
                    {unlockedBountyAchievements.length}/{bountyAchievements.length}
                  </div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    {bountyHistory.points} points
                  </div>
                </div>
              </div>

              {bountyHistory.events.length === 0 ? (
                <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-6 text-center text-xs text-muted-foreground">
                  No Mucho8s point events yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {bountyHistory.events.slice(0, 3).map((event) => (
                    <div key={event.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-3 py-2.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-magma/[0.07] border border-magma/15 flex items-center justify-center text-magma">
                        <Target size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{event.title}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{event.detail}</div>
                      </div>
                      <div className="font-mono text-xs font-black text-[#C8CED8]">+{event.points}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {(!isOwnProfile || profileTab === "overview") && nextTrophyChallenges.length > 0 && (
        <div
          className="m8-panel rounded-[22px] p-4 sm:p-5 order-4"
          data-testid="next-trophy-challenges"
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1 text-[#AEB6C3]">Trophy Progress</div>
              <h3 className="font-display font-black text-xl tracking-[-0.02em]">
                Next Trophies
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                General challenges level up to X. Requirements grow every level and rewards scale from +3 to +15 Elo.
              </p>
            </div>
            <span className="m8-pill text-[#C8CED8] border-[#343B48]">General</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {nextTrophyChallenges.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#2C333E] bg-[#0F1218] p-4 relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8D95A4] to-transparent" />

                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl border border-[#343B48] bg-[#11151C] flex items-center justify-center text-xl">
                    <span aria-hidden="true">{item.emoji}</span>
                  </div>
                  <span className="font-mono text-[10px] font-black text-[#C8CED8]">
                    Lv {item.nextLevel}/{MAX_TROPHY_LEVEL} · {item.value}/{item.goal}
                  </span>
                </div>

                <div className="font-display font-black mt-3">{item.title}</div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-5">
                  {item.description}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[9px] uppercase tracking-wider mb-1.5">
                    <span className="text-[#697181]">Progress</span>
                    <span className="font-black text-[#C8CED8]">{item.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full border border-[#242A35] bg-[#090C11] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8D95A4] transition-all duration-500"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 text-[10px] font-black text-[#C8CED8]">
                  +{item.reward} Elo on unlock
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!isOwnProfile || profileTab === "overview") && (
      <div className="m8-showcase rounded-[22px] p-4 sm:p-6 order-4" data-testid="trophy-cabinet">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Awards</div>
            <h3 className="font-display font-black text-xl tracking-[-0.02em]">Trophy Cabinet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              General Trophies, mode MVPs, active MERDA 💩 and verified unlock history.
            </p>
          </div>
          <Trophy size={20} className="text-[#C8CED8]" />
        </div>

        {trophyCabinet.length === 0 ? (
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-9 px-4 text-center">
            <Trophy size={28} className="text-[#3D4654] mx-auto mb-2" />
            <div className="font-semibold">No awards yet</div>
            <div className="text-xs text-muted-foreground mt-1">
              Unlock a General Trophy, earn an MVP, or get a MERDA 💩 to appear here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {trophyCabinet.map((trophy) => {
              const family =
                trophy.type === "mvp"
                  ? trophyFamilyStyle(trophy.source)
                  : trophyFamilyStyle("General");
              const semanticIconText = family.text;
              const semanticIconBorder = family.border;
              const semanticIconBg = family.bg;
              return (
              <button
                type="button"
                key={trophy.id}
                onClick={() => setSelectedTrophyId(trophy.id)}
                className={`rounded-2xl bg-gradient-to-b from-[#171C25] to-[#0D1118] border p-4 relative overflow-hidden transition-all duration-200 hover:-translate-y-1 text-left group focus:outline-none focus:ring-2 ${family.border} ${family.hover} ${family.focus}`}
                aria-label={`Open details for ${trophy.title}`}
              >
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${family.hex}, transparent)`,
                  }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className={`w-12 h-12 rounded-xl border bg-[#0F1218] flex items-center justify-center text-2xl shadow-[0_8px_24px_rgba(0,0,0,.22)] ${semanticIconBorder} ${semanticIconBg}`}>
                    {trophy.iconType === "trophy" ? (
                      <Trophy size={24} className={semanticIconText} strokeWidth={2.2} />
                    ) : (
                      <span aria-hidden="true">{trophy.emoji}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {trophy.count !== null && trophy.count !== undefined && (
                      <div className="px-2 py-1 rounded-lg border border-[#343B48] bg-[#101319] text-xs font-mono font-black">
                        {trophy.type === "achievement" ? `Lv ${trophy.count}/10` : `×${trophy.count}`}
                      </div>
                    )}
                    <ChevronRight
                      size={15}
                      className={`text-[#596170] group-hover:translate-x-0.5 transition-all ${family.text}`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <div className="font-display font-bold">{trophy.title}</div>
                  <span className={`h-5 px-1.5 rounded-md border inline-flex items-center text-[8px] font-black uppercase tracking-[0.12em] ${family.border} ${family.bg} ${family.text}`}>
                    {trophySourceLabel(trophy)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{trophy.detail}</div>
                <div className={`text-[9px] uppercase tracking-widest mt-3 transition-colors ${family.text}`}>
                  View unlock history
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      <Dialog
        open={Boolean(selectedTrophy)}
        onOpenChange={(open) => {
          if (!open) setSelectedTrophyId("");
        }}
      >
        <DialogContent className="bg-[#101319] border-[#242A35] sm:max-w-[620px] max-h-[82vh] overflow-y-auto">
          {selectedTrophy && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl shrink-0 ${
                    selectedTrophy.type === "mvp"
                      ? trophyFamilyStyle(selectedTrophy.source).border
                      : trophyFamilyStyle("General").border
                  } ${
                    selectedTrophy.type === "mvp"
                      ? trophyFamilyStyle(selectedTrophy.source).bg
                      : trophyFamilyStyle("General").bg
                  }`}>
                    {selectedTrophy.iconType === "trophy" ? (
                      <Trophy
                        size={24}
                        strokeWidth={2.2}
                        className={
                          selectedTrophy.type === "mvp"
                            ? trophyFamilyStyle(selectedTrophy.source).text
                            : trophyFamilyStyle("General").text
                        }
                      />
                    ) : (
                      <span aria-hidden="true">{selectedTrophy.emoji}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-display text-xl font-black">
                      {selectedTrophy.title}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      {selectedTrophy.detail}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="mt-2">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="brand-kicker mb-1">{trophySourceLabel(selectedTrophy)} · Unlock history</div>
                    <div className="text-sm font-bold">
                      {selectedTrophyEvents.length > 0
                        ? selectedTrophy.id === "mvp" || selectedTrophy.id === "merda"
                          ? `${selectedTrophyEvents.length} recorded occurrence${selectedTrophyEvents.length === 1 ? "" : "s"}`
                          : `${selectedTrophyEvents.length} level unlock${selectedTrophyEvents.length === 1 ? "" : "s"}`
                        : "Historical trigger unavailable"}
                    </div>
                  </div>
                  {selectedTrophy.count !== null && selectedTrophy.count !== undefined && (
                    <span className={`m8-pill ${
                      selectedTrophy.type === "mvp"
                        ? trophyFamilyStyle(selectedTrophy.source).text
                        : trophyFamilyStyle("General").text
                    } ${
                      selectedTrophy.type === "mvp"
                        ? trophyFamilyStyle(selectedTrophy.source).border
                        : trophyFamilyStyle("General").border
                    }`}>
                      {selectedTrophy.type === "achievement"
                        ? `Level ${selectedTrophy.count}/10`
                        : `Total ×${selectedTrophy.count}`}
                    </span>
                  )}
                </div>

                {selectedTrophyEvents.length === 0 ? (
                  <div className="rounded-xl border border-[#222834] bg-[#0F1218] p-5 text-center">
                    <Trophy size={22} className="mx-auto text-[#596170]" />
                    <div className="text-sm font-semibold mt-2">
                      Exact historical event not available
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      The award is unlocked from the current profile totals, but the older match that triggered it was not saved with enough detail.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...selectedTrophyEvents].reverse().map((event, index) => (
                      <div
                        key={`${event.id}-${index}`}
                        className="rounded-xl border border-[#222834] bg-[#0F1218] p-3.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                          <div className="w-9 h-9 rounded-lg border border-[#2A303B] bg-[#151923] flex items-center justify-center shrink-0">
                            <Trophy
                              size={14}
                              className={
                                selectedTrophy.type === "mvp"
                                  ? trophyFamilyStyle(selectedTrophy.source).text
                                  : trophyFamilyStyle("General").text
                              }
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-xs font-black uppercase tracking-wider ${
                                event.result === "Win" ? "text-emerald-400" : "text-red-400"
                              }`}>
                                {event.result}
                              </span>
                              {event.context && (
                                <span className="text-[10px] text-[#697181]">
                                  {event.context}
                                </span>
                              )}
                            </div>

                            <div className="font-semibold text-sm mt-1">
                              vs {event.opponent}
                            </div>

                            {event.note && (
                              <div className="text-xs text-muted-foreground mt-1.5">
                                {event.note}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[10px] text-[#697181]">
                              {event.date && (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays size={11} />
                                  {new Date(event.date).toLocaleDateString()}
                                </span>
                              )}
                              {Number(event.stake || 0) > 0 && (
                                <span className="font-mono font-black text-emerald-400">
                                  €{Number(event.stake).toFixed(2)}
                                </span>
                              )}
                              {event.platform && (
                                <span className="uppercase">{event.platform}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {isOwnProfile && profileTab === "mucho8s" && (
        <div className="m8-panel rounded-[22px] p-4 sm:p-5 order-3" data-testid="my-mucho8s-history">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1 text-magma">Mucho8s</div>
              <h3 className="font-display font-black text-xl">Mucho8s History</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Complete verified team history, Elo change, pairing and result.
              </p>
            </div>
            <Link
              to="/matches"
              className="text-[10px] uppercase tracking-widest text-magma hover:text-white inline-flex items-center gap-1"
            >
              Match Center <ChevronRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
            <div className="m8-stat-card">
              <div className="brand-kicker">Matches</div>
              <div className="font-display text-xl font-black mt-1">{player.totalMatches || 0}</div>
            </div>
            <div className="m8-stat-card">
              <div className="brand-kicker">Record</div>
              <div className="font-display text-xl font-black mt-1">
                {player.wins || 0}W - {player.losses || 0}L
              </div>
            </div>
            <div className="m8-stat-card">
              <div className="brand-kicker">Win Rate</div>
              <div className="font-display text-xl font-black mt-1">{winRate(player)}%</div>
            </div>
            <div className="m8-stat-card">
              <div className="brand-kicker">Winnings</div>
              <div className="font-display text-xl font-black mt-1 text-emerald-400">
                €{Number(mucho8sInsights.wonValue || 0).toFixed(0)}
              </div>
            </div>
          </div>

          {playerMatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2A303B] bg-[#0F1218] py-8 text-center text-sm text-muted-foreground">
              No Mucho8s history yet.
            </div>
          ) : (
            <div className="space-y-2">
              {playerMatches.slice(0, 30).map((m) => {
                const teamA = (m.teamA || []).map(String);
                const teamB = (m.teamB || []).map(String);
                const inA = teamA.includes(String(player.id));
                const myTeam = inA ? teamA : teamB;
                const opponents = inA ? teamB : teamA;
                const winnerSide = m.winner === "B" ? "B" : "A";
                const won = (inA && winnerSide === "A") || (!inA && winnerSide === "B");
                const coreEloDelta = Number(m.eloChanges?.[player.id] || 0);
                const pairing = (Array.isArray(m.pairings) ? m.pairings : []).find(
                  (pair) =>
                    String(pair?.playerAId || "") === String(player.id) ||
                    String(pair?.playerBId || "") === String(player.id)
                );
                const stakeElo = Math.max(
                  0,
                  Math.round(Number(pairing?.amount || 0))
                );
                const stakeDelta = won ? stakeElo : -stakeElo;
                const eloDelta = coreEloDelta + stakeDelta;

                return (
                  <Link
                    key={m.id}
                    to="/matches"
                    className="group rounded-xl border border-[#222834] bg-[#0F1218] p-3.5 flex flex-col lg:flex-row lg:items-center gap-3 transition-all hover:border-[#3A4350]"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <ModeBadge mode="mucho8s" compact />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-black text-xs uppercase ${
                            won ? "text-emerald-400" : "text-red-400"
                          }`}>
                            {won ? "WIN" : "LOSS"}
                          </span>
                          <span className="text-[10px] text-[#697181]">
                            {m.game || "Game"}{m.mode ? ` · ${m.mode}` : ""}
                          </span>
                        </div>
                        <div className="text-sm font-semibold truncate mt-1">
                          vs {opponents.map((pid) => playerMap[pid]?.name).filter(Boolean).join(" · ") || "Opponent team"}
                        </div>
                        <div className="text-[10px] text-[#697181] mt-1">
                          {m.date ? new Date(m.date).toLocaleDateString() : "—"}
                          {myTeam.length > 1 ? ` · ${myTeam.length}v${opponents.length}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {Number(m?.eloContext?.resultDelta) > 0 && (
                        <span
                          className="m8-pill text-[#C8CED8]"
                          title={`Alpha avg ${m.eloContext.teamAElo} · Bravo avg ${m.eloContext.teamBElo}`}
                        >
                          Base ±{m.eloContext.resultDelta}
                        </span>
                      )}
                      {pairing && Number(pairing.amount || 0) > 0 && (
                        <span
                          className="m8-pill text-emerald-400"
                          title="Stake: 1€ = 1 Elo"
                        >
                          Stake {stakeDelta >= 0 ? "+" : ""}{stakeDelta}
                        </span>
                      )}
                      <span className={`m8-pill font-mono ${
                        eloDelta > 0
                          ? "text-emerald-400"
                          : eloDelta < 0
                            ? "text-red-400"
                            : "text-[#8D95A4]"
                      }`}>
                        Total {eloDelta > 0 ? "+" : ""}{eloDelta} Elo
                      </span>
                      <ChevronRight size={13} className="text-[#596170] group-hover:text-white" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isOwnProfile && profileTab === "edit" && (
        <div className="m8-panel rounded-2xl p-4 sm:p-5 order-4" data-testid="edit-profile-panel">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="brand-kicker mb-1">Edit Profile</div>
              <h3 className="font-display font-bold text-lg">Profile settings</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Choose your role and connect PayPal or Revolut for Mucho1v1.
              </p>
            </div>
            <Link2 size={18} className="text-[#697181] shrink-0 mt-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 rounded-xl bg-[#0F1218] border border-[#222834] p-3">
              <Label className="text-xs font-semibold">Role</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {["SMG", "AR", "FLEX"].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setProfileRole(role)}
                    className={`h-10 rounded-lg border text-xs font-black transition-all ${
                      profileRole === role
                        ? "bg-white text-black border-white"
                        : "bg-[#151923] border-[#2A303B] text-[#C8CED8] hover:border-[#3A4350]"
                    }`}
                    data-testid={`profile-role-${role.toLowerCase()}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
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
                data-testid="save-profile-settings"
              >
                <Save size={15} className="mr-1.5" />
                {savingLinks ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOwnProfile && profileTab === "challenges" && (
        <div className="m8-panel rounded-2xl p-4 sm:p-5 order-3" data-testid="my-challenges-panel">
          <div className="mb-4">
            <div className="brand-kicker mb-1 text-emerald-400">Mucho1v1</div>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
              <div>
                <h3 className="font-display font-bold text-lg">My Mucho1v1</h3>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest text-[#697181]">Mucho1v1 Winnings</div>
                <div className="font-mono font-black text-emerald-400 mt-0.5">
                  €{Number(challengeStats.wonValue || 0).toFixed(2)}
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Direct 1v1 history only. Mucho8s pairings never appear here.
            </p>
          </div>

          {myChallenges.length === 0 ? (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] py-8 px-4 text-center text-sm text-muted-foreground">
              No Mucho1v1 yet.
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

                      <div className="flex items-center gap-2 flex-wrap">
                        {challenge.mvp_awarded === true && (
                          <span className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-[#D5A33A]/[0.08] border border-[#D5A33A]/20 text-[#D5A33A] text-xs font-extrabold tracking-wider">
                            <Trophy size={12} /> MVP
                          </span>
                        )}
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
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Pending</span>
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
                                  : "bg-emerald-400 text-black border-emerald-400 hover:bg-emerald-300"
                            }`}
                            data-testid={`open-challenge-${challenge.id}`}
                          >
                            OPEN MUCHO1V1
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

      {(!isOwnProfile || profileTab === "overview") && (
      <div className="m8-panel rounded-2xl p-4 sm:p-5 order-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <div className="brand-kicker mb-1">Progression</div>
            <h3 className="font-display font-black text-lg tracking-[-0.02em]">Elo History</h3>
          </div>
          <span className="m8-pill">{player.currentElo} Elo</span>
        </div>
        <div className="h-44">
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
        <div className="brand-kicker mb-1 text-magma">Mucho8s</div>
        <h3 className="font-display font-black text-xl tracking-[-0.02em] mb-4">Recent Mucho8s</h3>
        <div className="space-y-2">
          {playerMatches.slice(0, 10).map((m) => {
            const winners = m.winner === "A" ? m.teamA : m.teamB;
            const won = winners.includes(player.id);
            const teammates = (m.teamA.includes(player.id) ? m.teamA : m.teamB)
              .filter((pid) => pid !== player.id)
              .map((pid) => playerMap[pid]?.name)
              .filter(Boolean);
            const baseDelta = Number(m.eloChanges?.[player.id] || 0);
            const pairing = (Array.isArray(m.pairings) ? m.pairings : []).find(
              (item) => item?.playerAId === player.id || item?.playerBId === player.id
            );
            const valueBonus = Math.max(0, Math.round(Number(pairing?.amount) || 0));
            const delta = baseDelta === 0
              ? 0
              : baseDelta + (baseDelta > 0 ? valueBonus : -valueBonus);

            return (
              <div key={m.id} className="interactive-row flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl p-3">
                <ModeBadge mode="mucho8s" compact />
                <div className={`font-bold text-sm ${won ? "text-emerald-400" : "text-red-400"}`}>
                  {won ? "WIN" : "LOSS"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.game || "Game"} · {m.mode || "Mode"}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Con {teammates.length ? teammates.join(", ") : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {((Array.isArray(m.mvpIds) ? m.mvpIds : []).includes(player.id) || m.mvpId === player.id) && (
                    <Trophy size={14} className="text-[#D5A33A]" aria-label="MVP" />
                  )}
                  {((Array.isArray(m.merdaIds) && m.merdaIds.includes(player.id)) || m.merdaId === player.id) && (
                    <span title="MERDA">💩</span>
                  )}
                  <span className={`font-mono text-sm ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {delta >= 0 ? "+" : ""}{delta} Elo
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(m.date).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })}

          {playerMatches.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">No Mucho8s recorded for this player yet.</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
