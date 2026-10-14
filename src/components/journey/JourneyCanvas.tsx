'use client';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { AgXToneMapping, SRGBColorSpace, VSMShadowMap, PCFShadowMap, DefaultLoadingManager } from 'three';
import { CameraRig } from './CameraRig';
import { RoomShell } from './RoomShell';
import { RenderStats } from './RenderStats';
import { CloudVolume } from './CloudVolume';
import { Props } from './Props';
import { HeroRobot } from './HeroRobot';
import { LidarPulse } from './LidarPulse';
import { CloudDeck } from './CloudDeck';
import { SkyDome } from './SkyDome';
import { EnvironmentHDRI } from './EnvironmentHDRI';
import { Lights, FogCtl, FrameloopCtl } from './SceneRig';
import { Post } from './Post';
import { Warmup } from './Warmup';
import { useScene, type Tier } from '@/lib/store';
import { TimerClock, silenceR3FClockWarning } from './timerClock';

const DPR_STEPS = [2, 1.5, 1.25, 1];

/** R3F root. Always alpha (R3): the DOM Backdrop owns the page colour; hero "AMR" sits between. */
silenceR3FClockWarning(); // must run before <Canvas> creates its store (R3F calls new THREE.Clock())

export default function JourneyCanvas({ tier, mobile, saveData, onFail }: { tier: Tier; mobile: boolean; saveData: boolean; onFail: () => void }) {
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';
  const high = tier === 'high';
  const maxDpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25);
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => { useScene.setState({ tier }); }, [tier]);
  useEffect(() => {
    DefaultLoadingManager.onProgress = (_u, done, total) => useScene.setState({ load: total ? done / total : 1 });
    DefaultLoadingManager.onLoad = () => useScene.setState({ load: 1 });
    return () => { DefaultLoadingManager.onProgress = () => {}; DefaultLoadingManager.onLoad = () => {}; };
  }, []);
  const [volOk, setVolOk] = useState<boolean | null>(null);
  const onVol = useCallback((ok: boolean) => setVolOk(ok), []);
  const step = (dir: 1 | -1) => setDpr((d) => {
    const steps = DPR_STEPS.filter((s) => s <= maxDpr);
    const i = steps.findIndex((s) => s <= d + 1e-6);
    return steps[Math.min(steps.length - 1, Math.max(0, i + dir))] ?? d;
  });

  return (
    <Canvas
      aria-hidden
      dpr={dpr}
      // Review #12: r186 dropped PCFSoft; VSM gives soft, blurred shadows on high tier.
      shadows={high ? { type: debug && window.location.search.includes('pcf') ? PCFShadowMap : VSMShadowMap } : false}
      // Review #12: the high-tier composer does 4× MSAA, so the default framebuffer stays non-antialiased.
      gl={{ antialias: !high, alpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 28, near: 0.05, far: 400, position: [-2.5, 0.45, 3.1] }}
      onCreated={({ gl, set }) => {
        set({ clock: new TimerClock() as unknown as import('three').Clock }); // review r2 low #3: Timer, not Clock
        gl.toneMapping = AgXToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
        // Review #6: the canvas is decorative (story is in SrDescription): hidden from AT and never focusable.
        gl.domElement.setAttribute('aria-hidden', 'true');
        gl.domElement.setAttribute('role', 'presentation');
        gl.domElement.tabIndex = -1;
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }, { once: true });
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      eventPrefix="client"
    >
      <PerformanceMonitor bounds={() => [50, 60]} flipflops={6} onDecline={() => step(1)} onIncline={() => step(-1)} />
      <FrameloopCtl />
      <Warmup />
      {debug && <RenderStats />}
      <CameraRig parallax={!mobile} />
      <Lights shadows={high} mapSize={2048} />
      <FogCtl />
      <EnvironmentHDRI tier={tier} />
      <RoomShell grid={high} />
      <Props high={high} />
      <HeroRobot tier={tier} allowHi={high && !mobile && !saveData} />
      <LidarPulse rays={high ? 180 : 90} />
      <SkyDome stars={high ? 600 : 300} />
      <Suspense fallback={null}>
        {high && !mobile && <CloudVolume onReady={onVol} />}
        {/* Sprite fallback: low tier / mobile, and on high tier until the volume textures are ready (or if they fail). */}
        {!(high && !mobile && volOk) && <CloudDeck count={4} segments={mobile ? 8 : 10} low={!high || mobile} />}
      </Suspense>
      {high && !(debug && new URLSearchParams(window.location.search).has('nopost')) && <Post />}
    </Canvas>
  );
}
