import { describe, expect, it } from 'vitest';
import { robots } from '@/lib/content';
describe('robot content never mixed', () => {
  const a = JSON.stringify(robots.amr4), h = JSON.stringify(robots.hardware);
  it('badges', () => { expect(robots.amr4.badge).toBe('In development'); expect(robots.hardware.badge).toBe('Field-tested'); });
  it('AMR4 has no hardware-only specs', () => { for (const s of ['Jazzy', 'Raspberry', 'S2E', 'DDSM115', 'Nav2']) expect(a).not.toContain(s); });
  it('Hardware has no AMR4-only specs', () => { for (const s of ['Humble', 'Jetson', 'A1', 'mecanum']) expect(h).not.toContain(s); });
  it('image slots empty in v1', () => { expect(robots.amr4.image).toBeUndefined(); expect(robots.hardware.image).toBeUndefined(); });
});
