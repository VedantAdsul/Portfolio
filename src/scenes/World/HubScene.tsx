/**
 * HubScene Component
 *
 * Loads and renders the Blender-exported Central Hub GLB.
 * Preloaded in advance but initially hidden until the camera crosses
 * the `Boat Visibility` marker during the journey.
 *
 * Preserves original world coordinates, scale, and rotation of the asset.
 * Applies the verified Minecraft-authentic texture filtering and
 * translucent water material treatment (FrontSide, depthWrite, no castShadow).
 */

import { useGLTF } from "@react-three/drei";
import { useEffect, useLayoutEffect } from "react";
import * as THREE from "three";
import { DRACO_DECODER_PATH } from "./VillageScene";

export const HUB_MODEL_URL = "/assets/world/hub.glb";

const TRANSLUCENT_MATERIAL_REGEX = /glass|water|ice|stained/i;

export interface HubSceneProps {
  visible?: boolean;
  onLoaded?: () => void;
}

export function HubScene({ visible = false, onLoaded }: HubSceneProps) {
  const { scene } = useGLTF(HUB_MODEL_URL, DRACO_DECODER_PATH);

  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);

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
            mesh.castShadow = false;
            mesh.receiveShadow = true;
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
              mat.transparent = true;
              mat.depthWrite = true;
              mat.side = THREE.FrontSide;
              mat.needsUpdate = true;
            } else if (mat.transparent && !TRANSLUCENT_MATERIAL_REGEX.test(mat.name)) {
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
    <group visible={visible}>
      {/* Actual Hub geometry */}
      <primitive object={scene} />
    </group>
  );
}

// Preload the Central Hub GLB asset in background
useGLTF.preload(HUB_MODEL_URL, DRACO_DECODER_PATH);

export default HubScene;
