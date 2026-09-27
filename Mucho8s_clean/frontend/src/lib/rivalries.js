const safeIds = (value) =>
  (Array.isArray(value) ? value : []).map((id) => String(id || "")).filter(Boolean);

const pairKey = (a, b) => [String(a), String(b)].sort().join("::");

const ensurePair = (map, a, b) => {
  const key = pairKey(a, b);
  if (!map.has(key)) {
    const [playerAId, playerBId] = [String(a), String(b)].sort();
    map.set(key, {
      key,
      playerAId,
      playerBId,
      meetings: 0,
      playerAWins: 0,
      playerBWins: 0,
      moneyVolume: 0,
      playerANet: 0,
      lastMeetingAt: null,
      lastWinnerId: null,
      teamMeetings: 0,
      directMeetings: 0,
    });
  }
  return map.get(key);
};

const touchLastMeeting = (row, date, winnerId) => {
  const time = new Date(date || 0).getTime();
  const current = new Date(row.lastMeetingAt || 0).getTime();
  if (!row.lastMeetingAt || time >= current) {
    row.lastMeetingAt = date || null;
    row.lastWinnerId = winnerId || null;
  }
};

export const buildRivalries = (matches = [], challenges = []) => {
  const pairs = new Map();

  (Array.isArray(matches) ? matches : []).filter(Boolean).forEach((match) => {
    const teamA = safeIds(match.teamA);
    const teamB = safeIds(match.teamB);
    if (!teamA.length || !teamB.length) return;

    const winnerTeam = match.winner === "B" ? teamB : teamA;
    const winnerSet = new Set(winnerTeam);
    const date = match.verifiedAt || match.date || null;

    teamA.forEach((a) => {
      teamB.forEach((b) => {
        const row = ensurePair(pairs, a, b);
        const winnerId = winnerSet.has(a) ? a : b;

        row.meetings += 1;
        row.teamMeetings += 1;
        if (winnerId === row.playerAId) row.playerAWins += 1;
        if (winnerId === row.playerBId) row.playerBWins += 1;
        touchLastMeeting(row, date, winnerId);
      });
    });

    (Array.isArray(match.pairings) ? match.pairings : []).forEach((pair) => {
      const a = String(pair?.playerAId || "");
      const b = String(pair?.playerBId || "");
      const amount = Math.max(0, Number(pair?.amount) || 0);
      if (!a || !b || !amount) return;

      const row = pairs.get(pairKey(a, b));
      if (!row) return;

      const winnerId = match.winner === "B" ? b : a;
      row.moneyVolume += amount;
      row.playerANet += winnerId === row.playerAId ? amount : -amount;
    });
  });

  (Array.isArray(challenges) ? challenges : [])
    .filter((challenge) => {
      const source = String(challenge?.source || "").toLowerCase();
      return (
        !["match_pairing", "balancer_pairing"].includes(source) &&
        challenge?.status === "completed" &&
        challenge?.reported_winner_player_id &&
        (challenge?.verified_at || challenge?.result_reported_at)
      );
    })
    .forEach((challenge) => {
      const challenger = String(challenge.challenger_player_id || "");
      const challenged = String(challenge.challenged_player_id || "");
      if (!challenger || !challenged || challenger === challenged) return;

      const row = ensurePair(pairs, challenger, challenged);
      const winnerId = String(challenge.reported_winner_player_id || "");
      const amount = Math.max(0, Number(challenge.amount_cents || 0) / 100);
      const date =
        challenge.verified_at ||
        challenge.result_reported_at ||
        challenge.created_at ||
        null;

      row.meetings += 1;
      row.directMeetings += 1;
      if (winnerId === row.playerAId) row.playerAWins += 1;
      if (winnerId === row.playerBId) row.playerBWins += 1;
      row.moneyVolume += amount;
      row.playerANet += winnerId === row.playerAId ? amount : -amount;
      touchLastMeeting(row, date, winnerId);
    });

  return [...pairs.values()].sort((a, b) => {
    if (b.meetings !== a.meetings) return b.meetings - a.meetings;
    if (b.moneyVolume !== a.moneyVolume) return b.moneyVolume - a.moneyVolume;
    return new Date(b.lastMeetingAt || 0) - new Date(a.lastMeetingAt || 0);
  });
};

export const buildPlayerRivalries = (playerId, matches = [], challenges = []) =>
  buildRivalries(matches, challenges)
    .filter((row) => row.playerAId === playerId || row.playerBId === playerId)
    .map((row) => {
      const isA = row.playerAId === playerId;
      return {
        ...row,
        playerId,
        opponentId: isA ? row.playerBId : row.playerAId,
        wins: isA ? row.playerAWins : row.playerBWins,
        losses: isA ? row.playerBWins : row.playerAWins,
        moneyNet: isA ? row.playerANet : -row.playerANet,
      };
    })
    .sort((a, b) => {
      if (b.meetings !== a.meetings) return b.meetings - a.meetings;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return new Date(b.lastMeetingAt || 0) - new Date(a.lastMeetingAt || 0);
    });
