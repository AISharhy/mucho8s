import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, UsersRound, X } from "lucide-react";

const initialsFor = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase() || "?";

export default function TournamentTeamRosterModal({
  team,
  onClose,
  switcheroo = false,
}) {
  const accent = switcheroo ? "#FF4FA3" : "#D5A33A";
  const roster = Array.isArray(team?.roster) ? team.roster : [];

  return (
    <AnimatePresence>
      {team && (
        <motion.div
          key={team.id || team.name}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[260] bg-[#03050A]/88 backdrop-blur-md flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 230, damping: 22 }}
            className="w-full max-w-md rounded-[24px] border bg-[#0B1017] shadow-[0_28px_90px_rgba(0,0,0,.58)] overflow-hidden"
            style={{ borderColor: switcheroo ? "rgba(255,79,163,.32)" : "rgba(213,163,58,.3)" }}
          >
            <div
              className="h-1"
              style={{
                background: switcheroo
                  ? "linear-gradient(90deg,transparent,#FF4FA3,transparent)"
                  : "linear-gradient(90deg,transparent,#D5A33A,transparent)",
              }}
            />

            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div
                    className="text-[9px] tracking-[.2em] font-black"
                    style={{ color: accent }}
                  >
                    TOURNAMENT TEAM
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <h2 className="font-display text-2xl font-black truncate">
                      {team.name || "Team"}
                    </h2>
                    {team.seed ? (
                      <span
                        className="h-6 px-2 rounded-lg border text-[9px] font-mono font-black inline-flex items-center"
                        style={{
                          borderColor: switcheroo
                            ? "rgba(255,79,163,.25)"
                            : "rgba(213,163,58,.25)",
                          color: accent,
                        }}
                      >
                        #{team.seed}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1.5">
                    <UsersRound size={13} />
                    {roster.length} PLAYER{roster.length === 1 ? "" : "S"}
                    {team.switcherooGeneration ? (
                      <span className="ml-1">· SWITCHEROO GEN {team.switcherooGeneration}</span>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 shrink-0 rounded-xl border border-[#2A303B] bg-[#111720] text-muted-foreground hover:text-white flex items-center justify-center"
                  aria-label="Close roster"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {roster.length ? (
                  roster.map((player, index) => (
                    <motion.div
                      key={player.id || player.name || index}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className="h-12 rounded-xl border border-[#252B36] bg-[#111720] px-3 flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-black"
                        style={{ backgroundColor: accent }}
                      >
                        {initialsFor(player.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black truncate">
                          {player.name || "Player"}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          PLAYER {index + 1}
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="min-h-[120px] rounded-xl border border-dashed border-[#2A303B] bg-[#0D1219] flex flex-col items-center justify-center text-center text-muted-foreground">
                    <UsersRound size={24} className="opacity-40" />
                    <div className="text-xs font-bold text-white mt-2">Roster not available</div>
                  </div>
                )}
              </div>

              {team.name && roster.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#202631] flex items-center justify-between text-[9px] text-muted-foreground">
                  <span>Click outside to close</span>
                  <span className="inline-flex items-center gap-1" style={{ color: accent }}>
                    <Crown size={11} />
                    MuchoTourney
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
