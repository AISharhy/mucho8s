import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import { MODES, GAMES } from "@/lib/demoData";
import { Crown, Search, WalletCards, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export const RecordMatchDialog = ({
  open,
  onOpenChange,
  initialTeams,
  editData,
  defaultGame,
  title = "Record Match",
  reportOnly = false,
}) => {
  const { players, createMatchReport, editMatch } = useData();
  const [assign, setAssign] = useState({});
  const [winner, setWinner] = useState("A");
  const [mvpId, setMvpId] = useState("");
  const [map, setMap] = useState("");
  const [mode, setMode] = useState(MODES[0]);
  const [game, setGame] = useState(GAMES[0]);
  const [query, setQuery] = useState("");
  const [pairings, setPairings] = useState([]);
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [captainA, setCaptainA] = useState("");
  const [captainB, setCaptainB] = useState("");

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
    setMode(editData?.mode || MODES[0]);
    setGame(editData?.game || defaultGame || GAMES[0]);
    setPairings(Array.isArray(source?.pairings) ? source.pairings : []);
    setScoreA(String(editData?.scoreA ?? 0));
    setScoreB(String(editData?.scoreB ?? 0));
    setCaptainA(editData?.captainAPlayerId || source?.teamA?.[0] || "");
    setCaptainB(editData?.captainBPlayerId || source?.teamB?.[0] || "");
    setQuery("");
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

  const effectiveCaptainA = teamA.includes(captainA) ? captainA : teamA[0] || "";
  const effectiveCaptainB = teamB.includes(captainB) ? captainB : teamB[0] || "";
  const numericScoreA = Math.max(0, Number(scoreA) || 0);
  const numericScoreB = Math.max(0, Number(scoreB) || 0);
  const scoreValid =
    (numericScoreA === 0 && numericScoreB === 0) ||
    (numericScoreA !== numericScoreB && (numericScoreA > numericScoreB ? "A" : "B") === winner);
  const valid =
    teamA.length === teamB.length &&
    teamA.length >= 2 &&
    teamA.length <= 4 &&
    Boolean(effectiveCaptainA && effectiveCaptainB) &&
    scoreValid;

  const updatePairing = (playerAId, field, value) => {
    setPairings((prev) => {
      const existing = prev.find((pair) => pair.playerAId === playerAId);
      const base = existing || {
        playerAId,
        playerBId: "",
        amount: 5,
        platform: "cmg",
      };

      const nextPair = {
        ...base,
        [field]: field === "amount" ? Math.max(0, Number(value) || 0) : value,
      };

      return [...prev.filter((pair) => pair.playerAId !== playerAId), nextPair];
    });
  };

  const cleanPairings = pairings
    .filter((pair) =>
      teamA.includes(pair.playerAId) &&
      teamB.includes(pair.playerBId) &&
      Number(pair.amount || 0) > 0
    )
    .map((pair) => ({
      playerAId: pair.playerAId,
      playerBId: pair.playerBId,
      amount: Number(pair.amount || 0),
      platform: ["cmg", "paypal", "revolut"].includes(pair.platform) ? pair.platform : "cmg",
    }));

  const submit = async () => {
    if (!valid) {
      if (!scoreValid) {
        toast.error("The selected winner must match the score");
      } else {
        toast.error("Both teams must be equal (2, 3 or 4 players each)");
      }
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
            pairings: cleanPairings,
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
        scoreA: numericScoreA,
        scoreB: numericScoreB,
        mvpId: mvpId || undefined,
        map,
        mode,
        game,
        pairings: cleanPairings,
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

              <div className="rounded-2xl bg-[#0F1218] border border-[#1D222C] p-4" data-testid="match-money-pairings">
                <div className="flex items-center gap-2 mb-3">
                  <WalletCards size={17} className="text-[#D5A33A]" />
                  <div>
                    <div className="font-display font-bold">Money Chall Pairings</div>
                    <div className="text-xs text-muted-foreground">
                      Admin can edit who challs who, stake and platform for this match.
                    </div>
                  </div>
                </div>

                {teamA.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Assign teams first.</div>
                ) : (
                  <div className="space-y-2">
                    {teamA.map((alphaId) => {
                      const alpha = players.find((p) => p.id === alphaId);
                      const pairing = pairings.find((pair) => pair.playerAId === alphaId);
                      const usedBravo = pairings
                        .filter((pair) => pair.playerAId !== alphaId)
                        .map((pair) => pair.playerBId);

                      return (
                        <div
                          key={alphaId}
                          className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_95px_105px] gap-2 sm:items-center rounded-xl bg-[#151923] border border-[#242A35] p-2.5"
                        >
                          <div className="text-sm font-semibold truncate">{alpha?.name || "Alpha"}</div>
                          <ArrowRightLeft size={14} className="hidden sm:block text-muted-foreground" />

                          <select
                            value={pairing?.playerBId || ""}
                            onChange={(e) => updatePairing(alphaId, "playerBId", e.target.value)}
                            className="h-9 rounded-lg bg-[#0F1218] border border-[#2A303B] px-2 text-xs"
                          >
                            <option value="">No pairing</option>
                            {teamB.map((bravoId) => {
                              const bravo = players.find((p) => p.id === bravoId);
                              return (
                                <option key={bravoId} value={bravoId} disabled={usedBravo.includes(bravoId)}>
                                  {bravo?.name || "Bravo"}
                                </option>
                              );
                            })}
                          </select>

                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={pairing?.amount ?? ""}
                              onChange={(e) => updatePairing(alphaId, "amount", e.target.value)}
                              className="h-9 pl-6 bg-[#0F1218] border-[#2A303B] text-xs"
                            />
                          </div>

                          <select
                            value={pairing?.platform || "cmg"}
                            onChange={(e) => updatePairing(alphaId, "platform", e.target.value)}
                            className="h-9 rounded-lg bg-[#0F1218] border border-[#2A303B] px-2 text-xs"
                          >
                            <option value="cmg">CMG</option>
                            <option value="paypal">PayPal</option>
                            <option value="revolut">Revolut</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}
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
                    {MODES.map((m) => <option key={m}>{m}</option>)}
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

          {!editData && (
            <div className="rounded-2xl bg-[#0F1218] border border-[#1D222C] p-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">Verification</div>
                <div className="font-display font-bold mt-1">Score & Captains</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Elo, wins/losses, streaks, MVP and Money Chall results update only after a captain confirms.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Alpha score</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    className="mt-1 bg-[#151923] border-[#2A303B]"
                    data-testid="score-alpha-input"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bravo score</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    className="mt-1 bg-[#151923] border-[#2A303B]"
                    data-testid="score-bravo-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Alpha captain</Label>
                  <select
                    value={effectiveCaptainA}
                    onChange={(e) => setCaptainA(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                    data-testid="captain-alpha-select"
                  >
                    {teamA.map((id) => (
                      <option key={id} value={id}>{players.find((p) => p.id === id)?.name || "Player"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Bravo captain</Label>
                  <select
                    value={effectiveCaptainB}
                    onChange={(e) => setCaptainB(e.target.value)}
                    className="mt-1 w-full h-10 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                    data-testid="captain-bravo-select"
                  >
                    {teamB.map((id) => (
                      <option key={id} value={id}>{players.find((p) => p.id === id)?.name || "Player"}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!scoreValid && (
                <div className="text-xs text-red-400">
                  The selected winner does not match the entered score.
                </div>
              )}
            </div>
          )}
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
