import type { ReactNode } from 'react';
import { MaintenanceView } from './MaintenanceView';

/** login-spec §5: NEXT_PUBLIC_MAINTENANCE=1 is a build-time switch; every route renders the maintenance page. */
import { MAINTENANCE } from '@/lib/maintenance';
export { MAINTENANCE };
export function MaintenanceGate({ children }: { children: ReactNode }) {
  if (!MAINTENANCE) return <>{children}</>;
  return <MaintenanceView until={process.env.NEXT_PUBLIC_MAINTENANCE_UNTIL} />;
}
