import type { MapDataService } from '../types';
import { asset } from '@/lib/asset';
/**
 * Prefers the offline bake (public/data/map_reveal.bin, scripts/bake-map.ts); if it is missing or the wrong size,
 * computes the same grid at runtime from the shared layout. lib/grid pulls in three.js (path spline), so it is
 * imported lazily, never in the initial bundle. Returns revealU ++ state ++ roomId (3 × 100·70 bytes).
 */
let cached: Promise<Uint8Array> | null = null;
export const runtimeMapData: MapDataService = {
  loadReveal() {
    return (cached ??= import('@/lib/grid').then(async ({ bakeMap, encodeMap, decodeMap }) => {
      try {
        const r = await fetch(asset('/data/map_reveal.bin'));
        if (r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')) {
          const buf = new Uint8Array(await r.arrayBuffer());
          decodeMap(buf);
          return buf;
        }
      } catch { /* fall through to the runtime bake */ }
      return encodeMap(bakeMap());
    }));
  },
  async loadPath() { return (await import('@/lib/path')).PATH_POINTS; },
};
