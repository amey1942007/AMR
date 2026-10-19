import { describe, expect, it } from 'vitest';
import { isBotId } from '@/lib/control/bot-persist';

describe('bot persist', () => {
  it('accepts known bot ids', () => {
    expect(isBotId('hardware-bot')).toBe(true);
    expect(isBotId('amr4')).toBe(true);
    expect(isBotId('other')).toBe(false);
    expect(isBotId(null)).toBe(false);
  });
});
