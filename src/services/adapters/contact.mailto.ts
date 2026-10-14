import type { ContactService } from '../types';
/** No backend configured: the drawer shows a mailto button instead of the form. */
export function createMailtoContact(): ContactService {
  return { name: 'mailto', isAvailable: () => false, submit: async () => ({ status: 'unavailable' }) };
}
