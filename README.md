# amrslam.tech website
Next.js 16 static export (`out/`) for GitHub Pages. Specs: `instruction.md` (brief) and `design/ui-spec.md` (ui-spec wins).

## Requirements
- Node.js **22.12+** (22 LTS) and npm (bundled with Node). Check with `node -v`.
- Git.

## Run on Windows (PowerShell, project on the D: drive)
```powershell
D:
cd D:\projects\amrslam-website        # wherever you cloned it
npm install                            # uses package-lock.json
copy .env.example .env.local           # optional; leave values empty for the mock contact form
npm run dev                            # http://localhost:3000
```
Production preview:
```powershell
npm run build                          # writes out\ and runs the budget check
npm start                              # serves out\ on http://localhost:3000
```

## Run on macOS / Linux
```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
```

## Scripts
| Script | What it does |
|---|---|
| `npm run dev` | Dev server on :3000 (contact form = mock adapter; `?mock=error`, `?mock=slow`) |
| `npm run build` | Static export to `out/`, then `scripts/check-budgets.mjs` (fails on budget breach) |
| `npm start` | Serve `out/` on :3000 |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint, TypeScript, Vitest unit tests |
| `npm run test:e2e` | Playwright + axe smoke tests against `out/` (run `npx playwright install chromium` once, or set `CHROME_PATH`) |
| `npm run bake:camera` | Re-bakes `public/data/camera.bin` from `src/lib/camera-keys.ts` |

## Debug URL flags (home)
`?debug=1` HUD (p, tier, fps, adapters) · `?tier=low|high` · `?rm=1` reduced-motion mode · `?nowebgl=1` fallback · `?camera=live` runtime spline instead of baked samples.

## Contact adapter (`NEXT_PUBLIC_CONTACT_ADAPTER`)
`supabase | http | mailto` (+ `mock` in dev/test only; a production build never uses the mock). Unset → mock in dev; production → `supabase` if URL + **publishable** key are set, else `mailto` (form hidden, mailto button). Secret/service-role keys are rejected. 10 s request timeout. supabase-js loads on first submit.

## Assets
- Robot: `public/models/amr_hero_lo.glb` (first paint) and `amr_hero_hi.glb` (streamed, desktop high tier only). Missing files → built-in stand-in with the same node names.
- HDRI: 1K `.hdr` first, then 2K log-encoded WebP (`scripts/compress_hdri.py`) on the high tier.
- Room/props: procedural stand-ins until `room_shell.glb` / `props.glb` exist. See `CREDITS.md`.

## Deploy to GitHub Pages (https://amey1942007.github.io/AMR/)
The workflow `.github/workflows/pages.yml` (it replaces the old `deploy.yml`, so only one workflow deploys) runs lint, typecheck and unit tests, builds with `NEXT_PUBLIC_BASE_PATH=/AMR` and deploys `out/` on every push to `main`.
1. On GitHub: repo **Settings → Pages → Source: GitHub Actions**.
2. Push to `main` (or run the workflow by hand from the **Actions** tab).
3. Optional repo variables/secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CONTACT_ADAPTER`.

`NEXT_PUBLIC_BASE_PATH` is empty by default, so `npm run dev` and a normal `npm run build` still serve at `/`.
To test the Pages build locally on Windows (PowerShell, from D:\…\site):
```powershell
$env:NEXT_PUBLIC_BASE_PATH = "/AMR"; $env:NEXT_PUBLIC_SITE_URL = "https://amey1942007.github.io"
npm run build
Remove-Item Env:NEXT_PUBLIC_BASE_PATH; Remove-Item Env:NEXT_PUBLIC_SITE_URL
New-Item -ItemType Directory -Force ..\pages-test | Out-Null
Remove-Item -Recurse -Force ..\pages-test\AMR -ErrorAction SilentlyContinue
Copy-Item -Recurse out ..\pages-test\AMR
npx serve ..\pages-test -l 4180     # open http://localhost:4180/AMR/
```
Run `npm run build` again without the variable before serving at `/`. Asset URLs in code go through `asset()` (`src/lib/asset.ts`) so they pick up the base path; `public/.nojekyll` stops Pages from hiding `_next/`. `public/sitemap.xml` and `robots.txt` still name amrslam.tech (the production domain).

## Content-Security-Policy and `'unsafe-eval'` on the home page
`scripts/csp-meta.mjs` (postbuild) adds a hashed CSP meta tag to every page and writes `out/_headers` (with `frame-ancestors 'none'`) for hosts that support header files. **GitHub Pages ignores `_headers`**, and a `<meta>` CSP can't carry `frame-ancestors`, so on GitHub Pages the site has **no clickjacking (frame-ancestors / X-Frame-Options) protection**. That needs a header-capable host or a CDN in front (e.g. Cloudflare) for amrslam.tech.
The home page alone also allows `'unsafe-eval'`. The KTX2 textures (clouds, HDRI) are decoded by the Basis Universal transcoder (`public/basis/`), an Emscripten/embind build that creates functions with `new Function()` inside a blob Web Worker, and blob workers inherit the page's CSP. Without `'unsafe-eval'` the clouds silently never load. An eval-free transcoder would need a custom Emscripten rebuild of basis_universal (embind without dynamic execution), which wasn't in scope. Every other page (login, control, contact, subpages) keeps a strict `script-src` with no `'unsafe-eval'`.
