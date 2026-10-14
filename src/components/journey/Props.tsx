'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import type { Group, LineBasicMaterial, MeshStandardMaterial } from 'three';
import { PROPS } from '@/lib/room';
import { S } from '@/lib/scene-state';
import { smoothstep } from '@/lib/monotone';

/** Primitive stand-ins (#24242E, white 20% edges) at §11.2 positions; rise y −0.15→0 + fade, staggered .10–.30. */
export function Props() {
  const groups = useRef<(Group | null)[]>([]);
  const mats = useRef<(MeshStandardMaterial | null)[]>([]);
  const edges = useRef<(LineBasicMaterial | null)[]>([]);
  useFrame(() => {
    PROPS.forEach((_, i) => {
      const a = 0.1 + (i / PROPS.length) * 0.14;
      const k = smoothstep(a, a + 0.06, S.p);
      const g = groups.current[i], m = mats.current[i];
      if (g) { g.position.y = -0.15 * (1 - k); g.visible = k > 0.001 && S.p <= 0.9; }
      if (m) { m.opacity = k; m.depthWrite = k > 0.99; }
      const e = edges.current[i];
      if (e) e.opacity = 0.2 * k;
    });
  });
  return (
    <group name="props">
      {PROPS.map((b, i) => (
        <group key={b.name} ref={(g) => { groups.current[i] = g; }} position={[b.x, 0, b.z]} rotation-y={b.yaw}>
          <mesh name={b.name} position-y={b.h / 2} castShadow receiveShadow>
            {b.shape === 'cyl' ? <cylinderGeometry args={[b.w / 2, b.w / 2.6, b.h, 24]} /> : b.shape === 'cone' ? <coneGeometry args={[b.w / 2, b.h, 24]} /> : <boxGeometry args={[b.w, b.h, b.d]} />}
            <meshStandardMaterial ref={(m) => { mats.current[i] = m; }} color={b.shape === 'cone' ? '#3a2a30' : '#24242E'} roughness={0.75} transparent opacity={0} />
            <Edges threshold={20}><lineBasicMaterial ref={(m) => { edges.current[i] = m; }} color="white" transparent opacity={0} /></Edges>
          </mesh>
        </group>
      ))}
    </group>
  );
}
