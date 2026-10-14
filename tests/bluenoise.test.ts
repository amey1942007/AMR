import { describe, expect, it } from 'vitest';
import { blueNoise } from '@/lib/bluenoise';

describe('blueNoise', () => {
  it('is a uniform permutation with low-frequency energy suppressed', () => {
    const t = blueNoise(16, 1.5);
    const hist = new Array(256).fill(0); t.forEach((v) => hist[v]++);
    expect(hist.filter((c) => c === 1).length).toBe(256);
    // neighbours differ more than for white noise: mean |Δ| to the right neighbour well above 85 (white ≈ 85)
    let d = 0; for (let i = 0; i < 256; i++) d += Math.abs(t[i] - t[(i % 16 === 15) ? i - 15 : i + 1]);
    expect(d / 256).toBeGreaterThan(95);
  });
});
