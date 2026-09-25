import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-admin-session",
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

  return Boolean(
    credential?.is_active &&
    credential?.required_account_id &&
    credential.required_account_id === session.account_id
  );
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
    if (!(await validateAdminSession(req, supabase))) {
      return json({ error: "Admin session expired or invalid" }, 401);
    }
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "list") {
      const { data, error } = await supabase
        .from("admin_audit_log")
        .select("id,action,entity_type,entity_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ ok: true, logs: data || [] });
    }

    if (action === "log") {
      const event = String(body?.event || "").trim().slice(0, 120);
      const entityType = String(body?.entityType || "").trim().slice(0, 80);
      const entityId = body?.entityId == null ? null : String(body.entityId).slice(0, 120);
      const details =
        body?.details && typeof body.details === "object" && !Array.isArray(body.details)
          ? body.details
          : {};

      if (!event || !entityType) return json({ error: "Invalid audit event" }, 400);

      const { data, error } = await supabase
        .from("admin_audit_log")
        .insert({
          action: event,
          entity_type: entityType,
          entity_id: entityId,
          details,
        })
        .select("id,action,entity_type,entity_id,details,created_at")
        .single();

      if (error) throw error;
      return json({ ok: true, log: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
