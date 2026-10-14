import type Lenis from 'lenis';
let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => void (lenis = l);
export const getLenis = () => lenis;
