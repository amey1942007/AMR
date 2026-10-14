/**
 * Bakes the §9.2 camera (centripetal CatmullRom + Fritsch–Carlson p→u, monotone FOV) into
 * public/data/camera.bin: 1024 samples × 7 float32 (pos xyz, target xyz, fov), uniform in p.
 * Run: npm run bake:camera   (CameraRig lerps samples; ?camera=live uses the runtime spline.)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { CatmullRomCurve3, Vector3 } from 'three';
import { KEYS } from '../src/lib/camera-keys';
import { monotone } from '../src/lib/monotone';

export const SAMPLES = 1024, STRIDE = 7;
const pos = new CatmullRomCurve3(KEYS.map((k) => new Vector3(...k.pos)), false, 'centripetal');
const tgt = new CatmullRomCurve3(KEYS.map((k) => new Vector3(...k.tgt)), false, 'centripetal');
const toU = monotone(KEYS.map((k) => k.p), KEYS.map((_, i) => i / (KEYS.length - 1)));
const toF = monotone(KEYS.map((k) => k.p), KEYS.map((k) => k.fov));
const out = new Float32Array(SAMPLES * STRIDE);
const v = new Vector3(), t = new Vector3();
for (let i = 0; i < SAMPLES; i++) {
  const p = i / (SAMPLES - 1), u = toU(p);
  pos.getPoint(u, v); tgt.getPoint(u, t);
  out.set([v.x, v.y, v.z, t.x, t.y, t.z, toF(p)], i * STRIDE);
}
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/camera.bin', Buffer.from(out.buffer));
console.log(`camera.bin: ${SAMPLES} samples, ${out.byteLength} bytes`);
