import type { MapDataService } from '../types';
/**
 * Deterministic grid computed from the shared layout (same format as an offline map_reveal.bin: reveal ++ state).
 * lib/grid pulls in three.js (path spline), so it is imported lazily — never in the initial bundle.
 */
let cached: Promise<Uint8Array> | null = null;
export const runtimeMapData: MapDataService = {
  loadReveal() {
    return (cached ??= import('@/lib/grid').then(({ bakeMap }) => {
      const m = bakeMap();
      const out = new Uint8Array(m.reveal.length * 2);
      out.set(m.reveal); out.set(m.state, m.reveal.length);
      return out;
    }));
  },
  async loadPath() { return (await import('@/lib/path')).PATH_POINTS; },
};
