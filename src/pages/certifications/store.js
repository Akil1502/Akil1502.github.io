import { certifications } from '../../data/resume'

// Mutable state shared between the Certifications DOM (GSAP / ScrollTrigger writes) and its 3D scene (useFrame
// reads). Plain objects so GSAP can tween fields directly; never put these in React state.
export const CERT_COUNT = certifications.length

export const isAnthropic = (issuer) => /anthropic/i.test(issuer)
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']
export const pad2 = (n) => String(n).padStart(2, '0')

export const cert = {
  // SLING-RING PORTAL per certification card: open 0 (closed) .. ~1.35 (burst) .. 1 (steady); burst 0..1 extra heat
  portals: Array.from({ length: CERT_COUNT }, () => ({ open: 0, burst: 0 })),
  hover: -1, // index of the hovered spell card (-1 none)
  focus: -1, // index of the card nearest the viewport centre (written by the 3D side)
  focusSide: 1, // +1 when the focused card sits on the right half of the screen, -1 on the left
  cardPos: Array.from({ length: CERT_COUNT }, () => ({ x: 0, y: 0, ok: false })),
  time: 0, // TIME REVERSAL of the education record: 0 = shattered .. 1 = whole
  timeVel: 0, // |d time / dt| smoothed, so the gem glows while time is being rewound
  close: 0, // TIME REVERSAL of the closing statement: 0 = scattered .. 1 = assembled
  flash: 0, // green flash (snap of a reassembly); decays in 3D
  flashOrange: 0, // orange flash (a portal burst); decays in 3D
  hoverCodex: -1, // codex callout under the pointer (the matching amulet layer glows)
}

export function resetCert() {
  cert.portals.forEach((p) => {
    p.open = 0
    p.burst = 0
  })
  cert.cardPos.forEach((c) => {
    c.ok = false
  })
  cert.hover = -1
  cert.focus = -1
  cert.focusSide = 1
  cert.time = 0
  cert.timeVel = 0
  cert.close = 0
  cert.flash = 0
  cert.flashOrange = 0
  cert.hoverCodex = -1
}
