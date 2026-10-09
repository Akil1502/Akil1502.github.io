// Disintegration effect: text elements crumble into thousands of particles that drift away and fade.
// dissolveElements([el, ...], { duration, hold }) draws each element's text onto a full-screen canvas,
// samples it into particles and animates them; resolves when done. The caller hides the real elements.
export function dissolveElements(elements, { duration = 1.6, step = 3, drift = 1, resolveAt = 0.75 } = {}) {
  return new Promise((resolve) => {
    const els = Array.from(elements).filter(Boolean)
    if (!els.length || typeof document === 'undefined') return resolve()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = window.innerWidth
    const H = window.innerHeight
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '10001' })
    document.body.appendChild(canvas)
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // 1. rasterise every element's text in place
    for (const el of els) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      ctx.fillStyle = cs.color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.textContent || '', r.left + r.width / 2, r.top + r.height / 2 + parseFloat(cs.fontSize) * 0.04)
    }
    // 2. sample pixels into particles
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const parts = []
    const sx = Math.max(1, Math.round(step * dpr))
    let minX = Infinity
    let maxX = -Infinity
    for (let y = 0; y < canvas.height; y += sx) {
      for (let x = 0; x < canvas.width; x += sx) {
        const i = (y * canvas.width + x) * 4
        const a = img[i + 3]
        if (a < 40) continue
        const px = x / dpr
        const py = y / dpr
        minX = Math.min(minX, px)
        maxX = Math.max(maxX, px)
        parts.push({ x: px, y: py, r: img[i], g: img[i + 1], b: img[i + 2], a: a / 255, s: Math.random(), t: Math.random() })
      }
    }
    ctx.clearRect(0, 0, W, H)
    if (!parts.length) {
      canvas.remove()
      return resolve()
    }
    const span = Math.max(1, maxX - minX)
    const size = step
    let start = null
    let resolved = false
    const frame = (now) => {
      if (start === null) start = now
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, W, H)
      let alive = 0
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]
        // dissolve sweeps left → right with per-particle jitter
        const delay = ((p.x - minX) / span) * duration * 0.55 + p.s * duration * 0.2
        const life = duration * 0.45
        const k = (t - delay) / life
        if (k < 0) {
          ctx.globalAlpha = p.a
          ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`
          ctx.fillRect(p.x, p.y, size, size)
          alive++
          continue
        }
        if (k >= 1) continue
        alive++
        const e = k * k
        const dx = (40 + p.s * 160) * e * drift + Math.sin(t * 6 + p.t * 12) * 6 * k
        const dy = (-30 - p.t * 90) * e * drift + Math.cos(t * 5 + p.s * 9) * 5 * k
        ctx.globalAlpha = p.a * (1 - k) * (1 - k)
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`
        const sz = size * (1 - k * 0.6)
        ctx.fillRect(p.x + dx, p.y + dy, sz, sz)
      }
      if (!resolved && t > duration * resolveAt) {
        resolved = true
        resolve()
      }
      if (alive > 0 && t < duration * 1.3) requestAnimationFrame(frame)
      else canvas.remove()
    }
    requestAnimationFrame(frame)
  })
}
