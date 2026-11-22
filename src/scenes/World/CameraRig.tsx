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
import { CAMERA_CONFIG, getJourneyProgressVelocity } from "../../config/cameraConfig";
import type { SectionId } from "../../data/sections";
import {
  CAMERA_PATH_MARS_URL,
  CAMERA_PATH_VILLAGE_URL,
  DRACO_DECODER_PATH,
} from "./gltfLoaderConfig";
import { hubFadeState } from "./hubFadeState";

export const CAMERA_PATH_URL = CAMERA_PATH_VILLAGE_URL;
export const DEFAULT_CAMERA_FOV = 58;

const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Default coordinates directly from Blender world coordinates
const FALLBACK_BOAT_VISIBILITY = new THREE.Vector3(-159.7057, 9.8877, -14.1756);
const FALLBACK_HUB_RESTING = new THREE.Vector3(-274.015, 15.7716, -19.552);
const FALLBACK_CAMERA_POINTER = new THREE.Vector3(-296.2811, 28.9538, -4.1265);
const FALLBACK_NEXT_AREA = new THREE.Vector3(-383.8439, 24.4108, -23.0299);
const FALLBACK_WORMHOLE_ENTRY = new THREE.Vector3(-385.9731, 26.8341, -22.6255);
const FALLBACK_WORMHOLE_EXIT = new THREE.Vector3(-430.0504, 26.9651, -23.8131);
const FALLBACK_MARS_STATION_ENTRY = new THREE.Vector3(-537.0149, 171.031, -21.4217);
const FALLBACK_MARS_STATION_RESTING = new THREE.Vector3(-557.5784, 165.6332, -21.6792);
const FALLBACK_MARS_CAMERA_POINTER = new THREE.Vector3(-632.1886, 180.7053, -10.4269);

export interface BlenderMarkers {
  boatVisibility: THREE.Vector3;
  hubResting: THREE.Vector3;
  cameraPointer: THREE.Vector3;
  nextArea: THREE.Vector3 | null;
  wormholeEntry: THREE.Vector3;
  wormholeExit: THREE.Vector3;
  marsStationEntry: THREE.Vector3;
  marsStationResting: THREE.Vector3;
  marsCameraPointer: THREE.Vector3;
  found: {
    boatVisibility: boolean;
    hubResting: boolean;
    cameraPointer: boolean;
    nextArea: boolean;
    wormholeEntry: boolean;
    wormholeExit: boolean;
    marsStationEntry: boolean;
    marsStationResting: boolean;
    marsCameraPointer: boolean;
  };
}

export interface CameraRigProps {
  /** Whether the guided camera journey is currently active */
  active?: boolean;
  /** Called on every frame tick with normalized journey progress [0, 1] */
  onProgress?: (progress: number) => void;
  /** Called when the camera arrives at the Hub destination */
  onComplete?: () => void;
  /** Called when the camera crosses Boat Visibility to toggle Hub visibility */
  onHubVisibilityChange?: (visible: boolean) => void;
  /** Called with normalized Hub fade-in progress [0.0 - 1.0] starting at Boat Visibility */
  onHubFadeChange?: (fade: number) => void;
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
      wormholeEntry?: boolean;
      wormholeExit?: boolean;
      marsStationEntry?: boolean;
      marsStationResting?: boolean;
      marsCameraPointer?: boolean;
    };
  }) => void;
}

/**
 * Extracts named Empty positional markers from the Blender glTF scene(s).
 */
function extractMarkers(
  villageScene: THREE.Group,
  marsScene?: THREE.Group
): BlenderMarkers {
  let boatVisibility: THREE.Vector3 | null = null;
  let hubResting: THREE.Vector3 | null = null;
  let cameraPointer: THREE.Vector3 | null = null;
  let nextArea: THREE.Vector3 | null = null;
  let wormholeEntry: THREE.Vector3 | null = null;
  let wormholeExit: THREE.Vector3 | null = null;
  let marsStationEntry: THREE.Vector3 | null = null;
  let marsStationResting: THREE.Vector3 | null = null;
  let marsCameraPointer: THREE.Vector3 | null = null;

  villageScene.updateMatrixWorld(true);

  villageScene.traverse((child) => {
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
    } else if (cleanName === "wormhole entry" || cleanName.includes("wormhole entry")) {
      wormholeEntry = new THREE.Vector3();
      child.getWorldPosition(wormholeEntry);
    } else if (cleanName === "wormhole exit" || cleanName.includes("wormhole exit")) {
      wormholeExit = new THREE.Vector3();
      child.getWorldPosition(wormholeExit);
    }
  });

  if (marsScene) {
    marsScene.updateMatrixWorld(true);
    marsScene.traverse((child) => {
      const cleanName = child.name.replace(/_/g, " ").toLowerCase().trim();
      if (cleanName === "mars station entry" || cleanName.includes("station entry")) {
        marsStationEntry = new THREE.Vector3();
        child.getWorldPosition(marsStationEntry);
      } else if (
        cleanName === "mars station resting" ||
        cleanName.includes("station resting")
      ) {
        marsStationResting = new THREE.Vector3();
        child.getWorldPosition(marsStationResting);
      } else if (
        cleanName === "mars camera pointer" ||
        cleanName.includes("mars camera pointer")
      ) {
        marsCameraPointer = new THREE.Vector3();
        child.getWorldPosition(marsCameraPointer);
      }
    });
  }

  return {
    boatVisibility: boatVisibility ?? FALLBACK_BOAT_VISIBILITY.clone(),
    hubResting: hubResting ?? FALLBACK_HUB_RESTING.clone(),
    cameraPointer: cameraPointer ?? FALLBACK_CAMERA_POINTER.clone(),
    nextArea: nextArea ?? wormholeEntry ?? FALLBACK_NEXT_AREA.clone(),
    wormholeEntry: wormholeEntry ?? FALLBACK_WORMHOLE_ENTRY.clone(),
    wormholeExit: wormholeExit ?? FALLBACK_WORMHOLE_EXIT.clone(),
    marsStationEntry: marsStationEntry ?? FALLBACK_MARS_STATION_ENTRY.clone(),
    marsStationResting: marsStationResting ?? FALLBACK_MARS_STATION_RESTING.clone(),
    marsCameraPointer: marsCameraPointer ?? FALLBACK_MARS_CAMERA_POINTER.clone(),
    found: {
      boatVisibility: boatVisibility !== null,
      hubResting: hubResting !== null,
      cameraPointer: cameraPointer !== null,
      nextArea: nextArea !== null || wormholeEntry !== null,
      wormholeEntry: wormholeEntry !== null,
      wormholeExit: wormholeExit !== null,
      marsStationEntry: marsStationEntry !== null,
      marsStationResting: marsStationResting !== null,
      marsCameraPointer: marsCameraPointer !== null,
    },
  };
}

/**
 * Extracts ordered world-space path points from a glTF scene object if present.
 * Returns:
 * 1. journeyPoints: Mountain Peak -> Village -> Docks -> Water -> Hub Resting
 * 2. departurePoints: Hub Resting -> Hallway -> Archway -> Wormhole Entry / Next Area
 */
function extractPathPoints(
  scene: THREE.Group,
  hubRestingPos: THREE.Vector3,
  targetExitPos: THREE.Vector3
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
    // In camera_path_village.glb:
    // Vertex 380 is Mountain Peak.
    // Vertex 86 is the arrival at Hub Resting (dist = 0.11).
    // Vertices 85 to 52 travel through the hallway to Wormhole Entry.
    // Vertex 51 is Wormhole Entry.
    // Vertices 50 to 18 travel back through the hallway to Hub Resting.
    // Vertex 18 is Hub Resting at the start of the hallway.

    // 1. Locate arrivalHubIdx: scanning backwards from Mountain Peak (points.length - 1) downwards
    let arrivalHubIdx = -1;
    let minArrivalDist = Infinity;
    for (let i = points.length - 1; i >= 60; i--) {
      const d = points[i].distanceTo(hubRestingPos);
      if (d < minArrivalDist) {
        minArrivalDist = d;
        arrivalHubIdx = i;
      }
    }

    // 2. Locate departure destination index (Wormhole Entry / Next Area)
    let bestExitIdx = -1;
    let minExitDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = points[i].distanceTo(targetExitPos);
      if (d < minExitDist) {
        minExitDist = d;
        bestExitIdx = i;
      }
    }

    // 3. Locate departure starting index at Hub Resting (near index 18)
    let depHubIdx = -1;
    let minDepHubDist = Infinity;
    for (let i = 0; i < 40; i++) {
      const d = points[i].distanceTo(hubRestingPos);
      if (d < minDepHubDist) {
        minDepHubDist = d;
        depHubIdx = i;
      }
    }

    if (arrivalHubIdx !== -1) {
      // Main journey: Mountain Peak -> Village -> Docks -> Water -> Hub Resting
      // Strictly terminates at Hub Resting without traveling to Wormhole Entry!
      const journey = points.slice(arrivalHubIdx, points.length).reverse();
      journey[journey.length - 1].copy(hubRestingPos);

      // Departure journey: Hub Resting -> Hallway -> Archway -> Wormhole Entry
      let departure: THREE.Vector3[];
      if (depHubIdx !== -1 && bestExitIdx !== -1 && bestExitIdx > depHubIdx) {
        departure = points.slice(depHubIdx, bestExitIdx + 1);
      } else {
        const startIdx = depHubIdx !== -1 ? depHubIdx : 18;
        departure = points.slice(startIdx, Math.min(points.length, startIdx + 34));
      }
      departure[0].copy(hubRestingPos);
      departure[departure.length - 1].copy(targetExitPos);

      return {
        journeyPoints: journey,
        departurePoints: departure,
        nodeName: foundNodeName || "Camera_Path_Village",
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
  fallbackDeparture[fallbackDeparture.length - 1].copy(targetExitPos);

  return {
    journeyPoints: fallbackJourney,
    departurePoints: fallbackDeparture,
    nodeName: foundNodeName || "Camera_Path_Main (fallback)",
  };
}

/**
 * Extracts ordered world-space arrival path points for Mars Research Station.
 * In camera_path_mars.glb: index 48 is Mars_Station_Entry, index 0 is Mars_Station_Resting.
 * Sequences points from Entry -> Resting.
 */
function extractMarsPathPoints(
  scene: THREE.Group,
  entryPos: THREE.Vector3,
  restingPos: THREE.Vector3
): {
  marsPoints: THREE.Vector3[];
  nodeName: string;
} {
  const points: THREE.Vector3[] = [];
  let foundNodeName = "";

  scene.updateMatrixWorld(true);

  scene.traverse((child) => {
    const isTargetName =
      child.name.toLowerCase().includes("mars") ||
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

  if (points.length >= 2) {
    const marsArrival = points.slice().reverse();
    marsArrival[0].copy(entryPos);
    marsArrival[marsArrival.length - 1].copy(restingPos);
    return {
      marsPoints: marsArrival,
      nodeName: foundNodeName || "Camera_Path_Mars",
    };
  }

  return {
    marsPoints: [entryPos.clone(), restingPos.clone()],
    nodeName: foundNodeName || "Camera_Path_Mars (fallback)",
  };
}

export function CameraRig({
  active = true,
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
  const villageGltf = useGLTF(CAMERA_PATH_VILLAGE_URL, DRACO_DECODER_PATH, true);
  const marsGltf = useGLTF(CAMERA_PATH_MARS_URL, DRACO_DECODER_PATH, true);

  // Single continuous progress value along journey: 0.0 = Mountain, 1.0 = Hub Resting
  const progressRef = useRef<number>(0);
  const prevProgressRef = useRef<number>(0);

  // Hub visibility and gradual fade state
  const isHubVisibleRef = useRef<boolean>(false);
  const maxHubFadeRef = useRef<number>(0);
  const prevHubFadeRef = useRef<number>(-1);
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
    marsCurve,
    markers,
    boatVisibilityProgress,
    isFallback,
    vertexCount,
    nodeName,
  } = useMemo(() => {
    const extractedMarkers = extractMarkers(villageGltf.scene, marsGltf.scene);
    const targetExitPos =
      extractedMarkers.wormholeEntry ??
      extractedMarkers.nextArea ??
      FALLBACK_WORMHOLE_ENTRY;

    const {
      journeyPoints,
      departurePoints,
      nodeName: extractedName,
    } = extractPathPoints(villageGltf.scene, extractedMarkers.hubResting, targetExitPos);

    const { marsPoints } = extractMarsPathPoints(
      marsGltf.scene,
      extractedMarkers.marsStationEntry,
      extractedMarkers.marsStationResting
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
    const constructedMarsCurve = new THREE.CatmullRomCurve3(
      marsPoints,
      false,
      "centripetal"
    );

    // Calculate progress on the curve corresponding to Boat Visibility with sub-millimeter precision
    let minP = 0.7806;
    let minDist = Infinity;
    const SAMPLES = 5000;
    for (let p = 0; p <= 1.0; p += 1.0 / SAMPLES) {
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
      marsCurve: constructedMarsCurve,
      markers: extractedMarkers,
      boatVisibilityProgress: minP,
      isFallback: !hasGlbVertices,
      vertexCount: journeyPoints.length,
      nodeName: extractedName,
    };
  }, [villageGltf.scene, marsGltf.scene]);

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

    const { hubRestingToNextArea } = CAMERA_CONFIG.departureRoutes;

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
        duration: hubRestingToNextArea.returnTravelDurationSec,
        ease: hubRestingToNextArea.returnTravelEase,
      });

      // Phase 2: Once safely arrived at Hub Resting, smoothly turn view back to Camera Pointer
      tl.to(departureAlignRef.current, {
        value: 0,
        duration: hubRestingToNextArea.returnAlignmentDurationSec,
        ease: hubRestingToNextArea.returnAlignmentEase,
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
      // Camera position remains strictly stationary at Hub Resting during this phase
      tl.to(departureAlignRef.current, {
        value: 1,
        duration: hubRestingToNextArea.alignmentDurationSec,
        ease: hubRestingToNextArea.alignmentEase,
      });

      // Phase 2: Once alignment is complete, begin accelerating along the traced departure path through hallway/stairs
      tl.to(departureTravelRef.current, {
        value: 1,
        duration: hubRestingToNextArea.travelDurationSec,
        ease: hubRestingToNextArea.travelEase,
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

      // If a section transition is actively animating, ignore wheel inputs
      if (isTransitioningRef.current) {
        return;
      }

      // At Hub Resting:
      if (isAtHubRestingRef.current && currentSectionRef.current === "home") {
        if (e.deltaY > 15) {
          // Scrolling down at Hub Resting triggers intentional departure sequence towards next section
          isTransitioningRef.current = true;
          onScrollDownAtHub?.();
          onNavigateSection?.("project-geofence");
          return;
        } else if (e.deltaY < 0 && CAMERA_CONFIG.boundaries.lockReverseAtHubResting) {
          // TREAT HUB_RESTING AS A NAVIGATION BOUNDARY:
          // Strictly ignore upward scroll input when resting at Hub.
          // Do NOT allow the camera to move backwards into the village.
          return;
        }
        return;
      } else if (currentSectionRef.current !== "home") {
        if (e.deltaY < -15) {
          // Scrolling up in a secondary section returns to Hub Resting
          isTransitioningRef.current = true;
          onNavigateSection?.("home");
          return;
        }
      }

      // Normalize delta across continuous trackpads and stepped mouse wheels
      const sign = Math.sign(e.deltaY);
      const magnitude = Math.min(Math.abs(e.deltaY), 80);
      const impulse = sign * magnitude * CAMERA_CONFIG.scrollDynamics.scrollSensitivity;

      // Accumulate target scroll velocity:
      // Positive deltaY (scroll down) accelerates forward up to maxForwardBoostProgress
      // Negative deltaY (scroll up) accelerates in reverse down to -maxReverseSpeedProgress
      targetScrollVelocityRef.current = THREE.MathUtils.clamp(
        targetScrollVelocityRef.current + impulse,
        -CAMERA_CONFIG.scrollDynamics.maxReverseSpeedProgress,
        CAMERA_CONFIG.scrollDynamics.maxForwardBoostProgress
      );

      // Smoothly transition scroll velocity using GSAP
      gsap.to(velocityStateRef.current, {
        scrollVelocity: targetScrollVelocityRef.current,
        duration: CAMERA_CONFIG.scrollDynamics.accelerationDurationSec,
        ease: "power1.out",
        overwrite: "auto",
      });

      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }

      // When scrolling stops, smoothly ease scroll velocity to 0
      decelTimeoutRef.current = setTimeout(() => {
        targetScrollVelocityRef.current = 0;
        gsap.to(velocityStateRef.current, {
          scrollVelocity: 0,
          duration: CAMERA_CONFIG.scrollDynamics.decelerationDurationSec,
          ease: "power2.out",
          overwrite: "auto",
        });
      }, CAMERA_CONFIG.scrollDynamics.inactivityTimeoutMs);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }
    };
  }, [active, onScrollDownAtHub, onNavigateSection, onAtHubRestingChange]);

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
      maxHubFadeRef.current = 0;
      prevHubFadeRef.current = -1;
      isAtHubRestingRef.current = false;
      departureAlignRef.current.value = 0;
      departureTravelRef.current.value = 0;
    }
  }, [active]);

  // Per-frame physics, kinematics, and orientation update loop
  useFrame((_, delta) => {
    if (!active) return;
    if (
      typeof window !== "undefined" &&
      (window as unknown as { __CAMERA_OVERRIDE__?: boolean }).__CAMERA_OVERRIDE__
    ) {
      return;
    }

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

    // Autonomous progress velocity (du/dt) derived from centralized CAMERA_CONFIG speeds
    const totalCurveLength = curve.getLength();
    const baseProgressVelocity = isAtHubRestingRef.current
      ? 0
      : getJourneyProgressVelocity(progressRef.current, totalCurveLength);

    const isOnWater = progressRef.current >= boatVisibilityProgress;
    const scrollMultiplier = isOnWater
      ? CAMERA_CONFIG.scrollDynamics.waterScrollMultiplier
      : 1.0;

    const currentVelocity =
      baseProgressVelocity + velocityStateRef.current.scrollVelocity * scrollMultiplier;

    // Integrate progress along the path (clamped strictly between 0 and 1)
    progressRef.current = THREE.MathUtils.clamp(
      progressRef.current + currentVelocity * delta,
      0,
      1
    );

    // If camera reversed before the end (only possible if lockReverse is disabled), clear resting state
    if (
      progressRef.current < 0.985 &&
      isAtHubRestingRef.current &&
      !CAMERA_CONFIG.boundaries.lockReverseAtHubResting
    ) {
      isAtHubRestingRef.current = false;
      onAtHubRestingChange?.(false);
    }

    // Notify progress change
    if (Math.abs(progressRef.current - prevProgressRef.current) > 0.0001) {
      prevProgressRef.current = progressRef.current;
      onProgress?.(progressRef.current);
    }

    if (typeof window !== "undefined") {
      (
        window as unknown as { __SET_CAMERA_PROGRESS__?: (p: number) => void }
      ).__SET_CAMERA_PROGRESS__ = (p: number) => {
        progressRef.current = p;
      };
      (window as unknown as { __CAMERA_DIAGNOSTICS__: unknown }).__CAMERA_DIAGNOSTICS__ =
        {
          progress: progressRef.current,
          isHubVisible: isHubVisibleRef.current,
          hubFade: maxHubFadeRef.current,
          isAtHubResting: isAtHubRestingRef.current,
          departureAlign: departureAlignRef.current.value,
          departureTravel: departureTravelRef.current.value,
          cameraPosition: camera.position.toArray(),
          markers: markers.found,
          journeyLength: curve.getLength(),
          departureLength: departureCurve.getLength(),
          marsLength: marsCurve.getLength(),
        };
    }

    // Gradual Hub appearance: begins revealing at Boat_Visibility and smoothly fades in.
    // Reaches full opacity within the final 20–25% of the distance between Boat_Visibility and Hub_Resting.
    // Uses smooth quadratic ease-out curve (t * (2 - t)) for natural visual approach.
    // Once revealed, keep it visible permanently during that visit, including when moving backwards.
    let currentFade = 0;
    if (progressRef.current >= boatVisibilityProgress) {
      // Reaches 100% full opacity at 77.5% of the span (leaving final 22.5% distance solid)
      const fadeEndProgress =
        boatVisibilityProgress + (1.0 - boatVisibilityProgress) * 0.775;
      const t = THREE.MathUtils.clamp(
        (progressRef.current - boatVisibilityProgress) /
          (fadeEndProgress - boatVisibilityProgress),
        0,
        1
      );
      // Quadratic ease-out: rapid natural reveal, smooth zero-derivative arrival at 1.0
      currentFade = t * (2 - t);
    }
    maxHubFadeRef.current = Math.max(maxHubFadeRef.current, currentFade);
    const effectiveFade = maxHubFadeRef.current;

    // Imperative store update without triggering 60 FPS React re-renders
    hubFadeState.fade = effectiveFade;

    if (!isHubVisibleRef.current && effectiveFade > 0.001) {
      isHubVisibleRef.current = true;
      hubFadeState.visible = true;
      onHubVisibilityChange?.(true);
    }

    // Smooth mouse look offset damping
    smoothedMouseXRef.current = THREE.MathUtils.damp(
      smoothedMouseXRef.current,
      rawMouseXRef.current,
      CAMERA_CONFIG.orientationDynamics.mouseLookDamping,
      delta
    );

    // Evaluate camera position along the exact continuous Blender curves
    const journeyPos = curve.getPointAt(progressRef.current);
    const depTravel = departureTravelRef.current.value;
    const depAlign = departureAlignRef.current.value;

    let currentPos: THREE.Vector3;
    if (depTravel > 0.0001) {
      // Traveling along the traced departure hallway path (only after alignment is complete)
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
    const lookAngle =
      smoothedMouseXRef.current * CAMERA_CONFIG.orientationDynamics.maxMouseLookAngleRad;
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
      camera.quaternion.slerp(
        targetQuat,
        Math.min(1, CAMERA_CONFIG.orientationDynamics.cameraRotationDamping * delta)
      );
    }
  });

  return null;
}

// Preload camera path assets
useGLTF.preload(CAMERA_PATH_VILLAGE_URL, DRACO_DECODER_PATH, true);
useGLTF.preload(CAMERA_PATH_MARS_URL, DRACO_DECODER_PATH, true);

export default CameraRig;
