import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'

// The six team tokens: small, original, procedural homages (no logos). Each fits a ~1.0 world-unit circle,
// centred on the origin and facing +z, so the director can scale it to any slot. Every model owns its idle motion
// and reads `live` (the director's per-token record: { glow, hover, pop, spin }) for power-ups.
// Shared geometry/material choices: PBR metals pick up the global studio env map; emissive parts are tone-map-free
// so bloom catches them.

const TAU = Math.PI * 2
const tmp = new THREE.Object3D()

/* ------------------------------------------------------------------ 01 · reactor ring (Iron Man) */
export function ReactorToken({ live, low }) {
  const coils = useRef()
  const spin = useRef()
  const coilMat = useRef()
  const coreMat = useRef()
  const ringMat = useRef()
  const seg = low ? 24 : 48
  useLayoutEffect(() => {
    if (!coils.current) return
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU
      tmp.position.set(Math.cos(a) * 0.27, Math.sin(a) * 0.27, 0.035)
      tmp.rotation.set(0, 0, a)
      tmp.scale.set(0.13, 0.062, 0.05)
      tmp.updateMatrix()
      coils.current.setMatrixAt(i, tmp.matrix)
    }
    coils.current.instanceMatrix.needsUpdate = true
  }, [])
  const tri = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i / 3) * TAU
      const x = Math.cos(a) * 0.115
      const y = Math.sin(a) * 0.115
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 })
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const l = live.current
    const g = 0.6 + 0.4 * l.glow
    if (spin.current) spin.current.rotation.z = -t * (0.5 + l.hover * 2.2)
    if (coilMat.current) coilMat.current.emissiveIntensity = (1.4 + 0.4 * Math.sin(t * 3)) * g + l.pop * 2
    if (coreMat.current) coreMat.current.emissiveIntensity = (2.6 + 0.6 * Math.sin(t * 5.3)) * g + l.pop * 3 + l.hover * 1.5
    if (ringMat.current) ringMat.current.emissiveIntensity = 1.6 * g + l.hover
  })
  return (
    <group>
      {/* housing: deep gunmetal plate with a hot-rod red rim and a gold titanium inner collar */}
      <mesh rotation-x={Math.PI / 2} position-z={-0.03}>
        <cylinderGeometry args={[0.44, 0.44, 0.08, seg]} />
        <meshStandardMaterial color={'#1a1b21'} metalness={1} roughness={0.38} envMapIntensity={1.4} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.45, 0.05, 14, seg * 2]} />
        <meshStandardMaterial color={'#c1121b'} metalness={0.75} roughness={0.28} envMapIntensity={1.8} />
      </mesh>
      <mesh position-z={0.03}>
        <torusGeometry args={[0.365, 0.026, 12, seg * 2]} />
        <meshStandardMaterial color={'#f5c04a'} metalness={1} roughness={0.22} envMapIntensity={2.2} />
      </mesh>
      <group ref={spin}>
        <instancedMesh ref={coils} args={[null, null, 10]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial ref={coilMat} color={'#cff8ff'} emissive={'#7fe9ff'} emissiveIntensity={1.4} toneMapped={false} roughness={0.35} />
        </instancedMesh>
      </group>
      <mesh position-z={0.04}>
        <torusGeometry args={[0.165, 0.024, 12, seg * 2]} />
        <meshStandardMaterial ref={ringMat} color={'#9ff1ff'} emissive={'#4fd1ff'} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      <mesh geometry={tri} position-z={0.02}>
        <meshStandardMaterial ref={coreMat} color={'#f2feff'} emissive={'#bff6ff'} emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ 02 · star shield (Captain America) */
const SHIELD_R = 0.47
const dish = (r) => 0.085 * (1 - Math.pow(r / SHIELD_R, 2)) // convex dish height
function bandGeometry(r0, r1, seg, steps = 6) {
  // profile runs from the outer edge inward so the lathe's normals (and front faces) point at the camera
  const pts = []
  for (let i = steps; i >= 0; i--) {
    const r = r0 + ((r1 - r0) * i) / steps
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), dish(r)))
  }
  const g = new THREE.LatheGeometry(pts, seg)
  g.rotateX(Math.PI / 2) // lathe axis (y) → z, dish faces the camera
  return g
}
export function ShieldToken({ live, low }) {
  const seg = low ? 36 : 72
  const geo = useMemo(
    () => ({
      blue: bandGeometry(0, 0.165, seg, 4),
      red1: bandGeometry(0.165, 0.265, seg),
      silver: bandGeometry(0.265, 0.365, seg),
      red2: bandGeometry(0.365, SHIELD_R, seg),
      back: (() => {
        const g = new THREE.CircleGeometry(SHIELD_R, seg)
        g.rotateY(Math.PI)
        return g
      })(),
      star: (() => {
        const s = new THREE.Shape()
        for (let i = 0; i < 10; i++) {
          const a = Math.PI / 2 + (i / 10) * TAU
          const r = i % 2 === 0 ? 0.142 : 0.056
          if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        s.closePath()
        return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.008, bevelSegments: 2 })
      })(),
    }),
    [seg],
  )
  const starMat = useRef()
  const rimMat = useRef()
  useFrame((state) => {
    const l = live.current
    if (starMat.current) starMat.current.emissiveIntensity = 0.12 + l.pop * 0.9 + l.hover * 0.35
    if (rimMat.current) rimMat.current.emissiveIntensity = 0.05 + l.glow * 0.15 + l.pop * 0.6
  })
  return (
    <group>
      <mesh geometry={geo.blue}>
        <meshStandardMaterial color={'#1f43b8'} metalness={0.55} roughness={0.3} envMapIntensity={1.6} />
      </mesh>
      <mesh geometry={geo.red1}>
        <meshStandardMaterial color={'#c8202f'} metalness={0.5} roughness={0.32} envMapIntensity={1.6} />
      </mesh>
      <mesh geometry={geo.silver}>
        <meshStandardMaterial color={'#e9edf5'} metalness={1} roughness={0.2} envMapIntensity={2.2} />
      </mesh>
      <mesh geometry={geo.red2}>
        <meshStandardMaterial color={'#c8202f'} metalness={0.5} roughness={0.32} envMapIntensity={1.6} />
      </mesh>
      <mesh geometry={geo.back}>
        <meshStandardMaterial color={'#8a8f99'} metalness={1} roughness={0.35} />
      </mesh>
      {/* brushed silver rim */}
      <mesh>
        <torusGeometry args={[SHIELD_R, 0.018, 10, seg]} />
        <meshStandardMaterial ref={rimMat} color={'#f1f4fa'} metalness={1} roughness={0.18} envMapIntensity={2.4} emissive={'#ffffff'} emissiveIntensity={0.05} />
      </mesh>
      <mesh geometry={geo.star} position-z={dish(0) - 0.01}>
        <meshStandardMaterial ref={starMat} color={'#f4f6fb'} metalness={1} roughness={0.16} envMapIntensity={2.6} emissive={'#ffffff'} emissiveIntensity={0.12} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ 03 · war hammer (Thor) */
export function HammerToken({ live, low }) {
  const runeMat = useRef()
  const sway = useRef()
  const geo = useMemo(() => {
    // leather wrap: a helix around the handle
    const pts = []
    const turns = 7
    for (let i = 0; i <= 140; i++) {
      const k = i / 140
      const a = k * turns * TAU
      pts.push(new THREE.Vector3(Math.cos(a) * 0.05, -0.02 - k * 0.44, Math.sin(a) * 0.05))
    }
    const wrap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 140 : 280, 0.011, 5, false)
    const knot = new THREE.TorusKnotGeometry(0.058, 0.008, low ? 48 : 96, 5, 2, 3)
    knot.scale(1, 1, 0.25)
    return { wrap, knot }
  }, [low])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const l = live.current
    if (runeMat.current) runeMat.current.emissiveIntensity = 1.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 2.4)) + l.pop * 3 + l.hover * 2.5
    if (sway.current) sway.current.rotation.z = Math.sin(t * 1.1) * 0.06 * (1 + l.hover * 2)
  })
  return (
    <group ref={sway} position-y={0.08} scale={0.92}>
      {/* the head: blocky, rounded, uru-grey */}
      <RoundedBox args={[0.6, 0.33, 0.33]} radius={0.05} smoothness={low ? 2 : 4} position-y={0.24}>
        <meshStandardMaterial color={'#a9b1bb'} metalness={1} roughness={0.3} envMapIntensity={2} />
      </RoundedBox>
      {/* darker end bands */}
      {[-0.255, 0.255].map((x) => (
        <mesh key={x} position={[x, 0.24, 0]}>
          <boxGeometry args={[0.035, 0.345, 0.345]} />
          <meshStandardMaterial color={'#4a5058'} metalness={1} roughness={0.4} />
        </mesh>
      ))}
      {/* engraved knotwork rune, glowing storm-blue */}
      <mesh geometry={geo.knot} position={[0, 0.24, 0.168]}>
        <meshStandardMaterial ref={runeMat} color={'#cfeeff'} emissive={'#8fd8ff'} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
      {/* handle + leather wrap */}
      <mesh position-y={-0.24}>
        <cylinderGeometry args={[0.042, 0.046, 0.48, 16]} />
        <meshStandardMaterial color={'#6b4426'} roughness={0.75} metalness={0.05} />
      </mesh>
      <mesh geometry={geo.wrap}>
        <meshStandardMaterial color={'#3a2414'} roughness={0.85} />
      </mesh>
      {/* pommel + wrist-strap loop */}
      <mesh position-y={-0.5}>
        <cylinderGeometry args={[0.062, 0.05, 0.06, 16]} />
        <meshStandardMaterial color={'#b9c0c9'} metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.6, 0]} rotation-y={0.4}>
        <torusGeometry args={[0.065, 0.012, 8, 32]} />
        <meshStandardMaterial color={'#3a2414'} roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ 04 · hourglass (Black Widow) */
export function HourglassToken({ live, low }) {
  const glassMat = useRef()
  const inner = useRef()
  const seg = low ? 32 : 64
  const geo = useMemo(() => {
    const top = new THREE.Shape()
    top.moveTo(-0.2, 0.29)
    top.lineTo(0.2, 0.29)
    top.lineTo(0, 0.025)
    top.closePath()
    const bot = new THREE.Shape()
    bot.moveTo(-0.2, -0.29)
    bot.lineTo(0, -0.025)
    bot.lineTo(0.2, -0.29)
    bot.closePath()
    return new THREE.ExtrudeGeometry([top, bot], { depth: 0.05, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.014, bevelSegments: 3 })
  }, [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const l = live.current
    if (glassMat.current) glassMat.current.emissiveIntensity = 0.55 + 0.25 * Math.sin(t * 2.2) + l.pop * 1.5 + l.hover * 0.8
    if (inner.current) inner.current.rotation.z = t * (0.6 + l.hover * 2)
  })
  return (
    <group>
      <mesh position-z={-0.03}>
        <circleGeometry args={[0.43, seg]} />
        <meshStandardMaterial color={'#0b090c'} metalness={0.7} roughness={0.18} envMapIntensity={1.4} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.45, 0.032, 12, seg * 2]} />
        <meshStandardMaterial color={'#a7b0bb'} metalness={1} roughness={0.26} envMapIntensity={2} />
      </mesh>
      <group ref={inner}>
        <mesh>
          <torusGeometry args={[0.385, 0.006, 6, seg * 2, Math.PI * 1.6]} />
          <meshBasicMaterial color={'#ff2a44'} toneMapped={false} />
        </mesh>
      </group>
      <mesh geometry={geo} position-z={-0.01}>
        <meshPhysicalMaterial ref={glassMat} color={'#e0102b'} emissive={'#e0102b'} emissiveIntensity={0.6} metalness={0.1} roughness={0.12} clearcoat={1} clearcoatRoughness={0.08} envMapIntensity={2} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ 05 · gamma hexagon (Hulk) */
function hexShape(r) {
  const s = new THREE.Shape()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 + (i / 6) * TAU
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  s.closePath()
  return s
}
export function GammaToken({ live, low }) {
  const glyphMat = useRef()
  const crackMat = useRef()
  const geo = useMemo(() => {
    const frameShape = hexShape(0.47)
    const hole = new THREE.Path(hexShape(0.37).getPoints().reverse())
    frameShape.holes.push(hole)
    const frame = new THREE.ExtrudeGeometry(frameShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.016, bevelSegments: 2 })
    const plate = new THREE.ExtrudeGeometry(hexShape(0.37), { depth: 0.025, bevelEnabled: false })
    // the gamma glyph: a V with a loop at its foot, traced as a tube
    const P = [
      [-0.19, 0.2],
      [-0.1, 0.15],
      [-0.035, 0.06],
      [0.01, -0.06],
      [0.035, -0.15],
      [0, -0.215],
      [-0.035, -0.15],
      [-0.01, -0.06],
      [0.035, 0.06],
      [0.1, 0.15],
      [0.19, 0.2],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0.07))
    const glyph = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P, false, 'catmullrom', 0.4), low ? 64 : 128, 0.024, 6, false)
    // glowing fissures on the cracked plate
    const cracks = []
    const C = [
      [
        [-0.33, 0.05],
        [-0.22, 0.02],
        [-0.15, -0.08],
        [-0.05, -0.12],
      ],
      [
        [0.3, -0.16],
        [0.2, -0.1],
        [0.14, 0.02],
        [0.06, 0.06],
      ],
      [
        [-0.12, -0.33],
        [-0.08, -0.25],
        [-0.12, -0.18],
      ],
      [
        [0.08, 0.33],
        [0.12, 0.26],
        [0.21, 0.24],
      ],
    ]
    for (const c of C) cracks.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(c.map(([x, y]) => new THREE.Vector3(x, y, 0.03)), false, 'catmullrom', 0.1), 24, 0.007, 4, false))
    return { frame, plate, glyph, cracks }
  }, [low])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const l = live.current
    const throb = 0.5 + 0.5 * Math.sin(t * 2.6) * Math.sin(t * 0.9)
    if (glyphMat.current) glyphMat.current.emissiveIntensity = 1.6 + throb * 1.1 + l.pop * 3 + l.hover * 2
    if (crackMat.current) crackMat.current.emissiveIntensity = 1.2 + throb * 1.4 + l.pop * 2 + l.hover * 1.5
  })
  return (
    <group>
      <mesh geometry={geo.frame} position-z={-0.035}>
        <meshStandardMaterial color={'#5b2c8c'} metalness={0.8} roughness={0.32} envMapIntensity={1.8} />
      </mesh>
      <mesh geometry={geo.plate} position-z={-0.02}>
        <meshStandardMaterial color={'#13261a'} roughness={0.85} metalness={0.15} flatShading emissive={'#0b2a0e'} emissiveIntensity={0.6} />
      </mesh>
      {geo.cracks.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial ref={i === 0 ? crackMat : undefined} color={'#c6ff9e'} emissive={'#7cff4f'} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      ))}
      <mesh geometry={geo.glyph}>
        <meshStandardMaterial ref={glyphMat} color={'#e4ffd4'} emissive={'#7cff4f'} emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ 06 · spell mandala (Doctor Strange) */
const mandalaVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const mandalaFrag = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  varying vec2 vUv;
  #define TAU 6.2831853
  float ring(float r, float R, float w) { return smoothstep(w, 0.0, abs(r - R)); }
  float sqr(vec2 p, float a, float s, float w) {
    float c = cos(a), si = sin(a);
    p = mat2(c, -si, si, c) * p;
    vec2 d = abs(p) - vec2(s);
    float e = abs(max(d.x, d.y));
    return smoothstep(w, 0.0, e);
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float t = uTime;
    float v = 0.0;
    v += ring(r, 0.94, 0.022) * 1.2;
    v += ring(r, 0.8, 0.012);
    v += ring(r, 0.5, 0.014) * 0.9;
    v += ring(r, 0.3, 0.012) * 0.8;
    // rune band between 0.8 and 0.94: ticks of varying length, rotating
    float ar = fract((a + t * 0.35) / TAU * 48.0);
    float tick = step(0.55, fract(sin(floor((a + t * 0.35) / TAU * 48.0) * 91.7) * 43758.5)) ;
    v += smoothstep(0.82, 0.84, r) * (1.0 - smoothstep(0.9, 0.92, r)) * smoothstep(0.35, 0.1, abs(ar - 0.5)) * (0.4 + 0.6 * tick);
    // two counter-rotating squares + an inner rotating pair
    v += sqr(p, t * 0.4, 0.56, 0.018) * 0.8;
    v += sqr(p, -t * 0.4 + 0.785398, 0.56, 0.018) * 0.8;
    v += sqr(p, t * 0.9, 0.24, 0.014) * 0.7;
    // petal dots on the 0.66 orbit
    float pa = fract((a - t * 0.6) / TAU * 12.0);
    v += smoothstep(0.035, 0.0, length(vec2((pa - 0.5) * 0.35, r - 0.66))) * 1.2;
    // soft glow + fade
    float glow = exp(-abs(r - 0.94) * 9.0) * 0.35 + exp(-r * 3.5) * 0.25;
    vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.82, 0.45), clamp(v * 0.5, 0.0, 1.0));
    float alpha = clamp(v, 0.0, 1.4) + glow;
    gl_FragColor = vec4(col * (1.1 + uPower), alpha * (0.75 + 0.35 * uPower));
  }
`
export function MandalaToken({ live, low }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: mandalaVert,
        fragmentShader: mandalaFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uPower: { value: 0 } },
      }),
    [],
  )
  const gemMat = useRef()
  const frame = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const l = live.current
    mat.uniforms.uTime.value = t * (1 + l.hover * 1.5)
    mat.uniforms.uPower.value = l.pop * 1.2 + l.hover * 0.6 + l.glow * 0.2
    if (gemMat.current) gemMat.current.emissiveIntensity = 1.6 + 0.6 * Math.sin(t * 1.8) + l.pop * 2 + l.hover * 1.5
    if (frame.current) frame.current.rotation.z = -t * 0.15
  })
  return (
    <group>
      <mesh material={mat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={frame}>
        <mesh>
          <torusGeometry args={[0.495, 0.012, 8, low ? 64 : 128]} />
          <meshStandardMaterial color={'#f0c060'} metalness={1} roughness={0.25} emissive={'#ffa63d'} emissiveIntensity={0.25} />
        </mesh>
      </group>
      {/* the eye: an emerald gem in a small gold setting */}
      <mesh position-z={0.03}>
        <torusGeometry args={[0.075, 0.016, 8, 32]} />
        <meshStandardMaterial color={'#e8b34a'} metalness={1} roughness={0.2} envMapIntensity={2.2} />
      </mesh>
      <mesh position-z={0.03} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.06, 20, 16]} />
        <meshStandardMaterial ref={gemMat} color={'#bfffe0'} emissive={'#38f29a'} emissiveIntensity={1.8} toneMapped={false} roughness={0.1} />
      </mesh>
    </group>
  )
}

export const TOKEN_MODELS = [ReactorToken, ShieldToken, HammerToken, HourglassToken, GammaToken, MandalaToken]
