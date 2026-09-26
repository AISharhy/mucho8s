import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import { EmptyState } from "@/components/ProductState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Trophy,
  Filter,
  Pencil,
  Trash2,
  WalletCards,
  ArrowRightLeft,
  Lock,
  Gamepad2,
  RotateCcw,
  Swords,
} from "lucide-react";
import { GAMES } from "@/lib/demoData";
import { toast } from "sonner";

const TeamList = ({ ids, playerMap, playerAvatars, eloChanges, pairings = [], mvpId, merdaId, merdaIds = [] }) => (
  <div className="flex-1 space-y-2">
    {ids.map((id) => {
      const p = playerMap[id];
      if (!p) return null;
      const baseDelta = Number(eloChanges?.[id] ?? 0);
      const pairing = (Array.isArray(pairings) ? pairings : []).find(
        (item) => item?.playerAId === id || item?.playerBId === id
      );
      const valueBonus = Math.max(0, Math.round(Number(pairing?.amount) || 0));
      const delta = baseDelta === 0
        ? 0
        : baseDelta + (baseDelta > 0 ? valueBonus : -valueBonus);
      const isMvp = id === mvpId;
      const isMerda = (Array.isArray(merdaIds) ? merdaIds : []).includes(id) || id === merdaId;

      return (
        <div key={id} className="flex items-center gap-2.5 min-w-0">
          <PlayerAvatar
            name={p.name}
            elo={p.currentElo}
            size={30}
            avatarUrl={playerAvatars?.[id]}
          />
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
            <div className="text-[9px] uppercase tracking-widest text-[#596170] mt-0.5">
              {p.currentElo} Elo
            </div>
          </div>
          <span
            className={`min-w-[52px] h-7 px-2 rounded-lg border inline-flex items-center justify-center font-mono text-[11px] font-black ${
              delta >= 0
                ? "text-emerald-400 bg-emerald-500/[0.06] border-emerald-500/15"
                : "text-red-400 bg-red-500/[0.06] border-red-500/15"
            }`}
          >
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </div>
      );
    })}
  </div>
);

const money = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));

export default function Matches() {
  const {
    matches,
    publicChallenges,
    matchReports,
    playerMap,
    playerAvatars,
    deleteMatch,
    isAdmin,
    adminCreateChallengePairings,
  } = useData();

  const safeMatches = useMemo(
    () => (Array.isArray(matches) ? matches.filter(Boolean) : []),
    [matches]
  );

  const safePlayerMap = useMemo(
    () => (playerMap && typeof playerMap === "object" ? playerMap : {}),
    [playerMap]
  );

  const [editData, setEditData] = useState(null);
  const [view, setView] = useState("live");
  const [query, setQuery] = useState("");
  const [winnerFilter, setWinnerFilter] = useState("all");
  const [gameFilter, setGameFilter] = useState("ALL");
  const [rematchBusyId, setRematchBusyId] = useState(null);

  const createRematch = async (match) => {
    if (!isAdmin || !match) return;

    const pairings = (Array.isArray(match.pairings) ? match.pairings : [])
      .filter(
        (pair) =>
          pair?.playerAId &&
          pair?.playerBId &&
          Number(pair?.amount || 0) > 0
      )
      .map((pair) => ({
        challengerPlayerId: pair.playerAId,
        challengedPlayerId: pair.playerBId,
        amount: Number(pair.amount || 0),
        platform: ["paypal", "revolut"].includes(
          String(pair.platform || "").toLowerCase()
        )
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
    toast.success(
      `Rematch created · ${created.length} chall${created.length === 1 ? "" : "s"}`
    );
  };

  const liveChallenges = useMemo(
    () =>
      (Array.isArray(publicChallenges) ? publicChallenges : [])
        .filter((challenge) =>
          ["pending", "accepted", "result_pending", "disputed"].includes(
            String(challenge?.status || "")
          )
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at)
        ),
    [publicChallenges]
  );

  const liveReports = useMemo(
    () =>
      (Array.isArray(matchReports) ? matchReports : [])
        .filter((report) =>
          ["pending", "disputed"].includes(String(report?.status || ""))
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at)
        ),
    [matchReports]
  );

  const liveCount = liveChallenges.length + liveReports.length;

  const history = useMemo(() => {
    const matchIds = new Set(safeMatches.map((match) => String(match.id)));

    const matchRows = safeMatches.map((match) => ({
      type: "match",
      date: match.date,
      item: match,
    }));

    const challengeRows = (Array.isArray(publicChallenges) ? publicChallenges : [])
      .filter((challenge) => {
        const verified = Boolean(
          challenge?.status === "completed" &&
          challenge?.verified_at &&
          challenge?.reported_winner_player_id
        );
        if (!verified) return false;

        const alreadyInsideTeamMatch =
          String(challenge?.source || "") === "match_pairing" &&
          challenge?.match_id &&
          matchIds.has(String(challenge.match_id));

        return !alreadyInsideTeamMatch;
      })
      .map((challenge) => ({
        type: "chall",
        date: challenge.verified_at || challenge.created_at,
        item: challenge,
      }));

    return [...matchRows, ...challengeRows].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [safeMatches, publicChallenges]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return history.filter((row) => {
      if (row.type === "match") {
        const match = row.item;

        if (winnerFilter !== "all" && match.winner !== winnerFilter) return false;
        if (gameFilter !== "ALL" && match.game !== gameFilter) return false;
        if (!q) return true;

        const teamA = Array.isArray(match.teamA) ? match.teamA : [];
        const teamB = Array.isArray(match.teamB) ? match.teamB : [];
        const names = [...teamA, ...teamB].map(
          (id) => safePlayerMap[id]?.name?.toLowerCase() || ""
        );

        return (
          names.some((name) => name.includes(q)) ||
          String(match.game || "").toLowerCase().includes(q) ||
          String(match.mode || "").toLowerCase().includes(q)
        );
      }

      if (winnerFilter !== "all" || gameFilter !== "ALL") return false;

      const challenge = row.item;
      const challenger =
        safePlayerMap[challenge.challenger_player_id]?.name || "";
      const challenged =
        safePlayerMap[challenge.challenged_player_id]?.name || "";

      return (
        !q ||
        challenger.toLowerCase().includes(q) ||
        challenged.toLowerCase().includes(q) ||
        String(challenge.platform || "").toLowerCase().includes(q)
      );
    });
  }, [history, query, winnerFilter, gameFilter, safePlayerMap]);

  const renderLiveChallenge = (challenge) => {
    const challenger = safePlayerMap[challenge.challenger_player_id];
    const challenged = safePlayerMap[challenge.challenged_player_id];
    const amount = Number(challenge.amount_cents || 0) / 100;
    const status = String(challenge.status || "").replaceAll("_", " ").toUpperCase();

    return (
      <Link
        key={`live-chall-${challenge.id}`}
        to={`/challenges/${challenge.id}`}
        className="m8-panel rounded-2xl p-4 flex items-center gap-4 hover:border-[#394150] transition-all"
      >
        <Swords size={18} className="text-[#D5A33A] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate">
            {challenger?.name || "Player"} <span className="text-[#596170]">vs</span> {challenged?.name || "Player"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {status} · {String(challenge.platform || "paypal").toUpperCase()}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-black text-[#D5A33A]">{money(amount)}</div>
          <div className="text-[10px] text-muted-foreground mt-1">OPEN</div>
        </div>
      </Link>
    );
  };

  const renderLiveReport = (report) => {
    const teamA = Array.isArray(report.team_a) ? report.team_a : [];
    const teamB = Array.isArray(report.team_b) ? report.team_b : [];
    const names = (ids) =>
      ids.map((id) => safePlayerMap[id]?.name || "Player").join(" · ");

    return (
      <Link
        key={`live-report-${report.id}`}
        to="/team-builder"
        className="m8-panel rounded-2xl p-4 flex items-center gap-4 hover:border-[#394150] transition-all"
      >
        <Gamepad2 size={18} className="text-magma shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold truncate">
            {names(teamA)} <span className="text-[#596170]">vs</span> {names(teamB)}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
            {String(report.status || "").replaceAll("_", " ").toUpperCase()}
            {report.game ? ` · ${report.game}` : ""}
            {report.mode ? ` · ${report.mode}` : ""}
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0">OPEN</div>
      </Link>
    );
  };

  const renderMoneyChall = (challenge) => {
    const challenger = safePlayerMap[challenge.challenger_player_id];
    const challenged = safePlayerMap[challenge.challenged_player_id];
    const winner = safePlayerMap[challenge.reported_winner_player_id];
    const loserId =
      challenge.reported_winner_player_id === challenge.challenger_player_id
        ? challenge.challenged_player_id
        : challenge.challenger_player_id;
    const loser = safePlayerMap[loserId];
    const amount = Number(challenge.amount_cents || 0) / 100;

    return (
      <div
        key={`chall-${challenge.id}`}
        className="m8-panel rounded-[22px] p-5 animate-fade-up overflow-hidden relative"
        data-testid={`match-history-chall-${challenge.id}`}
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D5A33A] to-transparent" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D5A33A]/10 border border-[#D5A33A]/20 text-[#D5A33A] text-[10px] font-black uppercase tracking-wider">
                <Swords size={12} /> Money Match
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(
                  challenge.verified_at || challenge.created_at
                ).toLocaleString()}
              </span>
            </div>

            <div className="font-display text-lg font-black mt-3">
              {challenger?.name || "Player"}{" "}
              <span className="text-[#596170]">vs</span>{" "}
              {challenged?.name || "Player"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {String(challenge.platform || "paypal").toUpperCase()} · verified
            </div>
          </div>

          <div className="sm:text-right">
            <div className="font-display text-2xl font-black text-[#D5A33A]">
              {money(amount)}
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-1">
              {winner?.name || "Winner"} won
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-emerald-500/[0.05] border border-emerald-500/15 p-3">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Winner
            </div>
            <div className="font-semibold mt-1">{winner?.name || "Player"}</div>
            <div className="font-mono text-sm font-black text-emerald-400 mt-1">
              +{25 + Math.max(0, Math.round(amount))} Elo
            </div>
          </div>

          <div className="rounded-xl bg-red-500/[0.04] border border-red-500/15 p-3 text-right">
            <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Loser
            </div>
            <div className="font-semibold mt-1">{loser?.name || "Player"}</div>
            <div className="font-mono text-sm font-black text-red-400 mt-1">
              -{25 + Math.max(0, Math.round(amount))} Elo
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <Link
            to={`/challenges/${challenge.id}`}
            className="h-9 px-3 rounded-lg bg-[#0F1218] border border-[#2A303B] inline-flex items-center justify-center text-xs font-bold text-[#C8CED8] hover:text-white"
          >
            Open Match
          </Link>
        </div>
      </div>
    );
  };

  const renderTeamMatch = (match) => (
    <div
      key={match.id}
      className="m8-panel rounded-[22px] p-5 animate-fade-up overflow-hidden relative"
      data-testid={`match-row-${match.id}`}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background:
            match.winner === "A"
              ? "linear-gradient(90deg, transparent, #FF2A3B, transparent)"
              : "linear-gradient(90deg, transparent, #D5A33A, transparent)",
        }}
      />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-muted-foreground">
            {new Date(match.date).toLocaleString()}
          </span>
          {match.game && (
            <span
              className="px-2 py-0.5 rounded-md bg-[#171B23] text-xs border border-[#2B313E] text-[#D5A33A] font-bold"
              data-testid={`match-game-${match.id}`}
            >
              {match.game}
            </span>
          )}
          {match.mode && (
            <span className="px-2 py-0.5 rounded-md bg-[#0F1218] text-xs border border-[#222834] text-[#AAB1BE]">
              {match.mode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black tracking-wide border"
            style={{
              background:
                match.winner === "A"
                  ? "rgba(255,42,59,0.10)"
                  : "rgba(213,163,58,0.10)",
              color: match.winner === "A" ? "#FF5361" : "#E6B94E",
              borderColor:
                match.winner === "A"
                  ? "rgba(255,42,59,0.22)"
                  : "rgba(213,163,58,0.22)",
            }}
          >
            <Trophy size={13} />
            {match.winner === "A" ? "Alpha" : "Bravo"} won
          </span>

          {match.locked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold text-emerald-400 border border-emerald-500/20 bg-emerald-500/[0.06]">
              <Lock size={12} /> LOCKED
            </span>
          )}

          {isAdmin && (
            <>
              <Button
                variant="ghost"
                data-testid={`match-edit-${match.id}`}
                onClick={() => setEditData(match)}
                className="h-9 px-3 rounded-lg bg-[#0F1218] border border-[#222834] text-[#C8CED8] hover:text-white hover:bg-white/[0.04]"
              >
                <Pencil size={14} className="mr-1.5" /> Edit
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    data-testid={`match-delete-${match.id}`}
                    className="h-9 px-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">
                      Delete this match?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      The match will be removed and player stats will be recalculated.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-[#0F1218] border-[#222834]">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        const ok = await deleteMatch(match.id);
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
            background:
              match.winner === "A"
                ? "rgba(255,42,59,0.055)"
                : "rgba(15,18,24,.72)",
            borderColor:
              match.winner === "A" ? "rgba(255,42,59,.20)" : "#1C202E",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-black uppercase tracking-widest text-magma">
              Alpha
            </div>
            {match.winner === "A" && (
              <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                Winner
              </span>
            )}
          </div>
          <TeamList
            ids={Array.isArray(match.teamA) ? match.teamA : []}
            playerMap={safePlayerMap}
            playerAvatars={playerAvatars}
            eloChanges={match.eloChanges}
            pairings={match.pairings}
            mvpId={match.mvpId}
            merdaId={match.merdaId}
          />
        </div>

        <div
          className="rounded-xl p-4 border"
          style={{
            background:
              match.winner === "B"
                ? "rgba(213,163,58,0.05)"
                : "rgba(15,18,24,.72)",
            borderColor:
              match.winner === "B" ? "rgba(213,163,58,.20)" : "#1C202E",
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-xs font-black uppercase tracking-widest text-gold">
              Bravo
            </div>
            {match.winner === "B" && (
              <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-black">
                Winner
              </span>
            )}
          </div>
          <TeamList
            ids={Array.isArray(match.teamB) ? match.teamB : []}
            playerMap={safePlayerMap}
            playerAvatars={playerAvatars}
            eloChanges={match.eloChanges}
            pairings={match.pairings}
            mvpId={match.mvpId}
            merdaId={match.merdaId}
          />
        </div>
      </div>

      {Array.isArray(match.pairings) &&
        match.pairings.filter(Boolean).length > 0 && (
          <div
            className="mt-4 pt-4 border-t border-[#1D222C]"
            data-testid={`match-money-pairings-${match.id}`}
          >
            <div className="flex items-center gap-2 mb-3">
              <WalletCards size={15} className="text-[#D5A33A]" />
              <span className="brand-kicker">Money Matchups</span>
              <span className="ml-auto text-[10px] text-muted-foreground">
                {match.pairings.length} pairings
              </span>

              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      disabled={rematchBusyId === match.id}
                      className="h-8 px-3 rounded-lg bg-magma hover:bg-[#ff3c4c] text-white font-bold"
                    >
                      <RotateCcw size={13} className="mr-1.5" />
                      {rematchBusyId === match.id ? "Creating..." : "Rematch"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Create rematch?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This creates the same money matchups with the same amounts and payment methods.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="bg-[#181B26] border-[#2A303B]">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => createRematch(match)}
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
              {match.pairings.filter(Boolean).map((pair, index) => {
                const alpha = safePlayerMap[pair.playerAId];
                const bravo = safePlayerMap[pair.playerBId];
                const winnerId =
                  match.winner === "A" ? pair.playerAId : pair.playerBId;
                const winner = safePlayerMap[winnerId];

                return (
                  <div
                    key={pair.playerAId + "-" + pair.playerBId + "-" + index}
                    className="m8-panel-quiet rounded-xl px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <span
                        className={`font-semibold truncate ${
                          winnerId === pair.playerAId ? "text-emerald-400" : ""
                        }`}
                      >
                        {alpha?.name || "Alpha"}
                      </span>
                      <ArrowRightLeft
                        size={13}
                        className="text-muted-foreground shrink-0"
                      />
                      <span
                        className={`font-semibold truncate ${
                          winnerId === pair.playerBId ? "text-emerald-400" : ""
                        }`}
                      >
                        {bravo?.name || "Bravo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>€{Number(pair.amount || 0).toFixed(2)}</span>
                      <span>·</span>
                      <span>
                        {String(pair.platform || "paypal").toUpperCase()}
                      </span>
                      <span className="ml-auto text-emerald-400">
                        {winner?.name || "Winner"} won
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Matches</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">
              Matches
            </h2>
          </div>

          <div className="inline-flex self-start lg:self-auto rounded-xl border border-[#222834] bg-[#0F1218] p-1">
            <button
              type="button"
              onClick={() => setView("live")}
              className={`h-9 px-4 rounded-lg text-sm font-bold transition-all ${
                view === "live"
                  ? "bg-white text-black"
                  : "text-[#8D95A4] hover:text-white"
              }`}
            >
              Live{liveCount > 0 ? ` · ${liveCount}` : ""}
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              className={`h-9 px-4 rounded-lg text-sm font-bold transition-all ${
                view === "history"
                  ? "bg-white text-black"
                  : "text-[#8D95A4] hover:text-white"
              }`}
            >
              History
            </button>
          </div>
        </div>

        {view === "history" && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5 pt-4 border-t border-[#1D222C]">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                data-testid="matches-search-input"
                placeholder="Search player, game or mode..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-10 bg-[#0F1218] border-[#222834] h-11 rounded-xl"
              />
            </div>

            <select
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
              className="h-11 w-full sm:w-auto rounded-xl bg-[#0F1218] border border-[#222834] text-[#C8CED8] font-semibold px-3 text-sm"
            >
              <option value="ALL">All Games</option>
              {GAMES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-2">
              <Filter size={16} className="text-muted-foreground" />
              {[
                { key: "all", label: "All" },
                { key: "A", label: "Alpha" },
                { key: "B", label: "Bravo" },
              ].map((filter) => (
                <button
                  key={filter.key}
                  aria-pressed={winnerFilter === filter.key}
                  onClick={() => setWinnerFilter(filter.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    winnerFilter === filter.key
                      ? "bg-magma text-white border-magma"
                      : "bg-[#0F1218] text-[#8D95A4] border-[#222834] hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {view === "live" ? (
        <div className="space-y-3" data-testid="live-matches-list">
          {liveCount === 0 ? (
            <EmptyState
              icon={Gamepad2}
              title="No live matches"
              description="Pending and in-progress matches will appear here."
            />
          ) : (
            <>
              {liveReports.map(renderLiveReport)}
              {liveChallenges.map(renderLiveChallenge)}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3" data-testid="matches-list">
          {filtered.length === 0 && (
            <EmptyState
              icon={Gamepad2}
              title={history.length === 0 ? "No match history yet" : "No matches found"}
              description={
                history.length === 0
                  ? "Verified team matches and Money Challs will appear here."
                  : "Try changing the search or filters."
              }
            />
          )}

          {filtered.map((row) =>
            row.type === "chall"
              ? renderMoneyChall(row.item)
              : renderTeamMatch(row.item)
          )}
        </div>
      )}

      <RecordMatchDialog
        open={!!editData}
        onOpenChange={(open) => !open && setEditData(null)}
        editData={editData}
        title="Edit Match"
      />
    </div>
  );
}
