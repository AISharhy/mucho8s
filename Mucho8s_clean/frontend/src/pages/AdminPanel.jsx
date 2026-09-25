import React, { useCallback, useEffect, useRef, useState } from "react";
import { useData } from "@/context/DataContext";
import { EloBadge, PlayerAvatar } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RecordMatchDialog } from "@/components/RecordMatchDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, UserPlus, Trash2, Pencil, RotateCcw, Upload, Download, LogOut, History, Database, Check, Lock, Eye, EyeOff, MessageCircle, Send, Link2 } from "lucide-react";
import { toast } from "sonner";

const Gate = () => {
  const { setAdmin } = useData();
  const [nick, setNick] = useState("");
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const tryEnter = async () => {
    if (!nick.trim() || !pwd) return;
    setBusy(true);
    const ok = await setAdmin(nick.trim(), pwd);
    setBusy(false);
    if (!ok) {
      toast.error("Access denied — invalid admin credentials");
      return;
    }
    toast.success("Welcome, Admin");
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card-surface rounded-2xl p-8 text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-[#0B0D12] border border-[#282E39] flex items-center justify-center mx-auto mb-5">
          <img src={`${process.env.PUBLIC_URL}/logo-mark.svg`} alt="MuchoMoney8s" className="w-14 h-14 object-contain" />
        </div>
        <div className="brand-kicker mb-1">Control Room</div><h2 className="font-display text-2xl font-extrabold">Admin Access</h2>
        <p className="text-muted-foreground text-sm mt-2 mb-6">Restricted area for roster and match management.</p>
        <Input
          data-testid="admin-nickname-input"
          placeholder="Username..."
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryEnter()}
          className="bg-[#0F1218] border-[#222834] h-12 text-center"
        />
        <div className="relative mt-3">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-testid="admin-password-input"
            type={show ? "text" : "password"}
            placeholder="Admin password..."
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryEnter()}
            className="bg-[#0F1218] border-[#222834] h-12 text-center px-9"
          />
          <button
            type="button"
            data-testid="admin-password-toggle"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
          >
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Button
          data-testid="admin-enter-btn"
          disabled={!nick.trim() || !pwd || busy}
          onClick={tryEnter}
          className="w-full mt-4 h-12 bg-magma hover:bg-magma/90 text-white font-bold"
        >
          {busy ? "Checking..." : "Enter Control Room"}
        </Button>
      </div>
    </div>
  );
};

export default function AdminPanel() {
  const { admin, setAdmin, players, matches, addPlayer, removePlayer, editPlayer, resetStats, importPlayers, importFullBackup, storageMode, getDiscordStatus, configureDiscordWebhook, clearDiscordWebhook, testDiscordWebhook, listDiscordAccounts, linkDiscordAccount } = useData();
  const [newName, setNewName] = useState("");
  const [newElo, setNewElo] = useState(1000);
  const [editing, setEditing] = useState({}); // id -> { name, elo }
  const [histOpen, setHistOpen] = useState(false);
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [discordConfigured, setDiscordConfigured] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordAccounts, setDiscordAccounts] = useState([]);
  const [accountBusyId, setAccountBusyId] = useState("");
  const fileRef = useRef(null);

  const loadDiscordAccounts = useCallback(async () => {
    const list = await listDiscordAccounts();
    if (list) setDiscordAccounts(list);
  }, [listDiscordAccounts]);

  useEffect(() => {
    let active = true;
    if (!admin) return undefined;

    getDiscordStatus().then((configured) => {
      if (active) setDiscordConfigured(configured);
    });
    void loadDiscordAccounts();

    return () => {
      active = false;
    };
  }, [admin, getDiscordStatus, loadDiscordAccounts]);

  if (!admin) return <Gate />;

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-magma" />
          <div><div className="brand-kicker mb-1">Administration</div><h2 className="font-display text-2xl font-extrabold">Control Room</h2></div>
          <span className="text-sm text-muted-foreground">· {admin?.nickname}</span>
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-[#0F1218] border border-[#222834] text-muted-foreground">{storageMode}</span>
        </div>
        <Button variant="ghost" onClick={() => setAdmin(null)} data-testid="admin-logout-btn" className="text-muted-foreground">
          <LogOut size={16} className="mr-1" /> Sign out
        </Button>
      </div>

      {storageMode === "local" && (
        <div className="rounded-xl border border-[#3A3320] bg-[#D5A33A]/5 px-4 py-3 text-sm text-muted-foreground">
          <span className="text-[#D5A33A] font-semibold">Local mode:</span> player e match sono salvati solo in questo browser. Collega Supabase per avere lo stesso database su PC e telefono.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add player */}
        <div className="card-surface rounded-2xl p-5">
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
        <div className="card-surface rounded-2xl p-5 lg:col-span-2">
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

      <div className="card-surface rounded-2xl p-5" data-testid="discord-settings">
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

      {/* Roster management */}
      <div className="card-surface rounded-2xl p-5" data-testid="admin-roster">
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

      <RecordMatchDialog open={histOpen} onOpenChange={setHistOpen} title="Add Historical Match" />
    </div>
  );
}

const ConfirmButton = ({ label, icon, title, desc, onConfirm, testid, iconOnly }) => (
  <AlertDialog>
    <AlertDialogTrigger asChild>
      {iconOnly ? (
        <Button size="icon" variant="ghost" data-testid={testid} className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-500/10">
          {icon}
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
