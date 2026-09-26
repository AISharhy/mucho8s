import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { GAMES } from "@/lib/demoData";

const MATCH_MODES = ["Hardpoint", "Search & Destroy"];
import { Crown, Search } from "lucide-react";
import { toast } from "sonner";

export const RecordMatchDialog = ({
  open,
  onOpenChange,
  initialTeams,
  editData,
  defaultGame,
  defaultMode,
  title = "Record Match",
  reportOnly = false,
}) => {
  const { players, createMatchReport, editMatch } = useData();
  const [assign, setAssign] = useState({});
  const [winner, setWinner] = useState("A");
  const [mvpId, setMvpId] = useState("");
  const [map, setMap] = useState("");
  const [mode, setMode] = useState(MATCH_MODES[0]);
  const [game, setGame] = useState(GAMES[0]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;

    const next = {};
    const source = editData || initialTeams;
    if (source) {
      (source.teamA || []).forEach((id) => (next[id] = "A"));
      (source.teamB || []).forEach((id) => (next[id] = "B"));
    }

    setAssign(next);
    setWinner(editData?.winner || "A");
    setMvpId(editData?.mvpId || "");
    setMap(editData?.map || "");
    setMode(editData?.mode || defaultMode || MATCH_MODES[0]);
    setGame(editData?.game || defaultGame || GAMES[0]);
    setQuery("");
  }, [open, initialTeams, editData, defaultGame, defaultMode]);

  const teamA = Object.keys(assign).filter((id) => assign[id] === "A");
  const teamB = Object.keys(assign).filter((id) => assign[id] === "B");
  const assigned = [...teamA, ...teamB];

  const cycle = (id) => {
    setAssign((prev) => {
      const cur = prev[id];
      const next = { ...prev };

      if (cur === "A") next[id] = "B";
      else if (cur === "B") delete next[id];
      else {
        if (teamA.length <= teamB.length && teamA.length < 4) next[id] = "A";
        else if (teamB.length < 4) next[id] = "B";
        else if (teamA.length < 4) next[id] = "A";
        else return prev;
      }

      return next;
    });
  };

  const filtered = useMemo(
    () => players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())),
    [players, query]
  );

  // Captains are assigned automatically from the generated team order.
  const effectiveCaptainA = teamA[0] || "";
  const effectiveCaptainB = teamB[0] || "";
  const valid =
    teamA.length === teamB.length &&
    teamA.length >= 2 &&
    teamA.length <= 4 &&
    Boolean(effectiveCaptainA && effectiveCaptainB);

  const submit = async () => {
    if (!valid) {
      toast.error("Both teams must be equal (2, 3 or 4 players each)");
      return;
    }

    if (editData) {
      const payload = reportOnly
        ? {
            teamA: editData.teamA || [],
            teamB: editData.teamB || [],
            winner,
            mvpId: mvpId || undefined,
            mode: editData.mode || mode,
            game: editData.game || game,
            map: editData.map || "",
            date: editData.date,
            pairings: Array.isArray(editData.pairings) ? editData.pairings : [],
          }
        : {
            teamA,
            teamB,
            winner,
            mvpId: mvpId || undefined,
            mode,
            game,
            map,
            date: editData.date,
            pairings: Array.isArray(editData.pairings) ? editData.pairings : [],
          };

      const ok = await editMatch(editData.id, payload);
      if (!ok) return;

      toast.success(
        reportOnly
          ? "Result reported — Elo & stats recalculated"
          : "Match updated — Elo & stats recalculated"
      );
    } else {
      const report = await createMatchReport({
        teamA,
        teamB,
        winner,
        scoreA: 0,
        scoreB: 0,
        mvpId: mvpId || undefined,
        map,
        mode,
        game,
        pairings: [],
        captainAPlayerId: effectiveCaptainA,
        captainBPlayerId: effectiveCaptainB,
      });
      if (!report) return;
      toast.success("Result submitted — waiting for captain verification");
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#101319] border-[#242A35] max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        data-testid="record-match-dialog"
      >
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto pr-1 space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-magma" /> Alpha
              <span className="font-mono font-bold text-magma">{teamA.length}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-[#D5A33A]" /> Bravo
              <span className="font-mono font-bold text-[#D5A33A]">{teamB.length}</span>
            </span>
            <span className="text-muted-foreground text-xs ml-auto">Teams must be equal (2–4 each)</span>
          </div>

          {reportOnly ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-magma/5 border border-magma/20 p-3">
                <div className="text-[10px] uppercase tracking-widest text-magma mb-2">Alpha</div>
                <div className="space-y-1 text-sm">
                  {teamA.map((id) => (
                    <div key={id} className="font-medium">
                      {players.find((p) => p.id === id)?.name || "Unknown"}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#D5A33A]/5 border border-[#D5A33A]/20 p-3">
                <div className="text-[10px] uppercase tracking-widest text-[#D5A33A] mb-2">Bravo</div>
                <div className="space-y-1 text-sm">
                  {teamB.map((id) => (
                    <div key={id} className="font-medium">
                      {players.find((p) => p.id === id)?.name || "Unknown"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  data-testid="record-match-search"
                  placeholder="Search players..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 bg-[#0F1218] border-[#222834] rounded-xl"
                />
              </div>

              <div className="max-h-[260px] overflow-y-auto pr-2 -mr-1" data-testid="record-player-scroll">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filtered.map((p) => {
                    const side = assign[p.id];
                    const color = side === "A" ? "#FF2A3B" : side === "B" ? "#D5A33A" : "#222834";

                    return (
                      <button
                        key={p.id}
                        data-testid={`record-player-${p.id}`}
                        onClick={() => cycle(p.id)}
                        className="flex items-center gap-2 p-2 rounded-xl text-left transition-all"
                        style={{
                          background: side ? `${color}18` : "#181B26",
                          border: `1px solid ${color}`,
                        }}
                      >
                        <PlayerAvatar name={p.name} elo={p.currentElo} size={30} />
                        <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                        <EloBadge elo={p.currentElo} />
                        {side && (
                          <span
                            className="text-[10px] font-bold px-1.5 rounded"
                            style={{ background: color, color: side === "A" ? "#fff" : "#000" }}
                          >
                            {side === "A" ? "α" : "β"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Winner</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  data-testid="winner-alpha-btn"
                  onClick={() => setWinner("A")}
                  className={winner === "A"
                    ? "bg-magma text-white flex-1"
                    : "flex-1 bg-[#0F1218] text-magma border border-magma/40 hover:bg-magma/10"}
                >
                  Alpha
                </Button>
                <Button
                  type="button"
                  data-testid="winner-bravo-btn"
                  onClick={() => setWinner("B")}
                  className={winner === "B"
                    ? "bg-[#D5A33A] text-black flex-1"
                    : "flex-1 bg-[#0F1218] text-[#D5A33A] border border-[#3A3320] hover:bg-[#D5A33A]/10"}
                >
                  Bravo
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">MVP (optional)</Label>
              <select
                data-testid="mvp-select"
                value={mvpId}
                onChange={(e) => setMvpId(e.target.value)}
                className="mt-1 w-full h-10 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
              >
                <option value="">No MVP</option>
                {assigned.map((id) => {
                  const p = players.find((x) => x.id === id);
                  return <option key={id} value={id}>{p?.name}</option>;
                })}
              </select>
            </div>

            {!reportOnly && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Mode</Label>
                  <select
                    data-testid="mode-select"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
                  >
                    {MATCH_MODES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Game</Label>
                  <select
                    data-testid="game-select"
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl bg-[#0F1218] border border-[#3A3320] text-[#D5A33A] font-semibold px-3 text-sm"
                  >
                    {GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="record-cancel-btn"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!valid}
            className="w-full sm:w-auto rounded-xl bg-magma hover:bg-[#ff3c4c] text-white"
            data-testid="record-save-btn"
          >
            <Crown size={16} className="mr-1" />
            {reportOnly ? "Update Result" : editData ? "Update Match" : "Submit for Verification"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
