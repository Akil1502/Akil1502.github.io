import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import { AsmPart, tone, Label, Shockwave, HUD, writeMatrix, smooth01, rng, rect, breathe, fireImpact, placeMachine, tookBeat, useMachine, FONT_HUD } from './kit'

// MACHINE 03 · ESS ATTENDANCE PORTAL — "1,000+ EMPLOYEES · 3 ENTITIES".
// Three gold arch gates named after the three entities (BANNARI / SHIVA / AUTOMOBILES) and 1,000 instanced
// tokens (tier-scaled 1000 / 500 / 250) streaming through them in three looping CatmullRom streams; each stream
// pinches to pass through its arch and flares beyond it. Assembly: floor rises, the three gates drop in one
// after another and land, then the tokens pour in. RUN beat: a surge (streams speed up, gates flare).
const GATES = [
  { name: 'BANNARI', x: -1.14 },
  { name: 'SHIVA', x: 0 },
  { name: 'AUTOMOBILES', x: 1.14 },
]
const SAMPLES = 192
const GATE_Y = -0.14

// Closed loop that threads the arch heading right, climbs, and returns behind the gate.
function buildStream(gx) {
  const pts = [
    new THREE.Vector3(gx - 0.64, -0.3, -0.5),
    new THREE.Vector3(gx - 0.36, -0.2, -0.18),
    new THREE.Vector3(gx, GATE_Y + 0.02, 0),
    new THREE.Vector3(gx + 0.36, -0.06, 0.3),
    new THREE.Vector3(gx + 0.6, 0.3, 0.12),
    new THREE.Vector3(gx + 0.3, 0.68, -0.25),
    new THREE.Vector3(gx - 0.28, 0.7, -0.58),
    new THREE.Vector3(gx - 0.62, 0.3, -0.7),
  ]
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.6)
  const p = curve.getSpacedPoints(SAMPLES)
  const arr = new Float32Array(SAMPLES * 3)
  let gateU = 0
  let best = Infinity
  for (let i = 0; i < SAMPLES; i++) {
    arr[i * 3] = p[i].x
    arr[i * 3 + 1] = p[i].y
    arr[i * 3 + 2] = p[i].z
    const d = Math.hypot(p[i].x - gx, p[i].y - GATE_Y, p[i].z)
    if (d < best) {
      best = d
      gateU = i / SAMPLES
    }
  }
  return { arr, gateU }
}

export default function Gates({ tier, order }) {
  const count = tier === 'high' ? 1000 : tier === 'medium' ? 500 : 250
  const m = useMachine('ess', 1.72, order)
  m.impactAt[0] = 0
  m.impactAt[1] = GATE_Y
  const tokens = useRef()
  const scanners = useRef([])
  const gateMats = useRef([])
  const floorLine = useRef()
  const st = useRef({ phase: 0, surge: 0 }).current
  const streams = useMemo(() => GATES.map((g) => buildStream(g.x)), [])
  const data = useMemo(() => {
    const r = rng(1000 + count)
    const u0 = new Float32Array(count)
    const spd = new Float32Array(count)
    const ox = new Float32Array(count)
    const oy = new Float32Array(count)
    const oz = new Float32Array(count)
    const stream = new Uint8Array(count)
    for (let i = 0; i < count; i++) {
      u0[i] = r()
      spd[i] = 0.88 + r() * 0.24
      ox[i] = (r() - 0.5) * 0.14
      oy[i] = (r() - 0.5) * 0.14
      oz[i] = (r() - 0.5) * 0.14
      stream[i] = i % 3
    }
    return { u0, spd, ox, oy, oz, stream }
  }, [count])

  useLayoutEffect(() => {
    const im = tokens.current
    if (!im) return
    const white = new THREE.Color(tone.hud)
    for (let i = 0; i < count; i++) {
      writeMatrix(im.instanceMatrix.array, i, 0, 0, 0, 0)
      im.setColorAt(i, i % 7 === 0 ? white : HUD)
    }
    im.instanceMatrix.needsUpdate = true
    im.instanceColor.needsUpdate = true
  }, [count])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    if (!placeMachine(m, t, dt)) return
    const im = tokens.current
    if (!im) return
    if (tookBeat(m)) {
      st.surge = 1
      fireImpact(m, 0.3, 0, GATE_Y)
    }
    st.surge = Math.max(0, st.surge - dt * 0.55)
    // tokens pour in once the gates have landed, then keep looping
    const pour = smooth01((m.asmRaw - 0.62) / 0.45)
    st.phase += dt * 0.07 * (1 + st.surge * 3.2) * (0.25 + 0.75 * pour)
    const arr = im.instanceMatrix.array
    for (let i = 0; i < count; i++) {
      const S = streams[data.stream[i]]
      const P = S.arr
      const u = (data.u0[i] + st.phase * data.spd[i]) % 1
      const f = u * SAMPLES
      const i0 = f | 0
      const i1 = (i0 + 1) % SAMPLES
      const fr = f - i0
      let x = P[i0 * 3] + (P[i1 * 3] - P[i0 * 3]) * fr
      let y = P[i0 * 3 + 1] + (P[i1 * 3 + 1] - P[i0 * 3 + 1]) * fr
      let z = P[i0 * 3 + 2] + (P[i1 * 3 + 2] - P[i0 * 3 + 2]) * fr
      let dg = Math.abs(u - S.gateU)
      if (dg > 0.5) dg = 1 - dg
      // the stream narrows to pass through the arch and flares again beyond it
      const pinch = 1 - 0.82 * Math.exp(-(dg * 9) * (dg * 9))
      x += data.ox[i] * pinch
      y += data.oy[i] * pinch + Math.sin(t * 2.5 + data.u0[i] * 40) * 0.014
      z += data.oz[i] * pinch
      const glow = Math.exp(-(dg * 12) * (dg * 12))
      const back = 0.5 + 0.5 * smooth01((z + 0.7) / 0.55)
      // pour-in: each token switches on at its own moment so the streams fill up rather than pop
      const on = pour >= 1 ? 1 : smooth01((pour - data.u0[i] * 0.85) / 0.15)
      writeMatrix(arr, i, x, y, z, (0.75 + glow * 1.7 + st.surge * 0.4) * back * on)
    }
    im.instanceMatrix.needsUpdate = true
    for (let k = 0; k < 3; k++) {
      const gm = gateMats.current[k]
      if (gm) gm.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 2 + k * 2.1) + st.surge * 2.5
      const sc = scanners.current[k]
      if (sc) sc.position.y = GATE_Y + 0.02 + Math.sin(t * 1.7 + k * 1.3) * 0.2
    }
    breathe(floorLine, t, 0.38, 0.14, 1.5)
  })

  const seg = tier === 'high' ? [6, 5] : [5, 4]
  return (
    <group ref={m.group} visible={false}>
      {/* shared floor rises into place */}
      <AsmPart m={m} delay={0} dur={0.45} from={[0, -0.9, 0]} scaleFrom={0.6}>
        <mesh position={[0, GATE_Y - 0.44, 0]}>
          <boxGeometry args={[3.3, 0.04, 0.6]} />
          <meshStandardMaterial color="#0e130f" metalness={1} roughness={0.4} />
        </mesh>
        <Line ref={floorLine} points={rect(3.3, 0.6)} rotation={[-Math.PI / 2, 0, 0]} position={[0, GATE_Y - 0.415, 0]} color={tone.hud} lineWidth={1} transparent opacity={0.4} />
      </AsmPart>

      {/* the three entities: gates drop in one after another */}
      {GATES.map((g, k) => (
        <AsmPart key={g.name} m={m} delay={0.14 + k * 0.13} dur={0.46} from={[0, 2.4, 0.3]} spin={[0, 0, (k - 1) * 0.5]} scaleFrom={0.7} position={[g.x, 0, 0]}>
          <mesh position={[0, GATE_Y, 0]}>
            <torusGeometry args={[0.32, 0.04, 10, 40, Math.PI]} />
            <meshStandardMaterial ref={(el) => (gateMats.current[k] = el)} color={tone.heroBase} metalness={1} roughness={0.25} emissive={tone.heroBase} emissiveIntensity={0.4} />
          </mesh>
          {[-0.32, 0.32].map((px) => (
            <mesh key={px} position={[px, GATE_Y - 0.18, 0]}>
              <boxGeometry args={[0.08, 0.36, 0.08]} />
              <meshStandardMaterial color={tone.heroBase} metalness={1} roughness={0.25} />
            </mesh>
          ))}
          <mesh position={[0, GATE_Y - 0.39, 0]}>
            <boxGeometry args={[0.95, 0.06, 0.4]} />
            <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.35} />
          </mesh>
          {/* cyan scanner bar sweeping inside the arch */}
          <mesh ref={(el) => (scanners.current[k] = el)} position={[0, GATE_Y, 0.02]}>
            <boxGeometry args={[0.6, 0.008, 0.01]} />
            <meshBasicMaterial color={tone.hud} toneMapped={false} transparent opacity={0.85} />
          </mesh>
          <Text font={FONT_HUD} fontSize={0.082} letterSpacing={0.18} anchorX="center" anchorY="middle" position={[0, GATE_Y + 0.5, 0.02]}>
            {g.name}
            <meshBasicMaterial color={tone.hero} toneMapped={false} />
          </Text>
        </AsmPart>
      ))}

      {/* the employees */}
      <instancedMesh ref={tokens} args={[null, null, count]} frustumCulled={false}>
        <sphereGeometry args={[0.019, seg[0], seg[1]]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <Shockwave ref={m.shock} radius={2} />
      <group ref={m.labels} visible={false}>
        <Label>1,000+ EMPLOYEES · 3 ENTITIES</Label>
      </group>
    </group>
  )
}
