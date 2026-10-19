import { SimulationVideoSlot } from './SimulationVideoSlot';

/**
 * ui-spec §14: first block of #info, before the robot cards. Copy is static HTML; the player
 * island loads a published Supabase `site_videos` row (or the local media.ts override).
 */
export function SimulationSection() {
  return (
    <section id="simulation" aria-labelledby="sim-title" className="reveal">
      <p className="eyebrow text-muted">SIMULATION</p>
      <h2 id="sim-title" className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">Watch the mapping run.</h2>
      <p id="sim-lead" className="mt-4 max-w-[60ch] text-muted">Two simulation clips — autonomous exploration and browser teleop. Drag or use the arrows; more demos will land here.</p>
      <SimulationVideoSlot />
    </section>
  );
}
