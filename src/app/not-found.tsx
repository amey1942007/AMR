import Link from 'next/link';
import { StubPage } from '@/components/StubPage';
export default function NotFound() {
  return <StubPage eyebrow="404" title="Page not found"><p><Link className="underline" href="/">Back to home</Link></p></StubPage>;
}
