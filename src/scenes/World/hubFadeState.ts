/**
 * Hub Fade State - VEDANT.EXE
 *
 * Imperative state container bridging camera path progress and Hub material opacity.
 * Avoids triggering 60 FPS React re-renders across the component tree.
 *
 * - CameraRig writes `fade` [0.0 - 1.0] and `visible` [boolean] in its `useFrame` loop.
 * - HubScene reads `fade` in its own `useFrame` loop to update material opacities
 *   directly on WebGL uniforms without shader recompilation.
 */

export interface HubFadeState {
  /** Normalized fade-in progress from Boat_Visibility (0.0) to Hub_Resting (1.0) */
  fade: number;
  /** Whether the Hub has been revealed by crossing the Boat_Visibility marker */
  visible: boolean;
}

export const hubFadeState: HubFadeState = {
  fade: 0,
  visible: false,
};

if (typeof window !== "undefined") {
  (window as unknown as { __HUB_FADE_STATE__: HubFadeState }).__HUB_FADE_STATE__ =
    hubFadeState;
}
