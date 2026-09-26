import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { EmptyState } from "@/components/ProductState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Search, Trophy, Filter, Pencil, Trash2, WalletCards, ArrowRightLeft, Lock, Gamepad2, RotateCcw } from "lucide-react";
import { GAMES } from "@/lib/demoData";
import { toast } from "sonner";

const TeamList = ({ ids, playerMap, playerAvatars, eloChanges, mvpId, merdaId }) => (
  <div className="flex-1 space-y-2">
    {ids.map((id) => {
      const p = playerMap[id];
      if (!p) return null;
      const delta = Number(eloChanges?.[id] ?? 0);
      const isMvp = id === mvpId;
      const isMerda = id === merdaId;

      return (
        <div key={id} className="flex items-center gap-2.5 min-w-0">
          <PlayerAvatar name={p.name} elo={p.currentElo} size={30} avatarUrl={playerAvatars?.[id]} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate flex items-center gap-1.5">
              <span className="truncate">{p.name}</span>
              {isMvp && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#D5A33A]/10 border border-[#D5A33A]/20 text-[#D5A33A] text-[8px] font-black uppercase tracking-wider shrink-0">
                  <span aria-hidden="true">🏆</span> MVP
                </span>
              )}
              {isMerda && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#8B5E3C]/10 border border-[#8B5E3C]/25 text-[#C79A6B] text-[8px] font-black uppercase tracking-wider shrink-0">
                  💩 MERDA
                </span>
              )}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-[#596170] mt-0.5">{p.currentElo} Elo</div>
          </div>
          <span
            className={`min-w-[52px] h-7 px-2 rounded-lg border inline-flex items-center justify-center font-mono text-[11px] font-black ${delta >= 0
              ? "text-emerald-400 bg-emerald-500/[0.06] border-emerald-500/15"
              : "text-red-400 bg-red-500/[0.06] border-red-500/15"}`}
          >
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </div>
      );
    })}
  </div>
);

export default function Matches() {
  const { matches, playerMap, playerAvatars, deleteMatch, isAdmin, adminCreateChallengePairings } = useData();
  const safeMatches = useMemo(
    () => (Array.isArray(matches) ? matches.filter(Boolean) : []),
    [matches]
  );
  const safePlayerMap = useMemo(
    () => (playerMap && typeof playerMap === "object" ? playerMap : {}),
    [playerMap]
  );
  const [editData, setEditData] = useState(null);
  const [query, setQuery] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [rematchBusyId, setRematchBusyId] = useState(null);

  const createRematch = async (match) => {
    if (!isAdmin || !match) return;

    const pairings = (Array.isArray(match.pairings) ? match.pairings : [])
      .filter((pair) => pair?.playerAId && pair?.playerBId && Number(pair?.amount || 0) > 0)
      .map((pair) => ({
        challengerPlayerId: pair.playerAId,
        challengedPlayerId: pair.playerBId,
        amount: Number(pair.amount || 0),
        platform: ["paypal", "revolut"].includes(String(pair.platform || "").toLowerCase())
          ? String(pair.platform).toLowerCase()
          : "paypal",
      }));

    if (!pairings.length) {
      toast.error("No valid Money Chall pairings found");
      return;
    }

    setRematchBusyId(match.id);
    const created = await adminCreateChallengePairings(pairings);
    setRematchBusyId(null);

    if (!created) return;
    toast.success(`Rematch created · ${created.length} chall${created.length === 1 ? "" : "s"}`);
  };

  const filtered = useMemo(() => {
    return safeMatches.filter((m) => {
      if (winnerFilter !== "all" && m.winner !== winnerFilter) return false;
      if (gameFilter !== "ALL" && m.game !== gameFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      const teamA = Array.isArray(m.teamA) ? m.teamA : [];
      const teamB = Array.isArray(m.teamB) ? m.teamB : [];
      const names = [...teamA, ...teamB].map((id) => safePlayerMap[id]?.name?.toLowerCase() || "");
      return names.some((n) => n.includes(q)) || (m.game || "").toLowerCase().includes(q) || (m.mode || "").toLowerCase().includes(q);
    });
  }, [safeMatches, query, winnerFilter, gameFilter, safePlayerMap]);

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="brand-kicker mb-1">History</div>
          <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Matches</h2>
          <p className="text-sm text-[#7F8795] mt-1">Final verified match history only.</p>
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
              aria-pressed={winnerFilter === f.k}
              onClick={() => setWinnerFilter(f.k)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                winnerFilter === f.k ? "bg-magma text-white border-magma" : "bg-[#0F1218] text-[#8D95A4] border-[#222834] hover:text-white"
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
        </div>
      </section>

      <div className="space-y-3" data-testid="matches-list">
        {filtered.length === 0 && (
          <EmptyState
            icon={Gamepad2}
            title={safeMatches.length === 0 ? "No matches yet" : "No matches found"}
            description={safeMatches.length === 0
              ? "Verified match results will appear here with Elo changes, MVP and MERDA."
              : "Try changing the search, game or winner filter."}
          />
        )}
        {filtered.map((m) => (
          <div key={m.id} className="m8-panel rounded-[22px] p-5 animate-fade-up overflow-hidden relative" data-testid={`match-row-${m.id}`}>
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: m.winner === "A"
                ? "linear-gradient(90deg, transparent, #FF2A3B, transparent)"
                : "linear-gradient(90deg, transparent, #D5A33A, transparent)" }}
            />
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-muted-foreground">{new Date(m.date).toLocaleString()}</span>
                {m.game && <span className="px-2 py-0.5 rounded-md bg-[#171B23] text-xs border border-[#2B313E] text-[#D5A33A] font-bold" data-testid={`match-game-${m.id}`}>{m.game}</span>}
                {m.mode && <span className="px-2 py-0.5 rounded-md bg-[#0F1218] text-xs border border-[#222834] text-[#AAB1BE]">{m.mode}</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide border"
                  style={{
                    background: m.winner === "A" ? "rgba(255,42,59,0.10)" : "rgba(213,163,58,0.10)",
                    color: m.winner === "A" ? "#FF5361" : "#E6B94E",
                    borderColor: m.winner === "A" ? "rgba(255,42,59,0.22)" : "rgba(213,163,58,0.22)",
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
            <div className="grid grid-cols-1 sm:grid-cols-2 items-stretch gap-3 sm:gap-4">
              <div
                className="rounded-xl p-4 border"
                style={{
                  background: m.winner === "A" ? "rgba(255,42,59,0.055)" : "rgba(15,18,24,.72)",
                  borderColor: m.winner === "A" ? "rgba(255,42,59,.20)" : "#1C202E",
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-black uppercase tracking-widest text-magma">Alpha</div>
                  {m.winner === "A" && <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-black">Winner</span>}
                </div>
                <TeamList ids={Array.isArray(m.teamA) ? m.teamA : []} playerMap={safePlayerMap} playerAvatars={playerAvatars} eloChanges={m.eloChanges} mvpId={m.mvpId} merdaId={m.merdaId} />
              </div>

              <div
                className="rounded-xl p-4 border"
                style={{
                  background: m.winner === "B" ? "rgba(213,163,58,0.05)" : "rgba(15,18,24,.72)",
                  borderColor: m.winner === "B" ? "rgba(213,163,58,.20)" : "#1C202E",
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-black uppercase tracking-widest text-gold">Bravo</div>
                  {m.winner === "B" && <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-black">Winner</span>}
                </div>
                <TeamList ids={Array.isArray(m.teamB) ? m.teamB : []} playerMap={safePlayerMap} playerAvatars={playerAvatars} eloChanges={m.eloChanges} mvpId={m.mvpId} merdaId={m.merdaId} />
              </div>
            </div>

            {Array.isArray(m.pairings) && m.pairings.filter(Boolean).length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#1D222C]" data-testid={`match-money-pairings-${m.id}`}>
                <div className="flex items-center gap-2 mb-3">
                  <WalletCards size={15} className="text-[#D5A33A]" />
                  <span className="brand-kicker">Money Chall Pairings</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{m.pairings.length} pairings</span>

                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          disabled={rematchBusyId === m.id}
                          className="h-8 px-3 rounded-lg bg-magma hover:bg-[#ff3c4c] text-white font-bold"
                          data-testid={`match-rematch-${m.id}`}
                        >
                          <RotateCcw size={13} className="mr-1.5" />
                          {rematchBusyId === m.id ? "Creating..." : "Rematch"}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Create rematch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This creates {m.pairings.filter(Boolean).length} new Money Challs with the same players, amounts and payment platforms.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-[#181B26] border-[#2A303B]">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => createRematch(m)}
                            className="bg-magma hover:bg-[#ff3c4c] text-white"
                          >
                            Create Rematch
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {m.pairings.filter(Boolean).map((pair, index) => {
                    const alpha = safePlayerMap[pair.playerAId];
                    const bravo = safePlayerMap[pair.playerBId];
                    const winnerId = m.winner === "A" ? pair.playerAId : pair.playerBId;
                    const winner = safePlayerMap[winnerId];

                    return (
                      <div key={pair.playerAId + "-" + pair.playerBId + "-" + index} className="m8-panel-quiet rounded-xl px-3 py-2.5">
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
                          <span>{String(pair.platform || "paypal").toUpperCase()}</span>
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

      <RecordMatchDialog
        open={!!editData}
        onOpenChange={(o) => !o && setEditData(null)}
        editData={editData}
        title="Edit Match"
      />

    </div>
  );
}
