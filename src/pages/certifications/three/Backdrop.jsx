import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { simplex3D } from '../../../three/shaders/noise.glsl.js'
import { scroll } from '../../../three/scrollStore'

/*
 * Far background for the Sanctum page:
 *  - MirrorDimension: a faint kaleidoscope (8-fold polar fold) of a log-polar "city" of window cells that endlessly
 *    zooms inward and folds with scroll — the bending-buildings feel, kept very dim (violet + orange edges).
 *  - Smoke: slow fbm wisps lit from below in violet/orange, the reference's cinematic haze around the relic.
 * Both are single planes; Smoke is skipped on low tier, the kaleidoscope runs at reduced detail on medium.
 */
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const kaleidoFrag = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uIntensity;
  uniform float uAspect;
  uniform float uSegments;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  varying vec2 vUv;
  #define TAU 6.28318530718
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    p = rot2(uTime * 0.015 + uScroll * 0.9) * p;
    float r = length(p);
    float a = atan(p.y, p.x);
    float seg = TAU / uSegments;
    a = mod(a, seg);
    a = abs(a - seg * 0.5);
    // log-polar: rings of "buildings" receding into the centre forever
    float lr = log(r + 0.0001) * 1.6 - uTime * 0.06 - uScroll * 2.2;
    vec2 g = vec2(lr * 3.0, a * 10.0);
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float hv = h2(cell);
    float edge = 1.0 - smoothstep(0.0, 0.05, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    // windows inside some cells
    vec2 wg = fract(f * vec2(4.0, 3.0));
    float win = step(0.25, wg.x) * step(wg.x, 0.75) * step(0.3, wg.y) * step(wg.y, 0.7) * step(0.55, hv) * step(0.15, f.x) * step(f.x, 0.85);
    float twinkle = 0.5 + 0.5 * sin(uTime * 1.3 + hv * 40.0);
    vec3 col = uA * edge * (0.25 + 0.5 * hv) + uB * win * twinkle * 0.35 * step(0.8, hv) + uC * edge * step(0.95, hv) * 0.5;
    // fold seams glow faintly
    col += uA * (1.0 - smoothstep(0.0, 0.01, a)) * 0.15;
    float fade = smoothstep(0.15, 0.9, r) * smoothstep(2.2, 0.9, r);
    gl_FragColor = vec4(col * fade * uIntensity, 1.0);
  }
`

const smokeFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uA;
  uniform vec3 uB;
  varying vec2 vUv;
  ${simplex3D}
  float fbm(vec3 p) {
    float v = 0.0;
    float amp = 0.55;
    for (int i = 0; i < 3; i++) {
      v += amp * snoise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }
  void main() {
    vec2 p = vUv * vec2(2.6, 1.6);
    float t = uTime * 0.035;
    float w = fbm(vec3(p, t));
    vec2 q = vec2(w, w * 0.7 + 0.2);
    float n = fbm(vec3(p + q * 1.4 + vec2(0.0, -t * 2.0), t * 0.7));
    n = smoothstep(0.0, 0.85, n);
    float mask = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    vec3 col = mix(uA, uB, smoothstep(0.6, 0.0, vUv.y) * q.x * 0.8 + 0.2);
    gl_FragColor = vec4(col * n * mask * uIntensity, 1.0);
  }
`

export function MirrorDimension({ tier = 'high', aspect = 1.6, intensity = 0.5, ...props }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: kaleidoFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uIntensity: { value: intensity },
          uAspect: { value: aspect },
          uSegments: { value: tier === 'high' ? 8 : 6 },
          uA: { value: new THREE.Color('#5b1f9a') },
          uB: { value: new THREE.Color('#ff9a2e') },
          uC: { value: new THREE.Color('#38f29a') },
        },
      }),
    [tier, aspect, intensity],
  )
  useLayoutEffect(() => () => mat.dispose(), [mat])
  const ref = useRef()
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uScroll.value += ((scroll.progress || 0) - mat.uniforms.uScroll.value) * 0.08
  })
  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-2} {...props}>
      <planeGeometry args={[2 * aspect, 2]} />
    </mesh>
  )
}

export function Smoke({ intensity = 0.5, size = [16, 10], ...props }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: smokeFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: intensity }, uA: { value: new THREE.Color('#3b1a57') }, uB: { value: new THREE.Color('#ff8a2a') } },
      }),
    [intensity],
  )
  useLayoutEffect(() => () => mat.dispose(), [mat])
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh material={mat} frustumCulled={false} renderOrder={-1} {...props}>
      <planeGeometry args={size} />
    </mesh>
  )
}
