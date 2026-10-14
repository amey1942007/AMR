'use client';
import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, DefaultLoadingManager } from 'three';
import { CameraRig } from './CameraRig';
import { RoomShell } from './RoomShell';
import { Props } from './Props';
import { HeroRobot } from './HeroRobot';
import { LidarPulse } from './LidarPulse';
import { CloudDeck } from './CloudDeck';
import { SkyDome } from './SkyDome';
import { EnvironmentHDRI } from './EnvironmentHDRI';
import { Lights, FogCtl, FrameloopCtl } from './SceneRig';
import { Post } from './Post';
import { useScene, type Tier } from '@/lib/store';
import { useServices } from '@/components/providers/ServicesProvider';

const DPR_STEPS = [2, 1.5, 1.25, 1];

/** R3F root. Always alpha (R3): the DOM Backdrop owns the page colour; hero "AMR" sits between. */
export default function JourneyCanvas({ tier, mobile, saveData, onFail }: { tier: Tier; mobile: boolean; saveData: boolean; onFail: () => void }) {
  const { media } = useServices();
  const high = tier === 'high';
  const maxDpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25);
  const [dpr, setDpr] = useState(maxDpr);
  useEffect(() => { useScene.setState({ tier }); }, [tier]);
  useEffect(() => {
    DefaultLoadingManager.onProgress = (_u, done, total) => useScene.setState({ load: total ? done / total : 1 });
    DefaultLoadingManager.onLoad = () => useScene.setState({ load: 1 });
    return () => { DefaultLoadingManager.onProgress = () => {}; DefaultLoadingManager.onLoad = () => {}; };
  }, []);
  const step = (dir: 1 | -1) => setDpr((d) => {
    const steps = DPR_STEPS.filter((s) => s <= maxDpr);
    const i = steps.findIndex((s) => s <= d + 1e-6);
    return steps[Math.min(steps.length - 1, Math.max(0, i + dir))] ?? d;
  });

  return (
    <Canvas
      aria-hidden
      dpr={dpr}
      shadows={high ? { type: PCFSoftShadowMap } : false}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 28, near: 0.05, far: 400, position: [-2.5, 0.45, 3.1] }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onFail(); }, { once: true });
      }}
      style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none' }}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      eventPrefix="client"
    >
      <PerformanceMonitor bounds={() => [45, 60]} flipflops={6} onDecline={() => step(1)} onIncline={() => step(-1)} />
      <FrameloopCtl />
      <CameraRig parallax={!mobile} />
      <Lights shadows={high} mapSize={4096} />
      <FogCtl />
      <EnvironmentHDRI tier={tier} />
      <RoomShell floorTexture={media.floorTexture} />
      <Props />
      <HeroRobot tier={tier} allowHi={high && !mobile && !saveData} contactShadows />
      <LidarPulse rays={high ? 180 : 90} />
      <SkyDome stars={high ? 600 : 300} />
      <Suspense fallback={null}>
        <CloudDeck count={high ? 8 : 4} segments={high ? 20 : 8} />
      </Suspense>
      {high && <Post />}
    </Canvas>
  );
}
