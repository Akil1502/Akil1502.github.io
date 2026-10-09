import { useRef, useEffect } from 'react'
import gsap from 'gsap'

// Wraps an element so it is pulled towards the cursor (magnetic button effect).
export default function Magnetic({ children, strength = 0.35, radius = 110, as: Tag = 'div', className = '', ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(pointer: coarse)').matches) return
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' })
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const d = Math.hypot(dx, dy)
      if (d < radius + Math.max(r.width, r.height) / 2) {
        xTo(dx * strength)
        yTo(dy * strength)
      } else {
        xTo(0)
        yTo(0)
      }
    }
    const onLeave = () => {
      xTo(0)
      yTo(0)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [strength, radius])
  return (
    <Tag ref={ref} className={className} data-interactive="" style={{ display: 'inline-block', willChange: 'transform' }} {...rest}>
      {children}
    </Tag>
  )
}
