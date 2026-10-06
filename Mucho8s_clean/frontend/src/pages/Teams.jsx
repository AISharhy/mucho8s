import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Plus, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { createTeam, listTeams } from "@/lib/teams";

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
  const { discordPlayer, playerMap } = useData();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const myTeam = useMemo(
    () => teams.find((team) =>
      (team.members || []).some((member) => member.player_id === discordPlayer?.id)
    ),
    [teams, discordPlayer?.id],
  );

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
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.035em]">Teams</h1>
            </div>
            <p className="text-sm text-[#7F8795] mt-2 max-w-2xl">
              Create a competitive team, build a roster and give your squad a public Mucho identity.
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

      {loading ? (
        <div className="m8-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading teams...</div>
      ) : teams.length === 0 ? (
        <div className="m8-panel rounded-2xl p-10 text-center">
          <Users size={30} className="text-[#596170] mx-auto mb-3" />
          <h3 className="font-display text-xl font-bold">No teams yet</h3>
          <p className="text-sm text-muted-foreground mt-1">The first competitive club can be created now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="teams-grid">
          {teams.map((team) => {
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
