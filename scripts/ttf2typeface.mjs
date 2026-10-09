// Converts a TTF into three.js typeface JSON (same algorithm as facetype.js), ASCII glyphs only.
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'

const [,, inPath, outPath] = process.argv
const buf = readFileSync(inPath)
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
const scale = (1000 * 100) / ((font.unitsPerEm || 2048) * 100)
const r = (v) => Math.round(v * scale)
const result = {
  glyphs: {},
  familyName: font.names.fontFamily?.en || 'font',
  ascender: r(font.ascender),
  descender: r(font.descender),
  underlinePosition: r(font.tables.post?.underlinePosition ?? -100),
  underlineThickness: r(font.tables.post?.underlineThickness ?? 50),
  boundingBox: { yMin: r(font.tables.head.yMin), xMin: r(font.tables.head.xMin), yMax: r(font.tables.head.yMax), xMax: r(font.tables.head.xMax) },
  resolution: 1000,
  original_font_information: { format: 0, fontFamily: font.names.fontFamily?.en },
}
for (let i = 0; i < font.glyphs.length; i++) {
  const g = font.glyphs.get(i)
  if (g.unicode === undefined) continue
  if (g.unicode < 32 || g.unicode > 126) continue
  const t = { ha: r(g.advanceWidth), x_min: r(g.xMin ?? 0), x_max: r(g.xMax ?? 0), o: '' }
  for (const c of g.path.commands) {
    const type = c.type.toLowerCase() === 'c' ? 'b' : c.type.toLowerCase()
    t.o += type + ' '
    if (c.x !== undefined && c.y !== undefined) t.o += r(c.x) + ' ' + r(c.y) + ' '
    if (c.x1 !== undefined && c.y1 !== undefined) t.o += r(c.x1) + ' ' + r(c.y1) + ' '
    if (c.x2 !== undefined && c.y2 !== undefined) t.o += r(c.x2) + ' ' + r(c.y2) + ' '
  }
  result.glyphs[String.fromCharCode(g.unicode)] = t
}
writeFileSync(outPath, JSON.stringify(result))
console.log(`${outPath}: ${Object.keys(result.glyphs).length} glyphs, ${(JSON.stringify(result).length / 1024).toFixed(1)} KB`)
