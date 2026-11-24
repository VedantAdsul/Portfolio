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
const CUTOUT_MATERIAL_REGEX =
  /leaves|bars|ladder|cobweb|flower|daisy|dandelion|poppy|grass|lever|sapling|rail/i;

// Hardware portal clipping plane:
// Clips any voxel blocks behind the Mars wormhole mouth plane (X > -535.702) that would
// otherwise penetrate into the hollow 3D wormhole cylinder and block the camera's view of the singularity.
const MARS_WORMHOLE_MOUTH = new THREE.Vector3(-535.702, 169.187, -21.004);
const MARS_WORMHOLE_APPROACH_DIR = new THREE.Vector3(
  0.99086,
  0.02727,
  -0.13211
).normalize();
const MARS_PORTAL_PLANE_NORMAL = MARS_WORMHOLE_APPROACH_DIR.clone().negate();
const MARS_PORTAL_CLIPPING_PLANE = new THREE.Plane().setFromNormalAndCoplanarPoint(
  MARS_PORTAL_PLANE_NORMAL,
  MARS_WORMHOLE_MOUTH
);

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

          const isCutoutMesh = materials.some((m) => CUTOUT_MATERIAL_REGEX.test(m.name));

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
            mat.clippingPlanes = [MARS_PORTAL_CLIPPING_PLANE];
            mat.clipShadows = true;

            if (mat instanceof THREE.MeshStandardMaterial) {
              if (mat.map) {
                mat.map.magFilter = THREE.NearestFilter;
                mat.map.minFilter = THREE.NearestMipmapLinearFilter;
                mat.map.colorSpace = THREE.SRGBColorSpace;
                mat.needsUpdate = true;
              }

              const matName = mat.name.toLowerCase();

              if (/sea_lantern/i.test(matName)) {
                // Calibrate sea lantern emission: authentic Minecraft cyan glow without blinding bloom blowout
                mat.transparent = false;
                mat.depthWrite = true;
                mat.emissive = new THREE.Color(0x3a8e9e);
                mat.emissiveIntensity = 0.35;
              } else if (/iron_block/i.test(matName)) {
                // Correct iron block material in isolation:
                // Blender glTF exported iron_block with default metallicFactor = 1.0 and specularFactor = 0,
                // which completely absorbs diffuse light and makes the block appear abnormally dark.
                // Reset metalness to 0.0 and roughness to 0.55 so the authentic light-gray Minecraft texture
                // scatters standard diffuse light identically to the rest of the voxel world.
                mat.transparent = false;
                mat.depthWrite = true;
                mat.metalness = 0.0;
                mat.roughness = 0.55;
                if ("specularIntensity" in mat) {
                  (mat as unknown as { specularIntensity: number }).specularIntensity =
                    0.4;
                }
                if ("specularColor" in mat) {
                  (mat as unknown as { specularColor: THREE.Color }).specularColor.setHex(
                    0xffffff
                  );
                }
              } else if (isTranslucentMesh || TRANSLUCENT_MATERIAL_REGEX.test(matName)) {
                mat.transparent = true;
                mat.opacity = mat.opacity < 1 ? mat.opacity : 0.85;
                mat.depthWrite = true;
                mat.side = THREE.FrontSide;
              } else if (isCutoutMesh || CUTOUT_MATERIAL_REGEX.test(matName)) {
                // Minecraft cutout foliage, cobwebs, bars
                mat.transparent = true;
                mat.alphaTest = 0.5;
                mat.depthWrite = true;
              } else {
                // Crucial fix: Blender exported solid blocks (andesite, stone_bricks, cobblestone,
                // smooth_stone, dirt, quartz, etc.) with alphaMode: "BLEND". Force transparent = false
                // and depthWrite = true so solid voxel geometry properly occludes and writes depth!
                mat.transparent = false;
                mat.depthWrite = true;
              }

              mat.needsUpdate = true;
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
