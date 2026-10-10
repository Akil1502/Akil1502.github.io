// ARMOURED CHEST — procedural geometry (pure JS, no three.js objects; runs once per quality level and is cached).
//
// 1. The under-suit is a signed-distance torso (smooth union of ellipsoids/capsules: rib cage, pectorals, abdomen,
//    waist, trapezius, deltoids, neck), shrink-wrapped by a radial ray-march into one smooth mesh.
// 2. Every armour plate is drawn as a 2D outline on a *chart* (cylindrical wrap of the torso, a top-down view for the
//    collar, spherical charts for the pauldron lames), inset by half a seam gap, then lifted off the surface with a
//    bevel profile computed from the true 3D distance to the plate edge: crisp chamfered rim + gentle crown, a side
//    wall diving into the body and (for free-standing shells) a back face.
// 3. Turned parts (reactor bezel, gorget rings) are lathes.
// Every vertex carries aExp (xyz = exploded-view offset, w = breathing phase); the shader moves it (one draw call per
// material, no per-part transforms).
import { REACTOR_D as REACTOR, SCALE, chestDelay } from './chestField.js'

const ZA = -0.53 // torso axis depth (stage units): keeps the reactor socket close to the stage origin's z
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// ------------------------------------------------------------------------------------------------ body field
function ell(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = (px - cx) / rx
  const y = (py - cy) / ry
  const z = (pz - cz) / rz
  const k0 = Math.sqrt(x * x + y * y + z * z)
  const k1 = Math.sqrt((x * x) / (rx * rx) + (y * y) / (ry * ry) + (z * z) / (rz * rz))
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}
function cap(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax
  const pay = py - ay
  const paz = pz - az
  const bax = bx - ax
  const bay = by - ay
  const baz = bz - az
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1)
  const dx = pax - bax * h
  const dy = pay - bay * h
  const dz = paz - baz * h
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
}
// capsule whose radius blends from ra (at a) to rb (at b)
function taper(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = px - ax
  const pay = py - ay
  const paz = pz - az
  const bax = bx - ax
  const bay = by - ay
  const baz = bz - az
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1)
  const dx = pax - bax * h
  const dy = pay - bay * h
  const dz = paz - baz * h
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * h)
}
function sph(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx
  const dy = py - cy
  const dz = pz - cz
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r
}
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export const Y_BOT = -1.17
export const Y_TOP = 0.93
// upper arm: shoulder → mid-bicep, cut square to its axis
export const ARM_A = [0.9, 0.6, ZA]
export const ARM_B = [1.036, -0.188, ZA + 0.04]
export const ARM_R = 0.15
const ARM_D = (() => {
  const d = [ARM_B[0] - ARM_A[0], ARM_B[1] - ARM_A[1], ARM_B[2] - ARM_A[2]]
  const l = Math.hypot(d[0], d[1], d[2])
  return [d[0] / l, d[1] / l, d[2] / l, l]
})()
export const ARM_CUT = 0.63 // distance along the arm axis
const CUT = [ARM_A[0] + ARM_D[0] * ARM_CUT, ARM_A[1] + ARM_D[1] * ARM_CUT, ARM_A[2] + ARM_D[2] * ARM_CUT]
const R_CUT = ARM_R + 0.018 - 0.04 * (ARM_CUT / ARM_D[3]) // arm radius at the cut

// torso without the shoulder balls and arms: what the cylindrical torso chart wraps (flank plates must not climb
// onto the arms)
export function sdTorso(x, y, z) {
  const ax = Math.abs(x)
  let d = ell(ax, y, z, 0, 0.26, ZA + 0.03, 0.72, 0.64, 0.43)
  const pec = smin(ell(x, y, z, 0.33, 0.35, ZA + 0.27, 0.37, 0.28, 0.32), ell(x, y, z, -0.33, 0.35, ZA + 0.27, 0.37, 0.28, 0.32), 0.1)
  d = smin(d, pec, 0.12)
  d = smin(d, ell(ax, y, z, 0, -0.5, ZA + 0.07, 0.5, 0.66, 0.38), 0.18)
  d = smin(d, ell(ax, y, z, 0, -1.02, ZA + 0.03, 0.445, 0.4, 0.33), 0.15)
  d = smin(d, cap(ax, y, z, 0.16, 0.86, ZA - 0.02, 0.74, 0.74, ZA, 0.16), 0.14)
  return Math.max(d, Y_BOT - y, y - Y_TOP)
}

export function sdBody(x, y, z) {
  const ax = Math.abs(x)
  let d = ell(ax, y, z, 0, 0.26, ZA + 0.03, 0.72, 0.64, 0.43) // rib cage
  const pec = smin(ell(x, y, z, 0.33, 0.35, ZA + 0.27, 0.37, 0.28, 0.32), ell(x, y, z, -0.33, 0.35, ZA + 0.27, 0.37, 0.28, 0.32), 0.1)
  d = smin(d, pec, 0.12)
  d = smin(d, ell(ax, y, z, 0, -0.5, ZA + 0.07, 0.5, 0.66, 0.38), 0.18) // abdomen
  d = smin(d, ell(ax, y, z, 0, -1.02, ZA + 0.03, 0.445, 0.4, 0.33), 0.15) // waist
  d = smin(d, cap(ax, y, z, 0.16, 0.86, ZA - 0.02, 0.74, 0.74, ZA, 0.16), 0.14) // trapezius
  d = smin(d, sph(ax, y, z, 0.88, 0.62, ZA, 0.225), 0.1) // deltoid
  const arm = Math.max(taper(ax, y, z, ARM_A[0], ARM_A[1], ARM_A[2], ARM_B[0], ARM_B[1], ARM_B[2], ARM_R + 0.018, ARM_R - 0.022), (ax - CUT[0]) * ARM_D[0] + (y - CUT[1]) * ARM_D[1] + (z - CUT[2]) * ARM_D[2])
  d = smin(d, arm, 0.05)
  d = smin(d, cap(ax, y, z, 0, 0.72, ZA - 0.02, 0, 1.16, ZA - 0.04, 0.19), 0.1) // neck
  return Math.max(d, Y_BOT - y, y - Y_TOP)
}

function gradient(x, y, z, out, sd = sdBody) {
  const e = 0.0015
  // tetrahedral 4-tap gradient
  const a = sd(x + e, y - e, z - e)
  const b = sd(x - e, y - e, z + e)
  const c = sd(x - e, y + e, z - e)
  const d = sd(x + e, y + e, z + e)
  let nx = a - b - c + d
  let ny = -a - b + c + d
  let nz = -a + b - c + d
  const l = Math.hypot(nx, ny, nz) || 1
  out[0] = nx / l
  out[1] = ny / l
  out[2] = nz / l
  return out
}

// march from o along unit d until the surface; returns t or -1
function march(ox, oy, oz, dx, dy, dz, tMax, sd = sdBody) {
  let t = 0
  for (let i = 0; i < 140; i++) {
    const s = sd(ox + dx * t, oy + dy * t, oz + dz * t)
    if (s < 1.5e-4) return t
    t += Math.max(s * 0.9, 2e-4)
    if (t > tMax) return -1
  }
  return t
}

// nearest surface point (fallback for rays that miss)
const _g = [0, 0, 0]
function projectToSurface(p, sd = sdBody) {
  for (let i = 0; i < 8; i++) {
    const s = sd(p[0], p[1], p[2])
    gradient(p[0], p[1], p[2], _g, sd)
    p[0] -= _g[0] * s
    p[1] -= _g[1] * s
    p[2] -= _g[2] * s
    if (Math.abs(s) < 1e-4) break
  }
  return p
}

// ------------------------------------------------------------------------------------------------ charts
// A chart maps 2D (u, v) to a surface point P and outward normal N (arrays), and back (inv).
const RM = 0.6 // cylindrical chart: u = θ · RM
function cylChart(mirror = false) {
  const s = mirror ? -1 : 1
  return {
    at(u, v, P, N) {
      const th = (s * u) / RM
      const dx = Math.sin(th)
      const dz = Math.cos(th)
      const R = 1.6
      const t = march(dx * R, v, ZA + dz * R, -dx, 0, -dz, R, sdTorso)
      if (t < 0) {
        P[0] = dx * 0.3
        P[1] = v
        P[2] = ZA + dz * 0.3
        projectToSurface(P, sdTorso)
      } else {
        P[0] = dx * (R - t)
        P[1] = v
        P[2] = ZA + dz * (R - t)
      }
      gradient(P[0], P[1], P[2], N, sdTorso)
    },
    inv(P) {
      return [s * Math.atan2(P[0], P[2] - ZA) * RM, P[1]]
    },
  }
}
// top-down projection (collar / trapezius): u = x, v = -z
function topChart(mirror = false) {
  const s = mirror ? -1 : 1
  return {
    at(u, v, P, N) {
      const x = s * u
      const z = -v
      const t = march(x, 1.6, z, 0, -1, 0, 3)
      P[0] = x
      P[2] = z
      P[1] = t < 0 ? 0.6 : 1.6 - t
      if (t < 0) projectToSurface(P)
      gradient(P[0], P[1], P[2], N)
    },
    inv(P) {
      return [s * P[0], -P[2]]
    },
  }
}
// cylinder around the upper-arm axis: u = θ·ARM_R (θ = 0 faces outwards, + towards the front), v = distance along
// the axis from the shoulder joint
function armChart(mirror = false) {
  const s = mirror ? -1 : 1
  const A = [s * ARM_A[0], ARM_A[1], ARM_A[2]]
  const D = [s * ARM_D[0], ARM_D[1], ARM_D[2]]
  let b1 = [s, 0, 0]
  const dp = dot(b1, D)
  b1 = norm([b1[0] - D[0] * dp, b1[1] - D[1] * dp, b1[2] - D[2] * dp])
  let b2 = cross(D, b1)
  if (b2[2] < 0) b2 = [-b2[0], -b2[1], -b2[2]]
  return {
    at(u, v, P, N) {
      const th = u / ARM_R
      const rd = [b1[0] * Math.cos(th) + b2[0] * Math.sin(th), b1[1] * Math.cos(th) + b2[1] * Math.sin(th), b1[2] * Math.cos(th) + b2[2] * Math.sin(th)]
      const o = [A[0] + D[0] * v + rd[0] * 0.5, A[1] + D[1] * v + rd[1] * 0.5, A[2] + D[2] * v + rd[2] * 0.5]
      const t = march(o[0], o[1], o[2], -rd[0], -rd[1], -rd[2], 0.5)
      const tt = t < 0 ? 0.5 - ARM_R : t
      P[0] = o[0] - rd[0] * tt
      P[1] = o[1] - rd[1] * tt
      P[2] = o[2] - rd[2] * tt
      gradient(P[0], P[1], P[2], N)
    },
    frame: { A, D, b1, b2 },
  }
}

// front projection: u = x, v = y (used only to convert design points)
function frontPoint(x, y) {
  const t = march(x, y, 1.2, 0, 0, -1, 3)
  const P = [x, y, t < 0 ? 0 : 1.2 - t]
  if (t < 0) projectToSurface(P)
  return P
}
// spherical shell chart for pauldron lames: axis A, zero-azimuth B1; 'polar' (cap: azimuthal-equidistant) or
// 'band' (u = α·r·sinβref, v = β·r). r(β) may flare outwards.
function sphereChart({ C, A, B1, r, flare = 0, polar = false, betaRef = 1, mirror = false }) {
  const s = mirror ? -1 : 1
  const c = [s * C[0], C[1], C[2]]
  const a = norm([s * A[0], A[1], A[2]])
  let b1 = [s * B1[0], B1[1], B1[2]]
  const dp = dot(b1, a)
  b1 = norm([b1[0] - a[0] * dp, b1[1] - a[1] * dp, b1[2] - a[2] * dp])
  // keep the chart right-handed on both sides so the plate winding test stays meaningful
  const b2 = mirror ? cross(b1, a) : cross(a, b1)
  const sr = Math.sin(betaRef)
  const ab = (u, v) => {
    if (polar) {
      const rho = Math.hypot(u, v)
      return [Math.atan2(v, u), rho / r]
    }
    return [u / (r * sr), v / r]
  }
  const pt = (al, be, out) => {
    const rr = r + flare * be * be
    const sb = Math.sin(be)
    const dx = b1[0] * sb * Math.cos(al) + b2[0] * sb * Math.sin(al) + a[0] * Math.cos(be)
    const dy = b1[1] * sb * Math.cos(al) + b2[1] * sb * Math.sin(al) + a[1] * Math.cos(be)
    const dz = b1[2] * sb * Math.cos(al) + b2[2] * sb * Math.sin(al) + a[2] * Math.cos(be)
    out[0] = c[0] + dx * rr
    out[1] = c[1] + dy * rr
    out[2] = c[2] + dz * rr
    return out
  }
  const t0 = [0, 0, 0]
  const t1 = [0, 0, 0]
  const t2 = [0, 0, 0]
  return {
    at(u, v, P, N) {
      const [al, be] = ab(u, v)
      pt(al, be, P)
      // normal by finite differences in (α, β); fall back to radial at the pole
      const e = 1e-3
      pt(al + e, be, t1)
      pt(al, be + e, t2)
      pt(al, be, t0)
      let n = cross(sub(t1, t0), sub(t2, t0))
      const rad = norm(sub(P, c))
      if (Math.hypot(n[0], n[1], n[2]) < 1e-12 || be < 0.02) n = rad
      n = norm(n)
      if (dot(n, rad) < 0) n = [-n[0], -n[1], -n[2]]
      N[0] = n[0]
      N[1] = n[1]
      N[2] = n[2]
    },
  }
}

// ------------------------------------------------------------------------------------------------ small vec helpers
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

// ------------------------------------------------------------------------------------------------ 2D outline tools
// pts: [[u, v, radius?], ...] (closed). Rounds every corner with its radius, returns a dense polyline.
function roundPoly(pts, defR) {
  const out = []
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const a = pts[(i + n - 1) % n]
    const b = pts[(i + 1) % n]
    const r = p[2] ?? defR
    const e1 = [a[0] - p[0], a[1] - p[1]]
    const e2 = [b[0] - p[0], b[1] - p[1]]
    const l1 = Math.hypot(e1[0], e1[1])
    const l2 = Math.hypot(e2[0], e2[1])
    if (r <= 0 || l1 < 1e-6 || l2 < 1e-6) {
      out.push([p[0], p[1]])
      continue
    }
    e1[0] /= l1
    e1[1] /= l1
    e2[0] /= l2
    e2[1] /= l2
    const cosA = clamp(e1[0] * e2[0] + e1[1] * e2[1], -1, 1)
    const ang = Math.acos(cosA)
    if (ang > Math.PI - 0.05) {
      out.push([p[0], p[1]])
      continue
    }
    const half = ang / 2
    let t = r / Math.tan(half)
    const tMax = 0.45 * Math.min(l1, l2)
    let rr = r
    if (t > tMax) {
      t = tMax
      rr = t * Math.tan(half)
    }
    const s0 = [p[0] + e1[0] * t, p[1] + e1[1] * t]
    const s1 = [p[0] + e2[0] * t, p[1] + e2[1] * t]
    const bis = [e1[0] + e2[0], e1[1] + e2[1]]
    const bl = Math.hypot(bis[0], bis[1])
    const cd = rr / Math.sin(half)
    const c = [p[0] + (bis[0] / bl) * cd, p[1] + (bis[1] / bl) * cd]
    let a0 = Math.atan2(s0[1] - c[1], s0[0] - c[0])
    let a1 = Math.atan2(s1[1] - c[1], s1[0] - c[0])
    let da = a1 - a0
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    const steps = Math.max(2, Math.ceil(Math.abs(da) / 0.2))
    for (let k = 0; k <= steps; k++) {
      const aa = a0 + (da * k) / steps
      out.push([c[0] + Math.cos(aa) * rr, c[1] + Math.sin(aa) * rr])
    }
  }
  return out
}

function resample(poly, spacing, minN = 40, maxN = 260) {
  const n = poly.length
  const cum = [0]
  for (let i = 1; i <= n; i++) {
    const a = poly[i - 1]
    const b = poly[i % n]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const L = cum[n]
  const N = clamp(Math.round(L / spacing), minN, maxN)
  const out = []
  let j = 0
  for (let k = 0; k < N; k++) {
    const s = (k / N) * L
    while (cum[j + 1] < s) j++
    const a = poly[j]
    const b = poly[(j + 1) % n]
    const f = (s - cum[j]) / Math.max(1e-9, cum[j + 1] - cum[j])
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
  }
  return out
}

function signedArea(p) {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

// inward unit normals of a CCW closed polyline (smoothed over neighbours)
function inwardNormals(p) {
  const n = p.length
  const out = []
  for (let i = 0; i < n; i++) {
    const a = p[(i + n - 1) % n]
    const b = p[(i + 1) % n]
    const tx = b[0] - a[0]
    const ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    out.push([-ty / l, tx / l])
  }
  return out
}

function centroid(p) {
  let A = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < p.length; i++) {
    const a = p[i]
    const b = p[(i + 1) % p.length]
    const c = a[0] * b[1] - b[0] * a[1]
    A += c
    cx += (a[0] + b[0]) * c
    cy += (a[1] + b[1]) * c
  }
  A *= 0.5
  return [cx / (6 * A), cy / (6 * A)]
}

// ------------------------------------------------------------------------------------------------ mesh accumulator
class Mesh {
  constructor() {
    this.pos = []
    this.nrm = []
    this.exp = []
    this.seam = []
    this.idx = []
    this.n = 0
  }
  add(P, N, e, seam = 0) {
    this.pos.push(P[0], P[1], P[2])
    this.nrm.push(N[0], N[1], N[2])
    this.exp.push(e[0], e[1], e[2], e[3])
    this.seam.push(seam)
    return this.n++
  }
  tri(a, b, c) {
    this.idx.push(a, b, c)
  }
}

// computes smooth vertex normals for a set of triangles (indices into m), writing into m.nrm
function smoothNormals(m, i0, i1, v0, v1) {
  const acc = new Float64Array((v1 - v0) * 3)
  const P = m.pos
  for (let t = i0; t < i1; t += 3) {
    const a = m.idx[t]
    const b = m.idx[t + 1]
    const c = m.idx[t + 2]
    const ux = P[b * 3] - P[a * 3]
    const uy = P[b * 3 + 1] - P[a * 3 + 1]
    const uz = P[b * 3 + 2] - P[a * 3 + 2]
    const vx = P[c * 3] - P[a * 3]
    const vy = P[c * 3 + 1] - P[a * 3 + 1]
    const vz = P[c * 3 + 2] - P[a * 3 + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const k of [a, b, c]) {
      const o = (k - v0) * 3
      acc[o] += nx
      acc[o + 1] += ny
      acc[o + 2] += nz
    }
  }
  for (let k = v0; k < v1; k++) {
    const o = (k - v0) * 3
    const l = Math.hypot(acc[o], acc[o + 1], acc[o + 2])
    if (l > 1e-12) {
      m.nrm[k * 3] = acc[o] / l
      m.nrm[k * 3 + 1] = acc[o + 1] / l
      m.nrm[k * 3 + 2] = acc[o + 2] / l
    }
  }
}

// flips the winding of triangles [i0, i1) if their geometric normal disagrees with the reference normals
function orient(m, i0, i1) {
  let score = 0
  const P = m.pos
  const Nn = m.nrm
  for (let t = i0; t < i1; t += 3 * 7) {
    const a = m.idx[t]
    const b = m.idx[t + 1]
    const c = m.idx[t + 2]
    const ux = P[b * 3] - P[a * 3]
    const uy = P[b * 3 + 1] - P[a * 3 + 1]
    const uz = P[b * 3 + 2] - P[a * 3 + 2]
    const vx = P[c * 3] - P[a * 3]
    const vy = P[c * 3 + 1] - P[a * 3 + 1]
    const vz = P[c * 3 + 2] - P[a * 3 + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    score += nx * Nn[a * 3] + ny * Nn[a * 3 + 1] + nz * Nn[a * 3 + 2]
  }
  if (score < 0) {
    for (let t = i0; t < i1; t += 3) {
      const tmp = m.idx[t + 1]
      m.idx[t + 1] = m.idx[t + 2]
      m.idx[t + 2] = tmp
    }
  }
}

// ------------------------------------------------------------------------------------------------ the plate builder
// Machined plate profile over the distance e from the plate edge:
//   rounded rim (h0 → T over `bevel`) · chamfer band (rises `cham[1]` over `cham[0]`, ends in a crisp crease) ·
//   plateau with an optional soft crown.
const BEVEL_F = [0, 0.12, 0.3, 0.52, 0.76, 1.0]
function profile(e, o) {
  const [cw, ch] = o.cham
  if (e <= o.bevel) {
    const b = e / o.bevel
    return o.lift + o.h0 + (o.T - o.h0) * (1 - Math.pow(1 - b, 2.4))
  }
  if (cw > 0 && e <= o.bevel + cw) return o.lift + o.T + (ch * (e - o.bevel)) / cw
  const x = Math.max(0, e - o.bevel - cw)
  return o.lift + o.T + ch + o.crown * (1 - Math.exp(-x / o.crownW))
}
function ringOffsets(o) {
  const out = BEVEL_F.map((f) => f * o.bevel)
  const [cw] = o.cham
  const b = o.bevel
  if (cw > 0) out.push(b + cw * 0.34, b + cw * 0.68, b + cw, b + cw + 0.0025, b + cw + 0.012, b + cw + 0.03)
  else out.push(b + 0.008, b + 0.024)
  return out
}

// Builds one plate into mesh m. Returns { centroid: [x,y,z], area }
function plate(m, chart, outline, opt, Q) {
  const o = {
    gap: 0.018,
    T: 0.034,
    h0: 0.011,
    bevel: 0.017,
    crown: 0.006,
    crownW: 0.12,
    cham: [0.034, 0.011],
    wall: 0.03,
    lift: 0,
    radius: 0.04,
    back: false,
    seam: 1,
    exp: [0, 0, 0],
    phase: Math.random(),
    J: 8,
    ...opt,
  }
  // outline → chart 2D
  let pts = outline.map((p) => {
    if (p.P) {
      const uv = chart.inv(p.P)
      return [uv[0], uv[1], p.r]
    }
    return p
  })
  let poly = roundPoly(pts, o.radius)
  poly = resample(poly, Q.spacing, Q.minN, Q.maxN)
  if (signedArea(poly) < 0) poly.reverse()
  // inset by half the seam gap
  let nrm = inwardNormals(poly)
  const ring0 = poly.map((p, i) => [p[0] + nrm[i][0] * o.gap * 0.5, p[1] + nrm[i][1] * o.gap * 0.5])
  nrm = inwardNormals(ring0)
  // limit bevel ring offsets by the plate's size
  const c2 = centroid(ring0)
  let minR = Infinity
  for (const p of ring0) minR = Math.min(minR, Math.hypot(p[0] - c2[0], p[1] - c2[1]))
  const offs = ringOffsets(o).filter((e) => e < minR * 0.6)
  const rings2 = offs.map((e) => ring0.map((p, i) => [p[0] + nrm[i][0] * e, p[1] + nrm[i][1] * e]))
  const last = rings2[rings2.length - 1]
  const cc = centroid(last)
  const J = Q.J ?? o.J
  for (let j = 1; j < J; j++) {
    const f = 1 - j / J
    rings2.push(last.map((p) => [cc[0] + (p[0] - cc[0]) * f, cc[1] + (p[1] - cc[1]) * f]))
  }
  const N = ring0.length
  const R = rings2.length
  // surface samples
  const SP = []
  const SN = []
  for (let r = 0; r < R; r++) {
    const rp = []
    const rn = []
    for (let i = 0; i < N; i++) {
      const P = [0, 0, 0]
      const Nn = [0, 0, 0]
      chart.at(rings2[r][i][0], rings2[r][i][1], P, Nn)
      rp.push(P)
      rn.push(Nn)
    }
    SP.push(rp)
    SN.push(rn)
  }
  const cP = [0, 0, 0]
  const cN = [0, 0, 0]
  chart.at(cc[0], cc[1], cP, cN)
  if (o.explode) o.exp = radial(cP, o.explode[0], o.explode[1] ?? 0.25, o.explode[2])
  // distance from the 3D edge
  const edge = SP[0]
  const distEdge = (P) => {
    let best = Infinity
    for (let i = 0; i < N; i += 3) {
      const a = edge[i]
      const b = edge[(i + 3) % N]
      const abx = b[0] - a[0]
      const aby = b[1] - a[1]
      const abz = b[2] - a[2]
      const t = clamp(((P[0] - a[0]) * abx + (P[1] - a[1]) * aby + (P[2] - a[2]) * abz) / (abx * abx + aby * aby + abz * abz || 1), 0, 1)
      const dx = P[0] - a[0] - abx * t
      const dy = P[1] - a[1] - aby * t
      const dz = P[2] - a[2] - abz * t
      const d = dx * dx + dy * dy + dz * dz
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }
  const e4 = [o.exp[0], o.exp[1], o.exp[2], o.phase]
  // ---- top surface
  const v0 = m.n
  const i0 = m.idx.length
  for (let r = 0; r < R; r++) {
    for (let i = 0; i < N; i++) {
      const P = SP[r][i]
      const Nn = SN[r][i]
      const e = r < offs.length ? offs[r] : Math.max(offs[offs.length - 1], distEdge(P))
      const h = profile(e, o)
      m.add([P[0] + Nn[0] * h, P[1] + Nn[1] * h, P[2] + Nn[2] * h], Nn, e4)
    }
  }
  const hc = profile(Math.max(offs[offs.length - 1], distEdge(cP)), o)
  const vc = m.add([cP[0] + cN[0] * hc, cP[1] + cN[1] * hc, cP[2] + cN[2] * hc], cN, e4)
  for (let r = 0; r < R - 1; r++) {
    for (let i = 0; i < N; i++) {
      const a = v0 + r * N + i
      const b = v0 + r * N + ((i + 1) % N)
      const c = v0 + (r + 1) * N + i
      const d = v0 + (r + 1) * N + ((i + 1) % N)
      m.tri(a, b, d)
      m.tri(a, d, c)
    }
  }
  for (let i = 0; i < N; i++) m.tri(v0 + (R - 1) * N + i, v0 + (R - 1) * N + ((i + 1) % N), vc)
  orient(m, i0, m.idx.length)
  smoothNormals(m, i0, m.idx.length, v0, m.n)
  const topEnd = m.idx.length
  // ---- side wall (own vertices → crisp edge)
  const w0 = m.n
  const iw = m.idx.length
  const h0 = profile(0, o)
  for (let i = 0; i < N; i++) {
    const P = SP[0][i]
    const Nn = SN[0][i]
    // outward in-surface direction: from ring 1 towards ring 0
    const Q1 = SP[Math.min(1, R - 1)][i]
    const out = norm(sub(P, Q1))
    m.add([P[0] + Nn[0] * h0, P[1] + Nn[1] * h0, P[2] + Nn[2] * h0], out, e4, o.seam)
    const hb = o.lift - o.wall
    m.add([P[0] + Nn[0] * hb, P[1] + Nn[1] * hb, P[2] + Nn[2] * hb], out, e4, o.seam)
  }
  for (let i = 0; i < N; i++) {
    const a = w0 + i * 2
    const b = w0 + ((i + 1) % N) * 2
    m.tri(a, b, b + 1)
    m.tri(a, b + 1, a + 1)
  }
  orient(m, iw, m.idx.length)
  smoothNormals(m, iw, m.idx.length, w0, m.n)
  // ---- back face (free-standing shells)
  if (o.back) {
    const b0 = m.n
    const ib = m.idx.length
    const hb = o.lift - o.wall
    for (let r = 0; r < R; r++)
      for (let i = 0; i < N; i++) {
        const P = SP[r][i]
        const Nn = SN[r][i]
        m.add([P[0] + Nn[0] * hb, P[1] + Nn[1] * hb, P[2] + Nn[2] * hb], [-Nn[0], -Nn[1], -Nn[2]], e4)
      }
    const bc = m.add([cP[0] + cN[0] * hb, cP[1] + cN[1] * hb, cP[2] + cN[2] * hb], [-cN[0], -cN[1], -cN[2]], e4)
    for (let r = 0; r < R - 1; r++)
      for (let i = 0; i < N; i++) {
        const a = b0 + r * N + i
        const b = b0 + r * N + ((i + 1) % N)
        const c = b0 + (r + 1) * N + i
        const d = b0 + (r + 1) * N + ((i + 1) % N)
        m.tri(a, b, d)
        m.tri(a, d, c)
      }
    for (let i = 0; i < N; i++) m.tri(b0 + (R - 1) * N + i, b0 + (R - 1) * N + ((i + 1) % N), bc)
    orient(m, ib, m.idx.length)
  }
  // nanite sampling only uses the top surface
  m.top = m.top || []
  m.top.push([i0, topEnd])
  return { centroid: [cP[0] + cN[0] * hc, cP[1] + cN[1] * hc, cP[2] + cN[2] * hc] }
}

// lathe around an arbitrary axis: profile [[r, h], ...] (open polyline), axis frame (C, A, B1)
function lathe(m, prof, C, A, segs, exp, phase, { a0 = 0, a1 = Math.PI * 2, smoothAll = false } = {}) {
  const a = norm(A)
  let b1 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const dp = dot(b1, a)
  b1 = norm([b1[0] - a[0] * dp, b1[1] - a[1] * dp, b1[2] - a[2] * dp])
  const b2 = cross(a, b1)
  const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6
  const S = full ? segs : segs + 1
  const e4 = [exp[0], exp[1], exp[2], phase]
  // split the profile into segments with their own normals (hard edges between profile segments unless smoothAll)
  const v0 = m.n
  const i0 = m.idx.length
  const segsP = []
  for (let k = 0; k < prof.length - 1; k++) segsP.push([prof[k], prof[k + 1]])
  for (const [p, q] of segsP) {
    const base = m.n
    // 2D normal of the profile segment (r, h) → outward
    const tr = q[0] - p[0]
    const th = q[1] - p[1]
    const l = Math.hypot(tr, th) || 1
    const nr = th / l
    const nh = -tr / l
    for (let s = 0; s < S; s++) {
      const ang = a0 + ((a1 - a0) * s) / segs
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      const rd = [b1[0] * ca + b2[0] * sa, b1[1] * ca + b2[1] * sa, b1[2] * ca + b2[2] * sa]
      for (const [pp, w] of [
        [p, 0],
        [q, 1],
      ]) {
        void w
        const P = [C[0] + rd[0] * pp[0] + a[0] * pp[1], C[1] + rd[1] * pp[0] + a[1] * pp[1], C[2] + rd[2] * pp[0] + a[2] * pp[1]]
        const Nn = [rd[0] * nr + a[0] * nh, rd[1] * nr + a[1] * nh, rd[2] * nr + a[2] * nh]
        m.add(P, Nn, e4)
      }
    }
    for (let s = 0; s < segs; s++) {
      const i = base + s * 2
      const j = base + ((s + 1) % S) * 2
      m.tri(i, j, j + 1)
      m.tri(i, j + 1, i + 1)
    }
  }
  orient(m, i0, m.idx.length)
  if (smoothAll) smoothNormals(m, i0, m.idx.length, v0, m.n)
}

// ------------------------------------------------------------------------------------------------ under-suit body
function buildBody(m, Q) {
  const C = [0, 0.05, ZA]
  const NU = Q.bodyU
  const NV = Q.bodyV
  const v0 = m.n
  const e4 = [0, 0, 0, 0]
  const P = [0, 0, 0]
  const Nn = [0, 0, 0]
  for (let j = 0; j <= NV; j++) {
    const phi = -Math.PI / 2 + (Math.PI * j) / NV
    for (let i = 0; i < NU; i++) {
      const th = (Math.PI * 2 * i) / NU
      const dx = Math.cos(phi) * Math.sin(th)
      const dy = Math.sin(phi)
      const dz = Math.cos(phi) * Math.cos(th)
      const R = 2.2
      const t = march(C[0] + dx * R, C[1] + dy * R, C[2] + dz * R, -dx, -dy, -dz, R)
      const d = t < 0 ? 0.2 : R - t
      P[0] = C[0] + dx * d
      P[1] = C[1] + dy * d
      P[2] = C[2] + dz * d
      gradient(P[0], P[1], P[2], Nn)
      // the cut planes: flat normals
      if (P[1] <= Y_BOT + 0.002) Nn.splice(0, 3, 0, -1, 0)
      if (P[1] >= Y_TOP - 0.002) Nn.splice(0, 3, 0, 1, 0)
      m.add(P, Nn, e4)
    }
  }
  const i0 = m.idx.length
  for (let j = 0; j < NV; j++)
    for (let i = 0; i < NU; i++) {
      const a = v0 + j * NU + i
      const b = v0 + j * NU + ((i + 1) % NU)
      const c = a + NU
      const d = b + NU
      m.tri(a, b, d)
      m.tri(a, d, c)
    }
  orient(m, i0, m.idx.length)
}

// ------------------------------------------------------------------------------------------------ the design
// Design points are given in FRONT view coordinates (x, y) and dropped onto the body: F(x, y) → surface point.
const F = (x, y, r) => ({ P: frontPoint(x, y), r })
const RB = 0.35 // bezel outer radius (plates start here)
const BZ = (deg, r) => {
  const a = (deg * Math.PI) / 180
  return F(REACTOR[0] + Math.cos(a) * (RB + 0.004), REACTOR[1] + Math.sin(a) * (RB + 0.004), r ?? 0)
}
const arc = (d0, d1, step = 12) => {
  const out = []
  const n = Math.max(1, Math.round(Math.abs(d1 - d0) / step))
  for (let k = 0; k <= n; k++) out.push(BZ(d0 + ((d1 - d0) * k) / n))
  return out
}
const mirrorF = (list) => list.map((p) => (p.P ? { P: [-p.P[0], p.P[1], p.P[2]], r: p.r } : p))
// explode offset: radially away from the reactor (+ a little towards the viewer)
function radial(c, amt, fwd = 0.25, extra = [0, 0, 0]) {
  const d = norm([c[0] - REACTOR[0], (c[1] - REACTOR[1]) * 1.0, (c[2] - REACTOR[2]) * 0.5 + 0.02])
  return [d[0] * amt + extra[0], d[1] * amt + extra[1], d[2] * amt + fwd * amt + extra[2]]
}
function centre3(list) {
  let x = 0
  let y = 0
  let z = 0
  for (const p of list) {
    x += p.P[0]
    y += p.P[1]
    z += p.P[2]
  }
  return [x / list.length, y / list.length, z / list.length]
}

export function buildChest(quality = 'high') {
  const Q =
    quality === 'low'
      ? { spacing: 0.024, minN: 28, maxN: 120, J: 5, bodyU: 96, bodyV: 72, lathe: 64 }
      : { spacing: 0.015, minN: 40, maxN: 220, J: 7, bodyU: 168, bodyV: 124, lathe: 120 }
  const M = { red: new Mesh(), gold: new Mesh(), gun: new Mesh(), chrome: new Mesh(), under: new Mesh(), glow: new Mesh() }
  const anchors = {}
  const cyl = [cylChart(false), cylChart(true)]
  const top = [topChart(false), topChart(true)]
  const sides = [0, 1]
  // plate on both sides: outline given for the +x side
  const pair = (mat, list, opt, chartPair = cyl, explodeAmt = 0.3, fwd = 0.25) => {
    const res = []
    for (const s of sides) {
      const ol = s ? mirrorF(list) : list
      res.push(plate(M[mat], chartPair[s], ol, { explode: [explodeAmt, fwd], ...opt }, Q))
    }
    return res
  }
  const single = (mat, list, opt, chart = cyl[0], explodeAmt = 0.3, fwd = 0.25) => plate(M[mat], chart, list, { explode: [explodeAmt, fwd], ...opt }, Q)

  // ---- pectorals (red): bezel arc → collar line → armpit → under-pec sweep
  const pecPts = [
    BZ(78, 0.012),
    F(0.135, 0.735, 0.03),
    F(0.36, 0.715, 0.08),
    F(0.55, 0.62, 0.07),
    F(0.625, 0.44, 0.07),
    F(0.615, 0.2, 0.08),
    F(0.5, 0.055, 0.1),
    F(0.335, 0.0, 0.03),
    BZ(-48, 0.012),
    ...arc(-48, 78).slice(1, -1),
  ]
  pair('red', pecPts, { T: 0.04, cham: [0.042, 0.014], crown: 0.012, crownW: 0.16 }, cyl, 0.34)

  // ---- sternum keel (gold) under the reactor, pointing down
  const keel = [...arc(-132, -48), F(0.335, 0.0, 0.03), F(0.235, -0.165, 0.05), F(0.0, -0.31, 0.04), F(-0.235, -0.165, 0.05), F(-0.335, 0.0, 0.03)]
  single('gold', keel, { T: 0.036, crown: 0.012, crownW: 0.1 }, cyl[0], 0.32)
  // ---- upper sternum (gold) between the pecs above the bezel
  const ust = [...arc(78, 102), F(-0.135, 0.735, 0.03), F(0, 0.775, 0.04), F(0.135, 0.735, 0.03)]
  single('gold', ust, { T: 0.03, crown: 0.006 }, cyl[0], 0.3)

  // ---- rib slats (gunmetal) under the pecs
  pair('gun', [F(0.335, 0.0, 0.02), F(0.5, 0.055, 0.06), F(0.615, 0.2, 0.03), F(0.64, 0.06, 0.04), F(0.55, -0.055, 0.05), F(0.297, -0.07, 0.02)], { T: 0.03, crown: 0.008 }, cyl, 0.4)
  pair('gun', [F(0.297, -0.07, 0.02), F(0.55, -0.055, 0.04), F(0.64, 0.06, 0.03), F(0.62, -0.1, 0.04), F(0.5, -0.2, 0.05), F(0.235, -0.165, 0.02)], { T: 0.028, crown: 0.008 }, cyl, 0.44)

  // ---- abdominals (gold): four chevron bands that echo the keel's V
  const absEdge = [
    [0.355, -0.215],
    [0.35, -0.4],
    [0.34, -0.565],
    [0.325, -0.73],
    [0.29, -0.955],
  ]
  const absMid = [-0.31, -0.48, -0.645, -0.81, -0.955]
  for (let k = 0; k < 4; k++) {
    const [ex0, ey0] = absEdge[k]
    const [ex1, ey1] = absEdge[k + 1]
    const topE =
      k === 0
        ? [F(-ex0, ey0, 0.03), F(-0.235, -0.165, 0.02), F(0, absMid[0], 0.03), F(0.235, -0.165, 0.02), F(ex0, ey0, 0.03)]
        : [F(-ex0, ey0, 0.03), F(0, absMid[k], 0.04), F(ex0, ey0, 0.03)]
    const botE = k === 3 ? [F(ex1, ey1, 0.04), F(-ex1, ey1, 0.04)] : [F(ex1, ey1, 0.03), F(0, absMid[k + 1], 0.04), F(-ex1, ey1, 0.03)]
    single('gold', [...topE, ...botE], { T: 0.036, crown: 0.012, crownW: 0.08, bevel: 0.015 }, cyl[0], 0.34 + k * 0.05, 0.45)
  }

  // ---- obliques (red): wrap from the abs round to the flank, tapering into the belt
  pair('red', [F(0.355, -0.215, 0.02), F(0.5, -0.2, 0.03), F(0.62, -0.1, 0.03), { P: cylP(1.02, -0.12) }, { P: cylP(0.98, -0.6), r: 0.05 }, F(0.335, -0.6, 0.02), F(0.34, -0.565, 0.0), F(0.35, -0.4, 0.0)], { T: 0.038, crown: 0.016, crownW: 0.12 }, cyl, 0.42)
  pair('red', [F(0.335, -0.6, 0.02), { P: cylP(0.98, -0.6), r: 0.03 }, { P: cylP(0.92, -0.96), r: 0.05 }, F(0.29, -0.955, 0.03), F(0.325, -0.73, 0.0)], { T: 0.036, crown: 0.014, crownW: 0.12 }, cyl, 0.44)

  // ---- flank (gunmetal slats under the arm) + back (red)
  const flank = [
    [F(0.625, 0.47, 0.02), { P: cylP(1.32, 0.45), r: 0.03 }, { P: cylP(1.32, 0.29), r: 0.03 }, F(0.62, 0.29, 0.02)],
    [F(0.62, 0.29, 0.02), { P: cylP(1.32, 0.27), r: 0.03 }, { P: cylP(1.32, 0.09), r: 0.03 }, F(0.615, 0.2, 0.0), F(0.64, 0.06, 0.02)],
    [F(0.64, 0.06, 0.02), { P: cylP(1.32, 0.07), r: 0.03 }, { P: cylP(1.32, -0.1), r: 0.03 }, F(0.62, -0.1, 0.02)],
  ]
  flank.forEach((ol, k) => pair('gun', ol, { T: 0.03, crown: 0.01, radius: 0.03 }, cyl, 0.42 + k * 0.03, 0.0))
  // back plates
  pair('red', [{ P: cylP(1.36, 0.62) }, { P: cylP(1.86, 0.66) }, { P: cylP(1.86, -0.12), r: 0.05 }, { P: cylP(1.36, -0.12) }], { T: 0.036, crown: 0.02, crownW: 0.15, radius: 0.06 }, cyl, 0.36, -0.6)
  pair('red', [{ P: cylP(1.06, -0.14) }, { P: cylP(1.86, -0.14) }, { P: cylP(1.86, -0.95), r: 0.05 }, { P: cylP(0.98, -0.95), r: 0.05 }], { T: 0.034, crown: 0.016, crownW: 0.15, radius: 0.06 }, cyl, 0.36, -0.6)

  // ---- belt (gunmetal) + front buckle (gold)
  single('gold', [[-0.16, -0.962, 0.02], [0.16, -0.962, 0.02], [0.13, -1.14, 0.03], [-0.13, -1.14, 0.03]], { T: 0.044, crown: 0.012 }, cyl[0], 0.4, 0.4)
  for (const s of sides) {
    const ch = cyl[s]
    const segs = [
      [0.165, 0.62],
      [0.62, 1.12],
      [1.12, 1.62],
      [1.62, 1.885],
    ]
    for (const [a, b] of segs) {
      const ol = [
        [a + 0.005, -0.965],
        [b, -0.965],
        [b, -1.14],
        [a, -1.14],
      ].map(([u, v]) => [u, v, 0.02])
      plate(M.gun, ch, ol, { T: 0.03, crown: 0.006, explode: [0.4, 0.1, [0, -0.1, 0]] }, Q)
    }
  }

  // ---- collar / trapezius (gold, top-down chart)
  const collar = [
    { P: frontPoint(0.135, 0.735), r: 0.02 },
    { P: frontPoint(0.36, 0.715), r: 0.04 },
    { P: frontPoint(0.55, 0.62), r: 0.04 },
    [0.64, -(ZA - 0.02), 0.04],
    [0.6, -(ZA - 0.2), 0.05],
    [0.22, -(ZA - 0.2), 0.05],
    [0.22, -(ZA + 0.13), 0.06],
  ]
  pair('red', collar, { T: 0.034, cham: [0.03, 0.01], crown: 0.008, crownW: 0.1, radius: 0.03 }, top, 0.34, 0.0)
  pair('red', [[0.2, -(ZA - 0.22), 0.03], [0.6, -(ZA - 0.22), 0.05], [0.5, -(ZA - 0.31), 0.05], [0.18, -(ZA - 0.31), 0.04]], { T: 0.03, cham: [0.02, 0.006] }, top, 0.34, -0.2)

  // ---- reactor bezel: gold outer collar + chrome inner ring + dark socket + glow ring
  const zs = frontPoint(REACTOR[0], REACTOR[1])[2]
  const BC = [REACTOR[0], REACTOR[1], zs]
  const bzExp = [0, 0, 0.1]
  lathe(M.gold, [[0.352, -0.09], [0.352, 0.03], [0.344, 0.058], [0.33, 0.07], [0.288, 0.07], [0.276, 0.062]], BC, [0, 0, 1], Q.lathe, bzExp, 0.1)
  lathe(M.chrome, [[0.276, 0.056], [0.268, 0.066], [0.252, 0.066], [0.244, 0.054], [0.24, 0.04], [0.24, 0.026]], BC, [0, 0, 1], Q.lathe, bzExp, 0.1)
  // socket floor: glows with the power-up (the reactor covers its centre; when the reactor powers down for the
  // hero-select beat the heart still glows)
  lathe(M.glow, [[0.242, 0.028], [0.0, 0.03]], BC, [0, 0, 1], Q.lathe, [0, 0, 0.0], 0.1)
  // bezel bolts (chrome), between the gold rim steps
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 10
    const cx = BC[0] + Math.cos(a) * 0.31
    const cy = BC[1] + Math.sin(a) * 0.31
    lathe(M.chrome, [[0.0, 0.088], [0.012, 0.086], [0.016, 0.078], [0.016, 0.06]], [cx, cy, BC[2]], [0, 0, 1], 12, bzExp, 0.1, { smoothAll: false })
  }

  // ---- gorget: stacked rings around the neck (+ dark neck seal with a glow ring)
  const NC = [0, 0, ZA - 0.03]
  const nA = norm([0, 1, -0.06])
  const gor = [
    ['gold', [[0.29, 0.76], [0.296, 0.8], [0.29, 0.84], [0.268, 0.86], [0.255, 0.86]], 0.0],
    ['gun', [[0.268, 0.865], [0.274, 0.89], [0.272, 0.93], [0.258, 0.95], [0.21, 0.955], [0.205, 0.94]], 0.05],
  ]
  gor.forEach(([mat, prof, k]) => lathe(M[mat], prof, NC, nA, Q.lathe, [0, 0.3 + k, -0.04], 0.3 + k, { smoothAll: false }))
  lathe(M.under, [[0.205, 0.94], [0.17, 0.935], [0.0, 0.93]], NC, nA, Q.lathe, [0, 0.4, -0.04], 0.4)
  lathe(M.glow, [[0.18, 0.942], [0.168, 0.947], [0.152, 0.942]], NC, nA, Q.lathe, [0, 0.4, -0.04], 0.4)

  // ---- pauldrons: a dominant dome cap over two tucked lames (gold edge band), tilted out over the arm
  const PC = [0.875, 0.6, ZA]
  const PA = [0.6, 1, 0.03]
  const PB = [1, -0.6, 0]
  const lames = [
    { mat: 'red', r: 0.336, b0: 0.0, b1: 1.1, polar: true, T: 0.04, cham: [0.05, 0.016], crown: 0.012, crownW: 0.22, bevel: 0.02 },
    { mat: 'gold', r: 0.31, b0: 1.02, b1: 1.38, a: 2.0, T: 0.03, cham: [0.03, 0.008], crown: 0.0, bevel: 0.014 },
  ]
  for (const s of sides) {
    lames.forEach((L, k) => {
      const ch = sphereChart({ C: PC, A: PA, B1: PB, r: L.r, polar: L.polar, betaRef: (L.b0 + L.b1) / 2, mirror: !!s, flare: 0.016 })
      let ol
      if (L.polar) {
        ol = []
        for (let q = 0; q < 56; q++) {
          const a = (q / 56) * Math.PI * 2
          ol.push([Math.cos(a) * L.b1 * L.r, Math.sin(a) * L.b1 * L.r, 0])
        }
      } else {
        const sr = Math.sin((L.b0 + L.b1) / 2)
        const u = L.a * L.r * sr
        ol = [
          [-u, L.b0 * L.r, 0.04],
          [u, L.b0 * L.r, 0.04],
          [u * 0.94, L.b1 * L.r, 0.06],
          [-u * 0.94, L.b1 * L.r, 0.06],
        ]
      }
      const sx = s ? -1 : 1
      const dirOut = norm([sx * (0.8 + k * 0.08), 0.62 - k * 0.22, 0.12])
      const amt = 0.36 + k * 0.07
      plate(M[L.mat], ch, ol, { T: L.T, h0: 0.008, bevel: L.bevel, cham: L.cham, crown: L.crown, crownW: L.crownW ?? 0.1, wall: 0.024, gap: 0, back: true, exp: [dirOut[0] * amt, dirOut[1] * amt, dirOut[2] * amt], phase: 0.2 + k * 0.1 }, Q)
    })
  }

  // ---- upper arms: bicep plate (red) with a gold band, sealed cut (gunmetal ring, dark seal, glow ring)
  for (const s of sides) {
    const ch = armChart(!!s)
    const { A, D } = ch.frame
    const sx = s ? -1 : 1
    const out = norm([sx * 0.9, -0.35, 0.1])
    const U = 2.45 * ARM_R
    plate(M.red, ch, [[-U, 0.1, 0.03], [U, 0.1, 0.03], [U * 0.98, 0.555, 0.03], [-U * 0.98, 0.555, 0.03]], { T: 0.034, cham: [0.03, 0.01], crown: 0.008, crownW: 0.1, radius: 0.03, exp: [out[0] * 0.5, out[1] * 0.5, out[2] * 0.5], phase: 0.6 }, Q)
    plate(M.gold, ch, [[-U * 0.96, 0.562, 0.012], [U * 0.96, 0.562, 0.012], [U * 0.96, 0.612, 0.012], [-U * 0.96, 0.612, 0.012]], { T: 0.03, cham: [0, 0], crown: 0.0, bevel: 0.01, radius: 0.012, exp: [out[0] * 0.56, out[1] * 0.56, out[2] * 0.56], phase: 0.65 }, Q)
    const C = [A[0], A[1], A[2]]
    const ex = [out[0] * 0.56, out[1] * 0.56, out[2] * 0.56]
    lathe(M.gun, [[R_CUT + 0.03, ARM_CUT - 0.014], [R_CUT + 0.036, ARM_CUT + 0.004], [R_CUT + 0.022, ARM_CUT + 0.018], [R_CUT - 0.01, ARM_CUT + 0.018]], C, D, Q.lathe, ex, 0.65)
    lathe(M.under, [[R_CUT - 0.01, ARM_CUT + 0.018], [R_CUT - 0.02, ARM_CUT + 0.01], [0, ARM_CUT + 0.008]], C, D, Q.lathe, ex, 0.65)
    lathe(M.glow, [[R_CUT - 0.035, ARM_CUT + 0.0125], [R_CUT - 0.052, ARM_CUT + 0.0135]], C, D, Q.lathe, ex, 0.65)
  }

  // ---- vents on the upper pecs: dark frame + glowing slit
  for (const s of sides) {
    const ch = cyl[s]
    const sx = s ? -1 : 1
    for (let k = 0; k < 2; k++) {
      const y = 0.655 - k * 0.045
      const x0 = 0.385 + k * 0.02
      const fr = [F(sx * x0, y), F(sx * (x0 + 0.13), y - 0.04), F(sx * (x0 + 0.13), y - 0.068), F(sx * x0, y - 0.028)].map((p) => ({ ...p, r: 0.008 }))
      const c = centre3(fr)
      const e = radial(c, 0.4)
      plate(M.gun, ch, fr, { lift: 0.05, T: 0.014, h0: 0.004, bevel: 0.005, cham: [0, 0], crown: 0, gap: 0, wall: 0.03, radius: 0.008, seam: 0, exp: e }, Q)
      const sl = [F(sx * (x0 + 0.012), y - 0.008), F(sx * (x0 + 0.118), y - 0.041), F(sx * (x0 + 0.118), y - 0.058), F(sx * (x0 + 0.012), y - 0.024)].map((p) => ({ ...p, r: 0.004 }))
      plate(M.glow, ch, sl, { lift: 0.06, T: 0.006, h0: 0.003, bevel: 0.003, cham: [0, 0], crown: 0, gap: 0, wall: 0.008, radius: 0.004, seam: 0, exp: e }, Q)
    }
  }

  // ---- under-suit
  buildBody(M.under, Q)

  // ---- HUD anchors (rest positions + their explode offsets), on four different parts, top → bottom
  const anc = (name, P, e) => (anchors[name] = { p: P, e })
  {
    const ga = (-35 * Math.PI) / 180
    anc('forehead', [Math.sin(ga) * 0.285, 0.905, ZA - 0.03 + Math.cos(ga) * 0.285], [0, 0.35, -0.04])
    const pa = [-PC[0] - 0.1, PC[1] + 0.36, PC[2] + 0.1]
    const dOut = norm([-0.8, 0.6, 0.12])
    anc('crown', pa, [dOut[0] * 0.36, dOut[1] * 0.36, dOut[2] * 0.36])
    const pp = frontPoint(-0.42, 0.3)
    anc('cheek', [pp[0], pp[1], pp[2] + 0.06], radial(pp, 0.34))
    const pb = frontPoint(-0.18, -0.62)
    anc('ear', [pb[0], pb[1], pb[2] + 0.06], radial(pb, 0.4, 0.4))
  }

  // design units → stage units
  const S = SCALE
  for (const m of Object.values(M)) {
    for (let i = 0; i < m.pos.length; i++) m.pos[i] *= S
    for (let i = 0; i < m.exp.length; i++) if (i % 4 !== 3) m.exp[i] *= S
  }
  for (const a of Object.values(anchors)) {
    a.p = a.p.map((v) => v * S)
    a.e = a.e.map((v) => v * S)
  }
  const out = {}
  for (const [k, m] of Object.entries(M)) {
    out[k] = {
      position: new Float32Array(m.pos),
      normal: new Float32Array(m.nrm),
      aExp: new Float32Array(m.exp),
      aSeam: new Float32Array(m.seam),
      index: m.n > 65535 ? new Uint32Array(m.idx) : new Uint16Array(m.idx),
      top: (m.top || []).map((r) => r.slice()),
    }
  }
  return { meshes: out, anchors, socketZ: zs * S }
}

function cylP(u, v) {
  const P = [0, 0, 0]
  const N = [0, 0, 0]
  cylChart(false).at(u, v, P, N)
  return P
}

// Nanite targets: area-weighted samples over the plates' top surfaces, with their reveal delay and paint.
const SWARM = [
  ['red', [0.64, 0.03, 0.05]],
  ['gold', [0.88, 0.62, 0.22]],
  ['gun', [0.2, 0.21, 0.24]],
  ['chrome', [0.76, 0.78, 0.82]],
]
export function sampleSwarm(data, count) {
  const tris = []
  let total = 0
  for (const [key, colour] of SWARM) {
    const m = data.meshes[key]
    const P = m.position
    const I = m.index
    for (const [i0, i1] of m.top) {
      for (let t = i0; t < i1; t += 3) {
        const a = I[t] * 3
        const b = I[t + 1] * 3
        const c = I[t + 2] * 3
        const ux = P[b] - P[a]
        const uy = P[b + 1] - P[a + 1]
        const uz = P[b + 2] - P[a + 2]
        const vx = P[c] - P[a]
        const vy = P[c + 1] - P[a + 1]
        const vz = P[c + 2] - P[a + 2]
        const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
        if (!(ar > 0)) continue
        total += ar
        tris.push([m, a, b, c, total, colour])
      }
    }
  }
  const aTarget = new Float32Array(count * 3)
  const aNormal = new Float32Array(count * 3)
  const aRand = new Float32Array(count * 4)
  const color = new Float32Array(count * 3)
  for (let k = 0; k < count; k++) {
    const r = Math.random() * total
    let lo = 0
    let hi = tris.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tris[mid][4] < r) lo = mid + 1
      else hi = mid
    }
    const [m, a, b, c, , colour] = tris[lo]
    let u = Math.random()
    let v = Math.random()
    if (u + v > 1) {
      u = 1 - u
      v = 1 - v
    }
    const w = 1 - u - v
    for (let q = 0; q < 3; q++) {
      aTarget[k * 3 + q] = m.position[a + q] * w + m.position[b + q] * u + m.position[c + q] * v
      aNormal[k * 3 + q] = m.normal[a + q] * w + m.normal[b + q] * u + m.normal[c + q] * v
      color[k * 3 + q] = colour[q]
    }
    aRand[k * 4] = chestDelay(aTarget[k * 3], aTarget[k * 3 + 1], aTarget[k * 3 + 2])
    aRand[k * 4 + 1] = Math.random()
    aRand[k * 4 + 2] = Math.random()
    aRand[k * 4 + 3] = Math.random()
  }
  return { aTarget, aNormal, aRand, color }
}

// Everything the component needs, as transferable typed arrays.
export function buildChestPayload(quality, count) {
  const data = buildChest(quality)
  data.swarm = sampleSwarm(data, count)
  for (const m of Object.values(data.meshes)) delete m.top
  return data
}
