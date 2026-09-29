import { playerRating } from "@/lib/elo";

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const sameTeamInMatch = (match, aId, bId) => {
  const inA = match.teamA?.includes(aId) && match.teamA?.includes(bId);
  const inB = match.teamB?.includes(aId) && match.teamB?.includes(bId);
  return Boolean(inA || inB);
};

const duoWonMatch = (match, aId, bId) => {
  if (!sameTeamInMatch(match, aId, bId)) return false;
  const winners = match.winner === "A" ? match.teamA : match.teamB;
  return winners?.includes(aId) && winners?.includes(bId);
};

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;

export const duoChemistry = (playerA, playerB, matches = []) => {
  if (!playerA || !playerB) {
    return {
      score: 50,
      matchesTogether: 0,
      winsTogether: 0,
      winRate: 0,
      eloGap: 0,
      confidence: 0,
      label: "No data",
    };
  }

  const together = (matches || [])
    .filter((match) => sameTeamInMatch(match, playerA.id, playerB.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const matchesTogether = together.length;
  const winsTogether = together.filter((match) => duoWonMatch(match, playerA.id, playerB.id)).length;
  const winRate = matchesTogether ? Math.round((winsTogether / matchesTogether) * 100) : 0;
  const eloGap = Math.abs(Number(playerA.currentElo || 0) - Number(playerB.currentElo || 0));

  const eloSimilarity = clamp(100 - eloGap / 4);
  const sampleConfidence = clamp(matchesTogether / 6, 0, 1);
  const recent = together.slice(0, 5);
  const recentWins = recent.filter((match) => duoWonMatch(match, playerA.id, playerB.id)).length;
  const recentWinRate = recent.length ? (recentWins / recent.length) * 100 : 50;

  const historySignal = matchesTogether
    ? winRate * 0.68 + recentWinRate * 0.22 + eloSimilarity * 0.1
    : 50;

  const score = Math.round(
    clamp(50 * (1 - sampleConfidence) + historySignal * sampleConfidence)
  );

  const label =
    matchesTogether === 0
      ? "New duo"
      : score >= 80
        ? "Elite chemistry"
        : score >= 65
          ? "Strong chemistry"
          : score >= 50
            ? "Balanced chemistry"
            : "Developing chemistry";

  return {
    score,
    matchesTogether,
    winsTogether,
    winRate,
    eloGap,
    confidence: Math.round(sampleConfidence * 100),
    label,
  };
};

export const teamChemistry = (team, matches = []) => {
  const pairs = [];

  for (let i = 0; i < team.length; i += 1) {
    for (let j = i + 1; j < team.length; j += 1) {
      pairs.push({
        a: team[i],
        b: team[j],
        ...duoChemistry(team[i], team[j], matches),
      });
    }
  }

  return {
    score: Math.round(average(pairs.map((pair) => pair.score))),
    pairs: pairs.sort((a, b) => b.score - a.score),
  };
};

export const teamBalance = (teamA, teamB) => {
  const strengthA = teamA.reduce((sum, player) => sum + playerRating(player), 0);
  const strengthB = teamB.reduce((sum, player) => sum + playerRating(player), 0);
  const avgStrength = Math.max(1, (strengthA + strengthB) / 2);
  const diff = Math.abs(strengthA - strengthB);
  const score = Math.round(clamp(100 - (diff / avgStrength) * 100));

  const verdict =
    score >= 94
      ? "Excellent Balance"
      : score >= 88
        ? "Balanced"
        : score >= 78
          ? "Playable"
          : "Unbalanced";

  return {
    score,
    verdict,
    strengthA: Math.round(strengthA),
    strengthB: Math.round(strengthB),
    diff: Math.round(diff),
  };
};

const sameIds = (left = [], right = []) => {
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
};

export const playerRecentForm = (player, matches = []) => {
  if (!player?.id) return { score: 50, winRate: 50, played: 0, streak: 0 };

  const recent = [...(matches || [])]
    .filter((match) => match.teamA?.includes(player.id) || match.teamB?.includes(player.id))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  if (!recent.length) {
    return {
      score: 50,
      winRate: 50,
      played: 0,
      streak: Number(player?.currentStreak || 0),
    };
  }

  const results = recent.map((match) => {
    const winners = match.winner === "A" ? match.teamA : match.teamB;
    return winners?.includes(player.id) ? 1 : 0;
  });
  const wins = results.reduce((sum, value) => sum + value, 0);
  const winRate = (wins / recent.length) * 100;

  let streak = 0;
  for (const result of results) {
    if (streak === 0) streak = result ? 1 : -1;
    else if (streak > 0 && result) streak += 1;
    else if (streak < 0 && !result) streak -= 1;
    else break;
  }

  const streakSignal = clamp(50 + streak * 8);
  const score = Math.round(clamp(winRate * 0.72 + streakSignal * 0.28));

  return {
    score,
    winRate: Math.round(winRate),
    played: recent.length,
    streak,
  };
};

export const recentFormBalance = (teamA, teamB, matches = []) => {
  const formA = teamA.map((player) => playerRecentForm(player, matches));
  const formB = teamB.map((player) => playerRecentForm(player, matches));
  const avgA = average(formA.map((row) => row.score));
  const avgB = average(formB.map((row) => row.score));
  const diff = Math.abs(avgA - avgB);
  const score = Math.round(clamp(100 - diff * 2));

  return {
    score,
    avgA: Math.round(avgA),
    avgB: Math.round(avgB),
    diff: Math.round(diff),
  };
};

export const teamFreshness = (teamA, teamB, matches = []) => {
  const recent = [...(matches || [])]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 12);

  const aIds = teamA.map((player) => String(player.id));
  const bIds = teamB.map((player) => String(player.id));
  const allPairs = [];
  let repeatWeight = 0;

  const registerPair = (left, right, sameTeam) => {
    const key = [String(left), String(right)].sort().join(":");
    if (allPairs.some((row) => row.key === key)) return;
    allPairs.push({ key, left: String(left), right: String(right), sameTeam });
  };

  for (let i = 0; i < aIds.length; i += 1) {
    for (let j = i + 1; j < aIds.length; j += 1) registerPair(aIds[i], aIds[j], true);
  }
  for (let i = 0; i < bIds.length; i += 1) {
    for (let j = i + 1; j < bIds.length; j += 1) registerPair(bIds[i], bIds[j], true);
  }
  aIds.forEach((aId) => bIds.forEach((bId) => registerPair(aId, bId, false)));

  recent.forEach((match, index) => {
    const weight = Math.max(0.25, 1 - index * 0.07);
    const matchA = new Set((match.teamA || []).map(String));
    const matchB = new Set((match.teamB || []).map(String));

    allPairs.forEach((pair) => {
      const togetherA = matchA.has(pair.left) && matchA.has(pair.right);
      const togetherB = matchB.has(pair.left) && matchB.has(pair.right);
      const opposed =
        (matchA.has(pair.left) && matchB.has(pair.right)) ||
        (matchB.has(pair.left) && matchA.has(pair.right));

      if (pair.sameTeam && (togetherA || togetherB)) repeatWeight += 1.2 * weight;
      if (!pair.sameTeam && opposed) repeatWeight += 0.65 * weight;
    });
  });

  const possible = Math.max(1, allPairs.length);
  const normalized = repeatWeight / possible;
  const score = Math.round(clamp(100 - normalized * 32));

  const exactIndex = recent.findIndex((match) =>
    (sameIds(match.teamA, aIds) && sameIds(match.teamB, bIds)) ||
    (sameIds(match.teamA, bIds) && sameIds(match.teamB, aIds))
  );

  return {
    score: exactIndex === 0 ? Math.min(score, 35) : score,
    repeated: repeatWeight > 0,
    exactRepeated: exactIndex >= 0,
    recentIndex: exactIndex,
    repeatWeight: Number(repeatWeight.toFixed(2)),
  };
};

export const analyzeManualTeams = (teamA, teamB, matches = []) => {
  if (!teamA.length || !teamB.length || teamA.length !== teamB.length) return null;

  const chemistryA = teamChemistry(teamA, matches);
  const chemistryB = teamChemistry(teamB, matches);
  const chemistryScore = Math.round((chemistryA.score + chemistryB.score) / 2);
  const balance = teamBalance(teamA, teamB);
  const freshness = teamFreshness(teamA, teamB, matches);
  const recentForm = recentFormBalance(teamA, teamB, matches);
  const lobbyQuality = Math.round(
    balance.score * 0.45 +
    chemistryScore * 0.25 +
    recentForm.score * 0.15 +
    freshness.score * 0.15
  );

  const why = [
    `Power difference: ${balance.diff}`,
    `Team chemistry: ${chemistryScore}%`,
    `Recent form balance: ${recentForm.score}% · A ${recentForm.avgA} / B ${recentForm.avgB}`,
    freshness.repeated
      ? `Freshness: ${freshness.score}% · recent teammate/opponent repeats detected`
      : "Freshness: 100% · new player combinations",
  ];

  return {
    teamA,
    teamB,
    chemistryA,
    chemistryB,
    chemistryScore,
    balanceScore: balance.score,
    balanceVerdict: balance.verdict,
    strengthA: balance.strengthA,
    strengthB: balance.strengthB,
    strengthDiff: balance.diff,
    freshnessScore: freshness.score,
    recentFormScore: recentForm.score,
    recentFormA: recentForm.avgA,
    recentFormB: recentForm.avgB,
    lobbyQuality,
    why,
    draftScore: Math.round(
      chemistryScore * 0.35 +
      balance.score * 0.35 +
      recentForm.score * 0.15 +
      freshness.score * 0.15
    ),
    pairings: buildCrossTeamPairings(teamA, teamB),
  };
};

const combinations = (items, size) => {
  const result = [];
  const walk = (start, combo) => {
    if (combo.length === size) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      combo.push(items[i]);
      walk(i + 1, combo);
      combo.pop();
    }
  };
  walk(0, []);
  return result;
};

export const buildCrossTeamPairings = (teamA, teamB) => {
  const available = [...teamB];

  return [...teamA]
    .sort((a, b) => playerRating(b) - playerRating(a))
    .map((playerA) => {
      available.sort(
        (left, right) =>
          Math.abs(playerRating(playerA) - playerRating(left)) -
          Math.abs(playerRating(playerA) - playerRating(right))
      );
      const playerB = available.shift();
      return {
        playerA,
        playerB,
        ratingGap: playerB
          ? Math.round(Math.abs(playerRating(playerA) - playerRating(playerB)))
          : 0,
      };
    })
    .filter((pair) => pair.playerB);
};

export const draftTeamsByPriority = (players, matches = [], priority = "mixed") => {
  if (!Array.isArray(players) || players.length < 4 || players.length % 2 !== 0) return null;

  const teamSize = players.length / 2;
  const anchor = players[0];
  const rest = players.slice(1);
  const candidates = combinations(rest, teamSize - 1)
    .map((combo) => {
      const teamA = [anchor, ...combo];
      const aIds = new Set(teamA.map((player) => player.id));
      const teamB = players.filter((player) => !aIds.has(player.id));
      return analyzeManualTeams(teamA, teamB, matches);
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const scoreFor = (analysis) => {
    if (priority === "chemistry") {
      return (
        analysis.chemistryScore * 0.7 +
        analysis.balanceScore * 0.2 +
        analysis.freshnessScore * 0.1
      );
    }

    if (priority === "recent") {
      return (
        analysis.recentFormScore * 0.65 +
        analysis.balanceScore * 0.25 +
        analysis.freshnessScore * 0.1
      );
    }

    if (priority === "freshness") {
      return (
        analysis.freshnessScore * 0.65 +
        analysis.balanceScore * 0.25 +
        analysis.chemistryScore * 0.1
      );
    }

    if (priority === "mixed") {
      return (
        analysis.balanceScore * 0.5 +
        analysis.chemistryScore * 0.3 +
        analysis.recentFormScore * 0.2
      );
    }

    return (
      analysis.balanceScore * 0.9 +
      analysis.freshnessScore * 0.1
    );
  };

  if (priority === "random") {
    const bestBalance = Math.max(...candidates.map((analysis) => analysis.balanceScore));
    const minimumBalance = Math.max(82, bestBalance - 8);
    const safe = candidates.filter((analysis) => analysis.balanceScore >= minimumBalance);
    const pool = safe.length ? safe : candidates;
    const weighted = pool.flatMap((analysis) => {
      const freshnessWeight =
        analysis.freshnessScore >= 90 ? 3 :
        analysis.freshnessScore >= 75 ? 2 : 1;
      return Array.from({ length: freshnessWeight }, () => analysis);
    });
    const picked = weighted[Math.floor(Math.random() * weighted.length)] || pool[0];
    return {
      ...picked,
      balancePriority: priority,
      priorityScore: picked.balanceScore,
    };
  }

  let best = candidates[0];
  let bestScore = scoreFor(best);

  candidates.slice(1).forEach((analysis) => {
    const score = scoreFor(analysis);
    if (score > bestScore) {
      best = analysis;
      bestScore = score;
    }
  });

  return {
    ...best,
    balancePriority: priority,
    priorityScore: Math.round(bestScore),
  };
};

export const draftTeamsBalanced = (players, matches = []) =>
  draftTeamsByPriority(players, matches, "elo");

export const draftTeamsByChemistry = (players, matches = []) =>
  draftTeamsByPriority(players, matches, "chemistry");
