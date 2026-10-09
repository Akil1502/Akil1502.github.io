import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { COL, rng } from './gammaConst'

// SMASH visuals at a point on the ground (pool of 3, oldest is recycled):
//  · a flat gamma shockwave ring + a trailing purple ring racing across the ground
//  · a translucent dust wall (open cylinder) expanding with the front
//  · rock chips + green sparks thrown up on ballistic arcs (GPU: positions are computed in the vertex shader)
//  · slow dust puffs rolling outward
// fire(x, y, z, power, big) in ground-group space. Idle cost: early-outs; nothing is allocated per frame.

const POOL = 3

const chipVert = /* glsl */ `
  attribute vec3 aVel;
  attribute float aSeed;
  uniform float uTime;
  uniform float uT0;
  uniform float uPower;
  uniform float uPR;
  uniform vec3 uOrigin;
  varying float vA;
  varying float vSeed;
  void main() {
    float age = uTime - uT0;
    float life = 0.8 + aSeed * 0.9;
    vec3 v = aVel * (0.65 + uPower * 0.7);
    vec3 p = uOrigin + v * age + vec3(0.0, -6.5 * age * age, 0.0);
    p.y = max(p.y, uOrigin.y - 0.2);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vA = (age > 0.0 && age < life) ? pow(1.0 - age / life, 1.3) : 0.0;
    vSeed = aSeed;
    gl_PointSize = vA > 0.0 ? (2.0 + aSeed * aSeed * 9.0) * uPR * (12.0 / max(-mv.z, 1.0)) : 0.0;
  }
`
const chipFrag = /* glsl */ `
  uniform vec3 uGreen;
  varying float vA;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // most are hot gamma sparks, a third are dark rock chips with a lit edge
    float rock = step(0.66, vSeed);
    vec3 spark = mix(uGreen * 2.2, vec3(1.6, 2.0, 1.4), smoothstep(0.25, 0.0, d));
    vec3 chip = mix(vec3(0.05, 0.07, 0.05), uGreen * 0.8, smoothstep(0.2, 0.5, d));
    vec3 col = mix(spark, chip, rock);
    float a = vA * mix(smoothstep(0.5, 0.0, d), 1.0, rock);
    gl_FragColor = vec4(col * a, a);
  }
`
const puffVert = /* glsl */ `
  attribute vec3 aVel;
  attribute float aSeed;
  uniform float uTime;
  uniform float uT0;
  uniform float uPower;
  uniform float uPR;
  uniform vec3 uOrigin;
  varying float vA;
  varying float vSeed;
  void main() {
    float age = uTime - uT0;
    float life = 1.6 + aSeed * 1.4;
    float e = 1.0 - exp(-age * 2.2);
    vec3 p = uOrigin + aVel * e * (0.8 + uPower * 0.8) + vec3(0.0, age * 0.35, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float k = age / life;
    vA = (age > 0.0 && k < 1.0) ? smoothstep(0.0, 0.08, k) * (1.0 - k) * (1.0 - k) : 0.0;
    vSeed = aSeed;
    gl_PointSize = vA > 0.0 ? (60.0 + aSeed * 120.0) * (0.6 + e * 0.8) * uPR * (8.0 / max(-mv.z, 1.0)) : 0.0;
  }
`
const puffFrag = /* glsl */ `
  uniform vec3 uDust;
  varying float vA;
  varying float vSeed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float n = 0.75 + 0.25 * sin(c.x * 19.0 + vSeed * 30.0) * sin(c.y * 17.0 - vSeed * 21.0);
    float a = smoothstep(0.5, 0.05, d) * vA * 0.32 * n;
    gl_FragColor = vec4(uDust, a);
  }
`
const ringVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const ringFrag = /* glsl */ `
  uniform float uK;
  uniform float uPower;
  uniform vec3 uGreen;
  uniform vec3 uPurple;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float R = uK;
    float a = exp(-pow((d - R) * 22.0, 2.0)) * 1.6 + exp(-pow((d - R * 0.86) * 12.0, 2.0)) * 0.5;
    float p = exp(-pow((d - R * 0.7) * 16.0, 2.0)) * 0.7;
    float fade = (1.0 - uK) * (1.0 - uK) * uPower;
    vec3 col = uGreen * a + uPurple * p;
    gl_FragColor = vec4(col * fade, 1.0);
  }
`
const wallVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const wallFrag = /* glsl */ `
  uniform float uK;
  uniform float uPower;
  uniform vec3 uGreen;
  varying vec2 vUv;
  void main() {
    float n = 0.6 + 0.4 * sin(vUv.x * 80.0 + vUv.y * 9.0) * sin(vUv.x * 37.0 - vUv.y * 13.0 + uK * 6.0);
    float a = pow(1.0 - vUv.y, 2.2) * n * (1.0 - uK) * uPower * 0.55;
    gl_FragColor = vec4(uGreen * a, 1.0);
  }
`

function burstGeometry(n, seed, puff) {
  const r = rng(seed)
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  const sd = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2
    if (puff) {
      const s = 1.2 + r() * 2.6
      vel[i * 3] = Math.cos(a) * s
      vel[i * 3 + 1] = 0.1 + r() * 0.7
      vel[i * 3 + 2] = Math.sin(a) * s
    } else {
      const up = 3 + r() * 6.5
      const out = 0.8 + r() * 3.4
      vel[i * 3] = Math.cos(a) * out
      vel[i * 3 + 1] = up
      vel[i * 3 + 2] = Math.sin(a) * out
    }
    sd[i] = r()
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1))
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
  return g
}

const SmashFX = forwardRef(function SmashFX({ tier }, ref) {
  const chipN = tier === 'high' ? 220 : tier === 'medium' ? 120 : 60
  const puffN = tier === 'high' ? 26 : tier === 'medium' ? 16 : 8
  const pr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1
  const green = useMemo(() => new THREE.Color(COL.green), [])
  const purple = useMemo(() => new THREE.Color(COL.purpleHi), [])
  const slots = useMemo(
    () =>
      Array.from({ length: POOL }, (_, i) => {
        const common = { uTime: { value: 0 }, uT0: { value: -100 }, uPower: { value: 1 }, uPR: { value: pr }, uOrigin: { value: new THREE.Vector3() } }
        const chipMat = new THREE.ShaderMaterial({
          vertexShader: chipVert,
          fragmentShader: chipFrag,
          uniforms: { ...common, uGreen: { value: green } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const puffMat = new THREE.ShaderMaterial({
          vertexShader: puffVert,
          fragmentShader: puffFrag,
          uniforms: { ...common, uDust: { value: new THREE.Color(COL.dust) } },
          transparent: true,
          depthWrite: false,
        })
        const ringMat = new THREE.ShaderMaterial({
          vertexShader: ringVert,
          fragmentShader: ringFrag,
          uniforms: { uK: { value: 1 }, uPower: { value: 0 }, uGreen: { value: green }, uPurple: { value: purple } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        })
        const wallMat = new THREE.ShaderMaterial({
          vertexShader: wallVert,
          fragmentShader: wallFrag,
          uniforms: { uK: { value: 1 }, uPower: { value: 0 }, uGreen: { value: green } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          toneMapped: false,
        })
        return {
          common,
          chipMat,
          puffMat,
          ringMat,
          wallMat,
          chipGeo: burstGeometry(chipN, 11 + i * 7, false),
          puffGeo: burstGeometry(puffN, 91 + i * 5, true),
          t0: -100,
          power: 1,
          big: false,
          pos: new THREE.Vector3(),
          ring: null,
          wall: null,
          group: null,
        }
      }),
    [chipN, puffN, pr, green, purple],
  )
  const next = useRef(0)
  const clock = useRef(0)
  // the dust wall stands ON the ground: an open cylinder whose base sits at y = 0
  const wallGeo = useMemo(() => new THREE.CylinderGeometry(1, 1.15, 1, 48, 1, true).translate(0, 0.5, 0), [])
  // hand-made GPU resources leave with the page
  useEffect(() => () => wallGeo.dispose(), [wallGeo])
  useEffect(
    () => () =>
      slots.forEach((s) => {
        for (const r of [s.chipMat, s.puffMat, s.ringMat, s.wallMat, s.chipGeo, s.puffGeo]) r.dispose()
      }),
    [slots],
  )

  useImperativeHandle(ref, () => ({
    fire(x, y, z, power = 1, big = false) {
      const s = slots[next.current]
      next.current = (next.current + 1) % POOL
      s.t0 = clock.current
      s.power = power
      s.big = big
      s.pos.set(x, y, z)
      s.common.uT0.value = clock.current
      s.common.uPower.value = power
      s.common.uOrigin.value.set(x, y + 0.05, z)
      if (s.group) s.group.visible = true
    },
  }))

  useFrame((state) => {
    const t = state.clock.elapsedTime
    clock.current = t
    for (const s of slots) {
      s.common.uTime.value = t
      const age = t - s.t0
      const alive = age >= 0 && age < 3.2
      if (s.group) s.group.visible = alive
      if (!alive) continue
      const dur = s.big ? 1.6 : 1.15
      const k = Math.min(1, age / dur)
      const e = 1 - Math.pow(1 - k, 3)
      const R = (s.big ? 13 : 8) * (0.55 + 0.45 * s.power)
      if (s.ring) {
        s.ring.position.set(s.pos.x, s.pos.y + 0.12, s.pos.z)
        s.ring.scale.setScalar(R)
        s.ringMat.uniforms.uK.value = e
        s.ringMat.uniforms.uPower.value = k >= 1 ? 0 : 1.4 * s.power
      }
      if (s.wall) {
        const wr = 0.3 + e * R * 0.42
        s.wall.position.set(s.pos.x, s.pos.y, s.pos.z)
        s.wall.scale.set(wr, (0.4 + e * 1.4) * (s.big ? 1.4 : 1), wr)
        s.wallMat.uniforms.uK.value = Math.min(1, age / (dur * 0.9))
        s.wallMat.uniforms.uPower.value = age > dur * 0.9 ? 0 : s.power
      }
    }
  })

  return (
    <group>
      {slots.map((s, i) => (
        <group key={i} ref={(el) => (s.group = el)} visible={false}>
          <mesh ref={(el) => (s.ring = el)} rotation={[-Math.PI / 2, 0, 0]} material={s.ringMat} frustumCulled={false} renderOrder={2}>
            <planeGeometry args={[2, 2]} />
          </mesh>
          <mesh ref={(el) => (s.wall = el)} geometry={wallGeo} material={s.wallMat} frustumCulled={false} renderOrder={3} />
          <points geometry={s.puffGeo} material={s.puffMat} frustumCulled={false} renderOrder={4} />
          <points geometry={s.chipGeo} material={s.chipMat} frustumCulled={false} renderOrder={5} />
        </group>
      ))}
    </group>
  )
})

export default SmashFX
