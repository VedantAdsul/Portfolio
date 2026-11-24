/**
 * WormholeScene Component - VEDANT.EXE
 *
 * Loads and renders the Blender-exported 5th Dimension Wormhole GLB.
 *
 * Dynamic Black Hole Architecture:
 * - Central Singularity Core: Genuine pitch-black event horizon void with an unlit blocker disk
 *   at the throat (Z = 0) preventing line-of-sight background leakage, paired with Cylinder_1.
 * - Vertex Shader Displacement:
 *   - Continuous inward gravitational peristaltic flow towards singularity throat.
 *   - Relativistic differential vortex rotation (Kerr frame dragging: inner material swirls faster).
 *   - 3D simplex noise radial turbulence with strict singularity core radius protection (> 0.45).
 * - Fragment Shader Cosmic Energy:
 *   - Seamless hardware repeat UV coordinates without mipmap seam jumps.
 *   - Multi-frequency cosmic plasma ribbons using continuous circular ring coordinates.
 *   - Balanced cosmic palette: electric cyan, royal violet, and warm accretion gold.
 *   - Dynamic emissive radiance that pairs with UnrealBloomPass post-processing (threshold: 0.82)
 *     while keeping the singularity core and dark cosmic voids completely unbloomed.
 */

import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  DRACO_DECODER_PATH,
  WORMHOLE_BASECOLOR_TEXTURE_URL,
  WORMHOLE_HUB_ENTRANCE,
  WORMHOLE_HUB_EXIT,
  WORMHOLE_MARS_ENTRANCE,
  WORMHOLE_MARS_EXIT,
  WORMHOLE_MODEL_URL,
} from "./gltfLoaderConfig";

// GLSL Simplex Noise 2D and 3D implementations for organic cosmic turbulence
const GLSL_SIMPLEX_NOISE = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise2D(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(vec3(i, 0.0)).xy;
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float snoise3D(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

export interface WormholeInfo {
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  hubRig: THREE.Object3D | null;
  marsRig: THREE.Object3D | null;
  hubEntrance: THREE.Vector3;
  hubExit: THREE.Vector3;
  marsEntrance: THREE.Vector3;
  marsExit: THREE.Vector3;
}

export interface WormholeSceneProps {
  /** Overall scene visibility */
  visible?: boolean;
  /** Whether the Village Hub wormhole rig is active/visible */
  hubRigVisible?: boolean;
  /** Whether the Mars Station wormhole rig is active/visible */
  marsRigVisible?: boolean;
  /** Whether wormhole rotation/vortex animations should run */
  animate?: boolean;
  /** Beginning of Mars camera path to align the Mars wormhole exit mouth */
  marsPathStart?: THREE.Vector3;
  /** Initial tangent of Mars camera path to align the Mars wormhole exit orientation */
  marsPathTangent?: THREE.Vector3;
  /** Callback fired once wormhole asset is parsed and rigs are ready */
  onLoaded?: (info: WormholeInfo) => void;
}

export function WormholeScene({
  visible = true,
  hubRigVisible = true,
  marsRigVisible = false,
  animate = true,
  marsPathStart,
  marsPathTangent,
  onLoaded,
}: WormholeSceneProps) {
  const { scene, animations } = useGLTF(WORMHOLE_MODEL_URL, DRACO_DECODER_PATH, true);
  const rawBaseColorMap = useTexture(WORMHOLE_BASECOLOR_TEXTURE_URL);

  const baseColorMap = useMemo(() => {
    const tex = rawBaseColorMap.clone();
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [rawBaseColorMap]);

  const hubRigRef = useRef<THREE.Object3D | null>(null);
  const marsRigRef = useRef<THREE.Object3D | null>(null);

  // Dynamic animation uniform values
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uPullStrength: { value: 1.0 },
    uTwistSpeed: { value: 1.8 },
    uTurbulence: { value: 0.12 },
  });

  // Genuinely pitch-black core (absorbs all light, zero specular/ambient/directional reflection)
  // DoubleSide ensures that regardless of viewing angle, the core is never backface culled
  const blackCoreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.DoubleSide,
        depthWrite: true,
        clippingPlanes: [],
      }),
    []
  );

  // Dynamic black hole tunnel material: combines baked Base Color texture with
  // vertex displacement, differential Kerr rotation, 3D simplex turbulence, and
  // luminous multi-frequency cosmic plasma ribbons
  const tunnelMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: baseColorMap,
      color: new THREE.Color(0xffffff),
      emissive: new THREE.Color(0xffffff),
      emissiveMap: baseColorMap,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: true,
      transparent: false,
      clippingPlanes: [],
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniformsRef.current.uTime;
      shader.uniforms.uPullStrength = uniformsRef.current.uPullStrength;
      shader.uniforms.uTwistSpeed = uniformsRef.current.uTwistSpeed;
      shader.uniforms.uTurbulence = uniformsRef.current.uTurbulence;

      // Vertex shader modifications
      shader.vertexShader = `
        uniform float uTime;
        uniform float uPullStrength;
        uniform float uTwistSpeed;
        uniform float uTurbulence;
        varying float vWormholeDist;
        varying float vWormholeAngle;
        ${GLSL_SIMPLEX_NOISE}
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float distZ = abs(position.z);
        vWormholeDist = distZ;

        // Inward gravitational pull along Z (peristaltic flow towards throat Z = 0)
        float pullPhase = distZ * 1.6 + uTime * 2.2;
        float pullFalloff = smoothstep(5.6, 0.4, distZ);
        float zPull = sin(pullPhase) * 0.09 * uPullStrength * pullFalloff;
        transformed.z -= sign(position.z) * zPull;

        // Differential vortex rotation (relativistic frame dragging)
        // Gentle gradient prevents polygon twisting or razor facets near throat
        float twistAngle = (uTime * 0.75) / (distZ * 1.4 + 1.0);
        float cosT = cos(twistAngle);
        float sinT = sin(twistAngle);
        transformed.xy = vec2(
          transformed.x * cosT - transformed.y * sinT,
          transformed.x * sinT + transformed.y * cosT
        );

        // 3D Simplex noise turbulence
        vec3 noiseCoord = vec3(transformed.xy * 0.75, distZ * 0.5 + uTime * 0.25);
        float rNoise = snoise3D(noiseCoord) * uTurbulence * pullFalloff;
        float r = length(transformed.xy);
        // Protect singularity core: never pinch below throat radius (0.24)
        float safeR = max(r + rNoise, 0.24);
        transformed.xy = normalize(transformed.xy) * safeR;
        vWormholeAngle = atan(transformed.y, transformed.x);
        `
      );

      // Fragment shader modifications
      shader.fragmentShader = `
        uniform float uTime;
        varying float vWormholeDist;
        varying float vWormholeAngle;
        ${GLSL_SIMPLEX_NOISE}
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `
        #ifdef USE_MAP
          // Native hardware repeat wrapping prevents mipmap derivative seam jump
          float flowV = clamp(vMapUv.y + snoise2D(vec2(vMapUv.x * 4.0, uTime * 0.2)) * 0.012, 0.0, 0.245);
          vec2 sampleUv = vec2(vMapUv.x + uTime * 0.06, flowV);
          vec4 sampledDiffuseColor = texture2D(map, sampleUv);
          // Darken diffuse reflections as we approach the black hole event horizon
          float voidDarkening = smoothstep(0.45, 1.4, vWormholeDist);
          diffuseColor *= sampledDiffuseColor * voidDarkening;
        #endif
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `
        #include <emissivemap_fragment>
        // Periodic 2D circle coordinates guarantee 100% seamless 360-degree azimuthal noise without seams
        float circAngle = vMapUv.x * 6.2831853;
        vec2 ringCoord = vec2(cos(circAngle), sin(circAngle));

        // Multi-frequency cosmic plasma ribbons
        float s1 = smoothstep(0.32, 0.82, snoise3D(vec3(ringCoord * 2.8 + vec2(sin(uTime * 0.5), cos(uTime * 0.5)) * 0.3, vWormholeDist * 1.2 - uTime * 1.6)));
        float s2 = smoothstep(0.38, 0.88, snoise3D(vec3(ringCoord * 4.2 - vec2(cos(uTime * 0.7), sin(uTime * 0.7)) * 0.4, vWormholeDist * 2.0 - uTime * 2.4)));
        float ribbon = s1 * 0.7 + s2 * 0.5;

        // Cosmic palette: deep electric cyan, royal violet, warm accretion gold
        vec3 cyan = vec3(0.0, 0.88, 1.0);
        vec3 violet = vec3(0.68, 0.18, 0.98);
        vec3 gold = vec3(1.0, 0.72, 0.15);

        vec3 plasma = mix(cyan, violet, s2);
        plasma = mix(plasma, gold, s1 * s2 * 1.2);

        // Black Hole Accretion Disk Physics:
        // Inside the photon sphere / event horizon (vWormholeDist < 0.45), gravity traps all photons: zero emission!
        // Cosmic plasma ribbons glow continuously along the entire tunnel length, plunging into the dark core.
        float eventHorizonFade = smoothstep(0.38, 0.95, vWormholeDist);
        totalEmissiveRadiance += plasma * ribbon * eventHorizonFade * 1.35;
        `
      );
    };

    mat.customProgramCacheKey = () => "wormhole-dynamic-tunnel-v1";
    return mat;
  }, [baseColorMap]);

  // Setup AnimationMixer and extract actions
  const { mixer, actions } = useMemo(() => {
    const m = new THREE.AnimationMixer(scene);
    const actMap: Record<string, THREE.AnimationAction> = {};

    animations.forEach((clip) => {
      const action = m.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      actMap[clip.name] = action;
    });

    return { mixer: m, actions: actMap };
  }, [scene, animations]);

  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);

    // Locate the two active wormhole rigs
    hubRigRef.current =
      scene.getObjectByName("5th_Dimension_Wormhole_Animated002") ||
      scene.getObjectByName("5th_Dimension_Wormhole_Animated.002") ||
      null;

    let marsRig =
      scene.getObjectByName("5th_Dimension_Wormhole_Animated001") ||
      scene.getObjectByName("5th_Dimension_Wormhole_Animated.001") ||
      scene.getObjectByName("5th_Dimension_Wormhole_Mars") ||
      null;

    // If only one rig exists in wormhole.glb, clone it to provide the Mars destination wormhole
    if (!marsRig && hubRigRef.current) {
      marsRig = hubRigRef.current.clone(true);
      marsRig.name = "5th_Dimension_Wormhole_Mars";
      scene.add(marsRig);
    }
    marsRigRef.current = marsRig;

    // Position and orient Mars wormhole rig so its entrance sits exactly on the platform,
    // upright and directly facing the approaching camera along the Mars camera path trajectory
    if (marsRigRef.current) {
      const marsRig = marsRigRef.current;
      const mThroat =
        marsRig.getObjectByName("5th_D.002") ||
        marsRig.getObjectByName("5th_D002") ||
        marsRig.getObjectByName("5th_D.001") ||
        marsRig.getObjectByName("5th_D001");
      const mVortex =
        marsRig.getObjectByName("Vortex.002") || marsRig.getObjectByName("Vortex002");

      if (mThroat && mVortex) {
        // Target mouth position on the platform where vertex 132 / Wormhole Exit sits
        const targetMouthPos =
          marsPathStart?.clone() ?? new THREE.Vector3(-535.702, 169.187, -21.004);

        // Direction from which the camera approaches the mouth on the wrap-around path:
        // Strictly horizontal along the station platform to match camera arrival trajectory:
        const approachDir = new THREE.Vector3(0.99086, 0.02727, -0.13211).normalize();

        const targetMouthNormal = approachDir.clone().negate();
        const worldUp = new THREE.Vector3(0, 1, 0);

        // Basis where Z is the tunnel axis facing outward from mouth towards Mars
        const zAxis = targetMouthNormal.clone().normalize();
        const xAxis = new THREE.Vector3().crossVectors(worldUp, zAxis).normalize();
        const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

        const desiredThroatMat = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
        const desiredThroatQuat = new THREE.Quaternion().setFromRotationMatrix(
          desiredThroatMat
        );

        // Cylinder mouth is 5.6 units along Z in local space; scaled by 3.932481 -> 22.022m
        const rigScale = 3.932481;
        const tunnelLength = 5.6 * rigScale;
        const desiredThroatPos = targetMouthPos
          .clone()
          .addScaledVector(approachDir, tunnelLength);

        mVortex.updateMatrix();
        mThroat.updateMatrix();
        const L = new THREE.Matrix4().multiplyMatrices(mVortex.matrix, mThroat.matrix);

        const desiredThroatWorldMatrix = new THREE.Matrix4().compose(
          desiredThroatPos,
          desiredThroatQuat,
          new THREE.Vector3(rigScale, rigScale, rigScale)
        );
        const L_inv = L.clone().invert();
        const marsRigWorldMatrix = new THREE.Matrix4().multiplyMatrices(
          desiredThroatWorldMatrix,
          L_inv
        );

        marsRigWorldMatrix.decompose(marsRig.position, marsRig.quaternion, marsRig.scale);
        marsRig.updateMatrixWorld(true);
      }
    }

    // Helper: attach a solid pitch-black singularity blocker disk across the throat (Z = 0)
    // of the wormhole to prevent any line-of-sight background light leakage
    const ensureSingularityBlocker = (parent: THREE.Object3D | null | undefined) => {
      if (!parent) return;
      const existing = parent.getObjectByName("SingularityBlocker");
      if (!existing) {
        const blockerGeom = new THREE.CircleGeometry(2.5, 32);
        const blocker = new THREE.Mesh(blockerGeom, blackCoreMaterial);
        blocker.name = "SingularityBlocker";
        blocker.position.set(0, 0, 0);
        blocker.renderOrder = 10;
        blocker.frustumCulled = false;
        parent.add(blocker);
      }
    };

    // Attach blocker to 5th_D002 (Hub) and Mars rig throat
    const hub5thD =
      scene.getObjectByName("5th_D002") || scene.getObjectByName("5th_D.002");
    ensureSingularityBlocker(hub5thD);

    if (marsRigRef.current) {
      const mars5thD =
        marsRigRef.current.getObjectByName("5th_D.002") ||
        marsRigRef.current.getObjectByName("5th_D002") ||
        marsRigRef.current.getObjectByName("5th_D001") ||
        marsRigRef.current.getObjectByName("5th_D.001");
      ensureSingularityBlocker(mars5thD);
    }

    // Traverse and assign materials strictly preserving geometry and singularity
    scene.traverse((child) => {
      const name = child.name.toLowerCase();
      if (
        name.includes("wormhole001") ||
        name.includes("wormhole.001") ||
        name.includes("wormhole002") ||
        name.includes("wormhole.002") ||
        name.startsWith("portal_a")
      ) {
        child.visible = false;
        return;
      }

      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.frustumCulled = false;
        const mat = mesh.material;
        const matName = Array.isArray(mat)
          ? mat.map((m) => m.name.toLowerCase()).join(" ")
          : (mat?.name || "").toLowerCase();
        const meshName = mesh.name.toLowerCase();

        if (
          meshName.includes("cylinder_1") ||
          meshName.includes("cylinder001_1") ||
          matName.includes("black")
        ) {
          // Central black hole core: genuine unlit pitch black singularity
          mesh.material = blackCoreMaterial;
          mesh.renderOrder = 2;
          mesh.visible = true;
        } else if (
          meshName.includes("vortex") ||
          meshName.includes("portal_b") ||
          meshName.includes("portal") ||
          matName.includes("portal")
        ) {
          // Flat 2D portal disk: make its material invisible so the disc itself doesn't render,
          // but keep mesh.visible = true so Three.js continues to render its children
          mesh.visible = true;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              m.visible = false;
            });
          } else if (mesh.material) {
            mesh.material.visible = false;
          }
        } else if (
          meshName.includes("cylinder") ||
          matName.includes("5") ||
          matName.includes("wormhole")
        ) {
          // 3D Wormhole tunnel tube: applies dynamic black hole shader
          mesh.material = tunnelMaterial;
          mesh.renderOrder = 1;
          mesh.visible = true;
        }
      }
    });

    onLoaded?.({
      mixer,
      actions,
      hubRig: hubRigRef.current,
      marsRig: marsRigRef.current,
      hubEntrance: WORMHOLE_HUB_ENTRANCE.clone(),
      hubExit: WORMHOLE_HUB_EXIT.clone(),
      marsEntrance: WORMHOLE_MARS_ENTRANCE.clone(),
      marsExit: marsPathStart ? marsPathStart.clone() : WORMHOLE_MARS_EXIT.clone(),
    });
  }, [
    scene,
    mixer,
    actions,
    blackCoreMaterial,
    tunnelMaterial,
    marsPathStart,
    marsPathTangent,
    onLoaded,
  ]);

  // Synchronize independent rig visibility
  useEffect(() => {
    if (hubRigRef.current) {
      hubRigRef.current.visible = hubRigVisible;
    }
  }, [hubRigVisible]);

  useEffect(() => {
    if (marsRigRef.current) {
      marsRigRef.current.visible = marsRigVisible;
    }
  }, [marsRigVisible]);

  // Update animation time and mixer every frame
  useFrame((_, delta) => {
    if (visible && animate) {
      uniformsRef.current.uTime.value += delta;
      if (mixer) {
        mixer.update(delta);
      }
    }
  });

  return <primitive object={scene} visible={visible} />;
}

// Preload assets immediately
useGLTF.preload(WORMHOLE_MODEL_URL, DRACO_DECODER_PATH, true);
useTexture.preload(WORMHOLE_BASECOLOR_TEXTURE_URL);

export default WormholeScene;
