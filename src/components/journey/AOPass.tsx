'use client';
import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { groupPasses } from '@react-three/postprocessing';

type N8 = { enabled: boolean; configuration: Record<string, unknown>; setQualityMode(m: string): void; dispose(): void };

/**
 * N8AO (review #12). The `n8ao` package (~80 KB gz: shaders + embedded noise) is imported dynamically, so it lands in
 * its own chunk that streams after first paint. AO only matters from p .2 on. Until it arrives, nothing is drawn.
 * The pass is created exactly like @react-three/postprocessing's <N8AO> (a groupPass primitive in the composer).
 */
export function AOPass({ onPass }: { onPass: (p: N8 | null) => void }) {
  const { scene, camera } = useThree();
  const [pass, setPass] = useState<N8 | null>(null);
  useEffect(() => {
    let live = true, made: N8 | null = null;
    import('n8ao').then(({ N8AOPostPass }) => {
      if (!live) return;
      const p = new N8AOPostPass(scene, camera) as unknown as N8;
      Object.assign(p.configuration, { halfRes: true, aoRadius: 0.6, distanceFalloff: 0.5, intensity: 2.2, depthAwareUpsampling: true });
      (p.configuration.color as { set(c: string): void } | undefined)?.set?.('#0B0B10');
      p.setQualityMode('Medium');
      // No transparency pre-passes: they re-render every transparent object twice per frame (draw budget).
      Object.assign(p, { autoDetectTransparency: false }); p.configuration.transparencyAware = false;
      p.enabled = false;
      groupPasses.add(p as never);
      made = p; setPass(p); onPass(p);
    }).catch(() => {});
    return () => { live = false; onPass(null); made?.dispose(); };
  }, [scene, camera, onPass]);
  return pass ? <primitive object={pass} /> : null;
}
