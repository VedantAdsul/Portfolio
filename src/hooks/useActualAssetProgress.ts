/**
 * useActualAssetProgress Hook
 *
 * Synchronizes loading screen progression with REAL asset and subsystem readiness:
 * - DOM & document.readyState (25%)
 * - Web fonts ready state (50%)
 * - Three.js WebGL canvas context creation (70%)
 * - Drei asset manager download & decoding (70% - 95%)
 * - Real 3D scene mount and first frame rendered (100%)
 *
 * Never uses fake random timers. Advances strictly upon real subsystem milestones.
 * Guarantees progress only reaches 100% when the 3D village scene is actually rendered.
 */

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

export interface UseActualAssetProgressOptions {
  isCanvasReady?: boolean;
  isSceneReady?: boolean;
  onComplete?: () => void;
}

export interface UseActualAssetProgressResult {
  progress: number;
  statusText: string;
  error: string | null;
}

export function useActualAssetProgress({
  isCanvasReady = false,
  isSceneReady = false,
  onComplete,
}: UseActualAssetProgressOptions = {}): UseActualAssetProgressResult {
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);
  const hasCompletedRef = useRef<boolean>(false);
  const onCompleteRef = useRef(onComplete);
  const { progress: dreiProgress, total, active, errors } = useProgress();

  // Keep onComplete ref up-to-date without triggering effect resets
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Track font readiness (Mojangles, Minecraftia, Press Start 2P)
  useEffect(() => {
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(() => {
        setFontsLoaded(true);
      });
    } else {
      const timer = window.setTimeout(() => {
        setFontsLoaded(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // Compute actual progress directly during render based on real subsystem readiness
  let computedProgress = 0;

  if (
    typeof document !== "undefined" &&
    (document.readyState === "complete" || document.readyState === "interactive")
  ) {
    computedProgress = Math.max(computedProgress, 25);
  }

  if (fontsLoaded) {
    computedProgress = Math.max(computedProgress, 50);
  }

  if (isCanvasReady) {
    computedProgress = Math.max(computedProgress, 70);
  }

  if (total > 0) {
    // Drei is tracking GLB assets: scale 70% -> 95% while downloading and decompressing
    const assetSlice = Math.round((dreiProgress / 100) * 25);
    computedProgress = Math.max(computedProgress, 70 + assetSlice);
    // If Drei manager completed loading assets
    if (!active && dreiProgress >= 100) {
      computedProgress = Math.max(computedProgress, 95);
    }
  }

  // CRITICAL: 100% is only declared when the 3D scene has mounted and rendered its first frame
  if (isSceneReady && fontsLoaded && isCanvasReady) {
    computedProgress = 100;
  } else {
    // Cap at 95% while waiting for 3D scene to mount and render
    computedProgress = Math.min(computedProgress, 95);
  }

  // Determine authentic Minecraft-style loading status description reflecting actual stages
  let statusText = "Generating terrain...";
  if (computedProgress >= 100) {
    statusText = "World ready.";
  } else if (computedProgress >= 90) {
    statusText = "Preparing the world...";
  } else if (computedProgress >= 75) {
    statusText = "Filling waterways...";
  } else if (computedProgress >= 50) {
    statusText = "Growing vegetation...";
  } else if (computedProgress >= 25) {
    statusText = "Loading stone structures...";
  }

  // Handle completion transition once 100% is reached
  useEffect(() => {
    if (computedProgress >= 100 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      const timer = window.setTimeout(() => {
        onCompleteRef.current?.();
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [computedProgress]);

  const activeError = errors && errors.length > 0 ? errors[0] : null;

  return {
    progress: computedProgress,
    statusText,
    error: activeError,
  };
}

export default useActualAssetProgress;
