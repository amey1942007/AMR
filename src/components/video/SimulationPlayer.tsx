'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MediaVideo } from '@/services/types';
import { useScene } from '@/lib/store';
import { useUI } from '@/lib/ui-store';
import { getLenis } from '@/lib/lenis-ref';
import { SignalLoader } from '@/components/utility/SignalLoader';
import '@/components/effects/effects.css';

export type State = 'poster' | 'loading' | 'playing' | 'paused' | 'ended' | 'error' | 'blocked';

function fmt(sec?: number) {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CONSENT_KEY = 'amr-consent-embeds';

/** ui-spec §14.3–14.4 runtime: dynamically imported by SimulationFacade on click (never in pre-click JS). */
export function SimulationPlayer({ video, initial = 'loading' }: { video: MediaVideo; initial?: State }) {
  const [state, setState] = useState<State>(initial);
  const [alwaysTick, setAlwaysTick] = useState(0);
  const always = useSyncExternalStore(
    () => () => {},
    () => { void alwaysTick; try { return localStorage.getItem(CONSENT_KEY) === '1'; } catch { return false; } },
    () => false,
  );
  const setAlways = (v: boolean) => { try { localStorage.setItem(CONSENT_KEY, v ? '1' : '0'); } catch { /* */ } setAlwaysTick((n) => n + 1); };
  const wrap = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrollY = useRef(0);
  const setPaused = useCallback((v: boolean) => useScene.setState({ renderPaused: v }), []);

  // Auto-pause when the section leaves the viewport or a dialog opens. Never auto-resume.
  useEffect(() => {
    const el = wrap.current;
    if (!el || !video) return;
    const pause = () => {
      const v = videoRef.current;
      if (v && !v.paused) v.pause();
      setPaused(false);
      setState((s) => (s === 'playing' ? 'paused' : s));
    };
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { if (!e.isIntersecting) pause(); }, { threshold: 0.25 })
      : null;
    if (io) io.observe(el);
    const un = useUI.subscribe((s, p) => { if (s.dialog && !p.dialog) pause(); });
    return () => { io?.disconnect(); un(); };
  }, [video, setPaused]);

  useEffect(() => () => setPaused(false), [setPaused]);

  // Fullscreen: restore scroll on exit (ui-spec §14.3).
  useEffect(() => {
    const onFs = () => {
      if (document.fullscreenElement) scrollY.current = window.scrollY;
      else {
        const y = scrollY.current;
        const l = getLenis();
        if (l) l.scrollTo(y, { immediate: true });
        else window.scrollTo(0, y);
      }
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const title = video.title;
  const dur = fmt(video.durationSec);
  const poster = 'poster' in video ? video.poster : undefined;
  const isEmbed = video.kind === 'youtube' || video.kind === 'vimeo';
  const embedSrc = video.kind === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&cc_load_policy=1`
    : video.kind === 'vimeo'
      ? `https://player.vimeo.com/video/${video.id}?autoplay=1&dnt=1&title=0&byline=0`
      : '';

  function start() {
    if (always && isEmbed) setAlways(true);
    setState('loading');
  }

  return (
    <div ref={wrap} data-lenis-prevent className="relative w-full">
      <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-dark)] bg-black/40 max-md:rounded-[12px]">
        {(state === 'poster' || state === 'loading') && (
          <button
            type="button"
            onClick={start}
            className="absolute inset-0 z-[1] grid place-items-center"
            aria-label={`Play: ${title}${dur ? ` (${dur})` : ''}`}
            aria-busy={state === 'loading' || undefined}
            disabled={state === 'loading'}
          >
            {poster && (
              <picture className="absolute inset-0">
                {video.kind === 'file' && video.posterSet?.avif && (
                  <source type="image/avif" srcSet={`${video.posterSet.avif} 1920w${video.posterSet.avif2x ? `, ${video.posterSet.avif2x} 3840w` : ''}`} sizes="(min-width:1440px) 1100px, 100vw" />
                )}
                {video.kind === 'file' && video.posterSet?.webp && (
                  <source type="image/webp" srcSet={`${video.posterSet.webp} 1920w${video.posterSet.webp2x ? `, ${video.posterSet.webp2x} 3840w` : ''}`} sizes="(min-width:1440px) 1100px, 100vw" />
                )}
                <img src={poster} alt="" loading="lazy" decoding="async" fetchPriority="low" className="h-full w-full object-cover" />
              </picture>
            )}
            <span className="relative z-[1]">
              {state === 'loading' ? (
                <SignalLoader active delay={0} minMs={0} />
              ) : (
                <span aria-hidden className="grid size-[72px] place-items-center rounded-full max-md:size-14" style={{ backgroundImage: 'var(--grad-pill)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                </span>
              )}
            </span>
          </button>
        )}

        {state !== 'poster' && video.kind === 'file' && (
          <video
            ref={(el) => {
              videoRef.current = el;
              if (el && state === 'loading') {
                const go = () => { el.play().then(() => { setState('playing'); setPaused(true); el.focus(); }).catch(() => setState('error')); };
                if (el.readyState >= 2) go();
                else el.addEventListener('canplay', go, { once: true });
                const t = window.setTimeout(() => setState((s) => (s === 'loading' ? 'error' : s)), 15_000);
                el.addEventListener('error', () => { clearTimeout(t); setState('error'); }, { once: true });
              }
            }}
            className="absolute inset-0 h-full w-full bg-black"
            controls playsInline preload="metadata" poster={poster}
            onPlay={() => { setState('playing'); setPaused(true); }}
            onPause={() => { setState((s) => (s === 'playing' ? 'paused' : s)); setPaused(false); }}
            onEnded={() => { setState('ended'); setPaused(false); }}
          >
            {video.sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
            {video.captions?.map((c) => <track key={c.src} kind="captions" src={c.src} srcLang={c.srclang} label={c.label} default={!!c.default} />)}
          </video>
        )}

        {state !== 'poster' && isEmbed && embedSrc && (
          <iframe
            className="absolute inset-0 h-full w-full bg-black"
            src={embedSrc}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => { setState('playing'); setPaused(true); }}
            ref={(el) => {
              if (!el || state !== 'loading') return;
              const t = window.setTimeout(() => setState((s) => (s === 'loading' ? 'blocked' : s)), 8_000);
              const onViol = () => { clearTimeout(t); setState('blocked'); };
              document.addEventListener('securitypolicyviolation', onViol);
              el.addEventListener('load', () => { clearTimeout(t); document.removeEventListener('securitypolicyviolation', onViol); }, { once: true });
            }}
          />
        )}

        {state === 'ended' && video.kind === 'file' && (
          <button type="button" className="absolute inset-0 z-[2] grid place-items-center bg-black/40" onClick={() => { const v = videoRef.current; if (v) { v.currentTime = 0; void v.play(); } }} aria-label="Replay">
            <span className="eyebrow rounded-full border border-white/40 px-4 py-2 text-white">Replay</span>
          </button>
        )}

        {(state === 'error' || state === 'blocked') && (
          <div role="alert" className="absolute inset-0 z-[2] grid place-items-center bg-black/70 p-6 text-center text-white">
            <div>
              <p>{state === 'blocked' ? 'This video is blocked in your browser.' : "The video couldn't load."}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button type="button" className="underline" onClick={() => setState('poster')}>Try again</button>
                {video.kind === 'file' && <a className="underline" href={video.sources.find((s) => s.type === 'video/mp4')?.src} download>Download MP4</a>}
                {video.kind === 'youtube' && <a className="underline" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer">Watch on YouTube ↗</a>}
                {video.kind === 'vimeo' && <a className="underline" href={`https://vimeo.com/${video.id}`} target="_blank" rel="noopener noreferrer">Watch on Vimeo ↗</a>}
              </div>
            </div>
          </div>
        )}
      </div>

      {state === 'poster' && isEmbed && (
        <p className="mt-2 text-[length:var(--text-small)] text-muted">
          Plays via {video.kind === 'youtube' ? 'YouTube (privacy-enhanced mode)' : 'Vimeo'}. Loading it shares your IP address with {video.kind === 'youtube' ? 'YouTube' : 'Vimeo'}.{' '}
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} /> Always load {video.kind === 'youtube' ? 'YouTube' : 'Vimeo'} videos
          </label>
        </p>
      )}
      {state === 'playing' && <span role="status" className="sr-only" aria-live="polite">Video playing.</span>}
    </div>
  );
}
