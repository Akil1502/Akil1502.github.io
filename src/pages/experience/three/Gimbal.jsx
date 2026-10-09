import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import HudRing from '../../../three/primitives/HudRing'
import { disposeAll } from '../signals'

/* The mount the hourglass turns in:
   - a brushed gunmetal main ring with a red emissive groove on its inner face
   - 60 engraved index marks on its front face; a red "chase" light runs around them (speeds up with scroll velocity
     and on every DECRYPT flare) — the ring reads as spinning even though the axle stays level
   - a horizontal axle with bearing hubs (the hourglass pivots on it)
   - a slim outer gyro ring that spins about its own axis and opens wider as the hero ignites
   - a HUD tick ring far behind, slowly counter-rotating
   `fx` supplies glow, flare, charge, the ignition `open` amount, velocity and the assemble offset. */

export const RING_R = 1.86
const MARKS = 60
const tmp = new THREE.Object3D()
const col = new THREE.Color()
const RED = new THREE.Color('#ff1030')
const DIM = new THREE.Color('#2c3038')
const HOT = new THREE.Color('#ffd9de')

export default function Gimbal({ fx }) {
  const root = useRef()
  const marks = useRef()
  const groove = useRef()
  const gyro = useRef()
  const gyroInner = useRef()
  const hud = useRef()
  const chase = useRef(0)
  const markCol = useMemo(() => new Float32Array(MARKS * 3), [])

  const mats = useMemo(
    () => ({
      gun: new THREE.MeshPhysicalMaterial({ color: '#4a505b', metalness: 1, roughness: 0.27, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 1.9 }),
      dark: new THREE.MeshStandardMaterial({ color: '#23262d', metalness: 1, roughness: 0.38, envMapIntensity: 1.4 }),
      groove: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.06, 0.16), toneMapped: false }),
      bead: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.2, 0.3), toneMapped: false }),
    }),
    [],
  )
  useEffect(() => () => disposeAll(Object.values(mats)), [mats])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const glow = fx.glow
    const asm = fx.asmRing
    // intro: the ring spins up from a collapsed, tumbling state
    root.current.scale.setScalar(Math.max(0.001, 1 - asm * 0.85))
    root.current.rotation.set(asm * 1.2, asm * -2.2, asm * -3.4)

    // chase light around the index marks
    chase.current += d * (0.35 + Math.min(Math.abs(fx.velocity) / 30, 2.5) + fx.flare * 3 + fx.charge * 0.25)
    const head = chase.current % 1
    const mi = marks.current
    for (let i = 0; i < MARKS; i++) {
      const a = (i / MARKS) * Math.PI * 2 + Math.PI / 2
      const major = i % 5 === 0
      const len = major ? 0.16 : 0.08
      const r = RING_R - 0.02
      tmp.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.085)
      tmp.rotation.set(0, 0, a)
      tmp.scale.set(len, major ? 0.022 : 0.012, 0.01)
      tmp.updateMatrix()
      mi.setMatrixAt(i, tmp.matrix)
      let dist = Math.abs(i / MARKS - head)
      dist = Math.min(dist, 1 - dist)
      const lit = Math.exp(-dist * dist * 900) + Math.exp(-dist * 40) * 0.25
      col.copy(major ? RED : DIM).lerp(HOT, Math.min(1, lit * 0.8))
      col.multiplyScalar((major ? 0.9 : 0.5) + lit * 3 * glow + fx.flare * (major ? 1.6 : 0.6))
      mi.setColorAt(i, col)
    }
    mi.instanceMatrix.needsUpdate = true
    if (mi.instanceColor) mi.instanceColor.needsUpdate = true

    mats.groove.color.setRGB((0.6 + 1.8 * glow) * (0.9 + 0.1 * Math.sin(t * 3)) + fx.flare * 3, 0.05 + fx.flare * 1.4, 0.14 + fx.flare * 1.6)

    // gyro ring: spins about its own axis, tilt opens with the hero ignition
    gyro.current.rotation.set(0.35 + fx.open * 0.9, t * 0.45 + fx.open * 1.5, 0.2)
    gyroInner.current.rotation.z = t * 0.8
    hud.current.rotation.z = -t * 0.05
  })

  return (
    <group ref={root}>
      {/* main ring + inner groove */}
      <mesh material={mats.gun}>
        <torusGeometry args={[RING_R, 0.075, 24, 200]} />
      </mesh>
      <mesh ref={groove} material={mats.groove}>
        <torusGeometry args={[RING_R - 0.07, 0.014, 8, 200]} />
      </mesh>
      {/* index marks with the chase light */}
      <instancedMesh ref={marks} args={[null, null, MARKS]} frustumCulled={false}>
        <instancedBufferAttribute attach="instanceColor" args={[markCol, 3]} />
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* axle + bearing hubs */}
      <mesh material={mats.dark} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, RING_R * 2, 12]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * RING_R, 0, 0]}>
          <mesh material={mats.gun} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.12, 0.12, 0.2, 28]} />
          </mesh>
          <mesh material={mats.bead} position={[s * 0.105, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.05, 0.05, 0.02, 20]} />
          </mesh>
        </group>
      ))}
      {/* crown + foot clasps */}
      {[1, -1].map((s) => (
        <mesh key={s} material={mats.gun} position={[0, s * (RING_R + 0.05), 0]}>
          <boxGeometry args={[0.16, 0.12, 0.2]} />
        </mesh>
      ))}
      {/* gyro ring */}
      <group ref={gyro}>
        <mesh material={mats.dark}>
          <torusGeometry args={[RING_R + 0.4, 0.022, 10, 220]} />
        </mesh>
        <group ref={gyroInner}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} material={mats.bead} position={[Math.cos((k * Math.PI) / 2) * (RING_R + 0.4), Math.sin((k * Math.PI) / 2) * (RING_R + 0.4), 0]}>
              <sphereGeometry args={[0.035, 12, 12]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* HUD ticks far behind */}
      <group ref={hud} position={[0, 0, -0.6]}>
        <HudRing radius={RING_R + 0.85} ticks={120} gauge={0.68} speed={0.04} color={'#ff2a40'} tickLength={0.06} thickness={0.004} />
      </group>
    </group>
  )
}
