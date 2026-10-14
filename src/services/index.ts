import type { AppConfig } from '@/lib/config';
import type { ContactService, Services } from './types';
import { createMockContact, type MockMode } from './adapters/contact.mock';
import { createMailtoContact } from './adapters/contact.mailto';
import { createSupabaseContact } from './adapters/contact.supabase';
import { createHttpContact } from './adapters/contact.http';
import { staticContent } from './adapters/content.static';
import { staticMedia } from './adapters/media.static';
import { mockMapData } from './adapters/mapdata.mock';

export function createContactService(cfg: AppConfig, mockMode?: MockMode): ContactService {
  switch (cfg.contactAdapter) {
    case 'supabase':
      return cfg.supabaseUrl && cfg.supabaseKey
        ? createSupabaseContact({ url: cfg.supabaseUrl, key: cfg.supabaseKey })
        : createMailtoContact();
    case 'mock':
      return createMockContact({ mode: mockMode });
    case 'http':
      return createHttpContact();
    default:
      return createMailtoContact();
  }
}

/** opts.mockMode: dev-only override from ?mock=error|slow (only honoured when the mock adapter is active). */
export function createServices(cfg: AppConfig, opts: { mockMode?: MockMode } = {}): Services {
  return {
    contact: createContactService(cfg, opts.mockMode),
    content: staticContent,
    media: staticMedia,
    mapData: mockMapData,
    config: { controlPanelUrl: cfg.controlPanelUrl, siteUrl: cfg.siteUrl, basePath: cfg.basePath, email: cfg.email },
  };
}
export type { Services } from './types';
