import { useEffect, useState } from "react";
import { Navigation } from "./components/Navigation/Navigation";
import { LoadingScreen } from "./components/LoadingScreen/LoadingScreen";
import { WorldCanvas } from "./scenes/World/WorldCanvas";
import { useSectionNavigation } from "./hooks/useSectionNavigation";
import { useActualAssetProgress } from "./hooks/useActualAssetProgress";
import { PixelUIPreview } from "./components/PixelUI/PixelUIPreview";

function getSectionDescription(id: string): string {
  switch (id) {
    case "home":
      return "Central Hub — A connected voxel world blending physical and digital systems.";
    case "project-geofence":
      return "GeoFence — Pet tracking and virtual fencing hardware-software solution.";
    case "project-Evilog":
      return "EviLog — Low-cost, hardware-assisted evidence tracking and digital chain-of-custody.";
    case "project-safepath":
      return "SafePath — Offline emergency assistant Android application for crisis scenarios.";
    case "research":
      return "Research Wing — Technical skills, academic education, hardware prototyping, and experience.";
    case "return":
      return "Return Path — Direct communication channels, collaboration, and journey loop.";
    default:
      return "";
  }
}

export function App() {
  const [isCanvasReady, setIsCanvasReady] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showPreview, setShowPreview] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.location.search.includes("preview") : false
  );

  // Synchronized with real DOM, font, WebGL, and Drei asset loading progress
  const { progress } = useActualAssetProgress({
    isCanvasReady,
    onComplete: () => setIsLoading(false),
  });

  const {
    activeSection,
    currentIndex,
    totalSections,
    goToSection,
    nextSection,
    prevSection,
    isTransitioning,
  } = useSectionNavigation();

  // Task 2: Global scroll navigation integration with transition locking
  useEffect(() => {
    if (isLoading || showPreview) return;

    const handleWheel = (event: WheelEvent) => {
      // Ignore tiny trackpad drift
      if (Math.abs(event.deltaY) < 25) return;

      // Crucial constraint: Check navigation transition lock to prevent overlapping transitions
      if (isTransitioning.current) return;

      if (event.deltaY > 0) {
        nextSection();
      } else if (event.deltaY < 0) {
        prevSection();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isLoading, showPreview, isTransitioning, nextSection, prevSection]);

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
      {/* Background Layer: 3D World Canvas (pointer-events: none) */}
      <WorldCanvas onCreated={() => setIsCanvasReady(true)} />

      {/* UI Layer: Permanent Brand Header */}
      <header
        style={{
          position: "fixed",
          top: "24px",
          left: "32px",
          zIndex: 40,
          pointerEvents: "auto",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "14px",
            letterSpacing: "2px",
            fontWeight: 700,
            color: "var(--color-sage)",
            textTransform: "uppercase",
          }}
        >
          VEDANT.EXE
        </span>
      </header>

      {/* UI Layer: Fixed Navigation HUD */}
      <Navigation activeId={activeSection.id} onNavigate={goToSection} />

      {/* UI Layer: Active Section Dynamic Content */}
      <main
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            maxWidth: "640px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "3px",
              color: "var(--color-sage)",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            {`Sector ${currentIndex + 1} of ${totalSections}`}
          </p>
          <h1
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              color: "var(--color-parchment)",
              textTransform: "uppercase",
              letterSpacing: "2px",
              margin: "0 0 16px 0",
            }}
          >
            {activeSection.label}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "15px",
              color: "var(--color-sage)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            {getSectionDescription(activeSection.id)}
          </p>
        </div>
      </main>

      {/* Isolated UI Preview Trigger */}
      <div
        style={{
          position: "fixed",
          bottom: "16px",
          right: "24px",
          zIndex: 40,
        }}
      >
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            letterSpacing: "1px",
            padding: "6px 12px",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            color: "var(--color-sage)",
            border: "1px solid var(--color-sage)",
            cursor: "pointer",
          }}
        >
          [PREVIEW PIXEL UI]
        </button>
      </div>

      {/* Initialization Flow: Minecraft-style Loading Screen with real asset synchronization */}
      {isLoading && <LoadingScreen progress={progress} />}

      {/* Isolated Component Preview Modal */}
      {showPreview && <PixelUIPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}

export default App;
