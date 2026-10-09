import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import Amulet from './Amulet'
import Mandala from './Mandala'
import SparkPortal from './SparkPortal'
import TimeSeal from './TimeSeal'
import { Smoke } from './Backdrop'
import GlowPlane from '../../../three/primitives/GlowPlane'
import { scroll, clamp } from '../../../three/scrollStore'
import { useAnchor } from '../../../three/anchor'
import { cert } from '../store'

/*
 * The relic's stage. The amulet is pinned to the viewport (reference style) and blends between one pose per beat,
 * weighted by how much of each DOM section currently covers the viewport — so it glides as you scroll and never
 * jumps. Per-beat pose: screen position (fractions of the visible half-width/height at its depth), depth, scale,
 * yaw/pitch, exploded-view amount, how open the eye is, mandala / spark-crown strength, green (time) amount.
 *
 * Intro (time-based, once): the layers fly in backwards from an explosion (TIME REVERSAL), the spell circle draws
 * itself, the crown of sparks opens like a portal (SLING-RING) with an impact, then the eye opens with a lamp-strike.
 */
const IDS = ['certifications-hero', 'certifications-codex', 'certifications-spells', 'certifications-time', 'certifications-close', 'certifications-next']
const N = IDS.length
// codex callout index -> amulet layer index (see Amulet LAYERS / Codex CALLOUTS)
const CALLOUT_LAYER = [4, 3, 1, 0]
// mobile: the relic rides with a DOM slot per beat instead of hovering pinned (so copy never scrolls across it)
const MOBILE_SLOTS = ['[data-anchor="cert-hero-slot"]', '[data-anchor="cert-codex-slot"]', null, '.cert-time .time-dial-svg', '[data-anchor="cert-close-slot"]', null]
const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]
const TAN = Math.tan(THREE.MathUtils.degToRad(21))

const EMERALD = new THREE.Color('#38f29a')
const ORANGE = new THREE.Color('#ffa63d')
const RIM = new THREE.Color('#ff8a2e')

// pose fields: fx fy z s yaw pitch explode open mandala crown green runes glow
const F = { fx: 0, fy: 1, z: 2, s: 3, yaw: 4, pitch: 5, ex: 6, open: 7, mand: 8, crown: 9, green: 10, runes: 11, glow: 12 }
const NF = 13
function pose(o) {
  const a = new Float32Array(NF)
  for (const k in o) a[F[k]] = o[k]
  return a
}
const DESK = [
  pose({ fx: 0.4, fy: -0.03, z: 0, s: 1.3, yaw: -0.2, pitch: 0.04, ex: 0, open: 1, mand: 1, crown: 1, green: 0, runes: 0.55, glow: 0.45 }),
  pose({ fx: 0.02, fy: -0.12, z: 0, s: 0.92, yaw: -0.78, pitch: 0.16, ex: 1, open: 0.3, mand: 0.75, crown: 0.35, green: 0, runes: 1, glow: 0.7 }),
  pose({ fx: 0.48, fy: -0.05, z: -1.2, s: 0.86, yaw: 0, pitch: 0.02, ex: 0, open: 1, mand: 0.7, crown: 0.8, green: 0, runes: 0.6, glow: 0.55 }),
  pose({ fx: 0.5, fy: -0.02, z: -0.6, s: 0.95, yaw: -0.28, pitch: 0.06, ex: 0, open: 1, mand: 0.18, crown: 0.25, green: 1, runes: 0.9, glow: 0.8 }),
  pose({ fx: 0, fy: 0.54, z: -1.6, s: 0.62, yaw: 0, pitch: 0.1, ex: 0, open: 0.7, mand: 1, crown: 0.9, green: 0.2, runes: 0.7, glow: 0.6 }),
  pose({ fx: 0, fy: 1.75, z: -4, s: 0.6, yaw: 0, pitch: 0.35, ex: 0, open: 0.25, mand: 0.3, crown: 0.3, green: 0, runes: 0.4, glow: 0.4 }),
]
// mobile: fx / fy are ignored (the relic follows MOBILE_SLOTS); z, s and the look come from here
const MOB = [
  pose({ fx: 0, fy: 0.38, z: -0.8, s: 0.56, yaw: 0, pitch: 0.06, ex: 0, open: 1, mand: 1, crown: 1, green: 0, runes: 0.55, glow: 0.45 }),
  pose({ fx: 0, fy: 0.02, z: -1.4, s: 0.5, yaw: -0.7, pitch: 0.14, ex: 1, open: 0.3, mand: 0.6, crown: 0.3, green: 0, runes: 1, glow: 0.7 }),
  pose({ fx: 0, fy: 0.72, z: -6, s: 0.42, yaw: 0, pitch: 0.2, ex: 0, open: 1, mand: 0.3, crown: 0.5, green: 0, runes: 0.6, glow: 0.5 }),
  pose({ fx: 0.0, fy: 0.5, z: -3, s: 0.55, yaw: 0, pitch: 0.05, ex: 0, open: 1, mand: 0.15, crown: 0.2, green: 1, runes: 0.9, glow: 0.8 }),
  pose({ fx: 0, fy: 0.6, z: -2.4, s: 0.52, yaw: 0, pitch: 0.1, ex: 0, open: 0.7, mand: 0.9, crown: 0.8, green: 0.2, runes: 0.7, glow: 0.6 }),
  pose({ fx: 0, fy: 1.75, z: -4, s: 0.5, yaw: 0, pitch: 0.35, ex: 0, open: 0.25, mand: 0.3, crown: 0.3, green: 0, runes: 0.4, glow: 0.4 }),
]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
function strikeAt(u) {
  const n = STRIKE.length - 1
  const x = clamp01(u) * n
  const i = Math.min(Math.floor(x), n - 1)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (x - i)
}

export default function AmuletRig({ tier = 'high', ready = true }) {
  const { size } = useThree()
  const dial = useAnchor(MOBILE_SLOTS[3], 0, { depth: 0, follow: 1 })
  const slot = useAnchor(MOBILE_SLOTS[1], 0, { depth: 0, follow: 1 })
  const heroSlot = useAnchor(MOBILE_SLOTS[0], 0, { depth: 0, follow: 1 })
  const closeSlot = useAnchor(MOBILE_SLOTS[4], 0, { depth: 0, follow: 1 })
  const mSlots = useMemo(() => [heroSlot, slot, null, dial, closeSlot, null], [heroSlot, slot, dial, closeSlot])
  const stage = useRef() // position + scale (no rotation)
  const look = useRef() // amulet rotation (mouse / hover look)
  const mandA = useRef()
  const mandB = useRef()
  const floor = useRef()
  const glowRef = useRef()
  const keyL = useRef()
  const rimL = useRef()
  const fillL = useRef()
  const frontL = useRef()

  const reduced = useMemo(() => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false), [])
  const api = useMemo(() => ({ intro: reduced ? 1 : 0, open: 0, explode: 0, glow: 0.4, runes: 0.5, green: 0, flash: 0, rewind: 0, highlight: -1 }), [reduced])
  const crown = useMemo(() => ({ open: 0, intensity: 1, boost: 0 }), [])
  const seal = useMemo(() => ({ progress: 0, weight: 0, flash: 0, rewind: 0 }), [])
  const sim = useMemo(
    () => ({
      cur: new Float32Array(NF),
      tgt: new Float32Array(NF),
      w: new Float32Array(N),
      started: -1,
      landed: false,
      lastTime: 0,
      rewind: 0,
      yaw: 0,
      pitch: 0,
      x: 0,
      y: 0,
      init: false,
      owner: -1, // mobile: beat whose DOM slot the relic currently rides with
      appear: 1, // mobile: 0..1 scale-in through a portal after jumping to a new slot
      snap: false,
      cam: { x: 0, y: 0, z: 0 },
      camLook: { x: 0, y: 0, z: 0 },
    }),
    [],
  )

  // camera offsets are page-owned: hand them back on unmount
  useEffect(() => {
    scroll.camOffset = sim.cam
    scroll.camLook = sim.camLook
    return () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
    }
  }, [sim])

  const crownCount = tier === 'high' ? 520 : tier === 'medium' ? 280 : 140

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const S = sim
    const mobile = size.width < 960
    const P = mobile ? MOB : DESK
    const vh = scroll.vh || size.height
    const y = scroll.y || 0
    const aspect = size.width / size.height

    // ---- 1. beat weights: how much of each section covers the viewport ----
    let sum = 0
    for (let i = 0; i < N; i++) {
      const s = scroll.sections[IDS[i]]
      let w = 0
      if (s) w = Math.max(0, Math.min(s.top + s.height, y + vh) - Math.max(s.top, y)) / vh
      S.w[i] = w
      sum += w
    }
    if (sum < 0.001) {
      S.w.fill(0)
      S.w[0] = 1
      sum = 1
    }
    for (let k = 0; k < NF; k++) S.tgt[k] = 0
    for (let i = 0; i < N; i++) {
      const w = S.w[i] / sum
      if (w <= 0) continue
      const p = P[i]
      for (let k = 0; k < NF; k++) S.tgt[k] += p[k] * w
    }
    // spells beat: the relic takes the half of the screen the focused card leaves free
    const wSpells = S.w[2] / sum
    if (!mobile && wSpells > 0) {
      const side = cert.focusSide || 1
      S.tgt[F.fx] += (-side * P[2][F.fx] - P[2][F.fx]) * wSpells
      S.tgt[F.yaw] += side * 0.35 * wSpells
    }
    // hero: the eye opens as you begin to scroll
    const heroW = S.w[0] / sum
    const scrolled = clamp01(y / (vh * 0.45))
    S.tgt[F.open] -= heroW * (1 - (0.3 + 0.7 * scrolled))
    const wTime = S.w[3] / sum
    const D = dial.current
    const cz = state.camera.position.z
    const aspectFix = mobile ? 1 : Math.min(1.15, Math.max(0.75, aspect / 1.6))
    // relic + seal are about 3.6 units across: the scale that fits them inside the DOM clock dial
    const dialScale = (D.h * ((cz - P[3][F.z]) / cz) * (mobile ? 0.68 : 0.8)) / 3.6 / aspectFix
    let anchored = false
    if (!mobile) {
      S.owner = -1
      S.appear = 1
      // codex beat: centre the exploded relic in its DOM slot (between the copy and the callouts)
      const wCodex = S.w[1] / sum
      const SL = slot.current
      const gC = wCodex * smooth(0.3, 0.75, wCodex) // only once the codex owns the screen
      if (gC > 0 && SL.ok) {
        const ndcX = (SL.screenX / size.width) * 2 - 1
        const ndcY = clamp(-((SL.screenY / size.height) * 2 - 1), -0.85, 0.85)
        S.tgt[F.fx] += (ndcX - P[1][F.fx]) * gC
        S.tgt[F.fy] += (ndcY - P[1][F.fy]) * gC
      }
      // time beat: centre the relic inside the DOM clock dial
      const gT = wTime * smooth(0.3, 0.75, wTime)
      if (gT > 0 && D.ok && D.inView > 0) {
        const ndcX = (D.screenX / size.width) * 2 - 1
        const ndcY = clamp(-((D.screenY / size.height) * 2 - 1), -0.85, 0.85)
        S.tgt[F.fx] += (ndcX - P[3][F.fx]) * gT
        S.tgt[F.fy] += (ndcY - P[3][F.fy]) * gT
        S.tgt[F.s] += (dialScale - P[3][F.s]) * gT
      }
    } else {
      // mobile: ride with the DOM slot of the beat that owns the screen. When ownership moves on, the relic waits
      // until its old slot has scrolled away, then re-appears in the new slot through a burst of sparks (a
      // sling-ring jump) — so it never sweeps across the copy on a narrow screen.
      let want = -1
      let best = 0.12
      for (let i = 0; i < N; i++) {
        const r = mSlots[i]
        if (!r) continue
        const A = r.current
        if (A.ok && A.inView > best) {
          best = A.inView
          want = i
        }
      }
      if (want >= 0 && S.owner >= 0 && want !== S.owner) {
        const cur = mSlots[S.owner].current
        const curVis = cur.ok ? cur.inView : 0
        if (curVis > 0.02 && best < curVis + 0.15) want = S.owner // hysteresis
      }
      if (want >= 0 && S.owner < 0) {
        S.owner = want
        S.snap = true
        S.appear = 1
      } else if (want >= 0 && want !== S.owner) {
        const cur = mSlots[S.owner].current
        const gone = !cur.ok || cur.inView <= 0.02 || S.appear <= 0.002
        if (gone) {
          S.owner = want
          S.snap = true
          S.appear = reduced ? 1 : 0
          if (!reduced) cert.flashOrange = Math.max(cert.flashOrange, 0.75)
        } else S.appear = Math.max(0, S.appear - dt * 4.5) // close the portal where it is first
      } else if (S.owner >= 0) S.appear = Math.min(1, S.appear + dt * 1.7)
      const o = S.owner
      const A = o >= 0 ? mSlots[o].current : null
      // follow the slot even when it is screens away (useAnchor keeps measuring it; `ok` only means "near"), so
      // after a jump the relic leaves with its slot instead of lingering at its last on-screen spot
      if (A && A.h > 0) {
        anchored = true
        S.tgt[F.fx] = (A.screenX / size.width) * 2 - 1
        S.tgt[F.fy] = clamp(-((A.screenY / size.height) * 2 - 1), -6, 6)
        S.tgt[F.z] = P[o][F.z]
        S.tgt[F.s] = o === 3 ? dialScale : P[o][F.s]
      }
    }

    // ---- 2. smoothing ----
    const k = 1 - Math.pow(0.03, dt)
    if (!S.init) {
      S.cur.set(S.tgt)
      S.init = true
    } else for (let i = 0; i < NF; i++) S.cur[i] += (S.tgt[i] - S.cur[i]) * k
    if (anchored) {
      // glued to the scrolling DOM (only a touch of lag), or jumped there while out of sight
      const kp = S.snap ? 1 : 1 - Math.pow(0.0004, dt)
      S.cur[F.fx] += (S.tgt[F.fx] - S.cur[F.fx]) * kp
      S.cur[F.fy] += (S.tgt[F.fy] - S.cur[F.fy]) * kp
      if (S.snap) {
        S.cur[F.z] = S.tgt[F.z]
        S.cur[F.s] = S.tgt[F.s]
      }
      S.snap = false
    }
    const C = S.cur

    // ---- 3. intro timeline (time-based, once) ----
    if (ready && S.started < 0) S.started = t + 0.35
    const it = S.started < 0 ? -1 : t - S.started
    let introOpen = 1
    let introGlow = 1
    let introMand = 1
    let introCrown = 1
    if (!reduced) {
      api.intro = it < 0 ? 0 : clamp01(it / 1.6)
      introMand = it < 0 ? 0 : clamp01((it - 0.15) / 1.8)
      introCrown = it < 1.45 ? 0 : 1
      introOpen = it < 1.8 ? 0 : 1 - Math.pow(1 - clamp01((it - 1.8) / 0.9), 3)
      introGlow = it < 1.8 ? 0.25 : strikeAt((it - 1.8) / 0.7)
      if (!S.landed && it >= 1.6) {
        S.landed = true
        cert.flash = Math.max(cert.flash, 1)
        cert.flashOrange = 1
        scroll.impulse = Math.max(scroll.impulse || 0, 0.45)
      }
    }

    // flashes decay
    cert.flash *= Math.exp(-dt * 2.4)
    cert.flashOrange *= Math.exp(-dt * 2.8)

    // ---- 4. rewind activity (|d time| while the education record reassembles) ----
    const dTime = Math.abs(cert.time - S.lastTime)
    S.lastTime = cert.time
    S.rewind += (clamp01((dTime / Math.max(dt, 1e-3)) * 1.6) - S.rewind) * (1 - Math.pow(0.05, dt))
    cert.timeVel = S.rewind

    // ---- 5. place the stage ----
    const z = C[F.z]
    const camZ = state.camera.position.z
    const halfH = TAN * (camZ - z)
    const halfW = halfH * aspect
    const bob = Math.sin(t * 0.9) * 0.06
    const g = stage.current
    // mobile portal jump: grows back with a little overshoot (never exactly 0, so nothing degenerates)
    const ap = S.appear
    const appearScale = ap >= 1 ? 1 : Math.max(0.0001, 1 + 2.2 * Math.pow(ap - 1, 3) + 1.2 * Math.pow(ap - 1, 2))
    if (g) {
      // anchored placement includes the camera's drift so the relic stays on its DOM slot
      const ox = anchored ? state.camera.position.x : 0
      const oy = anchored ? state.camera.position.y : 0
      g.position.set(C[F.fx] * halfW + ox, C[F.fy] * halfH + bob + oy, z)
      g.scale.setScalar(C[F.s] * aspectFix * appearScale)
    }

    // ---- 6. look: mouse + idle, or toward the hovered spell card ----
    const mx = scroll.mouse.x
    const my = scroll.mouse.y
    let yawT = C[F.yaw] + mx * 0.32 + Math.sin(t * 0.37) * 0.07
    let pitchT = C[F.pitch] - my * 0.2 + Math.sin(t * 0.53) * 0.04
    const hv = cert.hover
    if (hv >= 0 && cert.cardPos[hv]?.ok && g) {
      const cp = cert.cardPos[hv]
      yawT = clamp((cp.x - g.position.x) * 0.16, -0.75, 0.75)
      pitchT = clamp(-(cp.y - g.position.y) * 0.14, -0.5, 0.5)
    }
    const kl = 1 - Math.pow(0.04, dt)
    S.yaw += (yawT - S.yaw) * kl
    S.pitch += (pitchT - S.pitch) * kl
    if (look.current) look.current.rotation.set(S.pitch, S.yaw, Math.sin(t * 0.45) * 0.03 - mx * 0.04)

    // ---- 7. amulet api ----
    api.open = C[F.open] * introOpen
    api.explode = C[F.ex]
    api.glow = clamp01(C[F.glow] * introGlow + S.rewind * 0.6 + wTime * cert.time * 0.3)
    api.runes = clamp01(C[F.runes] + cert.flashOrange * 0.5)
    api.green = clamp01(C[F.green] + S.rewind * 0.5 + cert.flash * 0.6)
    api.flash = cert.flash
    api.rewind = S.rewind
    api.highlight = cert.hoverCodex >= 0 ? (CALLOUT_LAYER[cert.hoverCodex] ?? -1) : -1

    // ---- 8. mandalas, crown, seal ----
    const mand = C[F.mand] * introMand
    if (mandA.current) {
      const u = mandA.current.material.uniforms
      u.uReveal.value = introMand
      u.uIntensity.value = 0.34 * mand + cert.flashOrange * 0.4
      mandA.current.userData.speed = 0.06 - S.rewind * 1.2 + Math.abs(scroll.velocity || 0) * 0.004
      u.uColor.value.copy(ORANGE).lerp(EMERALD, clamp01(C[F.green] * 0.9))
    }
    if (mandB.current) {
      const u = mandB.current.material.uniforms
      u.uReveal.value = clamp01(introMand * 1.3 - 0.3)
      u.uIntensity.value = 0.24 * mand
      mandB.current.userData.speed = -0.11 - S.rewind * 0.8
    }
    if (floor.current) {
      const u = floor.current.material.uniforms
      u.uReveal.value = clamp01(introMand * 1.5 - 0.5)
      u.uIntensity.value = 0.24 * mand * (1 - C[F.ex] * 0.6)
    }
    crown.open = introCrown ? 1 + cert.flashOrange * 0.35 : 0
    crown.intensity = (0.22 + 0.42 * C[F.crown]) * (1 + cert.flashOrange * 1.5)
    crown.boost = cert.flashOrange + Math.min(1, Math.abs(scroll.velocity || 0) / 40)
    seal.progress = cert.time
    seal.weight = clamp01((wTime - 0.12) * 2.2)
    seal.flash = cert.flash
    seal.rewind = S.rewind

    // camera: a slow dolly into the codex (exploded view) and a touch toward the time seal
    S.cam.z = -0.9 * (S.w[1] / sum) - 0.4 * wTime
    S.cam.y = 0.15 * (S.w[4] / sum)

    // ---- 9. light ----
    const L = keyL.current
    if (L && g) {
      L.position.set(g.position.x + 3.2, g.position.y + 3.4, g.position.z + 4.5)
      L.intensity = 95 * (0.6 + 0.4 * introMand)
    }
    if (rimL.current && g) {
      rimL.current.position.set(g.position.x - 0.4, g.position.y + 0.8, g.position.z - 1.8)
      rimL.current.intensity = (26 * mand + cert.flashOrange * 50) * ap
      rimL.current.color.copy(RIM).lerp(EMERALD, clamp01(C[F.green]))
    }
    if (fillL.current && g) {
      fillL.current.position.set(g.position.x - 4.5, g.position.y - 1.2, g.position.z + 3)
      fillL.current.intensity = 30
    }
    if (frontL.current && g) {
      frontL.current.position.set(g.position.x - 0.6, g.position.y + 1.4, g.position.z + 5.5)
      frontL.current.intensity = 70 * (0.5 + 0.5 * introMand)
    }
    if (glowRef.current && g) glowRef.current.position.set(g.position.x * 0.9, g.position.y * 0.9, z - 2.4)
  })

  const hi = tier === 'high'
  return (
    <>
      <pointLight ref={keyL} color="#ffd9a6" intensity={40} distance={16} decay={2} />
      <pointLight ref={rimL} color="#ff8a2e" intensity={20} distance={9} decay={2} />
      <pointLight ref={fillL} color="#8a4dff" intensity={24} distance={14} decay={2} />
      <pointLight ref={frontL} color="#ffe2b8" intensity={50} distance={14} decay={2} />

      {/* cinematic haze around the relic */}
      <group ref={glowRef}>
        <GlowPlane color="#ff8a2e" intensity={0.14} size={[10, 10]} softness={2.4} />
        <GlowPlane color="#7b2cbf" intensity={0.14} size={[24, 15]} position={[0, -1, -2]} softness={1.6} />
        {tier !== 'low' ? <Smoke intensity={0.32} size={[14, 9]} position={[0, -0.6, 0.5]} /> : null}
      </group>

      <group ref={stage}>
        {/* spell circles: a big one behind, a counter-rotating tilted one, and a floor sigil under the relic */}
        <Mandala ref={mandA} radius={2.7} seed={1} cells={72} speed={0.06} intensity={0} reveal={0} position={[0, 0, -1.1]} />
        {tier !== 'low' ? <Mandala ref={mandB} radius={1.9} seed={4} cells={48} detail={0} speed={-0.11} intensity={0} reveal={0} position={[0, 0, -0.7]} rotation={[0.32, -0.2, 0]} /> : null}
        <Mandala ref={floor} radius={1.85} seed={9} cells={56} speed={0.09} intensity={0} reveal={0} position={[0, -1.7, 0.2]} rotation={[-1.3, 0, 0]} />

        {/* crown of sparks round the medallion (opens like a portal on arrival) */}
        <SparkPortal state={crown} count={crownCount} radius={1.28} size={0.075} speed={0.5} gravity={0.6} life={1.0} spin={1.4} seed={3} position={[0, 0, -0.05]} ring={hi} />

        <group ref={look}>
          <Amulet api={api} tier={tier} />
        </group>

        <TimeSeal state={seal} tier={tier} />
      </group>
    </>
  )
}

