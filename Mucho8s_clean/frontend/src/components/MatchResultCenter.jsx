import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  Clock3,
  Crown,
  Lock,
  ShieldCheck,
  Swords,
  X,
} from "lucide-react";
import { toast } from "sonner";

const statusClass = {
  pending: "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/10",
  disputed: "text-orange-400 border-orange-500/25 bg-orange-500/10",
  completed: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10",
  cancelled: "text-[#697181] border-[#343B48] bg-[#151923]",
};

export default function MatchResultCenter() {
  const {
    matchReports,
    playerMap,
    discordPlayer,
    isAdmin,
    confirmMatchReport,
    disputeMatchReport,
    adminResolveMatchReport,
  } = useData();

  const [disputeId, setDisputeId] = useState("");
  const [disputeNote, setDisputeNote] = useState("");
  const [busy, setBusy] = useState("");

  const safePlayerMap = playerMap && typeof playerMap === "object" ? playerMap : {};

  const reports = useMemo(
    () =>
      [...(Array.isArray(matchReports) ? matchReports : [])]
        .filter(Boolean)
        .filter((report) => ["pending", "disputed", "completed"].includes(report.status))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 12),
    [matchReports]
  );

  if (!reports.length) return null;

  const eligibleCaptain = (report) => {
    if (!discordPlayer?.id || report.status !== "pending") return false;

    if (report.reporter_is_admin) {
      return [report.captain_a_player_id, report.captain_b_player_id].includes(discordPlayer.id);
    }

    if (report.reporter_player_id === report.captain_a_player_id) {
      return discordPlayer.id === report.captain_b_player_id;
    }

    return discordPlayer.id === report.captain_a_player_id;
  };

  const confirm = async (report) => {
    setBusy(`confirm:${report.id}`);
    const result = await confirmMatchReport(report.id);
    setBusy("");
    if (result) toast.success("Result confirmed — match locked and stats updated");
  };

  const dispute = async (report) => {
    if (!disputeNote.trim()) {
      toast.error("Explain why the result is wrong");
      return;
    }

    setBusy(`dispute:${report.id}`);
    const result = await disputeMatchReport(report.id, disputeNote.trim());
    setBusy("");
    if (!result) return;

    setDisputeId("");
    setDisputeNote("");
    toast.error("Result disputed — Admin review required");
  };

  const adminResolve = async (report, decision) => {
    setBusy(`admin:${report.id}`);
    const result = await adminResolveMatchReport(report.id, decision);
    setBusy("");
    if (!result) return;

    toast.success(
      decision === "confirm"
        ? "Result locked by Admin — stats updated"
        : "Match report cancelled"
    );
  };

  return (
    <section className="m8-panel rounded-[22px] p-5 sm:p-6" data-testid="match-result-center">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="brand-kicker mb-1">Verification Center</div>
          <h3 className="font-display text-2xl font-black tracking-[-0.025em]">Match Results</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Results update Elo and challenge stats only after verification.
          </p>
        </div>
        <ShieldCheck size={20} className="text-magma" />
      </div>

      <div className="space-y-3">
        {reports.map((report) => {
          const teamA = Array.isArray(report.team_a) ? report.team_a : [];
          const teamB = Array.isArray(report.team_b) ? report.team_b : [];
          const captainA = safePlayerMap[report.captain_a_player_id];
          const captainB = safePlayerMap[report.captain_b_player_id];
          const mvp = report.mvp_id ? safePlayerMap[report.mvp_id] : null;
          const canReview = eligibleCaptain(report);
          const statusLabel =
            report.status === "completed"
              ? "LOCKED"
              : report.status === "disputed"
                ? "DISPUTED"
                : "WAITING CONFIRMATION";

          return (
            <div
              key={report.id}
              className={`rounded-2xl border p-4 transition-colors ${report.status === "completed"
                ? "bg-emerald-500/[0.025] border-emerald-500/15"
                : report.status === "disputed"
                  ? "bg-orange-500/[0.025] border-orange-500/15"
                  : "bg-[#0F1218] border-[#1D222C]"}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wider ${statusClass[report.status] || statusClass.pending}`}>
                      {report.status === "completed" ? <Lock size={12} /> : report.status === "disputed" ? <AlertTriangle size={12} /> : <Clock3 size={12} />}
                      {statusLabel}
                    </span>
                    {report.game && (
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {report.game}{report.mode ? ` · ${report.mode}` : ""}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center mt-4">
                    <div>
                      <div className={`font-display font-bold ${report.winner === "A" ? "text-magma" : ""}`}>
                        Team A
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {teamA.map((id) => safePlayerMap[id]?.name || "Player").join(" · ")}
                      </div>
                      <div className="text-[10px] text-[#697181] mt-1">
                        Captain: {captainA?.name || "Player"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={`font-display font-bold ${report.winner === "B" ? "text-[#D5A33A]" : ""}`}>
                        Team B
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {teamB.map((id) => safePlayerMap[id]?.name || "Player").join(" · ")}
                      </div>
                      <div className="text-[10px] text-[#697181] mt-1">
                        Captain: {captainB?.name || "Player"}
                      </div>
                    </div>
                  </div>

                  {mvp && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D5A33A]/[0.07] border border-[#D5A33A]/20 text-xs text-[#D5A33A] mt-3 font-bold">
                      <Crown size={13} /> MVP · {mvp.name}
                    </div>
                  )}

                  {report.status === "disputed" && report.dispute_note && (
                    <div className="mt-3 rounded-xl bg-orange-500/[0.05] border border-orange-500/20 p-3 text-sm">
                      <div className="text-[10px] uppercase tracking-widest text-orange-300">Dispute reason</div>
                      <div className="text-muted-foreground mt-1">{report.dispute_note}</div>
                    </div>
                  )}
                </div>

                <div className="lg:w-64 shrink-0">
                  {canReview && disputeId !== report.id && (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => setDisputeId(report.id)}
                        disabled={Boolean(busy)}
                        className="bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15"
                      >
                        <X size={15} className="mr-1.5" /> Dispute
                      </Button>
                      <Button
                        onClick={() => confirm(report)}
                        disabled={Boolean(busy)}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
                      >
                        <Check size={15} className="mr-1.5" /> Confirm
                      </Button>
                    </div>
                  )}

                  {canReview && disputeId === report.id && (
                    <div className="space-y-2">
                      <textarea
                        value={disputeNote}
                        onChange={(event) => setDisputeNote(event.target.value)}
                        maxLength={240}
                        placeholder="What is wrong with this result?"
                        className="w-full min-h-20 rounded-xl bg-[#151923] border border-[#2A303B] px-3 py-2 text-sm outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setDisputeId("");
                            setDisputeNote("");
                          }}
                          className="border border-[#2A303B]"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => dispute(report)}
                          disabled={Boolean(busy) || !disputeNote.trim()}
                          className="bg-red-500 hover:bg-red-400 text-white"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  )}

                  {report.status === "pending" && !canReview && (
                    <div className="rounded-xl bg-[#151923] border border-[#242A35] p-3 text-xs text-muted-foreground text-center">
                      Waiting for an authorized captain to verify.
                    </div>
                  )}

                  {report.status === "completed" && (
                    <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-3 text-xs text-emerald-400 text-center font-semibold">
                      <Lock size={14} className="inline mr-1.5" />
                      Official result locked
                    </div>
                  )}

                  {isAdmin && ["pending", "disputed"].includes(report.status) && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <Button
                        variant="ghost"
                        onClick={() => adminResolve(report, "cancel")}
                        disabled={Boolean(busy)}
                        className="border border-[#2A303B] text-muted-foreground"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => adminResolve(report, "confirm")}
                        disabled={Boolean(busy)}
                        className="bg-[#181B26] border border-magma/30 text-magma hover:bg-magma/10"
                      >
                        <Swords size={14} className="mr-1.5" /> Admin Lock
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
