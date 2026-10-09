import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { skills } from '../../../data/resume'
import { useDispose } from './useDispose'

// Skill "subsystems" orbiting the reactor on a tilted ring. Each one comes ONLINE (cyan / gold for the AI tools,
// pops) as the repulsor charge passes its threshold; standby ones are dim. Every subsystem keeps an orbiting marker,
// but its name is only spelled out while it sweeps through the right-hand arc of the ring — so the labels read as a
// clean, rolling column beside the reactor instead of a tangle over it (the DOM list carries the full roster).
// `compact` (portrait / phones): markers only — the DOM chips name the systems there.
const NAMES = [...skills.core.map((s) => s.name), ...skills.ai.map((s) => s.name)]
const N = NAMES.length
const FONT = '/fonts/ShareTechMono-Regular.ttf'
const ON = new THREE.Color('#9ff4ff')
const OFF = new THREE.Color('#5d6470')
const AI = new THREE.Color('#f5c04a')
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export default function SkillOrbit({ dir, radius = 2.3, compact = false }) {
  const groups = useRef([])
  const texts = useRef([])
  const marks = useRef([])
  const state = useRef(NAMES.map(() => ({ on: false, pop: 0 })))
  const col = useMemo(() => new THREE.Color(), [])
  const markGeo = useMemo(() => new THREE.PlaneGeometry(0.075, 0.075), [])
  const markMats = useMemo(() => NAMES.map(() => new THREE.MeshBasicMaterial({ color: '#7fe9ff', transparent: true, opacity: 0, toneMapped: false, depthWrite: false })), [])
  useDispose([markGeo, markMats], [markGeo, markMats])

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime
    const c = dir.charge || 0
    const vis = dir.labels || 0
    for (let i = 0; i < N; i++) {
      const g = groups.current[i]
      const tx = texts.current[i]
      if (!g) continue
      g.visible = vis > 0.01
      if (!g.visible) continue
      const a = (i / N) * Math.PI * 2 + t * 0.16
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const x = ca * radius
      const y = -sa * radius * 0.46
      const z = sa * radius * 0.62
      g.position.set(x, y, z)
      const st = state.current[i]
      const on = c >= (i + 1) / (N + 1)
      if (on && !st.on) st.pop = 1
      st.on = on
      st.pop = Math.max(0, st.pop - dt * 2.2)
      const depth = 0.4 + 0.6 * (sa * 0.5 + 0.5) // front of the ring brighter than the back
      const isAI = i >= skills.core.length
      col.copy(on ? (isAI ? AI : ON) : OFF)
      if (tx) {
        // names only on the right-hand arc, and the ones passing behind the reactor recede
        const arc = compact ? 0 : sstep(0.3, 0.62, ca) * (0.35 + 0.65 * sstep(-0.6, 0.3, sa))
        tx.visible = arc > 0.01
        tx.color = col.getHex()
        tx.fillOpacity = vis * arc * (on ? 1 : 0.5)
        tx.outlineOpacity = vis * arc * 0.7 // dark halo keeps the names legible over the reactor bloom
      }
      g.scale.setScalar(1 + st.pop * 0.35)
      const m = markMats[i]
      m.opacity = vis * depth * (on ? 1 : 0.35)
      m.color.copy(col).multiplyScalar(on ? 1.8 : 1)
      if (marks.current[i]) marks.current[i].rotation.z = Math.PI / 4 + t * (on ? 2 : 0.3)
    }
  })

  return (
    <group>
      {NAMES.map((n, i) => (
        <group key={n} ref={(el) => (groups.current[i] = el)} visible={false}>
          <mesh ref={(el) => (marks.current[i] = el)} geometry={markGeo} material={markMats[i]} />
          {compact ? null : (
            <Text
              ref={(el) => (texts.current[i] = el)}
              font={FONT}
              fontSize={0.11}
              letterSpacing={0.06}
              anchorX="center"
              anchorY="bottom"
              position={[0, 0.07, 0]}
              color="#5d6470"
              outlineWidth={0.012}
              outlineBlur={0.03}
              outlineColor="#05040a"
              outlineOpacity={0}
              fillOpacity={0}
              visible={false}
            >
              {n.toUpperCase()}
            </Text>
          )}
        </group>
      ))}
    </group>
  )
}
