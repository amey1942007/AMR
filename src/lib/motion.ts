/** Lenis loads after first paint (separate chunk), cached. GSAP was replaced by lib/tween.ts (JS budget). */
export const loadLenis = () => import('lenis').then((m) => m.default);
