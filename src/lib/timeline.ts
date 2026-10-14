import { getLenis } from './lenis-ref';
import { Timeline } from './tween';
import { addTick } from './ticker';
import { useScene } from './store';

import { CAPTURE, S, nextNavDark } from './scene-state';
export { S, nextNavDark, NAV_DARK_AT } from './scene-state';

/** Builds the paused master timeline (duration 1 → time = p). Separate from the trigger so tests can drive it. */
export function buildMasterTimeline() {
  const tl = new Timeline(S);
  tl.to({ p: 1, duration: 1 }, 0)
    .to({ heroTitle: 0, duration: 0.16, ease: 'power2.in' }, 0.04)
    .to({ tagline: 0, duration: 0.09 }, 0.03)
    .to({ roomOpacity: 1, duration: 0.18, ease: 'power1.out' }, 0.08)
    .to({ propsIn: 1, duration: 0.2, ease: 'power1.out' }, 0.1)
    .to({ bgMix: 1, duration: 0.22 }, 0.06)
    .to({ shadowFrustum: 1, duration: 0.26 }, 0.04)
    .to({ uDrive: 1, duration: 0.54, ease: 'sine.inOut' }, 0.26)
    .to({ minimap: 1, duration: 0.06 }, 0.26)
    .to({ minimap: 0, duration: 0.08 }, 0.76)
    .to({ c1: 1, duration: 0.04 }, 0.3)
    .to({ c1: 0, duration: 0.04 }, 0.38)
    .to({ c2: 1, duration: 0.04 }, 0.42)
    .to({ c2: 0, duration: 0.04 }, 0.5)
    .to({ c3: 1, duration: 0.04 }, 0.54)
    .to({ c3: 0, duration: 0.04 }, 0.62)
    .to({ chip: 1, duration: 0.04 }, 0.3)
    .to({ chip: 0, duration: 0.04 }, 0.7)
    .to({ fog: 1, duration: 0.5 }, 0.3)
    .to({ envIntensity: 0.45, exposure: 0.95, duration: 0.1 }, 0.3)
    .to({ envIntensity: 0.35, exposure: 0.9, duration: 0.3 }, 0.6)
    .to({ skyMix: 1, duration: 0.2 }, 0.6)
    .to({ cloudOpacity: 1, duration: 0.1 }, 0.62)
    .to({ beyond: 1, duration: 0.04 }, 0.66)
    .to({ beyond: 0, duration: 0.04 }, 0.76)
    .to({ cloudLight: 1, duration: 0.12 }, 0.78)
    .to({ cloudDissolve: 1, duration: 0.12, ease: 'power1.in' }, 0.86)
    .to({ stars: 0.6, duration: 0.16 }, 0.84);
  return tl;
}

/**
 * Scroll → progress without ScrollTrigger: start = #journey top, end = #info top − 35 % viewport. Scrub ≈ 1 s
 * (exponential catch-up on the shared ticker). Resize/orientation keeps the current progress (review #9):
 * the scroll position is restored for the same p once start/end are recomputed.
 */
export function createJourney() {
  const tl = buildMasterTimeline();
  let start = 0, end = 1, cur = 0, raw = 0;
  const measure = () => {
    const j = document.getElementById('journey'), i = document.getElementById('info');
    if (!j || !i) return;
    start = j.getBoundingClientRect().top + window.scrollY;
    end = Math.max(start + 1, i.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35);
  };
  const read = () => Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
  measure();
  raw = cur = read();
  tl.progress(cur);
  const apply = () => {
    tl.progress(cur);
    const { navDark } = useScene.getState();
    const nd = nextNavDark(navDark, S.p);
    if (nd !== navDark) useScene.setState({ navDark: nd });
  };
  apply();
  const onScroll = () => { raw = read(); };
  const off = addTick((_, _dt, dt) => {
    if (Math.abs(raw - cur) < 1e-5) { if (cur !== raw) { cur = raw; apply(); } return; }
    cur = CAPTURE ? raw : cur + (raw - cur) * (1 - Math.exp(-dt / 0.3)); // scrub ≈ 1 s to settle in wall time, even when frames are slow (raw dt)
    apply();
  });
  let rz = 0;
  const onResize = () => {
    const keep = raw;
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      measure();
      const y = start + keep * (end - start);
      const l = getLenis();
      if (Math.abs(window.scrollY - y) > 1) { if (l) l.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }
      raw = cur = keep; apply();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  ro.observe(document.body);
  return () => {
    off(); ro.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    tl.kill();
  };
}
