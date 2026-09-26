import React from "react";
import { LoaderCircle } from "lucide-react";

export const PageSkeleton = () => (
  <div className="m8-page-stack" aria-busy="true" aria-label="Loading MuchoMoney8s">
    <section className="m8-panel rounded-[22px] p-5 sm:p-7">
      <div className="flex items-center gap-4">
        <div className="m8-skeleton h-16 w-16 rounded-2xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="m8-skeleton h-3 w-28 rounded-full" />
          <div className="m8-skeleton h-8 w-48 sm:w-64 rounded-lg mt-3" />
          <div className="m8-skeleton h-3 w-36 rounded-full mt-3" />
        </div>
        <LoaderCircle size={20} className="hidden sm:block text-magma animate-spin" />
      </div>
    </section>

    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="m8-panel rounded-2xl p-4 min-h-[98px]">
          <div className="m8-skeleton h-2.5 w-20 rounded-full" />
          <div className="m8-skeleton h-6 w-24 rounded-lg mt-4" />
          <div className="m8-skeleton h-2.5 w-16 rounded-full mt-3" />
        </div>
      ))}
    </section>

    <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="m8-panel rounded-2xl p-5 min-h-[190px]">
          <div className="m8-skeleton h-4 w-32 rounded-full" />
          <div className="space-y-3 mt-5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="m8-skeleton h-11 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </section>
  </div>
);

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action = null,
  compact = false,
}) => (
  <div
    className={`m8-empty-state m8-panel rounded-2xl text-center ${compact ? "p-8" : "p-10 sm:p-14"}`}
    role="status"
  >
    {Icon && (
      <div className="m8-empty-icon mx-auto mb-4">
        <Icon size={22} />
      </div>
    )}
    <div className="font-display font-black text-lg tracking-[-0.015em]">{title}</div>
    {description && (
      <div className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-6">
        {description}
      </div>
    )}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);
