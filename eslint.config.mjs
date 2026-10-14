import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const config = [
  ...next,
  ...nextTs,
  // R3F mutates three.js objects inside useFrame by design (no React state per frame).
  { files: ['src/components/journey/**'], rules: { 'react-hooks/immutability': 'off' } },
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'public/**', 'test-results/**', 'playwright-report/**'] },
];
export default config;
