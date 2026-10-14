import { Logo } from '@/components/nav/Logo';
import { COMPANY_NAME, EMAIL, REPO_URL } from '@/lib/content';

const link = 'inline-flex min-h-11 items-center text-white/80 hover:text-white';
export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-[var(--content-max)] border-t border-[var(--line-dark)] px-[var(--gutter)] py-12 text-white">
      <div className="flex items-center gap-4">
        <Logo />
        <span className="text-muted">{COMPANY_NAME}</span>
      </div>
      <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--text-small)]">
        <li><a className={link} href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
        <li><a className={link} href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub<span className="sr-only"> (opens in new tab)</span></a></li>
        <li><a className={link} href="/privacy/">Privacy</a></li>
        <li><a className={link} href="/credits/">Credits</a></li>
      </ul>
      <p className="mt-6 text-[length:var(--text-small)] text-muted">© 2026 {COMPANY_NAME}</p>
    </footer>
  );
}
