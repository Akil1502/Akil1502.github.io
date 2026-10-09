import { useEffect, useRef } from 'react'

// The "co-pilot": a second, cyan reticle that locks onto the nearest [data-copilot] element near the cursor,
// draws a leader line and reads its label before you get there. AI assistance as a behaviour, not a badge.
export default function Copilot({ ready }) {
  const ret = useRef(null)
  const label = useRef(null)
  useEffect(() => {
    if (!ready) return
    if (window.matchMedia('(pointer: coarse)').matches) return
    const el = ret.current
    let targets = []
    const refresh = () => {
      targets = Array.from(document.querySelectorAll('[data-copilot]'))
    }
    refresh()
    const mo = new MutationObserver(refresh)
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-copilot'] })

    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    const onMove = (e) => {
      mx = e.clientX
      my = e.clientY
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    let x = mx
    let y = my
    let tx = mx
    let ty = my
    let cur = null
    let shown = false
    let raf
    const RADIUS = 240
    // A target counts only if it is actually visible: not muted, not hidden, and no ancestor faded below 0.3.
    // Checked only for the nearest candidates, so the walk stays cheap.
    const isVisible = (node) => {
      if (node.hasAttribute('data-copilot-muted')) return false
      let n = node
      for (let depth = 0; n && n !== document.body && depth < 12; depth++, n = n.parentElement) {
        const cs = getComputedStyle(n)
        if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.3) return false
      }
      return true
    }
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000))
      last = now
      const cands = []
      for (const t of targets) {
        const r = t.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight || r.width === 0) continue
        // distance from cursor to the rect (0 inside)
        const dx = Math.max(r.left - mx, 0, mx - r.right)
        const dy = Math.max(r.top - my, 0, my - r.bottom)
        const d = Math.hypot(dx, dy)
        if (d < RADIUS) cands.push({ t, r, d })
      }
      cands.sort((a, b) => a.d - b.d)
      let best = null
      for (let i = 0; i < cands.length && i < 4; i++) {
        if (isVisible(cands[i].t)) {
          best = cands[i]
          break
        }
      }
      if (best) {
        tx = best.r.left + best.r.width / 2
        ty = best.r.top + best.r.height / 2
        if (best.t !== cur) {
          cur = best.t
          label.current.textContent = cur.dataset.copilot || 'TARGET'
          el.classList.add('is-locked')
          el.style.setProperty('--w', `${best.r.width + 18}px`)
          el.style.setProperty('--h', `${best.r.height + 18}px`)
        }
        // keep the label inside the viewport: flip it to the left of the box near the right edge
        const labelW = label.current.parentElement.offsetWidth || 160
        el.classList.toggle('is-flip', best.r.right + 26 + labelW > window.innerWidth - 12)
        if (!shown) {
          shown = true
          el.classList.add('is-on')
        }
      } else if (shown) {
        shown = false
        cur = null
        el.classList.remove('is-on', 'is-locked')
      }
      // frame-rate independent follow (same feel at 30, 60 or 144 fps)
      const k = 1 - Math.pow(0.012, dt)
      x += (tx - x) * k
      y += (ty - y) * k
      el.style.transform = `translate(${x}px, ${y}px)`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [ready])

  return (
    <div ref={ret} className="copilot" aria-hidden="true">
      <span className="copilot-box" />
      <span className="copilot-leader" />
      <span className="copilot-label">
        <i className="copilot-dot" />
        <span ref={label}>SCANNING</span>
      </span>
    </div>
  )
}
