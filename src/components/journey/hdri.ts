import { DataTexture, EquirectangularReflectionMapping, FloatType, HalfFloatType, LinearFilter, RGBAFormat, DataUtils } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/** Must match scripts/compress_hdri.py */
const LMIN = -8, LMAX = 10;

export function loadHdr(url: string) {
  return new HDRLoader().setDataType(HalfFloatType).loadAsync(url).then((t) => { t.mapping = EquirectangularReflectionMapping; return t; });
}

/** Decode the streamed 2K log-encoded WebP back to linear HDR (half float). */
export async function loadLogWebp(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HDRI ${res.status}`);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  const src = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const lut = new Uint16Array(256);
  for (let i = 0; i < 256; i++) lut[i] = i === 0 ? 0 : DataUtils.toHalfFloat(2 ** (LMIN + (i / 255) * (LMAX - LMIN)));
  const out = new Uint16Array(bmp.width * bmp.height * 4);
  const one = DataUtils.toHalfFloat(1);
  for (let i = 0; i < src.length; i += 4) { out[i] = lut[src[i]]; out[i + 1] = lut[src[i + 1]]; out[i + 2] = lut[src[i + 2]]; out[i + 3] = one; }
  const t = new DataTexture(out, bmp.width, bmp.height, RGBAFormat, HalfFloatType);
  t.flipY = true;
  t.mapping = EquirectangularReflectionMapping;
  t.minFilter = t.magFilter = LinearFilter;
  t.needsUpdate = true;
  void FloatType;
  return t;
}
