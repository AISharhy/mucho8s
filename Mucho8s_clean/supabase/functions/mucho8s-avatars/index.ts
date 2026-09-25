import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseUrl || !secretKey) {
      throw new Error("Supabase server credentials unavailable");
    }

    const supabase = createClient(supabaseUrl, secretKey);

    const { data, error } = await supabase
      .from("player_accounts")
      .select("player_id,avatar_url,paypal_url,revolut_url,cmg_url")
      .not("player_id", "is", null)
      .not("avatar_url", "is", null);

    if (error) throw error;

    const profiles = Object.fromEntries(
      (data || [])
        .filter((row: any) => row?.player_id)
        .map((row: any) => [
          String(row.player_id),
          {
            avatarUrl: row?.avatar_url ? String(row.avatar_url) : "",
            paypalUrl: row?.paypal_url ? String(row.paypal_url) : "",
            revolutUrl: row?.revolut_url ? String(row.revolut_url) : "",
            cmgUrl: row?.cmg_url ? String(row.cmg_url) : "",
          },
        ])
    );

    const avatars = Object.fromEntries(
      Object.entries(profiles)
        .filter(([, profile]: any) => profile?.avatarUrl)
        .map(([playerId, profile]: any) => [playerId, profile.avatarUrl])
    );

    return new Response(JSON.stringify({ ok: true, avatars, profiles }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
