import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Reveals children matching `selector` (default: direct [data-reveal] descendants) when the container scrolls into view.
// Options: { y, stagger, duration, start, once, selector, from }
export function useReveal(options = {}) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const {
      y = 40,
      stagger = 0.08,
      duration = 1.1,
      start = 'top 80%',
      once = true,
      selector = '[data-reveal]',
      from = {},
      delay = 0,
    } = options
    const targets = selector === 'self' ? [el] : el.querySelectorAll(selector)
    if (!targets.length) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform' })
      return
    }
    gsap.set(targets, { opacity: 0, y, ...from })
    const tween = gsap.to(targets, {
      opacity: 1,
      y: 0,
      x: 0,
      rotateX: 0,
      scale: 1,
      duration,
      delay,
      stagger,
      ease: 'power4.out',
      overwrite: 'auto',
      scrollTrigger: { trigger: el, start, once, toggleActions: once ? 'play none none none' : 'play none none reverse' },
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return ref
}
