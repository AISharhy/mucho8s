import React from "react";
import RankUpgradeRive from "@/components/RankUpgradeRive";

export default function RiveUpgradeTest() {
  return (
    <section className="m8-panel rounded-[22px] p-5 sm:p-7 min-h-[620px] flex flex-col">
      <div className="mb-5">
        <div className="brand-kicker mb-1">Rive Test</div>
        <h1 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em]">
          Original Rank Upgrade
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Questa è l'animazione Rive originale senza overlay o logica Mucho.
          Interagisci direttamente con il pulsante UPGRADE dentro l'animazione.
        </p>
      </div>

      <div className="flex-1 min-h-[500px] rounded-2xl border border-[#242A35] bg-[#080B10] overflow-hidden grid place-items-center">
        <RankUpgradeRive className="w-full h-[500px] sm:h-[560px]" />
      </div>
    </section>
  );
}
