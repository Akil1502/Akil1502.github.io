import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Cinematic haze: two slow fbm smoke layers far behind the stage (red-black and a warm gold wisp), drifting with
// time and scroll. Cheap value-noise fbm (4 octaves high / 3 low). The director sets dir.smoke (0..1 strength)
// and dir.smokeWarm (how much the gold beacon light catches the smoke).

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const frag = (octaves) => /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uIntensity;
  uniform float uWarm;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec2 uFocus;
  uniform float uSeed;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < ${octaves}; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }
  void main() {
    vec2 uv = vUv * vec2(2.2, 1.4) + vec2(uSeed, uSeed * 0.37);
    float t = uTime * 0.035;
    vec2 q = vec2(fbm(uv + vec2(t, -t * 0.6)), fbm(uv + vec2(-t * 0.8, t * 0.4) + 4.1));
    float n = fbm(uv + 1.6 * q + vec2(0.0, uScroll));
    float d = smoothstep(0.38, 0.85, n);
    vec2 c = vUv - uFocus;
    float focus = exp(-dot(c, c) * 7.0);
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    vec3 col = mix(uColorA, uColorB, clamp(focus * uWarm * 1.4 + q.x * 0.25, 0.0, 1.0));
    gl_FragColor = vec4(col, d * edge * uIntensity * (0.55 + 0.9 * focus));
  }
`

function Layer({ dir, z, scale, colorA, colorB, seed, speed, low, warmK = 1 }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag(low ? 3 : 4),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uIntensity: { value: 0 },
          uWarm: { value: 0 },
          uColorA: { value: new THREE.Color(colorA) },
          uColorB: { value: new THREE.Color(colorB) },
          uFocus: { value: new THREE.Vector2(0.5, 0.5) },
          uSeed: { value: seed },
        },
      }),
    [colorA, colorB, seed, low],
  )
  useFrame((state) => {
    const d = dir.current
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime * speed
    u.uScroll.value = d.scrollY * 0.00018 * speed
    u.uIntensity.value = d.active ? d.smoke : 0
    u.uWarm.value = d.smokeWarm * warmK
    u.uFocus.value.set(d.focusU, d.focusV)
  })
  return (
    <mesh material={mat} position={[0, 0, z]} renderOrder={-5}>
      <planeGeometry args={scale} />
    </mesh>
  )
}

export default function Smoke({ dir, tier }) {
  const low = tier === 'low'
  return (
    <>
      <Layer dir={dir} z={-9} scale={[34, 20]} colorA={'#2a0a0e'} colorB={'#7a3a12'} seed={0.3} speed={1} low={low} />
      {!low ? <Layer dir={dir} z={-5} scale={[24, 14]} colorA={'#1a0709'} colorB={'#a0641c'} seed={3.7} speed={1.4} low={low} warmK={1.2} /> : null}
    </>
  )
}
