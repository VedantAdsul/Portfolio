/**
 * ResearchScene Component - VEDANT.EXE
 *
 * Loads and renders the Mars Research Station environment GLB.
 * Preloaded independently in advance under its own Suspense boundary so that
 * geometry, textures, and shaders are resident in GPU memory before teleportation.
 *
 * Stays hidden (visible={false}) throughout the initial village journey so it
 * consumes zero draw calls and cannot be seen behind the village terrain.
 */

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect } from "react";
import * as THREE from "three";
import { DRACO_DECODER_PATH, RESEARCH_MODEL_URL } from "./gltfLoaderConfig";

const TRANSLUCENT_MATERIAL_REGEX = /glass|water|ice|stained/i;

export interface ResearchSceneProps {
  /** Controls WebGL rendering visibility */
  visible?: boolean;
  /** Callback fired when Mars Station geometry and textures have finished mounting */
  onLoaded?: () => void;
}

export function ResearchScene({ visible = false, onLoaded }: ResearchSceneProps) {
  const { scene } = useGLTF(RESEARCH_MODEL_URL, DRACO_DECODER_PATH, true);

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
            mesh.receiveShadow = false;
          } else {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }

          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) {
                mat.map.magFilter = THREE.NearestFilter;
                mat.map.minFilter = THREE.NearestMipmapNearestFilter;
                mat.map.generateMipmaps = true;
                mat.map.needsUpdate = true;
              }

              if (isTranslucentMesh) {
                mat.transparent = true;
                mat.opacity = mat.opacity < 1 ? mat.opacity : 0.85;
                mat.depthWrite = true;
                mat.side = THREE.FrontSide;
              }
            }
          });
        }
      }
    });

    onLoaded?.();
  }, [scene, onLoaded]);

  return (
    <group name="ResearchScene_Root" visible={visible}>
      <primitive object={scene} />
    </group>
  );
}

// Preload Mars Station asset in advance
useGLTF.preload(RESEARCH_MODEL_URL, DRACO_DECODER_PATH, true);

export default ResearchScene;
