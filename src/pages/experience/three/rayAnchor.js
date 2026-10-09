import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/* Screen-locked DOM → world anchor. This page dollies and pitches the camera per beat (scroll.camOffset /
   camLook), which the shared useAnchor (it assumes an unrotated camera) cannot follow, and a world-vertical rail
   would lean under the pitch (3-point perspective). So the element's rect is mapped onto a plane PARALLEL TO THE
   IMAGE PLANE at `dist` in front of the camera: x/y/z is the rect centre in world space, w/h are its size in world
   units on that plane, and the caller orients its group with the camera quaternion (`placeOnScreen`) so local +y is
   screen-up — the 3D stays glued to the DOM line exactly under any camera pose. Allocation-free per frame. */

const v = new THREE.Vector3()

export function useScreenAnchor(selector, dist = 10) {
  const ref = useRef({ ok: false, x: 0, y: 0, z: 0, w: 1, h: 1, inView: 0 })
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
    const W = size.width
    const H = size.height
    camera.updateMatrixWorld()
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist
    const tw = th * (W / H)
    const nx = ((r.left + r.width / 2) / W) * 2 - 1
    const ny = -(((r.top + r.height / 2) / H) * 2 - 1)
    v.set(nx * tw, ny * th, -dist).applyMatrix4(camera.matrixWorld)
    out.x = v.x
    out.y = v.y
    out.z = v.z
    out.w = (r.width / W) * 2 * tw
    out.h = (r.height / H) * 2 * th
    out.ok = r.bottom > -H && r.top < H * 2
    const vis = Math.min(r.bottom, H) - Math.max(r.top, 0)
    out.inView = Math.max(0, Math.min(1, vis / Math.max(1, Math.min(r.height, H))))
  })
  return ref
}

// Places a group at an anchor, facing the camera (local +y = screen up).
export function placeOnScreen(group, a, camera) {
  group.position.set(a.x, a.y, a.z)
  group.quaternion.copy(camera.quaternion)
}
