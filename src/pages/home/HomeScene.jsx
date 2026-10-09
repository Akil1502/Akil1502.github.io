import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import GlowPlane from '../../three/primitives/GlowPlane'
import { scroll } from '../../three/scrollStore'
import { home, updateBeats, track, trackObj, resetHome, prefersReducedMotion } from './homeStore'
import { useHelmetGeometry } from './three/useHelmetGeometry'
import { getArmorMaterials, armorUniforms } from './three/armor'
import { disposeAll } from './three/useDispose'
import Helmet from './three/Helmet'
import Nanites, { getNaniteMaterial, naniteSize } from './three/Nanites'
import Reactor from './three/Reactor'
import SkillOrbit from './three/SkillOrbit'
import Smoke from './three/Smoke'
import LeaderLines from './three/LeaderLines'
import { TickRing, LockBrackets, Shockwaves } from './three/HudBits'

// ============ HOME · IRON MAN ============
// One pinned stage, scrubbed by scroll (beat coordinate b, see homeStore):
//  b 0–1  SUIT-UP     nanites stream out of the reactor and crawl over the helmet → eyes lamp-strike on
//  b 1–2  DIAGNOSTIC  plates separate (exploded view), scan band, gold leader lines to the four numbers
//  b 2–3  REPULSOR    the armour retracts into the reactor, which takes centre stage and charges → blast
//  b 3–4  IDENTITY    nanotech suit-up #2 on the other side of the screen → power-up impact
//  b 4–5  HERO SELECT reactor powers down, the helmet withdraws to the background and watches the hovered card
//  b 5    NEXT        armour retracts one last time
const DESK_H = [
  { b: 0, x: 2.05, y: 0.55, z: 0, s: 1.45, ry: -0.42, rx: 0.05 },
  { b: 0.62, x: 2.2, y: 0.6, z: 0.35, s: 1.45, ry: -0.3, rx: 0.02 },
  { b: 1.0, x: 2.4, y: 0.24, z: -0.25, s: 1.22, ry: -0.62, rx: 0.08 },
  { b: 1.6, x: 2.4, y: 0.24, z: -0.25, s: 1.22, ry: 0.45, rx: 0.08 },
  { b: 1.95, x: 2.45, y: 0.8, z: -0.9, s: 1.2, ry: 0.0, rx: 0.0 },
  { b: 2.3, x: 2.45, y: 1.3, z: -1.6, s: 1.1, ry: 0.0, rx: -0.1 },
  { b: 2.72, x: -2.4, y: 0.55, z: 0, s: 1.45, ry: 0.42, rx: 0.05 },
  { b: 3.62, x: -2.3, y: 0.6, z: 0.3, s: 1.45, ry: 0.32, rx: 0.02 },
  { b: 4.0, x: 3.5, y: 1.55, z: -2.8, s: 1.15, ry: -0.35, rx: 0.1 },
  { b: 4.6, x: 3.5, y: 1.55, z: -2.8, s: 1.15, ry: -0.35, rx: 0.1 },
  { b: 5.0, x: 0, y: 0.5, z: -3.5, s: 1.0, ry: 0, rx: 0 },
]
// portrait / phones: the copy sits in the lower half of the screen, so the stage lives in the upper half
const PORT_H = [
  { b: 0, x: 0, y: 1.6, z: -0.4, s: 0.82, ry: -0.18, rx: 0.06 },
  { b: 0.62, x: 0, y: 1.65, z: 0, s: 0.84, ry: -0.06, rx: 0.03 },
  { b: 1.0, x: 0, y: 1.75, z: -0.6, s: 0.64, ry: -0.55, rx: 0.08 },
  { b: 1.6, x: 0, y: 1.75, z: -0.6, s: 0.64, ry: 0.55, rx: 0.08 },
  { b: 1.95, x: 0, y: 2.6, z: -1.4, s: 0.58, ry: 0, rx: 0 },
  { b: 2.3, x: 0, y: 3.0, z: -1.8, s: 0.55, ry: 0, rx: -0.1 },
  { b: 2.72, x: 0, y: 1.95, z: -0.4, s: 0.76, ry: 0.18, rx: 0.06 },
  { b: 3.62, x: 0, y: 2.0, z: 0, s: 0.78, ry: 0.06, rx: 0.03 },
  { b: 4.0, x: 0, y: 2.75, z: -3.4, s: 0.7, ry: 0, rx: 0.1 },
  { b: 4.6, x: 0, y: 2.75, z: -3.4, s: 0.7, ry: 0, rx: 0.1 },
  { b: 5.0, x: 0, y: 1.0, z: -4, s: 0.6, ry: 0, rx: 0 },
]
const DESK_R = { x: 1.98, y: -0.1, z: 0.7, s: 0.92 }
const PORT_R = { x: 0, y: 1.2, z: 0.2, s: 0.58 }
const REACTOR_OFF = new THREE.Vector3(0, -1.74, 0.3) // below the helmet, head units
const REACTOR_SCALE = 0.36

// ---- scroll choreography (piecewise smoothstep keys: [b, value]) ----
const T_ARMOR = [[0, 1], [1.92, 1], [2.3, 0], [2.68, 0], [3.2, 1], [4.55, 1], [5.0, 0]]
const T_EXPLODE = [[1.04, 0], [1.3, 1], [1.58, 1], [1.86, 0]]
const T_LINES = [[1.2, 0], [1.4, 1], [1.56, 1], [1.66, 0]]
const T_SCAN = [[1.02, 0], [1.12, 1], [1.58, 1], [1.7, 0]]
const T_CHARGE = [[2.04, 0], [2.55, 1], [2.64, 1], [2.95, 0.04]]
const T_LABELS = [[2.0, 0], [2.12, 1], [2.64, 1], [2.8, 0]]
const T_REACTOR_STAGE = [[1.84, 0], [2.16, 1], [2.64, 1], [2.96, 0]]
const T_REACTOR_VIS = [[3.62, 1], [3.95, 0]]
const T_LIGHT = [[3.7, 1], [4.05, 0.6], [4.6, 0.6], [5, 0.35]]
const T_SMOKE = [[0, 1], [1.0, 0.75], [2.0, 0.55], [2.9, 1], [4.0, 0.45]]
const T_BRACKETS = [[0, 1], [0.5, 1], [0.75, 0], [3.0, 0], [3.3, 1], [3.62, 1], [3.8, 0]]
const T_CAM_X = [[0, 0.25], [1.9, 0.3], [2.3, 0.6], [2.7, 0.2], [3.0, -0.3], [3.7, -0.25], [4.0, 0]]
const T_CAM_Z = [[0, 0], [0.62, -0.55], [1.0, 0.2], [1.6, 0], [2.1, -0.9], [2.6, -1.3], [3.0, -0.2], [3.6, -0.6], [4.0, 0]]

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
// dev-only inspection switch: ?hd=1 skips the intro (helmet fully formed), ?hd=front|side|q|q2|back|top|low poses it
const DEBUG = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('hd') : null
const DBG_POSE = { front: [0, 0.05], side: [1.5, 0.05], q: [-0.6, 0.05], q2: [0.7, -0.15], back: [2.6, 0.1], top: [-0.3, 0.6], low: [0.35, -0.45] }

export default function HomeScene({ tier = 'high', ready }) {
  const { size, gl, scene, camera } = useThree()
  const geo = useHelmetGeometry(tier === 'low' ? 0.7 : 1)
  // session-cached (programs survive a round trip to another page); never disposed here
  const mats = useMemo(() => {
    const m = getArmorMaterials(tier)
    if (DEBUG && new URLSearchParams(window.location.search).get('lime')) m.under.color.set('#39ff14')
    return m
  }, [tier])
  const naniteMat = useMemo(() => getNaniteMaterial(), [])
  const count = tier === 'high' ? 5200 : tier === 'medium' ? 2600 : 1200
  const reduced = useMemo(prefersReducedMotion, [])
  const portrait = size.width <= 960 || size.width / size.height < 0.95

  // Shader warm-up: one hidden stand-in per armour material (+ the swarm) so every program the suit-up needs is
  // compiled — off the critical path, in parallel where the driver allows — before the first plate is drawn.
  const warm = useMemo(() => {
    const g = new THREE.BoxGeometry(0.01, 0.01, 0.01)
    g.deleteAttribute('uv')
    const s = naniteSize(count)
    const hex = new THREE.CylinderGeometry(s, s, s * 0.32, 6, 1)
    const swarm = new THREE.InstancedMesh(hex, naniteMat, 1)
    swarm.setColorAt(0, new THREE.Color('#ffffff'))
    swarm.frustumCulled = false
    return { g, hex, swarm }
  }, [naniteMat, count])

  useEffect(
    () => () => {
      disposeAll(warm.g, warm.hex)
      warm.swarm.dispose()
    },
    [warm],
  )

  const root = useRef()
  const warmG = useRef()
  const fx = useRef()
  const helm = useRef()
  const helmInner = useRef()
  const reactor = useRef()
  const smokeG = useRef()
  const orbit = useRef()
  const brackets = useRef()
  const shock = useRef()
  const bgRing = useRef()
  const keyLight = useRef()
  const rimR = useRef()
  const rimC = useRef()
  const rimG = useRef()
  const eyeLight = useRef()
  const flashLight = useRef()
  const sourceLocal = useRef(new THREE.Vector3(0, -2, 0))

  const dir = useMemo(
    () => ({ explode: 0, lines: 0, charge: 0, labels: 0, reactorPower: 1, reactorVis: 1, blast: 0, hover: false, blink: 0, smoke: 1, lightScale: 1, eyes: 0, eyeLight: 0, flash: 0 }),
    [],
  )
  const dirRef = useRef(dir)
  const st = useRef({ intro: 0, introDelay: 0.35, armed: true, ry: 0, rx: 0, cur: {}, waitFrames: 0, compile: 'idle', warm: false })
  const v = useMemo(() => ({ rWorld: new THREE.Vector3(), att: new THREE.Vector3(), ndc: new THREE.Vector3(), tmp: new THREE.Vector3() }), [])
  const camOff = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  const camLook = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])

  // impacts (once per beat) — wired to the helmet's power-up + click, and the repulsor blast
  useEffect(() => {
    const kick = (amount) => {
      if (!reduced) scroll.impulse = Math.max(scroll.impulse || 0, amount)
    }
    dir.kick = kick
    dir.onPowerUp = () => {
      if (home.b > 4.4) return
      kick(0.45)
      if (!reduced) {
        dir.flash = 1
        home.flash = Math.max(home.flash, 0.55)
      }
      if (helm.current) {
        helm.current.getWorldPosition(v.tmp)
        shock.current?.fire(v.tmp, '#f5c04a', 5.5 * (helm.current.scale.x / 1.45), 1.0)
        v.tmp.z += 0.2
        shock.current?.fire(v.tmp, '#7fe9ff', 4 * (helm.current.scale.x / 1.45), 0.75)
      }
      brackets.current?.lock()
      home.introDone = true
    }
    dir.onRepulsor = () => {
      dir.blink = 1
      kick(0.25)
      if (!reduced) home.flash = Math.max(home.flash, 0.22)
      if (helm.current) {
        helm.current.getWorldPosition(v.tmp)
        v.tmp.z += 1
        shock.current?.fire(v.tmp, '#7fe9ff', 3.2, 0.7)
      }
    }
    return () => {
      dir.onPowerUp = null
      dir.onRepulsor = null
      dir.kick = null
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
      armorUniforms.uReveal.value = 0
      armorUniforms.uScanAmt.value = 0
      armorUniforms.uDiag.value = 0
      resetHome()
    }
  }, [dir, v, reduced])

  // Shader warm-up, driven from the frame loop (no timers to strand). Starts once the studio environment map exists
  // (its presence is part of the program key). Each queued object is compiled against the real scene's lights and
  // — because Effects render the scene into a render target (no tone mapping, linear output) — against a render
  // target too, so the cached programs match the real draw exactly. With KHR_parallel_shader_compile everything is
  // queued at once and polled; without it, one object per frame with its link forced right away, so the cost is
  // paid in small slices while only the reactor is on stage instead of as one freeze when the suit-up starts.
  const warmStep = () => {
    const s = st.current
    if (s.compile === 'idle') {
      if (!warmG.current || !(scene.environment || ++s.waitFrames > 120)) return
      s.compile = 'running'
      s.warmT0 = performance.now()
      s.parallel = gl.extensions.has('KHR_parallel_shader_compile')
      // none of these groups holds a light (compile(obj, camera, scene) would count those twice)
      s.queue = [...warmG.current.children, fx.current, orbit.current].filter(Boolean)
      s.qi = 0
      s.pending = new Set()
      s.rt = tier !== 'low' ? new THREE.WebGLRenderTarget(1, 1) : null
    }
    const steps = s.parallel ? s.queue.length : 1
    for (let k = 0; k < steps && s.qi < s.queue.length; k++) {
      const obj = s.queue[s.qi++]
      const prev = gl.getRenderTarget()
      try {
        if (s.rt) gl.setRenderTarget(s.rt)
        gl.compile(obj, camera, scene).forEach((m) => s.pending.add(m))
      } catch {
        /* a material that cannot be pre-compiled simply compiles on first draw */
      } finally {
        gl.setRenderTarget(prev)
      }
    }
    for (const m of s.pending) {
      const prog = gl.properties.get(m)?.currentProgram
      if (prog && s.parallel && !prog.isReady()) continue
      if (prog && !s.parallel) {
        try {
          prog.getUniforms() // forces the link now
        } catch {
          /* released meanwhile */
        }
      }
      s.pending.delete(m)
    }
    // never hold the suit-up hostage to a driver that is slow to report readiness
    if ((s.qi >= s.queue.length && s.pending.size === 0) || performance.now() - s.warmT0 > 8000) {
      s.compile = 'done'
      s.warm = true
      s.pending.clear()
      s.rt?.dispose()
      s.rt = null
    }
  }
  useEffect(() => () => st.current.rt?.dispose(), [])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const t = state.clock.elapsedTime
    const s = st.current
    const b = updateBeats()
    home.portrait = portrait

    if (s.compile !== 'done') warmStep()
    if (warmG.current) warmG.current.visible = false
    if (helmInner.current) helmInner.current.visible = s.warm

    // ---- nanotech reveal: intro (time) ∧ scroll ----
    if (ready && geo && s.warm) {
      // real time (not frame-clamped) so the suit-up always lasts ~3.2 s, even on a slow frame rate
      const rdt = Math.min(delta, 0.5)
      if (s.introDelay > 0) s.introDelay -= rdt
      else s.intro = Math.min(1, s.intro + rdt / 3.2)
      if (DEBUG || reduced) s.intro = 1
    }
    const A = track(b, T_ARMOR)
    const reveal = Math.min(easeInOut(s.intro), A) * 1.1
    armorUniforms.uReveal.value = reveal
    armorUniforms.uTime.value = t
    home.reveal = Math.min(1, reveal / 1.06)

    // ---- beat values ----
    dir.explode = track(b, T_EXPLODE)
    dir.lines = track(b, T_LINES)
    armorUniforms.uScanAmt.value = track(b, T_SCAN)
    armorUniforms.uScanY.value = Math.sin(t * 1.1) * 1.15
    armorUniforms.uDiag.value = dir.explode
    const C = track(b, T_CHARGE)
    dir.charge = C
    home.charge = C
    dir.labels = track(b, T_LABELS)
    const wR = track(b, T_REACTOR_STAGE)
    const rVis = track(b, T_REACTOR_VIS)
    dir.reactorVis = rVis
    dir.lightScale = track(b, T_LIGHT)
    dir.reactorPower = 0.8 * dir.lightScale
    dir.reactorHud = wR
    dir.smoke = track(b, T_SMOKE)
    dir.blink = Math.max(0, dir.blink - dt * 2.2)
    dir.blast = Math.max(0, dir.blast - dt * 1.4)
    dir.flash = Math.max(0, dir.flash - dt * 2.5)

    // repulsor blast when the charge tops out (re-arms when it drops)
    if (C > 0.985 && s.armed) {
      s.armed = false
      dir.blast = 1
      dir.kick?.(0.6)
      if (!reduced) home.flash = Math.max(home.flash, 0.85)
      if (reactor.current) {
        reactor.current.getWorldPosition(v.tmp)
        v.tmp.z += 0.4
        shock.current?.fire(v.tmp, '#7fe9ff', 9, 1.1)
        shock.current?.fire(v.tmp, '#ffffff', 5, 0.6)
      }
    } else if (C < 0.6) s.armed = true

    // ---- helmet layout ----
    const H = trackObj(b, portrait ? PORT_H : DESK_H, s.cur)
    const g = helm.current
    if (g) {
      g.position.set(H.x, H.y + Math.sin(t * 0.8) * 0.05, H.z)
      g.scale.setScalar(H.s)
      // look at the cursor (or at the hovered hero card) relative to where the helmet sits on screen
      v.ndc.copy(g.position).project(state.camera)
      const lk = home.look.active ? home.look : scroll.mouse
      const gain = home.look.active ? 0.75 : 0.42
      const tY = H.ry + THREE.MathUtils.clamp((lk.x - v.ndc.x) * gain, -0.6, 0.6) + Math.sin(t * 0.35) * 0.04
      const tX = H.rx - THREE.MathUtils.clamp((lk.y - v.ndc.y) * gain * 0.6, -0.35, 0.35) + Math.sin(t * 0.5) * 0.02
      const k = 1 - Math.pow(0.03, dt)
      s.ry += (tY - s.ry) * k
      s.rx += (tX - s.rx) * k
      const pose = DEBUG ? DBG_POSE[DEBUG] : null
      if (pose) {
        s.ry = pose[0]
        s.rx = pose[1]
        g.position.set(0, 0.35, 3.2)
      }
      if (helmInner.current) helmInner.current.rotation.set(s.rx, s.ry, Math.sin(t * 0.4) * 0.015)
    }

    // ---- reactor: attached under the helmet, or centre stage in the repulsor beat; powers down for hero select ----
    const r = reactor.current
    if (r && g) {
      const R = portrait ? PORT_R : DESK_R
      v.att.copy(REACTOR_OFF).multiplyScalar(H.s).add(g.position)
      const sA = REACTOR_SCALE * H.s
      r.position.set(v.att.x + (R.x - v.att.x) * wR, v.att.y + (R.y - v.att.y) * wR, v.att.z + (R.z - v.att.z) * wR)
      // scaled down instead of hidden: its point light must stay in the scene (constant light count)
      r.scale.setScalar(Math.max(0.001, (sA + (R.s - sA) * wR) * rVis))
      r.rotation.set(-0.12 * (1 - wR) + scroll.mouse.y * 0.1, s.ry * 0.4 * (1 - wR) + scroll.mouse.x * 0.15, 0)
      // nanite source = reactor centre in helmet space
      r.getWorldPosition(v.rWorld)
      if (helmInner.current) {
        helmInner.current.updateWorldMatrix(true, false)
        sourceLocal.current.copy(v.rWorld)
        helmInner.current.worldToLocal(sourceLocal.current)
      }
      if (orbit.current) {
        orbit.current.position.copy(r.position)
        orbit.current.scale.setScalar(r.scale.x)
      }
    }
    if (smokeG.current && g) {
      smokeG.current.position.x += (g.position.x - smokeG.current.position.x) * (1 - Math.pow(0.2, dt))
      smokeG.current.position.y += (g.position.y - smokeG.current.position.y) * (1 - Math.pow(0.2, dt))
      smokeG.current.position.z = -0.5
    }
    brackets.current?.setVisible(home.introDone ? track(b, T_BRACKETS) * home.reveal : 0)
    bgRing.current?.setOpacity((0.22 + dir.explode * 0.25) * home.reveal * dir.lightScale)

    // ---- lights (intensities only — never toggled, so the light count is constant) ----
    const ls = dir.lightScale
    if (keyLight.current) keyLight.current.intensity = 1.8 * ls
    if (rimR.current) rimR.current.intensity = 24 * ls
    if (rimC.current) rimC.current.intensity = (14 + C * 30) * ls
    if (rimG.current) rimG.current.intensity = 10 * ls
    if (eyeLight.current) eyeLight.current.intensity = (dir.eyeLight || 0) * 0.9
    if (flashLight.current) {
      flashLight.current.intensity = dir.flash * 120 + dir.blast * 80
      if (g) flashLight.current.position.set(g.position.x, g.position.y + 0.4, g.position.z + 3)
    }

    // ---- camera: gentle dolly per beat ----
    camOff.x = track(b, T_CAM_X) * (portrait ? 0 : 1)
    camOff.y = 0
    camOff.z = track(b, T_CAM_Z)
    camLook.x = camOff.x * 0.6
    camLook.y = 0
    camLook.z = 0
    scroll.camOffset = camOff
    scroll.camLook = camLook
  }, -1)

  return (
    <group ref={root}>
      {/* stage atmosphere */}
      <GlowPlane color={'#e8232a'} intensity={0.34} size={[30, 20]} position={[1.5, 0.4, -8]} />
      <GlowPlane color={'#f5c04a'} intensity={0.12} size={[12, 9]} position={[2.4, 2.6, -6]} softness={2.4} />
      <GlowPlane color={'#7fe9ff'} intensity={0.1} size={[10, 8]} position={[-2.5, -2.4, -6]} softness={2.4} />
      <directionalLight ref={keyLight} position={[3.5, 4.5, 6]} intensity={2.4} color={'#ffe2c4'} />

      {/* shader warm-up stand-ins (never drawn) */}
      <group ref={warmG} visible={false}>
        {Object.values(mats).map((m, i) => (
          <mesh key={i} geometry={warm.g} material={m} />
        ))}
        <primitive object={warm.swarm} />
      </group>

      <group ref={smokeG}>
        <Smoke tier={tier} dirRef={dirRef} />
      </group>

      <group ref={helm}>
        <group ref={helmInner} visible={false}>
          {geo ? (
            <>
              <Helmet geo={geo} mats={mats} dir={dir} />
              <Nanites geo={geo} count={count} sourceRef={sourceLocal} material={naniteMat} />
            </>
          ) : null}
        </group>
        {/* rim + eye lights travel with the helmet */}
        <pointLight ref={rimR} position={[-2.3, 1.1, -1.6]} color={'#ff3020'} intensity={32} distance={9} decay={2} />
        <pointLight ref={rimC} position={[2.4, -0.5, -1.4]} color={'#7fe9ff'} intensity={14} distance={8} decay={2} />
        <pointLight ref={rimG} position={[0.8, 2.8, 0.6]} color={'#ffd38a'} intensity={14} distance={7} decay={2} />
        <pointLight ref={eyeLight} position={[0, 0.2, 1.6]} color={'#9ff4ff'} intensity={0} distance={2.4} decay={2} />
        <TickRing ref={bgRing} radius={1.62} ticks={144} gauge={0.68} color={'#f5c04a'} opacity={0.22} speed={0.05} major={12} position={[0, -0.05, -1.1]} />
        <LockBrackets ref={brackets} w={1.85} h={2.5} position={[0, -0.1, 0.95]} color={'#f5c04a'} />
      </group>

      <group ref={reactor}>
        <Reactor dir={dir} tier={tier} />
      </group>
      <group ref={orbit}>
        <SkillOrbit dir={dir} radius={portrait ? 1.6 : 2.3} compact={portrait} />
      </group>

      <group ref={fx}>
        <LeaderLines dir={dir} compact={portrait} />
        <Shockwaves ref={shock} />
      </group>
      <pointLight ref={flashLight} color={'#fff1d0'} intensity={0} distance={14} decay={2} />
    </group>
  )
}
