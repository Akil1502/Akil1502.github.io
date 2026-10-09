import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import {
  AsmPart,
  tone,
  Label,
  Shockwave,
  TickRing,
  HUD,
  HERO,
  tmp,
  writeMatrix,
  backOut,
  clamp01,
  lerp,
  rng,
  rect,
  breathe,
  fireImpact,
  placeMachine,
  tookBeat,
  useMachine,
  FONT_HUD,
} from './kit'

// MACHINE 05 · PRIME DELAY ORDER — "200 RECIPIENTS · DAILY · NO MANUAL STEP".
// Once a day a launcher fires 200 instanced gold envelopes in staggered parabolic arcs to a 20 × 10 inbox grid of
// 200 dots; each dot lights gold on arrival. The run loops every 6 s (one "day"), clock hand sweeping a full turn.
// Assembly: the inbox board slams in, its 200 dots fly into the grid row by row, the launcher swings up and the
// clock drops in. RUN beat: the day restarts immediately (muzzle shockwave).
const M_COLS = 20
const M_ROWS = 10
const M_N = M_COLS * M_ROWS // 200 — the count IS the content
const M_SX = 0.082
const M_SY = 0.112
const CYCLE = 6
const LAUNCH_SPAN = 3.4
const GRID_CX = 0.44
const BASE_X = -1.22
const BASE_Y = -0.52
const BARREL_TILT = -0.62
const LAUNCH_X = BASE_X + Math.sin(-BARREL_TILT) * 0.4
const LAUNCH_Y = BASE_Y + Math.cos(BARREL_TILT) * 0.4

export default function Dispatch({ tier, order }) {
  const m = useMachine('prime-delay', 1.7, order)
  m.impactAt[0] = GRID_CX
  m.impactAt[1] = 0
  const env = useRef()
  const inbox = useRef()
  const barrel = useRef()
  const muzzleMat = useRef()
  const clockRing = useRef()
  const clockHand = useRef()
  const boardLine = useRef()
  const st = useRef({ t: 0, started: false, inboxFinal: false }).current
  const data = useMemo(() => {
    const r = rng(200)
    const tx = new Float32Array(M_N)
    const ty = new Float32Array(M_N)
    const delay = new Float32Array(M_N)
    const flight = new Float32Array(M_N)
    const height = new Float32Array(M_N)
    const spin = new Float32Array(M_N)
    const sway = new Float32Array(M_N)
    // assembly scatter for the inbox dots
    const sx = new Float32Array(M_N)
    const sy = new Float32Array(M_N)
    const sz = new Float32Array(M_N)
    const asmDelay = new Float32Array(M_N)
    const order = Array.from({ length: M_N }, (_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      const o = order[i]
      order[i] = order[j]
      order[j] = o
    }
    for (let i = 0; i < M_N; i++) {
      const col = i % M_COLS
      const row = Math.floor(i / M_COLS)
      tx[i] = GRID_CX + (col - (M_COLS - 1) / 2) * M_SX
      ty[i] = ((M_ROWS - 1) / 2 - row) * M_SY
      delay[i] = (order[i] / M_N) * LAUNCH_SPAN + r() * 0.04
      flight[i] = 1.05 + r() * 0.35
      height[i] = 0.38 + r() * 0.4
      spin[i] = r() * 2 + 0.5
      sway[i] = (r() - 0.5) * 0.3
      const a = r() * Math.PI * 2
      const d = 0.9 + r() * 1.5
      sx[i] = Math.cos(a) * d
      sy[i] = Math.sin(a) * d * 0.7 + 0.6
      sz[i] = 0.6 + r() * 2
      asmDelay[i] = 0.1 + (row / (M_ROWS - 1)) * 0.24 + r() * 0.06
    }
    return { tx, ty, delay, flight, height, spin, sway, sx, sy, sz, asmDelay }
  }, [])

  const layoutInbox = (asmRaw) => {
    const ib = inbox.current
    if (!ib) return
    const arr = ib.instanceMatrix.array
    for (let i = 0; i < M_N; i++) {
      const k = clamp01((asmRaw - data.asmDelay[i]) / 0.42)
      if (k <= 0) {
        writeMatrix(arr, i, 0, 0, 0, 0)
        continue
      }
      const e = backOut(k, 1.7)
      const inv = 1 - e
      writeMatrix(arr, i, data.tx[i] + data.sx[i] * inv, data.ty[i] + data.sy[i] * inv, data.sz[i] * inv, 0.4 + 0.6 * e)
    }
    ib.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const ib = inbox.current
    if (ib) {
      for (let i = 0; i < M_N; i++) {
        writeMatrix(ib.instanceMatrix.array, i, 0, 0, 0, 0)
        ib.setColorAt(i, HUD)
      }
      ib.instanceMatrix.needsUpdate = true
      ib.instanceColor.needsUpdate = true
    }
    const ev = env.current
    if (ev) {
      for (let i = 0; i < M_N; i++) writeMatrix(ev.instanceMatrix.array, i, 0, 0, 0, 0)
      ev.instanceMatrix.needsUpdate = true
    }
  }, [data])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    if (!placeMachine(m, t, dt)) return
    const ev = env.current
    const ib = inbox.current
    if (!ev || !ib || !ib.instanceColor) return

    if (!st.inboxFinal) {
      layoutInbox(m.asmRaw)
      if (m.asmRaw >= 1) st.inboxFinal = true
    }
    // the first day starts the moment the machine is assembled
    if (!st.started && m.asm >= 1) {
      st.started = true
      st.t = 0
    }
    if (tookBeat(m)) {
      st.t = 0
      fireImpact(m, 0.3, LAUNCH_X, LAUNCH_Y)
    }
    if (st.started) st.t = (st.t + dt) % CYCLE
    const T = st.started ? st.t : 0
    const ea = ev.instanceMatrix.array
    const ca = ib.instanceColor.array
    let firing = 0
    for (let i = 0; i < M_N; i++) {
      const s = st.started ? (T - data.delay[i]) / data.flight[i] : -1
      if (s > 0 && s < 1) {
        // parabola from the muzzle to the envelope's own inbox cell
        const dx = data.tx[i] - LAUNCH_X
        const dy = data.ty[i] - LAUNCH_Y
        const h = data.height[i]
        const arc = Math.sin(s * Math.PI)
        tmp.position.set(LAUNCH_X + dx * s, LAUNCH_Y + dy * s + h * 4 * s * (1 - s), 0.05 + arc * data.sway[i])
        tmp.rotation.set(s * data.spin[i] * Math.PI * 2, 0, Math.atan2(dy + h * 4 * (1 - 2 * s), dx))
        tmp.scale.set(1, 1, 1)
        tmp.updateMatrix()
        ev.setMatrixAt(i, tmp.matrix)
        if (s < 0.06) firing = 1
      } else {
        writeMatrix(ea, i, 0, 0, 0, 0)
      }
      // inbox dot: dim cyan until its envelope lands, then a gold flash settling to a lit gold
      const arrive = data.delay[i] + data.flight[i]
      let b = 0
      if (st.started && T >= arrive) b = 0.55 + 1.9 * Math.exp(-(T - arrive) * 2.6)
      if (T > CYCLE - 0.6) b *= (CYCLE - T) / 0.6 // the inbox clears before the next day's run
      const k = Math.min(1, b / 0.5)
      ca[i * 3] = lerp(HUD.r * 0.16, HERO.r * b, k)
      ca[i * 3 + 1] = lerp(HUD.g * 0.16, HERO.g * b, k)
      ca[i * 3 + 2] = lerp(HUD.b * 0.16, HERO.b * b, k)
    }
    ev.instanceMatrix.needsUpdate = true
    ib.instanceColor.needsUpdate = true
    // launcher: recoil while firing, muzzle ring pulsing, clock sweeping one turn per "day"
    if (barrel.current) barrel.current.rotation.z = BARREL_TILT + firing * Math.sin(t * 60) * 0.03
    if (muzzleMat.current) muzzleMat.current.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 6) + firing * 2.5
    if (clockRing.current) clockRing.current.rotation.z = t * 0.25
    if (clockHand.current) clockHand.current.rotation.z = -(T / CYCLE) * Math.PI * 2
    breathe(boardLine, t, 0.45, 0.15, 1.3)
  })

  const W = M_COLS * M_SX + 0.2
  const H = M_ROWS * M_SY + 0.2
  const seg = tier === 'high' ? [7, 6] : [5, 4]
  return (
    <group ref={m.group} visible={false}>
      {/* inbox board slams in from behind */}
      <AsmPart m={m} delay={0} dur={0.5} from={[0, 2.6, 0]} spin={[0, 0, 0.35]} scaleFrom={0.5} position={[GRID_CX, 0, 0]}>
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[W, H, 0.06]} />
          <meshStandardMaterial color="#070b08" metalness={0.9} roughness={0.45} />
        </mesh>
        <Line ref={boardLine} points={rect(W, H, -0.02)} color={tone.hud} lineWidth={1} transparent opacity={0.5} />
        <Text font={FONT_HUD} fontSize={0.055} letterSpacing={0.22} anchorX="left" anchorY="middle" position={[-W / 2 + 0.03, H / 2 + 0.07, 0]}>
          INBOX · 200
          <meshBasicMaterial color={tone.hud} toneMapped={false} />
        </Text>
      </AsmPart>
      <instancedMesh ref={inbox} args={[null, null, M_N]} frustumCulled={false}>
        <sphereGeometry args={[0.022, seg[0], seg[1]]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      {/* 200 envelopes */}
      <instancedMesh ref={env} args={[null, null, M_N]} frustumCulled={false}>
        <boxGeometry args={[0.078, 0.052, 0.006]} />
        <meshStandardMaterial color={tone.heroBase} metalness={1} roughness={0.3} emissive={tone.hero} emissiveIntensity={0.5} toneMapped={false} />
      </instancedMesh>

      {/* launcher swings up into position */}
      <AsmPart m={m} delay={0.24} dur={0.46} from={[-0.6, -0.8, 0]} spin={[0, 0, -1.4]} scaleFrom={0.4} position={[BASE_X, BASE_Y, 0]}>
        <mesh position={[0, -0.07, 0]}>
          <boxGeometry args={[0.36, 0.12, 0.3]} />
          <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.35} />
        </mesh>
        <group ref={barrel} rotation={[0, 0, BARREL_TILT]}>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.055, 0.075, 0.42, 20]} />
            <meshStandardMaterial color={tone.heroBase} metalness={1} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.41, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.012, 8, 32]} />
            <meshStandardMaterial ref={muzzleMat} color={tone.hud} emissive={tone.hud} emissiveIntensity={1} toneMapped={false} />
          </mesh>
        </group>
      </AsmPart>
      {/* DAILY: the scheduler's clock drops in, spinning */}
      <AsmPart m={m} delay={0.34} dur={0.44} from={[0, 0.9, 0.4]} spin={[0, 0, 4]} scaleFrom={0} position={[BASE_X, 0.46, 0]}>
        <TickRing ref={clockRing} radius={0.17} ticks={24} length={0.025} thickness={0.008} />
        <mesh>
          <ringGeometry args={[0.135, 0.14, 48]} />
          <meshBasicMaterial color={tone.hud} transparent opacity={0.4} toneMapped={false} />
        </mesh>
        <group ref={clockHand}>
          <mesh position={[0, 0.06, 0.01]}>
            <boxGeometry args={[0.012, 0.12, 0.01]} />
            <meshBasicMaterial color={tone.hero} toneMapped={false} />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.012]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshBasicMaterial color={tone.hero} toneMapped={false} />
        </mesh>
        <Text font={FONT_HUD} fontSize={0.11} letterSpacing={0.1} anchorX="center" anchorY="middle" position={[0, -0.32, 0.02]}>
          DAILY
          <meshBasicMaterial color={tone.hero} toneMapped={false} />
        </Text>
      </AsmPart>

      <Shockwave ref={m.shock} radius={1.8} />
      <group ref={m.labels} visible={false}>
        <Label>200 RECIPIENTS · DAILY · NO MANUAL STEP</Label>
      </group>
    </group>
  )
}
