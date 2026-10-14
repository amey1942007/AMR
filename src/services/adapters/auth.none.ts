import type { AuthService } from '../types';
/** login-spec §1.6: no sign-in backend configured. /login shows "Sign-in isn't available yet." */
export const noneAuth: AuthService = {
  name: 'none',
  isAvailable: () => false,
  signIn: async () => ({ status: 'unavailable' }),
  signOut: async () => {},
  getSession: async () => null,
  onChange: () => () => {},
};
