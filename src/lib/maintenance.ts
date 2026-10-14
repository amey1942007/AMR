/** login-spec §5: build-time maintenance switch (shared by layout, TopBar and MaintenanceGate). */
export const MAINTENANCE = process.env.NEXT_PUBLIC_MAINTENANCE === '1';
