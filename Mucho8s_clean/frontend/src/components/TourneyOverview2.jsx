import React, { useMemo, useState } from "react";
import { CalendarDays, Trophy, UsersRound, GitBranch, Radio, History, ShieldCheck, Swords } from "lucide-react";

const panel = "rounded-2xl border border-[#D5A33A]/20 bg-[#11161E] p-4 sm:p-5";
const statusText = { setup:"Registrations / setup", review:"Switcheroo review", ready:"Ready to start", live:"Tournament live", completed:"Completed" };
const rosterPlayers = team => Array.isArray(team?.roster) ? team.roster : [];

/** Read-only tournament dashboard: official operations continue through existing authenticated endpoints. */
export default function TourneyOverview2({ tournament, onTeamOpen, admin = false }) {
  const [tab, setTab] = useState("overview");
  const rounds = Array.isArray(tournament?.bracket) ? tournament.bracket : [];
  const teams = Array.isArray(tournament?.teams) ? tournament.teams : [];
  const matches = rounds.flatMap((round, roundIndex) =>
    (Array.isArray(round) ? round : []).map((m, matchIndex) => ({...m, roundIndex, matchIndex})));
  const completed = matches.filter(m => Boolean(m.winner)).length;
  const active = matches.filter(m => m.a && m.b && !m.winner);
  const rosterCount = useMemo(() => teams.reduce((n,t)=>n+rosterPlayers(t).length,0),[teams]);
  const tabs = [["overview","Lobby",CalendarDays],["bracket","Bracket",GitBranch],["live","Match Rooms",Radio],["history","History",History]];
  if (!tournament) return null;
  return <section className="space-y-4" aria-label="MuchoTourney 2.0 overview">
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Tournament sections">
      {tabs.map(([key,label,Icon])=><button type="button" role="tab" aria-selected={tab===key} key={key} onClick={()=>setTab(key)}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black tracking-wide transition-colors ${tab===key?"border-[#D5A33A] bg-[#D5A33A]/15 text-[#F4CE70]":"border-[#343B48] text-[#AAB1BE] hover:border-[#D5A33A]/40"}`}>
        <Icon size={15}/>{label}
      </button>)}
    </div>
    {tab==="overview"&&<div className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="brand-kicker text-[#D5A33A]">TOURNAMENT LOBBY</div>
          <h2 className="font-display text-2xl font-black mt-1">{tournament.name}</h2>
          <p className="text-sm text-muted-foreground mt-2">{statusText[tournament.status]||"Tournament"} · {tournament.game} · {tournament.format} · BO{tournament.bestOf}</p>
        </div>
        <span className="m8-pill">{admin?"ADMIN CONTROL AVAILABLE":"CIRCLE VIEW"}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
        {[[UsersRound,"Teams",teams.length],[ShieldCheck,"Registered players",rosterCount],[Swords,"Matches finished",completed],[Trophy,"Tournament status",statusText[tournament.status]||"Setup"]].map(([Icon,label,value])=><div key={label} className="bg-[#0C1119] rounded-xl border border-[#252B36] p-3"><Icon size={16} className="text-[#D5A33A]"/><p className="text-[10px] mt-2 text-muted-foreground">{label}</p><p className="font-display font-bold mt-1">{value}</p></div>)}
      </div>
      <h3 className="font-black text-sm mt-5 mb-3">Teams & rosters</h3>
      <div className="grid sm:grid-cols-2 gap-2">
        {teams.map((team,index)=><button type="button" key={team.id||index} onClick={()=>onTeamOpen?.(team)} className="text-left rounded-xl border border-[#2B303B] bg-[#0C1119] px-4 py-3 hover:border-[#D5A33A]/50">
          <div className="font-bold text-sm"><span className="text-[#D5A33A] mr-2">#{index+1}</span>{team.name}</div>
          <div className="text-xs text-muted-foreground mt-1">{rosterPlayers(team).length} players</div>
        </button>)}
        {!teams.length&&<p className="text-xs text-muted-foreground">Teams will appear after registration.</p>}
      </div>
    </div>}
    {tab==="bracket"&&<div className={panel}>
      <h2 className="font-display text-xl font-black">Interactive Bracket</h2>
      <p className="text-xs text-muted-foreground mt-1">Select team names to view rosters. Only confirmed results advance the bracket.</p>
      <div className="flex gap-4 overflow-x-auto mt-4 pb-3">
        {rounds.map((round,i)=><div key={i} className="min-w-[235px] flex-1 space-y-3">
          <div className="text-xs uppercase tracking-widest font-bold text-[#D5A33A]">Round {i+1}</div>
          {(Array.isArray(round)?round:[]).map((m,j)=><div key={m.id||j} className="rounded-xl border border-[#343B48] bg-[#0B1018] p-3">
            {[m.a,m.b].map((team,k)=><button key={k} type="button" disabled={!team} onClick={()=>onTeamOpen?.(team)} className="w-full flex justify-between items-center text-xs font-semibold text-left p-2 rounded-md hover:bg-white/5 disabled:opacity-40">
              <span className="truncate">{team?.name||"TBD"}</span><span className={m.winner===team?.id?"text-[#D5A33A]":"text-muted-foreground"}>{k===0?(m.scoreA??"—"):(m.scoreB??"—")}</span>
            </button>)}
          </div>)}
        </div>)}
        {!rounds.length&&<p className="text-sm text-muted-foreground">The bracket is not generated yet.</p>}
      </div>
    </div>}
    {tab==="live"&&<div className={panel}>
      <h2 className="font-display text-xl font-black">Tournament Match Rooms</h2>
      <p className="text-xs text-muted-foreground mt-1">Scheduled fixtures. Ready Check and Map Veto will only become actionable after server-side match authorization is enabled.</p>
      <div className="space-y-2 mt-4">{active.map(m=><div key={m.id||`${m.roundIndex}-${m.matchIndex}`} className="rounded-xl border border-[#343B48] p-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-[10px] text-[#D5A33A]">ROUND {m.roundIndex+1} · MATCH {m.matchIndex+1}</div><div className="font-bold mt-1">{m.a?.name} <span className="text-muted-foreground">VS</span> {m.b?.name}</div></div>
        <span className="text-xs border border-[#D5A33A]/30 rounded-lg px-3 py-2 text-[#F4CE70]">Awaiting match</span>
      </div>)}{!active.length&&<p className="text-sm text-muted-foreground">No pending match rooms yet.</p>}</div>
    </div>}
    {tab==="history"&&<div className={panel}>
      <h2 className="font-display text-xl font-black">Tournament History</h2>
      <p className="text-xs text-muted-foreground mt-1">Completed rounds from the active tournament.</p>
      <div className="mt-4 space-y-2">{matches.filter(m=>m.winner).map(m=><div key={m.id||`${m.roundIndex}-${m.matchIndex}`} className="border border-[#343B48] rounded-xl p-3 text-sm">Round {m.roundIndex+1} · {m.a?.name||"TBD"} {m.scoreA} : {m.scoreB} {m.b?.name||"TBD"}</div>)}
      {!completed&&<p className="text-sm text-muted-foreground">No completed games yet.</p>}</div>
    </div>}
  </section>;
}
