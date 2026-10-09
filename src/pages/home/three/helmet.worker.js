// Builds the procedural helmet off the main thread and ships the raw vertex arrays back (transferable).
import { buildHelmetGeometries } from './helmetGeometry'

self.onmessage = (e) => {
  const { quality = 1 } = e.data || {}
  try {
    const g = buildHelmetGeometries({ quality })
    const out = {}
    const transfer = []
    for (const [k, v] of Object.entries(g)) {
      if (v && v.isBufferGeometry) {
        const pos = v.attributes.position.array
        const nor = v.attributes.normal.array
        const index = v.index ? v.index.array : null
        out[k] = { pos, nor, index }
        transfer.push(pos.buffer, nor.buffer)
        if (index) transfer.push(index.buffer)
      } else if (v && v.isVector3) out[k] = v.toArray()
    }
    out.anchors = Object.fromEntries(Object.entries(g.anchors).map(([k, v]) => [k, v.toArray()]))
    self.postMessage({ ok: true, data: out }, transfer)
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}
