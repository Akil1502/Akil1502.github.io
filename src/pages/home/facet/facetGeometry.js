// FACETED HELMET — an original "designer collectible" low-poly helmet, built from a hand-authored plane layout.
//
// How it is made:
//  1. A smooth analytic head (stack of superellipse cross-sections) is used only as a guide surface: every authored
//     vertex is snapped onto it from a convenient projection (front / side / top / back) and then sculpted along the
//     surface normal (brow ridge, nose keel, cheekbones, raised crest, crease lines...).
//  2. The layout is authored per plate as PLANES — polygons between named vertices (right half; the left half is
//     mirrored). Each polygon is shaded with one normal, so the sculpture reads as a few large deliberate planes
//     instead of a random triangulation. Plate boundaries follow the design lines: a gold faceplate confined to the
//     face (chevron "V" forehead, angular eye slits, cheekbones, muzzle, mouth slit, trapezoid chin) framed by a red
//     shell (crest strip, crown, side plates radiating from the ear pod, outer jaw, back plates).
//  3. Every plate becomes a solid shell: the top planes, a crisp 45° chamfer along the border, a short wall and an
//     underside. Borders are inset so neighbouring plates are separated by a thin seam (tighter around the eye and
//     mouth slits), through which a glowing seam ribbon on the dark under-suit shows.
// All coordinates are stage units: ~2.3 tall, centred on the origin, facing +z. Geometry is baked in helmet space
// (the nanotech reveal shader keys off the raw `position` attribute).
import * as THREE from 'three'

export const FACET = { T: 0.046, BEVEL: 0.019, SEAM: 0.0085, FOOT: 0.014, SKULL: 0.04 }
const FINE = 0.28 // inset factor on the eye / mouth slit edges (crisp, narrow openings)

// ---------------------------------------------------------------- guide surface
//        y      W     Zf    Zb    ef   eb
const KEYS = [
  [-1.27, 0.06, 0.08, 0.06, 2.0, 2.0],
  [-1.2, 0.34, 0.5, 0.4, 1.8, 2.2],
  [-1.08, 0.48, 0.79, 0.56, 1.6, 2.2],
  [-0.7, 0.6, 0.86, 0.66, 1.8, 2.2],
  [-0.35, 0.7, 0.87, 0.8, 2.2, 2.2],
  [0.0, 0.735, 0.86, 0.92, 2.5, 2.2],
  [0.3, 0.74, 0.82, 0.98, 2.6, 2.3],
]
const YBOT = KEYS[0][0]
const YDOME = 0.3
const YTOP = 1.08
const SX = 0.92 // global width squeeze: a narrower, taller head (applied to the guide surface and to authored x)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
// lower-face squash applied to every built point: shortens chin and jaw relative to the dome (eye line ≈ mid-height)
const SQ_Y = 0.2
const SQ_K = 0.94
const squash = (p) => {
  if (p.y < SQ_Y) p.y = SQ_Y + (p.y - SQ_Y) * SQ_K
  return p
}
const sec = { W: 0, Zf: 0, Zb: 0, ef: 2, eb: 2 }

function section(y) {
  if (y >= YDOME) {
    const t = clamp((y - YDOME) / (YTOP - YDOME), 0, 1)
    const k = (p) => Math.pow(Math.max(0, 1 - Math.pow(t, p)), 1 / p)
    const top = KEYS[KEYS.length - 1]
    sec.W = top[1] * SX * k(2.7)
    sec.Zf = top[2] * k(2.0)
    sec.Zb = top[3] * k(2.7)
    sec.ef = top[4]
    sec.eb = top[5]
    return sec
  }
  let i = 0
  while (i < KEYS.length - 2 && y > KEYS[i + 1][0]) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const u = clamp((y - a[0]) / (b[0] - a[0]), 0, 1)
  sec.W = (a[1] + (b[1] - a[1]) * u) * SX
  sec.Zf = a[2] + (b[2] - a[2]) * u
  sec.Zb = a[3] + (b[3] - a[3]) * u
  sec.ef = a[4] + (b[4] - a[4]) * u
  sec.eb = a[5] + (b[5] - a[5]) * u
  return sec
}

function field(x, y, z) {
  if (y <= YBOT || y >= YTOP) return 1e3
  const s = section(y)
  if (s.W < 1e-4) return 1e3
  const e = z >= 0 ? s.ef : s.eb
  const Z = z >= 0 ? s.Zf : s.Zb
  return Math.pow(Math.abs(x) / s.W, e) + Math.pow(Math.abs(z) / Z, e)
}

function gradAt(p, out) {
  const h = 2e-3
  out.set(
    field(p.x + h, p.y, p.z) - field(p.x - h, p.y, p.z),
    field(p.x, p.y + h, p.z) - field(p.x, p.y - h, p.z),
    field(p.x, p.y, p.z + h) - field(p.x, p.y, p.z - h),
  )
  if (out.lengthSq() < 1e-12) out.set(0, 1, 0)
  return out.normalize()
}

const projF = (x, y) => {
  const s = section(y)
  const q = Math.pow(Math.min(1, Math.abs(x) / s.W), s.ef)
  return new THREE.Vector3(x, y, s.Zf * Math.pow(Math.max(0, 1 - q), 1 / s.ef))
}
const projB = (x, y) => {
  const s = section(y)
  const q = Math.pow(Math.min(1, Math.abs(x) / s.W), s.eb)
  return new THREE.Vector3(x, y, -s.Zb * Math.pow(Math.max(0, 1 - q), 1 / s.eb))
}
const projS = (z, y) => {
  const s = section(y)
  const e = z >= 0 ? s.ef : s.eb
  const Z = z >= 0 ? s.Zf : s.Zb
  const q = Math.pow(Math.min(1, Math.abs(z) / Z), e)
  return new THREE.Vector3(s.W * Math.pow(Math.max(0, 1 - q), 1 / e), y, z)
}
const projT = (x, z) => {
  let lo = YDOME - 0.25
  let hi = YTOP
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) * 0.5
    if (field(x, m, z) < 1) lo = m
    else hi = m
  }
  return new THREE.Vector3(x, (lo + hi) * 0.5, z)
}
// ray from c along d → surface
function rayHit(c, d, out) {
  let lo = 0
  let hi = 2.6
  for (let i = 0; i < 36; i++) {
    const m = (lo + hi) * 0.5
    if (field(c.x + d.x * m, c.y + d.y * m, c.z + d.z * m) < 1) lo = m
    else hi = m
  }
  return out
    .copy(d)
    .multiplyScalar((lo + hi) * 0.5)
    .add(c)
}

// ---------------------------------------------------------------- authored vertices (right half, x >= 0)
// [kind, a, b, dz]  F: front (x,y)   B: back (x,y)   S: side (z,y)   T: top (x,z)    dz: lift along the normal
const V = {
  // centre line (shared by both halves)
  cTop: ['F', 0, 0.665, 0.012], // forehead top = front tip of the crest strip
  cF: ['F', 0, 0.47, 0.036], // forehead keel
  cV: ['F', 0, 0.152, 0.006], // tip of the chevron forehead, between the eyes
  cN: ['F', 0, -0.1, 0.036], // nose keel
  cLp: ['F', 0, -0.365, 0.03],
  cMt: ['F', 0, -0.508, 0.014],
  cMb: ['F', 0, -0.531, 0.014],
  cChin: ['F', 0, -0.765, 0.042],
  cChinB: ['F', 0, -0.99, 0.0],
  // GOLD faceplate border (the red frame starts here)
  ft1: ['F', 0.18, 0.648, 0.0],
  ft2: ['F', 0.37, 0.578, 0.0],
  ft3: ['F', 0.475, 0.43, 0.0],
  fs1: ['F', 0.515, 0.25, 0.0],
  fs2: ['F', 0.53, -0.02, 0.0],
  fs3: ['F', 0.495, -0.3, 0.0],
  fs4: ['F', 0.405, -0.56, 0.0],
  // forehead planes + brow ridge
  fm: ['F', 0.25, 0.462, 0.018],
  bA: ['F', 0.12, 0.276, 0.04],
  bB: ['F', 0.38, 0.396, 0.03],
  // eye slit: pointed inner tip, straight top edge, angled bottom, chevron outer end
  eIi: ['F', 0.105, 0.19, 0.008],
  eOt: ['F', 0.405, 0.333, 0.01],
  eOo: ['F', 0.448, 0.288, 0.01],
  eOb: ['F', 0.392, 0.238, 0.01],
  eMb: ['F', 0.25, 0.195, 0.01],
  // cheek
  ck1: ['F', 0.4, 0.03, 0.036], // cheekbone apex
  ck2: ['F', 0.35, -0.3, 0.012],
  clM: ['F', 0.2, -0.12, 0.012], // cheek line (eye → mouth corner)
  lp1: ['F', 0.205, -0.37, 0.018],
  // mouth slit: straight centre, ends kinked down
  mt1: ['F', 0.12, -0.512, 0.014],
  mc: ['F', 0.225, -0.546, 0.012],
  mb1: ['F', 0.12, -0.535, 0.014],
  mcb: ['F', 0.213, -0.569, 0.012],
  // chin
  chS: ['F', 0.205, -0.8, 0.02],
  chB: ['F', 0.17, -0.97, 0.0],
  // outer jaw (red)
  jf1: ['F', 0.37, -0.79, 0.012],
  sj1: ['S', 0.4, -0.37, 0.0],
  jm1: ['S', 0.24, -0.66, 0.014],
  jm2: ['S', 0.0, -0.63, 0.014],
  jm3: ['S', -0.26, -0.6, 0.01],
  jm4: ['S', -0.48, -0.56, 0.0],
  jb2: ['S', 0.32, -0.93, 0.0],
  jb1: ['S', 0.0, -0.87, 0.0],
  jb0: ['S', -0.26, -0.83, 0.0],
  nb1: ['S', -0.48, -0.79, 0.0],
  // side plate: crease line (where the red frame turns from the face to the side) + corners
  o0: ['S', 0.392, 0.241, 0.024],
  o7: ['S', 0.392, -0.141, 0.024],
  o1: ['S', 0.121, 0.512, 0.0],
  o2: ['S', -0.261, 0.512, 0.0],
  o3: ['S', -0.532, 0.241, 0.0],
  o4: ['S', -0.532, -0.141, 0.0],
  o5: ['S', -0.261, -0.412, 0.0],
  o6: ['S', 0.121, -0.412, 0.0],
  cb: ['S', 0.43, 0.5, 0.0],
  ob: ['S', -0.5, 0.47, 0.0],
  obb: ['S', -0.5, -0.38, 0.0],
  ec: ['S', -0.07, 0.05, -0.01],
  // crest strip (raised ridge, front → back)
  kc1: ['T', 0, 0.42, 0.034],
  kc2: ['T', 0, 0.0, 0.034],
  kc3: ['T', 0, -0.42, 0.034],
  kc4: ['B', 0, 0.76, 0.034],
  kcE: ['B', 0, 0.45, 0.026],
  k1: ['T', 0.17, 0.42, 0.0],
  k2: ['T', 0.165, 0.0, 0.0],
  k3: ['T', 0.155, -0.42, 0.0],
  k4: ['B', 0.145, 0.76, 0.0],
  kE: ['B', 0.13, 0.45, 0.0],
  // crown
  cw1: ['T', 0.4, 0.34, 0.014],
  cw2: ['T', 0.43, -0.05, 0.014],
  cw3: ['T', 0.39, -0.45, 0.014],
  cw4: ['B', 0.35, 0.64, 0.012],
  // back rows
  bc1: ['B', 0, 0.24, 0.02],
  b11: ['B', 0.24, 0.24, 0.012],
  b12: ['B', 0.47, 0.24, 0.0],
  bc2: ['B', 0, -0.14, 0.02],
  b21: ['B', 0.23, -0.14, 0.012],
  b22: ['B', 0.45, -0.14, 0.0],
  bc3: ['B', 0, -0.38, 0.014],
  b31: ['B', 0.22, -0.38, 0.01],
  b32: ['B', 0.43, -0.38, 0.0],
  bc4: ['B', 0, -0.57, 0.01],
  b41: ['B', 0.21, -0.57, 0.006],
  b42: ['B', 0.4, -0.57, 0.0],
  bc5: ['B', 0, -0.76, 0.0],
  b51: ['B', 0.2, -0.765, 0.0],
  b52: ['B', 0.38, -0.775, 0.0],
}
// octagonal socket ring around the ear: the side plate radiates from it in eight clean trapezoids
const EAR_C = { z: -0.07, y: 0.05 }
const EAR_R = 0.26
const ER = []
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8
  const k = 'er' + i
  V[k] = ['S', EAR_C.z + Math.cos(a) * EAR_R, EAR_C.y + Math.sin(a) * EAR_R, 0.012]
  ER.push(k)
}
// slit edges get a much smaller inset than ordinary plate seams
const FINE_KEYS = new Set(['eIi', 'eOt', 'eOo', 'eOb', 'eMb', 'cMt', 'mt1', 'mc', 'cMb', 'mb1', 'mcb'].flatMap((k) => [k, k + '~']))

// ---------------------------------------------------------------- plane layout
const quads = (A, B) => {
  // band of quads between two chains of equal length running the same way
  const out = []
  for (let i = 0; i < A.length - 1; i++) out.push([A[i], A[i + 1], B[i + 1], B[i]])
  return out
}

function layout() {
  const P = {}
  // ---- GOLD faceplate ----
  // chevron forehead: keel, two upper planes, the main plane, and a brow ridge that tips down over the eyes
  P.forehead = {
    mat: 'gold',
    sym: true,
    polys: [
      ['cTop', 'ft1', 'fm', 'cF'],
      ['ft1', 'ft2', 'ft3', 'fm'],
      ['cF', 'fm', 'bB', 'bA'],
      ['fm', 'ft3', 'bB'],
      ['bB', 'ft3', 'fs1', 'eOo', 'eOt'],
      ['bA', 'bB', 'eOt', 'eIi'],
      ['cF', 'bA', 'eIi', 'cV'],
    ],
  }
  P.muzzle = {
    mat: 'gold',
    sym: true,
    polys: [
      ['cV', 'eIi', 'eMb', 'clM', 'cN'],
      ['cN', 'clM', 'lp1', 'cLp'],
      ['cLp', 'lp1', 'mc', 'mt1', 'cMt'],
    ],
  }
  P.cheek = {
    mat: 'gold',
    polys: [
      ['eMb', 'eOb', 'eOo', 'ck1', 'clM'],
      ['eOo', 'fs1', 'fs2', 'ck1'],
      ['ck1', 'fs2', 'fs3', 'ck2'],
      ['clM', 'ck1', 'ck2', 'lp1'],
      ['lp1', 'ck2', 'fs3', 'fs4', 'mc'],
    ],
  }
  P.chin = {
    mat: 'gold',
    sym: true,
    polys: [
      ['cMb', 'mb1', 'mcb', 'chS', 'cChin'],
      ['cChin', 'chS', 'chB', 'cChinB'],
    ],
  }
  // ---- RED shell ----
  P.crest = { mat: 'red', sym: true, thick: 1.5, polys: quads(['cTop', 'kc1', 'kc2', 'kc3', 'kc4', 'kcE'], ['ft1', 'k1', 'k2', 'k3', 'k4', 'kE']) }
  P.crown = {
    mat: 'red',
    polys: [
      ...quads(['ft1', 'k1', 'k2', 'k3', 'k4'], ['ft2', 'cw1', 'cw2', 'cw3', 'cw4']),
      ['k4', 'kE', 'cw4'],
      ...quads(['ft2', 'cw1', 'cw2', 'cw3', 'cw4'], ['ft3', 'cb', 'o1', 'o2', 'ob']),
    ],
  }
  P.temple = {
    mat: 'red',
    polys: [
      // eight radial trapezoids around the ear socket
      [ER[0], ER[1], 'o1', 'cb', 'o0'],
      [ER[1], ER[2], 'o2', 'o1'],
      [ER[2], ER[3], 'o3', 'ob', 'o2'],
      [ER[3], ER[4], 'o4', 'o3'],
      [ER[4], ER[5], 'o5', 'obb', 'o4'],
      [ER[5], ER[6], 'o6', 'o5'],
      [ER[6], ER[7], 'o7', 'sj1', 'o6'],
      [ER[7], ER[0], 'o0', 'o7'],
      // the red frame around the faceplate (seen from the front)
      ['o0', 'cb', 'ft3', 'fs1'],
      ['o7', 'o0', 'fs1', 'fs2'],
      ['sj1', 'o7', 'fs2', 'fs3'],
      // socket floor under the ear pod
      ...ER.map((k, i) => [k, ER[(i + 7) % 8], 'ec']),
    ],
  }
  P.jaw = {
    mat: 'red',
    polys: [
      ['mc', 'mcb', 'chS', 'jf1', 'fs4'],
      ['chS', 'chB', 'jb2', 'jf1'],
      ['fs3', 'fs4', 'jf1', 'jm1', 'sj1'],
      ['jf1', 'jb2', 'jm1'],
      ...quads(['sj1', 'o6', 'o5', 'obb'], ['jm1', 'jm2', 'jm3', 'jm4']),
      ...quads(['jm1', 'jm2', 'jm3', 'jm4'], ['jb2', 'jb1', 'jb0', 'nb1']),
    ],
  }
  const R0 = ['kcE', 'kE', 'cw4', 'ob']
  const R1 = ['bc1', 'b11', 'b12', 'o3']
  const R2 = ['bc2', 'b21', 'b22', 'o4']
  const R3 = ['bc3', 'b31', 'b32', 'obb']
  const R4 = ['bc4', 'b41', 'b42', 'jm4']
  const R5 = ['bc5', 'b51', 'b52', 'nb1']
  P.backU = { mat: 'red', sym: true, polys: quads(R0, R1) }
  P.backM = { mat: 'red', sym: true, polys: [...quads(R1, R2), ...quads(R2, R3)] }
  P.backL = { mat: 'red', sym: true, polys: [...quads(R3, R4), ...quads(R4, R5)] }
  return P
}

// ---------------------------------------------------------------- polygon helpers
let POS = null
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3()
const _h = new THREE.Vector3()

// Newell normal (robust for slightly non-planar polygons)
function polyNormal(pts, out) {
  out.set(0, 0, 0)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    out.x += (p.y - q.y) * (p.z + q.z)
    out.y += (p.z - q.z) * (p.x + q.x)
    out.z += (p.x - q.x) * (p.y + q.y)
  }
  return out.normalize()
}

// ear clipping in the polygon's own plane → index triples (counter-clockwise about n)
function triangulate(pts, n) {
  const u = new THREE.Vector3()
  if (Math.abs(n.x) < 0.9) u.set(1, 0, 0)
  else u.set(0, 1, 0)
  u.addScaledVector(n, -u.dot(n)).normalize()
  const w = new THREE.Vector3().crossVectors(n, u)
  const P2 = pts.map((p) => [p.dot(u), p.dot(w)])
  const idx = pts.map((_, i) => i)
  const out = []
  const cross = (a, b, c) => (P2[b][0] - P2[a][0]) * (P2[c][1] - P2[a][1]) - (P2[b][1] - P2[a][1]) * (P2[c][0] - P2[a][0])
  const inside = (p, a, b, c) => cross(a, b, p) >= -1e-9 && cross(b, c, p) >= -1e-9 && cross(c, a, p) >= -1e-9
  let guard = 0
  while (idx.length > 3 && guard++ < 64) {
    let clipped = false
    for (let i = 0; i < idx.length; i++) {
      const a = idx[(i + idx.length - 1) % idx.length]
      const b = idx[i]
      const c = idx[(i + 1) % idx.length]
      if (cross(a, b, c) <= 1e-9) continue
      let ok = true
      for (const j of idx) if (j !== a && j !== b && j !== c && inside(j, a, b, c)) ok = false
      if (!ok) continue
      out.push([a, b, c])
      idx.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]])
  else for (let i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i + 1]]) // fallback fan
  return out
}

class Tris {
  constructor() {
    this.p = []
    this.n = []
  }
  // pushes a triangle with an explicit (flat) normal; flips the winding to agree with it
  add(a, b, c, n) {
    _a.subVectors(b, a)
    _b.subVectors(c, a)
    _h.crossVectors(_a, _b)
    if (_h.dot(n) < 0) this.p.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z)
    else this.p.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
    for (let k = 0; k < 3; k++) this.n.push(n.x, n.y, n.z)
  }
  // pushes a triangle shaded with its own face normal, facing `hint`
  addFace(a, b, c, hint) {
    _a.subVectors(b, a)
    _b.subVectors(c, a)
    _c.crossVectors(_a, _b)
    if (_c.lengthSq() < 1e-16) return
    _c.normalize()
    if (_c.dot(hint) < 0) _c.negate()
    this.add(a, b, c, _c.clone())
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.computeBoundingSphere()
    return g
  }
}

// offset direction at a border vertex: the point whose distance to each adjacent border edge (along the edge's
// inward direction) equals that edge's inset factor
function insetDir(list, n) {
  const d = new THREE.Vector3()
  if (!list.length) return d
  if (list.length === 2) {
    const [e1, e2] = list
    const c = e1.d.dot(e2.d)
    const den = 1 - c * c
    if (den < 0.02) d.copy(e1.d).add(e2.d).normalize().multiplyScalar((e1.f + e2.f) * 0.5)
    else {
      const a = (e1.f - c * e2.f) / den
      const b = (e2.f - c * e1.f) / den
      d.copy(e1.d).multiplyScalar(a).addScaledVector(e2.d, b)
    }
  } else {
    for (const e of list) d.addScaledVector(e.d, e.f)
    d.multiplyScalar(1 / list.length)
  }
  d.addScaledVector(n, -d.dot(n))
  const maxL = 2.4 * Math.max(...list.map((e) => e.f))
  if (d.length() > maxL) d.setLength(maxL)
  return d
}

function buildPlate(polys, opts) {
  const T = FACET.T * (opts.thick || 1)
  const { BEVEL: Bv, SEAM: S, FOOT: F } = FACET
  const ids = new Map()
  const keys = []
  const vid = (k) => {
    if (!POS[k]) throw new Error('facet: unknown vertex ' + k)
    if (!ids.has(k)) {
      ids.set(k, keys.length)
      keys.push(k)
    }
    return ids.get(k)
  }
  // planes: outward normal (agrees with the guide surface) + triangulation
  const planes = []
  for (const poly of polys) {
    let ks = poly
    const pts = ks.map((k) => POS[k])
    const n = polyNormal(pts, new THREE.Vector3())
    _c.set(0, 0, 0)
    for (const p of pts) _c.add(p)
    _c.multiplyScalar(1 / pts.length)
    gradAt(_c, _h)
    if (n.dot(_h) < 0) {
      ks = [...ks].reverse()
      n.negate()
    }
    const tri = triangulate(
      ks.map((k) => POS[k]),
      n,
    )
    planes.push({ n, faces: tri.map(([a, b, c]) => [vid(ks[a]), vid(ks[b]), vid(ks[c])]) })
  }
  const P = keys.map((k) => POS[k].clone())
  const N = P.map(() => new THREE.Vector3())
  for (const pl of planes)
    for (const f of pl.faces) {
      _a.subVectors(P[f[1]], P[f[0]])
      _b.subVectors(P[f[2]], P[f[0]])
      _n.crossVectors(_a, _b)
      for (const i of f) N[i].add(_n)
    }
  N.forEach((n) => n.normalize())
  // boundary edges (directed as in their face: interior on the left)
  const edges = new Map()
  for (const pl of planes)
    for (const f of pl.faces)
      for (let e = 0; e < 3; e++) {
        const a = f[e]
        const b = f[(e + 1) % 3]
        const key = a < b ? a + '|' + b : b + '|' + a
        const rec = edges.get(key)
        if (rec) rec.n++
        else edges.set(key, { a, b, n: 1 })
      }
  const border = [...edges.values()].filter((e) => e.n === 1)
  const inE = P.map(() => [])
  for (const e of border) {
    _n.addVectors(N[e.a], N[e.b]).normalize()
    _a.subVectors(P[e.b], P[e.a])
    e.d = new THREE.Vector3().crossVectors(_n, _a).normalize()
    e.f = FINE_KEYS.has(keys[e.a]) && FINE_KEYS.has(keys[e.b]) ? FINE : 1
    inE[e.a].push(e)
    inE[e.b].push(e)
  }
  const D = P.map((p, i) => insetDir(inE[i], N[i]))
  const top = (i, o) =>
    o
      .copy(P[i])
      .addScaledVector(N[i], T)
      .addScaledVector(D[i], S + Bv)
  const mid = (i, o) =>
    o
      .copy(P[i])
      .addScaledVector(N[i], T - Bv)
      .addScaledVector(D[i], S)
  const bot = (i, o) => o.copy(P[i]).addScaledVector(N[i], -F).addScaledVector(D[i], S)

  const out = new Tris()
  const smp = new Tris()
  const q = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const down = new THREE.Vector3()
  for (const pl of planes) {
    down.copy(pl.n).negate()
    for (const f of pl.faces) {
      top(f[0], q[0])
      top(f[1], q[1])
      top(f[2], q[2])
      out.add(q[0], q[1], q[2], pl.n)
      smp.add(q[0], q[1], q[2], pl.n)
      bot(f[0], q[0])
      bot(f[1], q[1])
      bot(f[2], q[2])
      out.add(q[0], q[1], q[2], down)
    }
  }
  const hint = new THREE.Vector3()
  for (const e of border) {
    const d = e.d
    // chamfer (faces outward + up)
    hint.copy(N[e.a]).add(N[e.b]).normalize().sub(d)
    top(e.a, q[0])
    top(e.b, q[1])
    mid(e.b, q[2])
    mid(e.a, q[3])
    out.addFace(q[0], q[3], q[2], hint)
    out.addFace(q[0], q[2], q[1], hint)
    // wall
    hint.copy(d).negate()
    const m0 = q[3].clone()
    const m1 = q[2].clone()
    bot(e.b, q[0])
    bot(e.a, q[1])
    out.addFace(m0, q[1], q[0], hint)
    out.addFace(m0, q[0], m1, hint)
  }
  const geometry = out.geometry()
  const sample = smp.geometry()
  const centroid = new THREE.Vector3()
  const normal = new THREE.Vector3()
  P.forEach((p, i) => {
    centroid.add(p)
    normal.add(N[i])
  })
  centroid.multiplyScalar(1 / P.length)
  normal.normalize()
  return {
    geometry,
    sample,
    centroid,
    normal,
    border: border.map((e) => ({ ka: keys[e.a], kb: keys[e.b], a: P[e.a], b: P[e.b], na: N[e.a], nb: N[e.b], d: e.d })),
  }
}

// ---------------------------------------------------------------- turned parts (ear pods, neck)
function lathe(profile, segs, phi0 = 0) {
  const g = new THREE.LatheGeometry(
    profile.map(([r, h]) => new THREE.Vector2(r, h)),
    segs,
    phi0,
  )
  const ng = g.toNonIndexed()
  g.dispose()
  ng.deleteAttribute('uv')
  return ng
}
function finish(g, m) {
  g.applyMatrix4(m)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

// ---------------------------------------------------------------- main
const mirrorKey = (k) => (POS[k] && Math.abs(POS[k].x) < 1e-6 ? k : k + '~')

export function buildFacetHelmet({ low = false } = {}) {
  // resolve vertices (+ mirrored copies)
  POS = {}
  const tmpN = new THREE.Vector3()
  for (const [k, [kind, a, b, dz]] of Object.entries(V)) {
    const p = kind === 'F' ? projF(a * SX, b) : kind === 'B' ? projB(a * SX, b) : kind === 'S' ? projS(a, b) : projT(a * SX, b)
    if (dz) p.addScaledVector(gradAt(p, tmpN), dz)
    if (Math.abs(p.x) < 1e-6) p.x = 0
    POS[k] = squash(p)
  }
  for (const k of Object.keys(V)) if (POS[k].x !== 0) POS[k + '~'] = POS[k].clone().setX(-POS[k].x)

  const L = layout()
  const plates = []
  for (const [name, def] of Object.entries(L)) {
    const mir = def.polys.map((t) => t.map(mirrorKey))
    if (def.sym) plates.push({ name, side: 0, mat: def.mat, ...buildPlate([...def.polys, ...mir], def) })
    else {
      plates.push({ name: name + 'R', side: 1, mat: def.mat, ...buildPlate(def.polys, def) })
      plates.push({ name: name + 'L', side: -1, mat: def.mat, ...buildPlate(mir, def) })
    }
  }

  // seams: border edges shared by two plates → a thin ribbon at the bottom of the gap
  const owner = new Map()
  plates.forEach((pl, pi) =>
    pl.border.forEach((e) => {
      const key = e.ka < e.kb ? e.ka + '|' + e.kb : e.kb + '|' + e.ka
      if (!owner.has(key)) owner.set(key, [])
      owner.get(key).push(pi)
    }),
  )
  const seam = new Tris()
  const done = new Set()
  const r = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
  const hw = FACET.SEAM * 1.25
  const sn = new THREE.Vector3()
  plates.forEach((pl) =>
    pl.border.forEach((e) => {
      const key = e.ka < e.kb ? e.ka + '|' + e.kb : e.kb + '|' + e.ka
      if (done.has(key) || owner.get(key).length < 2) return
      done.add(key)
      r[0].copy(e.a).addScaledVector(e.na, -0.004).addScaledVector(e.d, hw)
      r[1].copy(e.b).addScaledVector(e.nb, -0.004).addScaledVector(e.d, hw)
      r[2].copy(e.b).addScaledVector(e.nb, -0.004).addScaledVector(e.d, -hw)
      r[3].copy(e.a).addScaledVector(e.na, -0.004).addScaledVector(e.d, -hw)
      sn.copy(e.na).add(e.nb).normalize()
      seam.add(r[0], r[1], r[2], sn)
      seam.add(r[0], r[2], r[3], sn)
    }),
  )
  const seams = seam.geometry()

  // under-suit skull: the guide surface pulled in under the plates
  const skull = low ? new THREE.SphereGeometry(1, 36, 24) : new THREE.SphereGeometry(1, 56, 36)
  {
    const pos = skull.attributes.position
    const c = new THREE.Vector3(0, -0.1, 0.02)
    const d = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize()
      rayHit(c, d, p)
      gradAt(p, tmpN)
      p.addScaledVector(tmpN, -FACET.SKULL)
      squash(p)
      pos.setXYZ(i, p.x, p.y, p.z)
    }
    skull.deleteAttribute('uv')
    skull.computeVertexNormals()
    skull.computeBoundingSphere()
  }

  // eye lenses: a cyan lens slightly larger than the slit (tucked under the plate walls) + a thin white-hot core
  // along the slit's spine; vertex colours, so one material and one draw call drive both
  const EYE = ['eIi', 'eOt', 'eOo', 'eOb', 'eMb']
  const eyeP = []
  const eyeCol = []
  const eyeC = []
  const LENS = [0.06, 0.55, 0.95]
  const CORE = [2.9, 3.05, 3.2]
  for (const sfx of ['', '~']) {
    const q = EYE.map((k) => POS[k + sfx].clone())
    const c = q.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / q.length)
    const n = polyNormal(q, new THREE.Vector3())
    gradAt(c, tmpN)
    if (n.dot(tmpN) < 0) n.negate()
    const ax = new THREE.Vector3().subVectors(q[2], q[0])
    ax.addScaledVector(n, -ax.dot(n)).normalize()
    // grown across the slit (it tucks under the brow / cheek walls) but barely along it (no glow leaking into the
    // seams that run on from the slit's tips)
    const squeeze = (alongK, perpK, lift) =>
      q.map((v) => {
        const d = v.clone().sub(c)
        const along = d.dot(ax)
        const perp = d.addScaledVector(ax, -along)
        return c
          .clone()
          .addScaledVector(ax, along * alongK)
          .addScaledVector(perp, perpK)
          .addScaledVector(n, lift)
      })
    const lens = squeeze(1.0, 1.7, 0.004)
    const core = squeeze(0.88, 0.5, 0.012)
    const tri = triangulate(q, n)
    for (const [layer, col] of [
      [lens, LENS],
      [core, CORE],
    ])
      for (const [a, b, cc] of tri) {
        _a.subVectors(layer[b], layer[a])
        _b.subVectors(layer[cc], layer[a])
        _h.crossVectors(_a, _b)
        const order = _h.dot(n) < 0 ? [a, cc, b] : [a, b, cc]
        for (const i of order) {
          eyeP.push(layer[i].x, layer[i].y, layer[i].z)
          eyeCol.push(col[0], col[1], col[2])
        }
      }
    eyeC.push({ p: c.clone().addScaledVector(n, 0.03), n: n.clone(), ax: ax.clone() })
  }
  const eyes = new THREE.BufferGeometry()
  eyes.setAttribute('position', new THREE.Float32BufferAttribute(eyeP, 3))
  eyes.setAttribute('color', new THREE.Float32BufferAttribute(eyeCol, 3))
  eyes.computeBoundingSphere()

  // ear pods: octagonal bezel + recessed glow channel + faceted cap, baked onto the surface normal
  const ears = []
  for (const s of [1, -1]) {
    const p = POS[s > 0 ? 'ec' : 'ec~'].clone()
    const n = gradAt(p, new THREE.Vector3())
    p.addScaledVector(n, FACET.T * 0.55)
    const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n), new THREE.Vector3(1, 1, 1))
    const ph = Math.PI / 8
    const bezel = finish(
      lathe(
        [
          [0.235, -0.05],
          [0.235, 0.0],
          [0.22, 0.036],
          [0.188, 0.05],
          [0.152, 0.05],
          [0.143, 0.028],
        ],
        8,
        ph,
      ),
      m,
    )
    const cap = finish(
      lathe(
        [
          [0.13, 0.022],
          [0.13, 0.052],
          [0.11, 0.07],
          [0.07, 0.07],
          [0.056, 0.086],
          [0.0, 0.094],
        ],
        8,
        ph,
      ),
      m,
    )
    const glow = finish(
      lathe(
        [
          [0.145, 0.03],
          [0.13, 0.03],
        ],
        8,
        ph,
      ),
      m,
    )
    ears.push({ side: s, bezel, cap, glow, center: p.clone(), normal: n.clone() })
  }

  // neck seal: stacked faceted rings, tucked under the jaw
  const neck = finish(
    lathe(
      [
        [0.08, -1.22],
        [0.24, -1.205],
        [0.33, -1.18],
        [0.37, -1.14],
        [0.38, -1.07],
        [0.355, -1.05],
        [0.37, -1.03],
        [0.39, -0.95],
        [0.36, -0.93],
        [0.38, -0.91],
        [0.4, -0.83],
        [0.37, -0.7],
        [0.3, -0.6],
      ],
      14,
      0,
    ),
    new THREE.Matrix4().makeScale(SX, 1, 1.12).premultiply(new THREE.Matrix4().makeTranslation(0, 0, -0.06)),
  )

  // HUD anchors (helmet space) + the plate each one rides on
  const byName = Object.fromEntries(plates.map((p) => [p.name, p]))
  const anchorOn = (pl, lift) => pl.centroid.clone().addScaledVector(pl.normal, FACET.T + lift)
  const lift = (k, h) => POS[k].clone().addScaledVector(gradAt(POS[k], tmpN), FACET.T + h)
  const anchors = {
    forehead: { plate: 'forehead', p: lift('cF', 0.05) },
    crown: { plate: 'crownL', p: anchorOn(byName.crownL, 0.06) },
    cheek: { plate: 'cheekL', p: lift('ck1~', 0.05) },
    ear: { plate: 'earL', p: ears[1].center.clone().addScaledVector(ears[1].normal, 0.14) },
  }

  POS = null
  return { plates, seams, skull, eyes, eyeC, ears, neck, anchors }
}
