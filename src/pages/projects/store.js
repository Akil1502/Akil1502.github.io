// Shared state for the PROJECTS (HULK) page. Both lazy chunks (ProjectsPage = DOM, ProjectsScene = GL) import this
// module, so it is the hand-off point between GSAP choreography and the three.js frame loop. Nothing here causes
// React renders: the DOM writes, the GL reads inside useFrame.
//
//   gamma.smashes   queue of SMASH requests { sx, sy, power, big, crack } in CSS pixels (null sx = crater centre).
//                   The GL drains it every frame: ground shockwave + shards jump + dust burst + flash + cracks flare.
//   gamma.landed    { [projectId]: ms } performance.now() when that card smashed down → its 3D machine assembles
//   gamma.runBeat   { id, t } | null   SMASH button on a card → that machine replays its beat
//   gamma.index     0..n-1             card currently centred in the lineup (3D emphasis)
//   gamma.hover     { id, rx, ry }     hovered card tilt in degrees (machine tilts with it)
//   gamma.rowHover  index | -1         roll-call row under the pointer (crater glow pulses)
//   gamma.crack     0..1               how far the fissures have spread (raised by every smash, never lowered)
//   gamma.live      bool               the page is on screen (loader + transition finished)
//   gamma.breach    seconds            performance.now()/1000 when containment broke (hero beat B)
export const gamma = {
  smashes: [],
  landed: {},
  runBeat: null,
  index: 0,
  hover: null,
  rowHover: -1,
  crack: 0,
  live: false,
  breach: 0,
  lastSmash: -10,
}

export function resetGamma() {
  gamma.smashes.length = 0
  gamma.landed = {}
  gamma.runBeat = null
  gamma.index = 0
  gamma.hover = null
  gamma.rowHover = -1
  gamma.crack = 0
  gamma.live = false
  gamma.breach = 0
  gamma.lastSmash = -10
}

// SMASH: queue a ground-pound for the GL and kick the camera. (sx, sy) is the screen point the blow lands on
// (CSS px); the GL projects it onto the cracked ground. `crack` raises how far the fissures have spread.
export function requestSmash({ sx = null, sy = null, power = 0.6, big = false, crack = 0 } = {}) {
  gamma.smashes.push({ sx, sy, power, big, crack })
  if (gamma.smashes.length > 6) gamma.smashes.shift()
  gamma.lastSmash = performance.now() / 1000
  if (typeof window !== 'undefined' && window.__portfolioImpulse) window.__portfolioImpulse(power)
}

export const REDUCED = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
