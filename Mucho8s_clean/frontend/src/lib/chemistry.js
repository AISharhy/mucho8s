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

export const analyzeManualTeams = (teamA, teamB, matches = []) => {
  if (!teamA.length || !teamB.length || teamA.length !== teamB.length) return null;

  const chemistryA = teamChemistry(teamA, matches);
  const chemistryB = teamChemistry(teamB, matches);
  const chemistryScore = Math.round((chemistryA.score + chemistryB.score) / 2);
  const balance = teamBalance(teamA, teamB);

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
    draftScore: Math.round(chemistryScore * 0.55 + balance.score * 0.45),
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

export const draftTeamsByChemistry = (players, matches = []) => {
  if (!Array.isArray(players) || players.length < 4 || players.length % 2 !== 0) return null;

  const teamSize = players.length / 2;
  const anchor = players[0];
  const rest = players.slice(1);
  const candidates = combinations(rest, teamSize - 1);
  let best = null;

  candidates.forEach((combo) => {
    const teamA = [anchor, ...combo];
    const aIds = new Set(teamA.map((player) => player.id));
    const teamB = players.filter((player) => !aIds.has(player.id));
    const analysis = analyzeManualTeams(teamA, teamB, matches);

    if (!analysis) return;
    if (!best || analysis.draftScore > best.draftScore) best = analysis;
  });

  return best;
};
