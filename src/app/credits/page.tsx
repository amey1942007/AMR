import { StubPage } from '@/components/StubPage';
import models from '@/data/credits.models.json';
import { asset } from '@/lib/asset';
export const metadata = { title: 'Credits | amrslam.tech', alternates: { canonical: '/credits/' } };

// Mirrors CREDITS.md (G5: a static export cannot serve the .md). Model credits come from src/data/credits.models.json.
interface Credit { what: string; licence: string; url: string; author?: string; changes?: string; licenceText?: string }
const assets: Credit[] = [
  { what: 'Studio HDRI "studio_small_09" (1K .hdr; 2K re-encoded as log-WebP)', licence: 'CC0', url: 'https://polyhaven.com/a/studio_small_09', author: 'Poly Haven' },
  { what: 'Unbounded, Inter Tight, JetBrains Mono (via Fontsource)', licence: 'SIL Open Font License 1.1', url: 'https://fontsource.org' },
  { what: 'UI icons (Lucide)', licence: 'ISC', url: 'https://lucide.dev/license' },
  { what: 'Tech-stack logos (Simple Icons v16.35.0; trademarks belong to their owners)', licence: 'CC0', url: 'https://simpleicons.org' },
  { what: 'Cloud sprite, room/prop stand-ins, camera/map data', licence: 'Own work', url: 'https://amrslam.tech' },
];

export default function Page() {
  const all: Credit[] = [...(models as Credit[]), ...assets];
  return (
    <StubPage eyebrow="Credits" title="Credits">
      <ul className="flex flex-col gap-6">
        {all.map((c) => (
          <li key={c.what}>
            <p className="text-white">{c.what}</p>
            <p className="text-[length:var(--text-small)] text-muted">
              {c.licence}{c.author ? ` · ${c.author}` : ''} ·{' '}
              <a className="underline" href={c.url} target="_blank" rel="noopener noreferrer">{c.url}<span className="sr-only"> (opens in new tab)</span></a>
              {c.licenceText && <> · <a className="underline" href={asset(c.licenceText)}>Licence text</a></>}
            </p>
            {c.changes && <p className="mt-1 text-[length:var(--text-small)] text-muted">Changes: {c.changes}</p>}
          </li>
        ))}
      </ul>
    </StubPage>
  );
}
