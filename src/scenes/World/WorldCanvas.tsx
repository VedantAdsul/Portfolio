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
import { WorldFallback } from "./WorldFallback";
import { CameraRig, DEFAULT_CAMERA_FOV } from "./CameraRig";

export interface WorldCanvasProps {
  onCreated?: () => void;
  onSceneReady?: () => void;
  onError?: (error: Error) => void;
  enableOrbitControls?: boolean;
  isJourneyActive?: boolean;
  fov?: number;
  onJourneyProgress?: (progress: number) => void;
  onJourneyComplete?: () => void;
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
          <Suspense fallback={<WorldFallback />}>
            <VillageScene />
            <CameraRig
              active={isJourneyActive}
              onProgress={onJourneyProgress}
              onComplete={onJourneyComplete}
            />
            <SceneReadyWatcher onReady={onSceneReady} />
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
