/** Exit timing for the site menu. Durations match --dur-menu / --dur-theme; stagger matches globals.css. */
export const MENU_LINE_MS = 600;
export const MENU_STAGGER_MS = 60;
export const MENU_FADE_MS = 300;
/** Ignore transitionend that fires before the exit has actually finished (interrupted enters, bubbled events). */
export const MENU_EXIT_EPSILON_MS = 40;
export const MENU_EXIT_FALLBACK_PAD_MS = 150;

export type MenuPhase = 'closed' | 'open' | 'closing';

/**
 * Presence while `open` is the store flag.
 * `phase` is the phase we are already in: `closed` means the exit has settled (do not replay it).
 * Reduced motion skips `closing` and unmounts on the same render.
 */
export function menuPhaseForOpen(phase: MenuPhase, open: boolean, reducedMotion: boolean): MenuPhase {
  if (open) return 'open';
  if (reducedMotion || phase === 'closed') return 'closed';
  return 'closing';
}

/** Longest line: duration plus the reverse stagger on the first item. */
export function menuExitDurationMs(itemCount: number): number {
  const n = Math.max(itemCount, 1);
  return MENU_LINE_MS + (n - 1) * MENU_STAGGER_MS;
}

export function menuExitFallbackMs(itemCount: number): number {
  return menuExitDurationMs(itemCount) + MENU_EXIT_FALLBACK_PAD_MS;
}

export function cssTimeMs(value: string): number {
  const m = /^(-?\d+(?:\.\d+)?)(ms|s)$/.exec(value.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  return m[2] === 'ms' ? n : n * 1000;
}

function propertyMatches(declared: string, property: string): boolean {
  if (declared === 'all' || declared === property) return true;
  return property === 'transform' && (declared === 'transform' || declared === '-webkit-transform');
}

/** Wall-clock end (duration + delay) for one property, from a computed transition. */
export function transitionEndMs(
  style: { transitionProperty: string; transitionDuration: string; transitionDelay: string },
  property: string,
): number {
  const props = style.transitionProperty.split(',').map((s) => s.trim()).filter(Boolean);
  const durs = style.transitionDuration.split(',').map((s) => s.trim()).filter(Boolean);
  const delays = style.transitionDelay.split(',').map((s) => s.trim()).filter(Boolean);
  if (!props.length || !durs.length) return 0;
  const steps = props.includes('all') ? Math.max(props.length, durs.length) : props.length;
  let max = 0;
  for (let i = 0; i < steps; i++) {
    const prop = props[i % props.length];
    if (!propertyMatches(prop, property)) continue;
    const dur = cssTimeMs(durs[i % durs.length] || '0s');
    const delay = delays.length ? cssTimeMs(delays[i % delays.length] || '0s') : 0;
    if (dur <= 0) continue;
    max = Math.max(max, dur + delay);
  }
  return max;
}

/** True once `elapsedMs` has reached the measured exit (with a small early-frame tolerance). */
export function shouldSettleMenuExit(elapsedMs: number, expectedMs: number): boolean {
  if (expectedMs <= 0) return true;
  return elapsedMs >= expectedMs - MENU_EXIT_EPSILON_MS;
}
