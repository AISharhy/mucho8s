import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { load, save } from "@/lib/storage";
import { toast } from "sonner";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 3500;

export const DataProvider = ({ children }) => {
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [admin, setAdminState] = useState(() => load("admin", null)); // { nickname, password }
  const [loaded, setLoaded] = useState(false);
  const versionRef = useRef(-1);

  const applyState = useCallback((data) => {
    if (typeof data.version === "number" && data.version === versionRef.current) return;
    versionRef.current = data.version;
    setPlayers(data.players || []);
    setMatches(data.matches || []);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API}/state`);
      if (!res.ok) return;
      const data = await res.json();
      applyState(data);
      setLoaded(true);
    } catch (e) {
      // network hiccup — keep last known state
    }
  }, [applyState]);

  // initial load + live polling (every ~3.5s)
  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, POLL_MS);
    return () => clearInterval(t);
  }, [fetchState]);

  useEffect(() => {
    save("admin", admin);
  }, [admin]);

  const playerMap = useMemo(() => {
    const m = {};
    players.forEach((p) => (m[p.id] = p));
    return m;
  }, [players]);

  const isAdmin = !!(admin && admin.password);

  const authHeaders = useCallback(
    () => ({ "Content-Type": "application/json", "X-Admin-Password": admin?.password || "" }),
    [admin]
  );

  // Generic authenticated write; refetches state on success.
  const write = useCallback(
    async (path, { method = "POST", body } = {}) => {
      try {
        const res = await fetch(`${API}${path}`, {
          method,
          headers: authHeaders(),
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
        versionRef.current = -1; // force refresh
        await fetchState();
        return true;
      } catch (e) {
        toast.error("Network error — please retry");
        return false;
      }
    },
    [authHeaders, fetchState]
  );

  const setAdmin = useCallback(async (nickname, password) => {
    if (nickname === null) {
      setAdminState(null);
      return true;
    }
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setAdminState({ nickname: data.nickname, password });
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  const addPlayer = useCallback((name, startElo = 1000) => write("/players", { body: { name, startElo } }), [write]);
  const removePlayer = useCallback((id) => write(`/players/${id}`, { method: "DELETE" }), [write]);
  const editElo = useCallback((id, currentElo) => write(`/players/${id}/elo`, { method: "PUT", body: { currentElo } }), [write]);
  const resetStats = useCallback(() => write("/reset-stats"), [write]);
  const resetToDemo = useCallback(() => write("/reset-demo"), [write]);
  const importPlayers = useCallback((list) => write("/players/import", { body: { players: list } }), [write]);

  // One-time recovery of data previously saved in this browser's localStorage.
  const restoreLocal = useCallback(async () => {
    const lp = load("players", null);
    const lm = load("matches", null);
    if (!Array.isArray(lp) || lp.length === 0) return { ok: false, reason: "none" };
    const ok = await write("/restore", { body: { players: lp, matches: Array.isArray(lm) ? lm : [] } });
    return { ok, players: lp.length, matches: Array.isArray(lm) ? lm.length : 0 };
  }, [write]);
  const recordMatch = useCallback((data) => write("/matches", { body: data }), [write]);
  const editMatch = useCallback((id, data) => write(`/matches/${id}`, { method: "PUT", body: data }), [write]);
  const deleteMatch = useCallback((id) => write(`/matches/${id}`, { method: "DELETE" }), [write]);

  const value = {
    players,
    matches,
    playerMap,
    admin,
    isAdmin,
    loaded,
    setAdmin,
    addPlayer,
    removePlayer,
    editElo,
    resetStats,
    resetToDemo,
    importPlayers,
    restoreLocal,
    recordMatch,
    editMatch,
    deleteMatch,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
