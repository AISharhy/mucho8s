export const BEST_OF = 3;

export const COMPETITIVE_MAP_POOLS = {
  BO7: {
    "Search & Destroy": ["Den", "Frequency", "Gridlock", "Raid", "Scar", "Standoff", "Hacienda"],
    Hardpoint: ["Colossus", "Den", "Gridlock", "Frequency", "Scar", "Hacienda"],
  },
  BO6: {
    "Search & Destroy": ["Protocol", "Rewind", "Skyline", "Vault", "Hacienda", "Firing Range", "Fringe"],
    Hardpoint: ["Hacienda", "Protocol", "Red Card", "Skyline", "Vault"],
  },
  MW3: {
    "Search & Destroy": ["Highrise", "Invasion", "Karachi", "Rio", "6 Star", "Scrapyard"],
    Hardpoint: ["Sub Base", "Vista", "6 Star", "Karachi", "Rio"],
  },
  VG: {
    "Search & Destroy": ["Tuscan", "Berlin", "Bocage", "USS Texas", "Demyansk"],
    Hardpoint: ["Tuscan", "Gavutu", "Berlin", "Bocage"],
  },
  CW: {
    "Search & Destroy": ["Checkmate", "Moscow", "Raid", "Express", "Standoff", "Miami"],
    Hardpoint: ["Apocalypse", "Checkmate", "Garrison", "Moscow", "Raid"],
  },
  WW2: {
    Hardpoint: ["Ardennes Forest", "Gibraltar", "London Docks", "Sainte Marie du Mont"],
    "Search & Destroy": ["Ardennes Forest", "London Docks", "Sainte Marie du Mont", "USS Texas"],
  },
  BO2: {
    "Search & Destroy": ["Cargo", "Express", "Raid", "Slums", "Standoff", "Meltdown"],
    Hardpoint: ["Raid", "Standoff", "Slums", "Yemen"],
  },
};

export const competitiveMapPool = (game, mode, format = "") => {
  const source = COMPETITIVE_MAP_POOLS?.[game]?.[mode] || [];
  let pool = [...source];

  if (game === "MW3" && mode === "Search & Destroy" && format !== "2v2") {
    pool = pool.filter((map) => map !== "Scrapyard");
  }

  if (game === "CW" && mode === "Search & Destroy" && format === "2v2") {
    pool = pool.filter((map) => map !== "Miami");
  }

  return pool;
};

export const drawBo3Maps = (game, mode, format = "") => {
  const pool = competitiveMapPool(game, mode, format);
  if (pool.length < BEST_OF) return [];

  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, BEST_OF);
};
