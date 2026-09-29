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

const resetPlayer = (player: any, startingElo = 500) => {
  const elo = Math.max(500, Math.round(Number(startingElo) || 500));
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

const pairKey = (a: string, b: string) => [String(a), String(b)].sort().join("::");

const buildSeasonAwards = ({
  players,
  matches,
  challenges,
  startingElo,
  seasonNumber,
  seasonName,
}: {
  players: any[];
  matches: any[];
  challenges: any[];
  startingElo: number;
  seasonNumber: number;
  seasonName: string;
}) => {
  const playerById = Object.fromEntries(
    (players || [])
      .filter((player: any) => player?.id)
      .map((player: any) => [String(player.id), player])
  );

  const directChallenges = (challenges || []).filter((challenge: any) => {
    const source = String(challenge?.source || "").toLowerCase();
    return (
      challenge?.status === "completed" &&
      challenge?.reported_winner_player_id &&
      !["match_pairing", "balancer_pairing"].includes(source)
    );
  });

  const competitiveIds = new Set<string>();
  (matches || []).forEach((match: any) => {
    [...(Array.isArray(match?.teamA) ? match.teamA : []), ...(Array.isArray(match?.teamB) ? match.teamB : [])]
      .map(String)
      .forEach((id) => competitiveIds.add(id));
  });
  directChallenges.forEach((challenge: any) => {
    if (challenge?.challenger_player_id) competitiveIds.add(String(challenge.challenger_player_id));
    if (challenge?.challenged_player_id) competitiveIds.add(String(challenge.challenged_player_id));
  });

  const activePlayers = Object.values(playerById).filter((player: any) =>
    competitiveIds.has(String(player.id)) || Number(player?.totalMatches || 0) > 0
  );

  const awards: any[] = [];
  const addAward = ({
    id,
    title,
    emoji,
    rarity = "rare",
    category = "Performance",
    playerIds = [],
    detail = "",
    value = "",
  }: any) => {
    const cleanIds = [...new Set((playerIds || []).map(String).filter((id: string) => Boolean(playerById[id])))];
    if (!cleanIds.length) return;
    awards.push({
      id,
      title,
      emoji,
      rarity,
      category,
      playerIds: cleanIds,
      detail,
      value,
      seasonNumber,
      seasonName,
    });
  };

  if (!activePlayers.length) return awards;

  const standings = [...activePlayers].sort((a: any, b: any) => {
    const eloDiff = Number(b?.currentElo || 0) - Number(a?.currentElo || 0);
    if (eloDiff) return eloDiff;
    const winsDiff = Number(b?.wins || 0) - Number(a?.wins || 0);
    if (winsDiff) return winsDiff;
    return String(a?.name || "").localeCompare(String(b?.name || ""));
  });

  if (standings[0]) {
    addAward({
      id: "season-champion",
      title: "Season Champion",
      emoji: "🏆",
      rarity: "legendary",
      category: "Podium",
      playerIds: [standings[0].id],
      detail: `Finished #1 in ${seasonName}`,
      value: `${Math.round(Number(standings[0].currentElo || 0))} Elo`,
    });
  }
  if (standings[1]) {
    addAward({
      id: "runner-up",
      title: "Runner-Up",
      emoji: "🥈",
      rarity: "epic",
      category: "Podium",
      playerIds: [standings[1].id],
      detail: `Finished #2 in ${seasonName}`,
      value: `${Math.round(Number(standings[1].currentElo || 0))} Elo`,
    });
  }
  if (standings[2]) {
    addAward({
      id: "podium-finish",
      title: "Podium Finish",
      emoji: "🥉",
      rarity: "epic",
      category: "Podium",
      playerIds: [standings[2].id],
      detail: `Finished #3 in ${seasonName}`,
      value: `${Math.round(Number(standings[2].currentElo || 0))} Elo`,
    });
  }

  const highestPeak = [...activePlayers].sort(
    (a: any, b: any) => Number(b?.peakElo || b?.currentElo || 0) - Number(a?.peakElo || a?.currentElo || 0)
  )[0];
  if (highestPeak) {
    addAward({
      id: "highest-peak",
      title: "Highest Peak",
      emoji: "👑",
      rarity: "epic",
      category: "Performance",
      playerIds: [highestPeak.id],
      detail: "Highest Elo reached during the season",
      value: `${Math.round(Number(highestPeak.peakElo || highestPeak.currentElo || 0))} Elo`,
    });
  }

  const appearances = new Map<string, number>();
  const addAppearance = (id: unknown) => {
    const key = String(id || "");
    if (!key) return;
    appearances.set(key, Number(appearances.get(key) || 0) + 1);
  };
  (matches || []).forEach((match: any) => {
    (Array.isArray(match?.teamA) ? match.teamA : []).forEach(addAppearance);
    (Array.isArray(match?.teamB) ? match.teamB : []).forEach(addAppearance);
  });
  directChallenges.forEach((challenge: any) => {
    addAppearance(challenge.challenger_player_id);
    addAppearance(challenge.challenged_player_id);
  });
  const mostActive = [...appearances.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mostActive?.[1] > 0) {
    addAward({
      id: "most-active",
      title: "Most Active",
      emoji: "⚔️",
      category: "Performance",
      playerIds: [mostActive[0]],
      detail: "Most competitive appearances across Mucho8s and Mucho1v1",
      value: `${mostActive[1]} matches`,
    });
  }

  const currentStreak = new Map<string, number>();
  const maxStreak = new Map<string, number>();
  [...(matches || [])]
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime())
    .forEach((match: any) => {
      const teamA = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
      const teamB = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
      const winners = match?.winner === "B" ? teamB : teamA;
      const losers = match?.winner === "B" ? teamA : teamB;
      winners.forEach((id: string) => {
        const next = Number(currentStreak.get(id) || 0) + 1;
        currentStreak.set(id, next);
        maxStreak.set(id, Math.max(Number(maxStreak.get(id) || 0), next));
      });
      losers.forEach((id: string) => currentStreak.set(id, 0));
    });
  const longestStreak = [...maxStreak.entries()].sort((a, b) => b[1] - a[1])[0];
  if (longestStreak?.[1] > 1) {
    addAward({
      id: "longest-win-streak",
      title: "Longest Win Streak",
      emoji: "🔥",
      rarity: longestStreak[1] >= 8 ? "epic" : "rare",
      category: "Performance",
      playerIds: [longestStreak[0]],
      detail: "Longest Mucho8s winning run of the season",
      value: `W${longestStreak[1]}`,
    });
  }

  const mvpCount = new Map<string, number>();
  const upsetWins = new Map<string, number>();
  const clearedMerda = new Map<string, number>();
  (matches || []).forEach((match: any) => {
    (Array.isArray(match?.mvpIds) ? match.mvpIds : match?.mvpId ? [match.mvpId] : [])
      .map(String)
      .forEach((id: string) => mvpCount.set(id, Number(mvpCount.get(id) || 0) + 1));

    (Array.isArray(match?.merdaClearedIds) ? match.merdaClearedIds : [])
      .map(String)
      .forEach((id: string) => clearedMerda.set(id, Number(clearedMerda.get(id) || 0) + 1));

    if (match?.upsetApplied === true) {
      const winners = match?.winner === "B"
        ? (Array.isArray(match?.teamB) ? match.teamB : [])
        : (Array.isArray(match?.teamA) ? match.teamA : []);
      winners.map(String).forEach((id: string) =>
        upsetWins.set(id, Number(upsetWins.get(id) || 0) + 1)
      );
    }
  });

  const mvpLeader = [...mvpCount.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mvpLeader?.[1] > 0) {
    addAward({
      id: "mvp-hunter",
      title: "MVP Hunter",
      emoji: "🎯",
      category: "Performance",
      playerIds: [mvpLeader[0]],
      detail: "Most automatic MVP awards",
      value: `${mvpLeader[1]} MVP`,
    });
  }

  const upsetLeader = [...upsetWins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (upsetLeader?.[1] > 0) {
    addAward({
      id: "upset-king",
      title: "Upset King",
      emoji: "🧨",
      category: "Performance",
      playerIds: [upsetLeader[0]],
      detail: "Most wins as the lower-rated side",
      value: `${upsetLeader[1]} upsets`,
    });
  }

  const survivor = [...clearedMerda.entries()].sort((a, b) => b[1] - a[1])[0];
  if (survivor?.[1] > 0) {
    addAward({
      id: "the-survivor",
      title: "The Survivor",
      emoji: "💩",
      category: "Special",
      playerIds: [survivor[0]],
      detail: "Cleared the most MERDA during the season",
      value: `${survivor[1]} cleared`,
    });
  }

  const improved = [...activePlayers]
    .map((player: any) => ({
      id: String(player.id),
      delta: Math.round(Number(player?.currentElo || startingElo) - Number(startingElo || 500)),
    }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (improved && improved.delta > 0) {
    addAward({
      id: "most-improved",
      title: "Most Improved",
      emoji: "📈",
      rarity: improved.delta >= 250 ? "epic" : "rare",
      category: "Performance",
      playerIds: [improved.id],
      detail: "Biggest Elo gain from the season starting Elo",
      value: `+${improved.delta} Elo`,
    });
  }

  const moneyNet = new Map<string, number>();
  (challenges || [])
    .filter((challenge: any) => challenge?.status === "completed" && challenge?.reported_winner_player_id)
    .forEach((challenge: any) => {
      const challenger = String(challenge?.challenger_player_id || "");
      const challenged = String(challenge?.challenged_player_id || "");
      const winner = String(challenge?.reported_winner_player_id || "");
      if (!challenger || !challenged || !winner) return;
      const loser = winner === challenger ? challenged : challenger;
      const amount = Math.max(0, Number(challenge?.amount_cents || 0) / 100);
      moneyNet.set(winner, Number(moneyNet.get(winner) || 0) + amount);
      moneyNet.set(loser, Number(moneyNet.get(loser) || 0) - amount);
    });
  const moneyLeader = [...moneyNet.entries()].sort((a, b) => b[1] - a[1])[0];
  if (moneyLeader && moneyLeader[1] > 0) {
    addAward({
      id: "money-king",
      title: "Money King",
      emoji: "💰",
      rarity: "epic",
      category: "Money",
      playerIds: [moneyLeader[0]],
      detail: "Best verified net result in money matchups",
      value: `+€${moneyLeader[1].toFixed(2)}`,
    });
  }

  const duoStats = new Map<string, { a: string; b: string; games: number; wins: number }>();
  (matches || []).forEach((match: any) => {
    const teamA = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
    const teamB = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
    const winnerSide = match?.winner === "B" ? "B" : "A";

    const updateTeam = (team: string[], won: boolean) => {
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          const key = pairKey(team[i], team[j]);
          const [a, b] = [team[i], team[j]].sort();
          const row = duoStats.get(key) || { a, b, games: 0, wins: 0 };
          row.games += 1;
          if (won) row.wins += 1;
          duoStats.set(key, row);
        }
      }
    };

    updateTeam(teamA, winnerSide === "A");
    updateTeam(teamB, winnerSide === "B");
  });
  const bestDuo = [...duoStats.values()]
    .filter((row) => row.games >= 3)
    .sort((left, right) => {
      const leftRate = left.wins / Math.max(1, left.games);
      const rightRate = right.wins / Math.max(1, right.games);
      if (rightRate !== leftRate) return rightRate - leftRate;
      return right.games - left.games;
    })[0];
  if (bestDuo) {
    addAward({
      id: "best-chemistry",
      title: "Best Chemistry",
      emoji: "🤝",
      category: "Duo",
      playerIds: [bestDuo.a, bestDuo.b],
      detail: "Best-performing duo with at least 3 matches together",
      value: `${bestDuo.wins}-${bestDuo.games - bestDuo.wins}`,
    });
  }

  const rivalryStats = new Map<string, {
    a: string;
    b: string;
    meetings: number;
    aWins: number;
    bWins: number;
    money: number;
  }>();
  const touchRivalry = (aRaw: unknown, bRaw: unknown, winnerRaw: unknown, amount = 0) => {
    const a0 = String(aRaw || "");
    const b0 = String(bRaw || "");
    const winner = String(winnerRaw || "");
    if (!a0 || !b0 || a0 === b0 || !winner) return;
    const [a, b] = [a0, b0].sort();
    const key = pairKey(a, b);
    const row = rivalryStats.get(key) || { a, b, meetings: 0, aWins: 0, bWins: 0, money: 0 };
    row.meetings += 1;
    if (winner === a) row.aWins += 1;
    if (winner === b) row.bWins += 1;
    row.money += Math.max(0, Number(amount || 0));
    rivalryStats.set(key, row);
  };

  (matches || []).forEach((match: any) => {
    const teamA = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
    const teamB = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
    const winners = new Set(match?.winner === "B" ? teamB : teamA);
    const pairingAmounts = Object.fromEntries(
      (Array.isArray(match?.pairings) ? match.pairings : [])
        .map((pair: any) => [pairKey(pair?.playerAId, pair?.playerBId), Number(pair?.amount || 0)])
    );
    teamA.forEach((left: string) => teamB.forEach((right: string) => {
      touchRivalry(left, right, winners.has(left) ? left : right, pairingAmounts[pairKey(left, right)] || 0);
    }));
  });
  directChallenges.forEach((challenge: any) => {
    touchRivalry(
      challenge.challenger_player_id,
      challenge.challenged_player_id,
      challenge.reported_winner_player_id,
      Number(challenge.amount_cents || 0) / 100,
    );
  });

  const rivalry = [...rivalryStats.values()]
    .filter((row) => row.meetings >= 2)
    .sort((left, right) => {
      if (right.meetings !== left.meetings) return right.meetings - left.meetings;
      const leftDiff = Math.abs(left.aWins - left.bWins);
      const rightDiff = Math.abs(right.aWins - right.bWins);
      if (leftDiff !== rightDiff) return leftDiff - rightDiff;
      return right.money - left.money;
    })[0];
  if (rivalry) {
    addAward({
      id: "rivalry-of-season",
      title: "Rivalry of the Season",
      emoji: "⚡",
      rarity: "epic",
      category: "Rivalry",
      playerIds: [rivalry.a, rivalry.b],
      detail: "The season's most active head-to-head battle",
      value: `${rivalry.aWins}-${rivalry.bWins} · ${rivalry.meetings} meetings`,
    });
  }

  return awards;
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
          .select("season_number,season_name,season_started_at,starting_elo,rollover_mode,rollover_day,leaderboard_min_matches,updated_at")
          .eq("id", "main")
          .maybeSingle(),
        supabase
          .from("season_archives")
          .select("season_number,season_name,started_at,ended_at,players,matches,challenge_stats,awards")
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

    if (action === "update-config") {
      const seasonName = String(body?.seasonName || "").trim().slice(0, 60);
      const startingElo = Math.max(500, Math.min(3000, Math.round(Number(body?.startingElo) || 500)));
      const rolloverMode = String(body?.rolloverMode || "monthly").toLowerCase() === "manual" ? "manual" : "monthly";
      const rolloverDay = Math.max(1, Math.min(28, Math.round(Number(body?.rolloverDay) || 1)));
      const leaderboardMinMatches = Math.max(0, Math.min(100, Math.round(Number(body?.leaderboardMinMatches) || 0)));

      const updates: Record<string, unknown> = {
        starting_elo: startingElo,
        rollover_mode: rolloverMode,
        rollover_day: rolloverDay,
        leaderboard_min_matches: leaderboardMinMatches,
        updated_at: new Date().toISOString(),
      };
      if (seasonName) updates.season_name = seasonName;

      const { data: updatedConfig, error: updateError } = await supabase
        .from("competition_config")
        .update(updates)
        .eq("id", "main")
        .select("*")
        .single();

      if (updateError) throw updateError;

      await supabase.from("admin_audit_log").insert({
        action: "competition.config.update",
        entity_type: "competition",
        entity_id: "main",
        details: {
          season_name: updatedConfig.season_name,
          starting_elo: updatedConfig.starting_elo,
          rollover_mode: updatedConfig.rollover_mode,
          rollover_day: updatedConfig.rollover_day,
          leaderboard_min_matches: updatedConfig.leaderboard_min_matches,
        },
      });

      return json({ ok: true, current: updatedConfig });
    }

    if (action === "repair-elo") {
      const [{ data: config, error: configError }, { data: state, error: stateError }] = await Promise.all([
        supabase
          .from("competition_config")
          .select("season_number,season_started_at,starting_elo")
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
      const startingElo = Math.max(500, Number(config?.starting_elo || 500));
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
        const firstHistoryElo = Number(
          Array.isArray(player?.eloHistory) && player.eloHistory.length
            ? player.eloHistory[0]?.elo
            : NaN
        );
        const baseline = baselines.get(id) || {
          elo: Number.isFinite(firstHistoryElo) ? Math.max(500, Math.round(firstHistoryElo)) : startingElo,
          at: seasonStartedAt,
        };
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

        const oldElo = Math.round(Number(player?.currentElo) || startingElo);
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
    const startingElo = Math.max(500, Number(config?.starting_elo || 500));
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
      .select("id,challenger_player_id,challenged_player_id,amount_cents,payment_received_at,reported_winner_player_id,status,verified_at,source,created_at")
      .eq("season_number", currentSeason);

    if (challengeError) throw challengeError;

    const completed = (challengeRows || []).filter((row: any) => row.status === "completed");
    const settled = completed.filter((row: any) => row.payment_received_at);
    const volumeCents = settled.reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0);
    const awards = buildSeasonAwards({
      players,
      matches,
      challenges: challengeRows || [],
      startingElo,
      seasonNumber: currentSeason,
      seasonName: currentName,
    });

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
        awards,
      }, { onConflict: "season_number" });

    if (archiveError) throw archiveError;

    const nextSeason = currentSeason + 1;
    const nextName = String(body?.seasonName || `Season ${nextSeason}`).trim().slice(0, 60) || `Season ${nextSeason}`;
    const resetStats = body?.resetStats !== false;

    if (resetStats) {
      const nextPlayers = players.map((player: any) => resetPlayer(player, startingElo));
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
