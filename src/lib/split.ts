/** Tiny SSR-safe word splitter (no layout reads). Words are wrapped at render time; the parent carries aria-label. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
export const SPLIT_MIN_WIDTH = 812;
