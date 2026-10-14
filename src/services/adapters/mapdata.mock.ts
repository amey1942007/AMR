import type { MapDataService } from '../types';
const GRID = { w: 100, h: 70 } as const; // keep in sync with lib/grid (no three.js import here)
/** Procedural 100 × 70 map (same format as baked: reveal ++ state ++ roomId, 3 × 7000); border = occupied. */
export const mockMapData: MapDataService = {
  async loadReveal() {
    const n = GRID.w * GRID.h, out = new Uint8Array(n * 3);
    for (let y = 0; y < GRID.h; y++)
      for (let x = 0; x < GRID.w; x++) {
        const i = y * GRID.w + x;
        out[i] = Math.round((x / (GRID.w - 1)) * 254);
        out[n + i] = x === 0 || y === 0 || x === GRID.w - 1 || y === GRID.h - 1 ? 2 : 1;
        out[2 * n + i] = x < 50 ? 1 : 6;
      }
    return out;
  },
  async loadPath() {
    return [[-2.5, 1.5], [0, 0], [2, 1.8]];
  },
};
