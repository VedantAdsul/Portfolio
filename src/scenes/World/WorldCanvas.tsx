import { Canvas } from "@react-three/fiber";

export interface WorldCanvasProps {
  onCreated?: () => void;
}

export function WorldCanvas({ onCreated }: WorldCanvasProps = {}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 5, 10], fov: 45 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        onCreated={() => {
          onCreated?.();
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 5]} intensity={1.2} />
        <mesh>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial color="#9c754d" roughness={0.9} />
        </mesh>
      </Canvas>
    </div>
  );
}

export default WorldCanvas;
