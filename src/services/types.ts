import type { RobotSpec } from '@/lib/content';

export interface ContactPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
  /** Honeypot — must be empty for real humans. */
  website?: string;
  source?: string;
  /** Stored in the existing `subject` column (≤ 200); the contact page puts the topic here. */
  subject?: string | null;
  page_url?: string;
  user_agent?: string;
}
export type ContactStatus = 'ok' | 'error' | 'throttled' | 'unavailable';
export interface ContactResult { status: ContactStatus; retryInSec?: number }

export interface ContactService {
  readonly name: string;
  isAvailable(): boolean;
  submit(payload: ContactPayload): Promise<ContactResult>;
}

type MaybePromise<T> = T | Promise<T>;
export interface LinkItem { id: 'github' | 'demo' | 'control' | 'contact' | 'email'; label: string; href?: string; external?: boolean }
export interface ContentService {
  getRobots(): MaybePromise<{ amr4: RobotSpec; hardware: RobotSpec }>;
  getTechStack(): MaybePromise<readonly { label: string; icon?: string }[]>;
  getCopy(): MaybePromise<Record<string, unknown>>;
  getLinks(): MaybePromise<readonly LinkItem[]>;
}

/** ui-spec §14.2 */
export type MediaVideo =
  | { kind: 'file'; sources: { src: string; type: 'video/mp4' | 'video/webm' }[]; poster: string; posterSet?: { avif?: string; webp?: string; avif2x?: string; webp2x?: string }; captions?: { src: string; srclang: string; label: string; default?: boolean }[]; title: string; description?: string; transcriptUrl?: string; durationSec?: number; width?: number; height?: number }
  | { kind: 'youtube'; id: string; poster?: string; title: string; description?: string; transcriptUrl?: string; durationSec?: number; captions?: 'provider' }
  | { kind: 'vimeo'; id: string; poster?: string; title: string; description?: string; transcriptUrl?: string; durationSec?: number; captions?: 'provider' };

export interface MediaService {
  getVideo(id: 'simulation'): MediaVideo | null;
  hasDemoVideo: boolean;
  stillUrls: string[];
  posterUrl?: string;
  mapStaticUrl?: string;
  heroModel: { lo?: string; hi?: string };
  roomUrl?: string;
  floorTexture?: string;
  propsUrl?: string;
}

export interface MapDataService {
  loadReveal(): Promise<Uint8Array>;
  loadPath(): Promise<[number, number][]>;
}

/** login-spec §1.6. Provider errors are mapped inside adapters; the UI only ever sees these statuses. */
export type AuthResult = { status: 'ok' } | { status: 'invalid' } | { status: 'rate_limited'; retryAfterSec?: number } | { status: 'network' } | { status: 'unavailable' };
export interface Session { email?: string; expiresAt?: number }
export type Unsubscribe = () => void;
export interface AuthService {
  readonly name: string;
  isAvailable(): boolean;
  signIn(c: { email: string; password: string }): Promise<AuthResult>;
  signOut(): Promise<void>;
  getSession(): Promise<Session | null>;
  onChange(cb: (s: Session | null) => void): Unsubscribe;
}

export interface ConfigService {
  controlPanelUrl?: string;
  authRedirectAllowlist: string[];
  siteUrl: string;
  basePath: string;
  email: string;
}

export interface Services {
  contact: ContactService;
  auth: AuthService;
  content: ContentService;
  media: MediaService;
  mapData: MapDataService;
  config: ConfigService;
}
