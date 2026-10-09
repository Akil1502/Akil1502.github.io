// Tiny mutable bus between the Skills DOM (SkillsPage) and its 3D storm (SkillsScene). Read in rAF / useFrame
// loops only, never through React state.
//   storm.hover    DOM -> 3D  stone index (0..12) under the pointer / focus, -1 when none
//   storm.feature  DOM -> 3D  stone the page is currently "about" (last skill card scrolled in); setFeature()
//                             also notifies DOM listeners (the rune-lock readout)
//   storm.queue    DOM -> 3D  pending LIGHTNING STRIKES { target, power } (target: stone index, -1 = sky -> hammer)
//   storm.flash    3D -> DOM  callback(power) fired by every strike that lands: the DOM white flash
//   storm.charge   3D -> DOM  0..1 hammer charge (drives the HUD charge readout)
//   storm.screen   3D -> DOM  projected screen px of the hammer head / grip (HUD callouts) + current beat value
export const storm = {
  hover: -1,
  feature: -1,
  queue: [],
  flash: null,
  charge: 0,
  lastStrike: -1,
  screen: null,
}

const listeners = new Set()

export function onFeature(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setFeature(i) {
  if (storm.feature === i) return
  storm.feature = i
  listeners.forEach((fn) => fn(i))
}

export function setHover(i) {
  storm.hover = i
  listeners.forEach((fn) => fn(i >= 0 ? i : storm.feature))
}

export function callStrike(target, power = 1) {
  if (storm.queue.length < 24) storm.queue.push({ target, power })
}

export function resetStorm() {
  storm.hover = -1
  storm.feature = -1
  storm.queue.length = 0
  storm.charge = 0
  storm.lastStrike = -1
}
