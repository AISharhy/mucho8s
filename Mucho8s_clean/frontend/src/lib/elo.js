export const BASE_ELO = 1000;
export const MIN_ELO = 500;
export const WIN_DELTA = 25;
export const LOSS_DELTA = 25;
export const MVP_BONUS = 3;
export const MERDA_PENALTY = 0;
export const UPSET_BONUS = 0;

// Balancing formula weights
export const WEIGHTS = { peak: 0.6, current: 0.25, winRate: 0.15 };

export const winRate = (p) =>
  p.totalMatches > 0 ? Math.round((p.wins / p.totalMatches) * 1000) / 10 : 0;

// Composite player rating driven by main KPIs
export const playerRating = (p) => {
  const contextual = Number(p?.contextWinRate);
  const wr = Number.isFinite(contextual) ? contextual : winRate(p); // 0-100
  return WEIGHTS.peak * p.peakElo + WEIGHTS.current * p.currentElo + WEIGHTS.winRate * (wr * 15);
};

export const CONTEXT_CONFIDENCE_MATCHES = 6;

export const computeContextStats = (matches, { game = "ALL", mode = "ALL" } = {}) => {
  const filtered = (matches || [])
    .filter((m) => game === "ALL" || m.game === game)
    .filter((m) => mode === "ALL" || m.mode === mode)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const stats = {};
  const ensure = (id) =>
    stats[id] || (stats[id] = {
      currentElo: BASE_ELO,
      peakElo: BASE_ELO,
      wins: 0,
      losses: 0,
      totalMatches: 0,
      mvpCount: 0,
    });

  filtered.forEach((m) => {
    const winners = m.winner === "A" ? m.teamA : m.teamB;
    [...(m.teamA || []), ...(m.teamB || [])].forEach((id) => {
      const s = ensure(id);
      const baseDelta = Number(m.eloChanges?.[id] ?? 0);
      const pairing = (Array.isArray(m.pairings) ? m.pairings : []).find(
        (item) => item?.playerAId === id || item?.playerBId === id
      );
      const valueBonus = Math.max(0, Math.round(Number(pairing?.amount) || 0));
      const delta = baseDelta === 0
        ? 0
        : baseDelta + (baseDelta > 0 ? valueBonus : -valueBonus);
      s.currentElo = Math.max(MIN_ELO, s.currentElo + delta);
      s.peakElo = Math.max(s.peakElo, s.currentElo);
      s.totalMatches += 1;
      if (winners?.includes(id)) s.wins += 1;
      else s.losses += 1;
      if (m.mvpId === id) s.mvpCount += 1;
    });
  });

  return { stats, matches: filtered };
};

export const playerForContext = (player, contextStats = {}, minConfidenceMatches = CONTEXT_CONFIDENCE_MATCHES) => {
  const contextual = contextStats?.[player.id];
  if (!contextual) {
    return {
      ...player,
      contextMatches: 0,
      contextConfidence: 0,
      contextWinRate: winRate(player),
    };
  }

  const sample = Math.max(0, Number(contextual.totalMatches || 0));
  const confidence = Math.max(0, Math.min(1, sample / Math.max(1, minConfidenceMatches)));
  const globalWr = winRate(player);
  const contextWr = sample ? (Number(contextual.wins || 0) / sample) * 100 : globalWr;
  const blendedWr = globalWr * (1 - confidence) + contextWr * confidence;

  return {
    ...player,
    currentElo: Math.round(Number(player.currentElo || BASE_ELO) * (1 - confidence) + Number(contextual.currentElo || BASE_ELO) * confidence),
    peakElo: Math.round(Number(player.peakElo || BASE_ELO) * (1 - confidence) + Number(contextual.peakElo || BASE_ELO) * confidence),
    contextMatches: sample,
    contextConfidence: Math.round(confidence * 100),
    contextWinRate: Math.round(blendedWr * 10) / 10,
    contextRawWinRate: Math.round(contextWr * 10) / 10,
  };
};

// Rebuild per-game player stats (Elo/wins) purely from that game's match history.
export const computeGameStats = (matches, game) =>
  computeContextStats(matches, { game }).stats;

// Project a player onto a specific game's stats (falls back to baseline if never played it).
export const playerForGame = (player, gameStats) =>
  playerForContext(player, gameStats);

export const RANKS = [
  {
    id: "iron",
    name: "Iron",
    min: 500,
    max: 899,
    color: "#7C8798",
    accent: "#3D4654",
    roman: "VI",
    description: "Entry division",
  },
  {
    id: "bronze",
    name: "Bronze",
    min: 900,
    max: 999,
    color: "#C17845",
    accent: "#6D3D24",
    roman: "V",
    description: "Rising competitor",
  },
  {
    id: "silver",
    name: "Silver",
    min: 1000,
    max: 1099,
    color: "#C7CFDA",
    accent: "#727D8A",
    roman: "IV",
    description: "Proven player",
  },
  {
    id: "gold",
    name: "Gold",
    min: 1100,
    max: 1199,
    color: "#F4C451",
    accent: "#9B6A13",
    roman: "III",
    description: "High-level competitor",
  },
  {
    id: "platinum",
    name: "Platinum",
    min: 1200,
    max: 1349,
    color: "#65D5D3",
    accent: "#1D747A",
    roman: "II",
    description: "Elite division",
  },
  {
    id: "masters",
    name: "Masters",
    min: 1350,
    max: Infinity,
    color: "#F04A63",
    accent: "#8A1730",
    roman: "I",
    description: "Top MuchoMoney8s division",
  },
];

export const tierOf = (elo) => {
  const value = Math.max(MIN_ELO, Number(elo) || BASE_ELO);
  return RANKS.find((rank) => value >= rank.min && value <= rank.max) || RANKS[0];
};

export const rankProgress = (elo) => {
  const value = Math.max(MIN_ELO, Number(elo) || BASE_ELO);
  const rank = tierOf(value);
  const index = RANKS.findIndex((item) => item.id === rank.id);
  const next = RANKS[index + 1] || null;

  if (!next) {
    return {
      rank,
      next: null,
      progress: 100,
      eloNeeded: 0,
      start: rank.min,
      target: rank.min,
    };
  }

  const span = Math.max(1, next.min - rank.min);
  const progress = Math.max(0, Math.min(100, ((value - rank.min) / span) * 100));

  return {
    rank,
    next,
    progress: Math.round(progress),
    eloNeeded: Math.max(0, next.min - value),
    start: rank.min,
    target: next.min,
  };
};

const kCombos = (arr, k) => {
  const result = [];
  const helper = (start, combo) => {
    if (combo.length === k) {
      result.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  };
  helper(0, []);
  return result;
};

// Generate the most balanced split from an even number of players (4, 6 or 8).
// Splits into two equal teams of size players.length / 2.
export const balanceTeams = (players) => {
  if (!players || players.length < 4 || players.length % 2 !== 0) return null;
  const teamSize = players.length / 2;
  const anchor = players[0];
  const others = players.slice(1);
  const otherIdx = others.map((_, i) => i);
  const combos = kCombos(otherIdx, teamSize - 1); // unique splits (anchor fixed in A)
  let best = null;

  for (const c of combos) {
    const teamA = [anchor, ...c.map((i) => others[i])];
    const aIds = new Set(teamA.map((p) => p.id));
    const teamB = players.filter((p) => !aIds.has(p.id));
    const sA = teamA.reduce((s, p) => s + playerRating(p), 0);
    const sB = teamB.reduce((s, p) => s + playerRating(p), 0);
    const diff = Math.abs(sA - sB);
    if (!best || diff < best.diff) best = { teamA, teamB, sA, sB, diff };
  }

  const avg = (best.sA + best.sB) / 2;
  const balanceScore = Math.max(0, Math.min(100, 100 - (best.diff / avg) * 100));
  const avgA = best.sA / teamSize;
  const avgB = best.sB / teamSize;
  const probA = 1 / (1 + Math.pow(10, (avgB - avgA) / 400));

  return {
    teamA: best.teamA,
    teamB: best.teamB,
    teamSize,
    strengthA: Math.round(best.sA),
    strengthB: Math.round(best.sB),
    diff: Math.round(best.diff),
    balanceScore: Math.round(balanceScore * 10) / 10,
    probA: Math.round(probA * 1000) / 10,
    probB: Math.round((1 - probA) * 1000) / 10,
  };
};

export const nextStreak = (streak, won) => {
  if (won) return streak > 0 ? streak + 1 : 1;
  return streak < 0 ? streak - 1 : -1;
};
