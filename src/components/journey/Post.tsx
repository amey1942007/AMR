'use client';
import { useCallback, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, SMAA } from '@react-three/postprocessing';
import { SMAAPreset, type BloomEffect, type SMAAEffect } from 'postprocessing';
import { S } from '@/lib/scene-state';
import { AOPass } from './AOPass';

/**
 * High tier: N8AO (half-res, room phase only) → Bloom (lidar/emissive only, threshold .85) → SMAA ULTRA.
 * The composer stays mounted for the whole journey (compiled once with the scene warm-up) and the effects are only
 * enabled or weakened by p, so there's no mount or compile hitch mid-scroll. 4× MSAA lives here, so the canvas itself
 * is created with antialias:false (review #12). No normal pass: N8AO reconstructs normals from depth.
 */
export function Post() {
  const bloom = useRef<BloomEffect>(null);
  const smaa = useRef<SMAAEffect>(null);
  const ao = useRef<{ enabled: boolean } | null>(null);
  // State (not just a ref) so the composer re-renders and re-reads its passes when the lazy AO pass arrives.
  const [, setAo] = useState<object | null>(null);
  const onPass = useCallback((p: { enabled: boolean } | null) => { ao.current = p; setAo(p); }, []);
  useFrame(() => {
    const on = S.p > 0.26 && S.p < 0.84;
    if (bloom.current) bloom.current.intensity = on ? 0.6 : 0;
    if (smaa.current) smaa.current.blendMode.opacity.value = on ? 1 : 0;
    // AO only while the apartment is in view (it would darken the hero's studio look and costs ~1 ms).
    if (ao.current) ao.current.enabled = S.p > 0.2 && S.p < 0.8;
  });
  return (
    <EffectComposer multisampling={4}>
      {!(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('noao')) && <AOPass onPass={onPass} />}
      <Bloom ref={bloom} luminanceThreshold={0.85} intensity={0} mipmapBlur />
      <SMAA ref={smaa} preset={SMAAPreset.ULTRA} />
    </EffectComposer>
  );
}
