'use client';
import { registerWarm } from './Warmup';
import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color, CustomBlending, Data3DTexture, DataTexture, GLSL3, HalfFloatType, LinearFilter, Matrix4, Mesh, NearestFilter, OneFactor,
  OneMinusSrcAlphaFactor, OrthographicCamera, PlaneGeometry, RedFormat, RepeatWrapping, Scene, ShaderMaterial, UnsignedByteType,
  Vector2, Vector3, WebGLRenderTarget, type PerspectiveCamera, type Texture,
} from 'three';
import { S } from '@/lib/scene-state';
import { tokens } from '@/lib/tokens';
import { asset } from '@/lib/asset';
import { blueNoise } from '@/lib/bluenoise';
import { decodeInWorker } from '@/lib/decode-client';
import { getKTX2 } from './robotLoader';

/**
 * Art v3 §5.1: raymarched cloud slab (x/z ±60 m, y 18–45 m), high tier and desktop only.
 * Noise: shape = cloud_shape_128_atlas16x8.ktx2 (a 2-D atlas of 128 z-slices, sampled with linear blending between
 * neighbouring slices), detail = cloud_detail_32.ktx2 (a real 3-D texture), jitter = a 64×64 blue-noise tile made in
 * code (decode worker). Pipeline per frame (only for p .60–.99):
 *   1. march → half-res target (48 steps + 6 light steps, Beer–Powder, dual HG, blue-noise + golden-ratio jitter)
 *   2. temporal resolve → ping-pong history: reproject the previous frame at the slab mid-depth, clamp the history
 *      to the current 3×3 neighbourhood min/max, blend 0.12 new / 0.88 history; reset when the camera jumps > 2 m
 *   3. premultiplied composite quad (renderOrder 6), depth-aware (joint-bilateral) upscale guided by the hit depth
 * The CloudDeck sprites are rendered by JourneyCanvas on low tier / mobile, and here until the textures arrive.
 */
const VERT = 'out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const RAY = /* glsl */ `
uniform mat4 uInvProj, uInvView; uniform vec3 uCam;
vec3 rayDir(vec2 uv){ vec4 v = uInvProj * vec4(uv * 2. - 1., 1., 1.); v /= v.w; return normalize((uInvView * vec4(v.xyz, 0.)).xyz); }
bool slab(vec3 ro, vec3 rd, out float t0, out float t1){
  if (abs(rd.y) < 1e-4) { t0 = 0.; t1 = 400.; return ro.y > 18. && ro.y < 45.; }
  float a = (18. - ro.y) / rd.y, b = (45. - ro.y) / rd.y; t0 = max(min(a, b), 0.); t1 = min(max(a, b), 400.); return t1 > t0; }`;
const MARCH = /* glsl */ `
precision highp float; precision highp sampler3D;
${RAY}
uniform sampler2D uShape, uBlue; uniform sampler3D uDetail;
uniform vec3 uSun, uDark, uLight, uRim, uGlow; uniform float uTime, uOpacity, uLightMix, uCoverage, uSteps, uFrame;
in vec2 vUv; layout(location = 0) out vec4 fragColor; layout(location = 1) out vec4 fragDepth;
float remap(float v, float a, float b, float c, float d){ return c + (v - a) / max(b - a, 1e-4) * (d - c); }
vec4 tile(float s, vec2 uv){
  uv = clamp(uv, .5 / 128., 1. - .5 / 128.);
  return texture(uShape, (vec2(mod(s, 16.), floor(s / 16.)) + uv) / vec2(16., 8.)); }
vec4 shape3(vec3 p){ p = fract(p); float z = p.z * 128. - .5, z0 = floor(z);
  return mix(tile(mod(z0, 128.), p.xy), tile(mod(z0 + 1., 128.), p.xy), z - z0); }
float hgt(float y){ return smoothstep(18., 22., y) * (1. - smoothstep(38., 45., y)); }
float density(vec3 p, bool detail){
  float h = hgt(p.y) * (1. - smoothstep(48., 60., max(abs(p.x), abs(p.z))));
  if (h <= 0.) return 0.;
  vec3 wind = vec3(.6, 0., .25) * uTime;
  // Review home-r4 #2: shape frequency raised (.018 → .034, ~30 m cells) so the deck reads as separate billows, not haze.
  vec4 n = shape3(p * .034 + wind * .034);
  float fbm = n.g * .625 + n.b * .25 + n.a * .125;
  float base = clamp(remap(n.r, fbm - 1., 1., 0., 1.), 0., 1.);
  float cov = clamp(uCoverage, 0., 1.);
  float d = clamp(remap(base * h, 1. - cov, 1., 0., 1.), 0., 1.);
  if (d <= 0. || !detail) return d * 1.6;
  vec3 dn = texture(uDetail, p * .16 + wind * .16 * 1.6).rgb;
  float e = (dn.r * .625 + dn.g * .25 + dn.b * .125) * .55 * (1. - d); // stronger detail erosion: crisp edges
  return clamp(remap(d, e, 1., 0., 1.), 0., 1.) * 1.6; }
float hg(float c, float g){ float g2 = g * g; return (1. - g2) / (12.566 * pow(1. + g2 - 2. * g * c, 1.5)); }
void main(){
  vec3 rd = rayDir(vUv), ro = uCam; float t0, t1;
  if (!slab(ro, rd, t0, t1)) { fragColor = vec4(0.); fragDepth = vec4(1.); return; }
  float steps = uSteps, ds = clamp((t1 - t0) / steps, .4, 2.5);
  float jit = fract(texture(uBlue, gl_FragCoord.xy / 64.).r + uFrame * .61803398875);
  float t = t0 + ds * jit, T = 1.; vec3 col = vec3(0.); float tw = 0., ws = 0.;
  float cosT = dot(rd, uSun), phase = mix(hg(cosT, -.2), hg(cosT, .35), .7);
  const float SIG = .9;
  for (int i = 0; i < 64; i++) {
    if (float(i) >= steps || t > t1 || T < .02) break;
    vec3 p = ro + rd * t; float d = density(p, true);
    if (d > .001) {
      float dl = 0.;
      for (int j = 1; j <= 6; j++) dl += density(p + uSun * (1.5 * float(j)), false);
      dl *= 1.5;
      float lightT = exp(-SIG * dl) * (1. - exp(-2. * SIG * dl)) * 2.;
      float hf = clamp((p.y - 18.) / 27., 0., 1.);
      vec3 amb = mix(uDark, mix(uDark, uLight, .6), hf); amb = mix(amb, uLight, uLightMix * .85);
      vec3 c = amb * .55 + vec3(.957, .945, 1.) * 1.2 * lightT * phase * 6.;
      c = mix(c, uRim, (1. - lightT) * .3 * (1. - d));
      if (p.y < 24.) c += uGlow * .06;
      float a = 1. - exp(-SIG * d * ds);
      col += T * a * c; tw += T * a * t; ws += T * a; T *= 1. - a;
    }
    t += ds;
  }
  fragColor = vec4(col * uOpacity, (1. - T) * uOpacity);
  fragDepth = vec4(ws > 1e-4 ? tw / ws / 400. : 1.); // transmittance-weighted hit depth (guide for the upscale)
}`;
const RESOLVE = /* glsl */ `
precision highp float;
${RAY}
uniform sampler2D uCur, uHist; uniform mat4 uPrevVP; uniform vec2 uTexel; uniform float uAlpha;
in vec2 vUv; out vec4 fragColor;
void main(){
  vec4 cur = texture(uCur, vUv), mn = cur, mx = cur;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec4 s = texture(uCur, vUv + vec2(x, y) * uTexel); mn = min(mn, s); mx = max(mx, s); }
  vec3 rd = rayDir(vUv); float t0, t1, a = uAlpha;
  vec3 pw = uCam + rd * (slab(uCam, rd, t0, t1) ? mix(t0, t1, .35) : 200.);
  vec4 pc = uPrevVP * vec4(pw, 1.); vec2 puv = pc.xy / pc.w * .5 + .5;
  if (pc.w <= 0. || any(lessThan(puv, vec2(0.))) || any(greaterThan(puv, vec2(1.)))) a = 1.;
  vec4 hist = clamp(texture(uHist, puv), mn, mx);
  fragColor = mix(hist, cur, a);
}`;
/**
 * Review home-r4 #2: depth-aware (joint-bilateral) upscale of the half-res clouds. Of the 4 low-res texels around the
 * pixel, each bilinear weight is scaled by how close its hit depth is to the nearest texel's depth, so a near billow
 * never smears over a far one / the sky behind it: silhouettes stay crisp instead of bilinear mush.
 */
const UPSCALE = /* glsl */ `
precision highp float;
uniform sampler2D uTex, uDepth; uniform vec2 uLow; in vec2 vUv; out vec4 fragColor;
void main(){
  vec2 f = vUv * uLow - .5, i0 = floor(f), fr = f - i0;
  vec2 o[4] = vec2[4](vec2(0., 0.), vec2(1., 0.), vec2(0., 1.), vec2(1., 1.));
  float bw[4] = float[4]((1. - fr.x) * (1. - fr.y), fr.x * (1. - fr.y), (1. - fr.x) * fr.y, fr.x * fr.y);
  float dRef = texture(uDepth, (i0 + floor(fr + .5) + .5) / uLow).r;
  vec4 acc = vec4(0.); float ws = 0.;
  for (int k = 0; k < 4; k++) {
    vec2 uv = (i0 + o[k] + .5) / uLow;
    float w = bw[k] * exp(-abs(texture(uDepth, uv).r - dRef) * 160.) + 1e-5;
    acc += texture(uTex, uv) * w; ws += w;
  }
  fragColor = acc / ws;
}`;

type Tex = { shape: Texture; detail: Data3DTexture; blue: DataTexture };

async function loadTextures(gl: Parameters<typeof getKTX2>[0]): Promise<Tex> {
  const k = getKTX2(gl);
  const blueJob = decodeInWorker<{ data: Uint8Array }>({ kind: 'bluenoise' });
  const [shape, detail, blueData] = await Promise.all([
    k.loadAsync(asset('/textures/clouds/cloud_shape_128_atlas16x8.ktx2')),
    k.loadAsync(asset('/textures/clouds/cloud_detail_32.ktx2')) as unknown as Promise<Data3DTexture>,
    blueJob ? blueJob.then((r) => r.data) : Promise.resolve(blueNoise(64)),
  ]);
  shape.minFilter = shape.magFilter = LinearFilter; shape.generateMipmaps = false; shape.needsUpdate = true;
  detail.wrapS = detail.wrapT = detail.wrapR = RepeatWrapping; detail.minFilter = detail.magFilter = LinearFilter; detail.needsUpdate = true;
  const blue = new DataTexture(blueData, 64, 64, RedFormat, UnsignedByteType);
  blue.wrapS = blue.wrapT = RepeatWrapping; blue.minFilter = blue.magFilter = NearestFilter; blue.needsUpdate = true;
  return { shape, detail, blue };
}

function quadScene(mat: ShaderMaterial) {
  const scene = new Scene(), m = new Mesh(new PlaneGeometry(2, 2), mat);
  m.frustumCulled = false; scene.add(m);
  return { scene, mesh: m };
}

export function CloudVolume({ steps = 48, onReady }: { steps?: number; onReady?: (ok: boolean) => void }) {
  const { gl, size, camera, clock } = useThree();
  const dpr = gl.getPixelRatio();
  const [tex, setTex] = useState<Tex | null>(null);
  useEffect(() => {
    let live = true;
    loadTextures(gl).then((t) => { if (live) { setTex(t); onReady?.(true); } else Object.values(t).forEach((x) => x.dispose()); })
      .catch((e) => { if (process.env.NODE_ENV !== 'production') console.warn('[CloudVolume] textures failed, sprite fallback', e); onReady?.(false); });
    return () => { live = false; };
  }, [gl, onReady]);
  useEffect(() => () => { if (tex) Object.values(tex).forEach((x) => x.dispose()); }, [tex]);

  const st = useMemo(() => {
    // Half-float needs EXT_color_buffer_(half_)float; fall back to 8-bit (premultiplied, still fine for clouds).
    const hf = gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float');
    const mk = (count = 1) => new WebGLRenderTarget(2, 2, { count, type: hf ? HalfFloatType : UnsignedByteType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    const cur = mk(2), hist = [mk(), mk()]; // cur: [0] colour, [1] hit depth
    cur.textures[1].minFilter = cur.textures[1].magFilter = NearestFilter;
    const ray = { uInvProj: { value: new Matrix4() }, uInvView: { value: new Matrix4() }, uCam: { value: new Vector3() } };
    const march = new ShaderMaterial({
      glslVersion: GLSL3, vertexShader: VERT, fragmentShader: MARCH, depthTest: false, depthWrite: false,
      uniforms: {
        ...ray, uShape: { value: null }, uDetail: { value: null }, uBlue: { value: null },
        uSun: { value: new Vector3(3, 5, 2).normalize() }, uTime: { value: 0 }, uOpacity: { value: 0 }, uLightMix: { value: 0 },
        uCoverage: { value: 0.55 }, uSteps: { value: steps }, uFrame: { value: 0 },
        uDark: { value: new Color(tokens['cloud-dark']) }, uLight: { value: new Color(tokens['cloud-light']) },
        uRim: { value: new Color(tokens['cloud-rim']) }, uGlow: { value: new Color('#E81CB0') },
      },
    });
    const resolve = new ShaderMaterial({
      glslVersion: GLSL3, vertexShader: VERT, fragmentShader: RESOLVE, depthTest: false, depthWrite: false,
      uniforms: { ...ray, uCur: { value: cur.textures[0] }, uHist: { value: null }, uPrevVP: { value: new Matrix4() }, uTexel: { value: new Vector2() }, uAlpha: { value: 1 } },
    });
    const comp = new ShaderMaterial({
      glslVersion: GLSL3, uniforms: { uTex: { value: null }, uDepth: { value: cur.textures[1] }, uLow: { value: new Vector2(2, 2) } }, transparent: true, depthTest: false, depthWrite: false,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, vertexShader: VERT,
      fragmentShader: UPSCALE,
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), comp);
    quad.frustumCulled = false; quad.renderOrder = 6; quad.name = 'cloud_volume';
    return {
      cur, hist, march, resolve, comp, quad, mp: quadScene(march), rp: quadScene(resolve), cam: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
      prevVP: new Matrix4(), prevPos: new Vector3(1e9, 0, 0), frame: 0, w: 0, wasOn: false,
    };
  }, [steps, gl]);
  useEffect(() => {
    const w = Math.max(2, Math.round((size.width * dpr) / 2)), h = Math.max(2, Math.round((size.height * dpr) / 2));
    for (const t of [st.cur, ...st.hist]) t.setSize(w, h);
    st.resolve.uniforms.uTexel.value.set(1 / w, 1 / h); st.comp.uniforms.uLow.value.set(w, h);
    st.wasOn = false; // history invalid after a resize
  }, [st, size, dpr]);
  useEffect(() => { const a = registerWarm(st.mp.scene, st.cam), b = registerWarm(st.rp.scene, st.cam); return () => { a(); b(); }; }, [st]);
  useEffect(() => () => {
    for (const t of [st.cur, ...st.hist]) t.dispose();
    for (const m of [st.march, st.resolve, st.comp]) m.dispose();
    for (const g of [st.quad.geometry, st.mp.mesh.geometry, st.rp.mesh.geometry]) g.dispose();
  }, [st]);

  useFrame(() => {
    const on = !!tex && S.p > 0.6 && S.p < 0.99 && S.cloudOpacity > 0.002;
    st.quad.visible = on;
    if (!on || !tex) { st.wasOn = false; return; }
    const cam = camera as PerspectiveCamera, u = st.march.uniforms;
    cam.updateMatrixWorld();
    u.uInvProj.value.copy(cam.projectionMatrixInverse); u.uInvView.value.copy(cam.matrixWorld); u.uCam.value.copy(cam.position);
    u.uShape.value = tex.shape; u.uDetail.value = tex.detail; u.uBlue.value = tex.blue;
    u.uTime.value = clock.getElapsedTime(); u.uOpacity.value = S.cloudOpacity; u.uLightMix.value = S.cloudLight;
    u.uCoverage.value = 0.55 * (1 - S.cloudDissolve); u.uFrame.value = st.frame++ % 1024;
    const jump = !st.wasOn || cam.position.distanceTo(st.prevPos) > 2;
    const r = st.resolve.uniforms, read = st.hist[st.w], write = st.hist[1 - st.w];
    r.uHist.value = read.texture; r.uPrevVP.value.copy(st.prevVP); r.uAlpha.value = jump ? 1 : 0.12;
    const prev = gl.getRenderTarget();
    gl.setClearColor(0, 0);
    gl.setRenderTarget(st.cur); gl.clear(); gl.render(st.mp.scene, st.cam);
    gl.setRenderTarget(write); gl.render(st.rp.scene, st.cam);
    gl.setRenderTarget(prev);
    st.comp.uniforms.uTex.value = write.texture;
    st.w = 1 - st.w;
    st.prevVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); st.prevPos.copy(cam.position); st.wasOn = true;
  });
  return <primitive object={st.quad} />;
}
