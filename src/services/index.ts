import type { AppConfig } from '@/lib/config';
import type { AuthService, ContactService, Services } from './types';
import { isPublishableKey } from './adapters/contact.shared';
import { staticContent } from './adapters/content.static';
import { staticMedia } from './adapters/media.static';
import { runtimeMapData } from './adapters/mapdata.runtime';

/**
 * Picks the contact adapter by config. Availability is decided synchronously from config; the adapter code itself
 * (and supabase-js) loads on first submit, keeping it out of the initial bundle.
 */
export function createContactService(cfg: AppConfig): ContactService {
  const kind = cfg.contactAdapter;
  const available =
    kind === 'mock' ||
    (kind === 'supabase' && !!cfg.supabaseUrl && !!cfg.supabaseKey && isPublishableKey(cfg.supabaseKey) && /^https:\/\//.test(cfg.supabaseUrl)) ||
    (kind === 'http' && !!(cfg.contactEndpoint ?? '/api/contact'));
  let impl: Promise<ContactService> | null = null;
  const load = () =>
    (impl ??= (async () => {
      if (kind === 'supabase' && available) return (await import('./adapters/contact.supabase')).createSupabaseContact({ url: cfg.supabaseUrl!, key: cfg.supabaseKey! });
      if (kind === 'mock') return (await import('./adapters/contact.mock')).createMockContact();
      if (kind === 'http') return (await import('./adapters/contact.http')).createHttpContact({ endpoint: cfg.contactEndpoint ?? '/api/contact' });
      return (await import('./adapters/contact.mailto')).createMailtoContact();
    })());
  return {
    name: available ? kind : 'mailto',
    isAvailable: () => available,
    submit: async (p) => (available ? (await load()).submit(p) : { status: 'unavailable' }),
  };
}

/**
 * login-spec §1.6: picks the auth adapter by NEXT_PUBLIC_AUTH_ADAPTER. Availability is decided from config; the
 * adapter code (and supabase-js for the supabase adapter) loads on first use, so it stays out of the initial bundle.
 */
export function createAuthService(cfg: AppConfig): AuthService {
  const kind = cfg.authAdapter;
  // NODE_ENV is inlined at build time: in production the mock branch is dead code, so the demo chunk never ships.
  const devMock = process.env.NODE_ENV !== 'production' && kind === 'mock';
  const available = devMock || (kind === 'supabase' && !!cfg.supabaseUrl && !!cfg.supabaseKey && isPublishableKey(cfg.supabaseKey) && /^https:\/\//.test(cfg.supabaseUrl));
  let impl: Promise<AuthService> | null = null;
  const load = () =>
    (impl ??= (async () => {
      if (kind === 'supabase' && available) return (await import('./adapters/auth.supabase')).createSupabaseAuth({ url: cfg.supabaseUrl!, key: cfg.supabaseKey! });
      if (process.env.NODE_ENV !== 'production' && kind === 'mock') return (await import('./adapters/auth.mock')).createMockAuth();
      return (await import('./adapters/auth.none')).noneAuth;
    })());
  return {
    name: available ? kind : 'none',
    isAvailable: () => available,
    signIn: async (c) => (available ? (await load()).signIn(c) : { status: 'unavailable' }),
    signOut: async () => { if (available) await (await load()).signOut(); },
    getSession: async () => (available ? (await load()).getSession() : null),
    onChange: (cb) => {
      if (!available) return () => {};
      let un: (() => void) | null = null, dead = false;
      load().then((a) => { if (!dead) un = a.onChange(cb); });
      return () => { dead = true; un?.(); };
    },
  };
}

export function createServices(cfg: AppConfig): Services {
  return {
    contact: createContactService(cfg),
    auth: createAuthService(cfg),
    content: staticContent,
    media: staticMedia,
    mapData: runtimeMapData,
    config: { controlPanelUrl: cfg.controlPanelUrl, authRedirectAllowlist: cfg.authRedirectAllowlist, siteUrl: cfg.siteUrl, basePath: cfg.basePath, email: cfg.email },
  };
}
export type { Services } from './types';
