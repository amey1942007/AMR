/**
 * Tiny own motion engine (replaces GSAP + ScrollTrigger to keep the initial JS ≤ 180 KB gz including motion).
 * - `Timeline`: declarative, deterministic and reversible property tracks evaluated at a progress p ∈ [0,1]
 *   (same semantics as a paused GSAP timeline of `.to()` tweens: each tween starts from the previous end value).
 * - `tween()`: a time-based tween on the shared rAF ticker (lib/ticker.ts).
 */
import { addTick } from './ticker';

export type Ease = 'none' | 'power1.in' | 'power1.out' | 'power2.in' | 'power3.out' | 'sine.inOut';
export const EASES: Record<Ease, (t: number) => number> = {
  none: (t) => t,
  'power1.in': (t) => t * t,
  'power1.out': (t) => 1 - (1 - t) * (1 - t),
  'power2.in': (t) => t * t * t,
  'power3.out': (t) => 1 - Math.pow(1 - t, 4),
  'sine.inOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

type Num = Record<string, number>;
interface Seg { start: number; dur: number; to: number; ease: (t: number) => number }

export class Timeline<T extends object> {
  private tracks = new Map<string, { init: number; segs: Seg[] }>();
  private p = 0;
  constructor(private target: T) {}
  to(vals: Partial<Record<keyof T, number>> & { duration: number; ease?: Ease }, at: number) {
    const { duration, ease = 'none', ...rest } = vals as Num & { ease?: Ease };
    for (const [k, v] of Object.entries(rest)) {
      let tr = this.tracks.get(k);
      if (!tr) this.tracks.set(k, (tr = { init: (this.target as Num)[k], segs: [] }));
      tr.segs.push({ start: at, dur: duration, to: v, ease: EASES[ease] });
      tr.segs.sort((a, b) => a.start - b.start);
    }
    return this;
  }
  progress(): number;
  progress(p: number): this;
  progress(p?: number): number | this {
    if (p === undefined) return this.p;
    this.p = Math.min(1, Math.max(0, p));
    const t = this.target as Num;
    this.tracks.forEach((tr, k) => {
      let v = tr.init;
      for (const s of tr.segs) {
        if (this.p < s.start) break;
        const f = s.dur > 0 ? Math.min(1, (this.p - s.start) / s.dur) : 1;
        v = v + (s.to - v) * s.ease(f);
        if (f < 1) break;
      }
      t[k] = v;
    });
    return this;
  }
  kill() { this.tracks.clear(); }
}

/** Time-based tween on the shared ticker. Returns a kill function. */
export function tween(duration: number, ease: Ease, onUpdate: (v: number) => void, onComplete?: () => void) {
  let t = 0, done = false;
  const e = EASES[ease];
  const off = addTick((_, dt) => {
    if (done) return;
    t += dt;
    const f = duration > 0 ? Math.min(1, t / duration) : 1;
    onUpdate(e(f));
    if (f >= 1) { done = true; off(); onComplete?.(); }
  });
  return () => { done = true; off(); };
}
