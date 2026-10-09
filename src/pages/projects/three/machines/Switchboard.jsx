import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import {
  AsmPart,
  tone,
  Label,
  Shockwave,
  HUD,
  HERO,
  writeMatrix,
  backOut,
  clamp01,
  easeInOut,
  lerp,
  hash,
  rng,
  rect,
  breathe,
  fireImpact,
  placeMachine,
  tookBeat,
  useMachine,
  FONT_HUD,
} from './kit'

// MACHINE 02 · AGENT CRM — "450 AGENTS · DAILY".
// A 30 × 15 switchboard: 450 instanced cyan terminals with random flicker and a travelling diagonal wave of
// brightness; a gold "active agent" roams cell to cell and heats the terminal it lands on.
// Assembly: the console slams in from behind and the 450 terminals fly in from a scattered cloud, column by
// column, snapping into the grid. RUN beat: the agent broadcasts a ping that ripples across the whole board.
const C_COLS = 30
const C_ROWS = 15
const C_N = C_COLS * C_ROWS // 450 — the count IS the content
const C_SX = 0.094
const C_SY = 0.092
const BOARD_TILT = -0.2

export default function Switchboard({ tier, order }) {
  const m = useMachine('agent-crm', 1.6, order)
  const dots = useRef()
  const agent = useRef()
  const agentTag = useRef()
  const haloMat = useRef()
  const outer = useRef()
  const inner = useRef()
  const scan = useRef()
  const st = useRef({
    cell: 0,
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    moveT: 1,
    wait: 0.6,
    hot: -1,
    hotT: -10,
    ping: -10,
    pingX: 0,
    pingY: 0,
    dotsFinal: false,
  }).current

  const data = useMemo(() => {
    const r = rng(450)
    const x = new Float32Array(C_N)
    const y = new Float32Array(C_N)
    const phase = new Float32Array(C_N)
    const seed = new Float32Array(C_N)
    // assembly scatter: a loose cloud in front of the board, swept in column by column (left → right)
    const sx = new Float32Array(C_N)
    const sy = new Float32Array(C_N)
    const sz = new Float32Array(C_N)
    const delay = new Float32Array(C_N)
    for (let i = 0; i < C_N; i++) {
      const col = i % C_COLS
      const row = Math.floor(i / C_COLS)
      x[i] = (col - (C_COLS - 1) / 2) * C_SX
      y[i] = ((C_ROWS - 1) / 2 - row) * C_SY
      phase[i] = r() * Math.PI * 2
      seed[i] = r()
      const a = r() * Math.PI * 2
      const d = 0.8 + r() * 1.8
      sx[i] = x[i] * 0.4 + Math.cos(a) * d
      sy[i] = y[i] * 0.4 + Math.sin(a) * d * 0.7
      sz[i] = 0.5 + r() * 2.2
      delay[i] = 0.1 + (col / (C_COLS - 1)) * 0.26 + r() * 0.06
    }
    return { x, y, phase, seed, sx, sy, sz, delay }
  }, [])

  const layoutDots = (asmRaw) => {
    const im = dots.current
    if (!im) return
    const arr = im.instanceMatrix.array
    for (let i = 0; i < C_N; i++) {
      const k = clamp01((asmRaw - data.delay[i]) / 0.4)
      if (k <= 0) {
        writeMatrix(arr, i, 0, 0, 0, 0)
        continue
      }
      const e = backOut(k, 1.6)
      const inv = 1 - e
      writeMatrix(arr, i, data.x[i] + data.sx[i] * inv, data.y[i] + data.sy[i] * inv, data.sz[i] * inv, 0.4 + 0.6 * e)
    }
    im.instanceMatrix.needsUpdate = true
  }

  useLayoutEffect(() => {
    const im = dots.current
    if (!im) return
    for (let i = 0; i < C_N; i++) {
      writeMatrix(im.instanceMatrix.array, i, 0, 0, 0, 0)
      im.setColorAt(i, HUD)
    }
    im.instanceMatrix.needsUpdate = true
    im.instanceColor.needsUpdate = true
    st.cell = Math.floor(hash(7.3) * C_N)
    st.to.set(data.x[st.cell], data.y[st.cell], 0.04)
    st.from.copy(st.to)
  }, [data, st])

  const pickCell = () => {
    st.from.copy(st.to)
    st.cell = Math.floor(Math.random() * C_N)
    st.to.set(data.x[st.cell], data.y[st.cell], 0.04)
    st.moveT = 0
    st.wait = 0.9 + Math.random() * 0.9 // nothing autonomous faster than ~900 ms (DESIGN rule 8)
  }

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    if (!placeMachine(m, t, dt)) return
    const im = dots.current
    if (!im || !im.instanceColor) return

    // ---- assembly: terminals snap into the grid (matrices only written while they move)
    if (!st.dotsFinal) {
      layoutDots(m.asmRaw)
      if (m.asmRaw >= 1) st.dotsFinal = true
    }

    // ---- RUN beat: the active agent broadcasts; a ping ripples across all 450 terminals, then it jumps
    if (tookBeat(m)) {
      st.ping = t
      st.pingX = st.to.x
      st.pingY = st.to.y
      fireImpact(m, 0.28, st.to.x, st.to.y * Math.cos(BOARD_TILT))
      pickCell()
    }
    // the gold agent roams cell to cell (once the board is live)
    if (m.asm >= 1) {
      if (st.moveT < 1) {
        st.moveT = Math.min(1, st.moveT + dt / 0.5)
        if (st.moveT >= 1) {
          st.hot = st.cell
          st.hotT = t
        }
      } else {
        st.wait -= dt
        if (st.wait <= 0) pickCell()
      }
    }
    const e = easeInOut(st.moveT)
    if (agent.current) {
      agent.current.position.set(lerp(st.from.x, st.to.x, e), lerp(st.from.y, st.to.y, e), 0.04 + Math.sin(st.moveT * Math.PI) * 0.16)
      agent.current.rotation.z = t * 1.5
    }
    if (agentTag.current && agent.current) agentTag.current.position.set(agent.current.position.x + 0.09, agent.current.position.y + 0.075, 0.08)
    if (haloMat.current) haloMat.current.opacity = 0.5 + 0.4 * Math.sin(t * 5)
    breathe(outer, t, 0.45, 0.15, 1.4)
    breathe(inner, t, 0.16, 0.08, 2.1, 1)
    // a thin cyan scan bar sweeps the board top → bottom
    if (scan.current) scan.current.position.y = ((C_ROWS * C_SY) / 2) * Math.cos(t * 0.9)

    // ---- per-dot brightness: base breath + travelling diagonal wave + random flicker + beat ping + agent heat
    const ca = im.instanceColor.array
    const wavePhase = t * 2.2
    const pingAge = t - st.ping
    const slotT = Math.floor(t * 7)
    const live = clamp01((m.asmRaw - 0.35) / 0.6) // the board powers up as it assembles
    for (let i = 0; i < C_N; i++) {
      const col = i % C_COLS
      const row = (i / C_COLS) | 0
      let b = 0.13 + 0.05 * Math.sin(t * 1.4 + data.phase[i])
      const w = 0.5 + 0.5 * Math.sin(col * 0.42 + row * 0.18 - wavePhase)
      const w2 = w * w
      b += w2 * w2 * 0.75 * live
      if (hash(slotT + i * 7.13 + data.seed[i]) > 0.94) b += 0.9 * live
      if (pingAge < 2.2) {
        const dx = data.x[i] - st.pingX
        const dy = data.y[i] - st.pingY
        const d = Math.sqrt(dx * dx + dy * dy)
        const r = pingAge * 1.5
        const g = Math.exp(-((d - r) * 4) * ((d - r) * 4))
        b += g * 2 * (1 - pingAge / 2.2)
      }
      let cr = HUD.r * b
      let cg = HUD.g * b
      let cb = HUD.b * b
      if (i === st.hot) {
        const k = Math.exp(-(t - st.hotT) * 1.4)
        cr = lerp(cr, HERO.r * 2.4, k)
        cg = lerp(cg, HERO.g * 2.4, k)
        cb = lerp(cb, HERO.b * 2.4, k)
      }
      ca[i * 3] = cr
      ca[i * 3 + 1] = cg
      ca[i * 3 + 2] = cb
    }
    im.instanceColor.needsUpdate = true
  })

  const W = C_COLS * C_SX + 0.24
  const H = C_ROWS * C_SY + 0.24
  const seg = tier === 'high' ? [7, 6] : [5, 4]
  return (
    <group ref={m.group} visible={false}>
      <group rotation={[BOARD_TILT, 0, 0]}>
        {/* console backplate slams in from behind */}
        <AsmPart m={m} delay={0} dur={0.5} from={[0, 2.8, 0]} spin={[0.5, 0, 0.12]} scaleFrom={0.5}>
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[W, H, 0.06]} />
            <meshStandardMaterial color="#070b08" metalness={0.9} roughness={0.45} />
          </mesh>
          <Line ref={outer} points={rect(W, H, -0.02)} color={tone.hud} lineWidth={1} transparent opacity={0.5} />
          <Line ref={inner} points={rect(W - 0.12, H - 0.12, -0.02)} color={tone.hud} lineWidth={1} transparent opacity={0.18} />
          <mesh ref={scan} position={[0, 0, -0.015]}>
            <planeGeometry args={[W - 0.14, 0.006]} />
            <meshBasicMaterial color={tone.hud} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
          </mesh>
        </AsmPart>
        {/* 450 terminals */}
        <instancedMesh ref={dots} args={[null, null, C_N]} frustumCulled={false}>
          <sphereGeometry args={[0.03, seg[0], seg[1]]} />
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
        {/* the active agent */}
        <AsmPart m={m} delay={0.72} dur={0.3} scaleFrom={0}>
          <group ref={agent}>
            <mesh>
              <sphereGeometry args={[0.046, 16, 16]} />
              <meshStandardMaterial color={tone.hud} emissive={tone.hero} emissiveIntensity={2.4} toneMapped={false} />
            </mesh>
            <mesh>
              <torusGeometry args={[0.085, 0.006, 8, 32]} />
              <meshBasicMaterial ref={haloMat} color={tone.hero} transparent opacity={0.8} toneMapped={false} />
            </mesh>
          </group>
          <Text ref={agentTag} font={FONT_HUD} fontSize={0.05} letterSpacing={0.2} anchorX="left" anchorY="middle">
            ACTIVE AGENT
            <meshBasicMaterial color={tone.hero} toneMapped={false} />
          </Text>
        </AsmPart>
      </group>
      <Shockwave ref={m.shock} radius={1.9} />
      <group ref={m.labels} visible={false}>
        <Label>~450 AGENTS · DAILY</Label>
      </group>
    </group>
  )
}
