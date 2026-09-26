import React from "react";
import { tierOf, rankProgress, winRate } from "@/lib/elo";
import { Crown, Flame, TrendingUp, TrendingDown, ChevronUp } from "lucide-react";

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

export const RankBadge = ({ elo, compact = false, showName = true }) => {
  const rank = tierOf(elo);
  const shieldSize = compact ? 34 : 48;

  return (
    <div className="inline-flex items-center gap-2.5" title={`${rank.name} · ${elo} Elo`}>
      <div
        className="relative shrink-0 rank-emblem"
        style={{ width: shieldSize, height: shieldSize }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: "polygon(50% 0%, 91% 20%, 82% 77%, 50% 100%, 18% 77%, 9% 20%)",
            background: `linear-gradient(145deg, ${rank.color}, ${rank.accent} 65%, #090A0F)`,
            boxShadow: `0 0 18px ${rank.color}33`,
          }}
        />
        <div
          className="absolute"
          style={{
            inset: compact ? 3 : 4,
            clipPath: "polygon(50% 0%, 91% 20%, 82% 77%, 50% 100%, 18% 77%, 9% 20%)",
            background: "linear-gradient(180deg, rgba(255,255,255,.13), rgba(255,255,255,0) 35%), #0B0D12",
            border: `1px solid ${rank.color}66`,
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <ChevronUp size={compact ? 13 : 17} style={{ color: rank.color }} strokeWidth={3} />
          <span
            className="font-display font-black leading-none"
            style={{ color: rank.color, fontSize: compact ? 9 : 11 }}
          >
            {rank.roman}
          </span>
        </div>
      </div>

      {showName && (
        <div className="min-w-0">
          <div
            className={`font-display font-extrabold uppercase tracking-[0.12em] leading-none ${compact ? "text-[10px]" : "text-xs"}`}
            style={{ color: rank.color }}
          >
            {rank.name}
          </div>
          {!compact && (
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
    <span aria-hidden="true">🏆</span>
    {count}
  </span>
);

export const MerdaBadge = ({ count }) => (
  <span className="inline-flex items-center gap-1 text-[#C79A6B] font-mono font-bold">
    <span aria-hidden="true">💩</span>
    {count}
  </span>
);

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
