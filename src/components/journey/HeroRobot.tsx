'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import gsap from 'gsap';
import { MathUtils, Vector3, type Group, type Material, type Mesh, type Object3D } from 'three';
import { StandInRobot } from './StandInRobot';
import { loadModel } from './robotLoader';
import { Trail } from './Trail';
import { Warmup } from './Warmup';
import { S } from '@/lib/scene-state';
import { poseAt, WHEEL_R } from '@/lib/path';
import { smoothstep } from '@/lib/monotone';
import { useScene, robotPose, robotScreen, lidarWorld } from '@/lib/store';
import { asset } from '@/lib/asset';
import { HERO_MODEL } from '@/lib/robot-nodes';

const WHEEL_NAMES = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'];

function prep(o: Object3D) {
  o.traverse((c) => { const m = c as Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
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
export function HeroRobot({ tier, allowHi, contactShadows }: { tier: 'high' | 'low'; allowHi: boolean; contactShadows: boolean }) {
  const { gl, camera, size, scene } = useThree();
  const [warm, setWarm] = useState(false);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const [model, setModel] = useState<Object3D | null>(null);
  const [prev, setPrev] = useState<Object3D | null>(null);
  const [ready, setReady] = useState(false);
  const nodes = useRef<{ wheels: Object3D[]; lidar: Object3D | null }>({ wheels: [], lidar: null });
  const st = useRef({ yaw: poseAt(0).yaw, idle: 0, lastX: poseAt(0).x, lastZ: poseAt(0).z, speed: 0, lastPub: 0 });
  const tmp = useMemo(() => new Vector3(), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const lo = await loadModel(gl, asset(HERO_MODEL.lo));
      if (!alive) return;
      if (lo) { setModel(prep(lo)); useScene.setState({ robotSource: 'lo' }); }
      setReady(true);
      if (!allowHi || tier !== 'high') return;
      await new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 1500)));
      const hi = await loadModel(gl, asset(HERO_MODEL.hi));
      if (!alive || !hi) return;
      setModel((old) => { setPrev(old); return prep(hi); });
      useScene.setState({ robotSource: 'hi' });
    })();
    return () => { alive = false; };
  }, [gl, tier, allowHi]);

  // Resolve named nodes on the active model (stand-in or GLB share names).
  useEffect(() => {
    const src = body.current;
    if (!src) return;
    const find = (n: string) => src.getObjectByName(n) ?? null;
    nodes.current = { wheels: WHEEL_NAMES.map(find).filter(Boolean) as Object3D[], lidar: find('lidar_top') };
  }, [model, ready]);

  // Arrival: fade/rise 1200 ms power3.out. Hi model: 400 ms cross-dissolve.
  useEffect(() => {
    if (!ready || !body.current) return;
    const b = body.current;
    const o = { a: 0 };
    b.position.y = -0.2;
    setOpacity(b, 0);
    let tw: gsap.core.Tween | null = null, alive = true;
    // Compile the robot's programs before the reveal so the fade-in never hitches.
    gl.compileAsync(scene, camera).catch(() => {}).finally(() => {
      if (!alive) return;
      tw = gsap.to(o, { a: 1, duration: 1.2, ease: 'power3.out', onUpdate: () => { setOpacity(b, o.a); b.position.y = -0.2 * (1 - o.a); }, onComplete: () => setWarm(true) });
    });
    return () => { alive = false; tw?.kill(); };
  }, [ready, gl, scene, camera]);
  useEffect(() => {
    if (!prev || !model) return;
    const o = { a: 0 };
    const tw = gsap.to(o, { a: 1, duration: 0.4, ease: 'none', onUpdate: () => { setOpacity(model, o.a); setOpacity(prev, 1 - o.a); }, onComplete: () => setPrev(null) });
    return () => { tw.kill(); };
  }, [prev, model]);

  useFrame((_, dt) => {
    const r = root.current;
    if (!r) return;
    dt = Math.min(dt, 0.1);
    const s = st.current;
    const pose = poseAt(S.uDrive);
    // Idle turntable 0.08 rad/s that eases back to heading by p .08.
    s.idle = MathUtils.euclideanModulo(s.idle + 0.08 * dt + Math.PI, Math.PI * 2) - Math.PI;
    const idleW = 1 - smoothstep(0, 0.08, S.p);
    let d = pose.yaw - s.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    s.yaw = S.uDrive > 0 ? s.yaw + d * (1 - Math.exp(-6 * dt)) : pose.yaw;
    r.position.set(pose.x, 0, pose.z);
    r.rotation.y = s.yaw + s.idle * idleW;
    r.visible = S.p <= 0.92;
    // Speed (m/s) from motion; wheels + lidar spin.
    const dist = Math.hypot(pose.x - s.lastX, pose.z - s.lastZ);
    s.lastX = pose.x; s.lastZ = pose.z;
    s.speed = MathUtils.damp(s.speed, dt > 0 ? dist / dt : 0, 5, dt);
    for (const w of nodes.current.wheels) w.rotation.x += (s.speed / WHEEL_R) * dt;
    if (nodes.current.lidar) nodes.current.lidar.rotation.y += (S.uDrive > 0 && S.uDrive < 1 ? Math.PI * 2 * 10 : 0.6) * dt;
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
        {contactShadows && <ContactShadows opacity={0.55} blur={2.4} scale={2.5} resolution={512} far={0.6} frames={Infinity} />}
      </group>
      <Trail />
      <Warmup after={warm} />
    </>
  );
}
