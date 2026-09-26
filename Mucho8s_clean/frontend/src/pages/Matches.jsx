import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import MatchResultCenter from "@/components/MatchResultCenter";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Crown, Trophy, Filter, Pencil, Trash2, WalletCards, ArrowRightLeft, Lock } from "lucide-react";
import { GAMES } from "@/lib/demoData";
import { toast } from "sonner";

const TeamList = ({ ids, playerMap, eloChanges, color, mvpId }) => (
  <div className="flex-1 space-y-1">
    {ids.map((id) => {
      const p = playerMap[id];
      if (!p) return null;
      const delta = eloChanges?.[id] ?? 0;
      return (
        <div key={id} className="flex items-center gap-2 text-sm">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="truncate flex items-center gap-1">
            {p.name}
            {id === mvpId && <Crown size={12} className="text-gold" />}
          </span>
          <span className={`ml-auto font-mono text-xs ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </div>
      );
    })}
  </div>
);

export default function Matches() {
  const { matches, playerMap, deleteMatch, isAdmin } = useData();
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [query, setQuery] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (winnerFilter !== "all" && m.winner !== winnerFilter) return false;
      if (gameFilter !== "ALL" && m.game !== gameFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      const names = [...m.teamA, ...m.teamB].map((id) => playerMap[id]?.name?.toLowerCase() || "");
      return names.some((n) => n.includes(q)) || (m.game || "").toLowerCase().includes(q) || (m.mode || "").toLowerCase().includes(q);
    });
  }, [matches, query, winnerFilter, gameFilter, playerMap]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">History</div>
          <h2 className="font-display text-2xl font-extrabold">Matches</h2>
          <p className="text-sm text-[#7F8795] mt-1">Search, review and manage every recorded lobby.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="matches-search-input"
            placeholder="Search by player, game or mode..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-[#0F1218] border-[#222834] h-11 rounded-xl"
          />
        </div>
        <select
          data-testid="matches-game-filter"
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="h-11 w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] font-semibold px-3 text-sm"
        >
          <option value="ALL">All Games</option>
          {GAMES.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-muted-foreground" />
          {[
            { k: "all", l: "All" },
            { k: "A", l: "Alpha" },
            { k: "B", l: "Bravo" },
          ].map((f) => (
            <button
              key={f.k}
              data-testid={`matches-filter-${f.k}`}
              onClick={() => setWinnerFilter(f.k)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                winnerFilter === f.k ? "bg-magma text-white border-magma" : "bg-[#0F1218] text-[#8D95A4] border-[#222834] hover:text-white"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        <Button onClick={() => setOpen(true)} data-testid="new-match-btn" disabled={!isAdmin} title={isAdmin ? "" : "Admin only"} className="w-full sm:w-auto bg-magma hover:bg-[#ff3c4c] text-white font-semibold h-11 rounded-xl disabled:opacity-40">
          <Plus size={18} className="mr-1" /> New Match
        </Button>
        </div>
      </div>

      <MatchResultCenter />

      <div className="space-y-3" data-testid="matches-list">
        {filtered.length === 0 && (
          <div className="card-surface rounded-2xl p-16 text-center text-muted-foreground">No matches found.</div>
        )}
        {filtered.map((m) => (
          <div key={m.id} className="card-surface rounded-2xl p-5 animate-fade-up" data-testid={`match-row-${m.id}`}>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground">{new Date(m.date).toLocaleString()}</span>
                {m.game && <span className="px-2 py-0.5 rounded-md bg-[#171B23] text-xs border border-[#2B313E] text-[#D5A33A] font-bold" data-testid={`match-game-${m.id}`}>{m.game}</span>}
                {m.mode && <span className="px-2 py-0.5 rounded-md bg-[#0F1218] text-xs border border-[#222834] text-[#AAB1BE]">{m.mode}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold"
                  style={{
                    background: m.winner === "A" ? "rgba(255,42,59,0.15)" : "rgba(213,163,58,0.12)",
                    color: m.winner === "A" ? "#FF2A3B" : "#D5A33A",
                  }}
                >
                  <Trophy size={13} />
                  {m.winner === "A" ? "Alpha" : "Bravo"} won
                  {(Number(m.scoreA || 0) > 0 || Number(m.scoreB || 0) > 0) && (
                    <span className="ml-1 font-mono">{Number(m.scoreA || 0)}-{Number(m.scoreB || 0)}</span>
                  )}
                </span>
                {m.locked && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06]">
                    <Lock size={12} /> LOCKED
                  </span>
                )}

                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      data-testid={`match-edit-${m.id}`}
                      onClick={() => setEditData(m)}
                      className="h-9 px-3 rounded-lg bg-[#0F1218] border border-[#222834] text-[#C8CED8] hover:text-white hover:bg-white/[0.04]"
                    >
                      <Pencil size={14} className="mr-1.5" /> Edit
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          data-testid={`match-delete-${m.id}`}
                          className="h-9 px-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 size={14} className="mr-1.5" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display">Delete this match?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The match will be removed and every player's Elo, wins/losses and stats will be recalculated.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-[#0F1218] border-[#222834]">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            data-testid={`match-delete-confirm-${m.id}`}
                            onClick={async () => {
                              const ok = await deleteMatch(m.id);
                              if (ok) toast.success("Match deleted — stats recalculated");
                            }}
                            className="bg-magma hover:bg-magma/90 text-white"
                          >
                            Delete Match
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
              <div className="flex-1 p-3 rounded-lg" style={{ background: m.winner === "A" ? "rgba(255,42,59,0.06)" : "transparent", border: "1px solid #1C202E" }}>
                <div className="text-xs font-bold uppercase tracking-widest text-magma mb-2">Alpha</div>
                <TeamList ids={m.teamA} playerMap={playerMap} eloChanges={m.eloChanges} color="#FF2A3B" mvpId={m.mvpId} />
              </div>
              <div className="flex items-center justify-center font-display font-bold text-muted-foreground py-1 sm:py-0">VS</div>
              <div className="flex-1 p-3 rounded-lg" style={{ background: m.winner === "B" ? "rgba(213,163,58,0.05)" : "transparent", border: "1px solid #1C202E" }}>
                <div className="text-xs font-bold uppercase tracking-widest text-gold mb-2">Bravo</div>
                <TeamList ids={m.teamB} playerMap={playerMap} eloChanges={m.eloChanges} color="#D5A33A" mvpId={m.mvpId} />
              </div>
            </div>

            {Array.isArray(m.pairings) && m.pairings.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#1D222C]" data-testid={`match-money-pairings-${m.id}`}>
                <div className="flex items-center gap-2 mb-3">
                  <WalletCards size={15} className="text-[#D5A33A]" />
                  <span className="brand-kicker">Money Chall Pairings</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{m.pairings.length} pairings</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {m.pairings.map((pair, index) => {
                    const alpha = playerMap[pair.playerAId];
                    const bravo = playerMap[pair.playerBId];
                    const winnerId = m.winner === "A" ? pair.playerAId : pair.playerBId;
                    const winner = playerMap[winnerId];

                    return (
                      <div key={pair.playerAId + "-" + pair.playerBId + "-" + index} className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-3 py-2.5">
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <span className={`font-semibold truncate ${winnerId === pair.playerAId ? "text-emerald-400" : ""}`}>
                            {alpha?.name || "Alpha"}
                          </span>
                          <ArrowRightLeft size={13} className="text-muted-foreground shrink-0" />
                          <span className={`font-semibold truncate ${winnerId === pair.playerBId ? "text-emerald-400" : ""}`}>
                            {bravo?.name || "Bravo"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                          <span>€{Number(pair.amount || 0).toFixed(2)}</span>
                          <span>·</span>
                          <span>{String(pair.platform || "cmg").toUpperCase()}</span>
                          <span className="ml-auto text-emerald-400">{winner?.name || "Winner"} won</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <RecordMatchDialog open={open} onOpenChange={setOpen} title="New Match" />
      <RecordMatchDialog
        open={!!editData}
        onOpenChange={(o) => !o && setEditData(null)}
        editData={editData}
        title="Edit Match"
      />

    </div>
  );
}
