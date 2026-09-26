import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Check,
  Clock3,
  Swords,
  X,
} from "lucide-react";
import { toast } from "sonner";

const statusClass = {
  pending: "text-[#D5A33A] border-[#D5A33A]/25 bg-[#D5A33A]/10",
  disputed: "text-orange-400 border-orange-500/25 bg-orange-500/10",
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
        .filter((report) => ["pending", "disputed"].includes(report.status))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8),
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
    if (result) toast.success("Result confirmed — stats updated");
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
        ? "Result confirmed by Admin"
        : "Match report cancelled"
    );
  };

  return (
    <section className="space-y-3" data-testid="match-result-center">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <div className="brand-kicker mb-1">Action needed</div>
          <h3 className="font-display text-xl font-black tracking-[-0.02em]">Pending verification</h3>
        </div>
        <span className="m8-pill">{reports.length}</span>
      </div>

      {reports.map((report) => {
        const teamA = Array.isArray(report.team_a) ? report.team_a : [];
        const teamB = Array.isArray(report.team_b) ? report.team_b : [];
        const mvp = report.mvp_id ? safePlayerMap[report.mvp_id] : null;
        const merda = report.merda_id ? safePlayerMap[report.merda_id] : null;
        const canReview = eligibleCaptain(report);
        const winnerName = report.winner === "A" ? "Alpha" : "Bravo";

        return (
          <div
            key={report.id}
            className={`m8-panel rounded-2xl p-4 border ${
              report.status === "disputed"
                ? "border-orange-500/20 bg-orange-500/[0.025]"
                : "border-[#222834]"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wider ${statusClass[report.status]}`}>
                    {report.status === "disputed" ? <AlertTriangle size={12} /> : <Clock3 size={12} />}
                    {report.status === "disputed" ? "DISPUTED" : "WAITING"}
                  </span>
                  {report.game && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {report.game}{report.mode ? ` · ${report.mode}` : ""}
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                    {winnerName} won
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 items-center mt-3">
                  <div>
                    <div className={`font-display font-bold ${report.winner === "A" ? "text-magma" : ""}`}>Alpha</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {teamA.map((id) => safePlayerMap[id]?.name || "Player").join(" · ")}
                    </div>
                  </div>

                  <div className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-[#596170]">VS</div>

                  <div className="sm:text-right">
                    <div className={`font-display font-bold ${report.winner === "B" ? "text-[#D5A33A]" : ""}`}>Bravo</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {teamB.map((id) => safePlayerMap[id]?.name || "Player").join(" · ")}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {mvp && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#D5A33A]/[0.07] border border-[#D5A33A]/20 text-xs text-[#D5A33A] font-bold">
                      <span aria-hidden="true">🏆</span> MVP · {mvp.name}
                    </span>
                  )}

                  {merda && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8B5E3C]/[0.08] border border-[#8B5E3C]/25 text-xs text-[#C79A6B] font-bold">
                      💩 MERDA · {merda.name}
                    </span>
                  )}

                  {report.status === "disputed" && report.dispute_note && (
                    <span className="inline-flex items-center px-2.5 py-1.5 rounded-lg bg-orange-500/[0.05] border border-orange-500/20 text-xs text-orange-300">
                      {report.dispute_note}
                    </span>
                  )}
                </div>
              </div>

              <div className="lg:w-64 shrink-0">
                {canReview && disputeId !== report.id && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => setDisputeId(report.id)}
                      disabled={Boolean(busy)}
                      className="h-11 bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15"
                    >
                      <X size={15} className="mr-1.5" /> Dispute
                    </Button>
                    <Button
                      onClick={() => confirm(report)}
                      disabled={Boolean(busy)}
                      className="h-11 bg-emerald-500 hover:bg-emerald-400 text-black font-bold"
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

                {report.status === "pending" && !canReview && !isAdmin && (
                  <div className="rounded-xl bg-[#151923] border border-[#242A35] p-3 text-xs text-muted-foreground text-center">
                    Waiting for captain verification
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
    </section>
  );
}
