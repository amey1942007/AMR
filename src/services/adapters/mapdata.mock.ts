import type { MapDataService } from '../types';
/** Procedural map data until scripts/bake-map.ts exists (M4). 96×72 grid, reveal step per cell. */
export const mockMapData: MapDataService = {
  async loadReveal() {
    const w = 96, h = 72, out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = Math.min(255, ((x + y) * 255) / (w + h));
    return out;
  },
  async loadPath() {
    return [[-2.5, 1.5], [-1, 1], [0.5, 0], [1.5, -1]];
  },
};
