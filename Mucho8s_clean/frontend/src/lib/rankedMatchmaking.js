/**
 * Pure matching helpers for the future server-authoritative Mucho Ranked queue.
 * Do not use client-submitted Elo or this module alone to award ranked points.
 */
export const RANKED_TEAM_SIZE = 4;
export const RANKED_LOBBY_SIZE = 8;
export const RANKED_FORMATS = Object.freeze(["snd", "hp", "mixed"]);

export function validateRankedCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length !== RANKED_LOBBY_SIZE) {
    throw new Error("Ranked requires exactly eight players");
  }
  const seen = new Set();
  return candidates.map((candidate) => {
    const id = String(candidate?.id ?? "").trim();
    const elo = Number(candidate?.elo);
    if (!id || seen.has(id)) throw new Error("Ranked players must be unique and identified");
    if (!Number.isFinite(elo) || elo < 0 || elo > 100000) throw new Error("Invalid ranked Elo");
    seen.add(id);
    return { id, elo };
  });
}

/**
 * Exhaustively finds the closest-skill 4v4 split (35 unique team partitions).
 * Deterministic order and tie-breaking ensures same input yields same result.
 * A production service must fetch Elo from trusted storage and atomically lock
 * queue participants before creating a match.
 */
export function balanceRankedLobby(candidates) {
  const roster = validateRankedCandidates(candidates).sort((a, b) => a.id.localeCompare(b.id));
  const total = roster.reduce((sum, player) => sum + player.elo, 0);
  let best = null;
  // Keep roster[0] on Team A to avoid mirrored partition duplicates.
  for (let a = 1; a < 6; a += 1) {
    for (let b = a + 1; b < 7; b += 1) {
      for (let c = b + 1; c < 8; c += 1) {
        const indices = new Set([0, a, b, c]);
        const teamA = roster.filter((_, index) => indices.has(index));
        const teamB = roster.filter((_, index) => !indices.has(index));
        const eloA = teamA.reduce((sum, player) => sum + player.elo, 0);
        const eloB = total - eloA;
        const delta = Math.abs(eloA - eloB);
        const signature = teamA.map((player) => player.id).join("|");
        if (!best || delta < best.delta || (delta === best.delta && signature < best.signature)) {
          best = { teamA, teamB, eloA, eloB, delta, signature };
        }
      }
    }
  }
  return {
    teamA: best.teamA.map((player) => player.id),
    teamB: best.teamB.map((player) => player.id),
    averageEloA: best.eloA / RANKED_TEAM_SIZE,
    averageEloB: best.eloB / RANKED_TEAM_SIZE,
    averageEloDifference: best.delta / RANKED_TEAM_SIZE,
  };
}
