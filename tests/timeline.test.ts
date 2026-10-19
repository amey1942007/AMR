import { describe, expect, it } from 'vitest';
import { S, buildMasterTimeline, nextNavDark } from '@/lib/timeline';
import { monotone } from '@/lib/monotone';
import { KEYS } from '@/lib/camera-keys';
import { detectTier } from '@/lib/capabilities';

describe('master timeline', () => {
  const tl = buildMasterTimeline();
  const at = (p: number) => { tl.progress(p); return { ...S }; };
  it('p tracks progress', () => { expect(at(0.5).p).toBeCloseTo(0.5); expect(at(1).p).toBe(1); });
  it('hero visible at 0, gone by .20', () => { expect(at(0).heroTitle).toBe(1); expect(at(0.21).heroTitle).toBe(0); });
  it('robot parked until .26, path end at .80', () => { expect(at(0.25).uDrive).toBe(0); expect(at(0.81).uDrive).toBe(1); });
  it('callouts never overlap at full opacity', () => {
    for (let p = 0; p <= 1; p += 0.005) { const s = at(p); expect([s.c1, s.c2, s.c3].filter((v) => v > 0.5).length).toBeLessThanOrEqual(1); }
  });
  it('cloud beats never overlap at full opacity', () => {
    for (let p = 0; p <= 1; p += 0.005) {
      const s = at(p);
      expect([s.cb1, s.cb2, s.cb3, s.cb4].filter((v) => v > 0.5).length).toBeLessThanOrEqual(1);
    }
  });
  it('last cloud beat gone as dissolve settles', () => {
    expect(at(0.92).cb4).toBe(0);
    expect(at(0.72).cb2).toBeGreaterThan(0.5);
  });
  it('reversible', () => { const a = at(0.47); at(0.9); expect(at(0.47)).toEqual(a); });
});

describe('nav hysteresis', () => {
  it('switches at .185 / back at .175', () => {
    expect(nextNavDark(false, 0.182)).toBe(false);
    expect(nextNavDark(false, 0.186)).toBe(true);
    expect(nextNavDark(true, 0.176)).toBe(true);
    expect(nextNavDark(true, 0.174)).toBe(false);
  });
});

describe('camera mapping', () => {
  const toU = monotone(KEYS.map((k) => k.p), KEYS.map((_, i) => i / (KEYS.length - 1)));
  it('hits keys exactly and is monotone', () => {
    KEYS.forEach((k, i) => expect(toU(k.p)).toBeCloseTo(i / (KEYS.length - 1)));
    let prev = -1;
    for (let p = 0; p <= 1; p += 0.001) { const u = toU(p); expect(u).toBeGreaterThanOrEqual(prev); prev = u; }
  });
});

describe('tier', () => {
  const base = { coarse: false, width: 1440, saveData: false, slowNet: false };
  it('desktop high, mobile low, override wins', () => {
    expect(detectTier({ ...base, cores: 8 })).toBe('high');
    expect(detectTier({ ...base, width: 390 })).toBe('low');
    expect(detectTier({ ...base, cores: 4 })).toBe('low');
    expect(detectTier({ ...base, width: 390, override: 'high' })).toBe('high');
  });
});

import { bakeMap, mappedPct } from '@/lib/grid';
import { castRay } from '@/lib/room';
describe('grid bake', () => {
  const m = bakeMap(90, 0.02);
  it('reveals progressively and fully at u=1', () => {
    const a = mappedPct(m.reveal, m.total, 0.2), b = mappedPct(m.reveal, m.total, 0.6);
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a); expect(mappedPct(m.reveal, m.total, 1)).toBe(100);
  });
  it('has occupied cells', () => expect(m.state.filter((s) => s === 2).length).toBeGreaterThan(50));
  it('ray down the corridor hits the west exterior wall', () => { const r = castRay(0, -0.1, Math.PI); expect(r.hit).toBe(true); expect(r.dist).toBeCloseTo(4.925, 2); });
});
