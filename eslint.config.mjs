import next from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
const config = [
  ...next,
  ...nextTs,
  // R3F mutates three.js objects inside useFrame by design (no React state per frame).
  { files: ['src/components/journey/**'], rules: { 'react-hooks/immutability': 'off' } },
  {
    ignores: [
      '.next/**',
      'out/**',
      // Legacy Pages publishes the static export into the repo root (index.html, _next/, …).
      '_next/**',
      'basis/**',
      'draco/**',
      'models/**',
      'hdri/**',
      'img/**',
      'textures/**',
      'data/**',
      'node_modules/**',
      'next-env.d.ts',
      'public/**',
      'test-results/**',
      'playwright-report/**',
      'scripts/apartment/**',
      '.devtmp/**',
      'amr-bridge/**',
      'supabase/functions/**',
    ],
  },
];
export default config;
