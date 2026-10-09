import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { simplex3D } from '../../../three/shaders/noise.glsl.js'
import { stage } from './stage'
import { decay, initXp, disposeAll } from '../signals'

/* Low-hanging haze behind the emblem (reference: the hero object stands in smoke). Two fbm layers drifting at
   different speeds, tinted smoky red-grey, masked to soft edges; it trails the emblem cluster loosely and is lit
   cold-white for a beat by every DECRYPT flare. Skipped on the low tier. */

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uFlash;
  uniform vec3 uColA;
  uniform vec3 uColB;
  varying vec2 vUv;
  ${simplex3D}
  float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * snoise(p); p *= 2.07; a *= 0.5; }
    return s;
  }
  void main() {
    vec2 p = vUv * vec2(3.4, 1.9);
    float n1 = fbm(vec3(p + vec2(uTime * 0.035, -uTime * 0.012), uTime * 0.04));
    float n2 = fbm(vec3(p * 1.6 - vec2(uTime * 0.05, 0.0), uTime * 0.06 + 7.0));
    float dens = smoothstep(-0.15, 0.85, n1 * 0.75 + n2 * 0.45);
    float edge = smoothstep(0.0, 0.28, vUv.x) * smoothstep(1.0, 0.72, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    vec3 col = mix(uColA, uColB, clamp(n2 * 0.6 + 0.5, 0.0, 1.0)) + vec3(0.55, 0.7, 1.0) * uFlash * dens;
    gl_FragColor = vec4(col, dens * edge * uOpacity);
  }
`

export default function Smoke() {
  const ref = useRef()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.5 },
          uFlash: { value: 0 },
          uColA: { value: new THREE.Color('#1a0d10') },
          uColB: { value: new THREE.Color('#4a1018') },
        },
      }),
    [],
  )
  useEffect(() => () => disposeAll(mat), [mat])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    mat.uniforms.uTime.value = t
    const x = initXp()
    mat.uniforms.uFlash.value = decay(x.arc, 3.5) * (x.arcPower || 0) * 0.35
    mat.uniforms.uOpacity.value = 0.38 + 0.22 * stage.focus
    if (ref.current) ref.current.position.set(stage.x * 0.7, stage.floorY + 3.1, stage.z - 3.2)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={-1}>
      <planeGeometry args={[18, 9]} />
    </mesh>
  )
}
