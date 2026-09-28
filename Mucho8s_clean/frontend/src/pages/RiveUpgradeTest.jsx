import React from "react";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RankUpgradeRive from "@/components/RankUpgradeRive";

export default function RiveUpgradeTest() {
  const navigate = useNavigate();

  return (
    <section className="fixed inset-0 z-[12000] overflow-hidden bg-[#020305]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-xl border border-white/10 bg-black/45 backdrop-blur-md text-white/70 hover:text-white hover:bg-black/65 transition-colors flex items-center justify-center"
        aria-label="Close Rive test"
        title="Close"
      >
        <X size={18} />
      </button>

      <div className="absolute inset-0">
        <RankUpgradeRive className="w-screen h-screen" />
      </div>
    </section>
  );
}
