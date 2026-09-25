import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_PASSWORD_SHA256 = "5275321e80637acbd0dc2a0d0e9b5120ab79618531edd49b189ff4b4ce4ec4ff";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, x-admin-password",
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

const isDiscordWebhook = (value: string) => {
  try {
    const url = new URL(value);
    const validHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
    return validHost && url.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
};

const postDiscord = async (webhookUrl: string, payload: unknown) => {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${text.slice(0, 180)}`);
  }
};

const cleanNames = (value: unknown) =>
  Array.isArray(value)
    ? value.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 4)
    : [];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const suppliedPassword = req.headers.get("x-admin-password") || "";
  if ((await sha256(suppliedPassword)) !== ADMIN_PASSWORD_SHA256) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase server credentials unavailable");

    const supabase = createClient(supabaseUrl, secretKey);
    const body = await req.json();
    const action = String(body?.action || "");

    const getWebhook = async () => {
      const { data, error } = await supabase
        .from("discord_config")
        .select("webhook_url")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;
      return data?.webhook_url || "";
    };

    if (action === "status") {
      const webhookUrl = await getWebhook();
      return json({ ok: true, configured: Boolean(webhookUrl) });
    }

    if (action === "configure") {
      const webhookUrl = String(body?.webhookUrl || "").trim();
      if (!isDiscordWebhook(webhookUrl)) return json({ error: "Invalid Discord webhook URL" }, 400);

      const { error } = await supabase
        .from("discord_config")
        .upsert({ id: "main", webhook_url: webhookUrl, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true, configured: true });
    }

    if (action === "clear") {
      const { error } = await supabase.from("discord_config").delete().eq("id", "main");
      if (error) throw error;
      return json({ ok: true, configured: false });
    }

    const webhookUrl = await getWebhook();
    if (!webhookUrl) return json({ error: "Discord webhook not configured" }, 400);

    if (action === "test") {
      await postDiscord(webhookUrl, {
        username: "MuchoMoney8s",
        embeds: [{
          title: "✅ Discord connected",
          description: "MuchoMoney8s is now connected to this channel.",
          color: 0xFF2A3B,
          footer: { text: "MuchoMoney8s · Competitive COD 8s" },
          timestamp: new Date().toISOString(),
        }],
      });
      return json({ ok: true });
    }

    if (action === "teams") {
      const teamA = cleanNames(body?.teamA);
      const teamB = cleanNames(body?.teamB);
      if (!teamA.length || !teamB.length) return json({ error: "Teams are required" }, 400);

      const game = String(body?.game || "All Games").slice(0, 40);
      const balance = Number(body?.balanceScore);
      const balanceText = Number.isFinite(balance) ? `${Math.round(balance)}%` : "—";

      await postDiscord(webhookUrl, {
        username: "MuchoMoney8s",
        embeds: [{
          title: "⚔️ New 8s Lobby",
          description: "Teams are ready.",
          color: 0xFF2A3B,
          fields: [
            { name: "🔴 Alpha", value: teamA.join("\n"), inline: true },
            { name: "⚪ Bravo", value: teamB.join("\n"), inline: true },
            { name: "Game", value: game, inline: true },
            { name: "Balance", value: balanceText, inline: true },
          ],
          footer: { text: "MuchoMoney8s · Team Balancer" },
          timestamp: new Date().toISOString(),
        }],
      });
      return json({ ok: true });
    }

    if (action === "result") {
      const teamA = cleanNames(body?.teamA);
      const teamB = cleanNames(body?.teamB);
      const winner = body?.winner === "B" ? "Bravo" : "Alpha";
      const game = String(body?.game || "Game").slice(0, 40);
      const mode = String(body?.mode || "Mode").slice(0, 60);
      const mvp = String(body?.mvp || "").trim().slice(0, 60);

      await postDiscord(webhookUrl, {
        username: "MuchoMoney8s",
        embeds: [{
          title: "🏆 Match Result",
          description: `**${winner} won**`,
          color: 0xFF2A3B,
          fields: [
            { name: "🔴 Alpha", value: teamA.join("\n") || "—", inline: true },
            { name: "⚪ Bravo", value: teamB.join("\n") || "—", inline: true },
            { name: "Game", value: game, inline: true },
            { name: "Mode", value: mode, inline: true },
            ...(mvp ? [{ name: "MVP", value: `👑 ${mvp}`, inline: true }] : []),
          ],
          footer: { text: "MuchoMoney8s · Match Result" },
          timestamp: new Date().toISOString(),
        }],
      });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
