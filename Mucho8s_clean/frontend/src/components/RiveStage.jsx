import React, { useState } from "react";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
} from "@rive-app/react-canvas";

function ActiveRiveStage({
  src,
  stateMachines,
  artboard,
  autoplay,
  ariaLabel,
  fallback,
}) {
  const [failed, setFailed] = useState(false);
  const { RiveComponent } = useRive({
    src,
    stateMachines: stateMachines || undefined,
    artboard: artboard || undefined,
    autoplay,
    onLoadError: () => setFailed(true),
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });

  if (failed) return fallback;

  return (
    <RiveComponent
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export default function RiveStage({
  src,
  stateMachines,
  artboard,
  autoplay = true,
  ariaLabel = "",
  className = "",
  fallback = null,
}) {
  const resolvedSrc = String(src || "").trim();

  if (!resolvedSrc) return fallback;

  return (
    <div className={className} data-rive-stage>
      <ActiveRiveStage
        src={resolvedSrc}
        stateMachines={stateMachines}
        artboard={artboard}
        autoplay={autoplay}
        ariaLabel={ariaLabel}
        fallback={fallback}
      />
    </div>
  );
}
