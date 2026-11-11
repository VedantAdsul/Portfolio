/**
 * WorldFallback Component
 *
 * Minimalist voxel loading indicator rendered inside the R3F Canvas while
 * the primary GLB environment geometry is downloading and parsing.
 */

export function WorldFallback() {
  return (
    <mesh position={[0, 28, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#9c754d" roughness={0.9} wireframe />
    </mesh>
  );
}

export default WorldFallback;
