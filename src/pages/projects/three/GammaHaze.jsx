import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { simplex3D } from '../../../three/shaders/noise.glsl.js'
import { COL, CX, CZ } from './gammaConst'

// Gamma haze: a few large smoke sheets (fbm simplex noise, slowly rolling) standing around the crater. Green and
// thick near the ground, bruised purple higher up, glowing brighter when the field flares (uFlare). Additive and
// depth-tested so the debris and the crater rim cut through it. Low tier: two sheets with 2 octaves.

const vert = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vW;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const frag = (octaves) => /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uAmp;
  uniform float uFlare;
  uniform vec3 uGreen;
  uniform vec3 uPurple;
  varying vec2 vUv;
  varying vec3 vW;
  ${simplex3D}
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < ${octaves}; i++) {
      s += a * snoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05 + uSeed;
    // smoke rises and rolls sideways
    vec3 p = vec3(uv.x * 2.6 + t * 0.6, uv.y * 1.6 - t * 1.4, t * 0.7 + uSeed * 3.0);
    // cheap warp: one octave bends the fbm so the smoke curls instead of scrolling as a sheet
    float n = fbm(p + vec3(0.45 * sin(p.y * 1.3 + t * 2.0), 0.0, 0.0));
    float d = smoothstep(-0.15, 0.65, n);
    // soft edges on every side, heavier at the bottom
    float edge = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x) * smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.45, uv.y);
    vec3 col = mix(uGreen, uPurple, smoothstep(0.15, 0.85, uv.y));
    float a = d * edge * uAmp * (1.0 + uFlare * 1.5);
    gl_FragColor = vec4(col * a, 1.0);
  }
`

const SHEETS = [
  { pos: [CX - 0.4, 0.9, CZ + 1.9], size: [11, 5.5], seed: 0.0, amp: 0.15 },
  { pos: [CX + 1.2, 1.6, CZ - 1.6], size: [15, 7], seed: 3.7, amp: 0.2 },
  { pos: [CX - 4.5, 1.2, CZ - 3.2], size: [12, 6], seed: 7.1, amp: 0.13 },
  { pos: [CX + 5.5, 1.0, CZ - 0.5], size: [10, 5], seed: 5.3, amp: 0.12 },
]

export default function GammaHaze({ tier, bus }) {
  const lo = tier === 'low'
  const sheets = useMemo(() => (lo ? SHEETS.slice(0, 2) : SHEETS), [lo])
  const mats = useMemo(
    () =>
      sheets.map(
        (s) =>
          new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag(lo ? 2 : 3),
            uniforms: {
              uTime: { value: 0 },
              uSeed: { value: s.seed },
              uAmp: { value: s.amp },
              uFlare: { value: 0 },
              uGreen: { value: new THREE.Color(COL.green) },
              uPurple: { value: new THREE.Color(COL.purple) },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
      ),
    [sheets, lo, tier],
  )
  useEffect(() => () => mats.forEach((m) => m.dispose()), [mats])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const fl = bus ? bus.uFlare.value : 0
    for (const m of mats) {
      m.uniforms.uTime.value = t
      m.uniforms.uFlare.value = fl
    }
  })
  return (
    <group>
      {sheets.map((s, i) => (
        <mesh key={i} position={s.pos} material={mats[i]} frustumCulled={false} renderOrder={1}>
          <planeGeometry args={s.size} />
        </mesh>
      ))}
    </group>
  )
}
