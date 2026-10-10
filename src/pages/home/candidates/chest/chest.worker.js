// Builds the armoured chest off the main thread and ships the raw vertex arrays back (transferable).
import { buildChestPayload } from './chestGeometry.js'

self.onmessage = (e) => {
  const { quality = 'high', count = 5200 } = e.data || {}
  try {
    const data = buildChestPayload(quality, count)
    const transfer = []
    for (const m of Object.values(data.meshes)) for (const k of ['position', 'normal', 'aExp', 'aSeam', 'index']) transfer.push(m[k].buffer)
    for (const v of Object.values(data.swarm)) transfer.push(v.buffer)
    self.postMessage({ ok: true, data }, transfer)
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) })
  }
}
