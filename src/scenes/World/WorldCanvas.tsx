/**
 * WorldCanvas Component
 *
 * Core WebGL viewport for VEDANT.EXE. Sets up the R3F Canvas, ACES filmic
 * tone mapping, PCF soft shadows, initial isometric perspective camera,
 * temporary development OrbitControls, and modular environment/world scenes.
 */

import { Component, type ReactNode, Suspense, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldEnvironment } from "./WorldEnvironment";
import { VillageScene } from "./VillageScene";
import { HubScene } from "./HubScene";
import { WormholeScene } from "./WormholeScene";
import { WormholeBloom } from "./WormholeBloom";
import { ResearchScene } from "./ResearchScene";
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
  isVillageVisible?: boolean;
  isHubVisible?: boolean;
  hubOpacity?: number;
  onHubVisibilityChange?: (visible: boolean) => void;
  onHubFadeChange?: (fade: number) => void;
  onAtHubRestingChange?: (atResting: boolean) => void;
  onScrollDownAtHub?: () => void;
  activeSection?: SectionId;
  onNavigateSection?: (section: SectionId) => void;
  isWormholeVisible?: boolean;
  isMarsVisible?: boolean;
  onMarsVisibilityChange?: (visible: boolean) => void;
  onTeleportToMars?: () => void;
  onAtMarsRestingChange?: (atResting: boolean) => void;
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
  isVillageVisible = true,
  isHubVisible = false,
  onHubVisibilityChange,
  onHubFadeChange,
  onAtHubRestingChange,
  onScrollDownAtHub,
  activeSection = "home",
  onNavigateSection,
  isWormholeVisible = true,
  isMarsVisible = false,
  onTeleportToMars,
  onAtMarsRestingChange,
}: WorldCanvasProps) {
  const [marsPathAlignment, setMarsPathAlignment] = useState<{
    start: THREE.Vector3;
    tangent: THREE.Vector3;
  } | null>(null);
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
          preserveDrawingBuffer: true,
        }}
        dpr={[1, 1.5]}
        shadows={{ type: THREE.PCFSoftShadowMap }}
        onCreated={(state) => {
          if (typeof window !== "undefined") {
            (window as unknown as { __THREE_SCENE__: THREE.Scene }).__THREE_SCENE__ =
              state.scene;
            (window as unknown as { __THREE_CAMERA__: THREE.Camera }).__THREE_CAMERA__ =
              state.camera;
            (window as unknown as { __THREE_GL__: THREE.WebGLRenderer }).__THREE_GL__ =
              state.gl;
            (window as unknown as { __THREE__: typeof THREE }).__THREE__ = THREE;
          }
          onCreated?.();
        }}
      >
        {/* Atmosphere, lighting, depth fog */}
        <WorldEnvironment />

        {/* Async loaded voxel world with ErrorBoundary and Suspense */}
        <SceneErrorBoundary onError={onError}>
          {/* Primary Suspense boundary: Village and CameraRig load and render first */}
          <Suspense fallback={<WorldFallback />}>
            <VillageScene visible={isVillageVisible} />
            <CameraRig
              active={isJourneyActive}
              onProgress={onJourneyProgress}
              onComplete={onJourneyComplete}
              onHubVisibilityChange={onHubVisibilityChange}
              onHubFadeChange={onHubFadeChange}
              onAtHubRestingChange={onAtHubRestingChange}
              onScrollDownAtHub={onScrollDownAtHub}
              activeSection={activeSection}
              onNavigateSection={onNavigateSection}
              onMarsPathReady={setMarsPathAlignment}
              onTeleportToMars={onTeleportToMars}
              onAtMarsRestingChange={onAtMarsRestingChange}
            />
            <SceneReadyWatcher onReady={onSceneReady} />
          </Suspense>

          {/* Preloaded HubScene mounted in its own independent Suspense.
              Loads in advance in the background without blocking initial Village render.
              Remains mounted in the Three.js scene graph with visible={isHubVisible}
              and smoothly fades in from Boat_Visibility to Hub_Resting via opacity prop. */}
          <Suspense fallback={null}>
            <HubScene visible={isHubVisible && !isMarsVisible} />
          </Suspense>

          {/* Preloaded WormholeScene mounted in its own independent Suspense.
              Loads wormhole.glb and runs vortex rotation animations.
              Village Hub rig is positioned at the hallway exit; Mars rig aligns with Mars path. */}
          <Suspense fallback={null}>
            <WormholeScene
              visible={isWormholeVisible}
              hubRigVisible={isWormholeVisible && !isMarsVisible}
              marsRigVisible={isMarsVisible}
              marsPathStart={marsPathAlignment?.start}
              marsPathTangent={marsPathAlignment?.tangent}
            />
          </Suspense>

          {/* High-performance post-processing bloom pipeline kept active continuously.
              Ensures constant tone mapping, color management, and exposure throughout the entire journey,
              completely eliminating pipeline-switch hitches or exposure jumps when reaching Hub Resting. */}
          <WormholeBloom enabled={true} />

          {/* Preloaded ResearchScene (Mars Station) mounted in its own independent Suspense.
              Geometry, textures, and shaders are resident in GPU memory before teleportation.
              Remains invisible (visible={false}) throughout the village journey so it
              consumes zero draw calls and cannot be seen behind the village terrain. */}
          <Suspense fallback={null}>
            <ResearchScene visible={isMarsVisible} />
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
