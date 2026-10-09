// Procedural armoured helmet (original design). The head is an analytic "boxy superellipsoid" surface; every armour
// plate is a 2D outline (THREE.Shape) that is extruded, tessellated and then wrapped onto that surface along a
// projection axis — the extruded outline is "bent" around the head, so plates have real thickness, bevelled edges
// and perfectly smooth cut-outs (eye slits, mouth slit, seams). All coordinates are in "head units":
// x ∈ ±0.8 (width), y ∈ ±1 (height), z ∈ ±0.92 (front = +z).
import * as THREE from 'three'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'

export const HEAD = { A: 0.82, B: 1.0, C: 0.92 }

const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
const sm = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const PX = 0.84 // <1 squares the sides / flattens the front
const PZ = 0.8

// jaw taper: the lower face narrows towards the chin (starts below the cheekbones → angular jaw)
const taper = (v) => 1 - 0.3 * sm(0.02, -0.7, v)
// flatter crown: lift the upper hemisphere
const yOf = (v) => (v > 0 ? HEAD.B * Math.pow(v, 0.86) : HEAD.B * v)
const yInv = (y) => (y > 0 ? Math.pow(y / HEAD.B, 1 / 0.86) : y / HEAD.B)
const gx = (u) => Math.sign(u) * Math.pow(Math.abs(u), PX)
const gxInv = (x) => Math.sign(x) * Math.pow(Math.abs(x), 1 / PX)
function zOf(v, w) {
  if (w >= 0) return HEAD.C * Math.pow(w, PZ) + 0.085 * sm(-0.3, -0.86, v) * sm(0.15, 0.75, w) // chin juts forward
  return -HEAD.C * 1.06 * Math.pow(-w, 0.88) * (1 - 0.2 * sm(-0.2, -0.95, v)) // longer crown, tucked nape
}
// unit-sphere direction (u,v,w) → head surface point
function surf(u, v, w, out) {
  return out.set(HEAD.A * taper(v) * gx(u), yOf(v), zOf(v, w))
}

const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)
const _d = new THREE.Vector3()
const _q = new THREE.Vector3()
const _t1 = new THREE.Vector3()
const _t2 = new THREE.Vector3()
const _p0 = new THREE.Vector3()
const _p1 = new THREE.Vector3()
const _p2 = new THREE.Vector3()
function normalAt(u, v, w, out) {
  _d.set(u, v, w).normalize()
  _t1.crossVectors(_d, Math.abs(_d.y) < 0.9 ? UP : RIGHT).normalize()
  _t2.crossVectors(_d, _t1).normalize()
  const e = 2e-3
  surf(_d.x, _d.y, _d.z, _p0)
  _q.copy(_d).addScaledVector(_t1, e).normalize()
  surf(_q.x, _q.y, _q.z, _p1)
  _q.copy(_d).addScaledVector(_t2, e).normalize()
  surf(_q.x, _q.y, _q.z, _p2)
  _p1.sub(_p0)
  _p2.sub(_p0)
  out.crossVectors(_p1, _p2).normalize()
  if (out.dot(_p0) < 0) out.negate()
  return out
}

function solveW(v, Z, limit) {
  const lim = limit ?? Math.sqrt(Math.max(0, 1 - v * v))
  let lo = -lim
  let hi = lim
  for (let i = 0; i < 17; i++) {
    const m = (lo + hi) * 0.5
    if (zOf(v, m) < Z) lo = m
    else hi = m
  }
  return (lo + hi) * 0.5
}

// Projects a 2D point (a = screen-right, b = screen-up as seen from the projection side) onto the head.
// Writes the surface point and its outward normal.
export function project(proj, a, b, outP, outN) {
  let u = 0
  let v = 0
  let w = 0
  if (proj === 'front' || proj === 'back') {
    const X = proj === 'front' ? a : -a
    v = clamp(yInv(b), -0.995, 0.995)
    const r = Math.sqrt(1 - v * v)
    u = clamp(gxInv(X / (HEAD.A * taper(v))), -r * 0.999, r * 0.999)
    w = Math.sqrt(Math.max(0, 1 - u * u - v * v)) * (proj === 'front' ? 1 : -1)
  } else if (proj === 'right' || proj === 'left') {
    const Z = proj === 'right' ? -a : a
    v = clamp(yInv(b), -0.995, 0.995)
    w = solveW(v, Z)
    u = Math.sqrt(Math.max(0, 1 - v * v - w * w)) * (proj === 'right' ? 1 : -1)
  } else {
    // top: screen right = +x, screen up = -z. On the upper head taper() == 1, so u follows from X directly;
    // then w is solved over its full range and v closes the unit vector.
    const X = a
    const Z = -b
    u = clamp(gxInv(X / HEAD.A), -0.999, 0.999)
    w = solveW(0.5, Z, Math.sqrt(1 - u * u))
    v = Math.sqrt(Math.max(0.0025, 1 - u * u - w * w))
  }
  surf(u, v, w, outP)
  normalAt(u, v, w, outN)
}

// ---------- shape helpers ----------
// Rounded polygon from [[x, y, cornerRadius], ...]
export function roundedPath(pts, path) {
  const n = pts.length
  const a = new THREE.Vector2()
  const c = new THREE.Vector2()
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const r = p[2] || 0
    const d1x = prev[0] - p[0]
    const d1y = prev[1] - p[1]
    const d2x = next[0] - p[0]
    const d2y = next[1] - p[1]
    const l1 = Math.hypot(d1x, d1y) || 1
    const l2 = Math.hypot(d2x, d2y) || 1
    const re = Math.min(r, l1 * 0.48, l2 * 0.48)
    a.set(p[0] + (d1x / l1) * re, p[1] + (d1y / l1) * re)
    c.set(p[0] + (d2x / l2) * re, p[1] + (d2y / l2) * re)
    if (i === 0) path.moveTo(a.x, a.y)
    else path.lineTo(a.x, a.y)
    if (re > 1e-5) path.quadraticCurveTo(p[0], p[1], c.x, c.y)
  }
  path.closePath()
  return path
}
export const mirrorHalf = (half) => [...half, ...half.slice(1, -1).reverse().map(([x, y, r]) => [-x, y, r])]
export const mirrorX = (pts) => pts.map(([x, y, r]) => [-x, y, r]).reverse()

export function shapeFrom(outline, holes = []) {
  const s = roundedPath(outline, new THREE.Shape())
  for (const h of holes) s.holes.push(roundedPath(h, new THREE.Path()))
  return s
}

const _P = new THREE.Vector3()
const _N = new THREE.Vector3()

// Wraps every vertex of a flat (x, y, z=offset) geometry onto the head. Projections are cached per 2D point
// (caps, walls and duplicated non-indexed vertices share them), which keeps the build fast.
function wrap(g, proj, base, relief) {
  const arr = g.attributes.position.array
  const cache = new Map()
  const pool = []
  for (let i = 0; i < arr.length; i += 3) {
    const a = arr[i]
    const b = arr[i + 1]
    const key = (Math.round(a * 20000) + 60000) * 131072 + (Math.round(b * 20000) + 60000)
    let c = cache.get(key)
    if (c === undefined) {
      project(proj, a, b, _P, _N)
      const r = relief ? relief(a, b) : 0
      c = pool.length
      pool.push(_P.x, _P.y, _P.z, _N.x, _N.y, _N.z, r)
      cache.set(key, c)
    }
    const d = base + arr[i + 2] + pool[c + 6]
    arr[i] = pool[c] + pool[c + 3] * d
    arr[i + 1] = pool[c + 1] + pool[c + 4] * d
    arr[i + 2] = pool[c + 2] + pool[c + 5] * d
  }
  g.attributes.position.needsUpdate = true
}

// Smooth normals that keep hard edges sharper than `crease` (typed-array version of toCreasedNormals).
function creasedNormals(g, crease) {
  const pos = g.attributes.position.array
  const nTri = pos.length / 9
  const fn = new Float32Array(nTri * 3)
  const fa = new Float32Array(nTri)
  for (let f = 0; f < nTri; f++) {
    const o = f * 9
    const ux = pos[o + 3] - pos[o]
    const uy = pos[o + 4] - pos[o + 1]
    const uz = pos[o + 5] - pos[o + 2]
    const vx = pos[o + 6] - pos[o]
    const vy = pos[o + 7] - pos[o + 1]
    const vz = pos[o + 8] - pos[o + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1e-12
    fn[f * 3] = nx / l
    fn[f * 3 + 1] = ny / l
    fn[f * 3 + 2] = nz / l
    fa[f] = l
  }
  // unique vertex ids by quantised position
  const nC = nTri * 3
  const ids = new Int32Array(nC)
  const map = new Map()
  let nv = 0
  for (let i = 0; i < nC; i++) {
    const o = i * 3
    const key = (Math.round(pos[o] * 4000) + 20000) * 1.6e9 + (Math.round(pos[o + 1] * 4000) + 20000) * 40000 + (Math.round(pos[o + 2] * 4000) + 20000)
    let id = map.get(key)
    if (id === undefined) {
      id = nv++
      map.set(key, id)
    }
    ids[i] = id
  }
  const off = new Int32Array(nv + 1)
  for (let i = 0; i < nC; i++) off[ids[i] + 1]++
  for (let v = 0; v < nv; v++) off[v + 1] += off[v]
  const cur = off.slice(0, nv)
  const faces = new Int32Array(nC)
  for (let i = 0; i < nC; i++) faces[cur[ids[i]]++] = (i / 3) | 0
  const cosC = Math.cos(crease)
  const out = new Float32Array(pos.length)
  for (let i = 0; i < nC; i++) {
    const f = (i / 3) | 0
    const v = ids[i]
    const fx = fn[f * 3]
    const fy = fn[f * 3 + 1]
    const fz = fn[f * 3 + 2]
    let sx = 0
    let sy = 0
    let sz = 0
    for (let j = off[v]; j < off[v + 1]; j++) {
      const gI = faces[j]
      const gx2 = fn[gI * 3]
      const gy2 = fn[gI * 3 + 1]
      const gz2 = fn[gI * 3 + 2]
      if (fx * gx2 + fy * gy2 + fz * gz2 >= cosC) {
        const w = fa[gI]
        sx += gx2 * w
        sy += gy2 * w
        sz += gz2 * w
      }
    }
    const l = Math.hypot(sx, sy, sz) || 1
    out[i * 3] = sx / l
    out[i * 3 + 1] = sy / l
    out[i * 3 + 2] = sz / l
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3))
  return g
}

// Extrude → tessellate → wrap onto the head along `proj`, offset outwards by `base`.
export function buildPlate(shape, { proj = 'front', depth = 0.035, base = 0.03, bevel = 0.012, maxEdge = 0.1, curveSegments = 6, crease = Math.PI / 4.5, relief = null } = {}) {
  let g = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.85,
    bevelSegments: 2,
  })
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = new TessellateModifier(maxEdge, 24).modify(g)
  wrap(g, proj, base, relief)
  creasedNormals(g, crease)
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

// Flat (zero-thickness) projected sheet, e.g. the glowing eye lenses.
export function buildSheet(shape, { proj = 'front', base = 0.02, maxEdge = 0.06, curveSegments = 5, relief = null } = {}) {
  let g = new THREE.ShapeGeometry(shape, curveSegments)
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  g = new TessellateModifier(maxEdge, 20).modify(g)
  wrap(g, proj, base, relief)
  g.computeVertexNormals()
  return g
}

// The dark under-suit skull that fills every seam.
export function buildSkull(segW = 96, segH = 72) {
  const g = new THREE.SphereGeometry(1, segW, segH)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    _d.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize()
    surf(_d.x, _d.y, _d.z, _P)
    if (_P.y < -0.9) _P.y = -0.9 + (_P.y + 0.9) * 0.15
    _P.multiplyScalar(0.992)
    pos.setXYZ(i, _P.x, _P.y, _P.z)
  }
  g.computeVertexNormals()
  return g
}

// ---------- the design ----------
// Sculpted face relief (added to the faceplate offset): angry brow ridge, sunken eye band, nose bridge,
// cheekbones, a recessed mouth line and a chin bump. This is what turns a gold dome into a face.
export function faceRelief(x, y) {
  const ax = Math.abs(x)
  const browY = 0.255 + ax * 0.085
  const brow = 0.04 * Math.exp(-(((y - browY) / 0.055) ** 2)) * sm(0.5, 0.36, ax)
  const socket = -0.018 * Math.exp(-(((y - (0.13 + ax * 0.08)) / 0.07) ** 2)) * sm(0.5, 0.4, ax)
  const nose = 0.032 * Math.exp(-((x / 0.075) ** 2)) * sm(-0.4, -0.12, y) * sm(0.3, 0.1, y)
  const cheek = 0.028 * Math.exp(-(((ax - 0.33) / 0.11) ** 2 + ((y + 0.16) / 0.13) ** 2))
  const mouth = -0.016 * Math.exp(-(((y + 0.52) / 0.045) ** 2)) * sm(0.32, 0.22, ax)
  const chin = 0.026 * Math.exp(-(((y + 0.75) / 0.1) ** 2)) * sm(0.22, 0.02, ax)
  const forehead = 0.012 * Math.exp(-(((y - 0.42) / 0.08) ** 2)) * sm(0.4, 0.0, ax)
  return brow + socket + nose + cheek + mouth + chin + forehead
}
// Faceplate (gold): a central mask + two cheek plates, separated by the classic diagonal cheek seams.
const MASK_HALF = [
  [0, 0.43, 0.0],
  [0.1, 0.49, 0.03],
  [0.4, 0.49, 0.08],
  [0.5, 0.36, 0.08],
  [0.525, 0.12, 0.03],
  [0.497, 0.045, 0.0],
  [0.262, -0.43, 0.03],
  [0.222, -0.852, 0.03],
  [0, -0.905, 0],
]
const CHEEK_R = [
  [0.525, 0.005, 0.004],
  [0.49, -0.085, 0.04],
  [0.462, -0.3, 0.07],
  [0.36, -0.6, 0.09],
  [0.25, -0.85, 0.03],
  [0.29, -0.442, 0.03],
]
export const EYE_R = [
  [0.068, 0.104, 0.008],
  [0.106, 0.152, 0.012],
  [0.37, 0.212, 0.016],
  [0.43, 0.196, 0.01],
  [0.405, 0.13, 0.012],
  [0.16, 0.07, 0.01],
]
const MOUTH = [
  [-0.17, -0.5, 0.006],
  [0.17, -0.5, 0.006],
  [0.222, -0.548, 0.006],
  [0.205, -0.563, 0.004],
  [0.16, -0.528, 0.004],
  [-0.16, -0.528, 0.004],
  [-0.205, -0.563, 0.004],
  [-0.222, -0.548, 0.006],
]
// crown (top projection: a = x, b = -z)
const CROWN_HALF = [
  [0, -0.9, 0],
  [0.34, -0.85, 0.12],
  [0.56, -0.68, 0.16],
  [0.72, -0.3, 0.2],
  [0.73, 0.3, 0.24],
  [0.55, 0.72, 0.24],
  [0.27, 0.86, 0.12],
  [0, 0.88, 0],
]
const CREST_HALF = [
  [0, -0.905, 0],
  [0.055, -0.87, 0.02],
  [0.088, -0.55, 0.04],
  [0.092, 0.5, 0.06],
  [0.07, 0.86, 0.04],
  [0, 0.88, 0],
]
// back of the head (back projection: a = -x, b = y)
const BACK_HALF = [
  [0, 0.5, 0],
  [0.4, 0.47, 0.14],
  [0.56, 0.05, 0.2],
  [0.44, -0.6, 0.16],
  [0.26, -0.84, 0.08],
  [0, -0.87, 0],
]

const _A = new THREE.Vector3()
const _B = new THREE.Vector3()
// Side plate (right): its front edge follows the faceplate outline (tucked under it), the rest wraps to the back.
function sidePlateOutline() {
  const edge = [
    [0.4, 0.49],
    [0.5, 0.36],
    [0.525, 0.12],
    [0.525, 0.005],
    [0.49, -0.085],
    [0.462, -0.3],
    [0.36, -0.6],
    [0.25, -0.85],
  ]
  const pts = []
  for (const [x, y] of edge) {
    project('front', x, y, _A, _B)
    pts.push([-(_A.z + 0.07), y, 0.06]) // a = -z (screen right = back of the head)
  }
  pts[0][2] = 0.05
  pts[pts.length - 1][2] = 0.04
  // jaw bottom → nape → back of the crown → top edge under the crown plate
  pts.push([-0.12, -0.9, 0.08])
  pts.push([0.5, -0.8, 0.12])
  pts.push([0.78, -0.3, 0.2])
  pts.push([0.86, 0.36, 0.14])
  pts.push([0.5, 0.46, 0.1])
  pts.push([-0.2, 0.52, 0.06])
  // winding: ExtrudeGeometry normalises it
  return pts
}

export function buildHelmetGeometries({ quality = 1 } = {}) {
  const me = 0.1 / quality // tessellation edge length (chord error stays < 0.002 head units)
  const mask = buildPlate(shapeFrom(mirrorHalf(MASK_HALF), [EYE_R, mirrorX(EYE_R), MOUTH]), { proj: 'front', base: 0.042, depth: 0.036, maxEdge: me * 0.7, relief: faceRelief })
  const cheekR = buildPlate(shapeFrom(CHEEK_R), { proj: 'front', base: 0.042, depth: 0.036, maxEdge: me * 0.7, relief: faceRelief })
  const cheekL = buildPlate(shapeFrom(mirrorX(CHEEK_R)), { proj: 'front', base: 0.042, depth: 0.036, maxEdge: me * 0.7, relief: faceRelief })
  const crown = buildPlate(shapeFrom(mirrorHalf(CROWN_HALF)), { proj: 'top', base: 0.03, depth: 0.034, maxEdge: me * 1.3 })
  const crest = buildPlate(shapeFrom(mirrorHalf(CREST_HALF)), { proj: 'top', base: 0.064, depth: 0.03, bevel: 0.01, maxEdge: me })
  const side = sidePlateOutline()
  const sideR = buildPlate(shapeFrom(side), { proj: 'right', base: 0.018, depth: 0.034, maxEdge: me * 1.3 })
  const sideL = buildPlate(shapeFrom(side.map(([a, b, r]) => [-a, b, r]).reverse()), { proj: 'left', base: 0.018, depth: 0.034, maxEdge: me * 1.3 })
  const back = buildPlate(shapeFrom(mirrorHalf(BACK_HALF)), { proj: 'back', base: 0.008, depth: 0.03, maxEdge: me * 1.3 })
  const eyes = buildSheet(shapeFrom(EYE_R.map(([x, y]) => [x, y, 0.01])), { proj: 'front', base: 0.036, relief: faceRelief })
  const eyesL = buildSheet(shapeFrom(mirrorX(EYE_R).map(([x, y]) => [x, y, 0.01])), { proj: 'front', base: 0.036, relief: faceRelief })
  const skull = buildSkull(Math.round(80 * quality), Math.round(60 * quality))

  // ear disc placement (right side); the left one is mirrored
  const earP = new THREE.Vector3()
  const earN = new THREE.Vector3()
  project('right', 0.14, 0.02, earP, earN)

  // a few anchor points (head units) used by the HUD leader lines
  const anchors = {}
  const pA = new THREE.Vector3()
  const nA = new THREE.Vector3()
  project('front', 0.0, 0.32, pA, nA)
  anchors.forehead = pA.clone().addScaledVector(nA, 0.08)
  project('top', 0.0, 0.1, pA, nA)
  anchors.crown = pA.clone().addScaledVector(nA, 0.1)
  project('front', -0.4, -0.3, pA, nA)
  anchors.cheek = pA.clone().addScaledVector(nA, 0.08)
  anchors.ear = earP.clone().addScaledVector(earN, 0.08)
  project('front', 0.26, 0.15, pA, nA)
  anchors.eyeR = pA.clone().addScaledVector(nA, 0.04)
  project('front', -0.26, 0.15, pA, nA)
  anchors.eyeL = pA.clone().addScaledVector(nA, 0.04)

  return { mask, cheekR, cheekL, crown, crest, sideR, sideL, back, eyes, eyesL, skull, earP, earN, anchors }
}

// Ear disc: a lathe-turned cap with a recessed groove (axis = +Y; orient to the surface normal when placing).
export function buildEarGeometry() {
  const prof = [
    [0.0, 0.085],
    [0.1, 0.085],
    [0.12, 0.074],
    [0.13, 0.055],
    [0.148, 0.05],
    [0.16, 0.072],
    [0.2, 0.08],
    [0.24, 0.07],
    [0.262, 0.04],
    [0.265, -0.02],
    [0.0, -0.02],
  ].map(([r, h]) => new THREE.Vector2(r, h))
  const g = new THREE.LatheGeometry(prof, 56)
  g.computeVertexNormals()
  return g
}

// Ribbed neck collar under the helmet (lathe, slightly oval).
export function buildCollarGeometry() {
  const prof = [
    [0.3, -0.8],
    [0.42, -0.84],
    [0.44, -0.9],
    [0.41, -0.93],
    [0.43, -0.97],
    [0.4, -1.0],
    [0.42, -1.04],
    [0.39, -1.07],
    [0.405, -1.11],
    [0.34, -1.15],
    [0.26, -1.16],
  ].map(([r, h]) => new THREE.Vector2(r, h))
  const g = new THREE.LatheGeometry(prof, 64)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * 0.86 - 0.06)
  g.computeVertexNormals()
  return g
}
