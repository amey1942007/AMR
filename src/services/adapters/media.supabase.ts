import type { MediaVideo } from '../types';
import { isPublishableKey } from './contact.shared';

/** Row shape for public.site_videos (published rows only are readable via RLS). */
export type SiteVideoRow = {
  id: string;
  kind: 'file' | 'youtube' | 'vimeo';
  title: string;
  description: string | null;
  duration_sec: number | null;
  youtube_id: string | null;
  vimeo_id: string | null;
  poster_url: string | null;
  sources: { src: string; type: 'video/mp4' | 'video/webm' }[] | null;
  captions: { src: string; srclang: string; label: string; default?: boolean }[] | null;
  transcript_url: string | null;
  width: number | null;
  height: number | null;
  published: boolean;
};

export function rowToMediaVideo(row: SiteVideoRow): MediaVideo | null {
  if (!row.published) return null;
  const base = {
    title: row.title,
    description: row.description ?? undefined,
    durationSec: row.duration_sec ?? undefined,
    transcriptUrl: row.transcript_url ?? undefined,
  };
  if (row.kind === 'youtube' && row.youtube_id) {
    return { kind: 'youtube', id: row.youtube_id, poster: row.poster_url ?? undefined, captions: 'provider', ...base };
  }
  if (row.kind === 'vimeo' && row.vimeo_id) {
    return { kind: 'vimeo', id: row.vimeo_id, poster: row.poster_url ?? undefined, captions: 'provider', ...base };
  }
  if (row.kind === 'file' && row.sources?.length && row.poster_url) {
    return {
      kind: 'file',
      sources: row.sources,
      poster: row.poster_url,
      captions: row.captions ?? undefined,
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      ...base,
    };
  }
  return null;
}

/** Fetches a published site_videos row. Returns null when unset, unpublished, or credentials missing. */
export async function fetchSiteVideo(id: string, cfg: { url?: string; key?: string; timeoutMs?: number } = {}): Promise<MediaVideo | null> {
  const url = cfg.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = cfg.key ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !isPublishableKey(key) || !/^https:\/\//.test(url)) return null;
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }) },
  });
  const { data, error } = await sb.from('site_videos').select('*').eq('id', id).eq('published', true).maybeSingle();
  if (error || !data) return null;
  return rowToMediaVideo(data as SiteVideoRow);
}
