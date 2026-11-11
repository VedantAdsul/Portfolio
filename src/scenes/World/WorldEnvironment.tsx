/**
 * WorldEnvironment Component
 *
 * Configures the atmospheric palette, sky background, soft depth fog,
 * ambient ground bounce, and directional sunlight for the voxel world.
 * Exposes adjustable properties for lighting balance.
 */

export interface WorldEnvironmentProps {
  ambientIntensity?: number;
  sunIntensity?: number;
  sunPosition?: [number, number, number];
  backgroundColor?: string;
  enableFog?: boolean;
  fogNear?: number;
  fogFar?: number;
}

export function WorldEnvironment({
  ambientIntensity = 0.7,
  sunIntensity = 1.8,
  sunPosition = [100, 140, 80],
  backgroundColor = "#17231d",
  enableFog = true,
  fogNear = 140,
  fogFar = 600,
}: WorldEnvironmentProps) {
  return (
    <>
      {/* Viewport background color aligned with project palette */}
      <color attach="background" args={[backgroundColor]} />

      {/* Atmospheric depth fog */}
      {enableFog && <fog attach="fog" args={[backgroundColor, fogNear, fogFar]} />}

      {/* Natural sky/ground ambient fill */}
      <hemisphereLight args={["#dbe4d0", "#2d4030", ambientIntensity * 0.6]} />

      {/* Warm ambient fill light */}
      <ambientLight color="#c8d6b9" intensity={ambientIntensity * 0.4} />

      {/* Key directional sunlight with high-resolution shadow frustum */}
      <directionalLight
        color="#fff6e8"
        intensity={sunIntensity}
        position={sunPosition}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={450}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0004}
      />
    </>
  );
}

export default WorldEnvironment;
