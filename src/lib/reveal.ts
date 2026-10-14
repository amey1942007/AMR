/**
 * Reveal trigger derived from the CURRENT position, not from intersection edges: an element counts as reached when
 * its top is above `frac` of the viewport, including when it's already been scrolled past (End key, anchor jump,
 * restored scroll). IntersectionObserver alone misses below → above jumps (no intersecting edge), which left blocks
 * stuck hidden (review v3). Re-checks on scroll (rAF-throttled), resize and IO callbacks; stops when all are done.
 */
export function onReached(els: HTMLElement[], frac: number, cb: (reached: HTMLElement[]) => void): () => void {
  const pending = new Set(els);
  let raf = 0;
  const check = () => {
    raf = 0;
    const vh = window.innerHeight * frac, hit: HTMLElement[] = [];
    for (const el of pending) if (el.getBoundingClientRect().top < vh) hit.push(el);
    if (!hit.length) return;
    hit.forEach((el) => pending.delete(el));
    cb(hit);
    if (!pending.size) stop();
  };
  const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
  const io = new IntersectionObserver(schedule, { rootMargin: `0px 0px -${Math.round((1 - frac) * 100)}% 0px` });
  els.forEach((el) => io.observe(el));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  function stop() {
    io.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  schedule();
  return stop;
}
