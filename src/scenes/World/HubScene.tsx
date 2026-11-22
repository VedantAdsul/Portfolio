/**
 * HubScene Component - VEDANT.EXE
 *
 * Loads and renders the Blender-exported Central Hub GLB.
 * Preloaded in advance but initially hidden until the camera crosses
 * the `Boat_Visibility` marker during the journey.
 *
 * Imperative Gradual Fade-in:
 * - Reads `hubFadeState.fade` imperatively in `useFrame`, completely eliminating
 *   60 FPS React re-renders across the component tree.
 * - Clones materials once on initial load to avoid mutating shared GLTF cache.
 * - Updates material opacity purely through WebGL uniform floats (`mat.opacity = ...`)
 *   WITHOUT calling `mat.needsUpdate = true`, preventing WebGL shader recompilation stalls.
 * - Preserves `depthWrite: true` and nearest-neighbor texture filtering for crisp voxels
 *   with no sorting or z-fighting glitches.
 */

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { DRACO_DECODER_PATH, HUB_MODEL_URL } from "./gltfLoaderConfig";
import { hubFadeState } from "./hubFadeState";

export { HUB_MODEL_URL };

const TRANSLUCENT_MATERIAL_REGEX = /glass|water|ice|stained/i;

interface OriginalMaterialData {
  originalMaterials: THREE.Material[];
  originalOpacities: number[];
  originalTransparents: boolean[];
  originalDepthWrites: boolean[];
}

interface ManagedMaterialInfo {
  material: THREE.Material;
  origOpacity: number;
  isTranslucent: boolean;
}

export interface HubSceneProps {
  /** Overall visibility toggle */
  visible?: boolean;
  /** Callback fired once Hub asset is parsed */
  onLoaded?: () => void;
}

export function HubScene({ visible = false, onLoaded }: HubSceneProps) {
  const { scene } = useGLTF(HUB_MODEL_URL, DRACO_DECODER_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const managedMaterialsRef = useRef<ManagedMaterialInfo[]>([]);
  const currentFadeRef = useRef<number>(-1);
  const isFullySolidRef = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    managedMaterialsRef.current = [];

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (mesh.material) {
          // 1. Capture pristine original materials and opacities ONCE on mesh.userData
          // so that React 19 StrictMode remounts or hot reloads NEVER read an already-zeroed opacity.
          if (!mesh.userData.__origMatData) {
            const rawMats = (
              Array.isArray(mesh.material) ? mesh.material : [mesh.material]
            ) as THREE.Material[];

            const origData: OriginalMaterialData = {
              originalMaterials: [...rawMats],
              originalOpacities: rawMats.map((m) => {
                const op = typeof m.opacity === "number" ? m.opacity : 1.0;
                return op;
              }),
              originalTransparents: rawMats.map((m) => m.transparent ?? false),
              originalDepthWrites: rawMats.map((m) => m.depthWrite ?? true),
            };
            mesh.userData.__origMatData = origData;
          }

          const origData = mesh.userData.__origMatData as OriginalMaterialData;
          const isArray = Array.isArray(mesh.material);

          // 2. Clone from pristine original materials, never mutating shared GLTF cache
          const clonedMats = origData.originalMaterials.map((origMat, idx) => {
            const cloned = origMat.clone();

            // Minecraft nearest-neighbor pixel filtering
            if ("map" in cloned && cloned.map) {
              const texture = cloned.map as THREE.Texture;
              texture.magFilter = THREE.NearestFilter;
              texture.minFilter = THREE.NearestMipmapLinearFilter;
              texture.needsUpdate = true;
            }

            const isWaterMesh = /water/i.test(mesh.name) || /water/i.test(cloned.name);
            const isTranslucentMesh =
              isWaterMesh ||
              TRANSLUCENT_MATERIAL_REGEX.test(mesh.name) ||
              TRANSLUCENT_MATERIAL_REGEX.test(cloned.name);
            const isCutoutMesh =
              /door|bars|ladder|lantern|leaves|fence|rail/i.test(mesh.name) ||
              /door|bars|ladder|lantern|leaves|fence|rail/i.test(cloned.name);

            if (isWaterMesh) {
              mesh.castShadow = false;
              mesh.receiveShadow = true;
              mesh.renderOrder = 1;
              cloned.transparent = true;
              cloned.depthWrite = true;
              cloned.side = THREE.FrontSide;
            } else if (isTranslucentMesh) {
              mesh.castShadow = false;
              mesh.receiveShadow = true;
              mesh.renderOrder = 2;
              cloned.transparent = true;
              cloned.depthWrite = true;
            } else {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              cloned.transparent = true;
              cloned.depthWrite = true;
              if (isCutoutMesh) {
                cloned.alphaTest = 0.5;
              }
            }

            const origOpacity = origData.originalOpacities[idx];

            // Initialize opacity based on current fade progress
            const currentFade = Math.max(0, hubFadeState.fade);
            cloned.opacity = origOpacity * currentFade;

            managedMaterialsRef.current.push({
              material: cloned,
              origOpacity,
              isTranslucent: isTranslucentMesh,
            });

            return cloned;
          });

          mesh.material = isArray ? clonedMats : clonedMats[0];
        }
      }
    });

    return () => {
      // Restore pristine original materials so cached scene is never permanently mutated.
      // Avoid calling material.dispose() on cloned materials during unmount because React 19
      // StrictMode will immediately remount the scene and reuse WebGL texture contexts.
      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const origData = mesh.userData.__origMatData as
            OriginalMaterialData | undefined;
          if (origData) {
            mesh.material = Array.isArray(mesh.material)
              ? origData.originalMaterials
              : origData.originalMaterials[0];
          }
        }
      });
      managedMaterialsRef.current = [];
    };
  }, [scene]);

  useEffect(() => {
    onLoaded?.();
  }, [onLoaded]);

  // Imperative 60 FPS frame update: updates uniform float opacity directly on GPU
  // without triggering React state updates or WebGL shader recompilations
  useFrame(() => {
    const isRevealed = visible || hubFadeState.visible;
    const targetFade = hubFadeState.fade;

    if (groupRef.current) {
      groupRef.current.visible = isRevealed;
    }

    if (!isRevealed) return;

    // Once fully faded in (>= 0.999), restore solid opacity so only genuinely translucent
    // materials (water, glass) remain transparent, and all solid voxel blocks become fully opaque
    const isFullySolid = targetFade >= 0.999;
    if (isFullySolid !== isFullySolidRef.current) {
      isFullySolidRef.current = isFullySolid;
      const mats = managedMaterialsRef.current;
      for (let i = 0; i < mats.length; i++) {
        const item = mats[i];
        if (isFullySolid) {
          item.material.transparent = item.isTranslucent;
          item.material.depthWrite = true;
        } else {
          item.material.transparent = true;
          item.material.depthWrite = true;
        }
      }
    }

    if (Math.abs(currentFadeRef.current - targetFade) > 0.001) {
      currentFadeRef.current = targetFade;
      const mats = managedMaterialsRef.current;
      for (let i = 0; i < mats.length; i++) {
        const item = mats[i];
        item.material.opacity = item.origOpacity * targetFade;
      }
    }
  });

  return (
    <group ref={groupRef} visible={visible || hubFadeState.visible}>
      <primitive object={scene} />
    </group>
  );
}

// Preload the Central Hub GLB asset in background
useGLTF.preload(HUB_MODEL_URL, DRACO_DECODER_PATH);

export default HubScene;
