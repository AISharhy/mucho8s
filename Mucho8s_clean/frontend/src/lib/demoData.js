import { uid } from "./storage";
import { winRate, nextStreak } from "./elo";

const NAMES = [
  "Reaper", "Ghxst", "Vortex", "N0Scope", "Havoc",
  "Blaze", "Cyclone", "Venom", "Sh4dow", "Frost",
  "Razor", "Titan", "Phantom", "Nitro", "Kraken",
  "Rogue", "Sniperz", "Blitz", "Echo", "Fury",
];

const MAPS = ["Terminal", "Nuketown", "Shipment", "Rust", "Highrise", "Firing Range", "Standoff", "Raid"];
const MODES = ["Hardpoint", "Search & Destroy"];
const GAMES = ["BO7", "BO6", "MW3", "WW2", "VG", "CW", "BO2", "MW4"];

// deterministic PRNG so demo data is stable per generation
const makeRand = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

export const generatePlayers = () => {
  const rand = makeRand(1337);
  return NAMES.map((name, i) => {
    const totalMatches = 24 + Math.floor(rand() * 66);
    const wr = 0.34 + rand() * 0.42; // 34% - 76%
    const wins = Math.round(totalMatches * wr);
    const losses = totalMatches - wins;
    const currentElo = 860 + Math.floor(rand() * 700);
    const peakElo = currentElo + 20 + Math.floor(rand() * 160);
    const mvpCount = Math.floor(wins * (0.1 + rand() * 0.25));
    const avgPlacement = Math.round((1 + rand() * 3) * 10) / 10;

    const last10 = Array.from({ length: 10 }, () => (rand() < wr ? "W" : "L"));
    let streakVal = 1;
    for (let s = 1; s < last10.length; s++) {
      if (last10[s] === last10[0]) streakVal++;
      else break;
    }
    const currentStreak = last10[0] === "W" ? streakVal : -streakVal;

    // random-walk elo history landing near currentElo
    const points = 14;
    const history = [];
    let elo = 1000;
    for (let m = 0; m <= points; m++) {
      const target = 1000 + ((currentElo - 1000) * m) / points;
      elo = Math.round(target + (rand() - 0.5) * 60);
      history.push({ match: m, elo: Math.max(500, elo) });
    }
    history[history.length - 1] = { match: points, elo: currentElo };

    return {
      id: uid(),
      name,
      currentElo,
      peakElo,
      totalMatches,
      wins,
      losses,
      avgPlacement,
      last10,
      currentStreak,
      mvpCount,
      eloHistory: history,
      createdAt: new Date(Date.now() - (20 - i) * 86400000).toISOString(),
    };
  });
};

export const generateMatches = (players) => {
  const rand = makeRand(9001);
  const matches = [];
  for (let i = 0; i < 10; i++) {
    const pool = [...players].sort(() => rand() - 0.5).slice(0, 8);
    const teamA = pool.slice(0, 4).map((p) => p.id);
    const teamB = pool.slice(4, 8).map((p) => p.id);
    const winner = rand() < 0.5 ? "A" : "B";
    const winIds = winner === "A" ? teamA : teamB;
    const mvpId = winIds[Math.floor(rand() * winIds.length)];
    const eloChanges = {};
    [...teamA, ...teamB].forEach((id) => {
      const won = winIds.includes(id);
      eloChanges[id] = (won ? 25 : -25) + (id === mvpId ? 10 : 0);
    });
    matches.push({
      id: uid(),
      date: new Date(Date.now() - (10 - i) * 86400000 - Math.floor(rand() * 40000000)).toISOString(),
      teamA,
      teamB,
      winner,
      mvpId,
      map: MAPS[Math.floor(rand() * MAPS.length)],
      mode: MODES[Math.floor(rand() * MODES.length)],
      game: GAMES[Math.floor(rand() * GAMES.length)],
      eloChanges,
    });
  }
  return matches.sort((a, b) => new Date(b.date) - new Date(a.date));
};

export { MAPS, MODES, GAMES };

// re-export for convenience where imported from demoData
export { winRate, nextStreak };
