/** Build-time public env (NEXT_PUBLIC_* are inlined by Next). Only the Supabase *publishable* key ever appears here. */
export type ContactAdapterName = 'mock' | 'mailto' | 'supabase' | 'http';

export interface AppConfig {
  contactAdapter: ContactAdapterName;
  supabaseUrl?: string;
  supabaseKey?: string;
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
  if (a && (ADAPTERS as string[]).includes(a)) {
    // Never pick supabase without credentials: degrade to mailto.
    if (a === 'supabase' && !(env.supabaseUrl && env.supabaseKey)) return 'mailto';
    return a as ContactAdapterName;
  }
  // Unset: mock for dev/test (locked decision); production builds must never silently fake success.
  if (env.nodeEnv !== 'production') return 'mock';
  return env.supabaseUrl && env.supabaseKey ? 'supabase' : 'mailto';
}

const empty = (v?: string) => (v && v.trim() ? v.trim() : undefined);

export function readConfig(): AppConfig {
  const supabaseUrl = empty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = empty(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return {
    contactAdapter: resolveContactAdapter({
      adapter: process.env.NEXT_PUBLIC_CONTACT_ADAPTER,
      supabaseUrl,
      supabaseKey,
      nodeEnv: process.env.NODE_ENV,
    }),
    supabaseUrl,
    supabaseKey,
    siteUrl: empty(process.env.NEXT_PUBLIC_SITE_URL) ?? 'https://amrslam.tech',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
    controlPanelUrl: empty(process.env.NEXT_PUBLIC_CONTROL_PANEL_URL),
    email: 'amey@amrslam.tech',
  };
}
