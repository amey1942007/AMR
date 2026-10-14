'use client';
import { S } from '@/lib/scene-state';
import { useFrame } from '@react-three/fiber';
import type { Mesh, Object3D } from 'three';

/**
 * ?debug=1 only: publishes renderer stats (draw calls incl. shadow passes) for the HUD and perf tests, plus a
 * breakdown of visible scene drawables by top-level group (`by`) and the number of visible shadow casters.
 */
let frames = 0;
let shadowPasses = 0;
let patched = false;
export function RenderStats() {
  // autoReset off: info accumulates every pass of the previous frame (shadow + main + post); read, then reset.
  useFrame(({ gl, scene }) => {
    gl.info.autoReset = false;
    if (!patched) { // count real shadow-map redraws (renderer only calls render when autoUpdate or needsUpdate)
      patched = true; const sm = gl.shadowMap as unknown as { render: (...a: unknown[]) => void; needsUpdate: boolean; autoUpdate: boolean };
      const orig = sm.render.bind(sm);
      sm.render = (...a: unknown[]) => { if ((sm as unknown as { enabled: boolean }).enabled && (sm.autoUpdate || sm.needsUpdate)) shadowPasses++; orig(...a); };
    }
    const by: Record<string, number> = {};
    let casters = 0;
    const walk = (o: Object3D, top: string) => {
      if (!o.visible) return;
      const m = o as Mesh;
      if ((m.isMesh || (o as unknown as { isLine?: boolean }).isLine || (o as unknown as { isPoints?: boolean }).isPoints) && m.material) {
        const n = Array.isArray(m.material) ? m.material.length : 1;
        by[top] = (by[top] ?? 0) + n;
        if (m.castShadow) casters += n;
      }
      for (const c of o.children) walk(c, top);
    };
    for (const c of scene.children) walk(c, c.name || c.type);
    const w = window as unknown as { __r3fStats?: unknown; __scene?: unknown };
    w.__scene = scene; (w as { __S?: unknown }).__S = S; // debug-only handles for verification scripts
    frames++; // rendered frames (useFrame runs only when R3F renders): lets tests assert the canvas stops
    w.__r3fStats = { frames, shadowPasses, calls: gl.info.render.calls, triangles: gl.info.render.triangles, casters, by };
    gl.info.reset();
  });
  return null;
}
