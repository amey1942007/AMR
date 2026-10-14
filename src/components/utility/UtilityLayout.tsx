import type { ReactNode } from 'react';
import { PulseRings } from '@/components/effects/PulseRings';
import { WaveLines } from '@/components/effects/WaveLines';
import { ScanSweep } from '@/components/effects/ScanSweep';
import { FxPause } from '@/components/effects/FxPause';
import { Footer } from '@/components/info/Footer';
import '@/components/effects/effects.css';

type Effect = 'rings' | 'waves' | 'sweep' | 'flatline';

/** login-spec §0 shared frame: TopBar is in AppShell; this centres the card and slots ≤ 2 effects. */
export function UtilityLayout({ effects, showFooter, children, className = '', shortHide = true }: {
  effects: Effect[];
  showFooter?: boolean;
  children: ReactNode;
  className?: string;
  shortHide?: boolean;
}) {
  // Cap at 2 (login-spec §0). flatline counts as waves.
  const picked = effects.slice(0, 2);
  const rings = picked.includes('rings');
  const waves = picked.includes('waves') || picked.includes('flatline');
  const sweep = picked.includes('sweep');
  const flat = picked.includes('flatline');
  return (
    <div id="info" tabIndex={-1} data-fx-host className={`relative flex outline-none min-h-[calc(100dvh-var(--nav-h))] flex-col items-center justify-center px-[var(--gutter)] py-16 ${shortHide ? 'max-[639px]:py-6 [@media(max-height:639px)]:items-start [@media(max-height:639px)]:pt-6' : ''} ${className}`}>
      {rings && (
        <div className={`pointer-events-none absolute left-1/2 top-[18%] size-[min(1040px,140vw)] -translate-x-1/2 -translate-y-1/2 opacity-30 max-md:size-[560px] ${shortHide ? '[@media(max-height:639px)]:hidden' : ''}`} aria-hidden>
          <PulseRings maxR={520} />
        </div>
      )}
      {sweep && (
        <div className="pointer-events-none absolute left-1/2 top-[40%] size-[min(720px,84vw)] -translate-x-1/2 -translate-y-1/2" aria-hidden>
          <ScanSweep maxR={360} />
          {rings && <div className="absolute inset-0"><PulseRings maxR={360} /></div>}
        </div>
      )}
      {waves && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-[30%] max-md:hidden ${shortHide ? '[@media(max-height:639px)]:hidden' : ''}`} aria-hidden>
          <WaveLines flatline={flat} className="!relative !inset-auto !h-full" />
        </div>
      )}
      <FxPause />
      <div className="relative z-[1] w-full max-w-[560px]">{children}</div>
      {showFooter && <div className="relative z-[1] mt-16 w-full"><Footer /></div>}
    </div>
  );
}
