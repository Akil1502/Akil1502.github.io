import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { scroll } from '../../../three/scrollStore'
import { COL, CX, CZ, groundHeight, rng, tmpObj } from './gammaConst'

// Floating debris: low-poly boulders torn out of the crater, orbiting slowly in the gamma field.
// `lev` (0..1, owned by the scene) is how hard the field is lifting them: 0 = lying in the rubble, 1 = suspended
// high above the crater. A SMASH drops the field (lev → 0 in a blink) and the rocks bounce back up on the field.
// The mouse pushes the cloud around (rocks lean away from the cursor side). Instanced: 3 rock shapes, one draw each.

function rockGeometry(detail, seed) {
  const g = new THREE.IcosahedronGeometry(0.5, detail)
  const p = g.attributes.position
  const h = (x, y, z) => {
    const s = Math.sin(x * 63.1 + y * 17.9 + z * 41.3 + seed * 9.7) * 43758.5453
    return s - Math.floor(s)
  }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    const z = p.getZ(i)
    const k = 0.72 + 0.5 * h(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100))
    p.setXYZ(i, x * k * 1.15, y * k * 0.85, z * k)
  }
  g.computeVertexNormals()
  return g
}

export default function Debris({ tier, state }) {
  const total = tier === 'high' ? 150 : tier === 'medium' ? 84 : 42
  const geos = useMemo(() => [rockGeometry(0, 1), rockGeometry(0, 2), rockGeometry(1, 3)], [])
  useEffect(() => () => geos.forEach((g) => g.dispose()), [geos])
  const meshes = [useRef(), useRef(), useRef()]
  const group = useRef()
  const per = Math.ceil(total / 3)
  const data = useMemo(() => {
    const r = rng(902 + total)
    return Array.from({ length: per * 3 }, (_, i) => {
      const inner = r() < 0.4
      const rad = inner ? 1.0 + r() * 2.4 : 2.6 + r() * 3.2
      const a = r() * Math.PI * 2
      return {
        a0: a,
        rad,
        // a few big boulders, many pebbles
        size: (r() < 0.12 ? 0.55 + r() * 0.5 : 0.1 + r() * 0.3) * (inner ? 0.9 : 1),
        h: 0.6 + r() * 3.4 + (inner ? 0.6 : 0),
        w: (0.05 + r() * 0.09) * (r() < 0.5 ? 1 : -1) * (inner ? 1.4 : 1),
        bob: r() * Math.PI * 2,
        spinA: new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(),
        spin: 0.2 + r() * 0.9,
        rest: 0, // ground height at the orbit (rocks resting in the rubble)
        lagK: 0.6 + r() * 0.8, // heavier rocks answer the field later
        lev: 1, // the field starts high: the rocks hang in the air until the first smash
        vy: 0,
        y: 0,
        mesh: i % 3,
        slot: Math.floor(i / 3),
      }
    })
  }, [per, total])

  const q = useMemo(() => new THREE.Quaternion(), [])
  useLayoutEffect(() => {
    for (const d of data) d.rest = groundHeight(CX + Math.cos(d.a0) * d.rad, CZ + Math.sin(d.a0) * d.rad) + d.size * 0.35
  }, [data])

  useFrame((s, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = s.clock.elapsedTime
    const target = state.lev
    const mx = scroll.mouse.x
    const my = scroll.mouse.y
    for (const d of data) {
      // each rock follows the field with its own inertia; a drop (state.drop) slams everything down at once
      const k = state.drop > 0 ? 1 - Math.pow(0.004, dt * (0.8 + d.lagK * 0.4)) : 1 - Math.pow(0.25, dt * d.lagK)
      d.lev += ((state.drop > 0 ? 0 : target) - d.lev) * k
      const ang = d.a0 + t * d.w
      const rr = d.rad * (1 + 0.18 * d.lev) // the cloud swells as it lifts
      let x = CX + Math.cos(ang) * rr
      let z = CZ + Math.sin(ang) * rr * 0.85
      const lift = d.h * d.lev + Math.sin(t * 0.8 + d.bob) * 0.12 * d.lev
      // the cursor pushes the cloud: rocks on the cursor's side drift away from it
      x += -mx * 0.6 * d.lev * (1.2 - d.rad / 7)
      z += my * 0.3 * d.lev
      const y = d.rest + lift
      tmpObj.position.set(x, y, z)
      q.setFromAxisAngle(d.spinA, t * d.spin * (0.25 + d.lev))
      tmpObj.quaternion.copy(q)
      tmpObj.scale.setScalar(d.size)
      tmpObj.updateMatrix()
      meshes[d.mesh].current?.setMatrixAt(d.slot, tmpObj.matrix)
    }
    for (const m of meshes) if (m.current) m.current.instanceMatrix.needsUpdate = true
    if (group.current) group.current.rotation.y = Math.sin(t * 0.05) * 0.05
  })

  return (
    <group ref={group}>
      {geos.map((g, i) => (
        <instancedMesh key={i} ref={meshes[i]} args={[g, null, per]} frustumCulled={false}>
          <meshStandardMaterial color={i === 2 ? COL.rockHi : '#1d251d'} roughness={0.82} metalness={0.15} flatShading envMapIntensity={0.9} emissive={COL.greenDeep} emissiveIntensity={0.05} />
        </instancedMesh>
      ))}
    </group>
  )
}
