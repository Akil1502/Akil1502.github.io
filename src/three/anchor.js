import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SECTION_GAP } from './constants'
import { scroll } from './scrollStore'

// Maps a DOM element's rectangle into world units on the z = `depth` plane, LOCAL to a section group
// (which sits at y = -index * SECTION_GAP). Lets 3D objects sit exactly where the layout leaves room for them.
// `follow` < 1 lets the object lag the camera's mouse parallax for depth (0 = full parallax, 1 = glued to DOM).
export function useAnchor(selector, index = 0, { depth = 0, follow = 0.85 } = {}) {
  const ref = useRef({ ok: false, x: 0, y: 0, w: 1, h: 1, screenX: 0, screenY: 0, inView: 0 })
  const el = useRef(null)
  const { camera, size } = useThree()
  useFrame(() => {
    if (!el.current || !el.current.isConnected) el.current = document.querySelector(selector)
    const e = el.current
    const out = ref.current
    if (!e) {
      out.ok = false
      return
    }
    const r = e.getBoundingClientRect()
    const cx = ((r.left + r.width / 2) / size.width) * 2 - 1
    const cy = -(((r.top + r.height / 2) / size.height) * 2 - 1)
    const dist = camera.position.z - depth
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist
    const halfW = halfH * (size.width / size.height)
    // camera parallax offsets (must match CameraRig)
    const px = scroll.mouse.x * 0.7
    const py = scroll.mouse.y * 0.45
    out.x = cx * halfW + camera.position.x - (1 - follow) * px
    out.y = cy * halfH + camera.position.y - (1 - follow) * py + index * SECTION_GAP
    out.w = (r.width / size.width) * 2 * halfW
    out.h = (r.height / size.height) * 2 * halfH
    out.screenX = r.left + r.width / 2
    out.screenY = r.top + r.height / 2
    out.ok = r.bottom > -size.height && r.top < size.height * 2
    // 0..1 how much of the element is inside the viewport
    const vis = Math.min(r.bottom, size.height) - Math.max(r.top, 0)
    out.inView = Math.max(0, Math.min(1, vis / Math.max(1, Math.min(r.height, size.height))))
  })
  return ref
}

// Visible world width/height at a given depth for the current camera.
export function useViewSize(depth = 0) {
  const { camera, size } = useThree()
  const dist = camera.position.z - depth
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist
  return { width: h * (size.width / size.height), height: h }
}
