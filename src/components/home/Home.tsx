'use client';
import { useCapabilities } from '@/lib/capabilities';
import { SmoothScroll } from '@/components/providers/SmoothScroll';
import { ScrollDriver } from '@/components/journey/ScrollDriver';
import { Backdrop } from '@/components/journey/Backdrop';
import { HeroLayer } from '@/components/hero/HeroLayer';
import { SrDescription } from '@/components/journey/SrDescription';
import { InfoSection } from '@/components/info/InfoSection';
import { DebugHUD } from '@/components/debug/DebugHUD';
import { useSyncExternalStore } from 'react';

const noop = () => () => {};
const useDebug = () => useSyncExternalStore(noop, () => new URLSearchParams(location.search).get('debug') === '1', () => false);

export function Home() {
  const cap = useCapabilities();
  const debug = useDebug();
  const rm = cap.reducedMotion;
  return (
    <>
      <SmoothScroll enabled={cap.ready && !rm} />
      <ScrollDriver reducedMotion={rm} />
      {rm ? (
        <HeroLayer isStatic />
      ) : (
        <>
          <Backdrop />
          <HeroLayer />
          <SrDescription />
          <div id="journey" aria-hidden style={{ height: '460vh' }} />
        </>
      )}
      <InfoSection reducedMotion={rm} />
      {debug && <DebugHUD />}
    </>
  );
}
