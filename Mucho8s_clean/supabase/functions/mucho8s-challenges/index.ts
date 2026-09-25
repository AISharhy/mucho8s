import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PLATFORM_COLUMNS: Record<string, string> = {
  paypal: "paypal_url",
  revolut: "revolut_url",
  cmg: "cmg_url",
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

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Login with Discord first" }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const { data: me, error: meError } = await supabase
      .from("player_accounts")
      .select("id,player_id,display_name,discord_username")
      .eq("id", user.id)
      .maybeSingle();

    if (meError) throw meError;
    if (!me?.player_id) return json({ error: "Your Discord account is not linked to a player yet" }, 409);

    const body = await req.json();
    const action = String(body?.action || "");

    const getChallenge = async (id: string) => {
      const { data, error } = await supabase
        .from("player_challenges")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    };

    const isParticipant = (challenge: any) =>
      challenge?.challenger_account_id === user.id || challenge?.challenged_account_id === user.id;

    if (action === "list") {
      const { data, error } = await supabase
        .from("player_challenges")
        .select("*")
        .or(`challenger_account_id.eq.${user.id},challenged_account_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return json({ ok: true, challenges: data || [] });
    }

    if (action === "create") {
      const targetPlayerId = String(body?.targetPlayerId || "").trim();
      const platform = String(body?.platform || "").trim().toLowerCase();
      const linkColumn = PLATFORM_COLUMNS[platform];

      if (!targetPlayerId || !linkColumn) {
        return json({ error: "Invalid challenge target or platform" }, 400);
      }
      if (targetPlayerId === me.player_id) {
        return json({ error: "You cannot challenge yourself" }, 400);
      }

      const { data: target, error: targetError } = await supabase
        .from("player_accounts")
        .select("id,player_id,paypal_url,revolut_url,cmg_url")
        .eq("player_id", targetPlayerId)
        .maybeSingle();

      if (targetError) throw targetError;
      if (!target) return json({ error: "This player has not connected Discord yet" }, 404);

      const targetUrl = String(target[linkColumn] || "").trim();
      if (!targetUrl) return json({ error: "This player has not configured that challenge method" }, 409);

      const { data: active, error: activeError } = await supabase
        .from("player_challenges")
        .select("id,status")
        .or(
          `and(challenger_player_id.eq.${me.player_id},challenged_player_id.eq.${targetPlayerId}),and(challenger_player_id.eq.${targetPlayerId},challenged_player_id.eq.${me.player_id})`
        )
        .in("status", ["pending", "accepted", "result_pending"])
        .limit(1);

      if (activeError) throw activeError;
      if (active?.length) return json({ error: "There is already an active challenge between these players" }, 409);

      const { data, error } = await supabase
        .from("player_challenges")
        .insert({
          challenger_account_id: user.id,
          challenger_player_id: me.player_id,
          challenged_account_id: target.id,
          challenged_player_id: targetPlayerId,
          platform,
          target_url: targetUrl,
          status: "pending",
          challenger_seen_status: "pending",
          challenged_seen_status: null,
        })
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "respond") {
      const id = String(body?.id || "").trim();
      const decision = String(body?.decision || "").trim().toLowerCase();
      if (!id || !["accept", "decline"].includes(decision)) {
        return json({ error: "Invalid challenge response" }, 400);
      }

      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (challenge.challenged_account_id !== user.id) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "pending") return json({ error: "Challenge is no longer pending" }, 409);

      const nextStatus = decision === "accept" ? "accepted" : "declined";
      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          status: nextStatus,
          responded_at: new Date().toISOString(),
          challenged_seen_status: nextStatus,
          challenger_seen_status: null,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "report-result") {
      const id = String(body?.id || "").trim();
      const winnerPlayerId = String(body?.winnerPlayerId || "").trim();
      const challenge = await getChallenge(id);

      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "accepted") return json({ error: "Challenge is not ready for a result" }, 409);

      const validWinners = [challenge.challenger_player_id, challenge.challenged_player_id];
      if (!validWinners.includes(winnerPlayerId)) return json({ error: "Invalid winner" }, 400);

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          status: "result_pending",
          reported_winner_player_id: winnerPlayerId,
          reporter_account_id: user.id,
          result_reported_at: new Date().toISOString(),
          challenger_seen_status: challenge.challenger_account_id === user.id ? "result_pending" : null,
          challenged_seen_status: challenge.challenged_account_id === user.id ? "result_pending" : null,
        })
        .eq("id", id)
        .eq("status", "accepted")
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "verify-result") {
      const id = String(body?.id || "").trim();
      const decision = String(body?.decision || "").trim().toLowerCase();
      if (!["confirm", "dispute"].includes(decision)) {
        return json({ error: "Invalid verification decision" }, 400);
      }

      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "result_pending") return json({ error: "No result is awaiting verification" }, 409);
      if (challenge.reporter_account_id === user.id) {
        return json({ error: "The other player must verify the result" }, 403);
      }

      const nextStatus = decision === "confirm" ? "completed" : "disputed";
      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          status: nextStatus,
          verifier_account_id: user.id,
          verified_at: decision === "confirm" ? new Date().toISOString() : null,
          dispute_note: decision === "dispute" ? String(body?.note || "").trim().slice(0, 240) || "Result disputed" : null,
          challenger_seen_status: challenge.challenger_account_id === user.id ? nextStatus : null,
          challenged_seen_status: challenge.challenged_account_id === user.id ? nextStatus : null,
        })
        .eq("id", id)
        .eq("status", "result_pending")
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "mark-seen") {
      const id = String(body?.id || "").trim();
      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);

      const field =
        challenge.challenger_account_id === user.id
          ? "challenger_seen_status"
          : "challenged_seen_status";

      const { data, error } = await supabase
        .from("player_challenges")
        .update({ [field]: challenge.status })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "cancel") {
      const id = String(body?.id || "").trim();
      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (challenge.challenger_account_id !== user.id) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "pending") return json({ error: "Only pending challenges can be cancelled" }, 409);

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          status: "cancelled",
          challenger_seen_status: "cancelled",
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
