import type { AppConfig } from '@/lib/config';
import type { ContactService, Services } from './types';
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

export function createServices(cfg: AppConfig): Services {
  return {
    contact: createContactService(cfg),
    content: staticContent,
    media: staticMedia,
    mapData: runtimeMapData,
    config: { controlPanelUrl: cfg.controlPanelUrl, siteUrl: cfg.siteUrl, basePath: cfg.basePath, email: cfg.email },
  };
}
export type { Services } from './types';
