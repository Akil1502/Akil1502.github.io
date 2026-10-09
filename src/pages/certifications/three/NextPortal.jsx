import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import SparkPortal from './SparkPortal'
import Mandala from './Mandala'
import { useAnchor } from '../../../three/anchor'
import { scroll } from '../../../three/scrollStore'
import { cert } from '../store'

/*
 * The last SLING-RING PORTAL: when the "next mission" call to action scrolls in, a large ring of sparks tears open
 * around its emblem (spring overshoot + one camera impact), with a faint spell circle inside — the way out of the
 * Sanctum. It surges while the link is hovered.
 */
export default function NextPortal({ tier }) {
  const a = useAnchor('[data-section="certifications-next"] .np-emblem', 0, { depth: -0.5, follow: 1 })
  const group = useRef()
  const inner = useRef()
  const st = useMemo(() => ({ open: 0, intensity: 1, boost: 0 }), [])
  const sim = useRef({ open: 0, vel: 0, fired: false, hover: 0, link: null })
  const count = tier === 'high' ? 760 : tier === 'medium' ? 420 : 200

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const A = a.current
    const S = sim.current
    const vis = scroll.sections['certifications-next']?.visible ?? 0
    const target = A.ok && vis > 0.18 ? 1 : 0
    // under-damped spring: tears open past full size, then settles
    S.vel += (target - S.open) * 90 * dt
    S.vel *= Math.exp(-dt * 7.5)
    S.open = Math.max(0, S.open + S.vel * dt)
    if (target && !S.fired && S.open > 0.6) {
      S.fired = true
      scroll.impulse = Math.max(scroll.impulse || 0, 0.35)
      cert.flashOrange = Math.max(cert.flashOrange, 0.6)
    }
    if (!target && S.open < 0.05) S.fired = false
    if (!S.link || !S.link.isConnected) S.link = document.querySelector('[data-section="certifications-next"] .np-link')
    const hovered = S.link ? S.link.matches(':hover') : false
    S.hover += ((hovered ? 1 : 0) - S.hover) * (1 - Math.pow(0.01, dt))

    const on = A.ok && S.open > 0.003
    if (group.current) group.current.visible = on
    if (!on) {
      st.open = 0
      return
    }
    const R = Math.max(0.2, A.h * 0.74)
    group.current.position.set(A.x, A.y, -0.5)
    group.current.scale.setScalar(R)
    st.open = S.open * (1 + S.hover * 0.12)
    st.intensity = 1.1 + S.hover * 0.9
    st.boost = S.hover * 1.6
    if (inner.current) {
      const u = inner.current.material.uniforms
      u.uReveal.value = Math.min(1, S.open)
      u.uIntensity.value = (0.35 + S.hover * 0.5) * Math.min(1, S.open)
      inner.current.scale.setScalar(0.92 * Math.min(1.2, S.open))
    }
  })

  return (
    <group ref={group} visible={false}>
      <Mandala ref={inner} radius={0.92} seed={21} cells={60} speed={-0.2} intensity={0} reveal={0} position={[0, 0, -0.1]} />
      <SparkPortal state={st} count={count} radius={1} size={0.06} speed={0.55} gravity={0.6} life={1.1} spin={1.5} seed={41} />
    </group>
  )
}
