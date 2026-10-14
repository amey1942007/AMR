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
