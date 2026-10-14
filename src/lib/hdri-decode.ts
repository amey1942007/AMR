/** Must match scripts/compress_hdri.py */
export const LMIN = -8, LMAX = 10;

/** IEEE half from float (round-to-nearest; enough for an 8-bit log LUT). */
export function toHalf(v: number): number {
  const f = new Float32Array([v]), i = new Uint32Array(f.buffer)[0];
  const s = (i >>> 16) & 0x8000, e = ((i >>> 23) & 0xff) - 112, m = i & 0x7fffff;
  if (e <= 0) return s | ((m | 0x800000) >> (1 - e + 13));
  if (e >= 31) return s | 0x7c00;
  return s | (e << 10) | ((m + 0x1000) >> 13);
}

/** RGBA8 log-encoded pixels → half-float RGBA (alpha 1). */
export function decodeLogPixels(src: Uint8ClampedArray | Uint8Array): Uint16Array {
  const lut = new Uint16Array(256);
  for (let i = 0; i < 256; i++) lut[i] = i === 0 ? 0 : toHalf(2 ** (LMIN + (i / 255) * (LMAX - LMIN)));
  const out = new Uint16Array(src.length), one = toHalf(1);
  for (let i = 0; i < src.length; i += 4) { out[i] = lut[src[i]]; out[i + 1] = lut[src[i + 1]]; out[i + 2] = lut[src[i + 2]]; out[i + 3] = one; }
  return out;
}
