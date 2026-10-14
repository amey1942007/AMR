import { StubPage } from '@/components/StubPage';
export const metadata = { title: 'Credits | amrslam.tech' };

// Mirrors CREDITS.md (G5: static export cannot serve the .md, so it is rendered here). Keep both in sync.
const credits = [
  { what: 'Unbounded, Inter Tight, JetBrains Mono (via Fontsource)', licence: 'SIL Open Font License 1.1', url: 'https://fontsource.org' },
  { what: 'UI icons (Lucide)', licence: 'ISC', url: 'https://lucide.dev/license' },
];

export default function Page() {
  return (
    <StubPage eyebrow="Credits" title="Credits">
      <ul className="flex flex-col gap-4">
        {credits.map((c) => (
          <li key={c.what}>
            <p className="text-white">{c.what}</p>
            <p className="text-[length:var(--text-small)] text-muted">
              {c.licence} · <a className="underline" href={c.url} target="_blank" rel="noopener noreferrer">{c.url}<span className="sr-only"> (opens in new tab)</span></a>
            </p>
          </li>
        ))}
      </ul>
    </StubPage>
  );
}
