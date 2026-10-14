'use client';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, type LineSegments, type Mesh, type MeshBasicMaterial, type Points, type LineBasicMaterial, type PointsMaterial } from 'three';
import { castRay } from '@/lib/room';
import { S } from '@/lib/scene-state';
import { robotU } from '@/lib/path';
import { useScene, lidarWorld } from '@/lib/store';

const INTERVAL = 1800, GROW = 180, HOLD = 120, FADE = 600, RING = 400;
const easeOut2 = (t: number) => 1 - (1 - t) * (1 - t);

/** Pulsed lidar (never a constant beam): 2D raycast against the shared layout (analytic, replaces BVH for primitives). */
export function LidarPulse({ rays }: { rays: number }) {
  const { clock } = useThree();
  const lines = useRef<LineSegments>(null);
  const pts = useRef<Points>(null);
  const ring = useRef<Mesh>(null);
  const st = useRef({ last: -1e9, lastU: -1, fired: 0, ox: 0, oy: 0, oz: 0, wasIn: false });
  const hits = useMemo(() => new Float32Array(rays * 3), [rays]);
  const dist = useMemo(() => new Float32Array(rays), [rays]);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(rays * 6), 3));
    const col = new Float32Array(rays * 6), a = new Color('#7B2FF7'), b = new Color('#E81CB0');
    for (let i = 0; i < rays; i++) { col.set([a.r, a.g, a.b, b.r, b.g, b.b], i * 6); }
    g.setAttribute('color', new BufferAttribute(col, 3));
    return g;
  }, [rays]);
  const pgeo = useMemo(() => { const g = new BufferGeometry(); g.setAttribute('position', new BufferAttribute(hits, 3)); return g; }, [hits]);

  function fire(now: number) {
    const s = st.current;
    s.last = now; s.lastU = robotU.value; s.fired = now;
    s.ox = lidarWorld.x; s.oy = Math.max(0.05, lidarWorld.y); s.oz = lidarWorld.z;
    for (let i = 0; i < rays; i++) {
      const r = castRay(s.ox, s.oz, (i / rays) * Math.PI * 2);
      dist[i] = r.dist;
      hits.set([r.x, s.oy, r.z], i * 3);
    }
    pgeo.attributes.position.needsUpdate = true;
    useScene.setState({ uMap: robotU.value });
  }

  useFrame(() => {
    const now = clock.getElapsedTime() * 1000;
    const s = st.current;
    const active = S.p > 0.28 && S.p < 0.8;
    if (active && (now - s.last > INTERVAL || Math.abs(robotU.value - s.lastU) > 0.06)) fire(now);
    if (!active && s.wasIn) {
      if (S.p >= 0.8) fire(now); // last pulse at the path end
      else useScene.setState({ uMap: S.p <= 0.28 ? 0 : useScene.getState().uMap });
    }
    s.wasIn = active;
    const t = now - s.fired;
    const grow = easeOut2(Math.min(1, t / GROW));
    const fk = Math.min(1, Math.max(0, (t - GROW - HOLD) / FADE));
    const op = 0.55 * (1 - fk * fk); // power1.in-ish fade
    const visible = t < GROW + HOLD + FADE && S.p < 0.85;
    const pos = geo.attributes.position.array as Float32Array;
    if (visible) {
      for (let i = 0; i < rays; i++) {
        const a = (i / rays) * Math.PI * 2, d = dist[i] * grow;
        pos.set([s.ox, s.oy, s.oz, s.ox + Math.cos(a) * d, s.oy, s.oz + Math.sin(a) * d], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
    }
    if (lines.current) { lines.current.visible = visible; (lines.current.material as LineBasicMaterial).opacity = op; }
    if (pts.current) { pts.current.visible = visible && grow > 0.99; (pts.current.material as PointsMaterial).opacity = op * 1.6; }
    if (ring.current) {
      const k = Math.min(1, t / RING);
      ring.current.visible = t < RING && S.p < 0.85;
      ring.current.position.set(s.ox, 0.02, s.oz);
      ring.current.scale.setScalar(0.01 + k * 1.2);
      (ring.current.material as MeshBasicMaterial).opacity = 0.4 * (1 - k);
    }
  });

  return (
    <group name="lidar">
      <lineSegments ref={lines} geometry={geo} frustumCulled={false} visible={false}>
        <lineBasicMaterial vertexColors transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </lineSegments>
      <points ref={pts} geometry={pgeo} frustumCulled={false} visible={false}>
        <pointsMaterial color="white" size={2} sizeAttenuation={false} transparent depthWrite={false} toneMapped={false} />
      </points>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.97, 1, 96]} />
        <meshBasicMaterial color="#E81CB0" transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
