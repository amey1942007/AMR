import type { Metadata } from 'next';
import { NotFoundView } from '@/components/utility/NotFoundView';
export const metadata: Metadata = { title: 'Page not found | AMR', robots: { index: false, follow: false } };
export default function NotFound() {
  return <NotFoundView />;
}
