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

const cleanPlayerName = (value: unknown) => {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2) throw new Error("Name must be at least 2 characters");
  if (name.length > 20) throw new Error("Name must be 20 characters or less");
  if (!/^[\p{L}\p{N}_.\- ]+$/u.test(name)) {
    throw new Error("Use only letters, numbers, spaces, dot, dash or underscore");
  }
  return name;
};

const accountSelect = "id,discord_id,discord_username,display_name,avatar_url,player_id,paypal_url,revolut_url,cmg_url,twitch_channel,requested_player_name,player_request_status,player_request_requested_at,player_request_reviewed_at,player_request_reviewed_by,created_at,updated_at";

const cleanPaymentLink = (value: unknown, provider: "paypal" | "revolut") => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.length > 500) throw new Error("Link is too long");

  let candidate = raw.replace(/^@+/, "").trim();
  if (!candidate) return null;

  if (!/^https?:\/\//i.test(candidate)) {
    if (candidate.includes("/")) {
      candidate = `https://${candidate.replace(/^\/+/, "")}`;
    } else {
      const host = provider === "paypal" ? "paypal.me" : "revolut.me";
      candidate = `https://${host}/${candidate}`;
    }
  }

  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http/https links are allowed");
  }
  return url.toString();
};

const cleanTwitchChannel = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  let channel = raw.replace(/^@+/, "").trim();
  if (/^https?:\/\//i.test(channel)) {
    const url = new URL(channel);
    if (!/(^|\.)twitch\.tv$/i.test(url.hostname)) {
      throw new Error("Use a valid twitch.tv channel");
    }
    channel = url.pathname.split("/").filter(Boolean)[0] || "";
  } else {
    channel = channel
      .replace(/^(?:www\.)?twitch\.tv\//i, "")
      .split(/[/?#]/)[0];
  }

  channel = channel.trim();
  if (!/^[A-Za-z0-9_]{2,25}$/.test(channel)) {
    throw new Error("Enter a valid Twitch username");
  }
  return channel.toLowerCase();
};

const attachPlayerCompetitionRows = async (
  supabase: any,
  accountId: string,
  playerId: string,
) => {
  if (!accountId || !playerId) return;

  const updates = [
    supabase
      .from("player_challenges")
      .update({ challenger_account_id: accountId })
      .eq("challenger_player_id", playerId)
      .is("challenger_account_id", null),
    supabase
      .from("player_challenges")
      .update({ challenged_account_id: accountId })
      .eq("challenged_player_id", playerId)
      .is("challenged_account_id", null),
    supabase
      .from("challenge_series")
      .update({ player_a_account_id: accountId })
      .eq("player_a_player_id", playerId)
      .is("player_a_account_id", null),
    supabase
      .from("challenge_series")
      .update({ player_b_account_id: accountId })
      .eq("player_b_player_id", playerId)
      .is("player_b_account_id", null),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result: any) => result?.error);
  if (failed?.error) throw failed.error;
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

    if (action === "sync" || action === "me" || action === "update-links" || action === "submit-player-request" || action === "twitch-status") {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return json({ error: "Missing session" }, 401);

      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      const user = authData?.user;
      if (authError || !user) return json({ error: "Invalid session" }, 401);

      const meta = metadataFromUser(user);

      const { data: existing, error: existingError } = await supabase
        .from("player_accounts")
        .select("player_id,twitch_channel")
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

      if (action === "submit-player-request") {
        if (existing?.player_id) {
          return json({ error: "This Discord account is already linked to a player" }, 409);
        }

        let requestedName = "";
        try {
          requestedName = cleanPlayerName(body?.name);
        } catch (error) {
          return json({ error: String(error).replace(/^Error:\s*/, "") }, 400);
        }

        const { data: state, error: stateError } = await supabase
          .from("app_state")
          .select("players")
          .eq("id", "main")
          .maybeSingle();
        if (stateError) throw stateError;

        const players = Array.isArray(state?.players) ? state.players : [];
        const duplicatePlayer = players.some(
          (player: any) => String(player?.name || "").trim().toLowerCase() === requestedName.toLowerCase()
        );
        if (duplicatePlayer) {
          return json({ error: "That player name is already in use" }, 409);
        }

        const { data: duplicateRequest, error: duplicateRequestError } = await supabase
          .from("player_accounts")
          .select("id")
          .ilike("requested_player_name", requestedName)
          .eq("player_request_status", "pending")
          .neq("id", user.id)
          .limit(1)
          .maybeSingle();
        if (duplicateRequestError) throw duplicateRequestError;
        if (duplicateRequest) {
          return json({ error: "That player name already has a pending request" }, 409);
        }

        const now = new Date().toISOString();
        const { error: requestError } = await supabase
          .from("player_accounts")
          .update({
            requested_player_name: requestedName,
            player_request_status: "pending",
            player_request_requested_at: now,
            player_request_reviewed_at: null,
            player_request_reviewed_by: null,
            updated_at: now,
          })
          .eq("id", user.id);
        if (requestError) throw requestError;
      }

      if (action === "twitch-status") {
        let twitchChannel = "";
        try {
          twitchChannel = cleanTwitchChannel(body?.twitchChannel || existing?.twitch_channel) || "";
        } catch {
          twitchChannel = "";
        }

        if (!twitchChannel) {
          return json({ ok: true, channel: "", live: false, checkedAt: new Date().toISOString() });
        }

        let live = false;
        let statusText = "";
        try {
          const statusResponse = await fetch(
            `https://decapi.me/twitch/uptime/${encodeURIComponent(twitchChannel)}`,
            {
              headers: {
                "User-Agent": "Mucho8s/1.0",
                "Accept": "text/plain",
              },
            },
          );
          statusText = (await statusResponse.text()).trim();
          const normalized = statusText.toLowerCase();
          live = statusResponse.ok &&
            Boolean(statusText) &&
            !normalized.includes("offline") &&
            !normalized.includes("not live") &&
            !normalized.includes("does not exist") &&
            !normalized.includes("error");
        } catch {
          live = false;
        }

        return json({
          ok: true,
          channel: twitchChannel,
          live,
          statusText,
          checkedAt: new Date().toISOString(),
        });
      }

      if (action === "update-links") {
        if (!existing?.player_id) {
          return json({ error: "Discord account is not linked to a player yet" }, 409);
        }

        let paypalUrl = null;
        let revolutUrl = null;
        let twitchChannel = null;
        try {
          paypalUrl = cleanPaymentLink(body?.paypalUrl, "paypal");
          revolutUrl = cleanPaymentLink(body?.revolutUrl, "revolut");
          twitchChannel = cleanTwitchChannel(body?.twitchChannel);
        } catch (error) {
          return json({ error: String(error).replace(/^Error:\s*/, "") }, 400);
        }

        const { error: linkError } = await supabase
          .from("player_accounts")
          .update({
            paypal_url: paypalUrl,
            revolut_url: revolutUrl,
            cmg_url: null,
            twitch_channel: twitchChannel,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (linkError) throw linkError;

      }

      const { data: account, error: accountError } = await supabase
        .from("player_accounts")
        .select(accountSelect)
        .eq("id", user.id)
        .maybeSingle();
      if (accountError) throw accountError;

      if (account?.player_id) {
        await attachPlayerCompetitionRows(supabase, user.id, String(account.player_id));
        await supabase.from("player_presence").upsert({
          account_id: user.id,
          player_id: account.player_id,
          last_seen_at: new Date().toISOString(),
        });
      }

      return json({ ok: true, account, user: { id: user.id, email: user.email || null } });
    }

    if (!(await validateAdminSession(req, supabase))) return json({ error: "Admin session expired or invalid" }, 401);

    if (action === "admin-list") {
      const { data, error } = await supabase
        .from("player_accounts")
        .select(accountSelect)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return json({ ok: true, accounts: data || [] });
    }

    if (action === "admin-approve-request") {
      const accountId = String(body?.accountId || "").trim();
      if (!accountId) return json({ error: "Account is required" }, 400);

      const { data: account, error: accountError } = await supabase
        .from("player_accounts")
        .select(accountSelect)
        .eq("id", accountId)
        .maybeSingle();
      if (accountError) throw accountError;
      if (!account) return json({ error: "Discord account not found" }, 404);
      if (account.player_id) return json({ error: "Account is already linked" }, 409);
      if (account.player_request_status !== "pending" || !account.requested_player_name) {
        return json({ error: "There is no pending player request" }, 409);
      }

      const requestedName = cleanPlayerName(account.requested_player_name);

      const { data: state, error: stateError } = await supabase
        .from("app_state")
        .select("players,version")
        .eq("id", "main")
        .maybeSingle();
      if (stateError) throw stateError;
      if (!state) return json({ error: "Player state unavailable" }, 500);

      const players = Array.isArray(state.players) ? state.players : [];
      if (players.some((player: any) =>
        String(player?.name || "").trim().toLowerCase() === requestedName.toLowerCase()
      )) {
        return json({ error: "That player name is already in use" }, 409);
      }

      const { data: config } = await supabase
        .from("competition_config")
        .select("starting_elo")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startingElo = Math.max(500, Math.round(Number(config?.starting_elo || 500)));
      const playerId = crypto.randomUUID();
      const now = new Date().toISOString();
      const player = {
        id: playerId,
        name: requestedName,
        currentElo: startingElo,
        peakElo: startingElo,
        totalMatches: 0,
        wins: 0,
        losses: 0,
        avgPlacement: 0,
        last10: [],
        currentStreak: 0,
        mvpCount: 0,
        merdaCount: 0,
        eloHistory: [{ match: 0, elo: startingElo }],
        createdAt: now,
      };

      const { error: stateUpdateError } = await supabase
        .from("app_state")
        .update({
          players: [...players, player],
          version: Date.now(),
          updated_at: now,
        })
        .eq("id", "main");
      if (stateUpdateError) throw stateUpdateError;

      const { data: updatedAccount, error: linkError } = await supabase
        .from("player_accounts")
        .update({
          player_id: playerId,
          player_request_status: "approved",
          player_request_reviewed_at: now,
          player_request_reviewed_by: "admin",
          updated_at: now,
        })
        .eq("id", accountId)
        .select(accountSelect)
        .single();

      if (linkError) throw linkError;
      await attachPlayerCompetitionRows(supabase, accountId, playerId);
      return json({ ok: true, account: updatedAccount, player });
    }

    if (action === "admin-reject-request") {
      const accountId = String(body?.accountId || "").trim();
      if (!accountId) return json({ error: "Account is required" }, 400);

      const now = new Date().toISOString();
      const { data: updatedAccount, error } = await supabase
        .from("player_accounts")
        .update({
          player_request_status: "rejected",
          player_request_reviewed_at: now,
          player_request_reviewed_by: "admin",
          updated_at: now,
        })
        .eq("id", accountId)
        .eq("player_request_status", "pending")
        .select(accountSelect)
        .maybeSingle();

      if (error) throw error;
      if (!updatedAccount) return json({ error: "There is no pending player request" }, 409);
      return json({ ok: true, account: updatedAccount });
    }

    if (action === "admin-link") {
      const accountId = String(body?.accountId || "").trim();
      const playerIdRaw = body?.playerId;
      const playerId = playerIdRaw == null || String(playerIdRaw).trim() === ""
        ? null
        : String(playerIdRaw).trim();
      const transfer = Boolean(body?.transfer);

      if (!accountId) return json({ error: "Account is required" }, 400);

      let previousOwner: any = null;
      if (playerId) {
        const { data: existingOwner, error: ownerError } = await supabase
          .from("player_accounts")
          .select(accountSelect)
          .eq("player_id", playerId)
          .neq("id", accountId)
          .maybeSingle();
        if (ownerError) throw ownerError;

        if (existingOwner && !transfer) {
          return json(
            {
              error: "This player is already linked to another Discord account",
              linkedAccountId: existingOwner.id,
            },
            409,
          );
        }

        if (existingOwner && transfer) {
          previousOwner = existingOwner;
          const { error: unlinkError } = await supabase
            .from("player_accounts")
            .update({
              player_id: null,
              player_request_status: null,
              player_request_reviewed_at: new Date().toISOString(),
              player_request_reviewed_by: "admin-transfer",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingOwner.id);
          if (unlinkError) throw unlinkError;
        }
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("player_accounts")
        .update({
          player_id: playerId,
          player_request_status: playerId ? "approved" : null,
          player_request_reviewed_at: playerId ? now : null,
          player_request_reviewed_by: playerId ? "admin-link" : null,
          updated_at: now,
        })
        .eq("id", accountId)
        .select(accountSelect)
        .single();

      if (error) {
        // Best-effort rollback if a forced transfer had to unlink another account first.
        if (previousOwner?.id && previousOwner?.player_id) {
          await supabase
            .from("player_accounts")
            .update({
              player_id: previousOwner.player_id,
              player_request_status: previousOwner.player_request_status,
              player_request_reviewed_at: previousOwner.player_request_reviewed_at,
              player_request_reviewed_by: previousOwner.player_request_reviewed_by,
              updated_at: new Date().toISOString(),
            })
            .eq("id", previousOwner.id);
        }

        if (String(error?.code) === "23505") {
          return json({ error: "This player is already linked to another Discord account" }, 409);
        }
        throw error;
      }

      if (data?.player_id) {
        await attachPlayerCompetitionRows(supabase, String(data.id), String(data.player_id));
      }

      return json({
        ok: true,
        account: data,
        transferredFromAccountId: previousOwner?.id || null,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
