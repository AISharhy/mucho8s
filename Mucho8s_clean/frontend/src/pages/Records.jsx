import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Award,
  Crown,
  Flame,
  Gamepad2,
  Medal,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import { useData } from "@/context/DataContext";
import { PlayerAvatar } from "@/components/shared";

const pairKey = (a, b) => [String(a), String(b)].sort().join("::");

const archivePlayerLookup = (archives = []) => {
  const map = {};
  archives.forEach((season) => {
    (Array.isArray(season?.players) ? season.players : []).forEach((player) => {
      const id = String(player?.id || "");
      if (!id) return;
      map[id] = { ...(map[id] || {}), ...player };
    });
  });
  return map;
};

const buildLongestStreak = (matches = []) => {
  const current = new Map();
  const best = new Map();

  [...matches]
    .filter(Boolean)
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0))
    .forEach((match) => {
      const a = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
      const b = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
      const winners = match?.winner === "B" ? b : a;
      const losers = match?.winner === "B" ? a : b;
      winners.forEach((id) => {
        const next = Number(current.get(id) || 0) + 1;
        current.set(id, next);
        best.set(id, Math.max(Number(best.get(id) || 0), next));
      });
      losers.forEach((id) => current.set(id, 0));
    });

  return [...best.entries()].sort((left, right) => right[1] - left[1])[0] || null;
};

const RecordCard = ({ icon: Icon, label, value, detail, player, avatarUrl, to, tone = "text-[#D5A33A]" }) => (
  <article className="m8-panel rounded-[20px] p-4 min-h-[170px] flex flex-col">
    <div className="flex items-center justify-between gap-3">
      <div className={`w-9 h-9 rounded-xl border border-[#2A303B] bg-[#0F1218] flex items-center justify-center ${tone}`}>
        <Icon size={16} />
      </div>
      <span className="text-[9px] uppercase tracking-[0.16em] text-[#697181]">All-Time Record</span>
    </div>

    <div className="font-mono text-2xl font-black mt-4">{value}</div>
    <div className="font-display font-black text-sm mt-1">{label}</div>
    <div className="text-[10px] text-muted-foreground mt-1">{detail}</div>

    {player && (
      <Link
        to={to || "#"}
        className="mt-auto pt-4 flex items-center gap-2 hover:opacity-90"
      >
        <PlayerAvatar
          name={player.name}
          elo={player.currentElo}
          size={30}
          avatarUrl={avatarUrl}
        />
        <span className="text-xs font-bold truncate">{player.name}</span>
      </Link>
    )}
  </article>
);

export default function Records() {
  const { players, matches, competitionData, playerMap, playerAvatars } = useData();
  const archives = Array.isArray(competitionData?.archives) ? competitionData.archives : [];

  const data = useMemo(() => {
    const archivedLookup = archivePlayerLookup(archives);
    const lookup = { ...archivedLookup, ...(playerMap || {}) };
    const aggregate = new Map();

    const addPlayerSnapshot = (player, isCurrent = false) => {
      const id = String(player?.id || "");
      if (!id) return;
      const row = aggregate.get(id) || {
        id,
        wins: 0,
        matches: 0,
        mvps: 0,
        peak: 0,
      };
      row.wins += Number(player?.wins || 0);
      row.matches += Number(player?.totalMatches || 0);
      row.mvps += Number(player?.mvpCount || 0);
      row.peak = Math.max(row.peak, Number(player?.peakElo || player?.currentElo || 0));
      if (isCurrent) row.current = true;
      aggregate.set(id, row);
    };

    archives.forEach((season) =>
      (Array.isArray(season?.players) ? season.players : []).forEach((player) => addPlayerSnapshot(player))
    );
    (Array.isArray(players) ? players : []).forEach((player) => addPlayerSnapshot(player, true));

    const allMatches = [
      ...archives.flatMap((season) => Array.isArray(season?.matches) ? season.matches : []),
      ...(Array.isArray(matches) ? matches : []),
    ];

    const leaders = [...aggregate.values()];
    const top = (field) => [...leaders].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))[0] || null;

    const awards = archives.flatMap((season) =>
      (Array.isArray(season?.awards) ? season.awards : []).map((award) => ({
        ...award,
        seasonNumber: Number(award.seasonNumber ?? season.season_number ?? 0),
        playerIds: Array.isArray(award.playerIds) ? award.playerIds.map(String) : [],
      }))
    );

    const awardTotals = new Map();
    const championTotals = new Map();
    awards.forEach((award) => {
      award.playerIds.forEach((id) => {
        awardTotals.set(id, Number(awardTotals.get(id) || 0) + 1);
        if (award.id === "season-champion") {
          championTotals.set(id, Number(championTotals.get(id) || 0) + 1);
        }
      });
    });

    const mostCards = [...awardTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const mostChampionships = [...championTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const streak = buildLongestStreak(allMatches);

    const rivalryMeetings = new Map();
    allMatches.forEach((match) => {
      const teamA = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
      const teamB = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
      teamA.forEach((a) => teamB.forEach((b) => {
        const key = pairKey(a, b);
        const row = rivalryMeetings.get(key) || { a, b, count: 0 };
        row.count += 1;
        rivalryMeetings.set(key, row);
      }));
    });
    const rivalry = [...rivalryMeetings.values()].sort((a, b) => b.count - a.count)[0] || null;

    return {
      lookup,
      peak: top("peak"),
      wins: top("wins"),
      matches: top("matches"),
      mvps: top("mvps"),
      streak,
      mostCards,
      mostChampionships,
      rivalry,
      archivedSeasons: archives.length,
    };
  }, [archives, players, matches, playerMap]);

  const resolve = (id) => data.lookup?.[String(id)] || null;
  const linkFor = (id) => playerMap?.[String(id)] ? `/players/${id}` : "/bacheca/records";

  return (
    <>
      <section className="m8-panel rounded-[22px] p-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">History Book</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.035em]">Records</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Permanent all-time records across archived seasons and the competition currently in progress.
            </p>
          </div>
          <div className="h-10 px-3 rounded-xl border border-[#222834] bg-[#0F1218] inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#AAB1BE]">
            <Medal size={14} className="text-[#D5A33A]" />
            {data.archivedSeasons} archived season{data.archivedSeasons === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <RecordCard
          icon={Crown}
          label="Highest Elo Peak"
          value={data.peak ? Math.round(data.peak.peak) + " Elo" : "—"}
          detail="Highest recorded peak across every season."
          player={data.peak ? resolve(data.peak.id) : null}
          avatarUrl={data.peak ? playerAvatars?.[data.peak.id] : ""}
          to={data.peak ? linkFor(data.peak.id) : "#"}
        />
        <RecordCard
          icon={Trophy}
          label="Most Wins"
          value={data.wins ? data.wins.wins : "—"}
          detail="Most Mucho8s wins accumulated across seasons."
          player={data.wins ? resolve(data.wins.id) : null}
          avatarUrl={data.wins ? playerAvatars?.[data.wins.id] : ""}
          to={data.wins ? linkFor(data.wins.id) : "#"}
          tone="text-emerald-400"
        />
        <RecordCard
          icon={Gamepad2}
          label="Most Matches"
          value={data.matches ? data.matches.matches : "—"}
          detail="Most Mucho8s appearances in recorded season history."
          player={data.matches ? resolve(data.matches.id) : null}
          avatarUrl={data.matches ? playerAvatars?.[data.matches.id] : ""}
          to={data.matches ? linkFor(data.matches.id) : "#"}
          tone="text-[#8E98FF]"
        />
        <RecordCard
          icon={Target}
          label="Most MVPs"
          value={data.mvps ? data.mvps.mvps : "—"}
          detail="Most automatic MVP awards accumulated."
          player={data.mvps ? resolve(data.mvps.id) : null}
          avatarUrl={data.mvps ? playerAvatars?.[data.mvps.id] : ""}
          to={data.mvps ? linkFor(data.mvps.id) : "#"}
          tone="text-magma"
        />
        <RecordCard
          icon={Flame}
          label="Longest Win Streak"
          value={data.streak ? "W" + data.streak[1] : "—"}
          detail="Longest uninterrupted Mucho8s winning run."
          player={data.streak ? resolve(data.streak[0]) : null}
          avatarUrl={data.streak ? playerAvatars?.[data.streak[0]] : ""}
          to={data.streak ? linkFor(data.streak[0]) : "#"}
          tone="text-orange-400"
        />
        <RecordCard
          icon={Award}
          label="Most Hall of Fame Cards"
          value={data.mostCards ? data.mostCards[1] : "—"}
          detail="Most permanent season award cards collected."
          player={data.mostCards ? resolve(data.mostCards[0]) : null}
          avatarUrl={data.mostCards ? playerAvatars?.[data.mostCards[0]] : ""}
          to={data.mostCards ? linkFor(data.mostCards[0]) : "#"}
          tone="text-[#B68AFF]"
        />
        <RecordCard
          icon={ShieldCheck}
          label="Most Season Titles"
          value={data.mostChampionships ? data.mostChampionships[1] : "—"}
          detail="Most Season Champion cards in Hall of Fame history."
          player={data.mostChampionships ? resolve(data.mostChampionships[0]) : null}
          avatarUrl={data.mostChampionships ? playerAvatars?.[data.mostChampionships[0]] : ""}
          to={data.mostChampionships ? linkFor(data.mostChampionships[0]) : "#"}
          tone="text-[#D5A33A]"
        />
        <RecordCard
          icon={Medal}
          label="Most Played Rivalry"
          value={data.rivalry ? data.rivalry.count + " meetings" : "—"}
          detail={
            data.rivalry
              ? `${resolve(data.rivalry.a)?.name || "Player"} vs ${resolve(data.rivalry.b)?.name || "Player"}`
              : "No all-time rivalry record yet."
          }
          tone="text-orange-400"
        />
      </section>
    </>
  );
}
