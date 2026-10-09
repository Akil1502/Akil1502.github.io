import * as THREE from 'three'

// Procedural engravings for the amulet, painted once into canvases (no image files). Every texture has a "base"
// canvas (albedo) and an "emit" canvas (only the engraved channels, white on black) used as an emissive map so the
// runes can glow orange — or green while time is being rewound.

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}
function tex(c, { srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  t.needsUpdate = true
  return t
}
function rng(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// lens curve used by the frame and the enamel plate: y = H (1 - (x/W)^2)^1.2
export const lensY = (x, W, H) => H * Math.pow(Math.max(0, 1 - (x / W) * (x / W)), 1.2)

// Enamel eye-plate: maps x in [-hw, hw], y in [-hh, hh] (ShapeGeometry uses positions as UVs, see repeat/offset)
export function enamelTextures(hw, hh) {
  const W = 1024
  const H = 512
  const [cb, b] = canvas(W, H)
  const [ce, e] = canvas(W, H)
  const px = (x) => (x / (2 * hw) + 0.5) * W
  const py = (y) => (0.5 - y / (2 * hh)) * H
  const g = b.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.5)
  g.addColorStop(0, '#3a1450')
  g.addColorStop(0.45, '#1a0b26')
  g.addColorStop(1, '#09050d')
  b.fillStyle = g
  b.fillRect(0, 0, W, H)
  e.fillStyle = '#000'
  e.fillRect(0, 0, W, H)

  const lens = (ctx, s, style, lw) => {
    ctx.beginPath()
    const ww = hw * s
    const hh2 = hh * s
    for (let i = 0; i <= 80; i++) {
      const x = ww - (2 * ww * i) / 80
      const y = lensY(x, ww, hh2)
      i === 0 ? ctx.moveTo(px(x), py(y)) : ctx.lineTo(px(x), py(y))
    }
    for (let i = 1; i <= 80; i++) {
      const x = -ww + (2 * ww * i) / 80
      ctx.lineTo(px(x), py(-lensY(x, ww, hh2)))
    }
    ctx.strokeStyle = style
    ctx.lineWidth = lw
    ctx.stroke()
  }
  for (const ctx of [b, e]) {
    const bright = ctx === e
    lens(ctx, 0.93, bright ? '#ffffff' : '#c58a3a', 3)
    lens(ctx, 0.84, bright ? 'rgba(255,255,255,0.55)' : 'rgba(197,138,58,0.6)', 1.5)
    lens(ctx, 0.76, bright ? 'rgba(255,255,255,0.35)' : 'rgba(197,138,58,0.4)', 1)
    // radial rays out of the chamber
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2
      const r0 = 0.5
      const r1 = 1.6
      ctx.beginPath()
      ctx.moveTo(px(Math.cos(a) * r0), py(Math.sin(a) * r0))
      ctx.lineTo(px(Math.cos(a) * r1), py(Math.sin(a) * r1))
      ctx.strokeStyle = bright ? `rgba(255,255,255,${k % 3 === 0 ? 0.5 : 0.18})` : 'rgba(197,138,58,0.25)'
      ctx.lineWidth = k % 3 === 0 ? 2 : 1
      ctx.stroke()
    }
    // glyph ticks along the inner lens
    const r = rng(7)
    for (let k = 0; k < 64; k++) {
      const u = k / 64
      const x = hw * 0.88 * Math.cos(u * Math.PI * 2)
      const top = Math.sin(u * Math.PI * 2) >= 0
      const y = (top ? 1 : -1) * lensY(x, hw * 0.88, hh * 0.88)
      const len = 6 + r() * 10
      ctx.save()
      ctx.translate(px(x), py(y))
      ctx.rotate(r() * Math.PI)
      ctx.fillStyle = bright ? '#ffffff' : '#d9a046'
      ctx.fillRect(-1.5, -len / 2, 3, len)
      if (r() > 0.5) ctx.fillRect(-len / 3, -1.5, (len * 2) / 3, 3)
      ctx.restore()
    }
  }
  const map = tex(cb)
  const emit = tex(ce)
  for (const t of [map, emit]) {
    t.repeat.set(1 / (2 * hw), 1 / (2 * hh))
    t.offset.set(0.5, 0.5)
  }
  return { map, emit }
}

// Medallion back disc (CircleGeometry uv: centre 0.5, 0.5): rings, an eight-point star and a rune band.
export function discTextures() {
  const S = 512
  const [cb, b] = canvas(S, S)
  const [ce, e] = canvas(S, S)
  const g = b.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2)
  g.addColorStop(0, '#2a1036')
  g.addColorStop(1, '#0b0610')
  b.fillStyle = g
  b.fillRect(0, 0, S, S)
  e.fillStyle = '#000'
  e.fillRect(0, 0, S, S)
  const c = S / 2
  const R = S / 2
  for (const ctx of [b, e]) {
    const bright = ctx === e
    const stroke = (a) => (bright ? `rgba(255,255,255,${a})` : `rgba(206,150,70,${a * 0.8})`)
    ctx.lineWidth = 2
    for (const [rr, a] of [
      [0.94, 1],
      [0.86, 0.6],
      [0.66, 0.8],
      [0.6, 0.4],
    ]) {
      ctx.beginPath()
      ctx.arc(c, c, R * rr, 0, Math.PI * 2)
      ctx.strokeStyle = stroke(a)
      ctx.stroke()
    }
    // eight-point star
    for (const off of [0, Math.PI / 4]) {
      ctx.beginPath()
      for (let k = 0; k <= 4; k++) {
        const a = off + (k / 4) * Math.PI * 2 + Math.PI / 4
        const x = c + Math.cos(a) * R * 0.85
        const y = c + Math.sin(a) * R * 0.85
        k === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = stroke(0.7)
      ctx.lineWidth = 2
      ctx.stroke()
    }
    // rune band
    const r = rng(3)
    for (let k = 0; k < 48; k++) {
      const a = (k / 48) * Math.PI * 2
      ctx.save()
      ctx.translate(c + Math.cos(a) * R * 0.9, c + Math.sin(a) * R * 0.9)
      ctx.rotate(a + Math.PI / 2)
      ctx.fillStyle = stroke(0.9)
      const h = 10 + r() * 8
      ctx.fillRect(-1.5, -h / 2, 3, h)
      if (r() > 0.4) ctx.fillRect(-5, -h / 2 + r() * h, 10, 2.5)
      if (r() > 0.7) {
        ctx.beginPath()
        ctx.arc(0, 0, 4, 0, Math.PI * 2)
        ctx.strokeStyle = stroke(0.9)
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.restore()
    }
  }
  return { map: tex(cb), emit: tex(ce) }
}

// Eyelid dome (SphereGeometry uv: u around, v = 1 at the apex .. 0 at the rim): concentric grooves + radial ribs.
export function lidTextures() {
  const W = 512
  const H = 256
  const [cb, b] = canvas(W, H)
  const [ce, e] = canvas(W, H)
  const grad = b.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#f1c46a')
  grad.addColorStop(1, '#b98232')
  b.fillStyle = grad
  b.fillRect(0, 0, W, H)
  e.fillStyle = '#000'
  e.fillRect(0, 0, W, H)
  const rows = [0.12, 0.3, 0.52, 0.8]
  for (const ctx of [b, e]) {
    const bright = ctx === e
    ctx.fillStyle = bright ? '#ffffff' : '#5b3910'
    for (const v of rows) ctx.fillRect(0, (1 - v) * H - 2, W, 4)
    for (let k = 0; k <= 12; k++) {
      const x = (k / 12) * W
      ctx.fillRect(x - 1.5, (1 - 0.8) * H, 3, (0.8 - 0.3) * H)
    }
    // small rune dots between the rings
    for (let k = 0; k < 24; k++) {
      ctx.beginPath()
      ctx.arc(((k + 0.5) / 24) * W, (1 - 0.41) * H, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return { map: tex(cb), emit: tex(ce) }
}

// Iris disc (RingGeometry uv: planar, centre 0.5, 0.5): fine radial filaments, like a cut stone's inner fire.
export function irisTexture() {
  const S = 512
  const [c, x] = canvas(S, S)
  x.fillStyle = '#000'
  x.fillRect(0, 0, S, S)
  const r = rng(11)
  const cx = S / 2
  for (let k = 0; k < 220; k++) {
    const a = r() * Math.PI * 2
    const r0 = S * (0.2 + r() * 0.05)
    const r1 = S * (0.38 + r() * 0.11)
    x.beginPath()
    x.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0)
    x.lineTo(cx + Math.cos(a + (r() - 0.5) * 0.1) * r1, cx + Math.sin(a + (r() - 0.5) * 0.1) * r1)
    x.strokeStyle = `rgba(255,255,255,${0.15 + r() * 0.6})`
    x.lineWidth = 1 + r() * 2
    x.stroke()
  }
  for (const [rr, a] of [
    [0.47, 0.9],
    [0.42, 0.4],
    [0.205, 0.8],
  ]) {
    x.beginPath()
    x.arc(cx, cx, S * rr, 0, Math.PI * 2)
    x.strokeStyle = `rgba(255,255,255,${a})`
    x.lineWidth = 3
    x.stroke()
  }
  return tex(c)
}
