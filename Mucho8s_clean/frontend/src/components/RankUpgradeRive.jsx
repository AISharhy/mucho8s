import React from "react";
import {
  Alignment,
  Fit,
  Layout,
  useRive,
} from "@rive-app/react-canvas";

const STATE_MACHINE = "State Machine 1";
const ARTBOARD = "Main";
const TEMPLATE_SRC = `${process.env.PUBLIC_URL}/animations/game-badge-upgrade.riv`;

export default function RankUpgradeRive({ className = "" }) {
  const { RiveComponent } = useRive({
    src: TEMPLATE_SRC,
    artboard: ARTBOARD,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    automaticallyHandleEvents: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });

  return (
    <div className={className}>
      <RiveComponent
        aria-label="Game badge upgrade animation"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
