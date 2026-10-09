import { useEffect, useLayoutEffect, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroStage from './sections/HeroStage'
import Channels from './sections/Channels'
import CallSection from './sections/CallSection'
import Credits from './sections/Credits'
import { resetContactStore } from './timeline'
import { measureSections, updateSectionProgress } from '../../three/scrollStore'
import './contact.css'

// 07 · CONTACT — AVENGERS ASSEMBLE. The finale page: the whole team assembles through sling-ring portals around
// a gold beacon (pinned stage), then delivers the six contact channels, re-forms around the big email, and rolls
// the end credits. 3D lives in ContactScene.jsx; shared choreography in timeline.js.
export default function ContactPage({ ready }) {
  const root = useRef(null)
  // layout effect: must run before the children's passive effects (Channels marks cards open on mount when
  // reduced motion is on), or this reset would wipe their state
  useLayoutEffect(() => {
    resetContactStore()
    return () => resetContactStore()
  }, [])

  // The 3D director reads section tops from the scroll store; if the page's height changes after mount (late
  // font swap, cards reflowing), re-measure so DOM and GL beats stay locked together.
  useEffect(() => {
    const el = root.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let lastH = el.offsetHeight
    let timer = 0
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      if (Math.abs(h - lastH) < 2) return
      lastH = h
      clearTimeout(timer)
      timer = setTimeout(() => {
        measureSections()
        updateSectionProgress()
        ScrollTrigger.refresh()
      }, 180)
    })
    ro.observe(el)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={root} className="page page-contact">
      <HeroStage ready={ready} />
      <Channels />
      <CallSection />
      <Credits />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
