'use client';
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { Object3D } from 'three';

/**
 * Shader warm-up (KHR_parallel_shader_compile via three's compileAsync): once the robot is in, compile every material
 * in the scene — including currently hidden sky/cloud/lidar objects — during idle so the first scroll never hitches.
 */
export function Warmup({ after }: { after: boolean }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!after) return;
    const run = () => {
      const hidden: Object3D[] = [];
      scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
      const pending = gl.compileAsync(scene, camera); // programs are collected synchronously here
      hidden.forEach((o) => (o.visible = false));
      pending.catch(() => {});
    };
    const id = window.setTimeout(() => {
      if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 }); else run();
    }, 300);
    return () => clearTimeout(id);
  }, [after, gl, scene, camera]);
  return null;
}
