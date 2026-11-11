/**
 * CameraRig Component
 *
 * Implements guided cinematic camera choreography along the Blender-exported
 * Bezier route (Camera_Path_Main).
 *
 * Traversal is reversed to match the intended journey:
 * Mountain (endpoint u=1.0) -> Village -> Docks -> Hub (endpoint u=0.0).
 *
 * Refinements:
 * 1. Slow, majestic default travel speed (~54s base journey).
 * 2. Downward scroll acceleration with bounded speed-scale and smooth GSAP deceleration.
 * 3. Subtle horizontal mouse look parallax without altering curve position or roll.
 * 4. Adjustable camera FOV (increased from 45 to 52 degrees).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

export const CAMERA_PATH_URL = "/assets/world/camera_path.glb";
export const DEFAULT_CAMERA_FOV = 52;
export const DEFAULT_BASE_DURATION = 54;
export const DEFAULT_MAX_SPEED_SCALE = 2.8;
export const DEFAULT_MOUSE_INFLUENCE = 0.16;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

export interface CameraRigProps {
  /** Whether the guided camera journey is currently active */
  active?: boolean;
  /** Journey animation duration at default base speed in seconds (default: 54) */
  duration?: number;
  /** Maximum speed scale factor achievable via scroll down (default: 2.8) */
  maxSpeedMultiplier?: number;
  /** Subtle horizontal mouse look influence (default: 0.16) */
  mouseInfluence?: number;
  /** Called on every animation tick with normalized journey progress [0, 1] */
  onProgress?: (progress: number) => void;
  /** Called when the camera arrives at the Hub destination */
  onComplete?: () => void;
  /** Diagnostic callback reporting whether raw vertex geometry was present in GLB */
  onDiagnostic?: (diagnostic: {
    hasVertices: boolean;
    vertexCount: number;
    nodeName: string;
    isFallback: boolean;
  }) => void;
}

/**
 * Extracts ordered world-space path points from a glTF scene object.
 * Returns empty array if the node has no line/mesh vertex geometry.
 */
function extractPathPoints(scene: THREE.Group): {
  points: THREE.Vector3[];
  nodeName: string;
} {
  const points: THREE.Vector3[] = [];
  let foundNodeName = "";

  scene.updateMatrixWorld(true);

  scene.traverse((child) => {
    const isTargetName =
      child.name.toLowerCase().includes("camera_path") ||
      child.name.toLowerCase().includes("path");

    if (isTargetName && !foundNodeName) {
      foundNodeName = child.name;
    }

    const meshOrLine = child as THREE.Mesh | THREE.Line;
    if (meshOrLine.geometry && meshOrLine.geometry.attributes?.position) {
      const posAttr = meshOrLine.geometry.attributes.position;
      child.updateMatrixWorld(true);
      for (let i = 0; i < posAttr.count; i++) {
        const pt = new THREE.Vector3().fromBufferAttribute(posAttr, i);
        pt.applyMatrix4(child.matrixWorld);
        points.push(pt);
      }
    }
  });

  return { points, nodeName: foundNodeName || "Camera_Path_Main" };
}

/**
 * Baseline trajectory connecting the Mountain origin to Hub.
 * Used only as a fallback if the GLB lacks vertex geometry.
 */
function createBaselineCurve(): THREE.CatmullRomCurve3 {
  const hubEndpoint = new THREE.Vector3(0, 28, 0); // u = 0.0 (Destination)
  const docksApproach = new THREE.Vector3(-15, 32, -10);
  const villageStreet = new THREE.Vector3(22, 40, -5);
  const villageOverlook = new THREE.Vector3(50, 56, 12);
  const mountainRidge = new THREE.Vector3(80, 82, 22);
  const mountainPeak = new THREE.Vector3(153.54, 56.7, -59.33); // u = 1.0 (Mountain peak)

  return new THREE.CatmullRomCurve3(
    [
      hubEndpoint,
      docksApproach,
      villageStreet,
      villageOverlook,
      mountainRidge,
      mountainPeak,
    ],
    false,
    "centripetal"
  );
}

export function CameraRig({
  active = true,
  duration = DEFAULT_BASE_DURATION,
  maxSpeedMultiplier = DEFAULT_MAX_SPEED_SCALE,
  mouseInfluence = DEFAULT_MOUSE_INFLUENCE,
  onProgress,
  onComplete,
  onDiagnostic,
}: CameraRigProps) {
  const { camera } = useThree();
  const gltf = useGLTF(CAMERA_PATH_URL);

  // Animated journey progress: 0.0 = Mountain (start), 1.0 = Hub (finish)
  const progressRef = useRef<{ value: number }>({ value: 0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const currentSpeedScaleRef = useRef<number>(1.0);
  const decelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mouse interaction state (horizontal NDC: -1.0 to +1.0)
  const rawMouseXRef = useRef<number>(0);
  const smoothedMouseXRef = useRef<number>(0);

  // Damped look-at target vector to eliminate micro-jitter
  const smoothedTargetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 28, 0));
  const isInitializedRef = useRef<boolean>(false);

  // Reconstruct curve from GLB geometry or baseline fallback
  const { curve, isFallback, vertexCount, nodeName } = useMemo(() => {
    const { points, nodeName: extractedName } = extractPathPoints(gltf.scene);

    if (points.length >= 2) {
      return {
        curve: new THREE.CatmullRomCurve3(points, false, "centripetal"),
        isFallback: false,
        vertexCount: points.length,
        nodeName: extractedName,
      };
    }

    return {
      curve: createBaselineCurve(),
      isFallback: true,
      vertexCount: 0,
      nodeName: extractedName,
    };
  }, [gltf.scene]);

  // Report diagnostic to parent and console
  useEffect(() => {
    onDiagnostic?.({
      hasVertices: !isFallback,
      vertexCount,
      nodeName,
      isFallback,
    });
  }, [isFallback, vertexCount, nodeName, onDiagnostic]);

  /**
   * Evaluates camera position and look-at target for a given journey progress.
   * Traversal is reversed:
   * Journey progress s = 0 -> Curve parameter u = 1.0 (Mountain)
   * Journey progress s = 1 -> Curve parameter u = 0.0 (Hub)
   */
  const evaluateJourney = useCallback(
    (journeyProgress: number) => {
      const clamped = Math.max(0, Math.min(1, journeyProgress));
      // Reverse parameter: 1.0 at start (Mountain), 0.0 at finish (Hub)
      const u = 1.0 - clamped;

      // 1. Position camera precisely on the curve
      const currentPos = curve.getPointAt(u);
      camera.position.copy(currentPos);

      // 2. Compute forward travel velocity vector along reversed journey
      const tangent = curve.getTangentAt(u);
      const forward = tangent.clone().negate().normalize();

      // 3. Compute base look-ahead target along curve
      const lookAheadDelta = 0.02; // Sample 2% ahead along journey
      const uAhead = Math.max(0, u - lookAheadDelta);
      let target = curve.getPointAt(uAhead);

      // At destination endpoint, extrapolate forward to look straight into Hub
      if (u <= 0.005) {
        target = currentPos.clone().addScaledVector(forward, 15);
      }

      // 4. Subtle horizontal mouse look influence (lateral parallax)
      // Local lateral right vector perpendicular to forward direction and world-up
      const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
      const lookDist = Math.max(8, currentPos.distanceTo(target));
      const lateralOffset = right.multiplyScalar(
        smoothedMouseXRef.current * mouseInfluence * lookDist
      );
      target = target.clone().add(lateralOffset);

      // 5. Constrain world-up to prevent gimbal roll and upside-down flips
      camera.up.copy(WORLD_UP);

      if (!isInitializedRef.current) {
        smoothedTargetRef.current.copy(target);
        isInitializedRef.current = true;
      } else {
        // Damped target interpolation for smooth, cinematic panning
        smoothedTargetRef.current.lerp(target, 0.16);
      }

      camera.lookAt(smoothedTargetRef.current);
    },
    [camera, curve, mouseInfluence]
  );

  // Position camera at Mountain endpoint on mount or when inactive
  useEffect(() => {
    if (!active) {
      evaluateJourney(0);
    }
  }, [active, evaluateJourney]);

  // Scroll down acceleration listener
  useEffect(() => {
    if (!active) return;

    const handleWheel = (e: WheelEvent) => {
      // Only downward scrolling accelerates forward journey
      if (e.deltaY > 0) {
        const deltaBoost = Math.min(Math.abs(e.deltaY), 100) * 0.008;
        currentSpeedScaleRef.current = Math.min(
          maxSpeedMultiplier,
          currentSpeedScaleRef.current + deltaBoost
        );

        if (tweenRef.current) {
          gsap.to(tweenRef.current, {
            timeScale: currentSpeedScaleRef.current,
            duration: 0.35,
            ease: "power1.out",
            overwrite: "auto",
          });
        }

        if (decelTimeoutRef.current) {
          clearTimeout(decelTimeoutRef.current);
        }

        // When scrolling stops, smoothly ease back to default slow speed
        decelTimeoutRef.current = setTimeout(() => {
          currentSpeedScaleRef.current = 1.0;
          if (tweenRef.current) {
            gsap.to(tweenRef.current, {
              timeScale: 1.0,
              duration: 1.6,
              ease: "power2.out",
              overwrite: "auto",
            });
          }
        }, 180);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }
    };
  }, [active, maxSpeedMultiplier]);

  // Subtle horizontal mouse movement tracking
  useEffect(() => {
    if (!active) return;

    const handlePointerMove = (e: PointerEvent) => {
      // Normalized device coordinates: -1.0 (left edge) to +1.0 (right edge)
      rawMouseXRef.current = (e.clientX / window.innerWidth) * 2 - 1;
    };

    const handlePointerLeave = () => {
      // Smoothly recenter when pointer leaves the window
      rawMouseXRef.current = 0;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("mouseleave", handlePointerLeave);
      rawMouseXRef.current = 0;
    };
  }, [active]);

  // GSAP animation context for clean unmounting
  useEffect(() => {
    if (!active) return;

    progressRef.current.value = 0;
    currentSpeedScaleRef.current = 1.0;
    isInitializedRef.current = false;
    evaluateJourney(0);

    const ctx = gsap.context(() => {
      const tween = gsap.to(progressRef.current, {
        value: 1,
        duration,
        ease: "none", // Linear base rate for constant cinematic travel
        onUpdate: () => {
          const val = progressRef.current.value;
          evaluateJourney(val);
          onProgress?.(val);
        },
        onComplete: () => {
          evaluateJourney(1);
          onProgress?.(1);
          onComplete?.();
        },
      });

      tweenRef.current = tween;
    });

    return () => {
      ctx.revert();
      tweenRef.current = null;
    };
  }, [active, duration, evaluateJourney, onProgress, onComplete]);

  // Continuous frame loop for smooth mouse damping & look orientation
  useFrame((_, delta) => {
    if (active) {
      // Smoothly interpolate mouse parallax offset
      smoothedMouseXRef.current = THREE.MathUtils.damp(
        smoothedMouseXRef.current,
        rawMouseXRef.current,
        4.0,
        delta
      );
      evaluateJourney(progressRef.current.value);
    }
  });

  return null;
}

// Preload the camera path asset
useGLTF.preload(CAMERA_PATH_URL);

export default CameraRig;
