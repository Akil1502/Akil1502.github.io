import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { useAnchor } from '../../../three/anchor'
import { useDispose } from './useDispose'

// HUD LOCK-ON callouts for the diagnostic beat: a gold leader line is drawn from each DOM read-out
// ([data-anchor="home-stat-N"]) to the armour plate it describes, ending in a pulsing reticle on the plate.
// `compact` (portrait / phones, where the read-outs sit in a 2×2 grid under the helmet and lines would cut across
// the copy): numbered reticles only — "01…04" lock onto the plates, matching the "PLATE 0N" tags in the DOM.
const TARGETS = ['forehead', 'crown', 'cheek', 'ear']
const FONT = '/fonts/ShareTechMono-Regular.ttf'

export default function LeaderLines({ dir, compact = false }) {
  const a0 = useAnchor('[data-anchor="home-stat-0"]', 0, { follow: 1 })
  const a1 = useAnchor('[data-anchor="home-stat-1"]', 0, { follow: 1 })
  const a2 = useAnchor('[data-anchor="home-stat-2"]', 0, { follow: 1 })
  const a3 = useAnchor('[data-anchor="home-stat-3"]', 0, { follow: 1 })
  const anchors = [a0, a1, a2, a3]
  const lines = useMemo(
    () =>
      TARGETS.map(() => {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3))
        const m = new THREE.LineBasicMaterial({ color: new THREE.Color('#f5c04a').multiplyScalar(1.4), transparent: true, opacity: 0, toneMapped: false, depthWrite: false, depthTest: false })
        const l = new THREE.Line(g, m)
        l.frustumCulled = false
        l.renderOrder = 6
        return l
      }),
    [],
  )
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.075, 0.09, 40), [])
  const dotGeo = useMemo(() => new THREE.CircleGeometry(0.03, 16), [])
  const ringMats = useMemo(() => TARGETS.map(() => new THREE.MeshBasicMaterial({ color: '#7fe9ff', transparent: true, opacity: 0, toneMapped: false, depthTest: false, depthWrite: false })), [])
  useDispose([lines.map((l) => [l.geometry, l.material]), ringGeo, dotGeo, ringMats], [lines, ringGeo, dotGeo, ringMats])
  const rings = useRef([])
  const dots = useRef([])
  const tags = useRef([])
  const v = useMemo(() => ({ p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), tip: new THREE.Vector3(), tmp: new THREE.Vector3() }), [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const L = dir.lines || 0
    for (let i = 0; i < TARGETS.length; i++) {
      const line = lines[i]
      const an = anchors[i].current
      const prog = Math.min(1, Math.max(0, L * 1.7 - i * 0.22))
      const tag = tags.current[i]
      if (compact) {
        line.visible = false
        if (dots.current[i]) dots.current[i].visible = false
        const ring = rings.current[i]
        const on = prog > 0.05 && !!dir.helmAnchor
        if (ring) ring.visible = on
        if (tag) tag.visible = on
        if (!on) continue
        dir.helmAnchor(TARGETS[i], v.p2)
        const k = Math.min(1, prog * 1.6)
        // lock-on: the reticle snaps in from wide to tight
        ring.position.copy(v.p2)
        ring.quaternion.copy(state.camera.quaternion)
        ring.scale.setScalar((1 + (1 - k) * 2.5) * (1 + 0.15 * Math.sin(t * 5 + i)))
        ringMats[i].opacity = 0.95 * k
        if (tag) {
          tag.position.copy(v.p2)
          tag.quaternion.copy(state.camera.quaternion)
          tag.fillOpacity = k
        }
        continue
      }
      if (tag) tag.visible = false
      const show = an.ok && prog > 0 && dir.helmAnchor
      line.visible = !!show
      const ring = rings.current[i]
      const dot = dots.current[i]
      if (!show) {
        if (ring) ring.visible = false
        if (dot) dot.visible = false
        continue
      }
      dir.helmAnchor(TARGETS[i], v.p2)
      v.p0.set(an.x, an.y, 0)
      const dx = v.p2.x - v.p0.x
      v.p1.set(v.p0.x + dx * 0.45, v.p0.y, 0)
      const pos = line.geometry.attributes.position
      pos.setXYZ(0, v.p0.x, v.p0.y, v.p0.z)
      if (prog < 0.5) {
        v.tip.lerpVectors(v.p0, v.p1, prog * 2)
        pos.setXYZ(1, v.tip.x, v.tip.y, v.tip.z)
        pos.setXYZ(2, v.tip.x, v.tip.y, v.tip.z)
      } else {
        v.tip.lerpVectors(v.p1, v.p2, (prog - 0.5) * 2)
        pos.setXYZ(1, v.p1.x, v.p1.y, v.p1.z)
        pos.setXYZ(2, v.tip.x, v.tip.y, v.tip.z)
      }
      pos.needsUpdate = true
      line.material.opacity = Math.min(1, prog * 2) * 0.85
      if (ring) {
        ring.visible = prog > 0.98
        ring.position.copy(v.p2)
        ring.quaternion.copy(state.camera.quaternion)
        ring.scale.setScalar(1 + 0.25 * Math.sin(t * 5 + i))
        ringMats[i].opacity = 0.9
      }
      if (dot) {
        dot.visible = true
        dot.position.copy(v.p0)
        dot.material.opacity = Math.min(1, prog * 3)
      }
    }
  })

  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      {TARGETS.map((k, i) => (
        <mesh key={k} ref={(el) => (rings.current[i] = el)} geometry={ringGeo} material={ringMats[i]} visible={false} renderOrder={7} />
      ))}
      {TARGETS.map((k, i) => (
        <mesh key={k + 'd'} ref={(el) => (dots.current[i] = el)} geometry={dotGeo} visible={false} renderOrder={7}>
          <meshBasicMaterial color={'#f5c04a'} transparent opacity={0} toneMapped={false} depthTest={false} depthWrite={false} />
        </mesh>
      ))}
      {compact
        ? TARGETS.map((k, i) => (
            <Text
              key={k + 't'}
              ref={(el) => (tags.current[i] = el)}
              font={FONT}
              fontSize={0.1}
              letterSpacing={0.08}
              anchorX={-0.12}
              anchorY="bottom"
              color="#f5c04a"
              outlineWidth={0.01}
              outlineBlur={0.02}
              outlineColor="#05040a"
              fillOpacity={0}
              renderOrder={8}
              visible={false}
            >
              {String(i + 1).padStart(2, '0')}
            </Text>
          ))
        : null}
    </group>
  )
}
