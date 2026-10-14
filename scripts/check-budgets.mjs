// M0 stub: verifies asset budgets for files that exist. Missing assets are allowed (placeholders render).
import { statSync, existsSync } from 'node:fs';
const budgets = {
  'public/models/amr_hero_lo.glb': 0.8e6,
  'public/models/amr_hero_hi.glb': 12e6,
  'public/models/room_shell.glb': 1.2e6,
  'public/models/props.glb': 1.5e6,
};
let fail = false;
for (const [f, max] of Object.entries(budgets)) {
  if (!existsSync(f)) { console.log(`skip  ${f} (missing → placeholder)`); continue; }
  const s = statSync(f).size;
  const ok = s <= max; fail ||= !ok;
  console.log(`${ok ? 'ok   ' : 'FAIL '} ${f} ${(s / 1e6).toFixed(2)} MB / ${(max / 1e6).toFixed(2)} MB`);
}
process.exit(fail ? 1 : 0);
