// Stage settings for the 'chest' centrepiece (owned by this candidate; tune freely).
// The reactor sits in the bezel socket at the chest centre (stage units; keep in sync with chestField.js REACTOR).
// Centerpiece.jsx offsets the armour each frame so this attachment point always lands in the socket centre.
export default {
  reactorAnchor: [0, 0.3456, 0.0], // REACTOR_D · SCALE
  reactorScale: 0.205, // housing radius 1.07 × 0.205 sits inside the socket's chrome lip (0.216 × SCALE)
  hud: { ring: 1.9, bracketW: 3.15, bracketH: 2.85 },
}
