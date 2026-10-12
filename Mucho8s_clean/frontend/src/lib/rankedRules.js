import { MIN_ELO, WIN_DELTA, LOSS_DELTA, MVP_BONUS } from "./elo";

/**
 * Ranked and Mucho8s have ONE rating, ONE rank and ONE leaderboard.
 * Money is never considered in Ranked Elo or match results.
 */
export function makeRankedMatch({ id, mode, teamA, teamB, winner, date = new Date().toISOString() }) {
  if (!["snd", "hp", "mixed"].includes(mode)) throw new Error("Invalid ranked mode");
  if (!["A", "B"].includes(winner)) throw new Error("Invalid winner");
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length !== 4 || teamB.length !== 4)
    throw new Error("Ranked requires 4v4");
  const ids = [...teamA, ...teamB].map(String);
  if (new Set(ids).size !== 8 || ids.some(id => !id.trim())) throw new Error("Invalid roster");
  return {
    id, date, game: "BO7", mode, format: mode === "mixed" ? "MIX CDL" : mode.toUpperCase(),
    teamA: ids.slice(0, 4), teamB: ids.slice(4), winner,
    pairings: [], // No money pairing, always.
    ranked: true, resultStatus: "verified", locked: true, verifiedAt: date,
    source: "mucho-ranked",
  };
}

/** Matches the base +25/-15 and every-third-win MVP bonus of existing 8s. */
export function rankedResultForPlayer({ elo, won, nextWinStreak = 0 }) {
  if (!Number.isFinite(Number(elo))) throw new Error("Invalid Elo");
  const mvp = won && nextWinStreak >= 3 && nextWinStreak % 3 === 0;
  const delta = won ? WIN_DELTA + (mvp ? MVP_BONUS : 0) : -LOSS_DELTA;
  return { delta, elo: Math.max(MIN_ELO, Math.round(Number(elo)) + delta), mvp };
}
