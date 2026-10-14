import { Color, DoubleSide, type Material, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D, type Texture, Vector2 } from 'three';

/** Art direction v2 palette (art-direction-v2.md §2). Only these values. */
export const PAL = {
  graphite: '#1A1A22', slate: '#2A2A35', steel: '#4A4A57', fog: '#A8A6B4', bone: '#E6E4EC',
  violet: '#7B2FF7', magenta: '#E81CB0', floor: '#0B0B10', wall: '#14141C',
} as const;

export interface PropMat {
  color: string; roughness: number; metalness: number; envMapIntensity: number;
  clearcoat?: number; clearcoatRoughness?: number; emissive?: string; emissiveIntensity?: number; leaves?: boolean;
}

/** §2.1 per-key materials. Keys are node names (walked up from the mesh) or material names. */
export const PROP_MATERIALS: Record<string, PropMat> = {
  steel_frame_shelves_01: { color: PAL.slate, roughness: 0.55, metalness: 0.5, envMapIntensity: 0.5 },
  modern_coffee_table_01: { color: PAL.bone, roughness: 0.4, metalness: 0, envMapIntensity: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.25 },
  dining_chair_02: { color: PAL.graphite, roughness: 0.7, metalness: 0, envMapIntensity: 0.4 },
  drawer_cabinet: { color: PAL.slate, roughness: 0.5, metalness: 0.2, envMapIntensity: 0.5 },
  drawer_cabinet_drawer_01: { color: PAL.fog, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 },
  drawer_cabinet_drawer_02: { color: PAL.fog, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5, emissive: PAL.violet, emissiveIntensity: 0.4 },
  drawer_cabinet_drawer_03: { color: PAL.fog, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 },
  drawer_cabinet_drawer_04: { color: PAL.fog, roughness: 0.45, metalness: 0.1, envMapIntensity: 0.5 },
  cardboard_box_01: { color: PAL.fog, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 },
  'cardboard_box_01#bone': { color: PAL.bone, roughness: 0.8, metalness: 0, envMapIntensity: 0.3 },
  plastic_crate_01: { color: PAL.graphite, roughness: 0.55, metalness: 0, envMapIntensity: 0.4 },
  potted_plant_02_pot: { color: PAL.bone, roughness: 0.3, metalness: 0, envMapIntensity: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.2 },
  potted_plant_02_dirt: { color: PAL.floor, roughness: 0.95, metalness: 0, envMapIntensity: 0.1 },
  potted_plant_02_leaves: { color: PAL.steel, roughness: 0.6, metalness: 0, envMapIntensity: 0.4, leaves: true },
  default: { color: PAL.slate, roughness: 0.75, metalness: 0, envMapIntensity: 0.4 },
};

/** Emissive accent strips added in code (≤ 0.6 so they stay under the bloom threshold). */
export const ACCENT_STRIPS: Record<string, { color: string; intensity: number; size: [number, number, number]; y: (h: number) => number; z: (d: number) => number }> = {
  shelves: { color: PAL.violet, intensity: 0.5, size: [1, 0.01, 0.01], y: (h) => h - 0.005, z: (d) => d / 2 },
  table: { color: PAL.magenta, intensity: 0.45, size: [1, 0.01, 0.01], y: (h) => h - 0.04, z: (d) => d / 2 },
};

function keyFor(mesh: Mesh): string {
  for (let n: Object3D | null = mesh; n; n = n.parent) if (PROP_MATERIALS[n.name]) return n.name;
  const mn = (mesh.material as Material).name;
  return PROP_MATERIALS[mn] ? mn : 'default';
}

const cache = new Map<string, MeshStandardMaterial>();

function build(key: string, src: MeshStandardMaterial, clearcoat: boolean): MeshStandardMaterial {
  const id = `${key}|${clearcoat}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const d = PROP_MATERIALS[key];
  const phys = clearcoat && d.clearcoat !== undefined;
  const m = phys
    ? new MeshPhysicalMaterial({ clearcoat: d.clearcoat, clearcoatRoughness: d.clearcoatRoughness })
    : new MeshStandardMaterial();
  m.name = `art:${key}`;
  m.color = new Color(d.color);
  m.roughness = d.roughness; m.metalness = d.metalness; m.envMapIntensity = d.envMapIntensity;
  if (d.emissive) { m.emissive = new Color(d.emissive); m.emissiveIntensity = d.emissiveIntensity ?? 0.4; }
  if (src.normalMap) { m.normalMap = src.normalMap; m.normalScale = new Vector2(0.6, 0.6); }
  if (d.leaves) {
    m.side = DoubleSide;
    // Leaf cut-outs live in the baseColor alpha: reuse that texture as alphaMap reading .a (not .g), so no albedo hue returns.
    if (src.map) {
      m.alphaMap = src.map; m.alphaTest = 0.5;
      m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).a;'); };
      m.customProgramCacheKey = () => 'art-leaves-alpha';
    }
  }
  m.transparent = true; m.opacity = 0;
  cache.set(id, m);
  return m;
}

/** Applies the v2 look to a loaded prop subtree; disposes the replaced material + its albedo/roughness textures. */
export function applyArt(root: Object3D, opts: { clearcoat: boolean; variant?: string }): Material[] {
  const used = new Set<Material>();
  const dead = new Set<MeshStandardMaterial>();
  root.traverse((n) => {
    const mesh = n as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    const src = mesh.material as MeshStandardMaterial;
    let key = keyFor(mesh);
    if (opts.variant && PROP_MATERIALS[`${key}#${opts.variant}`]) key = `${key}#${opts.variant}`;
    const m = build(key, src, opts.clearcoat);
    if (src !== m && !src.name.startsWith('art:')) dead.add(src);
    mesh.material = m;
    used.add(m);
  });
  dead.forEach((s) => {
    const keep = new Set<Texture | null>([s.normalMap, ...[...cache.values()].map((c) => c.alphaMap)]);
    for (const t of [s.map, s.roughnessMap, s.metalnessMap, s.aoMap] as (Texture | null)[]) if (t && !keep.has(t)) t.dispose();
    s.dispose();
  });
  return [...used];
}

/** Shared rise-in fade: transparent only while fading, opaque once in (avoids sorting artefacts). */
export function setFade(mats: Iterable<Material>, k: number) {
  for (const m of mats) {
    const opaque = k >= 0.999;
    if (m.transparent === opaque) { m.transparent = !opaque; m.needsUpdate = true; }
    m.opacity = k; m.depthWrite = k > 0.99;
  }
}

// ─── Art direction v3 §2.4: furniture materials keyed by (item, source material name) ───────────────────────
export interface ArtMat extends PropMat { sheen?: number; sheenColor?: string; side?: 'double' }
const M = (color: string, roughness: number, metalness = 0, envMapIntensity = 0.4, extra: Partial<ArtMat> = {}): ArtMat => ({ color, roughness, metalness, envMapIntensity, ...extra });
const STEEL_METAL = M(PAL.steel, 0.4, 0.8, 0.5);
/** Returns the palette material for one source material of one furniture item. */
export function artFor(item: string, mat: string): ArtMat {
  const m = mat.toLowerCase();
  switch (item) {
    case 'sofa': return M(PAL.slate, 0.85, 0, 0.35, { sheen: 0.3, sheenColor: PAL.steel });
    case 'coffeetable': return M(PAL.bone, 0.4, 0, 0.6, { clearcoat: 0.4, clearcoatRoughness: 0.25 });
    case 'loungechair': return M(PAL.graphite, 0.7);
    case 'sidetable': return M(PAL.fog, 0.5);
    case 'diningtable': return M(PAL.bone, 0.45, 0, 0.6);
    case 'chair': return M(PAL.graphite, 0.55);
    case 'tvunit': return M(PAL.graphite, 0.6);
    case 'tv': return m.includes('dark') ? M(PAL.floor, 0.15, 0, 0.6, { emissive: PAL.violet, emissiveIntensity: 0.25 }) : M(PAL.graphite, 0.5);
    case 'plant': return m.includes('leaves') ? M(PAL.steel, 0.6, 0, 0.4, { side: 'double' }) : m.includes('pot') || m === 'potted_plant_04' ? M(PAL.bone, 0.3, 0, 0.6, { clearcoat: 0.6, clearcoatRoughness: 0.2 }) : M(PAL.steel, 0.6);
    case 'rug': return m.includes('darker') ? M(PAL.graphite, 0.95) : M(PAL.slate, 0.95, 0, 0.3);
    case 'cabinet': case 'sink': case 'stove':
      if (m === 'metaldark' || m === 'glass') return M(PAL.floor, m === 'glass' ? 0.15 : 0.3, 0.1, 0.5);
      if (m === 'metal' || m === 'carpetwhite') return M(PAL.graphite, 0.3, 0.1, 0.5);
      if (m === 'metallight' || m === '_defaultmat') return M(PAL.fog, 0.35, 0.3, 0.5);
      return M(PAL.bone, 0.4, 0, 0.5);
    case 'fridge': return M(PAL.fog, 0.3, 0.4, 0.5);
    case 'bar': return m === 'metal' ? M(PAL.graphite, 0.3, 0.1) : M(PAL.slate, 0.5);
    case 'stool': return STEEL_METAL;
    case 'bathtub': return m.startsWith('metal') ? STEEL_METAL : M(PAL.bone, 0.25, 0, 0.6, { clearcoat: 0.8, clearcoatRoughness: 0.15 });
    case 'toilet': return m.startsWith('metal') ? STEEL_METAL : M(PAL.bone, 0.25, 0, 0.6);
    case 'sinkcabinet': return m === 'carpetwhite' ? M(PAL.bone, 0.3) : m.startsWith('metal') ? STEEL_METAL : M(PAL.fog, 0.45);
    case 'desk': return M(PAL.bone, 0.45, 0.1, 0.5);
    case 'deskchair': return m.includes('legs') ? STEEL_METAL : M(PAL.graphite, 0.7);
    case 'bed': return m === 'carpet' ? M(PAL.bone, 0.9, 0, 0.3) : m === 'carpetwhite' ? M(PAL.fog, 0.9, 0, 0.3) : M(PAL.slate, 0.6);
    case 'nightstand': return M(PAL.fog, 0.5);
    case 'wardrobe': return M(PAL.slate, 0.6);
    default: return M(PAL.slate, 0.75);
  }
}

/** Builds a palette material (Physical only where clearcoat/sheen is asked AND allowed by tier). */
export function buildArt(d: ArtMat, normalMap: Texture | null, physical: boolean): MeshStandardMaterial {
  const phys = physical && (d.clearcoat !== undefined || d.sheen !== undefined);
  const m = phys ? new MeshPhysicalMaterial({ clearcoat: d.clearcoat ?? 0, clearcoatRoughness: d.clearcoatRoughness ?? 0, sheen: d.sheen ?? 0, sheenColor: new Color(d.sheenColor ?? '#000') }) : new MeshStandardMaterial();
  m.color = new Color(d.color); m.roughness = d.roughness; m.metalness = d.metalness; m.envMapIntensity = d.envMapIntensity;
  if (d.emissive) { m.emissive = new Color(d.emissive); m.emissiveIntensity = Math.min(0.6, d.emissiveIntensity ?? 0.4); }
  if (normalMap) { m.normalMap = normalMap; m.normalScale = new Vector2(0.6, 0.6); }
  if (d.side === 'double') m.side = DoubleSide;
  return m;
}
