import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import GlowPlane from '../../../three/primitives/GlowPlane'
import Hourglass from './Hourglass'
import Gimbal from './Gimbal'
import Batons from './Batons'
import { stage } from './stage'
import { scroll, clamp } from '../../../three/scrollStore'
import { age, decay, strikeCurve, backOut, impact, flare, initXp } from '../signals'

/* The emblem cluster: hourglass in its gimbal ring, flanked by the two batons. It is pinned to the viewport and
   steered by the stage director (stage.js), and it answers the DOM's beats:
   - ASSEMBLE on the page intro (xp.intro): ring spins up from a collapsed tumble, the two glass triangles drop/rise
     into the axle, the batons spin in from the sides → IMPACT (camera jolt + floor shockwave) + first DECRYPT flare,
     then the emblem powers on with the LAMP STRIKE flicker
   - IGNITION while the hero is pinned (stage.hero): gyro ring opens, batons charge band by band, turntable half-spin
   - TURN on every section change (stage.flip): the hourglass turns over on its axle, the sand runs the other way
   - DECRYPT flares (xp.arc) / hover (xp.hover) / running decrypts (xp.decrypting): arcs, flashes, light surges
   It writes one per-frame state object (`fx`) that its parts read; nothing here allocates per frame. */

const RED = '#ff1030'

export default function Cluster() {
  const group = useRef()
  const redLight = useRef()
  const rimLight = useRef()
  const halo = useRef()
  const landed = useRef(false)
  const placed = useRef(false)
  const fx = useMemo(
    () => ({
      glow: 0,
      flare: 0,
      flash: 0,
      charge: 0.3,
      hover: 0,
      decrypting: 0,
      asmA: 1,
      asmB: 1,
      asmRing: 1,
      asmBat: 1,
      turn: 0,
      spin: 0,
      open: 0,
      velocity: 0,
      floorLocal: -2.6,
    }),
    [],
  )
  const pos = useMemo(() => new THREE.Vector3(stage.x, stage.y, stage.z), [])
  const scl = useRef(stage.s)

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const x = initXp()
    const t = state.clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const k = 1 - Math.pow(0.0015, d) // follow the stage
    const kSlow = 1 - Math.pow(0.05, d)

    // ---- ASSEMBLE from the intro stamp. Before the intro the cluster is collapsed to a point instead of hidden:
    // hiding it would drop its four point lights from the scene and recompile every lit shader when it appears.
    const ia = age(x.intro)
    if (ia < 0) {
      landed.current = false
      placed.current = false
      g.scale.setScalar(1e-4)
      redLight.current.intensity = 0
      rimLight.current.intensity = 0
      fx.glow = 0
      return
    }
    const a = clamp(ia / 1.9, 0, 1)
    fx.asmRing = 1 - backOut(clamp(a / 0.55, 0, 1), 1.3)
    fx.asmA = 1 - backOut(clamp((a - 0.14) / 0.5, 0, 1), 1.1)
    fx.asmB = 1 - backOut(clamp((a - 0.22) / 0.5, 0, 1), 1.1)
    fx.asmBat = 1 - backOut(clamp((a - 0.4) / 0.58, 0, 1), 1.5)
    if (a >= 1 && !landed.current) {
      landed.current = true
      if (ia < 4) {
        impact(0.5)
        flare(0.85)
      }
    }

    // ---- power: lamp strike after the landing, scaled by the stage focus
    const strike = strikeCurve(x.intro, 1.75)
    fx.glow = stage.focus * (0.18 + 0.82 * strike)
    fx.flare = decay(x.arc, 2.3) * (x.arcPower || 0)
    fx.flash = decay(x.arc, 7) * (x.arcPower || 0) * 0.8
    fx.hover += ((x.hover >= 0 ? 1 : 0) - fx.hover) * kSlow
    fx.decrypting += (Math.min(1, x.decrypting || 0) - fx.decrypting) * kSlow
    const past = stage.key > 0.06
    fx.charge += ((past ? 1 : 0.3 + 0.7 * stage.hero) - fx.charge) * kSlow
    fx.open += ((past ? 1 : stage.hero) - fx.open) * kSlow
    fx.spin += ((past ? Math.PI : stage.hero * Math.PI) - fx.spin) * k
    fx.turn += (stage.flip - fx.turn) * k
    fx.velocity = scroll.velocity || 0

    // ---- pose: follow the stage, lean to the mouse, breathe
    pos.set(stage.x, stage.y + Math.sin(t * 0.7) * 0.06, stage.z)
    if (placed.current) g.position.lerp(pos, k)
    else {
      // first assembled frame: start on the key (the parts fly in on their own), not from the origin
      placed.current = true
      g.position.copy(pos)
      scl.current = stage.s
      fx.turn = stage.flip // intro mid-page: do not spin through every turn it missed
    }
    scl.current += (stage.s - scl.current) * k
    g.scale.setScalar(scl.current)
    g.rotation.y = scroll.mouse.x * 0.3 + Math.sin(t * 0.23) * 0.07
    g.rotation.x = -scroll.mouse.y * 0.12 + Math.sin(t * 0.31) * 0.03
    fx.floorLocal = (stage.floorY - g.position.y) / Math.max(0.1, scl.current)

    // ---- lights
    redLight.current.intensity = (3 + 12 * fx.glow + 28 * fx.flash) * (0.9 + 0.1 * Math.sin(t * 5.3))
    rimLight.current.intensity = 14 * stage.focus
    const hu = halo.current?.material?.uniforms
    if (hu) hu.uIntensity.value = 0.12 + 0.18 * fx.glow + fx.flare * 0.3
  })

  return (
    <group ref={group} scale={1e-4}>
      <GlowPlane ref={halo} color={RED} intensity={0.2} size={[10, 10]} softness={2.4} position={[0, 0, -1.4]} />
      <pointLight ref={redLight} color={RED} intensity={0} distance={8} decay={2} position={[0, 0, 0.9]} />
      <pointLight ref={rimLight} color={'#dbe4f2'} intensity={0} distance={10} decay={2} position={[-1.8, 3.4, -2.2]} />
      <Gimbal fx={fx} />
      <Hourglass fx={fx} />
      <Batons fx={fx} />
    </group>
  )
}
