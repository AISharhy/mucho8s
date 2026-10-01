import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-admin-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
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
    const action = String(body?.action || "").trim();

    if (action === "update-player") {
      const playerId = String(body?.playerId || "").trim();
      const draft = body?.draft && typeof body.draft === "object" ? body.draft : null;
      if (!playerId || !draft) {
        return json({ error: "Player id and draft are required" }, 400);
      }

      const { data: state, error: stateError } = await supabase
        .from("app_state")
        .select("players,matches")
        .eq("id", "main")
        .maybeSingle();

      if (stateError) throw stateError;
      const players = Array.isArray(state?.players) ? state.players.map((player: any) => ({ ...player })) : [];
      const matches = Array.isArray(state?.matches) ? state.matches : [];
      const player = players.find((item: any) => String(item?.id || "") === playerId);
      if (!player) return json({ error: "Player not found" }, 404);

      const cleanName = String(draft?.name || player?.name || "").trim();
      if (!cleanName) return json({ error: "Nickname cannot be empty" }, 400);

      const currentElo = Math.max(500, Math.round(Number(draft?.currentElo ?? player?.currentElo ?? 500)));
      const existingHistory = Array.isArray(player?.eloHistory) && player.eloHistory.length
        ? player.eloHistory.map((row: any) => ({ ...row }))
        : [{ match: 0, elo: currentElo }];
      const startingElo = Math.max(
        500,
        Math.round(Number(draft?.startingElo ?? existingHistory?.[0]?.elo ?? currentElo)),
      );
      const peakElo = Math.max(
        currentElo,
        Math.round(Number(draft?.peakElo ?? player?.peakElo ?? currentElo)),
      );
      const wins = Math.max(0, Math.round(Number(draft?.wins ?? player?.wins ?? 0)));
      const losses = Math.max(0, Math.round(Number(draft?.losses ?? player?.losses ?? 0)));
      const avgPlacement = Math.max(0, Number(draft?.avgPlacement ?? player?.avgPlacement ?? 0));
      const currentStreak = Math.trunc(Number(draft?.currentStreak ?? player?.currentStreak ?? 0));
      const mvpCount = Math.max(0, Math.round(Number(draft?.mvpCount ?? player?.mvpCount ?? 0)));
      const merdaCount = Math.max(0, Math.round(Number(draft?.merdaCount ?? player?.merdaCount ?? 0)));

      existingHistory[0] = { ...existingHistory[0], match: 0, elo: startingElo };
      const lastHistoryElo = Number(existingHistory[existingHistory.length - 1]?.elo);
      if (lastHistoryElo !== currentElo) {
        existingHistory.push({ match: wins + losses, elo: currentElo });
      }

      const currentWins = Math.max(0, Math.round(Number(player?.wins || 0)));
      const currentLosses = Math.max(0, Math.round(Number(player?.losses || 0)));
      const existingAdjustments =
        player?.manualStatAdjustments && typeof player.manualStatAdjustments === "object"
          ? player.manualStatAdjustments
          : {};
      const manualWins = Math.round(Number(existingAdjustments?.wins || 0)) + (wins - currentWins);
      const manualLosses = Math.round(Number(existingAdjustments?.losses || 0)) + (losses - currentLosses);

      Object.assign(player, {
        name: cleanName,
        currentElo,
        peakElo,
        wins,
        losses,
        totalMatches: wins + losses,
        avgPlacement,
        currentStreak,
        mvpCount,
        merdaCount,
        eloHistory: existingHistory,
        manualStatAdjustments: {
          ...existingAdjustments,
          wins: manualWins,
          losses: manualLosses,
        },
      });

      const version = Date.now();
      const { error: updateError } = await supabase
        .from("app_state")
        .update({
          players,
          version,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "main");

      if (updateError) throw updateError;
      return json({ ok: true, player, version });
    }

    if (!Array.isArray(body.players) || !Array.isArray(body.matches)) {
      return json({ error: "Invalid state payload" }, 400);
    }

    const { data: currentState, error: currentStateError } = await supabase
      .from("app_state")
      .select("players,matches")
      .eq("id", "main")
      .maybeSingle();
    if (currentStateError) throw currentStateError;

    const currentPlayers = Array.isArray(currentState?.players) ? currentState.players : [];
    const currentMatches = Array.isArray(currentState?.matches) ? currentState.matches : [];
    const currentById = new Map(
      currentPlayers
        .filter((player: any) => player?.id)
        .map((player: any) => [String(player.id), player])
    );

    const matchesUnchanged =
      JSON.stringify(body.matches) === JSON.stringify(currentMatches);

    const mergedPlayers = body.players.map((incoming: any) => {
      const id = String(incoming?.id || "");
      const current = currentById.get(id);
      if (!current) return incoming;

      const existingAdjustments =
        current?.manualStatAdjustments && typeof current.manualStatAdjustments === "object"
          ? current.manualStatAdjustments
          : {};
      const next = {
        ...incoming,
        manualStatAdjustments: {
          ...existingAdjustments,
          ...(incoming?.manualStatAdjustments && typeof incoming.manualStatAdjustments === "object"
            ? incoming.manualStatAdjustments
            : {}),
        },
      };

      // Older frontends submit the whole state when an Admin edits one player.
      // Convert the visible W/L delta into a durable adjustment so future match
      // replays do not erase the correction.
      if (matchesUnchanged) {
        const currentWins = Math.max(0, Math.round(Number(current?.wins || 0)));
        const currentLosses = Math.max(0, Math.round(Number(current?.losses || 0)));
        const nextWins = Math.max(0, Math.round(Number(incoming?.wins || 0)));
        const nextLosses = Math.max(0, Math.round(Number(incoming?.losses || 0)));
        next.manualStatAdjustments = {
          ...next.manualStatAdjustments,
          wins: Math.round(Number(existingAdjustments?.wins || 0)) + (nextWins - currentWins),
          losses: Math.round(Number(existingAdjustments?.losses || 0)) + (nextLosses - currentLosses),
        };
      }

      return next;
    });

    const version = Date.now();
    const updatedAt = new Date().toISOString();

    if (matchesUnchanged) {
      const { error } = await supabase
        .from("app_state")
        .update({
          players: mergedPlayers,
          version,
          updated_at: updatedAt,
        })
        .eq("id", "main");
      if (error) throw error;
      return json({ ok: true, version });
    }

    const { error } = await supabase
      .from("app_state")
      .upsert({
        id: "main",
        players: mergedPlayers,
        matches: body.matches,
        version,
        updated_at: updatedAt,
      });

    if (error) throw error;

    return json({ ok: true, version });
  } catch (error) {
    console.error(error);
    return json({ error: "Cloud database update failed" }, 500);
  }
});
