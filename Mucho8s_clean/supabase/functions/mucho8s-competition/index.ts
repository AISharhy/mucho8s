import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-admin-session",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

const isAdmin = async (req: Request, supabase: any) => {
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

const resetPlayer = (player: any) => {
  const elo = 500;
  return {
    ...player,
    currentElo: elo,
    peakElo: elo,
    totalMatches: 0,
    wins: 0,
    losses: 0,
    avgPlacement: 0,
    last10: [],
    currentStreak: 0,
    mvpCount: 0,
    merdaCount: 0,
    eloHistory: [{ match: 0, elo }],
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);

    if (req.method === "GET") {
      const [{ data: config, error: configError }, { data: archives, error: archiveError }] = await Promise.all([
        supabase
          .from("competition_config")
          .select("season_number,season_name,season_started_at,updated_at")
          .eq("id", "main")
          .maybeSingle(),
        supabase
          .from("season_archives")
          .select("season_number,season_name,started_at,ended_at,players,matches,challenge_stats")
          .order("season_number", { ascending: false })
          .limit(20),
      ]);

      if (configError) throw configError;
      if (archiveError) throw archiveError;

      return json({
        ok: true,
        current: config || { season_number: 1, season_name: "Season 1" },
        archives: archives || [],
      });
    }

    if (!(await isAdmin(req, supabase))) return json({ error: "Admin session expired or invalid" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "repair-elo") {
      const [{ data: config, error: configError }, { data: state, error: stateError }] = await Promise.all([
        supabase
          .from("competition_config")
          .select("season_number,season_started_at")
          .eq("id", "main")
          .maybeSingle(),
        supabase
          .from("app_state")
          .select("players,matches")
          .eq("id", "main")
          .maybeSingle(),
      ]);

      if (configError) throw configError;
      if (stateError) throw stateError;

      const currentSeason = Number(config?.season_number ?? 1);
      const seasonStartedAt = new Date(config?.season_started_at || 0).getTime();
      const players = Array.isArray(state?.players) ? state.players : [];
      const matches = Array.isArray(state?.matches) ? state.matches : [];

      const [{ data: auditRows, error: auditError }, { data: challengeRows, error: challengeError }, { data: eloEvents, error: eloError }] = await Promise.all([
        supabase
          .from("admin_audit_log")
          .select("action,entity_id,details,created_at")
          .in("action", ["player.update", "player.add", "player.elo_repair", "player.elo_checkpoint"])
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("player_challenges")
          .select("id,season_number,verified_at")
          .eq("season_number", currentSeason)
          .not("verified_at", "is", null)
          .limit(2000),
        supabase
          .from("challenge_elo_events")
          .select("challenge_id,winner_player_id,loser_player_id,winner_delta,loser_delta,updated_at")
          .limit(2000),
      ]);

      if (auditError) throw auditError;
      if (challengeError) throw challengeError;
      if (eloError) throw eloError;

      const playerIds = new Set(players.map((player: any) => String(player?.id || "")).filter(Boolean));
      const baselines = new Map<string, { elo: number; at: number }>();

      for (const row of auditRows || []) {
        const id = String(row?.entity_id || "");
        if (!playerIds.has(id) || baselines.has(id)) continue;

        const at = new Date(row?.created_at || 0).getTime();
        if (!Number.isFinite(at) || at < seasonStartedAt) continue;

        const rawElo = row?.details?.to_elo ?? row?.details?.elo;
        const elo = Number(rawElo);
        if (!Number.isFinite(elo)) continue;

        baselines.set(id, { elo: Math.max(500, Math.round(elo)), at });
      }

      const challengeById = new Map(
        (challengeRows || []).map((row: any) => [String(row.id), row])
      );

      const nextPlayers = players.map((player: any) => {
        const id = String(player?.id || "");
        const baseline = baselines.get(id) || { elo: 500, at: seasonStartedAt };
        const events: Array<{ at: number; order: number; delta: number }> = [];

        for (const match of matches) {
          const teamA = Array.isArray(match?.teamA) ? match.teamA.map(String) : [];
          const teamB = Array.isArray(match?.teamB) ? match.teamB.map(String) : [];
          if (!teamA.includes(id) && !teamB.includes(id)) continue;

          const at = new Date(match?.date || 0).getTime();
          const delta = Number(match?.eloChanges?.[id] ?? 0);
          if (!Number.isFinite(at) || at <= baseline.at || !Number.isFinite(delta) || delta === 0) continue;
          events.push({ at, order: 0, delta });
        }

        for (const event of eloEvents || []) {
          const challenge = challengeById.get(String(event?.challenge_id || ""));
          if (!challenge) continue;

          const at = new Date(challenge?.verified_at || event?.updated_at || 0).getTime();
          if (!Number.isFinite(at) || at <= baseline.at) continue;

          let delta = 0;
          if (String(event?.winner_player_id || "") === id) delta = Number(event?.winner_delta || 0);
          else if (String(event?.loser_player_id || "") === id) delta = Number(event?.loser_delta || 0);
          if (!Number.isFinite(delta) || delta === 0) continue;

          events.push({ at, order: 1, delta });
        }

        events.sort((a, b) => a.at - b.at || a.order - b.order);

        let repairedElo = baseline.elo;
        for (const event of events) repairedElo = Math.max(500, repairedElo + event.delta);
        repairedElo = Math.round(repairedElo);

        const oldElo = Math.round(Number(player?.currentElo) || 500);
        const history = Array.isArray(player?.eloHistory) && player.eloHistory.length
          ? [...player.eloHistory]
          : [{ match: Number(player?.totalMatches || 0), elo: repairedElo }];

        history[history.length - 1] = {
          ...history[history.length - 1],
          elo: repairedElo,
        };

        return {
          ...player,
          currentElo: repairedElo,
          peakElo: Math.max(Number(player?.peakElo) || repairedElo, repairedElo),
          eloHistory: history,
          __repair: { oldElo, repairedElo },
        };
      });

      const changed = nextPlayers
        .filter((player: any) => player.__repair.oldElo !== player.__repair.repairedElo)
        .map((player: any) => ({
          id: player.id,
          name: player.name,
          from: player.__repair.oldElo,
          to: player.__repair.repairedElo,
        }));

      const persistedPlayers = nextPlayers.map(({ __repair, ...player }: any) => player);
      const now = new Date().toISOString();

      const { error: updateStateError } = await supabase
        .from("app_state")
        .update({
          players: persistedPlayers,
          version: Date.now(),
          updated_at: now,
        })
        .eq("id", "main");

      if (updateStateError) throw updateStateError;

      if (persistedPlayers.length) {
        const checkpoints = persistedPlayers.map((player: any) => ({
          action: "player.elo_checkpoint",
          entity_type: "player",
          entity_id: String(player.id),
          details: {
            name: player.name,
            elo: Number(player.currentElo || 500),
            source: "repair-elo",
            season_number: currentSeason,
          },
          created_at: now,
        }));
        const { error: checkpointError } = await supabase.from("admin_audit_log").insert(checkpoints);
        if (checkpointError) throw checkpointError;
      }

      return json({
        ok: true,
        checked: persistedPlayers.length,
        changed,
      });
    }

    if (action !== "new-season") return json({ error: "Unknown action" }, 400);

    const { data: config, error: configError } = await supabase
      .from("competition_config")
      .select("*")
      .eq("id", "main")
      .maybeSingle();

    if (configError) throw configError;
    const currentSeason = Number(config?.season_number ?? 1);
    const currentName = String(config?.season_name || (currentSeason === 0 ? "Pre-Season" : `Season ${currentSeason}`));

    const { data: state, error: stateError } = await supabase
      .from("app_state")
      .select("players,matches")
      .eq("id", "main")
      .maybeSingle();

    if (stateError) throw stateError;

    const players = Array.isArray(state?.players) ? state.players : [];
    const matches = Array.isArray(state?.matches) ? state.matches : [];

    const { data: challengeRows, error: challengeError } = await supabase
      .from("player_challenges")
      .select("amount_cents,payment_received_at,reported_winner_player_id,status")
      .eq("season_number", currentSeason);

    if (challengeError) throw challengeError;

    const completed = (challengeRows || []).filter((row: any) => row.status === "completed");
    const settled = completed.filter((row: any) => row.payment_received_at);
    const volumeCents = settled.reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0);

    const { error: archiveError } = await supabase
      .from("season_archives")
      .upsert({
        season_number: currentSeason,
        season_name: currentName,
        started_at: config?.season_started_at || null,
        ended_at: new Date().toISOString(),
        players,
        matches,
        challenge_stats: {
          completed: completed.length,
          settled: settled.length,
          volume_cents: volumeCents,
        },
      }, { onConflict: "season_number" });

    if (archiveError) throw archiveError;

    const nextSeason = currentSeason + 1;
    const nextName = String(body?.seasonName || `Season ${nextSeason}`).trim().slice(0, 60) || `Season ${nextSeason}`;
    const resetStats = body?.resetStats !== false;

    if (resetStats) {
      const nextPlayers = players.map(resetPlayer);
      const { error: stateUpdateError } = await supabase
        .from("app_state")
        .update({
          players: nextPlayers,
          matches: [],
          version: Date.now(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", "main");

      if (stateUpdateError) throw stateUpdateError;
    }

    const now = new Date().toISOString();
    const { data: updatedConfig, error: updateError } = await supabase
      .from("competition_config")
      .update({
        season_number: nextSeason,
        season_name: nextName,
        season_started_at: now,
        updated_at: now,
      })
      .eq("id", "main")
      .select("*")
      .single();

    if (updateError) throw updateError;

    await supabase.from("admin_audit_log").insert({
      action: "season.start",
      entity_type: "season",
      entity_id: String(nextSeason),
      details: {
        previous_season: currentSeason,
        previous_name: currentName,
        reset_stats: resetStats,
      },
    });

    return json({ ok: true, current: updatedConfig });
  } catch (error) {
    console.error(error);
    return json({ error: "Competition service failed" }, 500);
  }
});
