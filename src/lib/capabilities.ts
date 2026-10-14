'use client';
import { useSyncExternalStore } from 'react';
import type { Tier } from './store';

export interface Capabilities { ready: boolean; webgl2: boolean; reducedMotion: boolean; tier: Tier; mobile: boolean; saveData: boolean }
/** Server/prerender default (G11): no 3D, not reduced → DOM hero + info render without JS. */
export const SERVER_CAPS: Capabilities = { ready: false, webgl2: false, reducedMotion: false, tier: 'high', mobile: false, saveData: false };

let webgl2: boolean | null = null;
function hasWebGL2() {
  if (webgl2 !== null) return webgl2;
  try {
    const c = document.createElement('canvas');
    webgl2 = !!c.getContext('webgl2');
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

export function detectTier(env: { cores?: number; memory?: number; coarse: boolean; width: number; saveData: boolean; slowNet: boolean; override?: string | null }): Tier {
  if (env.override === 'low' || env.override === 'high') return env.override;
  if (env.width < 768) return 'low'; // lighter 3D on mobile (locked decision)
  if (env.saveData || env.slowNet) return 'low';
  if ((env.cores ?? 8) <= 4 || (env.memory ?? 8) <= 4) return 'low';
  if (env.coarse && (env.cores ?? 8) <= 6) return 'low';
  return 'high';
}

let cache: Capabilities | null = null;
function compute(): Capabilities {
  const q = new URLSearchParams(location.search);
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  const saveData = !!nav.connection?.saveData;
  const rmOverride = q.get('rm');
  const reducedMotion = rmOverride ? rmOverride === '1' : matchMedia('(prefers-reduced-motion: reduce)').matches;
  const webgl = q.get('nowebgl') === '1' ? false : hasWebGL2();
  return {
    ready: true,
    webgl2: webgl,
    reducedMotion,
    mobile: innerWidth < 768,
    saveData,
    tier: detectTier({
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      coarse: matchMedia('(pointer: coarse)').matches,
      width: innerWidth,
      saveData,
      slowNet: !!nav.connection?.effectiveType && nav.connection.effectiveType !== '4g',
      override: q.get('tier'),
    }),
  };
}

function subscribe(cb: () => void) {
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const on = () => { cache = compute(); cb(); }; // R9: re-render mode in place, no reload
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}

export function useCapabilities(): Capabilities {
  return useSyncExternalStore(subscribe, () => (cache ??= compute()), () => SERVER_CAPS);
}
