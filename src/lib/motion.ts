/** GSAP + ScrollTrigger + Lenis load after first paint (separate chunk), cached. */
let p: Promise<{ gsap: typeof import('gsap').gsap; ScrollTrigger: typeof import('gsap/ScrollTrigger').ScrollTrigger }> | null = null;
export function loadGsap() {
  return (p ??= Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([g, st]) => {
    g.gsap.registerPlugin(st.ScrollTrigger);
    return { gsap: g.gsap, ScrollTrigger: st.ScrollTrigger };
  }));
}
export const loadLenis = () => import('lenis').then((m) => m.default);
