import localFont from 'next/font/local';

// ui-spec R2: next/font/local over Fontsource woff2 → automatic preload + size-adjusted fallback.
export const unbounded = localFont({
  src: '../../node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
  variable: '--font-unbounded',
  weight: '200 900',
  display: 'swap',
  preload: true,
});
export const interTight = localFont({
  src: '../../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2',
  variable: '--font-inter-tight',
  weight: '100 900',
  display: 'swap',
  preload: false,
});
export const jetbrains = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  variable: '--font-jetbrains',
  weight: '100 800',
  display: 'swap',
  preload: false,
});
