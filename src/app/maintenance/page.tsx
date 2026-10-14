import type { Metadata } from 'next';
import { MaintenanceView } from '@/components/utility/MaintenanceView';
export const metadata: Metadata = { title: 'Maintenance | AMR', robots: { index: false, follow: false } };
export default function Page() {
  return <MaintenanceView until={process.env.NEXT_PUBLIC_MAINTENANCE_UNTIL} />;
}
