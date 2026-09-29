const pairKey = (a, b) => [String(a), String(b)].sort().join("::");

const award = (season, data) => ({
  seasonNumber: Number(season?.season_number ?? data?.seasonNumber ?? 0),
  seasonName: season?.season_name || data?.seasonName || `Season ${season?.season_number || 0}`,
  ...data,
  playerIds: Array.isArray(data?.playerIds) ? data.playerIds.map(String) : [],
});

export const buildSeasonAwardsFromArchive = (season, publicChallenges = []) => {
  const stored = Array.isArray(season?.awards) ? season.awards : [];
  if (stored.length) {
    return stored.map((item) => award(season, item));
  }

  const players = Array.isArray(season?.players) ? season.players : [];
  const matches = Array.isArray(season?.matches) ? season.matches : [];
  const seasonNumber = Number(season?.season_number ?? 0);
  const startingElo = Number(season?.starting_elo ?? 500);
  const playerMap = Object.fromEntries(players.filter((p) => p?.id).map((p) => [String(p.id), p]));
  const active = players.filter((p) =>
    Number(p?.totalMatches || 0) > 0 ||
    Math.round(Number(p?.currentElo || startingElo)) !== Math.round(startingElo)
  );
  const result = [];

  const add = (data) => {
    const ids = [...new Set((data?.playerIds || []).map(String).filter((id) => playerMap[id]))];
    if (!ids.length) return;
    result.push(award(season, { ...data, playerIds: ids }));
  };

  const standings = [...active].sort(
    (a, b) =>
      Number(b?.currentElo || 0) - Number(a?.currentElo || 0) ||
      Number(b?.wins || 0) - Number(a?.wins || 0)
  );

  if (standings[0]) add({
    id: "season-champion", title: "Season Champion", emoji: "🏆", rarity: "legendary", category: "Podium",
    playerIds: [standings[0].id], detail: `Finished #1 in ${season?.season_name || `Season ${seasonNumber}`}`,
    value: `${Math.round(Number(standings[0].currentElo || 0))} Elo`,
  });
  if (standings[1]) add({
    id: "runner-up", title: "Runner-Up", emoji: "🥈", rarity: "epic", category: "Podium",
    playerIds: [standings[1].id], detail: "Finished #2 in the final standings",
    value: `${Math.round(Number(standings[1].currentElo || 0))} Elo`,
  });
  if (standings[2]) add({
    id: "podium-finish", title: "Podium Finish", emoji: "🥉", rarity: "epic", category: "Podium",
    playerIds: [standings[2].id], detail: "Finished #3 in the final standings",
    value: `${Math.round(Number(standings[2].currentElo || 0))} Elo`,
  });

  const peak = [...active].sort(
    (a, b) => Number(b?.peakElo || b?.currentElo || 0) - Number(a?.peakElo || a?.currentElo || 0)
  )[0];
  if (peak) add({
    id: "highest-peak", title: "Highest Peak", emoji: "👑", rarity: "epic", category: "Performance",
    playerIds: [peak.id], detail: "Highest Elo reached during the season",
    value: `${Math.round(Number(peak.peakElo || peak.currentElo || 0))} Elo`,
  });

  const mostActive = [...active].sort(
    (a, b) => Number(b?.totalMatches || 0) - Number(a?.totalMatches || 0)
  )[0];
  if (mostActive && Number(mostActive.totalMatches || 0) > 0) add({
    id: "most-active", title: "Most Active", emoji: "⚔️", rarity: "rare", category: "Performance",
    playerIds: [mostActive.id], detail: "Most recorded Mucho8s appearances",
    value: `${Number(mostActive.totalMatches || 0)} matches`,
  });

  const current = new Map();
  const best = new Map();
  [...matches]
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0))
    .forEach((match) => {
      const a = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
      const b = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
      const winners = match?.winner === "B" ? b : a;
      const losers = match?.winner === "B" ? a : b;
      winners.forEach((id) => {
        const next = Number(current.get(id) || 0) + 1;
        current.set(id, next);
        best.set(id, Math.max(Number(best.get(id) || 0), next));
      });
      losers.forEach((id) => current.set(id, 0));
    });
  const streak = [...best.entries()].sort((a, b) => b[1] - a[1])[0];
  if (streak?.[1] > 1) add({
    id: "longest-win-streak", title: "Longest Win Streak", emoji: "🔥",
    rarity: streak[1] >= 8 ? "epic" : "rare", category: "Performance",
    playerIds: [streak[0]], detail: "Longest Mucho8s winning run of the season", value: `W${streak[1]}`,
  });

  const mvp = [...active].sort((a, b) => Number(b?.mvpCount || 0) - Number(a?.mvpCount || 0))[0];
  if (mvp && Number(mvp.mvpCount || 0) > 0) add({
    id: "mvp-hunter", title: "MVP Hunter", emoji: "🎯", rarity: "rare", category: "Performance",
    playerIds: [mvp.id], detail: "Most automatic MVP awards", value: `${Number(mvp.mvpCount || 0)} MVP`,
  });

  const improved = [...active]
    .map((p) => ({ id: String(p.id), delta: Math.round(Number(p?.currentElo || startingElo) - startingElo) }))
    .sort((a, b) => b.delta - a.delta)[0];
  if (improved?.delta > 0) add({
    id: "most-improved", title: "Most Improved", emoji: "📈",
    rarity: improved.delta >= 250 ? "epic" : "rare", category: "Performance",
    playerIds: [improved.id], detail: "Biggest Elo gain from the season starting Elo", value: `+${improved.delta} Elo`,
  });

  const mvpCounts = new Map();
  const upsetCounts = new Map();
  const clearCounts = new Map();
  matches.forEach((match) => {
    (Array.isArray(match?.mvpIds) ? match.mvpIds : match?.mvpId ? [match.mvpId] : [])
      .map(String).forEach((id) => mvpCounts.set(id, Number(mvpCounts.get(id) || 0) + 1));
    (Array.isArray(match?.merdaClearedIds) ? match.merdaClearedIds : [])
      .map(String).forEach((id) => clearCounts.set(id, Number(clearCounts.get(id) || 0) + 1));
    if (match?.upsetApplied === true) {
      const winners = match?.winner === "B" ? match?.teamB : match?.teamA;
      (Array.isArray(winners) ? winners : []).map(String)
        .forEach((id) => upsetCounts.set(id, Number(upsetCounts.get(id) || 0) + 1));
    }
  });

  const upset = [...upsetCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (upset?.[1] > 0) add({
    id: "upset-king", title: "Upset King", emoji: "🧨", rarity: "rare", category: "Performance",
    playerIds: [upset[0]], detail: "Most wins as the lower-rated side", value: `${upset[1]} upsets`,
  });

  const survivor = [...clearCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (survivor?.[1] > 0) add({
    id: "the-survivor", title: "The Survivor", emoji: "💩", rarity: "rare", category: "Special",
    playerIds: [survivor[0]], detail: "Cleared the most MERDA during the season", value: `${survivor[1]} cleared`,
  });

  const seasonChallenges = (Array.isArray(publicChallenges) ? publicChallenges : []).filter(
    (challenge) => Number(challenge?.season_number ?? -1) === seasonNumber && challenge?.status === "completed"
  );
  const moneyNet = new Map();
  seasonChallenges.forEach((challenge) => {
    const challenger = String(challenge?.challenger_player_id || "");
    const challenged = String(challenge?.challenged_player_id || "");
    const winner = String(challenge?.reported_winner_player_id || "");
    if (!challenger || !challenged || !winner) return;
    const loser = winner === challenger ? challenged : challenger;
    const amount = Math.max(0, Number(challenge?.amount_cents || 0) / 100);
    moneyNet.set(winner, Number(moneyNet.get(winner) || 0) + amount);
    moneyNet.set(loser, Number(moneyNet.get(loser) || 0) - amount);
  });
  const money = [...moneyNet.entries()].sort((a, b) => b[1] - a[1])[0];
  if (money && money[1] > 0) add({
    id: "money-king", title: "Money King", emoji: "💰", rarity: "epic", category: "Money",
    playerIds: [money[0]], detail: "Best verified net result in money matchups", value: `+€${money[1].toFixed(2)}`,
  });

  const duoStats = new Map();
  matches.forEach((match) => {
    const a = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
    const b = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
    const update = (team, won) => {
      for (let i = 0; i < team.length; i += 1) {
        for (let j = i + 1; j < team.length; j += 1) {
          const key = pairKey(team[i], team[j]);
          const ids = [team[i], team[j]].sort();
          const row = duoStats.get(key) || { a: ids[0], b: ids[1], games: 0, wins: 0 };
          row.games += 1;
          if (won) row.wins += 1;
          duoStats.set(key, row);
        }
      }
    };
    update(a, match?.winner !== "B");
    update(b, match?.winner === "B");
  });
  const duo = [...duoStats.values()]
    .filter((row) => row.games >= 3)
    .sort((a, b) => (b.wins / b.games) - (a.wins / a.games) || b.games - a.games)[0];
  if (duo) add({
    id: "best-chemistry", title: "Best Chemistry", emoji: "🤝", rarity: "rare", category: "Duo",
    playerIds: [duo.a, duo.b], detail: "Best-performing duo with at least 3 matches together",
    value: `${duo.wins}-${duo.games - duo.wins}`,
  });

  const rivalries = new Map();
  const touch = (aRaw, bRaw, winnerRaw, amount = 0) => {
    const a0 = String(aRaw || "");
    const b0 = String(bRaw || "");
    const winner = String(winnerRaw || "");
    if (!a0 || !b0 || a0 === b0 || !winner) return;
    const [a, b] = [a0, b0].sort();
    const key = pairKey(a, b);
    const row = rivalries.get(key) || { a, b, meetings: 0, aWins: 0, bWins: 0, money: 0 };
    row.meetings += 1;
    if (winner === a) row.aWins += 1;
    if (winner === b) row.bWins += 1;
    row.money += Math.max(0, Number(amount || 0));
    rivalries.set(key, row);
  };

  matches.forEach((match) => {
    const a = (Array.isArray(match?.teamA) ? match.teamA : []).map(String);
    const b = (Array.isArray(match?.teamB) ? match.teamB : []).map(String);
    const winners = new Set(match?.winner === "B" ? b : a);
    const pairingAmounts = Object.fromEntries(
      (Array.isArray(match?.pairings) ? match.pairings : [])
        .map((p) => [pairKey(p?.playerAId, p?.playerBId), Number(p?.amount || 0)])
    );
    a.forEach((left) => b.forEach((right) =>
      touch(left, right, winners.has(left) ? left : right, pairingAmounts[pairKey(left, right)] || 0)
    ));
  });

  seasonChallenges
    .filter((challenge) => !["match_pairing", "balancer_pairing"].includes(String(challenge?.source || "").toLowerCase()))
    .forEach((challenge) => touch(
      challenge.challenger_player_id,
      challenge.challenged_player_id,
      challenge.reported_winner_player_id,
      Number(challenge.amount_cents || 0) / 100
    ));

  const rivalry = [...rivalries.values()]
    .filter((row) => row.meetings >= 2)
    .sort((a, b) =>
      b.meetings - a.meetings ||
      Math.abs(a.aWins - a.bWins) - Math.abs(b.aWins - b.bWins) ||
      b.money - a.money
    )[0];
  if (rivalry) add({
    id: "rivalry-of-season", title: "Rivalry of the Season", emoji: "⚡", rarity: "epic", category: "Rivalry",
    playerIds: [rivalry.a, rivalry.b], detail: "The season's most active head-to-head battle",
    value: `${rivalry.aWins}-${rivalry.bWins} · ${rivalry.meetings} meetings`,
  });

  return result;
};

export const getSeasonAwards = (season, publicChallenges = []) =>
  buildSeasonAwardsFromArchive(season, publicChallenges);
