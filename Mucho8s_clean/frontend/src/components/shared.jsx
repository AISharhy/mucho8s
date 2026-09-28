import React from "react";
import { tierOf, rankProgress, winRate } from "@/lib/elo";
import { rankArtworkFor } from "@/lib/rankVisuals";
import { Flame, TrendingUp, TrendingDown, Trophy } from "lucide-react";

export const PlayerAvatar = ({ name, size = 40, elo, avatarUrl }) => {
  const tier = tierOf(elo ?? 1000);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const initials = (name || "?")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  const baseStyle = {
    width: size,
    height: size,
    border: `1px solid ${tier.color}38`,
  };

  if (avatarUrl && !imageError) {
    return (
      <div
        className="rounded-lg shrink-0 shadow-sm overflow-hidden bg-[#101319]"
        style={baseStyle}
        title={name}
      >
        <img
          src={avatarUrl}
          alt={`${name || "Player"} Discord avatar`}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-lg font-display font-extrabold shrink-0 shadow-sm"
      style={{
        ...baseStyle,
        fontSize: size * 0.38,
        background: "linear-gradient(145deg, #181B26, #101319)",
        color: "#F3F4F6",
      }}
    >
      {initials}
    </div>
  );
};

export const EloBadge = ({ elo }) => {
  const tier = tierOf(elo);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-bold"
      style={{ background: "#0F1218", color: tier.color, border: `1px solid ${tier.color}32` }}
    >
      {elo}
    </span>
  );
};

export const RankArtwork = ({ elo, rank: providedRank, family, size = 48, className = "" }) => {
  const rank = providedRank || (elo !== undefined ? tierOf(elo) : null);
  const src = rankArtworkFor(family || rank);
  const label = rank?.name || String(family || "Rank");

  return (
    <img
      src={src}
      alt={`${label} rank`}
      width={size}
      height={size}
      loading="lazy"
      className={`rank-artwork shrink-0 object-cover ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(10, Math.round(size * 0.2)),
      }}
    />
  );
};

export const RankBadge = ({ elo, compact = false, showName = true, showElo = true }) => {
  const rank = tierOf(elo);
  const artworkSize = compact ? 34 : 48;

  return (
    <div className="inline-flex items-center gap-2.5" title={`${rank.name} · ${elo} Elo`}>
      <RankArtwork rank={rank} size={artworkSize} />

      {showName && (
        <div className="min-w-0">
          <div
            className={`font-display font-extrabold uppercase tracking-[0.12em] leading-none ${compact ? "text-[10px]" : "text-xs"}`}
            style={{ color: rank.color }}
          >
            {rank.name}
          </div>
          {!compact && showElo && (
            <div className="text-[10px] text-muted-foreground mt-1 font-mono">{elo} ELO</div>
          )}
        </div>
      )}
    </div>
  );
};

export const RankProgress = ({ elo, compact = false }) => {
  const info = rankProgress(elo);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-widest">
        <span style={{ color: info.rank.color }} className="font-bold">{info.rank.name}</span>
        <span className="text-muted-foreground">
          {info.next ? `${info.eloNeeded} ELO to ${info.next.name}` : "MAX RANK"}
        </span>
      </div>
      <div className={`overflow-hidden rounded-full bg-[#0B0D12] border border-[#222834] ${compact ? "h-1.5 mt-1.5" : "h-2 mt-2"}`}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${info.progress}%`,
            background: `linear-gradient(90deg, ${info.rank.accent}, ${info.rank.color})`,
            boxShadow: `0 0 12px ${info.rank.color}55`,
          }}
        />
      </div>
    </div>
  );
};

export const TierTag = ({ elo }) => {
  const tier = tierOf(elo);
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-widest"
      style={{ color: tier.color }}
    >
      {tier.name}
    </span>
  );
};

export const Last10 = ({ record }) => (
  <div className="flex items-center gap-0.5" data-testid="last10-record">
    {(record && record.length ? record : Array(10).fill("-")).slice(0, 10).map((r, i) => (
      <span
        key={i}
        className="w-2.5 h-2.5 rounded-[2px]"
        style={{
          background: r === "W" ? "#10B981" : r === "L" ? "#EF4444" : "#2A2F3E",
        }}
        title={r}
      />
    ))}
  </div>
);

export const StreakBadge = ({ streak }) => {
  if (!streak) return <span className="text-xs text-muted-foreground">—</span>;
  const win = streak > 0;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
      style={{
        background: win ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
        color: win ? "#10B981" : "#EF4444",
      }}
    >
      {win ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {Math.abs(streak)}{win ? "W" : "L"}
    </span>
  );
};

export const MvpBadge = ({ count }) => (
  <span className="inline-flex items-center gap-1 text-[#D5A33A] font-mono font-bold" title="MVP">
    <Trophy size={13} strokeWidth={2.2} />
    {count}
  </span>
);

export const merdaSeverity = (count) => {
  const value = Math.max(0, Number(count || 0));
  if (value >= 5) return "critical";
  if (value >= 3) return "heavy";
  if (value >= 1) return "active";
  return "none";
};

export const merdaSurfaceClass = (count) => {
  const severity = merdaSeverity(count);
  return severity === "none" ? "" : `merda-surface merda-surface-${severity}`;
};

export const MerdaBadge = ({ count, compact = false }) => {
  const value = Math.max(0, Number(count || 0));
  if (value <= 0) return null;
  const severity = merdaSeverity(value);

  return (
    <span
      className={`merda-badge merda-badge-${severity} ${compact ? "merda-badge-compact" : ""}`}
      title={`MERDA active x${value} · each win removes 1`}
      aria-label={`MERDA active x${value}`}
    >
      <span aria-hidden="true">💩</span>
      <span className="font-mono font-black">x{value}</span>
    </span>
  );
};

export const WinRatePill = ({ player }) => {
  const wr = winRate(player);
  const color = wr >= 55 ? "#10B981" : wr >= 45 ? "#FFB800" : "#EF4444";
  return (
    <span className="font-mono font-bold" style={{ color }}>
      {wr}%
    </span>
  );
};

export const HotIcon = () => <Flame size={14} className="text-magma" />;
