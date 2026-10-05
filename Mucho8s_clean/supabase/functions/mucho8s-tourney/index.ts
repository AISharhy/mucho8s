import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED = new Set([
  "https://aisharhy.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const cors = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.has(origin) ? origin : "https://aisharhy.github.io",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-admin-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json" },
  });

const enc = new TextEncoder();
const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
const sha = async (value: string) =>
  hex(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value))));

const validateAdmin = async (req: Request, supabase: any) => {
  const token = (req.headers.get("x-admin-session") || "").trim();
  if (!token) return null;
  const tokenHash = await sha(token);
  const uaHash = await sha(req.headers.get("user-agent") || "unknown");
  const { data: session, error } = await supabase.from("admin_sessions")
    .select("username,account_id,user_agent_hash,expires_at,revoked_at")
    .eq("token_hash", tokenHash).maybeSingle();
  if (error || !session || session.revoked_at) return null;
  const expiry = new Date(session.expires_at).getTime();
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  if (!session.account_id || session.user_agent_hash !== uaHash) return null;
  const { data: credential, error: credentialError } = await supabase.from("admin_credentials")
    .select("is_active,required_account_id").eq("username", session.username).maybeSingle();
  if (credentialError || !credential?.is_active ||
      credential.required_account_id !== session.account_id) return null;
  const { data: account, error: accountError } = await supabase.from("player_accounts")
    .select("player_id").eq("id", session.account_id).maybeSingle();
  if (accountError || !account?.player_id) return null;
  const { data: access, error: accessError } = await supabase.from("admin_access")
    .select("username,is_active").eq("player_id", account.player_id)
    .eq("is_active", true).maybeSingle();
  if (accessError || !access?.is_active || access.username !== session.username) return null;
  return session;
};

const validatePlayer = async (req: Request, supabase: any) => {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  const user = authData?.user;
  if (authError || !user) return null;

  const { data: account, error: accountError } = await supabase
    .from("player_accounts")
    .select("player_id,display_name,discord_username")
    .eq("id", user.id)
    .maybeSingle();

  if (accountError || !account?.player_id) return null;

  return {
    userId: user.id,
    playerId: String(account.player_id),
    name: String(account.display_name || account.discord_username || "Player"),
  };
};

const rosterSizeFor = (format: unknown) =>
  Math.max(1, Number(String(format || "4v4").split("v")[0]) || 4);

const randomInt = (max: number) => {
  if (max <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % max;
};

const shuffleRows = (rows: any[]) => {
  const next = [...rows];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

const teamLabels = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel"];

const makeSwitcherooTeams = (pool: any[], format: unknown, generation: number) => {
  const rosterSize = rosterSizeFor(format);
  const teamCount = pool.length / rosterSize;
  const shuffled = shuffleRows(pool);

  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: crypto.randomUUID(),
    name: `Team ${teamLabels[index] || index + 1}`,
    seed: index + 1,
    roster: [],
    switcherooGeneration: generation,
  }));

  shuffled.forEach((player, index) => {
    teams[index % teamCount].roster.push({ id: player.id, name: player.name });
  });

  return teams;
};

const makeBracket = (teamsInput: any[]) => {
  const size = teamsInput.length <= 2 ? 2 : teamsInput.length <= 4 ? 4 : 8;
  const seeded = [...teamsInput].slice(0, size);
  while (seeded.length < size) seeded.push(null);

  const order =
    size === 8
      ? [0, 7, 3, 4, 1, 6, 2, 5]
      : size === 4
        ? [0, 3, 1, 2]
        : [0, 1];

  const first: any[] = [];
  for (let index = 0; index < order.length; index += 2) {
    first.push({
      id: `r0m${index / 2}`,
      round: 0,
      a: seeded[order[index]],
      b: seeded[order[index + 1]],
      winner: null,
      scoreA: 0,
      scoreB: 0,
    });
  }

  const rounds: any[][] = [first];
  let count = first.length / 2;
  let round = 1;

  while (count >= 1) {
    rounds.push(
      Array.from({ length: count }, (_, matchIndex) => ({
        id: `r${round}m${matchIndex}`,
        round,
        a: null,
        b: null,
        winner: null,
        scoreA: 0,
        scoreB: 0,
      }))
    );
    count /= 2;
    round += 1;
  }

  return rounds;
};

const buildPayPalPaymentUrl = (rawValue: unknown, amount: number) => {
  const raw = String(rawValue || "").trim();
  if (!raw) throw new Error("Admin must configure the PayPal link first");

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid PayPal link");
  }

  if (url.protocol !== "https:") {
    throw new Error("PayPal link must use HTTPS");
  }

  const host = url.hostname.toLowerCase();
  const allowed =
    host === "paypal.me" ||
    host.endsWith(".paypal.me") ||
    host === "paypal.com" ||
    host.endsWith(".paypal.com");

  if (!allowed) throw new Error("Use a paypal.me or paypal.com link");

  if ((host === "paypal.me" || host.endsWith(".paypal.me")) && amount > 0) {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1) {
      url.pathname = `/${parts[0]}/${amount}`;
    }
  }

  return url.toString();
};

const roundUpToFive = (value: number) =>
  Math.max(5, Math.ceil(Math.max(0, value) / 5) * 5);

const switcherooEconomy = (entryFeeRaw: unknown, playerCountRaw: unknown) => {
  const entryFee = Math.max(0, Math.round(Number(entryFeeRaw || 0)));
  const playerCount = Math.max(0, Math.round(Number(playerCountRaw || 0)));
  const entryPot = entryFee * playerCount;
  const baseGoal = roundUpToFive(entryPot * 0.5);
  const firstMargin = roundUpToFive(baseGoal * 0.5);
  return {
    entryFee,
    entryPot,
    baseGoal,
    firstMargin,
    marginGrowth: 5,
  };
};

const normalizeExpiredReview = async (supabase: any, row: any) => {
  const state = row?.state && typeof row.state === "object" ? { ...row.state } : null;
  if (!state || state.status !== "review") return row;

  const endsAt = new Date(state?.switcheroo?.reviewEndsAt || 0).getTime();
  if (!endsAt || endsAt > Date.now()) return row;

  const currentSwitcheroo =
    state.switcheroo && typeof state.switcheroo === "object"
      ? { ...state.switcheroo }
      : {};
  const pendingPayments = Array.isArray(currentSwitcheroo.pendingPayments)
    ? currentSwitcheroo.pendingPayments
    : [];
  const expiredAt = new Date().toISOString();

  let teams = Array.isArray(state.teams) ? [...state.teams] : [];
  if (state.seeding === "random") teams = shuffleRows(teams);
  teams = teams.map((team: any, index: number) => ({ ...team, seed: index + 1 }));
  const bracket = teams.length >= 2 ? makeBracket(teams) : [];

  const nextState = {
    ...state,
    teams,
    bracket,
    champion: null,
    status: "live",
    switcheroo: {
      ...currentSwitcheroo,
      phase: "bracket",
      setupStage: "bracket",
      pendingPayments: [],
      liveDraw: null,
      expiredPayments: [
        ...(Array.isArray(currentSwitcheroo.expiredPayments)
          ? currentSwitcheroo.expiredPayments
          : []),
        ...pendingPayments.map((payment: any) => ({
          ...payment,
          expiredAt,
          status: "expired",
        })),
      ],
    },
  };

  const { data, error } = await supabase
    .from("tourney_state")
    .update({
      state: nextState,
      status: "live",
      updated_at: new Date().toISOString(),
      updated_by: "system:review-expired-bracket",
    })
    .eq("id", "current")
    .select("state,status,updated_at")
    .single();

  if (error) throw error;
  return data;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED.has(origin)) return json(req, { error: "Origin not allowed" }, 403);

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const key = keys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    if (!url || !key) throw new Error("Server credentials unavailable");

    const supabase = createClient(url, key);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "get") {
      const { data, error } = await supabase
        .from("tourney_state")
        .select("state,status,updated_at")
        .eq("id", "current")
        .single();
      if (error) throw error;
      const row = await normalizeExpiredReview(supabase, data);
      return json(req, {
        tourney: row?.state || null,
        status: row?.status,
        updatedAt: row?.updated_at,
      });
    }

    if (action === "save") {
      const admin = await validateAdmin(req, supabase);
      if (!admin) return json(req, { error: "Admin access required" }, 401);

      const state = body.state;
      if (!state || typeof state !== "object") {
        return json(req, { error: "Invalid tournament state" }, 400);
      }

      const allowedStatuses = ["setup", "review", "ready", "live", "completed"];
      const status = allowedStatuses.includes(String(state.status))
        ? String(state.status)
        : "setup";

      const { data, error } = await supabase
        .from("tourney_state")
        .upsert({
          id: "current",
          state,
          status,
          updated_at: new Date().toISOString(),
          updated_by: admin.username,
        })
        .select("state,status,updated_at")
        .single();

      if (error) throw error;
      return json(req, {
        ok: true,
        tourney: data.state,
        status: data.status,
        updatedAt: data.updated_at,
      });
    }

    if (action === "request-entry-payment") {
      const actor = await validatePlayer(req, supabase);
      if (!actor) {
        return json(req, { error: "A linked Discord player account is required" }, 401);
      }

      const { data: rawRow, error: stateError } = await supabase
        .from("tourney_state")
        .select("state,status,updated_at")
        .eq("id", "current")
        .single();

      if (stateError) throw stateError;
      const state = rawRow?.state && typeof rawRow.state === "object" ? rawRow.state : null;

      if (!state || state.status !== "setup") {
        return json(req, { error: "Tournament entry payments are not open" }, 409);
      }

      const switcheroo =
        state.switcheroo && typeof state.switcheroo === "object"
          ? { ...state.switcheroo }
          : {};
      const freeEntry = Boolean(switcheroo.freeEntry);

      if (
        switcheroo.setupStage !== "published" ||
        !["published", "idle"].includes(String(switcheroo.phase || "published"))
      ) {
        return json(req, { error: "Tournament registration is not open" }, 409);
      }

      const isSwitcheroo = state.teamBuild === "switcheroo";
      const registrationMode =
        isSwitcheroo && String(switcheroo.registrationMode || "manual") === "open"
          ? "open"
          : "manual";
      const maxTeams = Math.min(8, Math.max(2, Number(switcheroo.maxTeams || 4)));
      const maxPlayers = rosterSizeFor(state.format) * maxTeams;

      let pool = isSwitcheroo
        ? (Array.isArray(switcheroo.pool) ? [...switcheroo.pool] : [])
        : Array.from(
            new Map(
              (Array.isArray(state.teams) ? state.teams : [])
                .flatMap((team: any) => (Array.isArray(team?.roster) ? team.roster : []))
                .filter((player: any) => player?.id)
                .map((player: any) => [
                  String(player.id),
                  { id: player.id, name: player.name || "Player" },
                ])
            ).values()
          );

      let participant = pool.find(
        (player: any) => String(player?.id || "") === actor.playerId
      );

      if (!participant) {
        if (registrationMode !== "open") {
          return json(req, { error: "You are not registered in this tournament roster" }, 403);
        }
        if (pool.length >= maxPlayers) {
          return json(req, { error: "Tournament registration is full" }, 409);
        }

        participant = {
          id: actor.playerId,
          name: actor.name,
          registeredAt: new Date().toISOString(),
          registrationSource: "open",
        };
        pool.push(participant);
      }

      const entryPaid = Array.isArray(switcheroo.entryPaid) ? switcheroo.entryPaid : [];
      if (entryPaid.some((row: any) => String(row?.playerId || "") === actor.playerId)) {
        return json(req, { error: "Tournament entry is already paid" }, 409);
      }

      const entryPendingPayments = Array.isArray(switcheroo.entryPendingPayments)
        ? switcheroo.entryPendingPayments
        : [];
      const existing = entryPendingPayments.find(
        (row: any) => String(row?.playerId || "") === actor.playerId
      );
      if (existing) {
        return json(req, { error: "Your tournament entry payment is already waiting for Admin confirmation" }, 409);
      }

      const economy = switcherooEconomy(
        freeEntry ? 0 : switcheroo.entryFee,
        pool.length
      );

      if (freeEntry) {
        const freeConfirmation = {
          id: crypto.randomUUID(),
          playerId: actor.playerId,
          name: actor.name,
          amount: 0,
          paidAt: new Date().toISOString(),
          confirmedBy: "free-entry",
          freeEntry: true,
        };

        const nextEntryPaid = [
          ...entryPaid.filter(
            (row: any) => String(row?.playerId || "") !== actor.playerId
          ),
          freeConfirmation,
        ];

        const nextState = {
          ...state,
          switcheroo: {
            ...switcheroo,
            freeEntry: true,
            registrationMode,
            maxTeams,
            ...(isSwitcheroo ? { pool } : {}),
            entryFee: 0,
            rerollBaseGoal: economy.baseGoal,
            rerollGoal: economy.baseGoal,
            rerollStep: economy.firstMargin,
            rerollStepGrowth: economy.marginGrowth,
            entryPaid: nextEntryPaid,
            entryPendingPayments,
          },
        };

        const { data: updated, error: updateError } = await supabase
          .from("tourney_state")
          .update({
            state: nextState,
            status: "setup",
            updated_at: new Date().toISOString(),
            updated_by: `player:${actor.playerId}:free-entry-confirm`,
          })
          .eq("id", "current")
          .select("state,status,updated_at")
          .single();

        if (updateError) throw updateError;

        return json(req, {
          ok: true,
          amount: 0,
          paymentId: freeConfirmation.id,
          paymentUrl: null,
          freeEntry: true,
          registered: true,
          openRegistration: registrationMode === "open",
          tourney: updated.state,
          status: updated.status,
          updatedAt: updated.updated_at,
        });
      }

      const paymentUrl = buildPayPalPaymentUrl(switcheroo.paypalUrl, economy.entryFee);
      const pending = {
        id: crypto.randomUUID(),
        playerId: actor.playerId,
        name: actor.name,
        amount: economy.entryFee,
        requestedAt: new Date().toISOString(),
        type: "entry",
        openRegistration: registrationMode === "open",
        tournamentType: isSwitcheroo ? "switcheroo" : "classic",
      };

      const nextState = {
        ...state,
        switcheroo: {
          ...switcheroo,
          freeEntry: false,
          registrationMode,
          maxTeams,
          ...(isSwitcheroo ? { pool } : {}),
          entryFee: economy.entryFee,
          rerollBaseGoal: economy.baseGoal,
          rerollGoal: economy.baseGoal,
          rerollStep: economy.firstMargin,
          rerollStepGrowth: economy.marginGrowth,
          entryPendingPayments: [...entryPendingPayments, pending],
        },
      };

      const { data: updated, error: updateError } = await supabase
        .from("tourney_state")
        .update({
          state: nextState,
          status: "setup",
          updated_at: new Date().toISOString(),
          updated_by: `player:${actor.playerId}:entry-request`,
        })
        .eq("id", "current")
        .select("state,status,updated_at")
        .single();

      if (updateError) throw updateError;

      return json(req, {
        ok: true,
        amount: economy.entryFee,
        paymentId: pending.id,
        paymentUrl,
        freeEntry: false,
        registered: true,
        openRegistration: registrationMode === "open",
        tourney: updated.state,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    }

    if (action === "review-entry-payment") {
      const admin = await validateAdmin(req, supabase);
      if (!admin) return json(req, { error: "Admin access required" }, 401);

      const paymentId = String(body.paymentId || "").trim();
      const decision = String(body.decision || "").trim().toLowerCase();
      if (!paymentId || !["confirm", "reject"].includes(decision)) {
        return json(req, { error: "Invalid tournament entry payment review" }, 400);
      }

      const { data: rawRow, error: stateError } = await supabase
        .from("tourney_state")
        .select("state,status,updated_at")
        .eq("id", "current")
        .single();

      if (stateError) throw stateError;
      const state = rawRow?.state && typeof rawRow.state === "object" ? rawRow.state : null;
      if (!state || state.status !== "setup") {
        return json(req, { error: "Tournament entry is no longer open" }, 409);
      }

      const switcheroo =
        state.switcheroo && typeof state.switcheroo === "object"
          ? { ...state.switcheroo }
          : {};

      const pendingRows = Array.isArray(switcheroo.entryPendingPayments)
        ? switcheroo.entryPendingPayments
        : [];
      const pending = pendingRows.find(
        (row: any) => String(row?.id || "") === paymentId
      );
      if (!pending) {
        return json(req, { error: "Pending tournament entry payment not found" }, 404);
      }

      const remainingPending = pendingRows.filter(
        (row: any) => String(row?.id || "") !== paymentId
      );

      let entryPaid = Array.isArray(switcheroo.entryPaid)
        ? [...switcheroo.entryPaid]
        : [];

      if (decision === "confirm") {
        entryPaid = entryPaid.filter(
          (row: any) => String(row?.playerId || "") !== String(pending.playerId || "")
        );
        entryPaid.push({
          id: pending.id,
          playerId: pending.playerId,
          name: pending.name,
          amount: pending.amount,
          paidAt: new Date().toISOString(),
          confirmedBy: admin.username,
        });
      }

      const isSwitcheroo = state.teamBuild === "switcheroo";
      let pool = isSwitcheroo
        ? (Array.isArray(switcheroo.pool) ? [...switcheroo.pool] : [])
        : Array.from(
            new Map(
              (Array.isArray(state.teams) ? state.teams : [])
                .flatMap((team: any) => (Array.isArray(team?.roster) ? team.roster : []))
                .filter((player: any) => player?.id)
                .map((player: any) => [
                  String(player.id),
                  { id: player.id, name: player.name || "Player" },
                ])
            ).values()
          );

      if (
        isSwitcheroo &&
        decision === "reject" &&
        pending.openRegistration &&
        !entryPaid.some(
          (row: any) => String(row?.playerId || "") === String(pending.playerId || "")
        )
      ) {
        pool = pool.filter(
          (player: any) =>
            String(player?.id || "") !== String(pending.playerId || "")
        );
      }

      const economy = switcherooEconomy(switcheroo.entryFee, pool.length);

      const nextState = {
        ...state,
        switcheroo: {
          ...switcheroo,
          ...(isSwitcheroo ? { pool } : {}),
          entryFee: economy.entryFee,
          entryPaid,
          entryPendingPayments: remainingPending,
          rerollBaseGoal: economy.baseGoal,
          rerollGoal: economy.baseGoal,
          rerollStep: economy.firstMargin,
          rerollStepGrowth: economy.marginGrowth,
        },
      };

      const { data: updated, error: updateError } = await supabase
        .from("tourney_state")
        .update({
          state: nextState,
          status: "setup",
          updated_at: new Date().toISOString(),
          updated_by: `${admin.username}:entry-${decision}`,
        })
        .eq("id", "current")
        .select("state,status,updated_at")
        .single();

      if (updateError) throw updateError;

      return json(req, {
        ok: true,
        decision,
        tourney: updated.state,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    }

    if (action === "request-payment") {
      const actor = await validatePlayer(req, supabase);
      if (!actor) {
        return json(req, { error: "A linked Discord player account is required" }, 401);
      }

      const requestedAmount = Math.round(Number(body.amount || 0));
      if (!Number.isFinite(requestedAmount) || requestedAmount < 1 || requestedAmount > 50) {
        return json(req, { error: "Contribution must be between €1 and €50" }, 400);
      }

      const { data: rawRow, error: stateError } = await supabase
        .from("tourney_state")
        .select("state,status,updated_at")
        .eq("id", "current")
        .single();

      if (stateError) throw stateError;
      const row = await normalizeExpiredReview(supabase, rawRow);
      const state = row?.state && typeof row.state === "object" ? row.state : null;

      if (!state || state.status !== "review" || state.teamBuild !== "switcheroo") {
        return json(req, { error: "Switcheroo payments are not open" }, 409);
      }

      const switcheroo =
        state.switcheroo && typeof state.switcheroo === "object"
          ? { ...state.switcheroo }
          : {};

      const pool = Array.isArray(switcheroo.pool) ? switcheroo.pool : [];
      const participant = pool.some(
        (player: any) => String(player?.id || "") === actor.playerId
      );
      if (!participant) {
        return json(req, { error: "Only tournament players can contribute" }, 403);
      }

      const reviewEndsAt = new Date(switcheroo.reviewEndsAt || 0).getTime();
      if (!reviewEndsAt || reviewEndsAt <= Date.now()) {
        return json(req, { error: "Switcheroo review has ended" }, 409);
      }

      const pendingPayments = Array.isArray(switcheroo.pendingPayments)
        ? switcheroo.pendingPayments
        : [];

      const existingPending = pendingPayments.find(
        (payment: any) => String(payment?.playerId || "") === actor.playerId
      );
      if (existingPending) {
        return json(req, { error: "You already have a PayPal payment waiting for Admin confirmation" }, 409);
      }

      const goal = Math.max(1, Math.round(Number(switcheroo.rerollGoal || 1)));
      const currentTotal = Math.max(0, Math.round(Number(switcheroo.contributedTotal || 0)));
      const reserved = pendingPayments.reduce(
        (sum: number, payment: any) => sum + Math.max(0, Math.round(Number(payment?.amount || 0))),
        0
      );
      const available = Math.max(0, goal - currentTotal - reserved);

      if (available <= 0) {
        return json(req, { error: "Enough PayPal payments are already waiting for confirmation" }, 409);
      }

      const amount = Math.min(requestedAmount, available);
      const paymentUrl = buildPayPalPaymentUrl(switcheroo.paypalUrl, amount);
      const pending = {
        id: crypto.randomUUID(),
        playerId: actor.playerId,
        name: actor.name,
        amount,
        requestedAt: new Date().toISOString(),
      };

      const nextState = {
        ...state,
        switcheroo: {
          ...switcheroo,
          pendingPayments: [...pendingPayments, pending],
        },
      };

      const { data: updated, error: updateError } = await supabase
        .from("tourney_state")
        .update({
          state: nextState,
          status: "review",
          updated_at: new Date().toISOString(),
          updated_by: `player:${actor.playerId}:paypal-request`,
        })
        .eq("id", "current")
        .select("state,status,updated_at")
        .single();

      if (updateError) throw updateError;

      return json(req, {
        ok: true,
        amount,
        paymentId: pending.id,
        paymentUrl,
        tourney: updated.state,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    }

    if (action === "review-payment") {
      const admin = await validateAdmin(req, supabase);
      if (!admin) return json(req, { error: "Admin access required" }, 401);

      const paymentId = String(body.paymentId || "").trim();
      const decision = String(body.decision || "").trim().toLowerCase();
      if (!paymentId || !["confirm", "reject"].includes(decision)) {
        return json(req, { error: "Invalid PayPal payment review" }, 400);
      }

      const { data: rawRow, error: stateError } = await supabase
        .from("tourney_state")
        .select("state,status,updated_at")
        .eq("id", "current")
        .single();

      if (stateError) throw stateError;
      const state = rawRow?.state && typeof rawRow.state === "object" ? rawRow.state : null;
      if (!state || state.teamBuild !== "switcheroo") {
        return json(req, { error: "No Switcheroo tournament found" }, 409);
      }

      const switcheroo =
        state.switcheroo && typeof state.switcheroo === "object"
          ? { ...state.switcheroo }
          : {};

      const pendingPayments = Array.isArray(switcheroo.pendingPayments)
        ? switcheroo.pendingPayments
        : [];
      const pending = pendingPayments.find(
        (payment: any) => String(payment?.id || "") === paymentId
      );

      if (!pending) {
        return json(req, { error: "Pending PayPal payment not found" }, 404);
      }

      const remainingPending = pendingPayments.filter(
        (payment: any) => String(payment?.id || "") !== paymentId
      );

      if (decision === "reject") {
        const nextState = {
          ...state,
          switcheroo: {
            ...switcheroo,
            pendingPayments: remainingPending,
          },
        };

        const { data: updated, error: updateError } = await supabase
          .from("tourney_state")
          .update({
            state: nextState,
            status: String(state.status || "review"),
            updated_at: new Date().toISOString(),
            updated_by: `${admin.username}:paypal-reject`,
          })
          .eq("id", "current")
          .select("state,status,updated_at")
          .single();

        if (updateError) throw updateError;
        return json(req, {
          ok: true,
          decision,
          rerolled: false,
          tourney: updated.state,
          status: updated.status,
          updatedAt: updated.updated_at,
        });
      }

      if (String(state.status || "") !== "review") {
        return json(req, { error: "Switcheroo is locked: the review timer has ended" }, 409);
      }

      const reviewEndsAt = new Date(switcheroo.reviewEndsAt || 0).getTime();
      const requestedAt = new Date(pending.requestedAt || 0).getTime();
      if (!reviewEndsAt || reviewEndsAt <= Date.now()) {
        await normalizeExpiredReview(supabase, rawRow);
        return json(req, { error: "Switcheroo is locked: the review timer has ended" }, 409);
      }
      if (!requestedAt || requestedAt > reviewEndsAt) {
        return json(req, { error: "This PayPal request was not created during the review window" }, 409);
      }

      const goal = Math.max(1, Math.round(Number(switcheroo.rerollGoal || 1)));
      const currentTotal = Math.max(0, Math.round(Number(switcheroo.contributedTotal || 0)));
      const amount = Math.max(0, Math.round(Number(pending.amount || 0)));
      const nextTotal = Math.min(goal, currentTotal + amount);
      const contribution = {
        id: pending.id,
        playerId: pending.playerId,
        name: pending.name,
        amount,
        at: new Date().toISOString(),
        confirmedBy: admin.username,
      };
      const contributions = [
        ...(Array.isArray(switcheroo.contributions) ? switcheroo.contributions : []),
        contribution,
      ];

      let nextState: any = {
        ...state,
        switcheroo: {
          ...switcheroo,
          pendingPayments: remainingPending,
          contributions,
          contributedTotal: nextTotal,
        },
      };
      let rerolled = false;

      const rerollsUsed = Math.max(0, Number(switcheroo.rerollsUsed || 0));

      if (nextTotal >= goal) {
        const pool = Array.isArray(switcheroo.pool) ? switcheroo.pool : [];
        const rosterSize = rosterSizeFor(state.format);
        if (pool.length < rosterSize * 2 || pool.length % rosterSize !== 0) {
          return json(req, { error: "Switcheroo player pool is no longer valid" }, 409);
        }

        const nextUsed = rerollsUsed + 1;
        const generation = Math.max(1, Number(switcheroo.generation || 1)) + 1;
        const teams = makeSwitcherooTeams(pool, state.format, generation);
        const reviewMinutes = Math.max(1, Number(switcheroo.reviewMinutes || 5));
        const step = Math.max(5, Math.round(Number(switcheroo.rerollStep || 10)));
        const stepGrowth = Math.max(5, Math.round(Number(switcheroo.rerollStepGrowth || 5)));
        const nextGoal = goal + step;
        const nextStep = step + stepGrowth;

        nextState = {
          ...state,
          teams,
          bracket: [],
          champion: null,
          status: "review",
          switcheroo: {
            ...switcheroo,
            generation,
            rerollsUsed: nextUsed,
            rerollStep: nextStep,
            rerollStepGrowth: stepGrowth,
            rerollGoal: nextGoal,
            reviewEndsAt: new Date(Date.now() + reviewMinutes * 60 * 1000).toISOString(),
            contributedTotal: 0,
            contributions: [],
            pendingPayments: [],
            phase: "review",
            history: [
              ...(Array.isArray(switcheroo.history) ? switcheroo.history : []),
              {
                generation: Number(switcheroo.generation || 1),
                goal,
                margin: step,
                nextGoal,
                nextMargin: nextStep,
                total: nextTotal,
                contributions,
                completedAt: new Date().toISOString(),
              },
            ],
          },
        };
        rerolled = true;
      }

      const { data: updated, error: updateError } = await supabase
        .from("tourney_state")
        .update({
          state: nextState,
          status: String(nextState.status || "review"),
          updated_at: new Date().toISOString(),
          updated_by: `${admin.username}:paypal-confirm`,
        })
        .eq("id", "current")
        .select("state,status,updated_at")
        .single();

      if (updateError) throw updateError;

      return json(req, {
        ok: true,
        decision,
        rerolled,
        confirmedAmount: amount,
        tourney: updated.state,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message || "Unexpected error")
          : String(error || "Unexpected error");

    return json(req, { error: message }, 500);
  }
});
