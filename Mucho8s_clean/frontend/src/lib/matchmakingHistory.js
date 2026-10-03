import { BASE_ELO, expectedEloScore } from "./elo";

export const mergeMatchHistory = (matches = [], archives = []) => {
  const byId = new Map();
  const add = (match) => {
    if (!match || !["A", "B"].includes(match.winner)) return;
    if (!Array.isArray(match.teamA) || !Array.isArray(match.teamB) ||
        !match.teamA.length || !match.teamB.length) return;
    const key = match.id || JSON.stringify([match.date, match.teamA, match.teamB, match.winner]);
    byId.set(key, match);
  };
  archives.forEach((archive) => (archive.matches || []).forEach(add));
  matches.forEach(add); // Active edits take precedence over archived copies.
  return [...byId.values()].sort((a, b) => new Date(a.date) - new Date(b.date));
};

// Persistent skill estimate from results, independent of seasonal Elo, money and awards.
export const computeMatchmakingRatings = (matches = []) => {
  const stats = {};
  const ensure = (id) => stats[id] || (stats[id] = { rating: BASE_ELO, played: 0 });
  [...matches].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((match) => {
    const teamA = [...new Set(match.teamA || [])];
    const teamB = [...new Set(match.teamB || [])];
    if (!teamA.length || !teamB.length || !["A", "B"].includes(match.winner)) return;
    const average = (team) => team.reduce((sum, id) => sum + ensure(id).rating, 0) / team.length;
    const delta = 32 * ((match.winner === "A" ? 1 : 0) - expectedEloScore(average(teamA), average(teamB)));
    teamA.forEach((id) => { ensure(id).rating += delta; ensure(id).played += 1; });
    teamB.forEach((id) => { ensure(id).rating -= delta; ensure(id).played += 1; });
  });
  return stats;
};
