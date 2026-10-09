import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Wind-driven rain: line segments animated entirely in the vertex shader (no CPU work per frame). Each streak
// brightens with the strike flash so the rain "freezes" in the lightning, like a camera flash in a storm.
const vert = /* glsl */ `
  attribute vec4 aSeed; // x, y0, z, speed
  attribute float aEnd;
  uniform float uTime;
  uniform float uH;
  uniform float uLen;
  uniform float uWind;
  varying float vEnd;
  varying float vDepth;
  void main() {
    float y = mod(aSeed.y - uTime * aSeed.w, uH) - uH * 0.5 + 1.5;
    float len = uLen * (0.6 + aSeed.w * 0.05);
    vec3 p = vec3(aSeed.x + uWind * y * 0.18 + aEnd * uWind * len * 0.18, y + aEnd * len, aSeed.z);
    vEnd = aEnd;
    vDepth = clamp((aSeed.z + 14.0) / 18.0, 0.0, 1.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uFlash;
  uniform float uOpacity;
  varying float vEnd;
  varying float vDepth;
  void main() {
    float a = (0.25 + 0.75 * vEnd) * uOpacity * (0.35 + 0.65 * vDepth) * (1.0 + uFlash * 3.5);
    gl_FragColor = vec4(uColor * (1.0 + uFlash * 2.0), a);
  }
`

export default function Rain({ tier = 'high', fx }) {
  const count = tier === 'high' ? 1400 : tier === 'medium' ? 700 : 300
  const { geo, mat } = useMemo(() => {
    const seeds = new Float32Array(count * 2 * 4)
    const ends = new Float32Array(count * 2)
    const pos = new Float32Array(count * 2 * 3)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 30
      const y = Math.random() * 18
      const z = -14 + Math.random() * 17
      const sp = 9 + Math.random() * 7
      for (let k = 0; k < 2; k++) {
        seeds.set([x, y, z, sp], (i * 2 + k) * 4)
        ends[i * 2 + k] = k
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uH: { value: 18 },
        uLen: { value: 0.55 },
        uWind: { value: -1.2 },
        uColor: { value: new THREE.Color('#9fc6e6') },
        uFlash: { value: 0 },
        uOpacity: { value: 0.22 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo: g, mat: m }
  }, [count])

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uFlash.value = fx.flash
    mat.uniforms.uOpacity.value = 0.1 + fx.rain * 0.1
  })

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />
}
