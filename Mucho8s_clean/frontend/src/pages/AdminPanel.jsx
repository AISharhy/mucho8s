import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { Link, Navigate } from "react-router-dom";
import { EloBadge, PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, UserPlus, Trash2, Pencil, RotateCcw, Upload, Download, LogOut, History, Database, Check,  MessageCircle, Send, Link2, Swords, WalletCards, AlertTriangle, Flag, Trophy, ExternalLink, Users, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

const ADMIN_TABS = [
  { key: "overview", label: "Overview", icon: Shield },
  { key: "players", label: "Players", icon: Users },
  { key: "matches", label: "Matches", icon: Gamepad2 },
  { key: "challenges", label: "Money Challs", icon: Swords },
  { key: "discord", label: "Discord", icon: MessageCircle },
  { key: "competition", label: "Competition", icon: Trophy },
  { key: "system", label: "System", icon: Database },
];

export default function AdminPanel() {
  const {
    admin,
    isAdmin,
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
    linkDiscordAccount,
    listAdminChallenges,
    adminUpdateChallenge,
    adminDeleteChallenge,
    listAdminAudit,
    matchReports,
    adminChallengeAlertCount,
    competitionData,
    startNewSeason,
  } = useData();
  const [newName, setNewName] = useState("");
  const [newElo, setNewElo] = useState(1000);
  const [editing, setEditing] = useState({}); // id -> { name, elo }
  const [histOpen, setHistOpen] = useState(false);
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
  const [seasonName, setSeasonName] = useState("");
  const [seasonBusy, setSeasonBusy] = useState(false);
  const fileRef = useRef(null);

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

  const challengeStats = useMemo(() => {
    const active = adminChallenges.filter((challenge) =>
      ["pending", "accepted", "result_pending"].includes(challenge.status)
    ).length;
    const disputed = adminChallenges.filter((challenge) =>
      challenge.status === "disputed" ||
      (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
    ).length;
    const completed = adminChallenges.filter((challenge) => challenge.status === "completed").length;
    const totalStake = adminChallenges.reduce((sum, challenge) => sum + Number(challenge.amount_cents || 0), 0) / 100;
    return { active, disputed, completed, totalStake };
  }, [adminChallenges]);

  const disputedChallenges = useMemo(
    () => adminChallenges.filter((challenge) =>
      challenge.status === "disputed" ||
      (challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at)
    ),
    [adminChallenges],
  );

  const pendingMatchReports = useMemo(
    () => (matchReports || []).filter((report) => ["pending", "disputed"].includes(report.status)),
    [matchReports],
  );

  const needsAttentionCount =
    pendingMatchReports.length +
    disputedChallenges.length +
    Number(adminChallengeAlertCount || 0);

  if (!isAdmin) return <Navigate to="/" replace />;

  const handleAdd = () => {
    if (!newName.trim()) return toast.error("Enter a player name");
    addPlayer(newName.trim(), Number(newElo) || 1000);
    toast.success(`${newName.trim()} added to the roster`);
    setNewName("");
    setNewElo(1000);
  };

  const savePlayer = async (id) => {
    const draft = editing[id];
    if (!draft?.name?.trim()) return toast.error("Nickname cannot be empty");
    const ok = await editPlayer(id, { name: draft.name.trim(), currentElo: Number(draft.elo) });
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

  const handleAccountLink = async (accountId, playerId) => {
    setAccountBusyId(accountId);
    const ok = await linkDiscordAccount(accountId, playerId || null);
    setAccountBusyId("");
    if (!ok) return;

    setDiscordAccounts((prev) =>
      prev.map((account) =>
        account.id === accountId ? { ...account, player_id: playerId || null } : account
      )
    );
    toast.success(playerId ? "Discord account linked to player" : "Discord account unlinked");
  };

  const updateAdminChallenge = async (id, updates, successMessage = "Challenge updated") => {
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
    await updateAdminChallenge(challenge.id, { amount }, "Challenge amount updated");
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
      complete ? "Challenge completed by Admin" : "Challenge winner updated"
    );
  };

  const removeAdminChallenge = async (id) => {
    setChallengeBusyId(id);
    const ok = await adminDeleteChallenge(id);
    setChallengeBusyId("");
    if (!ok) return;
    setAdminChallenges((prev) => prev.filter((item) => item.id !== id));
    toast.success("Challenge deleted");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-magma" />
          <div>
            <div className="brand-kicker mb-1">Administration</div>
            <h2 className="font-display text-2xl font-extrabold">Admin Console</h2>
          </div>
          <span className="text-sm text-muted-foreground">· {admin?.nickname}</span>
        </div>
        <Button variant="ghost" onClick={signOutDiscord} data-testid="admin-logout-btn" className="text-muted-foreground">
          <LogOut size={16} className="mr-1" /> Sign out Discord
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" data-testid="admin-tabs">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
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

      {activeTab === "competition" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="admin-season-control">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="brand-kicker mb-1">Competition</div>
            <h3 className="font-display font-bold text-lg">
              {competitionData?.current?.season_name || `Season ${competitionData?.current?.season_number || 1}`}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Starting a new season archives the current ranking and resets Elo/statistics to 1000.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            <Input
              value={seasonName}
              onChange={(e) => setSeasonName(e.target.value)}
              placeholder={`Season ${Number(competitionData?.current?.season_number || 1) + 1}`}
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
                    The current season will be archived. Player Elo and seasonal statistics will reset to 1000, and current match history will move into the season archive.
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

        </>\n      )}\n\n      {activeTab === "system" && storageMode === "local" && (
        <div className="rounded-xl border border-[#3A3320] bg-[#D5A33A]/5 px-4 py-3 text-sm text-muted-foreground">
          <span className="text-[#D5A33A] font-semibold">Local mode:</span> player e match sono salvati solo in questo browser. Collega Supabase per avere lo stesso database su PC e telefono.
        </div>
      )}

      {activeTab === "overview" && (\n        <>\n      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="admin-overview">
        {[
          { label: "Players", value: players.length, icon: Users, sub: `${discordAccounts.filter((a) => a.player_id).length} Discord linked` },
          { label: "Matches", value: matches.length, icon: Gamepad2, sub: "Recorded results" },
          { label: "Active Chall", value: challengeStats.active, icon: Swords, sub: `${challengeStats.disputed} disputed` },
          { label: "Challenge Volume", value: `€${challengeStats.totalStake.toFixed(2)}`, icon: WalletCards, sub: `${challengeStats.completed} completed` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card-surface rounded-2xl p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.label}</div>
                <Icon size={16} className="text-[#697181]" />
              </div>
              <div className="font-display text-2xl font-extrabold mt-2">{item.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.sub}</div>
            </div>
          );
        })}
      </div>

        </>\n      )}\n\n      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-surface rounded-2xl p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="brand-kicker mb-1">Needs Attention</div>
                <h3 className="font-display font-bold text-lg">
                  {needsAttentionCount ? `${needsAttentionCount} items` : "All clear"}
                </h3>
              </div>
              <AlertTriangle size={19} className={needsAttentionCount ? "text-orange-400" : "text-emerald-400"} />
            </div>
            <div className="space-y-2">
              <button onClick={() => setActiveTab("matches")} className="w-full text-left rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                <div className="text-sm font-semibold">Match verification</div>
                <div className="text-xs text-muted-foreground mt-1">{pendingMatchReports.length} pending or disputed results</div>
              </button>
              <button onClick={() => setActiveTab("challenges")} className="w-full text-left rounded-xl bg-[#0F1218] border border-[#1D222C] p-3">
                <div className="text-sm font-semibold">Money Chall disputes</div>
                <div className="text-xs text-muted-foreground mt-1">{disputedChallenges.length} disputes to review</div>
              </button>
            </div>
          </div>

          <div className="card-surface rounded-2xl p-5">
            <div className="brand-kicker mb-1">Quick Actions</div>
            <h3 className="font-display font-bold text-lg mb-4">Manage competition</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setActiveTab("players")} className="h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04]">
                <UserPlus size={15} className="mr-2" /> Players
              </Button>
              <Button onClick={() => setActiveTab("matches")} className="h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04]">
                <Gamepad2 size={15} className="mr-2" /> Matches
              </Button>
              <Button onClick={() => setActiveTab("challenges")} className="h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04]">
                <WalletCards size={15} className="mr-2" /> Challs
              </Button>
              <Button onClick={() => setActiveTab("competition")} className="h-11 bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04]">
                <Trophy size={15} className="mr-2" /> Season
              </Button>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "players" || activeTab === "system") && (\n      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add player */}
        <div className={`${activeTab === "players" ? "" : "hidden"} card-surface rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-emerald-400" />
            <h3 className="font-display font-bold text-lg">Add Player</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nickname</Label>
              <Input data-testid="admin-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Reaper" className="bg-[#0F1218] border-[#222834] mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Starting Elo</Label>
              <Input data-testid="admin-new-elo" type="number" value={newElo} onChange={(e) => setNewElo(e.target.value)} className="bg-[#0F1218] border-[#222834] mt-1" />
            </div>
            <Button onClick={handleAdd} data-testid="admin-add-player-btn" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
              <UserPlus size={16} className="mr-1" /> Add to Roster
            </Button>
          </div>
        </div>

        {/* Data actions */}
        <div className={`${activeTab === "system" ? "lg:col-span-3" : "hidden"} card-surface rounded-2xl p-5`}>
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-[#D5A33A]" />
            <h3 className="font-display font-bold text-lg">Data & Records</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleExport} data-testid="admin-export-btn" className="justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] h-14 rounded-xl">
              <Download size={18} className="mr-2 text-emerald-400" /> Export Full Database
            </Button>

            <Button onClick={() => fileRef.current?.click()} data-testid="admin-import-btn" className="justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] h-14 rounded-xl">
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

            <Button onClick={() => setHistOpen(true)} data-testid="admin-add-historical-btn" className="justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] h-14 rounded-xl">
              <History size={18} className="mr-2 text-magma" /> Add Historical Match
            </Button>
          </div>
        </div>
      </div>

      )}\n\n      {activeTab === "matches" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="admin-match-management">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Match Control</div>
            <h3 className="font-display font-bold text-lg">Manage Matches ({matches.length})</h3>
            <p className="text-sm text-muted-foreground mt-1">Report, edit or delete any recorded match directly from Admin.</p>
          </div>
          <Button onClick={() => setHistOpen(true)} className="bg-magma hover:bg-[#ff3c4c] text-white rounded-xl">
            <History size={15} className="mr-1.5" /> New Match
          </Button>
        </div>

        <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
          {matches.map((match) => (
            <div key={match.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-3 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm">{match.game || "Game"} · {match.mode || "Mode"}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md border border-[#2A303B] text-muted-foreground">
                    {new Date(match.date).toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    {match.winner === "A" ? "Alpha" : "Bravo"} won
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {match.teamA.map((id) => playerMap[id]?.name || "?").join(", ")} vs {match.teamB.map((id) => playerMap[id]?.name || "?").join(", ")}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
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
                  title="Delete this match?"
                  desc="The match will be removed and player Elo/statistics will be recalculated."
                  onConfirm={async () => {
                    const ok = await deleteMatch(match.id);
                    if (ok) toast.success("Match deleted");
                  }}
                />
              </div>
            </div>
          ))}
          {matches.length === 0 && (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-8 text-center text-sm text-muted-foreground">
              No matches recorded.
            </div>
          )}
        </div>
      </div>

        </>\n      )}\n\n      {activeTab === "challenges" && disputedChallenges.length > 0 && (
        <div className="card-surface rounded-2xl p-5 border-orange-500/20" data-testid="admin-dispute-center">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <div className="brand-kicker mb-1">Priority Queue</div>
              <h3 className="font-display font-bold text-lg">Disputes ({disputedChallenges.length})</h3>
              <p className="text-sm text-muted-foreground mt-1">Review contested challenge results first.</p>
            </div>
            <AlertTriangle size={20} className="text-orange-400" />
          </div>

          <div className="space-y-3">
            {disputedChallenges.map((challenge) => {
              const challenger = playerMap[challenge.challenger_player_id];
              const challenged = playerMap[challenge.challenged_player_id];
              const busy = challengeBusyId === challenge.id;
              const amount = (Number(challenge.amount_cents || 0) / 100).toFixed(2);

              const payoutDispute = Boolean(
                challenge.payout_disputed_at && !challenge.payout_dispute_resolved_at
              );

              return (
                <div key={challenge.id} className="rounded-xl bg-orange-500/[0.04] border border-orange-500/15 p-4">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold">
                        {challenger?.name || "Unknown"} vs {challenged?.name || "Unknown"} · €{amount}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-orange-400 mt-1">
                        {payoutDispute ? "Payment dispute" : "Result dispute"}
                      </div>
                      <div className="text-sm text-orange-200/80 mt-1">
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
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {payoutDispute ? (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() => updateAdminChallenge(
                              challenge.id,
                              { payoutResolution: "received" },
                              "Payout marked as received by Admin"
                            )}
                            className="h-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
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
                            className="h-10 bg-[#151923] border border-[#2A303B] text-white"
                          >
                            Reopen payout
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            disabled={busy}
                            onClick={() => updateAdminChallenge(
                              challenge.id,
                              {
                                winnerPlayerId: challenge.challenger_player_id,
                                status: "completed",
                              },
                              `${challenger?.name || "Challenger"} set as winner`
                            )}
                            className="h-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                          >
                            {challenger?.name || "Challenger"} won
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => updateAdminChallenge(
                              challenge.id,
                              {
                                winnerPlayerId: challenge.challenged_player_id,
                                status: "completed",
                              },
                              `${challenged?.name || "Challenged"} set as winner`
                            )}
                            className="h-10 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                          >
                            {challenged?.name || "Challenged"} won
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => updateAdminChallenge(challenge.id, { status: "cancelled" }, "Challenge cancelled")}
                            variant="ghost"
                            className="h-10 bg-[#151923] border border-[#2A303B]"
                          >
                            Cancel Chall
                          </Button>
                        </>
                      )}

                      <Link
                        to={`/challenges/${challenge.id}`}
                        className="h-10 px-3 rounded-xl bg-[#151923] border border-[#2A303B] inline-flex items-center justify-center"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "challenges" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="admin-challenge-management">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Challenge Control</div>
            <h3 className="font-display font-bold text-lg">Manage Challenges ({adminChallenges.length})</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Control status, stake, payment verification, results and disputes.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={loadAdminChallenges}
            className="bg-[#0F1218] border border-[#222834]"
          >
            <RotateCcw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>

        <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
          {adminChallenges.map((challenge) => {
            const challenger = playerMap[challenge.challenger_player_id];
            const challenged = playerMap[challenge.challenged_player_id];
            const draft = challengeDrafts[challenge.id] || {};
            const busy = challengeBusyId === challenge.id;
            const expanded = expandedChallengeId === challenge.id;
            const amount = new Intl.NumberFormat("it-IT", {
              style: "currency",
              currency: challenge.currency || "EUR",
            }).format(Number(challenge.amount_cents || 0) / 100);

            const statusClass =
              challenge.status === "completed"
                ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/5"
                : challenge.status === "disputed"
                  ? "text-orange-400 border-orange-500/25 bg-orange-500/5"
                  : challenge.status === "declined" || challenge.status === "cancelled"
                    ? "text-red-400 border-red-500/20 bg-red-500/5"
                    : challenge.status === "accepted"
                      ? "text-[#8E98FF] border-[#5865F2]/25 bg-[#5865F2]/5"
                      : "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/5";

            return (
              <div key={challenge.id} className="rounded-2xl bg-[#0F1218] border border-[#1D222C] overflow-hidden">
                <div className="p-4 flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-magma/10 border border-magma/20 flex items-center justify-center shrink-0">
                      <Swords size={17} className="text-magma" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold truncate">
                        {challenger?.name || "Unknown"} <span className="text-[#596170]">vs</span> {challenged?.name || "Unknown"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{String(challenge.platform || "").toUpperCase()}</span>
                        <span>·</span>
                        <span>{new Date(challenge.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                    <div className="h-10 px-3 rounded-xl bg-[#151923] border border-[#242A35] flex items-center">
                      <span className="font-mono font-bold text-white">{amount}</span>
                    </div>

                    <span className={`h-10 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider inline-flex items-center ${statusClass}`}>
                      {challenge.status.replace("_", " ")}
                    </span>

                    <Button
                      variant="ghost"
                      onClick={() => setExpandedChallengeId(expanded ? "" : challenge.id)}
                      className="h-10 px-4 rounded-xl bg-[#181B26] border border-[#2A303B] text-white hover:bg-white/[0.05]"
                    >
                      {expanded ? "Close" : "Manage"}
                    </Button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-[#1D222C] p-4 bg-[#0C0F14]">
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
                        onClick={() => updateAdminChallenge(challenge.id, { status: "disputed" }, "Challenge marked disputed")}
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
                          Open Match <ExternalLink size={13} />
                        </Link>

                        <ConfirmButton
                          iconOnly
                          testid={`admin-delete-challenge-${challenge.id}`}
                          icon={<Trash2 size={14} />}
                          title="Delete this challenge?"
                          desc="This permanently removes the challenge and its verification history."
                          onConfirm={() => removeAdminChallenge(challenge.id)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {adminChallenges.length === 0 && (
            <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-8 text-center text-sm text-muted-foreground">
              No challenges yet.
            </div>
          )}
        </div>
      </div>

        </>\n      )}\n\n      {activeTab === "discord" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="discord-settings">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle size={19} className="text-[#5865F2]" />
              <h3 className="font-display font-bold text-lg">Discord Integration</h3>
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

      <div className="card-surface rounded-2xl p-5" data-testid="discord-player-accounts">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Player Login</div>
            <h3 className="font-display font-bold text-lg">Discord Player Accounts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              When a player logs in with Discord for the first time, link that Discord account to the correct MuchoMoney8s player.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={loadDiscordAccounts}
            className="bg-[#0F1218] border border-[#222834]"
            data-testid="discord-accounts-refresh"
          >
            <RotateCcw size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>

        {discordAccounts.length === 0 ? (
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-4 py-8 text-center text-sm text-muted-foreground">
            No player has logged in with Discord yet.
          </div>
        ) : (
          <div className="space-y-2">
            {discordAccounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-[#0F1218] border border-[#1D222C] p-3"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {account.avatar_url ? (
                    <img src={account.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/30 flex items-center justify-center shrink-0">
                      <MessageCircle size={17} className="text-[#8E98FF]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{account.display_name || account.discord_username || "Discord User"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {account.discord_username ? `@${account.discord_username}` : "Discord account"}
                    </div>
                  </div>
                </div>

                <select
                  value={account.player_id || ""}
                  onChange={(e) => handleAccountLink(account.id, e.target.value)}
                  disabled={accountBusyId === account.id}
                  className="h-10 w-full sm:w-64 rounded-xl bg-[#151923] border border-[#2A303B] px-3 text-sm text-[#D7DBE2]"
                  data-testid={`discord-account-player-${account.id}`}
                >
                  <option value="">Not linked</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

        </>\n      )}\n\n      {activeTab === "system" && (
        <div className="card-surface rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="brand-kicker mb-1">Access Security</div>
              <h3 className="font-display font-bold text-lg">Discord allowlist</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Admin access is automatic only for the authorized Discord-linked players: Sharhy and SysMa. No Admin password is required.
              </p>
            </div>
            <Shield size={20} className="text-emerald-400" />
          </div>
        </div>
      )}

      {activeTab === "system" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="admin-audit-log">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="brand-kicker mb-1">Security & History</div>
            <h3 className="font-display font-bold text-lg">Admin Audit Log</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tracks important Admin changes to players, matches and challenges.
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
          <div className="rounded-xl bg-[#0F1218] border border-[#1D222C] p-8 text-center text-sm text-muted-foreground">
            No Admin actions recorded yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-xl bg-[#0F1218] border border-[#1D222C] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
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
        </>\n      )}\n\n      {activeTab === "players" && (\n        <>\n      <div className="card-surface rounded-2xl p-5" data-testid="admin-roster">
        <h3 className="font-display font-bold text-lg mb-4">Manage Roster ({players.length})</h3>
        <div className="space-y-2">
          {players.map((p) => {
            const isEditing = editing[p.id] !== undefined;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-[#0F1218] border border-[#1D222C]" data-testid={`admin-player-${p.id}`}>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={34} />
                {isEditing ? (
                  <div className="flex-1 min-w-[220px] grid grid-cols-1 sm:grid-cols-[1fr_110px_auto] gap-2">
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

        </>\n      )}\n\n      <RecordMatchDialog open={histOpen} onOpenChange={setHistOpen} title="Add Historical Match" />
      <RecordMatchDialog
        open={!!editMatchData}
        onOpenChange={(open) => !open && setEditMatchData(null)}
        editData={editMatchData}
        title="Edit Match"
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
        <Button data-testid={testid} className="justify-start bg-[#0F1218] border border-[#222834] hover:bg-white/[0.04] h-14 rounded-xl">
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
