'use client';
import { PillButton } from './PillButton';
import { useServices } from '@/components/providers/ServicesProvider';
import { useUI } from '@/lib/ui-store';

/** Control panel CTA: external URL → /login/ when Supabase auth is live → toast stub otherwise. */
export function ControlPanelLink({
  kind = 'ghost',
  className,
  icon,
}: {
  kind?: 'ghost' | 'filled';
  className?: string;
  icon?: 'external' | 'arrow';
}) {
  const { config, auth } = useServices();
  const showToast = useUI((s) => s.showToast);
  if (config.controlPanelUrl) {
    return (
      <PillButton kind={kind} href={config.controlPanelUrl} icon={icon ?? 'external'} className={className}>
        Control panel
      </PillButton>
    );
  }
  if (auth.isAvailable()) {
    return (
      <PillButton kind={kind} href="/sign-in/" className={className}>
        Control panel
      </PillButton>
    );
  }
  return (
    <PillButton kind={kind} className={className} onClick={() => showToast('Live control panel: coming soon')}>
      Control panel
    </PillButton>
  );
}
