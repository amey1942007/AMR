import type { WebGLRenderer, Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { asset } from '@/lib/asset';

let loader: GLTFLoader | null = null;
let ktx2: KTX2Loader | null = null;
/** One shared KTX2 loader (Basis transcoder in /basis/), also used for the cloud textures. */
export function getKTX2(gl: WebGLRenderer) {
  return (ktx2 ??= new KTX2Loader().setTranscoderPath(asset('/basis/')).detectSupport(gl));
}
function getLoader(gl: WebGLRenderer) {
  if (loader) return loader;
  const draco = new DRACOLoader().setDecoderPath(asset('/draco/'));
  const ktx2 = getKTX2(gl);
  loader = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/**
 * Review #14: one GET per model. Paths come from the media manifest (media.static.ts / apartment.json), so there's no
 * HEAD probe; a missing file (404 or HTML) makes the loader throw → null → placeholder.
 */
export async function loadModel(gl: WebGLRenderer, url: string): Promise<Object3D | null> {
  try {
    const g = await getLoader(gl).loadAsync(url);
    return g.scene;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.warn('[HeroRobot] model failed, using stand-in', url, e);
    return null;
  }
}
