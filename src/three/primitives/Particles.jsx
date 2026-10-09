import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scroll } from '../scrollStore'
import { palette } from '../constants'
import { simplex3D, curlNoise } from '../shaders/noise.glsl.js'

// Embers / sparks drifting through the whole scene: red and gold points moved by curl noise in the vertex shader.
// The cloud is tall enough to span every section and follows the camera's y so it never runs out.
const vert = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aSeed;
  attribute float aSize;
  varying float vSeed;
  varying float vAlpha;
  ${simplex3D}
  ${curlNoise}
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    float t = uTime * 0.12 + aSeed * 10.0;
    vec3 c = curl(p * 0.15 + vec3(0.0, t * 0.3, 0.0));
    p += c * (0.6 + aSeed * 0.8);
    p.y += sin(t + aSeed * 6.28) * 0.4;
    // drift upward with page scroll, wrapped around the (static) camera so the field never runs out
    float h = 26.0;
    p.y = mod(p.y + uScroll + h * 0.5, h) - h * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    gl_PointSize = aSize * uSize * uPixelRatio * (12.0 / max(depth, 1.0));
    vAlpha = smoothstep(40.0, 6.0, depth) * (0.5 + 0.5 * sin(uTime * (1.0 + aSeed) + aSeed * 20.0));
  }
`
const frag = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.05, d);
    float core = smoothstep(0.2, 0.0, d);
    vec3 col = mix(uColorA, uColorB, step(0.72, vSeed));
    col += core * 0.8;
    gl_FragColor = vec4(col, a * vAlpha * 0.9);
  }
`

export default function Particles({ tier = 'high', colorA = palette.red, colorB = palette.gold }) {
  const count = tier === 'high' ? 2600 : tier === 'medium' ? 1300 : 500
  const ref = useRef()
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const size = new Float32Array(count)
    const h = 26
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30
      pos[i * 3 + 1] = (Math.random() - 0.5) * h
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2
      seed[i] = Math.random()
      size[i] = 0.6 + Math.pow(Math.random(), 3) * 2.2
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSize: { value: 1 },
        uColorA: { value: new THREE.Color(palette.red) },
        uColorB: { value: new THREE.Color(palette.gold) },
      },
    })
    return { geometry: g, material: m }
  }, [count])

  const targetA = useMemo(() => new THREE.Color(), [])
  const targetB = useMemo(() => new THREE.Color(), [])
  targetA.set(colorA)
  targetB.set(colorB)
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
    material.uniforms.uScroll.value = (scroll.y || 0) * 0.006
    // blend to the active hero's colours
    material.uniforms.uColorA.value.lerp(targetA, 0.04)
    material.uniforms.uColorB.value.lerp(targetB, 0.04)
    material.uniforms.uSize.value = 1 + Math.min(Math.abs(scroll.velocity) / 80, 0.8)
  })

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} />
}
