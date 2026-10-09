import * as THREE from 'three'
import { strokeRune, RUNES } from '../runes'

// Procedural CanvasTextures for the Thor page. Everything is drawn here, once, from code (no images):
//   - hammer engravings: white "grooves" on black, used as BOTH the emissive map (the rune glow) and the bump map
//     (negative bump scale, so white reads as cut into the metal);
//   - the scorched landing seal under the hammer (white lines on transparent, alpha-driven);
//   - one glowing rune glyph per runestone / sigil.
// Textures are cached per key so remounts (page revisits) never redraw or re-upload them.

const cache = new Map()
const RUNE_KEYS = Object.keys(RUNES)

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function toTexture(c, srgb = false) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 4
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

// Small seeded PRNG so every texture is identical on every load.
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// An engraved ribbon: two parallel grooves (outline of a band of width w).
function ribbonStroke(ctx, path, w, groove) {
  ctx.lineWidth = w + groove
  ctx.strokeStyle = '#000'
  ctx.stroke(path) // clears whatever runs underneath (over/under crossings)
  ctx.lineWidth = w
  ctx.strokeStyle = '#fff'
  ctx.stroke(path)
  ctx.lineWidth = Math.max(1, w - groove * 2)
  ctx.strokeStyle = '#000'
  ctx.stroke(path)
}

// Two-strand interlaced braid (knotwork band) between x0 and x1 around cy. Each crossing alternates which strand
// passes over, so it reads as woven rather than two overlapping sine waves.
function braid(ctx, x0, x1, cy, amp, periods, w, groove) {
  const len = x1 - x0
  const k = (periods * Math.PI * 2) / len
  // segments run peak-to-peak, so every segment contains exactly one crossing
  const segs = Math.round(periods * 2) + 1
  for (let s = -1; s < segs; s++) {
    const p0 = Math.PI / 2 + s * Math.PI
    const p1 = p0 + Math.PI
    const strand = (sign) => {
      const path = new Path2D()
      for (let i = 0; i <= 24; i++) {
        const ph = p0 + ((p1 - p0) * i) / 24
        const x = x0 + ph / k
        if (x < x0 - 1 || x > x1 + 1) continue
        const y = cy + sign * amp * Math.sin(ph)
        if (i === 0 || x <= x0) path.moveTo(Math.max(x0, x), y)
        else path.lineTo(x, y)
      }
      return path
    }
    const over = s % 2 === 0 ? 1 : -1
    ribbonStroke(ctx, strand(-over), w, groove)
    ribbonStroke(ctx, strand(over), w, groove)
  }
}

// Interlaced rosette: n circles of radius r whose centres sit on a circle of radius d.
function rosette(ctx, cx, cy, n, r, d, w, groove, rot = 0) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const p = new Path2D()
    p.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, 0, Math.PI * 2)
    ribbonStroke(ctx, p, w, groove)
  }
  // weave: redraw an arc of each circle on top so the overlaps alternate over/under
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    const p = new Path2D()
    p.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r, a + 0.35, a + 1.25)
    ribbonStroke(ctx, p, w, groove)
  }
}

function ring(ctx, cx, cy, r, w) {
  ctx.lineWidth = w
  ctx.strokeStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()
}

function runeRing(ctx, cx, cy, r, count, w, h, lw, seed) {
  const rnd = rng(seed)
  ctx.lineWidth = lw
  ctx.strokeStyle = '#fff'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    ctx.save()
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
    ctx.rotate(a + Math.PI / 2)
    strokeRune(ctx, RUNE_KEYS[Math.floor(rnd() * RUNE_KEYS.length)], -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

function frame(ctx, W, H, inset, lw) {
  ctx.lineWidth = lw
  ctx.strokeStyle = '#fff'
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2)
}

// Long faces of the head (front / back / underside): double frame, knot medallion, woven braids either side.
export function headSideTexture() {
  return cached('side', () => {
    const W = 1024
    const H = 540
    const c = makeCanvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.lineCap = 'butt'
    ctx.lineJoin = 'round'
    frame(ctx, W, H, 16, 8)
    frame(ctx, W, H, 38, 3)
    const cx = W / 2
    const cy = H / 2
    // medallion
    ring(ctx, cx, cy, 168, 7)
    ring(ctx, cx, cy, 146, 3)
    runeRing(ctx, cx, cy, 124, 14, 18, 28, 3.2, 11)
    ring(ctx, cx, cy, 100, 3)
    rosette(ctx, cx, cy, 3, 50, 34, 13, 3.5, -Math.PI / 2)
    ring(ctx, cx, cy, 12, 4)
    // woven bands either side of the medallion
    braid(ctx, 62, cx - 186, cy, 70, 2, 26, 4)
    braid(ctx, cx + 186, W - 62, cy, 70, 2, 26, 4)
    // chevron ticks along the inner frame
    ctx.lineWidth = 3
    ctx.strokeStyle = '#fff'
    for (let x = 70; x < W - 60; x += 34) {
      if (Math.abs(x - cx) < 200) continue
      ctx.beginPath()
      ctx.moveTo(x, 52)
      ctx.lineTo(x + 10, 62)
      ctx.lineTo(x + 20, 52)
      ctx.moveTo(x, H - 52)
      ctx.lineTo(x + 10, H - 62)
      ctx.lineTo(x + 20, H - 52)
      ctx.stroke()
    }
    return toTexture(c)
  })
}

// Top of the head: a framed band of runes (decorative only; the sequence is random and spells nothing).
export function headTopTexture() {
  return cached('top', () => {
    const W = 1024
    const H = 540
    const c = makeCanvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.lineJoin = 'round'
    frame(ctx, W, H, 16, 8)
    frame(ctx, W, H, 38, 3)
    // inscription panel
    ctx.lineWidth = 4
    ctx.strokeStyle = '#fff'
    ctx.strokeRect(150, 170, W - 300, 200)
    const rnd = rng(77)
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    const n = 11
    const span = W - 360
    for (let i = 0; i < n; i++) {
      const x = 180 + (span / n) * i + (span / n - 52) / 2
      strokeRune(ctx, RUNE_KEYS[Math.floor(rnd() * RUNE_KEYS.length)], x, 200, 52, 140)
    }
    ctx.lineCap = 'butt'
    braid(ctx, 52, 138, H / 2, 70, 0.5, 22, 4)
    braid(ctx, W - 138, W - 52, H / 2, 70, 0.5, 22, 4)
    braid(ctx, 150, W - 150, 104, 26, 9, 14, 3)
    braid(ctx, 150, W - 150, H - 104, 26, 9, 14, 3)
    return toTexture(c)
  })
}

// Striking faces: concentric rings, a ring of runes and a four-loop woven knot.
export function headEndTexture() {
  return cached('end', () => {
    const S = 512
    const c = makeCanvas(S, S)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, S, S)
    ctx.lineJoin = 'round'
    frame(ctx, S, S, 12, 7)
    const cx = S / 2
    ring(ctx, cx, cx, 222, 7)
    ring(ctx, cx, cx, 200, 3)
    runeRing(ctx, cx, cx, 176, 16, 20, 30, 3.4, 5)
    ring(ctx, cx, cx, 150, 4)
    rosette(ctx, cx, cx, 4, 66, 54, 15, 4, Math.PI / 4)
    ring(ctx, cx, cx, 18, 5)
    // corner knots
    for (const [x, y] of [
      [44, 44],
      [S - 44, 44],
      [44, S - 44],
      [S - 44, S - 44],
    ])
      rosette(ctx, x, y, 3, 13, 9, 6, 2)
    return toTexture(c)
  })
}

// The scorched landing seal: rings, a band of runes, a six-circle woven rosette and radial ticks.
// White on transparent; the seal shader uses the alpha.
export function sealTexture() {
  return cached('seal', () => {
    const S = 1024
    const c = makeCanvas(S, S)
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, S, S)
    const cx = S / 2
    ctx.lineJoin = 'round'
    ring(ctx, cx, cx, 500, 9)
    ring(ctx, cx, cx, 482, 3)
    runeRing(ctx, cx, cx, 440, 28, 30, 50, 5, 3)
    ring(ctx, cx, cx, 396, 6)
    ctx.lineWidth = 3
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const r0 = i % 6 === 0 ? 352 : 372
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * 390, cx + Math.sin(a) * 390)
      ctx.stroke()
    }
    ring(ctx, cx, cx, 340, 3)
    // the woven rosette, drawn white-on-black then converted to alpha below
    const tmp = makeCanvas(S, S)
    const t = tmp.getContext('2d')
    t.fillStyle = '#000'
    t.fillRect(0, 0, S, S)
    t.lineJoin = 'round'
    rosette(t, cx, cx, 6, 168, 160, 18, 4, 0)
    rosette(t, cx, cx, 3, 62, 40, 14, 3.5, -Math.PI / 2)
    ring(t, cx, cx, 330, 4)
    ring(t, cx, cx, 14, 6)
    const img = t.getImageData(0, 0, S, S)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i + 3] = d[i]
      d[i] = d[i + 1] = d[i + 2] = 255
    }
    t.putImageData(img, 0, 0)
    ctx.drawImage(tmp, 0, 0)
    return toTexture(c)
  })
}

// A single glowing rune glyph (white strokes with a soft halo on black) for additive planes.
export function runeTexture(key) {
  return cached(`rune:${key}`, () => {
    const W = 128
    const H = 192
    const c = makeCanvas(W, H)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#fff'
    ctx.shadowColor = 'rgba(255,255,255,0.9)'
    ctx.shadowBlur = 16
    ctx.lineWidth = 9
    strokeRune(ctx, key, 26, 24, 76, 122)
    ctx.shadowBlur = 0
    ctx.lineWidth = 6
    strokeRune(ctx, key, 26, 24, 76, 122)
    return toTexture(c, true)
  })
}

// Chiselled grain for the runestones (roughness / bump variation), tiled.
export function stoneGrainTexture() {
  return cached('grain', () => {
    const S = 256
    const c = makeCanvas(S, S)
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(S, S)
    const rnd = rng(42)
    for (let i = 0; i < S * S; i++) {
      const v = 120 + rnd() * 70
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
      img.data[i * 4 + 3] = 255
    }
    ctx.putImageData(img, 0, 0)
    // chisel scratches
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    for (let i = 0; i < 60; i++) {
      ctx.lineWidth = 1 + rnd() * 2
      ctx.beginPath()
      const x = rnd() * S
      const y = rnd() * S
      ctx.moveTo(x, y)
      ctx.lineTo(x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 20)
      ctx.stroke()
    }
    const t = toTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    return t
  })
}
