import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { scroll, tickMouse } from './scrollStore'
import { CAMERA_Z } from './constants'

// Each page is its own scene, so the camera stays home at (0, 0, CAMERA_Z): mouse parallax, a slow handheld drift,
// scroll-velocity micro-shake and decaying impact impulses (scroll.impulse). Pages may add an offset on top by
// writing scroll.camOffset = { x, y, z } (world units) and scroll.camLook = { x, y, z }; both are smoothed here.
export default function CameraRig({ enabled = true }) {
  const { camera } = useThree()
  const shake = useRef(0)
  const off = useRef({ x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0 })
  useFrame((state, dt) => {
    tickMouse(dt)
    scroll.sectionIndex = 0
    // Lenis only updates velocity on scroll events; decay it so shake settles after jumps / route changes
    scroll.velocity *= Math.pow(0.02, Math.min(dt, 0.05))
    shake.current += (Math.min(Math.abs(scroll.velocity) / 60, 1) - shake.current) * 0.1
    const imp = scroll.impulse || 0
    scroll.impulse = imp * Math.max(0, 1 - dt * 5.5)
    const jolt = shake.current * 0.03 + imp * 0.22
    const t = state.clock.elapsedTime
    const mx = enabled ? scroll.mouse.x : 0
    const my = enabled ? scroll.mouse.y : 0
    const o = off.current
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05))
    const co = scroll.camOffset || { x: 0, y: 0, z: 0 }
    const cl = scroll.camLook || { x: 0, y: 0, z: 0 }
    o.x += (co.x - o.x) * k
    o.y += (co.y - o.y) * k
    o.z += (co.z - o.z) * k
    o.lx += (cl.x - o.lx) * k
    o.ly += (cl.y - o.ly) * k
    o.lz += (cl.z - o.lz) * k
    camera.position.x = o.x + mx * 0.7 + Math.sin(t * 0.3) * 0.08 + (Math.random() - 0.5) * jolt
    camera.position.y = o.y + my * 0.45 + Math.cos(t * 0.4) * 0.06 + (Math.random() - 0.5) * jolt
    camera.position.z = CAMERA_Z + o.z
    camera.lookAt(o.lx + mx * 0.25, o.ly + my * 0.15, o.lz)
    camera.rotation.z += -mx * 0.015
  })
  return null
}

export function computeSectionIndex() {
  return 0
}
