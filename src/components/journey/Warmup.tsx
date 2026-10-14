'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { Material, Object3D, Scene, Camera, WebGLRenderer } from 'three';

/** Off-screen scenes (cloud raymarch, composites) register here so their programs are warmed too. */
const extra = new Set<{ scene: Object3D; camera: Camera }>();
export function registerWarm(scene: Object3D, camera: Camera) { const e = { scene, camera }; extra.add(e); return () => { extra.delete(e); }; }

const idle = (fn: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : (setTimeout(fn, 16) as unknown as number);

/**
 * Review (long tasks): compile every program before it is first drawn, one small material batch per idle
 * slot via renderer.compileAsync (KHR_parallel_shader_compile when present), instead of one big compile
 * stall the first time a room / the sky phase becomes visible. Hidden objects are made visible only for the
 * synchronous part of each compile call.
 */
export async function warmScene(gl: WebGLRenderer, scene: Scene, camera: Camera, batch = 3, alive = () => true) {
  const seen = new Set<string>();
  const groups: Object3D[][] = [];
  let cur: Object3D[] = [];
  const key = (m: Material | Material[]) => (Array.isArray(m) ? m : [m]).map((x) => x.uuid).join();
  const visit = (root: Object3D) => root.traverse((o) => {
    const m = (o as unknown as { material?: Material | Material[] }).material;
    if (!m) return;
    const k = key(m) + ((o as unknown as { isInstancedMesh?: boolean }).isInstancedMesh ? 'i' : '') + ((o as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh ? 's' : '');
    if (seen.has(k)) return;
    seen.add(k); cur.push(o);
    if (cur.length >= batch) { groups.push(cur); cur = []; }
  });
  visit(scene);
  if (cur.length) groups.push(cur);
  for (const g of groups) {
    if (!alive()) return;
    await new Promise<void>((r) => idle(() => r()));
    const hidden: Object3D[] = [];
    for (const o of g) for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) { hidden.push(p); p.visible = true; }
    let pending: Promise<unknown>[] = [];
    try { pending = g.map((o) => gl.compileAsync(o, camera, scene)); } finally { hidden.forEach((p) => (p.visible = false)); }
    await Promise.all(pending).catch(() => {});
  }
  for (const e of [...extra]) {
    if (!alive()) return;
    await new Promise<void>((r) => idle(() => r()));
    await gl.compileAsync(e.scene, e.camera).catch(() => {});
  }
}

/** Re-warms whenever the scene graph grows (furniture / hi robot / cloud textures arrive). */
export function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let alive = true, n = -1, busy = false;
    const count = () => { let c = 0; scene.traverse(() => c++); return c; };
    const tick = async () => {
      if (!alive || busy) return;
      const c = count();
      if (c !== n) { busy = true; n = c; await warmScene(gl, scene, camera, 3, () => alive); busy = false; }
    };
    const id = setInterval(tick, 1000);
    tick();
    return () => { alive = false; clearInterval(id); };
  }, [gl, scene, camera]);
  return null;
}
