import React, { useEffect, useMemo, useState } from "react";

const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");

const cacheKey = (game, mapName) =>
  `m8-map-preview-v5:${String(game || "")}:${String(mapName || "")}`;

const fandomMapsPreview = (game, mapName) => {
  if (!SUPABASE_URL || !game || !mapName) return "";
  const params = new URLSearchParams({
    game: String(game),
    map: String(mapName),
  });
  return `${SUPABASE_URL}/functions/v1/mucho8s-map-preview?${params.toString()}`;
};

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

export default function MapPreviewCard({
  mapName,
  game,
  mode,
  index = 0,
  compact = false,
  className = "",
}) {
  const primarySource = useMemo(
    () => fandomMapsPreview(game, mapName),
    [game, mapName]
  );

  const [source, setSource] = useState(() => readCached(game, mapName) || primarySource);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const cached = readCached(game, mapName);
    setLoaded(false);
    setSource(cached || primarySource || "");
  }, [game, mapName, primarySource]);

  const handleError = () => {
    setLoaded(false);
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
      {!loaded && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,.06),transparent_35%),linear-gradient(135deg,#161C26,#0B0F15)]" />
      )}

      {source && (
        <img
          src={source}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          data-preview-source="fandom-maps"
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
        {!loaded && !source && (
          <div className="text-[9px] uppercase tracking-wider text-white/35 mt-1.5">
            Preview unavailable
          </div>
        )}
      </div>
    </div>
  );
}
