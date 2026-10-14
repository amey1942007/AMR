/**
 * login-spec §1.1 redirect order: (1) `?next=` if it is a same-origin relative path ("/…", not "//" or "/\\"), or an
 * exact allow-listed absolute URL; (2) NEXT_PUBLIC_CONTROL_PANEL_URL if its origin is allow-listed; (3) /control/.
 */
export const DEFAULT_TARGET = '/control/';

export function isSafeRelative(next: string): boolean {
  if (!next || next.length > 2048) return false;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return false;
  // No backslashes, control chars or encoded slashes that browsers may normalise into a protocol-relative URL.
  if (/[\\\u0000-\u001f\u007f]/.test(next) || /^\/(%2f|%5c)/i.test(next)) return false;
  if (/%(0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(next)) return false; // encoded control chars / backslash
  // Dot segments (raw or encoded) are rejected outright: /.//evil.com, /../../evil.
  if (/(^|\/)(\.|%2e){1,2}(\/|$|\?|#)/i.test(next)) return false;
  return normalizeRelative(next) !== null;
}

/** Rebuilds a same-origin path from the parsed URL (pathname+search+hash); null if it isn't one or starts with `//`. */
export function normalizeRelative(next: string): string | null {
  try {
    const u = new URL(next, 'https://same.invalid');
    if (u.origin !== 'https://same.invalid' || u.pathname.startsWith('//') || u.pathname.includes('\\')) return null;
    return u.pathname + u.search + u.hash;
  } catch { return null; }
}

function allowedAbsolute(url: string, allowlist: string[]): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return allowlist.some((a) => { try { return new URL(a).origin === u.origin; } catch { return false; } });
  } catch { return false; }
}

export function redirectTarget(opts: { next?: string | null; controlPanelUrl?: string; allowlist: string[] }): string {
  const { next, controlPanelUrl, allowlist } = opts;
  if (next) {
    if (isSafeRelative(next)) return normalizeRelative(next) ?? DEFAULT_TARGET;
    if (allowlist.includes(next) && allowedAbsolute(next, allowlist)) return next;
  }
  if (controlPanelUrl && allowedAbsolute(controlPanelUrl, allowlist)) return controlPanelUrl;
  return DEFAULT_TARGET;
}
