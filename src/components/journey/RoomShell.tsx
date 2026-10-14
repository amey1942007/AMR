'use client';
import { markShadowDirty } from '@/lib/shadow-dirty';
import { useEffect, useMemo, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { CanvasTexture, PlaneGeometry, ShaderMaterial, TextureLoader, type Texture } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, LineBasicMaterial, LineSegments, MathUtils, Matrix4, MeshStandardMaterial, Vector3, type Group } from 'three';
import { WALLS, ROOM, type Wall } from '@/lib/room';
import { robotPose } from '@/lib/store';
import { S } from '@/lib/scene-state';
import { smoothstep } from '@/lib/monotone';
import { PAL } from '@/lib/art';


const FLOOR_SPAN = 48; // m
const CUT_H = 0.12, CUT_O = 0.35, LAMBDA = 6;
/** Segment (a→b) vs axis-aligned wall footprint (slab test), in XZ. */
function segHitsWall(ax: number, az: number, bx: number, bz: number, w: Wall) {
  const dx = bx - ax, dz = bz - az;
  let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[ax, dx, w.x - w.w / 2, w.x + w.w / 2], [az, dz, w.z - w.d / 2, w.z + w.d / 2]] as const) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return false; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return false;
  }
  return true;
}
/** Box edge list (12 edges, 24 vertices) of a unit cube with base at y 0. */
const EDGE = (() => {
  const c = [[-.5, 0, -.5], [.5, 0, -.5], [.5, 0, .5], [-.5, 0, .5], [-.5, 1, -.5], [.5, 1, -.5], [.5, 1, .5], [-.5, 1, .5]];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  return e.map((i) => c[i]);
})();

/**
 * Art v3 §1: apartment walls as ONE instanced mesh + ONE edge line set (draw-call budget), with the per-wall
 * camera-facing cutaway (damped λ 6, hysteresis .25/.15): front walls drop to 0.12 m at 35 % opacity.
 * Rise-in (pStart) fade as before. Lidar/grid use the full-height geometry from room.ts (the cut is visual only).
 * Floor: v2 solid #0B0B10 + optional high-tier AA grid.
 */
export function RoomShell({ grid = false }: { grid?: boolean }) {
  const group = useRef<Group>(null);
  const floorMat = useRef<MeshStandardMaterial>(null);
  // Review r5 #2: the floor itself now extends FLOOR_SPAN m square (far past the camera frustum at p ≤ .2) and fades
  // to transparent with a radial alpha well outside the room, so there is no edge in frame and no second plane with
  // different shading. uv keeps the room footprint at 0..1 (baked AO stays aligned; ClampToEdge outside); uv1 spans
  // the whole plane and drives the alpha fade.
  const floorGeo = useMemo(() => {
    const g = new PlaneGeometry(FLOOR_SPAN, FLOOR_SPAN, 1, 1), pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2), uv1 = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      uv[i * 2] = x / ROOM.w + 0.5; uv[i * 2 + 1] = y / ROOM.d + 0.5;
      uv1[i * 2] = x / FLOOR_SPAN + 0.5; uv1[i * 2 + 1] = y / FLOOR_SPAN + 0.5;
    }
    g.setAttribute('uv', new BufferAttribute(uv, 2)); g.setAttribute('uv1', new BufferAttribute(uv1, 2));
    return g;
  }, []);
  const floorAlpha = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!, inner = (Math.hypot(ROOM.w, ROOM.d) / 2 + 1.5) / FLOOR_SPAN * 256;
    const grad = g.createRadialGradient(128, 128, inner, 128, 128, 128);
    grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#000');
    g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    const t = new CanvasTexture(c); t.channel = 1;
    return t;
  }, []);
  useEffect(() => () => { floorAlpha.dispose(); floorGeo.dispose(); }, [floorAlpha, floorGeo]);
  const camera = useThree((t) => t.camera);
  // Low tier has no realtime shadows: a floor AO texture baked offline from apartment.json (npm run bake:floor-ao).
  const [floorAO, setFloorAO] = useState<Texture | null>(null);
  useEffect(() => {
    if (grid) return;
    let live = true, t: Texture | null = null;
    new TextureLoader().loadAsync(asset('/textures/floor_ao.webp')).then((x) => { t = x; if (live) setFloorAO(x); else x.dispose(); }).catch(() => {});
    return () => { live = false; t?.dispose(); };
  }, [grid]);
  const gridMat = useMemo(() => new ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    uniforms: { uAlpha: { value: 0 } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uAlpha; varying vec3 vWorld;
      float line(vec2 p, float s){ vec2 c = p / s; vec2 g = abs(fract(c - .5) - .5) / fwidth(c); return 1. - min(min(g.x, g.y), 1.); }
      void main(){
        float a = max(line(vWorld.xz, .5) * .045, line(vWorld.xz, 1.) * .09);
        a *= 1. - smoothstep(6., 14., distance(cameraPosition, vWorld));
        a *= smoothstep(0., .6, min(4.9 - abs(vWorld.x), 3.4 - abs(vWorld.z)));
        a *= uAlpha; if (a < .002) discard;
        gl_FragColor = vec4(1., 1., 1., a);
        #include <colorspace_fragment>
      }`,
  }), []);
  const n = WALLS.length;
  const st = useMemo(() => WALLS.map(() => ({ front: false, h: 1, o: 1, k: -1 as number | undefined })), []);
  const { walls, alpha, edges, epos, ecol } = useMemo(() => {
    const geo = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const alpha = new InstancedBufferAttribute(new Float32Array(n).fill(0), 1);
    alpha.setUsage(DynamicDrawUsage);
    geo.setAttribute('aAlpha', alpha);
    const mat = new MeshStandardMaterial({ color: new Color(PAL.wall), roughness: 0.7, metalness: 0, envMapIntensity: 0.3, transparent: true });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aAlpha; varying float vAlpha;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vAlpha;').replace('#include <opaque_fragment>', 'diffuseColor.a *= vAlpha;\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey = () => 'wall-alpha';
    const walls = new InstancedMesh(geo, mat, n);
    walls.name = 'walls'; walls.receiveShadow = false; walls.castShadow = true; // v3 #7: the cut-away (translucent) south wall caught dithered VSM shadow = the dotted floor artifact at p .15 walls.frustumCulled = false;
    walls.instanceMatrix.setUsage(DynamicDrawUsage);
    const epos = new Float32Array(n * 24 * 3), ecol = new Float32Array(n * 24 * 4);
    const eg = new BufferGeometry();
    eg.setAttribute('position', new BufferAttribute(epos, 3).setUsage(DynamicDrawUsage));
    eg.setAttribute('color', new BufferAttribute(ecol, 4).setUsage(DynamicDrawUsage));
    const edges = new LineSegments(eg, new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    edges.name = 'wall_edges'; edges.frustumCulled = false;
    return { walls, alpha, edges, epos, ecol };
  }, [n]);
  useEffect(() => () => { walls.geometry.dispose(); (walls.material as MeshStandardMaterial).dispose(); edges.geometry.dispose(); (edges.material as LineBasicMaterial).dispose(); }, [walls, edges]);
  const m4 = useMemo(() => new Matrix4(), []), sc = useMemo(() => new Vector3(), []), ps = useMemo(() => new Vector3(), []);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.visible = S.p <= 0.9;
    const cx = camera.position.x, cz = camera.position.z;
    WALLS.forEach((w, i) => {
      const s = st[i];
      // Facing: wall normal toward the camera side (interior walls take the camera-side sign).
      const vx = cx - w.x, vz = cz - w.z, len = Math.hypot(vx, vz) || 1;
      let nx = w.nx, nz = w.nz;
      if (!w.exterior && nx * vx + nz * vz < 0) { nx = -nx; nz = -nz; }
      const facing = (nx * vx + nz * vz) / len;
      const th = s.front ? 0.15 : 0.25;
      const between = w.exterior ? true : segHitsWall(cx, cz, robotPose.x, robotPose.z, w);
      s.front = facing > th && between;
      const h0 = s.h;
      s.h = MathUtils.damp(s.h, s.front ? CUT_H / w.h : 1, LAMBDA, dt);
      s.o = MathUtils.damp(s.o, s.front ? CUT_O : 1, LAMBDA, dt);
      const rise = smoothstep(w.pStart, w.pStart + 0.08, S.p);
      // Review home-r4 #5: a cut-away front wall standing on a floor that hasn't faded in yet read as a hard dark band
      // at the bottom of the frame (p .15). Front walls follow the floor's opacity, so the edge fades in with the floor.
      // r5 #2: the cut-away exterior front wall's top read as a dark strip across the frame at p ≤ .2; hide it until .3.
      const a = rise * s.o * (s.front ? S.roomOpacity : 1) * (s.front && w.exterior ? smoothstep(0.2, 0.3, S.p) : 1);
      const key = s.h * Math.max(rise, 0.001);
      if (Math.abs(key - (s.k ?? -1)) > 0.002) { s.k = key; markShadowDirty(); }
      void h0;
      alpha.setX(i, a);
      m4.compose(ps.set(w.x, 0, w.z), walls.quaternion, sc.set(w.w, w.h * s.h * Math.max(rise, 0.001), w.d));
      walls.setMatrixAt(i, m4);
      for (let k = 0; k < 24; k++) {
        const [ex, ey, ez] = EDGE[k], o = (i * 24 + k);
        epos[o * 3] = w.x + ex * w.w; epos[o * 3 + 1] = ey * w.h * s.h * rise + 0.002; epos[o * 3 + 2] = w.z + ez * w.d;
        ecol[o * 4] = ecol[o * 4 + 1] = ecol[o * 4 + 2] = 1; ecol[o * 4 + 3] = 0.2 * a;
      }
    });
    alpha.needsUpdate = true; walls.instanceMatrix.needsUpdate = true;
    edges.geometry.attributes.position.needsUpdate = true; edges.geometry.attributes.color.needsUpdate = true;
    walls.visible = S.p > 0.07;
    if (floorMat.current) {
      floorMat.current.opacity = S.roomOpacity;
      floorMat.current.visible = S.roomOpacity > 0.001;
    }
    gridMat.uniforms.uAlpha.value = S.roomOpacity * (1 - smoothstep(0.6, 0.8, S.p));
  });
  return (
    <group ref={group} name="room_shell">
      <mesh name="floor" rotation-x={-Math.PI / 2} receiveShadow geometry={floorGeo}>
        <meshStandardMaterial ref={floorMat} color={PAL.floor} roughness={0.82} metalness={0} envMapIntensity={0.25} transparent alphaMap={floorAlpha} aoMap={floorAO} aoMapIntensity={1} />
      </mesh>
      {grid && (
        <mesh name="floor_grid" rotation-x={-Math.PI / 2} position-y={0.001} material={gridMat}>
          <planeGeometry args={[ROOM.w, ROOM.d]} />
        </mesh>
      )}
      <primitive object={walls} />
      <primitive object={edges} />
    </group>
  );
}
