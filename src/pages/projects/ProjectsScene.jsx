import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { scroll } from '../../three/scrollStore'
import GlowPlane from '../../three/primitives/GlowPlane'
import { gamma } from './store'
import { COL, CX, CZ, GROUND_Y, clamp01, smooth } from './three/gammaConst'
import GammaGround, { groundBus, fireShock } from './three/GammaGround'
import Debris from './three/Debris'
import SmashFX from './three/SmashFX'
import GammaHaze from './three/GammaHaze'
import Machines from './three/machines/Machines'

// PROJECTS — HULK. The stage is a cracked, gamma-irradiated impact crater seen from a low crane camera.
// Scroll beats (camera + field), read from the DOM sections every frame:
//   projects-hero    A: high three-quarter shot of the crater, debris hovering, fissures smouldering
//                    → scrolling charges the field: debris climbs, the gamma column rises, the camera dollies in
//                    → B: containment breaks (DOM fires the SMASH), the camera swings so the crater sits left
//   projects-lineup  the camera levels out and the ground sinks into a band under the five project cards; every
//                    card that smashes down sends a shockwave through the ground under it
//   projects-outro   crane up to a wide shot of the whole crater, every crack lit
// SMASH requests come from the DOM through gamma.smashes (screen point → projected onto the ground here).

const V = (x, y, z) => new THREE.Vector3(x, y, z)
// camera presets: offset from the rig home (0, 0, 10) and the look-at point (desktop / portrait)
const CAM = {
  a: { off: V(0, 3.4, 0), look: V(0.1, -2.6, -6.6) },
  b: { off: V(-0.6, 1.3, -3.2), look: V(3.9, -2.1, -6.6) },
  l: { off: V(0, 0.5, 0), look: V(0, -0.7, -6) },
  o: { off: V(0, 3.6, 0.8), look: V(0.9, -2.9, -6.6) },
  // closing call to action: the camera tilts up and away, the crater slides to the lower right, out from under
  // the next hero's name
  n: { off: V(0, 2.6, 0.8), look: V(CX - 4.6, -0.6, -6.6) },
}
const CAM_P = {
  a: { off: V(0, 2.8, 1), look: V(CX, -2.5, -6.6) },
  b: { off: V(0, 1.8, -1.5), look: V(CX, -2.4, -6.6) },
  // stacked cards scroll over the whole frame on a phone: tilt up so the crater sits low and the cards' machine
  // slots mostly frame the bruised sky and haze instead of the hot crater
  l: { off: V(0, 0.4, 0), look: V(0, 1, -6) },
  o: { off: V(0, 4.2, 1.5), look: V(CX, -3, -6.6) },
  n: { off: V(0, 2.6, 1.5), look: V(CX - 5.2, -0.4, -6.6) },
}

// how far a pinned section has been scrolled through (0 at its top, 1 when its sticky stage releases)
function pinProgress(id) {
  const s = scroll.sections[id]
  if (!s) return 0
  const vh = scroll.vh || window.innerHeight
  return clamp01((scroll.y - s.top) / Math.max(1, s.height - vh))
}
// 0 → 1 as a section's top travels from `from` to `to` (both in viewport heights below the top of the viewport)
function arriving(id, from = 1, to = 0) {
  const s = scroll.sections[id]
  if (!s) return 0
  const vh = scroll.vh || window.innerHeight
  return smooth(0, 1, (scroll.y - (s.top - vh * from)) / (vh * (from - to)))
}

const columnVert = /* glsl */ `
  varying vec2 vUv;
  varying float vFace;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFace = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`
const columnFrag = /* glsl */ `
  uniform float uTime;
  uniform float uK;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFace;
  void main() {
    float s = sin(vUv.x * 6.2832 * 3.0 + vUv.y * 9.0 - uTime * 5.0) * 0.5 + 0.5;
    float s2 = sin(vUv.x * 6.2832 * 7.0 - vUv.y * 14.0 - uTime * 7.0) * 0.5 + 0.5;
    float fall = pow(1.0 - vUv.y, 1.6);
    // soft silhouette: the beam is brightest where we look straight through it
    float a = (0.35 + 0.65 * s * s2) * fall * uK * pow(vFace, 1.6) * smoothstep(0.0, 0.08, vUv.y);
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`

export default function ProjectsScene({ tier }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const groundGroup = useRef()
  const fx = useRef()
  const craterLight = useRef()
  const rimLight = useRef()
  const smashLight = useRef()
  const column = useRef()
  const field = useRef({
    lev: 1,
    drop: 0,
    glow: 0.7,
    flashAt: -10,
    flashPower: 0,
    flashPos: new THREE.Vector3(),
    off: new THREE.Vector3(),
    look: new THREE.Vector3(),
    // the camera hand-off objects written into the shared scroll store (mutated in place, never re-allocated)
    camOffset: { x: 0, y: 0, z: 0 },
    camLook: { x: 0, y: 0, z: 0 },
  }).current
  const tmp = useMemo(
    () => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3() }),
    [],
  )
  const columnMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: columnVert,
        fragmentShader: columnFrag,
        uniforms: { uTime: { value: 0 }, uK: { value: 0 }, uColor: { value: new THREE.Color(COL.green) } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    [],
  )
  const columnGeo = useMemo(() => new THREE.CylinderGeometry(0.55, 1.15, 9, 40, 1, true).translate(0, 4.5, 0), [])

  // the camera belongs to every page: give it back level and centred when this page unmounts (fresh objects, so
  // the next page never shares ours); the hand-made GPU resources go with the page
  useEffect(
    () => () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
      columnMat.dispose()
      columnGeo.dispose()
    },
    [columnMat, columnGeo],
  )

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const portrait = size.width / size.height < 0.85
    const P = portrait ? CAM_P : CAM

    // ---------------------------------------------------------------- beats
    const hp = pinProgress('projects-hero')
    const wl = arriving('projects-lineup', 1)
    const wo = arriving('projects-outro', 0.9)
    // the closing call to action needs calm ground behind it
    // (complete once the call to action fills the lower two thirds, so it lands even where the page ends early)
    const wn = arriving('projects-next', 1, 0.35)
    const ab = smooth(0.32, 0.62, hp)
    const off = field.off.copy(P.a.off).lerp(P.b.off, ab)
    const look = field.look.copy(P.a.look).lerp(P.b.look, ab)
    off.lerp(P.l.off, wl).lerp(P.o.off, wo).lerp(P.n.off, wn)
    look.lerp(P.l.look, wl).lerp(P.o.look, wo).lerp(P.n.look, wn)
    // breathing crane drift so the shot is never static
    off.x += Math.sin(t * 0.13) * 0.25
    off.y += Math.sin(t * 0.21) * 0.08
    const co = field.camOffset
    co.x = off.x
    co.y = off.y
    co.z = off.z
    const cl = field.camLook
    cl.x = look.x
    cl.y = look.y
    cl.z = look.z
    scroll.camOffset = co
    scroll.camLook = cl

    // the ground sinks under the lineup so the DOM-anchored machines are never occluded
    const lineupOnly = wl * (1 - wo)
    if (groundGroup.current) groundGroup.current.position.y = GROUND_Y - 0.9 * lineupOnly

    // gamma field: hover in beat A, charging through the scroll, held high in B, calmer under the lineup
    const charge = smooth(0.2, 0.5, hp)
    let lev = 0.42 + 0.58 * charge
    // under the lineup the rocks settle low so they never clutter the machine slots
    lev = lev * (1 - lineupOnly) + 0.12 * lineupOnly
    lev = lev * (1 - wo) + 0.5 * wo
    if (!gamma.live) lev = 1 // before arrival the debris hangs in the air, waiting for the first smash
    field.lev = lev
    if (field.drop > 0) field.drop -= dt
    // under the lineup the ground calms down (more on portrait, where the cards sit right on top of it)
    const lineupGlow = portrait ? 0.42 : 0.85
    const heroGlow = 1.05 + 0.6 * charge
    let glowTarget = heroGlow * (1 - lineupOnly) + lineupGlow * lineupOnly
    glowTarget = glowTarget * (1 - wo) + 1.55 * wo
    glowTarget = (glowTarget + (gamma.rowHover >= 0 ? 0.6 : 0)) * (1 - 0.6 * wn)
    field.glow += (glowTarget - field.glow) * (1 - Math.pow(0.05, dt))
    groundBus.uGlow.value = field.glow

    // gamma column: rises out of the crater while the field charges (beat A → B), recedes after the breach
    const colK = smooth(0.18, 0.46, hp) * (1 - smooth(0.56, 0.8, hp)) * (1 - wl) + wo * 0.35 * (1 - wn)
    columnMat.uniforms.uTime.value = t
    columnMat.uniforms.uK.value = colK * (0.8 + 0.2 * Math.sin(t * 9)) + groundBus.uFlare.value * 0.5
    if (column.current) {
      column.current.visible = columnMat.uniforms.uK.value > 0.003
      column.current.scale.set(0.8 + colK * 0.5, 0.3 + colK * 0.9, 0.8 + colK * 0.5)
    }

    // ---------------------------------------------------------------- SMASH requests from the DOM
    while (gamma.smashes.length) {
      const s = gamma.smashes.shift()
      const gy = groundGroup.current ? groundGroup.current.position.y : GROUND_Y
      let x = CX
      let z = CZ
      if (s.sx != null && s.sy != null) {
        camera.updateMatrixWorld()
        tmp.ndc.set((s.sx / size.width) * 2 - 1, -((s.sy / size.height) * 2 - 1))
        tmp.ray.setFromCamera(tmp.ndc, camera)
        tmp.plane.constant = -gy
        if (tmp.ray.ray.intersectPlane(tmp.plane, tmp.hit) && tmp.hit.z > -24 && tmp.hit.z < 5) {
          x = tmp.hit.x
          z = tmp.hit.z
        } else {
          x = THREE.MathUtils.clamp(camera.position.x + (s.sx / size.width - 0.5) * 10, -12, 12)
          z = 0
        }
      }
      fireShock(x, z, s.big ? 1.4 : 1)
      fx.current?.fire(x, 0.05, z, s.power, s.big)
      groundBus.uFlare.value = Math.min(2.2, groundBus.uFlare.value + (s.big ? 1.6 : 0.9))
      gamma.crack = Math.min(1, Math.max(gamma.crack, s.crack || 0) + 0.06)
      if (s.big) field.drop = 0.32
      field.flashAt = t
      field.flashPower = s.power * (s.big ? 1.6 : 1)
      field.flashPos.set(x, gy + 1.2, z)
    }

    // ---------------------------------------------------------------- lights
    const fl = groundBus.uFlare.value
    if (craterLight.current) {
      const flicker = 0.88 + 0.12 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1)
      craterLight.current.intensity = (26 + 40 * charge * (1 - wl) + 18 * wo) * field.glow * flicker + fl * 60
      craterLight.current.position.set(CX, (groundGroup.current ? groundGroup.current.position.y : GROUND_Y) + 1.1 + lev * 0.6, CZ)
    }
    if (rimLight.current) rimLight.current.intensity = 70 + 30 * Math.sin(t * 0.7)
    if (smashLight.current) {
      const age = t - field.flashAt
      smashLight.current.intensity = age >= 0 && age < 1 ? field.flashPower * 320 * Math.exp(-age * 5) : 0
      smashLight.current.position.copy(field.flashPos)
    }
  })

  return (
    <group>
      <group ref={groundGroup} position={[0, GROUND_Y, 0]}>
        <GammaGround tier={tier} />
        <Debris tier={tier} state={field} />
        <SmashFX ref={fx} tier={tier} />
        <mesh ref={column} position={[CX, -0.6, CZ]} geometry={columnGeo} material={columnMat} frustumCulled={false} renderOrder={2} visible={false} />
        <GammaHaze tier={tier} bus={groundBus} />
        {/* soft volumetric glows: gamma green over the crater, bruised purple sky behind */}
        <GlowPlane color={COL.green} intensity={0.32} size={[22, 9]} position={[CX, 2.2, CZ - 3]} softness={1.8} />
        <GlowPlane color={COL.purple} intensity={0.45} size={[46, 18]} position={[CX - 2, 6, CZ - 12]} softness={1.4} />
      </group>
      <Machines tier={tier} />
      <pointLight ref={craterLight} color={COL.green} intensity={30} distance={16} decay={1.6} position={[CX, GROUND_Y + 1.2, CZ]} />
      <pointLight ref={rimLight} color={COL.purpleHi} intensity={70} distance={26} decay={1.6} position={[CX - 3, GROUND_Y + 5, CZ - 7]} />
      <pointLight ref={smashLight} color={COL.lime} intensity={0} distance={14} decay={1.7} position={[CX, GROUND_Y + 1, CZ]} />
    </group>
  )
}
