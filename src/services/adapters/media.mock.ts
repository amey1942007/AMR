import type { MediaService } from '../types';
/** Everything present (exercise all media branches in tests). */
export const mockMedia: MediaService = {
  hasDemoVideo: true,
  stillUrls: ['/img/stills/s1.webp', '/img/stills/s2.webp', '/img/stills/s3.webp', '/img/stills/s4.webp', '/img/stills/s5.webp'],
  posterUrl: '/img/hero-poster.webp',
  heroModel: { lo: '/models/amr_hero_lo.glb', hi: '/models/amr_hero_hi.glb' },
};
