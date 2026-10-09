import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAnchor } from '../../three/anchor'
import { scroll, clamp, lerp, smoothstep } from '../../three/scrollStore'
import { TEAM, HERO, SEC, arriveK, arriveStart, heroProgress, sectionEnter, sectionLeave, lampStrike, STRIKE_T, easeOutCubic, easeInOut, backOut, bump } from './timeline'
import Beacon from './three/Beacon'
import Smoke from './three/Smoke'
import { Portals, Shockwaves, TokenGlows, PORTALS, SHOCKS } from './three/Portals'
import { TOKEN_MODELS } from './three/Tokens'

// CONTACT · AVENGERS ASSEMBLE — the 3D director.
//
// One mutable record (`dir`) is computed here every frame BEFORE anything else draws (useFrame priority -1); the
// beacon, portals, sparks, shockwaves, glows and the six tokens only read it. Choreography:
//
//   HERO (pinned, scroll-scrubbed)  the gold beacon idles in smoke with six empty sockets → six SLING-RING PORTALS
//       spin open around the screen edges, one hero token flies out of each and locks into its socket (impact,
//       shockwave, socket lights up in that hero's colour) → IGNITION: lamp-strike, light pillar, camera shake →
//       the formation lies down into the "team circle" and the camera orbits it while LET'S ASSEMBLE slams in.
//   CHANNELS (timed transits)  each contact card opens a portal; its token dives into a portal at the formation and
//       pops out of a portal in the card's emblem slot. Scrolling back reverses the trip — every hop is a portal.
//   CALL  the beacon comes back face-on around the big email; every token portals home into the formation.
//       Hovering the email: all six lean in toward the core and the vortex surges.
//   CREDITS  the formation lies down and sinks behind the end credits, still orbiting.

const TAU = Math.PI * 2
const SLOT_Z = 1.2 // card slots are mapped onto this plane
const TRANSIT = 1.15 // seconds for one portal hop
const WARM_FRAMES = 4 // draw every token for a few frames at mount so its shaders compile behind the transition
const HERO_ANGLES = TEAM.map((_, i) => Math.PI / 2 - (i * TAU) / 6) // clockwise from the top
const CALL_SHIFT = Math.PI / 6 // call formation: nobody sits dead-centre above/below the email
const REDUCED = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const impulse = (v) => {
  if (!REDUCED) scroll.impulse = Math.max(scroll.impulse || 0, v)
}

function makeDirector() {
  const tokens = TEAM.map(() => ({
    pos: new THREE.Vector3(0, 0, -50),
    rot: new THREE.Euler(),
    scale: 0,
    loc: 'stage',
    transit: null,
    prevK: 0,
    landAt: -10,
    socket: 0,
    hoverSpin: 0,
    live: { glow: 0, hover: 0, pop: 0 },
  }))
  return {
    active: true,
    frame: 0,
    scrollY: 0,
    impulse: 0,
    smoke: 0.5,
    smokeWarm: 0,
    focusU: 0.6,
    focusV: 0.5,
    stage: {
      x: 0,
      y: 0,
      z: 0,
      tilt: 0,
      rx: 0,
      ry: 0,
      scale: 1,
      rx0: 2.3,
      ry0: 2.3,
      angles: HERO_ANGLES.slice(),
      spin: 0,
      power: 0,
      glow: 0,
      hover: 0,
      strike: 0,
      velocity: 0,
      formed: 1,
      vis: 1,
      haze: 1,
      floor: 0,
      pillar: 0,
      ringVis: 1,
      socketScale: 1,
      tokenSize: 1,
    },
    tokens,
    portals: Array.from({ length: PORTALS }, () => ({ x: 0, y: 0, z: 0, r: 0.5, open: 0 })),
    shocks: Array.from({ length: SHOCKS }, () => ({ x: 0, y: 0, z: 0, size: 1, at: -1, dur: 1, color: '#ffffff', dirty: true })),
    shockNext: 0,
    st: { ignited: false, igniteAt: -10, igShock: false, callDone: false, callAt: -10, emailAt: -10, wasEmail: false, hover: 0, phi: 0 },
  }
}

// Schedules a shockwave (`at` may be in the future: it starts then).
function fireShock(d, at, x, y, z, size, color, dur = 1.1) {
  const s = d.shocks[d.shockNext]
  d.shockNext = (d.shockNext + 1) % SHOCKS
  s.x = x
  s.y = y
  s.z = z
  s.size = size
  s.at = at
  s.dur = dur
  if (s.color !== color) {
    s.color = color
    s.dirty = true
  }
}

function beginTransit(tk, to, t) {
  if (tk.transit) return
  tk.transit = { from: tk.loc, to, t0: t, landed: false }
  tk.loc = to
}

// Idle pose: face the camera, follow the mouse a little, each hero with its own tic.
function idleRot(tk, i, t, mx, my, onStage) {
  tk.rot.set(-my * 0.25 + Math.sin(t * 0.7 + i) * 0.06, mx * 0.35 + Math.sin(t * 0.5 + i * 1.7) * 0.22, Math.sin(t * 0.4 + i) * 0.04)
  if (i === 1) tk.rot.y += Math.sin(t * 0.45) * 0.55 // the shield turns to catch the light
  if (i === 2) tk.rot.y += t * 0.35 * (onStage ? 0.6 : 1) // the hammer slowly rotates
  if (i === 4) tk.rot.y += Math.sin(t * 0.6) * 0.35
}

// Live pose of token i "on the stage": its formation slot, or (hero arrival, k < 1) its flight out of an edge portal.
function stagePose(out, d, w, i, k, p, t, mx, my, lean) {
  const s = d.stage
  const tk = d.tokens[i]
  const slot = w.slot[i]
  const own = !tk.transit && tk.loc === 'stage'
  if (k >= 1 || p >= 0.999) {
    out.x = slot.x
    out.y = slot.y
    out.z = slot.z
    out.s = s.tokenSize
    if (own) {
      idleRot(tk, i, t, mx, my, true)
      const a = s.angles[i]
      // standing in the circle: still facing the camera, turned slightly outward
      tk.rot.y += Math.cos(a) * 0.5 * Math.sin(s.tilt)
      // lean in toward the core on email hover
      tk.rot.y += -Math.cos(a) * 0.55 * lean
      tk.rot.x += Math.sin(a) * 0.45 * lean
      tk.rot.z += -Math.cos(a) * 0.12 * lean
    }
    return
  }
  // in flight from its edge portal: a swooping quadratic Bézier toward the camera, tumbling as it comes
  const E = w.edge[i]
  const e = easeOutCubic(k)
  const cx = (E.x + slot.x) * 0.5 - (slot.y - E.y) * 0.25
  const cy = (E.y + slot.y) * 0.5 + (slot.x - E.x) * 0.25
  const cz = 2.4
  const u1 = 1 - e
  out.x = u1 * u1 * E.x + 2 * u1 * e * cx + e * e * slot.x
  out.y = u1 * u1 * E.y + 2 * u1 * e * cy + e * e * slot.y
  out.z = u1 * u1 * E.z + 2 * u1 * e * cz + e * e * slot.z
  out.s = s.tokenSize * smoothstep(0, 0.22, k) * (1 + 0.25 * Math.sin(k * Math.PI))
  if (own) tk.rot.set((1 - e) * 0.9, (1 - e) * TAU * 1.25, (1 - e) * (i % 2 ? 1.4 : -1.4))
}

// One token rig: places its model from the director record.
function TokenRig({ dir, i, low }) {
  const g = useRef()
  const Model = TOKEN_MODELS[i]
  const live = useMemo(() => ({ current: dir.current.tokens[i].live }), [dir, i])
  useFrame(() => {
    const d = dir.current
    const tk = d.tokens[i]
    const o = g.current
    if (!o) return
    if (d.frame <= WARM_FRAMES) {
      // shader warm-up: drawn tiny for a few frames so every program compiles behind the loader / transition
      o.visible = true
      o.position.set(0, 0, 4)
      o.scale.setScalar(0.001)
      return
    }
    const vis = d.active && tk.scale > 0.004
    o.visible = vis
    if (!vis) return
    o.position.copy(tk.pos)
    o.rotation.copy(tk.rot)
    o.scale.setScalar(tk.scale)
  })
  return (
    <group ref={g}>
      <Model live={live} low={low} />
    </group>
  )
}

export default function ContactScene({ tier = 'high', ready = true }) {
  const low = tier === 'low'
  const dir = useRef(null)
  if (!dir.current) dir.current = makeDirector()
  const { camera } = useThree()

  // DOM slots: one emblem slot per channel card + the call-section crest
  const a0 = useAnchor('[data-anchor="ct-slot-0"]', 0, { depth: SLOT_Z, follow: 1 })
  const a1 = useAnchor('[data-anchor="ct-slot-1"]', 0, { depth: SLOT_Z, follow: 1 })
  const a2 = useAnchor('[data-anchor="ct-slot-2"]', 0, { depth: SLOT_Z, follow: 1 })
  const a3 = useAnchor('[data-anchor="ct-slot-3"]', 0, { depth: SLOT_Z, follow: 1 })
  const a4 = useAnchor('[data-anchor="ct-slot-4"]', 0, { depth: SLOT_Z, follow: 1 })
  const a5 = useAnchor('[data-anchor="ct-slot-5"]', 0, { depth: SLOT_Z, follow: 1 })
  const slots = useMemo(() => [a0, a1, a2, a3, a4, a5], [a0, a1, a2, a3, a4, a5])
  const crest = useAnchor('[data-anchor="ct-call-crest"]', 0, { depth: 0, follow: 0.9 })

  const colors = useMemo(() => TEAM.map((m) => m.color), [])
  const work = useMemo(() => {
    const obj = new THREE.Object3D()
    obj.rotation.order = 'YXZ'
    return {
      obj,
      slot: TEAM.map(() => new THREE.Vector3()),
      edge: TEAM.map(() => new THREE.Vector3()),
      camOffset: { x: 0, y: 0, z: 0 },
      camLook: { x: 0, y: 0, z: 0 },
      S: { x: 0, y: 0, z: 0, s: 0 },
      C: { x: 0, y: 0, z: 0, s: 0 },
      fadeEl: null,
    }
  }, [])

  // never leave the shared camera steered after leaving the page
  useEffect(
    () => () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
    },
    [],
  )

  useFrame((state, dtRaw) => {
    const d = dir.current
    d.frame++
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const W = state.size.width
    const H = state.size.height
    const aspect = W / Math.max(1, H)
    const narrow = W < 960
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const halfH0 = tan * 10
    const halfW0 = halfH0 * aspect
    const mx = scroll.mouse.x
    const my = scroll.mouse.y
    d.scrollY = scroll.y || 0
    d.impulse = scroll.impulse || 0
    const s = d.stage
    const st = d.st
    s.velocity = Math.min(Math.abs(scroll.velocity || 0) / 60, 1)

    // ---------------------------------------------------------------- scroll phases
    const p = heroProgress() // pinned hero 0..1
    const r1 = sectionEnter(SEC.channels, 0.95, 0.25) // channels arriving → stage recedes
    const c1 = sectionEnter(SEC.call, 0.95, 0.2) // call arriving → stage returns face-on
    const k3 = sectionLeave(SEC.call, 0.75, 0.05) // call leaving → stage sinks behind the credits
    const tiltK = easeInOut(smoothstep(HERO.tilt0, HERO.tilt1, p))
    const openK = 1 - smoothstep(0.03, HERO.arriveStart, p) // opening composition (stage off to the right)

    // ---------------------------------------------------------------- ignition (one-shot per forward crossing)
    if (!st.ignited && p >= HERO.ignite && ready) {
      st.ignited = true
      st.igniteAt = t
      impulse(0.6)
    }
    if (st.ignited && p < HERO.ignite - 0.03) st.ignited = false
    const sinceIgnite = t - st.igniteAt
    const heroPower = st.ignited ? lampStrike(sinceIgnite) : 0
    const strikeIgnite = st.ignited && sinceIgnite < STRIKE_T + 0.4 ? lampStrike(sinceIgnite) * smoothstep(STRIKE_T + 0.4, STRIKE_T - 0.1, sinceIgnite) : 0
    let landed = 0
    for (let i = 0; i < 6; i++) if (arriveK(p, i) >= 1) landed++

    // email hover (lean-in + vortex surge)
    const emailOn = scroll.ctEmail === 1 ? 1 : 0
    st.hover += (emailOn - st.hover) * (1 - Math.pow(0.004, dt))
    if (emailOn && !st.wasEmail) st.emailAt = t
    st.wasEmail = !!emailOn
    const emailStrike = Math.max(0, 1 - (t - st.emailAt) / 0.6)

    // ---------------------------------------------------------------- stage pose (blend of scrubbed configs)
    // HERO: opening (right of the statement) → centred for the arrivals → lying down + orbiting
    const heroScale = narrow ? Math.min(0.6, (halfW0 * 0.9) / 2.9) : 1
    let x = narrow ? 0 : lerp(0, Math.min(3.1, halfW0 * 0.36), openK)
    let y = narrow ? lerp(0.15, -0.75, openK) : lerp(0.12, -0.2, openK)
    // lying down, the circle sits low so LET'S ASSEMBLE and its line of copy stay clear above the back token
    y = lerp(y, narrow ? -1.6 : -2.2, tiltK)
    let z = 0
    let scale = heroScale * lerp(lerp(0.95, 0.88, openK), narrow ? 1.02 : 0.86, tiltK)
    let tilt = 1.33 * tiltK
    let rx0 = lerp(2.3, 2.5, tiltK)
    let ry0 = rx0
    let angleShift = 0
    let power = Math.max(0.14 + landed * 0.05, heroPower)
    let pillar = tiltK * heroPower
    let floor = tiltK * 0.9
    let ringVis = 1
    // orbit: the 360° circle shot (scroll) + a slow idle drift once lying down
    st.phi += dt * 0.07 * tiltK
    let phi = smoothstep(HERO.orbit0, 1, p) * TAU * 0.6 + st.phi
    let tokenSize = narrow ? 0.5 : lerp(0.9, 0.82, tiltK)
    // CHANNELS: recede deep behind the cards, lying down
    if (r1 > 0) {
      x = lerp(x, 0, r1)
      y = lerp(y, narrow ? 0.2 : -0.6, r1)
      z = lerp(z, -7.5, r1)
      scale = lerp(scale, narrow ? 1.1 : 1.5, r1)
      tilt = lerp(tilt, 1.2, r1)
      power = lerp(power, 0.5, r1)
      pillar = lerp(pillar, 0.3, r1)
      floor = lerp(floor, 0.55, r1)
      ringVis = lerp(1, 0.5, r1)
      rx0 = lerp(rx0, 2.2, r1)
      ry0 = lerp(ry0, 2.2, r1)
      tokenSize = lerp(tokenSize, narrow ? 0.34 : 0.5, r1)
    }
    // CALL: back to face-on around the big email (or a crest above it on phones)
    const ca = crest.current
    if (c1 > 0 && ca.ok && ca.w > 0.1 && ca.h > 0.1) {
      const callScale = narrow ? clamp(ca.w * 0.16, 0.3, 0.62) : 1
      const callRx = narrow ? Math.min(ca.w, ca.h) * 0.36 : clamp(ca.w * 0.4, 2.6, 5.2)
      const callRy = narrow ? callRx : clamp(ca.h * 0.36, 1.7, 2.5)
      x = lerp(x, ca.x, c1)
      y = lerp(y, ca.y, c1)
      z = lerp(z, 0, c1)
      scale = lerp(scale, callScale, c1)
      tilt = lerp(tilt, 0, c1)
      rx0 = lerp(rx0, callRx / callScale, c1)
      ry0 = lerp(ry0, callRy / callScale, c1)
      angleShift = (narrow ? 0 : CALL_SHIFT) * c1
      power = lerp(power, 0.85, c1)
      pillar = lerp(pillar, 0, c1)
      floor = lerp(floor, 0, c1)
      ringVis = lerp(ringVis, 1, c1)
      phi = lerp(phi, 0, c1)
      tokenSize = lerp(tokenSize, narrow ? 0.46 : 0.84, c1)
    }
    // CREDITS: lie down far away on the horizon below the crawl (a pillar of light rising behind the names),
    // still turning; at the very end it sinks out of frame and fades so the replay link and footer read cleanly.
    // The hand-off is a BLINK, not a flight: the formation rides up and out with the call section while it fades,
    // then re-forms low behind the crawl, so it never sweeps across the END CREDITS / STARRING lines.
    let endFade = 0
    let blink = 0
    if (k3 > 0) {
      // keyed to the cast list's top edge on screen (works for any credits height, desktop or phone)
      if (!work.fadeEl || !work.fadeEl.isConnected) work.fadeEl = document.querySelector('[data-anchor="ct-fade-mark"]')
      const endK = work.fadeEl ? smoothstep(H * 1.1, H * 0.62, work.fadeEl.getBoundingClientRect().top) : sectionLeave(SEC.credits, 2.3, 1.25)
      endFade = smoothstep(0.2, 0.85, endK)
      blink = k3 < 0.5 ? smoothstep(0.08, 0.5, k3) : 1 - smoothstep(0.5, 0.9, k3)
      if (k3 >= 0.5) {
        x = 0
        y = (narrow ? -4 : -4.3) - endK * 3.6
        z = -7
        scale = narrow ? 0.8 : 1.35
        tilt = 1.36
        rx0 = 2.5
        ry0 = 2.5
        angleShift = 0
        power = 0.6
        pillar = 0.55 * (1 - endK)
        floor = 0.8
        ringVis = 1
        phi = st.phi * 3 + t * 0.08
        tokenSize = narrow ? 0.4 : 0.62
      }
      scale *= 1 - 0.3 * blink
    }
    const lean = st.hover * clamp(c1 * (1 - k3) + r1 * (1 - c1) * 0.6, 0, 1)
    s.x = x
    s.y = y + Math.sin(t * 0.6) * 0.04
    s.z = z
    s.tilt = tilt
    s.scale = scale
    s.rx = -my * 0.1 * (1 - tiltK * 0.5)
    s.ry = mx * 0.16
    s.rx0 = rx0
    s.ry0 = ry0
    s.spin = phi
    for (let i = 0; i < 6; i++) s.angles[i] = HERO_ANGLES[i] + angleShift + phi
    s.hover = lean
    s.tokenSize = tokenSize * (1 - endFade) * (1 - blink)
    // ignition shockwaves: scheduled on the lamp-strike's first full flash (deterministic, frame-rate independent)
    if (st.ignited && !st.igShock) {
      st.igShock = true
      fireShock(d, st.igniteAt + 0.2, s.x, s.y, s.z + 0.2, 3.2 * s.scale, '#f5c04a', 1.1)
      fireShock(d, st.igniteAt + 0.3, s.x, s.y, s.z, 5.2 * s.scale, '#e8232a', 1.6)
    }
    if (!st.ignited) st.igShock = false
    // finale: all six home again → one more strike
    let home = 0
    for (let i = 0; i < 6; i++) if (d.tokens[i].loc === 'stage' && !d.tokens[i].transit) home++
    // (only while the call is actually on screen: a fast scroll straight into the credits must not flash it there)
    if (!st.callDone && c1 > 0.6 && k3 < 0.25 && home === 6 && p >= 1) {
      st.callDone = true
      st.callAt = t
      impulse(0.45)
      fireShock(d, t, s.x, s.y, s.z + 0.2, 3.4 * s.scale, '#f5c04a', 1.2)
      fireShock(d, t + 0.08, s.x, s.y, s.z + 0.1, 5 * s.scale, '#e8232a', 1.6)
    }
    if (st.callDone && c1 < 0.2) st.callDone = false
    const callStrike = Math.max(0, 1 - (t - st.callAt) / 0.9)
    s.strike = Math.max(strikeIgnite, callStrike * 0.8, emailStrike * 0.5 * lean)
    s.power = clamp(power + lean * 0.25, 0, 1.2)
    s.glow = 0.08 + Math.min(1, s.power) * 0.92
    s.formed = 1
    s.vis = (1 - endFade) * (1 - blink)
    s.haze = 1 - 0.55 * Math.max(tiltK * (1 - c1), k3)
    s.floor = floor
    s.pillar = pillar
    s.ringVis = ringVis
    s.socketScale = (1.4 * s.tokenSize) / Math.max(0.2, s.scale)

    // camera: push in a touch and look down on the circle while it lies down in the hero
    const camK = tiltK * (1 - r1)
    work.camOffset.x = 0
    work.camOffset.y = (narrow ? 0.4 : 0.6) * camK
    work.camOffset.z = -0.4 * camK
    work.camLook.x = 0
    work.camLook.y = (narrow ? -0.3 : -0.5) * camK
    work.camLook.z = 0
    scroll.camOffset = work.camOffset
    scroll.camLook = work.camLook

    // smoke follows the beacon and warms with its power
    d.smoke = (narrow ? 0.4 : 0.55) * (1 - 0.35 * r1 * (1 - c1))
    d.smokeWarm = Math.min(1, s.power) * s.vis
    d.focusU = 0.5 + (s.x / (halfW0 * 2.6)) * 0.9
    d.focusV = 0.5 + (s.y / (halfH0 * 2.6)) * 0.9

    // ---------------------------------------------------------------- formation slots (world)
    const o = work.obj
    o.position.set(s.x, s.y, s.z)
    o.rotation.set(-s.tilt + s.rx, s.ry, 0)
    o.scale.setScalar(s.scale)
    o.updateMatrix()
    for (let i = 0; i < 6; i++) {
      const a = s.angles[i]
      const rr = 1 - 0.17 * lean
      work.slot[i].set(Math.cos(a) * s.rx0 * rr, Math.sin(a) * s.ry0 * rr, 0.45 * lean).applyMatrix4(o.matrix)
      // tokens stand ON the floor when the formation lies down
      work.slot[i].y += s.tokenSize * 0.52 * Math.sin(s.tilt)
    }

    // sling-ring portals around the screen edges for the arrival (on the z = 0.6 plane)
    const pz = 0.6
    const halfHz = tan * (10 - pz)
    const halfWz = halfHz * aspect
    const ex = narrow ? halfWz - 0.6 : Math.min(halfWz - 1.45, 5.4)
    const eyTop = narrow ? halfHz * 0.6 : Math.min(1.78, halfHz * 0.5)
    const eyBot = narrow ? -halfHz * 0.5 : -Math.min(1.45, halfHz * 0.4)
    const pr = narrow ? 0.4 : 0.74
    for (let i = 0; i < 6; i++) {
      const right = i < 3
      const row = i === 0 || i === 5 ? 0 : i === 1 || i === 4 ? 1 : 2
      const ey = row === 0 ? eyTop : row === 1 ? (narrow ? 0.15 : 0.25) : eyBot
      const exx = narrow && row !== 1 ? ex * 0.7 : ex
      work.edge[i].set(right ? exx : -exx, ey, pz)
    }

    // ---------------------------------------------------------------- tokens
    for (let i = 0; i < PORTALS; i++) d.portals[i].open = 0
    for (let i = 0; i < 6; i++) {
      const tk = d.tokens[i]
      const L = tk.live
      const slotA = slots[i].current
      const k = arriveK(p, i)
      // landing in the hero formation (forward crossing only)
      if (k >= 1 && tk.prevK < 1 && ready && tk.loc === 'stage' && !tk.transit) {
        tk.landAt = t
        fireShock(d, t, work.slot[i].x, work.slot[i].y, work.slot[i].z + 0.1, s.tokenSize * 1.5, TEAM[i].color, 0.9)
        if (landed < 6) impulse(0.2)
      }
      tk.prevK = k

      // desired location (with hysteresis)
      const cardOn = !!(scroll.ctCardOn && scroll.ctCardOn[i])
      if (tk.loc === 'stage' && cardOn && slotA.ok && slotA.inView > 0.5 && p >= 0.999) beginTransit(tk, 'card', t)
      else if (tk.loc === 'card' && (!slotA.ok || slotA.inView < 0.05 || p < 0.999)) beginTransit(tk, 'stage', t)

      // live pose of each location
      const S = work.S
      stagePose(S, d, work, i, k, p, t, mx, my, lean)
      const C = work.C
      C.x = slotA.x
      C.y = slotA.y
      C.z = SLOT_Z
      C.s = Math.max(0.05, Math.min(slotA.w, slotA.h) * 0.84)

      // pop (landing spring) + hover
      const age = t - tk.landAt
      L.pop = age >= 0 && age < 1.2 ? Math.exp(-age * 5) : 0
      const hov = scroll.ctHover === i && tk.loc === 'card' ? 1 : 0
      L.hover += (hov - L.hover) * (1 - Math.pow(0.003, dt))
      L.glow = Math.min(1, s.power) * (tk.loc === 'stage' ? 1 : 0.6) + lean * 0.5
      tk.socket += ((tk.loc === 'stage' && !tk.transit && k >= 1 ? 1 : 0) - tk.socket) * (1 - Math.pow(0.02, dt))
      const springScale = 1 + (age >= 0 ? 0.24 * Math.exp(-age * 6) * Math.cos(age * 17) : 0)

      const src = d.portals[i * 2]
      const dst = d.portals[i * 2 + 1]
      if (tk.transit) {
        const tr = tk.transit
        const u = clamp((t - tr.t0) / TRANSIT, 0, 1)
        const A = tr.from === 'stage' ? S : C
        const B = tr.to === 'stage' ? S : C
        // source portal: opens, swallows the token, closes
        src.x = A.x
        src.y = A.y
        src.z = A.z + 0.05
        src.r = Math.max(0.22, A.s * 0.62)
        src.open = bump(u, 0, 0.14, 0.4, 0.58)
        // destination portal: opens, the token bursts out, closes
        dst.x = B.x
        dst.y = B.y
        dst.z = B.z + 0.05
        dst.r = Math.max(0.22, B.s * 0.62)
        dst.open = bump(u, 0.32, 0.48, 0.8, 0.98)
        if (u < 0.46) {
          const kk = smoothstep(0.08, 0.44, u)
          tk.pos.set(A.x, A.y, A.z - kk * 0.4)
          tk.scale = A.s * (1 - kk)
          tk.rot.set(0, kk * Math.PI * 2.2, kk * 1.2)
        } else {
          const kk = smoothstep(0.46, 0.82, u)
          tk.pos.set(B.x, B.y, B.z + (1 - kk) * 0.6)
          tk.scale = B.s * backOut(kk)
          tk.rot.set(0, (1 - kk) * -Math.PI * 2.2, (1 - kk) * -1.2)
        }
        if (u >= 0.72 && !tr.landed) {
          tr.landed = true
          tk.landAt = t
          fireShock(d, t, B.x, B.y, B.z + 0.1, B.s * 1.6, TEAM[i].color, 0.85)
        }
        if (u >= 1) tk.transit = null
      } else if (tk.loc === 'card') {
        tk.pos.set(C.x, C.y + Math.sin(t * 1.4 + i) * C.s * 0.03, C.z)
        tk.scale = C.s * springScale * (1 + 0.12 * L.hover)
        idleRot(tk, i, t, mx, my, false)
        // email hover: every token on a card leans toward the email card
        if (st.hover > 0.01 && i !== 0) {
          const e0 = slots[0].current
          tk.rot.y += clamp((e0.x - C.x) * 0.25, -0.6, 0.6) * st.hover
          tk.rot.x += clamp(-(e0.y - C.y) * 0.25, -0.5, 0.5) * st.hover
        }
        if (L.hover > 0.5) tk.hoverSpin += dt * 5
        else if (tk.hoverSpin > 0) tk.hoverSpin = Math.max(0, tk.hoverSpin - dt * 3)
        tk.rot.y += tk.hoverSpin
      } else {
        tk.pos.set(S.x, S.y, S.z)
        tk.scale = S.s * (k >= 1 ? springScale : 1)
        // arrival portal (hero only)
        if (p < 0.999 && k < 1) {
          const s0 = arriveStart(i)
          src.x = work.edge[i].x
          src.y = work.edge[i].y
          src.z = work.edge[i].z
          src.r = pr
          src.open = smoothstep(s0 - 0.05, s0 - 0.004, p) * (1 - smoothstep(s0 + HERO.arriveLen * 0.5, s0 + HERO.arriveLen * 0.95, p))
        }
      }
    }
  }, -1)

  return (
    <>
      {/* page lights (constant count; intensities only) */}
      <directionalLight position={[-6, 3, -5]} intensity={1.6} color={'#ff3b3b'} />
      <pointLight position={[6, 2.5, 6]} intensity={14} distance={24} decay={2} color={'#4fd1ff'} />
      <spotLight position={[0, 7, 9]} angle={0.65} penumbra={1} intensity={60} distance={30} decay={2} color={'#fff1d6'} />
      <Smoke dir={dir} tier={tier} />
      <Beacon dir={dir} tier={tier} sockets={colors} />
      <TokenGlows dir={dir} colors={colors} />
      {TEAM.map((m, i) => (
        <TokenRig key={m.key} dir={dir} i={i} low={low} />
      ))}
      <Portals dir={dir} tier={tier} />
      <Shockwaves dir={dir} />
    </>
  )
}
