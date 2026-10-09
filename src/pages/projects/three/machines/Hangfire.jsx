import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import {
  AsmPart,
  tone,
  Label,
  Shockwave,
  TickRing,
  HERO,
  DRAMA,
  tmp,
  writeMatrix,
  easeOutCubic,
  backOut,
  clamp01,
  lerp,
  rng,
  breathe,
  fireImpact,
  placeMachine,
  tookBeat,
  useMachine,
} from './kit'

// MACHINE 01 · HANGFIRE NOTIFICATION SYSTEM — "EVERY TICK · ORG-WIDE".
// A 24-tooth ring (instanced teeth) snaps one tooth every 0.5 s past a striker pin; every tick throws a burst of
// 12 instanced sparks outward that fade over 0.6 s. A slow clock hand sweeps the hub, cyan HUD rings turn,
// queue rails feed jobs in. Assembly: the 24 teeth fly in from a scatter and lock onto the ring one after another.
// RUN beat: a four-tick salvo with double bursts + shockwave.
const TEETH = 24
const TICK = 0.5
const RING_R = 0.5
const BURST = 12
const SPARK_LIFE = 0.6

export default function Hangfire({ tier, order }) {
  const sparkN = tier === 'high' ? 60 : 36
  const m = useMachine('hangfire', 1.15, order)
  const ring = useRef()
  const teeth = useRef()
  const sparks = useRef()
  const hand = useRef()
  const hudA = useRef()
  const hudB = useRef()
  const strikerMat = useRef()
  const coreMat = useRef()
  const railDots = useRef([])
  const rails = [useRef(), useRef()]
  const st = useRef({ timer: TICK * 0.4, tick: 0, angle: 0, salvo: 0, flash: 0, next: 0, teethFinal: false }).current
  const sparkData = useMemo(() => Array.from({ length: sparkN }, () => ({ born: -10, a: 0, sp: 0, spin: 0 })), [sparkN])

  // assembly scatter: each tooth starts somewhere off the ring with its own spin, and locks on in sequence
  const scatter = useMemo(() => {
    const r = rng(24)
    return Array.from({ length: TEETH }, (_, i) => {
      const a = (i / TEETH) * Math.PI * 2 + 0.9 + (r() - 0.5) * 0.8
      const d = 1.5 + r() * 1.3
      return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.8, z: 0.6 + r() * 1.8, spin: (r() - 0.5) * 9, delay: 0.06 + (i / TEETH) * 0.32 }
    })
  }, [])

  const layoutTeeth = (asmRaw) => {
    const im = teeth.current
    if (!im) return
    for (let i = 0; i < TEETH; i++) {
      const a = (i / TEETH) * Math.PI * 2
      const sc = scatter[i]
      const k = clamp01((asmRaw - sc.delay) / 0.42)
      const e = backOut(k, 2.2)
      const inv = 1 - e
      tmp.position.set(Math.cos(a) * RING_R + sc.x * inv, Math.sin(a) * RING_R + sc.y * inv, sc.z * inv)
      tmp.rotation.set(sc.spin * inv * 0.4, sc.spin * inv * 0.3, a + sc.spin * inv)
      const s = k <= 0 ? 0.0001 : 0.35 + 0.65 * e
      tmp.scale.set(0.13 * s, 0.065 * s, 0.1 * s)
      tmp.updateMatrix()
      im.setMatrixAt(i, tmp.matrix)
    }
    im.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    layoutTeeth(0)
    const sm = sparks.current
    if (sm) {
      for (let i = 0; i < sparkN; i++) {
        writeMatrix(sm.instanceMatrix.array, i, 0, 0, 0, 0)
        sm.setColorAt(i, HERO)
      }
      sm.instanceMatrix.needsUpdate = true
      sm.instanceColor.needsUpdate = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparkN])

  const fire = (t, big) => {
    const n = big ? BURST * 2 : BURST
    for (let k = 0; k < n; k++) {
      const d = sparkData[st.next]
      st.next = (st.next + 1) % sparkN
      d.born = t
      d.a = Math.PI / 2 + (Math.random() - 0.5) * 1.7
      d.sp = (0.55 + Math.random() * 0.9) * (big ? 1.35 : 1)
      d.spin = (Math.random() - 0.5) * 6
    }
    st.flash = 1
  }

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    if (!placeMachine(m, t, dt)) return

    // ---- assembly: teeth lock on one by one (matrices only written while they move)
    if (!st.teethFinal) {
      layoutTeeth(m.asmRaw)
      if (m.asmRaw >= 1) st.teethFinal = true
    }

    // ---- RUN beat: four-tick salvo, double bursts, shockwave from the striker
    if (tookBeat(m)) {
      st.salvo = 4
      st.timer = 1
      fireImpact(m, 0.3, 0, RING_R + 0.12)
    }
    // one tooth every 0.5 s once assembled (a quick 0.16 s salvo on a beat)
    if (m.asm >= 1) {
      st.timer += dt
      const interval = st.salvo > 0 ? 0.16 : TICK
      if (st.timer >= interval) {
        st.timer = 0
        st.tick++
        const big = st.salvo > 0
        if (big) st.salvo--
        fire(t, big)
      }
    }
    // mechanical detent: snap sharply to the next tooth (exponential ease → crisp click, tiny settle)
    const target = st.tick * ((Math.PI * 2) / TEETH)
    st.angle += (target - st.angle) * (1 - Math.pow(0.00002, dt))
    if (ring.current) ring.current.rotation.z = -st.angle
    if (hand.current) hand.current.rotation.z = -t * ((Math.PI * 2) / 45)
    if (hudA.current) hudA.current.rotation.z = t * 0.12
    if (hudB.current) hudB.current.rotation.z = -t * 0.07
    st.flash = Math.max(0, st.flash - dt * 3.5)
    if (strikerMat.current) strikerMat.current.emissiveIntensity = 0.5 + st.flash * 5
    if (coreMat.current) coreMat.current.emissiveIntensity = 1.3 + 0.45 * Math.sin(t * 3) + st.flash * 2
    // queue rails: a dot climbs each side rail (jobs feeding the scheduler); rails breathe
    for (let i = 0; i < railDots.current.length; i++) {
      const d = railDots.current[i]
      if (!d) continue
      const u = (t * 0.35 + i * 0.5) % 1
      d.position.y = -0.7 + u * 1.4
      d.scale.setScalar(0.6 + 0.4 * Math.sin(u * Math.PI))
      breathe(rails[i], t, 0.32, 0.14, 1.8, i * 1.7)
    }

    // ---- sparks: fly out from the striker, decelerate, fall and fade over 0.6 s
    const sm = sparks.current
    if (sm && sm.instanceColor) {
      const ca = sm.instanceColor.array
      const ma = sm.instanceMatrix.array
      for (let i = 0; i < sparkN; i++) {
        const d = sparkData[i]
        const age = t - d.born
        if (age < 0 || age > SPARK_LIFE) {
          writeMatrix(ma, i, 0, 0, 0, 0)
          continue
        }
        const u = age / SPARK_LIFE
        const e = easeOutCubic(u)
        tmp.position.set(Math.cos(d.a) * d.sp * e, RING_R + 0.12 + Math.sin(d.a) * d.sp * e - 1.1 * age * age, 0.1)
        tmp.rotation.set(0, 0, d.a + d.spin * u)
        tmp.scale.set(0.1 * (1 - u) + 0.012, 0.014 * (1 - u * 0.6), 0.014)
        tmp.updateMatrix()
        sm.setMatrixAt(i, tmp.matrix)
        const fade = (1 - u) * (1 - u * 0.5) * 1.7
        ca[i * 3] = lerp(HERO.r, DRAMA.r, u) * fade
        ca[i * 3 + 1] = lerp(HERO.g, DRAMA.g, u) * fade
        ca[i * 3 + 2] = lerp(HERO.b, DRAMA.b, u) * fade
      }
      sm.instanceMatrix.needsUpdate = true
      sm.instanceColor.needsUpdate = true
    }
  })

  const lo = tier === 'low'
  return (
    <group ref={m.group} visible={false}>
      {/* HUD rings: cyan + gold, always turning (concentric-ring motif) */}
      <AsmPart m={m} delay={0.34} dur={0.5} scaleFrom={0} spin={[0, 0, -2.4]}>
        <TickRing ref={hudA} radius={0.74} ticks={lo ? 48 : 72} length={0.05} gauge={0.78} />
        <mesh position={[0, 0, -0.02]}>
          <ringGeometry args={[0.69, 0.695, 96]} />
          <meshBasicMaterial color={tone.hud} transparent opacity={0.35} toneMapped={false} />
        </mesh>
      </AsmPart>
      <AsmPart m={m} delay={0.44} dur={0.5} scaleFrom={1.6} spin={[0, 0, 2]}>
        <TickRing ref={hudB} radius={0.84} ticks={lo ? 24 : 36} length={0.035} thickness={0.009} color={tone.hero} gauge={0.42} />
      </AsmPart>

      {/* the 24-tooth ring: frame + spokes slam in from behind, the instanced teeth lock on (layoutTeeth) */}
      <group ref={ring}>
        <AsmPart m={m} delay={0} dur={0.5} from={[0, 2.6, 0]} spin={[0, 0, -2.6]} scaleFrom={0.25}>
          <mesh>
            <torusGeometry args={[RING_R - 0.05, 0.04, 10, 72]} />
            <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.35} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation={[0, 0, (i * Math.PI) / 3]}>
              <boxGeometry args={[0.86, 0.03, 0.05]} />
              <meshStandardMaterial color={tone.metalHi} metalness={1} roughness={0.3} />
            </mesh>
          ))}
        </AsmPart>
        <instancedMesh ref={teeth} args={[null, null, TEETH]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={tone.heroBase} metalness={1} roughness={0.22} emissive={tone.heroBase} emissiveIntensity={0.18} />
        </instancedMesh>
      </group>

      {/* hub + cyan core */}
      <AsmPart m={m} delay={0.22} dur={0.45} from={[0, 2, 0.6]} scaleFrom={0}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.12, 32]} />
          <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, 0.07]}>
          <sphereGeometry args={[0.065, 20, 20]} />
          <meshStandardMaterial ref={coreMat} color={tone.hud} emissive={tone.hud} emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      </AsmPart>
      {/* slow clock hand */}
      <AsmPart m={m} delay={0.55} dur={0.4} scaleFrom={0} spin={[0, 0, 3]}>
        <group ref={hand}>
          <mesh position={[0, 0.18, 0.11]}>
            <boxGeometry args={[0.02, 0.38, 0.02]} />
            <meshStandardMaterial color={tone.hero} emissive={tone.heroBase} emissiveIntensity={0.5} metalness={1} roughness={0.25} />
          </mesh>
        </group>
      </AsmPart>
      {/* striker pin at 12 o'clock: each tooth that snaps past it throws a burst */}
      <AsmPart m={m} delay={0.4} dur={0.4} from={[0, 1, 0]} position={[0, RING_R + 0.19, 0.05]} rotation={[0, 0, Math.PI]}>
        <mesh>
          <coneGeometry args={[0.045, 0.14, 4]} />
          <meshStandardMaterial ref={strikerMat} color={tone.hud} emissive={tone.hero} emissiveIntensity={0.5} metalness={0.8} roughness={0.3} toneMapped={false} />
        </mesh>
      </AsmPart>
      {/* sparks */}
      <instancedMesh ref={sparks} args={[null, null, sparkN]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* queue rails either side */}
      {[-1.0, 1.0].map((x, i) => (
        <AsmPart key={x} m={m} delay={0.5} dur={0.4} from={[x * 0.9, 0, 0]} scaleFrom={0.6} position={[x, 0, 0]}>
          <Line ref={rails[i]} points={[[0, -0.72, 0], [0, 0.72, 0]]} color={tone.hud} lineWidth={1} transparent opacity={0.35} />
          <mesh ref={(el) => (railDots.current[i] = el)}>
            <sphereGeometry args={[0.028, 10, 10]} />
            <meshBasicMaterial color={tone.hud} toneMapped={false} />
          </mesh>
          <mesh position={[0, -0.76, 0]}>
            <boxGeometry args={[0.08, 0.012, 0.01]} />
            <meshBasicMaterial color={tone.hud} toneMapped={false} transparent opacity={0.6} />
          </mesh>
        </AsmPart>
      ))}

      <Shockwave ref={m.shock} radius={1.5} />
      <group ref={m.labels} visible={false}>
        <Label>EVERY TICK · ORG-WIDE</Label>
      </group>
    </group>
  )
}
