import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScene } from './store';

/** Plain per-frame scene state (brief §9/§14 + ui-spec §7.4). Written by the master timeline, read in useFrame / rAF. */
export const S = {
  p: 0,
  uDrive: 0,
  roomOpacity: 0,
  propsIn: 0,
  bgMix: 0,
  cloudOpacity: 0,
  cloudLight: 0,
  cloudDissolve: 0,
  stars: 0,
  heroTitle: 1,
  tagline: 1,
  minimap: 0,
  beyond: 0,
  c1: 0,
  c2: 0,
  c3: 0,
  chip: 0,
  fog: 0,
  envIntensity: 0.8,
  exposure: 1.0,
  skyMix: 0,
  shadowFrustum: 0,
};
export type SceneState = typeof S;

export const NAV_DARK_AT = 0.18;
const HYST = 0.005;

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

/** Nav theme with ±0.005 hysteresis so it never flickers at the threshold. */
export function nextNavDark(prev: boolean, p: number) {
  return prev ? p > NAV_DARK_AT - HYST : p >= NAV_DARK_AT + HYST;
}

export function createJourney() {
  gsap.registerPlugin(ScrollTrigger);
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
