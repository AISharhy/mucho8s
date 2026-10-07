import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Banknote,
  Clock3,
  Gamepad2,
  Inbox,
  Landmark,
  Plus,
  Search,
  ShieldCheck,
  Swords,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const euro = (value) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const relativeTime = (value) => {
  const timestamp = new Date(value || 0).getTime();
  if (!timestamp || Number.isNaN(timestamp)) return "NOW";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "NOW";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString("it-IT");
};

const challengeStatus = (challenge, myPlayerId) => {
  const status = String(challenge?.status || "pending").toLowerCase();
  const incoming =
    status === "pending" &&
    String(challenge?.challenged_player_id || "") === String(myPlayerId || "");

  if (incoming) return { label: "CHALLENGE YOU", tone: "amber", priority: 0 };
  if (status === "accepted") return { label: "LIVE", tone: "green", priority: 1 };
  if (status === "result_pending") return { label: "VERIFYING", tone: "violet", priority: 2 };
  if (status === "disputed") return { label: "DISPUTED", tone: "red", priority: 3 };
  return { label: "WAITING", tone: "muted", priority: 4 };
};

const statusClass = {
  green: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-400",
  amber: "border-[#D5A33A]/30 bg-[#D5A33A]/[0.08] text-[#E6BE5B]",
  violet: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300",
  red: "border-red-500/25 bg-red-500/[0.08] text-red-400",
  muted: "border-[#2A303B] bg-[#11161E] text-[#8B94A3]",
};

const FinderRow = ({
  row,
  playerMap,
  playerAvatars,
  myPlayerId,
  busyId,
  onAccept,
}) => {
  const isTeamMatch = row.kind === "8s";
  const alpha = isTeamMatch ? row.teamA : [row.challengerId];
  const bravo = isTeamMatch ? row.teamB : [row.challengedId];
  const status = isTeamMatch
    ? { label: "LIVE NOW", tone: "green" }
    : challengeStatus(row.challenge, myPlayerId);

  const alphaNames = alpha.map((id) => playerMap?.[id]?.name || "Player");
  const bravoNames = bravo.map((id) => playerMap?.[id]?.name || "Player");
  const canAccept =
    !isTeamMatch &&
    String(row.challenge?.status || "") === "pending" &&
    String(row.challengedId || "") === String(myPlayerId || "");

  const involved =
    isTeamMatch
      ? [...alpha, ...bravo].map(String).includes(String(myPlayerId || ""))
      : [row.challengerId, row.challengedId].map(String).includes(String(myPlayerId || ""));

  return (
    <article className="m8-panel rounded-2xl p-4 sm:p-5 transition-all hover:border-[#343C49]">
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 xl:w-[34%]">
          <div className="shrink-0 mt-0.5">
            <ModeBadge mode={isTeamMatch ? "mucho8s" : "mucho1v1"} compact />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display font-black text-lg tracking-[-0.02em]">
                {isTeamMatch ? row.format : "1v1"}
              </h3>
              <span
                className={`h-6 px-2 rounded-md border inline-flex items-center text-[9px] font-black uppercase tracking-[0.14em] ${statusClass[status.tone]}`}
              >
                {status.label}
              </span>
            </div>

            <div className="text-[10px] uppercase tracking-[0.16em] text-[#697181] mt-1.5">
              {isTeamMatch
                ? [row.game, row.mode, row.bestOf ? `BO${row.bestOf}` : ""].filter(Boolean).join(" · ")
                : [String(row.challenge?.platform || "free").toUpperCase(), "DIRECT CHALL"].join(" · ")}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="min-w-0">
            <div className="flex -space-x-1.5 mb-1.5">
              {alpha.slice(0, 4).map((id) => (
                <PlayerAvatar
                  key={`a-${row.id}-${id}`}
                  name={playerMap?.[id]?.name || "Player"}
                  elo={playerMap?.[id]?.currentElo || 1000}
                  size={28}
                  avatarUrl={playerAvatars?.[id]}
                />
              ))}
            </div>
            <div className="font-display font-black truncate">{alphaNames.join(" + ")}</div>
          </div>

          <div className="w-9 h-9 rounded-full border border-[#2A303B] bg-[#0D1117] flex items-center justify-center text-[10px] font-black text-[#697181]">
            VS
          </div>

          <div className="min-w-0 text-right">
            <div className="flex -space-x-1.5 mb-1.5 justify-end">
              {bravo.slice(0, 4).map((id) => (
                <PlayerAvatar
                  key={`b-${row.id}-${id}`}
                  name={playerMap?.[id]?.name || "Player"}
                  elo={playerMap?.[id]?.currentElo || 1000}
                  size={28}
                  avatarUrl={playerAvatars?.[id]}
                />
              ))}
            </div>
            <div className="font-display font-black truncate">{bravoNames.join(" + ")}</div>
          </div>
        </div>

        <div className="xl:w-[280px] flex items-center justify-between xl:justify-end gap-3">
          <div className="text-left xl:text-right shrink-0">
            <div className={`font-mono font-black text-base ${row.amount > 0 ? "text-emerald-400" : "text-[#C7CFDA]"}`}>
              {row.amount > 0 ? euro(row.amount) : "FREE"}
            </div>
            <div className="text-[9px] uppercase tracking-widest text-[#697181] mt-1">
              {relativeTime(row.createdAt)}
            </div>
          </div>

          {canAccept ? (
            <Button
              type="button"
              disabled={busyId === row.id}
              onClick={() => onAccept(row)}
              className="h-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black"
              data-testid={`matchfinder-accept-${row.id}`}
            >
              <Zap size={14} className="mr-1.5" />
              {busyId === row.id ? "Accepting..." : "Accept"}
            </Button>
          ) : involved || isTeamMatch ? (
            <Link
              to={row.href}
              className="h-10 px-3.5 rounded-xl bg-white text-black hover:bg-[#E7E9ED] inline-flex items-center justify-center gap-1.5 text-xs font-black"
              data-testid={`matchfinder-open-${row.id}`}
            >
              Open <ArrowRight size={14} />
            </Link>
          ) : (
            <span className="h-10 px-3 rounded-xl border border-[#252C37] bg-[#0F1218] text-[#697181] inline-flex items-center text-[10px] font-black uppercase tracking-wider">
              Public
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default function MatchFinder() {
  const navigate = useNavigate();
  const {
    liveMatches,
    publicChallenges,
    discordPlayer,
    discordSession,
    playerMap,
    playerAvatars,
    respondToChallenge,
  } = useData();

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(() => {
    const teamRows = (Array.isArray(liveMatches) ? liveMatches : []).map((match) => {
      const teamA = Array.isArray(match?.team_a) ? match.team_a.map(String) : [];
      const teamB = Array.isArray(match?.team_b) ? match.team_b.map(String) : [];
      const amount = (Array.isArray(match?.pairings) ? match.pairings : []).reduce(
        (sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0),
        0
      );

      return {
        id: String(match?.id || ""),
        kind: "8s",
        teamA,
        teamB,
        format: match?.format || `${teamA.length}v${teamB.length}`,
        game: match?.game || "",
        mode: match?.mode || "",
        bestOf: Array.isArray(match?.maps)
          ? match.maps.length >= 7
            ? 7
            : match.maps.length >= 5
              ? 5
              : 3
          : Number(match?.best_of || match?.bestOf || 3),
        amount,
        createdAt: match?.created_at,
        href: `/matches/live/${match?.id}`,
        sortAt: new Date(match?.created_at || 0).getTime() || 0,
      };
    });

    const challengeRows = (Array.isArray(publicChallenges) ? publicChallenges : [])
      .filter((challenge) => {
        const source = String(challenge?.source || "").toLowerCase();
        if (["match_pairing", "balancer_pairing"].includes(source)) return false;
        return ["pending", "accepted", "result_pending", "disputed"].includes(
          String(challenge?.status || "pending").toLowerCase()
        );
      })
      .map((challenge) => ({
        id: String(challenge?.id || ""),
        kind: "1v1",
        challenge,
        challengerId: String(challenge?.challenger_player_id || ""),
        challengedId: String(challenge?.challenged_player_id || ""),
        amount: Number(challenge?.amount_cents || 0) / 100,
        createdAt: challenge?.created_at,
        href: `/challenges/${challenge?.id}`,
        sortAt: new Date(challenge?.created_at || 0).getTime() || 0,
      }));

    return [...teamRows, ...challengeRows].sort((a, b) => {
      if (a.kind === "1v1" && b.kind === "1v1") {
        const pa = challengeStatus(a.challenge, discordPlayer?.id).priority;
        const pb = challengeStatus(b.challenge, discordPlayer?.id).priority;
        if (pa !== pb) return pa - pb;
      }
      return Number(b.sortAt || 0) - Number(a.sortAt || 0);
    });
  }, [liveMatches, publicChallenges, discordPlayer?.id]);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter === "8s" && row.kind !== "8s") return false;
      if (filter === "1v1" && row.kind !== "1v1") return false;
      if (filter === "money" && !(Number(row.amount || 0) > 0)) return false;

      if (!term) return true;

      const ids =
        row.kind === "8s"
          ? [...row.teamA, ...row.teamB]
          : [row.challengerId, row.challengedId];

      const haystack = [
        ...ids.map((id) => playerMap?.[id]?.name || ""),
        row.kind === "8s" ? row.game : row.challenge?.platform,
        row.kind === "8s" ? row.mode : row.challenge?.status,
        row.kind === "8s" ? row.format : "1v1",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, filter, query, playerMap]);

  const incomingCount = rows.filter(
    (row) =>
      row.kind === "1v1" &&
      String(row.challenge?.status || "") === "pending" &&
      String(row.challengedId || "") === String(discordPlayer?.id || "")
  ).length;
  const liveCount = rows.filter(
    (row) => row.kind === "8s" || String(row.challenge?.status || "") === "accepted"
  ).length;
  const moneyCount = rows.filter((row) => Number(row.amount || 0) > 0).length;

  const acceptChallenge = async (row) => {
    if (!discordSession || !discordPlayer) {
      toast.error("Login with Discord to accept this challenge");
      return;
    }

    setBusyId(row.id);
    const updated = await respondToChallenge(row.id, "accept");
    setBusyId("");

    if (!updated) return;
    toast.success("Mucho1v1 accepted");
    navigate(`/challenges/${row.id}`);
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-[24px] p-5 sm:p-6 overflow-hidden relative">
        <div
          className="absolute inset-x-0 top-0 h-[2px]"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,42,59,.95), rgba(213,163,58,.8), transparent)",
          }}
        />

        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5">
          <div>
            <div className="brand-kicker mb-1 text-magma">Competitive queue</div>
            <div className="flex items-center gap-2">
              <Search size={22} className="text-magma" />
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em]">
                Match Finder
              </h1>
            </div>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              One place for live Mucho8s, direct Mucho1v1 challenges and money matches.
              Find what is active and jump straight into the room.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              to="/team-builder"
              className="h-10 px-4 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white inline-flex items-center gap-2 text-sm font-black"
            >
              <Plus size={15} /> Create Mucho8s
            </Link>
            <Link
              to="/play"
              className="h-10 px-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/[0.1] inline-flex items-center gap-2 text-sm font-black"
            >
              <Landmark size={15} /> New 1v1
            </Link>
            <Link
              to="/challenges"
              className="h-10 px-4 rounded-xl border border-[#2A303B] bg-[#11161E] text-[#C7CFDA] hover:text-white inline-flex items-center gap-2 text-sm font-bold"
            >
              <Inbox size={15} /> Inbox
              {incomingCount > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-[#D5A33A] text-black inline-flex items-center justify-center text-[10px] font-black">
                  {incomingCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5 max-w-xl">
          {[
            ["Live", liveCount, Zap],
            ["Need action", incomingCount, ShieldCheck],
            ["Money", moneyCount, Banknote],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-[#697181]">
                <Icon size={11} /> {label}
              </div>
              <div className="font-mono text-xl font-black mt-1">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "All"],
              ["8s", "Mucho8s"],
              ["1v1", "1v1"],
              ["money", "Money"],
            ].map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant="ghost"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={`h-9 rounded-xl border px-3 text-xs font-black ${
                  filter === key
                    ? "border-magma/40 bg-magma/[0.08] text-white"
                    : "border-[#222834] bg-[#0F1218] text-[#8B94A3] hover:text-white"
                }`}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="relative flex-1 lg:max-w-md lg:ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#596170]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search player, game or mode..."
              className="h-10 pl-9 rounded-xl bg-[#0F1218] border-[#242A35]"
              data-testid="matchfinder-search"
            />
          </div>
        </div>
      </section>

      {visibleRows.length ? (
        <section className="space-y-2.5" data-testid="matchfinder-list">
          {visibleRows.map((row) => (
            <FinderRow
              key={`${row.kind}-${row.id}`}
              row={row}
              playerMap={playerMap}
              playerAvatars={playerAvatars}
              myPlayerId={discordPlayer?.id}
              busyId={busyId}
              onAccept={acceptChallenge}
            />
          ))}
        </section>
      ) : (
        <section className="m8-panel rounded-2xl p-10 text-center">
          <Gamepad2 size={30} className="text-[#596170] mx-auto" />
          <h2 className="font-display text-xl font-black mt-3">No matches found</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Change the filter or create a new Mucho8s / Mucho1v1.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Link
              to="/team-builder"
              className="h-10 px-4 rounded-xl bg-magma text-white inline-flex items-center gap-2 text-sm font-black"
            >
              <Swords size={15} /> Build Match
            </Link>
            <Link
              to="/play"
              className="h-10 px-4 rounded-xl border border-[#2A303B] bg-[#0F1218] text-white inline-flex items-center gap-2 text-sm font-bold"
            >
              <Users size={15} /> Challenge Player
            </Link>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[#202631] bg-[#0D1117] px-3.5 py-3 flex items-start gap-3">
        <Clock3 size={15} className="text-[#697181] mt-0.5 shrink-0" />
        <div>
          <div className="text-xs font-bold text-[#C7CFDA]">Match Finder v1</div>
          <p className="text-[11px] text-[#697181] mt-0.5">
            This first version uses the existing Mucho8s live rooms and direct Mucho1v1 system.
            Public open challenges and scheduled queues can be added next without changing this interface.
          </p>
        </div>
      </section>
    </div>
  );
}
