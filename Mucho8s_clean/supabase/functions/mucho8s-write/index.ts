import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_PASSWORD_SHA256 = "5275321e80637acbd0dc2a0d0e9b5120ab79618531edd49b189ff4b4ce4ec4ff";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-admin-password",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const suppliedPassword = req.headers.get("x-admin-password") || "";
  if ((await sha256(suppliedPassword)) !== ADMIN_PASSWORD_SHA256) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    if (!Array.isArray(body.players) || !Array.isArray(body.matches)) {
      return new Response(JSON.stringify({ error: "Invalid state payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl || !secretKey) {
      throw new Error("Supabase server credentials unavailable");
    }

    const supabase = createClient(supabaseUrl, secretKey);

    const { error } = await supabase
      .from("app_state")
      .upsert({
        id: "main",
        players: body.players,
        matches: body.matches,
        version: Date.now(),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
