import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Plus, Shield, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { clubStats } from "@/lib/clubAnalytics";
import { Input } from "@/components/ui/input";
import { createTeam, listTeams, listMyClubInvites, respondClubInvite } from "@/lib/teams";

const TeamMark = ({ team, size = 48 }) => (
  team?.logo_url ? (
    <img
      src={team.logo_url}
      alt=""
      className="rounded-xl object-cover border border-[#2A303B] bg-[#0F1218]"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-xl border border-[#2A303B] bg-[#0F1218] flex items-center justify-center font-display font-black text-magma"
      style={{ width: size, height: size }}
    >
      {String(team?.tag || "TM").slice(0, 3)}
    </div>
  )
);

export default function Teams() {
  const navigate = useNavigate();
  const { discordPlayer, playerMap, matches, competitionData } = useData();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invites, setInvites] = useState([]);
  const [clubQuery, setClubQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    tag: "",
    description: "",
    logoUrl: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      setTeams(await listTeams());
    } catch (error) {
      toast.error(error.message || "Unable to load teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => { if (discordPlayer) listMyClubInvites().then(setInvites).catch(e => toast.error(e.message)); else setInvites([]); }, [discordPlayer?.id]);

  const clubStandings = useMemo(() => teams.map(t => ({...t, stats:clubStats([...(matches||[]),...(competitionData?.archives||[]).flatMap(a=>a.matches||a.snapshot?.matches||[])],t.id)})).filter(t=>t.stats.played>0).sort((a,b)=>b.stats.wins-a.stats.wins||b.stats.winRate-a.stats.winRate||a.name.localeCompare(b.name)),[teams,matches,competitionData?.archives]);

  const myTeam = useMemo(
    () => teams.find((team) =>
      (team.members || []).some((member) => member.player_id === discordPlayer?.id)
    ),
    [teams, discordPlayer?.id],
  );

  const visibleTeams = useMemo(() => teams.filter(team => `${team.name || ""} ${team.tag || ""} ${team.description || ""}`.toLowerCase().includes(clubQuery.trim().toLowerCase())), [teams, clubQuery]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const team = await createTeam(form);
      toast.success(`${team.name} created`);
      setShowCreate(false);
      navigate(`/teams/${team.id}`);
    } catch (error) {
      toast.error(error.message || "Unable to create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Competitive Clubs</div>
            <div className="flex items-center gap-2">
              <Shield size={21} className="text-magma" />
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.035em]">MuchoClubs <span className="inline-block align-middle rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] tracking-widest text-amber-300">BETA</span></h1>
            </div>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              Create a competitive club, manage its roster, and give your squad a public Mucho identity. Club membership uses the existing Teams system.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {myTeam && (
              <Link
                to={`/teams/${myTeam.id}`}
                className="h-10 px-4 rounded-xl border border-[#2A303B] bg-[#11161E] text-sm font-bold inline-flex items-center gap-2 hover:border-[#424A58]"
              >
                <Crown size={15} className="text-[#D5A33A]" />
                My Team
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              disabled={!discordPlayer || Boolean(myTeam)}
              title={!discordPlayer ? "Login with Discord and link your player first" : myTeam ? "You already belong to a team" : "Create team"}
              className="h-10 px-4 rounded-xl bg-magma hover:bg-[#ff3c4c] text-white text-sm font-black inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="create-team-button"
            >
              <Plus size={16} />
              Create Team
            </button>
          </div>
        </div>
      </section>

      <section className="m8-panel rounded-2xl p-4"><h2 className="font-bold text-lg">Classifica club</h2><p className="text-xs text-slate-400 mt-1">Sfide tra club confermate · vittorie, poi win rate. Le partite precedenti senza identità club registrata sono escluse.</p>{clubStandings.length?<div className="overflow-x-auto"><table className="w-full text-sm mt-3"><thead><tr className="text-left text-slate-400"><th>Club</th><th>W</th><th>L</th><th>WR</th></tr></thead><tbody>{clubStandings.map((t,i)=><tr className="border-t border-white/10" key={t.id}><td className="py-2"><Link to={`/teams/${t.id}`}>{i+1}. [{t.tag}] {t.name}</Link></td><td>{t.stats.wins}</td><td>{t.stats.losses}</td><td>{t.stats.winRate}%</td></tr>)}</tbody></table></div>:<p className="text-xs text-slate-400 mt-4">Nessuna sfida club confermata.</p>}</section>

      {invites.length > 0 && <section className="m8-panel rounded-2xl p-4"><h2 className="font-bold text-lg">Inviti club</h2>{invites.map(inv => <div key={inv.id} className="flex flex-wrap justify-between items-center gap-3 border-t border-white/10 py-3 mt-2"><span className="text-sm">[{inv.competitive_teams?.tag}] {inv.competitive_teams?.name}</span><div className="flex gap-2">{[true,false].map(accept=><button key={String(accept)} disabled={saving} className="rounded-lg border border-white/15 px-3 py-2 text-xs" onClick={async()=>{setSaving(true);try{await respondClubInvite(inv.team_id,inv.id,accept);setInvites(v=>v.filter(i=>i.id!==inv.id));await load();toast.success(accept?"Invito accettato":"Invito rifiutato");}catch(e){toast.error(e.message);}finally{setSaving(false);}}}>{accept?'Accetta':'Rifiuta'}</button>)}</div></div>)}</section>}

      {showCreate && !myTeam && (
        <form onSubmit={submit} className="m8-panel rounded-2xl p-5 sm:p-6">
          <div className="brand-kicker mb-1">New Team</div>
          <h2 className="font-display text-2xl font-black">Create your club</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-[#AAB1BE]">Team name</span>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Mucho Elite"
                maxLength={32}
                required
                className="bg-[#0F1218] border-[#242A35]"
                data-testid="team-name-input"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-[#AAB1BE]">Tag</span>
              <Input
                value={form.tag}
                onChange={(e) => setForm((prev) => ({ ...prev, tag: e.target.value.toUpperCase() }))}
                placeholder="M8"
                maxLength={6}
                required
                className="bg-[#0F1218] border-[#242A35] uppercase"
                data-testid="team-tag-input"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-bold text-[#AAB1BE]">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Competitive Call of Duty team."
                maxLength={240}
                rows={3}
                className="w-full rounded-xl border border-[#242A35] bg-[#0F1218] px-3 py-2.5 text-sm text-white outline-none focus:border-magma/60 resize-none"
                data-testid="team-description-input"
              />
            </label>

            <label className="space-y-1.5 md:col-span-2">
              <span className="text-xs font-bold text-[#AAB1BE]">Logo URL <span className="font-normal text-[#697181]">(optional)</span></span>
              <Input
                value={form.logoUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                placeholder="https://..."
                className="bg-[#0F1218] border-[#242A35]"
                data-testid="team-logo-input"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="h-10 px-4 rounded-xl border border-[#2A303B] bg-[#11161E] text-sm font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl bg-magma text-white text-sm font-black disabled:opacity-50"
              data-testid="team-create-submit"
            >
              {saving ? "Creating..." : "Create Team"}
            </button>
          </div>
        </form>
      )}

      <div className="m8-panel rounded-2xl p-4 flex items-center gap-3"><Search size={17} className="text-[#7F8795] shrink-0" /><Input value={clubQuery} onChange={event => setClubQuery(event.target.value)} placeholder="Search clubs by name or tag..." aria-label="Search MuchoClubs" className="bg-[#0F1218] border-[#242A35]" /><span className="text-xs text-muted-foreground shrink-0">{visibleTeams.length} club</span></div>

      {loading ? (
        <div className="m8-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="m8-panel rounded-2xl p-10 text-center">
          <Users size={30} className="text-[#596170] mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">No teams yet</h3>
          <p className="text-sm text-muted-foreground mt-1">The first competitive club can be created now.</p>
        </div>
      ) : visibleTeams.length === 0 ? (
        <div className="m8-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">No clubs match your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="teams-grid">
          {visibleTeams.map((team) => {
            const captain = playerMap?.[team.captain_player_id];
            return (
              <Link
                key={team.id}
                to={`/teams/${team.id}`}
                className="m8-panel rounded-2xl p-4 hover:-translate-y-0.5 transition-transform group"
                data-testid={`team-card-${team.id}`}
              >
                <div className="flex items-start gap-3">
                  <TeamMark team={team} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase tracking-[.18em] text-magma font-black">[{team.tag}]</div>
                    <div className="font-display text-xl font-black truncate group-hover:text-white">{team.name}</div>
                    <div className="text-xs text-[#7F8795] mt-1">
                      {team.members?.length || 0}/8 players
                      {captain?.name ? ` · Captain ${captain.name}` : ""}
                    </div>
                  </div>
                </div>

                {team.description && (
                  <p className="text-sm text-[#929BA9] mt-4 line-clamp-2">{team.description}</p>
                )}

                <div className="mt-4 pt-3 border-t border-[#1D222C] flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-[#697181]">Public roster</span>
                  <span className="text-xs font-bold text-magma">Open →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
