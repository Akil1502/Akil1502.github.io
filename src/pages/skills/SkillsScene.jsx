import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import GlowPlane from '../../three/primitives/GlowPlane'
import { scroll } from '../../three/scrollStore'
import Hammer, { HEAD_Y, HEAD_H } from './three/Hammer'
import Lightning from './three/Lightning'
import StormClouds from './three/StormClouds'
import Rain from './three/Rain'
import Haze from './three/Haze'
import Ground from './three/Ground'
import Runestones from './three/Runestones'
import ConceptSigils from './three/ConceptSigils'
import Shockwave from './three/Shockwave'
import { storm } from './stormBus'
import { STONES } from './runes'

// SKILLS — THOR. One pinned stage, choreographed by scroll (reference style): the war hammer hangs in a storm over
// its scorched landing seal; the ring of runestones (one per skill) rises around it; lightning answers the DOM.
//
// Beats (pose per DOM section, blended by where the viewport centre sits):
//   0 hero      hammer called down from the clouds by a bolt (arrival one-shot), hovers right of the title
//   1 core      stones ASSEMBLE out of the ground; every core skill card that scrolls in calls a LIGHTNING STRIKE
//               from the hammer to its stone; the ring turns that stone to the front
//   2 ai        the stage swings left, the hammer whirls on its strap, the sky twists into a vortex and bolts pour
//               into it; the three gold AI stones get struck as their cards arrive
//   3 concepts  hammer laid flat and turning, the five laws orbit it as rune sigils, the ring sinks
//   4 finale    the hammer rises and SLAMS head-first into the seal: shockwave, bolts to all 13 stones, all runes lit
//   5 next      the hammer is recalled into the clouds (a bolt takes it), leaving the sky to the next-mission CTA
//
// Signature move LIGHTNING STRIKE = jagged branching bolt + DOM white flash (storm.flash) + camera impulse +
// storm-cloud flash + strike light. Also on hover of any skill card, and on click/tap of the empty sky.

const SECTIONS = ['skills-hero', 'skills-core', 'skills-ai', 'skills-concepts', 'skills-finale', 'skills-next']
const FLOOR = -2.3
const PLANT_Y = FLOOR + HEAD_Y + HEAD_H / 2 - 0.04 // head-down, striking face resting in the seal
const KEYS = ['x', 'y', 'z', 'scale', 'hy', 'tilt', 'flip', 'spin', 'whirl', 'ring', 'sig', 'charge', 'swirl', 'camX', 'camY', 'camZ', 'lookY', 'seal', 'haze', 'rain']

// wide (desktop / landscape) poses
const WIDE = [
  { x: 2.55, y: -0.05, z: 0, scale: 1, hy: 0.1, tilt: -0.22, flip: 0, spin: 0.12, whirl: 0, ring: 0, sig: 0, charge: 0.35, swirl: 0, camX: 0, camY: 0, camZ: 0, lookY: 0, seal: 0.55, haze: 1, rain: 0.6 },
  { x: 2.75, y: 0.25, z: -1.6, scale: 0.8, hy: 0.85, tilt: 0.08, flip: 0, spin: 0.55, whirl: 0, ring: 1, sig: 0, charge: 0.6, swirl: 0.12, camX: 0, camY: 0.25, camZ: 0, lookY: 0, seal: 0.7, haze: 0.8, rain: 0.7 },
  { x: -3.55, y: 0.1, z: -1.4, scale: 0.76, hy: 1.7, tilt: 0, flip: 0, spin: 0.2, whirl: 1, ring: 1, sig: 0, charge: 1, swirl: 1, camX: 0, camY: 0.3, camZ: -0.4, lookY: 0, seal: 0.85, haze: 1, rain: 1 },
  { x: 2.45, y: 0.55, z: -1.6, scale: 0.8, hy: 0.85, tilt: -0.55, flip: 0, spin: 0.4, whirl: 0, ring: 0, sig: 1, charge: 0.7, swirl: 0.25, camX: 0, camY: 0.35, camZ: 0.2, lookY: 0, seal: 0.45, haze: 0.7, rain: 0.6 },
  { x: -2.6, y: 0.05, z: -0.9, scale: 0.92, hy: 0.75, tilt: 0.06, flip: 1, spin: 0.08, whirl: 0, ring: 1, sig: 0, charge: 1, swirl: 0.45, camX: 0, camY: -0.25, camZ: -0.4, lookY: 0, seal: 1, haze: 1, rain: 0.9 },
  { x: 0, y: 0.4, z: -2.6, scale: 0.72, hy: 8, tilt: 0, flip: 0, spin: 0.6, whirl: 0, ring: 0, sig: 0, charge: 0.8, swirl: 0.7, camX: 0, camY: 0.35, camZ: 0, lookY: 0, seal: 0.25, haze: 0.5, rain: 0.8 },
]
// narrow (portrait phones): centred stage, smaller, hammer kept in the upper half (text owns the lower half).
// The camera rises and pitches down ~8 deg (camera y 0.85, looking at y -0.55) so the floor sits well below the
// lens: the landing seal and the runestone ring read as open ellipses instead of an edge-on line, and the ring is
// never seen from underneath.
const N_CAM = { camY: 0.85, lookY: -1.06 } // look.y = camY * 0.6 + lookY = -0.55
const NARROW = [
  { ...WIDE[0], ...N_CAM, x: 0, y: 0.85, z: 0, scale: 0.56, tilt: -0.15 },
  { ...WIDE[1], ...N_CAM, x: 0, y: 0.75, z: -1.2, scale: 0.5 },
  { ...WIDE[2], ...N_CAM, x: 0, y: 0.68, z: -1.2, scale: 0.48 },
  { ...WIDE[3], ...N_CAM, x: 0, y: 0.95, z: -1.4, scale: 0.5 },
  { ...WIDE[4], ...N_CAM, x: 0, y: 0.78, z: -1.2, scale: 0.54 },
  { ...WIDE[5], ...N_CAM, x: 0, y: 0.75, scale: 0.5 },
]

// phones: the page's content blocks in document order; the stage drifts into the biggest free gap between them
const BLOCKS = ['.sk-hero-copy', '.sk-quote', '.sk-core-copy', '.sk-ai-copy', '.sk-laws-head', '.sk-laws', '.sk-finale-inner', '.next-page .np-link']
  .map((s) => `.page-skills ${s}`)
  .join(',')
const BAND = 0.35 // narrow poses frame the stage's visual centre ~35% from the top
const GAP_MAX = 0.6 // never lower than this (the ring and seal must stay on screen)

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const backOut = (x, c = 1.4) => (x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2))
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function SkillsScene({ tier = 'high', ready = true }) {
  const { camera, size, gl } = useThree()
  const stage = useRef()
  const hammerRig = useRef()
  const hammer = useRef()
  const bolts = useRef()
  const stones = useRef()
  const ground = useRef()
  const shock = useRef()
  const strikeLight = useRef()
  const headLight = useRef()
  const keyLight = useRef()
  const glow = useRef()
  const trail = useRef()
  const reduced = useMemo(reducedMotion, [])

  // mutable per-frame state shared with the storm components (never React state)
  const fx = useMemo(
    () => ({ flash: 0, flashX: 0, flashY: 6, swirl: 0, vortexX: 0, vortexY: 5, charge: 0.3, rain: 0.6, haze: 1, seal: 0.5, ring: 0, sigils: 0, allLit: 0, out: 0, strikeP: new THREE.Vector3(), strikeI: 0, headP: new THREE.Vector3() }),
    [],
  )
  // start from the first pose of the layout we mount in (a phone must not slide in from the desktop pose)
  const pose = useMemo(() => ({ ...(size.width / size.height < 0.9 ? NARROW[0] : WIDE[0]) }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const cam = useMemo(() => ({ off: { x: 0, y: 0, z: 0 }, look: { x: 0, y: 0, z: 0 } }), [])
  const want = useMemo(() => ({ ...pose }), [pose])
  const st = useRef({
    arrival: -1,
    arrived: false,
    yaw: 0,
    whirl: 0,
    cool: 0,
    crawl: 0.8,
    sheet: 3,
    aiBolt: 1,
    slam: -1,
    slammed: false,
    plant: 0,
    shock: -1,
    shockAt: new THREE.Vector3(),
    strikeI: 0,
    lastClick: 0,
    recalled: false,
    s: 0,
    out: 0,
    warm: 3,
    els: [],
    lawsHead: null,
    blocks: [],
    follow: 0,
    grow: 0,
  })
  const v = useMemo(
    () => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), 0) }),
    [],
  )

  // --- strike helpers (allocate two closures per strike; never per frame) ---
  // Once the next-mission CTA has started to rise (st.out > 0.3) no new bolt is drawn: the sky belongs to the CTA.
  // Only the recall bolt that takes the hammer up passes `force`.
  const handoff = () => st.current.out > 0.3
  const headWorld = (t) => {
    const h = hammer.current?.head
    return h ? h.getWorldPosition(t) : t.set(0, 0, 0)
  }
  // `sky` scales the cloud-deck flash, `shake` the camera impulse. A bolt inside a volley (the finale's radiating
  // strikes) lights its stone and the floor but only nudges the sky, so the slam keeps its one big flash and the
  // title stays legible; ambient bolts (the summoning) never shake: impact is once per beat, never continuous.
  const flashAt = (p, power, dom, sky = 1, shake = true) => {
    // reduced motion: bolts still land, but the sky only glows instead of strobing
    fx.flash = Math.max(fx.flash, (0.55 + power * 0.45) * sky * (reduced ? 0.25 : 1))
    fx.flashX = p.x
    fx.flashY = p.y + 2
    const L = strikeLight.current
    if (L) {
      L.position.copy(p)
      L.intensity = Math.max(L.intensity, 70 * power)
    }
    fx.strikeP.copy(p)
    if (!reduced && shake) scroll.impulse = Math.max(scroll.impulse || 0, 0.16 + power * 0.26)
    if (dom) storm.flash?.(power)
  }
  const strikeStone = (i, power = 1, dom = true, volley = false) => {
    const b = bolts.current
    if (!b || !stones.current || handoff()) return
    b.fire(headWorld, (t) => stones.current.worldPos(i, t), { life: 0.5, width: 0.05 + power * 0.03, forks: tier === 'low' ? 1 : 3, rough: 0.2, intensity: 1 })
    stones.current.hit(i, power)
    stones.current.worldPos(i, v.a)
    flashAt(v.a, power, dom, volley ? 0.35 : 1, !volley)
    storm.lastStrike = i
  }
  const strikeFromSky = (power = 1, dom = true, spread = 1.6, force = false, shake = true) => {
    const b = bolts.current
    if (!b || (!force && handoff())) return
    headWorld(v.c)
    const sx = v.c.x + (Math.random() - 0.5) * spread * 2
    const sz = v.c.z - 2 - Math.random() * 2
    b.fire((t) => t.set(sx, 7.5, sz), headWorld, { life: 0.55, width: 0.07 + power * 0.03, forks: tier === 'low' ? 1 : 3, rough: 0.16, intensity: 1.1 })
    flashAt(v.c, power, dom, 1, shake)
  }
  const strikePoint = (p, power = 0.8) => {
    const b = bolts.current
    if (!b || handoff()) return
    const px = p.x
    const py = p.y
    const pz = p.z
    b.fire(headWorld, (t) => t.set(px, py, pz), { life: 0.45, width: 0.06, forks: 2, rough: 0.22 })
    flashAt(p, power, true)
  }
  const crawlArc = () => {
    const h = hammer.current?.head
    const b = bolts.current
    if (!h || !b) return
    const pick = () => {
      const f = Math.floor(Math.random() * 3)
      const p = [(Math.random() - 0.5) * 1.62, (Math.random() - 0.5) * 0.94, (Math.random() - 0.5) * 0.94]
      p[f] = (Math.random() < 0.5 ? -1 : 1) * [0.85, 0.49, 0.49][f]
      return p
    }
    const p0 = pick()
    const p1 = pick()
    b.fire((t) => h.localToWorld(t.set(p0[0], p0[1], p0[2])), (t) => h.localToWorld(t.set(p1[0], p1[1], p1[2])), { life: 0.16 + Math.random() * 0.12, width: 0.016, forks: 1, rough: 0.32, intensity: 0.85 })
  }

  // click / tap on the open sky (anywhere the DOM lets the pointer through to the canvas) calls a bolt from the
  // hammer to that point
  useEffect(() => {
    const el = gl.domElement
    const onDown = (e) => {
      const s = st.current
      if (!s.arrived) return
      const now = performance.now()
      if (now - s.lastClick < 380) return
      s.lastClick = now
      const r = el.getBoundingClientRect()
      v.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      v.ray.setFromCamera(v.ndc, camera)
      v.plane.constant = 0
      if (v.ray.ray.intersectPlane(v.plane, v.b)) strikePoint(v.b, 0.85)
    }
    // 'click' (not pointerdown) so a touch that starts a scroll never calls a strike
    el.addEventListener('click', onDown)
    return () => el.removeEventListener('click', onDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  // release the camera + bus on unmount
  useEffect(
    () => () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
      storm.charge = 0
      storm.screen = null
    },
    [],
  )

  useFrame((state, dt) => {
    // every motion here is exponential smoothing or a one-shot timeline, both stable at large steps, so a slow
    // device (or a software-GL preview at ~5 fps) still reaches each pose instead of crawling at a quarter speed
    const d = Math.min(dt, 0.1)
    const t = state.clock.elapsedTime
    const s = st.current
    const warming = s.warm > 0
    if (warming) s.warm--
    const narrow = size.width / size.height < 0.9
    const P = narrow ? NARROW : WIDE

    // ---- where are we? viewport centre against the five DOM beats -> continuous stage value 0..5 ----
    const mid = size.height * 0.5
    let sv = 0
    let nextTop = Infinity
    for (let k = 0; k < SECTIONS.length; k++) {
      let el = s.els[k]
      if (!el || !el.isConnected) el = s.els[k] = document.querySelector(`[data-section="${SECTIONS[k]}"]`)
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top <= mid) sv = k + Math.min(1, Math.max(0, (mid - r.top) / Math.max(1, r.height)))
      if (k === SECTIONS.length - 1) nextTop = r.top
    }
    s.s = sv
    // ---- phones: as the laws heading rises into the stage band (top half), the sigils fold back into the hammer,
    // so the five laws hand over from the sky to their DOM cards instead of colliding with the title ----
    let fold = 0
    // ---- phones: the stage is not pinned to the top band. Between beats (one section's content gone up, the next
    // one's heading still low) the biggest free gap in the frame gets the hammer, eased down into it and a touch
    // larger; as the next heading rises the gap closes and the stage settles back into its band above the text ----
    let followWant = 0
    let growWant = 0
    if (narrow) {
      let lh = s.lawsHead
      if (!lh || !lh.isConnected) lh = s.lawsHead = document.querySelector('[data-section="skills-concepts"] h2')
      if (lh) fold = smooth(size.height * 0.6, size.height * 0.4, lh.getBoundingClientRect().top)
      if (!s.blocks.length || !s.blocks[0].isConnected) s.blocks = document.querySelectorAll(BLOCKS)
      const H = size.height
      let prevBottom = -Infinity
      let best = 0
      let bestMid = 0
      for (let k = 0; k < s.blocks.length; k++) {
        const r = s.blocks[k].getBoundingClientRect()
        const g0 = Math.max(0, prevBottom)
        const g1 = Math.min(H, r.top)
        if (g1 - g0 > best) {
          best = g1 - g0
          bestMid = (g0 + g1) / 2
        }
        prevBottom = Math.max(prevBottom, r.bottom)
      }
      if (best > H * 0.38) {
        const c = Math.min(GAP_MAX, Math.max(BAND, bestMid / H))
        const k = (c - BAND) / (GAP_MAX - BAND)
        // visible world height at the stage depth is ~8.6 units on a portrait phone (fov 42, ~11 units away)
        followWant = -(c - BAND) * 8.6
        growWant = 0.16 * k
      }
    }
    s.follow += (followWant - s.follow) * (1 - Math.pow(0.02, d))
    s.grow += (growWant - s.grow) * (1 - Math.pow(0.02, d))
    // ---- hand-off: as the next-mission CTA rises into view (its top from 92% to 42% of the viewport) the whole
    // centrepiece leaves the stage: the hammer is recalled into the clouds, the ring, sigils and seal sink away and
    // go dark, live bolts fade and no new one is drawn over the CTA (only the storm sky stays). Smoothed so a jump
    // never pops.
    const outWant = Number.isFinite(nextTop) ? smooth(size.height * 0.92, size.height * 0.42, nextTop) : 0
    s.out += (outWant - s.out) * (1 - Math.pow(0.004, d))
    const out = s.out < 0.001 ? 0 : s.out
    const keep = 1 - out
    const x = Math.min(P.length - 1, Math.max(0, sv - 0.5))
    const i0 = Math.floor(x)
    const i1 = Math.min(P.length - 1, i0 + 1)
    const w = smooth(0.3, 0.7, x - i0)
    for (const k of KEYS) want[k] = P[i0][k] + (P[i1][k] - P[i0][k]) * w
    const kk = 1 - Math.pow(0.03, d)
    for (const k of KEYS) pose[k] += (want[k] - pose[k]) * kk
    const aiW = Math.max(0, 1 - Math.abs(sv - 2.5) * 1.6)
    const finW = smooth(3.9, 4.4, sv) * (1 - smooth(4.95, 5.25, sv))

    // ---- arrival (one-shot, after the intro): called down from the storm by a bolt ----
    if (s.arrival < 0 && ready !== false) {
      s.arrival = 0
      if (reduced) {
        s.arrival = 10
        s.arrived = true
      }
    }
    let drop = 6
    if (s.arrival >= 0) {
      const prev = s.arrival
      s.arrival += d
      const k = Math.min(1, s.arrival / 0.95)
      drop = (1 - backOut(k, 1.1)) * 6.5
      if (prev < 0.08 && s.arrival >= 0.08) strikeFromSky(0.6, false, 0.6, false, false)
      if (prev < 0.62 && s.arrival >= 0.62) strikeFromSky(1, true, 0.4)
      if (!s.arrived && s.arrival >= 0.66) {
        s.arrived = true
        ground.current?.flare(1)
        s.shock = 0
        headWorld(s.shockAt)
        scroll.impulse = Math.max(scroll.impulse || 0, 0.5)
      }
    }

    // ---- finale SLAM (one-shot per visit to the finale; re-arms once you scroll back up). Never starts, and never
    // lands its effects, once the hand-off to the next-mission CTA is under way (e.g. a jump straight to the end) ----
    if (s.slam < 0 && s.arrived && sv > 4.15 && out < 0.3) s.slam = 0
    if (s.slam >= 0 && sv < 3.7) {
      s.slam = -1
      s.slammed = false
    }
    let lift = 0
    if (s.slam >= 0) {
      s.slam += d
      const a = s.slam
      if (a < 0.5) lift = Math.sin((a / 0.5) * Math.PI * 0.5) * 1.1 // wind-up
      else if (a < 0.66) lift = 1.1 * (1 - Math.pow((a - 0.5) / 0.16, 2)) // drop
      s.plant = a < 0.5 ? 0 : Math.min(1, (a - 0.5) / 0.16)
      if (!s.slammed && a >= 0.66) {
        s.slammed = true
        if (out < 0.3) {
          if (!reduced) scroll.impulse = Math.max(scroll.impulse || 0, 0.62)
          storm.flash?.(1.2)
          ground.current?.flare(1.3)
          fx.flash = reduced ? 0.3 : 1.2
          s.shock = 0
          s.strikeI = 0
          headWorld(s.shockAt)
        } else s.strikeI = STONES.length
      }
      // bolts radiate from the impact to every stone, one after another (cut short if the hand-off begins)
      if (s.slammed && out > 0.3) s.strikeI = STONES.length
      if (s.slammed && s.strikeI < STONES.length && a >= 0.68 + s.strikeI * 0.05) {
        strikeStone(s.strikeI, 0.55, false, true)
        s.strikeI++
      }
    } else {
      s.plant += (0 - s.plant) * kk
    }
    fx.allLit += ((s.slammed ? 1 : 0) - fx.allLit) * kk

    // ---- recalled to the sky as the next-mission CTA starts to rise (one bolt takes it up, drawn while the CTA is
    // still low in the frame; the bolt tracks the climbing head, so it shortens into the clouds) ----
    if (!s.recalled && s.arrived && out > 0.08 && out < 0.45) {
      s.recalled = true
      strikeFromSky(0.8, false, 0.3, true, false)
    }
    if (s.recalled && out < 0.02) s.recalled = false
    // every bolt still alive fades out as the CTA takes the frame
    if (bolts.current) bolts.current.fade = 1 - smooth(0.3, 0.7, out)

    // ---- stage + hammer placement ----
    const g = stage.current
    if (g) {
      g.position.set(pose.x, pose.y + s.follow, pose.z)
      g.scale.setScalar(pose.scale * (1 + s.grow))
    }
    const hr = hammerRig.current
    if (hr) {
      const mx = scroll.mouse.x
      const my = scroll.mouse.y
      // whirl on the strap: angular speed ramps with the beat; settles upright again when it ends
      s.whirl += pose.whirl * 7.5 * d * (reduced ? 0.2 : 1)
      if (pose.whirl < 0.05) s.whirl += (Math.round(s.whirl / (Math.PI * 2)) * Math.PI * 2 - s.whirl) * kk
      s.yaw += pose.spin * d * (reduced ? 0.3 : 1)
      const rotZ = pose.tilt + pose.flip * Math.PI + s.whirl - mx * 0.08
      const orbit = 0.62 * pose.whirl
      const bob = Math.sin(t * 1.1) * 0.07 * (1 - s.plant)
      const baseY = pose.hy + (PLANT_Y - pose.hy) * s.plant * finW
      const recall = out * out * 11 // accelerating climb into the clouds during the hand-off
      hr.position.set(-Math.sin(rotZ) * orbit + mx * 0.15, baseY + Math.cos(rotZ) * orbit + bob + drop + lift + recall, 0)
      hr.visible = out < 0.985
      const yaw = (0.55 + s.yaw + Math.sin(t * 0.37) * 0.35 + mx * 0.45) * (1 - pose.whirl * 0.85) * (1 - s.plant * 0.7)
      hr.rotation.set(0.1 - my * 0.12, yaw, rotZ)
      if (trail.current) {
        trail.current.material.uniforms.uA.value = pose.whirl * 0.8
        trail.current.material.uniforms.uAng.value = rotZ + Math.PI / 2
        trail.current.scale.setScalar(orbit + HEAD_Y)
        trail.current.position.set(mx * 0.15, baseY + bob + drop + lift, 0.05)
        // (drawn during the warm-up frames too, fully transparent, so its shader compiles behind the transition)
        trail.current.visible = pose.whirl > 0.04 || warming
      }
    }

    // ---- charge: base per beat + strike afterglow ----
    fx.charge += (Math.min(1, pose.charge + fx.flash * 0.4) - fx.charge) * (1 - Math.pow(0.1, d))
    storm.charge = fx.charge
    fx.swirl = pose.swirl * (reduced ? 0.3 : 1) * (1 - out * 0.6)
    fx.rain = pose.rain
    fx.haze = pose.haze * (1 - out * 0.75)
    fx.seal = pose.seal * keep
    fx.ring = pose.ring * keep
    fx.sigils = pose.sig * keep * (1 - fold)
    fx.out = out
    hammer.current?.setCharge(fx.charge, fx.flash)
    headWorld(v.c)
    fx.vortexX = v.c.x
    fx.vortexY = v.c.y + 4

    // ---- the strike queue (DOM -> 3D): at most one strike per 0.2 s, so flashes stay under 3 / s ----
    s.cool -= d
    // during the hand-off the hammer has left: pending strikes are dropped instead of drawn over the CTA
    if (out > 0.3) storm.queue.length = 0
    if (s.arrived && s.cool <= 0 && storm.queue.length) {
      const job = storm.queue.shift()
      s.cool = 0.22
      if (job.target >= 0 && fx.ring > 0.3) strikeStone(job.target, job.power, true)
      else if (job.target >= 0 || job.target === -1) strikeFromSky(job.power, true)
    }
    // ambient storm life: crawling arcs on the charged head, sheet lightning, the summoning's bolts
    if (s.arrived && !reduced) {
      s.crawl -= d
      if (s.crawl <= 0) {
        s.crawl = (0.35 + Math.random() * 0.8) / (0.4 + fx.charge)
        if (fx.charge > 0.32 && out < 0.4) crawlArc()
      }
      s.sheet -= d
      if (s.sheet <= 0) {
        // sheet lightning only lights the cloud deck (no bolt), so it may keep breathing behind the CTA, softer
        s.sheet = 2.5 + Math.random() * 4
        fx.flash = Math.max(fx.flash, (0.3 + Math.random() * 0.25) * (1 - out * 0.5))
        fx.flashX = (Math.random() - 0.5) * 14
        fx.flashY = 3 + Math.random() * 3
      }
      if (aiW > 0.6) {
        s.aiBolt -= d
        if (s.aiBolt <= 0) {
          s.aiBolt = 1.3 + Math.random() * 0.9
          strikeFromSky(0.7, false, 1.2, false, false)
        }
      }
    }

    // ---- decays, lights, glow, shockwave ----
    fx.flash *= Math.exp(-d * 6.5)
    const SL = strikeLight.current
    if (SL) SL.intensity *= Math.exp(-d * 9)
    fx.strikeI = SL ? SL.intensity : 0
    fx.headP.copy(v.c)
    // lights never toggle (that would recompile every material); they fade by intensity instead
    if (headLight.current) {
      headLight.current.position.copy(v.c)
      headLight.current.intensity = (1.5 + fx.charge * 5 + fx.flash * 16) * keep
    }
    if (keyLight.current) keyLight.current.intensity = 26 + fx.flash * 40
    const gm = glow.current?.children[0]?.material
    if (gm?.uniforms?.uIntensity) gm.uniforms.uIntensity.value = (0.16 + fx.charge * 0.14 + fx.flash * 0.3) * (1 - out * 0.8)
    if (s.shock >= 0) {
      s.shock += d
      const p = s.shock / 1.1
      shock.current?.set(reduced || out > 0.5 ? 0 : p)
      const o = shock.current?.object
      if (o) {
        o.position.copy(s.shockAt)
        o.scale.setScalar(4.6)
      }
      if (p >= 1) s.shock = -1
    } else if (warming) {
      // nearly-finished ring = fully transparent (discarded) draw: compiles the shader, shows nothing
      shock.current?.set(s.warm > 0 ? 0.9999 : 0)
    }

    // ---- camera: per-beat dolly / framing (smoothed by CameraRig) ----
    cam.off.x = pose.camX
    cam.off.y = pose.camY
    cam.off.z = pose.camZ
    cam.look.x = pose.x * 0.08
    cam.look.y = pose.camY * 0.6 + pose.lookY
    scroll.camOffset = cam.off
    scroll.camLook = cam.look

    // ---- HUD lock-on: project the head and grip to screen for the DOM callouts ----
    const scr = storm.screen || (storm.screen = { hx: 0, hy: 0, gx: 0, gy: 0, ok: false })
    v.a.copy(v.c).project(camera)
    scr.hx = (v.a.x * 0.5 + 0.5) * size.width
    scr.hy = (-v.a.y * 0.5 + 0.5) * size.height
    const grip = hammer.current?.grip
    if (grip) {
      grip.getWorldPosition(v.a).project(camera)
      scr.gx = (v.a.x * 0.5 + 0.5) * size.width
      scr.gy = (-v.a.y * 0.5 + 0.5) * size.height
    }
    scr.ok = s.arrived
    scr.stage = sv
  })

  const boltCount = tier === 'high' ? 9 : tier === 'medium' ? 7 : 5
  return (
    <group>
      <StormClouds tier={tier} fx={fx} />
      <Rain tier={tier} fx={fx} />
      <Lightning ref={bolts} count={boltCount} />
      <pointLight ref={strikeLight} color={'#cfeaff'} intensity={0} distance={14} decay={1.6} />
      <pointLight ref={headLight} color={'#8fd8ff'} intensity={2} distance={6} decay={1.8} />
      <Shockwave ref={shock} />

      <group ref={stage}>
        <group ref={glow} position={[0, 0.8, -3.2]}>
          <GlowPlane color={'#3f7bb5'} intensity={0.2} size={[11, 11]} softness={1.7} />
        </group>
        <Haze tier={tier} fx={fx} />
        {/* key (cold, high left), rim (lightning blue, behind), cape-red bounce from below */}
        <pointLight ref={keyLight} color={'#b9ddff'} position={[-3.2, 4.2, 4]} intensity={26} distance={24} decay={1.5} />
        <pointLight color={'#8fd8ff'} position={[2.6, 2.6, -3]} intensity={36} distance={18} decay={1.5} />
        <pointLight color={'#d3242c'} position={[0.8, -0.6, 3]} intensity={3.5} distance={7} decay={1.8} />

        <group ref={hammerRig} position={[0, 6, 0]}>
          <Hammer ref={hammer} tier={tier} />
        </group>
        <WhirlTrail ref={trail} />
        <group position={[0, FLOOR, 0]}>
          <Runestones ref={stones} tier={tier} fx={fx} />
        </group>
        <Ground ref={ground} y={FLOOR} fx={fx} />
        <group position={[0, 0.9, 0]}>
          <ConceptSigils fx={fx} />
        </group>
      </group>
    </group>
  )
}

// A comet-tail disc that trails the whirling hammer head (motion blur for the strap spin).
const trailVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const trailFrag = /* glsl */ `
  uniform float uA;
  uniform float uAng;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float band = smoothstep(0.62, 0.86, r) * (1.0 - smoothstep(0.9, 1.0, r));
    float ang = atan(c.y, c.x);
    float lag = mod(uAng - ang, 6.2831853) / 6.2831853; // 0 at the head, growing behind it
    float tail = pow(1.0 - lag, 5.0);
    float a = band * tail * uA;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * (1.0 + tail * 1.5), a);
  }
`
const WhirlTrail = forwardRef(function WhirlTrail(_, ref) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: trailVert,
        fragmentShader: trailFrag,
        uniforms: { uA: { value: 0 }, uAng: { value: 0 }, uColor: { value: new THREE.Color('#8fd8ff') } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  return (
    <mesh ref={ref} material={mat} visible={false} renderOrder={4}>
      <planeGeometry args={[2.3, 2.3]} />
    </mesh>
  )
})
