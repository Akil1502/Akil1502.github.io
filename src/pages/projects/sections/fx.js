import { useEffect, useState } from 'react'
import gsap from 'gsap'
import * as transition from '../../../transition/controller'

// `live` = the page is really on screen (loader finished and any page transition has revealed it). Arrival
// choreography waits for it so it never plays behind the overlay. Safety net: never stay hidden > 5 s.
export function useLive(ready) {
  const [live, setLive] = useState(false)
  useEffect(() => {
    if (!ready || live) return
    let raf = 0
    const go = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setLive(true))
    }
    if (!transition.isTransitioning()) go()
    const off = transition.onTransition((phase) => phase === 'done' && go())
    const safety = setTimeout(go, 5000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(safety)
      off?.()
    }
  }, [ready, live])
  return live
}

// deterministic 0..1 noise so crack decals and dust are identical on every visit
export function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

// Jagged crack polylines for an SVG decal (viewBox 0 0 100 100, stroke kept crisp with non-scaling-stroke).
// Main fissures run up from the impact point at the bottom edge and fork; a few hairlines spider out sideways.
export function crackPaths(seed, { x0 = 50, y0 = 100, mains = 3, len = 58 } = {}) {
  const r = rng(seed)
  const out = []
  const walk = (x, y, ang, length, width, depth) => {
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    let cx = x
    let cy = y
    const steps = Math.max(3, Math.round(length / 6))
    for (let i = 0; i < steps; i++) {
      ang += (r() - 0.5) * 0.9
      const s = length / steps
      cx += Math.cos(ang) * s * 1.25
      cy += Math.sin(ang) * s
      d += ` L${cx.toFixed(1)} ${cy.toFixed(1)}`
      if (depth < 2 && r() < 0.28) walk(cx, cy, ang + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), length * (0.35 + r() * 0.25), width * 0.6, depth + 1)
    }
    out.push({ d, w: width })
  }
  for (let k = 0; k < mains; k++) {
    const spread = mains > 1 ? (k / (mains - 1) - 0.5) * 2.1 : 0
    walk(x0 + (r() - 0.5) * 6, y0, -Math.PI / 2 + spread + (r() - 0.5) * 0.3, len * (0.7 + r() * 0.5), 2.2, 0)
  }
  return out
}

// Dust burst: soft puffs roll out along an edge and rock chips arc up and fall. Elements are pre-rendered in the
// container (`.pj-dust` with `.pj-puff` / `.pj-chip` children) and re-used on every burst.
export function dustBurst(container, power = 1) {
  if (!container) return
  const puffs = container.querySelectorAll('.pj-puff')
  const chips = container.querySelectorAll('.pj-chip')
  const w = container.clientWidth || 300
  puffs.forEach((el, i) => {
    const u = puffs.length > 1 ? i / (puffs.length - 1) : 0.5
    const side = u - 0.5
    gsap.killTweensOf(el)
    gsap.fromTo(
      el,
      { x: side * w * 0.8, y: 0, scale: 0.35, opacity: 0.85 },
      { x: side * w * (1.05 + 0.25 * power), y: -30 - Math.abs(side) * 30 - (i % 3) * 14, scale: 1.8 + (i % 4) * 0.45, opacity: 0, duration: 1.3 + (i % 3) * 0.25, ease: 'power3.out' },
    )
  })
  chips.forEach((el, i) => {
    const side = (i % 2 ? 1 : -1) * (0.15 + ((i * 37) % 10) / 12)
    const up = 70 + ((i * 53) % 9) * 16
    gsap.killTweensOf(el)
    gsap.set(el, { x: side * w * 0.12, y: 0, rotation: 0, opacity: 1 })
    gsap.to(el, { x: side * w * (0.35 + power * 0.15), duration: 1.1, ease: 'power1.out' })
    gsap.to(el, { rotation: side * 540, duration: 1.1, ease: 'none' })
    gsap.to(el, { keyframes: [{ y: -up, duration: 0.42, ease: 'power2.out' }, { y: 24, duration: 0.5, ease: 'power2.in' }], })
    gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.85 })
  })
}

// Crack decal: draw every fissure from its impact point (stroke-dashoffset), flare hot, then settle to a glow.
export function crackFlash(svg) {
  if (!svg) return
  const paths = svg.querySelectorAll('path')
  paths.forEach((p) => {
    const len = 160
    gsap.killTweensOf(p)
    gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, duration: 0.42, ease: 'power3.out' })
  })
  gsap.killTweensOf(svg)
  gsap.fromTo(svg, { '--crack-glow': 1 }, { '--crack-glow': 0.28, duration: 1.6, ease: 'power2.out', delay: 0.3 })
}

// LAMP STRIKE flicker (shared vocabulary): [0, .7, .15, 1, .4, 1] over 0.7 s
export function lampStrike(el, delay = 0) {
  if (!el) return null
  return gsap.fromTo(el, { opacity: 0 }, { keyframes: { opacity: [0, 0.7, 0.15, 1, 0.4, 1] }, duration: 0.7, delay, ease: 'none' })
}

export const pad = (n) => String(n).padStart(2, '0')
