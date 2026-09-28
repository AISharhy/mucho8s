import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Link, Navigate } from "react-router-dom";
import { EloBadge, PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import MatchResultCenter from "@/components/MatchResultCenter";
import ModeBadge, { isDirectMucho1v1 } from "@/components/ModeBadge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, UserPlus, Trash2, Pencil, RotateCcw, Upload, Download, LogOut, History, Database, Check, MessageCircle, Send, Link2, Swords, WalletCards, AlertTriangle, Flag, Trophy, ExternalLink, Users, Gamepad2, Newspaper, Settings } from "lucide-react";
import { toast } from "sonner";

const ADMIN_TABS = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "players", label: "Players", icon: Users },
  { key: "matches", label: "Matches", icon: Gamepad2 },
  { key: "competition", label: "Competition", icon: Trophy },
  { key: "content", label: "Content", icon: Newspaper },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function AdminPanel() {
  const {
    admin,
    isAdmin,
    adminAuthLoading,
    signOutDiscord,
    players,
    matches,
    playerMap,
    addPlayer,
    removePlayer,
    editPlayer,
    resetStats,
    importPlayers,
    importFullBackup,
    deleteMatch,
    storageMode,
    getDiscordStatus,
    configureDiscordWebhook,
    clearDiscordWebhook,
    testDiscordWebhook,
    listDiscordAccounts,
    approveDiscordPlayerRequest,
    rejectDiscordPlayerRequest,
    listAdminChallenges,
    adminUpdateChallenge,
    adminDeleteChallenge,
    listAdminAudit,
    matchReports,
    liveMatches,
    refreshMatchReports,
    refreshLiveMatches,
    cancelLiveMatch,
    adminChallengeAlertCount,
    competitionData,
    startNewSeason,
    updateCompetitionConfig,
    repairElo,
    newsPosts,
    refreshNewsPosts,
    createNewsPost,
    updateNewsPost,
    deleteNewsPost,
  } = useData();
  const [newName, setNewName] = useState("");
  const [newElo, setNewElo] = useState(500);
  const [editing, setEditing] = useState({}); // id -> { name, elo }
  const [histOpen, setHistOpen] = useState(false);
  const [newLiveOpen, setNewLiveOpen] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [discordConfigured, setDiscordConfigured] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordAccounts, setDiscordAccounts] = useState([]);
  const [accountBusyId, setAccountBusyId] = useState("");
  const [adminChallenges, setAdminChallenges] = useState([]);
  const [challengeBusyId, setChallengeBusyId] = useState("");
  const [challengeDrafts, setChallengeDrafts] = useState({});
  const [expandedChallengeId, setExpandedChallengeId] = useState("");
  const [editMatchData, setEditMatchData] = useState(null);
  const [reportMatchData, setReportMatchData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [matchControlFilter, setMatchControlFilter] = useState("live");
  const [seasonName, setSeasonName] = useState("");
  const [seasonBusy, setSeasonBusy] = useState(false);
  const [eloRepairBusy, setEloRepairBusy] = useState(false);
  const [competitionEdit, setCompetitionEdit] = useState(false);
  const [competitionBusy, setCompetitionBusy] = useState(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const [editingNewsId, setEditingNewsId] = useState("");
  const [newsDraft, setNewsDraft] = useState({
    title: "",
    summary: "",
    category: "Platform",
    accent: "#FF2A3B",
    featured: false,
  });
  const [competitionDraft, setCompetitionDraft] = useState({
    seasonName: "",
    startingElo: 500,
    rolloverMode: "monthly",
    rolloverDay: 1,
    leaderboardMinMatches: 1,
  });
  const fileRef = useRef(null);

  useEffect(() => {
    const current = competitionData?.current;
    if (!current || competitionEdit) return;

    setCompetitionDraft({
      seasonName: current.season_name || "",
      startingElo: Number(current.starting_elo ?? 500),
      rolloverMode: current.rollover_mode || "monthly",
      rolloverDay: Number(current.rollover_day ?? 1),
      leaderboardMinMatches: Number(current.leaderboard_min_matches ?? 1),
    });
  }, [competitionData?.current, competitionEdit]);

  useEffect(() => {
    if (newName.trim()) return;
    setNewElo(Number(competitionData?.current?.starting_elo ?? 500));
  }, [competitionData?.current?.starting_elo]);

  const loadDiscordAccounts = useCallback(async () => {
    const list = await listDiscordAccounts();
    if (list) setDiscordAccounts(list);
  }, [listDiscordAccounts]);

  const loadAdminChallenges = useCallback(async () => {
    const list = await listAdminChallenges();
    if (!list) return;
    setAdminChallenges(list);
    setChallengeDrafts((prev) => {
      const next = { ...prev };
      list.forEach((challenge) => {
        next[challenge.id] = {
          amount: (Number(challenge.amount_cents || 0) / 100).toFixed(2),
          winnerPlayerId: challenge.reported_winner_player_id || "",
        };
      });
      return next;
    });
  }, [listAdminChallenges]);

  const loadAuditLogs = useCallback(async () => {
    const list = await listAdminAudit();
    if (list) setAuditLogs(list);
  }, [listAdminAudit]);

  useEffect(() => {
    let active = true;
    if (!admin) return undefined;

    getDiscordStatus().then((configured) => {
      if (active) setDiscordConfigured(configured);
    });
    void loadDiscordAccounts();
    void loadAdminChallenges();
    void loadAuditLogs();

    return () => {
      active = false;
    };
  }, [admin, getDiscordStatus, loadDiscordAccounts, loadAdminChallenges, loadAuditLogs]);

  const sortedAdminChallenges = useMemo(
    () => [...adminChallenges].sort((a, b) => {
      const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime();
      const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime();
      return bTime - aTime;
    }),
    [adminChallenges],
  );

  const adminMatchRows = useMemo(() => {
    const liveTeamRows = (Array.isArray(liveMatches) ? liveMatches : []).map((match) => ({
      type: "live-team",
      id: `live:${match.id}`,
      item: match,
      timestamp: new Date(match?.created_at || 0).getTime() || 0,
      status: "live",
      attention: Boolean(match?.cancel_requested_at),
    }));

    const reportRows = (Array.isArray(matchReports) ? matchReports : [])
      .filter((report) => ["pending", "disputed"].includes(String(report?.status || "")))
      .map((report) => ({
        type: "report",
        id: `report:${report.id}`,
        item: report,
        timestamp: new Date(report?.created_at || 0).getTime() || 0,
        status: report?.status || "pending",
        attention: true,
      }));

    const teamRows = (matches || []).map((match) => ({
      type: "team",
      id: `team:${match.id}`,
      item: match,
      timestamp: new Date(match?.date || 0).getTime() || 0,
      status: "completed",
      attention: false,
    }));

    const directRows = sortedAdminChallenges
      .filter((challenge) =>
        !["match_pairing", "balancer_pairing"].includes(String(challenge?.source || ""))
      )
      .map((challenge) => ({
        type: "challenge",
        id: `chall:${challenge.id}`,
        item: challenge,
        timestamp: new Date(
          challenge?.result_reported_at ||
          challenge?.verified_at ||
          challenge?.created_at ||
          0
        ).getTime() || 0,
        status: challenge?.status || "pending",
        attention: Boolean(
          challenge?.status === "disputed" ||
          challenge?.status === "result_pending" ||
          (challenge?.payout_disputed_at && !challenge?.payout_dispute_resolved_at)
        ),
      }));

    return [...liveTeamRows, ...reportRows, ...teamRows, ...directRows].sort(
      (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
    );
  }, [liveMatches, matchReports, matches, sortedAdminChallenges]);

  const visibleAdminMatchRows = useMemo(() => {
    if (matchControlFilter === "live") {
      return adminMatchRows.filter((row) =>
        row.type === "live-team" ||
        (
          row.type === "challenge" &&
          ["pending", "accepted"].includes(row.status)
        )
      );
    }

    if (matchControlFilter === "pending") {
      return adminMatchRows.filter((row) =>
        row.type === "report" ||
        (
          row.type === "challenge" &&
          (row.attention || row.status === "result_pending" || row.status === "disputed")
        )
      );
    }

    return adminMatchRows.filter((row) =>
      row.type === "team" ||
      (row.type === "challenge" && row.status === "completed")
    );
  }, [adminMatchRows, matchControlFilter]);

  const paymentLinkStats = useMemo(() => {
    const stats = { paypal: 0, revolut: 0, both: 0, none: 0 };

    discordAccounts.forEach((account) => {
      const hasPayPal = Boolean(String(account?.paypal_url || "").trim());
      const hasRevolut = Boolean(String(account?.revolut_url || "").trim());

      if (hasPayPal && hasRevolut) stats.both += 1;
      else if (hasPayPal) stats.paypal += 1;
      else if (hasRevolut) stats.revolut += 1;
      else stats.none += 1;
    });

    return stats;
  }, [discordAccounts]);

  const challengeStats = useMemo(() => {
    const direct = adminChallenges.filter(isDirectMucho1v1);
    const active = direct.filter((challenge) =>
      ["pending", "accepted", "result_pending"].includes(challenge.status)
    ).length;
    const disputed = direct.filter((challenge) =>
      challenge.status === "disputed" ||
      (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
    ).length;
    const completed = direct.filter((challenge) => challenge.status === "completed").length;
    const totalStake = direct.reduce(
      (sum, challenge) => sum + Number(challenge.amount_cents || 0),
      0
    ) / 100;
    return { active, disputed, completed, totalStake };
  }, [adminChallenges]);

  const disputedChallenges = useMemo(
    () => sortedAdminChallenges.filter((challenge) =>
      isDirectMucho1v1(challenge) &&
      (
        challenge.status === "disputed" ||
        (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
      )
    ),
    [sortedAdminChallenges],
  );

  const pendingMatchReports = useMemo(
    () => (matchReports || []).filter((report) => ["pending", "disputed"].includes(report.status)),
    [matchReports],
  );

  const needsAttentionCount =
    pendingMatchReports.length +
    disputedChallenges.length +
    Number(adminChallengeAlertCount || 0);

  if (adminAuthLoading && !isAdmin) {
    return (
      <div className="m8-panel rounded-2xl p-8 min-h-[220px] flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#0F1218] border border-[#242A35] flex items-center justify-center mb-4">
          <Shield size={20} className="text-magma" />
        </div>
        <h2 className="font-display text-xl font-bold">Verifying Admin access</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Checking your authorized Discord session...
        </p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const handleAdd = () => {
    if (!newName.trim()) return toast.error("Enter a player name");
    const configuredStartingElo = Number(competitionData?.current?.starting_elo ?? 500);
    addPlayer(newName.trim(), Number(newElo) || configuredStartingElo);
    toast.success(`${newName.trim()} added to the roster`);
    setNewName("");
    setNewElo(configuredStartingElo);
  };

  const savePlayer = async (id) => {
    const draft = editing[id];
    if (!draft?.name?.trim()) return toast.error("Nickname cannot be empty");
    const ok = await editPlayer(id, {
      name: draft.name.trim(),
      currentElo: Number(draft.elo),
    });
    if (!ok) return;
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    toast.success("Player updated");
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result);
        if (data && Array.isArray(data.players) && Array.isArray(data.matches)) {
          const ok = await importFullBackup(data);
          if (ok) toast.success(`Full backup restored: ${data.players.length} players, ${data.matches.length} matches`);
        } else {
          const list = Array.isArray(data) ? data : data.players;
          if (!Array.isArray(list)) throw new Error("bad");
          const ok = await importPlayers(list);
          if (ok) toast.success(`Imported ${list.length} players`);
        }
      } catch {
        toast.error("Invalid JSON backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const payload = {
      format: "mucho8s-full-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      players,
      matches,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mucho8s-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success(`Backup exported: ${players.length} players, ${matches.length} matches`);
  };

  const connectDiscord = async () => {
    if (!discordWebhook.trim()) return toast.error("Paste the Discord webhook URL first");
    setDiscordBusy(true);
    const ok = await configureDiscordWebhook(discordWebhook.trim());
    if (ok) {
      setDiscordConfigured(true);
      setDiscordWebhook("");
      const tested = await testDiscordWebhook();
      if (tested) toast.success("Discord connected — test message sent");
      else toast.success("Discord webhook saved");
    }
    setDiscordBusy(false);
  };

  const sendDiscordTest = async () => {
    setDiscordBusy(true);
    const ok = await testDiscordWebhook();
    setDiscordBusy(false);
    if (ok) toast.success("Test message sent to Discord");
  };

  const disconnectDiscord = async () => {
    setDiscordBusy(true);
    const ok = await clearDiscordWebhook();
    setDiscordBusy(false);
    if (ok) {
      setDiscordConfigured(false);
      setDiscordWebhook("");
      toast.success("Discord disconnected");
    }
  };

  const handlePlayerRequest = async (accountId, decision) => {
    setAccountBusyId(accountId);
    const account = decision === "approve"
      ? await approveDiscordPlayerRequest(accountId)
      : await rejectDiscordPlayerRequest(accountId);
    setAccountBusyId("");

    if (!account) return;

    setDiscordAccounts((prev) =>
      prev.map((item) => item.id === accountId ? { ...item, ...account } : item)
    );

    if (decision === "approve") {
      toast.success(`${account.requested_player_name || "Player"} approved and created`);
    } else {
      toast.success("Player name request rejected");
    }
  };

  const resetNewsDraft = () => {
    setEditingNewsId("");
    setNewsDraft({
      title: "",
      summary: "",
      category: "Platform",
      accent: "#FF2A3B",
      featured: false,
    });
  };

  const saveNewsPost = async () => {
    const title = newsDraft.title.trim();
    const summary = newsDraft.summary.trim();
    if (!title || !summary || newsBusy) {
      if (!title || !summary) toast.error("Add a title and post text");
      return;
    }

    setNewsBusy(true);
    const payload = { ...newsDraft, title, summary, published: true };
    const saved = editingNewsId
      ? await updateNewsPost(editingNewsId, payload)
      : await createNewsPost(payload);
    setNewsBusy(false);

    if (!saved) return;
    await refreshNewsPosts();
    toast.success(editingNewsId ? "News post updated" : "News post published");
    resetNewsDraft();
  };

  const editNewsPost = (post) => {
    setEditingNewsId(String(post.id));
    setNewsDraft({
      title: post.title || "",
      summary: post.summary || "",
      category: post.category || "Platform",
      accent: post.accent || "#FF2A3B",
      featured: Boolean(post.featured),
    });
  };

  const removeNewsPost = async (id) => {
    if (newsBusy) return;
    setNewsBusy(true);
    const ok = await deleteNewsPost(id);
    setNewsBusy(false);
    if (!ok) return;
    if (String(editingNewsId) === String(id)) resetNewsDraft();
    toast.success("News post deleted");
  };

  const updateAdminChallenge = async (id, updates, successMessage = "Mucho1v1 updated") => {
    setChallengeBusyId(id);
    const updated = await adminUpdateChallenge(id, updates);
    setChallengeBusyId("");
    if (!updated) return false;
    setAdminChallenges((prev) => prev.map((item) => (item.id === id ? updated : item)));
    setChallengeDrafts((prev) => ({
      ...prev,
      [id]: {
        amount: (Number(updated.amount_cents || 0) / 100).toFixed(2),
        winnerPlayerId: updated.reported_winner_player_id || "",
      },
    }));
    toast.success(successMessage);
    return true;
  };

  const saveChallengeAmount = async (challenge) => {
    const raw = challengeDrafts[challenge.id]?.amount ?? "0";
    const amount = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(amount) || amount < 0) return toast.error("Invalid amount");
    await updateAdminChallenge(challenge.id, { amount }, "Mucho1v1 amount updated");
  };

  const setChallengeWinner = async (challenge, complete = false) => {
    const winnerPlayerId = challengeDrafts[challenge.id]?.winnerPlayerId || "";
    if (!winnerPlayerId) return toast.error("Choose a winner first");
    await updateAdminChallenge(
      challenge.id,
      {
        winnerPlayerId,
        ...(complete ? { status: "completed" } : {}),
      },
      complete ? "Mucho1v1 completed by Admin" : "Mucho1v1 winner updated"
    );
  };

  const removeAdminChallenge = async (id) => {
    setChallengeBusyId(id);
    const ok = await adminDeleteChallenge(id);
    setChallengeBusyId("");
    if (!ok) return;
    setAdminChallenges((prev) => prev.filter((item) => item.id !== id));
    toast.success("Mucho1v1 deleted");
  };

  const saveCompetitionRules = async () => {
    if (competitionBusy) return;
    setCompetitionBusy(true);
    const result = await updateCompetitionConfig({
      seasonName: competitionDraft.seasonName.trim(),
      startingElo: Number(competitionDraft.startingElo),
      rolloverMode: competitionDraft.rolloverMode,
      rolloverDay: Number(competitionDraft.rolloverDay),
      leaderboardMinMatches: Number(competitionDraft.leaderboardMinMatches),
    });
    setCompetitionBusy(false);
    if (!result) return;

    setCompetitionEdit(false);
    toast.success("Competition rules updated");
    void loadAuditLogs();
  };

  const beginNewSeason = async () => {
    setSeasonBusy(true);
    const ok = await startNewSeason({
      seasonName: seasonName.trim(),
      resetStats: true,
    });
    setSeasonBusy(false);
    if (!ok) return;
    setSeasonName("");
    toast.success("New season started and previous season archived");
  };

  const runEloRepair = async () => {
    if (eloRepairBusy) return;
    setEloRepairBusy(true);
    const result = await repairElo();
    setEloRepairBusy(false);
    if (!result) return;

    const changed = Array.isArray(result.changed) ? result.changed : [];
    if (!changed.length) {
      toast.success(`Elo checked: ${Number(result.checked || 0)} players, no errors found`);
      return;
    }

    toast.success(`Repair Elo completed: ${changed.length} player${changed.length === 1 ? "" : "s"} corrected`);
    void loadAuditLogs();
  };

  return (
    <div className="m8-page-stack">
      <section className="m8-panel rounded-2xl p-5 sm:p-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-magma" />
          <div>
            <div className="brand-kicker mb-1">Administration</div>
            <h2 className="font-display text-3xl font-black tracking-[-0.03em]">Admin Console</h2>
          </div>
          <span className="text-sm text-muted-foreground">· {admin?.nickname}</span>
        </div>
        <Button variant="ghost" onClick={signOutDiscord} data-testid="admin-logout-btn" className="text-muted-foreground">
          <LogOut size={16} className="mr-1" /> Sign out Discord
        </Button>
      </section>

      <div className="m8-panel-quiet rounded-xl p-1.5 flex gap-1 overflow-x-auto" data-testid="admin-tabs" role="tablist" aria-label="Admin sections">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 inline-flex items-center gap-2 h-10 px-3 rounded-xl border text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? "bg-white text-black border-white"
                  : "bg-[#0F1218] border-[#222834] text-muted-foreground hover:text-white"
              }`}
            >
              <Icon size={15} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "competition" && (
        <>
      <div className="m8-panel rounded-2xl p-5" data-testid="admin-season-control">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Competition</div>
            <h3 className="font-display font-black text-lg tracking-[-0.015em]">
              {competitionData?.current?.season_name || `Season ${competitionData?.current?.season_number || 1}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Starting a new season archives the current ranking and resets Elo/statistics to {Number(competitionData?.current?.starting_elo ?? 500)}.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <Input
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder={`Season ${Number(competitionData?.current?.season_number ?? 0) + 1}`}
              className="h-11 bg-[#0F1218] border-[#222834] sm:w-52"
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={seasonBusy}
                  className="h-11 bg-magma hover:bg-magma/90 text-white font-bold"
                >
                  Start New Season
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-[#101319] border-[#242A35]">
                <AlertDialogHeader>
                  <AlertDialogTitle>Start a new season?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The current season will be archived. Player Elo and seasonal statistics will reset to the configured starting Elo ({Number(competitionData?.current?.starting_elo ?? 500)}), and current match history will move into the season archive.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={beginNewSeason} className="bg-magma hover:bg-magma/90">
                    Start Season
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="m8-panel rounded-2xl p-5">
          <div className="brand-kicker mb-1">Ranking health</div>
          <h3 className="font-display font-black text-lg">Elo Maintenance</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Check every player against trusted season checkpoints, verified matches and verified Money Chall results.
          </p>
          <ConfirmButton
            testid="admin-repair-elo-btn"
            label={eloRepairBusy ? "Repairing Elo..." : "Repair Elo"}
            icon={<RotateCcw size={18} className="mr-2 text-emerald-400" />}
            title="Repair all player Elo?"
            desc="Rebuilds each player's current Elo from trusted checkpoints and verified competitive results. Match records and statistics are not deleted."
            onConfirm={runEloRepair}
          />
        </div>

        <div className="m8-panel rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="brand-kicker mb-1">Current cycle</div>
              <h3 className="font-display font-black text-lg">Season Rules</h3>
            </div>
            {!competitionEdit && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCompetitionEdit(true)}
                className="h-9 px-3 bg-[#0F1218] border border-[#222834]"
              >
                <Pencil size={14} className="mr-1.5" /> Edit
              </Button>
            )}
          </div>

          {competitionEdit ? (
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Current season name</Label>
                <Input
                  value={competitionDraft.seasonName}
                  onChange={(e) => setCompetitionDraft((prev) => ({ ...prev, seasonName: e.target.value }))}
                  className="mt-1 bg-[#0F1218] border-[#222834]"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Starting Elo</Label>
                <Input
                  type="number"
                  min="500"
                  max="3000"
                  value={competitionDraft.startingElo}
                  onChange={(e) => setCompetitionDraft((prev) => ({ ...prev, startingElo: e.target.value }))}
                  className="mt-1 bg-[#0F1218] border-[#222834]"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Season rollover</Label>
                <select
                  value={competitionDraft.rolloverMode}
                  onChange={(e) => setCompetitionDraft((prev) => ({ ...prev, rolloverMode: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-md bg-[#0F1218] border border-[#222834] px-3 text-sm"
                >
                  <option value="monthly">Monthly automatic</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>

              {competitionDraft.rolloverMode === "monthly" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Rollover day</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={competitionDraft.rolloverDay}
                    onChange={(e) => setCompetitionDraft((prev) => ({ ...prev, rolloverDay: e.target.value }))}
                    className="mt-1 bg-[#0F1218] border-[#222834]"
                  />
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Leaderboard entry · minimum matches</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={competitionDraft.leaderboardMinMatches}
                  onChange={(e) => setCompetitionDraft((prev) => ({ ...prev, leaderboardMinMatches: e.target.value }))}
                  className="mt-1 bg-[#0F1218] border-[#222834]"
                />
                <div className="text-[11px] text-muted-foreground mt-1">
                  0 = visible immediately · 1 = after first match.
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  onClick={saveCompetitionRules}
                  disabled={competitionBusy}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                >
                  <Check size={15} className="mr-1.5" />
                  {competitionBusy ? "Saving..." : "Save Rules"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCompetitionEdit(false)}
                  disabled={competitionBusy}
                  className="bg-[#0F1218] border border-[#222834]"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <div className="m8-panel-quiet rounded-xl px-3 py-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Season name</span>
                <strong>{competitionData?.current?.season_name || "Season"}</strong>
              </div>
              <div className="m8-panel-quiet rounded-xl px-3 py-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Starting Elo</span>
                <strong>{Number(competitionData?.current?.starting_elo ?? 500)}</strong>
              </div>
              <div className="m8-panel-quiet rounded-xl px-3 py-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Season rollover</span>
                <strong>
                  {competitionData?.current?.rollover_mode === "manual"
                    ? "Manual"
                    : `Monthly · day ${Number(competitionData?.current?.rollover_day ?? 1)}`}
                </strong>
              </div>
              <div className="m8-panel-quiet rounded-xl px-3 py-2 flex justify-between gap-3">
                <span className="text-muted-foreground">Leaderboard entry</span>
                <strong>
                  {Number(competitionData?.current?.leaderboard_min_matches ?? 1) === 0
                    ? "Immediately"
                    : `After ${Number(competitionData?.current?.leaderboard_min_matches ?? 1)} match${Number(competitionData?.current?.leaderboard_min_matches ?? 1) === 1 ? "" : "es"}`}
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

        </>
      )}

      {activeTab === "settings" && storageMode === "local" && (
        <div className="rounded-xl border border-[#3A3320] bg-[#D5A33A]/5 px-4 py-3 text-sm text-muted-foreground">
          <span className="text-[#D5A33A] font-semibold">Local mode:</span> player e match sono salvati solo in questo browser. Collega Supabase per avere lo stesso database su PC e telefono.
        </div>
      )}

      {activeTab === "overview" && (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="admin-overview">
        {[
          { label: "Players", value: players.length, icon: Users, sub: `${discordAccounts.filter((a) => a.player_id).length} Discord linked` },
          { label: "Mucho8s", value: matches.length, icon: Gamepad2, sub: "Recorded team results" },
          { label: "Active Mucho1v1", value: challengeStats.active, icon: Swords, sub: `${challengeStats.disputed} disputed` },
          { label: "Mucho1v1 Volume", value: `€${challengeStats.totalStake.toFixed(2)}`, icon: WalletCards, sub: `${challengeStats.completed} completed` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="m8-stat-card">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                <Icon size={16} className="text-[#697181]" />
              </div>
              <div className="font-display text-2xl font-black tracking-[-0.025em] mt-2">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>
            </div>
          );
        })}
      </div>

        </>
      )}

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="m8-panel rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="brand-kicker mb-1">Needs Attention</div>
                <h3 className="font-display font-black text-lg tracking-[-0.015em]">
                  {needsAttentionCount ? `${needsAttentionCount} items` : "All clear"}
                </h3>
              </div>
              <AlertTriangle size={19} className={needsAttentionCount ? "text-orange-400" : "text-emerald-400"} />
            </div>
            <div className="space-y-2">
              <button onClick={() => setActiveTab("matches")} className="w-full text-left m8-panel-quiet rounded-xl p-3 hover:border-[#353E4C] transition-colors">
                <div className="text-sm font-semibold">Match verification</div>
                <div className="text-xs text-muted-foreground mt-1">{pendingMatchReports.length} pending or disputed results</div>
              </button>
              <button onClick={() => setActiveTab("matches")} className="w-full text-left m8-panel-quiet rounded-xl p-3 hover:border-[#353E4C] transition-colors">
                <div className="text-sm font-semibold">Mucho1v1 disputes</div>
                <div className="text-xs text-muted-foreground mt-1">{disputedChallenges.length} disputes to review</div>
              </button>
            </div>
          </div>

          <div className="m8-panel rounded-2xl p-5">
            <div className="brand-kicker mb-1">Quick Actions</div>
            <h3 className="font-display font-bold text-lg mb-4">Manage competition</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setActiveTab("players")} className="m8-action h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150]">
                <UserPlus size={15} className="mr-2" /> Add Player
              </Button>
              <Button onClick={() => setActiveTab("matches")} className="m8-action h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150]">
                <Gamepad2 size={15} className="mr-2" /> Matches
              </Button>
              <Button onClick={() => setActiveTab("competition")} className="m8-action h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150]">
                <Trophy size={15} className="mr-2" /> Competition
              </Button>
              <Button onClick={() => setActiveTab("content")} className="m8-action h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150]">
                <Newspaper size={15} className="mr-2" /> News
              </Button>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "players" || activeTab === "settings") && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add player */}
        <div className={`${activeTab === "players" ? "lg:col-span-3" : "hidden"} m8-panel rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-emerald-400" />
            <h3 className="font-display font-black text-lg tracking-[-0.015em]">Add Player</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_150px_auto] gap-3 sm:items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Nickname</Label>
              <Input data-testid="admin-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Reaper" className="bg-[#0F1218] border-[#222834] mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Starting Elo</Label>
              <Input data-testid="admin-new-elo" type="number" value={newElo} onChange={(e) => setNewElo(e.target.value)} className="bg-[#0F1218] border-[#222834] mt-1" />
            </div>
            <Button onClick={handleAdd} data-testid="admin-add-player-btn" className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold sm:px-6">
              <UserPlus size={16} className="mr-1" /> Add Player
            </Button>
          </div>
        </div>

        {/* Data actions */}
        <div className={`${activeTab === "settings" ? "lg:col-span-3" : "hidden"} m8-panel rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-[#D5A33A]" />
            <h3 className="font-display font-black text-lg tracking-[-0.015em]">Database & Maintenance</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleExport} data-testid="admin-export-btn" className="m8-action justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150] h-14 rounded-xl">
              <Download size={18} className="mr-2 text-emerald-400" /> Export Full Database
            </Button>

            <Button onClick={() => fileRef.current?.click()} data-testid="admin-import-btn" className="m8-action justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150] h-14 rounded-xl">
              <Upload size={18} className="mr-2 text-blue-400" /> Import Database Backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} data-testid="admin-import-file" />

            <ConfirmButton
              testid="admin-reset-stats-btn"
              label="Reset All Statistics"
              icon={<RotateCcw size={18} className="mr-2 text-orange-400" />}
              title="Reset all statistics?"
              desc="Every player's Elo, matches, wins, losses and MVP counts will be wiped and match history cleared. This cannot be undone."
              onConfirm={() => { resetStats(); toast.success("Statistics reset"); }}
            />

            <Button onClick={() => setHistOpen(true)} data-testid="admin-add-historical-btn" className="m8-action justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150] h-14 rounded-xl">
              <History size={18} className="mr-2 text-magma" /> Add Historical Mucho8s
            </Button>
          </div>
        </div>
      </div>

      )}

      {activeTab === "matches" && (
        <div className="m8-panel rounded-2xl p-5" data-testid="admin-match-management">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
            <div className="min-w-0">
              <div className="brand-kicker mb-1">Match Control</div>
              <h3 className="font-display font-black text-xl tracking-[-0.025em]">
                Matches
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Live activity, results waiting for Admin and complete match history.
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="h-7 px-2.5 rounded-lg border border-[#2A303B] bg-[#0F1218] inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-[#C8CED8]">
                  {adminMatchRows.length} Matches
                </span>
                {adminMatchRows.filter((row) => row.attention).length > 0 && (
                  <span className="h-7 px-2.5 rounded-lg border border-orange-500/25 bg-orange-500/[0.05] inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-orange-400">
                    {adminMatchRows.filter((row) => row.attention).length} Need attention
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                onClick={() => void Promise.all([loadAdminChallenges(), refreshMatchReports(), refreshLiveMatches()])}
                className="bg-[#0F1218] border border-[#222834]"
              >
                <RotateCcw size={14} className="mr-1.5" /> Refresh
              </Button>
              <Button
                onClick={() => setNewLiveOpen(true)}
                className="bg-magma hover:bg-[#ff3c4c] text-white rounded-xl"
              >
                <History size={15} className="mr-1.5" /> New Mucho8s
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {[
              ["live", "Live"],
              ["pending", "Pending"],
              ["history", "History"],
            ].map(([key, label]) => {
              const active = matchControlFilter === key;
              const count =
                key === "live"
                  ? adminMatchRows.filter((row) =>
                      row.type === "live-team" ||
                      (
                        row.type === "challenge" &&
                        ["pending", "accepted"].includes(row.status)
                      )
                    ).length
                  : key === "pending"
                    ? adminMatchRows.filter((row) =>
                        row.type === "report" ||
                        (
                          row.type === "challenge" &&
                          (row.attention || row.status === "result_pending" || row.status === "disputed")
                        )
                      ).length
                    : adminMatchRows.filter((row) =>
                        row.type === "team" ||
                        (row.type === "challenge" && row.status === "completed")
                      ).length;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMatchControlFilter(key)}
                  className={`h-9 px-3 rounded-xl border text-xs font-bold transition-all ${
                    active
                      ? "bg-white text-black border-white"
                      : "bg-[#0F1218] border-[#222834] text-muted-foreground hover:text-white"
                  }`}
                >
                  {label}
                  <span className={`ml-2 font-mono text-[10px] ${active ? "text-black/60" : "text-[#697181]"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-2 max-h-[760px] overflow-y-auto pr-1">
            {visibleAdminMatchRows.map((row) => {
              if (row.type === "report") {
                return (
                  <MatchResultCenter
                    key={row.id}
                    reportId={row.item.id}
                    hideHeader
                    onResolved={() => {
                      void Promise.all([refreshMatchReports(), refreshLiveMatches()]);
                    }}
                  />
                );
              }

              if (row.type === "live-team") {
                const live = row.item;
                const teamA = Array.isArray(live?.team_a) ? live.team_a : [];
                const teamB = Array.isArray(live?.team_b) ? live.team_b : [];
                const pairings = Array.isArray(live?.pairings) ? live.pairings : [];
                const stake = pairings.reduce(
                  (sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0),
                  0
                );

                return (
                  <div
                    key={row.id}
                    className={`rounded-2xl bg-[#0F1218] border p-4 flex flex-col lg:flex-row lg:items-center gap-4 ${
                      live.cancel_requested_at ? "border-orange-500/25" : "border-magma/25"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ModeBadge mode="mucho8s" compact className="shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-bold truncate">
                          {teamA.map((id) => playerMap[id]?.name || "?").join(" · ")}
                          <span className="text-[#596170] mx-2">vs</span>
                          {teamB.map((id) => playerMap[id]?.name || "?").join(" · ")}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span>{live.game || "Game"}</span>
                          <span>·</span>
                          <span>{live.mode || "Mode"}</span>
                          <span>·</span>
                          <span>{live.format || `${teamA.length}v${teamB.length}`}</span>
                          <span>·</span>
                          <span>{new Date(live.created_at).toLocaleString()}</span>
                          {stake > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-emerald-400">€{stake.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                      <span className={`h-9 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider inline-flex items-center ${
                        live.cancel_requested_at
                          ? "border-orange-500/25 bg-orange-500/[0.05] text-orange-400"
                          : "border-magma/25 bg-magma/[0.06] text-magma"
                      }`}>
                        {live.cancel_requested_at ? "Cancel requested" : "Live"}
                      </span>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          const ok = await cancelLiveMatch(live.id);
                          if (ok) toast.success("Live Mucho8s cancelled");
                        }}
                        className="h-9 px-3 border border-red-500/20 bg-red-500/[0.04] text-red-400 hover:bg-red-500/10"
                      >
                        Cancel live
                      </Button>
                    </div>
                  </div>
                );
              }

              if (row.type === "team") {
                const match = row.item;
                const pairings = Array.isArray(match?.pairings) ? match.pairings : [];
                const stake = pairings.reduce(
                  (sum, pair) => sum + Math.max(0, Number(pair?.amount) || 0),
                  0
                );
                const teamA = Array.isArray(match?.teamA) ? match.teamA : [];
                const teamB = Array.isArray(match?.teamB) ? match.teamB : [];

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl bg-[#0F1218] border border-[#1D222C] p-4 flex flex-col lg:flex-row lg:items-center gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ModeBadge mode="mucho8s" compact className="shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="font-display font-bold truncate">
                          {teamA.map((id) => playerMap[id]?.name || "?").join(" · ")}
                          <span className="text-[#596170] mx-2">vs</span>
                          {teamB.map((id) => playerMap[id]?.name || "?").join(" · ")}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span>{match.game || "Game"}</span>
                          <span>·</span>
                          <span>{match.mode || "Mode"}</span>
                          <span>·</span>
                          <span>{new Date(match.date).toLocaleString()}</span>
                          {stake > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#D5A33A]">€{stake.toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                      <span className="h-9 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center">
                        {match.winner === "A" ? "Alpha" : "Bravo"} won
                      </span>

                      <Button
                        onClick={() => setReportMatchData(match)}
                        variant="ghost"
                        className="h-9 px-3 bg-magma/10 border border-magma/20 text-magma hover:bg-magma/15"
                      >
                        <Flag size={14} className="mr-1.5" /> Report
                      </Button>
                      <Button
                        onClick={() => setEditMatchData(match)}
                        variant="ghost"
                        className="h-9 px-3 bg-[#151923] border border-[#2A303B] text-white"
                      >
                        <Pencil size={14} className="mr-1.5" /> Edit
                      </Button>
                      <ConfirmButton
                        testid={`admin-delete-match-${match.id}`}
                        label="Delete"
                        icon={<Trash2 size={14} className="mr-1.5" />}
                        compact
                        title="Delete this Mucho8s?"
                        desc="The Mucho8s will be removed and player Elo/statistics will be recalculated."
                        onConfirm={async () => {
                          const ok = await deleteMatch(match.id);
                          if (ok) toast.success("Mucho8s deleted");
                        }}
                      />
                    </div>
                  </div>
                );
              }

              const challenge = row.item;
              const challenger = playerMap[challenge.challenger_player_id];
              const challenged = playerMap[challenge.challenged_player_id];
              const draft = challengeDrafts[challenge.id] || {};
              const busy = challengeBusyId === challenge.id;
              const expanded = expandedChallengeId === challenge.id;
              const payoutDispute = Boolean(
                challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
              );
              const amount = new Intl.NumberFormat("it-IT", {
                style: "currency",
                currency: challenge.currency || "EUR",
              }).format(Number(challenge.amount_cents || 0) / 100);

              const statusClass =
                challenge.status === "completed"
                  ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
                  : challenge.status === "disputed" || payoutDispute
                    ? "text-orange-400 border-orange-500/25 bg-orange-500/5"
                    : challenge.status === "declined" || challenge.status === "cancelled"
                      ? "text-red-400 border-red-500/20 bg-red-500/5"
                      : challenge.status === "accepted"
                        ? "text-[#8E98FF] border-[#5865F2]/25 bg-[#5865F2]/5"
                        : "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/5";

              return (
                <div
                  key={row.id}
                  className={`rounded-2xl bg-[#0F1218] border overflow-hidden ${
                    row.attention ? "border-orange-500/20" : "border-[#1D222C]"
                  }`}
                >
                  <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ModeBadge mode="mucho1v1" compact className="shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="font-display font-bold truncate">
                          {challenger?.name || "Unknown"}
                          <span className="text-[#596170] mx-2">vs</span>
                          {challenged?.name || "Unknown"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                          <span className="text-emerald-400">Direct money match</span>
                          <span>·</span>
                          <span>{new Date(challenge.created_at).toLocaleString()}</span>
                          <span>·</span>
                          <span className="text-emerald-400">{amount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                      {row.attention && (
                        <span className="h-9 px-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] text-orange-400 text-[10px] font-bold uppercase tracking-wider inline-flex items-center">
                          <AlertTriangle size={13} className="mr-1.5" /> Attention
                        </span>
                      )}

                      <span className={`h-9 px-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider inline-flex items-center ${statusClass}`}>
                        {String(challenge.status || "pending").replace("_", " ")}
                      </span>

                      <Button
                        variant="ghost"
                        onClick={() => setExpandedChallengeId(expanded ? "" : challenge.id)}
                        className="h-9 px-4 rounded-xl bg-[#181B26] border border-[#2A303B] text-white hover:bg-white/[0.05]"
                      >
                        {expanded ? "Close" : "Manage"}
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-[#1D222C] p-4 bg-[#0C0F14]">
                      {(challenge.status === "disputed" || payoutDispute) && (
                        <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-3 mb-4">
                          <div className="text-[10px] uppercase tracking-widest text-orange-400 font-bold">
                            {payoutDispute ? "Payment dispute" : "Result dispute"}
                          </div>
                          <div className="text-xs text-orange-200/80 mt-1">
                            {payoutDispute
                              ? challenge.payout_dispute_note || "Winner reports missing payment."
                              : challenge.dispute_note || "No dispute note supplied."}
                          </div>

                          {Array.isArray(challenge.evidence) && challenge.evidence.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {challenge.evidence.map((item) => (
                                <a
                                  key={item.id || item.url}
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-20 h-14 rounded-lg overflow-hidden border border-orange-500/20 bg-[#0F1218]"
                                  title="Open evidence"
                                >
                                  <img src={item.url} alt="Evidence" className="w-full h-full object-cover" />
                                </a>
                              ))}
                            </div>
                          )}

                          {payoutDispute && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              <Button
                                disabled={busy}
                                onClick={() => updateAdminChallenge(
                                  challenge.id,
                                  { payoutResolution: "received" },
                                  "Payout marked as received by Admin"
                                )}
                                className="h-9 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                              >
                                <Check size={14} className="mr-1.5" /> Payment received
                              </Button>
                              <Button
                                disabled={busy}
                                onClick={() => updateAdminChallenge(
                                  challenge.id,
                                  { payoutResolution: "reopen" },
                                  "Payout reopened by Admin"
                                )}
                                className="h-9 bg-[#151923] border border-[#2A303B] text-white"
                              >
                                Reopen payout
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Stake €</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.50"
                              min="0"
                              value={draft.amount ?? ""}
                              onChange={(e) => setChallengeDrafts((prev) => ({
                                ...prev,
                                [challenge.id]: { ...prev[challenge.id], amount: e.target.value },
                              }))}
                              className="h-10 bg-[#151923] border-[#2A303B]"
                            />
                            <Button
                              disabled={busy}
                              onClick={() => saveChallengeAmount(challenge)}
                              className="h-10 px-3 bg-[#181B26] border border-[#2A303B]"
                            >
                              Save
                            </Button>
                          </div>
                        </div>

                        <div>
                          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</Label>
                          <select
                            value={challenge.status}
                            disabled={busy}
                            onChange={(e) => updateAdminChallenge(challenge.id, { status: e.target.value })}
                            className="mt-1 h-10 w-full rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                          >
                            {["pending","accepted","declined","result_pending","completed","disputed","cancelled"].map((status) => (
                              <option key={status} value={status}>{status.replace("_", " ")}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Winner</Label>
                          <div className="flex gap-2 mt-1">
                            <select
                              value={draft.winnerPlayerId || ""}
                              disabled={busy}
                              onChange={(e) => setChallengeDrafts((prev) => ({
                                ...prev,
                                [challenge.id]: { ...prev[challenge.id], winnerPlayerId: e.target.value },
                              }))}
                              className="h-10 flex-1 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm"
                            >
                              <option value="">No winner</option>
                              <option value={challenge.challenger_player_id}>{challenger?.name || "Challenger"}</option>
                              <option value={challenge.challenged_player_id}>{challenged?.name || "Challenged"}</option>
                            </select>
                            <Button
                              disabled={busy || !draft.winnerPlayerId}
                              onClick={() => setChallengeWinner(challenge, true)}
                              className="h-10 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                            >
                              <Trophy size={14} className="mr-1.5" /> Complete
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateAdminChallenge(challenge.id, { paymentSent: !challenge.payment_sent_at })}
                          className={`h-10 rounded-xl border text-xs font-semibold ${
                            challenge.payment_sent_at
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-[#151923] border-[#2A303B] text-muted-foreground"
                          }`}
                        >
                          Sent: {challenge.payment_sent_at ? "YES" : "NO"}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => updateAdminChallenge(challenge.id, { paymentReceived: !challenge.payment_received_at })}
                          className={`h-10 rounded-xl border text-xs font-semibold ${
                            challenge.payment_received_at
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-[#151923] border-[#2A303B] text-muted-foreground"
                          }`}
                        >
                          Received: {challenge.payment_received_at ? "YES" : "NO"}
                        </button>

                        <Button
                          disabled={busy}
                          onClick={() => updateAdminChallenge(challenge.id, { status: "disputed" }, "Mucho1v1 marked disputed")}
                          variant="ghost"
                          className="h-10 rounded-xl bg-orange-500/5 border border-orange-500/20 text-orange-400 hover:bg-orange-500/10"
                        >
                          <AlertTriangle size={14} className="mr-1.5" /> Dispute
                        </Button>

                        <div className="flex gap-2">
                          <Link
                            to={`/challenges/${challenge.id}`}
                            className="h-10 flex-1 rounded-xl bg-[#151923] border border-[#2A303B] text-sm text-white inline-flex items-center justify-center gap-2"
                          >
                            Open <ExternalLink size={13} />
                          </Link>

                          <ConfirmButton
                            iconOnly
                            testid={`admin-delete-challenge-${challenge.id}`}
                            icon={<Trash2 size={14} />}
                            title="Delete this Mucho8s?"
                            desc="This permanently removes the match and its verification history."
                            onConfirm={() => removeAdminChallenge(challenge.id)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {visibleAdminMatchRows.length === 0 && (
              <div className="m8-panel-quiet rounded-xl p-8 text-center text-sm text-muted-foreground">
                No matches in this view.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "content" && (
        <div className="grid grid-cols-1 xl:grid-cols-[.95fr_1.05fr] gap-4">
          <div className="m8-panel rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="brand-kicker mb-1">Content Studio</div>
                <h3 className="font-display font-black text-xl">Publish to News</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Everything published here appears automatically on the public News page.
                </p>
              </div>
              <Newspaper size={20} className="text-magma" />
            </div>

            <div className="space-y-3">
              <Input
                value={newsDraft.title}
                onChange={(event) => setNewsDraft((current) => ({ ...current, title: event.target.value.slice(0, 120) }))}
                placeholder="Post title"
                className="bg-[#0F1218] border-[#222834] h-10"
              />

              <textarea
                value={newsDraft.summary}
                onChange={(event) => setNewsDraft((current) => ({ ...current, summary: event.target.value.slice(0, 1200) }))}
                placeholder="Write the update, announcement or patch note..."
                rows={5}
                className="w-full min-h-[122px] resize-y rounded-xl bg-[#0F1218] border border-[#222834] px-3 py-2.5 text-sm outline-none focus:border-magma/50"
              />

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <select
                  value={newsDraft.category}
                  onChange={(event) => {
                    const category = event.target.value;
                    const accents = {
                      Platform: "#65D5D3",
                      Competition: "#FF2A3B",
                      Ranking: "#22C55E",
                      Season: "#D5A33A",
                      Update: "#8E98FF",
                    };
                    setNewsDraft((current) => ({
                      ...current,
                      category,
                      accent: accents[category] || current.accent,
                    }));
                  }}
                  className="h-10 rounded-xl bg-[#0F1218] border border-[#222834] px-3 text-sm"
                >
                  <option value="Platform">Platform</option>
                  <option value="Competition">Competition</option>
                  <option value="Ranking">Ranking / Elo</option>
                  <option value="Season">Season</option>
                  <option value="Update">Update</option>
                </select>

                <button
                  type="button"
                  onClick={() => setNewsDraft((current) => ({ ...current, featured: !current.featured }))}
                  className={`h-10 px-3 rounded-xl border text-xs font-black ${
                    newsDraft.featured
                      ? "border-[#D5A33A]/30 bg-[#D5A33A]/10 text-[#D5A33A]"
                      : "border-[#2A303B] bg-[#0F1218] text-muted-foreground"
                  }`}
                >
                  {newsDraft.featured ? "★ Featured" : "☆ Make Featured"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={newsBusy || !newsDraft.title.trim() || !newsDraft.summary.trim()}
                  onClick={() => void saveNewsPost()}
                  className="flex-1 h-11 bg-magma hover:bg-[#ff3c4c] text-white font-black"
                >
                  <Send size={15} className="mr-2" />
                  {editingNewsId ? "Save News Post" : "Publish Now"}
                </Button>
                {editingNewsId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetNewsDraft}
                    className="h-11 border border-[#2A303B] bg-[#0F1218]"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="text-[10px] text-[#697181]">
                Posts are published immediately and are added to the animated News ticker.
              </div>
            </div>
          </div>

          <div className="m8-panel rounded-2xl p-4 sm:p-5 min-w-0">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="brand-kicker mb-1">Published</div>
                <h3 className="font-display font-black text-lg">News Center</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  onClick={() => void refreshNewsPosts()}
                  className="h-9 px-3 border border-[#222834] bg-[#0F1218]"
                >
                  <RotateCcw size={13} className="mr-1.5" /> Refresh
                </Button>
                <Button asChild variant="ghost" className="h-9 px-3 border border-[#222834] bg-[#0F1218]">
                  <Link to="/news">
                    News <ExternalLink size={13} className="ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {newsPosts.length === 0 ? (
              <div className="m8-panel-quiet rounded-xl p-8 text-center text-sm text-muted-foreground">
                No Admin posts yet. Publish the first update from the editor.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 max-h-[430px] overflow-y-auto pr-1">
                {newsPosts.map((post) => (
                  <div key={post.id} className="rounded-xl border border-[#202631] bg-[#0F1218] p-3">
                    <div className="flex items-start gap-3">
                      <span
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ background: post.accent || "#FF2A3B" }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                            {post.category || "Platform"}
                          </span>
                          {post.featured && (
                            <span className="text-[8px] uppercase tracking-widest text-[#D5A33A]">Featured</span>
                          )}
                        </div>
                        <div className="font-display font-black text-sm mt-1 truncate">{post.title}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{post.summary}</div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => editNewsPost(post)}
                          className="w-8 h-8 rounded-lg border border-[#2A303B] bg-[#151923] inline-flex items-center justify-center text-muted-foreground hover:text-white"
                          title="Edit post"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={newsBusy}
                          onClick={() => void removeNewsPost(post.id)}
                          className="w-8 h-8 rounded-lg border border-red-500/20 bg-red-500/[0.04] inline-flex items-center justify-center text-red-400 hover:bg-red-500/10"
                          title="Delete post"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <>
      <div className="m8-panel rounded-2xl p-4" data-testid="discord-settings">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle size={19} className="text-[#5865F2]" />
              <h3 className="font-display font-black text-lg tracking-[-0.015em]">Discord Integration</h3>
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
                discordConfigured
                  ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
                  : "text-muted-foreground border-[#2A303B] bg-[#0F1218]"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${discordConfigured ? "bg-emerald-400" : "bg-[#596170]"}`} />
                {discordConfigured ? "Connected" : "Not connected"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Connect a Discord channel with a webhook. Team Balancer can send teams to Discord and saved match results are posted automatically.
            </p>
          </div>

          <div className="w-full lg:max-w-xl">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  value={discordWebhook}
                  onChange={(e) => setDiscordWebhook(e.target.value)}
                  placeholder={discordConfigured ? "Paste a new webhook to replace the current one" : "https://discord.com/api/webhooks/..."}
                  className="pl-9 bg-[#0F1218] border-[#222834] h-11"
                  data-testid="discord-webhook-input"
                />
              </div>
              <Button
                onClick={connectDiscord}
                disabled={discordBusy || !discordWebhook.trim()}
                className="h-11 bg-[#5865F2] hover:bg-[#6875f5] text-white"
                data-testid="discord-connect-btn"
              >
                <Link2 size={15} className="mr-1.5" /> {discordConfigured ? "Replace" : "Connect"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              <Button
                variant="ghost"
                onClick={sendDiscordTest}
                disabled={discordBusy || !discordConfigured}
                className="text-sm bg-[#0F1218] border border-[#222834]"
                data-testid="discord-test-btn"
              >
                <Send size={14} className="mr-1.5" /> Send Test
              </Button>
              <Button
                variant="ghost"
                onClick={disconnectDiscord}
                disabled={discordBusy || !discordConfigured}
                className="text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                data-testid="discord-disconnect-btn"
              >
                Disconnect
              </Button>
            </div>

            <div className="text-[11px] text-[#697181] mt-2">
              The webhook URL is stored server-side and is not exposed to site visitors.
            </div>
          </div>
        </div>
      </div>

      <div className="m8-panel rounded-2xl p-4" data-testid="discord-player-accounts">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-3">
          <div>
            <div className="brand-kicker mb-1">Player Accounts</div>
            <h3 className="font-display font-black text-xl tracking-[-0.02em]">
              Discord & Payments
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Players choose their Mucho8s name after Discord login. Approve or reject the request here; manual Discord linking is no longer required.
            </p>
          </div>

          <Button
            variant="ghost"
            onClick={loadDiscordAccounts}
            className="bg-[#0F1218] border border-[#222834] shrink-0"
            data-testid="discord-accounts-refresh"
          >
            <RotateCcw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            ["PayPal", paymentLinkStats.paypal, "text-[#61A8FF]"],
            ["Revolut", paymentLinkStats.revolut, "text-white"],
            ["Both", paymentLinkStats.both, "text-emerald-400"],
            ["None", paymentLinkStats.none, "text-muted-foreground"],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className="rounded-xl border border-[#222834] bg-[#0F1218] px-3 py-2"
            >
              <div className="text-[9px] uppercase tracking-widest text-[#697181]">{label}</div>
              <div className={`font-mono font-black text-lg mt-0.5 ${tone}`}>{value}</div>
            </div>
          ))}
        </div>

        {discordAccounts.length === 0 ? (
          <div className="m8-panel-quiet rounded-xl px-4 py-8 text-center text-sm text-muted-foreground">
            No player has logged in with Discord yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto pr-1">
            {discordAccounts.map((account) => {
              const hasPayPal = Boolean(String(account?.paypal_url || "").trim());
              const hasRevolut = Boolean(String(account?.revolut_url || "").trim());
              const linkedPlayer = account.player_id ? playerMap[account.player_id] : null;

              const paymentLabel =
                hasPayPal && hasRevolut
                  ? "PayPal + Revolut"
                  : hasPayPal
                    ? "PayPal"
                    : hasRevolut
                      ? "Revolut"
                      : "No payment link";

              const paymentClass =
                hasPayPal && hasRevolut
                  ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]"
                  : hasPayPal
                    ? "text-[#61A8FF] border-[#61A8FF]/20 bg-[#61A8FF]/[0.06]"
                    : hasRevolut
                      ? "text-white border-white/15 bg-white/[0.04]"
                      : "text-muted-foreground border-[#2A303B] bg-[#151923]";

              return (
                <div
                  key={account.id}
                  className="rounded-xl border border-[#202631] bg-[#0F1218] p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {account.avatar_url ? (
                        <img
                          src={account.avatar_url}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                          <MessageCircle size={17} className="text-[#8E98FF]" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">
                          {linkedPlayer?.name || account.display_name || account.discord_username || "Discord User"}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {account.display_name || account.discord_username || "Discord account"}
                          {linkedPlayer
                            ? " · linked"
                            : account.player_request_status === "pending"
                              ? ` · wants ${account.requested_player_name || "a player name"}`
                              : " · not linked"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={`h-8 px-2.5 rounded-lg border inline-flex items-center text-[10px] font-bold uppercase tracking-wider ${paymentClass}`}>
                        {paymentLabel}
                      </span>

                      {linkedPlayer ? (
                        <span className="h-8 px-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 inline-flex items-center text-[10px] font-black uppercase tracking-wider">
                          <Check size={13} className="mr-1" />
                          {linkedPlayer.name}
                        </span>
                      ) : account.player_request_status === "pending" && account.requested_player_name ? (
                        <>
                          <span className="h-8 px-2.5 rounded-lg border border-[#D5A33A]/25 bg-[#D5A33A]/[0.06] text-[#D5A33A] inline-flex items-center text-[10px] font-black">
                            {account.requested_player_name}
                          </span>
                          <Button
                            type="button"
                            onClick={() => handlePlayerRequest(account.id, "approve")}
                            disabled={accountBusyId === account.id}
                            className="h-8 px-3 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black text-[10px] font-black"
                            data-testid={`discord-request-approve-${account.id}`}
                          >
                            <Check size={13} className="mr-1" />
                            Approve
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handlePlayerRequest(account.id, "reject")}
                            disabled={accountBusyId === account.id}
                            variant="ghost"
                            className="h-8 px-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-red-400 hover:bg-red-500/[0.10] text-[10px] font-black"
                            data-testid={`discord-request-reject-${account.id}`}
                          >
                            Reject
                          </Button>
                        </>
                      ) : account.player_request_status === "rejected" ? (
                        <span className="h-8 px-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-red-400 inline-flex items-center text-[10px] font-black uppercase tracking-wider">
                          Rejected · waiting new request
                        </span>
                      ) : (
                        <span className="h-8 px-2.5 rounded-lg border border-[#2A303B] bg-[#151923] text-[#737D8D] inline-flex items-center text-[10px] font-bold">
                          Waiting for player request
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

        </>
      )}

      {activeTab === "settings" && (
        <>
      <div className="m8-panel rounded-2xl p-5" data-testid="admin-audit-log">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">History</div>
            <h3 className="font-display font-black text-lg tracking-[-0.015em]">Admin Audit Log</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tracks important Admin changes to players, Mucho8s and Mucho1v1.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={loadAuditLogs}
            className="bg-[#0F1218] border border-[#222834]"
          >
            <RotateCcw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>

        {auditLogs.length === 0 ? (
          <div className="m8-panel-quiet rounded-xl p-8 text-center text-sm text-muted-foreground">
            No Admin actions recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="m8-panel-quiet rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-semibold truncate">{log.action}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {log.entity_type}{log.entity_id ? ` · ${String(log.entity_id).slice(0, 12)}` : ""}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Roster management */}
        </>
      )}

      {activeTab === "players" && (
        <>
      <div className="m8-panel rounded-2xl p-4" data-testid="admin-roster">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-display font-bold text-lg">Players ({players.length})</h3>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Compact roster</span>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 max-h-[520px] overflow-y-auto pr-1">
          {players.map((p) => {
            const isEditing = editing[p.id] !== undefined;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-2.5 p-2.5 rounded-lg bg-[#0F1218] border border-[#1D222C]" data-testid={`admin-player-${p.id}`}>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={30} />
                {isEditing ? (
                  <div className="flex-1 min-w-[260px] grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-2">
                    <Input
                      data-testid={`admin-edit-name-input-${p.id}`}
                      value={editing[p.id].name}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], name: e.target.value } }))}
                      className="h-9 bg-[#0F1218] border-[#222834]"
                      aria-label="Player nickname"
                    />
                    <Input
                      data-testid={`admin-edit-elo-input-${p.id}`}
                      type="number"
                      value={editing[p.id].elo}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: { ...prev[p.id], elo: e.target.value } }))}
                      className="h-9 bg-[#0F1218] border-[#222834]"
                      aria-label="Player Elo"
                    />
                    <Button onClick={() => savePlayer(p.id)} data-testid={`admin-save-player-${p.id}`} className="h-9 bg-emerald-500 hover:bg-emerald-600">
                      <Check size={16} className="mr-1" /> Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium flex-1 min-w-[100px] truncate">{p.name}</span>
                    <EloBadge elo={p.currentElo} />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditing((prev) => ({ ...prev, [p.id]: { name: p.name, elo: p.currentElo } }))}
                      data-testid={`admin-edit-player-btn-${p.id}`}
                      className="h-9 w-9"
                    >
                      <Pencil size={15} />
                    </Button>
                  </>
                )}
                <ConfirmButton
                  iconOnly
                  testid={`admin-remove-player-${p.id}`}
                  icon={<Trash2 size={15} />}
                  title={`Remove ${p.name}?`}
                  desc="This player will be permanently removed from the roster."
                  onConfirm={() => { removePlayer(p.id); toast.success(`${p.name} removed`); }}
                />
              </div>
            );
          })}
        </div>
      </div>

        </>
      )}

      <RecordMatchDialog
        open={newLiveOpen}
        onOpenChange={setNewLiveOpen}
        title="New Live Mucho8s"
        liveOnly
        onReported={() => {
          setMatchControlFilter("live");
          void refreshLiveMatches();
        }}
      />
      <RecordMatchDialog open={histOpen} onOpenChange={setHistOpen} title="Add Historical Mucho8s" />
      <RecordMatchDialog
        open={!!editMatchData}
        onOpenChange={(open) => !open && setEditMatchData(null)}
        editData={editMatchData}
        title="Edit Mucho8s"
      />
      <RecordMatchDialog
        open={!!reportMatchData}
        onOpenChange={(open) => !open && setReportMatchData(null)}
        editData={reportMatchData}
        title="Report Result"
        reportOnly
      />
    </div>
  );
}

const ConfirmButton = ({ label, icon, title, desc, onConfirm, testid, iconOnly, compact }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      {iconOnly ? (
        <Button size="icon" variant="ghost" data-testid={testid} className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10">
          {icon}
        </Button>
      ) : compact ? (
        <Button data-testid={testid} variant="ghost" className="h-9 px-3 rounded-lg bg-red-500/5 border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10">
          {icon} {label}
        </Button>
      ) : (
        <Button data-testid={testid} className="m8-action justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] hover:border-[#394150] h-14 rounded-xl">
          {icon} {label}
        </Button>
      )}
    </AlertDialogTrigger>
    <AlertDialogContent className="bg-[#101319] border-[#222834]">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
        <AlertDialogDescription>{desc}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-[#0F1218] border-[#222834]">Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} data-testid={`${testid}-confirm`} className="bg-magma hover:bg-magma/90 text-white">
          Confirm
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
