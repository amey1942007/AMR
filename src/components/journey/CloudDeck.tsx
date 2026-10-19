'use client';
import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, InstancedBufferAttribute, InstancedBufferGeometry, LinearFilter, LinearMipmapLinearFilter, PlaneGeometry, ShaderMaterial, type Texture } from 'three';
import { getKTX2 } from './robotLoader';
import { S } from '@/lib/scene-state';
import { tokens } from '@/lib/tokens';
import { asset } from '@/lib/asset';

/**
 * Billboard cloud sprites (self-generated CC0-free sprite, own work). R = density, G = dissolve noise.
 * Opacity 0→1 (.62–.72), colour dark→light (.78–.90), noise-threshold dissolve (.86–.98).
 */
export function CloudDeck({ count = 8, segments = 16, low = false }: { count?: number; segments?: number; low?: boolean }) {
  // v3 §5.2: 2048² RG sprite (UASTC KTX2, mipmapped), shared Basis transcoder. Nothing renders until it arrives.
  const { gl, clock } = useThree();
  const [tex, setTex] = useState<Texture | null>(null);
  useEffect(() => {
    let live = true;
    getKTX2(gl).loadAsync(asset('/textures/clouds/cloud_sprite_2048.ktx2')).then((t) => {
      t.minFilter = LinearMipmapLinearFilter; t.magFilter = LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
      if (live) setTex(t); else t.dispose();
    }).catch(() => {});
    return () => { live = false; };
  }, [gl]);
  useEffect(() => () => tex?.dispose(), [tex]);
  const { geo, mat } = useMemo(() => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const n = count * segments;
    const off = new Float32Array(n * 3), sc = new Float32Array(n), rot = new Float32Array(n);
    for (let c = 0; c < count; c++) {
      const ang = (c / count) * Math.PI * 2 + rnd(), rad = 4 + rnd() * 21;
      const cx = Math.cos(ang) * rad, cz = Math.sin(ang) * rad, cy = 18 + (c / Math.max(1, count - 1)) * 27;
      for (let s = 0; s < segments; s++) {
        const i = c * segments + s;
        off.set([cx + (rnd() - 0.5) * 30, cy + (rnd() - 0.5) * 4, cz + (rnd() - 0.5) * 30], i * 3);
        sc[i] = 11 + rnd() * 11; rot[i] = rnd() * Math.PI * 2;
      }
    }
    const base = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    geo.setAttribute('aOff', new InstancedBufferAttribute(off, 3));
    geo.setAttribute('aScale', new InstancedBufferAttribute(sc, 1));
    geo.setAttribute('aRot', new InstancedBufferAttribute(rot, 1));
    geo.instanceCount = n;
    base.dispose(); // attributes were copied by reference; the base wrapper itself is no longer needed
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      defines: low ? { LOW: '' } : {},
      uniforms: { uTime: { value: 0 }, uRim: { value: new Color(tokens['cloud-rim']) }, uGlow: { value: new Color(tokens.magenta ?? '#E81CB0') }, uTex: { value: tex }, uOpacity: { value: 0 }, uDissolve: { value: 0 }, uDark: { value: new Color(tokens['cloud-dark']) }, uLight: { value: new Color(tokens['cloud-light']) }, uLightMix: { value: 0 } },
      vertexShader: `attribute vec3 aOff; attribute float aScale; attribute float aRot; uniform float uTime;
        varying vec2 vUv; varying float vShade; varying float vNear; varying float vLow;
        void main(){ vUv = uv; vec3 o = aOff; float r = aRot;
          #ifndef LOW
          o.x += sin(uTime * .05 + aRot) * .6; o.z += cos(uTime * .04 + aRot) * .6; r += uTime * .01;
          #endif
          vec4 mv = modelViewMatrix * vec4(o, 1.);
          float c = cos(r), s = sin(r); vec2 p = mat2(c,-s,s,c) * position.xy * aScale;
          mv.xy += p; vShade = .62 + .38 * (position.y + .5);
          vNear = smoothstep(2., 8., -mv.z); vLow = step(aOff.y, 25.);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOpacity; uniform float uDissolve; uniform vec3 uDark; uniform vec3 uLight; uniform float uLightMix; uniform vec3 uRim; uniform vec3 uGlow;
        varying vec2 vUv; varying float vShade; varying float vNear; varying float vLow;
        void main(){ vec4 t = texture2D(uTex, vUv); float a = pow(t.r, 1.35) * uOpacity * .70;
          a *= smoothstep(0., .25, t.r) * vNear;
          a *= smoothstep(uDissolve, uDissolve + .24, t.g * .76 + .24 * t.r);
          if (a < .003) discard; vec3 col = mix(uDark, uLight, uLightMix) * vShade;
          #ifndef LOW
          col = mix(col, uRim, pow(1. - t.r, 2.) * .35);
          col += uGlow * .06 * vLow;
          #endif
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    return { geo, mat };
  }, [tex, count, segments, low]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);
  useFrame(() => {
    // LOW shader already freezes drift; skip the time uniform so we don't dirty GPU state every frame.
    if (!low) mat.uniforms.uTime.value = clock.getElapsedTime();
    mat.uniforms.uOpacity.value = S.cloudOpacity;
    mat.uniforms.uLightMix.value = S.cloudLight;
    mat.uniforms.uDissolve.value = S.cloudDissolve * 1.05;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} visible={!!tex} renderOrder={5} />;
}
