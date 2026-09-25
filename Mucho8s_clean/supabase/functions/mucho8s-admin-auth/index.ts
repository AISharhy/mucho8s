import { createClient } from "npm:@supabase/supabase-js@2";

const SESSION_HOURS = 2;
const RATE_WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS = 5;
const PBKDF2_ITERATIONS = 210000;

const ALLOWED_ORIGINS = new Set([
  "https://aisharhy.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://aisharhy.github.io";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-admin-session",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });

const textEncoder = new TextEncoder();

const hex = (bytes: Uint8Array) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return hex(new Uint8Array(digest));
};

const base64UrlEncode = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecode = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
};

const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const pbkdf2 = async (password: string, salt: Uint8Array, iterations: number) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return base64UrlEncode(new Uint8Array(bits));
};

const passwordStrongEnough = (password: string) => {
  if (password.length < 12 || password.length > 128) return false;
  const groups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return groups >= 3;
};

const getClientKey = async (req: Request) => {
  const forwarded = req.headers.get("cf-connecting-ip")
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const ua = req.headers.get("user-agent") || "unknown";
  return sha256(`${forwarded}|${ua}`);
};

const getUserAgentHash = (req: Request) =>
  sha256(req.headers.get("user-agent") || "unknown");

const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const validateSession = async (req: Request, supabase: any) => {
  const token = String(req.headers.get("x-admin-session") || "").trim();
  if (!token) return null;

  const tokenHash = await sha256(token);
  const uaHash = await getUserAgentHash(req);

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("token_hash,username,account_id,user_agent_hash,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;
  if (!constantTimeEqual(String(session.user_agent_hash || ""), uaHash)) return null;

  const { data: credential, error: credentialError } = await supabase
    .from("admin_credentials")
    .select("username,is_active,required_account_id")
    .eq("username", session.username)
    .maybeSingle();

  if (credentialError || !credential?.is_active) return null;
  if (!credential?.required_account_id || credential.required_account_id !== session.account_id) return null;

  await supabase
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return {
    username: session.username,
    tokenHash,
    expiresAt: session.expires_at,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders(req) });
    }
    return new Response("ok", { headers: corsHeaders(req) });
  }

  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(req, { error: "Origin not allowed" }, 403);
  }

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "login") {
      const username = String(body?.username || "").trim().toLowerCase();
      const password = String(body?.password || "");
      if (!username || !password) return json(req, { error: "Missing credentials" }, 400);

      const authHeader = req.headers.get("authorization") || "";
      const discordToken = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!discordToken) {
        return json(req, { error: "Login with the authorized Discord account first" }, 401);
      }

      const { data: discordAuth, error: discordAuthError } = await supabase.auth.getUser(discordToken);
      const discordUser = discordAuth?.user;
      if (discordAuthError || !discordUser) {
        return json(req, { error: "Discord session is invalid or expired" }, 401);
      }

      const now = new Date();
      const cutoff = new Date(now.getTime() - RATE_WINDOW_MINUTES * 60 * 1000).toISOString();
      const clientKeyHash = await getClientKey(req);

      await supabase.from("admin_sessions").delete().lt("expires_at", now.toISOString());
      await supabase
        .from("admin_login_attempts")
        .delete()
        .lt("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

      const { data: failedAttempts, error: attemptError } = await supabase
        .from("admin_login_attempts")
        .select("id,created_at")
        .eq("username", username)
        .eq("client_key_hash", clientKeyHash)
        .eq("success", false)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(MAX_FAILED_ATTEMPTS);

      if (attemptError) throw attemptError;
      if ((failedAttempts || []).length >= MAX_FAILED_ATTEMPTS) {
        return json(req, {
          error: "Too many failed attempts. Try again in 15 minutes.",
          locked: true,
        }, 429);
      }

      const { data: credential, error: credentialError } = await supabase
        .from("admin_credentials")
        .select("username,password_hash,password_scheme,password_salt,password_iterations,is_active,required_account_id")
        .eq("username", username)
        .maybeSingle();

      if (credentialError) throw credentialError;

      if (!credential?.required_account_id || credential.required_account_id !== discordUser.id) {
        await supabase.from("admin_login_attempts").insert({
          username,
          client_key_hash: clientKeyHash,
          success: false,
        });
        return json(req, { error: "This Discord account is not authorized for Admin" }, 403);
      }

      let valid = false;
      if (credential?.is_active) {
        if (credential.password_scheme === "pbkdf2_sha256" && credential.password_salt) {
          const derived = await pbkdf2(
            password,
            base64UrlDecode(credential.password_salt),
            Number(credential.password_iterations || PBKDF2_ITERATIONS),
          );
          valid = constantTimeEqual(derived, String(credential.password_hash || ""));
        } else {
          const legacy = await sha256(password);
          valid = constantTimeEqual(legacy, String(credential.password_hash || ""));
        }
      }

      if (!valid) {
        await supabase.from("admin_login_attempts").insert({
          username,
          client_key_hash: clientKeyHash,
          success: false,
        });
        return json(req, { error: "Invalid admin credentials" }, 401);
      }

      await supabase
        .from("admin_login_attempts")
        .delete()
        .eq("username", username)
        .eq("client_key_hash", clientKeyHash)
        .eq("success", false);

      if (credential.password_scheme !== "pbkdf2_sha256") {
        const salt = new Uint8Array(16);
        crypto.getRandomValues(salt);
        const upgradedHash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);

        await supabase
          .from("admin_credentials")
          .update({
            password_hash: upgradedHash,
            password_scheme: "pbkdf2_sha256",
            password_salt: base64UrlEncode(salt),
            password_iterations: PBKDF2_ITERATIONS,
            updated_at: new Date().toISOString(),
          })
          .eq("username", username);
      }

      const token = randomToken();
      const tokenHash = await sha256(token);
      const uaHash = await getUserAgentHash(req);
      const expiresAt = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

      const { error: sessionError } = await supabase.from("admin_sessions").insert({
        token_hash: tokenHash,
        username,
        account_id: discordUser.id,
        user_agent_hash: uaHash,
        expires_at: expiresAt,
      });

      if (sessionError) throw sessionError;

      await supabase.from("admin_login_attempts").insert({
        username,
        client_key_hash: clientKeyHash,
        success: true,
      });

      return json(req, {
        ok: true,
        sessionToken: token,
        nickname: "Admin",
        expiresAt,
      });
    }

    const session = await validateSession(req, supabase);
    if (!session) return json(req, { error: "Admin session expired or invalid" }, 401);

    if (action === "status") {
      return json(req, {
        ok: true,
        nickname: "Admin",
        expiresAt: session.expiresAt,
      });
    }

    if (action === "logout") {
      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("token_hash", session.tokenHash);
      return json(req, { ok: true });
    }

    if (action === "logout-all") {
      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("username", session.username)
        .is("revoked_at", null);
      return json(req, { ok: true });
    }

    if (action === "change-password") {
      const newPassword = String(body?.newPassword || "");
      if (!passwordStrongEnough(newPassword)) {
        return json(req, {
          error: "Use at least 12 characters and at least 3 of: uppercase, lowercase, number, symbol.",
        }, 400);
      }

      const salt = new Uint8Array(16);
      crypto.getRandomValues(salt);
      const nextHash = await pbkdf2(newPassword, salt, PBKDF2_ITERATIONS);

      const { error: updateError } = await supabase
        .from("admin_credentials")
        .update({
          password_hash: nextHash,
          password_scheme: "pbkdf2_sha256",
          password_salt: base64UrlEncode(salt),
          password_iterations: PBKDF2_ITERATIONS,
          updated_at: new Date().toISOString(),
        })
        .eq("username", session.username);

      if (updateError) throw updateError;

      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("username", session.username)
        .neq("token_hash", session.tokenHash)
        .is("revoked_at", null);

      return json(req, { ok: true });
    }

    return json(req, { error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json(req, { error: "Admin authentication service error" }, 500);
  }
});
