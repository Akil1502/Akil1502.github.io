// The chest's NANOTECH reveal field: the armour grows OUT OF THE REACTOR. A surface point p becomes solid when
//   landT(p) = delay(p) · NANO_D + NANO_F      (delay: 0 at the reactor … 1 at the waist / shoulder tips)
// The same field drives the swarm (each nanite flies during [delay·D, delay·D + F]), so the solid plates fill in
// exactly behind the arriving nanites, and scrubbing uReveal backwards retracts the suit into the reactor.
import { NANO_D, NANO_F } from '../three/armor.js'

export { NANO_D, NANO_F }

// The bust is modelled in design units and scaled by SCALE into stage units (bigger silhouette, same design).
export const SCALE = 1.08
// reactor centre: design units, and stage units (keep in sync with meta.js reactorAnchor)
export const REACTOR_D = [0, 0.32, 0.0]
export const REACTOR = REACTOR_D.map((v) => v * SCALE)
const RMAX = 1.5 * SCALE

// JS twin of the GLSL below (keep them identical)
export function chestDelay(x, y, z) {
  const dx = x - REACTOR[0]
  const dy = (y - REACTOR[1]) * 0.92
  const dz = (z - REACTOR[2]) * 0.6
  const r = Math.min(1, Math.sqrt(dx * dx + dy * dy + dz * dz) / RMAX)
  const n = 0.5 + 0.5 * Math.sin(x * 9.1 + z * 4.3 + Math.sin(y * 7.7) * 1.3) * Math.cos(z * 6.1 - x * 3.7)
  return Math.min(1, Math.max(0, Math.pow(r, 0.85) * 0.86 + n * 0.14))
}

export const chestDelayGLSL = /* glsl */ `
float chestDelay(vec3 p) {
  vec3 d = (p - vec3(${REACTOR.map((v) => v.toFixed(3)).join(', ')})) * vec3(1.0, 0.92, 0.6);
  float r = min(1.0, length(d) / ${RMAX.toFixed(3)});
  float n = 0.5 + 0.5 * sin(p.x * 9.1 + p.z * 4.3 + sin(p.y * 7.7) * 1.3) * cos(p.z * 6.1 - p.x * 3.7);
  return clamp(pow(r, 0.85) * 0.86 + n * 0.14, 0.0, 1.0);
}
`
