import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { headEndTexture, headSideTexture, headTopTexture } from './textures'

// An original, procedurally built war hammer: a rounded, bevelled steel head with flared striking faces, rune-cut
// knotwork engravings (canvas-drawn bump + emissive maps that glow lightning-blue with the charge), a forged neck
// collar, a leather-wrapped grip (a raised helical band around a dark core), a lathe-turned pommel and a leather
// wrist-strap loop that hangs with gravity and swings with the hammer's motion.
//
// Local frame: the head's centre sits at y = +HEAD_Y, the grip runs down -Y. The group origin is near the balance
// point so tilts and spins pivot naturally. ref exposes { head, grip, pommel, setCharge(charge, flash) }.

export const HEAD_Y = 1.1
export const HEAD_H = 0.96
const L = 1.66 // head length (x)
const H = HEAD_H // head height (y)
const D = 0.96 // head depth (z)

const METAL = { color: '#a7afb8', metalness: 1, roughness: 0.3, envMapIntensity: 1.3 }
const BOLT = new THREE.Color('#8fd8ff')

function lathe(points, segs = 40) {
  return new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(r, y)),
    segs,
  )
}

// Raised helical leather band around the grip core.
function wrapGeometry({ y0 = -0.78, y1 = -2.05, turns = 6, r = 0.11, width = 0.2, bulge = 0.018, segs = 400, across = 6 } = {}) {
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const th = t * turns * Math.PI * 2
    const yc = y0 + (y1 - y0) * t
    const c = Math.cos(th)
    const s = Math.sin(th)
    for (let j = 0; j <= across; j++) {
      const v = j / across
      // rounded profile + a slight shingle slope so each turn appears to overlap the next
      const rr = r + Math.sin(v * Math.PI) * bulge + v * 0.007
      pos.push(c * rr, yc + (v - 0.5) * width, s * rr)
      uv.push(t * turns, v)
    }
  }
  const row = across + 1
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * row + j
      const b = a + row
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// Teardrop strap loop in the XY plane, hanging from its pivot at the origin. The tube is flattened by scaling z only:
// the curve lies in z = 0, so this widens the cross-section into a flat leather band.
function strapGeometry() {
  const pts = [
    [0, 0],
    [0.09, -0.1],
    [0.15, -0.36],
    [0.1, -0.6],
    [0, -0.68],
    [-0.1, -0.6],
    [-0.15, -0.36],
    [-0.09, -0.1],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0))
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  const g = new THREE.TubeGeometry(curve, 72, 0.013, 6, true)
  g.scale(1, 1, 3.6)
  return g
}

const Hammer = forwardRef(function Hammer({ tier = 'high' }, ref) {
  const head = useRef()
  const grip = useRef()
  const pommel = useRef()
  const strap = useRef()
  const swing = useRef({ ax: 0, az: 0, vx: 0, vz: 0 })

  const geo = useMemo(() => {
    const seg = tier === 'low' ? 3 : 5
    return {
      head: new RoundedBoxGeometry(L, H, D, seg, 0.075),
      cap: new RoundedBoxGeometry(0.08, H + 0.08, D + 0.08, seg, 0.035),
      band: new RoundedBoxGeometry(0.05, H + 0.03, D + 0.03, 2, 0.02),
      sidePlane: new THREE.PlaneGeometry(L - 0.24, H - 0.14),
      endPlane: new THREE.PlaneGeometry(H - 0.02, D - 0.02),
      neck: lathe(
        [
          [0, -0.47],
          [0.22, -0.47],
          [0.235, -0.505],
          [0.19, -0.55],
          [0.16, -0.6],
          [0.18, -0.64],
          [0.182, -0.685],
          [0.142, -0.73],
          [0.118, -0.78],
          [0, -0.78],
        ],
        tier === 'low' ? 24 : 40,
      ),
      core: new THREE.CylinderGeometry(0.108, 0.108, 1.32, 24, 1, true),
      wrap: wrapGeometry(tier === 'low' ? { segs: 240, across: 4 } : undefined),
      collar: lathe(
        [
          [0, -2.04],
          [0.132, -2.04],
          [0.148, -2.07],
          [0.148, -2.11],
          [0.128, -2.14],
          [0, -2.14],
        ],
        32,
      ),
      pommel: lathe(
        [
          [0, -2.14],
          [0.122, -2.14],
          [0.16, -2.18],
          [0.162, -2.24],
          [0.126, -2.28],
          [0.175, -2.34],
          [0.168, -2.4],
          [0.112, -2.445],
          [0.045, -2.465],
          [0, -2.465],
        ],
        tier === 'low' ? 24 : 40,
      ),
      eye: new THREE.TorusGeometry(0.046, 0.015, 8, 24),
      strap: strapGeometry(),
    }
  }, [tier])

  const mat = useMemo(() => {
    const side = headSideTexture()
    const top = headTopTexture()
    const end = headEndTexture()
    const engraved = (map) =>
      new THREE.MeshStandardMaterial({
        ...METAL,
        roughness: 0.34,
        bumpMap: map,
        bumpScale: -2.2,
        emissive: BOLT,
        emissiveMap: map,
        emissiveIntensity: 0.25,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      })
    return {
      metal: new THREE.MeshStandardMaterial(METAL),
      darkMetal: new THREE.MeshStandardMaterial({ ...METAL, color: '#6d747c', roughness: 0.38 }),
      side: engraved(side),
      top: engraved(top),
      end: engraved(end),
      core: new THREE.MeshStandardMaterial({ color: '#120a06', roughness: 0.9, metalness: 0 }),
      leather: new THREE.MeshStandardMaterial({ color: '#4b2d1a', roughness: 0.6, metalness: 0.04, envMapIntensity: 0.55 }),
      strap: new THREE.MeshStandardMaterial({ color: '#4a2b18', roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide }),
    }
  }, [])

  useEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose())
      Object.values(mat).forEach((m) => m.dispose())
    },
    [geo, mat],
  )

  useImperativeHandle(
    ref,
    () => ({
      get head() {
        return head.current
      },
      get grip() {
        return grip.current
      },
      get pommel() {
        return pommel.current
      },
      setCharge(charge, flash = 0) {
        const e = 0.06 + charge * 0.75 + flash * 2.6
        mat.side.emissiveIntensity = e
        mat.top.emissiveIntensity = e * 1.1
        mat.end.emissiveIntensity = e
      },
    }),
    [mat],
  )

  // strap: a damped pendulum that hangs along world gravity (expressed in the hammer's local frame)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const g = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const s = strap.current
    if (!s || !s.parent) return
    const d = Math.min(dt, 0.05)
    s.parent.getWorldQuaternion(q)
    g.set(0, -1, 0).applyQuaternion(q.invert())
    // desired swing angles that point the loop's -Y along gravity
    const wantZ = THREE.MathUtils.clamp(Math.atan2(g.x, -g.y), -1.9, 1.9)
    const wantX = THREE.MathUtils.clamp(Math.atan2(-g.z, Math.hypot(g.x, g.y)), -1.2, 1.2)
    const w = swing.current
    w.vz += ((wantZ - w.az) * 38 - w.vz * 3.2) * d
    w.vx += ((wantX - w.ax) * 38 - w.vx * 3.2) * d
    w.az += w.vz * d
    w.ax += w.vx * d
    s.rotation.set(w.ax, 0, w.az)
  })

  const ex = L / 2 + 0.005 // end-cap centre
  const ep = L / 2 + 0.047 // end-panel plane
  return (
    <group position={[0, HEAD_Y, 0]}>
      {/* head */}
      <mesh ref={head} geometry={geo.head} material={mat.metal} castShadow />
      <mesh geometry={geo.cap} material={mat.darkMetal} position={[ex, 0, 0]} />
      <mesh geometry={geo.cap} material={mat.darkMetal} position={[-ex, 0, 0]} />
      <mesh geometry={geo.band} material={mat.darkMetal} position={[L / 2 - 0.1, 0, 0]} />
      <mesh geometry={geo.band} material={mat.darkMetal} position={[-L / 2 + 0.1, 0, 0]} />
      {/* engraved panels */}
      <mesh geometry={geo.sidePlane} material={mat.side} position={[0, 0, D / 2 + 0.0015]} />
      <mesh geometry={geo.sidePlane} material={mat.side} position={[0, 0, -D / 2 - 0.0015]} rotation={[0, Math.PI, 0]} />
      <mesh geometry={geo.sidePlane} material={mat.top} position={[0, H / 2 + 0.0015, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geo.sidePlane} material={mat.side} position={[0, -H / 2 - 0.0015, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geo.endPlane} material={mat.end} position={[ep, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geo.endPlane} material={mat.end} position={[-ep, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* neck, grip, pommel */}
      <mesh geometry={geo.neck} material={mat.metal} />
      <group ref={grip} position={[0, -1.42, 0]}>
        <mesh geometry={geo.core} material={mat.core} />
      </group>
      <mesh geometry={geo.wrap} material={mat.leather} />
      <mesh geometry={geo.collar} material={mat.darkMetal} />
      <mesh ref={pommel} geometry={geo.pommel} material={mat.metal} />
      <mesh geometry={geo.eye} material={mat.darkMetal} position={[0, -2.508, 0]} />
      <group ref={strap} position={[0, -2.54, 0]}>
        <mesh geometry={geo.strap} material={mat.strap} />
      </group>
    </group>
  )
})

export default Hammer
