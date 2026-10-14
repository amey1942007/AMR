import type { RobotSpec } from '@/lib/content';

export interface ContactPayload {
  name: string;
  email: string;
  company?: string;
  message: string;
  /** Honeypot — must be empty for real humans. */
  website?: string;
  source?: string;
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

export interface MediaService {
  hasDemoVideo: boolean;
  stillUrls: string[];
  posterUrl?: string;
  heroModel: { lo?: string; hi?: string };
  roomUrl?: string;
  floorTexture?: string;
  propsUrl?: string;
}

export interface MapDataService {
  loadReveal(): Promise<Uint8Array>;
  loadPath(): Promise<[number, number][]>;
}

export interface ConfigService {
  controlPanelUrl?: string;
  siteUrl: string;
  basePath: string;
  email: string;
}

export interface Services {
  contact: ContactService;
  content: ContentService;
  media: MediaService;
  mapData: MapDataService;
  config: ConfigService;
}
