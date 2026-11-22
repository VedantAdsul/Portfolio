/**
 * Centralized GLTF Loader Configuration - VEDANT.EXE
 *
 * Configures global Draco and Meshopt decompression decoders, asset URLs,
 * and unified preloading utilities for all 3D environment assets.
 *
 * Guarantees that both EXT_meshopt_compression and KHR_draco_mesh_compression
 * work seamlessly across all components without ad-hoc per-file configuration.
 */

import { useGLTF } from "@react-three/drei";
import { MeshoptDecoder } from "three-stdlib";
import * as THREE from "three";

// Path to local Draco WASM / JS decoder files in public/draco/
export const DRACO_DECODER_PATH = "/draco/";

// Verified 3D Asset URLs
export const VILLAGE_MODEL_URL = "/assets/world/village.glb";
export const HUB_MODEL_URL = "/assets/world/hub.glb";
export const WORMHOLE_MODEL_URL = "/assets/world/wormhole.glb";
export const RESEARCH_MODEL_URL = "/assets/world/research.glb";
export const CAMERA_PATH_VILLAGE_URL = "/assets/world/camera_path_village.glb";
export const CAMERA_PATH_MARS_URL = "/assets/world/camera_path_mars.glb";
export const CAMERA_PATH_LEGACY_URL = "/assets/world/camera_path.glb";
export const WORMHOLE_BASECOLOR_TEXTURE_URL = "/assets/textures/wormhole_basecolor.png";

// Measured entrance/exit coordinates from Blender and GLTF inspection
export const WORMHOLE_HUB_ENTRANCE = new THREE.Vector3(-385.97, 26.81, -22.6);
export const WORMHOLE_HUB_EXIT = new THREE.Vector3(-430.05, 26.81, -23.65);
export const WORMHOLE_MARS_ENTRANCE = new THREE.Vector3(-492.94, 171.07, -20.37);
export const WORMHOLE_MARS_EXIT = new THREE.Vector3(-537.01, 171.07, -21.41);

// Set global Draco decoder path once so all useGLTF calls find the local binaries
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

// Ensure MeshoptDecoder function instance is ready for three-stdlib / drei loaders
if (typeof MeshoptDecoder === "function") {
  try {
    MeshoptDecoder();
  } catch {
    // Already initialized or worker context
  }
}

/**
 * Preload all world models and camera path assets in parallel.
 * Preloading warms up the Three.js GLTF parser and decoders so mounting
 * any scene during runtime transitions is instantaneous.
 */
export function preloadAllWorldAssets(): void {
  useGLTF.preload(VILLAGE_MODEL_URL, DRACO_DECODER_PATH, true);
  useGLTF.preload(HUB_MODEL_URL, DRACO_DECODER_PATH, true);
  useGLTF.preload(WORMHOLE_MODEL_URL, DRACO_DECODER_PATH, true);
  useGLTF.preload(RESEARCH_MODEL_URL, DRACO_DECODER_PATH, true);
  useGLTF.preload(CAMERA_PATH_VILLAGE_URL, DRACO_DECODER_PATH, true);
  useGLTF.preload(CAMERA_PATH_MARS_URL, DRACO_DECODER_PATH, true);
}
