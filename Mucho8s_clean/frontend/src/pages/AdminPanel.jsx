import React, { useRef, useState } from "react";
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
import { Shield, UserPlus, Trash2, Pencil, RotateCcw, Upload, Download, LogOut, History, Database, Check, Lock, Eye, EyeOff } from "lucide-react";
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
        <div className="gradient-bar h-1 absolute top-0 left-0 right-0" />
        <div className="w-16 h-16 rounded-full gradient-bar flex items-center justify-center mx-auto mb-5 magma-glow">
          <Shield size={30} className="text-black" />
        </div>
        <h2 className="font-display text-2xl font-bold">Admin Access</h2>
        <p className="text-muted-foreground text-sm mt-2 mb-6">Restricted area — only the <span className="text-gold font-semibold">Admin</span> can enter.</p>
        <Input
          data-testid="admin-nickname-input"
          placeholder="Username..."
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && tryEnter()}
          className="bg-[#181B26] border-[#242938] h-12 text-center"
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
            className="bg-[#181B26] border-[#242938] h-12 text-center px-9"
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
  const { admin, setAdmin, players, addPlayer, removePlayer, editElo, resetStats, importPlayers } = useData();
  const [newName, setNewName] = useState("");
  const [newElo, setNewElo] = useState(1000);
  const [editing, setEditing] = useState({}); // id -> value
  const [histOpen, setHistOpen] = useState(false);
  const fileRef = useRef(null);

  if (!admin) return <Gate />;

  const handleAdd = () => {
    if (!newName.trim()) return toast.error("Enter a player name");
    addPlayer(newName.trim(), Number(newElo) || 1000);
    toast.success(`${newName.trim()} added to the roster`);
    setNewName("");
    setNewElo(1000);
  };

  const saveElo = (id) => {
    editElo(id, Number(editing[id]));
    setEditing((p) => { const n = { ...p }; delete n[id]; return n; });
    toast.success("Elo updated");
  };

  const handleImport = (e) => {    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.players;
        if (!Array.isArray(list)) throw new Error("bad");
        importPlayers(list);
        toast.success(`Imported ${list.length} players`);
      } catch {
        toast.error("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleExport = () => {
    if (!players.length) {
      toast.error("No players to export");
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      players,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mucho8s-player-database-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${players.length} players`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-magma" />
          <h2 className="font-display text-2xl font-bold">Control Room</h2>
          <span className="text-sm text-muted-foreground">· {admin?.nickname}</span>
        </div>
        <Button variant="ghost" onClick={() => setAdmin(null)} data-testid="admin-logout-btn" className="text-muted-foreground">
          <LogOut size={16} className="mr-1" /> Sign out
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add player */}
        <div className="card-surface rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus size={18} className="text-emerald-400" />
            <h3 className="font-display font-bold text-lg">Add Player</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nickname</Label>
              <Input data-testid="admin-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Reaper" className="bg-[#181B26] border-[#242938] mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Starting Elo</Label>
              <Input data-testid="admin-new-elo" type="number" value={newElo} onChange={(e) => setNewElo(e.target.value)} className="bg-[#181B26] border-[#242938] mt-1" />
            </div>
            <Button onClick={handleAdd} data-testid="admin-add-player-btn" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold">
              <UserPlus size={16} className="mr-1" /> Add to Roster
            </Button>
          </div>
        </div>

        {/* Data actions */}
        <div className="card-surface rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-gold" />
            <h3 className="font-display font-bold text-lg">Data & Records</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleExport} data-testid="admin-export-btn" className="justify-start bg-[#181B26] border border-[#242938] hover:bg-white/5 h-14">
              <Download size={18} className="mr-2 text-emerald-400" /> Export Player Database
            </Button>

            <Button onClick={() => fileRef.current?.click()} data-testid="admin-import-btn" className="justify-start bg-[#181B26] border border-[#242938] hover:bg-white/5 h-14">
              <Upload size={18} className="mr-2 text-blue-400" /> Import Player Database
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

            <Button onClick={() => setHistOpen(true)} data-testid="admin-add-historical-btn" className="justify-start bg-[#181B26] border border-[#242938] hover:bg-white/5 h-14">
              <History size={18} className="mr-2 text-magma" /> Add Historical Match
            </Button>
          </div>
        </div>
      </div>

      {/* Roster management */}
      <div className="card-surface rounded-xl p-5" data-testid="admin-roster">
        <h3 className="font-display font-bold text-lg mb-4">Manage Roster ({players.length})</h3>
        <div className="space-y-2">
          {players.map((p) => {
            const isEditing = editing[p.id] !== undefined;
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#101219] border border-[#1C202E]" data-testid={`admin-player-${p.id}`}>
                <PlayerAvatar name={p.name} elo={p.currentElo} size={34} />
                <span className="font-medium flex-1 truncate">{p.name}</span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input
                      data-testid={`admin-edit-elo-input-${p.id}`}
                      type="number"
                      value={editing[p.id]}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-24 h-9 bg-[#181B26] border-[#242938]"
                    />
                    <Button size="icon" onClick={() => saveElo(p.id)} data-testid={`admin-save-elo-${p.id}`} className="h-9 w-9 bg-emerald-500 hover:bg-emerald-600">
                      <Check size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <EloBadge elo={p.currentElo} />
                    <Button size="icon" variant="ghost" onClick={() => setEditing((prev) => ({ ...prev, [p.id]: p.currentElo }))} data-testid={`admin-edit-elo-btn-${p.id}`} className="h-9 w-9">
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
        <Button data-testid={testid} className="justify-start bg-[#181B26] border border-[#242938] hover:bg-white/5 h-14">
          {icon} {label}
        </Button>
      )}
    </AlertDialogTrigger>
    <AlertDialogContent className="bg-[#12141C] border-[#242938]">
      <AlertDialogHeader>
        <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
        <AlertDialogDescription>{desc}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="bg-[#181B26] border-[#242938]">Cancel</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} data-testid={`${testid}-confirm`} className="bg-magma hover:bg-magma/90 text-white">
          Confirm
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
