import { playerRating } from "@/lib/elo";

const pairKey = (a, b) => [String(a), String(b)].sort().join(":");

const pairsOf = (ids = []) => {
  const pairs = [];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      pairs.push([ids[i], ids[j]]);
    }
  }
  return pairs;
};

const opponentKey = (playerId, opponentId) => `${playerId}:${opponentId}`;

const playerName = (playerMap, id) => playerMap?.[id]?.name || "Player";

const wasUpsetWin = (match, winners = []) => {
  const changes = match?.eloChanges && typeof match.eloChanges === "object"
    ? winners.map((id) => Number(match.eloChanges[id])).filter(Number.isFinite)
    : [];

  if (!changes.length || changes.length !== winners.length) return false;
  return changes.every((delta) => delta >= 40);
};

export const analyzeBountyHistory = (playerId, players = [], matches = []) => {
  if (!playerId) {
    return {
      events: [],
      counts: {},
      points: 0,
      completed: 0,
      biggestStreakBroken: 0,
    };
  }

  const playerMap = Object.fromEntries((players || []).map((player) => [String(player.id), player]));
  const ordered = [...(matches || [])]
    .filter((match) => Array.isArray(match?.teamA) && Array.isArray(match?.teamB))
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const winStreaks = new Map();
  const duoHistory = new Map();
  const lastHeadToHead = new Map();
  const headToHeadStats = new Map();
  const eventsByPlayer = new Map();
  const lastAwardIndex = new Map();

  const addEvent = (id, event, matchIndex) => {
    const cooldownKey = `${id}:${event.cooldownKey || event.type}`;
    const previousIndex = lastAwardIndex.get(cooldownKey);
    if (Number.isFinite(previousIndex) && matchIndex - previousIndex < 3) return;

    const list = eventsByPlayer.get(id) || [];
    list.push(event);
    eventsByPlayer.set(id, list);
    lastAwardIndex.set(cooldownKey, matchIndex);
  };

  ordered.forEach((match, matchIndex) => {
    const teamA = (match.teamA || []).map(String);
    const teamB = (match.teamB || []).map(String);
    const winnerSide = match.winner === "B" ? "B" : "A";
    const winners = winnerSide === "A" ? teamA : teamB;
    const losers = winnerSide === "A" ? teamB : teamA;
    const date = match.date || null;

    const streakTargets = losers
      .map((id) => ({ id, streak: Math.max(0, Number(winStreaks.get(id) || 0)) }))
      .filter((row) => row.streak >= 3)
      .sort((a, b) => b.streak - a.streak);

    if (streakTargets.length) {
      const target = streakTargets[0];
      const points = 4 + Math.min(4, Math.max(0, target.streak - 3));
      winners.forEach((id) => addEvent(id, {
        id: `streak_breaker:${match.id}:${id}`,
        matchId: match.id,
        type: "streak_breaker",
        title: "Streak Breaker",
        detail: `Ended ${playerName(playerMap, target.id)}'s ${target.streak}-win streak`,
        points,
        date,
        meta: { targetPlayerId: target.id, streak: target.streak },
        cooldownKey: `streak_breaker:${target.id}`,
      }, matchIndex));
    }

    const undefeatedDuos = pairsOf(losers)
      .map(([a, b]) => {
        const history = duoHistory.get(pairKey(a, b)) || { games: 0, wins: 0, losses: 0 };
        return { a, b, ...history };
      })
      .filter((row) => row.games >= 3 && row.losses === 0)
      .sort((a, b) => b.games - a.games);

    if (undefeatedDuos.length) {
      const duo = undefeatedDuos[0];
      winners.forEach((id) => addEvent(id, {
        id: `duo_breaker:${match.id}:${id}`,
        matchId: match.id,
        type: "duo_breaker",
        title: "Duo Breaker",
        detail: `Beat undefeated duo ${playerName(playerMap, duo.a)} + ${playerName(playerMap, duo.b)} (${duo.games}-0)`,
        points: 8,
        date,
        meta: { playerAId: duo.a, playerBId: duo.b, games: duo.games },
        cooldownKey: `duo_breaker:${pairKey(duo.a, duo.b)}`,
      }, matchIndex));
    }

    if (wasUpsetWin(match, winners)) {
      winners.forEach((id) => addEvent(id, {
        id: `underdog:${match.id}:${id}`,
        matchId: match.id,
        type: "underdog",
        title: "Giant Killer",
        detail: "Won a verified underdog matchup",
        points: 5,
        date,
        meta: {},
        cooldownKey: "underdog",
      }, matchIndex));
    }

    winners.forEach((id) => {
      const revengeTargets = losers
        .filter((opponentId) => lastHeadToHead.get(opponentKey(id, opponentId))?.result === "L")
        .map((opponentId) => ({
          opponentId,
          date: lastHeadToHead.get(opponentKey(id, opponentId))?.date || null,
        }))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      if (!revengeTargets.length) return;
      const target = revengeTargets[0];
      addEvent(id, {
        id: `revenge:${match.id}:${id}`,
        matchId: match.id,
        type: "revenge",
        title: "Payback",
        detail: `Won the rematch against ${playerName(playerMap, target.opponentId)}`,
        points: 4,
        date,
        meta: { opponentPlayerId: target.opponentId },
        cooldownKey: `revenge:${target.opponentId}`,
      }, matchIndex);
    });

    winners.forEach((id) => {
      const rivalryTargets = losers
        .map((opponentId) => {
          const history = headToHeadStats.get(pairKey(id, opponentId));
          if (!history || history.games < 3) return null;
          const idWins = Number(history.wins?.[id] || 0);
          const opponentWins = Number(history.wins?.[opponentId] || 0);
          if (Math.abs(idWins - opponentWins) > 1) return null;
          return { opponentId, games: history.games, idWins, opponentWins };
        })
        .filter(Boolean)
        .sort((a, b) => b.games - a.games);

      if (!rivalryTargets.length) return;
      const rivalry = rivalryTargets[0];
      addEvent(id, {
        id: `rivalry:${match.id}:${id}`,
        matchId: match.id,
        type: "rivalry",
        title: "Rivalry Edge",
        detail: `Won a close rivalry match vs ${playerName(playerMap, rivalry.opponentId)}`,
        points: 3,
        date,
        meta: { opponentPlayerId: rivalry.opponentId, games: rivalry.games },
        cooldownKey: `rivalry:${rivalry.opponentId}`,
      }, matchIndex);
    });

    winners.forEach((id) => {
      const current = Math.max(0, Number(winStreaks.get(id) || 0));
      winStreaks.set(id, current + 1);
    });
    losers.forEach((id) => winStreaks.set(id, 0));

    const updateDuo = (team, won) => {
      pairsOf(team).forEach(([a, b]) => {
        const key = pairKey(a, b);
        const row = duoHistory.get(key) || { games: 0, wins: 0, losses: 0 };
        row.games += 1;
        if (won) row.wins += 1;
        else row.losses += 1;
        duoHistory.set(key, row);
      });
    };

    updateDuo(teamA, winnerSide === "A");
    updateDuo(teamB, winnerSide === "B");

    teamA.forEach((a) => {
      teamB.forEach((b) => {
        const aWon = winnerSide === "A";
        lastHeadToHead.set(opponentKey(a, b), { result: aWon ? "W" : "L", date });
        lastHeadToHead.set(opponentKey(b, a), { result: aWon ? "L" : "W", date });

        const key = pairKey(a, b);
        const row = headToHeadStats.get(key) || { games: 0, wins: {} };
        row.games += 1;
        row.wins[a] = Number(row.wins[a] || 0) + (aWon ? 1 : 0);
        row.wins[b] = Number(row.wins[b] || 0) + (aWon ? 0 : 1);
        headToHeadStats.set(key, row);
      });
    });
  });

  const events = (eventsByPlayer.get(String(playerId)) || [])
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const counts = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});

  return {
    events,
    counts,
    points: events.reduce((sum, event) => sum + Number(event.points || 0), 0),
    completed: events.length,
    biggestStreakBroken: events
      .filter((event) => event.type === "streak_breaker")
      .reduce((max, event) => Math.max(max, Number(event.meta?.streak || 0)), 0),
  };
};

export const buildBountyAchievementCatalog = (history) => {
  const counts = history?.counts || {};
  const completed = Number(history?.completed || 0);
  const points = Number(history?.points || 0);
  const biggestStreakBroken = Number(history?.biggestStreakBroken || 0);

  return [
    {
      key: "bounty-hunter",
      label: "Bounty Hunter",
      detail: "Complete your first Match Bounty",
      category: "Bounty",
      unlocked: completed >= 1,
      progress: Math.min(completed, 1),
      target: 1,
    },
    {
      key: "contract-killer",
      label: "Contract Killer",
      detail: "Complete 5 Match Bounties",
      category: "Bounty",
      unlocked: completed >= 5,
      progress: Math.min(completed, 5),
      target: 5,
    },
    {
      key: "elite-hunter",
      label: "Elite Hunter",
      detail: "Complete 15 Match Bounties",
      category: "Bounty",
      unlocked: completed >= 15,
      progress: Math.min(completed, 15),
      target: 15,
    },
    {
      key: "streak-breaker",
      label: "Streak Breaker",
      detail: "End an opponent's 3+ win streak",
      category: "Streak",
      unlocked: Number(counts.streak_breaker || 0) >= 1,
      progress: Math.min(Number(counts.streak_breaker || 0), 1),
      target: 1,
    },
    {
      key: "heat-check",
      label: "Heat Check",
      detail: "End an opponent's 5+ win streak",
      category: "Streak",
      unlocked: biggestStreakBroken >= 5,
      progress: Math.min(biggestStreakBroken, 5),
      target: 5,
    },
    {
      key: "duo-breaker",
      label: "Duo Breaker",
      detail: "Beat an undefeated duo with 3+ games together",
      category: "Duo",
      unlocked: Number(counts.duo_breaker || 0) >= 1,
      progress: Math.min(Number(counts.duo_breaker || 0), 1),
      target: 1,
    },
    {
      key: "pair-wrecker",
      label: "Pair Wrecker",
      detail: "Break 3 undefeated duos",
      category: "Duo",
      unlocked: Number(counts.duo_breaker || 0) >= 3,
      progress: Math.min(Number(counts.duo_breaker || 0), 3),
      target: 3,
    },
    {
      key: "giant-killer",
      label: "Giant Killer",
      detail: "Win a verified underdog matchup",
      category: "Upset",
      unlocked: Number(counts.underdog || 0) >= 1,
      progress: Math.min(Number(counts.underdog || 0), 1),
      target: 1,
    },
    {
      key: "upset-specialist",
      label: "Upset Specialist",
      detail: "Win 3 verified underdog matchups",
      category: "Upset",
      unlocked: Number(counts.underdog || 0) >= 3,
      progress: Math.min(Number(counts.underdog || 0), 3),
      target: 3,
    },
    {
      key: "payback",
      label: "Payback",
      detail: "Win a rematch after losing the previous head-to-head",
      category: "Rivalry",
      unlocked: Number(counts.revenge || 0) >= 1,
      progress: Math.min(Number(counts.revenge || 0), 1),
      target: 1,
    },
    {
      key: "nemesis",
      label: "Nemesis",
      detail: "Complete 3 revenge bounties",
      category: "Rivalry",
      unlocked: Number(counts.revenge || 0) >= 3,
      progress: Math.min(Number(counts.revenge || 0), 3),
      target: 3,
    },
    {
      key: "rivalry-edge",
      label: "Rivalry Edge",
      detail: "Win a close rivalry matchup",
      category: "Rivalry",
      unlocked: Number(counts.rivalry || 0) >= 1,
      progress: Math.min(Number(counts.rivalry || 0), 1),
      target: 1,
    },
    {
      key: "rivalry-king",
      label: "Rivalry King",
      detail: "Win 5 close rivalry bounties",
      category: "Rivalry",
      unlocked: Number(counts.rivalry || 0) >= 5,
      progress: Math.min(Number(counts.rivalry || 0), 5),
      target: 5,
    },
    {
      key: "bounty-collector",
      label: "Bounty Collector",
      detail: "Earn 25 Bounty Points",
      category: "Points",
      unlocked: points >= 25,
      progress: Math.min(points, 25),
      target: 25,
    },
    {
      key: "bounty-legend",
      label: "Bounty Legend",
      detail: "Earn 75 Bounty Points",
      category: "Points",
      unlocked: points >= 75,
      progress: Math.min(points, 75),
      target: 75,
    },
  ];
};


export const detectLobbyBounties = (teamA = [], teamB = [], matches = []) => {
  if (!teamA.length || !teamB.length) return [];

  const playerMap = Object.fromEntries([...teamA, ...teamB].map((player) => [String(player.id), player]));
  const ordered = [...(matches || [])]
    .filter((match) => Array.isArray(match?.teamA) && Array.isArray(match?.teamB))
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  const streaks = new Map();
  const duoHistory = new Map();
  const h2h = new Map();

  ordered.forEach((match) => {
    const a = (match.teamA || []).map(String);
    const b = (match.teamB || []).map(String);
    const winners = match.winner === "B" ? b : a;
    const losers = match.winner === "B" ? a : b;

    winners.forEach((id) => streaks.set(id, Math.max(0, Number(streaks.get(id) || 0)) + 1));
    losers.forEach((id) => streaks.set(id, 0));

    const updateDuo = (team, won) => {
      pairsOf(team).forEach(([left, right]) => {
        const key = pairKey(left, right);
        const row = duoHistory.get(key) || { games: 0, wins: 0, losses: 0 };
        row.games += 1;
        if (won) row.wins += 1;
        else row.losses += 1;
        duoHistory.set(key, row);
      });
    };
    updateDuo(a, match.winner !== "B");
    updateDuo(b, match.winner === "B");

    a.forEach((left) => {
      b.forEach((right) => {
        const key = pairKey(left, right);
        const row = h2h.get(key) || { games: 0, wins: {} };
        row.games += 1;
        row.wins[left] = Number(row.wins[left] || 0) + (match.winner === "A" ? 1 : 0);
        row.wins[right] = Number(row.wins[right] || 0) + (match.winner === "B" ? 1 : 0);
        h2h.set(key, row);
      });
    });
  });

  const result = [];
  const add = (item) => {
    if (!result.some((existing) => existing.key === item.key)) result.push(item);
  };

  const inspectTargets = (targetTeam, hunterTeam, targetSide, hunterSide) => {
    const streakTarget = [...targetTeam]
      .map((player) => ({ player, streak: Number(streaks.get(String(player.id)) || 0) }))
      .filter((row) => row.streak >= 3)
      .sort((a, b) => b.streak - a.streak)[0];

    if (streakTarget) {
      add({
        key: `streak:${targetSide}:${streakTarget.player.id}`,
        title: "End the Streak",
        detail: `${streakTarget.player.name} is on a ${streakTarget.streak}-win streak`,
        reward: 4 + Math.min(4, Math.max(0, streakTarget.streak - 3)),
        hunterSide,
        type: "streak",
      });
    }

    const undefeated = pairsOf(targetTeam.map((player) => String(player.id)))
      .map(([a, b]) => ({ a, b, ...(duoHistory.get(pairKey(a, b)) || { games: 0, wins: 0, losses: 0 }) }))
      .filter((row) => row.games >= 3 && row.losses === 0)
      .sort((a, b) => b.games - a.games)[0];

    if (undefeated) {
      add({
        key: `duo:${targetSide}:${pairKey(undefeated.a, undefeated.b)}`,
        title: "Break the Duo",
        detail: `${playerName(playerMap, undefeated.a)} + ${playerName(playerMap, undefeated.b)} are ${undefeated.games}-0 together`,
        reward: 8,
        hunterSide,
        type: "duo",
      });
    }
  };

  inspectTargets(teamA, teamB, "A", "B");
  inspectTargets(teamB, teamA, "B", "A");

  const strengthA = teamA.reduce((sum, player) => sum + playerRating(player), 0);
  const strengthB = teamB.reduce((sum, player) => sum + playerRating(player), 0);
  const averageStrength = Math.max(1, (strengthA + strengthB) / 2);
  const diffPct = Math.abs(strengthA - strengthB) / averageStrength;

  if (diffPct >= 0.08) {
    add({
      key: "underdog",
      title: "Giant Killer",
      detail: `Team ${strengthA < strengthB ? "A" : "B"} enters as the underdog`,
      reward: 5,
      hunterSide: strengthA < strengthB ? "A" : "B",
      type: "underdog",
    });
  }

  const rivalries = [];
  teamA.forEach((left) => {
    teamB.forEach((right) => {
      const row = h2h.get(pairKey(left.id, right.id));
      if (!row || row.games < 3) return;
      const leftWins = Number(row.wins?.[String(left.id)] || row.wins?.[left.id] || 0);
      const rightWins = Number(row.wins?.[String(right.id)] || row.wins?.[right.id] || 0);
      if (Math.abs(leftWins - rightWins) > 1) return;
      rivalries.push({ left, right, games: row.games, leftWins, rightWins });
    });
  });

  rivalries
    .sort((a, b) => b.games - a.games)
    .slice(0, 1)
    .forEach((rivalry) => add({
      key: `rivalry:${pairKey(rivalry.left.id, rivalry.right.id)}`,
      title: "Rivalry Match",
      detail: `${rivalry.left.name} vs ${rivalry.right.name} · ${rivalry.leftWins}-${rivalry.rightWins} H2H`,
      reward: 3,
      hunterSide: "BOTH",
      type: "rivalry",
    }));

  return result
    .sort((a, b) => b.reward - a.reward)
    .slice(0, 3);
};
