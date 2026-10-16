import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { navItems } from '@/lib/content';
import {
  MENU_EXIT_FALLBACK_PAD_MS,
  MENU_LINE_MS,
  MENU_STAGGER_MS,
  cssTimeMs,
  menuExitDurationMs,
  menuExitFallbackMs,
  menuPhaseForOpen,
  shouldSettleMenuExit,
  transitionEndMs,
} from '@/components/nav/menu-motion';

describe('menu close phase', () => {
  it('plays a closing phase when the menu shuts', () => {
    expect(menuPhaseForOpen('open', false, false)).toBe('closing');
    expect(menuPhaseForOpen('closing', false, false)).toBe('closing');
  });
  it('does not replay a settled close', () => {
    expect(menuPhaseForOpen('closed', false, false)).toBe('closed');
  });
  it('opens from any phase', () => {
    for (const phase of ['closed', 'open', 'closing'] as const) {
      expect(menuPhaseForOpen(phase, true, false)).toBe('open');
      expect(menuPhaseForOpen(phase, true, true)).toBe('open');
    }
  });
  it('unmounts on the same turn when reduced motion is requested', () => {
    expect(menuPhaseForOpen('open', false, true)).toBe('closed');
    expect(menuPhaseForOpen('closing', false, true)).toBe('closed');
  });
});

describe('menu exit timing', () => {
  it('lasts for the line duration plus the reverse stagger', () => {
    expect(menuExitDurationMs(1)).toBe(MENU_LINE_MS);
    expect(menuExitDurationMs(navItems.length)).toBe(MENU_LINE_MS + (navItems.length - 1) * MENU_STAGGER_MS);
    expect(menuExitFallbackMs(navItems.length)).toBe(menuExitDurationMs(navItems.length) + MENU_EXIT_FALLBACK_PAD_MS);
  });
  it('parses computed transition ends', () => {
    expect(cssTimeMs('0.9s')).toBe(900);
    expect(cssTimeMs('600ms')).toBe(600);
    expect(transitionEndMs({
      transitionProperty: 'opacity, visibility',
      transitionDuration: '0.9s, 0s',
      transitionDelay: '0s, 0s',
    }, 'opacity')).toBe(900);
    expect(transitionEndMs({
      transitionProperty: 'transform',
      transitionDuration: '600ms',
      transitionDelay: '300ms',
    }, 'transform')).toBe(900);
    expect(transitionEndMs({
      transitionProperty: 'visibility',
      transitionDuration: '0s',
      transitionDelay: '0s',
    }, 'visibility')).toBe(0);
  });
  it('ignores a transitionend that fires before the exit finishes', () => {
    expect(shouldSettleMenuExit(200, 900)).toBe(false);
    expect(shouldSettleMenuExit(860, 900)).toBe(true);
    expect(shouldSettleMenuExit(0, 0)).toBe(true);
  });
});

describe('menu exit css', () => {
  const css = readFileSync('src/app/globals.css', 'utf8');
  const overlay = readFileSync('src/components/nav/MenuOverlay.tsx', 'utf8');

  it('reverses the line slide and keeps the panel visible while closing', () => {
    expect(css).toMatch(/\.menu-line\s*\{[^}]*transition:\s*transform var\(--dur-menu\)/);
    expect(css).toMatch(/\.dlg-root\.menu-panel\[data-closing='true'\]\s*\{[^}]*visibility:\s*visible/);
    expect(css).toMatch(/\.dlg-root\.menu-panel\[data-closing='true'\]\s*\{[^}]*opacity:\s*0/);
    expect(css).toContain('--menu-exit:');
    expect(css).toContain('pointer-events: none');
  });

  it('disables the exit under prefers-reduced-motion', () => {
    const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(rm).toMatch(/\[data-closing='true'\]\s*\{[^}]*transition:\s*none/);
    expect(rm).toMatch(/\.menu-line,\s*\.menu-panel\[data-open='true'\] \.menu-line\s*\{[^}]*transition:\s*none/);
    expect(rm).toMatch(/\.menu-burger-bar\s*\{\s*transition:\s*none/);
  });

  it('stays mounted until transitionend or animationend, with a timeout fallback', () => {
    expect(overlay).toContain("addEventListener('transitionend'");
    expect(overlay).toContain("addEventListener('animationend'");
    expect(overlay).toContain('setTimeout(settle');
    expect(overlay).toContain('prefers-reduced-motion');
    expect(overlay).toContain('phase === \'closed\') return null');
  });
});
