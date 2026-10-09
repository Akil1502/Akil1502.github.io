import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Soft radial light bloom on a plane (cheap volumetric feel). Pulses slowly; `pulse` ref can be driven externally.
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  uniform float uSoftness;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p * vec2(1.0, 1.25));
    float g = pow(smoothstep(0.5, 0.0, d), uSoftness);
    float flicker = 0.92 + 0.08 * sin(uTime * 7.0 + d * 20.0) * sin(uTime * 3.1);
    gl_FragColor = vec4(uColor, g * uIntensity * flicker);
  }
`
export default function GlowPlane({ color = '#e8232a', intensity = 0.6, size = [20, 14], softness = 1.6, ...props }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: { value: 0 }, uSoftness: { value: softness } },
      }),
    [color, intensity, softness],
  )
  const ref = useRef()
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
  })
  return (
    <mesh ref={ref} material={mat} {...props}>
      <planeGeometry args={size} />
    </mesh>
  )
}
