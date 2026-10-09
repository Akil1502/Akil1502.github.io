import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import SparkPortal from './SparkPortal'
import Mandala from './Mandala'
import { useAnchor } from '../../../three/anchor'
import { cert, CERT_COUNT, isAnthropic } from '../store'
import { certifications } from '../../../data/resume'

/*
 * SLING-RING PORTAL per certification card. Each slot follows its DOM window ([data-anchor="cert-portal-<i>"]),
 * reads cert.portals[i] ({ open, burst }, tweened by the DOM when the card scrolls in) and shows:
 *   - a spinning ring of sparks the size of the window (bursting wider while the card is revealed)
 *   - a small spell sigil inside the window: orange for Anthropic, emerald for GUVI
 * Hovering a card feeds the portal (sparks spin faster and hotter, sigil flares).
 * Also publishes card positions + which card is centred (cert.cardPos / cert.focus / cert.focusSide) for the rig.
 */
function PortalSlot({ i, tier }) {
  const a = useAnchor(`[data-anchor="cert-portal-${i}"]`, 0, { depth: 0, follow: 1 })
  const group = useRef()
  const sigil = useRef()
  const st = useMemo(() => ({ open: 0, intensity: 1, boost: 0 }), [])
  const hov = useRef(0)
  const orange = isAnthropic(certifications[i].issuer)
  const count = tier === 'high' ? 260 : tier === 'medium' ? 150 : 80

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const A = a.current
    const P = cert.portals[i]
    const pos = cert.cardPos[i]
    pos.ok = A.ok && A.inView > 0
    pos.x = A.x
    pos.y = A.y
    pos.sy = A.screenY
    pos.sx = A.screenX
    const on = A.ok && P.open > 0.002 && A.inView > 0
    if (group.current) group.current.visible = on
    if (!on) {
      st.open = 0
      return
    }
    hov.current += ((cert.hover === i ? 1 : 0) - hov.current) * (1 - Math.pow(0.004, dt))
    const h = hov.current
    const R = Math.max(0.05, Math.min(A.w, A.h) / 2)
    group.current.position.set(A.x, A.y, 0)
    group.current.scale.setScalar(R)
    st.open = P.open * (1 + h * 0.06)
    st.intensity = 0.9 + P.burst * 1.6 + h * 0.9
    st.boost = P.burst * 1.4 + h * 1.2
    if (sigil.current) {
      const u = sigil.current.material.uniforms
      const o = Math.min(1, P.open)
      u.uReveal.value = o
      u.uIntensity.value = (0.55 + h * 0.7 + P.burst * 0.8) * o
      sigil.current.scale.setScalar(0.84 * Math.min(1, P.open))
      sigil.current.userData.speed = (i % 2 ? -0.25 : 0.25) * (1 + h * 4)
    }
  })

  return (
    <group ref={group} visible={false}>
      <Mandala ref={sigil} radius={0.84} color={orange ? '#ffa63d' : '#38f29a'} hot={orange ? '#fff1c9' : '#e6fff2'} seed={i * 3 + 2} cells={36 + i * 4} detail={tier === 'low' ? 0 : 1} speed={0.25} intensity={0} reveal={0} position={[0, 0, -0.05]} />
      <SparkPortal state={st} count={count} radius={1} size={0.1} speed={0.7} gravity={0.85} life={0.95} spin={i % 2 ? -1.8 : 1.8} seed={i + 11} />
    </group>
  )
}

export default function CardPortals({ tier }) {
  const { size } = useThree()
  useFrame(() => {
    // which card is nearest the viewport centre (drives the relic's side swap)
    let best = -1
    let bd = Infinity
    for (let i = 0; i < CERT_COUNT; i++) {
      const p = cert.cardPos[i]
      if (!p.ok || p.sy === undefined) continue
      const d = Math.abs(p.sy - size.height * 0.5)
      if (d < bd && d < size.height * 0.75) {
        bd = d
        best = i
      }
    }
    cert.focus = best
    // no card in view yet (the spells header): keep the relic on the right, away from the title
    cert.focusSide = best >= 0 ? (cert.cardPos[best].sx > size.width * 0.5 ? 1 : -1) : -1
  })
  return (
    <>
      {Array.from({ length: CERT_COUNT }, (_, i) => (
        <PortalSlot key={i} i={i} tier={tier} />
      ))}
    </>
  )
}

