import { scroll } from '../../three/scrollStore'

/* EXPERIENCE (Black Widow): the contract between the DOM choreographer (ExperiencePage) and the 3D layer
   (ExperienceScene + ./three/*). Everything lives on `scroll.xp` so useFrame can read it without React state.
   Stamps are performance.now() / 1000 on both sides (never the R3F clock) so DOM and 3D beats line up.

   xp.intro      number   stamp of the page intro (title slam): the 3D emblem ASSEMBLES from it      DOM → 3D
   xp.arc        number   stamp of the latest DECRYPT flare: the batons crackle arcs from it          DOM → 3D
   xp.arcPower   number   0..1 strength of that flare
   xp.impact     number   stamp of the latest IMPACT (floor shockwave + tripwire flash)              DOM → 3D
   xp.land       number[] per mission file: stamp it landed (rail node shockwave), 0 = not yet        DOM → 3D
   xp.hover      number   hovered mission file index, -1 = none (batons over-charge)                  DOM → 3D
   xp.decrypting number   count of decrypts running right now (sustains a low crackle)                DOM → 3D */

export const STRIKE_KEYS = [0, 0.7, 0.15, 1, 0.4, 1] // shared lamp-strike flicker
export const STRIKE_DURATION = 0.7

export const nowSec = () => performance.now() / 1000

export function initXp(reset = false) {
  if (!scroll.xp || reset) {
    scroll.xp = { intro: 0, arc: 0, arcPower: 0, arcSeed: 0, impact: 0, land: [0, 0], hover: -1, decrypting: 0 }
  }
  return scroll.xp
}

// Removes the page's custom store field (called on unmount by both the DOM page and the 3D scene, so nothing of
// this page lingers on `scroll` for the next route; a late reader simply re-creates the defaults).
export function clearXp() {
  delete scroll.xp
}

// Disposes GPU resources created by hand (useMemo) — R3F only auto-disposes what is declared in JSX.
export function disposeAll(...items) {
  for (const it of items) {
    if (!it) continue
    if (Array.isArray(it)) disposeAll(...it)
    else if (typeof it.dispose === 'function') it.dispose()
  }
}

// DECRYPT flare: the batons discharge (strength 0..1).
export function flare(power = 1) {
  const x = initXp()
  x.arc = nowSec()
  x.arcPower = power
  x.arcSeed++
}

// IMPACT: camera jolt + floor shockwave + tripwire flash. Once per beat.
export function impact(v = 0.45) {
  const x = initXp()
  scroll.impulse = Math.max(scroll.impulse || 0, v)
  x.impact = nowSec()
}

// Seconds since a stamp (-1 when it never happened).
export function age(stamp) {
  if (!stamp) return -1
  return Math.max(0, nowSec() - stamp)
}

// 1 at the stamp, exponential decay afterwards; 0 when it never happened.
export function decay(stamp, rate = 3) {
  const a = age(stamp)
  if (a < 0 || a > 12 / rate) return 0
  return Math.exp(-a * rate)
}

// Lamp-strike curve from a stamp: 0 before, flickers through the keys, then holds at 1.
export function strikeCurve(stamp, delay = 0) {
  const a = age(stamp)
  if (a < 0) return 0
  const k = a - delay
  if (k < 0) return 0
  if (k >= STRIKE_DURATION) return 1
  const f = (k / STRIKE_DURATION) * (STRIKE_KEYS.length - 1)
  const i = Math.min(STRIKE_KEYS.length - 2, Math.floor(f))
  return STRIKE_KEYS[i] + (STRIKE_KEYS[i + 1] - STRIKE_KEYS[i]) * (f - i)
}

export function backOut(k, c = 1.7) {
  if (k <= 0) return 0
  if (k >= 1) return 1
  const u = k - 1
  return 1 + (c + 1) * u * u * u + c * u * u
}

export const easeOutCubic = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)
export const easeInOut = (k) => {
  const t = Math.min(1, Math.max(0, k))
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Deterministic 0..1 hash.
export function hash01(i, k = 0) {
  const s = Math.sin(i * 12.9898 + k * 78.233 + 0.5) * 43758.5453
  return s - Math.floor(s)
}
