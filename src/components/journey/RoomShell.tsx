'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { type Group, type LineBasicMaterial, type Mesh, type MeshStandardMaterial, type Texture, RepeatWrapping, SRGBColorSpace, TextureLoader } from 'three';
import { WALLS, ROOM } from '@/lib/room';
import { S } from '@/lib/scene-state';
import { smoothstep } from '@/lib/monotone';
import { asset } from '@/lib/asset';

/** Procedural walls (fallback until Amey's room_shell.glb) with per-wall near-first fade; floor with CC0 concrete if present. */
export function RoomShell({ floorTexture }: { floorTexture?: string }) {
  const group = useRef<Group>(null);
  const mats = useRef<(MeshStandardMaterial | null)[]>([]);
  const edges = useRef<(LineBasicMaterial | null)[]>([]);
  const meshes = useRef<(Mesh | null)[]>([]);
  const floorMat = useRef<MeshStandardMaterial>(null);
  const tex = useMemo<Texture | null>(() => {
    if (!floorTexture) return null;
    const t = new TextureLoader().load(asset(floorTexture));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.repeat.set(4, 3);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, [floorTexture]);
  useFrame(() => {
    if (!group.current) return;
    group.current.visible = S.p <= 0.9;
    WALLS.forEach((w, i) => {
      const m = mats.current[i];
      if (!m) return;
      const o = smoothstep(w.pStart, w.pStart + 0.08, S.p);
      m.opacity = o;
      if (meshes.current[i]) meshes.current[i]!.visible = o > 0.001;
      if (edges.current[i]) edges.current[i]!.opacity = 0.2 * o;
      m.depthWrite = o > 0.99;
    });
    if (floorMat.current) {
      floorMat.current.opacity = S.roomOpacity;
      floorMat.current.visible = S.roomOpacity > 0.001;
    }
  });
  return (
    <group ref={group} name="room_shell">
      <mesh name="floor" rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[ROOM.w, ROOM.d]} />
        <meshStandardMaterial ref={floorMat} color={tex ? '#9a9aa6' : '#0E0E14'} map={tex} roughness={0.9} envMapIntensity={0.6} transparent />
      </mesh>
      {WALLS.map((w, i) => (
        <mesh key={w.name} ref={(m) => { meshes.current[i] = m; }} name={w.name} position={[w.x, w.h / 2, w.z]} castShadow receiveShadow>
          <boxGeometry args={[w.w, w.h, w.d]} />
          <meshStandardMaterial ref={(m) => { mats.current[i] = m; }} color="#1A1A22" roughness={0.7} transparent opacity={0} />
          <Edges color="white" threshold={30}>
            <lineBasicMaterial ref={(m) => { edges.current[i] = m; }} color="white" transparent opacity={0} />
          </Edges>
        </mesh>
      ))}
    </group>
  );
}
