'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { KEYS } from '@/lib/camera-keys';
import { monotone, smoothstep } from '@/lib/monotone';
import { S } from '@/lib/scene-state';
import { asset } from '@/lib/asset';
import { robotPose } from '@/lib/store';

const STRIDE = 7;

/**
 * One continuous shot. Default: lerp between baked samples (public/data/camera.bin, scripts/bake-camera.ts) — cheap and
 * deterministic. `?camera=live` (or bin missing) evaluates the §9.2 splines + monotone p→u mapping at runtime.
 * Parallax only p < .12 (§9.2, G21).
 */
export function CameraRig({ parallax = true }: { parallax?: boolean }) {
  const { camera, pointer } = useThree();
  const baked = useRef<Float32Array | null>(null);
  useEffect(() => {
    if (new URLSearchParams(location.search).get('camera') === 'live') return;
    fetch(asset('/data/camera.bin')).then((r) => (r.ok ? r.arrayBuffer() : null)).then((b) => { if (b) baked.current = new Float32Array(b); }).catch(() => {});
  }, []);
  const live = useMemo(() => ({
    pos: new CatmullRomCurve3(KEYS.map((k) => new Vector3(...k.pos)), false, 'centripetal'),
    tgt: new CatmullRomCurve3(KEYS.map((k) => new Vector3(...k.tgt)), false, 'centripetal'),
    toU: monotone(KEYS.map((k) => k.p), KEYS.map((_, i) => i / (KEYS.length - 1))),
    toF: monotone(KEYS.map((k) => k.p), KEYS.map((k) => k.fov)),
  }), []);
  const par = useRef(new Vector2());
  const follow = useRef(new Vector2());
  const v = useMemo(() => new Vector3(), []), t = useMemo(() => new Vector3(), []);
  useFrame((_, dt) => {
    const p = Math.min(1, Math.max(0, S.p));
    let fov: number;
    const b = baked.current;
    if (b) {
      const n = b.length / STRIDE, x = p * (n - 1), i = Math.min(n - 2, Math.floor(x)), f = x - i, o = i * STRIDE, q = o + STRIDE;
      v.set(MathUtils.lerp(b[o], b[q], f), MathUtils.lerp(b[o + 1], b[q + 1], f), MathUtils.lerp(b[o + 2], b[q + 2], f));
      t.set(MathUtils.lerp(b[o + 3], b[q + 3], f), MathUtils.lerp(b[o + 4], b[q + 4], f), MathUtils.lerp(b[o + 5], b[q + 5], f));
      fov = MathUtils.lerp(b[o + 6], b[q + 6], f);
    } else {
      const u = live.toU(p);
      live.pos.getPoint(u, v); live.tgt.getPoint(u, t); fov = live.toF(p);
    }
    const w = parallax ? 1 - smoothstep(0.06, 0.12, p) : 0;
    par.current.x = MathUtils.damp(par.current.x, pointer.x * 0.08 * w, 4, dt);
    par.current.y = MathUtils.damp(par.current.y, pointer.y * 0.08 * w, 4, dt);
    camera.position.set(v.x + par.current.x, v.y + par.current.y, v.z);
    // v3 §3.3 robot follow (p .26–.66): bounded, damped pull of the target toward the robot (runtime, not baked).
    const fw = 0.3 * smoothstep(0.26, 0.32, p) * (1 - smoothstep(0.6, 0.66, p));
    follow.current.x = MathUtils.damp(follow.current.x, (robotPose.x - t.x) * fw, 3, dt);
    follow.current.y = MathUtils.damp(follow.current.y, (robotPose.z - t.z) * fw, 3, dt);
    t.x += follow.current.x; t.z += follow.current.y;
    camera.lookAt(t);
    const cam = camera as PerspectiveCamera;
    // Review #4 (375 px): keys are authored for landscape. On portrait keep the *horizontal* FOV of a 1:1 view so
    // the robot/apartment isn't cropped (hor+), capped at 75°.
    if (cam.aspect < 1) fov = Math.min(75, 2 * MathUtils.radToDeg(Math.atan(Math.tan(MathUtils.degToRad(fov) / 2) / cam.aspect)));
    if (Math.abs(cam.fov - fov) > 1e-4) { cam.fov = fov; cam.updateProjectionMatrix(); }
  });
  return null;
}
