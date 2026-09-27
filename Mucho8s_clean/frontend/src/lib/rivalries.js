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
      history: [],
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
    const pairingAmountByKey = Object.fromEntries(
      (Array.isArray(match.pairings) ? match.pairings : [])
        .map((pair) => {
          const a = String(pair?.playerAId || "");
          const b = String(pair?.playerBId || "");
          const amount = Math.max(0, Number(pair?.amount) || 0);
          return a && b ? [pairKey(a, b), amount] : null;
        })
        .filter(Boolean)
    );

    teamA.forEach((a) => {
      teamB.forEach((b) => {
        const row = ensurePair(pairs, a, b);
        const winnerId = winnerSet.has(a) ? a : b;
        const amount = Math.max(0, Number(pairingAmountByKey[pairKey(a, b)] || 0));

        row.meetings += 1;
        row.teamMeetings += 1;
        if (winnerId === row.playerAId) row.playerAWins += 1;
        if (winnerId === row.playerBId) row.playerBWins += 1;
        row.moneyVolume += amount;
        row.playerANet += amount
          ? winnerId === row.playerAId
            ? amount
            : -amount
          : 0;
        row.history.push({
          id: String(match.id || `team-${date || row.meetings}`),
          type: "team",
          date,
          winnerId,
          amount,
          game: match.game || "",
          mode: match.mode || "",
          format: `${teamA.length}v${teamB.length}`,
        });
        touchLastMeeting(row, date, winnerId);
      });
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
      row.history.push({
        id: String(challenge.id || `1v1-${date || row.meetings}`),
        type: "1v1",
        date,
        winnerId,
        amount,
        platform: String(challenge.platform || "").toLowerCase(),
        game: challenge.game || "",
        mode: challenge.mode || "",
        format: "1v1",
      });
      touchLastMeeting(row, date, winnerId);
    });

  return [...pairs.values()]
    .map((row) => {
      const history = [...row.history].sort(
        (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
      );
      const recentFive = history.slice(0, 5);
      const streakWinnerId = history[0]?.winnerId || null;
      let currentStreak = 0;

      for (const item of history) {
        if (!streakWinnerId || item.winnerId !== streakWinnerId) break;
        currentStreak += 1;
      }

      return {
        ...row,
        history,
        recentFive,
        streakWinnerId,
        currentStreak,
        scoreDiff: Math.abs(row.playerAWins - row.playerBWins),
      };
    })
    .sort((a, b) => {
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
