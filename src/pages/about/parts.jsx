import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { isTransitioning, onTransition } from '../../transition/controller'

export const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Thin red / white / blue light stripe used in labels and dividers.
export function TriBar({ className = '' }) {
  return (
    <span className={`ab-tribar ${className}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  )
}

// Rubber stamp (decorative, aria-hidden). Slam it in with slam().
export function Stamp({ children, className = '', tone = 'red' }) {
  return (
    <span className={`ab-stamp ab-stamp--${tone} ${className}`} aria-hidden="true">
      <span className="ab-stamp-in">{children}</span>
    </span>
  )
}

// Rubber-stamp slam: drops from oversized + blurred, lands hard (camera impulse) and leaves an ink ring.
export function slam(tl, el, at = 0, { rotate = -9, impulse = 0.4 } = {}) {
  if (!el) return
  tl.fromTo(
    el,
    { opacity: 0, scale: 2.7, rotate: rotate - 14, filter: 'blur(8px)' },
    { opacity: 1, scale: 1, rotate, filter: 'blur(0px)', duration: 0.38, ease: 'power4.in', immediateRender: true },
    at,
  )
  tl.call(
    () => {
      window.__portfolioImpulse?.(impulse)
      el.classList.remove('is-slammed')
      void el.offsetWidth
      el.classList.add('is-slammed')
    },
    null,
    `>-0.01`,
  )
}

// Fires `cb` once, when the page is actually on screen: after the studio loader (ready) and after a
// route transition has finished revealing the page.
export function useArrival(ready, cb) {
  const done = useRef(false)
  const cbRef = useRef(cb)
  cbRef.current = cb
  useEffect(() => {
    if (!ready || done.current) return
    const fire = () => {
      if (done.current) return
      done.current = true
      cbRef.current()
    }
    if (!isTransitioning()) {
      const id = setTimeout(fire, 80)
      return () => clearTimeout(id)
    }
    const off = onTransition((phase) => {
      if (phase === 'done') fire()
    })
    return () => off()
  }, [ready])
}

// Typewriter cell. The ghost holds the real text (accessible, reserves the layout); the live span is typed.
export function TypeCell({ text }) {
  return (
    <span className="ab-type">
      <span className="ab-type-ghost">{text}</span>
      <span className="ab-type-live" aria-hidden="true" data-text={text} />
    </span>
  )
}

export function typeIn(tl, live, at, msPerChar = 0.02) {
  const full = live?.dataset.text || ''
  const dur = Math.max(0.2, full.length * msPerChar)
  if (!live) return dur
  const o = { n: 0 }
  tl.to(
    o,
    {
      n: full.length,
      duration: dur,
      ease: 'none',
      onUpdate: () => {
        live.textContent = full.slice(0, Math.round(o.n))
      },
    },
    at,
  )
  return dur
}

// Wraps each phrase found in `text` with <mark>. Returns React nodes.
export function highlight(text, phrases, keyBase = 'h') {
  const nodes = []
  let rest = text
  let k = 0
  while (rest.length) {
    let best = null
    for (const ph of phrases) {
      const i = rest.indexOf(ph)
      if (i !== -1 && (best === null || i < best.i)) best = { i, ph }
    }
    if (!best) {
      nodes.push(rest)
      break
    }
    if (best.i > 0) nodes.push(rest.slice(0, best.i))
    nodes.push(
      <mark className="ab-mark" key={`${keyBase}-${k}`} style={{ '--i': k }}>
        {best.ph}
      </mark>,
    )
    k++
    rest = rest.slice(best.i + best.ph.length)
  }
  return nodes
}

export { gsap }
