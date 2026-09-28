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

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const validateAdminSession = async (req: Request, supabase: any) => {
  const token = String(req.headers.get("x-admin-session") || "").trim();
  if (!token) return null;

  const tokenHash = await sha256(token);
  const uaHash = await sha256(req.headers.get("user-agent") || "unknown");

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("username,account_id,user_agent_hash,expires_at,revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;
  if (session.user_agent_hash !== uaHash) return null;

  const { data: credential } = await supabase
    .from("admin_credentials")
    .select("is_active,required_account_id")
    .eq("username", session.username)
    .maybeSingle();

  if (!credential?.is_active) return null;
  if (!credential?.required_account_id || credential.required_account_id !== session.account_id) return null;

  const { data: account } = await supabase
    .from("player_accounts")
    .select("player_id")
    .eq("id", session.account_id)
    .maybeSingle();

  return {
    accountId: session.account_id,
    playerId: account?.player_id ? String(account.player_id) : null,
  };
};

const cleanPost = (body: any) => {
  const title = String(body?.title || "").trim().slice(0, 120);
  const summary = String(body?.summary || "").trim().slice(0, 1200);
  const category = String(body?.category || "Platform").trim().slice(0, 40) || "Platform";
  const accentRaw = String(body?.accent || "#FF2A3B").trim();
  const accent = /^#[0-9a-fA-F]{6}$/.test(accentRaw) ? accentRaw : "#FF2A3B";
  const featured = Boolean(body?.featured);
  const published = body?.published !== false;

  return { title, summary, category, accent, featured, published };
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
    const admin = await validateAdminSession(req, supabase);
    if (!admin) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "").trim();

    if (action === "list") {
      const { data, error } = await supabase
        .from("news_posts")
        .select("*")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return json({ ok: true, posts: data || [] });
    }

    if (action === "create") {
      const post = cleanPost(body);
      if (!post.title) return json({ error: "Title is required" }, 400);
      if (!post.summary) return json({ error: "Post text is required" }, 400);

      if (post.featured) {
        const { error: featuredError } = await supabase
          .from("news_posts")
          .update({ featured: false, updated_at: new Date().toISOString() })
          .eq("featured", true);
        if (featuredError) throw featuredError;
      }

      const { data, error } = await supabase
        .from("news_posts")
        .insert({
          ...post,
          author_player_id: admin.playerId,
        })
        .select("*")
        .single();

      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        action: "content.news_created",
        entity_type: "news_post",
        entity_id: data.id,
        details: { title: data.title, category: data.category, featured: data.featured },
      });

      return json({ ok: true, post: data });
    }

    if (action === "update") {
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "Post id is required" }, 400);

      const post = cleanPost(body);
      if (!post.title) return json({ error: "Title is required" }, 400);
      if (!post.summary) return json({ error: "Post text is required" }, 400);

      if (post.featured) {
        const { error: featuredError } = await supabase
          .from("news_posts")
          .update({ featured: false, updated_at: new Date().toISOString() })
          .neq("id", id)
          .eq("featured", true);
        if (featuredError) throw featuredError;
      }

      const { data, error } = await supabase
        .from("news_posts")
        .update({
          ...post,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        action: "content.news_updated",
        entity_type: "news_post",
        entity_id: id,
        details: { title: data.title, category: data.category, featured: data.featured, published: data.published },
      });

      return json({ ok: true, post: data });
    }

    if (action === "delete") {
      const id = String(body?.id || "").trim();
      if (!id) return json({ error: "Post id is required" }, 400);

      const { data: existing, error: existingError } = await supabase
        .from("news_posts")
        .select("title,category")
        .eq("id", id)
        .maybeSingle();
      if (existingError) throw existingError;

      const { error } = await supabase
        .from("news_posts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        action: "content.news_deleted",
        entity_type: "news_post",
        entity_id: id,
        details: { title: existing?.title || null, category: existing?.category || null },
      });

      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: String(error).replace(/^Error:\s*/, "") }, 500);
  }
});
