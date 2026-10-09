import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Drifting storm haze around the hammer (the reference's smoke): a few soft fbm-alpha planes, additive and faint,
// that light up with every strike and glow blue with the charge.
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uFlash;
  uniform float uCharge;
  uniform float uAmount;
  uniform vec3 uColor;
  uniform vec3 uBolt;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 3.1; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 p = vUv * 3.0 + vec2(uSeed * 7.0 + uTime * 0.035, uTime * 0.018 - uSeed);
    float n = fbm(p + fbm(p * 1.5 - uTime * 0.02));
    vec2 c = vUv - 0.5;
    float fall = smoothstep(0.5, 0.05, length(c * vec2(1.0, 1.3)));
    float a = smoothstep(0.35, 0.85, n) * fall * uAmount;
    vec3 col = uColor * (0.5 + uFlash * 3.0) + uBolt * uCharge * 0.6;
    gl_FragColor = vec4(col, a * (0.22 + uFlash * 0.5));
  }
`

const LAYERS = [
  { pos: [-1.4, -1.6, -1.2], size: [7, 3.6], seed: 0.1 },
  { pos: [1.6, -0.6, -2.4], size: [8, 5], seed: 0.57 },
  { pos: [0.2, 0.8, -3.2], size: [9, 6], seed: 0.83 },
]

export default function Haze({ tier = 'high', fx }) {
  const layers = useMemo(() => (tier === 'low' ? LAYERS.slice(0, 1) : tier === 'medium' ? LAYERS.slice(0, 2) : LAYERS), [tier])
  const mats = useMemo(
    () =>
      layers.map(
        (l) =>
          new THREE.ShaderMaterial({
            vertexShader: vert,
            fragmentShader: frag,
            uniforms: {
              uTime: { value: 0 },
              uSeed: { value: l.seed },
              uFlash: { value: 0 },
              uCharge: { value: 0 },
              uAmount: { value: 1 },
              uColor: { value: new THREE.Color('#6f8199') },
              uBolt: { value: new THREE.Color('#8fd8ff') },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [layers],
  )
  useFrame((state) => {
    for (const m of mats) {
      m.uniforms.uTime.value = state.clock.elapsedTime
      m.uniforms.uFlash.value = fx.flash
      m.uniforms.uCharge.value = fx.charge
      m.uniforms.uAmount.value = fx.haze
    }
  })
  return (
    <group>
      {layers.map((l, i) => (
        <mesh key={i} position={l.pos} material={mats[i]} renderOrder={2}>
          <planeGeometry args={l.size} />
        </mesh>
      ))}
    </group>
  )
}
