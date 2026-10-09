// Shared choreography for the CONTACT page (Avengers · team assemble). Both the DOM (ContactPage) and the 3D
// director (ContactScene) read these numbers, so a token landing in 3D and its roll-call row locking in the DOM
// happen on exactly the same scroll position.
import { scroll, clamp, smoothstep } from '../../three/scrollStore'

export const SEC = {
  hero: 'contact-hero',
  channels: 'contact-channels',
  call: 'contact-call',
  credits: 'contact-credits',
}

// The six team tokens, in formation order (clockwise from the top). `page` ties each to its hero page of the site,
// `channel` to the contact card it delivers in the comms array. Colours are each hero's own palette.
export const TEAM = [
  { key: 'reactor', page: 'home', hero: 'Iron Man', short: 'IRON MAN', color: '#7fe9ff', tint: '#e8232a', channel: 'Email', role: 'Comms' },
  { key: 'shield', page: 'about', hero: 'Captain America', short: 'CAPTAIN AMERICA', color: '#3d74ff', tint: '#c8202f', channel: 'Phone', role: 'Direct line' },
  { key: 'hammer', page: 'skills', hero: 'Thor', short: 'THOR', color: '#8fd8ff', tint: '#d9b25c', channel: 'LinkedIn', role: 'Bifrost link' },
  { key: 'hourglass', page: 'experience', hero: 'Black Widow', short: 'BLACK WIDOW', color: '#ff2a44', tint: '#a7b0bb', channel: 'Résumé', role: 'Dossier' },
  { key: 'gamma', page: 'projects', hero: 'Hulk', short: 'HULK', color: '#7cff4f', tint: '#7a3fb0', channel: 'GitHub', role: 'Heavy lifting' },
  { key: 'mandala', page: 'certifications', hero: 'Doctor Strange', short: 'DOCTOR STRANGE', color: '#ffa63d', tint: '#38f29a', channel: 'Location', role: 'Sanctum' },
]

// Pinned hero stage, as fractions of its own pinned scroll distance.
export const HERO = {
  arriveStart: 0.13, // first portal opens
  arriveStep: 0.07, // one hero every 7 %
  arriveLen: 0.095, // flight time of one hero (portal → slot)
  ignite: 0.62, // all six locked → beacon ignites (lamp strike + impact)
  tilt0: 0.6,
  tilt1: 0.78, // formation lies down into the "circle" shot
  slam: 0.67, // LET'S ASSEMBLE slams in
  orbit0: 0.7, // the 360° orbit begins
}
export const arriveStart = (i) => HERO.arriveStart + i * HERO.arriveStep
export const arriveK = (p, i) => clamp((p - arriveStart(i)) / HERO.arriveLen, 0, 1)
export const landedCount = (p) => {
  let n = 0
  for (let i = 0; i < TEAM.length; i++) if (arriveK(p, i) >= 1) n++
  return n
}

// 0..1 through the pinned stage (0 = stage pinned at the top, 1 = about to un-pin).
export function heroProgress() {
  const s = scroll.sections[SEC.hero]
  if (!s) return 0
  const vh = scroll.vh || (typeof window !== 'undefined' ? window.innerHeight : 800)
  return clamp((scroll.y - s.top) / Math.max(1, s.height - vh), 0, 1)
}

// 0 while the section's top edge sits `from` viewport-heights below the viewport top, 1 once it reaches `to`.
export function sectionEnter(id, from = 1, to = 0.2) {
  const s = scroll.sections[id]
  if (!s) return 0
  const vh = scroll.vh || (typeof window !== 'undefined' ? window.innerHeight : 800)
  return smoothstep(from, to, (s.top - scroll.y) / vh)
}

// 0..1 how far the section's bottom edge has travelled from `from` to `to` (viewport heights from the top).
export function sectionLeave(id, from = 1, to = 0) {
  const s = scroll.sections[id]
  if (!s) return 0
  const vh = scroll.vh || (typeof window !== 'undefined' ? window.innerHeight : 800)
  return smoothstep(from, to, (s.top + s.height - scroll.y) / vh)
}

// Store fields owned by this page (reset on unmount by ContactPage):
//   scroll.ctCardOn[i]  card i has opened its portal (DOM reveal fired)
//   scroll.ctHover      index of the hovered channel card, or -1
//   scroll.ctEmail      1 while an email link is hovered/focused → all six tokens lean in, vortex surges
export function resetContactStore() {
  scroll.ctCardOn = [false, false, false, false, false, false]
  scroll.ctHover = -1
  scroll.ctEmail = 0
}
if (!scroll.ctCardOn) resetContactStore()

// Lamp strike: arrival flicker keyframes over 0.7 s.
const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]
export const STRIKE_T = 0.7
export function lampStrike(t) {
  if (t <= 0) return 0
  if (t >= STRIKE_T) return 1
  const f = (t / STRIKE_T) * (STRIKE.length - 1)
  const i = Math.floor(f)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (f - i)
}
export const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3)
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
const BK = 1.9
export const backOut = (k) => {
  if (k <= 0) return 0
  if (k >= 1) return 1
  const x = k - 1
  return 1 + (BK + 1) * x * x * x + BK * x * x
}
// rises a→b, holds, falls c→d
export const bump = (x, a, b, c, d) => smoothstep(a, b, x) * (1 - smoothstep(c, d, x))
