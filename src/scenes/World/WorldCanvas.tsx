/**
 * WorldCanvas Component
 *
 * Core WebGL viewport for VEDANT.EXE. Sets up the R3F Canvas, ACES filmic
 * tone mapping, PCF soft shadows, initial isometric perspective camera,
 * temporary development OrbitControls, and modular environment/world scenes.
 */

import { Component, type ReactNode, Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldEnvironment } from "./WorldEnvironment";
import { VillageScene } from "./VillageScene";
import { HubScene } from "./HubScene";
import { WorldFallback } from "./WorldFallback";
import { CameraRig, DEFAULT_CAMERA_FOV } from "./CameraRig";
import type { SectionId } from "../../data/sections";

export interface WorldCanvasProps {
  onCreated?: () => void;
  onSceneReady?: () => void;
  onError?: (error: Error) => void;
  enableOrbitControls?: boolean;
  isJourneyActive?: boolean;
  fov?: number;
  onJourneyProgress?: (progress: number) => void;
  onJourneyComplete?: () => void;
  isHubVisible?: boolean;
  onHubVisibilityChange?: (visible: boolean) => void;
  onAtHubRestingChange?: (atResting: boolean) => void;
  onScrollDownAtHub?: () => void;
  activeSection?: SectionId;
  onNavigateSection?: (section: SectionId) => void;
}

interface SceneErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
}

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * Ensures Suspense has resolved and at least one WebGL frame has rendered
 * with the village geometry before notifying the application.
 */
function SceneReadyWatcher({ onReady }: { onReady?: () => void }) {
  const hasNotified = useRef(false);

  useFrame(() => {
    if (!hasNotified.current) {
      hasNotified.current = true;
      onReady?.();
    }
  });

  return null;
}

export function WorldCanvas({
  onCreated,
  onSceneReady,
  onError,
  enableOrbitControls = true,
  isJourneyActive = false,
  fov = DEFAULT_CAMERA_FOV,
  onJourneyProgress,
  onJourneyComplete,
  isHubVisible = false,
  onHubVisibilityChange,
  onAtHubRestingChange,
  onScrollDownAtHub,
  activeSection = "home",
  onNavigateSection,
}: WorldCanvasProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
      }}
    >
      <Canvas
        camera={{
          position: [153.54, 56.7, -59.33],
          fov,
          near: 0.5,
          far: 2000,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        dpr={[1, 1.5]}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        onCreated={() => {
          onCreated?.();
        }}
      >
        {/* Atmosphere, lighting, depth fog */}
        <WorldEnvironment />

        {/* Async loaded voxel world with ErrorBoundary and Suspense */}
        <SceneErrorBoundary onError={onError}>
          {/* Primary Suspense boundary: Village and CameraRig load and render first */}
          <Suspense fallback={<WorldFallback />}>
            <VillageScene />
            <CameraRig
              active={isJourneyActive}
              onProgress={onJourneyProgress}
              onComplete={onJourneyComplete}
              onHubVisibilityChange={onHubVisibilityChange}
              onAtHubRestingChange={onAtHubRestingChange}
              onScrollDownAtHub={onScrollDownAtHub}
              activeSection={activeSection}
              onNavigateSection={onNavigateSection}
            />
            <SceneReadyWatcher onReady={onSceneReady} />
          </Suspense>

          {/* Preloaded HubScene mounted in its own independent Suspense.
              Loads in advance in the background without blocking initial Village render.
              Remains mounted in the Three.js scene graph with visible={isHubVisible}
              so visibility toggles instantaneously at the boat marker with zero re-decoding. */}
          <Suspense fallback={null}>
            <HubScene visible={isHubVisible} />
          </Suspense>
        </SceneErrorBoundary>

        {/* OrbitControls enabled only when not on guided cinematic travel */}
        {enableOrbitControls && !isJourneyActive && (
          <OrbitControls
            target={[0, 28, 0]}
            enableDamping
            dampingFactor={0.05}
            maxDistance={900}
            minDistance={5}
            maxPolarAngle={Math.PI / 2 + 0.05}
          />
        )}
      </Canvas>
    </div>
  );
}

export default WorldCanvas;
