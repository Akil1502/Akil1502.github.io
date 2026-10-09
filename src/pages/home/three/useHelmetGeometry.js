import { useEffect, useState } from 'react'
import * as THREE from 'three'

// Loads the helmet geometry built in a Web Worker (falls back to an idle-time main-thread build). The promise is
// cached per quality level, so StrictMode double-mounts and revisits of the page never rebuild it.
const cache = new Map()

function revive(data) {
  const out = { anchors: {} }
  for (const [k, v] of Object.entries(data)) {
    if (k === 'anchors') continue
    if (Array.isArray(v)) out[k] = new THREE.Vector3().fromArray(v)
    else if (v && v.pos) {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(v.pos, 3))
      g.setAttribute('normal', new THREE.BufferAttribute(v.nor, 3))
      if (v.index) g.setIndex(new THREE.BufferAttribute(v.index, 1))
      g.computeBoundingBox()
      g.computeBoundingSphere()
      out[k] = g
    }
  }
  for (const [k, v] of Object.entries(data.anchors)) out.anchors[k] = new THREE.Vector3().fromArray(v)
  return out
}

async function buildOnMain(quality) {
  await new Promise((r) => setTimeout(r, 60))
  const { buildHelmetGeometries } = await import('./helmetGeometry')
  return buildHelmetGeometries({ quality })
}

export function loadHelmetGeometry(quality = 1) {
  if (cache.has(quality)) return cache.get(quality)
  const p = new Promise((resolve) => {
    let worker
    try {
      worker = new Worker(new URL('./helmet.worker.js', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
    if (!worker) {
      buildOnMain(quality).then(resolve)
      return
    }
    const fail = () => {
      worker.terminate()
      buildOnMain(quality).then(resolve)
    }
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data?.ok) resolve(revive(e.data.data))
      else fail()
    }
    worker.onerror = fail
    worker.postMessage({ quality })
  })
  cache.set(quality, p)
  return p
}

export function useHelmetGeometry(quality = 1) {
  const [geo, setGeo] = useState(null)
  useEffect(() => {
    let alive = true
    loadHelmetGeometry(quality).then((g) => alive && setGeo(g))
    return () => {
      alive = false
    }
  }, [quality])
  return geo
}
