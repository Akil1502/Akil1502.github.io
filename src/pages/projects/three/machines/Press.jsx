import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text, Line } from '@react-three/drei'
import { AsmPart, tone, Label, Shockwave, easeOutCubic, easeInQuad, easeInOut, smooth01, rect, breathe, fireImpact, placeMachine, tookBeat, useMachine, FONT_HUD, FONT_BIG } from './kit'

// MACHINE 04 · KNITTING INVOICE SYSTEM — "4 MODULES · PDF / EXCEL / CRYSTAL".
// A press: the upper plate lifts, holds and slams down every 1.2 s while the lower plate rises to meet it; each
// stamp prints a sheet labelled PDF / EXCEL / CRYSTAL (cycling) that flies out in an arc and lands on one of four
// module stacks. Stacks grow sheet by sheet, then ship (reset). Assembly: bench rises, the press frame drops
// in from above, the four module trays snap in. RUN beat: the press jumps straight to the slam (impact on landing).
const SHEET_LABELS = ['PDF', 'EXCEL', 'CRYSTAL']
const POOL = 6
const STACKS = 4
const PERIOD = 1.2
const FLIGHT = 0.8
const IMPACT = 0.78 // phase of the period at which the plates meet
const PRESS_X = -0.98
const FLOOR_Y = -0.4
const SHEET_T = 0.016
const STACK_MAX = 7
const KISS = 0.045 // how far the lower plate rises to meet the upper one
const BED_TOP = 0.03 // lower plate's gold face, above FLOOR_Y at rest
const SHEET_REST = BED_TOP + SHEET_T * 0.5 // a printed sheet lying on the lower plate
// upper plate centre when the plates meet over a sheet (lip half-depth 0.0725 below the plate centre)
const PLATE_DOWN = FLOOR_Y + KISS + BED_TOP + SHEET_T + 0.0725
const stackX = (j) => 0.02 + j * 0.42

// Upper plate: 0 → 1 → 0 over one period (slow lift, hold high, hard slam, hold down).
function plateLift(p) {
  if (p < 0.5) return easeOutCubic(p / 0.5)
  if (p < 0.68) return 1
  if (p < IMPACT) return 1 - easeInQuad((p - 0.68) / (IMPACT - 0.68))
  return 0
}
// Lower plate: rises into the slam, holds through the impact, sinks back.
function plateRise(p) {
  if (p < 0.58) return 0
  if (p < IMPACT) return smooth01((p - 0.58) / (IMPACT - 0.58))
  return 1 - smooth01((p - 0.84) / 0.16)
}

export default function Press({ order }) {
  const m = useMachine('knitting', 1.62, order)
  m.impactAt[0] = PRESS_X
  m.impactAt[1] = FLOOR_Y + 0.2
  const plate = useRef()
  const lower = useRef()
  const lipMat = useRef()
  const readout = useRef()
  const benchLine = useRef()
  const sheets = useRef([])
  const stacks = useRef([])
  const trayLines = useRef([])
  const st = useRef({ timer: 0.25, k: 0, stamped: -1, flights: [], counts: [0, 0, 0, 0], stackH: [0, 0, 0, 0], ship: [-1, -1, -1, -1], flash: 0, beatImpact: false, rise: 0 }).current

  const stamp = (t) => {
    const k = st.k++
    const label = k % 3
    const sheetIdx = label + 3 * (Math.floor(k / 3) % 2) // two pre-labelled sheets per document type, alternated
    const s = sheets.current[sheetIdx]
    st.flash = 1
    if (st.beatImpact) {
      st.beatImpact = false
      fireImpact(m, 0.35, PRESS_X, FLOOR_Y + 0.1)
    }
    if (!s) return
    st.flights = st.flights.filter((f) => f.sheet !== sheetIdx)
    st.flights.push({ sheet: sheetIdx, stack: k % STACKS, t0: t + 0.2 })
    s.visible = true
    s.position.set(PRESS_X, FLOOR_Y + KISS + SHEET_REST, 0.02)
    s.rotation.set(-Math.PI / 2, 0, 0)
  }

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    if (!placeMachine(m, t, dt)) return
    if (tookBeat(m)) {
      // jump to the top of the slam so the press lands right away; the landing is the impact
      st.timer = (st.stamped + 1) * PERIOD + 0.68 * PERIOD
      st.beatImpact = true
    }
    // the press cycles once it is assembled
    if (m.asm >= 1) st.timer += dt
    const p = (st.timer / PERIOD) % 1
    const n = Math.floor((st.timer - IMPACT * PERIOD) / PERIOD)
    if (n > st.stamped) {
      st.stamped = n
      stamp(t)
    }
    const lift = plateLift(p)
    st.rise = plateRise(p) * KISS
    if (plate.current) {
      const tremble = lift > 0.99 ? Math.sin(t * 40) * 0.004 : 0
      plate.current.position.y = PLATE_DOWN + lift * 0.5 + tremble
    }
    if (lower.current) lower.current.position.y = FLOOR_Y + st.rise
    st.flash = Math.max(0, st.flash - dt * 2.6)
    if (lipMat.current) lipMat.current.emissiveIntensity = 0.35 + st.flash * 3
    if (readout.current) readout.current.position.x = Math.sin(t * 2.6) * 0.2
    breathe(benchLine, t, 0.32, 0.12, 1.5)

    // sheets: sit on the lower plate for a beat, then arc to their module stack and land on top of it
    for (const f of st.flights) {
      const s = sheets.current[f.sheet]
      if (!s) {
        f.done = true
        continue
      }
      const u = (t - f.t0) / FLIGHT
      if (u < 0) {
        s.position.y = FLOOR_Y + st.rise + SHEET_REST
        continue
      }
      const j = f.stack
      if (u >= 1) {
        f.done = true
        s.visible = false
        st.counts[j]++
        if (st.counts[j] >= STACK_MAX) st.ship[j] = t + 0.55
        continue
      }
      const e = easeInOut(u)
      const x1 = stackX(j)
      const y0 = FLOOR_Y + SHEET_REST
      const y1 = FLOOR_Y + st.counts[j] * SHEET_T + SHEET_T
      const arc = Math.sin(u * Math.PI)
      s.position.set(PRESS_X + (x1 - PRESS_X) * e, y0 + (y1 - y0) * e + arc * (0.42 + j * 0.06), 0.02 + arc * 0.12)
      s.rotation.set(-Math.PI / 2 + arc * 0.75, 0, arc * 0.35)
    }
    // compact finished flights in place (no per-frame closures or arrays)
    let w = 0
    for (let r = 0; r < st.flights.length; r++) if (!st.flights[r].done) st.flights[w++] = st.flights[r]
    st.flights.length = w
    // stacks grow sheet by sheet, then ship (reset) once full; the tray outline flashes as a stack ships
    for (let j = 0; j < STACKS; j++) {
      if (st.ship[j] > 0 && t >= st.ship[j]) {
        st.ship[j] = -1
        st.counts[j] = 0
      }
      const target = st.counts[j] * SHEET_T
      st.stackH[j] += (target - st.stackH[j]) * (1 - Math.pow(0.0005, dt))
      const sm = stacks.current[j]
      if (sm) {
        const h = Math.max(0.0005, st.stackH[j])
        sm.scale.y = h
        sm.position.y = FLOOR_Y + h / 2
      }
      const tl = trayLines.current[j]
      if (tl && tl.material) tl.material.opacity = 0.45 + 0.15 * Math.sin(t * 2 + j) + (st.ship[j] > 0 ? 0.4 : 0)
    }
  })

  return (
    <group ref={m.group} visible={false}>
      {/* the works are seen from a raised three-quarter angle so the flat sheets read */}
      <group rotation={[0.5, 0, 0]} position={[0, 0.06, 0]}>
        {/* bench */}
        <AsmPart m={m} delay={0} dur={0.45} from={[0, -0.9, 0]} scaleFrom={0.6}>
          <mesh position={[0, FLOOR_Y - 0.03, 0]}>
            <boxGeometry args={[3.1, 0.05, 0.95]} />
            <meshStandardMaterial color="#0e130f" metalness={1} roughness={0.4} />
          </mesh>
          <Line ref={benchLine} points={rect(3.1, 0.95)} rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y - 0.002, 0]} color={tone.hud} lineWidth={1} transparent opacity={0.35} />
        </AsmPart>

        {/* the press drops in from above */}
        <AsmPart m={m} delay={0.14} dur={0.5} from={[0, 1.9, 0]} spin={[0, 0, 0.3]} scaleFrom={0.8} position={[PRESS_X, 0, 0]}>
          {/* base */}
          <mesh position={[0, FLOOR_Y - 0.12, 0]}>
            <boxGeometry args={[0.72, 0.14, 0.56]} />
            <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.35} />
          </mesh>
          {/* lower plate: rises to meet the slam */}
          <group ref={lower} position={[0, FLOOR_Y, 0]}>
            <mesh position={[0, -0.012, 0]}>
              <boxGeometry args={[0.62, 0.07, 0.5]} />
              <meshStandardMaterial color={tone.metalHi} metalness={1} roughness={0.3} />
            </mesh>
            <mesh position={[0, BED_TOP - 0.003, 0]}>
              <boxGeometry args={[0.6, 0.006, 0.48]} />
              <meshStandardMaterial color={tone.heroBase} emissive={tone.heroBase} emissiveIntensity={0.25} metalness={1} roughness={0.3} />
            </mesh>
          </group>
          {/* columns + crown */}
          {[-0.3, 0.3].map((x) => (
            <mesh key={x} position={[x, FLOOR_Y + 0.42, -0.2]}>
              <cylinderGeometry args={[0.03, 0.03, 0.92, 12]} />
              <meshStandardMaterial color={tone.metalHi} metalness={1} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, FLOOR_Y + 0.9, -0.2]}>
            <boxGeometry args={[0.8, 0.08, 0.22]} />
            <meshStandardMaterial color={tone.metal} metalness={1} roughness={0.35} />
          </mesh>
          {/* upper plate */}
          <group ref={plate} position={[0, PLATE_DOWN + 0.5, 0]}>
            <mesh>
              <boxGeometry args={[0.6, 0.14, 0.48]} />
              <meshStandardMaterial color={tone.metalHi} metalness={1} roughness={0.3} />
            </mesh>
            {/* gold die lip: flares on impact */}
            <mesh position={[0, -0.06, 0]}>
              <boxGeometry args={[0.62, 0.025, 0.5]} />
              <meshStandardMaterial ref={lipMat} color={tone.heroBase} emissive={tone.hero} emissiveIntensity={0.35} metalness={1} roughness={0.3} toneMapped={false} />
            </mesh>
            {/* cyan readout sliding along the plate face */}
            <mesh ref={readout} position={[0, 0.01, 0.245]}>
              <boxGeometry args={[0.12, 0.02, 0.006]} />
              <meshBasicMaterial color={tone.hud} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.01, 0.242]}>
              <boxGeometry args={[0.5, 0.02, 0.004]} />
              <meshBasicMaterial color={tone.hud} toneMapped={false} transparent opacity={0.2} />
            </mesh>
          </group>
        </AsmPart>

        {/* sheet pool: two pre-labelled sheets per document type */}
        {Array.from({ length: POOL }, (_, i) => (
          <group key={i} ref={(el) => (sheets.current[i] = el)} visible={false}>
            <mesh>
              <planeGeometry args={[0.3, 0.4]} />
              <meshStandardMaterial color="#f1ebe0" emissive="#f1ebe0" emissiveIntensity={0.1} roughness={0.85} metalness={0} side={THREE.DoubleSide} />
            </mesh>
            <Text font={FONT_BIG} fontSize={0.1} letterSpacing={0.06} anchorX="center" anchorY="middle" position={[0, 0.06, 0.004]}>
              {SHEET_LABELS[i % 3]}
              <meshBasicMaterial color={tone.drama} toneMapped={false} side={THREE.DoubleSide} />
            </Text>
            {[0, 1, 2].map((r) => (
              <mesh key={r} position={[0, -0.06 - r * 0.045, 0.003]}>
                <planeGeometry args={[0.2 - r * 0.04, 0.012]} />
                <meshBasicMaterial color="#8f8b82" side={THREE.DoubleSide} />
              </mesh>
            ))}
          </group>
        ))}

        {/* four module stacks: trays snap in left → right */}
        {Array.from({ length: STACKS }, (_, j) => (
          <AsmPart key={j} m={m} delay={0.34 + j * 0.08} dur={0.36} from={[0, -0.4, 0.7]} scaleFrom={0} position={[stackX(j), 0, 0]}>
            <mesh ref={(el) => (stacks.current[j] = el)} position={[0, FLOOR_Y, 0]} scale={[1, 0.0005, 1]}>
              <boxGeometry args={[0.31, 1, 0.41]} />
              <meshStandardMaterial color="#efe8da" roughness={0.75} />
            </mesh>
            <Line
              ref={(el) => (trayLines.current[j] = el)}
              points={rect(0.4, 0.5)}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, FLOOR_Y + 0.003, 0]}
              color={tone.hud}
              lineWidth={1}
              transparent
              opacity={0.55}
            />
            <Text font={FONT_HUD} fontSize={0.05} letterSpacing={0.18} anchorX="center" anchorY="middle" position={[0, FLOOR_Y - 0.07, 0.34]}>
              {`MODULE 0${j + 1}`}
              <meshBasicMaterial color={tone.hud} toneMapped={false} />
            </Text>
          </AsmPart>
        ))}
      </group>

      <Shockwave ref={m.shock} radius={1.6} />
      <group ref={m.labels} visible={false}>
        <Label>4 MODULES · PDF / EXCEL / CRYSTAL</Label>
      </group>
    </group>
  )
}
