/**
 * WorldCanvas Component
 *
 * Core WebGL viewport for VEDANT.EXE. Sets up the R3F Canvas, ACES filmic
 * tone mapping, PCF soft shadows, initial isometric perspective camera,
 * temporary development OrbitControls, and modular environment/world scenes.
 */

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { WorldEnvironment } from "./WorldEnvironment";
import { VillageScene } from "./VillageScene";
import { WorldFallback } from "./WorldFallback";

export interface WorldCanvasProps {
  onCreated?: () => void;
  onSceneReady?: () => void;
  enableOrbitControls?: boolean;
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
  enableOrbitControls = true,
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
          position: [60, 55, 75],
          fov: 45,
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

        {/* Async loaded voxel world within Suspense boundary */}
        <Suspense fallback={<WorldFallback />}>
          <VillageScene />
          <SceneReadyWatcher onReady={onSceneReady} />
        </Suspense>

        {/* Temporary OrbitControls for development inspection */}
        {enableOrbitControls && (
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
