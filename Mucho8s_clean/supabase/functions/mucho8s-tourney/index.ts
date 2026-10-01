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
  const { data: session } = await supabase
    .from("admin_sessions")
    .select("username,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    return null;
  }
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

const normalizeExpiredReview = async (supabase: any, row: any) => {
  const state = row?.state && typeof row.state === "object" ? { ...row.state } : null;
  if (!state || state.status !== "review") return row;

  const endsAt = new Date(state?.switcheroo?.reviewEndsAt || 0).getTime();
  if (!endsAt || endsAt > Date.now()) return row;

  const nextState = {
    ...state,
    status: "ready",
    switcheroo: { ...(state.switcheroo || {}), phase: "locked" },
  };

  const { data, error } = await supabase
    .from("tourney_state")
    .update({
      state: nextState,
      status: "ready",
      updated_at: new Date().toISOString(),
      updated_by: "system:review-expired",
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

    if (action === "contribute") {
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
        return json(req, { error: "Switcheroo contributions are not open" }, 409);
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

      const maxRerolls = Math.max(0, Number(switcheroo.maxRerolls || 0));
      const rerollsUsed = Math.max(0, Number(switcheroo.rerollsUsed || 0));
      if (rerollsUsed >= maxRerolls) {
        return json(req, { error: "Maximum number of re-rolls reached" }, 409);
      }

      const reviewEndsAt = new Date(switcheroo.reviewEndsAt || 0).getTime();
      if (!reviewEndsAt || reviewEndsAt <= Date.now()) {
        return json(req, { error: "Switcheroo review has ended" }, 409);
      }

      const goal = Math.max(1, Math.round(Number(switcheroo.rerollGoal || 1)));
      const currentTotal = Math.max(0, Math.round(Number(switcheroo.contributedTotal || 0)));
      const remaining = Math.max(0, goal - currentTotal);
      if (remaining <= 0) {
        return json(req, { error: "Re-roll goal already reached" }, 409);
      }

      const acceptedAmount = Math.min(requestedAmount, remaining);
      const contribution = {
        id: crypto.randomUUID(),
        playerId: actor.playerId,
        name: actor.name,
        amount: acceptedAmount,
        at: new Date().toISOString(),
      };

      const contributions = [
        ...(Array.isArray(switcheroo.contributions) ? switcheroo.contributions : []),
        contribution,
      ];
      const nextTotal = currentTotal + acceptedAmount;
      let nextState: any = {
        ...state,
        switcheroo: {
          ...switcheroo,
          contributions,
          contributedTotal: nextTotal,
        },
      };
      let rerolled = false;

      if (nextTotal >= goal) {
        const rosterSize = rosterSizeFor(state.format);
        if (pool.length < rosterSize * 2 || pool.length % rosterSize !== 0) {
          return json(req, { error: "Switcheroo player pool is no longer valid" }, 409);
        }

        const nextUsed = rerollsUsed + 1;
        const generation = Math.max(1, Number(switcheroo.generation || 1)) + 1;
        const teams = makeSwitcherooTeams(pool, state.format, generation);
        const reviewMinutes = Math.max(1, Number(switcheroo.reviewMinutes || 5));

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
            reviewEndsAt: new Date(Date.now() + reviewMinutes * 60 * 1000).toISOString(),
            contributedTotal: 0,
            contributions: [],
            phase: "review",
            history: [
              ...(Array.isArray(switcheroo.history) ? switcheroo.history : []),
              {
                generation: Number(switcheroo.generation || 1),
                goal,
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
          updated_by: `player:${actor.playerId}`,
        })
        .eq("id", "current")
        .select("state,status,updated_at")
        .single();

      if (updateError) throw updateError;

      return json(req, {
        ok: true,
        rerolled,
        acceptedAmount,
        tourney: updated.state,
        status: updated.status,
        updatedAt: updated.updated_at,
      });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    return json(
      req,
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500
    );
  }
});
