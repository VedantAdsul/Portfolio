/**
 * CameraRig Component
 *
 * Implements the guided cinematic camera journey for VEDANT.EXE connecting
 * the Mountain peak origin through the Village to the Central Hub destination.
 *
 * Traversal Journey:
 * Mountain Peak (u=1.0, progress=0.0) -> Village -> Docks ->
 * Boat Visibility marker (crossing triggers Hub visibility) ->
 * Hub Resting marker (u=0.0, progress=1.0) -> Looks toward Camera Pointer.
 *
 * Features:
 * 1. Autonomous continuous forward movement at default cinematic speed (~55s).
 * 2. Full bidirectional scroll velocity control:
 *    - Scroll DOWN: Accelerates forward movement smoothly up to max forward speed.
 *    - Scroll UP: Reverses movement backwards along the exact same path while
 *      maintaining the forward-facing orientation along the path.
 *    - Scroll RELEASE: Smoothly decelerates back to autonomous forward movement via GSAP.
 * 3. Blender Marker Integration:
 *    - Reads named Empty objects (`Boat Visibility`, `Hub Resting`, `Camera Pointer`, `Next Area`)
 *      directly from `camera_path.glb`.
 *    - Triggers Hub visibility when crossing `Boat Visibility`.
 *    - Smoothly settles and pauses autonomous movement at `Hub Resting`.
 *    - Smoothly blends orientation to look toward `Camera Pointer` without snapping.
 * 4. Section Navigation:
 *    - Scrolling down at `Hub Resting` triggers transition toward the next area.
 *    - Scrolling up returns to `Hub Resting`.
 *    - Unified transition system for navigation buttons and wheel events with debouncing.
 * 5. Horizontal mouse look interaction (~30 degrees max yaw rotation)
 *    with smooth damping, roll prevention, and automatic recentering.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";
import {
  HUB_DEPARTURE_PATH_POINTS,
  TRACED_CAMERA_PATH_POINTS,
} from "../../data/cameraPathPoints";
import type { SectionId } from "../../data/sections";

export const CAMERA_PATH_URL = "/assets/world/camera_path.glb";
export const DEFAULT_CAMERA_FOV = 58;
export const DEFAULT_BASE_DURATION = 55;
export const DEFAULT_MAX_FORWARD_BOOST = 0.055;
export const DEFAULT_MAX_REVERSE_SPEED = 0.045;
export const DEFAULT_MAX_MOUSE_ANGLE = 0.52; // ~29.8 degrees max yaw

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Default coordinates directly from Blender world coordinates
const FALLBACK_BOAT_VISIBILITY = new THREE.Vector3(-159.7057, 9.8877, -14.1756);
const FALLBACK_HUB_RESTING = new THREE.Vector3(-274.015, 15.7716, -19.552);
const FALLBACK_CAMERA_POINTER = new THREE.Vector3(-296.2811, 28.9538, -4.1265);
const FALLBACK_NEXT_AREA = new THREE.Vector3(-383.8439, 24.4108, -23.0299);

export interface BlenderMarkers {
  boatVisibility: THREE.Vector3;
  hubResting: THREE.Vector3;
  cameraPointer: THREE.Vector3;
  nextArea: THREE.Vector3 | null;
  found: {
    boatVisibility: boolean;
    hubResting: boolean;
    cameraPointer: boolean;
    nextArea: boolean;
  };
}

export interface CameraRigProps {
  /** Whether the guided camera journey is currently active */
  active?: boolean;
  /** Journey animation duration at default base speed in seconds (default: 55) */
  baseDuration?: number;
  /** Maximum forward velocity boost achievable via scroll down (default: 0.055) */
  maxForwardBoost?: number;
  /** Maximum reverse velocity achievable via scroll up (default: 0.045) */
  maxReverseSpeed?: number;
  /** Maximum horizontal mouse look angle in radians (default: 0.52, ~30 degrees) */
  maxMouseAngle?: number;
  /** Called on every frame tick with normalized journey progress [0, 1] */
  onProgress?: (progress: number) => void;
  /** Called when the camera arrives at the Hub destination */
  onComplete?: () => void;
  /** Called when the camera crosses Boat Visibility to toggle Hub visibility */
  onHubVisibilityChange?: (visible: boolean) => void;
  /** Called when camera settles at Hub Resting or leaves it */
  onAtHubRestingChange?: (atResting: boolean) => void;
  /** Called when user scrolls down from Hub Resting to trigger transition to next area */
  onScrollDownAtHub?: () => void;
  /** Currently active section (for unified section navigation) */
  activeSection?: SectionId;
  /** Callback to request navigation to a section */
  onNavigateSection?: (section: SectionId) => void;
  /** Diagnostic callback reporting whether markers and raw geometry were present */
  onDiagnostic?: (diagnostic: {
    hasVertices: boolean;
    vertexCount: number;
    nodeName: string;
    isFallback: boolean;
    markers: {
      boatVisibility: boolean;
      hubResting: boolean;
      cameraPointer: boolean;
      nextArea: boolean;
    };
  }) => void;
}

/**
 * Extracts named Empty positional markers from the Blender glTF scene.
 */
function extractMarkers(scene: THREE.Group): BlenderMarkers {
  let boatVisibility: THREE.Vector3 | null = null;
  let hubResting: THREE.Vector3 | null = null;
  let cameraPointer: THREE.Vector3 | null = null;
  let nextArea: THREE.Vector3 | null = null;

  scene.updateMatrixWorld(true);

  scene.traverse((child) => {
    const cleanName = child.name.replace(/_/g, " ").toLowerCase().trim();
    if (cleanName === "boat visibility" || cleanName.includes("boat visibility")) {
      boatVisibility = new THREE.Vector3();
      child.getWorldPosition(boatVisibility);
    } else if (cleanName === "hub resting" || cleanName.includes("hub resting")) {
      hubResting = new THREE.Vector3();
      child.getWorldPosition(hubResting);
    } else if (cleanName === "camera pointer" || cleanName.includes("camera pointer")) {
      cameraPointer = new THREE.Vector3();
      child.getWorldPosition(cameraPointer);
    } else if (cleanName === "next area" || cleanName.includes("next area")) {
      nextArea = new THREE.Vector3();
      child.getWorldPosition(nextArea);
    }
  });

  return {
    boatVisibility: boatVisibility ?? FALLBACK_BOAT_VISIBILITY.clone(),
    hubResting: hubResting ?? FALLBACK_HUB_RESTING.clone(),
    cameraPointer: cameraPointer ?? FALLBACK_CAMERA_POINTER.clone(),
    nextArea: nextArea ?? FALLBACK_NEXT_AREA.clone(),
    found: {
      boatVisibility: boatVisibility !== null,
      hubResting: hubResting !== null,
      cameraPointer: cameraPointer !== null,
      nextArea: nextArea !== null,
    },
  };
}

/**
 * Extracts ordered world-space path points from a glTF scene object if present.
 * Returns:
 * 1. journeyPoints: Mountain Peak -> Village -> Docks -> Water -> Hub Resting
 * 2. departurePoints: Hub Resting -> Hallway -> Archway -> Next Area (Workshop)
 */
function extractPathPoints(
  scene: THREE.Group,
  hubRestingPos: THREE.Vector3,
  nextAreaPos: THREE.Vector3
): {
  journeyPoints: THREE.Vector3[];
  departurePoints: THREE.Vector3[];
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

  if (points.length >= 70) {
    // Locate the point closest to Hub Resting along the village-to-hub sequence
    let bestHubIdx = -1;
    let minHubDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = points[i].distanceTo(hubRestingPos);
      if (d < minHubDist && i >= 50) {
        minHubDist = d;
        bestHubIdx = i;
      }
    }

    // Locate the point closest to Next Area (before Hub Resting in vertex order)
    let bestNextAreaIdx = -1;
    let minNextDist = Infinity;
    for (let i = 0; i < bestHubIdx; i++) {
      const d = points[i].distanceTo(nextAreaPos);
      if (d < minNextDist) {
        minNextDist = d;
        bestNextAreaIdx = i;
      }
    }

    if (bestHubIdx !== -1) {
      // The curve in camera_path.glb has Mountain Peak at the end of the vertex array
      // and Hub Resting at bestHubIdx (~67). Reverse to traverse from Mountain Peak -> Hub.
      const journey = points.slice(bestHubIdx, points.length).reverse();
      journey[journey.length - 1].copy(hubRestingPos);

      // Departure path from Hub Resting to Next Area (vertices 67 down to 42)
      let departure: THREE.Vector3[];
      if (bestNextAreaIdx !== -1 && bestNextAreaIdx < bestHubIdx) {
        departure = points.slice(bestNextAreaIdx, bestHubIdx + 1).reverse();
        departure[0].copy(hubRestingPos);
        departure[departure.length - 1].copy(nextAreaPos);
      } else {
        departure = HUB_DEPARTURE_PATH_POINTS.map(
          (p) => new THREE.Vector3(p[0], p[1], p[2])
        );
        departure[0].copy(hubRestingPos);
        departure[departure.length - 1].copy(nextAreaPos);
      }

      return {
        journeyPoints: journey,
        departurePoints: departure,
        nodeName: foundNodeName || "Camera_Path_Main",
      };
    }
  }

  // Fallback to verified pre-extracted vertices
  const fallbackJourney = TRACED_CAMERA_PATH_POINTS.map(
    (p) => new THREE.Vector3(p[0], p[1], p[2])
  );
  fallbackJourney[fallbackJourney.length - 1].copy(hubRestingPos);

  const fallbackDeparture = HUB_DEPARTURE_PATH_POINTS.map(
    (p) => new THREE.Vector3(p[0], p[1], p[2])
  );
  fallbackDeparture[0].copy(hubRestingPos);
  fallbackDeparture[fallbackDeparture.length - 1].copy(nextAreaPos);

  return {
    journeyPoints: fallbackJourney,
    departurePoints: fallbackDeparture,
    nodeName: foundNodeName || "Camera_Path_Main (fallback)",
  };
}

export function CameraRig({
  active = true,
  baseDuration = DEFAULT_BASE_DURATION,
  maxForwardBoost = DEFAULT_MAX_FORWARD_BOOST,
  maxReverseSpeed = DEFAULT_MAX_REVERSE_SPEED,
  maxMouseAngle = DEFAULT_MAX_MOUSE_ANGLE,
  onProgress,
  onComplete,
  onHubVisibilityChange,
  onAtHubRestingChange,
  onScrollDownAtHub,
  activeSection = "home",
  onNavigateSection,
  onDiagnostic,
}: CameraRigProps) {
  const { camera } = useThree();
  const gltf = useGLTF(CAMERA_PATH_URL);

  // Single continuous progress value along journey: 0.0 = Mountain, 1.0 = Hub Resting
  const progressRef = useRef<number>(0);
  const prevProgressRef = useRef<number>(0);

  // Hub visibility state and resting state
  const isHubVisibleRef = useRef<boolean>(false);
  const isAtHubRestingRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);

  // Departure sequence animation parameters:
  // departureAlign: 0 = looking at Camera Pointer; 1 = aligned with departure path forward tangent
  // departureTravel: 0 = at Hub Resting; 1 = at Next Area destination
  const departureAlignRef = useRef<{ value: number }>({ value: 0 });
  const departureTravelRef = useRef<{ value: number }>({ value: 0 });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const currentSectionRef = useRef<SectionId>(activeSection);

  // Velocity state animated via GSAP
  const velocityStateRef = useRef<{ scrollVelocity: number }>({
    scrollVelocity: 0,
  });
  const targetScrollVelocityRef = useRef<number>(0);
  const decelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mouse interaction state (normalized device coordinates: -1.0 to +1.0)
  const rawMouseXRef = useRef<number>(0);
  const smoothedMouseXRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  // Reconstruct curves from Blender markers and path points
  const {
    curve,
    departureCurve,
    markers,
    boatVisibilityProgress,
    isFallback,
    vertexCount,
    nodeName,
  } = useMemo(() => {
    const extractedMarkers = extractMarkers(gltf.scene);
    const {
      journeyPoints,
      departurePoints,
      nodeName: extractedName,
    } = extractPathPoints(
      gltf.scene,
      extractedMarkers.hubResting,
      extractedMarkers.nextArea ?? FALLBACK_NEXT_AREA
    );

    const hasGlbVertices = journeyPoints.length >= 2;
    const constructedJourneyCurve = new THREE.CatmullRomCurve3(
      journeyPoints,
      false,
      "centripetal"
    );
    const constructedDepartureCurve = new THREE.CatmullRomCurve3(
      departurePoints,
      false,
      "centripetal"
    );

    // Calculate progress on the curve corresponding to Boat Visibility
    let minP = 0.781;
    let minDist = Infinity;
    for (let p = 0; p <= 1.0; p += 0.001) {
      const pt = constructedJourneyCurve.getPointAt(p);
      const d = pt.distanceTo(extractedMarkers.boatVisibility);
      if (d < minDist) {
        minDist = d;
        minP = p;
      }
    }

    return {
      curve: constructedJourneyCurve,
      departureCurve: constructedDepartureCurve,
      markers: extractedMarkers,
      boatVisibilityProgress: minP,
      isFallback: !hasGlbVertices,
      vertexCount: journeyPoints.length,
      nodeName: extractedName,
    };
  }, [gltf.scene]);

  // Report diagnostic to parent
  useEffect(() => {
    onDiagnostic?.({
      hasVertices: !isFallback,
      vertexCount,
      nodeName,
      isFallback,
      markers: markers.found,
    });
  }, [isFallback, vertexCount, nodeName, markers.found, onDiagnostic]);

  // Animate intentional two-phase transitions between sections (leaving & returning to Hub Resting)
  useEffect(() => {
    if (activeSection === currentSectionRef.current) return;

    currentSectionRef.current = activeSection;
    isTransitioningRef.current = true;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    if (activeSection === "home") {
      // Returning to Hub Resting from secondary section (Workshop / Research)
      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioningRef.current = false;
          isAtHubRestingRef.current = true;
          onAtHubRestingChange?.(true);
        },
      });
      timelineRef.current = tl;

      // Phase 1: Retrace departure path backwards back to Hub Resting
      tl.to(departureTravelRef.current, {
        value: 0,
        duration: 1.8,
        ease: "power2.inOut",
      });

      // Phase 2: Once safely arrived at Hub Resting, smoothly turn view back to Camera Pointer
      tl.to(departureAlignRef.current, {
        value: 0,
        duration: 0.85,
        ease: "power2.inOut",
      });
    } else {
      // Leaving Hub Resting towards next section (Workshop / Next Area)
      // Hide the intro overlay immediately as departure starts
      isAtHubRestingRef.current = false;
      onAtHubRestingChange?.(false);

      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioningRef.current = false;
        },
      });
      timelineRef.current = tl;

      // Phase 1: First smoothly rotate/align camera to face the forward-facing exit direction
      tl.to(departureAlignRef.current, {
        value: 1,
        duration: 0.85,
        ease: "power2.inOut",
      });

      // Phase 2: Once aligned, begin accelerating along the traced departure path through the hallway/stairs
      tl.to(departureTravelRef.current, {
        value: 1,
        duration: 2.2,
        ease: "power2.inOut",
      });
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [activeSection, onAtHubRestingChange]);

  // Wheel listener: bidirectional scroll input for forward acceleration and reverse travel
  useEffect(() => {
    if (!active) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser default document scroll during guided camera travel
      e.preventDefault();

      // At Hub Resting:
      if (isAtHubRestingRef.current && currentSectionRef.current === "home") {
        if (e.deltaY > 15) {
          // Scrolling down at Hub Resting triggers intentional transition towards next section
          if (!isTransitioningRef.current) {
            isTransitioningRef.current = true;
            onScrollDownAtHub?.();
            onNavigateSection?.("project-geofence");
          }
          return;
        } else if (e.deltaY < -10) {
          // Scrolling up at Hub Resting begins reverse travel back along curve
          isAtHubRestingRef.current = false;
          onAtHubRestingChange?.(false);
        }
      } else if (currentSectionRef.current !== "home") {
        if (e.deltaY < -15) {
          // Scrolling up in a secondary section returns to Hub Resting
          if (!isTransitioningRef.current) {
            isTransitioningRef.current = true;
            onNavigateSection?.("home");
          }
          return;
        }
      }

      // Normalize delta across continuous trackpads and stepped mouse wheels
      const sign = Math.sign(e.deltaY);
      const magnitude = Math.min(Math.abs(e.deltaY), 80);
      const impulse = sign * magnitude * 0.00045;

      // Accumulate target scroll velocity:
      // Positive deltaY (scroll down) accelerates forward up to maxForwardBoost
      // Negative deltaY (scroll up) accelerates in reverse down to -maxReverseSpeed
      targetScrollVelocityRef.current = THREE.MathUtils.clamp(
        targetScrollVelocityRef.current + impulse,
        -maxReverseSpeed,
        maxForwardBoost
      );

      // Smoothly transition scroll velocity using GSAP
      gsap.to(velocityStateRef.current, {
        scrollVelocity: targetScrollVelocityRef.current,
        duration: 0.22,
        ease: "power1.out",
        overwrite: "auto",
      });

      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }

      // When scrolling stops (160ms of inactivity), smoothly ease scroll velocity to 0
      decelTimeoutRef.current = setTimeout(() => {
        targetScrollVelocityRef.current = 0;
        gsap.to(velocityStateRef.current, {
          scrollVelocity: 0,
          duration: 1.4,
          ease: "power2.out",
          overwrite: "auto",
        });
      }, 160);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }
    };
  }, [
    active,
    maxForwardBoost,
    maxReverseSpeed,
    onScrollDownAtHub,
    onNavigateSection,
    onAtHubRestingChange,
  ]);

  // Mouse move listener: horizontal look influence
  useEffect(() => {
    if (!active) return;

    const handlePointerMove = (e: PointerEvent) => {
      rawMouseXRef.current = (e.clientX / window.innerWidth) * 2 - 1;
    };

    const handlePointerLeave = () => {
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

  // Reset or initialize camera when deactivated
  useEffect(() => {
    if (!active) {
      progressRef.current = 0;
      targetScrollVelocityRef.current = 0;
      velocityStateRef.current.scrollVelocity = 0;
      isHubVisibleRef.current = false;
      isAtHubRestingRef.current = false;
      departureAlignRef.current.value = 0;
      departureTravelRef.current.value = 0;
    }
  }, [active]);

  // Per-frame physics, kinematics, and orientation update loop
  useFrame((_, delta) => {
    if (!active) return;

    // Check if camera has reached Hub Resting
    const isAtEnd = progressRef.current >= 0.999;
    if (
      isAtEnd &&
      !isAtHubRestingRef.current &&
      currentSectionRef.current === "home" &&
      departureTravelRef.current.value <= 0.001
    ) {
      isAtHubRestingRef.current = true;
      onAtHubRestingChange?.(true);
      onComplete?.();
    }

    // Match movement speed across open water bay to village camera movement:
    // Scale velocity across open water so it feels brisk and consistent with village streets,
    // then smoothly ease as the camera docks at Hub Resting.
    let waterSpeedMultiplier = 1.0;
    if (progressRef.current >= boatVisibilityProgress) {
      const waterSpan = 1.0 - boatVisibilityProgress;
      const waterProgress = THREE.MathUtils.clamp(
        (progressRef.current - boatVisibilityProgress) / waterSpan,
        0,
        1
      );
      if (waterProgress < 0.75) {
        waterSpeedMultiplier = THREE.MathUtils.lerp(
          1.0,
          1.95,
          Math.min(1, waterProgress * 3.0)
        );
      } else {
        waterSpeedMultiplier = THREE.MathUtils.lerp(
          1.95,
          1.0,
          (waterProgress - 0.75) / 0.25
        );
      }
    }

    // When resting at Hub, autonomous movement pauses (baseVelocity = 0)
    const baseVelocity = isAtHubRestingRef.current
      ? 0
      : (1.0 / baseDuration) * waterSpeedMultiplier;
    const scrollMultiplier = progressRef.current >= boatVisibilityProgress ? 1.5 : 1.0;
    const currentVelocity =
      baseVelocity + velocityStateRef.current.scrollVelocity * scrollMultiplier;

    // Integrate progress along the path (clamped strictly between 0 and 1)
    progressRef.current = THREE.MathUtils.clamp(
      progressRef.current + currentVelocity * delta,
      0,
      1
    );

    // If camera reversed before the end, clear resting state
    if (progressRef.current < 0.985 && isAtHubRestingRef.current) {
      isAtHubRestingRef.current = false;
      onAtHubRestingChange?.(false);
    }

    // Notify progress change
    if (Math.abs(progressRef.current - prevProgressRef.current) > 0.0001) {
      prevProgressRef.current = progressRef.current;
      onProgress?.(progressRef.current);
    }

    if (typeof window !== "undefined") {
      (window as unknown as { __CAMERA_DIAGNOSTICS__: unknown }).__CAMERA_DIAGNOSTICS__ =
        {
          progress: progressRef.current,
          isHubVisible: isHubVisibleRef.current,
          isAtHubResting: isAtHubRestingRef.current,
          departureAlign: departureAlignRef.current.value,
          departureTravel: departureTravelRef.current.value,
          cameraPosition: camera.position.toArray(),
        };
    }

    // Trigger Hub visibility precisely when camera reaches Boat Visibility marker.
    // Once revealed, keep it visible even when scrolling backwards.
    if (
      !isHubVisibleRef.current &&
      progressRef.current >= boatVisibilityProgress - 0.002
    ) {
      isHubVisibleRef.current = true;
      onHubVisibilityChange?.(true);
    }

    // Smooth mouse look offset damping
    smoothedMouseXRef.current = THREE.MathUtils.damp(
      smoothedMouseXRef.current,
      rawMouseXRef.current,
      3.8,
      delta
    );

    // Evaluate camera position along the exact continuous Blender curves
    const journeyPos = curve.getPointAt(progressRef.current);
    const depTravel = departureTravelRef.current.value;
    const depAlign = departureAlignRef.current.value;

    let currentPos: THREE.Vector3;
    if (depTravel > 0.0001) {
      // Traveling along the traced departure hallway path (no wall clipping)
      currentPos = departureCurve.getPointAt(depTravel);
    } else {
      // Along main journey or stationary at Hub Resting
      currentPos = journeyPos;
    }
    camera.position.copy(currentPos);

    // Determine forward heading and viewing direction target
    let baseTarget: THREE.Vector3;
    let forwardDir: THREE.Vector3;

    if (depTravel > 0.0001) {
      // Moving along departure path
      const depTangent = departureCurve.getTangentAt(depTravel).normalize();
      forwardDir = depTangent;
      const depLookAheadT = Math.min(1.0, depTravel + 0.035);
      const depAheadPt = departureCurve.getPointAt(depLookAheadT);
      baseTarget = depAheadPt.addScaledVector(depTangent, 12);
    } else if (
      depAlign > 0.0001 ||
      (isAtHubRestingRef.current && progressRef.current >= 0.99)
    ) {
      // At Hub Resting (stationary position), rotating between Camera Pointer and exit direction
      const depStartTangent = departureCurve.getTangentAt(0).normalize();
      forwardDir = depStartTangent;
      const exitLookTarget = journeyPos.clone().addScaledVector(depStartTangent, 15);
      baseTarget = new THREE.Vector3().lerpVectors(
        markers.cameraPointer,
        exitLookTarget,
        depAlign
      );
    } else {
      // Along main journey path
      const tangent = curve.getTangentAt(progressRef.current);
      forwardDir = tangent.clone().normalize();

      const lookDelta = 0.02;
      const pLook = Math.min(1.0, progressRef.current + lookDelta);

      let curveTarget: THREE.Vector3;
      if (progressRef.current >= 0.995) {
        curveTarget = currentPos.clone().addScaledVector(forwardDir, 15);
      } else {
        curveTarget = curve.getPointAt(pLook);
        if (curveTarget.distanceToSquared(currentPos) < 0.0001) {
          curveTarget = currentPos.clone().addScaledVector(forwardDir, 15);
        }
      }

      // Smoothly blend viewing direction towards Camera Pointer as we approach Hub Resting
      const hubLookBlend = THREE.MathUtils.smoothstep(progressRef.current, 0.88, 1.0);
      baseTarget = new THREE.Vector3().lerpVectors(
        curveTarget,
        markers.cameraPointer,
        hubLookBlend
      );
    }

    // Calculate lateral mouse look angle without affecting position or roll
    const rawLookForward = baseTarget.clone().sub(currentPos).normalize();
    const lookForward =
      rawLookForward.lengthSq() < 0.0001 ? forwardDir.clone() : rawLookForward;
    const lookRight = new THREE.Vector3().crossVectors(lookForward, WORLD_UP).normalize();

    // Yaw rotation offset: positive mouseX turns view right relative to forward path heading
    const lookAngle = smoothedMouseXRef.current * maxMouseAngle;
    const finalLookDir = lookForward
      .clone()
      .multiplyScalar(Math.cos(lookAngle))
      .add(lookRight.clone().multiplyScalar(Math.sin(lookAngle)))
      .normalize();

    const finalTarget = currentPos.clone().add(finalLookDir.multiplyScalar(15));

    // Compute target orientation quaternion and slerp smoothly
    const lookMatrix = new THREE.Matrix4().lookAt(currentPos, finalTarget, WORLD_UP);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

    if (!isInitializedRef.current) {
      camera.quaternion.copy(targetQuat);
      isInitializedRef.current = true;
    } else {
      camera.quaternion.slerp(targetQuat, Math.min(1, 8.5 * delta));
    }
  });

  return null;
}

// Preload the camera path asset
useGLTF.preload(CAMERA_PATH_URL);

export default CameraRig;
