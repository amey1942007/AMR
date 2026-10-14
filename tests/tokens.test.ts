import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokens } from '@/lib/tokens';

const css = readFileSync('src/styles/tokens.css', 'utf8');
describe('token parity (tokens.css ↔ tokens.ts)', () => {
  for (const [name, hex] of Object.entries(tokens)) {
    it(`--${name} = ${hex}`, () => {
      const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m?.[1].toLowerCase()).toBe(hex);
    });
  }
  it('locked decisions', () => {
    expect(tokens['pill-end']).toBe('#c0168f');
    expect(tokens['muted-on-light']).toBe('#5e5b68');
    expect(css).toMatch(/--grad-pill:\s*linear-gradient\(90deg, #7b2ff7 0%, #c0168f 100%\)/);
  });
});
