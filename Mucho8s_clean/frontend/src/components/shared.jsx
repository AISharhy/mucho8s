import React from "react";
import { tierOf, winRate } from "@/lib/elo";
import { Crown, Flame, TrendingUp, TrendingDown } from "lucide-react";

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
        background: "linear-gradient(145deg, #171B23, #101319)",
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
  <span className="inline-flex items-center gap-1 text-[#D5A33A] font-mono font-bold">
    <Crown size={14} className="text-[#D5A33A]" />
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
