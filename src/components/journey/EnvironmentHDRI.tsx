'use client';
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, type Texture } from 'three';
import { asset } from '@/lib/asset';
import { S } from '@/lib/scene-state';
import { loadHdr, loadLogWebp } from './hdri';

/** 1K .hdr first (fast lighting), then the compressed 2K stream on high tier (locked decision / G13). */
export function EnvironmentHDRI({ tier }: { tier: 'high' | 'low' }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    let alive = true;
    const pm = new PMREMGenerator(gl);
    const apply = (t: Texture) => {
      if (!alive) return;
      const env = pm.fromEquirectangular(t).texture;
      t.dispose();
      const old = scene.environment;
      scene.environment = env;
      old?.dispose();
    };
    loadHdr(asset('/hdri/studio_small_09_1k.hdr'))
      .then(apply)
      .then(() => {
        if (tier !== 'high' || !alive) return;
        const go = () => loadLogWebp(asset('/hdri/studio_small_09_2k.webp')).then(apply).catch(() => {});
        if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 1500 }); else setTimeout(go, 1500);
      })
      .catch((e) => process.env.NODE_ENV !== 'production' && console.warn('HDRI failed', e));
    return () => { alive = false; pm.dispose(); };
  }, [gl, scene, tier]);
  useFrame(() => { scene.environmentIntensity = S.envIntensity; gl.toneMappingExposure = S.exposure; });
  return null;
}
