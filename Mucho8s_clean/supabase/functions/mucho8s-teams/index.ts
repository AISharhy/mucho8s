import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = new Set([
  "https://aisharhy.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://aisharhy.github.io",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });

const cleanName = (value: unknown) => {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 32) {
    throw new Error("Team name must be between 2 and 32 characters");
  }
  if (!/^[\p{L}\p{N}_.\- '&]+$/u.test(name)) {
    throw new Error("Team name contains unsupported characters");
  }
  return name;
};

const cleanTag = (value: unknown) => {
  const tag = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,6}$/.test(tag)) {
    throw new Error("Tag must be 2-6 letters, numbers, _ or -");
  }
  return tag;
};

const cleanDescription = (value: unknown) => {
  const description = String(value || "").trim();
  if (description.length > 240) throw new Error("Description must be 240 characters or less");
  return description;
};

const cleanLogoUrl = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > 500) throw new Error("Logo URL is too long");
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("Logo URL must use http or https");
  }
  return url.toString();
};

const getUser = async (req: Request, supabase: any) => {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
};

const getAccount = async (supabase: any, userId: string) => {
  const { data, error } = await supabase
    .from("player_accounts")
    .select("id,player_id,display_name,discord_username")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const getTeamRow = async (supabase: any, teamId: string) => {
  const { data, error } = await supabase
    .from("competitive_teams")
    .select("id,name,tag,description,logo_url,owner_account_id,captain_player_id,created_at,updated_at")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const membersFor = async (supabase: any, teamIds: string[]) => {
  if (!teamIds.length) return [];
  const { data, error } = await supabase
    .from("competitive_team_members")
    .select("team_id,player_id,role,joined_at")
    .in("team_id", teamIds)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return data || [];
};

const publicTeam = (team: any, members: any[], canManage = false) => ({
  id: team.id,
  name: team.name,
  tag: team.tag,
  description: team.description || "",
  logo_url: team.logo_url || null,
  captain_player_id: team.captain_player_id,
  created_at: team.created_at,
  updated_at: team.updated_at,
  members: members
    .filter((member) => member.team_id === team.id)
    .map((member) => ({
      player_id: member.player_id,
      role: member.role,
      joined_at: member.joined_at,
    })),
  canManage,
});

const playerExists = async (supabase: any, playerId: string) => {
  const { data, error } = await supabase
    .from("app_state")
    .select("players")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;
  const players = Array.isArray(data?.players) ? data.players : [];
  return players.some((player: any) => String(player?.id || "") === playerId);
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");
    const user = await getUser(req, supabase);
    const account = user ? await getAccount(supabase, user.id) : null;

    if (action === "list") {
      const { data: teams, error } = await supabase
        .from("competitive_teams")
        .select("id,name,tag,description,logo_url,owner_account_id,captain_player_id,created_at,updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const members = await membersFor(supabase, (teams || []).map((team: any) => team.id));
      return json(req, {
        ok: true,
        teams: (teams || []).map((team: any) =>
          publicTeam(team, members, Boolean(account?.id && account.id === team.owner_account_id))
        ),
      });
    }

    if (action === "get") {
      const teamId = String(body?.teamId || "").trim();
      if (!teamId) return json(req, { error: "Team is required" }, 400);

      const team = await getTeamRow(supabase, teamId);
      if (!team) return json(req, { error: "Team not found" }, 404);
      const members = await membersFor(supabase, [team.id]);

      return json(req, {
        ok: true,
        team: publicTeam(team, members, Boolean(account?.id && account.id === team.owner_account_id)),
      });
    }

    if (!user || !account?.id) return json(req, { error: "Login with Discord first" }, 401);
    if (!account.player_id) return json(req, { error: "Your Discord account must be linked to a player" }, 409);

    if (action === "create") {
      let name = "";
      let tag = "";
      let description = "";
      let logoUrl = null;
      try {
        name = cleanName(body?.name);
        tag = cleanTag(body?.tag);
        description = cleanDescription(body?.description);
        logoUrl = cleanLogoUrl(body?.logoUrl);
      } catch (error) {
        return json(req, { error: String(error).replace(/^Error:\s*/, "") }, 400);
      }

      const { data: owned } = await supabase
        .from("competitive_teams")
        .select("id")
        .eq("owner_account_id", account.id)
        .maybeSingle();
      if (owned) return json(req, { error: "You already own a team" }, 409);

      const { data: membership } = await supabase
        .from("competitive_team_members")
        .select("team_id")
        .eq("player_id", account.player_id)
        .maybeSingle();
      if (membership) return json(req, { error: "You already belong to a team" }, 409);

      const now = new Date().toISOString();
      const { data: team, error: createError } = await supabase
        .from("competitive_teams")
        .insert({
          name,
          tag,
          description,
          logo_url: logoUrl,
          owner_account_id: account.id,
          captain_player_id: account.player_id,
          created_at: now,
          updated_at: now,
        })
        .select("id,name,tag,description,logo_url,owner_account_id,captain_player_id,created_at,updated_at")
        .single();

      if (createError) {
        if (String(createError.code) === "23505") {
          return json(req, { error: "Team name or tag is already in use" }, 409);
        }
        throw createError;
      }

      const { error: memberError } = await supabase
        .from("competitive_team_members")
        .insert({
          team_id: team.id,
          player_id: account.player_id,
          role: "captain",
          joined_at: now,
        });
      if (memberError) {
        await supabase.from("competitive_teams").delete().eq("id", team.id);
        throw memberError;
      }

      return json(req, {
        ok: true,
        team: publicTeam(team, [{
          team_id: team.id,
          player_id: account.player_id,
          role: "captain",
          joined_at: now,
        }], true),
      }, 201);
    }

    const teamId = String(body?.teamId || "").trim();
    if (!teamId) return json(req, { error: "Team is required" }, 400);

    const team = await getTeamRow(supabase, teamId);
    if (!team) return json(req, { error: "Team not found" }, 404);
    if (team.owner_account_id !== account.id) {
      return json(req, { error: "Only the team captain can manage this roster" }, 403);
    }

    if (action === "add-member") {
      const playerId = String(body?.playerId || "").trim();
      if (!playerId) return json(req, { error: "Player is required" }, 400);
      if (!(await playerExists(supabase, playerId))) return json(req, { error: "Player not found" }, 404);

      const { count, error: countError } = await supabase
        .from("competitive_team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", team.id);
      if (countError) throw countError;
      if (Number(count || 0) >= 8) return json(req, { error: "Roster limit is 8 players" }, 409);

      const { error: insertError } = await supabase
        .from("competitive_team_members")
        .insert({
          team_id: team.id,
          player_id: playerId,
          role: "member",
          joined_at: new Date().toISOString(),
        });

      if (insertError) {
        if (String(insertError.code) === "23505") {
          return json(req, { error: "That player already belongs to a team" }, 409);
        }
        throw insertError;
      }
    } else if (action === "remove-member") {
      const playerId = String(body?.playerId || "").trim();
      if (!playerId) return json(req, { error: "Player is required" }, 400);
      if (playerId === team.captain_player_id) {
        return json(req, { error: "The captain cannot be removed from the roster" }, 409);
      }

      const { error: deleteError } = await supabase
        .from("competitive_team_members")
        .delete()
        .eq("team_id", team.id)
        .eq("player_id", playerId);
      if (deleteError) throw deleteError;
    } else {
      return json(req, { error: "Unknown action" }, 400);
    }

    await supabase
      .from("competitive_teams")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", team.id);

    const refreshed = await getTeamRow(supabase, team.id);
    const members = await membersFor(supabase, [team.id]);
    return json(req, { ok: true, team: publicTeam(refreshed, members, true) });
  } catch (error) {
    console.error("mucho8s-teams", error);
    return json(req, { error: "Team request failed" }, 500);
  }
});
