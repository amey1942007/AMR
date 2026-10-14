import { DataTexture, EquirectangularReflectionMapping, HalfFloatType, LinearFilter, RGBAFormat } from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { decodeInWorker } from '@/lib/decode-client';
import { decodeLogPixels } from '@/lib/hdri-decode';

export function loadHdr(url: string) {
  return new HDRLoader().setDataType(HalfFloatType).loadAsync(url).then((t) => { t.mapping = EquirectangularReflectionMapping; return t; });
}

/** Decode the streamed 2K log-encoded WebP back to linear HDR (half float), in the decode worker when available. */
export async function loadLogWebp(url: string) {
  const abs = new URL(url, location.href).href;
  let px: Uint16Array, w: number, h: number;
  const job = decodeInWorker<{ data: Uint16Array; w: number; h: number }>({ kind: 'hdri', url: abs });
  if (job) ({ data: px, w, h } = await job);
  else {
    const res = await fetch(abs);
    if (!res.ok) throw new Error(`HDRI ${res.status}`);
    const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d')!; ctx.drawImage(bmp, 0, 0);
    px = decodeLogPixels(ctx.getImageData(0, 0, bmp.width, bmp.height).data); w = bmp.width; h = bmp.height;
  }
  const t = new DataTexture(px, w, h, RGBAFormat, HalfFloatType);
  t.flipY = true;
  t.mapping = EquirectangularReflectionMapping;
  t.minFilter = t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}
