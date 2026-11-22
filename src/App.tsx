/**
 * VEDANT.EXE - 3D Developer Portfolio
 * Milestone 1: Clean Foundation & Minecraft-Style Asset Loading Screen
 */

import { useCallback, useState } from "react";
import { LoadingScreen } from "./components/LoadingScreen/LoadingScreen";
import { WorldCanvas } from "./scenes/World/WorldCanvas";
import { useActualAssetProgress } from "./hooks/useActualAssetProgress";
import { useSectionNavigation } from "./hooks/useSectionNavigation";
import { Navigation } from "./components/Navigation/Navigation";
import { HubIntro } from "./components/HubIntro";

export function App() {
  const [isCanvasReady, setIsCanvasReady] = useState<boolean>(false);
  const [isSceneReady, setIsSceneReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [isJourneyActive, setIsJourneyActive] = useState<boolean>(false);
  const [isVillageVisible, setIsVillageVisible] = useState<boolean>(true);
  // Hub starts completely hidden on initial page load until Boat_Visibility marker is crossed
  const [isHubVisible, setIsHubVisible] = useState<boolean>(false);
  const [isAtHubResting, setIsAtHubResting] = useState<boolean>(false);
  const [hasReachedHubResting, setHasReachedHubResting] = useState<boolean>(false);
  // Mars Research Station starts hidden until wormhole teleportation
  const [isMarsVisible, setIsMarsVisible] = useState<boolean>(false);
  const [, setIsAtMarsResting] = useState<boolean>(false);

  // Hub wormhole remains hidden during village journey, becomes visible when camera reaches Hub Resting
  const isWormholeVisible = hasReachedHubResting;

  const { activeSection, goToSection, nextSection } = useSectionNavigation();

  const handleAtHubRestingChange = useCallback((atResting: boolean) => {
    setIsAtHubResting(atResting);
    if (atResting) {
      setHasReachedHubResting(true);
    }
  }, []);

  const handleTeleportToMars = useCallback(() => {
    setIsMarsVisible(true);
    setIsVillageVisible(false);
    setIsHubVisible(false);
  }, []);

  const handleTeleportToHub = useCallback(() => {
    setIsMarsVisible(false);
    setIsVillageVisible(true);
    setIsHubVisible(true);
    setIsAtMarsResting(false);
  }, []);

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
        isVillageVisible={isVillageVisible}
        isHubVisible={isHubVisible}
        onHubVisibilityChange={setIsHubVisible}
        onAtHubRestingChange={handleAtHubRestingChange}
        onScrollDownAtHub={nextSection}
        activeSection={activeSection.id}
        onNavigateSection={(sectionId) => {
          goToSection(sectionId);
        }}
        isWormholeVisible={isWormholeVisible}
        isMarsVisible={isMarsVisible}
        onMarsVisibilityChange={setIsMarsVisible}
        onTeleportToMars={handleTeleportToMars}
        onTeleportToHub={handleTeleportToHub}
        onAtMarsRestingChange={setIsAtMarsResting}
        enableOrbitControls={false}
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

      {/* Navigation Bar */}
      {!isLoading && (
        <Navigation
          activeId={activeSection.id}
          onNavigate={(id) => {
            goToSection(id);
          }}
        />
      )}

      {/* Introductory Portfolio Overlay at Hub Resting */}
      <HubIntro
        visible={isAtHubResting && activeSection.id === "home" && !isLoading}
        onExploreWorkshop={nextSection}
        onViewResearch={() => goToSection("research")}
      />

      {/* Minecraft-style Return to Hub Action when in Mars Environment */}
      {isMarsVisible && !isLoading && (
        <div
          style={{
            position: "fixed",
            bottom: "36px",
            left: "36px",
            zIndex: 45,
            pointerEvents: "auto",
            animation: "returnHubFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          <button
            type="button"
            className="pixel-btn"
            onClick={() => goToSection("home")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 18px",
              fontSize: "11px",
              letterSpacing: "1px",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "13px" }}>◀</span>
            <span>RETURN TO HUB</span>
          </button>
        </div>
      )}

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

      <style>{`
        @keyframes returnHubFadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default App;
