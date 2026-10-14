/** One shared rAF loop (no GSAP needed for first paint). Callbacks get (seconds, deltaSeconds, rawDelta). */
/** dt is clamped to 0.1 s (physics); raw is the true elapsed time (for unconditionally stable exponential smoothing). */
type Cb = (t: number, dt: number, raw: number) => void;
const cbs = new Set<Cb>();
let raf = 0, last = 0;
function loop(now: number) {
  const t = now / 1000, raw = last ? t - last : 0, dt = Math.min(0.1, raw);
  last = t;
  cbs.forEach((cb) => cb(t, dt, raw));
  raf = cbs.size ? requestAnimationFrame(loop) : 0;
}
export function addTick(cb: Cb) {
  cbs.add(cb);
  if (!raf && typeof window !== 'undefined') { last = 0; raf = requestAnimationFrame(loop); }
  return () => { cbs.delete(cb); };
}

