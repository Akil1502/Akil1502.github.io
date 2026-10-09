import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useDispose } from './useDispose'

// Drifting smoke wisps around the suit (domain-warped fbm on soft billboards). Cheap enough for every tier:
// the octave count and the number of planes scale with the device tier.
const vert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
const frag = (oct) => /* glsl */ `
uniform float uTime; uniform float uOpacity; uniform vec3 uColor; uniform vec3 uRim; uniform float uSeed; varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < ${oct}; i++){ v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main(){
  vec2 uv = vUv;
  float t = uTime * 0.04 + uSeed * 10.0;
  vec2 q = uv * vec2(2.4, 1.8) + vec2(t * 0.7, -t * 1.3);
  float w = fbm(q + fbm(q * 1.3 + t) * 1.6);
  float mask = smoothstep(0.5, 0.08, length((uv - 0.5) * vec2(1.0, 1.25)));
  float a = smoothstep(0.42, 0.95, w) * mask * uOpacity;
  vec3 col = mix(uColor, uRim, smoothstep(0.55, 1.0, w) * (1.0 - uv.y * 0.5));
  gl_FragColor = vec4(col, a);
}`

export default function Smoke({ tier = 'high', opacity = 1, dirRef }) {
  const n = tier === 'high' ? 4 : tier === 'medium' ? 3 : 2
  const oct = tier === 'high' ? 4 : 3
  const planes = useMemo(() => {
    const layout = [
      { p: [1.4, 0.6, -1.4], s: [6.5, 5], r: 0.2, o: 0.5 },
      { p: [-1.5, -0.6, -0.8], s: [5.5, 4.2], r: -0.3, o: 0.38 },
      { p: [0.3, -1.6, 0.9], s: [6, 3.2], r: 0.05, o: 0.3 },
      { p: [2.2, -0.2, 0.6], s: [3.6, 4.6], r: 0.6, o: 0.26 },
      { p: [-0.6, 1.5, -2.2], s: [7, 4], r: -0.1, o: 0.35 },
    ]
    return layout.slice(0, n).map((l, i) => ({
      ...l,
      mat: new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag(oct),
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: l.o * opacity },
          uColor: { value: new THREE.Color('#2b2427') },
          uRim: { value: new THREE.Color(i % 2 ? '#8a6a5a' : '#6d6a74') },
          uSeed: { value: i * 0.37 },
        },
      }),
    }))
  }, [n, oct, opacity])
  const refs = useRef([])
  useDispose([planes.map((p) => p.mat)], [planes])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const k = dirRef?.current?.smoke ?? 1
    for (let i = 0; i < planes.length; i++) {
      const pl = planes[i]
      pl.mat.uniforms.uTime.value = t
      pl.mat.uniforms.uOpacity.value = pl.o * opacity * k
      const m = refs.current[i]
      if (m) {
        m.position.x = pl.p[0] + Math.sin(t * 0.07 + i) * 0.3
        m.position.y = pl.p[1] + Math.sin(t * 0.05 + i * 2.1) * 0.15
      }
    }
  })
  return (
    <group>
      {planes.map((pl, i) => (
        <mesh key={i} ref={(el) => (refs.current[i] = el)} position={pl.p} rotation={[0, 0, pl.r]} material={pl.mat} renderOrder={1}>
          <planeGeometry args={pl.s} />
        </mesh>
      ))}
    </group>
  )
}
