import { supabaseAuth } from "@/lib/supabaseClient";

const URL = (process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const callTeams = async (payload, { auth = false } = {}) => {
  if (!URL || !KEY) throw new Error("Teams are unavailable in this version.");

  const headers = {
    "Content-Type": "application/json",
    apikey: KEY,
  };

  if (auth && !supabaseAuth) throw new Error("Login with Discord first.");

  if (supabaseAuth) {
    const { data } = await supabaseAuth.auth.getSession();
    const token = data?.session?.access_token;
    if (auth && !token) throw new Error("Login with Discord first.");
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${URL}/functions/v1/mucho8s-teams`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Team request failed");
  return result;
};

export const listTeams = async () => {
  const data = await callTeams({ action: "list" });
  return data.teams || [];
};

export const getTeam = async (teamId) => {
  const data = await callTeams({ action: "get", teamId });
  return data.team || null;
};

export const createTeam = async ({ name, tag, description, logoUrl }) => {
  const data = await callTeams(
    { action: "create", name, tag, description, logoUrl },
    { auth: true },
  );
  return data.team;
};

export const updateTeam = async (teamId, { name, tag, description, logoUrl }) => {
  const data = await callTeams(
    { action: "update", teamId, name, tag, description, logoUrl },
    { auth: true },
  );
  return data.team;
};

export const deleteTeam = async (teamId, confirmName) => {
  const data = await callTeams(
    { action: "delete", teamId, confirmName },
    { auth: true },
  );
  return data;
};

export const addTeamMember = async (teamId, playerId) => {
  const data = await callTeams(
    { action: "add-member", teamId, playerId },
    { auth: true },
  );
  return data.team;
};

export const removeTeamMember = async (teamId, playerId) => {
  const data = await callTeams(
    { action: "remove-member", teamId, playerId },
    { auth: true },
  );
  return data.team;
};

export const listMyClubInvites = async () => (await callTeams({action:"my-invites"}, {auth:true})).invites || [];
export const respondClubInvite = async (teamId, inviteId, accept) => callTeams({action:accept?"accept-invite":"decline-invite",teamId,inviteId}, {auth:true});
export const setClubCaptain = async (teamId, playerId) => callTeams({action:"set-captain",teamId,playerId}, {auth:true});

export const listClubChallenges = async () => (await callTeams({action:"club-challenges"},{auth:true})).challenges || [];
export const createClubChallenge = async (payload) => callTeams({action:"challenge",...payload},{auth:true});
export const respondClubChallenge = async (challengeId,accept) => callTeams({action:accept?"accept-challenge":"decline-challenge",challengeId},{auth:true});

export const registerClubTournament = async (teamId,roster) => callTeams({action:"register-tourney",teamId,roster},{auth:true});
