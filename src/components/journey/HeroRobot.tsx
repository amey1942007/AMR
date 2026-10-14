'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { tween } from '@/lib/tween';
import { Box3, CanvasTexture, Frustum, Sphere, type Camera, Group, MathUtils, Matrix4, Mesh, Vector3, type Material, type Object3D, type Texture } from 'three';
import { StandInRobot } from './StandInRobot';
import { loadModel } from './robotLoader';
import { Trail } from './Trail';
import { CAPTURE, S } from '@/lib/scene-state';
import { mergeByMaterialAsync } from '@/lib/merge-async';
import { pathLength, poseAt, robotU, ROUTE, WHEEL_R } from '@/lib/path';
import { initMotion, mecanumWheels, shouldSnap, SNAP_GAP, stepMotion } from '@/lib/robot-motion';
import { smoothstep } from '@/lib/monotone';
import { useScene, robotPose, robotScreen, lidarWorld } from '@/lib/store';
import { asset } from '@/lib/asset';
import { HERO_MODEL } from '@/lib/robot-nodes';

const _fr = new Frustum(), _m4 = new Matrix4(), _sph = new Sphere(new Vector3(), 0.6);
/** True when the robot (a 0.6 m sphere) at arc length s is outside the camera frustum. */
function offCamera(camera: Camera, s: number) {
  const p = ROUTE.at(s);
  _sph.center.set(p.x, 0.3, p.z);
  _fr.setFromProjectionMatrix(_m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return !_fr.intersectsSphere(_sph);
}

const WHEEL_NAMES = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'];

const rmQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/**
 * GLB nodes may carry their origin at the robot root, so spinning them would orbit the robot. Insert a pivot
 * group at the head's own vertical axis (bbox centre in x/z) and spin that instead: the head turns in place.
 */
function pivotOnAxis(node: Object3D): Object3D {
  if (node.parent?.name === 'lidar_top_pivot') return node.parent;
  const parent = node.parent;
  if (!parent) return node;
  node.updateWorldMatrix(true, true);
  const box = new Box3().setFromObject(node);
  const c = parent.worldToLocal(box.getCenter(new Vector3()));
  const pivot = new Group();
  pivot.name = 'lidar_top_pivot';
  pivot.position.set(c.x, node.position.y, c.z);
  parent.add(pivot);
  node.position.sub(new Vector3(c.x, node.position.y, c.z));
  pivot.add(node);
  return pivot;
}

/** Disposes every geometry, material and texture under o (lo GLB after the hi swap). */
export function disposeTree(o: Object3D) {
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    m.geometry.dispose();
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as Material[]) {
      for (const v of Object.values(mat)) if (v && (v as Texture).isTexture) (v as Texture).dispose();
      mat.dispose();
    }
  });
}

/** Subtrees that move or are looked up by name stay separate; everything else is static and can be merged. */
const KEEP = new Set([...WHEEL_NAMES, 'lidar_top', 'camera_pan', 'camera_tilt', 'accent_strip']);

/**
 * Draw budget: merge the robot's static meshes into one mesh per material (o-local space), sliced off the main thread
 * budget. Wheels, the lidar head and other named moving parts are left untouched. Casts only: under VSM a receiver
 * is also drawn into the shadow map, and the robot's self-shadowing is invisible at this scale.
 */
async function prep(o: Object3D) {
  o.updateMatrixWorld(true);
  const inv = new Matrix4().copy(o.matrixWorld).invert();
  const tmp = new Group(), victims: Mesh[] = [];
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh || Array.isArray(m.material)) return;
    for (let n: Object3D | null = m; n && n !== o; n = n.parent) if (KEEP.has(n.name)) return;
    const k = new Mesh(m.geometry, m.material);
    new Matrix4().multiplyMatrices(inv, m.matrixWorld).decompose(k.position, k.quaternion, k.scale);
    tmp.add(k); victims.push(m);
  });
  if (victims.length > 1) {
    const merged = await mergeByMaterialAsync(tmp);
    merged.name = 'robot_static';
    for (const v of victims) { v.removeFromParent(); v.geometry.dispose(); } // data was copied into the merge
    o.add(merged);
  }
  o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; /* baked static map: robot grounded by blob + N8AO */ } });
  return o;
}
function setOpacity(o: Object3D, a: number) {
  o.traverse((c) => {
    const m = c as Mesh;
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach((mat: Material) => {
      mat.transparent = a < 1; mat.opacity = a; mat.depthWrite = a > 0.5;
    });
  });
}

/** Robot: lo GLB → (high tier) hi GLB cross-dissolve; stand-in if files are missing. Drives the path (M3). */
/** Low tier has no shadow maps: a static radial blob grounds the robot (replaces drei ContactShadows, whose
 *  per-frame depth pass leaked a dithered wedge below the south wall at p .15, review v3 #7). */
function Blob() {
  const tex = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return new CanvasTexture(c);
  }, []);
  useEffect(() => () => tex?.dispose(), [tex]);
  if (!tex) return null;
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.004} renderOrder={1}>
      <planeGeometry args={[0.9, 1.0]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

export function HeroRobot({ tier, allowHi }: { tier: 'high' | 'low'; allowHi: boolean }) {
  const { gl, camera, size, scene } = useThree();
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const [model, setModel] = useState<Object3D | null>(null);
  const [prev, setPrev] = useState<Object3D | null>(null);
  const [ready, setReady] = useState(false);
  const nodes = useRef<{ wheels: Object3D[]; lidar: Object3D | null }>({ wheels: [], lidar: null });
  const st = useRef({ idle: 0, lastX: poseAt(0).x, lastZ: poseAt(0).z, speed: 0, lastPub: 0, lidarW: 0, u: 0, started: false, motion: initMotion(ROUTE, 0) });
  const tmp = useMemo(() => new Vector3(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const lo = await loadModel(gl, asset(HERO_MODEL.lo));
      if (!alive) return;
      if (lo) { const p = await prep(lo); if (!alive) return; setModel(p); useScene.setState({ robotSource: 'lo' }); }
      setReady(true);
      if (!allowHi || tier !== 'high') return;
      await new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 1500)));
      const hi = await loadModel(gl, asset(HERO_MODEL.hi));
      if (!alive || !hi) return;
      const ph = await prep(hi);
      if (!alive) return;
      setModel((old) => { setPrev(old); return ph; });
      useScene.setState({ robotSource: 'hi' });
    })();
    return () => { alive = false; };
  }, [gl, tier, allowHi]);

  // Resolve named nodes on the active model (stand-in or GLB share names).
  useEffect(() => {
    const src = body.current;
    if (!src) return;
    const find = (n: string) => src.getObjectByName(n) ?? null;
    // Spin target = the lidar_top head only. If (old GLB) lidar_top wraps lidar_base, don't spin anything.
    const top = find('lidar_top');
    const safe = top && !top.getObjectByName('lidar_base') && !top.getObjectByName('chassis') ? top : null;
    nodes.current = { wheels: WHEEL_NAMES.map(find).filter(Boolean) as Object3D[], lidar: safe ? pivotOnAxis(safe) : null };
  }, [model, ready]);

  // Arrival: fade/rise 1200 ms power3.out. Hi model: 400 ms cross-dissolve.
  useEffect(() => {
    if (!ready || !body.current) return;
    const b = body.current;
    const o = { a: 0 };
    b.position.y = -0.2;
    setOpacity(b, 0);
    let kill: (() => void) | null = null, alive = true;
    // Compile the robot's programs before the reveal so the fade-in never hitches.
    gl.compileAsync(scene, camera).catch(() => {}).finally(() => {
      if (!alive) return;
      kill = tween(1.2, 'power3.out', (a) => { o.a = a; setOpacity(b, a); b.position.y = -0.2 * (1 - a); });
    });
    return () => { alive = false; kill?.(); };
  }, [ready, gl, scene, camera]);
  useEffect(() => {
    if (!prev || !model) return;
    const o = { a: 0 };
    // Hi stays fully opaque underneath; only lo fades out on top (no X-ray look from two half-transparent meshes).
    setOpacity(model, 1);
    const kill = tween(0.4, 'none', (a) => { o.a = a; setOpacity(prev, 1 - a); }, () => setPrev(null));
    return () => { kill(); };
  }, [prev, model]);
  // Review #13: once the lo model has faded out (prev → null) or on unmount, free its geometry, materials, textures.
  useEffect(() => (prev ? () => disposeTree(prev) : undefined), [prev]);

  useFrame(({ camera }, dt) => {
    const r = root.current;
    if (!r) return;
    dt = Math.min(dt, 0.1);
    const s = st.current;
    // Physical motion (lib/robot-motion): scroll only sets the TARGET arc length; the robot chases it with speed,
    // accel, curvature and yaw-rate limits, so fast scrolls become a smooth catch-up. Hidden (p > .92), capture mode
    // and reduced motion snap instead (nothing to animate there).
    const L = pathLength(), m = s.motion;
    const target = S.uDrive * L;
    const snap = s.started && Math.abs(target - m.s) >= SNAP_GAP && shouldSnap(target - m.s, S.uDrive, offCamera(camera, m.s) && offCamera(camera, target));
    if (CAPTURE || rmQuery?.matches || S.p > 0.92 || !s.started || snap) { Object.assign(m, initMotion(ROUTE, target)); s.started = true; }
    else stepMotion(m, target, dt, ROUTE);
    s.u = m.s / L;
    robotU.value = s.u;
    const pose = ROUTE.at(m.s);
    // Idle turntable 0.08 rad/s that eases back to heading by p .08.
    s.idle = MathUtils.euclideanModulo(s.idle + 0.08 * dt + Math.PI, Math.PI * 2) - Math.PI;
    const idleW = 1 - smoothstep(0, 0.08, S.p);
    r.position.set(pose.x, 0, pose.z);
    r.rotation.y = m.yaw + s.idle * idleW;
    r.visible = S.p <= 0.92;
    // Wheels from the ACTUAL planar motion (mecanum inverse kinematics: strafing counter-rotates diagonal pairs).
    const vx = dt > 0 ? (pose.x - s.lastX) / dt : 0, vz = dt > 0 ? (pose.z - s.lastZ) / dt : 0;
    s.lastX = pose.x; s.lastZ = pose.z;
    const wheel = mecanumWheels(vx, vz, m.yaw, m.w, WHEEL_R);
    nodes.current.wheels.forEach((w, i) => { w.rotation.x += wheel[i] * dt; });
    s.speed = Math.abs(m.v);
    // Lidar: ONLY the `lidar_top` head turns, about its own local Y (rotateY), never lidar_base or a parent.
    // A real 2D lidar spins 5–10 Hz; shown slowed (~1.2 rev/s driving, 0.25 idle) with an eased spin-up/down.
    const lid = nodes.current.lidar;
    if (lid) {
      const target = rmQuery?.matches ? 0 : Math.PI * 2 * (s.speed > 0.02 ? 1.2 : 0.25);
      s.lidarW += (target - s.lidarW) * (1 - Math.exp(-dt / 0.6));
      lid.rotateY(s.lidarW * dt);
    }
    robotPose.x = pose.x; robotPose.z = pose.z; robotPose.yaw = r.rotation.y;
    (nodes.current.lidar ?? r).getWorldPosition(tmp);
    lidarWorld.x = tmp.x; lidarWorld.y = tmp.y; lidarWorld.z = tmp.z;
    tmp.set(pose.x, 0.15, pose.z).project(camera);
    robotScreen.visible = tmp.z < 1 && Math.abs(tmp.x) < 1.05 && Math.abs(tmp.y) < 1.05;
    robotScreen.x = (tmp.x * 0.5 + 0.5) * size.width;
    robotScreen.y = (-tmp.y * 0.5 + 0.5) * size.height;
    const now = performance.now();
    if (now - s.lastPub > 100) { s.lastPub = now; useScene.setState({ speed: Math.round(s.speed * 100) / 100 }); }
  });

  return (
    <>
      <group ref={root} name="robot">
        <group ref={body}>
          {ready && (model ? <primitive object={model} /> : <StandInRobot />)}
          {prev && <primitive object={prev} />}
        </group>
        <Blob />
      </group>
      <Trail />
    </>
  );
}
