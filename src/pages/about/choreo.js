// Shared contract between the About DOM (AboutPage) and its 3D rig (ShieldRig).
//
// The shield flies an itinerary of DOM waypoints. Every waypoint is a DOM slot marked
// data-anchor="<anchor>"; the rig maps it to world space every frame and scrubs the shield between
// consecutive waypoints with the page scroll:
//   rest  - the shield parks in the slot (hero, inspection stage, finale catch)
//   hit   - SHIELD THROW ricochet target: the shield strikes it (impact + sparks), lodges for a beat, flies on
// A waypoint inside a sticky stage ([data-pin] inside [data-pin-track]) is scrubbed by the pin progress on
// desktop; `pin` places a hit at that fraction of the pinned run.
export const WAYPOINTS = [
  { key: 'hero', anchor: 'about-shield-hero', kind: 'rest', fill: 0.92, hold: 0.16, pose: 'hero' },
  { key: 'file', anchor: 'about-shield-file', kind: 'rest', fill: 0.84, hold: 0.2, pose: 'inspect' },
  { key: 'road-0', anchor: 'about-node-0', kind: 'hit', fill: 0.84 },
  { key: 'road-1', anchor: 'about-node-1', kind: 'hit', fill: 0.84 },
  { key: 'road-2', anchor: 'about-node-2', kind: 'hit', fill: 0.84 },
  { key: 'road-3', anchor: 'about-node-3', kind: 'hit', fill: 0.84 },
  { key: 'code-0', anchor: 'about-card-0', kind: 'hit', fill: 0.86, pin: 0.12 },
  { key: 'code-1', anchor: 'about-card-1', kind: 'hit', fill: 0.86, pin: 0.34 },
  { key: 'code-2', anchor: 'about-card-2', kind: 'hit', fill: 0.86, pin: 0.56 },
  { key: 'code-3', anchor: 'about-card-3', kind: 'hit', fill: 0.86, pin: 0.78 },
  { key: 'final', anchor: 'about-shield-final', kind: 'rest', fill: 0.9, hold: 0.12, pose: 'final', focus: 0.36 },
]

// window CustomEvent the rig fires: detail = { type: 'land' | 'hit' | 'mark' | 'catch' | 'clang', key }
export const SHIELD_EVENT = 'about:shield'

// The viewport line (fraction of height from the top) a waypoint has to cross to be "reached".
export const FOCUS = 0.5

// Lamp-strike keyframes (HEROES.md vocabulary)
export const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]
