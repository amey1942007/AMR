'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, Fog, type DirectionalLight, type OrthographicCamera } from 'three';
import { addTick } from '@/lib/ticker';
import { S } from '@/lib/scene-state';
import { lerp } from '@/lib/monotone';
import { robotPose } from '@/lib/store';
import { useUI } from '@/lib/ui-store';
import { tokens } from '@/lib/tokens';

/** Key + rim lights; shadow frustum ±1.2 m around the robot → ±5 m room (lerped with p, no pop). */
export function Lights({ shadows, mapSize }: { shadows: boolean; mapSize: number }) {
  const key = useRef<DirectionalLight>(null);
  useFrame(() => {
    const l = key.current;
    if (!l) return;
    const k = S.shadowFrustum, half = lerp(1.2, 5, k);
    const cx = lerp(robotPose.x, 0, k), cz = lerp(robotPose.z, 0, k);
    l.position.set(cx + 3, 5, cz + 2);
    l.target.position.set(cx, 0, cz);
    l.target.updateMatrixWorld();
    const cam = l.shadow.camera as OrthographicCamera;
    if (cam.right !== half) { cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix(); }
  });
  return (
    <>
      <directionalLight ref={key} intensity={2.2} castShadow={shadows} shadow-mapSize={[mapSize, mapSize]} shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-near={0.5} shadow-camera-far={20} />
      <pointLight position={[-3.4, 0.7, 0.4]} color="#E81CB0" intensity={1.2} distance={6} decay={1.5} />
      <ambientLight intensity={0.15} />
    </>
  );
}

const ROOM = new Color(tokens['bg-room']), HOR = new Color(tokens['sky-horizon']);
/** Fog near/far 12/40 → 60/220 (p .3→.8); colour follows the sky blend. */
export function FogCtl() {
  const { scene } = useThree();
  useEffect(() => { scene.fog = new Fog(ROOM.clone(), 12, 40); return () => { scene.fog = null; }; }, [scene]);
  useFrame(() => {
    const f = scene.fog as Fog | null;
    if (!f) return;
    f.near = lerp(12, 60, S.fog); f.far = lerp(40, 220, S.fog);
    f.color.copy(ROOM).lerp(HOR, S.skyMix * 0.6);
  });
  return null;
}

/** Pause per ui-spec §8: '#info' top < 0 or a dialog open → render on demand. Tab hidden is handled by rAF. */
export function FrameloopCtl() {
  const { setFrameloop, invalidate } = useThree();
  useEffect(() => {
    let mode: 'always' | 'demand' = 'always';
    const tick = () => {
      const info = document.getElementById('info');
      const paused = (info ? info.getBoundingClientRect().top < 0 : false) || useUI.getState().dialog !== null;
      const next = paused ? 'demand' : 'always';
      if (next !== mode) { mode = next; setFrameloop(next); if (paused) invalidate(); }
    };
    return addTick(tick);
  }, [setFrameloop, invalidate]);
  return null;
}
