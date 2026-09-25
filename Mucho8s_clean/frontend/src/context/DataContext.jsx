import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { load, save, uid } from "@/lib/storage";
import { playerRating, BASE_ELO, MIN_ELO, WIN_DELTA, LOSS_DELTA, MVP_BONUS, UPSET_BONUS } from "@/lib/elo";
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

const ADMIN_NICKNAME = "Admin";
const ADMIN_PASSWORD_SHA256 = "5275321e80637acbd0dc2a0d0e9b5120ab79618531edd49b189ff4b4ce4ec4ff";

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
  mvpId: m?.mvpId || undefined,
  map: m?.map || "",
  mode: m?.mode || "",
  game: m?.game || "",
  eloChanges: m?.eloChanges && typeof m.eloChanges === "object" ? m.eloChanges : {},
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

const applyEffects = (byId, teamA, teamB, winner, mvpId) => {
  const winners = winner === "A" ? teamA : teamB;
  const losers = winner === "A" ? teamB : teamA;
  const winnerStrength = winners.reduce((sum, id) => sum + (byId[id] ? playerRating(byId[id]) : 0), 0);
  const loserStrength = losers.reduce((sum, id) => sum + (byId[id] ? playerRating(byId[id]) : 0), 0);
  const upset = winnerStrength < loserStrength;
  const changes = {};

  [...teamA, ...teamB].forEach((pid) => {
    const p = byId[pid];
    if (!p) return;
    const won = winners.includes(pid);
    let delta = won ? WIN_DELTA : -LOSS_DELTA;
    if (pid === mvpId) delta += MVP_BONUS;
    if (won && upset) delta += UPSET_BONUS;

    const nextElo = Math.max(MIN_ELO, p.currentElo + delta);
    p.currentElo = nextElo;
    p.peakElo = Math.max(p.peakElo, nextElo);
    p.totalMatches += 1;
    if (won) p.wins += 1;
    else p.losses += 1;
    if (pid === mvpId) p.mvpCount += 1;
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
    if ((p.eloHistory || []).length > 1) p.eloHistory = p.eloHistory.slice(0, -1);
  });
};

export const DataProvider = ({ children }) => {
  const [players, setPlayers] = useState(() => (load("players", []) || []).map(normalizePlayer));
  const [matches, setMatches] = useState(() => (load("matches", []) || []).map(normalizeMatch));
  const [admin, setAdminState] = useState(null);
  const [discordSession, setDiscordSession] = useState(null);
  const [discordAccount, setDiscordAccount] = useState(null);
  const [discordLoading, setDiscordLoading] = useState(hasSupabaseAuth);
  const [playerAvatars, setPlayerAvatars] = useState({});
  const [playerProfiles, setPlayerProfiles] = useState({});
  const [challenges, setChallenges] = useState([]);
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

      if (admin?.password) {
        headers["X-Admin-Password"] = admin.password;
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

  const saveMyChallengeLinks = useCallback(async ({ paypalUrl, revolutUrl, cmgUrl }) => {
    if (!discordSession) {
      toast.error("Login with Discord first");
      return false;
    }

    const data = await accountRequest(
      {
        action: "update-links",
        paypalUrl,
        revolutUrl,
        cmgUrl,
      },
      { session: discordSession },
    );

    if (!data?.account) return false;
    setDiscordAccount(data.account);
    await fetchPlayerAvatars();
    return true;
  }, [accountRequest, discordSession, fetchPlayerAvatars]);

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

  const markChallengeSeen = useCallback(async (id) => {
    const data = await challengeRequest({ action: "mark-seen", id }, { silent: true });
    if (!data?.challenge) return null;
    setChallenges((prev) => prev.map((item) => (item.id === id ? data.challenge : item)));
    return data.challenge;
  }, [challengeRequest]);

  const reportChallengeResult = useCallback(async (id, winnerPlayerId) => {
    const data = await challengeRequest({ action: "report-result", id, winnerPlayerId });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const verifyChallengeResult = useCallback(async (id, decision, note = "") => {
    const data = await challengeRequest({ action: "verify-result", id, decision, note });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const cancelChallenge = useCallback(async (id) => {
    const data = await challengeRequest({ action: "cancel", id });
    if (!data?.challenge) return null;
    await refreshChallenges();
    return data.challenge;
  }, [challengeRequest, refreshChallenges]);

  const isAdmin = Boolean(admin?.password);
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
          "X-Admin-Password": admin?.password || "",
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
            "X-Admin-Password": admin?.password || "",
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
          "X-Admin-Password": admin?.password || "",
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

  const setAdmin = useCallback(async (nickname, password) => {
    if (nickname === null) {
      setAdminState(null);
      return true;
    }

    const normalizedNickname = nickname.trim().toLowerCase();
    if (normalizedNickname !== ADMIN_NICKNAME.toLowerCase()) return false;

    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (hash !== ADMIN_PASSWORD_SHA256) return false;
    setAdminState({ nickname: ADMIN_NICKNAME, password });
    return true;
  }, []);

  const addPlayer = useCallback(async (name, startElo = BASE_ELO) => {
    if (STORAGE_MODE === "backend") return backendWrite("/players", { body: { name, startElo } });
    return persistWholeState([...players, makePlayer(name, startElo)], matches);
  }, [players, matches, backendWrite, persistWholeState]);

  const removePlayer = useCallback(async (id) => {
    if (STORAGE_MODE === "backend") return backendWrite(`/players/${id}`, { method: "DELETE" });
    return persistWholeState(players.filter((p) => p.id !== id), matches);
  }, [players, matches, backendWrite, persistWholeState]);

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

  const editPlayer = useCallback(async (id, { name, currentElo }) => {
    const cleanName = String(name || "").trim();
    if (!cleanName) return false;
    const elo = Math.max(MIN_ELO, Math.round(Number(currentElo) || BASE_ELO));

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
    p.peakElo = Math.max(p.peakElo, elo);
    p.eloHistory = [...(p.eloHistory || []), { match: p.eloHistory?.length || 0, elo }];
    return persistWholeState(next, matches);
  }, [players, matches, backendWrite, persistWholeState]);

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
      eloHistory: [{ match: 0, elo: BASE_ELO }],
    }));
    return persistWholeState(resetPlayers, []);
  }, [players, backendWrite, persistWholeState]);

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
    const eloChanges = applyEffects(byId, teamA, teamB, data.winner, data.mvpId);
    const match = normalizeMatch({
      ...data,
      id: uid(),
      date: data.date || new Date().toISOString(),
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

    return ok;
  }, [players, matches, backendWrite, persistWholeState, discordRequest]);

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
    nextMatch.eloChanges = applyEffects(byId, teamA, teamB, nextMatch.winner, nextMatch.mvpId);

    const nextMatches = matches.map((m) => (m.id === id ? nextMatch : m));
    recomputeRecent(byId, nextMatches, new Set([...old.teamA, ...old.teamB, ...teamA, ...teamB]));
    return persistWholeState(Object.values(byId), nextMatches);
  }, [players, matches, backendWrite, persistWholeState]);

  const deleteMatch = useCallback(async (id) => {
    if (STORAGE_MODE === "backend") return backendWrite(`/matches/${id}`, { method: "DELETE" });

    const old = matches.find((m) => m.id === id);
    if (!old) return false;

    const nextPlayers = clonePlayers(players);
    const byId = Object.fromEntries(nextPlayers.map((p) => [p.id, p]));
    revertEffects(byId, old);
    const nextMatches = matches.filter((m) => m.id !== id);
    recomputeRecent(byId, nextMatches, new Set([...old.teamA, ...old.teamB]));
    return persistWholeState(Object.values(byId), nextMatches);
  }, [players, matches, backendWrite, persistWholeState]);

  const value = {
    players,
    matches,
    playerMap,
    admin,
    isAdmin,
    loaded,
    storageMode: STORAGE_MODE,
    discordSession,
    discordAccount,
    discordPlayer,
    discordLoading,
    playerAvatars,
    playerProfiles,
    challenges,
    refreshChallenges,
    createChallenge,
    respondToChallenge,
    markChallengePaymentSent,
    confirmChallengePaymentReceived,
    markChallengeSeen,
    reportChallengeResult,
    verifyChallengeResult,
    cancelChallenge,
    refreshPlayerAvatars: fetchPlayerAvatars,
    saveMyChallengeLinks,
    signInWithDiscord,
    signOutDiscord,
    refreshDiscordAccount,
    listDiscordAccounts,
    linkDiscordAccount,
    setAdmin,
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
