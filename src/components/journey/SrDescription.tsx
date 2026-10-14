import { copy } from '@/lib/content';
/** AT users get the story once (ui-spec §6.1); the visual overlays are aria-hidden. */
export function SrDescription() {
  return (
    <div className="sr-only">
      <p>Animation: the AMR robot drives through a room and builds a map with lidar.</p>
      <ol>
        {copy.callouts.map((c) => <li key={c.id}>{c.eyebrow}: {c.title}</li>)}
        <li>{copy.beyond}</li>
      </ol>
    </div>
  );
}
