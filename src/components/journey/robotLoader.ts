import type { WebGLRenderer, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asset } from '@/lib/asset';

let loader: GLTFLoader | null = null;
function getLoader(gl: WebGLRenderer) {
  if (loader) return loader;
  const draco = new DRACOLoader().setDecoderPath(asset('/draco/'));
  const ktx2 = new KTX2Loader().setTranscoderPath(asset('/basis/')).detectSupport(gl);
  loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** Resolves null when the file is missing (→ placeholder), so the real GLB drops in without code changes. */
export async function loadModel(gl: WebGLRenderer, url: string): Promise<Object3D | null> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (!head.ok || (head.headers.get('content-type') ?? '').includes('text/html')) return null;
    const g = await getLoader(gl).loadAsync(url);
    return g.scene;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[HeroRobot] model failed, using stand-in', url, e);
    return null;
  }
}
