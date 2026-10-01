import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Shuffle } from "lucide-react";

const PALETTE = [
  "#FF4FA3",
  "#7C3AED",
  "#E11D48",
  "#0F766E",
  "#2563EB",
  "#B45309",
  "#9333EA",
  "#BE123C",
];

const pointOnCircle = (cx, cy, radius, angleDeg) => {
  const angle = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
};

const slicePath = (startAngle, endAngle, radius = 48) => {
  const start = pointOnCircle(50, 50, radius, endAngle);
  const end = pointOnCircle(50, 50, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    "M 50 50",
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
};

export default function SwitcherooWheel({
  players = [],
  disabled = false,
  onSpinComplete,
  label = "SPIN",
  hint = "Click the wheel",
  sizeClass = "w-[280px] h-[280px] sm:w-[340px] sm:h-[340px]",
  spinSignal = 0,
  onActivate,
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const timerRef = useRef(null);
  const lastSignalRef = useRef(spinSignal);

  const displayPlayers = useMemo(() => {
    const clean = (Array.isArray(players) ? players : [])
      .filter(Boolean)
      .map((player, index) => ({
        id: String(player?.id || index),
        name: String(player?.name || "Player"),
      }));

    if (clean.length) return clean;

    return Array.from({ length: 8 }, (_, index) => ({
      id: `placeholder-${index}`,
      name: "MUCHO",
    }));
  }, [players]);

  const slices = useMemo(() => {
    const count = displayPlayers.length;
    const step = 360 / count;

    if (count === 1) {
      return [
        {
          ...displayPlayers[0],
          start: 0,
          end: 360,
          middle: 0,
          fill: PALETTE[0],
          full: true,
        },
      ];
    }

    return displayPlayers.map((player, index) => ({
      ...player,
      start: index * step,
      end: (index + 1) * step,
      middle: index * step + step / 2,
      fill: PALETTE[index % PALETTE.length],
      full: false,
    }));
  }, [displayPlayers]);

  const runSpin = (notify = true) => {
    if (spinning || displayPlayers.length < 2) return;
    if (notify && disabled) return;

    setSpinning(true);
    const extraTurns = 5 + Math.floor(Math.random() * 3);
    const landing = Math.floor(Math.random() * 360);
    setRotation((current) => current + extraTurns * 360 + landing);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setSpinning(false);
      if (notify) onSpinComplete?.();
      timerRef.current = null;
    }, 3300);
  };

  const spin = () => {
    if (onActivate) {
      if (!disabled && !spinning) onActivate();
      return;
    }
    runSpin(true);
  };

  useEffect(() => {
    if (lastSignalRef.current === spinSignal) return;
    lastSignalRef.current = spinSignal;
    if (Number(spinSignal || 0) > 0) runSpin(false);
    // The wheel intentionally reacts only to generation changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinSignal]);

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    []
  );

  const fontSize =
    displayPlayers.length > 24
      ? 2.2
      : displayPlayers.length > 16
        ? 2.7
        : displayPlayers.length > 10
          ? 3.2
          : 4;

  const labelRadius =
    displayPlayers.length > 20 ? 34 : displayPlayers.length > 12 ? 35 : 36;

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={spin}
        disabled={disabled || spinning}
        aria-label={spinning ? "Switcheroo wheel spinning" : "Spin the Switcheroo wheel"}
        className={
          "relative rounded-full select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4FA3] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0B0F15] disabled:cursor-not-allowed " +
          sizeClass
        }
      >
        <div className="absolute left-1/2 -top-3 -translate-x-1/2 z-30">
          <div className="w-0 h-0 border-l-[13px] border-r-[13px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#FFD1E8] drop-shadow-[0_3px_3px_rgba(0,0,0,.45)]" />
        </div>

        <div className="absolute inset-0 rounded-full border-[10px] border-[#242A33] bg-[#0A0E14] shadow-[inset_0_0_0_2px_rgba(255,79,163,.2),0_18px_50px_rgba(0,0,0,.32)]" />

        <motion.div
          className="absolute inset-[12px] rounded-full overflow-hidden"
          animate={{ rotate: rotation }}
          transition={{ duration: 3.3, ease: [0.08, 0.72, 0.12, 1] }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label="Switcheroo player wheel">
            {slices.map((slice) =>
              slice.full ? (
                <circle key={slice.id} cx="50" cy="50" r="48" fill={slice.fill} />
              ) : (
                <path
                  key={slice.id}
                  d={slicePath(slice.start, slice.end)}
                  fill={slice.fill}
                  stroke="rgba(255,255,255,.12)"
                  strokeWidth=".35"
                />
              )
            )}

            {slices.map((slice) => {
              const point = pointOnCircle(50, 50, labelRadius, slice.full ? 0 : slice.middle);
              const rotate = slice.full ? 0 : slice.middle;
              const shortName =
                slice.name.length > 12 ? slice.name.slice(0, 11) + "…" : slice.name;

              return (
                <text
                  key={"label-" + slice.id}
                  x={point.x}
                  y={point.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight="900"
                  fill="#FFFFFF"
                  transform={`rotate(${rotate} ${point.x} ${point.y})`}
                  style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,.45)", strokeWidth: 0.45 }}
                >
                  {shortName}
                </text>
              );
            })}

            <circle cx="50" cy="50" r="15.5" fill="#090D13" stroke="#FF4FA3" strokeWidth="1.1" />
            <circle cx="50" cy="50" r="12.2" fill="#111720" stroke="rgba(255,255,255,.12)" strokeWidth=".6" />
          </svg>
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-[82px] h-[82px] rounded-full border border-[#FF4FA3]/50 bg-[#0B0F15]/95 backdrop-blur flex flex-col items-center justify-center shadow-[0_0_30px_rgba(255,79,163,.16)]">
            <Shuffle size={19} className={spinning ? "text-[#FF9DCE] animate-pulse" : "text-[#FF4FA3]"} />
            <span className="font-display text-[10px] font-black tracking-[.13em] mt-1">
              {spinning ? "SPINNING" : label}
            </span>
          </div>
        </div>

        <div className="absolute inset-[2px] rounded-full border border-white/10 pointer-events-none z-20" />
      </button>

      <div className="mt-3 text-[10px] text-muted-foreground text-center">
        {spinning ? "Switcheroo is choosing…" : hint}
      </div>
    </div>
  );
}
