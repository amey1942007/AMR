'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { SimulationSlide } from '@/data/media';
import './simulation-carousel.css';

function fmt(sec?: number) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function drivePreview(id: string) {
  return `https://drive.google.com/file/d/${id}/preview`;
}

function slideStyle(offset: number, dragPx: number): CSSProperties {
  const abs = Math.abs(offset);
  return {
    zIndex: 10 - abs,
    opacity: Math.max(0.25, 1 - abs * 0.35),
    transform: `translateX(calc(${offset * 42}% + ${dragPx * 0.35}px)) rotateY(${offset * -18}deg) scale(${1 - abs * 0.14})`,
  };
}

/**
 * Side-by-side coverflow for simulation clips. Arrows + drag/swipe rotate to the next slide.
 * Add entries in `simulationSlides` (media.ts) — designed for many more videos later.
 */
export function SimulationCarousel({ slides }: { slides: SimulationSlide[] }) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const drag = useRef<{ x: number } | null>(null);

  const go = useCallback((i: number) => {
    if (n < 1) return;
    setIndex(((i % n) + n) % n);
    setPlaying(false);
    setDragPx(0);
  }, [n]);

  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a, iframe')) return;
    drag.current = { x: e.clientX };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    setDragPx(e.clientX - drag.current.x);
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    drag.current = null;
    setDragPx(0);
    if (dx < -56) next();
    else if (dx > 56) prev();
  };

  if (n === 0) return null;
  const active = slides[index]!;
  const dur = fmt(active.durationSec);

  return (
    <div className="sim-carousel" data-lenis-prevent aria-roledescription="carousel" aria-label="Simulation videos">
      <div
        className="sim-carousel__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {slides.map((slide, i) => {
          const offset = i - index;
          const abs = Math.abs(offset);
          if (abs > 2) return null;
          const isActive = i === index;
          return (
            <article
              key={slide.id}
              className="sim-carousel__slide"
              data-active={isActive || undefined}
              style={slideStyle(offset, isActive ? dragPx : dragPx * 0.35)}
              aria-hidden={!isActive}
            >
              <div className="sim-carousel__frame">
                {isActive && playing ? (
                  <iframe
                    title={slide.title}
                    src={drivePreview(slide.driveId)}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="sim-carousel__iframe"
                  />
                ) : (
                  <button
                    type="button"
                    className="sim-carousel__poster"
                    aria-label={isActive ? `Play: ${slide.title}${dur ? ` (${dur})` : ''}` : `Show: ${slide.title}`}
                    onClick={() => {
                      if (!isActive) { go(i); return; }
                      setPlaying(true);
                    }}
                  >
                    <img src={slide.poster} alt="" loading={abs === 0 ? 'eager' : 'lazy'} decoding="async" className="sim-carousel__img" />
                    {isActive && (
                      <span aria-hidden className="sim-carousel__play">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>
                      </span>
                    )}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <div className="sim-carousel__controls">
        <button type="button" className="sim-carousel__arrow" onClick={prev} aria-label="Previous video" disabled={n < 2}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="sim-carousel__dots" role="tablist" aria-label="Choose video">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={s.title}
              className="sim-carousel__dot"
              data-on={i === index || undefined}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="sim-carousel__arrow" onClick={next} aria-label="Next video" disabled={n < 2}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>

      <div className="sim-carousel__meta">
        <span>{active.title}</span>
        {dur && <span className="font-mono">{dur}</span>}
        <span className="sim-carousel__hint">{n} clip{n === 1 ? '' : 's'} · drag or arrows</span>
        {active.description && <span className="sim-carousel__desc">{active.description}</span>}
        <p className="sim-carousel__note">Plays via Google Drive. Loading it shares your IP address with Google.</p>
      </div>
    </div>
  );
}
