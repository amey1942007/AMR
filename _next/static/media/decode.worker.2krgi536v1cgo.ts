/// <reference lib="webworker" />
/**
 * Off-main-thread decoders: the log-encoded HDRI WebP → half-float RGBA, and the 64×64 blue-noise tile.
 * Keeps getImageData and the void-and-cluster loop off the main thread (review item 14).
 */
import { blueNoise } from '@/lib/bluenoise';
import { decodeLogPixels } from '@/lib/hdri-decode';

type Msg = { id: number; kind: 'hdri'; url: string } | { id: number; kind: 'bluenoise' };
const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.kind === 'bluenoise') { const d = blueNoise(64); ctx.postMessage({ id: m.id, data: d }, [d.buffer]); return; }
    const res = await fetch(m.url);
    if (!res.ok) throw new Error(`HDRI ${res.status}`);
    const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const out = decodeLogPixels(g.getImageData(0, 0, bmp.width, bmp.height).data);
    ctx.postMessage({ id: m.id, data: out, w: bmp.width, h: bmp.height }, [out.buffer]);
  } catch (err) {
    ctx.postMessage({ id: m.id, error: String(err) });
  }
};
