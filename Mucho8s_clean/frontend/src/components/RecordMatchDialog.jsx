import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import { GAMES } from "@/lib/demoData";

const MATCH_MODES = ["Hardpoint", "Search & Destroy"];
import { ArrowRightLeft, Crown, Plus, RotateCcw, Search, Trash2, WalletCards, Trophy } from "lucide-react";
import { toast } from "sonner";

export const RecordMatchDialog = ({
  open,
  onOpenChange,
  initialTeams,
  editData,
  defaultGame,
  defaultMode,
  title = "Record Mucho8s",
  reportOnly = false,
  lockTeams = false,
  lockContext = false,
  initialCaptains = null,
  creatorPlayerId = "",
  liveMatchId = "",
  liveOnly = false,
  onReported,
}) => {
  const { players, createMatchReport, createLiveMatch, editMatch } = useData();
  const [assign, setAssign] = useState({});
  const [winner, setWinner] = useState("A");
  const [mapWinners, setMapWinners] = useState([]);
  const [map, setMap] = useState("");
  const [mode, setMode] = useState(MATCH_MODES[0]);
  const [game, setGame] = useState(GAMES[0]);
  const [bestOf, setBestOf] = useState(3);
  const [query, setQuery] = useState("");
  const [moneySettings, setMoneySettings] = useState({});
  const [pairingOrder, setPairingOrder] = useState([]);
  const [extraPairings, setExtraPairings] = useState([]);
  const [submitting, setSubmitting] = useState(false);

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
    setMapWinners(Array.isArray(source?.mapResults) ? source.mapResults.map((row) => row?.winner || "") : []);
    setMap(editData?.map || "");
    setMode(editData?.mode || defaultMode || MATCH_MODES[0]);
    setGame(editData?.game || defaultGame || GAMES[0]);
    setBestOf(Array.isArray(source?.maps) && source.maps.length >= 5 ? 5 : 3);
    setQuery("");

    const nextMoney = {};
    const nextPairingOrder = [];
    const nextExtraPairings = [];
    const usedA = new Set();
    const usedB = new Set();

    (Array.isArray(source?.pairings) ? source.pairings : []).forEach((pair, index) => {
      const playerAId = String(pair?.playerAId || "").trim();
      const playerBId = String(pair?.playerBId || "").trim();
      if (!playerAId || !playerBId) return;

      const normalized = {
        id: `extra-${index}-${playerAId}-${playerBId}`,
        playerAId,
        playerBId,
        amount: String(Number(pair?.amount ?? 5)),
        platform: ["paypal", "revolut"].includes(String(pair?.platform || "").toLowerCase())
          ? String(pair.platform).toLowerCase()
          : "paypal",
      };

      if (!usedA.has(playerAId) && !usedB.has(playerBId)) {
        usedA.add(playerAId);
        usedB.add(playerBId);
        nextPairingOrder.push({ playerAId, playerBId });
        nextMoney[playerAId] = {
          amount: normalized.amount,
          platform: normalized.platform,
        };
      } else {
        nextExtraPairings.push(normalized);
      }
    });

    setPairingOrder(nextPairingOrder);
    setMoneySettings(nextMoney);
    setExtraPairings(nextExtraPairings);
  }, [open, editData?.id, liveMatchId, defaultGame, defaultMode]);

  const teamA = Object.keys(assign).filter((id) => assign[id] === "A");
  const teamB = Object.keys(assign).filter((id) => assign[id] === "B");

  const orderedPairings = (
    pairingOrder.length === teamA.length &&
    pairingOrder.every(
      (pair) => teamA.includes(pair.playerAId) && teamB.includes(pair.playerBId)
    )
  )
    ? pairingOrder
    : teamA.map((playerAId, index) => ({
        playerAId,
        playerBId: teamB[index],
      }));

  const moneyPairings = orderedPairings
    .map((pair) => {
      const playerAId = pair.playerAId;
      const playerBId = pair.playerBId;
      if (!playerAId || !playerBId) return null;
      const saved = moneySettings[playerAId] || {};
      return {
        key: playerAId,
        playerAId,
        playerBId,
        amount: saved.amount ?? "5",
        platform: ["paypal", "revolut"].includes(saved.platform) ? saved.platform : "paypal",
      };
    })
    .filter(Boolean);

  const updateMoneyPairing = (playerAId, field, value) => {
    setMoneySettings((prev) => ({
      ...prev,
      [playerAId]: {
        amount: prev[playerAId]?.amount ?? "5",
        platform: prev[playerAId]?.platform || "paypal",
        [field]: value,
      },
    }));
  };

  const updatePairingOpponent = (playerAId, nextPlayerBId) => {
    setPairingOrder((prev) => {
      const base =
        prev.length === teamA.length &&
        prev.every((pair) => teamA.includes(pair.playerAId) && teamB.includes(pair.playerBId))
          ? prev
          : teamA.map((id, index) => ({ playerAId: id, playerBId: teamB[index] }));

      const current = base.find((pair) => pair.playerAId === playerAId);
      const occupied = base.find(
        (pair) => pair.playerAId !== playerAId && pair.playerBId === nextPlayerBId
      );

      return base.map((pair) => {
        if (pair.playerAId === playerAId) {
          return { ...pair, playerBId: nextPlayerBId };
        }
        if (occupied && pair.playerAId === occupied.playerAId) {
          return { ...pair, playerBId: current?.playerBId || pair.playerBId };
        }
        return pair;
      });
    });
  };

  const addExtraPairing = () => {
    if (!teamA.length || !teamB.length) return;

    const existingKeys = new Set([
      ...moneyPairings.map((pair) => `${pair.playerAId}:${pair.playerBId}`),
      ...extraPairings.map((pair) => `${pair.playerAId}:${pair.playerBId}`),
    ]);

    let playerAId = teamA[0];
    let playerBId = teamB[0];
    let found = false;

    for (const alphaId of teamA) {
      for (const bravoId of teamB) {
        if (!existingKeys.has(`${alphaId}:${bravoId}`)) {
          playerAId = alphaId;
          playerBId = bravoId;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      toast.error("All cross-team Chall combinations are already in this match");
      return;
    }

    setExtraPairings((prev) => [
      ...prev,
      {
        id: `extra-${Date.now()}-${prev.length}`,
        playerAId,
        playerBId,
        amount: "5",
        platform: "paypal",
      },
    ]);
  };

  const updateExtraPairing = (id, field, value) => {
    setExtraPairings((prev) =>
      prev.map((pair) => (pair.id === id ? { ...pair, [field]: value } : pair))
    );
  };

  const removeExtraPairing = (id) => {
    setExtraPairings((prev) => prev.filter((pair) => pair.id !== id));
  };

  const submittedPairings = [
    ...moneyPairings,
    ...extraPairings,
  ].map((pair) => {
    const amount = Number(String(pair.amount).replace(",", "."));
    return {
      playerAId: pair.playerAId,
      playerBId: pair.playerBId,
      amount,
      platform: amount === 0 ? "free" : pair.platform,
    };
  });

  const primaryPairingsValid =
    moneyPairings.length === teamA.length &&
    moneyPairings.length === teamB.length &&
    new Set(moneyPairings.map((pair) => pair.playerAId)).size === teamA.length &&
    new Set(moneyPairings.map((pair) => pair.playerBId)).size === teamB.length;

  const pairingKeys = submittedPairings.map(
    (pair) => `${pair.playerAId}:${pair.playerBId}`
  );

  const moneyValid =
    primaryPairingsValid &&
    new Set(pairingKeys).size === pairingKeys.length &&
    submittedPairings.every(
      (pair) =>
        teamA.includes(pair.playerAId) &&
        teamB.includes(pair.playerBId) &&
        Number.isFinite(pair.amount) &&
        pair.amount >= 0 &&
        (pair.amount === 0 || ["paypal", "revolut"].includes(pair.platform))
    );

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

  const liveSeriesMaps = liveMatchId && Array.isArray(initialTeams?.maps)
    ? initialTeams.maps.filter(Boolean).slice(0, 5)
    : [];
  const winsNeeded = liveSeriesMaps.length >= 5 ? 3 : 2;
  const alphaMapWins = mapWinners.filter((side) => side === "A").length;
  const bravoMapWins = mapWinners.filter((side) => side === "B").length;
  const derivedWinner = alphaMapWins >= winsNeeded ? "A" : bravoMapWins >= winsNeeded ? "B" : "";
  const playedMapCount = mapWinners.filter(Boolean).length;
  const expectedPlayedMaps = derivedWinner ? alphaMapWins + bravoMapWins : 0;
  const mapResultsValid = !liveSeriesMaps.length || Boolean(
    derivedWinner &&
    playedMapCount === expectedPlayedMaps &&
    mapWinners.slice(0, expectedPlayedMaps).every(Boolean) &&
    mapWinners.slice(expectedPlayedMaps).every((side) => !side)
  );
  const chooseMapWinner = (index, side) => {
    setMapWinners((prev) => {
      const next = liveSeriesMaps.map((_, mapIndex) => prev[mapIndex] || "");
      const priorA = next.slice(0, index).filter((value) => value === "A").length;
      const priorB = next.slice(0, index).filter((value) => value === "B").length;
      if (priorA >= winsNeeded || priorB >= winsNeeded) return next;
      next[index] = side;
      const nextA = next.slice(0, index + 1).filter((value) => value === "A").length;
      const nextB = next.slice(0, index + 1).filter((value) => value === "B").length;
      if (nextA >= winsNeeded || nextB >= winsNeeded) {
        for (let i = index + 1; i < next.length; i += 1) next[i] = "";
      }
      return next;
    });
  };

  const effectiveCaptainA =
    editData?.captainAPlayerId ||
    initialCaptains?.A ||
    teamA[0] ||
    "";
  const effectiveCaptainB =
    editData?.captainBPlayerId ||
    initialCaptains?.B ||
    teamB[0] ||
    "";
  const teamsLocked = reportOnly || lockTeams;
  const valid =
    teamA.length === teamB.length &&
    teamA.length >= 2 &&
    teamA.length <= 4 &&
    Boolean(effectiveCaptainA && effectiveCaptainB) &&
    moneyValid &&
    mapResultsValid;

  const submit = async (withRechall = false) => {
    if (submitting) return;
    if (!valid) {
      toast.error(
        teamA.length !== teamB.length || teamA.length < 2 || teamA.length > 4
          ? "Both teams must be equal (2, 3 or 4 players each)"
          : "Every Mucho8s pairing needs a valid stake (0 or more)"
      );
      return;
    }

    setSubmitting(true);

    if (editData) {
      const payload = reportOnly
        ? {
            teamA: editData.teamA || [],
            teamB: editData.teamB || [],
            winner,
            mode: editData.mode || mode,
            game: editData.game || game,
            map: editData.map || "",
            date: editData.date,
            pairings: submittedPairings,
          }
        : {
            teamA,
            teamB,
            winner,
            mode,
            game,
            map,
            date: editData.date,
            pairings: submittedPairings,
          };

      const ok = await editMatch(editData.id, payload);
      if (!ok) {
        setSubmitting(false);
        return;
      }

      toast.success(
        reportOnly
          ? "Result reported — Elo & stats recalculated"
          : "Mucho8s updated — Elo & stats recalculated"
      );
    } else if (liveOnly) {
      const liveMatch = await createLiveMatch({
        teamA,
        teamB,
        game,
        mode,
        format: `${teamA.length}v${teamB.length}`,
        bestOf,
        pairings: submittedPairings,
      });
      if (!liveMatch) {
        setSubmitting(false);
        return;
      }

      toast.success("Mucho8s is now live");
      onReported?.(null, liveMatch);
    } else {
      const reportWinner = liveSeriesMaps.length ? derivedWinner : winner;
      const report = await createMatchReport({
        teamA,
        teamB,
        winner: reportWinner,
        scoreA: liveSeriesMaps.length ? alphaMapWins : 0,
        scoreB: liveSeriesMaps.length ? bravoMapWins : 0,
        mapResults: liveSeriesMaps.length
          ? liveSeriesMaps.slice(0, alphaMapWins + bravoMapWins).map((mapName, index) => ({ map: mapName, winner: mapWinners[index] }))
          : [],

        map,
        mode,
        game,
        pairings: submittedPairings,
        captainAPlayerId: effectiveCaptainA,
        captainBPlayerId: effectiveCaptainB,
        liveMatchId: liveMatchId || undefined,
      });
      if (!report) {
        setSubmitting(false);
        return;
      }

      let rechallLiveMatch = null;
      if (withRechall && liveMatchId) {
        rechallLiveMatch = await createLiveMatch({
          teamA,
          teamB,
          game,
          mode,
          format: `${teamA.length}v${teamB.length}`,
          bestOf,
          pairings: submittedPairings,
        });
      }

      toast.success(
        rechallLiveMatch
          ? "Result submitted — Mucho8s rematch is now live"
          : withRechall
            ? "Result submitted — Mucho8s rematch could not be created"
            : "Mucho8s submitted — waiting for Admin verification"
      );
      onReported?.(report, rechallLiveMatch);
    }

    setSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-[#101319] border-[#242A35] max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        data-testid="record-match-dialog"
      >
        <DialogHeader>
          <div className="mb-1"><ModeBadge mode="mucho8s" compact /></div>
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

          {teamsLocked ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-magma/5 border border-magma/20 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-magma">Alpha</div>
                  {creatorPlayerId && teamA.includes(creatorPlayerId) && (
                    <div className="text-[10px] font-semibold text-[#D5A33A]">
                      👑 Captain · {players.find((p) => p.id === creatorPlayerId)?.name || "—"}
                    </div>
                  )}
                </div>
                <div className="space-y-1 text-sm">
                  {teamA.map((id) => (
                    <div key={id} className="font-medium">
                      {players.find((p) => p.id === id)?.name || "Unknown"}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl bg-[#D5A33A]/5 border border-[#D5A33A]/20 p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-[10px] uppercase tracking-widest text-[#D5A33A]">Bravo</div>
                  {creatorPlayerId && teamB.includes(creatorPlayerId) && (
                    <div className="text-[10px] font-semibold text-[#D5A33A]">
                      👑 Captain · {players.find((p) => p.id === creatorPlayerId)?.name || "—"}
                    </div>
                  )}
                </div>
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

          {!liveOnly && liveSeriesMaps.length > 0 && (
            <div className="rounded-2xl bg-[#0F1218] border border-[#222834] p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Map results</Label>
                  <div className="text-sm font-black mt-0.5">Alpha {alphaMapWins} — {bravoMapWins} Bravo</div>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  {derivedWinner ? `${derivedWinner === "A" ? "Alpha" : "Bravo"} wins` : `First to ${winsNeeded}`}
                </span>
              </div>
              <div className="space-y-2">
                {liveSeriesMaps.map((mapName, index) => {
                  const previousA = mapWinners.slice(0, index).filter((side) => side === "A").length;
                  const previousB = mapWinners.slice(0, index).filter((side) => side === "B").length;
                  const seriesAlreadyEnded = previousA >= winsNeeded || previousB >= winsNeeded;
                  return (
                    <div key={mapName + index} className={"grid grid-cols-[1fr_auto_auto] gap-2 items-center rounded-xl border p-2.5 " + (seriesAlreadyEnded ? "border-[#1C212A] opacity-35" : "border-[#242A35]")}>
                      <div className="min-w-0">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Map {index + 1}</div>
                        <div className="text-xs font-bold truncate">{mapName}</div>
                      </div>
                      <Button type="button" disabled={seriesAlreadyEnded} onClick={() => chooseMapWinner(index, "A")} className={mapWinners[index] === "A" ? "h-9 bg-magma text-white" : "h-9 bg-[#111720] text-magma border border-magma/30"}>Alpha</Button>
                      <Button type="button" disabled={seriesAlreadyEnded} onClick={() => chooseMapWinner(index, "B")} className={mapWinners[index] === "B" ? "h-9 bg-[#D5A33A] text-black" : "h-9 bg-[#111720] text-[#D5A33A] border border-[#3A3320]"}>Bravo</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!liveOnly && liveSeriesMaps.length === 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Winner</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button type="button" data-testid="winner-alpha-btn" onClick={() => setWinner("A")} className={winner === "A" ? "bg-magma text-white" : "bg-[#0F1218] text-magma border border-magma/40 hover:bg-magma/10"}>Alpha</Button>
              <Button type="button" data-testid="winner-bravo-btn" onClick={() => setWinner("B")} className={winner === "B" ? "bg-[#D5A33A] text-black" : "bg-[#0F1218] text-[#D5A33A] border border-[#3A3320] hover:bg-[#D5A33A]/10"}>Bravo</Button>
            </div>
          </div>
          )}

          <div className="rounded-2xl bg-[#0F1218] border border-[#222834] p-4" data-testid="match-money-settings">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <WalletCards size={16} className="text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold">Money Chall Pairings</div>
                  <div className="text-[11px] text-muted-foreground">
                    Base pairings + optional extra Challs against another opponent.
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={addExtraPairing}
                disabled={!teamA.length || !teamB.length}
                className="h-8 px-2.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/[0.12] hover:text-emerald-300 text-[10px] font-black shrink-0"
              >
                <Plus size={13} className="mr-1" /> Add Chall
              </Button>
            </div>

            <div className="space-y-2">
              {moneyPairings.map((pair) => {
                const alpha = players.find((player) => player.id === pair.playerAId);
                const bravo = players.find((player) => player.id === pair.playerBId);

                return (
                  <div
                    key={pair.key}
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_100px_auto] gap-2 items-center rounded-xl bg-[#151923] border border-[#242A35] p-2.5"
                  >
                    <div className="text-sm font-semibold truncate">{alpha?.name || "Alpha"}</div>
                    <ArrowRightLeft size={13} className="text-muted-foreground" />
                    <select
                      value={pair.playerBId}
                      onChange={(event) => updatePairingOpponent(pair.playerAId, event.target.value)}
                      className="h-9 rounded-lg bg-[#0F1218] border border-[#2A303B] px-2 text-xs font-semibold min-w-0"
                      aria-label={`Opponent for ${alpha?.name || "Alpha"}`}
                    >
                      {teamB.map((id) => {
                        const opponent = players.find((player) => player.id === id);
                        return (
                          <option key={id} value={id}>
                            {opponent?.name || "Bravo"}
                          </option>
                        );
                      })}
                    </select>

                    <div className="relative col-span-2 sm:col-span-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.5"
                        value={pair.amount}
                        disabled={Number(pair.amount) === 0}
                        onChange={(event) => updateMoneyPairing(pair.playerAId, "amount", event.target.value)}
                        className="h-9 pl-6 bg-[#0F1218] border-[#2A303B] text-xs disabled:opacity-55"
                        aria-label={`Amount for ${alpha?.name || "Alpha"} vs ${bravo?.name || "Bravo"}`}
                      />
                    </div>

                    <label className="h-9 px-2.5 rounded-lg border border-[#2A303B] bg-[#0F1218] inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Number(pair.amount) === 0}
                        onChange={(event) =>
                          updateMoneyPairing(
                            pair.playerAId,
                            "amount",
                            event.target.checked ? "0" : "5"
                          )
                        }
                        className="accent-emerald-400"
                        aria-label={`Free Chall for ${alpha?.name || "Alpha"} vs ${bravo?.name || "Bravo"}`}
                      />
                      <span className={Number(pair.amount) === 0 ? "text-emerald-400" : "text-muted-foreground"}>
                        Free
                      </span>
                    </label>

                  </div>
                );
              })}
            </div>

            {extraPairings.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[#242A35]">
                <div className="text-[9px] uppercase tracking-[0.16em] text-emerald-400 font-black mb-2">
                  Extra Challs
                </div>
                <div className="space-y-2">
                  {extraPairings.map((pair, index) => {
                    const alpha = players.find((player) => player.id === pair.playerAId);
                    const bravo = players.find((player) => player.id === pair.playerBId);

                    return (
                      <div
                        key={pair.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_100px_auto_36px] gap-2 items-center rounded-xl bg-emerald-500/[0.035] border border-emerald-500/15 p-2.5"
                      >
                        <select
                          value={pair.playerAId}
                          onChange={(event) => updateExtraPairing(pair.id, "playerAId", event.target.value)}
                          className="h-9 rounded-lg bg-[#0F1218] border border-[#2A303B] px-2 text-xs font-semibold min-w-0"
                          aria-label={`Extra Chall alpha player ${index + 1}`}
                        >
                          {teamA.map((id) => {
                            const player = players.find((item) => item.id === id);
                            return <option key={id} value={id}>{player?.name || "Alpha"}</option>;
                          })}
                        </select>

                        <ArrowRightLeft size={13} className="text-emerald-400" />

                        <select
                          value={pair.playerBId}
                          onChange={(event) => updateExtraPairing(pair.id, "playerBId", event.target.value)}
                          className="h-9 rounded-lg bg-[#0F1218] border border-[#2A303B] px-2 text-xs font-semibold min-w-0"
                          aria-label={`Extra Chall bravo player ${index + 1}`}
                        >
                          {teamB.map((id) => {
                            const player = players.find((item) => item.id === id);
                            return <option key={id} value={id}>{player?.name || "Bravo"}</option>;
                          })}
                        </select>

                        <div className="relative col-span-2 sm:col-span-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={pair.amount}
                            disabled={Number(pair.amount) === 0}
                            onChange={(event) => updateExtraPairing(pair.id, "amount", event.target.value)}
                            className="h-9 pl-6 bg-[#0F1218] border-[#2A303B] text-xs disabled:opacity-55"
                            aria-label={`Extra Chall amount for ${alpha?.name || "Alpha"} vs ${bravo?.name || "Bravo"}`}
                          />
                        </div>

                        <label className="h-9 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Number(pair.amount) === 0}
                            onChange={(event) =>
                              updateExtraPairing(
                                pair.id,
                                "amount",
                                event.target.checked ? "0" : "5"
                              )
                            }
                            className="accent-emerald-400"
                            aria-label={`Free extra Chall for ${alpha?.name || "Alpha"} vs ${bravo?.name || "Bravo"}`}
                          />
                          <span className={Number(pair.amount) === 0 ? "text-emerald-400" : "text-muted-foreground"}>
                            Free
                          </span>
                        </label>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeExtraPairing(pair.id)}
                          className="h-9 w-9 p-0 rounded-lg border border-red-500/20 bg-red-500/[0.04] text-red-400 hover:bg-red-500/[0.10] hover:text-red-300 col-span-1"
                          aria-label={`Remove extra Chall ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {moneyPairings.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                Select both teams to configure Mucho8s pairings.
              </div>
            )}
          </div>

          {!reportOnly && !lockContext && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

              <div>
                <Label className="text-xs text-muted-foreground">Series</Label>
                <select
                  data-testid="best-of-select"
                  value={bestOf}
                  onChange={(e) => setBestOf(Number(e.target.value) === 5 ? 5 : 3)}
                  className="mt-1 w-full h-10 rounded-xl bg-[#0F1218] border border-[#9146FF]/35 text-[#C7A7FF] font-semibold px-3 text-sm"
                >
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                </select>
              </div>
            </div>
          )}

        </div>

        <DialogFooter className="gap-2 sm:gap-2 sm:flex-wrap">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            data-testid="record-cancel-btn"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          {!liveOnly && !editData && liveMatchId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void submit(true)}
              disabled={!valid || submitting}
              className="w-full sm:w-auto rounded-xl border-[#D5A33A]/40 bg-[#D5A33A]/[0.06] text-[#D5A33A] hover:bg-[#D5A33A]/10 hover:text-[#E3B95E]"
              data-testid="record-rechall-btn"
            >
              <RotateCcw size={16} className="mr-1.5" />
              {submitting ? "Submitting..." : "Submit + Rematch"}
            </Button>
          )}

          <Button
            type="button"
            onClick={() => void submit(false)}
            disabled={!valid || submitting}
            className="w-full sm:w-auto rounded-xl bg-magma hover:bg-[#ff3c4c] text-white"
            data-testid="record-save-btn"
          >
            <Crown size={16} className="mr-1" />
            {submitting
              ? (liveOnly ? "Starting..." : "Submitting...")
              : liveOnly
                ? "Start Mucho8s"
                : reportOnly
                  ? "Update Result"
                  : editData
                    ? "Update Mucho8s"
                    : "Submit Mucho8s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
