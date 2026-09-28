import React, { useEffect, useMemo, useState } from "react";

const FANDOM_FILE_REDIRECT = "https://callofduty.fandom.com/wiki/Special:Redirect/file/";
const FANDOM_API = "https://callofduty.fandom.com/api.php";

const GAME_FILE_TAGS = {
  BO7: ["BO7"],
  BO6: ["BO6"],
  MW3: ["MWIII", "MW3"],
  VG: ["Vanguard", "VG"],
  CW: ["BOCW", "Cold War"],
  WW2: ["WWII", "WW2"],
  BO2: ["BOII", "BO2"],
};

const MAP_ALIASES = {
  "Sainte Marie du Mont": ["Sainte Marie du Mont", "Saint Marie du Mont"],
  "6 Star": ["6 Star", "6Star"],
  "Sub Base": ["Sub Base", "SubBase"],
  "Red Card": ["Red Card", "RedCard"],
  "Firing Range": ["Firing Range", "FiringRange"],
  "USS Texas": ["USS Texas", "USS Texas 1945"],
};

const clean = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const fileRedirect = (filename) =>
  FANDOM_FILE_REDIRECT + encodeURIComponent(filename);

const unique = (values) => [...new Set(values.filter(Boolean))];

const candidateFilenames = (mapName, game) => {
  const names = MAP_ALIASES[mapName] || [mapName];
  const tags = GAME_FILE_TAGS[game] || [game].filter(Boolean);
  const patterns = [
    ["MenuScreen", "jpg"],
    ["MenuScreen", "png"],
    ["LoadingScreen", "png"],
    ["LoadingScreen", "jpg"],
    ["Loading Screen", "jpg"],
    ["Load Screen", "png"],
    ["Load Screen", "jpg"],
    ["Promo", "jpg"],
    ["Promo", "png"],
    ["Reveal", "png"],
    ["Aerial View", "png"],
    ["aerial view", "png"],
  ];

  const candidates = [];
  names.forEach((name) => {
    tags.forEach((tag) => {
      patterns.forEach(([stem, ext]) => {
        candidates.push(`${name} ${stem} ${tag}.${ext}`);
      });
    });
  });

  return unique(candidates);
};

const scoreSearchResult = (page, mapName, game) => {
  const title = clean(page?.title);
  const mapTokens = clean(mapName).split(" ").filter(Boolean);
  const tags = (GAME_FILE_TAGS[game] || [game]).map(clean).filter(Boolean);
  let score = 0;

  mapTokens.forEach((token) => {
    if (title.includes(token)) score += 7;
  });
  tags.forEach((tag) => {
    if (title.includes(tag)) score += 8;
  });

  if (title.includes("menuscreen")) score += 16;
  if (title.includes("loading")) score += 14;
  if (title.includes("load screen")) score += 14;
  if (title.includes("promo")) score += 10;
  if (title.includes("reveal")) score += 8;
  if (title.includes("minimap")) score -= 12;

  return score;
};

const cacheKey = (game, mapName) =>
  `m8-map-preview-v2:${String(game || "")}:${String(mapName || "")}`;

const readCached = (game, mapName) => {
  try {
    return localStorage.getItem(cacheKey(game, mapName)) || "";
  } catch {
    return "";
  }
};

const writeCached = (game, mapName, url) => {
  try {
    localStorage.setItem(cacheKey(game, mapName), url);
  } catch {
    // Ignore storage failures.
  }
};

const searchArchive = async (mapName, game) => {
  const primaryTag = GAME_FILE_TAGS[game]?.[0] || game || "";
  const search = [mapName, primaryTag, "multiplayer"].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: search,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "1400",
  });

  const response = await fetch(`${FANDOM_API}?${params.toString()}`, {
    mode: "cors",
    credentials: "omit",
  });
  if (!response.ok) return "";

  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {});
  const ranked = pages
    .filter((page) => page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url)
    .sort(
      (left, right) =>
        scoreSearchResult(right, mapName, game) -
        scoreSearchResult(left, mapName, game)
    );

  return ranked[0]?.imageinfo?.[0]?.thumburl || ranked[0]?.imageinfo?.[0]?.url || "";
};

export default function MapPreviewCard({
  mapName,
  game,
  mode,
  index = 0,
  compact = false,
  className = "",
}) {
  const candidates = useMemo(
    () => candidateFilenames(mapName, game).map(fileRedirect),
    [mapName, game]
  );
  const [source, setSource] = useState(() => readCached(game, mapName) || "");
  const [candidateIndex, setCandidateIndex] = useState(-1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const cached = readCached(game, mapName);

    setCandidateIndex(-1);
    setLoaded(false);
    setSource(cached || "");

    if (cached) {
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const found = await searchArchive(mapName, game);
        if (active && found) {
          setSource(found);
          return;
        }
      } catch {
        // Fall through to filename-based archive redirects.
      }

      if (active && candidates.length) {
        setCandidateIndex(0);
        setSource(candidates[0]);
      }
    })();

    return () => {
      active = false;
    };
  }, [game, mapName, candidates]);

  const handleError = () => {
    setLoaded(false);

    if (candidateIndex < 0) {
      if (candidates.length) {
        setCandidateIndex(0);
        setSource(candidates[0]);
      } else {
        setSource("");
      }
      return;
    }

    const next = candidateIndex + 1;
    if (next < candidates.length) {
      setCandidateIndex(next);
      setSource(candidates[next]);
      return;
    }

    setSource("");
  };

  const handleLoad = () => {
    setLoaded(true);
    if (source) writeCached(game, mapName, source);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[#2A303B] bg-[#0D1118] ${compact ? "min-h-[92px]" : "min-h-[138px]"} ${className}`}
    >
      {source && (
        <img
          src={source}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={handleLoad}
          onError={handleError}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-70" : "opacity-0"}`}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/15" />

      <div className={`relative z-10 h-full flex flex-col justify-end ${compact ? "p-3" : "p-4"}`}>
        <div className="text-[9px] uppercase tracking-[0.16em] text-white/60 font-black">
          Map {index + 1}
        </div>
        <div className={`font-display font-black text-white mt-1 drop-shadow ${compact ? "text-base" : "text-xl"}`}>
          {mapName}
        </div>
        <div className="text-[10px] text-white/70 mt-1 font-semibold">
          {[game, mode].filter(Boolean).join(" · ")}
        </div>
      </div>

      {!loaded && !source && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,.06),transparent_35%),linear-gradient(135deg,#161C26,#0B0F15)]" />
      )}
    </div>
  );
}
