'use client';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { BotTelemetry, MapFrame } from '@/lib/telemetry/protocol';
import { LidarPoints, OccupancyMapMesh, PathLine, RobotMarker } from './OccupancyMap';

function SceneBody({ frame, map }: { frame: BotTelemetry | null; map: MapFrame | null }) {
  const pose = frame?.pose ?? [0, 0, 0];
  return (
    <>
      <color attach="background" args={['#07060c']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 2]} intensity={0.85} />
      <gridHelper args={[20, 40, '#1a0b3d', '#12101a']} position={[0, 0, 0]} />
      <OccupancyMapMesh map={map} />
      <LidarPoints scan={frame?.scan} />
      <PathLine path={frame?.path} />
      <RobotMarker frame={frame} />
      <OrbitControls
        makeDefault
        target={[pose[0], 0.1, -pose[1]]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={1.2}
        maxDistance={18}
      />
    </>
  );
}

export function BotScene({
  frame,
  map,
  className = '',
}: {
  frame: BotTelemetry | null;
  map: MapFrame | null;
  className?: string;
}) {
  return (
    <div className={`relative h-full min-h-[280px] w-full overflow-hidden ${className}`}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [2.5, 3.2, 2.5], fov: 42, near: 0.05, far: 80 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <SceneBody frame={frame} map={map} />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(5,5,7,0.55) 100%)',
        }}
        aria-hidden
      />
    </div>
  );
}
