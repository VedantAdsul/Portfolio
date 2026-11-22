/**
 * WormholeBloom Component - VEDANT.EXE
 *
 * Implements high-performance post-processing light diffusion and bloom
 * for the wormhole and black hole cosmic energy ribbons using Three.js's
 * standard UnrealBloomPass and EffectComposer.
 *
 * Visual Characteristics:
 * - Controlled bloom: Soft, ethereal aura around luminous emissive ribbons (strength: 0.42, radius: 0.5).
 * - High threshold (0.82): Strictly prevents bloom from blowing out or washing out the funnel.
 * - Singularity protection: Pitch-black singularity core (RGB = 0, 0, 0) is far below threshold,
 *   remaining a dark gravitational void.
 * - Standard sRGB color management preserved via OutputPass.
 */

import { useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export interface WormholeBloomProps {
  /** Whether the post-processing bloom effect is enabled */
  enabled?: boolean;
  /** Bloom intensity / brightness (default: 0.42 for controlled ethereal glow) */
  strength?: number;
  /** Diffusion spread radius (default: 0.5) */
  radius?: number;
  /** Luminance threshold above which pixels glow (default: 0.82) */
  threshold?: number;
}

export function WormholeBloom({
  enabled = true,
  strength = 0.35,
  radius = 0.4,
  threshold = 0.85,
}: WormholeBloomProps) {
  const { gl, scene, camera, size } = useThree();

  // Initialize EffectComposer pipeline
  const composer = useMemo(() => {
    const comp = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      strength,
      radius,
      threshold
    );
    const outputPass = new OutputPass();

    comp.addPass(renderPass);
    comp.addPass(bloom);
    comp.addPass(outputPass);
    comp.setSize(size.width, size.height);

    return comp;
  }, [gl, scene, camera, strength, radius, threshold, size.width, size.height]);

  // Keep composer size in sync with viewport changes
  useEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);

  // Cleanup composer on unmount or reconfiguration
  useEffect(() => {
    return () => {
      composer.dispose();
    };
  }, [composer]);

  // Fixed priority 1 in R3F render loop:
  // When enabled, renders through EffectComposer with UnrealBloomPass and OutputPass.
  // When disabled, renders scene directly with standard renderer.
  useFrame(({ gl: renderer, scene: sc, camera: cam }, delta) => {
    if (enabled) {
      composer.render(delta);
    } else {
      renderer.render(sc, cam);
    }
  }, 1);

  return null;
}

export default WormholeBloom;
