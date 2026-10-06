import { supabaseAuth } from "@/lib/supabaseClient";

const URL = (process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const callTeams = async (payload, { auth = false } = {}) => {
  if (!URL || !KEY) throw new Error("Teams are unavailable in this version.");

  const headers = {
    "Content-Type": "application/json",
    apikey: KEY,
  };

  if (auth || supabaseAuth) {
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
