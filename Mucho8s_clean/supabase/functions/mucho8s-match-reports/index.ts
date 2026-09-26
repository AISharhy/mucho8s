import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-admin-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const BASE_ELO = 1000;
const MIN_ELO = 500;
const WIN_DELTA = 25;
const LOSS_DELTA = 25;
const MVP_BONUS = 3;

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

  return true;
};

const getUserContext = async (req: Request, supabase: any) => {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, account: null };

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user || null;
  if (authError || !user) return { user: null, account: null };

  const { data: account, error } = await supabase
    .from("player_accounts")
    .select("id,player_id,display_name,discord_username")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return { user, account: account || null };
};

const normalizePlayer = (player: any) => {
  const current = Math.max(MIN_ELO, Math.round(Number(player?.currentElo) || BASE_ELO));
  return {
    ...player,
    id: String(player?.id || ""),
    name: String(player?.name || "Unknown"),
    currentElo: current,
    peakElo: Math.max(current, Math.round(Number(player?.peakElo) || current)),
    totalMatches: Math.max(0, Number(player?.totalMatches) || 0),
    wins: Math.max(0, Number(player?.wins) || 0),
    losses: Math.max(0, Number(player?.losses) || 0),
    last10: Array.isArray(player?.last10) ? player.last10.slice(0, 10) : [],
    currentStreak: Number(player?.currentStreak) || 0,
    mvpCount: Math.max(0, Number(player?.mvpCount) || 0),
    merdaCount: Math.max(0, Number(player?.merdaCount) || 0),
    eloHistory: Array.isArray(player?.eloHistory) && player.eloHistory.length
      ? player.eloHistory
      : [{ match: 0, elo: current }],
  };
};

const automaticMvpIds = (byId: Record<string, any>, winners: string[]) =>
  winners.filter((id) => {
    const current = Number(byId[id]?.currentStreak || 0);
    const nextWinStreak = current > 0 ? current + 1 : 1;
    return nextWinStreak >= 4 && nextWinStreak % 4 === 0;
  });

const automaticMerdaIds = (byId: Record<string, any>, losers: string[]) =>
  losers.filter((id) => {
    const current = Number(byId[id]?.currentStreak || 0);
    const nextLossStreak = current < 0 ? Math.abs(current) + 1 : 1;
    return nextLossStreak >= 4 && nextLossStreak % 4 === 0;
  });

const automaticMerdaClearedIds = (byId: Record<string, any>, winners: string[]) =>
  winners.filter((id) => {
    const player = byId[id];
    if (!player || Number(player.merdaCount || 0) <= 0) return false;
    const current = Number(player.currentStreak || 0);
    const nextWinStreak = current > 0 ? current + 1 : 1;
    return nextWinStreak >= 4 && nextWinStreak % 4 === 0;
  });

const applyEffects = (
  byId: Record<string, any>,
  teamA: string[],
  teamB: string[],
  winner: string,
  mvpIds: string[] = [],
  merdaIds: string[] = [],
  merdaClearedIds: string[] = [],
) => {
  const winners = winner === "A" ? teamA : teamB;
  const mvpSet = new Set(mvpIds);
  const merdaSet = new Set(merdaIds);
  const clearedSet = new Set(merdaClearedIds);
  const changes: Record<string, number> = {};

  [...teamA, ...teamB].forEach((id) => {
    const player = byId[id];
    if (!player) return;

    const won = winners.includes(id);
    let delta = won ? WIN_DELTA : -LOSS_DELTA;
    if (mvpSet.has(id)) delta += MVP_BONUS;

    const nextElo = Math.max(MIN_ELO, Number(player.currentElo || BASE_ELO) + delta);
    player.currentElo = nextElo;
    player.peakElo = Math.max(Number(player.peakElo || nextElo), nextElo);
    player.totalMatches = Math.max(0, Number(player.totalMatches || 0)) + 1;
    if (won) player.wins = Math.max(0, Number(player.wins || 0)) + 1;
    else player.losses = Math.max(0, Number(player.losses || 0)) + 1;
    if (mvpSet.has(id)) player.mvpCount = Math.max(0, Number(player.mvpCount || 0)) + 1;
    if (merdaSet.has(id)) player.merdaCount = Math.max(0, Number(player.merdaCount || 0)) + 1;
    if (clearedSet.has(id)) player.merdaCount = Math.max(0, Number(player.merdaCount || 0) - 1);
    player.eloHistory = [
      ...(Array.isArray(player.eloHistory) ? player.eloHistory : []),
      { match: player.totalMatches, elo: nextElo },
    ];
    changes[id] = delta;
  });

  return changes;
};

const recomputeRecent = (byId: Record<string, any>, matches: any[], ids: string[]) => {
  ids.forEach((id) => {
    const player = byId[id];
    if (!player) return;

    const involved = matches
      .filter((match) => (match.teamA || []).includes(id) || (match.teamB || []).includes(id))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const results = involved.map((match) => {
      const winners = match.winner === "A" ? match.teamA : match.teamB;
      return winners.includes(id) ? "W" : "L";
    });

    player.last10 = results.slice(0, 10);
    let streak = 0;
    for (const result of results) {
      if (streak === 0) streak = result === "W" ? 1 : -1;
      else if (streak > 0 && result === "W") streak += 1;
      else if (streak < 0 && result === "L") streak -= 1;
      else break;
    }
    player.currentStreak = streak;
  });
};

const recomputeAwardState = (byId: Record<string, any>, matches: any[]) => {
  const rebuiltMatches = (matches || []).map((match) => ({ ...match }));

  Object.values(byId).forEach((player: any) => {
    if (!player) return;
    player.mvpCount = 0;
    player.merdaCount = 0;
    player.currentStreak = 0;
  });

  [...rebuiltMatches]
    .sort((a, b) => {
      const dateDiff = new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime();
      if (dateDiff !== 0) return dateDiff;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    })
    .forEach((match) => {
      const teamA = Array.isArray(match?.teamA) ? match.teamA.map(String) : [];
      const teamB = Array.isArray(match?.teamB) ? match.teamB.map(String) : [];
      const winners = match?.winner === "B" ? teamB : teamA;
      const winnerSet = new Set(winners);
      const mvpIds: string[] = [];
      const merdaIds: string[] = [];
      const merdaClearedIds: string[] = [];

      [...teamA, ...teamB].forEach((id) => {
        const player = byId[id];
        if (!player) return;

        const won = winnerSet.has(id);
        const current = Number(player.currentStreak || 0);
        const nextStreak = won
          ? (current > 0 ? current + 1 : 1)
          : (current < 0 ? current - 1 : -1);

        player.currentStreak = nextStreak;

        if (won && nextStreak >= 4 && nextStreak % 4 === 0) {
          player.mvpCount = Math.max(0, Number(player.mvpCount || 0)) + 1;
          mvpIds.push(id);
        }

        if (!won && Math.abs(nextStreak) >= 4 && Math.abs(nextStreak) % 4 === 0) {
          player.merdaCount = Math.max(0, Number(player.merdaCount || 0)) + 1;
          merdaIds.push(id);
        }

        if (won && nextStreak >= 4 && nextStreak % 4 === 0 && Number(player.merdaCount || 0) > 0) {
          player.merdaCount = Math.max(0, Number(player.merdaCount || 0) - 1);
          merdaClearedIds.push(id);
        }
      });

      const mvpSet = new Set(mvpIds);
      const nextChanges: Record<string, number> = {};

      [...teamA, ...teamB].forEach((id) => {
        const player = byId[id];
        if (!player) return;

        const won = winnerSet.has(id);
        const nextDelta = (won ? WIN_DELTA : -LOSS_DELTA) + (mvpSet.has(id) ? MVP_BONUS : 0);
        const oldDelta = Number(match?.eloChanges?.[id]);

        if (Number.isFinite(oldDelta) && oldDelta !== 0 && oldDelta !== nextDelta) {
          player.currentElo = Math.max(
            MIN_ELO,
            Number(player.currentElo || BASE_ELO) + (nextDelta - oldDelta),
          );
        }

        nextChanges[id] = nextDelta;
      });

      match.mvpIds = mvpIds;
      match.mvpId = mvpIds[0] || undefined;
      match.merdaIds = merdaIds;
      match.merdaId = merdaIds[0] || undefined;
      match.merdaClearedIds = merdaClearedIds;
      match.eloChanges = nextChanges;
    });

  Object.values(byId).forEach((player: any) => {
    if (!player) return;
    player.peakElo = Math.max(
      Number(player.peakElo || BASE_ELO),
      Number(player.currentElo || BASE_ELO),
    );
    if (Array.isArray(player.eloHistory) && player.eloHistory.length) {
      const lastIndex = player.eloHistory.length - 1;
      player.eloHistory = player.eloHistory.map((row: any, index: number) =>
        index === lastIndex ? { ...row, elo: player.currentElo } : row
      );
    }
  });

  return rebuiltMatches;
};

const getCurrentSeason = async (supabase: any) => {
  const { data } = await supabase
    .from("competition_config")
    .select("season_number")
    .eq("id", "main")
    .maybeSingle();
  return Math.max(1, Number(data?.season_number) || 1);
};

const PLATFORM_COLUMNS: Record<string, string> = {
  paypal: "paypal_url",
  revolut: "revolut_url",
  cmg: "cmg_url",
};

const SUPPORTED_MATCH_PLATFORMS = new Set(["paypal", "revolut"]);

const syncMoneyPairings = async (
  supabase: any,
  report: any,
  verifiedAt: string,
  suppressNotifications = false,
) => {
  const raw = Array.isArray(report.pairings) ? report.pairings : [];
  const pairings = raw
    .map((pair: any) => ({
      playerAId: String(pair?.playerAId || "").trim(),
      playerBId: String(pair?.playerBId || "").trim(),
      amount: Number(pair?.amount),
      platform: String(pair?.platform || "cmg").trim().toLowerCase(),
    }))
    .filter((pair: any) =>
      pair.playerAId &&
      pair.playerBId &&
      pair.playerAId !== pair.playerBId &&
      PLATFORM_COLUMNS[pair.platform] &&
      Number.isFinite(pair.amount) &&
      pair.amount > 0
    );

  if (!pairings.length) return [];

  const ids = [...new Set(pairings.flatMap((pair: any) => [pair.playerAId, pair.playerBId]))];
  const { data: accounts, error: accountError } = await supabase
    .from("player_accounts")
    .select("id,player_id,paypal_url,revolut_url,cmg_url")
    .in("player_id", ids);

  if (accountError) throw accountError;
  const accountByPlayer = Object.fromEntries((accounts || []).map((row: any) => [String(row.player_id), row]));
  const synced: any[] = [];

  for (const pair of pairings) {
    const pairingKey = `${pair.playerAId}:${pair.playerBId}`;
    const challenger = accountByPlayer[pair.playerAId] || null;
    const challenged = accountByPlayer[pair.playerBId] || null;
    const linkColumn = PLATFORM_COLUMNS[pair.platform];
    const challengerUrl = String(challenger?.[linkColumn] || "");
    const challengedUrl = String(challenged?.[linkColumn] || "");
    const winnerPlayerId = report.winner === "A" ? pair.playerAId : pair.playerBId;

    const payload: Record<string, unknown> = {
      challenger_account_id: challenger?.id || null,
      challenger_player_id: pair.playerAId,
      challenged_account_id: challenged?.id || null,
      challenged_player_id: pair.playerBId,
      platform: pair.platform,
      target_url: challengedUrl,
      challenger_payout_url: challengerUrl || null,
      challenged_payout_url: challengedUrl || null,
      amount_cents: Math.round(pair.amount * 100),
      currency: "EUR",
      status: "completed",
      source: "match_pairing",
      match_id: report.match_id,
      pairing_key: pairingKey,
      season_number: report.season_number,
      reported_winner_player_id: winnerPlayerId,
      result_reported_at: verifiedAt,
      verified_at: verifiedAt,
      payment_sent_at: null,
      payment_received_at: null,
      payout_disputed_at: null,
      payout_dispute_note: null,
      payout_dispute_resolved_at: null,
      payout_dispute_resolution: null,
      last_event: suppressNotifications ? "admin_sync" : "match_pairing_verified",
      challenger_seen_status: suppressNotifications ? "completed" : null,
      challenged_seen_status: suppressNotifications ? "completed" : null,
      challenger_seen_event: suppressNotifications ? "admin_sync" : null,
      challenged_seen_event: suppressNotifications ? "admin_sync" : null,
    };

    const { data: existing, error: existingError } = await supabase
      .from("player_challenges")
      .select("id")
      .eq("source", "match_pairing")
      .eq("match_id", report.match_id)
      .eq("pairing_key", pairingKey)
      .maybeSingle();

    if (existingError) throw existingError;

    let current = existing || null;

    if (!current?.id) {
      const { data: activePairings, error: activePairingError } = await supabase
        .from("player_challenges")
        .select("id")
        .eq("source", "balancer_pairing")
        .eq("challenger_player_id", pair.playerAId)
        .eq("challenged_player_id", pair.playerBId)
        .in("status", ["pending", "accepted", "result_pending"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (activePairingError) throw activePairingError;
      current = activePairings?.[0] || null;
    }

    if (current?.id) {
      const { data, error } = await supabase
        .from("player_challenges")
        .update(payload)
        .eq("id", current.id)
        .select("*")
        .single();
      if (error) throw error;
      const { error: eloError } = await supabase.rpc("sync_challenge_elo", {
        p_challenge_id: data.id,
      });
      if (eloError) throw eloError;
      synced.push(data);
    } else {
      const { data, error } = await supabase
        .from("player_challenges")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      const { error: eloError } = await supabase.rpc("sync_challenge_elo", {
        p_challenge_id: data.id,
      });
      if (eloError) throw eloError;
      synced.push(data);
    }
  }

  return synced;
};

const finalizeReport = async (supabase: any, report: any, verifierAccountId: string | null, verifierPlayerId: string | null) => {
  if (report.status === "completed") return report;

  const { data: state, error: stateError } = await supabase
    .from("app_state")
    .select("players,matches,version")
    .eq("id", "main")
    .single();

  if (stateError) throw stateError;

  const existingMatches = Array.isArray(state?.matches) ? state.matches : [];
  const alreadyExists = existingMatches.some((match: any) => String(match?.id) === String(report.match_id));

  const verifiedAt = new Date().toISOString();
  let awardedMvpIds: string[] = [];
  let awardedMerdaIds: string[] = [];

  if (alreadyExists) {
    const storedMatch = existingMatches.find(
      (match: any) => String(match?.id) === String(report.match_id)
    );
    awardedMvpIds = Array.isArray(storedMatch?.mvpIds)
      ? storedMatch.mvpIds.map(String)
      : (storedMatch?.mvpId ? [String(storedMatch.mvpId)] : []);
    awardedMerdaIds = Array.isArray(storedMatch?.merdaIds)
      ? storedMatch.merdaIds.map(String)
      : (storedMatch?.merdaId ? [String(storedMatch.merdaId)] : []);
  }

  if (!alreadyExists) {
    const players = (Array.isArray(state?.players) ? state.players : []).map(normalizePlayer);
    const byId = Object.fromEntries(players.map((player: any) => [String(player.id), player]));
    const teamA = Array.isArray(report.team_a) ? report.team_a.map(String) : [];
    const teamB = Array.isArray(report.team_b) ? report.team_b.map(String) : [];

    const missing = [...teamA, ...teamB].filter((id) => !byId[id]);
    if (missing.length) throw new Error("One or more players in this report no longer exist");

    const winners = report.winner === "A" ? teamA : teamB;
    const losers = report.winner === "A" ? teamB : teamA;
    const mvpIds = automaticMvpIds(byId, winners);
    const merdaIds = automaticMerdaIds(byId, losers);
    const merdaClearedIds = automaticMerdaClearedIds(byId, winners);
    awardedMvpIds = mvpIds;
    awardedMerdaIds = merdaIds;
    const eloChanges = applyEffects(
      byId,
      teamA,
      teamB,
      report.winner,
      mvpIds,
      merdaIds,
      merdaClearedIds,
    );

    const match = {
      id: report.match_id,
      date: report.played_at || report.created_at || verifiedAt,
      teamA,
      teamB,
      winner: report.winner,
      scoreA: Number(report.score_a || 0),
      scoreB: Number(report.score_b || 0),
      mvpIds,
      mvpId: mvpIds[0] || undefined,
      merdaIds,
      merdaId: merdaIds[0] || undefined,
      merdaClearedIds,
      map: report.map || "",
      mode: report.mode || "",
      game: report.game || "",
      pairings: Array.isArray(report.pairings) ? report.pairings : [],
      season: Math.max(1, Number(report.season_number) || 1),
      eloChanges,
      resultStatus: "locked",
      locked: true,
      verifiedAt,
      captainAPlayerId: report.captain_a_player_id,
      captainBPlayerId: report.captain_b_player_id,
      reportId: report.id,
    };

    let nextMatches = [match, ...existingMatches];
    nextMatches = recomputeAwardState(byId, nextMatches);
    recomputeRecent(byId, nextMatches, [...teamA, ...teamB]);

    const finalizedMatch = nextMatches.find(
      (item: any) => String(item?.id) === String(report.match_id)
    );
    awardedMvpIds = Array.isArray(finalizedMatch?.mvpIds)
      ? finalizedMatch.mvpIds.map(String)
      : (finalizedMatch?.mvpId ? [String(finalizedMatch.mvpId)] : []);
    awardedMerdaIds = Array.isArray(finalizedMatch?.merdaIds)
      ? finalizedMatch.merdaIds.map(String)
      : (finalizedMatch?.merdaId ? [String(finalizedMatch.merdaId)] : []);

    const { error: updateError } = await supabase
      .from("app_state")
      .update({
        players: Object.values(byId),
        matches: nextMatches,
        version: Date.now(),
        updated_at: verifiedAt,
      })
      .eq("id", "main");

    if (updateError) throw updateError;

    await syncMoneyPairings(
      supabase,
      report,
      verifiedAt,
      verifierAccountId === null && verifierPlayerId === null,
    );
  }

  const { data: completed, error: completeError } = await supabase
    .from("team_match_reports")
    .update({
      status: "completed",
      verifier_account_id: verifierAccountId,
      verifier_player_id: verifierPlayerId,
      verified_at: verifiedAt,
      locked_at: verifiedAt,
      mvp_id: awardedMvpIds[0] || null,
      mvp_ids: awardedMvpIds,
      merda_id: awardedMerdaIds[0] || null,
      dispute_note: null,
    })
    .eq("id", report.id)
    .select("*")
    .single();

  if (completeError) throw completeError;

  await supabase.from("admin_audit_log").insert({
    action: "match.result_locked",
    entity_type: "match",
    entity_id: report.match_id,
    details: {
      report_id: report.id,
      winner: report.winner,
      score_a: report.score_a,
      score_b: report.score_b,
      verifier_player_id: verifierPlayerId,
    },
  });

  return completed;
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
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();
    const isAdmin = await validateAdminSession(req, supabase);
    const { user, account } = await getUserContext(req, supabase);

    if (action === "list-live") {
      const { data, error } = await supabase
        .from("live_team_matches")
        .select("id,match_id,team_a,team_b,game,mode,format,captain_player_id,status,created_at")
        .eq("status", "live")
        .order("created_at", { ascending: false })
        .limit(12);

      if (error) throw error;
      return json({ ok: true, liveMatches: data || [] });
    }

    if (action === "create-live") {
      if (!isAdmin && !account?.player_id) {
        return json({ error: "Login with a linked Discord account first" }, 401);
      }

      const teamA = Array.isArray(body?.teamA) ? body.teamA.map((id: unknown) => String(id)) : [];
      const teamB = Array.isArray(body?.teamB) ? body.teamB.map((id: unknown) => String(id)) : [];
      const creatorPlayerId = String(account?.player_id || "").trim();
      const creatorInLobby = [...teamA, ...teamB].includes(creatorPlayerId);

      if (teamA.length < 2 || teamA.length > 4 || teamA.length !== teamB.length) {
        return json({ error: "Teams must contain the same number of players (2-4)" }, 400);
      }
      if (!isAdmin && !creatorInLobby) {
        return json({ error: "The match creator must be one of the players in the lobby" }, 403);
      }

      if (user?.id) {
        await supabase
          .from("live_team_matches")
          .update({ status: "cancelled", closed_at: new Date().toISOString() })
          .eq("creator_account_id", user.id)
          .eq("status", "live");
      }

      const row = {
        match_id: crypto.randomUUID(),
        team_a: teamA,
        team_b: teamB,
        game: String(body?.game || ""),
        mode: String(body?.mode || ""),
        format: String(body?.format || ""),
        captain_player_id: creatorPlayerId || null,
        creator_account_id: user?.id || null,
        status: "live",
      };

      const { data, error } = await supabase
        .from("live_team_matches")
        .insert(row)
        .select("*")
        .single();

      if (error) throw error;

      return json({ ok: true, liveMatch: data });
    }

    if (action === "cancel-live") {
      const liveId = String(body?.id || "").trim();
      if (!liveId) return json({ error: "Live match id is required" }, 400);

      const { data: liveMatch, error: liveError } = await supabase
        .from("live_team_matches")
        .select("*")
        .eq("id", liveId)
        .maybeSingle();

      if (liveError) throw liveError;
      if (!liveMatch) return json({ ok: true });

      if (!isAdmin && (!user?.id || liveMatch.creator_account_id !== user.id)) {
        return json({ error: "Only the match creator or Admin can close this live match" }, 403);
      }

      const { error } = await supabase
        .from("live_team_matches")
        .update({ status: "cancelled", closed_at: new Date().toISOString() })
        .eq("id", liveId)
        .eq("status", "live");

      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "list") {
      let query = supabase
        .from("team_match_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);

      const { data, error } = await query;
      if (error) throw error;

      if (!isAdmin) {
        if (!account?.player_id) return json({ ok: true, reports: [] });
        const playerId = String(account.player_id);
        const visible = (data || []).filter((report: any) =>
          (Array.isArray(report?.team_a) && report.team_a.map(String).includes(playerId)) ||
          (Array.isArray(report?.team_b) && report.team_b.map(String).includes(playerId))
        );
        return json({ ok: true, reports: visible });
      }

      return json({ ok: true, reports: data || [] });
    }

    if (action === "create") {
      if (!isAdmin && !account?.player_id) return json({ error: "Login with a linked Discord account first" }, 401);

      const teamA = Array.isArray(body?.teamA) ? body.teamA.map((id: unknown) => String(id)) : [];
      const teamB = Array.isArray(body?.teamB) ? body.teamB.map((id: unknown) => String(id)) : [];
      const winner = String(body?.winner || "").toUpperCase();
      const reporterPlayerId = String(account?.player_id || "").trim();
      const reporterOnA = reporterPlayerId && teamA.includes(reporterPlayerId);
      const reporterOnB = reporterPlayerId && teamB.includes(reporterPlayerId);
      const captainA = reporterOnA
        ? reporterPlayerId
        : String(body?.captainAPlayerId || teamA[0] || "").trim();
      const captainB = reporterOnB
        ? reporterPlayerId
        : String(body?.captainBPlayerId || teamB[0] || "").trim();
      const scoreA = Math.max(0, Number(body?.scoreA) || 0);
      const scoreB = Math.max(0, Number(body?.scoreB) || 0);
      const pairings = (Array.isArray(body?.pairings) ? body.pairings : []).map((pair: any) => ({
        playerAId: String(pair?.playerAId || "").trim(),
        playerBId: String(pair?.playerBId || "").trim(),
        amount: Number(pair?.amount),
        platform: String(pair?.platform || "").trim().toLowerCase(),
      }));

      if (teamA.length < 2 || teamA.length > 4 || teamA.length !== teamB.length) {
        return json({ error: "Teams must contain the same number of players (2-4)" }, 400);
      }
      if (!["A", "B"].includes(winner)) return json({ error: "Winner is required" }, 400);
      if (!teamA.includes(captainA) || !teamB.includes(captainB)) {
        return json({ error: "The report could not assign the verification sides" }, 400);
      }
      if (!isAdmin && !reporterOnA && !reporterOnB) {
        return json({ error: "The match creator must be one of the players in the lobby" }, 403);
      }
      if (pairings.length !== teamA.length) {
        return json({ error: "Every player matchup needs a money amount" }, 400);
      }
      const seenA = new Set<string>();
      const seenB = new Set<string>();
      for (const pair of pairings) {
        const validPlayers = teamA.includes(pair.playerAId) && teamB.includes(pair.playerBId);
        const validAmount = Number.isFinite(pair.amount) && pair.amount > 0;
        const validPlatform = SUPPORTED_MATCH_PLATFORMS.has(pair.platform);
        if (!validPlayers || !validAmount || !validPlatform) {
          return json({ error: "Each matchup must use a valid amount with PayPal or Revolut" }, 400);
        }
        if (seenA.has(pair.playerAId) || seenB.has(pair.playerBId)) {
          return json({ error: "Each player can appear only once in the money matchups" }, 400);
        }
        seenA.add(pair.playerAId);
        seenB.add(pair.playerBId);
      }
      if (scoreA === scoreB && (scoreA > 0 || scoreB > 0)) {
        return json({ error: "A verified match cannot end in a draw" }, 400);
      }
      if (scoreA !== scoreB) {
        const scoreWinner = scoreA > scoreB ? "A" : "B";
        if (scoreWinner !== winner) return json({ error: "Winner does not match the score" }, 400);
      }

      const liveMatchId = String(body?.liveMatchId || "").trim();
      let liveMatch: any = null;

      if (liveMatchId) {
        const { data: liveRow, error: liveError } = await supabase
          .from("live_team_matches")
          .select("*")
          .eq("id", liveMatchId)
          .maybeSingle();

        if (liveError) throw liveError;
        if (!liveRow || liveRow.status !== "live") {
          return json({ error: "This live match is no longer active" }, 409);
        }
        if (!isAdmin && (!user?.id || liveRow.creator_account_id !== user.id)) {
          return json({ error: "Only the match creator or Admin can report this live match" }, 403);
        }

        const sameA = JSON.stringify((liveRow.team_a || []).map(String)) === JSON.stringify(teamA);
        const sameB = JSON.stringify((liveRow.team_b || []).map(String)) === JSON.stringify(teamB);
        if (!sameA || !sameB) {
          return json({ error: "The reported teams do not match the live match" }, 400);
        }

        liveMatch = liveRow;
      }

      const seasonNumber = Math.max(1, Number(body?.seasonNumber) || await getCurrentSeason(supabase));
      const playedAt = body?.playedAt && !Number.isNaN(new Date(body.playedAt).getTime())
        ? new Date(body.playedAt).toISOString()
        : new Date().toISOString();

      const row = {
        match_id: liveMatch?.match_id || crypto.randomUUID(),
        team_a: teamA,
        team_b: teamB,
        winner,
        score_a: Math.round(scoreA),
        score_b: Math.round(scoreB),
        mvp_id: null,
        mvp_ids: [],
        merda_id: null,
        game: String(body?.game || ""),
        mode: String(body?.mode || ""),
        map: String(body?.map || ""),
        pairings,
        season_number: seasonNumber,
        captain_a_player_id: captainA,
        captain_b_player_id: captainB,
        reporter_account_id: user?.id || null,
        reporter_player_id: account?.player_id || null,
        reporter_is_admin: isAdmin,
        status: "pending",
        played_at: playedAt,
      };

      const { data, error } = await supabase
        .from("team_match_reports")
        .insert(row)
        .select("*")
        .single();

      if (error) throw error;

      if (liveMatch?.id) {
        await supabase
          .from("live_team_matches")
          .update({ status: "closed", closed_at: new Date().toISOString() })
          .eq("id", liveMatch.id)
          .eq("status", "live");
      }

      await supabase.from("admin_audit_log").insert({
        action: "match.result_reported",
        entity_type: "match_report",
        entity_id: data.id,
        details: {
          match_id: data.match_id,
          winner: data.winner,
          captain_a: captainA,
          captain_b: captainB,
          reporter_player_id: account?.player_id || null,
          reporter_is_admin: isAdmin,
        },
      });

      return json({ ok: true, report: data });
    }

    const id = String(body?.id || "").trim();
    if (!id) return json({ error: "Report id is required" }, 400);

    const { data: report, error: reportError } = await supabase
      .from("team_match_reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (reportError) throw reportError;
    if (!report) return json({ error: "Match report not found" }, 404);

    if (action === "confirm") {
      if (!isAdmin) return json({ error: "Only Admin can confirm match results" }, 403);
      if (report.status !== "pending") return json({ error: "This result is no longer awaiting confirmation" }, 409);

      const completed = await finalizeReport(supabase, report, user?.id || null, null);
      return json({ ok: true, report: completed, locked: true });
    }

    if (action === "dispute") {
      if (!account?.player_id) return json({ error: "Login with a linked Discord account first" }, 401);
      if (report.status !== "pending") return json({ error: "This result is no longer awaiting confirmation" }, 409);

      const teamA = Array.isArray(report.team_a) ? report.team_a.map(String) : [];
      const teamB = Array.isArray(report.team_b) ? report.team_b.map(String) : [];
      const reporterId = String(report.reporter_player_id || "");
      const eligible = report.reporter_is_admin
        ? [...teamA, ...teamB]
        : teamA.includes(reporterId)
          ? teamB
          : teamB.includes(reporterId)
            ? teamA
            : [];

      if (!eligible.includes(String(account.player_id))) {
        return json({ error: "A player from the opposite team must review this result" }, 403);
      }

      const note = String(body?.note || "").trim().slice(0, 240);
      if (!note) return json({ error: "Explain why the result is disputed" }, 400);

      const { data, error } = await supabase
        .from("team_match_reports")
        .update({
          status: "disputed",
          verifier_account_id: user?.id || null,
          verifier_player_id: String(account.player_id),
          dispute_note: note,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, report: data });
    }

    if (action === "admin-resolve") {
      if (!isAdmin) return json({ error: "Admin access required" }, 403);
      if (!["pending", "disputed"].includes(report.status)) {
        return json({ error: "This report is already locked or cancelled" }, 409);
      }

      const decision = String(body?.decision || "").toLowerCase();
      if (decision === "confirm") {
        const completed = await finalizeReport(supabase, report, null, null);
        return json({ ok: true, report: completed, locked: true });
      }
      if (decision === "cancel") {
        const { data, error } = await supabase
          .from("team_match_reports")
          .update({ status: "cancelled" })
          .eq("id", id)
          .select("*")
          .single();
        if (error) throw error;
        return json({ ok: true, report: data });
      }
      return json({ error: "Invalid admin decision" }, 400);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: String(error).replace(/^Error:\s*/, "") }, 500);
  }
});
