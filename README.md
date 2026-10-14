# amrslam.tech website
Next.js 16 static export (`out/`) deployed to GitHub Pages. Spec: `../instruction.md` + `../design/ui-spec.md` (ui-spec wins).

## Run
```bash
corepack enable            # pnpm 10.34.7 via packageManager
pnpm install
cp .env.example .env.local # optional
pnpm dev                   # http://localhost:3000  (contact adapter defaults to mock in dev)
pnpm lint && pnpm typecheck && pnpm test
pnpm build                 # → out/ ; preview: npx serve out
```
Dev mock overrides: `?mock=error`, `?mock=slow`.

## Contact adapter (`NEXT_PUBLIC_CONTACT_ADAPTER`)
`mock | mailto | supabase | http`. Unset → `mock` in dev/test; production build → `supabase` if URL + publishable key are set, else `mailto` (form hidden, mailto button). Only the **publishable** key is ever used. supabase-js is dynamically imported on first submit.

## Milestone status
- [x] M0 Scaffold
