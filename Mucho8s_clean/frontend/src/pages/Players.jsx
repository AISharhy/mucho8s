import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { winRate, tierOf } from "@/lib/elo";
import { PlayerAvatar, EloBadge, TierTag, Last10, StreakBadge, WinRatePill, MvpBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Crown, Flame, Target, Swords as SwordsIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "On Fire" },
  { key: "legend", label: "Legends" },
  { key: "veteran", label: "Veterans" },
];

export default function Players() {
  const { players } = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const list = useMemo(() => {
    let l = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
    if (filter === "hot") l = l.filter((p) => p.currentStreak >= 2);
    if (filter === "legend") l = l.filter((p) => p.currentElo >= 1500);
    if (filter === "veteran") l = l.filter((p) => p.totalMatches >= 50);
    return l.sort((a, b) => b.currentElo - a.currentElo);
  }, [players, query, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="players-search-input"
            placeholder="Search players..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 bg-[#161924] border-[#242938] h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              data-testid={`players-filter-${f.key}`}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                filter === f.key ? "bg-magma text-white" : "bg-[#161924] text-muted-foreground hover:text-white border border-[#242938]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="players-grid">
        {list.map((p) => (
          <button
            key={p.id}
            data-testid={`player-card-${p.id}`}
            onClick={() => setSelected(p)}
            className="card-surface rounded-xl p-5 text-left animate-fade-up"
          >
            <div className="flex items-center gap-3 mb-4">
              <PlayerAvatar name={p.name} elo={p.currentElo} size={48} />
              <div className="min-w-0">
                <div className="font-display font-bold text-lg truncate flex items-center gap-1.5">
                  {p.name}
                  {p.currentStreak >= 3 && <Flame size={15} className="text-magma" />}
                </div>
                <TierTag elo={p.currentElo} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Current</div>
                <EloBadge elo={p.currentElo} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Peak</div>
                <span className="font-mono font-bold text-gold">{p.peakElo}</span>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Win Rate</div>
                <WinRatePill player={p} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">MVPs</div>
                <MvpBadge count={p.mvpCount} />
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#242938]">
              <Last10 record={p.last10} />
              <StreakBadge streak={p.currentStreak} />
            </div>
          </button>
        ))}
      </div>
      {list.length === 0 && <div className="text-center text-muted-foreground py-16">No players found.</div>}

      <PlayerDialog player={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const PlayerDialog = ({ player, onClose }) => {
  if (!player) return null;
  const tier = tierOf(player.currentElo);
  const rows = [
    { label: "Total Matches", value: player.totalMatches, icon: SwordsIcon },
    { label: "Wins", value: player.wins },
    { label: "Losses", value: player.losses },
    { label: "Win Rate", value: `${winRate(player)}%` },
    { label: "Avg Placement", value: player.avgPlacement || "—", icon: Target },
    { label: "MVP Count", value: player.mvpCount, icon: Crown },
  ];
  return (
    <Dialog open={!!player} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#12141C] border-[#242938] max-w-lg" data-testid="player-detail-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <PlayerAvatar name={player.name} elo={player.currentElo} size={44} />
            <div>
              <div className="font-display text-2xl">{player.name}</div>
              <span className="text-xs uppercase tracking-widest" style={{ color: tier.color }}>{tier.name}</span>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="h-32 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={player.eloHistory}>
              <YAxis domain={["dataMin - 30", "dataMax + 30"]} hide />
              <Tooltip
                contentStyle={{ background: "#12141C", border: "1px solid #242938", borderRadius: 8 }}
                labelStyle={{ color: "#9CA3AF" }}
              />
              <Line type="monotone" dataKey="elo" stroke="#FF2A3B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {rows.map((r) => (
            <div key={r.label} className="bg-[#181B26] rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{r.label}</div>
              <div className="font-mono font-bold text-lg text-white">{r.value}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">Last 10</span>
          <Last10 record={player.last10} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
