import { useEffect, useRef } from 'react'
import gsap from 'gsap'

// Custom cursor: a small dot that follows instantly and a ring that lags, growing over interactive elements.
export default function Cursor() {
  const dot = useRef(null)
  const ring = useRef(null)
  const label = useRef(null)
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return
    document.documentElement.classList.add('has-custom-cursor')
    const dx = gsap.quickTo(dot.current, 'x', { duration: 0.08, ease: 'power2.out' })
    const dy = gsap.quickTo(dot.current, 'y', { duration: 0.08, ease: 'power2.out' })
    const rx = gsap.quickTo(ring.current, 'x', { duration: 0.42, ease: 'power3.out' })
    const ry = gsap.quickTo(ring.current, 'y', { duration: 0.42, ease: 'power3.out' })
    const onMove = (e) => {
      dx(e.clientX)
      dy(e.clientY)
      rx(e.clientX)
      ry(e.clientY)
    }
    const onOver = (e) => {
      const t = e.target.closest('a, button, [data-interactive], [data-cursor]')
      const text = t?.dataset?.cursor
      if (t) {
        ring.current.classList.add('is-active')
        if (text) {
          label.current.textContent = text
          ring.current.classList.add('has-label')
        } else ring.current.classList.remove('has-label')
      } else {
        ring.current.classList.remove('is-active', 'has-label')
      }
    }
    const onDown = () => ring.current.classList.add('is-down')
    const onUp = () => ring.current.classList.remove('is-down')
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointerup', onUp, { passive: true })
    return () => {
      document.documentElement.classList.remove('has-custom-cursor')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])
  return (
    <>
      <div ref={dot} className="cursor-dot" aria-hidden="true" />
      <div ref={ring} className="cursor-ring" aria-hidden="true">
        <span ref={label} className="cursor-label" />
      </div>
    </>
  )
}
