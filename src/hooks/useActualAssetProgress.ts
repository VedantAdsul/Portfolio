/**
 * useActualAssetProgress Hook
 *
 * Synchronizes loading screen progression with REAL asset and subsystem readiness:
 * - DOM & document.readyState
 * - Web fonts ready state (document.fonts.ready for Press Start 2P & Inter)
 * - Three.js WebGL canvas context creation & first render
 * - Drei asset manager (textures, models) via useProgress
 *
 * Never uses fake random timers. Advances strictly upon real subsystem milestones.
 */

import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";

export interface UseActualAssetProgressOptions {
  isCanvasReady?: boolean;
  onComplete?: () => void;
}

export function useActualAssetProgress({
  isCanvasReady = false,
  onComplete,
}: UseActualAssetProgressOptions = {}) {
  const [fontsLoaded, setFontsLoaded] = useState<boolean>(false);
  const hasCompletedRef = useRef<boolean>(false);
  const { progress: dreiProgress, total } = useProgress();

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

  // Compute actual progress directly during render without cascading state updates
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
    computedProgress = Math.max(computedProgress, 75);
  }
  if (total > 0) {
    computedProgress = Math.min(
      100,
      Math.max(computedProgress, Math.round(75 + (dreiProgress / 100) * 25))
    );
  } else if (isCanvasReady && fontsLoaded) {
    computedProgress = 100;
  }

  useEffect(() => {
    if (computedProgress >= 100 && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      const timer = window.setTimeout(() => {
        onComplete?.();
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, [computedProgress, onComplete]);

  return { progress: computedProgress };
}

export default useActualAssetProgress;
