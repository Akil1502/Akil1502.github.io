import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import Shield from './Shield'
import ImpactFX from './ImpactFX'
import { HaloRays } from './Atmosphere'
import { makeShieldMaterials } from './shieldGeometry'
import { scroll, clamp, lerp } from '../../../three/scrollStore'
import { WAYPOINTS, SHIELD_EVENT, FOCUS } from '../choreo'
import { prefersReduced } from '../parts'

/* ------------------------------------------------------------------------------------------------
 * SHIELD THROW — one shield, one flight path, scrubbed by the scroll.
 *
 * Every frame the rig measures the DOM waypoints (choreo.js) and converts each into
 *   - a world position + radius (the DOM slot mapped onto the z = 0 plane, like useAnchor), and
 *   - a scroll window [enter, exit] during which the shield sits on it (the moment the slot crosses the
 *     focus line; sticky stages are scrubbed by their pin progress instead).
 * The scroll position then picks "at waypoint i" or "flying i → i+1, t", which gives the pose:
 *   rest → rest  ease-in-out swing with a sideways bulge     (hero → inspection stage)
 *   rest → hit   accelerating throw                           (stage → first timeline node)
 *   hit  → hit   straight ricochet, spinning hard             (node → node, card → card)
 *   hit  → rest  decelerating return into the catch           (last card → finale)
 * Crossing a hit waypoint fires the IMPACT: camera impulse, spark burst + shockwave + flash at the
 * target, star glint, and a DOM event so the page can flash / mark the target. Scrolling back re-fires.
 * Hits hold the shield for a short scroll window (longer on phones, where the flights pass behind full-width
 * text); long phone flights arc out to the screen edge, and no flight ever leaves the frame.
 * Rest poses idle (bob, mouse tilt) and the spin always settles with the star upright (72° symmetry).
 * The first arrival spins the shield in from off-screen right and lands it with an impact.
 * ---------------------------------------------------------------------------------------------- */

const TAU = Math.PI * 2
const STAR_STEP = TAU / 5
const FOLLOW = 0.9
const INSPECT_MAX = 1.15 // rad, how far the inspection stage turns the shield (~66°)
const HIT_HOLD = 0.06 // fraction of the viewport height a hit target holds the shield on each side of its focus line
const HIT_HOLD_MOBILE = 0.19

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - (1 - t) * (1 - t)
const easeOutBack = (t, c = 1.4) => 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2)
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a))

// Linear interpolation between two waypoints that scroll at the same rate keeps the shield exactly on the
// focus line (the reference's pinned hero object): only the shape of the swing is eased, gently.
function segEase(a, b, t) {
  if (a === 'rest' && b === 'rest') return lerp(t, easeInOut(t), 0.3)
  if (b === 'rest') return lerp(t, easeOut(t), 0.45)
  return t
}

// IMPACT camera shake (skipped when the visitor prefers reduced motion; REDUCED is read on mount)
let REDUCED = false
function kick(v) {
  if (REDUCED) return
  scroll.impulse = Math.max(scroll.impulse || 0, v)
}

function emit(type, key) {
  window.dispatchEvent(new CustomEvent(SHIELD_EVENT, { detail: { type, key } }))
}

// Rest orientation for a waypoint (rx, ry) given the inspection progress q.
function restPose(w, q, t, desktop, out) {
  switch (w.pose) {
    case 'hero':
      out.rx = 0.1
      out.ry = desktop ? -0.36 : -0.12
      break
    case 'inspect':
      // the inspection turn, scrubbed across the pinned stage: front → 66° left (rim profile) → front → 66° right
      out.rx = 0.1 + Math.sin(q * Math.PI) * 0.12
      out.ry = desktop ? Math.sin(q * TAU) * INSPECT_MAX : Math.sin(t * 0.45) * 0.55
      break
    case 'final':
      out.rx = 0.04
      out.ry = 0
      break
    default:
      out.rx = 0
      out.ry = 0
  }
  return out
}

export default function ShieldRig({ tier = 'high', ready }) {
  const { size } = useThree()
  const pos = useRef() // world position group (no rotation)
  const scaler = useRef() // uniform scale = radius
  const tilt = useRef() // facing / tilt
  const spinner = useRef() // spin about the shield normal
  const rimGlow = useRef()
  const rimGlowMat = useRef()
  const fx = useRef()
  const rays = useRef()
  const hit = useRef()

  const segments = tier === 'high' ? 160 : tier === 'medium' ? 112 : 72
  const keyTarget = useMemo(() => new THREE.Object3D(), [])
  const materials = useMemo(() => makeShieldMaterials(tier), [tier])
  useEffect(() => () => materials.dispose(), [materials])

  const wps = useMemo(() => WAYPOINTS.map((w) => ({ ...w, el: null, track: null, sticky: null, x: 0, y: 0, rad: 1, enter: 0, exit: 0, q: 0, ok: false })), [])
  const st = useRef({
    prevU: null,
    prevPath: null,
    spin: 0,
    spinVel: 0,
    introT: -1,
    introDone: false,
    landed: false,
    caught: false,
    glow: 0,
    hover: 0,
    restW: 1,
    rx: 0.1,
    ry: -0.36,
    pose: { rx: 0, ry: 0 },
    poseB: { rx: 0, ry: 0 },
    camOff: { x: 0, y: 0, z: 0 },
  })

  // camera offset object is shared with CameraRig; always restore it
  useEffect(() => {
    REDUCED = prefersReduced()
    scroll.camOffset = st.current.camOff
    return () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.aboutShieldHover = 0
      scroll.aboutArrive = 0
      scroll.aboutCharge = 0
    }
  }, [])

  const onOver = () => {
    scroll.aboutShieldHover = 1
  }
  const onOut = () => {
    scroll.aboutShieldHover = 0
  }
  const onClick = (e) => {
    e.stopPropagation?.()
    const s = st.current
    s.spinVel += 22
    s.glow = Math.max(s.glow, 0.9)
    kick(0.32)
    const p = pos.current
    const r = scaler.current ? scaler.current.scale.x : 1
    if (p && fx.current) fx.current.burst(p.position.x - r * 0.72, p.position.y + r * 0.62, p.position.z + 0.3, { power: 0.8, dirX: -1, dirY: 0.6, scale: 0.8 })
    emit('clang', 'shield')
  }

  useFrame((state, rawDt) => {
    const P = pos.current
    if (!P) return
    const s = st.current
    const dt = Math.min(rawDt, 0.05)
    const t = state.clock.elapsedTime
    const cam = state.camera
    const vw = size.width
    const vh = size.height
    const desktop = vw > 960
    const sy = window.scrollY
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z
    const halfW = halfH * (vw / vh)
    const lagX = scroll.mouse.x * 0.7 * (1 - FOLLOW)
    const lagY = scroll.mouse.y * 0.45 * (1 - FOLLOW)
    const focusPx = vh * FOCUS

    // ---------------- 1. measure the itinerary ----------------
    let missing = false
    for (let i = 0; i < wps.length; i++) {
      const w = wps[i]
      if (!w.el || !w.el.isConnected) {
        w.el = document.querySelector(`[data-anchor="${w.anchor}"]`)
        w.track = w.el ? w.el.closest('[data-pin-track]') : null
        w.sticky = w.el ? w.el.closest('[data-pin]') : null
      }
      if (!w.el) {
        w.ok = false
        missing = true
        continue
      }
      w.ok = true
      const r = w.el.getBoundingClientRect()
      const cy = r.top + r.height / 2
      w.x = ((r.left + r.width / 2) / vw) * 2 * halfW - halfW + cam.position.x - lagX
      w.y = -((cy / vh) * 2 - 1) * halfH + cam.position.y - lagY
      w.rad = (Math.max(8, Math.min(r.width, r.height)) / vh) * halfH * w.fill
      if (w.track && w.sticky && desktop) {
        const tr = w.track.getBoundingClientRect()
        const sr = w.sticky.getBoundingClientRect()
        const pinStart = sy + tr.top
        const pinEnd = pinStart + Math.max(1, tr.height - sr.height)
        w.q = clamp((sy - pinStart) / (pinEnd - pinStart), 0, 1)
        if (w.pin != null) {
          const mid = pinStart + w.pin * (pinEnd - pinStart)
          const hold = w.kind === 'hit' ? vh * HIT_HOLD : 0
          w.enter = mid - hold
          w.exit = mid + hold
        } else {
          const off = cy - sr.top - focusPx
          w.enter = pinStart + off
          w.exit = pinEnd + off
        }
      } else {
        const trig = sy + cy - vh * (w.focus ?? FOCUS)
        // hits lodge in their target for a beat (a "thunk"), then the shield snaps on to the next one; on phones
        // the hold is longer so the flight behind the full-width text blocks stays short
        const hold = w.kind === 'rest' ? vh * (w.hold || 0) : vh * (desktop ? HIT_HOLD : HIT_HOLD_MOBILE)
        w.enter = trig - hold
        w.exit = trig + hold
        w.q = clamp((sy - w.enter) / Math.max(1, w.exit - w.enter), 0, 1)
      }
      // the first slot holds the shield for the opening of the scroll even when it sits above the focus line
      // (phones: the hero slot is at the top of the screen)
      if (i === 0) w.exit = Math.max(w.exit, vh * (w.hold || 0))
      if (i > 0) {
        const p = wps[i - 1]
        if (w.enter < p.exit + 1) w.enter = p.exit + 1
      }
      if (w.exit < w.enter) w.exit = w.enter
    }
    // Only the shield mesh is hidden while the DOM is missing (mount / unmount): its stage lights stay in the scene
    // so the light count (and every material's compiled program) never changes.
    const shieldGroup = scaler.current
    if (missing) {
      if (shieldGroup) shieldGroup.visible = false
      if (rays.current?.mesh) rays.current.mesh.visible = false
      return
    }
    if (shieldGroup) shieldGroup.visible = true

    // ---------------- 2. where on the itinerary are we ----------------
    const N = wps.length
    let i = 0
    let tt = 0
    let at = true
    if (sy <= wps[0].exit) i = 0
    else if (sy >= wps[N - 1].enter) i = N - 1
    else {
      for (let k = 0; k < N - 1; k++) {
        if (sy >= wps[k].enter && sy <= wps[k].exit) {
          i = k
          break
        }
        if (sy > wps[k].exit && sy < wps[k + 1].enter) {
          i = k
          at = false
          tt = (sy - wps[k].exit) / (wps[k + 1].enter - wps[k].exit)
          break
        }
      }
    }
    const A = wps[i]
    const B = at ? A : wps[i + 1]
    const e = at ? 0 : segEase(A.kind, B.kind, tt)
    const u = at ? i : i + tt
    const fl = at ? 0 : Math.sin(Math.PI * tt) // in-flight weight

    // ---------------- 3. position + radius ----------------
    let x = lerp(A.x, B.x, e)
    let y = lerp(A.y, B.y, e)
    let z = 0
    const dx = B.x - A.x
    const dy = B.y - A.y
    const dl = Math.hypot(dx, dy) || 1
    let rad = lerp(A.rad, B.rad, e) * (1 + fl * 0.05)
    if (!at) {
      const restSwing = A.kind === 'rest' && B.kind === 'rest'
      const longHaul = B.enter - A.exit > vh * 0.9
      if (!desktop && longHaul) {
        // phones: long flights arc out to the screen edge (behind the column of text) instead of crossing it
        const side = i % 2 ? -1 : 1
        x = lerp(x, cam.position.x + side * (halfW - rad * 0.2), fl * 0.85)
        rad *= 1 - fl * 0.25
        z -= fl * 0.4
      } else {
        z += fl * (restSwing ? 0.9 : 1.15)
        if (restSwing) {
          x += (-dy / dl) * fl * 0.14 * dl
          y += (dx / dl) * fl * 0.14 * dl
        }
      }
      // never leave the frame between two slots (a pinned slot → a slot still below the fold)
      const mx = Math.max(0, halfW - rad * (desktop ? 1.1 : 0.2))
      const my = Math.max(0, halfH - rad * 1.15 - 0.15)
      x = clamp(x, cam.position.x - mx, cam.position.x + mx)
      y = clamp(y, cam.position.y - my, cam.position.y + my)
    }

    // ---------------- 4. orientation ----------------
    restPose(A, A.q, t, desktop, s.pose)
    restPose(B, B.q, t, desktop, s.poseB)
    let rx = lerp(s.pose.rx, s.poseB.rx, e)
    let ry = s.pose.ry + wrapAngle(s.poseB.ry - s.pose.ry) * e
    rx += (-dy / dl) * 0.5 * fl
    ry += (dx / dl) * 0.5 * fl
    const restTarget = at && A.kind === 'rest' ? 1 : 0
    s.restW += (restTarget - s.restW) * (1 - Math.exp(-dt * 4))
    const k = 1 - Math.exp(-dt * 5)
    s.hover += ((scroll.aboutShieldHover || 0) - s.hover) * k
    const charge = scroll.aboutCharge || 0
    rx += -scroll.mouse.y * 0.16 * s.restW
    ry += scroll.mouse.x * 0.24 * s.restW
    y += Math.sin(t * 0.8) * 0.045 * s.restW * rad

    // ---------------- 5. spin ----------------
    const pathPos = at ? i : i + e
    if (s.prevPath != null && Math.abs(pathPos - s.prevPath) < 1.5) {
      s.spin += (pathPos - s.prevPath) * dl * 2.6
    }
    s.prevPath = pathPos
    if (!at) s.spin += dt * 1.8 * fl
    s.spin += s.spinVel * dt + charge * dt * 3.5 + s.hover * dt * 0.9
    s.spinVel *= Math.exp(-dt * 1.5)
    if (s.restW > 0.5 && Math.abs(s.spinVel) < 0.6 && charge < 0.1) {
      const nearest = Math.round(s.spin / STAR_STEP) * STAR_STEP
      s.spin += (nearest - s.spin) * (1 - Math.exp(-dt * 2.6))
    }

    // ---------------- 6. arrival: spin in from off-screen, land with an impact ----------------
    if (s.introT < 0 && ready && scroll.aboutArrive) {
      s.introT = 0
      if (sy > vh * 0.5 || REDUCED) {
        s.introT = 9 // arrived mid-page (or reduced motion): no fly-in
        s.landed = true
      }
    }
    let ie = 0
    if (s.introT >= 0) {
      s.introT += dt
      ie = s.introT >= 9 ? 1 : easeOutBack(clamp(s.introT / 1.3, 0, 1))
      if (!s.landed && s.introT / 1.3 >= 0.42) {
        s.landed = true
        s.glow = 1
        kick(0.48)
        if (fx.current) fx.current.burst(x - rad * 0.95, y + rad * 0.1, 0.3, { power: 1, dirX: -1, dirY: 0.4, scale: 1.05 })
        emit('land', 'hero')
      }
      if (s.introT > 1.3) s.introDone = true
    }
    const away = 1 - ie
    x += away * (halfW * 1.25 + rad)
    y += away * 1.2
    z -= away * 1.5
    const introSpin = -away * away * 26

    // ---------------- 7. impacts ----------------
    if (s.prevU != null && s.introDone) {
      const lo = Math.min(s.prevU, u)
      const hi = Math.max(s.prevU, u)
      if (hi > lo) {
        const gradual = hi - lo < 1.6
        for (let kk = Math.ceil(lo); kk <= Math.floor(hi); kk++) {
          const crossed = (s.prevU < kk && u >= kk) || (s.prevU > kk && u <= kk)
          const w = wps[kk]
          if (!crossed || !w || w.kind !== 'hit') continue
          if (gradual) {
            const from = s.prevU < kk ? wps[kk - 1] : wps[kk + 1]
            const ddx = from ? from.x - w.x : 0
            const ddy = from ? from.y - w.y : 1
            if (fx.current) fx.current.burst(w.x, w.y, 0.35, { power: 1, dirX: ddx, dirY: ddy, scale: Math.max(0.7, Math.min(1.2, w.rad * 1.4)) })
            kick(kk >= 6 ? 0.42 : 0.34)
            s.glow = Math.max(s.glow, 0.85)
            s.spinVel += 6 * Math.sign(u - s.prevU)
            emit('hit', w.key)
          } else emit('mark', w.key)
        }
      }
      // the return: the shield is caught in the finale slot
      if (at && i === N - 1 && !s.caught) {
        s.caught = true
        s.glow = 1.2
        kick(0.4)
        if (fx.current) fx.current.burst(x, y, 0.4, { power: 0.9, scale: rad * 1.1, sparks: false })
        emit('catch', 'final')
      }
      if (u < N - 1.6) s.caught = false
    }
    s.prevU = u

    // ---------------- 8. apply ----------------
    s.glow *= Math.exp(-dt * 2.2)
    rad *= 1 + s.hover * 0.025
    P.position.set(x, y, z)
    scaler.current.scale.setScalar(rad)
    s.rx += (rx - s.rx) * (1 - Math.exp(-dt * 10))
    s.ry += wrapAngle(ry - s.ry) * (1 - Math.exp(-dt * 10))
    tilt.current.rotation.set(s.rx, s.ry, 0)
    spinner.current.rotation.z = s.spin + introSpin
    materials.star.emissiveIntensity = 0.02 + s.glow * 1.4 + s.hover * 0.12
    if (rimGlowMat.current) rimGlowMat.current.opacity = Math.min(1, s.glow * 0.85 + s.hover * 0.25)

    // ray burst behind the shield: strongest at rest in the hero / finale, faint in flight
    const S = scroll.sections
    const heroVis = S['about-hero']?.visible ?? 1
    const finVis = S['about-final']?.visible ?? 0
    const stage = Math.max(heroVis, finVis)
    if (rays.current?.mesh) {
      const m = rays.current.mesh
      // skip the full-plane ray shader whenever the shield is out of frame
      m.visible = Math.abs(y - cam.position.y) < halfH + rad * 2.6 && ie > 0
      m.position.set(x, y, z - 1.6)
      m.scale.setScalar(rad * (4.8 + s.glow * 0.8))
      rays.current.mat.uniforms.uIntensity.value = (0.07 + 0.15 * stage * s.restW + s.glow * 0.16) * ie
    }

    // finale dolly-in
    s.camOff.z += (-0.9 * finVis - s.camOff.z) * k
  })

  const lightsHigh = tier !== 'low'
  return (
    <>
      <ImpactFX ref={fx} tier={tier} />
      <HaloRays ref={rays} tier={tier} />
      <group ref={pos}>
        {/* stage lights travel with the shield (but do not spin with it); always in the scene, see useFrame */}
        <primitive object={keyTarget} />
        <spotLight position={[-4.5, 5, 6]} target={keyTarget} angle={0.5} penumbra={0.8} intensity={170} distance={22} decay={2} color="#fff3e6" />
        <pointLight position={[-4, 0.6, 1.2]} intensity={lightsHigh ? 38 : 28} distance={12} decay={2} color="#ff2a3a" />
        <pointLight position={[4.2, 1.6, 1.0]} intensity={lightsHigh ? 46 : 32} distance={12} decay={2} color="#3d74ff" />
        {lightsHigh ? <pointLight position={[0.5, -3.5, 4]} intensity={10} distance={12} decay={2} color="#cfdcff" /> : null}
        <group ref={scaler} visible={false}>
          <group ref={tilt}>
            <group ref={spinner}>
              <Shield materials={materials} segments={segments} hitArea={hit} onOver={onOver} onOut={onOut} onClick={onClick} />
            </group>
            {/* impact / catch glow round the rim */}
            <mesh ref={rimGlow} position={[0, 0, -0.02]}>
              <torusGeometry args={[1.03, 0.022, 8, 128]} />
              <meshBasicMaterial ref={rimGlowMat} color="#e7efff" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  )
}
