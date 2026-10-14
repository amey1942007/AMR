import type { MediaService } from '../types';
import { HERO_MODEL } from '@/lib/robot-nodes';
/**
 * Hand-kept manifest of assets present in public/. The hero model paths are always declared;
 * HeroRobot (M2) tries lo → hi and falls back to the §16 stand-in on load error, so dropping
 * amr_hero_lo.glb / amr_hero_hi.glb into public/models/ needs no code change.
 */
export const staticMedia: MediaService = { hasDemoVideo: false, stillUrls: [], heroModel: { ...HERO_MODEL } };
