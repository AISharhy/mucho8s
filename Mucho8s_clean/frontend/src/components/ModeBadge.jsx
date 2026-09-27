import React from "react";
import {
  UsersRound,
  Landmark,
  Medal,
  Trophy,
} from "lucide-react";

export const MODE_META = {
  mucho8s: {
    label: "Mucho8s",
    family: "Trophy8s",
    color: "#FF2A3B",
    textClass: "text-magma",
    borderClass: "border-magma/25",
    bgClass: "bg-magma/[0.06]",
    icon: UsersRound,
  },
  mucho1v1: {
    label: "Mucho1v1",
    family: "Trophy1v1",
    color: "#34D399",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/25",
    bgClass: "bg-emerald-500/[0.06]",
    icon: Landmark,
  },
  muchoranked: {
    label: "MuchoRanked",
    family: "TrophyRanked",
    color: "#4F8CFF",
    textClass: "text-[#4F8CFF]",
    borderClass: "border-[#4F8CFF]/25",
    bgClass: "bg-[#4F8CFF]/[0.06]",
    icon: Medal,
  },
  muchotourney: {
    label: "MuchoTourney",
    family: "TrophyTourney",
    color: "#D5A33A",
    textClass: "text-[#D5A33A]",
    borderClass: "border-[#D5A33A]/25",
    bgClass: "bg-[#D5A33A]/[0.06]",
    icon: Trophy,
  },
};

export const modeKeyFromSource = (source = "") => {
  const normalized = String(source || "").toLowerCase();
  if (["ranked", "muchoranked"].includes(normalized)) return "muchoranked";
  if (["tourney", "tournament", "muchotourney"].includes(normalized)) return "muchotourney";
  if (["direct", "1v1", "mucho1v1"].includes(normalized)) return "mucho1v1";
  return "mucho8s";
};

export const isDirectMucho1v1 = (challenge) => {
  const source = String(challenge?.source || "").toLowerCase();
  return !["match_pairing", "balancer_pairing"].includes(source);
};

export default function ModeBadge({
  mode = "mucho8s",
  compact = false,
  showIcon = true,
  className = "",
}) {
  const meta = MODE_META[mode] || MODE_META.mucho8s;
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border font-black uppercase tracking-[0.12em] ${compact ? "h-6 px-2 text-[8px]" : "h-7 px-2.5 text-[9px]"} ${meta.textClass} ${meta.borderClass} ${meta.bgClass} ${className}`}
    >
      {showIcon && <Icon size={compact ? 10 : 11} strokeWidth={2.2} />}
      {meta.label}
    </span>
  );
}
