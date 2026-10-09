import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { CONCEPTS } from '../runes'
import { runeTexture } from './textures'

// The five laws of the forge as rune sigils orbiting the hammer on a tilted ring (concepts beat). Each sigil is a
// glowing rune over its name in Cinzel; they fan out from the hammer with fx.sigils and stay billboarded.
const FONT = '/fonts/Cinzel-ExtraBold.ttf'
const TILT = 0.42
const GOLD = new THREE.Color('#ffd27a')

export default function ConceptSigils({ fx, radius = 2.9 }) {
  const items = useRef([])
  const ring = useRef()
  const group = useRef()
  const runeGeo = useMemo(() => new THREE.PlaneGeometry(0.46, 0.7), [])
  const mats = useMemo(
    () =>
      CONCEPTS.map(
        (c) =>
          new THREE.MeshBasicMaterial({
            map: runeTexture(c.rune),
            color: GOLD,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  )
  useEffect(
    () => () => {
      runeGeo.dispose()
      mats.forEach((m) => m.dispose())
    },
    [runeGeo, mats],
  )

  // a few warm-up frames at scale ~0 right after mount compile the rune + text shaders while the transition still
  // covers the screen (otherwise the first appearance of the sigils stalls a frame)
  const warm = useRef(3)

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const amt = fx.sigils
    const warming = warm.current > 0
    if (warming) warm.current--
    g.visible = amt > 0.01 || warming
    if (!g.visible) return
    const t = state.clock.elapsedTime
    const n = CONCEPTS.length
    for (let j = 0; j < n; j++) {
      const it = items.current[j]
      if (!it) continue
      const a = (j / n) * Math.PI * 2 + t * 0.16
      const s = Math.sin(a)
      const c = Math.cos(a)
      const depth = c * 0.5 + 0.5
      const r = radius * amt
      it.position.set(s * r, -c * r * Math.sin(TILT) + Math.sin(t + j) * 0.05, c * r * Math.cos(TILT))
      it.quaternion.copy(state.camera.quaternion)
      it.scale.setScalar(Math.max(1e-4, amt * (0.75 + 0.25 * depth)))
      mats[j].color.copy(GOLD).multiplyScalar((0.6 + 1.2 * depth) * amt)
      const tx = it.children[1]
      if (tx) tx.fillOpacity = (0.35 + 0.65 * depth) * amt
    }
    if (ring.current) {
      ring.current.scale.setScalar(Math.max(1e-4, radius * amt))
      ring.current.material.opacity = 0.35 * amt
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={[Math.PI / 2 + TILT, 0, 0]}>
        <torusGeometry args={[1, 0.006, 6, 160]} />
        <meshBasicMaterial color={'#d9b25c'} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
      </mesh>
      {CONCEPTS.map((c, j) => (
        <group
          key={c.name}
          ref={(el) => {
            items.current[j] = el
          }}
        >
          <mesh geometry={runeGeo} material={mats[j]} position={[0, 0.46, 0]} />
          <Text font={FONT} fontSize={0.2} letterSpacing={0.06} anchorX="center" anchorY="middle" color={'#f3e2b4'} material-toneMapped={false}>
            {c.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </group>
  )
}
