import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, type Material, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Cooperative slicing for main-thread work (review: the first click was swallowed during the furniture merge).
 * `slice()` yields to the event loop once ~budget ms have passed, so input and rAF run between chunks.
 */
export function makeSlicer(budgetMs = 6) {
  let t = performance.now();
  const idle = () => new Promise<void>((r) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 50 }) : setTimeout(r, 0)));
  return async () => { if (performance.now() - t > budgetMs) { await idle(); t = performance.now(); } };
}

/**
 * Async mergeByMaterial: one mesh per shared material, transforms baked, quantized attributes dequantized, plus an
 * optional per-vertex float attribute `aRoom` (from tagOf) so one merged draw can fade sub-parts independently.
 */
export async function mergeByMaterialAsync(root: Object3D, tagOf?: (m: Mesh) => number, slice = makeSlicer()): Promise<Group> {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map<Material, BufferGeometry[]>();
  const meshes: Mesh[] = [];
  root.traverse((n) => { if ((n as Mesh).isMesh) meshes.push(n as Mesh); });
  for (const m of meshes) {
    const src = m.geometry, g = new BufferGeometry();
    for (const name of ['position', 'normal', 'uv'] as const) {
      const a = src.getAttribute(name);
      if (!a) continue;
      const out = new Float32Array(a.count * a.itemSize);
      // getX/Y/Z/W denormalize and work for interleaved (meshopt) attributes too; getComponent+array does neither.
      const getters = [a.getX, a.getY, a.getZ, a.getW].slice(0, a.itemSize);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = getters[k].call(a, i);
      g.setAttribute(name, new BufferAttribute(out, a.itemSize));
    }
    if (src.index) g.setIndex(Array.from(src.index.array as ArrayLike<number>));
    g.applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (tagOf) g.setAttribute('aRoom', new BufferAttribute(new Float32Array(g.getAttribute('position').count).fill(tagOf(m)), 1));
    const mat = m.material as Material;
    (buckets.get(mat) ?? buckets.set(mat, []).get(mat)!).push(g);
    await slice();
  }
  const out = new Group();
  out.name = root.name;
  for (const [mat, geos] of buckets) {
    const attrs = ['position', 'normal', 'uv', 'aRoom'].filter((a) => geos.every((g) => g.getAttribute(a)));
    geos.forEach((g) => Object.keys(g.attributes).forEach((a) => { if (!attrs.includes(a)) g.deleteAttribute(a); }));
    // mergeGeometries needs all-indexed or all-non-indexed input (else it returns null and the meshes vanish).
    if (geos.some((g) => g.index) && geos.some((g) => !g.index)) {
      for (const g of geos) if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    }
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged && process.env.NODE_ENV !== 'production') console.warn('[merge] could not merge bucket', (mat as Material).name, geos.length);
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    if (merged) { const mesh = new Mesh(merged, mat); mesh.castShadow = mesh.receiveShadow = true; out.add(mesh); }
    await slice();
  }
  return out;
}
