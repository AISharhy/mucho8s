import nacl from "npm:tweetnacl@1.0.3";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const hexToBytes = (hex: string) =>
  new Uint8Array((hex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)));

const option = (interaction: any, name: string) =>
  interaction?.data?.options?.find((item: any) => item?.name === name)?.value;

const discordUserId = (interaction: any) =>
  String(interaction?.member?.user?.id || interaction?.user?.id || "");

const ephemeral = (content: string) =>
  json({ type: 4, data: { content, flags: 64 } });

const normal = (content: string) =>
  json({ type: 4, data: { content } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";
  const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY") || "";

  if (!publicKey) return json({ error: "DISCORD_PUBLIC_KEY is not configured" }, 503);

  const verified = nacl.sign.detached.verify(
    new TextEncoder().encode(timestamp + rawBody),
    hexToBytes(signature),
    hexToBytes(publicKey),
  );

  if (!verified) return json({ error: "Invalid request signature" }, 401);

  const interaction = JSON.parse(rawBody);
  if (interaction?.type === 1) return json({ type: 1 });
  if (interaction?.type !== 2) return ephemeral("Unsupported interaction.");

  try {
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !secretKey) throw new Error("Supabase credentials unavailable");
    const supabase = createClient(supabaseUrl, secretKey);

    const command = String(interaction?.data?.name || "").toLowerCase();
    const userId = discordUserId(interaction);

    if (command === "help") {
      return ephemeral(
        "**MuchoMoney8s commands**\n" +
        "/ranking — Top ELO players\n" +
        "/player name:<nickname> — Player stats\n" +
        "/chall player:<Discord user> amount:<€> platform:<paypal|revolut|cmg> — Send a challenge\n" +
        "/match — Show your active challenge"
      );
    }

    if (command === "ranking") {
      const { data, error } = await supabase
        .from("app_state")
        .select("players")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;

      const players = Array.isArray(data?.players) ? data.players : [];
      const top = [...players]
        .sort((a: any, b: any) => Number(b?.currentElo || 0) - Number(a?.currentElo || 0))
        .slice(0, 5);

      if (!top.length) return normal("No players in the ranking yet.");

      const lines = top.map(
        (player: any, index: number) =>
          `**#${index + 1} ${player?.name || "Unknown"}** — ${Number(player?.currentElo || 0)} ELO`
      );
      return normal("🏆 **MuchoMoney8s Ranking**\n" + lines.join("\n"));
    }

    if (command === "player") {
      const name = String(option(interaction, "name") || "").trim().toLowerCase();
      if (!name) return ephemeral("Choose a player name.");

      const { data, error } = await supabase
        .from("app_state")
        .select("players")
        .eq("id", "main")
        .maybeSingle();
      if (error) throw error;

      const players = Array.isArray(data?.players) ? data.players : [];
      const player = players.find(
        (item: any) => String(item?.name || "").toLowerCase() === name
      );
      if (!player) return ephemeral("Player not found.");

      const total = Number(player.totalMatches || 0);
      const wins = Number(player.wins || 0);
      const winRate = total ? Math.round((wins / total) * 100) : 0;

      return normal(
        `🎮 **${player.name}**\n` +
        `ELO: **${player.currentElo}**\n` +
        `Record: **${wins}W - ${Number(player.losses || 0)}L**\n` +
        `Win Rate: **${winRate}%**\n` +
        `MVP: **${Number(player.mvpCount || 0)}**`
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("player_accounts")
      .select("id,player_id,discord_id,paypal_url,revolut_url,cmg_url")
      .eq("discord_id", userId)
      .maybeSingle();

    if (accountError) throw accountError;
    if (!account?.player_id) {
      return ephemeral("Link your Discord account to a MuchoMoney8s player on the website first.");
    }

    if (command === "match") {
      const { data: active, error } = await supabase
        .from("player_challenges")
        .select("*")
        .or(`challenger_account_id.eq.${account.id},challenged_account_id.eq.${account.id}`)
        .in("status", ["accepted", "result_pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!active) return ephemeral("You do not have an active challenge.");

      if (command === "match") {
        const opponentId =
          active.challenger_player_id === account.player_id
            ? active.challenged_player_id
            : active.challenger_player_id;
        return ephemeral(
          `⚔️ **Active challenge**\n` +
          `Opponent player ID: ${opponentId}\n` +
          `Stake: **€${(Number(active.amount_cents || 0) / 100).toFixed(2)}**\n` +
          `Platform: **${String(active.platform || "").toUpperCase()}**\n` +
          `Status: **${active.status}**`
        );
      }
    }

    if (command === "chall") {
      const targetDiscordId = String(option(interaction, "player") || "");
      const amount = Number(option(interaction, "amount"));
      const platform = String(option(interaction, "platform") || "").toLowerCase();

      if (!targetDiscordId || targetDiscordId === userId) {
        return ephemeral("Choose another Discord player.");
      }
      if (!Number.isFinite(amount) || amount <= 0) return ephemeral("Enter a valid amount.");
      if (!["paypal", "revolut", "cmg"].includes(platform)) return ephemeral("Invalid platform.");

      const { data: target, error: targetError } = await supabase
        .from("player_accounts")
        .select("id,player_id,paypal_url,revolut_url,cmg_url")
        .eq("discord_id", targetDiscordId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target?.player_id) return ephemeral("That Discord user is not linked to a player.");

      const linkColumn =
        platform === "paypal" ? "paypal_url" :
        platform === "revolut" ? "revolut_url" :
        "cmg_url";
      const targetUrl = String(target[linkColumn] || "");
      const challengerUrl = String(account[linkColumn] || "");
      if (!targetUrl) return ephemeral(`That player has not configured ${platform.toUpperCase()}.`);
      if (!challengerUrl) return ephemeral(`Configure your ${platform.toUpperCase()} link on MuchoMoney8s first.`);

      const { data: existing, error: existingError } = await supabase
        .from("player_challenges")
        .select("id")
        .or(
          `and(challenger_player_id.eq.${account.player_id},challenged_player_id.eq.${target.player_id}),and(challenger_player_id.eq.${target.player_id},challenged_player_id.eq.${account.player_id})`
        )
        .in("status", ["pending", "accepted", "result_pending"])
        .limit(1);
      if (existingError) throw existingError;
      if (existing?.length) return ephemeral("There is already an active challenge between you.");

      const { data: seasonConfig } = await supabase
        .from("competition_config")
        .select("season_number")
        .eq("id", "main")
        .maybeSingle();
      const seasonNumber = Math.max(1, Number(seasonConfig?.season_number || 1));

      const { error: insertError } = await supabase
        .from("player_challenges")
        .insert({
          challenger_account_id: account.id,
          challenger_player_id: account.player_id,
          challenged_account_id: target.id,
          challenged_player_id: target.player_id,
          platform,
          target_url: targetUrl,
          challenger_payout_url: challengerUrl,
          challenged_payout_url: targetUrl,
          amount_cents: Math.round(amount * 100),
          currency: "EUR",
          status: "pending",
          season_number: seasonNumber,
          challenger_seen_status: "pending",
          challenged_seen_status: null,
          last_event: "created",
          challenger_seen_event: "created",
          challenged_seen_event: null,
        });
      if (insertError) throw insertError;

      return normal(
        `⚔️ Challenge sent for **€${amount.toFixed(2)}** via **${platform.toUpperCase()}**.\n` +
        "The other player can accept it from MuchoMoney8s."
      );
    }

    return ephemeral("Unknown command. Use /help.");
  } catch (error) {
    console.error(error);
    return ephemeral("MuchoMoney8s bot encountered an error.");
  }
});
