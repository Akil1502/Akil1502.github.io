import { useEffect, useRef } from 'react'
import { scroll } from '../three/scrollStore'
import { PAGES } from '../data/heroes'

// Reference-style cinematic HUD frame fixed over every page: corner brackets, a live telemetry readout
// (top-right, jitters like a real instrument), a channel label (top-left), a scroll-scrubbed frame counter
// "SEQ 001 / 180" (bottom-left), a status line (bottom-centre) and a scroll cue (bottom-right).
const FRAMES = 180

export default function HudFrame({ page, ready }) {
  const meter = useRef(null)
  const seq = useRef(null)
  const bar = useRef(null)
  useEffect(() => {
    if (!page) return
    let raf
    let t = 0
    const base = page.hud.meter
    const big = base > 1000
    const decimals = big ? 0 : base < 10 ? 2 : 1
    const loop = () => {
      t += 1
      if (meter.current && t % 6 === 0) {
        const jitter = big ? 0 : (Math.sin(t * 0.05) * 0.4 + (Math.random() - 0.5) * 0.3) * (base < 10 ? 0.02 : 0.6)
        const v = Math.min(base === 100 ? 100 : Infinity, base + jitter)
        meter.current.textContent = (big ? Math.round(v).toLocaleString('en-US') : v.toFixed(decimals)) + page.hud.meterUnit
      }
      const p = Math.max(0, Math.min(1, scroll.progress || 0))
      if (seq.current) seq.current.textContent = `${String(1 + Math.round(p * (FRAMES - 1))).padStart(3, '0')} / ${FRAMES}`
      if (bar.current) bar.current.style.transform = `scaleX(${p})`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [page])

  if (!page) return null
  const idx = PAGES.indexOf(page) + 1
  return (
    <div className={`hud-frame ${ready ? 'is-ready' : ''}`} aria-hidden="true">
      <span className="hf-corner hf-tl" />
      <span className="hf-corner hf-tr" />
      <span className="hf-corner hf-bl" />
      <span className="hf-corner hf-br" />
      <div className="hf-top">
        <span className="hf-label">
          <i className="hf-dot" /> {page.hud.topLeft}
        </span>
        <span className="hf-label hf-right">
          {page.hud.topRight} <b ref={meter}>{page.hud.meter}</b> <i className="hf-dot" />
        </span>
      </div>
      <div className="hf-bottom">
        <span className="hf-label">
          {page.hud.bottomLeft} <b ref={seq}>001 / {FRAMES}</b>
        </span>
        <span className="hf-label hf-mid">{page.hud.bottomMid}</span>
        <span className="hf-label hf-right">
          {String(idx).padStart(2, '0')} / {String(PAGES.length).padStart(2, '0')} · SCROLL ↓
        </span>
      </div>
      <span className="hf-progress">
        <span ref={bar} />
      </span>
    </div>
  )
}
