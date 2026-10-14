'use client';
import { markShadowDirty } from '@/lib/shadow-dirty';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Color, CylinderGeometry, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, type Material, Matrix4, Mesh, MeshStandardMaterial, type Object3D, Quaternion, TorusGeometry, Vector3, type BufferGeometry } from 'three';
import { ACCENTS, FURNITURE, PROPS, type Box, type Placement } from '@/lib/room';
import { S } from '@/lib/scene-state';
import { smoothstep } from '@/lib/monotone';
import { artFor, buildArt, PAL } from '@/lib/art';
import { makeSlicer, mergeByMaterialAsync } from '@/lib/merge-async';
import { loadModel } from './robotLoader';
import { asset } from '@/lib/asset';
import { MODEL_VER } from '@/lib/robot-nodes';

/** Room rise-in order (path order) → stagger p .10–.30. */
const ORDER = ['living', 'link', 'kitchen', 'corridor', 'bath', 'bed2', 'bed1'];
const kRoom = (room: string) => { const i = Math.max(0, ORDER.indexOf(room)); return smoothstep(0.1 + (i / ORDER.length) * 0.14, 0.16 + (i / ORDER.length) * 0.14, S.p); };
/** Items big enough to matter in the key-light shadow (draw-call budget: small items don't cast). */
const CASTS = /sofa|bed$/;

function instanced(geo: BufferGeometry, list: Box[]) {
  const alpha = new InstancedBufferAttribute(new Float32Array(list.length), 1);
  alpha.setUsage(DynamicDrawUsage);
  geo.setAttribute('aAlpha', alpha);
  const mat = new MeshStandardMaterial({ color: new Color(PAL.slate), roughness: 0.75, metalness: 0, envMapIntensity: 0.4, transparent: true });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha; varying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <opaque_fragment>', 'diffuseColor.a *= vAlpha;\n#include <opaque_fragment>');
  };
  mat.customProgramCacheKey = () => 'prop-alpha';
  const mesh = new InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length; mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  return { mesh, alpha };
}

/** Code-side accent strips (apartment.json accents), in host-local space. ≤ .6 emissive (under the bloom threshold). */
function accentMeshes(host: Placement): Mesh[] {
  const out: Mesh[] = [];
  for (const a of ACCENTS.filter((x) => x.host === host.node)) {
    if (a.shape === 'screenGradient') continue; // done by the TV screen material (art.ts)
    const mat = new MeshStandardMaterial({ color: a.color, emissive: new Color(a.color), emissiveIntensity: Math.min(0.6, a.intensity), roughness: 0.4, transparent: true, opacity: 0 });
    mat.name = `accent:${a.id}`;
    const p = a.params as { size?: number[]; offset?: number[]; radius?: number; tube?: number; y?: number; width?: number };
    const off = p.offset ?? [0, 0, 0];
    if (a.shape === 'box') {
      const m = new Mesh(new BoxGeometry(...(p.size as [number, number, number])), mat);
      m.position.set(off[0], off[1], off[2]); out.push(m);
    } else if (a.shape === 'torus') {
      const m = new Mesh(new TorusGeometry(p.radius, p.tube, 6, 64), mat);
      m.rotation.x = Math.PI / 2; m.position.set(off[0], p.y ?? 0, off[2]); out.push(m);
    } else if (a.shape === 'rectLine') {
      const [w, d] = p.size as [number, number], t = p.width ?? 0.02, y = p.y ?? 0.01;
      for (const [x, z, sx, sz] of [[0, -d / 2, w, t], [0, d / 2, w, t], [-w / 2, 0, t, d], [w / 2, 0, t, d]]) {
        const m = new Mesh(new BoxGeometry(sx, 0.002, sz), mat); m.position.set(x, y, z); out.push(m);
      }
    }
  }
  return out;
}

/** Per-room fade weights, shared by every merged furniture material (uniform float uRoomK[8]). */
const ROOM_K = { value: new Float32Array(8) };
/**
 * Room fade without per-room draws: each merged vertex carries its room index (aRoom); the material rises it by
 * 0.15 m and screen-door dithers it in by uRoomK[aRoom]. Stays opaque (no sorting, no program switches).
 */
function patchRoomFade(m: Material) {
  if (m.userData.roomFade) return;
  m.userData.roomFade = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRoomK = ROOM_K;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRoom; uniform float uRoomK[8]; varying float vK;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvK = uRoomK[int(aRoom + .5)]; transformed.y -= .15 * (1. - vK);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vK;')
      .replace('#include <clipping_planes_fragment>', 'if (vK < .999 && vK <= fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))))) discard;\n#include <clipping_planes_fragment>');
  };
  m.customProgramCacheKey = () => 'room-fade';
}

/**
 * v3 furniture: CC0 GLBs (public/models/furniture, Draco + KTX2 normals) placed from src/data/apartment.json, restyled to
 * the v2 palette (art.ts artFor), then merged ACROSS rooms per material (draw budget: one draw per look) and faded in
 * room by room in the shader. Building and merging are sliced (≤6 ms chunks) so input is never blocked.
 * Until (or if not) loaded, every collider footprint shows as Slate blocks in two instanced draw calls.
 */
/** Low tier uses the low-detail set (`fileLo`) when present. */
const fileOf = (f: Placement, high: boolean) => (!high && (f as Placement & { fileLo?: string }).fileLo) || f.file;

export function Props({ high = true }: { high?: boolean }) {
  const gl = useThree((t) => t.gl);
  const [group, setGroup] = useState<Group | null>(null);
  const loaded = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    const files = [...new Set(FURNITURE.map((f) => fileOf(f, high)))];
    Promise.all(files.map((f) => loadModel(gl, asset(`${f}?v=${MODEL_VER}`)).then((o) => [f, o] as const))).then(async (res) => {
      if (!live) return;
      const src = new Map(res), slice = makeSlicer();
      const cache = new Map<string, MeshStandardMaterial>(), root = new Group(), shadowRoot = new Group();
      const nodes: string[] = [];
      for (const f of FURNITURE) {
        const s = src.get(fileOf(f, high));
        if (!s) continue;
        const holder = new Group();
        holder.userData.room = Math.max(0, ORDER.indexOf(f.room));
        holder.position.set(f.position[0], f.position[1], f.position[2]);
        holder.rotation.y = (f.yaw * Math.PI) / 180;
        const o = s.clone(true);
        o.scale.set(f.scale[0], f.scale[1], f.scale[2]);
        holder.add(o);
        o.traverse((n) => {
          const m = n as Mesh;
          if (!m.isMesh) return;
          const mats = (Array.isArray(m.material) ? m.material : [m.material]) as MeshStandardMaterial[];
          const repl = mats.map((sm) => {
            // Key on the resolved look (not the item) so identical palette materials merge into one draw.
            const d = artFor(f.item, sm.name), nm = high && /sofa|bed$|rug|loungechair/.test(f.item) ? sm.normalMap ?? null : null;
            const key = `${JSON.stringify(d)}|${nm?.uuid ?? ''}`;
            let am = cache.get(key);
            if (!am) { am = buildArt(d, nm, high); am.name = `art:${f.item}`; cache.set(key, am); }
            return am;
          });
          m.material = Array.isArray(m.material) ? repl : repl[0];
        });
        for (const a of accentMeshes(f)) holder.add(a);
        (CASTS.test(f.item) ? shadowRoot : root).add(holder);
        nodes.push(f.node);
        await slice();
        if (!live) return;
      }
      const tag = (m: Mesh) => { let n: Object3D | null = m; while (n && n.userData.room === undefined) n = n.parent; return (n?.userData.room as number) ?? 0; };
      const g = new Group();
      g.name = 'furniture';
      for (const [r, cast] of [[root, false], [shadowRoot, true]] as const) {
        // Multi-material meshes are split per group before merging (the merge expects one material per mesh).
        splitMultiMaterial(r);
        const merged = await mergeByMaterialAsync(r, tag, slice);
        if (!live) return;
        merged.traverse((n) => { const m = n as Mesh; if (m.isMesh) { m.castShadow = cast || true; m.receiveShadow = false; /* all furniture casts: the map is baked, not per-frame */ patchRoomFade(m.material as Material); } });
        g.add(merged);
      }
      // Accent materials were created per accent; make them opaque like the rest (the dither does the fade).
      g.traverse((n) => { const m = n as Mesh; if (m.isMesh) { const mt = m.material as MeshStandardMaterial; mt.transparent = false; mt.opacity = 1; } });
      for (const n of nodes) loaded.current.add(n);
      setGroup(g);
      markShadowDirty();
    });
    return () => { live = false; };
  }, [gl, high]);
  useEffect(() => () => {
    group?.traverse((n) => { const m = n as Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as Material).dispose(); } });
  }, [group]);

  // VSM renders every receiveShadow mesh into the shadow map too (three's WebGLShadowMap), so furniture only casts;
  // the floor is the receiver. Saves ~40 draws per frame.
  // Primitive fallback for everything not (yet) loaded.
  const { boxes, cyls, idx } = useMemo(() => {
    const bl = PROPS.filter((p) => p.shape !== 'cyl'), cl = PROPS.filter((p) => p.shape === 'cyl');
    return { boxes: instanced(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0), bl), cyls: instanced(new CylinderGeometry(0.5, 0.42, 1, 24).translate(0, 0.5, 0), cl), idx: { bl, cl } };
  }, []);
  useEffect(() => () => { for (const x of [boxes, cyls]) { x.mesh.geometry.dispose(); (x.mesh.material as Material).dispose(); } }, [boxes, cyls]);
  const m4 = useMemo(() => new Matrix4(), []), q = useMemo(() => new Quaternion(), []), up = useMemo(() => new Vector3(0, 1, 0), []);
  const pos = useMemo(() => new Vector3(), []), scl = useMemo(() => new Vector3(), []);
  const roomOf = useMemo(() => new Map(FURNITURE.map((f) => [f.node, f.room])), []);

  useFrame(() => {
    const vis = S.p <= 0.9 && S.p > 0.09;
    for (const [set, list] of [[boxes, idx.bl], [cyls, idx.cl]] as const) {
      list.forEach((b, j) => {
        const k = group && loaded.current.has(b.name) ? 0 : kRoom(roomOf.get(b.name) ?? 'living');
        set.alpha.setX(j, k);
        q.setFromAxisAngle(up, b.yaw);
        m4.compose(pos.set(b.x, -0.15 * (1 - k), b.z), q, scl.set(b.w, b.h * Math.max(k, 0.001), b.d));
        set.mesh.setMatrixAt(j, m4);
      });
      set.alpha.needsUpdate = true; set.mesh.instanceMatrix.needsUpdate = true;
      set.mesh.visible = vis && !(group && list.every((b) => loaded.current.has(b.name)));
    }
    let any = 0;
    ORDER.forEach((r, i) => { ROOM_K.value[i] = kRoom(r); any = Math.max(any, ROOM_K.value[i]); });
    if (group) group.visible = vis && any > 0.001;
  });

  return (
    <group name="props">
      <primitive object={boxes.mesh} />
      <primitive object={cyls.mesh} />
      {group && <primitive object={group} />}
    </group>
  );
}

/** Replace each multi-material mesh by one mesh per geometry group (so mergeByMaterial can bucket them). */
function splitMultiMaterial(root: Object3D) {
  const todo: Mesh[] = [];
  root.traverse((n) => { const m = n as Mesh; if (m.isMesh && Array.isArray(m.material)) todo.push(m); });
  for (const m of todo) {
    const mats = m.material as Material[], g = m.geometry;
    for (const grp of g.groups) {
      const part = g.clone();
      part.clearGroups();
      if (g.index) part.setIndex(Array.from((g.index.array as ArrayLike<number>)).slice(grp.start, grp.start + grp.count));
      const pm = new Mesh(part, mats[grp.materialIndex ?? 0]);
      pm.position.copy(m.position); pm.quaternion.copy(m.quaternion); pm.scale.copy(m.scale);
      m.parent!.add(pm);
    }
    m.parent!.remove(m);
  }
}
