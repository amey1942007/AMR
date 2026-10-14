'use client';
import { useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Color, InstancedBufferAttribute, InstancedBufferGeometry, PlaneGeometry, ShaderMaterial, TextureLoader } from 'three';
import { S } from '@/lib/scene-state';
import { tokens } from '@/lib/tokens';
import { asset } from '@/lib/asset';

/**
 * Billboard cloud sprites (self-generated CC0-free sprite, own work). R = density, G = dissolve noise.
 * Opacity 0→1 (.62–.72), colour dark→light (.78–.90), noise-threshold dissolve (.86–.98).
 */
export function CloudDeck({ count = 8, segments = 20 }: { count?: number; segments?: number }) {
  const tex = useLoader(TextureLoader, asset('/img/clouds/cloud.webp'));
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
        sc[i] = 9 + rnd() * 9; rot[i] = rnd() * Math.PI * 2;
      }
    }
    const base = new PlaneGeometry(1, 1);
    const geo = new InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
    geo.setAttribute('aOff', new InstancedBufferAttribute(off, 3));
    geo.setAttribute('aScale', new InstancedBufferAttribute(sc, 1));
    geo.setAttribute('aRot', new InstancedBufferAttribute(rot, 1));
    geo.instanceCount = n;
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { uTex: { value: tex }, uOpacity: { value: 0 }, uDissolve: { value: 0 }, uDark: { value: new Color(tokens['cloud-dark']) }, uLight: { value: new Color(tokens['cloud-light']) }, uLightMix: { value: 0 } },
      vertexShader: `attribute vec3 aOff; attribute float aScale; attribute float aRot; varying vec2 vUv; varying float vShade;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(aOff, 1.);
          float c = cos(aRot), s = sin(aRot); vec2 p = mat2(c,-s,s,c) * position.xy * aScale;
          mv.xy += p; vShade = .75 + .25 * (position.y + .5); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uOpacity; uniform float uDissolve; uniform vec3 uDark; uniform vec3 uLight; uniform float uLightMix;
        varying vec2 vUv; varying float vShade;
        void main(){ vec4 t = texture2D(uTex, vUv); float a = t.r * uOpacity;
          a *= smoothstep(uDissolve, uDissolve + .18, t.g * .82 + .18 * t.r);
          if (a < .003) discard; vec3 col = mix(uDark, uLight, uLightMix) * vShade;
          gl_FragColor = vec4(col, a * .85); #include <colorspace_fragment> }`,
    });
    return { geo, mat };
  }, [tex, count, segments]);
  useFrame(() => {
    mat.uniforms.uOpacity.value = S.cloudOpacity;
    mat.uniforms.uLightMix.value = S.cloudLight;
    mat.uniforms.uDissolve.value = S.cloudDissolve * 1.05;
  });
  return <mesh geometry={geo} material={mat} frustumCulled={false} visible renderOrder={5} />;
}
