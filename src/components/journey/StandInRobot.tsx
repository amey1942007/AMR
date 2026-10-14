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
      <RoundedBox name="chassis" args={[0.52, 0.12, 0.63]} radius={0.025} smoothness={4} position={[0, 0.1, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial color="#1A1A22" metalness={0.6} roughness={0.35} clearcoat={0.3} />
      </RoundedBox>
      <mesh name="accent_strip" position={[0, 0.1, 0.317]}>
        <boxGeometry args={[0.4, 0.012, 0.004]} />
        <meshStandardMaterial color="#E81CB0" emissive="#E81CB0" emissiveIntensity={2} toneMapped={false} />
      </mesh>
      {WHEELS.map(([n, x, z]) => (
        <group key={n} name={n} position={[x, 0.05, z]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 0.05, 32]} />
            <meshPhysicalMaterial map={stripes} roughness={0.85} sheen={0.2} />
          </mesh>
        </group>
      ))}
      <mesh name="lidar_base" position={[0, 0.175, 0.12]} castShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.03, 32]} />
        <meshPhysicalMaterial color="#222" metalness={0.8} roughness={0.3} />
      </mesh>
      <group name="lidar_top" position={[0, 0.21, 0.12]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.04, 32]} />
          <meshPhysicalMaterial color="#151518" metalness={0.5} roughness={0.25} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.041, 0.004, 12, 48]} />
          <meshStandardMaterial color="#E81CB0" emissive="#E81CB0" emissiveIntensity={1.5} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
