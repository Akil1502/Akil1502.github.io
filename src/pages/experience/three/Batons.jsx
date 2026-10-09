import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import Bolts, { makeBolt } from './Bolts'
import { RING_R } from './Gimbal'
import { disposeAll } from '../signals'

/* Two original escrima-style stun BATONS flanking the emblem (rubber grip with rings, guard, gunmetal shaft with
   three charge bands, silver collar, glowing emitter and a forked tip) and the arcs they throw:
     0      tip ↔ tip, bowed high so it leaps over the ring            (DECRYPT flare, hover, while decrypting)
     1, 2   tip → ring                                                 (flare, hover, random idle sparks)
     3, 4   tip → floor (ground strike)                                (strong flares only)
     5, 6   micro-arcs across each forked tip                          (always crackling once charged)
     7, 8   ring bearings → neck, crawling along the axle              (flare: the emblem drinks the charge)
   `fx` (cluster state) supplies charge (hero ignition), flare (decayed DECRYPT stamp), hover, decrypting,
   assemble offset and the floor height in cluster-local units. Charge bands light one by one with the charge. */

const BX = 2.48
const BY = -0.22
const LEAN = 0.14
const TIP = 1.23
const PRONG = 0.046
const ICE = '#a8d4ff'

function useBatonMaterials() {
  const m = useMemo(() => {
    const gun = new THREE.MeshStandardMaterial({ color: '#3a3f48', metalness: 1, roughness: 0.3, envMapIntensity: 1.6 })
    const rubber = new THREE.MeshStandardMaterial({ color: '#141418', metalness: 0.15, roughness: 0.78, envMapIntensity: 0.6 })
    const silver = new THREE.MeshStandardMaterial({ color: '#c3cad4', metalness: 1, roughness: 0.16, envMapIntensity: 2 })
    const bands = [0, 1, 2].map(
      () => new THREE.MeshStandardMaterial({ color: '#2a0007', emissive: '#ff1030', emissiveIntensity: 0, roughness: 0.4, toneMapped: false }),
    )
    const emitter = new THREE.MeshStandardMaterial({ color: '#e6f2ff', emissive: ICE, emissiveIntensity: 0.2, roughness: 0.3, toneMapped: false })
    return { gun, rubber, silver, bands, emitter }
  }, [])
  useEffect(() => () => disposeAll(m.gun, m.rubber, m.silver, m.bands, m.emitter), [m])
  return m
}

function Baton({ m }) {
  return (
    <group>
      {/* pommel */}
      <mesh material={m.silver} position={[0, -1.13, 0]} scale={[1, 0.7, 1]}>
        <sphereGeometry args={[0.085, 20, 14]} />
      </mesh>
      {/* rubber grip + rings */}
      <mesh material={m.rubber} position={[0, -0.76, 0]}>
        <cylinderGeometry args={[0.072, 0.07, 0.66, 20]} />
      </mesh>
      {[-1.04, -0.93, -0.82, -0.71, -0.6, -0.49].map((y) => (
        <mesh key={y} material={m.gun} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.073, 0.011, 8, 28]} />
        </mesh>
      ))}
      {/* guard */}
      <mesh material={m.silver} position={[0, -0.41, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.05, 24]} />
      </mesh>
      {/* shaft */}
      <mesh material={m.gun} position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.046, 0.05, 1.26, 20]} />
      </mesh>
      {/* charge bands */}
      {[-0.05, 0.25, 0.55].map((y, k) => (
        <mesh key={y} material={m.bands[k]} position={[0, y, 0]}>
          <cylinderGeometry args={[0.053, 0.053, 0.035, 20]} />
        </mesh>
      ))}
      {/* collar + emitter + forked tip */}
      <mesh material={m.silver} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.066, 0.06, 0.1, 20]} />
      </mesh>
      <mesh material={m.emitter} position={[0, 1.03, 0]}>
        <cylinderGeometry args={[0.04, 0.046, 0.16, 16]} />
      </mesh>
      <mesh material={m.silver} position={[PRONG, 1.165, 0]} rotation={[0, 0, -0.12]}>
        <boxGeometry args={[0.018, 0.13, 0.018]} />
      </mesh>
      <mesh material={m.silver} position={[-PRONG, 1.165, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.018, 0.13, 0.018]} />
      </mesh>
    </group>
  )
}

export default function Batons({ fx }) {
  const m = useBatonMaterials()
  const left = useRef()
  const right = useRef()
  const lightL = useRef()
  const lightR = useRef()
  const glowL = useRef()
  const glowR = useRef()
  const spark = useRef({ next: 2, until: 0, which: 1 })
  const bolts = useMemo(
    () => [
      makeBolt({ amp: 0.05, width: 1.2 }),
      makeBolt({ amp: 0.13 }),
      makeBolt({ amp: 0.13 }),
      makeBolt({ amp: 0.09, width: 1.1 }),
      makeBolt({ amp: 0.09, width: 1.1 }),
      makeBolt({ amp: 0.4, width: 0.6 }),
      makeBolt({ amp: 0.4, width: 0.6 }),
      makeBolt({ amp: 0.07, width: 0.8 }),
      makeBolt({ amp: 0.07, width: 0.8 }),
    ],
    [],
  )

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const asm = fx.asmBat
    const glow = fx.glow
    const ch = fx.charge
    const f = fx.flare
    const hov = fx.hover
    const dec = fx.decrypting

    // --- baton poses (assemble: they spin in from the sides)
    const bobL = Math.sin(t * 1.1) * 0.05
    const bobR = Math.sin(t * 1.1 + 1.7) * 0.05
    const xL = -BX - asm * 6
    const xR = BX + asm * 6
    const rL = LEAN + Math.sin(t * 0.7) * 0.03 + asm * 5
    const rR = -LEAN - Math.sin(t * 0.7 + 1) * 0.03 - asm * 5
    left.current.position.set(xL, BY + bobL, 0.15)
    left.current.rotation.set(0, 0.35, rL, 'ZYX')
    right.current.position.set(xR, BY + bobR, 0.15)
    right.current.rotation.set(0, -0.35, rR, 'ZYX')
    // tip (fork centre) positions in cluster space
    const tLx = xL - Math.sin(rL) * TIP
    const tLy = BY + bobL + Math.cos(rL) * TIP
    const tRx = xR - Math.sin(rR) * TIP
    const tRy = BY + bobR + Math.cos(rR) * TIP

    // --- charge bands light one by one; the emitter brightens with charge, flares white
    for (let k = 0; k < 3; k++) {
      const on = THREE.MathUtils.clamp(ch * 3 - k, 0, 1)
      m.bands[k].emissiveIntensity = (on * (2.2 + 0.6 * Math.sin(t * 6 + k)) + f * 2) * glow
    }
    m.emitter.emissiveIntensity = (0.3 + 2.6 * ch + 6 * f + 1.5 * hov) * glow

    // --- idle sparks once charged
    const sp = spark.current
    if (t > sp.next && ch > 0.6 && asm < 0.01) {
      sp.until = t + 0.1 + Math.random() * 0.12
      sp.which = Math.random() < 0.5 ? 1 : 2
      sp.next = t + 1.4 + Math.random() * 3.2
    }
    const idle = t < sp.until ? 0.75 : 0

    const live = asm < 0.02 ? 1 : 0
    const ground = fx.floorLocal
    // 0: tip ↔ tip over the ring
    bolts[0].a.set(tLx, tLy, 0.15)
    bolts[0].b.set(tRx, tRy, 0.15)
    bolts[0].bow.set(0, 1.25, 0.2)
    bolts[0].power = Math.max(f, hov * 0.7, dec * 0.42) * live * glow
    // 1, 2: tips → ring
    bolts[1].a.set(tLx, tLy, 0.15)
    bolts[1].b.set(Math.cos(2.75) * RING_R, Math.sin(2.75) * RING_R, 0)
    bolts[1].bow.set(0, 0.25, 0.1)
    bolts[1].power = Math.max(f * 0.95, hov * 0.45, sp.which === 1 ? idle : 0) * live * glow
    bolts[2].a.set(tRx, tRy, 0.15)
    bolts[2].b.set(Math.cos(0.39) * RING_R, Math.sin(0.39) * RING_R, 0)
    bolts[2].bow.set(0, 0.25, 0.1)
    bolts[2].power = Math.max(f * 0.95, hov * 0.45, sp.which === 2 ? idle : 0) * live * glow
    // 3, 4: ground strikes on strong flares
    bolts[3].a.set(tLx, tLy, 0.15)
    bolts[3].b.set(tLx - 0.55, ground, 0.7)
    bolts[3].bow.set(-0.35, 0, 0)
    bolts[3].power = (f > 0.45 ? f : 0) * live * glow
    bolts[4].a.set(tRx, tRy, 0.15)
    bolts[4].b.set(tRx + 0.55, ground, 0.7)
    bolts[4].bow.set(0.35, 0, 0)
    bolts[4].power = (f > 0.45 ? f : 0) * live * glow
    // 5, 6: micro arcs across each fork
    const cL = Math.cos(rL)
    const sL = Math.sin(rL)
    const cR = Math.cos(rR)
    const sR = Math.sin(rR)
    const py = TIP + 0.01
    bolts[5].a.set(xL + PRONG * cL - py * sL, BY + bobL + PRONG * sL + py * cL, 0.15)
    bolts[5].b.set(xL - PRONG * cL - py * sL, BY + bobL - PRONG * sL + py * cL, 0.15)
    bolts[5].power = (0.25 + 0.75 * ch) * (Math.random() < 0.8 ? 1 : 0.2) * live * glow
    bolts[6].a.set(xR + PRONG * cR - py * sR, BY + bobR + PRONG * sR + py * cR, 0.15)
    bolts[6].b.set(xR - PRONG * cR - py * sR, BY + bobR - PRONG * sR + py * cR, 0.15)
    bolts[6].power = (0.25 + 0.75 * ch) * (Math.random() < 0.8 ? 1 : 0.2) * live * glow
    // 7, 8: along the axle into the neck
    bolts[7].a.set(-RING_R + 0.05, 0, 0)
    bolts[7].b.set(-0.12, 0, 0)
    bolts[7].power = Math.max(f * 0.85, hov * 0.25) * live * glow
    bolts[8].a.set(RING_R - 0.05, 0, 0)
    bolts[8].b.set(0.12, 0, 0)
    bolts[8].power = Math.max(f * 0.85, hov * 0.25) * live * glow

    // --- tip lights + glows
    const li = (0.6 + 5 * ch + 34 * f + 10 * hov) * glow * live
    lightL.current.position.set(tLx, tLy, 0.4)
    lightR.current.position.set(tRx, tRy, 0.4)
    lightL.current.intensity = li * (0.85 + 0.3 * Math.random())
    lightR.current.intensity = li * (0.85 + 0.3 * Math.random())
    glowL.current.position.set(tLx, tLy, 0.12)
    glowR.current.position.set(tRx, tRy, 0.12)
    const gs = (0.25 + 0.5 * ch + 1.4 * f + 0.4 * hov) * glow * live
    glowL.current.scale.setScalar(Math.max(0.001, gs))
    glowR.current.scale.setScalar(Math.max(0.001, gs))
  })

  return (
    <group>
      <group ref={left}>
        <Baton m={m} />
      </group>
      <group ref={right}>
        <Baton m={m} />
      </group>
      <pointLight ref={lightL} color={ICE} intensity={0} distance={5.5} decay={2} />
      <pointLight ref={lightR} color={ICE} intensity={0} distance={5.5} decay={2} />
      <TipGlow ref={glowL} />
      <TipGlow ref={glowR} />
      <Bolts bolts={bolts} core={'#ffffff'} glow={'#7fb8ff'} thickness={0.013} />
    </group>
  )
}

// small additive billboard-ish glow at each tip
const tipVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const tipFrag = /* glsl */ `
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * d * 7.0) * 0.9 + exp(-d * 22.0) * 2.0;
    gl_FragColor = vec4(vec3(0.55, 0.78, 1.0) * g, g);
  }
`
const TipGlow = ({ ref }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: tipVert,
        fragmentShader: tipFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh ref={ref} material={mat} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
