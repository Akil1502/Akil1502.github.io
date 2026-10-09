import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { simplex3D } from '../../../three/shaders/noise.glsl.js'
import { scroll } from '../../../three/scrollStore'

/* ------------------------------------------------------------------------------------------------
 * Stage atmosphere for the About page (all procedural):
 *   HaloRays  - a vintage war-poster sunburst of red / white / blue light shafts that sits behind the
 *               shield and follows it; broken up by noise so it reads as light through haze
 *   Haze      - domain-warped fbm smoke drifting across the stage (navy / steel, warmed by the red key)
 *   StarField - instanced five-point stars drifting and tumbling in the dark (shader-animated)
 * ---------------------------------------------------------------------------------------------- */

const uvVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

const raysFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRays;
  uniform float uSpin;
  uniform vec3 uRed;
  uniform vec3 uWhite;
  uniform vec3 uBlue;
  varying vec2 vUv;
  ${simplex3D}
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float f = (a / 6.2831853 + 0.5) * uRays + uSpin;
    float id = floor(f);
    float fr = fract(f);
    float beam = smoothstep(0.0, 0.22, fr) * smoothstep(0.58, 0.3, fr);
    float m = mod(id, 3.0);
    vec3 col = m < 0.5 ? uRed : (m < 1.5 ? uWhite : uBlue);
    float shaft = 0.55 + 0.45 * snoise(vec3(id * 0.73, r * 2.4 - uTime * 0.35, uTime * 0.05));
    float fall = smoothstep(1.0, 0.18, r) * smoothstep(0.12, 0.34, r);
    float a2 = beam * fall * shaft * uIntensity;
    gl_FragColor = vec4(col, a2);
    #include <colorspace_fragment>
  }
`

const hazeFrag = /* glsl */ `
  uniform float uTime;
  uniform float uAlpha;
  uniform float uScroll;
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform vec3 uWarm;
  varying vec2 vUv;
  ${simplex3D}
  float fbm(vec3 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
      s += a * snoise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 3.1);
      a *= 0.5;
    }
    return s;
  }
  void main() {
    vec2 uv = vUv;
    vec2 p = uv * vec2(3.2, 1.9) + vec2(uTime * 0.018, uScroll * 0.35);
    float t = uTime * 0.035;
    #if WARP
      vec2 q = vec2(snoise(vec3(p * 0.7, t)), snoise(vec3(p * 0.7 + 4.3, t + 1.7)));
      float n = fbm(vec3(p + 1.4 * q, t * 1.4));
    #else
      vec2 q = vec2(0.0);
      float n = fbm(vec3(p, t));
    #endif
    float d = smoothstep(-0.25, 0.75, n);
    float edge = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x) * smoothstep(0.0, 0.3, uv.y) * smoothstep(1.0, 0.7, uv.y);
    vec3 col = mix(uColA, uColB, clamp(q.x * 0.8 + 0.5, 0.0, 1.0));
    col = mix(col, uWarm, smoothstep(0.55, 0.0, uv.x) * 0.55);
    gl_FragColor = vec4(col, d * d * uAlpha * edge);
    #include <colorspace_fragment>
  }
`

const starVert = /* glsl */ `
  attribute vec3 aOffset;
  attribute float aSeed;
  uniform float uTime;
  uniform float uScroll;
  varying float vSeed;
  varying float vFade;
  void main() {
    vSeed = aSeed;
    float ang = uTime * (0.2 + aSeed * 0.6) * (aSeed > 0.5 ? 1.0 : -1.0) + aSeed * 40.0;
    float tilt = sin(uTime * 0.5 + aSeed * 12.0) * 1.2;
    vec3 p = position * (0.5 + aSeed * 0.9);
    p = vec3(p.x * cos(ang) - p.y * sin(ang), p.x * sin(ang) + p.y * cos(ang), p.z);
    p = vec3(p.x * cos(tilt) + p.z * sin(tilt), p.y, -p.x * sin(tilt) + p.z * cos(tilt));
    vec3 o = aOffset;
    float h = 18.0;
    o.y = mod(o.y + uScroll * (0.6 + aSeed * 0.8) + uTime * 0.08 + h * 0.5, h) - h * 0.5;
    o.x += sin(uTime * 0.2 + aSeed * 30.0) * 0.4;
    vec4 mv = modelViewMatrix * vec4(o + p, 1.0);
    vFade = smoothstep(26.0, 9.0, -mv.z) * smoothstep(8.5, 6.5, abs(o.y));
    gl_Position = projectionMatrix * mv;
  }
`
const starFrag = /* glsl */ `
  uniform vec3 uSilver;
  uniform vec3 uRed;
  uniform vec3 uBlue;
  uniform float uAlpha;
  varying float vSeed;
  varying float vFade;
  void main() {
    vec3 col = vSeed < 0.62 ? uSilver : (vSeed < 0.82 ? uRed : uBlue);
    gl_FragColor = vec4(col, vFade * uAlpha * (0.35 + 0.65 * fract(vSeed * 7.3)));
    #include <colorspace_fragment>
  }
`

function starGeometry(ro = 0.12) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? ro * 0.382 : ro
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return new THREE.ShapeGeometry(s)
}

// Ray burst that follows the shield: the rig positions/scales it and drives `intensity`.
export const HaloRays = forwardRef(function HaloRays({ tier }, ref) {
  const mesh = useRef()
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: uvVert,
        fragmentShader: raysFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uIntensity: { value: 0 },
          uRays: { value: tier === 'low' ? 18 : 24 },
          uSpin: { value: 0 },
          uRed: { value: new THREE.Color('#ff2b3a') },
          uWhite: { value: new THREE.Color('#dfe6f5') },
          uBlue: { value: new THREE.Color('#3d74ff') },
        },
      }),
    [tier],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useImperativeHandle(ref, () => ({ mesh: mesh.current, mat }), [mat])
  useFrame((state, dt) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uSpin.value += Math.min(dt, 0.05) * 0.02
  })
  return (
    <mesh ref={mesh} material={mat} frustumCulled={false} renderOrder={-2}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
})

export function Haze({ tier }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: uvVert,
        fragmentShader: hazeFrag,
        transparent: true,
        depthWrite: false,
        defines: { OCTAVES: tier === 'high' ? 4 : tier === 'medium' ? 3 : 2, WARP: tier === 'low' ? 0 : 1 },
        uniforms: {
          uTime: { value: 0 },
          uAlpha: { value: 0 },
          uScroll: { value: 0 },
          uColA: { value: new THREE.Color('#1b2a4d') },
          uColB: { value: new THREE.Color('#4a5878') },
          uWarm: { value: new THREE.Color('#5a1620') },
        },
      }),
    [tier],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((state) => {
    const S = scroll.sections
    const hero = S['about-hero']?.visible ?? 1
    const fin = S['about-final']?.visible ?? 0
    const peak = Math.max(hero, fin)
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uScroll.value = (scroll.y || 0) * 0.00025
    const target = 0.34 + 0.36 * peak
    mat.uniforms.uAlpha.value += (target - mat.uniforms.uAlpha.value) * 0.05
  })
  return (
    <mesh material={mat} position={[0, 0, -5]} frustumCulled={false} renderOrder={-3}>
      <planeGeometry args={[26, 14]} />
    </mesh>
  )
}

export function StarField({ tier }) {
  const count = tier === 'high' ? 64 : tier === 'medium' ? 36 : 16
  const geo = useMemo(() => {
    const g = starGeometry()
    const off = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      off[i * 3] = (Math.random() - 0.5) * 22
      off[i * 3 + 1] = (Math.random() - 0.5) * 18
      off[i * 3 + 2] = -3 - Math.random() * 10
      seed[i] = Math.random()
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    return g
  }, [count])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uAlpha: { value: 0.75 },
          uSilver: { value: new THREE.Color('#e9edf5') },
          uRed: { value: new THREE.Color('#ff3442') },
          uBlue: { value: new THREE.Color('#4f84ff') },
        },
      }),
    [],
  )
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime
    mat.uniforms.uScroll.value = (scroll.y || 0) * 0.004
  })
  return <instancedMesh args={[geo, mat, count]} frustumCulled={false} renderOrder={-1} />
}
