import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Sparkles, Swords, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { useData } from "@/context/DataContext";
import { RANKS, tierOf } from "@/lib/elo";

const eventStyle = {
  rankup: {
    kicker: "Division promoted",
    icon: Crown,
    tone: "gold",
  },
  eloUp: {
    kicker: "Rating updated",
    icon: TrendingUp,
    tone: "green",
  },
  eloDown: {
    kicker: "Rating updated",
    icon: TrendingDown,
    tone: "red",
  },
  challWin: {
    kicker: "Verified chall",
    icon: Swords,
    tone: "green",
  },
  challLoss: {
    kicker: "Verified chall",
    icon: Swords,
    tone: "red",
  },
  trophy: {
    kicker: "Milestone reached",
    icon: Trophy,
    tone: "gold",
  },
};

const euro = (cents, currency = "EUR") =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
  }).format(Number(cents || 0) / 100);

const unlockedAchievementKeys = (player, publicChallenges = []) => {
  if (!player?.id) return new Set();

  const verified = publicChallenges.filter((challenge) =>
    challenge?.status === "completed" &&
    challenge?.reported_winner_player_id &&
    (
      challenge.challenger_player_id === player.id ||
      challenge.challenged_player_id === player.id
    ) &&
    !(challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
  );

  const challWins = verified.filter(
    (challenge) => challenge.reported_winner_player_id === player.id
  );
  const moneyWon = challWins.reduce(
    (total, challenge) => total + Number(challenge.amount_cents || 0) / 100,
    0
  );

  const keys = new Set();
  const add = (condition, key, label) => {
    if (condition) keys.add(JSON.stringify({ key, label }));
  };

  add((player.totalMatches || 0) >= 1, "match-1", "First Match");
  add((player.totalMatches || 0) >= 10, "match-10", "Regular");
  add((player.totalMatches || 0) >= 25, "match-25", "Veteran");
  add((player.totalMatches || 0) >= 50, "match-50", "Grinder");
  add((player.totalMatches || 0) >= 100, "match-100", "Centurion");

  add((player.wins || 0) >= 1, "win-1", "First Blood");
  add((player.wins || 0) >= 10, "win-10", "Winner");
  add((player.wins || 0) >= 25, "win-25", "Elite Winner");
  add((player.wins || 0) >= 50, "win-50", "Dominant");

  add((player.mvpCount || 0) >= 1, "mvp-1", "MVP");
  add((player.mvpCount || 0) >= 5, "mvp-5", "MVP x5");
  add((player.mvpCount || 0) >= 10, "mvp-10", "MVP x10");

  add((player.currentStreak || 0) >= 3, "streak-3", "Hot Streak");
  add((player.currentStreak || 0) >= 5, "streak-5", "On Fire");
  add((player.currentStreak || 0) >= 10, "streak-10", "Untouchable");

  add(challWins.length >= 1, "chall-1", "First Chall");
  add(challWins.length >= 5, "chall-5", "Chall Grinder");
  add(challWins.length >= 10, "chall-10", "Chall Veteran");
  add(challWins.length >= 25, "chall-25", "Chall King");

  add(moneyWon >= 25, "money-25", "In The Money");
  add(moneyWon >= 50, "money-50", "Money Maker");
  add(moneyWon >= 100, "money-100", "Big Earner");
  add(moneyWon >= 250, "money-250", "High Roller");

  return keys;
};

export default function CompetitiveEventFX() {
  const {
    discordPlayer,
    challenges,
    publicChallenges,
  } = useData();

  const [event, setEvent] = useState(null);
  const queueRef = useRef([]);
  const timerRef = useRef(null);
  const previousEloRef = useRef(null);
  const previousRankRef = useRef(null);
  const challengeSnapshotRef = useRef(new Map());
  const challengeReadyRef = useRef(false);
  const achievementSnapshotRef = useRef(new Set());
  const achievementReadyRef = useRef(false);

  const achievementKeys = useMemo(
    () => unlockedAchievementKeys(discordPlayer, publicChallenges || []),
    [discordPlayer, publicChallenges]
  );

  const showNext = useCallback(() => {
    if (timerRef.current || event || queueRef.current.length === 0) return;

    const next = queueRef.current.shift();
    setEvent(next);

    timerRef.current = window.setTimeout(() => {
      setEvent(null);
      timerRef.current = null;
    }, 2200);
  }, [event]);

  const pushEvent = useCallback((next) => {
    if (!next) return;
    queueRef.current.push(next);
    window.setTimeout(showNext, 0);
  }, [showNext]);

  useEffect(() => {
    if (!event && queueRef.current.length > 0 && !timerRef.current) {
      showNext();
    }
  }, [event, showNext]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (!discordPlayer?.id) {
      previousEloRef.current = null;
      previousRankRef.current = null;
      return;
    }

    const nextElo = Number(discordPlayer.currentElo || 0);
    const nextRank = tierOf(nextElo);

    if (previousEloRef.current === null) {
      previousEloRef.current = nextElo;
      previousRankRef.current = nextRank.id;
      return;
    }

    const previousElo = Number(previousEloRef.current);
    const previousRankId = previousRankRef.current;

    if (nextElo !== previousElo) {
      const delta = nextElo - previousElo;
      const previousIndex = RANKS.findIndex((rank) => rank.id === previousRankId);
      const nextIndex = RANKS.findIndex((rank) => rank.id === nextRank.id);

      if (nextIndex > previousIndex) {
        pushEvent({
          type: "rankup",
          title: "RANK UP",
          value: nextRank.name,
          detail: previousElo + " → " + nextElo + " Elo",
          color: nextRank.color,
        });
      } else {
        pushEvent({
          type: delta >= 0 ? "eloUp" : "eloDown",
          title: delta >= 0 ? "+" + delta + " ELO" : delta + " ELO",
          value: nextElo + " Elo",
          detail: nextRank.name,
          color: delta >= 0 ? "#34D399" : "#FB7185",
        });
      }

      previousEloRef.current = nextElo;
      previousRankRef.current = nextRank.id;
    }
  }, [discordPlayer?.id, discordPlayer?.currentElo, pushEvent]);

  useEffect(() => {
    if (!discordPlayer?.id) {
      challengeSnapshotRef.current = new Map();
      challengeReadyRef.current = false;
      return;
    }

    const relevant = (challenges || []).filter((challenge) =>
      challenge.challenger_player_id === discordPlayer.id ||
      challenge.challenged_player_id === discordPlayer.id
    );

    const nextSnapshot = new Map(
      relevant.map((challenge) => [
        challenge.id,
        {
          status: challenge.status,
          winner: challenge.reported_winner_player_id || null,
          verifiedAt: challenge.verified_at || null,
        },
      ])
    );

    if (!challengeReadyRef.current) {
      if (relevant.length > 0) {
        challengeSnapshotRef.current = nextSnapshot;
        challengeReadyRef.current = true;
      }
      return;
    }

    relevant.forEach((challenge) => {
      const previous = challengeSnapshotRef.current.get(challenge.id);
      const justCompleted =
        challenge.status === "completed" &&
        challenge.reported_winner_player_id &&
        (
          !previous ||
          previous.status !== "completed" ||
          previous.verifiedAt !== challenge.verified_at
        );

      if (!justCompleted) return;

      const won = challenge.reported_winner_player_id === discordPlayer.id;
      pushEvent({
        type: won ? "challWin" : "challLoss",
        title: won ? "CHALL WON" : "CHALL LOST",
        value: euro(challenge.amount_cents, challenge.currency || "EUR"),
        detail: "Verified match result",
        color: won ? "#34D399" : "#FB7185",
      });
    });

    challengeSnapshotRef.current = nextSnapshot;
  }, [challenges, discordPlayer?.id, pushEvent]);

  useEffect(() => {
    if (!discordPlayer?.id) {
      achievementSnapshotRef.current = new Set();
      achievementReadyRef.current = false;
      return;
    }

    if (!achievementReadyRef.current) {
      if (achievementKeys.size > 0 || (publicChallenges || []).length > 0) {
        achievementSnapshotRef.current = new Set(achievementKeys);
        achievementReadyRef.current = true;
      }
      return;
    }

    const unlockedNow = [...achievementKeys].filter(
      (entry) => !achievementSnapshotRef.current.has(entry)
    );

    if (unlockedNow.length > 0) {
      const parsed = JSON.parse(unlockedNow[0]);
      pushEvent({
        type: "trophy",
        title: "TROPHY UNLOCKED",
        value: parsed.label,
        detail: "New player milestone",
        color: "#D5A33A",
      });
    }

    achievementSnapshotRef.current = new Set(achievementKeys);
  }, [achievementKeys, discordPlayer?.id, publicChallenges, pushEvent]);

  if (!event) return null;

  const meta = eventStyle[event.type] || eventStyle.trophy;
  const Icon = meta.icon || Sparkles;

  return (
    <div className="m8-event-layer" aria-live="polite" aria-atomic="true">
      <div
        className={"m8-event-card m8-event-" + meta.tone}
        style={{ "--event-accent": event.color || "#D5A33A" }}
      >
        <div className="m8-event-flare" />
        <div className="m8-event-icon">
          <Icon size={24} strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="m8-event-kicker">{meta.kicker}</div>
          <div className="m8-event-title">{event.title}</div>
          <div className="m8-event-value">{event.value}</div>
          {event.detail && <div className="m8-event-detail">{event.detail}</div>}
        </div>
        <Sparkles size={18} className="m8-event-spark" />
      </div>
    </div>
  );
}
