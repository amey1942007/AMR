import { copy, robots, techStack } from '@/lib/content';
import type { ContentService } from '../types';
export const staticContent: ContentService = {
  getRobots: () => robots,
  getTechStack: () => techStack,
  getCopy: () => copy,
};
