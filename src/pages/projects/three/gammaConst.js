import * as THREE from 'three'

// Palette + world layout for the HULK page. Everything 3D on this page reads from here.
export const COL = {
  bg: '#040805',
  green: '#7cff4f', // gamma green (hero / numbers)
  lime: '#c6ff9e', // pale gamma (HUD lines)
  greenDeep: '#1f7a12',
  greenBase: '#3fae2a', // "metal" body of green parts
  purple: '#7a3fb0', // torn-trouser purple (drama)
  purpleHi: '#a46be8', // purple that still reads as an emissive line on black
  rock: '#141a14',
  rockHi: '#28322a',
  dust: '#9fb59a',
}

// The cracked ground lives in a group at y = GROUND_Y (the group sinks while the lineup is on screen so the
// DOM-anchored machines can never be occluded). The impact crater is centred at (CX, CZ) in group space.
export const GROUND_Y = -2.6
export const CX = 1.6
export const CZ = -6.6
export const GROUND_W = 46
export const GROUND_D = 40
export const GROUND_Z0 = 6 // near edge (towards the camera)

// Deterministic value noise (same numbers on every visit) for the baked ground relief.
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

// Height of the cracked ground at (x, z) in group space: a bowl-shaped impact crater with a heaved rim, rubble
// relief and a few broken terraces further out.
export function groundHeight(x, z) {
  const dx = x - CX
  const dz = z - CZ
  const r = Math.sqrt(dx * dx + dz * dz)
  const a = Math.atan2(dz, dx)
  const bowl = -1.05 * Math.exp(-(r / 2.1) * (r / 2.1))
  // the rim is lumpy: heaved plates are higher on some bearings than others
  const rimH = 0.5 + 0.22 * Math.sin(a * 5 + 1.3) + 0.12 * Math.sin(a * 11)
  const rim = rimH * Math.exp(-((r - 2.55) / 0.75) * ((r - 2.55) / 0.75))
  const rubble = (vnoise(x * 0.9, z * 0.9) - 0.5) * 0.32 + (vnoise(x * 2.3 + 7, z * 2.3) - 0.5) * 0.12
  // stepped breaks: the ground has dropped along a few fault lines
  const fault = Math.floor(vnoise(x * 0.22 + 3, z * 0.22 - 2) * 3) * 0.12
  const far = Math.min(1, r / 6)
  return bowl + rim + rubble * (0.5 + 0.5 * far) + fault * far
}

export const tmpObj = new THREE.Object3D()
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
