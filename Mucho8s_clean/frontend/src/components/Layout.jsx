import React, { Component, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import ChallengeCenter from "@/components/ChallengeCenter";
import CompetitiveEventFX from "@/components/CompetitiveEventFX";
import SeasonAwardReveal from "@/components/SeasonAwardReveal";
import { PageSkeleton } from "@/components/ProductState";
import { PlayerAvatar, EloBadge } from "@/components/shared";
import ModeBadge from "@/components/ModeBadge";
import { AlertTriangle, Bell, CheckCheck, Swords, Trophy, ShieldAlert, WalletCards, X, Shield, Gamepad2, Search, ChevronDown, LogOut, MessageCircle, UserCircle, Twitch } from "lucide-react";
import { useData } from "@/context/DataContext";
import { fetchTourney, subscribeTourney } from "@/lib/tourneyLive";

class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page render error", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="m8-panel rounded-2xl p-8 min-h-[280px] flex flex-col items-center justify-center text-center">
          <AlertTriangle size={28} className="text-orange-400 mb-3" />
          <h2 className="font-display text-xl font-bold">This page could not load</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {this.state.error?.message || "A page error occurred."}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 h-10 px-4 rounded-xl bg-magma text-white text-sm font-bold"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const TOP_NAV = [
  { to: "/play", label: "Play" },
  { to: "/matches", label: "Matches" },
  { to: "/ranking", label: "Leaderboard" },
  { to: "/rank-guide", label: "Rank System" },
  { to: "/bacheca", label: "Bacheca" },
  { to: "/news", label: "News" },
];

const TITLES = {
  "/": "Dashboard",
  "/play": "Play",
  "/wallet": "Wallet",
  "/players": "Players",
  "/teams": "Team",
  "/team-builder": "Team Builder",
  "/balancer": "Team Builder",
  "/draft": "Team Builder",
  "/matches": "Matches",
  "/ranking": "Ranking",
  "/bacheca": "Bacheca",
  "/bacheca/hall-of-fame": "Hall of Fame",
  "/bacheca/rivalries": "Rivalries",
  "/bacheca/records": "Records",
  "/rivalries": "Bacheca",
  "/leaderboard": "Ranking",
  "/statistics": "Ranking",
  "/rank-guide": "Rank System",
  "/ranks": "Rank System",
  "/admin": "Admin Panel",
  "/challenges": "Mucho1v1",
  "/challenge-ranking": "Mucho1v1 Ranking",
  "/live": "Live",
  "/tourney/live": "MuchoTourney Live",
};

export const Layout = () => {
  const loc = useLocation();
  const {
    discordPlayer,
    discordAccount,
    discordSession,
    discordLoading,
    signInWithDiscord,
    signOutDiscord,
    submitPlayerNameRequest,
    challengeNotificationCount,
    markChallengeSeen,
    adminChallengeAlertCount,
    adminAccountAlertCount,
    isAdmin,
    challenges,
    liveMatches,
    matchReports,
    matches,
    playerMap,
    playerAvatars,
    dashboardData,
    loaded,
  } = useData();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [requestedPlayerName, setRequestedPlayerName] = useState("");
  const [submittingPlayerRequest, setSubmittingPlayerRequest] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [seenModeNotificationKeys, setSeenModeNotificationKeys] = useState(() => new Set());
  const [liveTourney, setLiveTourney] = useState(null);

  useEffect(() => {
    let alive = true;
    const apply = (row) => {
      if (!alive) return;
      const entryPublished =
        row?.status === "setup" &&
        row?.switcheroo?.setupStage === "published";
      const visibleStatus = ["review", "ready", "live", "completed"].includes(row?.status);
      setLiveTourney(entryPublished || visibleStatus ? row : null);
    };
    fetchTourney().then(apply);
    const off = subscribeTourney(apply);
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    setAccountOpen(false);
    setSearchOpen(false);
    setSearchQuery("");
  }, [loc.pathname]);

  useEffect(() => {
    if (!discordAccount?.id || discordAccount?.player_id) return;
    setRequestedPlayerName(
      discordAccount?.requested_player_name ||
      discordAccount?.display_name ||
      discordAccount?.discord_username ||
      ""
    );
  }, [
    discordAccount?.id,
    discordAccount?.player_id,
    discordAccount?.requested_player_name,
    discordAccount?.display_name,
    discordAccount?.discord_username,
  ]);

  useEffect(() => {
    if (!discordPlayer?.id) {
      setSeenModeNotificationKeys(new Set());
      return;
    }

    try {
      const raw = localStorage.getItem(`mucho_notifications_seen_${discordPlayer.id}`);
      const list = raw ? JSON.parse(raw) : [];
      setSeenModeNotificationKeys(new Set(Array.isArray(list) ? list : []));
    } catch {
      setSeenModeNotificationKeys(new Set());
    }
  }, [discordPlayer?.id]);

  const mucho1v1Notifications = useMemo(() => {
    if (!discordAccount?.id) return [];

    const seriesSeen = new Set();

    return [...challenges]
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b?.updated_at || b?.created_at || 0) -
          new Date(a?.updated_at || a?.created_at || 0)
      )
      .reduce((rows, challenge) => {
        const event = String(challenge?.last_event || challenge?.status || "");
        const source = String(challenge?.source || "");

        if (["match_pairing", "balancer_pairing"].includes(source)) return rows;
        if (
          [
            "admin_update",
            "admin_sync",
            "pairing_assigned",
            "challenger_ready",
            "challenged_ready",
            "ready_removed",
            "payout_received",
            "series_payout_received",
          ].includes(event)
        ) return rows;

        const isChallenger = challenge.challenger_account_id === discordAccount.id;
        const isChallenged = challenge.challenged_account_id === discordAccount.id;
        if (!isChallenger && !isChallenged) return rows;

        if (challenge.series_id) {
          if (seriesSeen.has(challenge.series_id)) return rows;
          seriesSeen.add(challenge.series_id);
        }

        const opponentId = isChallenger
          ? challenge.challenged_player_id
          : challenge.challenger_player_id;
        const opponent = playerMap[opponentId];
        const iWon =
          challenge.status === "completed" &&
          challenge.reported_winner_player_id === discordPlayer?.id;

        let title = "";
        let tone = "neutral";

        if (challenge.status === "pending" && isChallenged) {
          title = `New Mucho1v1 from ${opponent?.name || "player"}`;
          tone = "magma";
        } else if (event === "accepted" && isChallenger) {
          title = `${opponent?.name || "Player"} accepted your Mucho1v1`;
          tone = "green";
        } else if (
          challenge.status === "result_pending" &&
          challenge.reporter_account_id !== discordAccount.id
        ) {
          title = "Result needs verification";
          tone = "gold";
        } else if (challenge.status === "disputed" || event === "payout_disputed") {
          title = "Mucho1v1 dispute opened";
          tone = "orange";
        } else if (event === "payout_sent") {
          title = "Payment marked as sent";
          tone = "gold";
        } else if (event === "rechallenge_created") {
          title = `Mucho1v1 rematch vs ${opponent?.name || "player"}`;
          tone = "magma";
        } else if (event === "series_ended") {
          title = "Mucho1v1 Series closed";
          tone = "neutral";
        } else if (event === "series_payout_sent") {
          title = "Series payment sent";
          tone = "gold";
        } else if (challenge.status === "completed" && event === "completed") {
          title = iWon ? "Mucho1v1 won" : "Mucho1v1 lost";
          tone = iWon ? "green" : "red";
        } else if (["declined", "series_declined"].includes(event)) {
          title = "Mucho1v1 declined";
          tone = "red";
        } else if (["cancelled", "series_cancelled"].includes(event)) {
          title = "Mucho1v1 cancelled";
          tone = "red";
        }

        if (!title) return rows;

        rows.push({
          key: `mucho1v1:${challenge.id}:${event}`,
          mode: "mucho1v1",
          challenge,
          title,
          detail: `vs ${opponent?.name || "Player"} · €${(Number(challenge.amount_cents || 0) / 100).toFixed(2)}`,
          tone,
          to: `/challenges/${challenge.id}`,
          timestamp: challenge.updated_at || challenge.created_at,
        });
        return rows;
      }, [])
      .slice(0, 6);
  }, [challenges, discordAccount, discordPlayer, playerMap]);

  const mucho8sNotifications = useMemo(() => {
    const playerId = String(discordPlayer?.id || "");
    if (!playerId) return [];

    const rows = [];

    (Array.isArray(liveMatches) ? liveMatches : []).forEach((match) => {
      const teamA = (Array.isArray(match?.team_a) ? match.team_a : []).map(String);
      const teamB = (Array.isArray(match?.team_b) ? match.team_b : []).map(String);
      if (![...teamA, ...teamB].includes(playerId)) return;
      if (String(match?.status || "live") !== "live") return;

      rows.push({
        key: `mucho8s:live:${match.id}`,
        mode: "mucho8s",
        title: "Mucho8s is live",
        detail: [match.format, match.game, match.mode].filter(Boolean).join(" · ") || "Live team match",
        tone: "magma",
        to: `/matches/live/${match.id}`,
        timestamp: match.created_at,
      });
    });

    (Array.isArray(matchReports) ? matchReports : []).forEach((report) => {
      const teamA = (Array.isArray(report?.team_a) ? report.team_a : []).map(String);
      const teamB = (Array.isArray(report?.team_b) ? report.team_b : []).map(String);
      if (![...teamA, ...teamB].includes(playerId)) return;
      if (!["pending", "disputed"].includes(String(report?.status || ""))) return;

      rows.push({
        key: `mucho8s:report:${report.id}:${report.status}`,
        mode: "mucho8s",
        title:
          report.status === "disputed"
            ? "Mucho8s result disputed"
            : "Mucho8s result needs verification",
        detail: [report.game, report.mode].filter(Boolean).join(" · ") || "Match result",
        tone: report.status === "disputed" ? "orange" : "gold",
        to: "/matches",
        timestamp: report.updated_at || report.created_at,
      });
    });

    (Array.isArray(matches) ? matches : []).forEach((match) => {
      if (match?.trophyBonusEligible !== true) return;

      const unlocks = Array.isArray(match?.trophyUnlocks?.[playerId])
        ? match.trophyUnlocks[playerId]
        : [];
      if (!unlocks.length) return;

      rows.push({
        key: `mucho8s:trophy:${match.id}`,
        mode: "mucho8s",
        title: `${unlocks.length} Trophy8s unlocked`,
        detail: unlocks
          .map((item) => String(item || "").replaceAll("-", " "))
          .join(" · "),
        tone: "magma",
        to: `/players/${playerId}`,
        timestamp: match.date,
      });
    });

    return rows
      .filter((item) => item.key && item.timestamp)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8);
  }, [discordPlayer?.id, liveMatches, matchReports, matches]);

  const notifications = useMemo(
    () =>
      [...mucho8sNotifications, ...mucho1v1Notifications]
        .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .slice(0, 10),
    [mucho8sNotifications, mucho1v1Notifications]
  );

  const unseenMucho8sCount = useMemo(
    () =>
      mucho8sNotifications.filter(
        (item) => !seenModeNotificationKeys.has(item.key)
      ).length,
    [mucho8sNotifications, seenModeNotificationKeys]
  );

  const globalNotificationCount =
    Number(challengeNotificationCount || 0) + unseenMucho8sCount;

  const adminMatchAttentionCount = useMemo(
    () => (Array.isArray(matchReports) ? matchReports : []).filter((report) =>
      ["pending", "disputed"].includes(String(report?.status || ""))
    ).length,
    [matchReports]
  );

  const adminAttentionCount =
    Number(adminChallengeAlertCount || 0) +
    Number(adminAccountAlertCount || 0) +
    adminMatchAttentionCount;

  const persistSeenModeNotifications = (keys) => {
    if (!discordPlayer?.id) return;

    const next = new Set(seenModeNotificationKeys);
    (keys || []).forEach((key) => {
      if (key) next.add(key);
    });

    setSeenModeNotificationKeys(next);
    try {
      localStorage.setItem(
        `mucho_notifications_seen_${discordPlayer.id}`,
        JSON.stringify([...next].slice(-200))
      );
    } catch {
      // Ignore local storage failures.
    }
  };

  const handleMarkAllRead = async () => {
    if (!discordAccount?.id || markingAllRead) return;

    const unread = challenges.filter((challenge) => {
      const isChallenger = challenge.challenger_account_id === discordAccount.id;
      const isChallenged = challenge.challenged_account_id === discordAccount.id;
      if (!isChallenger && !isChallenged) return false;

      const seenStatus = isChallenger
        ? challenge.challenger_seen_status
        : challenge.challenged_seen_status;
      const seenEvent = isChallenger
        ? challenge.challenger_seen_event
        : challenge.challenged_seen_event;
      const currentEvent = challenge.last_event || challenge.status;

      return seenStatus !== challenge.status || seenEvent !== currentEvent;
    });

    const unreadMucho8sKeys = mucho8sNotifications
      .filter((item) => !seenModeNotificationKeys.has(item.key))
      .map((item) => item.key);

    if (!unread.length && !unreadMucho8sKeys.length) return;

    setMarkingAllRead(true);
    try {
      await Promise.all(unread.map((challenge) => markChallengeSeen(challenge.id)));
      persistSeenModeNotifications(unreadMucho8sKeys);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const onlinePlayers = useMemo(() => {
    const presenceRows = Array.isArray(dashboardData?.onlinePlayers)
      ? dashboardData.onlinePlayers
      : [];
    const twitchRows = Array.isArray(dashboardData?.twitchLivePlayers)
      ? dashboardData.twitchLivePlayers
      : [];
    const byPlayerId = new Map();

    presenceRows.forEach((row) => {
      const id = String(row?.player_id || "").trim();
      if (!id || !playerMap[id]) return;
      byPlayerId.set(id, {
        ...playerMap[id],
        lastSeenAt: row?.last_seen_at || null,
        twitchLive: false,
        twitchChannel: "",
      });
    });

    twitchRows.forEach((row) => {
      const id = String(row?.player_id || "").trim();
      if (!id || !playerMap[id]) return;
      const current = byPlayerId.get(id) || {
        ...playerMap[id],
        lastSeenAt: null,
      };
      byPlayerId.set(id, {
        ...current,
        twitchLive: true,
        twitchChannel: String(row?.twitch_channel || "").trim(),
        twitchStartedAt: row?.started_at || null,
      });
    });

    return [...byPlayerId.values()].sort((a, b) => {
      if (Boolean(a.twitchLive) !== Boolean(b.twitchLive)) return a.twitchLive ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [dashboardData?.onlinePlayers, dashboardData?.twitchLivePlayers, playerMap]);

  const twitchLivePlayers = useMemo(
    () =>
      onlinePlayers
        .filter((player) => Boolean(player?.twitchLive))
        .sort((a, b) => {
          const aStarted = Date.parse(String(a?.twitchStartedAt || "")) || Number.MAX_SAFE_INTEGER;
          const bStarted = Date.parse(String(b?.twitchStartedAt || "")) || Number.MAX_SAFE_INTEGER;
          return aStarted - bStarted;
        }),
    [onlinePlayers]
  );

  const siteOnlinePlayers = useMemo(
    () => onlinePlayers.filter((player) => Boolean(player?.lastSeenAt)),
    [onlinePlayers]
  );

  const twitchOnlyPlayers = useMemo(
    () => twitchLivePlayers.filter((player) => !player?.lastSeenAt),
    [twitchLivePlayers]
  );

  const playerSearchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return [];
    return Object.values(playerMap || {})
      .filter(Boolean)
      .filter((player) => String(player.name || "").toLowerCase().includes(term))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .slice(0, 6);
  }, [playerMap, searchQuery]);

  const busyPlayerIds = useMemo(() => {
    const ids = new Set();
    challenges.forEach((challenge) => {
      if (!["accepted", "result_pending"].includes(String(challenge?.status || ""))) return;
      if (challenge.challenger_player_id) ids.add(String(challenge.challenger_player_id));
      if (challenge.challenged_player_id) ids.add(String(challenge.challenged_player_id));
    });
    return ids;
  }, [challenges]);

  const title =
    TITLES[loc.pathname] ||
    (loc.pathname.startsWith("/matches/live/")
      ? "Match Room"
      : loc.pathname.startsWith("/bacheca/rivalries/") || loc.pathname.startsWith("/rivalries/")
        ? "Rivalry"
        : loc.pathname.startsWith("/bacheca")
          ? "Bacheca"
          : loc.pathname.startsWith("/players/")
          ? "Player Profile"
          : loc.pathname.startsWith("/teams/")
            ? "Team"
          : loc.pathname.startsWith("/challenges/")
            ? "Mucho1v1"
            : "MuchoMoney8s");

  useEffect(() => {
    document.title = title === "MuchoMoney8s" ? "MuchoMoney8s" : `${title} · MuchoMoney8s`;
  }, [title]);

  const needsPlayerOnboarding = Boolean(
    discordSession &&
    discordAccount &&
    !discordAccount.player_id
  );
  const playerRequestStatus = String(discordAccount?.player_request_status || "");

  const sendPlayerRequest = async (event) => {
    event?.preventDefault?.();
    const name = requestedPlayerName.trim();
    if (!name || submittingPlayerRequest) return;

    setSubmittingPlayerRequest(true);
    await submitPlayerNameRequest(name);
    setSubmittingPlayerRequest(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0D12]">
      <ChallengeCenter />
      <CompetitiveEventFX />
      <SeasonAwardReveal />

      {needsPlayerOnboarding && (
        <div className="m8-discord-onboarding" data-testid="discord-player-onboarding">
          <div className="m8-discord-onboarding-card">
            <div className="m8-discord-onboarding-icon">
              <MessageCircle size={24} />
            </div>

            <div className="m8-discord-onboarding-kicker">Discord connected</div>

            <div className="mt-4 mb-5 rounded-xl border border-red-500/30 bg-red-500/[0.07] px-4 py-3 text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-red-400">
                Private Circle Only
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-[#C9CED7]">
                Mucho8s è una piattaforma privata ed esclusiva, riservata ai membri del
                <strong className="text-white"> Circle Mucho8s</strong>. Se non fai già parte del Circle,
                non inviare una richiesta di accesso. Grazie.
              </p>
            </div>

            {playerRequestStatus === "pending" ? (
              <>
                <h2>Request sent</h2>
                <p>
                  You asked to use <strong>{discordAccount?.requested_player_name || requestedPlayerName}</strong> on Mucho8s.
                  An Admin must approve it before your player profile becomes active.
                </p>
                <div className="m8-discord-request-status is-pending">
                  <span />
                  Waiting for Admin approval
                </div>
              </>
            ) : (
              <>
                <h2>Choose your Mucho8s name</h2>
                <p>
                  This is the nickname other players will see. Send the request and an Admin will approve or reject it.
                </p>

                {playerRequestStatus === "rejected" && (
                  <div className="m8-discord-request-status is-rejected">
                    Your previous request was rejected. Choose another name and send it again.
                  </div>
                )}

                <form onSubmit={sendPlayerRequest} className="m8-discord-onboarding-form">
                  <label htmlFor="mucho-player-name">Player name</label>
                  <input
                    id="mucho-player-name"
                    value={requestedPlayerName}
                    onChange={(event) => setRequestedPlayerName(event.target.value)}
                    maxLength={20}
                    autoFocus
                    placeholder="e.g. Sharhy"
                    autoComplete="off"
                  />
                  <button
                    type="submit"
                    disabled={submittingPlayerRequest || requestedPlayerName.trim().length < 2}
                  >
                    {submittingPlayerRequest ? "Sending..." : "Send request"}
                  </button>
                </form>
              </>
            )}

            <button
              type="button"
              className="m8-discord-onboarding-logout"
              onClick={signOutDiscord}
            >
              <LogOut size={14} />
              Logout Discord
            </button>
          </div>
        </div>
      )}

      <header className="m8-topbar sticky top-0 z-40">
        <div className="m8-topbar-inner">
          <div className="lg:hidden">
            <MobileNav />
          </div>

          <Link to="/" className="m8-topbar-brand" aria-label="Mucho8s home">
            <span className="m8-topbar-wordmark">MUCHO<span>8S</span></span>
          </Link>

          <div className="m8-topbar-online-wrap">
            <button
              type="button"
              onClick={() => {
                setOnlineOpen((open) => !open);
                setNotificationsOpen(false);
                setAccountOpen(false);
                setSearchOpen(false);
              }}
              aria-label={`${onlinePlayers.length} players online`}
              title="Players online"
              aria-expanded={onlineOpen}
              aria-controls="online-players-panel"
              data-testid="header-online-players"
              className="m8-topbar-online"
            >
              <span className="m8-topbar-online-dot" />
              <span className="font-mono font-black">{onlinePlayers.length}</span>
              <span>ONLINE</span>
            </button>
            {onlineOpen && (
              <div
                id="online-players-panel"
                role="dialog"
                aria-label="Players online"
                onMouseLeave={() => setOnlineOpen(false)}
                className="m8-topbar-online-panel m8-topbar-popover-enter m8-panel rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1D222C]">
                  <div>
                    <div className="brand-kicker mb-0.5">Presence</div>
                    <div className="font-display font-bold">
                      {onlinePlayers.length} Online
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOnlineOpen(false)}
                    aria-label="Close online players"
                    className="w-8 h-8 rounded-lg bg-[#171B23] border border-[#2A303B] flex items-center justify-center text-muted-foreground hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-[400px] overflow-y-auto p-2">
                  {siteOnlinePlayers.length === 0 && twitchOnlyPlayers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      No players online right now.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {siteOnlinePlayers.length > 0 && (
                        <div>
                          <div className="px-3 pt-1 pb-1.5 text-[9px] uppercase tracking-[0.18em] font-black text-[#657080]">
                            Online now
                          </div>
                          <div className="space-y-1">
                            {siteOnlinePlayers.map((player) => {
                              const inMatch = busyPlayerIds.has(String(player.id));
                              return (
                                <Link
                                  key={`site:${player.id}`}
                                  to={`/players/${player.id}`}
                                  onClick={() => setOnlineOpen(false)}
                                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
                                >
                                  <div className="relative">
                                    <PlayerAvatar
                                      name={player.name}
                                      elo={player.currentElo}
                                      size={34}
                                      avatarUrl={playerAvatars?.[player.id]}
                                    />
                                    <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#101319]" />
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-sm truncate">{player.name}</div>
                                    {player.twitchLive ? (
                                      <div className="text-[10px] mt-0.5 text-[#B88CFF] inline-flex items-center gap-1">
                                        <Twitch size={11} />
                                        <span>Online · LIVE on Twitch</span>
                                      </div>
                                    ) : (
                                      <div className={`text-[10px] mt-0.5 ${inMatch ? "text-[#D5A33A]" : "text-emerald-400"}`}>
                                        {inMatch ? "In Match" : "Available"}
                                      </div>
                                    )}
                                  </div>

                                  <EloBadge elo={player.currentElo} />
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {twitchOnlyPlayers.length > 0 && (
                        <div>
                          <div className="px-3 pt-2 pb-1.5 text-[9px] uppercase tracking-[0.18em] font-black text-[#A970FF] flex items-center gap-1.5">
                            <Twitch size={11} />
                            <span>Live on Twitch</span>
                          </div>
                          <div className="space-y-1">
                            {twitchOnlyPlayers.map((player) => (
                              <Link
                                key={`twitch:${player.id}`}
                                to={`/live/${player.id}`}
                                onClick={() => setOnlineOpen(false)}
                                className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-[#9146FF]/[0.07] border border-[#9146FF]/20 hover:bg-[#9146FF]/[0.12] transition-colors"
                              >
                                <div className="relative">
                                  <PlayerAvatar
                                    name={player.name}
                                    elo={player.currentElo}
                                    size={34}
                                    avatarUrl={playerAvatars?.[player.id]}
                                  />
                                  <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-[#9146FF] border-2 border-[#101319]" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold text-sm truncate">{player.name}</div>
                                  <div className="text-[10px] mt-0.5 text-[#C7A7FF] inline-flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#9146FF] animate-pulse" />
                                    <span>
                                      LIVE NOW
                                      {player.twitchStartedAt
                                        ? ` · ${new Date(player.twitchStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                        : ""}
                                    </span>
                                  </div>
                                </div>

                                <EloBadge elo={player.currentElo} />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <nav className="m8-topbar-nav" aria-label="Primary navigation">
            {TOP_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `m8-topbar-link ${isActive ? "is-active" : ""}`}
              >
                {item.label}
              </NavLink>
            ))}

            {liveTourney && (
              <NavLink
                to="/tourney/live"
                className={({ isActive }) => {
                  const switcheroo = liveTourney?.teamBuild === "switcheroo";
                  const activeClass = switcheroo
                    ? "border-[#FF4FA3] bg-[#FF4FA3]/20 text-[#FFD1E8]"
                    : "border-[#F3C64F] bg-[#D5A33A]/20 text-[#FFE18A]";
                  const idleClass = switcheroo
                    ? "border-[#FF4FA3]/35 bg-[#FF4FA3]/10 text-[#FF9DCE] hover:bg-[#FF4FA3]/16"
                    : "border-[#D5A33A]/35 bg-[#D5A33A]/10 text-[#E9BE55] hover:bg-[#D5A33A]/16";
                  return `h-8 px-3 rounded-lg border inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.05em] transition-all ${isActive ? activeClass : idleClass}`;
                }}
                title={`${liveTourney.name} · live tournament`}
                data-testid="header-live-muchotourney"
              >
                <span
                  className={
                    "w-1.5 h-1.5 rounded-full animate-pulse " +
                    (liveTourney?.teamBuild === "switcheroo" ? "bg-[#FF4FA3]" : "bg-[#F3C64F]")
                  }
                />
                <Trophy size={12} />
                <span>MuchoTourney</span>
              </NavLink>
            )}

            {twitchLivePlayers.length > 0 && (
              <Link
                to={`/live/${twitchLivePlayers[0].id}`}
                className="m8-twitch-live-chip"
                title={
                  twitchLivePlayers.length === 1
                    ? `${twitchLivePlayers[0].name} is live on Twitch`
                    : `${twitchLivePlayers.length} players are live on Twitch`
                }
                aria-label={
                  twitchLivePlayers.length === 1
                    ? `Watch ${twitchLivePlayers[0].name} live on Twitch`
                    : `${twitchLivePlayers.length} players live on Twitch`
                }
                data-testid="header-global-twitch-live"
              >
                <Twitch size={12} />
                <span>LIVE</span>
                {twitchLivePlayers.length > 1 && (
                  <span className="font-mono text-[9px] opacity-80">
                    {twitchLivePlayers.length}
                  </span>
                )}
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 relative">
            <div
              className={`m8-topbar-search ${searchOpen ? "is-open" : ""}`}
              onMouseEnter={() => setSearchOpen(true)}
              onMouseLeave={() => {
                if (!searchQuery.trim()) setSearchOpen(false);
              }}
            >
              <button
                type="button"
                className="m8-topbar-search-trigger"
                aria-label="Search players"
                title="Search players"
                onClick={() => {
                  setSearchOpen((open) => !open);
                  setNotificationsOpen(false);
                  setOnlineOpen(false);
                  setAccountOpen(false);
                }}
              >
                <Search size={18} />
              </button>

              <div className="m8-topbar-search-field">
                <Search size={15} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchQuery("");
                      setSearchOpen(false);
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Search players..."
                  aria-label="Search players"
                  data-testid="topbar-player-search"
                />
              </div>

              {searchOpen && searchQuery.trim() && (
                <div className="m8-topbar-search-results">
                  {playerSearchResults.length ? (
                    playerSearchResults.map((player) => (
                      <Link
                        key={player.id}
                        to={`/players/${player.id}`}
                        className="m8-topbar-search-result"
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <PlayerAvatar
                          name={player.name}
                          elo={player.currentElo}
                          size={28}
                          avatarUrl={playerAvatars?.[player.id]}
                        />
                        <span>{player.name}</span>
                        <small>{Number(player.currentElo || 0)} Elo</small>
                      </Link>
                    ))
                  ) : (
                    <div className="m8-topbar-search-empty">No players found</div>
                  )}
                </div>
              )}
            </div>

            {discordPlayer && (
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setOnlineOpen(false);
                  setAccountOpen(false);
                  setSearchOpen(false);
                }}
                aria-label={globalNotificationCount > 0 ? `${globalNotificationCount} notifications` : "Notifications"}
                title="Notifications"
                aria-expanded={notificationsOpen}
                aria-controls="challenge-notifications-panel"
                data-testid="header-challenge-bell"
                className="m8-action relative w-10 h-10 rounded-xl border border-[#242A35] bg-[#11161E] hover:bg-white/[0.05] hover:border-[#343B48] transition-all flex items-center justify-center text-[#AAB1BE] hover:text-white"
              >
                <Bell size={19} />
                {globalNotificationCount > 0 && (
                  <span
                    data-testid="header-challenge-badge"
                    className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-magma border-2 border-[#0D1016] text-white text-[9px] font-extrabold leading-none flex items-center justify-center shadow-[0_0_14px_rgba(255,42,59,0.45)]"
                  >
                    {globalNotificationCount > 99 ? "99+" : globalNotificationCount}
                  </span>
                )}
              </button>
            )}

            {isAdmin && (
              <Link
                to="/admin"
                data-testid="header-admin-alerts"
                title={adminAttentionCount > 0 ? `${adminAttentionCount} admin actions need attention` : "Admin Control Room"}
                aria-label={adminAttentionCount > 0 ? `${adminAttentionCount} admin actions need attention` : "Admin Control Room"}
                className={`relative w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${
                  adminAttentionCount > 0
                    ? "border-orange-500/35 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15"
                    : "border-[#242A35] bg-[#12151C] text-[#AAB1BE] hover:text-white"
                }`}
              >
                <Shield size={18} />
                {adminAttentionCount > 0 && (
                  <span
                    data-testid="header-admin-alert-badge"
                    className="absolute -top-1.5 -right-1.5 min-w-[19px] h-[19px] px-1 rounded-full bg-orange-500 border-2 border-[#0D1016] text-black text-[9px] font-extrabold leading-none flex items-center justify-center shadow-[0_0_14px_rgba(249,115,22,0.38)]"
                  >
                    {adminAttentionCount > 99 ? "99+" : adminAttentionCount}
                  </span>
                )}
              </Link>
            )}

            {discordSession ? (
              <div className="m8-topbar-account-wrap">
                <button
                  type="button"
                  className={`m8-topbar-account ${accountOpen ? "is-open" : ""}`}
                  data-testid="header-my-profile"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  onClick={() => {
                    setAccountOpen((open) => !open);
                    setNotificationsOpen(false);
                    setOnlineOpen(false);
                    setSearchOpen(false);
                  }}
                >
                  {discordPlayer ? (
                    <PlayerAvatar
                      name={discordPlayer.name}
                      elo={discordPlayer.currentElo}
                      size={30}
                      avatarUrl={playerAvatars?.[discordPlayer.id]}
                    />
                  ) : discordAccount?.avatar_url ? (
                    <img
                      src={discordAccount.avatar_url}
                      alt=""
                      className="w-[30px] h-[30px] rounded-full object-cover"
                    />
                  ) : (
                    <span className="m8-topbar-account-fallback">
                      <MessageCircle size={15} />
                    </span>
                  )}

                  <span className="m8-topbar-account-name">
                    {discordPlayer?.name || discordAccount?.display_name || discordAccount?.discord_username || "Discord"}
                  </span>
                  <ChevronDown
                    size={13}
                    className={`text-[#687281] transition-transform ${accountOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {accountOpen && (
                  <div className="m8-topbar-account-menu" role="menu">
                    {discordPlayer && (
                      <Link
                        to={`/players/${discordPlayer.id}`}
                        role="menuitem"
                        className="m8-topbar-account-menu-item"
                        onClick={() => setAccountOpen(false)}
                      >
                        <UserCircle size={15} />
                        <span>Profile</span>
                      </Link>
                    )}

                    {discordPlayer && (
                      <Link
                        to="/teams"
                        role="menuitem"
                        className="m8-topbar-account-menu-item"
                        onClick={() => setAccountOpen(false)}
                        data-testid="account-team-link"
                      >
                        <Shield size={15} />
                        <span>Team</span>
                      </Link>
                    )}

                    {discordPlayer && (
                      <Link
                        to="/wallet"
                        role="menuitem"
                        className="m8-topbar-account-menu-item"
                        onClick={() => setAccountOpen(false)}
                        data-testid="account-wallet-link"
                      >
                        <WalletCards size={15} />
                        <span>Wallet</span>
                      </Link>
                    )}

                    <div className="m8-topbar-account-menu-separator" />
                    <button
                      type="button"
                      role="menuitem"
                      className="m8-topbar-account-menu-item is-danger"
                      onClick={async () => {
                        setAccountOpen(false);
                        await signOutDiscord();
                      }}
                      data-testid="discord-logout-btn-topbar"
                    >
                      <LogOut size={15} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={signInWithDiscord}
                disabled={discordLoading}
                className="m8-topbar-discord-login"
                data-testid="discord-login-btn-topbar"
              >
                <MessageCircle size={15} />
                <span>{discordLoading ? "Connecting..." : "Login Discord"}</span>
              </button>
            )}
            {discordPlayer && notificationsOpen && (
                  <div
                    id="challenge-notifications-panel"
                    role="dialog"
                    aria-label="Notifications"
                    onMouseLeave={() => setNotificationsOpen(false)}
                    className="absolute right-0 top-12 w-[min(92vw,410px)] m8-topbar-popover-enter m8-panel rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#1D222C]">
                      <div>
                        <div className="brand-kicker mb-0.5">Notifications</div>
                        <div className="font-display font-bold">Mucho updates</div>
                        <div className="flex items-center gap-2 mt-1.5" aria-label="Notification modes">
                          <span className="w-2 h-2 rounded-full bg-magma" title="Mucho8s" />
                          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Mucho1v1" />
                          <span className="w-2 h-2 rounded-full bg-[#D5A33A]" title="MuchoTourney" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          disabled={markingAllRead || globalNotificationCount === 0}
                          className="h-8 px-2.5 rounded-lg bg-[#171B23] border border-[#2A303B] inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#B8C0CC] hover:text-white hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-default"
                          aria-label="Mark all notifications as read"
                        >
                          <CheckCheck size={14} className="text-emerald-400" />
                          <span>Mark All Read</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          aria-label="Close notifications"
                          className="w-8 h-8 rounded-lg bg-[#171B23] border border-[#2A303B] flex items-center justify-center text-muted-foreground hover:text-white"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No important notifications.</div>
                      ) : notifications.map((item) => {
                        const tone = item.tone || "neutral";
                        const Icon =
                          item.mode === "mucho8s"
                            ? Gamepad2
                            : tone === "green"
                              ? Trophy
                              : tone === "orange"
                                ? ShieldAlert
                                : tone === "gold"
                                  ? WalletCards
                                  : Swords;
                        const toneClass =
                          tone === "green" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                          tone === "red" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                          tone === "orange" ? "text-orange-400 bg-orange-500/10 border-orange-500/20" :
                          tone === "gold" ? "text-[#D5A33A] bg-[#D5A33A]/10 border-[#D5A33A]/20" :
                          item.mode === "mucho1v1"
                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            : "text-magma bg-magma/10 border-magma/20";

                        return (
                          <Link
                            key={item.key}
                            to={item.to}
                            onClick={() => {
                              setNotificationsOpen(false);
                              if (item.mode === "mucho8s") {
                                persistSeenModeNotifications([item.key]);
                              } else if (item.challenge?.id) {
                                void markChallengeSeen(item.challenge.id);
                              }
                            }}
                            className="flex items-start gap-3 rounded-xl p-3 hover:bg-white/[0.035] transition-colors"
                          >
                            <div className={`w-9 h-9 rounded-lg border shrink-0 flex items-center justify-center ${toneClass}`}>
                              <Icon size={15} />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <ModeBadge mode={item.mode} compact />
                              </div>
                              <div className="text-sm font-semibold truncate">{item.title}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {item.detail}
                              </div>
                            </div>

                            <span className="text-[10px] text-[#697181] shrink-0">
                              {item.timestamp
                                ? new Date(item.timestamp).toLocaleDateString()
                                : ""}
                            </span>
                          </Link>
                        );
                      })}
                    </div>

                    <Link
                      to="/play"
                      onClick={() => setNotificationsOpen(false)}
                      className="h-11 border-t border-[#1D222C] flex items-center justify-center text-sm font-semibold text-[#AAB1BE] hover:text-white hover:bg-white/[0.03]"
                    >
                      Open Play Center
                    </Link>
                  </div>
            )}
          </div>
        </div>
      </header>

      <main className="page-shell p-4 sm:p-6 lg:p-8 xl:p-9">
        {!loaded ? (
          <PageSkeleton />
        ) : (
          <PageErrorBoundary key={loc.pathname}>
            <Outlet />
          </PageErrorBoundary>
        )}
      </main>
    </div>
  );
};
