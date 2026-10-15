'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { BotTelemetry, MapFrame } from '@/lib/telemetry/protocol';

async function inflateZlibAsync(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream('deflate');
    const ab = await new Response(new Blob([bytes.buffer as ArrayBuffer]).stream().pipeThrough(ds)).arrayBuffer();
    return new Uint8Array(ab);
  } catch {
    return null;
  }
}

function cellsToTexture(cells: Uint8Array, w: number, h: number): THREE.DataTexture {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = cells[i] ?? 0;
    const o = i * 4;
    if (v === 2) {
      rgba[o] = 232; rgba[o + 1] = 28; rgba[o + 2] = 176; rgba[o + 3] = 220;
    } else if (v === 1) {
      rgba[o] = 255; rgba[o + 1] = 255; rgba[o + 2] = 255; rgba[o + 3] = 28;
    } else {
      rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0; rgba[o + 3] = 0;
    }
  }
  const tex = new THREE.DataTexture(rgba, w, h);
  tex.needsUpdate = true;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.flipY = false;
  return tex;
}

export function OccupancyMapMesh({ map }: { map: MapFrame | null }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    if (!map?.data) return;
    let dead = false;
    (async () => {
      const raw = Uint8Array.from(atob(map.data), (c) => c.charCodeAt(0));
      const cells = await inflateZlibAsync(raw);
      if (dead || !cells || !mat.current) return;
      const prev = mat.current.map;
      mat.current.map = cellsToTexture(cells, map.w, map.h);
      mat.current.needsUpdate = true;
      prev?.dispose();
    })();
    return () => { dead = true; };
  }, [map]);

  if (!map) return null;
  const width = map.w * map.res;
  const height = map.h * map.res;
  const cx = map.origin[0] + width / 2 + map.tf[0];
  const cy = map.origin[1] + height / 2 + map.tf[1];

  return (
    <mesh ref={mesh} position={[cx, 0.01, -cy]} rotation={[-Math.PI / 2, 0, map.tf[2]]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial ref={mat} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

export function LidarPoints({ scan }: { scan?: [number, number][] }) {
  const pts = useMemo(() => {
    if (!scan?.length) return new Float32Array(0);
    const arr = new Float32Array(scan.length * 3);
    for (let i = 0; i < scan.length; i++) {
      arr[i * 3] = scan[i][0];
      arr[i * 3 + 1] = 0.08;
      arr[i * 3 + 2] = -scan[i][1];
    }
    return arr;
  }, [scan]);

  if (!pts.length) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[pts, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#5ee6a8" size={0.06} sizeAttenuation />
    </points>
  );
}

export function RobotMarker({ frame }: { frame: BotTelemetry | null }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current || !frame) return;
    const [x, y, yaw] = frame.pose;
    ref.current.position.set(x, 0.12, -y);
    ref.current.rotation.y = -yaw;
  });
  return (
    <group ref={ref}>
      <mesh castShadow>
        <boxGeometry args={[0.36, 0.18, 0.28]} />
        <meshStandardMaterial color="#c8c4d4" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0.14, 0.06, 0]}>
        <boxGeometry args={[0.08, 0.06, 0.16]} />
        <meshStandardMaterial color="#e81cb0" emissive="#e81cb0" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export function PathLine({ path }: { path?: [number, number][] }) {
  const pts = useMemo(() => {
    if (!path?.length) return null;
    return path.map(([x, y]) => [x, 0.05, -y] as [number, number, number]);
  }, [path]);
  if (!pts) return null;
  return <Line points={pts} color="#7b2ff7" lineWidth={2} />;
}
