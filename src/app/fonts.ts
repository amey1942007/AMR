import localFont from 'next/font/local';

// Variable Fontsource woff2s break next/font size-adjust metrics ("Fallback font" errors).
// Keep CSS fallback stacks; skip automatic size-adjust for Inter Tight / JetBrains.
export const unbounded = localFont({
  src: '../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
  variable: '--font-unbounded',
  weight: '200 900',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  fallback: ['system-ui', 'sans-serif'],
});
export const interTight = localFont({
  src: '../../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2',
  variable: '--font-inter-tight',
  weight: '100 900',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});
export const jetbrains = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-jetbrains',
  weight: '100 800',
  display: 'swap',
  preload: false,
  adjustFontFallback: false,
  fallback: ['ui-monospace', 'Consolas', 'monospace'],
});
