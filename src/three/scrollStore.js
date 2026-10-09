// Tiny mutable store shared between the DOM scroll (Lenis) and the R3F scene.
// Mutated in place on every scroll frame; read inside useFrame without causing React re-renders.
export const scroll = {
  y: 0, // current scroll position in px
  progress: 0, // 0..1 over the whole document
  velocity: 0, // px per frame, smoothed
  limit: 1, // max scroll
  sections: {}, // id -> { top, height, progress(0..1 of section through viewport) }
  mouse: { x: 0, y: 0 }, // normalised -1..1, smoothed
  pointerDown: false,
}

let targetMouse = { x: 0, y: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      targetMouse.x = (e.clientX / window.innerWidth) * 2 - 1
      targetMouse.y = -((e.clientY / window.innerHeight) * 2 - 1)
    },
    { passive: true },
  )
  window.addEventListener('pointerdown', () => (scroll.pointerDown = true), { passive: true })
  window.addEventListener('pointerup', () => (scroll.pointerDown = false), { passive: true })
}

// Call once per frame from the scene to smooth the mouse.
export function tickMouse(dt) {
  const k = 1 - Math.pow(0.001, dt) // frame-rate independent lerp
  scroll.mouse.x += (targetMouse.x - scroll.mouse.x) * k
  scroll.mouse.y += (targetMouse.y - scroll.mouse.y) * k
}

// Recompute per-section progress from DOM positions. Sections are elements with [data-section].
export function measureSections() {
  const els = document.querySelectorAll('[data-section]')
  const vh = window.innerHeight
  els.forEach((el) => {
    const id = el.dataset.section
    const rect = el.getBoundingClientRect()
    const top = rect.top + scroll.y
    scroll.sections[id] = { top, height: rect.height, progress: 0, visible: 0 }
  })
  scroll.vh = vh
}

export function updateSectionProgress() {
  const vh = scroll.vh || window.innerHeight
  for (const id in scroll.sections) {
    const s = scroll.sections[id]
    // progress: 0 when section top enters bottom of viewport, 1 when section bottom leaves top
    const start = s.top - vh
    const end = s.top + s.height
    s.progress = clamp((scroll.y - start) / (end - start), 0, 1)
    // visible: 0..1 how centred the section is in the viewport (1 = centred)
    const centre = s.top + s.height / 2
    const dist = Math.abs(scroll.y + vh / 2 - centre)
    s.visible = clamp(1 - dist / (s.height / 2 + vh / 2), 0, 1)
  }
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
