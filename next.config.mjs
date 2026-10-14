import { statSync } from 'node:fs';

/** Cache-buster for GLBs: changes whenever a model file is regenerated (size + mtime). */
const modelVer = ['amr_hero_lo', 'amr_hero_hi', 'props']
  .map((n) => { try { const st = statSync(`public/models/${n}.glb`); return `${st.size.toString(36)}${Math.floor(st.mtimeMs / 1000).toString(36)}`; } catch { return '0'; } })
  .join('.');

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''; // '' with the custom domain amrslam.tech
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath || undefined,
  reactStrictMode: true,
  agentRules: false,
  env: { NEXT_PUBLIC_MODEL_VER: modelVer },
};
export default nextConfig;
