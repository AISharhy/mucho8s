import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Plus, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useData } from "@/context/DataContext";
import { PlayerAvatar, RankBadge } from "@/components/shared";
import { addTeamMember, getTeam, removeTeamMember } from "@/lib/teams";

const TeamLogo = ({ team }) => (
  team?.logo_url ? (
    <img
      src={team.logo_url}
      alt=""
      className="w-20 h-20 rounded-2xl object-cover border border-[#2A303B] bg-[#0F1218]"
    />
  ) : (
    <div className="w-20 h-20 rounded-2xl border border-[#2A303B] bg-[#0F1218] flex items-center justify-center font-display text-2xl font-black text-magma">
      {String(team?.tag || "TM").slice(0, 3)}
    </div>
  )
);

export default function TeamProfile() {
  const { id } = useParams();
  const { players, playerMap, playerAvatars, discordPlayer } = useData();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memberToAdd, setMemberToAdd] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setTeam(await getTeam(id));
    } catch (error) {
      toast.error(error.message || "Unable to load team");
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const memberIds = useMemo(
    () => new Set((team?.members || []).map((member) => member.player_id)),
    [team?.members],
  );

  const availablePlayers = useMemo(
    () => players
      .filter((player) => !memberIds.has(player.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [players, memberIds],
  );

  const averageElo = useMemo(() => {
    const values = (team?.members || [])
      .map((member) => Number(playerMap?.[member.player_id]?.currentElo))
      .filter(Number.isFinite);
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [team?.members, playerMap]);

  const addMember = async () => {
    if (!memberToAdd) return;
    setBusy(true);
    try {
      const next = await addTeamMember(team.id, memberToAdd);
      setTeam(next);
      setMemberToAdd("");
      toast.success("Player added to roster");
    } catch (error) {
      toast.error(error.message || "Unable to add player");
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (playerId) => {
    setBusy(true);
    try {
      setTeam(await removeTeamMember(team.id, playerId));
      toast.success("Player removed from roster");
    } catch (error) {
      toast.error(error.message || "Unable to remove player");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="m8-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">Loading team...</div>;
  }

  if (!team) {
    return (
      <div className="m8-panel rounded-2xl p-10 text-center">
        <Shield size={32} className="text-[#596170] mx-auto mb-3" />
        <h2 className="font-display text-2xl font-black">Team not found</h2>
        <Link to="/teams" className="inline-flex mt-4 text-sm font-bold text-magma">Back to Teams</Link>
      </div>
    );
  }

  const captain = playerMap?.[team.captain_player_id];

  return (
    <div className="m8-page-stack">
      <Link
        to="/teams"
        className="inline-flex items-center gap-2 text-sm text-[#8D95A4] hover:text-white w-fit"
      >
        <ArrowLeft size={15} />
        Teams
      </Link>

      <section className="m8-panel rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          <TeamLogo team={team} />

          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[.2em] text-magma font-black">[{team.tag}] Competitive Team</div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-[-0.04em] mt-1">{team.name}</h1>
            {team.description && (
              <p className="text-sm text-[#929BA9] mt-2 max-w-2xl">{team.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 min-w-[220px]">
            <div className="rounded-xl border border-[#222834] bg-[#0F1218] p-3">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">Roster</div>
              <div className="font-mono text-xl font-black mt-1">{team.members?.length || 0}/8</div>
            </div>
            <div className="rounded-xl border border-[#222834] bg-[#0F1218] p-3">
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">Avg Elo</div>
              <div className="font-mono text-xl font-black mt-1">{averageElo || "—"}</div>
            </div>
          </div>
        </div>
      </section>

      {team.canManage && (
        <section className="m8-panel rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex-1">
              <div className="brand-kicker mb-1">Captain Controls</div>
              <h2 className="font-display text-xl font-black">Manage roster</h2>
              <p className="text-xs text-[#7F8795] mt-1">Add any active Mucho player. Maximum roster: 8.</p>
            </div>

            <div className="flex gap-2 w-full lg:w-auto">
              <select
                value={memberToAdd}
                onChange={(event) => setMemberToAdd(event.target.value)}
                className="h-10 min-w-0 lg:min-w-[260px] flex-1 rounded-xl border border-[#242A35] bg-[#0F1218] px-3 text-sm text-white"
                data-testid="team-member-select"
              >
                <option value="">Select player...</option>
                {availablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} · {player.currentElo} Elo
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addMember}
                disabled={!memberToAdd || busy || (team.members?.length || 0) >= 8}
                className="h-10 px-4 rounded-xl bg-magma text-white font-black text-sm inline-flex items-center gap-2 disabled:opacity-40"
                data-testid="team-add-member"
              >
                <Plus size={15} />
                Add
              </button>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="brand-kicker mb-1">Roster</div>
            <h2 className="font-display text-2xl font-black">Players</h2>
          </div>
          <div className="text-xs text-[#697181] inline-flex items-center gap-1.5">
            <Users size={14} />
            {team.members?.length || 0} members
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(team.members || []).map((member) => {
            const player = playerMap?.[member.player_id];
            const isCaptain = member.player_id === team.captain_player_id;
            return (
              <div key={member.player_id} className="m8-panel rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Link to={`/players/${member.player_id}`} className="shrink-0">
                    <PlayerAvatar
                      name={player?.name || "Player"}
                      elo={player?.currentElo || 500}
                      size={46}
                      avatarUrl={playerAvatars?.[member.player_id]}
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/players/${member.player_id}`}
                        className="font-display font-black truncate hover:text-magma"
                      >
                        {player?.name || "Unknown player"}
                      </Link>
                      {isCaptain && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#D5A33A]/30 bg-[#D5A33A]/10 px-1.5 py-0.5 text-[9px] font-black text-[#E6BE5B]">
                          <Crown size={10} />
                          CAPTAIN
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      {player ? <RankBadge elo={player.currentElo} compact /> : <span className="text-xs text-muted-foreground">Player data unavailable</span>}
                    </div>
                  </div>

                  {team.canManage && !isCaptain && (
                    <button
                      type="button"
                      onClick={() => removeMember(member.player_id)}
                      disabled={busy}
                      className="w-9 h-9 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 flex items-center justify-center disabled:opacity-40"
                      aria-label={`Remove ${player?.name || "player"}`}
                      title="Remove from roster"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {discordPlayer?.id === team.captain_player_id && !team.canManage && (
        <div className="text-xs text-[#697181] text-center">
          Re-login with Discord if captain controls are not visible.
        </div>
      )}
    </div>
  );
}
