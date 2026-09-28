import React, { useEffect } from "react";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useStateMachineInput,
} from "@rive-app/react-canvas";

const STATE_MACHINE = "State Machine 1";
const ARTBOARD = "Main";

const TEMPLATE_SRC = `${process.env.PUBLIC_URL}/animations/game-badge-upgrade.riv`;

export default function RankUpgradeRive({
  playKey,
  className = "",
  onReady,
  onError,
}) {
  const { rive, RiveComponent } = useRive({
    src: TEMPLATE_SRC,
    artboard: ARTBOARD,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    automaticallyHandleEvents: false,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    onLoad: () => onReady?.(),
    onLoadError: (error) => onError?.(error),
  });

  const restartTrigger = useStateMachineInput(
    rive,
    STATE_MACHINE,
    "Trigger 2"
  );
  const upgradeTrigger = useStateMachineInput(
    rive,
    STATE_MACHINE,
    "Trigger 1"
  );

  useEffect(() => {
    if (!rive || !playKey) return undefined;

    // The source file exposes Trigger 2 beside the restart state and
    // Trigger 1 beside the click/upgrade state.
    restartTrigger?.fire?.();

    const timer = window.setTimeout(() => {
      upgradeTrigger?.fire?.();
    }, 180);

    return () => window.clearTimeout(timer);
  }, [rive, playKey, restartTrigger, upgradeTrigger]);

  return (
    <div className={className} data-rankup-rive-template>
      <RiveComponent
        aria-hidden="true"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
