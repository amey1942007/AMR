import { Home } from '@/components/home/Home';
import { InfoContent } from '@/components/info/InfoContent';
export const metadata = { alternates: { canonical: '/' } };
export default function Page() {
  return <Home info={<InfoContent />} />;
}
