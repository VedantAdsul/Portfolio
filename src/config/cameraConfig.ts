/**
 * Centralized Camera Configuration - VEDANT.EXE
 *
 * File path: src/config/cameraConfig.ts
 *
 * Exposes all route section speeds, scroll physics, transition timings,
 * and navigation boundary behaviors for manual calibration.
 *
 * Units:
 * - Speed: World units (Minecraft blocks / meters) per second (units/s)
 * - Durations: Seconds (s)
 * - Progress: Normalized path parameter [0.0 - 1.0]
 * - Angles: Radians (rad)
 */

export interface RouteSectionConfig {
  /** Unique section identifier */
  id: string;
  /** Human-readable section name */
  name: string;
  /** Section start parameter on the main journey Catmull-Rom path [0.0 - 1.0] */
  startProgress: number;
  /** Section end parameter on the main journey Catmull-Rom path [0.0 - 1.0] */
  endProgress: number;
  /**
   * Autonomous traversal speed in world units (blocks) per second.
   * Total journey path length is ~573.2 world units.
   * Changing this value tunes only this section's speed without affecting others.
   */
  speedUnitsPerSec: number;
  /** Detailed description of the route section */
  description: string;
}

export interface DepartureRouteConfig {
  /** Route identifier */
  id: string;
  /** Route name */
  name: string;
  /**
   * Phase 1: Duration in seconds to smoothly rotate/align the camera from
   * looking at Camera Pointer to facing the exit hallway direction.
   * The camera position remains stationary at Hub Resting during this phase.
   */
  alignmentDurationSec: number;
  /** GSAP easing curve for Phase 1 alignment */
  alignmentEase: string;
  /**
   * Phase 2: Duration in seconds to travel along the traced departure path
   * through the hallway, archway, and stairs to Next Area (Workshop).
   */
  travelDurationSec: number;
  /** GSAP easing curve for Phase 2 travel */
  travelEase: string;
  /**
   * Return Phase 1: Duration in seconds to retrace the departure path
   * backwards from Next Area back to Hub Resting.
   */
  returnTravelDurationSec: number;
  /** GSAP easing curve for return travel */
  returnTravelEase: string;
  /**
   * Return Phase 2: Duration in seconds to smoothly rotate camera view
   * from the exit direction back to looking at Camera Pointer.
   */
  returnAlignmentDurationSec: number;
  /** GSAP easing curve for return alignment */
  returnAlignmentEase: string;
  /** Detailed description */
  description: string;
}

export interface ScrollDynamicsConfig {
  /** Scroll wheel impulse sensitivity multiplier applied per wheel event */
  scrollSensitivity: number;
  /** Maximum forward velocity boost in progress units per second achievable by scrolling down */
  maxForwardBoostProgress: number;
  /** Maximum reverse velocity in progress units per second achievable by scrolling up */
  maxReverseSpeedProgress: number;
  /** GSAP duration in seconds to smoothly accelerate when scroll wheel input starts */
  accelerationDurationSec: number;
  /** GSAP duration in seconds to smoothly ease back to base speed after scrolling stops */
  decelerationDurationSec: number;
  /** Inactivity timeout in milliseconds before scroll deceleration begins */
  inactivityTimeoutMs: number;
  /** Multiplier for scroll responsiveness on open water */
  waterScrollMultiplier: number;
}

export interface OrientationDynamicsConfig {
  /** Maximum horizontal mouse-look yaw angle in radians (~30 deg = 0.52 rad) */
  maxMouseLookAngleRad: number;
  /** Damping factor for mouse look horizontal recentering */
  mouseLookDamping: number;
  /** Damping factor for camera quaternion slerp alignment */
  cameraRotationDamping: number;
}

export interface CameraConfig {
  /** Speeds for each route section of the Mountain-to-Hub journey */
  routeSections: {
    mountainToVillage: RouteSectionConfig;
    villageToBoat: RouteSectionConfig;
    boatToHubResting: RouteSectionConfig;
  };
  /** Departure routes from Hub Resting to subsequent sections */
  departureRoutes: {
    hubRestingToNextArea: DepartureRouteConfig;
  };
  /** Bidirectional scroll physics and velocity bounds */
  scrollDynamics: ScrollDynamicsConfig;
  /** Camera orientation and mouse look dynamics */
  orientationDynamics: OrientationDynamicsConfig;
  /** Journey boundary constraints */
  boundaries: {
    /**
     * When true, scrolling up at Hub Resting is ignored and cannot move backwards
     * into the village. Hub Resting acts as a strict navigation boundary.
     */
    lockReverseAtHubResting: boolean;
  };
}

export const CAMERA_CONFIG: CameraConfig = {
  routeSections: {
    /**
     * Section 1: Mountain Peak -> Village Entrance
     * Swoops down from the mountain peak (Y=56.7) into the village entrance (Y=18.0).
     * Arc length: ~80.25 world units.
     */
    mountainToVillage: {
      id: "mountain-to-village",
      name: "Mountain -> Village",
      startProgress: 0.0,
      endProgress: 0.14,
      speedUnitsPerSec: 10.5,
      description: "Descent from mountain peak origin down into the village entrance.",
    },

    /**
     * Section 2: Village Entrance -> Boat Visibility Marker
     * Winds through the village streets, cobblestone stairs, market houses, and docks.
     * Arc length: ~367.20 world units.
     */
    villageToBoat: {
      id: "village-to-boat",
      name: "Village -> Boat",
      startProgress: 0.14,
      endProgress: 0.7806,
      speedUnitsPerSec: 10.5,
      description:
        "Traversal through the village paths and docks up to the Boat Visibility marker.",
    },

    /**
     * Section 3: Boat Visibility Marker -> Hub Resting
     * Glides across the open water bay, approaches the Hub dock/stairs, and docks at Hub Resting.
     * Arc length: ~125.76 world units.
     */
    boatToHubResting: {
      id: "boat-to-hub-resting",
      name: "Boat -> Hub Resting",
      startProgress: 0.7806,
      endProgress: 1.0,
      speedUnitsPerSec: 19.5,
      description:
        "Flight across the open water bay up to the Hub entrance and Hub Resting position.",
    },
  },

  departureRoutes: {
    /**
     * Hub Departure: Hub Resting -> Next Area (Workshop)
     * Traced along Blender curve vertices 67 down to 42 (arc length: ~117.60 world units).
     * Navigates up the hallway stairs and through door archways without clipping walls.
     */
    hubRestingToNextArea: {
      id: "hub-to-next-area",
      name: "Hub Resting -> Next Area",
      alignmentDurationSec: 0.85,
      alignmentEase: "power2.inOut",
      travelDurationSec: 2.2,
      travelEase: "power2.inOut",
      returnTravelDurationSec: 1.8,
      returnTravelEase: "power2.inOut",
      returnAlignmentDurationSec: 0.85,
      returnAlignmentEase: "power2.inOut",
      description:
        "Two-phase departure from Hub Resting: first aligns orientation to exit hallway, then travels along traced path.",
    },
  },

  scrollDynamics: {
    scrollSensitivity: 0.00045,
    maxForwardBoostProgress: 0.055,
    maxReverseSpeedProgress: 0.045,
    accelerationDurationSec: 0.22,
    decelerationDurationSec: 1.4,
    inactivityTimeoutMs: 160,
    waterScrollMultiplier: 1.5,
  },

  orientationDynamics: {
    maxMouseLookAngleRad: 0.52, // ~29.8 degrees max yaw
    mouseLookDamping: 3.8,
    cameraRotationDamping: 8.5,
  },

  boundaries: {
    lockReverseAtHubResting: true,
  },
};

/**
 * Calculates the autonomous path velocity (in progress units per second: du/dt)
 * for any given progress point along the main journey curve.
 *
 * Uses the physical speed (units/s) from CAMERA_CONFIG.routeSections and divides
 * by the total curve length (units) to yield du/dt. Smoothly interpolates across
 * section boundaries over a blend window to prevent velocity discontinuities.
 */
export function getJourneyProgressVelocity(
  progress: number,
  totalPathLength: number
): number {
  if (totalPathLength <= 0) return 0.018;

  const { mountainToVillage, villageToBoat, boatToHubResting } =
    CAMERA_CONFIG.routeSections;

  let physicalSpeed: number;

  if (progress < mountainToVillage.endProgress) {
    // Mountain to Village
    const blendZone = 0.02;
    if (progress > mountainToVillage.endProgress - blendZone) {
      const t = (progress - (mountainToVillage.endProgress - blendZone)) / blendZone;
      physicalSpeed = THREE_lerp(
        mountainToVillage.speedUnitsPerSec,
        villageToBoat.speedUnitsPerSec,
        t
      );
    } else {
      physicalSpeed = mountainToVillage.speedUnitsPerSec;
    }
  } else if (progress < villageToBoat.endProgress) {
    // Village to Boat
    const blendZone = 0.02;
    if (progress > villageToBoat.endProgress - blendZone) {
      const t = (progress - (villageToBoat.endProgress - blendZone)) / blendZone;
      physicalSpeed = THREE_lerp(
        villageToBoat.speedUnitsPerSec,
        boatToHubResting.speedUnitsPerSec,
        t
      );
    } else {
      physicalSpeed = villageToBoat.speedUnitsPerSec;
    }
  } else {
    // Boat to Hub Resting: smoothly ease speed down as we dock at Hub Resting (u > 0.94)
    if (progress > 0.94) {
      const easeT = (progress - 0.94) / 0.06;
      // Gently ease from full water speed down to docking speed (10.5 units/s)
      physicalSpeed = THREE_lerp(
        boatToHubResting.speedUnitsPerSec,
        villageToBoat.speedUnitsPerSec,
        easeT
      );
    } else {
      physicalSpeed = boatToHubResting.speedUnitsPerSec;
    }
  }

  // Convert physical speed (units/s) to path progress velocity (du/dt)
  return physicalSpeed / totalPathLength;
}

function THREE_lerp(x: number, y: number, t: number): number {
  return x + (y - x) * Math.max(0, Math.min(1, t));
}
