/** Plain per-frame scene state (brief §9/§14 + ui-spec §7.4). Written by the master timeline (timeline.ts, lazy), read every frame. */
export const S = {
  p: 0, uDrive: 0, roomOpacity: 0, propsIn: 0, bgMix: 0, cloudOpacity: 0, cloudLight: 0, cloudDissolve: 0, stars: 0,
  heroTitle: 1, tagline: 1, minimap: 0, beyond: 0, c1: 0, c2: 0, c3: 0, cb1: 0, cb2: 0, cb3: 0, cb4: 0, chip: 0,
  fog: 0, envIntensity: 0.8, exposure: 1.0, skyMix: 0, shadowFrustum: 0,
};
export type SceneState = typeof S;
export const NAV_DARK_AT = 0.18;
const HYST = 0.005;
/** Nav theme with ±0.005 hysteresis so it never flickers at the threshold. */
export function nextNavDark(prev: boolean, p: number) {
  return prev ? p > NAV_DARK_AT - HYST : p >= NAV_DARK_AT + HYST;
}

/** `?capture=1` (screenshot tooling only): scroll scrub and robot catch-up snap instantly so slow software-GL frames still land on the requested p. */
export const CAPTURE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('capture');
