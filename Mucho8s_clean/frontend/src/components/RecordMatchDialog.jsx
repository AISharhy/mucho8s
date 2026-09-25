import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { MODES, GAMES } from "@/lib/demoData";
import { Crown, Search } from "lucide-react";
import { toast } from "sonner";

// Reusable match recorder. initialTeams = { teamA: [ids], teamB: [ids] }
// editData = existing match object -> switches dialog to edit mode
export const RecordMatchDialog = ({ open, onOpenChange, initialTeams, editData, defaultGame, title = "Record Match" }) => {
  const { players, recordMatch, editMatch } = useData();
  const [assign, setAssign] = useState({}); // id -> 'A' | 'B'
  const [winner, setWinner] = useState("A");
  const [mvpId, setMvpId] = useState("");
  const [map, setMap] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [game, setGame] = useState(GAMES[0]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) {
      const next = {};
      const source = editData || initialTeams;
      if (source) {
        (source.teamA || []).forEach((id) => (next[id] = "A"));
        (source.teamB || []).forEach((id) => (next[id] = "B"));
      }
      setAssign(next);
      setWinner(editData?.winner || "A");
      setMvpId(editData?.mvpId || "");
      setMode(editData?.mode || MODES[0]);
      setGame(editData?.game || defaultGame || GAMES[0]);
      setQuery("");
    }
  }, [open, initialTeams, editData, defaultGame]);

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

  const valid = teamA.length === teamB.length && teamA.length >= 2 && teamA.length <= 4;

  const submit = () => {
    if (!valid) {
      toast.error("Both teams must be equal (2, 3 or 4 players each)");
      return;
    }
    if (editData) {
      editMatch(editData.id, { teamA, teamB, winner, mvpId: mvpId || undefined, mode, game });
      toast.success("Match updated — Elo & stats recalculated");
    } else {
      recordMatch({ teamA, teamB, winner, mvpId: mvpId || undefined, map, mode, game });
      toast.success("Match recorded — Elo & stats updated");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12141C] border-[#242938] max-w-2xl max-h-[90vh] flex flex-col" data-testid="record-match-dialog">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-magma" /> Alpha
            <span className="font-mono font-bold text-magma">{teamA.length}</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gold" /> Bravo
            <span className="font-mono font-bold text-gold">{teamB.length}</span>
          </span>
          <span className="text-muted-foreground text-xs ml-auto">Teams must be equal (2–4 each)</span>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="record-match-search"
            placeholder="Search players..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 bg-[#181B26] border-[#242938]"
          />
        </div>

        <div className="max-h-[260px] overflow-y-auto pr-2 -mr-1" data-testid="record-player-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((p) => {
              const side = assign[p.id];
              const color = side === "A" ? "#FF2A3B" : side === "B" ? "#FFB800" : "#242938";
              return (
                <button
                  key={p.id}
                  data-testid={`record-player-${p.id}`}
                  onClick={() => cycle(p.id)}
                  className="flex items-center gap-2 p-2 rounded-md text-left transition-all"
                  style={{ background: side ? `${color}18` : "#181B26", border: `1px solid ${color}` }}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Winner</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                data-testid="winner-alpha-btn"
                onClick={() => setWinner("A")}
                className={winner === "A" ? "bg-magma text-white flex-1" : "flex-1 bg-[#181B26] text-magma border border-magma/40 hover:bg-magma/10"}
              >
                Alpha
              </Button>
              <Button
                type="button"
                data-testid="winner-bravo-btn"
                onClick={() => setWinner("B")}
                className={winner === "B" ? "bg-gold text-black flex-1" : "flex-1 bg-[#181B26] text-gold border border-gold/40 hover:bg-gold/10"}
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
              className="mt-1 w-full h-10 rounded-md bg-[#181B26] border border-[#242938] px-3 text-sm"
            >
              <option value="">No MVP</option>
              {assigned.map((id) => {
                const p = players.find((x) => x.id === id);
                return (
                  <option key={id} value={id}>
                    {p?.name}
                  </option>
                );
              })}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <select
              data-testid="mode-select"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-[#181B26] border border-[#242938] px-3 text-sm"
            >
              {MODES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Game</Label>
            <select
              data-testid="game-select"
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="mt-1 w-full h-10 rounded-md bg-[#181B26] border border-gold/40 text-gold font-semibold px-3 text-sm"
            >
              {GAMES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="record-cancel-btn">
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid} className="bg-magma hover:bg-magma/90 text-white" data-testid="record-save-btn">
            <Crown size={16} className="mr-1" /> {editData ? "Update Match" : "Save Result"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
