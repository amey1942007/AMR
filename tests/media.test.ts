import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simulationVideo, mediaFilePaths, SIMULATION_FILE_EXAMPLE } from '@/data/media';
import { staticMedia } from '@/services/adapters/media.static';

const run = (env: Record<string, string>) => {
  try {
    execFileSync('npx', ['tsx', 'scripts/check-media.ts'], { env: { ...process.env, ...env }, stdio: 'pipe' });
    return 0;
  } catch (e) { return (e as { status: number }).status; }
};

describe('simulation video media (ui-spec §14.2)', () => {
  it('null → placeholder; MediaService.getVideo reads media.ts', () => {
    expect(simulationVideo).toBeNull();
    expect(staticMedia.getVideo('simulation')).toBeNull();
  });
  it('mediaFilePaths lists poster, sources and captions', () => {
    const p = mediaFilePaths(SIMULATION_FILE_EXAMPLE);
    expect(p).toEqual(expect.arrayContaining(['video/simulation.webm', 'video/simulation.mp4', 'video/simulation.en.vtt', 'video/simulation-poster.webp']));
  });
  it('prebuild fails on a missing file and passes when files exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'media-'));
    // Fixture entry checked against an empty root → missing files → exit 1.
    expect(run({ NEXT_PUBLIC_SIM_VIDEO_FIXTURE: '1', MEDIA_CHECK_ROOT: root })).toBe(1);
    mkdirSync(join(root, 'video/__e2e__'), { recursive: true });
    for (const f of ['sim-poster.webp', 'sim.webm', 'sim.mp4', 'sim.en.vtt']) writeFileSync(join(root, 'video/__e2e__', f), 'x');
    expect(run({ NEXT_PUBLIC_SIM_VIDEO_FIXTURE: '1', MEDIA_CHECK_ROOT: root })).toBe(0);
    // A poster over 180 KB fails.
    writeFileSync(join(root, 'video/__e2e__/sim-poster.webp'), Buffer.alloc(181 * 1024));
    expect(run({ NEXT_PUBLIC_SIM_VIDEO_FIXTURE: '1', MEDIA_CHECK_ROOT: root })).toBe(1);
  }, 30_000);
});
