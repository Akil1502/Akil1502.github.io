import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { palette } from '../constants'

const tmp = new THREE.Object3D()

// Thin HUD ring of tick marks (instanced). `gauge` (0..1) lights a bright arc; the ring rotates at `speed`.
export default function HudRing({ radius = 2, ticks = 72, gauge = 0.72, speed = 0.15, color = palette.cyan, tilt = 0, thickness = 0.015, tickLength = 0.12, ...props }) {
  const inst = useRef()
  const ring = useRef()
  const colors = useMemo(() => {
    const c = new Float32Array(ticks * 3)
    const bright = new THREE.Color(color)
    const dim = new THREE.Color(color).multiplyScalar(0.35)
    for (let i = 0; i < ticks; i++) {
      const on = i / ticks < gauge
      const cc = on ? bright : dim
      c[i * 3] = cc.r
      c[i * 3 + 1] = cc.g
      c[i * 3 + 2] = cc.b
    }
    return c
  }, [ticks, gauge, color])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!inst.current) return
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * Math.PI * 2
      const major = i % 6 === 0
      const len = major ? tickLength * 1.9 : tickLength
      tmp.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
      tmp.rotation.set(0, 0, a)
      tmp.scale.set(len, major ? 0.03 : 0.018, 0.02)
      tmp.updateMatrix()
      inst.current.setMatrixAt(i, tmp.matrix)
    }
    inst.current.instanceMatrix.needsUpdate = true
    if (ring.current) ring.current.rotation.z = t * speed
  })

  return (
    <group ref={ring} rotation={[tilt, 0, 0]} {...props}>
      <instancedMesh ref={inst} args={[null, null, ticks]}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </boxGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <mesh>
        <torusGeometry args={[radius - tickLength * 0.9, thickness, 6, 160]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} toneMapped={false} />
      </mesh>
    </group>
  )
}
