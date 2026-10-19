'use client';
import { useMemo } from 'react';
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { RoundedBox } from '@react-three/drei';

const WHEELS: [string, number, number][] = [['wheel_FL', 0.3, 0.25], ['wheel_FR', -0.3, 0.25], ['wheel_RL', 0.3, -0.25], ['wheel_RR', -0.3, -0.25]];

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#111'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#3a3a44'; g.lineWidth = 6;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = SRGBColorSpace;
  return t;
}

/** Brief §16 stand-in with the exact §7.1 node names (forward = +Z, wheels spin about local X). */
export function StandInRobot() {
  const stripes = useMemo(() => stripeTexture(), []);
  return (
    <group name="amr_standin">
      <RoundedBox name="chassis" args={[0.52, 0.12, 0.63]} radius={0.025} smoothness={4} position={[0, 0.1, 0]}>
        <meshPhysicalMaterial color="#0C0C12" metalness={0.72} roughness={0.28} clearcoat={0.55} clearcoatRoughness={0.2} />
      </RoundedBox>
      <mesh name="accent_strip" position={[0, 0.1, 0.317]}>
        <boxGeometry args={[0.4, 0.012, 0.004]} />
        <meshStandardMaterial color="#E81CB0" emissive="#E81CB0" emissiveIntensity={2.4} toneMapped={false} />
      </mesh>
      {WHEELS.map(([n, x, z]) => (
        <group key={n} name={n} position={[x, 0.05, z]}>
          <mesh rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 48]} />
            <meshPhysicalMaterial map={stripes} color="#1a1a20" roughness={0.7} metalness={0.15} sheen={0.15} />
          </mesh>
        </group>
      ))}
      <mesh name="lidar_base" position={[0, 0.175, 0.12]}>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 32]} />
        <meshPhysicalMaterial color="#1a1a22" metalness={0.85} roughness={0.22} />
      </mesh>
      <group name="lidar_top" position={[0, 0.21, 0.12]}>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.04, 32]} />
          <meshPhysicalMaterial color="#101014" metalness={0.55} roughness={0.2} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.041, 0.004, 12, 48]} />
          <meshStandardMaterial color="#E81CB0" emissive="#E81CB0" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
