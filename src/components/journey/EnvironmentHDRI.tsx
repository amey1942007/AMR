'use client';
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, type Texture } from 'three';
import { asset } from '@/lib/asset';
import { S } from '@/lib/scene-state';
import { loadHdr, loadLogWebp } from './hdri';

/** 1K .hdr first (fast lighting), then the compressed 2K stream on high tier (locked decision / G13). */
export function EnvironmentHDRI({ tier, defer = false }: { tier: 'high' | 'low'; defer?: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    let alive = true;
    let idleHandle: ReturnType<typeof setTimeout> | number | null = null;
    let usedIdle = false;
    const pm = new PMREMGenerator(gl);
    const apply = (t: Texture) => {
      if (!alive) return;
      const env = pm.fromEquirectangular(t).texture;
      t.dispose();
      const old = scene.environment;
      scene.environment = env;
      old?.dispose();
    };
    const load1k = () => {
      if (!alive) return;
      loadHdr(asset('/hdri/studio_small_09_1k.hdr'))
        .then(apply)
        .then(() => {
          if (tier !== 'high' || defer || !alive) return;
          const go = () => loadLogWebp(asset('/hdri/studio_small_09_2k.webp')).then(apply).catch(() => {});
          if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 2000);
        })
        .catch((e) => process.env.NODE_ENV !== 'production' && console.warn('HDRI failed', e));
    };
    // Mobile / low: don't compete with first paint + scroll — PMREM is expensive.
    if (defer) {
      if ('requestIdleCallback' in window) {
        usedIdle = true;
        idleHandle = requestIdleCallback(load1k, { timeout: 3200 });
      } else {
        idleHandle = setTimeout(load1k, 1200);
      }
    } else {
      load1k();
    }
    return () => {
      alive = false;
      pm.dispose();
      if (idleHandle == null) return;
      if (usedIdle && 'cancelIdleCallback' in window) cancelIdleCallback(idleHandle as number);
      else clearTimeout(idleHandle);
    };
  }, [gl, scene, tier, defer]);
  useFrame(() => { scene.environmentIntensity = S.envIntensity; gl.toneMappingExposure = S.exposure; });
  return null;
}
