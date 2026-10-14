import type { ContentService } from '../types';
import { robots } from '@/lib/content';
/** Async mock (tests / future CMS): same shapes, resolves after a tick. */
export const mockContent: ContentService = {
  getRobots: async () => robots,
  getTechStack: async () => [{ label: 'Mock tech' }],
  getCopy: async () => ({ tagline: 'Mock tagline' }),
  getLinks: async () => [{ id: 'github', label: 'GitHub', href: 'https://example.com', external: true }],
};
