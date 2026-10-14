import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScene } from './store';

import { S, nextNavDark } from './scene-state';
export { S, nextNavDark, NAV_DARK_AT } from './scene-state';

/** Builds the paused master timeline (duration 1 → time = p). Separate from the trigger so tests can drive it. */
export function buildMasterTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  tl.to(S, { p: 1, duration: 1 }, 0)
    .to(S, { heroTitle: 0, duration: 0.16, ease: 'power2.in' }, 0.04)
    .to(S, { tagline: 0, duration: 0.09 }, 0.03)
    .to(S, { roomOpacity: 1, duration: 0.18, ease: 'power1.out' }, 0.08)
    .to(S, { propsIn: 1, duration: 0.2, ease: 'power1.out' }, 0.1)
    .to(S, { bgMix: 1, duration: 0.22 }, 0.06)
    .to(S, { shadowFrustum: 1, duration: 0.26 }, 0.04)
    .to(S, { uDrive: 1, duration: 0.54, ease: 'sine.inOut' }, 0.26)
    .to(S, { minimap: 1, duration: 0.06 }, 0.26)
    .to(S, { minimap: 0, duration: 0.08 }, 0.76)
    .to(S, { c1: 1, duration: 0.04 }, 0.3)
    .to(S, { c1: 0, duration: 0.04 }, 0.38)
    .to(S, { c2: 1, duration: 0.04 }, 0.42)
    .to(S, { c2: 0, duration: 0.04 }, 0.5)
    .to(S, { c3: 1, duration: 0.04 }, 0.54)
    .to(S, { c3: 0, duration: 0.04 }, 0.62)
    .to(S, { chip: 1, duration: 0.04 }, 0.3)
    .to(S, { chip: 0, duration: 0.04 }, 0.7)
    .to(S, { fog: 1, duration: 0.5 }, 0.3)
    .to(S, { envIntensity: 0.35, exposure: 0.9, duration: 0.3 }, 0.6)
    .to(S, { skyMix: 1, duration: 0.2 }, 0.6)
    .to(S, { cloudOpacity: 1, duration: 0.1 }, 0.62)
    .to(S, { beyond: 1, duration: 0.04 }, 0.66)
    .to(S, { beyond: 0, duration: 0.04 }, 0.76)
    .to(S, { cloudLight: 1, duration: 0.12 }, 0.78)
    .to(S, { cloudDissolve: 1, duration: 0.12, ease: 'power1.in' }, 0.86)
    .to(S, { stars: 0.6, duration: 0.16 }, 0.84);
  return tl;
}

export function createJourney() {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.refresh();
  const tl = buildMasterTimeline();
  const st = ScrollTrigger.create({
    trigger: '#journey',
    start: 'top top',
    endTrigger: '#info',
    end: 'top 35%',
    scrub: 1,
    onUpdate: (s) => {
      tl.progress(s.progress);
      const { navDark } = useScene.getState();
      const nd = nextNavDark(navDark, S.p);
      if (nd !== navDark) useScene.setState({ navDark: nd });
    },
    onRefresh: (s) => tl.progress(s.progress),
  });
  return () => {
    st.kill();
    tl.kill();
  };
}
