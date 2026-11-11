/**
 * LoadingScreen - Authentic Minecraft Java Edition Loading Screen
 *
 * Renders the centered discrete square chunk loader over the authentic Minecraft
 * dirt background, displaying real-time asset readiness percentage and authentic
 * category-based generation stage descriptions.
 */

import React from "react";
import { MinecraftSquareLoader } from "../PixelUI/PixelLoading";
import { PixelButton } from "../PixelUI/PixelButton";
import "../PixelUI/pixel.css";

export interface LoadingScreenProps {
  progress?: number;
  statusText?: string;
  error?: string | null;
  onRetry?: () => void;
  title?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  progress = 0,
  statusText = "Generating terrain...",
  error = null,
  onRetry,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className="mc-dirt-bg"
      aria-live="polite"
      aria-busy={clampedProgress < 100 && !error}
      role="status"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: "480px",
          padding: "24px",
          boxSizing: "border-box",
        }}
      >
        {/* Real Percentage Positioned Directly Above the Indicator */}
        <p
          style={{
            fontFamily: "var(--mc-font)",
            fontSize: "14px",
            color: error ? "#ff5555" : "#ffffff",
            textShadow: "2px 2px 0px #000000",
            letterSpacing: "1px",
            marginBottom: "16px",
            textAlign: "center",
            margin: "0 0 16px 0",
            userSelect: "none",
          }}
        >
          {error ? "Failed" : `${clampedProgress}%`}
        </p>

        {/* Authentic Minecraft Java Edition Three-Color Nested Square Indicator */}
        <MinecraftSquareLoader progress={error ? 0 : clampedProgress} size={180} />

        {/* Short Stage Description Directly Below the Square in Minecraft Font */}
        <p
          style={{
            fontFamily: "var(--mc-font)",
            fontSize: "12px",
            color: error ? "#ff5555" : "var(--mc-gray)",
            textShadow: "2px 2px 0px #000000",
            letterSpacing: "0.5px",
            marginTop: "16px",
            marginBottom: error ? "16px" : "0",
            textAlign: "center",
            lineHeight: 1.5,
            userSelect: "none",
          }}
        >
          {error ? `Error: ${error}` : statusText}
        </p>

        {/* Graceful Error Recovery Button */}
        {error && (
          <div style={{ marginTop: "16px" }}>
            <PixelButton
              onClick={() => {
                if (onRetry) {
                  onRetry();
                } else {
                  window.location.reload();
                }
              }}
              variant="compact"
            >
              Retry Generation
            </PixelButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
