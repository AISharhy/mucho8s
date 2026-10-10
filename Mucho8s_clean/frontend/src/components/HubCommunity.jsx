import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Flame, Trophy, Users, Medal, Swords, Filter } from "lucide-react";
import { useData } from "@/context/DataContext";

// Derived views only: this module never edits matches, ratings, or official history.
const dateValue = (item) => new Date(item.date || item.created_at || 0).getTime() || 0;
const displayDate = (value) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
const text = (value) => String(value || "").toLowerCase();

export default function HubCommunity() {
  const { players = [], matches = [], playerMap = {}, newsPosts = [] } = useData();
  const [section, setSection] = useState("feed");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("all");

  const activity = useMemo(() => {
    const matchPosts = (Array.isArray(matches) ? matches : []).filter((match) =>
      match && match.id && (match.winner === "A" || match.winner === "B")
    ).map((match) => {
      const teamA = (Array.isArray(match.teamA) ? match.teamA : []).map(id => playerMap[id]?.name || id);
      const teamB = (Array.isArray(match.teamB) ? match.teamB : []).map(id => playerMap[id]?.name || id);
      const winners = match.winner === "A" ? teamA : teamB;
      const mvpIds = Array.isArray(match.mvpIds) ? match.mvpIds : (match.mvpId ? [match.mvpId] : []);
      const mvps = mvpIds.map(id => playerMap[id]?.name || id);
      return {
        id: "match-" + match.id,
        kind: "match",
        category: "Verified result",
        title: teamA.join(", ") + " vs " + teamB.join(", "),
        description: [match.game, match.mode, "Winner: " + winners.join(", "), mvps.length ? "MVP: " + mvps.join(", ") : ""].filter(Boolean).join(" · "),
        date: match.date || match.created_at,
        mvp: mvps.length > 0,
        rank: false
      };
    });
    const official = (Array.isArray(newsPosts) ? newsPosts : []).map(post => ({
      id: "news-" + post.id, kind: "news", category: post.category || "Circle update",
      title: post.title, description: post.summary, date: post.created_at,
      mvp: false, rank: /rank|elo/i.test(post.category || "")
    }));
    return [...official, ...matchPosts].sort((a,b) => dateValue(b) - dateValue(a));
  }, [matches, playerMap, newsPosts]);

  const filtered = useMemo(() => activity.filter(item => {
    if (mode === "matches" && item.kind !== "match") return false;
    if (mode === "mvp" && !item.mvp) return false;
    if (mode === "updates" && item.kind !== "news") return false;
    const haystack = text([item.title, item.description, item.category].join(" "));
    return haystack.includes(text(query.trim()));
  }), [activity, mode, query]);

  const foundPlayers = useMemo(() => (Array.isArray(players) ? players : [])
    .filter(player => text(player.name).includes(text(query.trim())))
    .sort((a,b) => Number(b.currentElo || 0) - Number(a.currentElo || 0))
    .slice(0, 60), [players, query]);

  const topPlayers = useMemo(() => [...(Array.isArray(players) ? players : [])]
    .sort((a,b) => Number(b.currentElo || 0) - Number(a.currentElo || 0)).slice(0,5), [players]);

  return (
    <section className="m8-panel rounded-[24px] p-5 sm:p-7" aria-label="Community Hub">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <div className="brand-kicker mb-1">Circle Mucho8s</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">Hub</h1>
          <p className="text-sm text-muted-foreground mt-2">Verified matches, MVP highlights, Circle updates and player discovery.</p>
        </div>
        <Users size={25} className="text-magma shrink-0" />
      </div>
      <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Hub sections">
        {[
          ["feed", "Feed", Swords],
          ["trending", "Trending", Flame],
          ["players", "Players", Users],
        ].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key}
            onClick={() => { setSection(key); setQuery(""); }}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${section === key ? "border-magma/50 bg-magma/10 text-white" : "border-[#252B36] text-muted-foreground hover:text-white"}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>
      <label className="relative block mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <span className="sr-only">Search {section === "players" ? "players" : "community activity"}</span>
        <input value={query} onChange={e => setQuery(e.target.value)} maxLength={100}
          placeholder={section === "players" ? "Search players by nickname..." : "Search Hub activity..."}
          className="w-full rounded-xl border border-[#252B36] bg-[#0F1218] pl-10 pr-3 py-3 text-sm outline-none focus:border-magma/60" />
      </label>
      {section === "feed" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter size={14} className="text-muted-foreground" />
          {[["all","All"],["matches","Matches"],["mvp","MVP"],["updates","Circle updates"]].map(([key,label]) => (
            <button type="button" key={key} onClick={() => setMode(key)} aria-pressed={mode === key}
              className={`rounded-lg px-3 py-1.5 text-xs border ${mode === key ? "border-[#D5A33A]/50 text-[#D5A33A] bg-[#D5A33A]/10" : "border-[#252B36] text-muted-foreground"}`}>{label}</button>
          ))}
        </div>
      )}
      {section === "players" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {foundPlayers.map(player => (
            <Link key={player.id} to={`/players/${encodeURIComponent(player.id)}`}
              className="flex items-center justify-between rounded-2xl border border-[#252B36] bg-[#11161F] p-4 hover:border-magma/40">
              <span className="font-semibold truncate">{player.name}</span>
              <span className="text-xs font-mono text-[#D5A33A] ml-3 shrink-0">{Number(player.currentElo || 0)} ELO</span>
            </Link>
          ))}
          {!foundPlayers.length && <p className="text-sm text-muted-foreground">No players found.</p>}
        </div>
      ) : section === "trending" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#252B36] bg-[#11161F] p-4">
            <h2 className="font-bold flex items-center gap-2 mb-3"><Trophy size={17} className="text-[#D5A33A]"/> Top players by ELO</h2>
            {topPlayers.map((player, index) => (
              <Link key={player.id} to={`/players/${encodeURIComponent(player.id)}`} className="flex items-center justify-between py-2 border-b border-[#252B36] last:border-b-0 text-sm hover:text-magma">
                <span>#{index+1} · {player.name}</span><span className="font-mono text-[#D5A33A]">{player.currentElo}</span>
              </Link>
            ))}
          </div>
          <div className="rounded-2xl border border-[#252B36] bg-[#11161F] p-4">
            <h2 className="font-bold flex items-center gap-2 mb-3"><Medal size={17} className="text-[#D5A33A]"/> Recent MVP highlights</h2>
            {activity.filter(item => item.mvp).slice(0,5).map(item => (
              <article key={item.id} className="py-2 border-b border-[#252B36] last:border-b-0">
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
              </article>
            ))}
            {!activity.some(item => item.mvp) && <p className="text-sm text-muted-foreground">No verified MVP highlights yet.</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.slice(0, 50).map(item => (
            <article key={item.id} className="rounded-2xl border border-[#252B36] bg-[#11161F] p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-[#D5A33A]">
                <span>{item.category}</span><span className="text-muted-foreground">{displayDate(item.date)}</span>
                {item.mvp && <span className="rounded-md bg-[#D5A33A]/10 px-2 py-1">MVP</span>}
              </div>
              <h2 className="font-display text-lg font-bold mt-2">{item.title}</h2>
              <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
            </article>
          ))}
          {!filtered.length && <div className="rounded-2xl border border-[#252B36] p-6 text-sm text-muted-foreground">No activity matching your search.</div>}
        </div>
      )}
    </section>
  );
}
