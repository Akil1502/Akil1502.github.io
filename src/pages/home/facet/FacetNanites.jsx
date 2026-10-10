import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { armorUniforms, nanoDelay } from '../three/armor'
import { naniteSize } from '../three/Nanites'

// dev-only: ?rv=0..1.1 freezes the reveal (see Centerpiece.jsx) — the swarm must follow it to be inspectable
const DBG_RV = import.meta.env.DEV && typeof window !== 'undefined' ? parseFloat(new URLSearchParams(window.location.search).get('rv')) : NaN

// NANOTECH SUIT-UP for the faceted helmet (adapted from three/Nanites.jsx): thousands of tiny hex plates stream out
// of the reactor and land on the plate facets. `parts` = [[topSurfaceGeometry, colour], ...] in helmet space; all
// motion lives in the shared swarm material's vertex shader (driven by uReveal), so this only builds the targets.
export default function FacetNanites({ parts, count = 5000, sourceRef, material }) {
  const mesh = useMemo(() => {
    const areas = parts.map(([g]) => triArea(g))
    const total = areas.reduce((a, b) => a + b, 0)
    const size = naniteSize(count)
    const hex = new THREE.CylinderGeometry(size, size, size * 0.32, 6, 1)
    const m = new THREE.InstancedMesh(hex, material, count)
    m.frustumCulled = false
    const aTarget = new Float32Array(count * 3)
    const aNormal = new Float32Array(count * 3)
    const aRand = new Float32Array(count * 4)
    const p = new THREE.Vector3()
    const n = new THREE.Vector3()
    const col = new THREE.Color()
    const holder = new THREE.Mesh()
    let idx = 0
    parts.forEach(([g, c], pi) => {
      holder.geometry = g
      const sampler = new MeshSurfaceSampler(holder).build()
      const want = pi === parts.length - 1 ? count - idx : Math.round((areas[pi] / total) * count)
      col.set(c)
      for (let k = 0; k < want && idx < count; k++) {
        sampler.sample(p, n)
        aTarget[idx * 3] = p.x
        aTarget[idx * 3 + 1] = p.y
        aTarget[idx * 3 + 2] = p.z
        aNormal[idx * 3] = n.x
        aNormal[idx * 3 + 1] = n.y
        aNormal[idx * 3 + 2] = n.z
        aRand[idx * 4] = nanoDelay(p.x, p.y, p.z)
        aRand[idx * 4 + 1] = Math.random()
        aRand[idx * 4 + 2] = Math.random()
        aRand[idx * 4 + 3] = Math.random()
        m.setColorAt(idx, col)
        idx++
      }
    })
    hex.setAttribute('aTarget', new THREE.InstancedBufferAttribute(aTarget, 3))
    hex.setAttribute('aNormalT', new THREE.InstancedBufferAttribute(aNormal, 3))
    hex.setAttribute('aRand', new THREE.InstancedBufferAttribute(aRand, 4))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    return m
  }, [parts, count, material])

  // the swarm material is owned by the scene; only the per-instance data lives here
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame(() => {
    const r = Number.isNaN(DBG_RV) ? armorUniforms.uReveal.value : DBG_RV
    mesh.visible = r > 0.001 && r < 1.1
    if (sourceRef?.current) material.userData.uni.uSource.value.copy(sourceRef.current)
  })

  return <primitive object={mesh} />
}

function triArea(g) {
  const pos = g.attributes.position
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let s = 0
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    s += b.sub(a).cross(c.sub(a)).length() * 0.5
  }
  return s
}
