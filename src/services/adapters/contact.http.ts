import type { ContactService } from '../types';
/** Placeholder for a future /api/contact route (Vercel). Not wired in M0; behaves like mailto. */
export function createHttpContact(): ContactService {
  return { name: 'http (not implemented)', isAvailable: () => false, submit: async () => ({ status: 'unavailable' }) };
}
