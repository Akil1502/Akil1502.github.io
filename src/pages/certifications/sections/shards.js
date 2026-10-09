// Deterministic "shattered glass" layout for a rectangle, in percentages of its box: radial cracks from an impact
// point, cut by two concentric rings. Returns polygons (for clip-path) plus each shard's centroid and distance from
// the impact (used to fling it outward and to order the reassembly).
function rng(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// perimeter parameter of a boundary point of [0,100]^2, clockwise from the top-left corner (screen coords, y down)
function per([x, y]) {
  if (y <= 0.0001) return x
  if (x >= 99.9999) return 100 + y
  if (y >= 99.9999) return 200 + (100 - x)
  return 300 + (100 - y)
}
const CORNERS = [
  [0, [0, 0]],
  [100, [100, 0]],
  [200, [100, 100]],
  [300, [0, 100]],
]

// where the ray from c along d leaves the box
function exitPoint(c, d) {
  let t = Infinity
  if (d[0] > 1e-6) t = Math.min(t, (100 - c[0]) / d[0])
  if (d[0] < -1e-6) t = Math.min(t, -c[0] / d[0])
  if (d[1] > 1e-6) t = Math.min(t, (100 - c[1]) / d[1])
  if (d[1] < -1e-6) t = Math.min(t, -c[1] / d[1])
  return [Math.min(100, Math.max(0, c[0] + d[0] * t)), Math.min(100, Math.max(0, c[1] + d[1] * t)), t]
}

export function makeShards({ cx = 40, cy = 46, spokes = 10, seed = 3 } = {}) {
  const r = rng(seed)
  const c = [cx, cy]
  const rays = []
  for (let k = 0; k < spokes; k++) {
    const a = ((k + 0.25 + r() * 0.5) / spokes) * Math.PI * 2
    const d = [Math.cos(a), Math.sin(a)]
    const [ox, oy, len] = exitPoint(c, d)
    const rin = Math.min(len * 0.55, 10 + r() * 8)
    const rmid = Math.min(len * 0.82, 30 + r() * 14)
    rays.push({ a, d, o: [ox, oy], i: [c[0] + d[0] * rin, c[1] + d[1] * rin], m: [c[0] + d[0] * rmid, c[1] + d[1] * rmid] })
  }
  const shards = []
  const push = (pts) => {
    const n = pts.length
    let sx = 0
    let sy = 0
    for (const p of pts) {
      sx += p[0]
      sy += p[1]
    }
    const centroid = [sx / n, sy / n]
    shards.push({
      poly: `polygon(${pts.map((p) => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`).join(', ')})`,
      points: pts,
      centroid,
      dist: Math.hypot(centroid[0] - c[0], centroid[1] - c[1]),
    })
  }
  for (let k = 0; k < spokes; k++) {
    const A = rays[k]
    const B = rays[(k + 1) % spokes]
    push([c, A.i, B.i])
    push([A.i, A.m, B.m, B.i])
    // outer piece: walk the box perimeter clockwise from A's exit to B's exit, picking up corners
    const pa = per(A.o)
    let pb = per(B.o)
    if (pb < pa) pb += 400
    const pts = [A.m, A.o]
    for (const [pc, pt] of [...CORNERS, ...CORNERS.map(([p, q]) => [p + 400, q])]) if (pc > pa && pc < pb) pts.push(pt)
    pts.push(B.o, B.m)
    push(pts)
  }
  return { shards, impact: c }
}
