/**
 * VEDANT.EXE - 3D Developer Portfolio
 * Milestone 1: Clean Foundation & Minecraft-Style Asset Loading Screen
 */

import { useState } from "react";
import { LoadingScreen } from "./components/LoadingScreen/LoadingScreen";
import { WorldCanvas } from "./scenes/World/WorldCanvas";
import { useActualAssetProgress } from "./hooks/useActualAssetProgress";

export function App() {
  const [isCanvasReady, setIsCanvasReady] = useState<boolean>(false);
  const [isSceneReady, setIsSceneReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [isJourneyActive, setIsJourneyActive] = useState<boolean>(false);

  // Synchronized with real DOM, font, WebGL, Drei assets, and 3D first-frame render
  const {
    progress,
    statusText,
    error: assetError,
  } = useActualAssetProgress({
    isCanvasReady,
    isSceneReady,
    onComplete: () => {
      setIsLoading(false);
      setIsJourneyActive(true);
    },
  });

  const combinedError = sceneError || assetError;

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        backgroundColor: "var(--color-forest)",
      }}
    >
      {/* Background 3D World Canvas */}
      <WorldCanvas
        onCreated={() => setIsCanvasReady(true)}
        onSceneReady={() => setIsSceneReady(true)}
        onError={(err) => setSceneError(err.message)}
        isJourneyActive={isJourneyActive}
        onJourneyComplete={() => setIsJourneyActive(false)}
      />

      {/* Brand Header */}
      <header
        style={{
          position: "fixed",
          top: "24px",
          left: "28px",
          zIndex: 40,
          pointerEvents: "auto",
        }}
      >
        <span
          style={{
            fontFamily: "var(--mc-font)",
            fontSize: "13px",
            letterSpacing: "1px",
            color: "var(--mc-white)",
            textShadow: "2px 2px 0px #000000",
            textTransform: "uppercase",
            userSelect: "none",
          }}
        >
          VEDANT.EXE
        </span>
      </header>

      {/* Minecraft Java Edition World Generation Loading Screen */}
      {isLoading && (
        <LoadingScreen
          progress={progress}
          statusText={statusText}
          error={combinedError}
          onRetry={() => {
            setSceneError(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

export default App;
