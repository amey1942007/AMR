export interface RoutePoint { p: [number, number]; mode?: 'fwd' | 'rev' | 'hold'; cusp?: boolean; r?: number; faceDeg?: number }
export interface PathSample { x: number; z: number; tx: number; tz: number; k: number; mode: 'fwd' | 'rev' | 'hold'; heading: number }
export interface BuiltPath {
  length: number;
  cuspS: number[];
  N: number;
  ds: number;
  pieces: unknown[];
  at(s: number): PathSample;
  heading(s: number): number;
  curvature: Float64Array;
}
export function buildPath(route: RoutePoint[], opts?: { radius?: number; minRadius?: number }): BuiltPath;
