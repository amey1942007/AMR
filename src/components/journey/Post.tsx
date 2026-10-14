'use client';
import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';
import { S } from '@/lib/scene-state';

/**
 * High tier: Bloom (lidar/emissive only, threshold .85 — §18A wins, G3) + SMAA, mounted only while the lidar is
 * active (p .26–.84) so the always-alpha hero phase (R3) is untouched. Base AA = native MSAA (gl.antialias).
 */
export function Post() {
  const [on, setOn] = useState(false);
  useFrame(() => {
    const want = S.p > 0.26 && S.p < 0.84;
    if (want !== on) setOn(want);
  });
  if (!on) return null;
  return (
    <EffectComposer multisampling={4}>
      <Bloom luminanceThreshold={0.85} intensity={0.6} mipmapBlur />
      <SMAA />
    </EffectComposer>
  );
}
