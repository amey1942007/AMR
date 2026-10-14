'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { Color, Vector3 } from 'three';
import type { Line2, LineSegments2 } from 'three-stdlib';
import { pathCurve } from '@/lib/path';
import { S } from '@/lib/scene-state';

const N = 300, AHEAD = 1.2;
/** Driven trail (solid gradient, 2 px) + dashed planned segment 1.2 m ahead (opacity .35). */
export function Trail() {
  const solid = useRef<Line2 | LineSegments2>(null);
  const dashed = useRef<Line2 | LineSegments2>(null);
  const { pts, cols } = useMemo(() => {
    const c = pathCurve();
    const a = new Color('#7B2FF7'), b = new Color('#E81CB0');
    const pts: Vector3[] = [], cols: Color[] = [];
    for (let i = 0; i < N; i++) { const p = c.getPointAt(i / (N - 1)); p.y = 0.01; pts.push(p); cols.push(a.clone().lerp(b, i / (N - 1))); }
    return { pts, cols };
  }, []);
  const len = useMemo(() => pathCurve().getLength(), []);
  const ahead = useMemo(() => Array.from({ length: 16 }, () => new Vector3()), []);
  useFrame(() => {
    const vis = S.uDrive > 0.001 && S.p <= 0.9;
    const k = Math.max(0, Math.floor(S.uDrive * (N - 1)));
    if (solid.current) { solid.current.visible = vis; solid.current.geometry.instanceCount = k; }
    if (dashed.current) {
      dashed.current.visible = vis && S.uDrive < 0.999;
      const c = pathCurve();
      const flat: number[] = [];
      for (let i = 0; i < ahead.length; i++) {
        const u = Math.min(1, S.uDrive + (AHEAD / len) * (i / (ahead.length - 1)));
        c.getPointAt(u, ahead[i]);
        flat.push(ahead[i].x, 0.012, ahead[i].z);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dashed.current.geometry as any).setPositions(flat);
      dashed.current.computeLineDistances();
    }
  });
  return (
    <>
      <Line ref={solid} points={pts} vertexColors={cols} lineWidth={2} visible={false} />
      <Line ref={dashed} points={ahead.map(() => [0, 0, 0] as [number, number, number])} color="#E81CB0" lineWidth={1.5} dashed dashSize={0.08} gapSize={0.06} transparent opacity={0.35} visible={false} />
    </>
  );
}
