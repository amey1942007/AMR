/** One shared rAF loop (no GSAP needed for first paint). Callbacks get (seconds, deltaSeconds). */
type Cb = (t: number, dt: number) => void;
const cbs = new Set<Cb>();
let raf = 0, last = 0;
function loop(now: number) {
  const t = now / 1000, dt = last ? Math.min(0.1, t - last) : 0;
  last = t;
  cbs.forEach((cb) => cb(t, dt));
  raf = cbs.size ? requestAnimationFrame(loop) : 0;
}
export function addTick(cb: Cb) {
  cbs.add(cb);
  if (!raf && typeof window !== 'undefined') { last = 0; raf = requestAnimationFrame(loop); }
  return () => { cbs.delete(cb); };
}
