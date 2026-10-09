import { scroll, clamp } from '../../../three/scrollStore'

/* The stage director. The emblem cluster (hourglass + ring + batons) is pinned to the viewport like the hero of the
   reference video and moves between KEYS, one per DOM section, as the page scrolls:
     hero (right) → dossier (left) → file 01 (right) → file 02 (right, surveillance angle) → outro (left) → next.
   Mobile (one text column, no free side, so anything pinned would sit behind the copy): the emblem crowns the
   hero, rises out of frame while the dossier and the mission files are read (the rail's hourglass nodes carry the
   motif), drops back into the gap before the outro and rises ahead of the outro copy (two keys on one section).
   Key anchors: 'center' = section centred in the viewport, 'end' = section bottom at the viewport bottom (pinned
   hero), 'start' = section top at the viewport top, a number f = section top at f × viewport height from the top.
   Each section also turns the hourglass over once (flip = key index × π): time runs in the other direction on every
   beat. Between two keys there is a hold at both ends (smoothstep) so the cluster rests while a section is read.
   `updateStage()` is called once per frame by the scene root; every part reads the shared `stage` object. */

const D = (id, x, y, z, s, focus, cam, look, anchor = 'center') => ({ id, x, y, z, s, focus, cam, look, anchor })

const DESKTOP = [
  D('experience-hero', 2.85, 0.05, 0, 1, 1, [0, 0.35, 0], [0, -0.12, 0], 'end'),
  D('experience-dossier', -3.45, 0.0, -0.6, 0.84, 0.95, [-0.35, 0.55, -0.2], [-0.55, -0.18, 0]),
  D('experience-file-bannari', 3.55, 0.15, -0.8, 0.84, 0.9, [0.25, 1.05, 0], [0.4, -0.3, 0]),
  D('experience-file-creative-ideas', 3.5, 0.05, -1.1, 0.84, 0.9, [0.55, 1.7, -0.3], [0.5, -0.62, 0]),
  D('experience-outro', -2.9, 0.15, -0.3, 1.08, 1, [-0.4, 0.45, -0.4], [-0.7, -0.05, 0]),
  D('experience-next', 0, 3.1, -6, 0.62, 0.6, [0, 0.6, 0], [0, 0.6, 0]),
]

const MOBILE = [
  D('experience-hero', 0, 1.42, 0, 0.5, 1, [0, 0.25, 0], [0, 0.05, 0], 'end'),
  // holds the crown spot (turning over once) while the dossier title rises toward it, then shoots up out of frame
  D('experience-dossier', 0, 1.42, 0, 0.5, 1, [0, 0.25, 0], [0, 0.05, 0], 0.4),
  D('experience-dossier', 0.3, 8.2, -6, 0.5, 0.3, [0, 0.4, 0], [0, 0.1, 0]),
  D('experience-file-bannari', 0.6, 8.6, -8, 0.55, 0.2, [0, 0.6, 0], [0, 0, 0]),
  D('experience-file-creative-ideas', -0.6, 8.6, -8, 0.55, 0.2, [0, 0.9, 0], [0, -0.2, 0]),
  // two beats on the outro: it first settles low in the gap between the last log and the outro copy (outro top at
  // 75 % of the frame), then rises ahead of the copy into the band reserved above it (outro top at 5 %)
  D('experience-outro', 0, -0.4, -1.5, 0.42, 0.85, [0, 0.3, 0], [0, 0.1, 0], 0.75),
  D('experience-outro', 0, 2.45, -0.8, 0.46, 0.9, [0, 0.3, 0], [0, 0.1, 0], 0.05),
  D('experience-next', 0, 2.2, -6, 0.5, 0.5, [0, 0.6, 0], [0, 0.4, 0]),
]

export const stage = {
  mobile: false,
  x: DESKTOP[0].x,
  y: DESKTOP[0].y,
  z: DESKTOP[0].z,
  s: 1,
  focus: 1,
  flip: 0, // hourglass turn (radians about x): key index × π
  key: 0, // fractional key index
  cam: { x: 0, y: 0, z: 0 },
  look: { x: 0, y: 0, z: 0 },
  hero: 0, // 0..1 progress through the pinned hero (ignition scrub)
  floorY: -2.55,
}

const centres = new Float64Array(Math.max(DESKTOP.length, MOBILE.length))
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const mix = (a, b, t) => a + (b - a) * t

export function updateStage(isMobile) {
  const keys = isMobile ? MOBILE : DESKTOP
  stage.mobile = isMobile
  const vh = scroll.vh || window.innerHeight
  const y = scroll.y || 0
  let last = -Infinity
  for (let i = 0; i < keys.length; i++) {
    const s = scroll.sections[keys[i].id]
    let c
    if (!s) c = last + vh
    else if (keys[i].anchor === 'end') c = s.top + s.height - vh
    else if (keys[i].anchor === 'start') c = s.top
    else if (typeof keys[i].anchor === 'number') c = s.top - keys[i].anchor * vh
    else c = s.top + s.height / 2 - vh / 2
    if (i === 0) c = Math.max(0, c)
    c = Math.max(c, last + 1)
    centres[i] = c
    last = c
  }
  // pinned hero ignition progress
  const h = scroll.sections['experience-hero']
  stage.hero = h ? clamp((y - h.top) / Math.max(1, h.height - vh), 0, 1) : 0

  let i = 0
  while (i < keys.length - 2 && y >= centres[i + 1]) i++
  const raw = clamp((y - centres[i]) / Math.max(1, centres[i + 1] - centres[i]), 0, 1)
  const t = sstep(0.18, 0.82, raw)
  const a = keys[i]
  const b = keys[i + 1]
  // crossing the frame (left ↔ right) the cluster swings back in depth and dims, so it passes BEHIND the copy it
  // crosses instead of sliding across it at full size and glow
  const arc = Math.sin(Math.PI * t)
  const dip = Math.min(3, Math.abs(b.x - a.x) * 0.42) * arc
  stage.key = i + t
  stage.x = mix(a.x, b.x, t)
  stage.y = mix(a.y, b.y, t)
  stage.z = mix(a.z, b.z, t) - dip
  stage.s = mix(a.s, b.s, t)
  stage.focus = mix(a.focus, b.focus, t) * (1 - 0.12 * dip)
  // the turn-over is a decisive beat in the middle of the move (the glass is edge-on only briefly)
  stage.flip = (i + sstep(0.34, 0.66, raw)) * Math.PI
  stage.cam.x = mix(a.cam[0], b.cam[0], t)
  stage.cam.y = mix(a.cam[1], b.cam[1], t)
  stage.cam.z = mix(a.cam[2], b.cam[2], t)
  stage.look.x = mix(a.look[0], b.look[0], t)
  stage.look.y = mix(a.look[1], b.look[1], t)
  stage.look.z = mix(a.look[2], b.look[2], t)
  return stage
}
