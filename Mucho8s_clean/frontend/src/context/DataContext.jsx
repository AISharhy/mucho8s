import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { load, save, uid } from "@/lib/storage";
import { BASE_ELO, MIN_ELO, WIN_DELTA, LOSS_DELTA, MVP_BONUS, MERDA_PENALTY } from "@/lib/elo";
import { toast } from "sonner";
import { supabaseAuth, hasSupabaseAuth } from "@/lib/supabaseClient";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const SUPABASE_URL = (process.env.REACT_APP_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || "";
const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const HAS_BACKEND = Boolean(BACKEND_URL);
const STORAGE_MODE = HAS_SUPABASE ? "supabase" : HAS_BACKEND ? "backend" : "local";
const POLL_MS = 3500;

const makePlayer = (name, startElo = BASE_ELO) => {
  const elo = Math.max(MIN_ELO, Math.round(Number(startElo) || BASE_ELO));
  return {
    id: uid(),
    name: name.trim(),
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
    role: "",
    eloHistory: [{ match: 0, elo }],
    createdAt: new Date().toISOString(),
  };
};

const normalizePlayer = (p) => {
  const cur = Math.max(MIN_ELO, Math.round(Number(p?.currentElo) || BASE_ELO));
  return {
    id: p?.id || uid(),
    name: String(p?.name || "Unknown").trim() || "Unknown",
    currentElo: cur,
    peakElo: Math.max(cur, Math.round(Number(p?.peakElo) || cur)),
    totalMatches: Math.max(0, Number(p?.totalMatches) || 0),
    wins: Math.max(0, Number(p?.wins) || 0),
    losses: Math.max(0, Number(p?.losses) || 0),
    avgPlacement: Number(p?.avgPlacement) || 0,
    last10: Array.isArray(p?.last10) ? p.last10.slice(0, 10) : [],
    currentStreak: Number(p?.currentStreak) || 0,
    mvpCount: Math.max(0, Number(p?.mvpCount) || 0),
    merdaCount: Math.max(0, Number(p?.merdaCount) || 0),
    role:
      p?.role === "Main AR" ? "AR" :
      p?.role === "Flex" ? "FLEX" :
      ["AR", "FLEX", "SMG"].includes(p?.role) ? p.role : "",
    eloHistory: Array.isArray(p?.eloHistory) && p.eloHistory.length
      ? p.eloHistory
      : [{ match: 0, elo: cur }],
    createdAt: p?.createdAt || new Date().toISOString(),
  };
};

const normalizeMatch = (m) => ({
  id: m?.id || uid(),
  date: m?.date || new Date().toISOString(),
  teamA: Array.isArray(m?.teamA) ? m.teamA : [],
  teamB: Array.isArray(m?.teamB) ? m.teamB : [],
  winner: m?.winner === "B" ? "B" : "A",
  scoreA: Math.max(0, Number(m?.scoreA) || 0),
  scoreB: Math.max(0, Number(m?.scoreB) || 0),
  mvpId: m?.mvpId || undefined,
  merdaIds: Array.isArray(m?.merdaIds)
    ? m.merdaIds.filter(Boolean)
    : (m?.merdaId ? [m.merdaId] : []),
  merdaId: m?.merdaId || (Array.isArray(m?.merdaIds) ? m.merdaIds[0] : undefined),
  merdaClearedIds: Array.isArray(m?.merdaClearedIds) ? m.merdaClearedIds.filter(Boolean) : [],
  map: m?.map || "",
  mode: m?.mode || "",
  game: m?.game || "",
  eloChanges: m?.eloChanges && typeof m.eloChanges === "object" ? m.eloChanges : {},
  pairings: Array.isArray(m?.pairings) ? m.pairings : [],
  season: Math.max(1, Number(m?.season) || 1),
  resultStatus: m?.resultStatus || (m?.locked ? "locked" : ""),
  locked: Boolean(m?.locked),
  verifiedAt: m?.verifiedAt || null,
  captainAPlayerId: m?.captainAPlayerId || null,
  captainBPlayerId: m?.captainBPlayerId || null,
  reportId: m?.reportId || null,
});

const clonePlayers = (players) => players.map((p) => ({
  ...p,
  last10: [...(p.last10 || [])],
  eloHistory: [...(p.eloHistory || [])],
}));

const recomputeRecent = (byId, matches, ids) => {
  ids.forEach((pid) => {
    const p = byId[pid];
    if (!p) return;
    const involved = matches
      .filter((m) => m.teamA.includes(pid) || m.teamB.includes(pid))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const results = involved.map((m) => {
      const winners = m.winner === "A" ? m.teamA : m.teamB;
      return winners.includes(pid) ? "W" : "L";
    });

    p.last10 = results.slice(0, 10);
    let streak = 0;
    for (const result of results) {
      if (streak === 0) streak = result === "W" ? 1 : -1;
      else if (streak > 0 && result === "W") streak += 1;
      else if (streak < 0 && result === "L") streak -= 1;
      else break;
    }
    p.currentStreak = streak;
  });
};

const automaticMerdaIds = (byId, losers) =>
  losers.filter((pid) => {
    const current = Number(byId[pid]?.currentStreak || 0);
    const nextLossStreak = current < 0 ? Math.abs(current) + 1 : 1;
    return nextLossStreak >= 4 && nextLossStreak % 4 === 0;
  });

const automaticMerdaClearedIds = (byId, winners) =>
  winners.filter((pid) => {
    const player = byId[pid];
    if (!player || Number(player.merdaCount || 0) <= 0) return false;
    const current = Number(player.currentStreak || 0);
    const nextWinStreak = current > 0 ? current + 1 : 1;
    return nextWinStreak >= 4 && nextWinStreak % 4 === 0;
  });

const applyEffects = (byId, teamA, teamB, winner, mvpId, merdaIds = [], merdaClearedIds = []) => {
  const winners = winner === "A" ? teamA : teamB;
  const merdaSet = new Set(merdaIds || []);
  const clearedSet = new Set(merdaClearedIds || []);
  const changes = {};

  [...teamA, ...teamB].forEach((pid) => {
    const p = byId[pid];
    if (!p) return;
    const won = winners.includes(pid);
    let delta = won ? WIN_DELTA : -LOSS_DELTA;
    if (pid === mvpId) delta += MVP_BONUS;
    if (merdaSet.has(pid)) delta -= MERDA_PENALTY;

    const nextElo = Math.max(MIN_ELO, p.currentElo + delta);
    p.currentElo = nextElo;
    p.peakElo = Math.max(p.peakElo, nextElo);
    p.totalMatches += 1;
    if (won) p.wins += 1;
    else p.losses += 1;
    if (pid === mvpId) p.mvpCount += 1;
    if (merdaSet.has(pid)) p.merdaCount = Math.max(0, Number(p.merdaCount || 0)) + 1;
    if (clearedSet.has(pid)) p.merdaCount = Math.max(0, Number(p.merdaCount || 0) - 1);
    p.eloHistory = [...(p.eloHistory || []), { match: p.totalMatches, elo: nextElo }];
    changes[pid] = delta;
  });

  return changes;
};

const revertEffects = (byId, match) => {
  const winners = match.winner === "A" ? match.teamA : match.teamB;
  [...match.teamA, ...match.teamB].forEach((pid) => {
    const p = byId[pid];
    if (!p) return;
    const delta = Number(match.eloChanges?.[pid] || 0);
    p.currentElo = Math.max(MIN_ELO, p.currentElo - delta);
    p.totalMatches = Math.max(0, p.totalMatches - 1);
    if (winners.includes(pid)) p.wins = Math.max(0, p.wins - 1);
    else p.losses = Math.max(0, p.losses - 1);
    if (pid === match.mvpId) p.mvpCount = Math.max(0, p.mvpCount - 1);
    const merdaIds = Array.isArray(match.merdaIds)
      ? match.merdaIds
      : (match.merdaId ? [match.merdaId] : []);
    if (merdaIds.includes(pid)) p.merdaCount = Math.max(0, Number(p.merdaCount || 0) - 1);
    const merdaClearedIds = Array.isArray(match.merdaClearedIds) ? match.merdaClearedIds : [];
    if (merdaClearedIds.includes(pid)) p.merdaCount = Math.max(0, Number(p.merdaCount || 0) + 1);
    if ((p.eloHistory || []).length > 1) p.eloHistory = p.eloHistory.slice(0, -1);
  });
};

export const DataProvider = ({ children }) => {
  const [players, setPlayers] = useState(() => (load("players", []) || []).map(normalizePlayer));
  const [matches, setMatches] = useState(() => (load("matches", []) || []).map(normalizeMatch));
  const [admin, setAdminState] = useState(() => {
    try {
      const raw = sessionStorage.getItem("mucho8s_admin_session");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.sessionToken || !parsed?.expiresAt) return null;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
        sessionStorage.removeItem("mucho8s_admin_session");
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [adminValidated, setAdminValidated] = useState(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState(true);
  const [discordSession, setDiscordSession] = useState(null);
  const [discordAccount, setDiscordAccount] = useState(null);
  const [discordLoading, setDiscordLoading] = useState(hasSupabaseAuth);
  const [playerAvatars, setPlayerAvatars] = useState({});
  const [playerProfiles, setPlayerProfiles] = useState({});
  const [challenges, setChallenges] = useState([]);
  const [publicChallenges, setPublicChallenges] = useState([]);
  const [matchReports, setMatchReports] = useState([]);
  const [adminChallengeAlertCount, setAdminChallengeAlertCount] = useState(0);
  const [dashboardData, setDashboardData] = useState({
    activeChallenges: [],
    recentChallenges: [],
    onlinePlayers: [],
    competition: { season_number: 1, season_name: "Season 1" },
  });
  const [competitionData, setCompetitionData] = useState({
    current: { season_number: 1, season_name: "Season 1" },
    archives: [],
  });
  const [loaded, setLoaded] = useState(STORAGE_MODE === "local");
  const versionRef = useRef(-1);

  const applyState = useCallback((data) => {
    if (typeof data?.version === "number" && data.version === versionRef.current) return;
    if (typeof data?.version === "number") versionRef.current = data.version;
    setPlayers((data?.players || []).map(normalizePlayer));
    setMatches((data?.matches || []).map(normalizeMatch).sort((a, b) => new Date(b.date) - new Date(a.date)));
    setLoaded(true);
  }, []);

  const fetchState = useCallback(async () => {
    if (STORAGE_MODE === "local") {
      setLoaded(true);
      return;
    }

    try {
      if (STORAGE_MODE === "supabase") {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/app_state?id=eq.main&select=players,matches,version`,
          {
            headers: {
              apikey: SUPABASE_ANON_KEY,
            },
          },
        );
        if (!res.ok) return;
        const rows = await res.json();
        if (rows?.[0]) {
          const remote = rows[0];
          const localPlayers = load("players", []);
          const localMatches = load("matches", []);
          const cloudIsEmpty = Array.isArray(remote.players) && remote.players.length === 0
            && Array.isArray(remote.matches) && remote.matches.length === 0;
          if (cloudIsEmpty && Array.isArray(localPlayers) && localPlayers.length > 0) {
            setPlayers(localPlayers.map(normalizePlayer));
            setMatches((Array.isArray(localMatches) ? localMatches : []).map(normalizeMatch));
            setLoaded(true);
          } else {
            applyState(remote);
          }
        }
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/state`);
      if (!res.ok) return;
      applyState(await res.json());
    } catch {
      // Keep the last known state if the remote database is temporarily unavailable.
    }
  }, [applyState]);

  useEffect(() => {
    if (STORAGE_MODE === "local") return;
    fetchState();
    const timer = setInterval(fetchState, POLL_MS);
    return () => clearInterval(timer);
  }, [fetchState]);

  useEffect(() => {
    if (STORAGE_MODE !== "local" || !loaded) return;
    save("players", players);
    save("matches", matches);
  }, [players, matches, loaded]);

  const playerMap = useMemo(() => {
    const result = {};
    players.forEach((p) => {
      result[p.id] = p;
    });
    return result;
  }, [players]);

  const fetchPlayerAvatars = useCallback(async () => {
    if (!HAS_SUPABASE) {
      setPlayerAvatars({});
      return {};
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-avatars`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      const avatars = data?.avatars && typeof data.avatars === "object" ? data.avatars : {};
      const profiles = data?.profiles && typeof data.profiles === "object" ? data.profiles : {};
      setPlayerAvatars(avatars);
      setPlayerProfiles(profiles);
      return profiles;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!HAS_SUPABASE) return undefined;
    void fetchPlayerAvatars();
    const timer = setInterval(fetchPlayerAvatars, 15000);
    return () => clearInterval(timer);
  }, [fetchPlayerAvatars]);

  const fetchCompetitionData = useCallback(async () => {
    if (!HAS_SUPABASE) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-competition`, {
        method: "GET",
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.ok) {
        setCompetitionData({
          current: data.current || { season_number: 1, season_name: "Season 1" },
          archives: Array.isArray(data.archives) ? data.archives : [],
        });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!HAS_SUPABASE) return undefined;
    void fetchCompetitionData();
    const timer = setInterval(fetchCompetitionData, 60000);
    return () => clearInterval(timer);
  }, [fetchCompetitionData]);

  const fetchDashboardData = useCallback(async () => {
    if (!HAS_SUPABASE) return null;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-dashboard`, {
        method: "GET",
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.ok) {
        setDashboardData({
          activeChallenges: Array.isArray(data.activeChallenges) ? data.activeChallenges : [],
          recentChallenges: Array.isArray(data.recentChallenges) ? data.recentChallenges : [],
          onlinePlayers: Array.isArray(data.onlinePlayers) ? data.onlinePlayers : [],
          competition: data.competition || { season_number: 1, season_name: "Season 1" },
        });
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!HAS_SUPABASE) return undefined;
    void fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(timer);
  }, [fetchDashboardData]);

  const fetchPublicChallenges = useCallback(async () => {
    if (!HAS_SUPABASE) {
      setPublicChallenges([]);
      return [];
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-challenge-public`, {
        method: "GET",
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const list = Array.isArray(data?.challenges) ? data.challenges : [];
      setPublicChallenges(list);
      return list;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!HAS_SUPABASE) return undefined;
    void fetchPublicChallenges();
    const timer = setInterval(fetchPublicChallenges, 30000);
    return () => clearInterval(timer);
  }, [fetchPublicChallenges]);

  const accountRequest = useCallback(async (payload, { session, silent = false } = {}) => {
    if (!HAS_SUPABASE) {
      if (!silent) toast.error("Discord login requires Supabase");
      return null;
    }

    try {
      const activeSession = session || null;
      const headers = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      };

      if (activeSession?.access_token) {
        headers.Authorization = `Bearer ${activeSession.access_token}`;
      }

      if (admin?.sessionToken) {
        headers["X-Admin-Session"] = admin.sessionToken;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-account`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Discord account action failed");
        return null;
      }

      return data;
    } catch {
      if (!silent) toast.error("Discord account service unavailable");
      return null;
    }
  }, [admin]);

  const syncDiscordSession = useCallback(async (session) => {
    setDiscordSession(session || null);

    if (!session) {
      setDiscordAccount(null);
      setDiscordLoading(false);
      return;
    }

    const data = await accountRequest({ action: "sync" }, { session, silent: true });
    setDiscordAccount(data?.account || null);
    setDiscordLoading(false);
    void fetchPlayerAvatars();
  }, [accountRequest, fetchPlayerAvatars]);

  useEffect(() => {
    if (!supabaseAuth) {
      setDiscordLoading(false);
      return undefined;
    }

    let active = true;

    supabaseAuth.auth.getSession().then(({ data }) => {
      if (active) void syncDiscordSession(data?.session || null);
    });

    const { data: listener } = supabaseAuth.auth.onAuthStateChange((_event, session) => {
      if (active) void syncDiscordSession(session || null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [syncDiscordSession]);

  const signInWithDiscord = useCallback(async () => {
    if (!supabaseAuth) {
      toast.error("Discord login is not available");
      return false;
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseAuth.auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo },
    });

    if (error) {
      toast.error(error.message || "Discord login failed");
      return false;
    }

    return true;
  }, []);

  const signOutDiscord = useCallback(async () => {
    if (!supabaseAuth) return false;
    const { error } = await supabaseAuth.auth.signOut();
    if (error) {
      toast.error(error.message || "Discord logout failed");
      return false;
    }
    setDiscordSession(null);
    setDiscordAccount(null);
    return true;
  }, []);

  const refreshDiscordAccount = useCallback(async () => {
    if (!discordSession) return null;
    const data = await accountRequest({ action: "me" }, { session: discordSession, silent: true });
    if (data?.account) setDiscordAccount(data.account);
    return data?.account || null;
  }, [accountRequest, discordSession]);

  // Keep Discord-linked player presence fresh while the site is open.
  useEffect(() => {
    if (!discordSession?.access_token || !discordAccount?.player_id) return undefined;

    const heartbeat = async () => {
      await accountRequest({ action: "me" }, { session: discordSession, silent: true });
    };

    void heartbeat();
    const timer = setInterval(heartbeat, 60 * 1000);
    return () => clearInterval(timer);
  }, [discordSession, discordAccount?.player_id, accountRequest]);

  const saveMyChallengeLinks = useCallback(async ({ paypalUrl, revolutUrl, role = "" }) => {
    if (!discordSession) {
      toast.error("Login with Discord first");
      return false;
    }

    const data = await accountRequest(
      {
        action: "update-links",
        paypalUrl,
        revolutUrl,
        role,
      },
      { session: discordSession },
    );

    if (!data?.account) return false;
    setDiscordAccount(data.account);
    versionRef.current = -1;
    await Promise.all([
      fetchPlayerAvatars(),
      fetchState(),
    ]);
    return true;
  }, [accountRequest, discordSession, fetchPlayerAvatars, fetchState]);

  const listDiscordAccounts = useCallback(async () => {
    const data = await accountRequest({ action: "admin-list" });
    return Array.isArray(data?.accounts) ? data.accounts : null;
  }, [accountRequest]);

  const linkDiscordAccount = useCallback(async (accountId, playerId) => {
    const data = await accountRequest({ action: "admin-link", accountId, playerId });
    if (!data?.account) return false;

    if (discordAccount?.id === accountId) {
      setDiscordAccount(data.account);
    }

    void fetchPlayerAvatars();
    return true;
  }, [accountRequest, discordAccount, fetchPlayerAvatars]);

  const challengeRequest = useCallback(async (payload, { silent = false } = {}) => {
    if (!HAS_SUPABASE || !discordSession?.access_token) {
      if (!silent) toast.error("Login with Discord first");
      return null;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${discordSession.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Challenge action failed");
        return null;
      }

      return data;
    } catch {
      if (!silent) toast.error("Challenge service unavailable");
      return null;
    }
  }, [discordSession]);

  const refreshChallenges = useCallback(async () => {
    if (!discordSession?.access_token || !discordAccount?.player_id) {
      setChallenges([]);
      return [];
    }

    const data = await challengeRequest({ action: "list" }, { silent: true });
    const list = Array.isArray(data?.challenges) ? data.challenges : [];
    setChallenges(list);
    return list;
  }, [challengeRequest, discordAccount, discordSession]);

  useEffect(() => {
    if (!discordSession?.access_token || !discordAccount?.player_id) {
      setChallenges([]);
      return undefined;
    }

    void refreshChallenges();
    const timer = setInterval(refreshChallenges, 4000);
    return () => clearInterval(timer);
  }, [discordSession, discordAccount, refreshChallenges]);

  const matchReportRequest = useCallback(async (payload, { silent = false } = {}) => {
    if (!HAS_SUPABASE) {
      if (!silent) toast.error("Match verification requires Supabase");
      return null;
    }

    try {
      const headers = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      };

      if (discordSession?.access_token) {
        headers.Authorization = `Bearer ${discordSession.access_token}`;
      }
      if (admin?.sessionToken) {
        headers["X-Admin-Session"] = admin.sessionToken;
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-match-reports`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Match result action failed");
        return null;
      }
      return data;
    } catch {
      if (!silent) toast.error("Match verification service unavailable");
      return null;
    }
  }, [admin, discordSession]);

  const refreshMatchReports = useCallback(async () => {
    if (!HAS_SUPABASE || (!admin?.sessionToken && !discordSession?.access_token)) {
      setMatchReports([]);
      return [];
    }

    const data = await matchReportRequest({ action: "list" }, { silent: true });
    const list = Array.isArray(data?.reports) ? data.reports : [];
    setMatchReports(list);
    return list;
  }, [admin?.sessionToken, discordSession?.access_token, matchReportRequest]);

  useEffect(() => {
    if (!HAS_SUPABASE || (!admin?.sessionToken && !discordSession?.access_token)) {
      setMatchReports([]);
      return undefined;
    }

    void refreshMatchReports();
    const timer = setInterval(refreshMatchReports, 5000);
    return () => clearInterval(timer);
  }, [admin?.sessionToken, discordSession?.access_token, refreshMatchReports]);

  const createMatchReport = useCallback(async (payload) => {
    const data = await matchReportRequest({ action: "create", ...payload });
    if (!data?.report) return null;
    await refreshMatchReports();
    return data.report;
  }, [matchReportRequest, refreshMatchReports]);

  const confirmMatchReport = useCallback(async (id) => {
    const data = await matchReportRequest({ action: "confirm", id });
    if (!data?.report) return null;

    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      refreshMatchReports(),
      fetchPublicChallenges(),
      fetchDashboardData(),
    ]);
    return data.report;
  }, [matchReportRequest, refreshMatchReports, fetchState, fetchPublicChallenges, fetchDashboardData]);

  const disputeMatchReport = useCallback(async (id, note) => {
    const data = await matchReportRequest({ action: "dispute", id, note });
    if (!data?.report) return null;
    await refreshMatchReports();
    return data.report;
  }, [matchReportRequest, refreshMatchReports]);

  const adminResolveMatchReport = useCallback(async (id, decision) => {
    const data = await matchReportRequest({ action: "admin-resolve", id, decision });
    if (!data?.report) return null;

    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      refreshMatchReports(),
      fetchPublicChallenges(),
      fetchDashboardData(),
    ]);
    return data.report;
  }, [matchReportRequest, refreshMatchReports, fetchState, fetchPublicChallenges, fetchDashboardData]);

  const createChallenge = useCallback(async (targetPlayerId, platform, amount) => {
    const data = await challengeRequest({
      action: "create",
      targetPlayerId,
      platform,
      amount,
    });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const createRechallenge = useCallback(async (id, amount) => {
    const data = await challengeRequest({ action: "rechallenge", id, amount });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const closeChallengeSeries = useCallback(async (seriesId) => {
    const data = await challengeRequest({ action: "close-series", seriesId });
    if (!data?.series) return null;
    await refreshChallenges();
    return data.series;
  }, [challengeRequest, refreshChallenges]);

  const markChallengeSeriesPaymentSent = useCallback(async (seriesId) => {
    const data = await challengeRequest({ action: "series-payment-sent", seriesId });
    if (!data?.series) return null;
    await refreshChallenges();
    return data.series;
  }, [challengeRequest, refreshChallenges]);

  const confirmChallengeSeriesPaymentReceived = useCallback(async (seriesId) => {
    const data = await challengeRequest({ action: "series-payment-received", seriesId });
    if (!data?.series) return null;
    await refreshChallenges();
    return data.series;
  }, [challengeRequest, refreshChallenges]);

  const respondToChallenge = useCallback(async (id, decision) => {
    const data = await challengeRequest({ action: "respond", id, decision });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const markChallengePaymentSent = useCallback(async (id) => {
    const data = await challengeRequest({ action: "payment-sent", id });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const confirmChallengePaymentReceived = useCallback(async (id) => {
    const data = await challengeRequest({ action: "payment-received", id });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const disputeChallengePayout = useCallback(async (id, note) => {
    const data = await challengeRequest({ action: "payout-dispute", id, note });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const uploadChallengeEvidence = useCallback(async (id, file, kind = "dispute") => {
    if (!file) return null;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Evidence image must be under 5 MB");
      return null;
    }

    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || "");
        resolve(raw.includes(",") ? raw.split(",")[1] : raw);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const data = await challengeRequest({
      action: "upload-evidence",
      id,
      fileName: file.name,
      mimeType: file.type,
      base64,
      kind,
    });

    if (!data?.challenge) return null;
    setChallenges((prev) => prev.map((item) => item.id === id ? data.challenge : item));
    return data.evidence || null;
  }, [challengeRequest]);

  const markChallengeSeen = useCallback(async (id) => {
    const data = await challengeRequest({ action: "mark-seen", id }, { silent: true });
    if (!data?.challenge) return null;
    setChallenges((prev) => prev.map((item) => (item.id === id ? data.challenge : item)));
    return data.challenge;
  }, [challengeRequest]);

  const listChallengeMessages = useCallback(async (id, { silent = true } = {}) => {
    const data = await challengeRequest({ action: "list-messages", id }, { silent });
    return Array.isArray(data?.messages) ? data.messages : [];
  }, [challengeRequest]);

  const sendChallengeMessage = useCallback(async (id, message) => {
    const data = await challengeRequest({ action: "send-message", id, message });
    return data?.message || null;
  }, [challengeRequest]);

  const setChallengeReady = useCallback(async (id, ready = true) => {
    const data = await challengeRequest({ action: "set-ready", id, ready });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const reportChallengeResult = useCallback(async (id, winnerPlayerId) => {
    const data = await challengeRequest({ action: "report-result", id, winnerPlayerId });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const verifyChallengeResult = useCallback(async (id, decision, note = "") => {
    const data = await challengeRequest({ action: "verify-result", id, decision, note });
    if (!data?.challenge) return null;

    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      refreshChallenges(),
      fetchPublicChallenges(),
      fetchDashboardData(),
    ]);

    return data.challenge;
  }, [challengeRequest, fetchDashboardData, fetchPublicChallenges, fetchState, refreshChallenges]);

  const cancelChallenge = useCallback(async (id) => {
    const data = await challengeRequest({ action: "cancel", id });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const adminChallengeRequest = useCallback(async (payload, { silent = false } = {}) => {
    if (!HAS_SUPABASE || !admin?.sessionToken) {
      if (!silent) toast.error("Admin access required");
      return null;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          "X-Admin-Session": admin.sessionToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) {
          const missingPlayer = data?.playerId ? playerMap?.[data.playerId] : null;
          const rawError = String(data?.error || "Admin challenge action failed");
          let message = rawError;

          if (missingPlayer && rawError.includes("has not configured")) {
            const platform = rawError.split("has not configured")[1]?.trim() || "the selected payment method";
            message = `${missingPlayer.name} has not configured ${platform} yet.`;
          }

          toast.error(message);
        }
        return null;
      }
      return data;
    } catch {
      if (!silent) toast.error("Challenge admin service unavailable");
      return null;
    }
  }, [admin, playerMap]);

  const refreshAdminChallengeAlerts = useCallback(async () => {
    if (!admin?.sessionToken) {
      setAdminChallengeAlertCount(0);
      return 0;
    }

    const data = await adminChallengeRequest({ action: "admin-list" }, { silent: true });
    const list = Array.isArray(data?.challenges) ? data.challenges : [];
    const count = list.filter((challenge) =>
      challenge.status === "disputed" ||
      (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
    ).length;

    setAdminChallengeAlertCount(count);
    return count;
  }, [admin, adminChallengeRequest]);

  useEffect(() => {
    if (!admin?.sessionToken) {
      setAdminChallengeAlertCount(0);
      return undefined;
    }
    void refreshAdminChallengeAlerts();
    const timer = setInterval(refreshAdminChallengeAlerts, 10000);
    return () => clearInterval(timer);
  }, [admin?.sessionToken, refreshAdminChallengeAlerts]);

  const listAdminChallenges = useCallback(async () => {
    const data = await adminChallengeRequest({ action: "admin-list" });
    return Array.isArray(data?.challenges) ? data.challenges : null;
  }, [adminChallengeRequest]);

  const adminCreateChallengePairings = useCallback(async (pairings) => {
    const data = await adminChallengeRequest({
      action: "admin-create-pairings",
      pairings,
    });
    if (!Array.isArray(data?.challenges)) return null;

    if (discordAccount?.player_id) {
      await refreshChallenges();
    }

    return data.challenges;
  }, [adminChallengeRequest, discordAccount, refreshChallenges]);

  const syncMatchMoneyPairings = useCallback(async (match, { silent = true } = {}) => {
    if (!match?.id || STORAGE_MODE !== "supabase" || !admin?.sessionToken) return true;

    const data = await adminChallengeRequest({
      action: "admin-sync-match-pairings",
      matchId: match.id,
      winner: match.winner,
      date: match.date,
      seasonNumber: match.season || competitionData?.current?.season_number || 1,
      pairings: Array.isArray(match.pairings) ? match.pairings : [],
    }, { silent });

    if (!data?.ok) return false;

    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      fetchPublicChallenges(),
      fetchDashboardData(),
      refreshAdminChallengeAlerts(),
      discordAccount?.player_id ? refreshChallenges() : Promise.resolve(),
    ]);

    return true;
  }, [
    admin?.sessionToken,
    adminChallengeRequest,
    competitionData,
    discordAccount?.player_id,
    fetchDashboardData,
    fetchPublicChallenges,
    fetchState,
    refreshAdminChallengeAlerts,
    refreshChallenges,
  ]);

  const adminUpdateChallenge = useCallback(async (id, updates) => {
    const data = await adminChallengeRequest({ action: "admin-update", id, ...updates });
    if (!data?.challenge) return null;
    setChallenges((prev) => {
      const exists = prev.some((item) => item.id === id);
      return exists
        ? prev.map((item) => (item.id === id ? data.challenge : item))
        : [data.challenge, ...prev];
    });

    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      fetchPublicChallenges(),
      fetchDashboardData(),
    ]);

    return data.challenge;
  }, [adminChallengeRequest, fetchDashboardData, fetchPublicChallenges, fetchState]);

  const adminDeleteChallenge = useCallback(async (id) => {
    const data = await adminChallengeRequest({ action: "admin-delete", id });
    if (!data?.ok) return false;

    setChallenges((prev) => prev.filter((item) => item.id !== id));
    versionRef.current = -1;
    await Promise.all([
      fetchState(),
      fetchPublicChallenges(),
      fetchDashboardData(),
    ]);

    return true;
  }, [adminChallengeRequest, fetchDashboardData, fetchPublicChallenges, fetchState]);

  const challengeNotificationCount = useMemo(() => {
    if (!discordAccount?.id) return 0;

    const seenSeries = new Set();
    let count = 0;

    challenges.forEach((challenge) => {
      const isChallenger = challenge.challenger_account_id === discordAccount.id;
      const isChallenged = challenge.challenged_account_id === discordAccount.id;
      if (!isChallenger && !isChallenged) return;

      if (challenge.status === "pending" && isChallenged) {
        count += 1;
        return;
      }

      if (
        challenge.status === "result_pending" &&
        challenge.reporter_account_id !== discordAccount.id
      ) {
        count += 1;
        return;
      }

      if (challenge.status === "completed" && !challenge.payment_received_at) {
        count += 1;
        return;
      }

      if (challenge.series_id) {
        if (seenSeries.has(challenge.series_id)) return;
        seenSeries.add(challenge.series_id);

        const seenEvent = isChallenger
          ? challenge.challenger_seen_event
          : challenge.challenged_seen_event;

        if (challenge.last_event && seenEvent !== challenge.last_event) {
          count += 1;
        }
        return;
      }

      const seenEvent = isChallenger
        ? challenge.challenger_seen_event
        : challenge.challenged_seen_event;

      if (challenge.last_event && seenEvent !== challenge.last_event) {
        count += 1;
        return;
      }

      if (challenge.status === "completed" && challenge.reported_winner_player_id) {
        const myPlayerId = discordAccount.player_id;
        const iWon = challenge.reported_winner_player_id === myPlayerId;

        if (!iWon && !challenge.payment_sent_at) count += 1;
        if (iWon && challenge.payment_sent_at && !challenge.payment_received_at) count += 1;
      }
    });

    return count;
  }, [challenges, discordAccount]);

  const adminAuditRequest = useCallback(async (payload, { silent = false } = {}) => {
    if (!HAS_SUPABASE || !admin?.sessionToken) {
      if (!silent) toast.error("Admin access required");
      return null;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-admin-audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          "X-Admin-Session": admin.sessionToken,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Audit log action failed");
        return null;
      }
      return data;
    } catch {
      if (!silent) toast.error("Audit log service unavailable");
      return null;
    }
  }, [admin]);

  const logAdminAction = useCallback(async (event, entityType, entityId = null, details = {}) => {
    return adminAuditRequest(
      { action: "log", event, entityType, entityId, details },
      { silent: true },
    );
  }, [adminAuditRequest]);

  const listAdminAudit = useCallback(async () => {
    const data = await adminAuditRequest({ action: "list" });
    return Array.isArray(data?.logs) ? data.logs : null;
  }, [adminAuditRequest]);

  const isAdmin = Boolean(admin?.sessionToken && adminValidated);
  const discordPlayer = useMemo(
    () => (discordAccount?.player_id ? playerMap[discordAccount.player_id] || null : null),
    [discordAccount, playerMap],
  );

  const backendWrite = useCallback(async (path, { method = "POST", body } = {}) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Session": admin?.sessionToken || "",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 401) {
        toast.error("Admin access required for this action");
        return false;
      }
      if (!res.ok) {
        toast.error("Action failed — please retry");
        return false;
      }
      versionRef.current = -1;
      await fetchState();
      return true;
    } catch {
      toast.error("Network error — please retry");
      return false;
    }
  }, [admin, fetchState]);

  const persistWholeState = useCallback(async (nextPlayers, nextMatches) => {
    const normalizedPlayers = nextPlayers.map(normalizePlayer);
    const normalizedMatches = nextMatches.map(normalizeMatch).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (STORAGE_MODE === "local") {
      setPlayers(normalizedPlayers);
      setMatches(normalizedMatches);
      save("players", normalizedPlayers);
      save("matches", normalizedMatches);
      return true;
    }

    if (STORAGE_MODE === "supabase") {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-write`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            "X-Admin-Session": admin?.sessionToken || "",
          },
          body: JSON.stringify({ players: normalizedPlayers, matches: normalizedMatches }),
        });
        if (res.status === 401) {
          toast.error("Admin access required for this action");
          return false;
        }
        if (!res.ok) {
          toast.error("Cloud database update failed");
          return false;
        }
        versionRef.current = -1;
        await fetchState();
        return true;
      } catch {
        toast.error("Cloud database unavailable");
        return false;
      }
    }

    return backendWrite("/restore", { body: { players: normalizedPlayers, matches: normalizedMatches } });
  }, [admin, backendWrite, fetchState]);

  const discordRequest = useCallback(async (payload, { silent = false } = {}) => {
    if (STORAGE_MODE !== "supabase") {
      if (!silent) toast.error("Discord integration requires Supabase mode");
      return null;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-discord`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          "X-Admin-Session": admin?.sessionToken || "",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        if (!silent) toast.error("Admin access required for Discord");
        return null;
      }

      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Discord action failed");
        return null;
      }

      return data;
    } catch {
      if (!silent) toast.error("Discord connection unavailable");
      return null;
    }
  }, [admin]);

  const getDiscordStatus = useCallback(async () => {
    const data = await discordRequest({ action: "status" }, { silent: true });
    return Boolean(data?.configured);
  }, [discordRequest]);

  const configureDiscordWebhook = useCallback(async (webhookUrl) => {
    const data = await discordRequest({ action: "configure", webhookUrl });
    return Boolean(data?.ok);
  }, [discordRequest]);

  const clearDiscordWebhook = useCallback(async () => {
    const data = await discordRequest({ action: "clear" });
    return Boolean(data?.ok);
  }, [discordRequest]);

  const testDiscordWebhook = useCallback(async () => {
    const data = await discordRequest({ action: "test" });
    return Boolean(data?.ok);
  }, [discordRequest]);

  const sendDiscordTeams = useCallback(async ({ teamA, teamB, game, balanceScore }) => {
    const data = await discordRequest({
      action: "teams",
      teamA,
      teamB,
      game,
      balanceScore,
    });
    return Boolean(data?.ok);
  }, [discordRequest]);

  const adminAuthRequest = useCallback(async (payload, { token, silent = false } = {}) => {
    if (!HAS_SUPABASE) {
      if (!silent) toast.error("Admin security requires Supabase mode");
      return null;
    }

    try {
      const headers = {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
      };
      if (discordSession?.access_token) {
        headers.Authorization = `Bearer ${discordSession.access_token}`;
      }
      const activeToken = token || admin?.sessionToken;
      if (activeToken) headers["X-Admin-Session"] = activeToken;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-admin-auth`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!silent) toast.error(data?.error || "Admin authentication failed");
        return null;
      }
      return data;
    } catch {
      if (!silent) toast.error("Admin authentication service unavailable");
      return null;
    }
  }, [admin, discordSession]);

  useEffect(() => {
    if (discordLoading) {
      setAdminAuthLoading(true);
      return undefined;
    }

    if (!discordSession?.access_token) {
      if (admin?.sessionToken) {
        sessionStorage.removeItem("mucho8s_admin_session");
        setAdminValidated(false);
        setAdminState(null);
      }
      setAdminAuthLoading(false);
      return undefined;
    }

    if (admin?.sessionToken) return undefined;

    let active = true;
    setAdminAuthLoading(true);

    const autoLogin = async () => {
      const data = await adminAuthRequest({ action: "auto-login" }, { silent: true });
      if (!active) return;

      if (!data?.ok || !data?.sessionToken) {
        setAdminValidated(false);
        setAdminState(null);
        setAdminAuthLoading(false);
        return;
      }

      const next = {
        nickname: data.nickname || "Admin",
        sessionToken: data.sessionToken,
        expiresAt: data.expiresAt,
        automatic: true,
      };

      sessionStorage.setItem("mucho8s_admin_session", JSON.stringify(next));
      setAdminState(next);
      setAdminValidated(true);
      setAdminAuthLoading(false);
    };

    void autoLogin();
    return () => {
      active = false;
    };
  }, [discordLoading, discordSession?.access_token, admin?.sessionToken, adminAuthRequest]);

  useEffect(() => {
    if (!admin?.sessionToken) {
      setAdminValidated(false);
      if (!discordLoading && !discordSession?.access_token) setAdminAuthLoading(false);
      return undefined;
    }

    let active = true;
    setAdminAuthLoading(true);

    const verify = async () => {
      const data = await adminAuthRequest({ action: "status" }, { silent: true });
      if (!active) return;

      if (!data?.ok) {
        sessionStorage.removeItem("mucho8s_admin_session");
        setAdminValidated(false);
        setAdminState(null);
        setAdminAuthLoading(false);
        return;
      }

      setAdminValidated(true);
      setAdminAuthLoading(false);
    };

    void verify();
    const timer = setInterval(verify, 5 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [admin?.sessionToken, adminAuthRequest, discordLoading, discordSession?.access_token]);

  const setAdmin = useCallback(async (nickname, password) => {
    if (nickname === null) {
      const token = admin?.sessionToken;
      if (token) {
        await adminAuthRequest({ action: "logout" }, { token, silent: true });
      }
      sessionStorage.removeItem("mucho8s_admin_session");
      setAdminValidated(false);
      setAdminState(null);
      return true;
    }

    const data = await adminAuthRequest({
      action: "login",
      username: String(nickname || "").trim(),
      password: String(password || ""),
    });

    if (!data?.ok || !data?.sessionToken) return false;

    const next = {
      nickname: data.nickname || "Admin",
      sessionToken: data.sessionToken,
      expiresAt: data.expiresAt,
    };

    sessionStorage.setItem("mucho8s_admin_session", JSON.stringify(next));
    setAdminState(next);
    setAdminValidated(true);
    return true;
  }, [admin?.sessionToken, adminAuthRequest]);

  const changeAdminPassword = useCallback(async (newPassword) => {
    const data = await adminAuthRequest({
      action: "change-password",
      newPassword: String(newPassword || ""),
    });
    return Boolean(data?.ok);
  }, [adminAuthRequest]);

  const logoutAllAdminSessions = useCallback(async () => {
    const data = await adminAuthRequest({ action: "logout-all" });
    if (!data?.ok) return false;
    sessionStorage.removeItem("mucho8s_admin_session");
    setAdminValidated(false);
    setAdminState(null);
    return true;
  }, [adminAuthRequest]);

  const startNewSeason = useCallback(async ({ seasonName = "", resetStats = true } = {}) => {
    if (!HAS_SUPABASE || !admin?.sessionToken) {
      toast.error("Admin access required");
      return false;
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/mucho8s-competition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          "X-Admin-Session": admin.sessionToken,
        },
        body: JSON.stringify({
          action: "new-season",
          seasonName,
          resetStats,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Could not start new season");
        return false;
      }

      versionRef.current = -1;
      await Promise.all([
        fetchState(),
        fetchCompetitionData(),
        fetchDashboardData(),
        fetchPublicChallenges(),
      ]);
      return true;
    } catch {
      toast.error("Competition service unavailable");
      return false;
    }
  }, [admin, fetchState, fetchCompetitionData, fetchDashboardData, fetchPublicChallenges]);

  const addPlayer = useCallback(async (name, startElo = BASE_ELO) => {
    if (STORAGE_MODE === "backend") return backendWrite("/players", { body: { name, startElo } });
    const player = makePlayer(name, startElo);
    const ok = await persistWholeState([...players, player], matches);
    if (ok) void logAdminAction("player.add", "player", player.id, { name: player.name, elo: player.currentElo });
    return ok;
  }, [players, matches, backendWrite, persistWholeState, logAdminAction, syncMatchMoneyPairings]);

  const removePlayer = useCallback(async (id) => {
    if (STORAGE_MODE === "backend") return backendWrite(`/players/${id}`, { method: "DELETE" });
    const removed = players.find((p) => p.id === id);
    const ok = await persistWholeState(players.filter((p) => p.id !== id), matches);
    if (ok) void logAdminAction("player.delete", "player", id, { name: removed?.name || "" });
    return ok;
  }, [players, matches, backendWrite, persistWholeState, logAdminAction, syncMatchMoneyPairings]);

  const editElo = useCallback(async (id, currentElo) => {
    if (STORAGE_MODE === "backend") {
      return backendWrite(`/players/${id}/elo`, { method: "PUT", body: { currentElo } });
    }
    const next = clonePlayers(players);
    const p = next.find((x) => x.id === id);
    if (!p) return false;
    const elo = Math.max(MIN_ELO, Math.round(Number(currentElo) || BASE_ELO));
    p.currentElo = elo;
    p.peakElo = Math.max(p.peakElo, elo);
    p.eloHistory = [...(p.eloHistory || []), { match: p.eloHistory?.length || 0, elo }];
    return persistWholeState(next, matches);
  }, [players, matches, backendWrite, persistWholeState]);

  const editPlayerName = useCallback(async (id, name) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return false;
    if (STORAGE_MODE === "backend") {
      return backendWrite(`/players/${id}/name`, { method: "PUT", body: { name: cleanName } });
    }
    const next = clonePlayers(players);
    const p = next.find((x) => x.id === id);
    if (!p) return false;
    p.name = cleanName;
    return persistWholeState(next, matches);
  }, [players, matches, backendWrite, persistWholeState]);

  const editPlayer = useCallback(async (id, { name, currentElo, role = "" }) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return false;
    const elo = Math.max(MIN_ELO, Math.round(Number(currentElo) || BASE_ELO));
    const cleanRole = ["AR", "FLEX", "SMG"].includes(role) ? role : "";

    if (STORAGE_MODE === "backend") {
      const okName = await backendWrite(`/players/${id}/name`, { method: "PUT", body: { name: cleanName } });
      if (!okName) return false;
      return backendWrite(`/players/${id}/elo`, { method: "PUT", body: { currentElo: elo } });
    }

    const next = clonePlayers(players);
    const p = next.find((x) => x.id === id);
    if (!p) return false;
    p.name = cleanName;
    p.currentElo = elo;
    p.role = cleanRole;
    p.peakElo = Math.max(p.peakElo, elo);
    p.eloHistory = [...(p.eloHistory || []), { match: p.eloHistory?.length || 0, elo }];
    const ok = await persistWholeState(next, matches);
    if (ok) void logAdminAction("player.update", "player", id, { name: cleanName, elo, role: cleanRole });
    return ok;
  }, [players, matches, backendWrite, persistWholeState, logAdminAction]);

  const resetStats = useCallback(async () => {
    if (STORAGE_MODE === "backend") return backendWrite("/reset-stats");
    const resetPlayers = players.map((p) => ({
      ...p,
      currentElo: BASE_ELO,
      peakElo: BASE_ELO,
      totalMatches: 0,
      wins: 0,
      losses: 0,
      avgPlacement: 0,
      last10: [],
      currentStreak: 0,
      mvpCount: 0,
      merdaCount: 0,
      eloHistory: [{ match: 0, elo: BASE_ELO }],
    }));
    const ok = await persistWholeState(resetPlayers, []);
    if (ok) void logAdminAction("stats.reset", "database", "main", {});
    return ok;
  }, [players, backendWrite, persistWholeState, logAdminAction]);

  const importPlayers = useCallback(async (list) => {
    const next = (Array.isArray(list) ? list : []).map(normalizePlayer);
    if (STORAGE_MODE === "backend") return backendWrite("/players/import", { body: { players: next } });
    return persistWholeState(next, matches);
  }, [matches, backendWrite, persistWholeState]);

  const importFullBackup = useCallback(async (backup) => {
    if (!backup || !Array.isArray(backup.players)) return false;
    const nextPlayers = backup.players.map(normalizePlayer);
    const nextMatches = Array.isArray(backup.matches) ? backup.matches.map(normalizeMatch) : [];
    return persistWholeState(nextPlayers, nextMatches);
  }, [persistWholeState]);

  const recordMatch = useCallback(async (data) => {
    if (STORAGE_MODE === "backend") return backendWrite("/matches", { body: data });

    const nextPlayers = clonePlayers(players);
    const byId = Object.fromEntries(nextPlayers.map((p) => [p.id, p]));
    const teamA = [...(data.teamA || [])];
    const teamB = [...(data.teamB || [])];
    const winners = data.winner === "A" ? teamA : teamB;
    const losers = data.winner === "A" ? teamB : teamA;
    const merdaIds = automaticMerdaIds(byId, losers);
    const merdaClearedIds = automaticMerdaClearedIds(byId, winners);
    const eloChanges = applyEffects(byId, teamA, teamB, data.winner, data.mvpId, merdaIds, merdaClearedIds);
    const match = normalizeMatch({
      ...data,
      merdaIds,
      merdaId: merdaIds[0] || undefined,
      merdaClearedIds,
      id: uid(),
      date: data.date || new Date().toISOString(),
      season: data.season || competitionData?.current?.season_number || dashboardData?.competition?.season_number || 1,
      eloChanges,
    });
    const nextMatches = [match, ...matches];
    recomputeRecent(byId, nextMatches, new Set([...teamA, ...teamB]));
    const ok = await persistWholeState(Object.values(byId), nextMatches);

    if (ok && STORAGE_MODE === "supabase") {
      void discordRequest({
        action: "result",
        teamA: teamA.map((id) => byId[id]?.name).filter(Boolean),
        teamB: teamB.map((id) => byId[id]?.name).filter(Boolean),
        winner: match.winner,
        game: match.game,
        mode: match.mode,
        mvp: match.mvpId ? byId[match.mvpId]?.name || "" : "",
      }, { silent: true });
    }

    if (ok) {
      const moneyOk = await syncMatchMoneyPairings(match, { silent: false });
      if (!moneyOk) {
        toast.error("Match saved, but Money Chall statistics could not sync");
      }
      void logAdminAction("match.add", "match", match.id, {
        game: match.game,
        mode: match.mode,
        winner: match.winner,
        moneyPairings: match.pairings?.length || 0,
      });
    }
    return ok;
  }, [players, matches, backendWrite, persistWholeState, discordRequest, logAdminAction, competitionData, dashboardData, syncMatchMoneyPairings]);

  const editMatch = useCallback(async (id, data) => {
    if (STORAGE_MODE === "backend") {
      return backendWrite(`/matches/${id}`, { method: "PUT", body: data });
    }

    const old = matches.find((m) => m.id === id);
    if (!old) return false;

    const nextPlayers = clonePlayers(players);
    const byId = Object.fromEntries(nextPlayers.map((p) => [p.id, p]));
    revertEffects(byId, old);

    const teamA = [...(data.teamA || [])];
    const teamB = [...(data.teamB || [])];
    const nextMatch = normalizeMatch({
      ...old,
      ...data,
      id,
      date: data.date || old.date,
    });
    const winners = nextMatch.winner === "A" ? teamA : teamB;
    const losers = nextMatch.winner === "A" ? teamB : teamA;
    const merdaIds = automaticMerdaIds(byId, losers);
    const merdaClearedIds = automaticMerdaClearedIds(byId, winners);
    nextMatch.merdaIds = merdaIds;
    nextMatch.merdaId = merdaIds[0] || undefined;
    nextMatch.merdaClearedIds = merdaClearedIds;
    nextMatch.eloChanges = applyEffects(byId, teamA, teamB, nextMatch.winner, nextMatch.mvpId, merdaIds, merdaClearedIds);

    const nextMatches = matches.map((m) => (m.id === id ? nextMatch : m));
    recomputeRecent(byId, nextMatches, new Set([...old.teamA, ...old.teamB, ...teamA, ...teamB]));
    const ok = await persistWholeState(Object.values(byId), nextMatches);
    if (ok) {
      const moneyOk = await syncMatchMoneyPairings(nextMatch, { silent: false });
      if (!moneyOk) {
        toast.error("Match updated, but Money Chall statistics could not sync");
      }
      void logAdminAction("match.update", "match", id, {
        winner: nextMatch.winner,
        game: nextMatch.game,
        mode: nextMatch.mode,
        moneyPairings: nextMatch.pairings?.length || 0,
      });
    }
    return ok;
  }, [players, matches, backendWrite, persistWholeState, logAdminAction, syncMatchMoneyPairings]);

  const deleteMatch = useCallback(async (id) => {
    if (STORAGE_MODE === "backend") return backendWrite(`/matches/${id}`, { method: "DELETE" });

    const old = matches.find((m) => m.id === id);
    if (!old) return false;

    const nextPlayers = clonePlayers(players);
    const byId = Object.fromEntries(nextPlayers.map((p) => [p.id, p]));
    revertEffects(byId, old);
    const nextMatches = matches.filter((m) => m.id !== id);
    recomputeRecent(byId, nextMatches, new Set([...old.teamA, ...old.teamB]));
    const ok = await persistWholeState(Object.values(byId), nextMatches);
    if (ok) {
      await syncMatchMoneyPairings({ ...old, pairings: [] }, { silent: true });
      void logAdminAction("match.delete", "match", id, { game: old.game, mode: old.mode });
    }
    return ok;
  }, [players, matches, backendWrite, persistWholeState, logAdminAction, syncMatchMoneyPairings]);

  const value = {
    players,
    matches,
    playerMap,
    admin,
    isAdmin,
    adminAuthLoading,
    loaded,
    storageMode: STORAGE_MODE,
    discordSession,
    discordAccount,
    discordPlayer,
    discordLoading,
    playerAvatars,
    playerProfiles,
    challenges,
    publicChallenges,
    matchReports,
    dashboardData,
    competitionData,
    challengeNotificationCount,
    adminChallengeAlertCount,
    refreshChallenges,
    refreshMatchReports,
    createMatchReport,
    confirmMatchReport,
    disputeMatchReport,
    adminResolveMatchReport,
    createChallenge,
    createRechallenge,
    closeChallengeSeries,
    markChallengeSeriesPaymentSent,
    confirmChallengeSeriesPaymentReceived,
    respondToChallenge,
    markChallengePaymentSent,
    confirmChallengePaymentReceived,
    disputeChallengePayout,
    uploadChallengeEvidence,
    markChallengeSeen,
    listChallengeMessages,
    sendChallengeMessage,
    setChallengeReady,
    reportChallengeResult,
    verifyChallengeResult,
    cancelChallenge,
    listAdminChallenges,
    adminCreateChallengePairings,
    syncMatchMoneyPairings,
    adminUpdateChallenge,
    adminDeleteChallenge,
    listAdminAudit,
    logAdminAction,
    refreshPublicChallenges: fetchPublicChallenges,
    refreshDashboardData: fetchDashboardData,
    refreshCompetitionData: fetchCompetitionData,
    refreshAdminChallengeAlerts,
    startNewSeason,
    refreshPlayerAvatars: fetchPlayerAvatars,
    saveMyChallengeLinks,
    signInWithDiscord,
    signOutDiscord,
    refreshDiscordAccount,
    listDiscordAccounts,
    linkDiscordAccount,
    setAdmin,
    changeAdminPassword,
    logoutAllAdminSessions,
    addPlayer,
    removePlayer,
    editElo,
    editPlayerName,
    editPlayer,
    resetStats,
    importPlayers,
    importFullBackup,
    getDiscordStatus,
    configureDiscordWebhook,
    clearDiscordWebhook,
    testDiscordWebhook,
    sendDiscordTeams,
    recordMatch,
    editMatch,
    deleteMatch,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
