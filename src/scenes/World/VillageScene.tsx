/**
 * VillageScene Component
 *
 * Loads and renders the Blender-exported Minecraft village environment GLB.
 * Preserves original geometry, materials, and proportions while ensuring
 * crisp pixel-art texture filtering and shadow casting/receiving.
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect } from "react";
import * as THREE from "three";

export const VILLAGE_MODEL_URL = "/assets/world/village.glb";
export const DRACO_DECODER_PATH = "/draco/";

// Ensure Draco decoder loads locally from public/draco/ rather than external CDN
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

// Pattern to identify genuinely semi-transparent materials that should retain alpha blending
const TRANSLUCENT_MATERIAL_REGEX = /glass|water|ice|stained/i;

export interface VillageSceneProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  onLoaded?: () => void;
}

export function VillageScene({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  onLoaded,
}: VillageSceneProps) {
  const { scene } = useGLTF(VILLAGE_MODEL_URL, DRACO_DECODER_PATH);

  useLayoutEffect(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          materials.forEach((mat) => {
            // Apply Minecraft-authentic nearest-neighbor texture sampling
            if ("map" in mat && mat.map) {
              const texture = mat.map as THREE.Texture;
              texture.magFilter = THREE.NearestFilter;
              texture.minFilter = THREE.NearestMipmapLinearFilter;
              texture.needsUpdate = true;
            }

            // Alpha cutout handling for Minecraft foliage, doors, rails, and saplings
            if (mat.transparent && !TRANSLUCENT_MATERIAL_REGEX.test(mat.name)) {
              mat.alphaTest = 0.5;
              mat.depthWrite = true;
              mat.needsUpdate = true;
            }
          });
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  return (
    <primitive object={scene} position={position} rotation={rotation} scale={scale} />
  );
}

// Preload the environment with local Draco decoder to initiate background streaming
useGLTF.preload(VILLAGE_MODEL_URL, DRACO_DECODER_PATH);

export default VillageScene;
