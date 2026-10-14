'use client';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BackSide, BufferAttribute, BufferGeometry, Color, type Group, type PointsMaterial, ShaderMaterial } from 'three';
import { S } from '@/lib/scene-state';
import { tokens } from '@/lib/tokens';

/** Gradient sky sphere (horizon → zenith, 1/255 dither against banding) + 600 faint stars. Follows the camera. */
export function SkyDome({ stars = 600 }: { stars?: number }) {
  const g = useRef<Group>(null);
  const { camera } = useThree();
  const mat = useMemo(() => new ShaderMaterial({
    side: BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uZen: { value: new Color(tokens['sky-zenith']) }, uHor: { value: new Color(tokens['sky-horizon']) }, uRoom: { value: new Color(tokens['bg-room']) }, uMix: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uRoom; uniform float uMix; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){ float t = smoothstep(-0.05, 0.6, vDir.y); vec3 sky = mix(uHor, uZen, t);
        vec3 c = mix(uRoom, sky, uMix) + (h(gl_FragCoord.xy) - .5) / 255.;
        gl_FragColor = vec4(c, uMix);
          #include <colorspace_fragment>
        }`,
  }), []);
  const starGeo = useMemo(() => {
    const a = new Float32Array(stars * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < stars; i++) {
      const th = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y);
      a.set([Math.cos(th) * r * 280, y * 280, Math.sin(th) * r * 280], i * 3);
    }
    const geo = new BufferGeometry(); geo.setAttribute('position', new BufferAttribute(a, 3)); return geo;
  }, [stars]);
  // Review #13: memoised GPU objects passed by prop are not auto-disposed by R3F.
  useEffect(() => () => mat.dispose(), [mat]);
  useEffect(() => () => starGeo.dispose(), [starGeo]);
  const starMat = useRef<PointsMaterial>(null);
  useFrame(() => {
    if (!g.current) return;
    g.current.position.copy(camera.position);
    g.current.visible = S.skyMix > 0.001;
    mat.uniforms.uMix.value = S.skyMix;
    if (starMat.current) starMat.current.opacity = S.stars;
  });
  return (
    <group ref={g} visible={false}>
      <mesh material={mat} renderOrder={-10} frustumCulled={false}><sphereGeometry args={[300, 32, 16]} /></mesh>
      <points geometry={starGeo} renderOrder={-9} frustumCulled={false}>
        <pointsMaterial ref={starMat} color="white" size={1.5} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
      </points>
    </group>
  );
}
