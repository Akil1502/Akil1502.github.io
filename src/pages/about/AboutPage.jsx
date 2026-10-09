import { useEffect, useRef } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import NextPage from '../../components/NextPage'
import { measureSections, updateSectionProgress } from '../../three/scrollStore'
import HeroSection from './sections/HeroSection'
import FileSection from './sections/FileSection'
import RoadSection from './sections/RoadSection'
import CodeSection from './sections/CodeSection'
import FinalSection from './sections/FinalSection'
import { SHIELD_EVENT } from './choreo'
import './about.css'

/* ------------------------------------------------------------------------------------------------
 * 02 · ABOUT — CAPTAIN AMERICA
 * A recruit's personnel file told in five beats, with one round shield (AboutScene → ShieldRig) flying
 * the whole page:
 *   1. hero   — "Built to / hold the line." The shield spins in, lands, CLASSIFIED stamp.
 *   2. file   — pinned inspection stage (full scrubbed revolution) + summary + dossier (APPROVED).
 *   3. road   — the journey; SHIELD THROW ricochets medal → medal down the rail.
 *   4. code   — pinned principles stage; SHIELD THROW ricochets card → card.
 *   5. final  — the shield returns and is caught; orders (contact / résumé).
 * The DOM is the source of truth for every word; the shield rig only reports impacts (SHIELD_EVENT).
 * ---------------------------------------------------------------------------------------------- */

export default function AboutPage({ ready }) {
  const root = useRef(null)

  // impacts reported by the 3D rig → flash + mark the struck target
  useEffect(() => {
    const el = root.current
    if (!el) return
    const timers = new Set()
    const onShield = (e) => {
      const { type, key } = e.detail || {}
      if (type !== 'hit' && type !== 'mark') return
      const target = el.querySelector(`[data-hit="${key}"]`)
      if (!target) return
      target.classList.add('is-struck')
      if (type === 'hit') {
        target.classList.remove('is-hit')
        void target.offsetWidth
        target.classList.add('is-hit')
        const id = setTimeout(() => {
          target.classList.remove('is-hit')
          timers.delete(id)
        }, 900)
        timers.add(id)
      }
    }
    window.addEventListener(SHIELD_EVENT, onShield)
    return () => {
      window.removeEventListener(SHIELD_EVENT, onShield)
      timers.forEach(clearTimeout)
    }
  }, [])

  // fonts change line breaks (and the pinned stages' lengths): re-measure once they settle
  useEffect(() => {
    let dead = false
    const remeasure = () => {
      if (dead) return
      ScrollTrigger.refresh()
      measureSections()
      updateSectionProgress()
    }
    const raf = requestAnimationFrame(remeasure)
    document.fonts?.ready?.then(remeasure)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={root} className="page page-about">
      <HeroSection ready={ready} />
      <FileSection />
      <RoadSection />
      <CodeSection />
      <FinalSection />
      <NextPage current="about" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
