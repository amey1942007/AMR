'use client';
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { useCapabilities } from '@/lib/capabilities';
import { SmoothScroll } from '@/components/providers/SmoothScroll';
import { ScrollDriver } from '@/components/journey/ScrollDriver';
import { Backdrop } from '@/components/journey/Backdrop';
import { HeroLayer } from '@/components/hero/HeroLayer';
import { SrDescription } from '@/components/journey/SrDescription';
import { InfoSection } from '@/components/info/InfoSection';
import { ReducedMotionStory } from '@/components/fallback/ReducedMotionStory';

// Heavy chunks load after first paint, client-only.
const JourneyCanvas = dynamic(() => import('@/components/journey/JourneyCanvas'), { ssr: false });
const Fallback3D = dynamic(() => import('@/components/fallback/Fallback3D'), { ssr: false });
const Overlays = dynamic(() => import('@/components/overlay/Overlays').then((m) => m.Overlays), { ssr: false });
const DebugHUD = dynamic(() => import('@/components/debug/DebugHUD').then((m) => m.DebugHUD), { ssr: false });

const noop = () => () => {};
const useQuery = (k: string) => useSyncExternalStore(noop, () => new URLSearchParams(location.search).get(k), () => null);

export function Home({ info }: { info: ReactNode }) {
  const cap = useCapabilities();
  const debug = useQuery('debug') === '1';
  const [failed, setFailed] = useState(false);
  const rm = cap.reducedMotion;
  const use3D = cap.ready && !rm && cap.webgl2 && !failed;
  return (
    <>
      <SmoothScroll enabled={cap.ready && !rm} />
      <ScrollDriver reducedMotion={rm} />
      {rm ? (
        <>
          <HeroLayer isStatic />
          <ReducedMotionStory />
        </>
      ) : (
        <>
          <Backdrop />
          <HeroLayer />
          {use3D && <JourneyCanvas tier={cap.tier} mobile={cap.mobile} saveData={cap.saveData} onFail={() => setFailed(true)} />}
          {cap.ready && !use3D && <Fallback3D />}
          {cap.ready && <Overlays tier={cap.tier} mobile={cap.mobile} live={use3D} />}
          <SrDescription />
          <div id="journey" aria-hidden style={{ height: '460vh' }} />
        </>
      )}
      <InfoSection reducedMotion={rm}>{info}</InfoSection>
      {debug && <DebugHUD />}
    </>
  );
}
