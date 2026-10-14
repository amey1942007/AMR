'use client';
import { useEffect } from 'react';
import './pages.css';

/**
 * Light subpage motion (pages-spec §1): `.reveal-in` blocks fade/slide in once (700 ms power3.out via CSS, stagger
 * 80 ms) when they enter the viewport; the lidar sweep pauses off-screen. Blocks already on screen at load and all
 * blocks under reduced motion are shown immediately (opacity-only CSS). No GSAP, no WebGL.
 */
export function PageMotion() {
  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal-in'));
    const below = els.filter((el) => el.getBoundingClientRect().top > innerHeight * 0.9);
    if (!rm) below.forEach((el) => el.classList.add('reveal-wait'));
    let batch = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        el.style.transitionDelay = `${(batch++ % 4) * 80}ms`;
        el.classList.remove('reveal-wait');
        io.unobserve(el);
      });
      batch = 0;
    }, { rootMargin: '0px 0px -10% 0px' });
    below.forEach((el) => io.observe(el));
    // Jumping (End key, anchor links): reveal anything above the viewport too, so nothing stays hidden.
    const onScroll = () => below.forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) { el.classList.remove('reveal-wait'); io.unobserve(el); } });
    addEventListener('scroll', onScroll, { passive: true });
    const sweeps = Array.from(document.querySelectorAll<SVGElement>('.lidar-sweep'));
    const sio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('sweep-paused', !e.isIntersecting)));
    sweeps.forEach((s) => sio.observe(s));
    return () => { io.disconnect(); sio.disconnect(); removeEventListener('scroll', onScroll); els.forEach((el) => el.classList.remove('reveal-wait')); };
  }, []);
  return null;
}
