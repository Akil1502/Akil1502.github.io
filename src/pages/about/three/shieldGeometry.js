import * as THREE from 'three'

/* ------------------------------------------------------------------------------------------------
 * The round shield, built procedurally (original artwork, unit radius, front faces +Z):
 *   - four lathed bands following a shallow convex dome: flag-red outer ring, brushed silver ring,
 *     flag-red inner ring, star-spangled blue core; each band has rounded edges so a fine groove
 *     catches light between the rings
 *   - a rolled, polished rim that wraps round to a concave gunmetal back
 *   - an extruded, bevelled five-point star bent onto the dome
 *   - leather grip straps + a centre pad on the back (seen during the inspection turn and the throws)
 * The silver uses MeshPhysicalMaterial anisotropy on the high tier: the lathe UVs run round the
 * circumference, so highlights stretch into concentric "spun metal" arcs.
 * ---------------------------------------------------------------------------------------------- */

export const DOME = 0.16 // front-centre height above the rim plane
export const THICK = 0.062 // shell thickness
export const STAR_OUTER = 0.395
export const STAR_INNER = STAR_OUTER * 0.382 // regular pentagram ratio

export const domeZ = (r) => DOME * (1 - r * r)
const backZ = (r) => domeZ(r) - THICK

export const BANDS = [
  { key: 'outer', r0: 0.8, r1: 1.0, mat: 'red' },
  { key: 'silver', r0: 0.6, r1: 0.8, mat: 'silver' },
  { key: 'inner', r0: 0.41, r1: 0.6, mat: 'red' },
  { key: 'core', r0: 0, r1: 0.41, mat: 'blue' },
]

const V = (r, z) => new THREE.Vector2(Math.max(0, r), z)

// One band's profile, outer edge → inner edge, with rounded shoulders dipping into a groove at both edges.
function bandProfile(r0, r1, steps) {
  const g = 0.008 // groove depth
  const e = 0.016 // shoulder width
  const pts = []
  pts.push(V(r1, domeZ(r1) - g))
  pts.push(V(r1 - e * 0.3, domeZ(r1 - e * 0.3) - g * 0.32))
  pts.push(V(r1 - e, domeZ(r1 - e)))
  const inner = r0 > 0 ? r0 + e : 0
  for (let i = 1; i < steps; i++) {
    const r = r1 - e + (inner - (r1 - e)) * (i / steps)
    pts.push(V(r, domeZ(r)))
  }
  if (r0 > 0) {
    pts.push(V(r0 + e, domeZ(r0 + e)))
    pts.push(V(r0 + e * 0.3, domeZ(r0 + e * 0.3) - g * 0.32))
    pts.push(V(r0, domeZ(r0) - g))
  } else {
    pts.push(V(0, domeZ(0)))
  }
  return pts
}

// Rolled rim: front edge → over the lip → the back's outer edge.
function rimProfile() {
  return [V(1.0, domeZ(1.0) - 0.008), V(1.011, -0.013), V(1.021, -0.027), V(1.025, -0.043), V(1.019, -0.06), V(1.004, -0.07), V(0.982, backZ(0.982) - 0.004)]
}
// Concave back: from just inside the rim to the centre.
function backProfile(steps) {
  const pts = [V(0.982, backZ(0.982) - 0.004)]
  for (let i = 1; i <= steps; i++) {
    const r = 0.982 * (1 - i / steps)
    pts.push(V(r, backZ(r)))
  }
  return pts
}

function lathe(pts, segments) {
  const g = new THREE.LatheGeometry(pts, segments)
  g.rotateX(Math.PI / 2) // lathe axis (+Y) → shield normal (+Z)
  return g
}

function starShape(ro, ri) {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? ri : ro
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  s.closePath()
  return s
}

// Bends every vertex of a flat (XY) geometry onto the dome: z += dome(r) + lift.
function bendOntoDome(geo, lift, surface = domeZ) {
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const y = p.getY(i)
    p.setZ(i, p.getZ(i) + surface(Math.hypot(x, y)) + lift)
  }
  p.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

export function buildShieldGeometries(segments = 128) {
  const bands = BANDS.map((b) => lathe(bandProfile(b.r0, b.r1, b.r0 > 0 ? 6 : 10), segments))
  const rim = lathe(rimProfile(), segments)
  const back = lathe(backProfile(12), Math.max(48, segments >> 1))

  const star = new THREE.ExtrudeGeometry(starShape(STAR_OUTER, STAR_INNER), {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 1,
  })
  bendOntoDome(star, -0.012)

  // grip straps: thin boxes with many x-segments, bent along the concave back (they sit just behind it)
  // arm strap (long) + hand grip (short), like a real round-shield back
  const strapA = new THREE.BoxGeometry(1.36, 0.13, 0.024, 28, 1, 1)
  strapA.translate(0, 0.1, 0)
  bendOntoDome(strapA, -0.026, backZ)
  const strapB = new THREE.BoxGeometry(0.46, 0.085, 0.034, 12, 1, 1)
  strapB.translate(0, -0.3, 0)
  bendOntoDome(strapB, -0.034, backZ)
  const pad = new THREE.CylinderGeometry(0.1, 0.1, 0.026, 24)
  pad.rotateX(Math.PI / 2)
  pad.translate(0, 0.1, backZ(0.1) - 0.04)

  return { bands, rim, back, star, straps: [strapA, strapB], pad }
}

export function disposeShieldGeometries(g) {
  if (!g) return
  g.bands.forEach((b) => b.dispose())
  g.rim.dispose()
  g.back.dispose()
  g.star.dispose()
  g.straps.forEach((s) => s.dispose())
  g.pad.dispose()
}

// Spun-metal roughness map: rows (lathe v = radial) vary slowly → concentric rings; sparse scratches on top.
export function makeBrushedTexture(w = 128, h = 512) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  const img = g.createImageData(w, h)
  let seed = 1337
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const rows = new Float32Array(h)
  let v = 0.8
  for (let y = 0; y < h; y++) {
    v += (rnd() - 0.5) * 0.14
    v = Math.min(1, Math.max(0.56, v))
    rows[y] = v
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = rows[y] * (0.93 + rnd() * 0.07)
      const i = (y * w + x) * 4
      const b = Math.round(n * 255)
      img.data[i] = b
      img.data[i + 1] = b
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  g.globalAlpha = 0.32
  g.lineCap = 'round'
  for (let k = 0; k < 120; k++) {
    g.strokeStyle = rnd() > 0.45 ? '#ffffff' : '#6c6c6c'
    g.lineWidth = rnd() * 1.1 + 0.3
    g.beginPath()
    const x = rnd() * w
    const y = rnd() * h
    g.moveTo(x, y)
    g.lineTo(x + (rnd() - 0.5) * 40, y + (rnd() - 0.5) * 18)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}

export function makeShieldMaterials(tier = 'high') {
  const phys = tier === 'high'
  const brushed = makeBrushedTexture()
  const M = phys ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  const side = THREE.DoubleSide
  const paint = phys ? { clearcoat: 0.75, clearcoatRoughness: 0.24 } : {}
  const red = new M({ color: '#b8141f', metalness: 0.42, roughness: 0.42, roughnessMap: brushed, envMapIntensity: 1.25, side, ...paint })
  const blue = new M({ color: '#1c3fa6', metalness: 0.42, roughness: 0.4, roughnessMap: brushed, envMapIntensity: 1.25, side, ...paint })
  const silver = new M({
    color: '#dfe4ec',
    metalness: 1,
    roughness: 0.38,
    roughnessMap: brushed,
    envMapIntensity: 1.45,
    side,
    ...(phys ? { anisotropy: 0.75 } : {}),
  })
  const star = new M({ color: '#e4e8f0', metalness: 1, roughness: 0.3, roughnessMap: brushed, envMapIntensity: 1.8, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.0, side })
  const rim = new M({ color: '#c3c9d3', metalness: 1, roughness: 0.3, roughnessMap: brushed, envMapIntensity: 1.6, side })
  const back = new THREE.MeshStandardMaterial({ color: '#454b56', metalness: 0.92, roughness: 0.55, roughnessMap: brushed, envMapIntensity: 1.1, side })
  const leather = new THREE.MeshStandardMaterial({ color: '#2a1810', roughness: 0.82, metalness: 0.05 })
  const all = { red, blue, silver, star, rim, back, leather }
  return {
    ...all,
    dispose() {
      Object.values(all).forEach((m) => m.dispose())
      brushed.dispose()
    },
  }
}
