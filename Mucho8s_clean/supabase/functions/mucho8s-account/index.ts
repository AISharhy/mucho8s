import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-admin-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const validateAdminSession = async (req: Request, supabase: any) => {
  const token = String(req.headers.get("x-admin-session") || "").trim();
  if (!token) return false;

  const tokenHash = await sha256(token);
  const uaHash = await sha256(req.headers.get("user-agent") || "unknown");

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("username,account_id,user_agent_hash,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session || session.revoked_at) return false;
  if (new Date(session.expires_at).getTime() <= Date.now()) return false;
  if (session.user_agent_hash !== uaHash) return false;

  const { data: credential } = await supabase
    .from("admin_credentials")
    .select("is_active,required_account_id")
    .eq("username", session.username)
    .maybeSingle();

  if (!credential?.is_active) return false;
  if (!credential?.required_account_id || credential.required_account_id !== session.account_id) return false;

  await supabase
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return true;
};

const cleanPaymentLink = (value: unknown, provider: "paypal" | "revolut") => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > 500) throw new Error("Link is too long");

  let candidate = raw.replace(/^@+/, "").trim();
  if (!candidate) return null;

  if (!/^https?:\/\//i.test(candidate)) {
    if (candidate.includes("/")) {
      candidate = `https://${candidate.replace(/^\/+/, "")}`;
    } else {
      const host = provider === "paypal" ? "paypal.me" : "revolut.me";
      candidate = `https://${host}/${candidate}`;
    }
  }

  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https links are allowed");
  }
  return url.toString();
};

const attachPlayerCompetitionRows = async (
  supabase: any,
  accountId: string,
  playerId: string,
) => {
  if (!accountId || !playerId) return;

  const updates = [
    supabase
      .from("player_challenges")
      .update({ challenger_account_id: accountId })
      .eq("challenger_player_id", playerId)
      .is("challenger_account_id", null),
    supabase
      .from("player_challenges")
      .update({ challenged_account_id: accountId })
      .eq("challenged_player_id", playerId)
      .is("challenged_account_id", null),
    supabase
      .from("challenge_series")
      .update({ player_a_account_id: accountId })
      .eq("player_a_player_id", playerId)
      .is("player_a_account_id", null),
    supabase
      .from("challenge_series")
      .update({ player_b_account_id: accountId })
      .eq("player_b_player_id", playerId)
      .is("player_b_account_id", null),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
};

const metadataFromUser = (user: any) => {
  const identity = Array.isArray(user?.identities)
    ? user.identities.find((x: any) => x?.provider === "discord") || user.identities[0]
    : null;
  const data = identity?.identity_data || user?.user_metadata || {};

  const discordId = String(
    data?.provider_id ||
    data?.sub ||
    data?.id ||
    identity?.id ||
    ""
  ).trim();

  const username = String(
    data?.user_name ||
    data?.preferred_username ||
    data?.username ||
    user?.user_metadata?.user_name ||
    user?.user_metadata?.preferred_username ||
    ""
  ).trim();

  const displayName = String(
    data?.full_name ||
    data?.name ||
    data?.global_name ||
    user?.user_metadata?.full_name ||
    username ||
    "Discord User"
  ).trim();

  const avatarUrl = String(
    data?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    ""
  ).trim();

  return { discordId, username, displayName, avatarUrl };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "sync" || action === "me" || action === "update-links") {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "Missing session" }, 401);

      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return json({ error: "Invalid session" }, 401);

      const meta = metadataFromUser(user);

      const { data: existing, error: existingError } = await supabase
        .from("player_accounts")
        .select("player_id")
        .eq("id", user.id)
        .maybeSingle();
      if (existingError) throw existingError;

      if (action === "sync") {
        const { error: upsertError } = await supabase
          .from("player_accounts")
          .upsert({
            id: user.id,
            discord_id: meta.discordId || null,
            discord_username: meta.username || null,
            display_name: meta.displayName,
            avatar_url: meta.avatarUrl || null,
            player_id: existing?.player_id || null,
            updated_at: new Date().toISOString(),
          });
        if (upsertError) throw upsertError;
      }

      if (action === "update-links") {
        if (!existing?.player_id) {
          return json({ error: "Discord account is not linked to a player yet" }, 409);
        }

        let paypalUrl = null;
        let revolutUrl = null;
        const role = String(body?.role || "").trim().toUpperCase();

        if (!["", "SMG", "AR", "FLEX"].includes(role)) {
          return json({ error: "Role must be SMG, AR or FLEX" }, 400);
        }

        try {
          paypalUrl = cleanPaymentLink(body?.paypalUrl, "paypal");
          revolutUrl = cleanPaymentLink(body?.revolutUrl, "revolut");
        } catch (error) {
          return json({ error: String(error).replace(/^Error:\s*/, "") }, 400);
        }

        const { error: linkError } = await supabase
          .from("player_accounts")
          .update({
            paypal_url: paypalUrl,
            revolut_url: revolutUrl,
            cmg_url: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (linkError) throw linkError;

        const { data: state, error: stateError } = await supabase
          .from("app_state")
          .select("players")
          .eq("id", "main")
          .maybeSingle();

        if (stateError) throw stateError;

        if (state?.players && Array.isArray(state.players)) {
          const nextPlayers = state.players.map((player: any) =>
            String(player?.id || "") === String(existing.player_id)
              ? { ...player, role }
              : player
          );

          const { error: roleError } = await supabase
            .from("app_state")
            .update({
              players: nextPlayers,
              version: Date.now(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", "main");

          if (roleError) throw roleError;
        }
      }

      const { data: account, error: accountError } = await supabase
        .from("player_accounts")
        .select("id,discord_id,discord_username,display_name,avatar_url,player_id,paypal_url,revolut_url,cmg_url,created_at,updated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (accountError) throw accountError;

      if (account?.player_id) {
        await attachPlayerCompetitionRows(supabase, user.id, String(account.player_id));
        await supabase.from("player_presence").upsert({
          account_id: user.id,
          player_id: account.player_id,
          last_seen_at: new Date().toISOString(),
        });
      }

      return json({ ok: true, account, user: { id: user.id, email: user.email || null } });
    }

    if (!(await validateAdminSession(req, supabase))) return json({ error: "Admin session expired or invalid" }, 401);

    if (action === "admin-list") {
      const { data, error } = await supabase
        .from("player_accounts")
        .select("id,discord_id,discord_username,display_name,avatar_url,player_id,paypal_url,revolut_url,cmg_url,created_at,updated_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ ok: true, accounts: data || [] });
    }

    if (action === "admin-link") {
      const accountId = String(body?.accountId || "").trim();
      const playerIdRaw = body?.playerId;
      const playerId = playerIdRaw == null || String(playerIdRaw).trim() === ""
        ? null
        : String(playerIdRaw).trim();

      if (!accountId) return json({ error: "Account is required" }, 400);

      const { data, error } = await supabase
        .from("player_accounts")
        .update({
          player_id: playerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", accountId)
        .select("id,discord_id,discord_username,display_name,avatar_url,player_id,paypal_url,revolut_url,cmg_url,created_at,updated_at")
        .single();

      if (error) {
        if (String(error?.code) === "23505") {
          return json({ error: "This player is already linked to another Discord account" }, 409);
        }
        throw error;
      }

      if (data?.player_id) {
        await attachPlayerCompetitionRows(supabase, String(data.id), String(data.player_id));
      }

      return json({ ok: true, account: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
