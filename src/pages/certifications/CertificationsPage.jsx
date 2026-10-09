import { useEffect, useRef } from 'react'
import NextPage from '../../components/NextPage'
import Hero from './sections/Hero'
import Codex from './sections/Codex'
import Spells from './sections/Spells'
import Time from './sections/Time'
import Close from './sections/Close'
import { scroll } from '../../three/scrollStore'
import { resetCert } from './store'
import './certifications.css'

const BEATS = [
  { id: 'certifications-hero', n: 'I', label: 'Sanctum' },
  { id: 'certifications-codex', n: 'II', label: 'Codex' },
  { id: 'certifications-spells', n: 'III', label: 'Spells' },
  { id: 'certifications-time', n: 'IV', label: 'Foundation' },
  { id: 'certifications-close', n: 'V', label: 'Practice' },
]

// HUD rail on the right edge: one rune per beat, the active one lit, a thread that fills with page progress.
function BeatRail() {
  const root = useRef(null)
  useEffect(() => {
    let raf
    let last = -1
    const loop = () => {
      const el = root.current
      if (el) {
        const vh = scroll.vh || window.innerHeight
        const mid = (scroll.y || 0) + vh * 0.5
        let active = 0
        BEATS.forEach((b, i) => {
          const s = scroll.sections[b.id]
          if (s && mid >= s.top) active = i
        })
        if (active !== last) {
          last = active
          el.querySelectorAll('.cb-item').forEach((n, i) => n.classList.toggle('is-active', i === active))
        }
        el.style.setProperty('--p', (scroll.progress || 0).toFixed(3))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  const go = (id) => (e) => {
    e.preventDefault()
    const s = scroll.sections[id]
    if (s && window.__lenis) window.__lenis.scrollTo(s.top, { duration: 1.6 })
  }
  return (
    <nav ref={root} className="cert-rail" aria-label="Page beats">
      <span className="cb-thread" aria-hidden="true">
        <i />
      </span>
      {BEATS.map((b) => (
        <a key={b.id} href={`#${b.id}`} className="cb-item" onClick={go(b.id)} data-cursor={b.n}>
          <span className="cb-n">{b.n}</span>
          <span className="cb-label mono">{b.label}</span>
        </a>
      ))}
    </nav>
  )
}

/*
 * 06 · CERTIFICATIONS — DOCTOR STRANGE. Five beats over a pinned relic (see CertificationsScene):
 *   I   Sanctum     — the amulet assembles backwards, the spell circle draws itself, the eye opens
 *   II  Codex       — exploded view of the relic with HUD callouts (counts)
 *   III Spells      — five certification cards, each revealed through a sling-ring spark portal
 *   IV  Foundation  — TIME REVERSAL: the shattered education record rewinds itself whole (pinned stage)
 *   V   Practice    — the closing statement un-scatters (time reversal again), résumé
 *   then the next mission, through one last portal.
 */
export default function CertificationsPage({ ready }) {
  useEffect(() => () => resetCert(), [])
  return (
    <div className="page page-certifications">
      <BeatRail />
      <Hero ready={ready} />
      <Codex />
      <Spells />
      <Time />
      <Close />
      <NextPage current="certifications" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
