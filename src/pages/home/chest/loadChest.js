// Loads the chest geometry built in a Web Worker (falls back to an idle-time main-thread build). The promise is
// cached per quality + swarm size, so StrictMode double-mounts and revisits of the page never rebuild it. The cached
// payload is plain typed arrays: each mount wraps them in fresh BufferGeometries (and disposes those on unmount).
const cache = new Map()

async function buildOnMain(quality, count) {
  await new Promise((r) => setTimeout(r, 30))
  const { buildChestPayload } = await import('./chestGeometry.js')
  return buildChestPayload(quality, count)
}

export function loadChestData(quality, count) {
  const key = quality + ':' + count
  if (cache.has(key)) return cache.get(key)
  const p = new Promise((resolve) => {
    let worker = null
    try {
      worker = new Worker(new URL('./chest.worker.js', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
    if (!worker) {
      buildOnMain(quality, count).then(resolve)
      return
    }
    const fail = () => {
      worker.terminate()
      buildOnMain(quality, count).then(resolve)
    }
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data?.ok) resolve(e.data.data)
      else fail()
    }
    worker.onerror = fail
    worker.postMessage({ quality, count })
  })
  cache.set(key, p)
  return p
}
