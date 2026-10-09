import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { scroll, measureSections, updateSectionProgress } from '../three/scrollStore'

gsap.registerPlugin(ScrollTrigger)

let lenisInstance = null
export const getLenis = () => lenisInstance

// Smooth scroll via Lenis, synced to GSAP's ticker + ScrollTrigger, feeding the shared scroll store.
export function useLenis(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const lenis = new Lenis({
      lerp: 0.085,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
      smoothWheel: true,
      syncTouch: false,
    })
    lenisInstance = lenis
    window.__lenis = lenis // exposed for the headless visual-check script

    let lastY = 0
    lenis.on('scroll', (e) => {
      scroll.y = e.scroll
      scroll.limit = e.limit || 1
      scroll.progress = e.limit ? e.scroll / e.limit : 0
      scroll.velocity = scroll.velocity * 0.8 + (e.scroll - lastY) * 0.2
      lastY = e.scroll
      updateSectionProgress()
      ScrollTrigger.update()
    })

    const raf = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    const onResize = () => {
      measureSections()
      updateSectionProgress()
      ScrollTrigger.refresh()
    }
    measureSections()
    updateSectionProgress()
    window.addEventListener('resize', onResize)
    // re-measure once fonts/layout settle
    const t1 = setTimeout(onResize, 300)
    const t2 = setTimeout(onResize, 1500)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener('resize', onResize)
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisInstance = null
    }
  }, [enabled])
}

export function scrollToSection(id) {
  const el = document.querySelector(`[data-section="${id}"]`)
  if (!el) return
  if (lenisInstance) lenisInstance.scrollTo(el, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) })
  else el.scrollIntoView({ behavior: 'smooth' })
}
