import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import GlowPlane from '../../../three/primitives/GlowPlane'
import HudRing from '../../../three/primitives/HudRing'
import { useScreenAnchor, placeOnScreen } from './rayAnchor'
import { scroll, clamp } from '../../../three/scrollStore'
import { age, easeOutCubic, initXp, disposeAll } from '../signals'
import { experience } from '../../../data/resume'

/* The ledger rail running down the mission files (adapted from the old missions DataRail, re-wired in widow red):
   - gunmetal housing the full height of [data-anchor="xp-rail"], a faint ghost core and an emissive red fill that
     grows from the top as the files scroll (same window as the DOM twin: files top at 60 % → bottom at 60 %)
   - instanced tick marks (lit inside the fill, a scan band sweeps them) and data packets climbing the rail with
     fading trails (count scales with the tier)
   - one node per mission file at its [data-anchor="xp-node-<id>"]: a tiny hourglass (two cones point to point) in a
     red HUD ring that locks on when the file is in view and fires two shockwave rings when the file lands
     (xp.land[i] stamped by the DOM decrypt beat) */

const tmp = new THREE.Object3D()
const col = new THREE.Color()
const RED = new THREE.Color('#ff1834')
const HOT = new THREE.Color('#ffd6db')
const STEEL = new THREE.Color('#a7b0bb')
const MAX_TICKS = 260
const TICK_STEP = 0.25
const TRAIL = 3
const TRAIL_FADE = [1, 0.5, 0.25, 0.1]

function fillAmount() {
  const s = scroll.sections['experience-files']
  if (!s) return 0
  const vh = scroll.vh || window.innerHeight
  return clamp((scroll.y + vh * 0.6 - s.top) / Math.max(1, s.height), 0, 1)
}

function Node({ job, i, rail }) {
  const anchor = useScreenAnchor(`[data-anchor="xp-node-${job.id}"]`)
  const group = useRef()
  const core = useRef()
  const coreMat = useRef()
  const rings = useRef()
  const glow = useRef()
  const shocks = useRef([])
  const ignite = useRef(0)
  const spin = useRef(0)

  useFrame((state, dt) => {
    const a = anchor.current
    const r = rail.current
    const on = a.ok && r.ok && (scroll.sections['experience-files']?.visible ?? 0) > 0.01
    group.current.visible = on
    if (!on) return
    const t = state.clock.elapsedTime
    const x = initXp()
    const s = clamp(r.w * 0.9, 0.3, 0.9)
    placeOnScreen(group.current, a, state.camera)
    group.current.scale.setScalar(s)
    const target = a.inView > 0.4 ? 1 : 0
    ignite.current += (target - ignite.current) * (1 - Math.pow(target ? 0.002 : 0.08, Math.min(dt, 0.05)))
    const ig = ignite.current
    const la = age(x.land?.[i] || 0)
    const flash = la >= 0 && la < 1.4 ? Math.exp(-la * 5) : 0
    const hov = x.hover === i ? 1 : 0
    spin.current += dt * (0.6 + 2.2 * ig + 2 * hov + flash * 12)
    core.current.rotation.set(0, spin.current, 0)
    core.current.scale.setScalar(0.85 + 0.1 * Math.sin(t * 3) + flash * 0.7 + hov * 0.15)
    coreMat.current.emissiveIntensity = 0.3 + 2.2 * ig + flash * 4 + hov
    rings.current.scale.setScalar((1 + (1 - ig) * 1.8) * (1 + flash * 0.3))
    // no point light here (the page keeps a fixed light budget): the additive glow card carries the flash
    const gu = glow.current?.material?.uniforms
    if (gu) gu.uIntensity.value = 0.42 * ig + 0.25 * hov + flash * 1.4
    for (let k = 0; k < 2; k++) {
      const m = shocks.current[k]
      if (!m) continue
      const kk = la < 0 ? -1 : (la - k * 0.14) / (1.1 + k * 0.3)
      if (kk < 0 || kk >= 1) {
        m.visible = false
        continue
      }
      m.visible = true
      m.scale.setScalar(0.05 + easeOutCubic(kk) * (4.4 + k * 1.8))
      m.material.opacity = Math.pow(1 - kk, 2) * (k ? 0.6 : 0.95)
    }
  })

  return (
    <group ref={group} visible={false}>
      <GlowPlane ref={glow} color={'#ff1030'} intensity={0} size={[3.4, 3.4]} softness={2.2} position={[0, 0, -0.4]} />
      <group ref={core}>
        <mesh position={[0, 0.11, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.2, 3]} />
          <meshStandardMaterial ref={coreMat} color={'#ff3a50'} emissive={'#ff1030'} emissiveIntensity={0.3} metalness={0.2} roughness={0.25} toneMapped={false} />
        </mesh>
        <mesh position={[0, -0.11, 0]}>
          <coneGeometry args={[0.16, 0.2, 3]} />
          <meshStandardMaterial color={'#ff3a50'} emissive={'#ff1030'} emissiveIntensity={1.4} metalness={0.2} roughness={0.25} toneMapped={false} />
        </mesh>
      </group>
      <group ref={rings}>
        <HudRing radius={0.44} ticks={36} gauge={0.75} speed={0.5} color={'#ff2a40'} tickLength={0.05} thickness={0.006} />
        <HudRing radius={0.64} ticks={48} gauge={1} speed={-0.25} color={'#a7b0bb'} tilt={0.5} tickLength={0.035} thickness={0.004} />
      </group>
      {[0, 1].map((k) => (
        <mesh key={k} ref={(el) => (shocks.current[k] = el)} visible={false} position={[0, 0, -0.05]}>
          <torusGeometry args={[1, 0.012, 6, 96]} />
          <meshBasicMaterial color={k ? '#a7b0bb' : '#ff2a40'} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export default function LedgerRail({ tier = 'high' }) {
  const count = tier === 'high' ? 110 : tier === 'medium' ? 55 : 28
  const rail = useScreenAnchor('[data-anchor="xp-rail"]')
  const group = useRef()
  const housing = useRef()
  const ghost = useRef()
  const core = useRef()
  const coreMat = useRef()
  const head = useRef()
  const ticks = useRef()
  const packets = useRef()
  const fill = useRef(0)
  const hangingBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1).translate(0, -0.5, 0), [])
  useEffect(() => () => disposeAll(hangingBox), [hangingBox])
  const tickCol = useMemo(() => new Float32Array(MAX_TICKS * 3), [])
  const packCol = useMemo(() => new Float32Array(count * (TRAIL + 1) * 3), [count])
  const data = useMemo(() => {
    const speed = new Float32Array(count)
    const phase = new Float32Array(count)
    const lane = new Float32Array(count)
    const size = new Float32Array(count)
    const tint = new Uint8Array(count)
    for (let i = 0; i < count; i++) {
      speed[i] = 0.05 + Math.pow(Math.random(), 1.6) * 0.26
      phase[i] = Math.random()
      lane[i] = Math.random() * 2 - 1
      size[i] = 0.018 + Math.random() * 0.026
      tint[i] = Math.random() > 0.8 ? 1 : 0
    }
    return { speed, phase, lane, size, tint }
  }, [count])

  useFrame((state, dt) => {
    const a = rail.current
    const on = a.ok && a.inView > 0.02
    group.current.visible = on
    if (!on) return
    const t = state.clock.elapsedTime
    const x = initXp()
    const w = Math.max(a.w, 0.25)
    const h = Math.max(a.h, 1)
    const rw = Math.min(w * 0.06, 0.035)
    placeOnScreen(group.current, a, state.camera)
    fill.current += (fillAmount() - fill.current) * (1 - Math.pow(0.02, Math.min(dt, 0.05)))
    const f = fill.current
    let surge = 0
    for (let i = 0; i < (x.land?.length || 0); i++) {
      const la = age(x.land[i])
      if (la >= 0 && la < 3) surge = Math.max(surge, Math.exp(-la * 2.6))
    }
    housing.current.scale.set(rw, h, rw * 0.8)
    ghost.current.scale.set(rw * 0.45, h, rw * 0.45)
    core.current.position.y = h / 2
    core.current.scale.set(rw * 0.55, Math.max(0.001, f * h), rw * 0.55)
    coreMat.current.emissiveIntensity = 1.6 * (0.85 + 0.15 * Math.sin(t * 5.5)) + surge * 3
    const hy = h / 2 - f * h
    head.current.position.y = hy
    head.current.scale.setScalar(rw * (1.7 + 0.4 * Math.sin(t * 9) + surge * 1.6))

    const n = Math.min(MAX_TICKS, Math.floor(h / TICK_STEP) + 1)
    const scan = (t * 0.12) % 1
    for (let i = 0; i < MAX_TICKS; i++) {
      if (i < n) {
        const frac = (i * TICK_STEP) / h
        const major = i % 4 === 0
        const len = major ? 0.14 : 0.05
        tmp.position.set(major ? 0 : rw * 1.2 + len * 0.5, h / 2 - i * TICK_STEP, 0)
        tmp.scale.set(len, major ? 0.014 : 0.009, 0.01)
        tmp.updateMatrix()
        ticks.current.setMatrixAt(i, tmp.matrix)
        const lit = frac < f ? 1 : 0.18
        const sweep = Math.exp(-Math.pow((frac - scan) * 18, 2))
        col.copy(major ? STEEL : RED).multiplyScalar(lit * (0.8 + 0.2 * Math.sin(t * 3 + i * 0.5)) + sweep * 0.8 + surge * 0.6)
        ticks.current.setColorAt(i, col)
      } else {
        tmp.scale.setScalar(0)
        tmp.updateMatrix()
        ticks.current.setMatrixAt(i, tmp.matrix)
      }
    }
    ticks.current.instanceMatrix.needsUpdate = true
    ticks.current.instanceColor.needsUpdate = true

    const { speed, phase, lane, size, tint } = data
    let k = 0
    for (let i = 0; i < count; i++) {
      const fr = (t * speed[i] + phase[i]) % 1
      const gap = 0.012 + speed[i] * 0.06
      const base = tint[i] ? HOT : RED
      for (let j = 0; j <= TRAIL; j++, k++) {
        const ff = fr - j * gap
        if (ff < 0) {
          tmp.scale.setScalar(0)
          tmp.updateMatrix()
          packets.current.setMatrixAt(k, tmp.matrix)
          continue
        }
        tmp.position.set(lane[i] * rw * 0.9, -h / 2 + ff * h, 0.06)
        tmp.rotation.set(t * 2 + i, t * 1.3 + j * 0.2, 0)
        tmp.scale.setScalar(size[i] * (1 - j * 0.2))
        tmp.updateMatrix()
        packets.current.setMatrixAt(k, tmp.matrix)
        const fromTop = 1 - ff
        const inFill = fromTop < f ? 1 : 0.2
        const flash = Math.exp(-Math.pow((fromTop - f) * 60, 2)) * 1.5
        col.copy(base).multiplyScalar(inFill * TRAIL_FADE[j] * (1 + surge * 1.5) + flash)
        packets.current.setColorAt(k, col)
      }
      tmp.rotation.set(0, 0, 0)
    }
    packets.current.instanceMatrix.needsUpdate = true
    packets.current.instanceColor.needsUpdate = true
  })

  return (
    <>
      <group ref={group} visible={false}>
        <mesh ref={housing}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={'#16181d'} metalness={0.9} roughness={0.35} emissive={'#3a0008'} emissiveIntensity={0.3} envMapIntensity={1.2} />
        </mesh>
        <mesh ref={ghost}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color={'#ff1834'} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh ref={core} geometry={hangingBox}>
          <meshStandardMaterial ref={coreMat} color={'#ffc2ca'} emissive={'#ff1030'} emissiveIntensity={1} roughness={0.4} toneMapped={false} />
        </mesh>
        <mesh ref={head}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial color={[3, 1.6, 1.7]} toneMapped={false} />
        </mesh>
        <instancedMesh ref={ticks} args={[null, null, MAX_TICKS]} frustumCulled={false}>
          <instancedBufferAttribute attach="instanceColor" args={[tickCol, 3]} />
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        <instancedMesh ref={packets} args={[null, null, count * (TRAIL + 1)]} frustumCulled={false}>
          <instancedBufferAttribute attach="instanceColor" args={[packCol, 3]} />
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
      </group>
      {experience.map((job, i) => (
        <Node key={job.id} job={job} i={i} rail={rail} />
      ))}
    </>
  )
}
