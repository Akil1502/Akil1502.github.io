// Home (Iron Man) page — tiny mutable store shared by the DOM page and the 3D scene, plus the scroll choreography.
// Everything is read/written inside rAF / useFrame; nothing here triggers React renders.
import { scroll } from '../../three/scrollStore'

export const BEATS = ['home-suitup', 'home-diagnostic', 'home-repulsor', 'home-identity', 'home-select', 'home-next']

export const home = {
  b: 0, // continuous beat coordinate: i + fraction through section i (0 = suit-up top … 5 = next-page top)
  pin: [0, 0, 0, 0, 0, 0], // per-beat progress through the sticky (pinned) part, 0..1
  portrait: false,
  // values written by the scene, read by the DOM
  reveal: 0, // 0..1 how much of the armour is formed
  charge: 0, // repulsor charge 0..1
  eyes: 0, // eye power 0..1
  flash: 0, // impact flash 0..1 (DOM overlay)
  introDone: false,
  // written by the DOM, read by the scene
  look: { x: 0, y: 0, active: false }, // hovered hero card → helmet looks at it
  ready: false,
}

// Back to a clean slate (called when the page or its scene unmounts, so a revisit replays the suit-up and no
// stale hover / flash state leaks into the next visit).
export function resetHome() {
  home.b = 0
  home.pin.fill(0)
  home.reveal = 0
  home.charge = 0
  home.eyes = 0
  home.flash = 0
  home.introDone = false
  home.look.active = false
  home.look.x = 0
  home.look.y = 0
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ss = (t) => t * t * (3 - 2 * t)

// Updates home.b and home.pin from the measured sections + current scroll position.
export function updateBeats() {
  const y = scroll.y || 0
  const vh = scroll.vh || (typeof window !== 'undefined' ? window.innerHeight : 800)
  let b = 0
  let found = false
  for (let i = 0; i < BEATS.length; i++) {
    const s = scroll.sections[BEATS[i]]
    if (!s) continue
    const pinLen = Math.max(1, s.height - vh)
    home.pin[i] = clamp((y - s.top) / pinLen, 0, 1)
    const next = scroll.sections[BEATS[i + 1]]
    const end = next ? next.top : s.top + s.height
    if (!found && y < end) {
      b = i + clamp((y - s.top) / Math.max(1, end - s.top), 0, 1)
      found = true
    }
  }
  if (!found) b = BEATS.length
  home.b = b
  return b
}

// Piecewise smoothstep track: keys = [[b, v], ...] sorted by b. Keep key arrays as module constants (no per-frame
// allocation).
export function track(b, keys) {
  if (b <= keys[0][0]) return keys[0][1]
  for (let i = 0; i < keys.length - 1; i++) {
    const k0 = keys[i]
    const k1 = keys[i + 1]
    if (b <= k1[0]) {
      const t = ss(clamp((b - k0[0]) / Math.max(1e-6, k1[0] - k0[0]), 0, 1))
      return k0[1] + (k1[1] - k0[1]) * t
    }
  }
  return keys[keys.length - 1][1]
}

// Interpolates keyframe objects ({ b, ...fields }) into `out` with smoothstep easing.
export function trackObj(b, frames, out) {
  if (b <= frames[0].b) return Object.assign(out, frames[0])
  const last = frames[frames.length - 1]
  if (b >= last.b) return Object.assign(out, last)
  for (let i = 0; i < frames.length - 1; i++) {
    const f0 = frames[i]
    const f1 = frames[i + 1]
    if (b <= f1.b) {
      const t = ss(clamp((b - f0.b) / Math.max(1e-6, f1.b - f0.b), 0, 1))
      for (const k in f0) if (k !== 'b') out[k] = f0[k] + ((f1[k] ?? f0[k]) - f0[k]) * t
      out.b = b
      return out
    }
  }
  return out
}
