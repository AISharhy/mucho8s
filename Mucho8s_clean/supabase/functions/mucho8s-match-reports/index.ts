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

const errorMessage = (error: unknown) => {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const message = typeof value.message === "string" ? value.message.trim() : "";
    const details = typeof value.details === "string" ? value.details.trim() : "";
    const hint = typeof value.hint === "string" ? value.hint.trim() : "";
    const code = typeof value.code === "string" ? value.code.trim() : "";

    if (message) {
      const extra = details || hint || code;
      return extra && extra !== message ? `${message} — ${extra}` : message;
    }

    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to the safe generic message below.
    }
  }

  return "Unexpected match verification error";
};

const BASE_ELO = 1000;
const MIN_ELO = 500;
const WIN_DELTA = 25;
const LOSS_DELTA = 15;
const MVP_BONUS = 5;
const MVP_DENIAL_BONUS = 3;
const ELO_K = 50;
const ELO_SCALE = 400;
const MIN_RESULT_DELTA = 5;
const MAX_RESULT_DELTA = 45;

const COMPETITIVE_MAP_POOLS: Record<string, Record<string, string[]>> = {
  BO7: {
    "Search & Destroy": ["Den", "Frequency", "Gridlock", "Raid", "Scar", "Standoff", "Hacienda"],
    Hardpoint: ["Colossus", "Den", "Gridlock", "Frequency", "Scar", "Hacienda"],
  },
  BO6: {
    "Search & Destroy": ["Protocol", "Rewind", "Skyline", "Vault", "Hacienda", "Firing Range", "Fringe"],
    Hardpoint: ["Hacienda", "Protocol", "Red Card", "Skyline", "Vault"],
  },
  MW3: {
    "Search & Destroy": ["Highrise", "Invasion", "Karachi", "Rio", "6 Star", "Scrapyard"],
    Hardpoint: ["Sub Base", "Vista", "6 Star", "Karachi", "Rio"],
  },
  VG: {
    "Search & Destroy": ["Tuscan", "Berlin", "Bocage", "USS Texas", "Demyansk"],
    Hardpoint: ["Tuscan", "Gavutu", "Berlin", "Bocage"],
  },
  CW: {
    "Search & Destroy": ["Checkmate", "Moscow", "Raid", "Express", "Standoff", "Miami"],
    Hardpoint: ["Apocalypse", "Checkmate", "Garrison", "Moscow", "Raid"],
  },
  WW2: {
    Hardpoint: ["Ardennes Forest", "Gibraltar", "London Docks", "Sainte Marie du Mont"],
    "Search & Destroy": ["Ardennes Forest", "London Docks", "Sainte Marie du Mont", "USS Texas"],
  },
  BO2: {
    "Search & Destroy": ["Cargo", "Express", "Raid", "Slums", "Standoff", "Meltdown"],
    Hardpoint: ["Raid", "Standoff", "Slums", "Yemen"],
  },
};

const competitiveMapPool = (game: string, mode: string, format: string) => {
  let pool = mode === "CDL Mix" ? [...(COMPETITIVE_MAP_POOLS?.[game]?.Hardpoint || []), ...(COMPETITIVE_MAP_POOLS?.[game]?.["Search & Destroy"] || [])] : [...(COMPETITIVE_MAP_POOLS?.[game]?.[mode] || [])];

  if (game === "MW3" && ["Search & Destroy","CDL Mix"].includes(mode) && format !== "2v2") {
    pool = pool.filter((map) => map !== "Scrapyard");
  }
  if (game === "CW" && ["Search & Destroy","CDL Mix"].includes(mode) && format === "2v2") {
    pool = pool.filter((map) => map !== "Miami");
  }

  return [...new Set(pool)];
};

const secureRandom = () => {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] / 0x100000000;
};

const drawSeriesMaps = (
  game: string,
  mode: string,
  format: string,
  bestOf: number,
  recentMatches: any[] = [],
) => {
  const seriesLength = [3,5,7].includes(bestOf) ? bestOf : 3;
  const pool = competitiveMapPool(game, mode, format);
  if (!pool.length) return [];

  // Random, but history-aware: maps that have not appeared recently get
  // progressively more weight. Maps from the immediately previous matching
  // series are strongly cooled down whenever alternatives exist.
  const relevant = [...recentMatches]
    .filter((match: any) =>
      String(match?.game || "") === game &&
      String(match?.mode || "") === mode
    )
    .sort((a: any, b: any) =>
      new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
    )
    .slice(0, 8);

  const lastSeen = new Map<string, number>();
  const usage = new Map<string, number>();
  relevant.forEach((match: any, matchIndex: number) => {
    const played = Array.isArray(match?.maps) && match.maps.length
      ? match.maps.map(String)
      : (match?.map ? [String(match.map)] : []);
    [...new Set(played)].forEach((map) => {
      usage.set(map, (usage.get(map) || 0) + 1);
      if (!lastSeen.has(map)) lastSeen.set(map, matchIndex);
    });
  });

  const previousMaps = new Set(
    relevant.length
      ? (Array.isArray(relevant[0]?.maps) && relevant[0].maps.length
          ? relevant[0].maps.map(String)
          : (relevant[0]?.map ? [String(relevant[0].map)] : []))
      : []
  );

  const remaining = [...pool];
  const picked: string[] = [];
  while (picked.length < seriesLength && remaining.length) {
    const alternativesOutsidePrevious =
      remaining.filter((map) => !previousMaps.has(map)).length;
    const weights = remaining.map((map) => {
      const seenAgo = lastSeen.has(map) ? Number(lastSeen.get(map)) : relevant.length + 3;
      const timesUsed = usage.get(map) || 0;
      let weight = 1 + seenAgo * 2.5;
      weight /= 1 + timesUsed * 0.75;
      if (previousMaps.has(map) && alternativesOutsidePrevious >= (seriesLength - picked.length)) {
        weight *= 0.04;
      }
      return Math.max(0.01, weight);
    });

    const total = weights.reduce((sum, value) => sum + value, 0);
    let roll = secureRandom() * total;
    let selectedIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        selectedIndex = index;
        break;
      }
    }
    picked.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  while (picked.length < seriesLength && pool.length) picked.push(pool[Math.floor(secureRandom() * pool.length)]);
  return picked;
};

const expectedEloScore = (elo: number, opponentElo: number) =>
  1 / (1 + Math.pow(10, (opponentElo - elo) / ELO_SCALE));

const eloResultDelta = (elo: number, opponentElo: number, won: boolean) => {
  const expected = expectedEloScore(elo, opponentElo);
  const raw = ELO_K * ((won ? 1 : 0) - expected);
  const magnitude = Math.max(
    MIN_RESULT_DELTA,
    Math.min(MAX_RESULT_DELTA, Math.round(Math.abs(raw))),
  );
  return won ? magnitude : -magnitude;
};

const averageTeamElo = (byId: Record<string, any>, ids: string[]) => {
  const values = ids
    .map((id) => Number(byId[id]?.currentElo || BASE_ELO))
    .filter(Number.isFinite);
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : BASE_ELO;
};

const upsetAdjustmentFromAverages = (
  averageA: number,
  averageB: number,
  winner: string,
) => {
  const winnerAverage = winner === "B" ? averageB : averageA;
  const loserAverage = winner === "B" ? averageA : averageB;
  const difference = Math.max(0, Math.round(Math.abs(averageA - averageB)));

  if (winnerAverage >= loserAverage || difference < 100) {
    return {
      applied: false,
      averageA,
      averageB,
      difference,
      winnerBonus: 0,
      loserPenalty: 0,
    };
  }

  if (difference >= 400) {
    return { applied: true, averageA, averageB, difference, winnerBonus: 5, loserPenalty: 3 };
  }
  if (difference >= 300) {
    return { applied: true, averageA, averageB, difference, winnerBonus: 4, loserPenalty: 3 };
  }
  if (difference >= 200) {
    return { applied: true, averageA, averageB, difference, winnerBonus: 3, loserPenalty: 2 };
  }
  return { applied: true, averageA, averageB, difference, winnerBonus: 2, loserPenalty: 1 };
};

const teamUpsetAdjustment = (
  byId: Record<string, any>,
  teamA: string[],
  teamB: string[],
  winner: string,
) => upsetAdjustmentFromAverages(
  averageTeamElo(byId, teamA),
  averageTeamElo(byId, teamB),
  winner,
);

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
    placementRequired: Math.max(0, Number(player?.placementRequired) || 0),
    placementPlayed: Math.max(0, Number(player?.placementPlayed) || 0),
    placementComplete: player?.placementComplete !== false,
    lifetimePlacementCompleted: player?.lifetimePlacementCompleted === true,
    eloHistory: Array.isArray(player?.eloHistory) && player.eloHistory.length
      ? player.eloHistory
      : [{ match: 0, elo: current }],
  };
};

const automaticMvpIds = (byId: Record<string, any>, winners: string[]) =>
  winners.filter((id) => {
    const current = Number(byId[id]?.currentStreak || 0);
    const nextWinStreak = current > 0 ? current + 1 : 1;
    return nextWinStreak >= 3 && nextWinStreak % 3 === 0;
  });

const automaticMerdaIds = (byId: Record<string, any>, losers: string[]) =>
  losers.filter((id) => {
    const current = Number(byId[id]?.currentStreak || 0);
    const nextLossStreak = current < 0 ? Math.abs(current) + 1 : 1;
    // MERDA starts at 3 straight losses, then every further loss in the same
    // losing streak adds another one: LLL=1, LLLL=2, LLLLL=3...
    return nextLossStreak >= 3;
  });

const automaticMerdaClearedIds = (byId: Record<string, any>, winners: string[]) =>
  winners.filter((id) => Number(byId[id]?.merdaCount || 0) > 0);

const applyEffects = (
  byId: Record<string, any>,
  teamA: string[],
  teamB: string[],
  winner: string,
  mvpIds: string[] = [],
  merdaIds: string[] = [],
  merdaClearedIds: string[] = [],
  mvpDenialBonus = 0,
) => {
  const winners = winner === "A" ? teamA : teamB;
  const mvpSet = new Set(mvpIds);
  const merdaSet = new Set(merdaIds);
  const clearedSet = new Set(merdaClearedIds);
  const changes: Record<string, number> = {};
  const upset = teamUpsetAdjustment(byId, teamA, teamB, winner);

  [...teamA, ...teamB].forEach((id) => {
    const player = byId[id];
    if (!player) return;

    const won = winners.includes(id);
    let delta = won ? WIN_DELTA : -LOSS_DELTA;
    if (upset.applied) {
      delta += won ? upset.winnerBonus : -upset.loserPenalty;
    }
    if (mvpSet.has(id)) delta += MVP_BONUS;
    if (won && mvpDenialBonus > 0) delta += mvpDenialBonus;

    const nextElo = Math.max(MIN_ELO, Number(player.currentElo || BASE_ELO) + delta);
    player.currentElo = nextElo;
    player.peakElo = Math.max(Number(player.peakElo || nextElo), nextElo);
    player.totalMatches = Math.max(0, Number(player.totalMatches || 0)) + 1;
    if (Number(player.placementRequired || 0) > 0 && player.placementComplete !== true) {
      player.placementPlayed = Math.min(
        Number(player.placementRequired),
        Math.max(0, Number(player.placementPlayed || 0)) + 1,
      );
      if (player.placementPlayed >= Number(player.placementRequired)) {
        player.placementComplete = true;
        player.lifetimePlacementCompleted = true;
      }
    }
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
      const losers = match?.winner === "B" ? teamA : teamB;
      const winnerSet = new Set(winners);
      const mvpBountyStoppedIds = losers.filter((id) => {
        const current = Number(byId[id]?.currentStreak || 0);
        return current > 0 && current % 3 === 2;
      });
      const mvpBountyBonus = mvpBountyStoppedIds.length ? MVP_DENIAL_BONUS : 0;
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

        if (won && nextStreak >= 3 && nextStreak % 3 === 0) {
          player.mvpCount = Math.max(0, Number(player.mvpCount || 0)) + 1;
          mvpIds.push(id);
        }

        if (!won && Math.abs(nextStreak) >= 3) {
          player.merdaCount = Math.max(0, Number(player.merdaCount || 0)) + 1;
          merdaIds.push(id);
        }

        if (won && Number(player.merdaCount || 0) > 0) {
          // Each win clears exactly one MERDA, even if more are still active.
          player.merdaCount = Math.max(0, Number(player.merdaCount || 0) - 1);
          merdaClearedIds.push(id);
        }
      });

      const mvpSet = new Set(mvpIds);
      const storedAverageA = Number(match?.teamAverageEloA);
      const storedAverageB = Number(match?.teamAverageEloB);
      const upset =
        Number.isFinite(storedAverageA) && Number.isFinite(storedAverageB)
          ? upsetAdjustmentFromAverages(
              storedAverageA,
              storedAverageB,
              match?.winner === "B" ? "B" : "A",
            )
          : teamUpsetAdjustment(byId, teamA, teamB, match?.winner === "B" ? "B" : "A");
      const nextChanges: Record<string, number> = {};

      [...teamA, ...teamB].forEach((id) => {
        const player = byId[id];
        if (!player) return;

        const won = winnerSet.has(id);
        const oldDelta = Number(match?.eloChanges?.[id] || 0);
        const upsetDelta = upset.applied
          ? (won ? upset.winnerBonus : -upset.loserPenalty)
          : 0;
        const nextDelta =
          (won ? WIN_DELTA : -LOSS_DELTA) +
          upsetDelta +
          (mvpSet.has(id) ? MVP_BONUS : 0) +
          (won ? mvpBountyBonus : 0);

        if (oldDelta !== nextDelta) {
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
      match.mvpBountyBonus = mvpBountyBonus;
      match.mvpBountyStoppedIds = mvpBountyStoppedIds;
      match.mvpBountyRecipientIds = mvpBountyBonus > 0 ? winners : [];
      match.teamAverageEloA = Math.round(upset.averageA);
      match.teamAverageEloB = Math.round(upset.averageB);
      match.upsetApplied = upset.applied;
      match.upsetEloDifference = upset.difference;
      match.upsetWinnerBonus = upset.winnerBonus;
      match.upsetLoserPenalty = upset.loserPenalty;
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
  return Math.max(0, Number(data?.season_number ?? 1));
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
      // Admin verification closes report-based Money Match settlement too.
      // Players must not need to confirm payment again after the report is locked.
      payment_sent_at: verifiedAt,
      payment_received_at: verifiedAt,
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
  let liveDurationMinutes: number | null = null;

  const { data: liveTiming, error: liveTimingError } = await supabase
    .from("live_team_matches")
    .select("created_at,closed_at")
    .eq("match_id", report.match_id)
    .maybeSingle();

  if (liveTimingError) throw liveTimingError;
  if (liveTiming?.created_at) {
    const startedAt = new Date(liveTiming.created_at).getTime();
    const finishedAt = new Date(liveTiming.closed_at || report.played_at || verifiedAt).getTime();
    if (Number.isFinite(startedAt) && Number.isFinite(finishedAt) && finishedAt >= startedAt) {
      liveDurationMinutes = Math.max(1, Math.round((finishedAt - startedAt) / 60000));
    }
  }

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
    const mvpBountyStoppedIds = losers.filter((id) => {
      const current = Number(byId[id]?.currentStreak || 0);
      return current > 0 && current % 3 === 2;
    });
    const mvpBountyBonus = mvpBountyStoppedIds.length ? MVP_DENIAL_BONUS : 0;
    const mvpIds = automaticMvpIds(byId, winners);
    const merdaIds = automaticMerdaIds(byId, losers);
    const merdaClearedIds = automaticMerdaClearedIds(byId, winners);
    awardedMvpIds = mvpIds;
    awardedMerdaIds = merdaIds;
    const upset = teamUpsetAdjustment(byId, teamA, teamB, report.winner);
    const eloChanges = applyEffects(
      byId,
      teamA,
      teamB,
      report.winner,
      mvpIds,
      merdaIds,
      merdaClearedIds,
      mvpBountyBonus,
    );

    const match = {
      id: report.match_id,
      date: report.played_at || report.created_at || verifiedAt,
      durationMinutes: liveDurationMinutes,
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
      mvpBountyBonus,
      mvpBountyStoppedIds,
      mvpBountyRecipientIds: mvpBountyBonus > 0 ? winners : [],
      teamAverageEloA: Math.round(upset.averageA),
      teamAverageEloB: Math.round(upset.averageB),
      upsetApplied: upset.applied,
      upsetEloDifference: upset.difference,
      upsetWinnerBonus: upset.winnerBonus,
      upsetLoserPenalty: upset.loserPenalty,
      map: report.map || (Array.isArray(report.maps) ? report.maps[0] || "" : ""),
      maps: Array.isArray(report.maps) ? report.maps.map(String).slice(0, 7) : [],
      mapResults: Array.isArray(report.map_results) ? report.map_results : [],
      mode: report.mode || "",
      game: report.game || "",
      pairings: Array.isArray(report.pairings) ? report.pairings : [],
      season: Math.max(0, Number(report.season_number ?? 1)),
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

  }

  // Pairing sync is idempotent. Run it on retries too: a previous attempt may
  // have written the team match to app_state and then failed while settling a
  // money pairing. Skipping this when the match already exists would lock the
  // report with missing pairing/Elo data.
  await syncMoneyPairings(
    supabase,
    report,
    verifiedAt,
    verifierAccountId === null && verifierPlayerId === null,
  );

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
        .select("id,match_id,team_a,team_b,game,mode,format,maps,captain_player_id,status,created_at,cancel_requested_at,cancel_requested_by_player_id,pairings")
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
      const pairings = (Array.isArray(body?.pairings) ? body.pairings : [])
        .map((pair: any) => ({
          playerAId: String(pair?.playerAId || "").trim(),
          playerBId: String(pair?.playerBId || "").trim(),
          amount: Number(pair?.amount),
          platform: String(pair?.platform || "paypal").trim().toLowerCase(),
          payerPlayerId: String(pair?.payerPlayerId || "").trim(),
        }))
        .filter((pair: any) =>
          teamA.includes(pair.playerAId) &&
          teamB.includes(pair.playerBId) &&
          [pair.playerAId, pair.playerBId].includes(pair.payerPlayerId) &&
          Number.isFinite(pair.amount) &&
          pair.amount >= 0 &&
          SUPPORTED_MATCH_PLATFORMS.has(pair.platform)
        );
      const creatorPlayerId = String(account?.player_id || "").trim();
      const creatorInLobby = [...teamA, ...teamB].includes(creatorPlayerId);
      const game = String(body?.game || "").trim();
      const mode = String(body?.mode || "").trim();
      const format = String(body?.format || "").trim();
      const bestOf = [3,5,7].includes(Number(body?.bestOf)) ? Number(body.bestOf) : 3;
      const pool = competitiveMapPool(game, mode, format);
      const requestedMaps = Array.isArray(body?.maps)
        ? body.maps.map((map: unknown) => String(map || "").trim()).filter(Boolean)
        : [];

      let seriesMaps: string[] = [];
      if (requestedMaps.length) {
        const uniqueMaps = [...new Set(requestedMaps)];
        const validManualRotation =
          requestedMaps.length === bestOf &&
          (bestOf === 7 || uniqueMaps.length === bestOf) &&
          requestedMaps.every((map,index) => {
            if (mode !== "CDL Mix") return pool.includes(map);
            const requestedModes = Array.isArray(body?.mapModes) ? body.mapModes : [];
            const slotMode = requestedModes[index];
            return ["Hardpoint","Search & Destroy"].includes(slotMode) && competitiveMapPool(game,slotMode,format).includes(map);
          });

        if (!validManualRotation) {
          return json({ error: "Manual map rotation is invalid for this game/mode/format" }, 400);
        }
        seriesMaps = requestedMaps;
      } else {
        const { data: mapHistoryState, error: mapHistoryError } = await supabase
          .from("app_state")
          .select("matches")
          .eq("id", "main")
          .maybeSingle();
        if (mapHistoryError) throw mapHistoryError;
        seriesMaps = drawSeriesMaps(
          game,
          mode,
          format,
          bestOf,
          Array.isArray(mapHistoryState?.matches) ? mapHistoryState.matches : [],
        );
      }

      if (teamA.length < 2 || teamA.length > 4 || teamA.length !== teamB.length) {
        return json({ error: "Teams must contain the same number of players (2-4)" }, 400);
      }

      if (pairings.length < teamA.length) {
        return json({ error: "Every player must have at least one Money Chall pairing" }, 400);
      }

      const livePairKeys = new Set<string>();
      const coveredLiveA = new Set<string>();
      const coveredLiveB = new Set<string>();

      for (const pair of pairings) {
        const key = `${pair.playerAId}:${pair.playerBId}`;
        if (livePairKeys.has(key)) {
          return json({ error: "The same Money Chall pairing cannot be added twice" }, 400);
        }
        livePairKeys.add(key);
        coveredLiveA.add(pair.playerAId);
        coveredLiveB.add(pair.playerBId);
      }

      if (coveredLiveA.size !== teamA.length || coveredLiveB.size !== teamB.length) {
        return json({ error: "Every player must appear in at least one Money Chall pairing" }, 400);
      }

      if (seriesMaps.length !== bestOf) {
        return json({
          error: game === "MW4"
            ? "MW4 competitive map pool is not configured yet"
            : `No competitive BO${bestOf} map pool is configured for this game/mode/format`,
        }, 400);
      }
      if (!isAdmin && !creatorInLobby) {
        return json({ error: "The match creator must be one of the players in the lobby" }, 403);
      }

      if (user?.id) {
        const { data: existingLive, error: existingLiveError } = await supabase
          .from("live_team_matches")
          .select("id,cancel_requested_at")
          .eq("creator_account_id", user.id)
          .eq("status", "live")
          .limit(1);

        if (existingLiveError) throw existingLiveError;
        if (existingLive?.length) {
          return json({
            error: existingLive[0]?.cancel_requested_at
              ? "Your current live match is waiting for Admin cancellation"
              : "You already have an active live match",
          }, 409);
        }
      }

      const row = {
        match_id: crypto.randomUUID(),
        team_a: teamA,
        team_b: teamB,
        game,
        mode,
        format,
        maps: seriesMaps,
        pairings,
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

    if (action === "list-live-messages" || action === "send-live-message") {
      const liveId = String(body?.id || "").trim();
      if (!liveId) return json({ error: "Live match id is required" }, 400);

      const { data: liveMatch, error: liveError } = await supabase
        .from("live_team_matches")
        .select("id,team_a,team_b,status")
        .eq("id", liveId)
        .maybeSingle();

      if (liveError) throw liveError;
      if (!liveMatch || liveMatch.status !== "live") {
        return json({ error: "This Mucho8s is no longer live" }, 409);
      }

      const playerId = String(account?.player_id || "").trim();
      const participants = [
        ...(Array.isArray(liveMatch.team_a) ? liveMatch.team_a.map(String) : []),
        ...(Array.isArray(liveMatch.team_b) ? liveMatch.team_b.map(String) : []),
      ];
      const participant = Boolean(playerId && participants.includes(playerId));

      if (!isAdmin && !participant) {
        return json({ error: "Match chat is private to Mucho8s players" }, 403);
      }

      if (action === "list-live-messages") {
        const { data, error } = await supabase
          .from("live_match_messages")
          .select("id,live_match_id,sender_player_id,body,created_at")
          .eq("live_match_id", liveId)
          .order("created_at", { ascending: true })
          .limit(200);

        if (error) throw error;
        return json({ ok: true, messages: data || [] });
      }

      const message = String(body?.message || "").trim();
      if (!message) return json({ error: "Message is empty" }, 400);
      if (message.length > 500) return json({ error: "Message is too long" }, 400);

      const senderPlayerId = playerId || "__admin__";
      const { data, error } = await supabase
        .from("live_match_messages")
        .insert({
          live_match_id: liveId,
          sender_account_id: user?.id || null,
          sender_player_id: senderPlayerId,
          body: message,
        })
        .select("id,live_match_id,sender_player_id,body,created_at")
        .single();

      if (error) throw error;
      return json({ ok: true, message: data });
    }

    if (action === "request-cancel-live") {
      const liveId = String(body?.id || "").trim();
      if (!liveId) return json({ error: "Live match id is required" }, 400);
      if (!account?.player_id) {
        return json({ error: "Login with a linked Discord account first" }, 401);
      }

      const { data: liveMatch, error: liveError } = await supabase
        .from("live_team_matches")
        .select("*")
        .eq("id", liveId)
        .maybeSingle();

      if (liveError) throw liveError;
      if (!liveMatch || liveMatch.status !== "live") {
        return json({ error: "This live match is no longer active" }, 409);
      }

      if (String(liveMatch.captain_player_id || "") !== String(account.player_id)) {
        return json({ error: "Only the match captain can request cancellation" }, 403);
      }

      const requestedAt = new Date().toISOString();
      const { data, error } = await supabase
        .from("live_team_matches")
        .update({
          cancel_requested_at: requestedAt,
          cancel_requested_by_player_id: account.player_id,
        })
        .eq("id", liveId)
        .eq("status", "live")
        .select("*")
        .single();

      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        action: "match.cancel_requested",
        entity_type: "live_match",
        entity_id: liveId,
        details: {
          captain_player_id: account.player_id,
          match_id: liveMatch.match_id,
        },
      });

      return json({ ok: true, liveMatch: data });
    }

    if (action === "cancel-live") {
      const liveId = String(body?.id || "").trim();
      if (!liveId) return json({ error: "Live match id is required" }, 400);
      if (!isAdmin) {
        return json({ error: "Only Admin can cancel a live match" }, 403);
      }

      const { data: liveMatch, error: liveError } = await supabase
        .from("live_team_matches")
        .select("*")
        .eq("id", liveId)
        .maybeSingle();

      if (liveError) throw liveError;
      if (!liveMatch) return json({ ok: true });

      const closedAt = new Date().toISOString();
      const { error } = await supabase
        .from("live_team_matches")
        .update({
          status: "cancelled",
          closed_at: closedAt,
          cancel_requested_at: null,
          cancel_requested_by_player_id: null,
        })
        .eq("id", liveId)
        .eq("status", "live");

      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        action: "match.cancelled",
        entity_type: "live_match",
        entity_id: liveId,
        details: {
          match_id: liveMatch.match_id,
          requested: Boolean(liveMatch.cancel_requested_at),
        },
      });

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
      const mapResults = (Array.isArray(body?.mapResults) ? body.mapResults : [])
        .map((row: any) => ({
          map: String(row?.map || "").trim(),
          winner: String(row?.winner || "").trim().toUpperCase(),
        }))
        .filter((row: any) => row.map && ["A", "B"].includes(row.winner));
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
      if (pairings.length < teamA.length) {
        return json({ error: "Every player must have at least one Money Chall pairing" }, 400);
      }

      const pairingKeys = new Set<string>();
      const coveredA = new Set<string>();
      const coveredB = new Set<string>();

      for (const pair of pairings) {
        const validPlayers = teamA.includes(pair.playerAId) && teamB.includes(pair.playerBId);
        const validAmount = Number.isFinite(pair.amount) && pair.amount >= 0;
        const validPlatform = SUPPORTED_MATCH_PLATFORMS.has(pair.platform);

        if (!validPlayers || !validAmount || !validPlatform) {
          return json({ error: "Each matchup must use a valid amount with PayPal or Revolut" }, 400);
        }

        const pairingKey = `${pair.playerAId}:${pair.playerBId}`;
        if (pairingKeys.has(pairingKey)) {
          return json({ error: "The same Money Chall pairing cannot be added twice" }, 400);
        }

        pairingKeys.add(pairingKey);
        coveredA.add(pair.playerAId);
        coveredB.add(pair.playerBId);
      }

      if (coveredA.size !== teamA.length || coveredB.size !== teamB.length) {
        return json({ error: "Every player must appear in at least one Money Chall pairing" }, 400);
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

        if (mapResults.length) {
          const scheduledMaps = Array.isArray(liveRow.maps) ? liveRow.maps.map(String).slice(0, 7) : [];
          const winsNeeded = Math.ceil(scheduledMaps.length / 2);
          const alphaWins = mapResults.filter((row: any) => row.winner === "A").length;
          const bravoWins = mapResults.filter((row: any) => row.winner === "B").length;
          const resultWinner = alphaWins >= winsNeeded ? "A" : bravoWins >= winsNeeded ? "B" : "";
          const mapsMatch = mapResults.every((row: any, index: number) => row.map === scheduledMaps[index]);
          if (!mapsMatch || !resultWinner || resultWinner !== winner || alphaWins !== Math.round(scoreA) || bravoWins !== Math.round(scoreB)) {
            return json({ error: "Map results do not match the reported series score" }, 400);
          }
        }
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
        maps: Array.isArray(liveMatch?.maps) ? liveMatch.maps.map(String).slice(0, 7) : [],
        map_results: mapResults,
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
    return json({ error: errorMessage(error) }, 500);
  }
});
