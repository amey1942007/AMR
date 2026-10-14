/** TS mirror of src/styles/tokens.css colours for 3D code. Parity enforced by tests/tokens.test.ts. */
export const tokens = {
  bg: '#050507',
  'bg-hero': '#f2f1f5',
  'bg-room': '#0a0a10',
  ink: '#0b0b10',
  paper: '#ffffff',
  muted: '#8a8794',
  'muted-on-light': '#5e5b68',
  violet: '#7b2ff7',
  magenta: '#e81cb0',
  'pill-end': '#c0168f',
  'sky-zenith': '#07060c',
  'sky-horizon': '#1a0b3d',
  'cloud-dark': '#3a2370',
  'cloud-light': '#e9e3f7',
  'grid-occ': '#e81cb0',
  danger: '#ff6b8b',
  success: '#5ee6a8',
} as const;
export type TokenName = keyof typeof tokens;
