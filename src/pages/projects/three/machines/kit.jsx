import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { scroll } from '../../../../three/scrollStore'
import { gamma } from '../../store'
import { COL } from '../gammaConst'

// Shared runtime for the five project machines ("counts are the content"), adapted from the old Roster kit and
// re-skinned for the gamma lab. Each machine lives inside its card's DOM slot (data-anchor="pj-machine-<id>"),
// stays hidden until the DOM card has SMASHED down (gamma.landed[id]), then assembles: parts drop in from above and
// slam home with an overshoot, a shockwave and a small flash, and only then start their looping beat.
// gamma.runBeat = { id, t } (the card's SMASH button) replays the beat.

export const tmp = new THREE.Object3D()
export const DEG = Math.PI / 180
export const FONT_HUD = '/fonts/Rajdhani-SemiBold.ttf'
export const FONT_BIG = '/fonts/Anton-Regular.ttf'

// colour roles: hero = gamma green (numbers, moving parts), hud = pale gamma (lines, labels), drama = purple
export const tone = { hero: COL.green, heroBase: COL.greenBase, hud: COL.lime, drama: COL.purpleHi, metal: '#232a24', metalHi: '#323b33' }
export const HERO = new THREE.Color(COL.green)
export const HUD = new THREE.Color(COL.lime)
export const DRAMA = new THREE.Color(COL.purpleHi)
export const REDUCED = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const ASM_DUR = 1.1
export const ASM_LAND = 0.8

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const lerp = (a, b, t) => a + (b - a) * t
export const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3)
export const easeInQuad = (u) => u * u
export const easeInOut = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2)
export const smooth01 = (x) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t)
}
export const backOut = (k, c = 1.9) => (k <= 0 ? 0 : k >= 1 ? 1 : 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2))
export const hash = (n) => {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
export function writeMatrix(arr, i, x, y, z, s) {
  const o = i * 16
  arr[o] = s
  arr[o + 1] = 0
  arr[o + 2] = 0
  arr[o + 3] = 0
  arr[o + 4] = 0
  arr[o + 5] = s
  arr[o + 6] = 0
  arr[o + 7] = 0
  arr[o + 8] = 0
  arr[o + 9] = 0
  arr[o + 10] = s
  arr[o + 11] = 0
  arr[o + 12] = x
  arr[o + 13] = y
  arr[o + 14] = z
  arr[o + 15] = 1
}
export const rect = (w, h, z = 0) => [
  [-w / 2, -h / 2, z],
  [w / 2, -h / 2, z],
  [w / 2, h / 2, z],
  [-w / 2, h / 2, z],
  [-w / 2, -h / 2, z],
]
export function breathe(lineRef, t, base = 0.4, amp = 0.15, speed = 1.6, phase = 0) {
  const l = lineRef.current
  if (l && l.material) l.material.opacity = base + amp * Math.sin(t * speed + phase)
}

// ---------------------------------------------------------------- camera-aware DOM anchor
// Unlike the shared useAnchor (which assumes the camera looks straight down -z), this one unprojects the DOM
// slot's centre through the live camera, so the page can tilt/dolly the camera and the machines stay glued to
// their cards. The anchor sits on a camera-facing plane `dist` units in front of the camera.
const _v = new THREE.Vector3()
const _f = new THREE.Vector3()
export function useScreenAnchor(selector, dist = 8) {
  const ref = useRef({ ok: false, pos: new THREE.Vector3(), w: 1, h: 1, screenX: 0, screenY: 0, inView: 0, edge: 1 })
  const el = useRef(null)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  useFrame(() => {
    if (!el.current || !el.current.isConnected) el.current = document.querySelector(selector)
    const e = el.current
    const out = ref.current
    // no DOM reads (forced layout) while the lineup is nowhere near the viewport
    const sec = scroll.sections['projects-lineup']
    if (!e || (sec && sec.visible <= 0)) {
      out.ok = false
      return
    }
    const r = e.getBoundingClientRect()
    const W = size.width
    const H = size.height
    out.screenX = r.left + r.width / 2
    out.screenY = r.top + r.height / 2
    const visY = Math.min(r.bottom, H) - Math.max(r.top, 0)
    const visX = Math.min(r.right, W) - Math.max(r.left, 0)
    out.inView = Math.max(0, Math.min(1, visY / Math.max(1, Math.min(r.height, H))))
    out.edge = Math.max(0, Math.min(1, visX / Math.max(1, Math.min(r.width, W))))
    out.ok = r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && r.width > 4
    if (!out.ok) return
    camera.updateMatrixWorld()
    _v.set((out.screenX / W) * 2 - 1, -((out.screenY / H) * 2 - 1), 0.5).unproject(camera).sub(camera.position).normalize()
    camera.getWorldDirection(_f)
    out.pos.copy(camera.position).addScaledVector(_v, dist / Math.max(0.2, _v.dot(_f)))
    const halfH = Math.tan((camera.fov * DEG) / 2) * dist
    const halfW = halfH * (W / H)
    out.w = (r.width / W) * 2 * halfW
    out.h = (r.height / H) * 2 * halfH
  })
  return ref
}

// ---------------------------------------------------------------- impact bus
// One shared flash light (owned by Machines.jsx). Machines write where and how hard they landed.
export const impact = { t: -10, pos: new THREE.Vector3(), power: 0 }
const _l = new THREE.Vector3()
export function fireImpact(m, power = 0.3, lx = 0, ly = 0) {
  scroll.impulse = Math.max(scroll.impulse || 0, power)
  const g = m.group.current
  if (g) {
    _l.set(lx, ly, 0.4)
    g.localToWorld(_l)
    impact.pos.copy(_l)
  }
  impact.t = performance.now() / 1000
  impact.power = power
  m.shock.current?.fire(power, lx, ly)
}

// ---------------------------------------------------------------- machine lifecycle
export function useMachine(id, halfWidth, order) {
  const anchor = useScreenAnchor(`[data-anchor="pj-machine-${id}"]`, 8)
  const group = useRef()
  const labels = useRef()
  const shock = useRef()
  const camera = useThree((s) => s.camera)
  const m = useRef({
    id,
    halfWidth,
    order,
    on: false,
    scale: 1,
    emph: 1,
    rx: 0,
    ry: 0,
    lastBeat: gamma.runBeat ? gamma.runBeat.t : 0,
    asmAt: -1,
    asm: 0,
    asmRaw: 0,
    landed: false,
    parts: [],
    partsDone: false,
    impactAt: [0, 0],
    q: new THREE.Quaternion(),
    e: new THREE.Euler(),
  }).current
  m.anchor = anchor
  m.group = group
  m.labels = labels
  m.shock = shock
  m.camera = camera
  return m
}

function beatPending(m) {
  const b = gamma.runBeat
  return !!b && b.id === m.id && b.t !== m.lastBeat
}

export function placeMachine(m, t, dt) {
  const a = m.anchor.current
  const g = m.group.current
  const sec = scroll.sections['projects-lineup']
  const on = !!g && a.ok && (!sec || sec.visible > 0.02)
  m.on = on
  if (!on) {
    if (g) g.visible = false
    return false
  }
  if (m.asmAt < 0) {
    if (REDUCED) m.asmAt = t - ASM_DUR * 3
    else if (gamma.landed[m.id] || beatPending(m)) m.asmAt = t
  }
  if (m.asmAt < 0) {
    g.visible = false
    return false
  }
  g.visible = true
  m.asmRaw = (t - m.asmAt) / ASM_DUR
  m.asm = clamp01(m.asmRaw)
  if (!m.landed && m.asm >= ASM_LAND) {
    m.landed = true
    if (m.asmRaw < 1.4 && !REDUCED) fireImpact(m, 0.18, m.impactAt[0], m.impactAt[1])
  }
  if (!m.partsDone) driveParts(m)
  const lg = m.labels.current
  if (lg) {
    const k = easeOutCubic(clamp01((m.asmRaw - 0.62) / 0.32))
    lg.visible = k > 0.001
    lg.scale.set(Math.max(k, 0.001), 1, 1)
  }
  // design units: half-height 1, half-width `halfWidth`; fit the smaller of the two
  const s = Math.min(a.h / 2, a.w / 2 / m.halfWidth) * 0.88
  m.scale = s
  g.position.copy(a.pos)
  const k = 1 - Math.pow(0.002, dt)
  const current = gamma.index === m.order
  m.emph += ((current ? 1 : 0.94) - m.emph) * k
  const pop = 0.9 + 0.1 * backOut(clamp01(m.asmRaw / 0.9), 2.2)
  g.scale.setScalar(s * (0.86 + 0.14 * smooth01(a.edge)) * m.emph * pop)
  const h = gamma.hover
  const tx = h && h.id === m.id ? -h.rx * DEG * 0.8 : 0
  const ty = h && h.id === m.id ? h.ry * DEG * 0.8 : 0
  m.rx += (tx - m.rx) * k
  m.ry += (ty - m.ry) * k
  // face the camera (it may be tilted), then the hover tilt + idle sway on top
  m.e.set(m.rx + Math.sin(t * 0.6) * 0.022, m.ry + Math.sin(t * 0.41) * 0.04, 0)
  m.q.setFromEuler(m.e)
  g.quaternion.copy(m.camera.quaternion).multiply(m.q)
  return true
}

export function tookBeat(m) {
  if (!beatPending(m)) return false
  m.lastBeat = gamma.runBeat.t
  return m.asm >= 1
}

function driveParts(m) {
  const a = m.asmRaw
  let done = true
  for (let i = 0; i < m.parts.length; i++) {
    const p = m.parts[i]
    const k = clamp01((a - p.delay) / p.dur)
    if (k < 1) done = false
    const g = p.g
    g.visible = k > 0
    if (k <= 0) continue
    const e = backOut(k, p.overshoot)
    const inv = 1 - e
    g.position.set(p.px + p.from[0] * inv, p.py + p.from[1] * inv, p.pz + p.from[2] * inv)
    g.rotation.set(p.rx + p.spin[0] * inv, p.ry + p.spin[1] * inv, p.rz + p.spin[2] * inv)
    g.scale.setScalar(Math.max(0.001, p.scaleFrom + (1 - p.scaleFrom) * e))
  }
  if (done && a >= 1) m.partsDone = true
}

const ZERO3 = [0, 0, 0]
// Parts drop in from above by default (the gamma lab's SMASH: everything lands from overhead).
const FROM_ABOVE = [0, 2.2, 0]
export function AsmPart({ m, delay = 0, dur = 0.5, from = FROM_ABOVE, spin = ZERO3, scaleFrom = 0.5, overshoot = 1.9, position = ZERO3, rotation = ZERO3, children }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    const part = { g, delay, dur, from, spin, scaleFrom, overshoot, px: position[0], py: position[1], pz: position[2], rx: rotation[0], ry: rotation[1], rz: rotation[2] }
    m.parts.push(part)
    m.partsDone = false
    return () => {
      const i = m.parts.indexOf(part)
      if (i >= 0) m.parts.splice(i, 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m])
  return (
    <group ref={ref} position={position} rotation={rotation}>
      {children}
    </group>
  )
}

// Mono HUD label under each machine (its DOM twin lives in the card: .pj-machine-twin).
export function Label({ children, y = -0.92, size = 0.09, color = tone.hud, spacing = 0.16, ...props }) {
  return (
    <Text font={FONT_HUD} fontSize={size} letterSpacing={spacing} anchorX="center" anchorY="middle" position={[0, y, 0.08]} {...props}>
      {children}
      <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.95} />
    </Text>
  )
}

export const TickRing = forwardRef(function TickRing({ radius = 1, ticks = 48, color = tone.hud, length = 0.07, thickness = 0.012, gauge = 1, ...props }, ref) {
  const inst = useRef()
  const colors = useMemo(() => {
    const c = new Float32Array(ticks * 3)
    const bright = new THREE.Color(color)
    const dim = new THREE.Color(color).multiplyScalar(0.3)
    for (let i = 0; i < ticks; i++) {
      const cc = i / ticks < gauge ? bright : dim
      c[i * 3] = cc.r
      c[i * 3 + 1] = cc.g
      c[i * 3 + 2] = cc.b
    }
    return c
  }, [ticks, gauge, color])
  useLayoutEffect(() => {
    const im = inst.current
    if (!im) return
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2
      const major = i % 6 === 0
      tmp.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
      tmp.rotation.set(0, 0, a)
      tmp.scale.set(major ? length * 1.8 : length, major ? thickness * 1.6 : thickness, thickness)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    }
    im.instanceMatrix.needsUpdate = true
  }, [radius, ticks, length, thickness])
  return (
    <group ref={ref} {...props}>
      <instancedMesh ref={inst} args={[null, null, ticks]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </boxGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  )
})

// Gamma shockwave: a green torus and a trailing purple one race outward while fading.
const SHOCK_DUR = 0.95
export const Shockwave = forwardRef(function Shockwave({ radius = 1.7 }, ref) {
  const group = useRef()
  const rings = useRef([])
  const mats = useRef([])
  const st = useRef({ pending: false, t0: -10, power: 1, active: false }).current
  useImperativeHandle(ref, () => ({
    fire(power = 1, x = 0, y = 0) {
      st.pending = true
      st.power = power
      if (group.current) group.current.position.set(x, y, 0.12)
    },
  }))
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (st.pending) {
      st.pending = false
      st.t0 = t
      st.active = true
      if (group.current) group.current.visible = true
    }
    if (!st.active) return
    let alive = false
    for (let i = 0; i < 2; i++) {
      const mesh = rings.current[i]
      const mat = mats.current[i]
      if (!mesh || !mat) continue
      const u = (t - st.t0 - i * 0.12) / SHOCK_DUR
      if (u < 0) {
        mesh.visible = false
        alive = true
        continue
      }
      if (u >= 1) {
        mesh.visible = false
        continue
      }
      alive = true
      mesh.visible = true
      const r = (0.08 + easeOutCubic(u) * radius * (0.7 + 0.45 * Math.min(1, st.power * 2))) * (i ? 0.82 : 1)
      mesh.scale.set(r, r, r)
      mat.opacity = (1 - u) * (1 - u) * (i ? 0.7 : 0.95)
    }
    if (!alive) {
      st.active = false
      if (group.current) group.current.visible = false
    }
  })
  return (
    <group ref={group} visible={false}>
      {[tone.hero, tone.drama].map((c, i) => (
        <mesh key={i} ref={(el) => (rings.current[i] = el)} visible={false}>
          <torusGeometry args={[1, i ? 0.007 : 0.014, 6, 96]} />
          <meshBasicMaterial ref={(el) => (mats.current[i] = el)} color={c} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
})
