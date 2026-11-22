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
import { DRACO_DECODER_PATH, VILLAGE_MODEL_URL } from "./gltfLoaderConfig";

export { VILLAGE_MODEL_URL, DRACO_DECODER_PATH };

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

        if (mesh.material) {
          const materials = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];

          const isWaterMesh =
            /water/i.test(mesh.name) || materials.some((m) => /water/i.test(m.name));

          const isTranslucentMesh = materials.some((m) =>
            TRANSLUCENT_MATERIAL_REGEX.test(m.name)
          );

          if (isWaterMesh) {
            // Water should receive shadows but never cast solid black shadows on riverbeds
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            // Render water after opaque terrain (0) and before window glass (2)
            mesh.renderOrder = 1;
          } else if (isTranslucentMesh) {
            mesh.castShadow = false;
            mesh.receiveShadow = true;
            mesh.renderOrder = 2;
          } else {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }

          materials.forEach((mat) => {
            // Apply Minecraft-authentic nearest-neighbor texture sampling
            if ("map" in mat && mat.map) {
              const texture = mat.map as THREE.Texture;
              texture.magFilter = THREE.NearestFilter;
              texture.minFilter = THREE.NearestMipmapLinearFilter;
              texture.needsUpdate = true;
            }

            if (/water/i.test(mat.name)) {
              // Fix water rendering:
              // 1. depthWrite: true ensures the front surface writes depth, occluding
              //    internal/stepped water faces and eliminating multi-layer alpha stacking
              //    that causes patchy dark blue blocks and visible seams.
              // 2. side: THREE.FrontSide enables backface culling, discarding downward-facing
              //    bottom faces and backfaces that cause double-blending and z-fighting.
              mat.transparent = true;
              mat.depthWrite = true;
              mat.side = THREE.FrontSide;
              mat.needsUpdate = true;
            } else if (mat.transparent && !TRANSLUCENT_MATERIAL_REGEX.test(mat.name)) {
              // Alpha cutout handling for Minecraft foliage, doors, rails, and saplings
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
