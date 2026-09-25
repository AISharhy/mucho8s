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

const PLATFORM_COLUMNS: Record<string, string> = {
  paypal: "paypal_url",
  revolut: "revolut_url",
  cmg: "cmg_url",
};

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const isAdminRequest = async (req: Request, supabase: any) => {
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

    const writeAudit = async (action: string, entityId: string | null, details: Record<string, unknown> = {}) => {
      const { error } = await supabase.from("admin_audit_log").insert({
        action,
        entity_type: "challenge",
        entity_id: entityId,
        details,
      });
      if (error) console.error("audit log failed", error);
    };

    const body = await req.json();
    const action = String(body?.action || "");
    const adminRequest = await isAdminRequest(req, supabase);

    if (adminRequest && action === "admin-list") {
      const { data, error } = await supabase
        .from("player_challenges")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return json({ ok: true, challenges: data || [] });
    }

    if (adminRequest && action === "admin-create-pairings") {
      const rawPairings = Array.isArray(body?.pairings) ? body.pairings : [];
      if (!rawPairings.length) return json({ error: "No pairings supplied" }, 400);
      if (rawPairings.length > 8) return json({ error: "Too many pairings" }, 400);

      const pairings = rawPairings.map((pair: any) => ({
        challengerPlayerId: String(pair?.challengerPlayerId || "").trim(),
        challengedPlayerId: String(pair?.challengedPlayerId || "").trim(),
        platform: String(pair?.platform || "").trim().toLowerCase(),
        amount: Number(pair?.amount),
      }));

      const seenPlayers = new Set<string>();
      for (const pair of pairings) {
        if (!pair.challengerPlayerId || !pair.challengedPlayerId || pair.challengerPlayerId === pair.challengedPlayerId) {
          return json({ error: "Invalid pairing" }, 400);
        }
        if (!PLATFORM_COLUMNS[pair.platform]) return json({ error: "Invalid challenge platform" }, 400);
        if (!Number.isFinite(pair.amount) || pair.amount <= 0) return json({ error: "Every pairing needs a valid amount" }, 400);
        if (seenPlayers.has(pair.challengerPlayerId) || seenPlayers.has(pair.challengedPlayerId)) {
          return json({ error: "A player can appear only once in a pairing set" }, 400);
        }
        seenPlayers.add(pair.challengerPlayerId);
        seenPlayers.add(pair.challengedPlayerId);
      }

      const playerIds = [...seenPlayers];
      const { data: accounts, error: accountError } = await supabase
        .from("player_accounts")
        .select("id,player_id,paypal_url,revolut_url,cmg_url")
        .in("player_id", playerIds);

      if (accountError) throw accountError;

      const accountByPlayer = Object.fromEntries(
        (accounts || []).map((account: any) => [String(account.player_id), account])
      );

      for (const playerId of playerIds) {
        if (!accountByPlayer[playerId]) {
          return json({ error: `Player ${playerId} has not linked Discord yet`, playerId }, 409);
        }
      }

      const rows: any[] = [];

      for (const pair of pairings) {
        const challenger = accountByPlayer[pair.challengerPlayerId];
        const challenged = accountByPlayer[pair.challengedPlayerId];
        const column = PLATFORM_COLUMNS[pair.platform];
        const challengerUrl = String(challenger?.[column] || "").trim();
        const challengedUrl = String(challenged?.[column] || "").trim();

        if (!challengerUrl || !challengedUrl) {
          const missingPlayerId = !challengerUrl ? pair.challengerPlayerId : pair.challengedPlayerId;
          return json({
            error: `Player ${missingPlayerId} has not configured ${pair.platform.toUpperCase()}`,
            playerId: missingPlayerId,
          }, 409);
        }

        const { data: active, error: activeError } = await supabase
          .from("player_challenges")
          .select("id")
          .or(
            `and(challenger_player_id.eq.${pair.challengerPlayerId},challenged_player_id.eq.${pair.challengedPlayerId}),and(challenger_player_id.eq.${pair.challengedPlayerId},challenged_player_id.eq.${pair.challengerPlayerId})`
          )
          .in("status", ["pending", "accepted", "result_pending"])
          .limit(1);

        if (activeError) throw activeError;
        if (active?.length) {
          return json({ error: "There is already an active challenge between one of the selected pairs" }, 409);
        }

        rows.push({
          challenger_account_id: challenger.id,
          challenger_player_id: pair.challengerPlayerId,
          challenged_account_id: challenged.id,
          challenged_player_id: pair.challengedPlayerId,
          platform: pair.platform,
          target_url: challengedUrl,
          challenger_payout_url: challengerUrl,
          challenged_payout_url: challengedUrl,
          amount_cents: Math.round(pair.amount * 100),
          currency: "EUR",
          status: "pending",
          challenger_seen_status: null,
          challenged_seen_status: null,
          last_event: "pairing_assigned",
          challenger_seen_event: null,
          challenged_seen_event: null,
        });
      }

      const { data: created, error: insertError } = await supabase
        .from("player_challenges")
        .insert(rows)
        .select("*");

      if (insertError) throw insertError;

      await writeAudit("challenge.pairings_created", null, {
        count: created?.length || 0,
        player_ids: playerIds,
      });

      return json({ ok: true, challenges: created || [] });
    }

    if (adminRequest && action === "admin-update") {
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "Challenge id is required" }, 400);

      const current = await (async () => {
        const { data, error } = await supabase
          .from("player_challenges")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        return data;
      })();

      if (!current) return json({ error: "Challenge not found" }, 404);

      const updates: Record<string, unknown> = {};
      const allowedStatuses = ["pending","accepted","declined","result_pending","completed","disputed","cancelled"];

      if (body?.status !== undefined) {
        const status = String(body.status);
        if (!allowedStatuses.includes(status)) return json({ error: "Invalid status" }, 400);
        updates.status = status;
        if (status === "accepted" || status === "declined") updates.responded_at = new Date().toISOString();
        if (status === "completed") updates.verified_at = new Date().toISOString();
      }

      if (body?.amount !== undefined) {
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount < 0) return json({ error: "Invalid amount" }, 400);
        updates.amount_cents = Math.round(amount * 100);
      }

      if (body?.paymentSent !== undefined) {
        updates.payment_sent_at = body.paymentSent ? new Date().toISOString() : null;
      }

      if (body?.paymentReceived !== undefined) {
        updates.payment_received_at = body.paymentReceived ? new Date().toISOString() : null;
      }

      if (body?.winnerPlayerId !== undefined) {
        const winner = String(body.winnerPlayerId || "").trim();
        if (winner && ![current.challenger_player_id, current.challenged_player_id].includes(winner)) {
          return json({ error: "Winner must be one of the challenge players" }, 400);
        }
        updates.reported_winner_player_id = winner || null;
        if (winner) {
          updates.reporter_account_id = null;
          updates.result_reported_at = new Date().toISOString();
        }
      }

      if (body?.disputeNote !== undefined) {
        updates.dispute_note = String(body.disputeNote || "").trim().slice(0, 240) || null;
      }

      if (body?.payoutResolution !== undefined) {
        const resolution = String(body.payoutResolution || "").trim().toLowerCase();
        if (!["received", "reopen"].includes(resolution)) {
          return json({ error: "Invalid payout dispute resolution" }, 400);
        }
        updates.payout_dispute_resolved_at = new Date().toISOString();
        updates.payout_dispute_resolution = resolution;
        if (resolution === "received") {
          updates.payment_received_at = new Date().toISOString();
          updates.last_event = "payout_received";
        } else {
          updates.payment_sent_at = null;
          updates.payment_received_at = null;
          updates.last_event = "payout_reopened";
        }
      }

      updates.challenger_seen_status = null;
      updates.challenged_seen_status = null;
      if (body?.payoutResolution === undefined) updates.last_event = "admin_update";
      updates.challenger_seen_event = null;
      updates.challenged_seen_event = null;

      const { data, error } = await supabase
        .from("player_challenges")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      await writeAudit("challenge.update", id, {
        status: data.status,
        amount_cents: data.amount_cents,
        winner_player_id: data.reported_winner_player_id,
        payment_sent: Boolean(data.payment_sent_at),
        payment_received: Boolean(data.payment_received_at),
      });
      return json({ ok: true, challenge: data });
    }

    if (adminRequest && action === "admin-delete") {
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "Challenge id is required" }, 400);
      const { error } = await supabase.from("player_challenges").delete().eq("id", id);
      if (error) throw error;
      await writeAudit("challenge.delete", id, {});
      return json({ ok: true });
    }

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Login with Discord first" }, 401);

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    const user = authData?.user;
    if (authError || !user) return json({ error: "Invalid session" }, 401);

    const { data: me, error: meError } = await supabase
      .from("player_accounts")
      .select("id,player_id,display_name,discord_username,paypal_url,revolut_url,cmg_url")
      .eq("id", user.id)
      .maybeSingle();

    if (meError) throw meError;
    if (!me?.player_id) return json({ error: "Your Discord account is not linked to a player yet" }, 409);

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
      const amount = Number(body?.amount);
      const amountCents = Math.round(amount * 100);

      if (!targetPlayerId || !linkColumn) {
        return json({ error: "Invalid challenge target or platform" }, 400);
      }
      if (!Number.isFinite(amount) || amount <= 0 || amountCents <= 0) {
        return json({ error: "Enter a valid challenge amount" }, 400);
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
      const challengerUrl = String(me[linkColumn] || "").trim();
      if (!targetUrl) return json({ error: "This player has not configured that challenge method" }, 409);
      if (!challengerUrl) return json({ error: `Configure your ${platform.toUpperCase()} link before sending this challenge` }, 409);

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
          challenger_payout_url: challengerUrl,
          challenged_payout_url: targetUrl,
          amount_cents: amountCents,
          currency: "EUR",
          status: "pending",
          challenger_seen_status: "pending",
          challenged_seen_status: null,
          last_event: "created",
          challenger_seen_event: "created",
          challenged_seen_event: null,
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
          last_event: nextStatus,
          challenged_seen_event: nextStatus,
          challenger_seen_event: null,
        })
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "payment-sent") {
      const id = String(body?.id || "").trim();
      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "completed") return json({ error: "The result must be verified before payout" }, 409);
      if (!challenge.reported_winner_player_id) return json({ error: "Winner is missing" }, 409);
      if (me.player_id === challenge.reported_winner_player_id) {
        return json({ error: "Only the losing player can mark the payout as sent" }, 403);
      }

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          payment_sent_at: new Date().toISOString(),
          payment_received_at: null,
          last_event: "payout_sent",
          challenger_seen_event: challenge.challenger_account_id === user.id ? "payout_sent" : null,
          challenged_seen_event: challenge.challenged_account_id === user.id ? "payout_sent" : null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "payment-received") {
      const id = String(body?.id || "").trim();
      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "completed") return json({ error: "The result must be verified before payout" }, 409);
      if (me.player_id !== challenge.reported_winner_player_id) {
        return json({ error: "Only the winning player can confirm the payout" }, 403);
      }
      if (!challenge.payment_sent_at) return json({ error: "The losing player has not marked the payout as sent yet" }, 409);

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          payment_received_at: new Date().toISOString(),
          last_event: "payout_received",
          challenger_seen_event: challenge.challenger_account_id === user.id ? "payout_received" : null,
          challenged_seen_event: challenge.challenged_account_id === user.id ? "payout_received" : null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      return json({ ok: true, challenge: data });
    }

    if (action === "payout-dispute") {
      const id = String(body?.id || "").trim();
      const note = String(body?.note || "").trim().slice(0, 240);
      const challenge = await getChallenge(id);
      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "completed") return json({ error: "The result must be verified first" }, 409);
      if (me.player_id !== challenge.reported_winner_player_id) return json({ error: "Only the winner can dispute a missing payout" }, 403);
      if (!challenge.payment_sent_at) return json({ error: "The losing player has not marked the payout as sent yet" }, 409);
      if (challenge.payment_received_at) return json({ error: "This payout is already confirmed as received" }, 409);
      if (!note) return json({ error: "Add a short reason for the payout dispute" }, 400);
      if (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at) return json({ error: "A payout dispute is already open" }, 409);

      const event = "payout_disputed";
      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          payout_disputed_at: new Date().toISOString(),
          payout_dispute_note: note,
          payout_dispute_resolved_at: null,
          payout_dispute_resolution: null,
          last_event: event,
          challenger_seen_event: challenge.challenger_account_id === user.id ? event : null,
          challenged_seen_event: challenge.challenged_account_id === user.id ? event : null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;
      await writeAudit("challenge.payout_dispute", id, { winner_player_id: challenge.reported_winner_player_id, amount_cents: challenge.amount_cents, note });
      return json({ ok: true, challenge: data });
    }

    if (action === "set-ready") {
      const id = String(body?.id || "").trim();
      const ready = body?.ready !== false;
      const challenge = await getChallenge(id);

      if (!challenge) return json({ error: "Challenge not found" }, 404);
      if (!isParticipant(challenge)) return json({ error: "Not allowed" }, 403);
      if (challenge.status !== "accepted") return json({ error: "Challenge must be accepted first" }, 409);
      if (!challenge.payment_received_at) return json({ error: "Payment must be confirmed before Ready" }, 409);

      const field =
        challenge.challenger_account_id === user.id
          ? "challenger_ready_at"
          : "challenged_ready_at";

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          [field]: ready ? new Date().toISOString() : null,
          last_event: ready
            ? (challenge.challenger_account_id === user.id ? "challenger_ready" : "challenged_ready")
            : "ready_removed",
          challenger_seen_event:
            challenge.challenger_account_id === user.id
              ? (ready ? "challenger_ready" : "ready_removed")
              : null,
          challenged_seen_event:
            challenge.challenged_account_id === user.id
              ? (ready ? "challenged_ready" : "ready_removed")
              : null,
        })
        .eq("id", id)
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
          last_event: "result_reported",
          challenger_seen_event: challenge.challenger_account_id === user.id ? "result_reported" : null,
          challenged_seen_event: challenge.challenged_account_id === user.id ? "result_reported" : null,
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
          payment_sent_at: decision === "confirm" ? null : challenge.payment_sent_at,
          payment_received_at: decision === "confirm" ? null : challenge.payment_received_at,
          dispute_note: decision === "dispute" ? String(body?.note || "").trim().slice(0, 240) || "Result disputed" : null,
          challenger_seen_status: challenge.challenger_account_id === user.id ? nextStatus : null,
          challenged_seen_status: challenge.challenged_account_id === user.id ? nextStatus : null,
          last_event: nextStatus,
          challenger_seen_event: challenge.challenger_account_id === user.id ? nextStatus : null,
          challenged_seen_event: challenge.challenged_account_id === user.id ? nextStatus : null,
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
      const eventField =
        challenge.challenger_account_id === user.id
          ? "challenger_seen_event"
          : "challenged_seen_event";

      const { data, error } = await supabase
        .from("player_challenges")
        .update({
          [field]: challenge.status,
          [eventField]: challenge.last_event || challenge.status,
        })
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
          last_event: "cancelled",
          challenger_seen_event: "cancelled",
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
