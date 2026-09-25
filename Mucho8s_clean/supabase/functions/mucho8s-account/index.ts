import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_PASSWORD_SHA256 = "5275321e80637acbd0dc2a0d0e9b5120ab79618531edd49b189ff4b4ce4ec4ff";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-admin-password",
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

const getAdmin = async (req: Request) => {
  const supplied = req.headers.get("x-admin-password") || "";
  return (await sha256(supplied)) === ADMIN_PASSWORD_SHA256;
};

const cleanPublicUrl = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > 500) throw new Error("Link is too long");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https links are allowed");
  }
  return url.toString();
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
        let cmgUrl = null;

        try {
          paypalUrl = cleanPublicUrl(body?.paypalUrl);
          revolutUrl = cleanPublicUrl(body?.revolutUrl);
          cmgUrl = cleanPublicUrl(body?.cmgUrl);
        } catch (error) {
          return json({ error: String(error).replace(/^Error:\s*/, "") }, 400);
        }

        const { error: linkError } = await supabase
          .from("player_accounts")
          .update({
            paypal_url: paypalUrl,
            revolut_url: revolutUrl,
            cmg_url: cmgUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (linkError) throw linkError;
      }

      const { data: account, error: accountError } = await supabase
        .from("player_accounts")
        .select("id,discord_id,discord_username,display_name,avatar_url,player_id,paypal_url,revolut_url,cmg_url,created_at,updated_at")
        .eq("id", user.id)
        .maybeSingle();
      if (accountError) throw accountError;

      return json({ ok: true, account, user: { id: user.id, email: user.email || null } });
    }

    if (!(await getAdmin(req))) return json({ error: "Unauthorized" }, 401);

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

      return json({ ok: true, account: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
