import { balanceRankedLobby, validateRankedCandidates } from "./rankedMatchmaking";

const roster = [980, 1020, 1100, 900, 1000, 1030, 970, 1000].map((elo, index) => ({
  id: `player-${index + 1}`, elo,
}));

test("returns two disjoint teams of four containing all players", () => {
  const { teamA, teamB } = balanceRankedLobby(roster);
  expect(teamA).toHaveLength(4);
  expect(teamB).toHaveLength(4);
  expect(new Set([...teamA, ...teamB]).size).toBe(8);
});

test("returns the same split regardless of input order", () => {
  expect(balanceRankedLobby(roster)).toEqual(balanceRankedLobby([...roster].reverse()));
});

test("balances equal Elo teams exactly", () => {
  const equal = roster.map(p => ({ ...p, elo: 1000 }));
  expect(balanceRankedLobby(equal).averageEloDifference).toBe(0);
});

test("rejects duplicate players and untrusted Elo values", () => {
  expect(() => validateRankedCandidates([...roster.slice(0, 7), roster[0]])).toThrow();
  expect(() => validateRankedCandidates([...roster.slice(0, 7), { id: "bad", elo: NaN }])).toThrow();
  expect(() => validateRankedCandidates(roster.slice(0, 7))).toThrow();
});
