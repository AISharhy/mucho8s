import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const isTwitchChannelLive = async (channel: string) => {
  const normalizedChannel = String(channel || "").trim().replace(/^@+/, "");
  if (!normalizedChannel) return false;

  try {
    const response = await fetch(
      `https://decapi.me/twitch/uptime/${encodeURIComponent(normalizedChannel)}`,
      {
        headers: {
          "User-Agent": "Mucho8s/1.0",
          "Accept": "text/plain",
        },
        signal: AbortSignal.timeout(3500),
      },
    );
    const statusText = (await response.text()).trim();
    const normalized = statusText.toLowerCase();

    return response.ok &&
      Boolean(statusText) &&
      !normalized.includes("offline") &&
      !normalized.includes("not live") &&
      !normalized.includes("does not exist") &&
      !normalized.includes("error");
  } catch {
    return false;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);
    const onlineCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const [
      { data: activeChallenges, error: activeError },
      { data: recentChallenges, error: recentError },
      { data: presence, error: presenceError },
      { data: twitchAccounts, error: twitchAccountsError },
      { data: config, error: configError },
    ] = await Promise.all([
      supabase
        .from("player_challenges")
        .select("id,challenger_player_id,challenged_player_id,platform,amount_cents,currency,status,created_at,responded_at,result_reported_at,reported_winner_player_id,season_number")
        .in("status", ["accepted", "result_pending", "disputed"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("player_challenges")
        .select("id,challenger_player_id,challenged_player_id,platform,amount_cents,currency,status,created_at,verified_at,reported_winner_player_id,payment_received_at,season_number")
        .eq("status", "completed")
        .order("verified_at", { ascending: false })
        .limit(20),
      supabase
        .from("player_presence")
        .select("player_id,last_seen_at")
        .gte("last_seen_at", onlineCutoff)
        .order("last_seen_at", { ascending: false })
        .limit(100),
      supabase
        .from("player_accounts")
        .select("player_id,twitch_channel")
        .not("player_id", "is", null)
        .not("twitch_channel", "is", null)
        .limit(100),
      supabase
        .from("competition_config")
        .select("season_number,season_name,season_started_at,updated_at")
        .eq("id", "main")
        .maybeSingle(),
    ]);

    if (activeError) throw activeError;
    if (recentError) throw recentError;
    if (presenceError) throw presenceError;
    if (twitchAccountsError) throw twitchAccountsError;
    if (configError) throw configError;

    const twitchChecks = await Promise.all(
      (twitchAccounts || []).map(async (row: any) => {
        const playerId = String(row?.player_id || "").trim();
        const twitchChannel = String(row?.twitch_channel || "").trim().replace(/^@+/, "");
        if (!playerId || !twitchChannel) return null;

        const live = await isTwitchChannelLive(twitchChannel);
        return live ? { player_id: playerId, twitch_channel: twitchChannel } : null;
      }),
    );
    const twitchLivePlayers = twitchChecks.filter(Boolean);

    return new Response(JSON.stringify({
      ok: true,
      activeChallenges: activeChallenges || [],
      recentChallenges: recentChallenges || [],
      onlinePlayers: presence || [],
      twitchLivePlayers,
      competition: config || { season_number: 1, season_name: "Season 1" },
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=15",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Dashboard data unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
