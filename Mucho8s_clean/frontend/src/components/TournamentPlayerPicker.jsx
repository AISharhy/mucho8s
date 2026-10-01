import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GripVertical, Plus, Search, UserPlus, UsersRound, X } from "lucide-react";
import { playUiSound } from "@/lib/uiAudio";

export default function TournamentPlayerPicker({
  players = [],
  selected = [],
  paidIds = new Set(),
  pendingIds = new Set(),
  entryFee = 5,
  disabled = false,
  onChange,
}) {
  const [query, setQuery] = useState("");
  const [dragId, setDragId] = useState(null);

  const selectedIds = useMemo(
    () => new Set((selected || []).map((player) => String(player.id))),
    [selected]
  );

  const available = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (players || [])
      .filter((player) => !selectedIds.has(String(player.id)))
      .filter((player) =>
        term ? String(player.name || "").toLowerCase().includes(term) : true
      )
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [players, query, selectedIds]);

  const add = (player) => {
    if (disabled || !player || selectedIds.has(String(player.id))) return;
    void playUiSound("select", "switcheroo");
    onChange?.([...(selected || []), { id: player.id, name: player.name }]);
  };

  const remove = (player) => {
    if (disabled) return;
    void playUiSound("back", "switcheroo");
    onChange?.((selected || []).filter((row) => String(row.id) !== String(player.id)));
  };

  const reorder = (targetId) => {
    if (!dragId || dragId === targetId || disabled) return;
    const next = [...(selected || [])];
    const from = next.findIndex((row) => String(row.id) === String(dragId));
    const to = next.findIndex((row) => String(row.id) === String(targetId));
    if (from < 0 || to < 0) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void playUiSound("click", "switcheroo");
    onChange?.(next);
    setDragId(null);
  };

  return (
    <div className="grid lg:grid-cols-[1.05fr_.95fr] gap-4">
      <section className="rounded-[22px] border border-[#FF4FA3]/20 bg-[#0B1017] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] tracking-[.16em] text-[#FF4FA3] font-black">
              SELECTED PLAYERS
            </div>
            <div className="font-display text-lg font-black mt-1">
              Drag to reorder
            </div>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {(selected || []).length} selected
          </span>
        </div>

        <div className="mt-4 min-h-[260px]">
          <AnimatePresence initial={false}>
            {(selected || []).length ? (
              <motion.div layout className="space-y-2">
                {(selected || []).map((player, index) => {
                  const paid = paidIds.has(String(player.id));
                  const pending = pendingIds.has(String(player.id));
                  const locked = paid || pending;

                  return (
                    <motion.div
                      layout
                      key={player.id}
                      draggable={!disabled && !locked}
                      onDragStart={() => !locked && setDragId(String(player.id))}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => reorder(String(player.id))}
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.96 }}
                      className={
                        "rounded-xl border px-3 py-2.5 flex items-center gap-3 transition-all " +
                        (dragId === String(player.id)
                          ? "border-[#FF4FA3]/60 bg-[#FF4FA3]/10 opacity-65"
                          : "border-[#2A303B] bg-[#111720]")
                      }
                    >
                      <div className="w-7 text-center font-mono text-[10px] text-[#FF8BC5] font-black">
                        {index + 1}
                      </div>

                      <button
                        type="button"
                        disabled={disabled || locked}
                        className="text-[#596270] disabled:opacity-25 cursor-grab active:cursor-grabbing"
                        title={locked ? "Payment state locks this player" : "Drag to reorder"}
                      >
                        <GripVertical size={16} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black truncate">{player.name}</div>
                        <div className="text-[9px] text-muted-foreground mt-0.5">
                          {paid
                            ? "ENTRY PAID"
                            : pending
                              ? "PAYMENT PENDING"
                              : `€${entryFee} DUE`}
                        </div>
                      </div>

                      <span
                        className={
                          "h-6 px-2 rounded-lg border text-[8px] font-black flex items-center " +
                          (paid
                            ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                            : pending
                              ? "border-amber-500/20 bg-amber-500/[0.06] text-amber-300"
                              : "border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.05] text-[#FF8BC5]")
                        }
                      >
                        {paid ? "PAID" : pending ? "PENDING" : "SELECTED"}
                      </span>

                      <button
                        type="button"
                        disabled={disabled || locked}
                        onClick={() => remove(player)}
                        className="w-8 h-8 rounded-lg border border-[#2A303B] bg-[#0D1219] text-[#697181] hover:text-red-300 hover:border-red-500/20 disabled:opacity-25 flex items-center justify-center"
                        aria-label={`Remove ${player.name}`}
                      >
                        <X size={13} />
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-[250px] rounded-2xl border border-dashed border-[#2A303B] bg-[#0D1219] flex flex-col items-center justify-center text-center px-6"
              >
                <UsersRound size={28} className="text-[#FF4FA3] opacity-55" />
                <div className="font-display font-black mt-3">No players selected</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Add players from the list. Selected cards can be dragged to reorder.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <section className="rounded-[22px] border border-[#252B36] bg-[#0B1017] p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-[#FF4FA3]" />
          <div className="font-display font-black">Available players</div>
        </div>

        <div className="relative mt-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#596270]"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search player..."
            className="w-full h-10 rounded-xl bg-[#111720] border border-[#2A303B] pl-9 pr-3 text-xs focus:outline-none focus:border-[#FF4FA3]/35"
          />
        </div>

        <div className="mt-3 max-h-[430px] overflow-y-auto pr-1 space-y-1.5">
          {available.length ? (
            available.map((player) => (
              <motion.button
                layout
                key={player.id}
                type="button"
                disabled={disabled}
                onClick={() => add(player)}
                whileTap={{ scale: 0.985 }}
                className="w-full min-h-11 rounded-xl border border-[#252B36] bg-[#0D1219] px-3 py-2 flex items-center gap-3 text-left hover:border-[#FF4FA3]/30 hover:bg-[#FF4FA3]/[0.035] disabled:opacity-35"
              >
                <div className="w-8 h-8 rounded-full border border-[#FF4FA3]/20 bg-[#FF4FA3]/[0.06] text-[#FF8BC5] flex items-center justify-center text-[9px] font-black">
                  {String(player.name || "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black truncate">{player.name}</div>
                  <div className="text-[9px] text-muted-foreground">
                    {Number(player.currentElo || 0)} ELO
                  </div>
                </div>
                <Plus size={14} className="text-[#FF4FA3]" />
              </motion.button>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No players available.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
