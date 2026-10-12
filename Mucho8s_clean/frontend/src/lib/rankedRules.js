/**
 * Ranked and Mucho8s have ONE rating, ONE rank and ONE leaderboard.
 * Money is never considered in Ranked Elo or match results.
 */
export function makeRankedMatch({ id, mode, teamA, teamB, winner, date = new Date().toISOString() }) {
  if (mode !== "hp") throw new Error("Invalid ranked mode");
  if (!["A", "B"].includes(winner)) throw new Error("Invalid winner");
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length !== 4 || teamB.length !== 4)
    throw new Error("Ranked requires 4v4");
  const ids = [...teamA, ...teamB].map(String);
  if (new Set(ids).size !== 8 || ids.some(id => !id.trim())) throw new Error("Invalid roster");
  return {
    id, date, game: "BO7", mode: "Hardpoint", format: "4v4", bestOf: 1,
    teamA: ids.slice(0, 4), teamB: ids.slice(4), winner,
    pairings: [], // No money pairing, always.
    ranked: true, resultStatus: "verified", locked: true, verifiedAt: date,
    source: "mucho-ranked",
  };
}

/**
 * Ranked matches must be committed through the existing Mucho8s match-result
 * pipeline (applyEffects/recomputeAwardState), never a separate Elo ledger.
 * This keeps all existing dynamic Elo, MVP, streak and rank rules identical.
 */
