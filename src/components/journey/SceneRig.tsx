'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog, Matrix4, Vector3, type DirectionalLight, type OrthographicCamera } from 'three';
import { markShadowDirty, takeShadowDirty } from '@/lib/shadow-dirty';
import { addTick } from '@/lib/ticker';
import { S } from '@/lib/scene-state';
import { lerp } from '@/lib/monotone';
import { useUI } from '@/lib/ui-store';
import { useScene } from '@/lib/store';
import { tokens } from '@/lib/tokens';

/** Light direction (from target toward the key light). */
const LDIR = new Vector3(3, 5, 2).normalize();
const FOOT = { hx: 5.2, hz: 3.7, h: 2.7 };
/**
 * Key + rim lights. One directional key with a tight orthographic shadow camera fitted (in light space) to the
 * 10×7 m footprint, VSM-soft on high tier. Furniture + walls are static casters: the shadow map is baked once
 * (autoUpdate off) and re-rendered only when a caster changes (markShadowDirty: wall rise/cutaway, props loaded)
 * or the light changes. The robot does not cast into it; it is grounded by a blob + N8AO instead.
 */
export function Lights({ shadows, mapSize }: { shadows: boolean; mapSize: number }) {
  const key = useRef<DirectionalLight>(null);
  const gl = useThree((t) => t.gl);
  useEffect(() => {
    const l = key.current;
    if (!l) return;
    l.position.copy(LDIR).multiplyScalar(10);
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
    l.updateMatrixWorld();
    // Fit: project the footprint box corners into light view space.
    const lv = new Matrix4().lookAt(l.position, l.target.position, new Vector3(0, 1, 0));
    lv.setPosition(l.position); lv.invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const v = new Vector3();
    for (const sx of [-1, 1]) for (const sy of [0, 1]) for (const sz of [-1, 1]) {
      v.set(sx * FOOT.hx, sy * FOOT.h, sz * FOOT.hz).applyMatrix4(lv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    const cam = l.shadow.camera as OrthographicCamera;
    cam.left = x0; cam.right = x1; cam.bottom = y0; cam.top = y1; cam.near = Math.max(0.1, -z1 - 0.5); cam.far = -z0 + 0.5;
    cam.updateProjectionMatrix();
    gl.shadowMap.autoUpdate = false;
    markShadowDirty();
  }, [gl, shadows]);
  useFrame(() => {
    // Sky phase (p > .72): keep the baked map, never re-render it (draw budget).
    if (takeShadowDirty() && S.p <= 0.72) gl.shadowMap.needsUpdate = true;
  });
  return (
    <>
      <directionalLight ref={key} color="#F4F1FF" intensity={2.0} castShadow={shadows} shadow-mapSize={[mapSize, mapSize]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-radius={6} shadow-blurSamples={12} />
      <pointLight position={[-3.4, 0.7, 0.4]} color="#E81CB0" intensity={0.9} distance={6} decay={1.5} />
      <hemisphereLight args={["#2B1A5E", "#0B0B10", 0.25]} />
    </>
  );
}

const ROOM = new Color('#0B0B10'), HOR = new Color(tokens['sky-horizon']);
/** Fog near/far 12/40 → 60/220 (p .3→.8); colour follows the sky blend. */
export function FogCtl() {
  const { scene } = useThree();
  useEffect(() => { scene.fog = new Fog(ROOM.clone(), 12, 40); return () => { scene.fog = null; }; }, [scene]);
  useFrame(() => {
    const f = scene.fog as Fog | null;
    if (!f) return;
    f.near = lerp(12, 60, S.fog); f.far = lerp(40, 220, S.fog);
    f.color.copy(ROOM).lerp(HOR, S.skyMix * 0.6);
  });
  return null;
}

/** Pause per ui-spec §8: '#info' top < 0 or a dialog open → render on demand. Tab hidden is handled by rAF. */
export function FrameloopCtl() {
  const { setFrameloop, invalidate } = useThree();
  useEffect(() => {
    let mode: 'always' | 'demand' | 'never' = 'always';
    const tick = () => {
      const info = document.getElementById('info');
      // ui-spec §14.3: while the simulation video plays, render 0 frames ('never' ignores stray invalidate() calls).
      const stop = useScene.getState().renderPaused;
      const paused = (info ? info.getBoundingClientRect().top < 0 : false) || useUI.getState().dialog !== null;
      const next = stop ? 'never' : paused ? 'demand' : 'always';
      if (next !== mode) { mode = next; setFrameloop(next); if (next === 'demand') invalidate(); }
    };
    return addTick(tick);
  }, [setFrameloop, invalidate]);
  return null;
}
