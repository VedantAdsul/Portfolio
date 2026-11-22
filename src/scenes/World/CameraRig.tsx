/**
 * CameraRig Component
 *
 * Implements the guided cinematic camera journey for VEDANT.EXE connecting
 * the Mountain peak origin through the Village to the Central Hub destination,
 * and onward through the 5th Dimension Wormhole to the Mars Research Station.
 *
 * Traversal Journey:
 * 1. Mountain Peak (u=1.0, progress=0.0) -> Village -> Docks ->
 *    Boat Visibility marker (crossing triggers Hub visibility) ->
 *    Hub Resting marker (u=0.0, progress=1.0) -> Looks toward Camera Pointer.
 * 2. Departure: Hub Resting -> Hallway -> Wormhole -> Event Horizon Plunge ->
 *    Concealed Teleportation in pitch-black singularity core ->
 *    Emergence from destination wormhole onto Mars Camera Path ->
 *    Mars Station Resting Point 1.
 * 3. Mars Multi-Point Navigation:
 *    - Forward: Resting 1 (u=0.5692) -> Resting 2 (u=0.8194) -> Resting 3 (u=1.0).
 *    - Reverse: Resting 3 -> Resting 2 -> Resting 1.
 *      Significantly faster cinematic rewind with zero 180-degree rotation.
 *      Camera strictly maintains forward viewing orientation along the path.
 *    - Return to Hub: Intentional Minecraft-style button action triggering reverse
 *      wormhole transition concealed inside the black singularity core.
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

// Mars Resting Points and Look Target Pointers from Blender
const FALLBACK_MARS_STATION_RESTING_1 = new THREE.Vector3(-598.8008, 151.6248, -26.4746);
const FALLBACK_MARS_STATION_RESTING_2 = new THREE.Vector3(-617.8926, 165.2556, -46.6581);
const FALLBACK_MARS_STATION_RESTING_3 = new THREE.Vector3(-639.4886, 162.6155, -37.6995);

const FALLBACK_MARS_CAMERA_POINTER_1 = new THREE.Vector3(-632.1886, 180.7053, -10.4269);
const FALLBACK_MARS_CAMERA_POINTER_2 = new THREE.Vector3(-612.4886, 193.6155, -103.6995);
const FALLBACK_MARS_CAMERA_POINTER_3 = new THREE.Vector3(-624.1622, 177.3324, -2.474);

// Mars Camera Path U parameter values for each resting point
const MARS_RESTING_U = {
  EXIT: 0.0,
  RESTING_1: 0.5692,
  RESTING_2: 0.8194,
  RESTING_3: 1.0,
};

export interface BlenderMarkers {
  boatVisibility: THREE.Vector3;
  hubResting: THREE.Vector3;
  cameraPointer: THREE.Vector3;
  nextArea: THREE.Vector3 | null;
  wormholeEntry: THREE.Vector3;
  wormholeExit: THREE.Vector3;
  marsStationEntry: THREE.Vector3;
  marsStationResting1: THREE.Vector3;
  marsStationResting2: THREE.Vector3;
  marsStationResting3: THREE.Vector3;
  marsCameraPointer1: THREE.Vector3;
  marsCameraPointer2: THREE.Vector3;
  marsCameraPointer3: THREE.Vector3;
  found: {
    boatVisibility: boolean;
    hubResting: boolean;
    cameraPointer: boolean;
    nextArea: boolean;
    wormholeEntry: boolean;
    wormholeExit: boolean;
    marsStationEntry: boolean;
    marsStationResting1: boolean;
    marsStationResting2: boolean;
    marsStationResting3: boolean;
    marsCameraPointer1: boolean;
    marsCameraPointer2: boolean;
    marsCameraPointer3: boolean;
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
  /** Callback when Mars camera path is extracted and ready for wormhole exit alignment */
  onMarsPathReady?: (info: { start: THREE.Vector3; tangent: THREE.Vector3 }) => void;
  /** Called when the camera enters the wormhole throat and teleports to Mars */
  onTeleportToMars?: () => void;
  /** Called when the camera teleports back from Mars to Hub */
  onTeleportToHub?: () => void;
  /** Called when the camera arrives at or leaves a Mars resting point */
  onAtMarsRestingChange?: (atResting: boolean, restingIndex?: number) => void;
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
      marsStationResting1?: boolean;
      marsStationResting2?: boolean;
      marsStationResting3?: boolean;
      marsCameraPointer1?: boolean;
      marsCameraPointer2?: boolean;
      marsCameraPointer3?: boolean;
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
  let marsStationResting1: THREE.Vector3 | null = null;
  let marsStationResting2: THREE.Vector3 | null = null;
  let marsStationResting3: THREE.Vector3 | null = null;
  let marsCameraPointer1: THREE.Vector3 | null = null;
  let marsCameraPointer2: THREE.Vector3 | null = null;
  let marsCameraPointer3: THREE.Vector3 | null = null;

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
      if (cleanName.includes("wormhole exit") || cleanName.includes("station entry")) {
        marsStationEntry = new THREE.Vector3();
        child.getWorldPosition(marsStationEntry);
      } else if (
        cleanName.includes("station resting 1") ||
        cleanName.includes("resting 1") ||
        cleanName.includes("resting_1")
      ) {
        marsStationResting1 = new THREE.Vector3();
        child.getWorldPosition(marsStationResting1);
      } else if (
        cleanName.includes("station resting 2") ||
        cleanName.includes("resting 2") ||
        cleanName.includes("resting_2")
      ) {
        marsStationResting2 = new THREE.Vector3();
        child.getWorldPosition(marsStationResting2);
      } else if (
        cleanName.includes("station resting 3") ||
        cleanName.includes("resting 3") ||
        cleanName.includes("resting_3")
      ) {
        marsStationResting3 = new THREE.Vector3();
        child.getWorldPosition(marsStationResting3);
      } else if (
        cleanName.includes("camera pointer 2") ||
        cleanName.includes("pointer 2") ||
        cleanName.includes("pointer_2")
      ) {
        marsCameraPointer2 = new THREE.Vector3();
        child.getWorldPosition(marsCameraPointer2);
      } else if (
        cleanName.includes("camera pointer 3") ||
        cleanName.includes("pointer 3") ||
        cleanName.includes("pointer_3")
      ) {
        marsCameraPointer3 = new THREE.Vector3();
        child.getWorldPosition(marsCameraPointer3);
      } else if (
        cleanName.includes("camera pointer 1") ||
        cleanName.includes("pointer 1") ||
        cleanName.includes("pointer_1")
      ) {
        marsCameraPointer1 = new THREE.Vector3();
        child.getWorldPosition(marsCameraPointer1);
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
    marsStationResting1: marsStationResting1 ?? FALLBACK_MARS_STATION_RESTING_1.clone(),
    marsStationResting2: marsStationResting2 ?? FALLBACK_MARS_STATION_RESTING_2.clone(),
    marsStationResting3: marsStationResting3 ?? FALLBACK_MARS_STATION_RESTING_3.clone(),
    marsCameraPointer1: marsCameraPointer1 ?? FALLBACK_MARS_CAMERA_POINTER_1.clone(),
    marsCameraPointer2: marsCameraPointer2 ?? FALLBACK_MARS_CAMERA_POINTER_2.clone(),
    marsCameraPointer3: marsCameraPointer3 ?? FALLBACK_MARS_CAMERA_POINTER_3.clone(),
    found: {
      boatVisibility: boatVisibility !== null,
      hubResting: hubResting !== null,
      cameraPointer: cameraPointer !== null,
      nextArea: nextArea !== null || wormholeEntry !== null,
      wormholeEntry: wormholeEntry !== null,
      wormholeExit: wormholeExit !== null,
      marsStationEntry: marsStationEntry !== null,
      marsStationResting1: marsStationResting1 !== null,
      marsStationResting2: marsStationResting2 !== null,
      marsStationResting3: marsStationResting3 !== null,
      marsCameraPointer1: marsCameraPointer1 !== null,
      marsCameraPointer2: marsCameraPointer2 !== null,
      marsCameraPointer3: marsCameraPointer3 !== null,
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
    // 1. Locate arrivalHubIdx: scanning backwards from Mountain Peak downwards
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
      const journey = points.slice(arrivalHubIdx, points.length).reverse();
      journey[journey.length - 1].copy(hubRestingPos);

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
 * Extracts ordered world-space path points for Mars Research Station.
 * In camera_path_mars.glb:
 * - Total vertices: 427.
 * - Vertices 426 down to 212 form the continuous forward path (215 vertices):
 *   Vertex 426 is Wormhole Exit ([-535.48, 170.26, -20.96], u = 0.0)
 *   Vertex 258 is Resting 1 ([-598.80, 151.62, -26.47], u1 = 0.5692)
 *   Vertex 229 is Resting 2 ([-617.89, 165.26, -46.66], u2 = 0.8194)
 *   Vertex 212 is Resting 3 ([-639.49, 162.62, -37.70], u3 = 1.0)
 */
function extractMarsPathPoints(scene: THREE.Group): {
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

  if (points.length >= 215) {
    const marsPoints = points.slice(212, 427).reverse();
    return {
      marsPoints,
      nodeName: foundNodeName || "Camera_Path_Mars",
    };
  }

  return {
    marsPoints: [
      new THREE.Vector3(-535.48, 170.26, -20.96),
      FALLBACK_MARS_STATION_RESTING_1.clone(),
      FALLBACK_MARS_STATION_RESTING_2.clone(),
      FALLBACK_MARS_STATION_RESTING_3.clone(),
    ],
    nodeName: foundNodeName || "Camera_Path_Mars (fallback)",
  };
}

/**
 * Computes forward viewing look target along the Mars path.
 * Pure spatial function of path parameter u:
 * Camera never turns 180-degrees during reverse movement;
 * line-of-sight remains continuously oriented forward toward the station vistas.
 */
function getMarsLookTarget(
  u: number,
  curve: THREE.CatmullRomCurve3,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3
): THREE.Vector3 {
  const { RESTING_1, RESTING_2, RESTING_3 } = MARS_RESTING_U;

  if (u <= RESTING_1) {
    const lookAheadT = Math.min(RESTING_1, u + 0.04);
    const lookAheadPt = curve.getPointAt(lookAheadT);
    const tangent = curve.getTangentAt(u).normalize();
    const curveTarget = lookAheadPt.addScaledVector(tangent, 15);

    const blend = THREE.MathUtils.smoothstep(u, 0.35, RESTING_1);
    return new THREE.Vector3().lerpVectors(curveTarget, p1, blend);
  } else if (u <= RESTING_2) {
    const t = (u - RESTING_1) / (RESTING_2 - RESTING_1);
    const blend = THREE.MathUtils.smoothstep(t, 0, 1);
    return new THREE.Vector3().lerpVectors(p1, p2, blend);
  } else {
    const t = THREE.MathUtils.clamp((u - RESTING_2) / (RESTING_3 - RESTING_2), 0, 1);
    const blend = THREE.MathUtils.smoothstep(t, 0, 1);
    return new THREE.Vector3().lerpVectors(p2, p3, blend);
  }
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
  onMarsPathReady,
  onTeleportToMars,
  onTeleportToHub,
  onAtMarsRestingChange,
  onDiagnostic,
}: CameraRigProps) {
  const { camera } = useThree();
  const villageGltf = useGLTF(CAMERA_PATH_VILLAGE_URL, DRACO_DECODER_PATH, true);
  const marsGltf = useGLTF(CAMERA_PATH_MARS_URL, DRACO_DECODER_PATH, true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as unknown as { __MARS_SCENE__?: THREE.Group }).__MARS_SCENE__ =
        marsGltf.scene;
    }
  }, [marsGltf.scene]);

  // Single continuous progress value along journey: 0.0 = Mountain, 1.0 = Hub Resting
  const progressRef = useRef<number>(0);
  const prevProgressRef = useRef<number>(0);

  // Hub visibility and gradual fade state
  const isHubVisibleRef = useRef<boolean>(false);
  const maxHubFadeRef = useRef<number>(0);
  const isAtHubRestingRef = useRef<boolean>(false);
  const isTransitioningRef = useRef<boolean>(false);

  // Departure and teleportation sequence animation parameters
  const departureAlignRef = useRef<{ value: number }>({ value: 0 });
  const departureTravelRef = useRef<{ value: number }>({ value: 0 });
  const plungeTravelRef = useRef<{ value: number }>({ value: 0 });
  const marsTravelRef = useRef<{ value: number }>({ value: 0 });
  const marsRestingIndexRef = useRef<number>(1);
  const isTeleportedRef = useRef<boolean>(false);
  const isAtMarsRestingRef = useRef<boolean>(false);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const currentSectionRef = useRef<SectionId>(activeSection);

  // Keep latest callback references in an effect so GSAP timelines are never interrupted by parent re-renders
  const onAtHubRestingChangeRef = useRef(onAtHubRestingChange);
  const onTeleportToMarsRef = useRef(onTeleportToMars);
  const onTeleportToHubRef = useRef(onTeleportToHub);
  const onAtMarsRestingChangeRef = useRef(onAtMarsRestingChange);

  useEffect(() => {
    onAtHubRestingChangeRef.current = onAtHubRestingChange;
    onTeleportToMarsRef.current = onTeleportToMars;
    onTeleportToHubRef.current = onTeleportToHub;
    onAtMarsRestingChangeRef.current = onAtMarsRestingChange;
  });

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

    const { marsPoints } = extractMarsPathPoints(marsGltf.scene);

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

    // Calculate progress on the curve corresponding to Boat Visibility
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

  // Notify parent of Mars path start and orientation for wormhole exit alignment
  useEffect(() => {
    if (marsCurve) {
      onMarsPathReady?.({
        start: marsCurve.getPointAt(0),
        tangent: marsCurve.getTangentAt(0).normalize(),
      });
    }
  }, [marsCurve, onMarsPathReady]);

  // Animate intentional transitions between sections
  useEffect(() => {
    if (activeSection === currentSectionRef.current) return;

    currentSectionRef.current = activeSection;
    isTransitioningRef.current = true;

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const { hubRestingToNextArea } = CAMERA_CONFIG.departureRoutes;

    if (activeSection === "home") {
      // Returning to Hub Resting
      if (isTeleportedRef.current) {
        // REVERSE WORMHOLE TELEPORTATION FROM MARS TO HUB:
        // 1. Fast rewind from current Mars position along marsCurve to wormhole exit (u = 0.0)
        // 2. Plunge into Mars wormhole throat void (100% black singularity)
        // 3. Concealed environment switch inside the pitch-black core
        // 4. Emerge out of Hub wormhole mouth into hallway
        // 5. Retrace hallway back to Hub Resting
        // 6. Smoothly re-align view with Camera Pointer
        const currentMarsU = marsTravelRef.current.value;
        const rewindDuration = Math.max(0.6, currentMarsU * 1.2);

        const tl = gsap.timeline({
          onComplete: () => {
            isTransitioningRef.current = false;
            isAtHubRestingRef.current = true;
            onAtHubRestingChangeRef.current?.(true);
          },
        });
        timelineRef.current = tl;

        // Phase 1: Fast rewind to Mars wormhole exit if not already there
        if (currentMarsU > 0.01) {
          tl.to(marsTravelRef.current, {
            value: 0,
            duration: rewindDuration,
            ease: "power2.inOut",
          });
        }

        // Phase 2: Plunge into Mars wormhole throat void
        tl.to(plungeTravelRef.current, {
          value: 1,
          duration: 0.8,
          ease: "power2.in",
        });

        // Phase 3: Concealed switch inside pitch-black core void
        tl.call(() => {
          isTeleportedRef.current = false;
          marsRestingIndexRef.current = 1;
          marsTravelRef.current.value = 0;
          isAtMarsRestingRef.current = false;
          onAtMarsRestingChangeRef.current?.(false, 1);
          onTeleportToHubRef.current?.();
          progressRef.current = 1.0;
          departureTravelRef.current.value = 1.0;
          departureAlignRef.current.value = 1.0;
        });

        // Phase 4: Emerge out of Hub wormhole mouth into departure hallway
        tl.to(plungeTravelRef.current, {
          value: 0,
          duration: 0.8,
          ease: "power2.out",
        });

        // Phase 5: Travel backwards along departure path back to Hub Resting
        tl.to(departureTravelRef.current, {
          value: 0,
          duration: hubRestingToNextArea.returnTravelDurationSec,
          ease: hubRestingToNextArea.returnTravelEase,
        });

        // Phase 6: Smoothly re-align view to face Camera Pointer at Hub Resting
        tl.to(departureAlignRef.current, {
          value: 0,
          duration: hubRestingToNextArea.returnAlignmentDurationSec,
          ease: hubRestingToNextArea.returnAlignmentEase,
        });
      } else {
        // Retrace departure path backwards back to Hub Resting
        const tl = gsap.timeline({
          onComplete: () => {
            isTransitioningRef.current = false;
            isAtHubRestingRef.current = true;
            onAtHubRestingChangeRef.current?.(true);
          },
        });
        timelineRef.current = tl;

        tl.to(departureTravelRef.current, {
          value: 0,
          duration: hubRestingToNextArea.returnTravelDurationSec,
          ease: hubRestingToNextArea.returnTravelEase,
        });

        tl.to(departureAlignRef.current, {
          value: 0,
          duration: hubRestingToNextArea.returnAlignmentDurationSec,
          ease: hubRestingToNextArea.returnAlignmentEase,
        });
      }
    } else {
      // Leaving Hub Resting towards Mars Research Station through the wormhole
      isAtHubRestingRef.current = false;
      onAtHubRestingChangeRef.current?.(false);

      const tl = gsap.timeline({
        onComplete: () => {
          isTransitioningRef.current = false;
          marsRestingIndexRef.current = 1;
          isAtMarsRestingRef.current = true;
          onAtMarsRestingChangeRef.current?.(true, 1);
        },
      });
      timelineRef.current = tl;

      // Phase 1: Smoothly rotate camera view to face down the departure hallway
      tl.to(departureAlignRef.current, {
        value: 1,
        duration: hubRestingToNextArea.alignmentDurationSec,
        ease: hubRestingToNextArea.alignmentEase,
      });

      // Phase 2: Accelerate along departure path through hallway to wormhole entrance
      tl.to(departureTravelRef.current, {
        value: 1,
        duration: hubRestingToNextArea.travelDurationSec,
        ease: hubRestingToNextArea.travelEase,
      });

      // Phase 3: Plunge into wormhole tunnel towards the pitch-black singularity throat
      tl.to(plungeTravelRef.current, {
        value: 1,
        duration: 1.25,
        ease: "power2.in",
      });

      // Phase 4: Teleportation moment concealed inside the 100% pitch-black core void
      tl.call(() => {
        isTeleportedRef.current = true;
        plungeTravelRef.current.value = 0;
        marsTravelRef.current.value = 0;
        onTeleportToMarsRef.current?.();
      });

      // Phase 5: Emerging from destination wormhole exit and gliding along Mars camera path to Resting 1
      tl.to(marsTravelRef.current, {
        value: MARS_RESTING_U.RESTING_1,
        duration: 4.8,
        ease: "power2.out",
      });
    }

    return () => {
      if (timelineRef.current) {
        timelineRef.current.kill();
      }
    };
  }, [activeSection, markers.hubResting, markers.cameraPointer, camera]);

  // Wheel listener: bidirectional scroll input for forward acceleration and reverse travel
  useEffect(() => {
    if (!active) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // If an intentional camera transition is actively animating, ignore wheel inputs
      if (isTransitioningRef.current) {
        return;
      }

      // 1. MARS ENVIRONMENT NAVIGATION (Resting 1 -> Resting 2 -> Resting 3)
      if (isTeleportedRef.current) {
        const currentIndex = marsRestingIndexRef.current;

        if (e.deltaY > 15) {
          // Scroll DOWN: Forward navigation along Mars path
          if (currentIndex === 1) {
            // Forward 1 -> 2
            isTransitioningRef.current = true;
            marsRestingIndexRef.current = 2;
            isAtMarsRestingRef.current = false;
            onAtMarsRestingChangeRef.current?.(false, 1);
            gsap.to(marsTravelRef.current, {
              value: MARS_RESTING_U.RESTING_2,
              duration: 2.8,
              ease: "power2.inOut",
              onComplete: () => {
                isTransitioningRef.current = false;
                isAtMarsRestingRef.current = true;
                onAtMarsRestingChangeRef.current?.(true, 2);
              },
            });
            return;
          } else if (currentIndex === 2) {
            // Forward 2 -> 3
            isTransitioningRef.current = true;
            marsRestingIndexRef.current = 3;
            isAtMarsRestingRef.current = false;
            onAtMarsRestingChangeRef.current?.(false, 2);
            gsap.to(marsTravelRef.current, {
              value: MARS_RESTING_U.RESTING_3,
              duration: 2.4,
              ease: "power2.inOut",
              onComplete: () => {
                isTransitioningRef.current = false;
                isAtMarsRestingRef.current = true;
                onAtMarsRestingChangeRef.current?.(true, 3);
              },
            });
            return;
          } else {
            // At Resting 3: at end of path
            return;
          }
        } else if (e.deltaY < -15) {
          // Scroll UP: Reverse navigation (Fast cinematic rewind, camera does NOT turn 180 degrees)
          if (currentIndex === 3) {
            // Reverse 3 -> 2
            isTransitioningRef.current = true;
            marsRestingIndexRef.current = 2;
            isAtMarsRestingRef.current = false;
            onAtMarsRestingChangeRef.current?.(false, 3);
            gsap.to(marsTravelRef.current, {
              value: MARS_RESTING_U.RESTING_2,
              duration: 1.1, // Significantly faster rewind
              ease: "power2.inOut",
              onComplete: () => {
                isTransitioningRef.current = false;
                isAtMarsRestingRef.current = true;
                onAtMarsRestingChangeRef.current?.(true, 2);
              },
            });
            return;
          } else if (currentIndex === 2) {
            // Reverse 2 -> 1
            isTransitioningRef.current = true;
            marsRestingIndexRef.current = 1;
            isAtMarsRestingRef.current = false;
            onAtMarsRestingChangeRef.current?.(false, 2);
            gsap.to(marsTravelRef.current, {
              value: MARS_RESTING_U.RESTING_1,
              duration: 1.3, // Significantly faster rewind
              ease: "power2.inOut",
              onComplete: () => {
                isTransitioningRef.current = false;
                isAtMarsRestingRef.current = true;
                onAtMarsRestingChangeRef.current?.(true, 1);
              },
            });
            return;
          } else {
            // At Resting 1: LOCKED. Strictly ignore upward scroll; do NOT auto-teleport to Hub!
            return;
          }
        }
        return;
      }

      // 2. HUB RESTING NAVIGATION
      if (isAtHubRestingRef.current && currentSectionRef.current === "home") {
        if (e.deltaY > 15) {
          isTransitioningRef.current = true;
          onScrollDownAtHub?.();
          onNavigateSection?.("project-geofence");
          return;
        } else if (e.deltaY < 0 && CAMERA_CONFIG.boundaries.lockReverseAtHubResting) {
          // Strictly ignore upward scroll input when resting at Hub
          return;
        }
        return;
      }

      // 3. VILLAGE JOURNEY VELOCITY INTEGRATION
      const sign = Math.sign(e.deltaY);
      const magnitude = Math.min(Math.abs(e.deltaY), 80);
      const impulse = sign * magnitude * CAMERA_CONFIG.scrollDynamics.scrollSensitivity;

      targetScrollVelocityRef.current = THREE.MathUtils.clamp(
        targetScrollVelocityRef.current + impulse,
        -CAMERA_CONFIG.scrollDynamics.maxReverseSpeedProgress,
        CAMERA_CONFIG.scrollDynamics.maxForwardBoostProgress
      );

      gsap.to(velocityStateRef.current, {
        scrollVelocity: targetScrollVelocityRef.current,
        duration: CAMERA_CONFIG.scrollDynamics.accelerationDurationSec,
        ease: "power1.out",
        overwrite: "auto",
      });

      if (decelTimeoutRef.current) {
        clearTimeout(decelTimeoutRef.current);
      }

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
  }, [active, onScrollDownAtHub, onNavigateSection]);

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
      isAtHubRestingRef.current = false;
      departureAlignRef.current.value = 0;
      departureTravelRef.current.value = 0;
      plungeTravelRef.current.value = 0;
      marsTravelRef.current.value = 0;
      marsRestingIndexRef.current = 1;
      isTeleportedRef.current = false;
      isAtMarsRestingRef.current = false;
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

    // Autonomous progress velocity derived from centralized CAMERA_CONFIG speeds
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

    // Notify progress change
    if (Math.abs(progressRef.current - prevProgressRef.current) > 0.0001) {
      prevProgressRef.current = progressRef.current;
      onProgress?.(progressRef.current);
    }

    // Expose diagnostics and test harnesses
    if (typeof window !== "undefined") {
      (
        window as unknown as { __SET_CAMERA_PROGRESS__?: (p: number) => void }
      ).__SET_CAMERA_PROGRESS__ = (p: number) => {
        progressRef.current = p;
      };
      (
        window as unknown as { __TRIGGER_SCROLL_WHEEL__?: (deltaY: number) => void }
      ).__TRIGGER_SCROLL_WHEEL__ = (deltaY: number) => {
        window.dispatchEvent(new WheelEvent("wheel", { deltaY, cancelable: true }));
      };
      (window as unknown as { __CAMERA_DIAGNOSTICS__: unknown }).__CAMERA_DIAGNOSTICS__ =
        {
          progress: progressRef.current,
          isHubVisible: isHubVisibleRef.current,
          hubFade: maxHubFadeRef.current,
          isAtHubResting: isAtHubRestingRef.current,
          departureAlign: departureAlignRef.current.value,
          departureTravel: departureTravelRef.current.value,
          plungeTravel: plungeTravelRef.current.value,
          marsTravel: marsTravelRef.current.value,
          marsRestingIndex: marsRestingIndexRef.current,
          isTeleported: isTeleportedRef.current,
          isAtMarsResting: isAtMarsRestingRef.current,
          cameraPosition: camera.position.toArray(),
          cameraRotation: camera.rotation.toArray(),
          cameraDirection: camera.getWorldDirection(new THREE.Vector3()).toArray(),
          markers: markers.found,
          journeyLength: curve.getLength(),
          departureLength: departureCurve.getLength(),
          marsLength: marsCurve.getLength(),
        };
    }

    // Gradual Hub appearance
    let currentFade = 0;
    if (progressRef.current >= boatVisibilityProgress) {
      const fadeEndProgress =
        boatVisibilityProgress + (1.0 - boatVisibilityProgress) * 0.775;
      const t = THREE.MathUtils.clamp(
        (progressRef.current - boatVisibilityProgress) /
          (fadeEndProgress - boatVisibilityProgress),
        0,
        1
      );
      currentFade = t * (2 - t);
    }
    maxHubFadeRef.current = Math.max(maxHubFadeRef.current, currentFade);
    const effectiveFade = maxHubFadeRef.current;

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

    // Evaluate camera position and orientation along the exact continuous Blender curves
    const journeyPos = curve.getPointAt(progressRef.current);
    const isTeleported = isTeleportedRef.current;
    const marsTravel = marsTravelRef.current.value;
    const plungeTravel = plungeTravelRef.current.value;
    const depTravel = departureTravelRef.current.value;
    const depAlign = departureAlignRef.current.value;

    let currentPos: THREE.Vector3;
    let forwardDir: THREE.Vector3;
    let baseTarget: THREE.Vector3;

    if (isTeleported) {
      if (plungeTravel > 0.0001) {
        // Plunging from Mars wormhole exit into singularity throat void during return to Hub
        const marsExitPt = marsCurve.getPointAt(0);
        const marsTangent = marsCurve.getTangentAt(0).normalize();
        const marsThroatPt = marsExitPt.clone().addScaledVector(marsTangent, -20);
        currentPos = new THREE.Vector3().lerpVectors(
          marsExitPt,
          marsThroatPt,
          plungeTravel
        );
        forwardDir = marsTangent.clone().negate();
        baseTarget = marsThroatPt.clone().addScaledVector(marsTangent, -10);
      } else {
        // In Mars environment: traveling along Mars camera path (Resting 1 -> 2 -> 3)
        currentPos = marsCurve.getPointAt(marsTravel);
        forwardDir = marsCurve.getTangentAt(marsTravel).normalize();

        // Target is computed as a pure spatial function of u: zero 180-degree flip during reverse
        baseTarget = getMarsLookTarget(
          marsTravel,
          marsCurve,
          markers.marsCameraPointer1,
          markers.marsCameraPointer2,
          markers.marsCameraPointer3
        );
      }
    } else if (plungeTravel > 0.0001) {
      // Plunging from Hub wormhole entrance into pitch-black singularity throat void
      const whEntry = departureCurve.getPointAt(1.0);
      const whThroat = new THREE.Vector3(-407.8, 26.81, -23.125);
      currentPos = new THREE.Vector3().lerpVectors(whEntry, whThroat, plungeTravel);
      forwardDir = new THREE.Vector3().subVectors(whThroat, whEntry).normalize();
      baseTarget = whThroat.clone().addScaledVector(forwardDir, 10);
    } else if (depTravel > 0.0001) {
      // Moving along departure path through hallway
      currentPos = departureCurve.getPointAt(depTravel);
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
      currentPos = journeyPos;
      const depStartTangent = departureCurve.getTangentAt(0).normalize();
      forwardDir = depStartTangent;
      const exitLookTarget = journeyPos.clone().addScaledVector(depStartTangent, 15);
      baseTarget = new THREE.Vector3().lerpVectors(
        markers.cameraPointer,
        exitLookTarget,
        depAlign
      );
    } else {
      // Along main village journey path
      currentPos = journeyPos;
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

      const hubLookBlend = THREE.MathUtils.smoothstep(progressRef.current, 0.88, 1.0);
      baseTarget = new THREE.Vector3().lerpVectors(
        curveTarget,
        markers.cameraPointer,
        hubLookBlend
      );
    }
    camera.position.copy(currentPos);

    // Calculate lateral mouse look angle without affecting position or roll
    const rawLookForward = baseTarget.clone().sub(currentPos).normalize();
    const lookForward =
      rawLookForward.lengthSq() < 0.0001 ? forwardDir.clone() : rawLookForward;
    const lookRight = new THREE.Vector3().crossVectors(lookForward, WORLD_UP).normalize();

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
