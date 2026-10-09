// Rune glyphs for the Skills (Thor) page. The Elder Futhark is a historical alphabet; every glyph below is drawn
// from scratch as stroke polylines in a 10 x 16 box (y down), so the SAME data renders the DOM SVG glyph on a
// skill card and the glowing CanvasTexture rune on its 3D runestone. Pure decoration: the runes do not spell
// anything and carry no claim about the skill they sit beside.
import { skills } from '../../data/resume'

export const RUNES = {
  fehu: { char: 'F', strokes: [[[3, 16], [3, 0]], [[3, 6], [8.5, 1]], [[3, 10.5], [8.5, 5.5]]] },
  uruz: { char: 'U', strokes: [[[2.5, 16], [2.5, 0], [8, 5], [8, 16]]] },
  thurisaz: { char: 'TH', strokes: [[[3, 0], [3, 16]], [[3, 4], [8, 8], [3, 12]]] },
  ansuz: { char: 'A', strokes: [[[3, 16], [3, 0]], [[3, 0], [8.5, 4.5]], [[3, 5], [8.5, 9.5]]] },
  raidho: { char: 'R', strokes: [[[2.5, 16], [2.5, 0], [7.5, 4], [2.5, 8], [8, 16]]] },
  kaunan: { char: 'K', strokes: [[[8, 2], [2.5, 8], [8, 14]]] },
  gebo: { char: 'G', strokes: [[[1.5, 1], [8.5, 15]], [[8.5, 1], [1.5, 15]]] },
  wunjo: { char: 'W', strokes: [[[3, 16], [3, 0], [8, 4], [3, 8]]] },
  hagalaz: { char: 'H', strokes: [[[2.5, 0], [2.5, 16]], [[7.5, 0], [7.5, 16]], [[2.5, 5], [7.5, 11]]] },
  naudiz: { char: 'N', strokes: [[[5, 0], [5, 16]], [[2, 5], [8, 11]]] },
  isaz: { char: 'I', strokes: [[[5, 0], [5, 16]]] },
  jera: { char: 'J', strokes: [[[5.5, 1.5], [2, 5], [5.5, 8.5]], [[4.5, 7.5], [8, 11], [4.5, 14.5]]] },
  eihwaz: { char: 'EI', strokes: [[[5, 0], [5, 16]], [[5, 0], [8.5, 3.5]], [[5, 16], [1.5, 12.5]]] },
  perthro: { char: 'P', strokes: [[[2.5, 0], [2.5, 16]], [[2.5, 0], [6, 4], [8.5, 1.5]], [[2.5, 16], [6, 12], [8.5, 14.5]]] },
  algiz: { char: 'Z', strokes: [[[5, 16], [5, 0]], [[5, 6.5], [1, 1.5]], [[5, 6.5], [9, 1.5]]] },
  sowilo: { char: 'S', strokes: [[[7.5, 0], [2.5, 6.5], [7.5, 9.5], [2.5, 16]]] },
  tiwaz: { char: 'T', strokes: [[[5, 0], [5, 16]], [[5, 0], [1, 5]], [[5, 0], [9, 5]]] },
  berkanan: { char: 'B', strokes: [[[2.5, 0], [2.5, 16]], [[2.5, 0], [7.5, 4], [2.5, 8], [7.5, 12], [2.5, 16]]] },
  ehwaz: { char: 'E', strokes: [[[2, 16], [2, 0], [5, 5], [8, 0], [8, 16]]] },
  mannaz: { char: 'M', strokes: [[[2, 16], [2, 0], [8, 6.5]], [[8, 16], [8, 0], [2, 6.5]]] },
  laguz: { char: 'L', strokes: [[[3, 16], [3, 0], [8, 5]]] },
  ingwaz: { char: 'NG', strokes: [[[5, 2.5], [9, 8], [5, 13.5], [1, 8], [5, 2.5]]] },
  dagaz: { char: 'D', strokes: [[[1, 1], [1, 15], [9, 1], [9, 15], [1, 1]]] },
  othala: { char: 'O', strokes: [[[1, 16], [7.5, 8.5], [5, 2], [2.5, 8.5], [9, 16]]] },
}

// The 13 skills in stone order (10 core + 3 AI). `kind` is a plain description of the technology itself.
const CORE_META = [
  { rune: 'fehu', kind: 'Language · runtime' },
  { rune: 'raidho', kind: 'Web framework' },
  { rune: 'mannaz', kind: 'Web framework' },
  { rune: 'ehwaz', kind: 'Services' },
  { rune: 'berkanan', kind: 'Data access' },
  { rune: 'othala', kind: 'Database' },
  { rune: 'kaunan', kind: 'Language' },
  { rune: 'gebo', kind: 'Front end' },
  { rune: 'dagaz', kind: 'Server views' },
  { rune: 'jera', kind: 'Tooling' },
]
// AI tool notes: wording taken from the résumé summary / AI tools line.
const AI_META = [
  { rune: 'sowilo', kind: 'AI tool', note: 'Prompt engineering with Claude' },
  { rune: 'laguz', kind: 'AI-native IDE', note: 'Windsurf IDE for code review and delivery' },
  { rune: 'ansuz', kind: 'Practice', note: 'To accelerate code review, feature delivery and day-to-day engineering workflows' },
]
const CONCEPT_RUNES = ['hagalaz', 'naudiz', 'algiz', 'ingwaz', 'eihwaz']

export const STONES = [
  ...skills.core.map((s, i) => ({ name: s.name, level: s.level, ai: false, ...CORE_META[i] })),
  ...skills.ai.map((s, i) => ({ name: s.name, level: s.level, ai: true, ...AI_META[i] })),
]
export const CORE_COUNT = skills.core.length
export const AI_COUNT = skills.ai.length
export const CONCEPTS = skills.concepts.map((name, i) => ({ name, rune: CONCEPT_RUNES[i % CONCEPT_RUNES.length] }))
export const AI_NOTE = 'AI-assisted workflow: prompt engineering with Claude, Windsurf IDE for code review and delivery'

// SVG path data for a rune (viewBox 0 0 10 16).
export function runePath(key) {
  const r = RUNES[key]
  if (!r) return ''
  return r.strokes.map((pl) => pl.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')).join(' ')
}

// Strokes a rune into a 2D canvas context inside the box (x, y, w, h); the caller sets strokeStyle / lineWidth.
export function strokeRune(ctx, key, x, y, w, h) {
  const r = RUNES[key]
  if (!r) return
  const sx = w / 10
  const sy = h / 16
  ctx.beginPath()
  for (const pl of r.strokes) {
    pl.forEach(([px, py], i) => {
      const X = x + px * sx
      const Y = y + py * sy
      if (i) ctx.lineTo(X, Y)
      else ctx.moveTo(X, Y)
    })
  }
  ctx.stroke()
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII']
export const pad2 = (n) => String(n).padStart(2, '0')
