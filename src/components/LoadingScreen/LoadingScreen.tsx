/**
 * LoadingScreen - Authentic Minecraft Java Edition Loading Screen
 *
 * Renders the centered discrete square chunk loader over the authentic Minecraft
 * dirt background, displaying real-time asset readiness percentage.
 */

import React from "react";
import { MinecraftSquareLoader } from "../PixelUI/PixelLoading";
import "../PixelUI/pixel.css";

export interface LoadingScreenProps {
  progress?: number;
  onComplete?: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress = 0 }) => {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className="mc-dirt-bg"
      aria-live="polite"
      aria-busy={clampedProgress < 100}
      role="status"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        {/* Centered Percentage in Minecraft Pixel Font */}
        <p
          style={{
            fontFamily: "var(--mc-font)",
            fontSize: "14px",
            color: "#ffffff",
            textShadow: "2px 2px 0px #000000",
            letterSpacing: "1px",
            marginBottom: "16px",
            textAlign: "center",
            margin: "0 0 16px 0",
          }}
        >
          {clampedProgress}%
        </p>

        {/* Discrete Minecraft Square Chunk Loader */}
        <MinecraftSquareLoader progress={clampedProgress} size={132} />
      </div>
    </div>
  );
};

export default LoadingScreen;
