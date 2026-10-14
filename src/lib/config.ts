/** Build-time public env (NEXT_PUBLIC_* are inlined by Next). Only the Supabase *publishable* key ever appears here. */
export type ContactAdapterName = 'mock' | 'mailto' | 'supabase' | 'http';

export type AuthAdapterName = 'mock' | 'supabase' | 'none';

export interface AppConfig {
  contactAdapter: ContactAdapterName;
  authAdapter: AuthAdapterName;
  /** Comma-separated origins from NEXT_PUBLIC_AUTH_REDIRECT_ALLOWLIST (login-spec §1.1). */
  authRedirectAllowlist: string[];
  maintenance: boolean;
  maintenanceUntil?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  contactEndpoint?: string;
  siteUrl: string;
  basePath: string;
  controlPanelUrl?: string;
  email: string;
}

const ADAPTERS: ContactAdapterName[] = ['mock', 'mailto', 'supabase', 'http'];

export function resolveContactAdapter(env: {
  adapter?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  nodeEnv?: string;
}): ContactAdapterName {
  const a = env.adapter?.trim().toLowerCase();
  const prod = env.nodeEnv === 'production';
  // The mock fakes success: it can never be selected in a production build.
  if (a === 'mock' && prod) return env.supabaseUrl && env.supabaseKey ? 'supabase' : 'mailto';
  if (a && (ADAPTERS as string[]).includes(a)) {
    // Never pick supabase without credentials: degrade to mailto.
    if (a === 'supabase' && !(env.supabaseUrl && env.supabaseKey)) return 'mailto';
    return a as ContactAdapterName;
  }
  // Unset: mock for dev/test (locked decision); production builds must never silently fake success.
  if (!prod) return 'mock';
  return env.supabaseUrl && env.supabaseKey ? 'supabase' : 'mailto';
}

/**
 * login-spec §1.6: explicit mock | supabase | none wins (supabase without URL+key degrades to none). Unset: supabase when
 * URL and key exist, else none in production and mock in dev. The mock never protects anything: /control is a stub.
 */
export function resolveAuthAdapter(env: { adapter?: string; supabaseUrl?: string; supabaseKey?: string; nodeEnv?: string }): AuthAdapterName {
  const a = env.adapter?.trim().toLowerCase();
  const creds = !!(env.supabaseUrl && env.supabaseKey);
  const prod = env.nodeEnv === 'production';
  // The mock accepts a demo password: it can never be selected in a production build (review login #1).
  if (a === 'mock') return prod ? (creds ? 'supabase' : 'none') : 'mock';
  if (a === 'none') return a;
  if (a === 'supabase') return creds ? 'supabase' : 'none';
  if (creds) return 'supabase';
  return env.nodeEnv === 'production' ? 'none' : 'mock';
}

/** login-spec §1.7: the publishable key first, the legacy anon key as fallback. Never a secret/service_role key. */
export function readSupabaseKey(env: { publishable?: string; anon?: string }): string | undefined {
  return empty(env.publishable) ?? empty(env.anon);
}

const empty = (v?: string) => (v && v.trim() ? v.trim() : undefined);

export function readConfig(): AppConfig {
  const supabaseUrl = empty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = readSupabaseKey({ publishable: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  return {
    contactAdapter: resolveContactAdapter({
      adapter: process.env.NEXT_PUBLIC_CONTACT_ADAPTER,
      supabaseUrl,
      supabaseKey,
      nodeEnv: process.env.NODE_ENV,
    }),
    authAdapter: resolveAuthAdapter({ adapter: process.env.NEXT_PUBLIC_AUTH_ADAPTER, supabaseUrl, supabaseKey, nodeEnv: process.env.NODE_ENV }),
    authRedirectAllowlist: (process.env.NEXT_PUBLIC_AUTH_REDIRECT_ALLOWLIST ?? 'https://bot.amrslam.tech').split(',').map((o) => o.trim()).filter(Boolean),
    maintenance: process.env.NEXT_PUBLIC_MAINTENANCE === '1',
    maintenanceUntil: empty(process.env.NEXT_PUBLIC_MAINTENANCE_UNTIL),
    supabaseUrl,
    supabaseKey,
    contactEndpoint: empty(process.env.NEXT_PUBLIC_CONTACT_ENDPOINT),
    siteUrl: empty(process.env.NEXT_PUBLIC_SITE_URL) ?? 'https://amrslam.tech',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
    controlPanelUrl: empty(process.env.NEXT_PUBLIC_CONTROL_PANEL_URL),
    email: 'amey@amrslam.tech',
  };
}
