import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { scroll } from '../three/scrollStore'
import { PAGES } from '../data/heroes'
import HeroLink from '../transition/HeroLink'
import Emblem from './Emblem'
import Magnetic from './Magnetic'
import { profile } from '../data/resume'

// Top bar + full-screen "Hero Select" roster. Each page link carries its hero's colour (--h-a / --h-b).
export default function Nav({ ready, page }) {
  const bar = useRef(null)
  const menu = useRef(null)
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  // hide on scroll down, show on scroll up
  useEffect(() => {
    let raf
    let lastY = 0
    const loop = () => {
      const dy = scroll.y - lastY
      if (Math.abs(dy) > 4) {
        setHidden(dy > 0 && scroll.y > 140)
        lastY = scroll.y
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!ready || !bar.current) return
    gsap.fromTo(bar.current.querySelectorAll('[data-nav-item]'), { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.05, ease: 'power4.out', delay: 0.2 })
  }, [ready])

  // roster cards assemble in when the menu opens
  useEffect(() => {
    const el = menu.current
    if (!el) return
    const cards = el.querySelectorAll('.hs-card')
    if (open) {
      window.__lenis?.stop()
      gsap.fromTo(
        cards,
        { y: (i) => (i % 2 ? 80 : -80), rotateY: (i) => (i % 2 ? 40 : -40), opacity: 0, scale: 0.8 },
        { y: 0, rotateY: 0, opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.06, delay: 0.25 },
      )
    } else {
      window.__lenis?.start()
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <header ref={bar} className={`nav ${hidden && !open ? 'is-hidden' : ''} ${ready ? 'is-ready' : ''}`}>
        <HeroLink to="home" className="nav-logo" data-nav-item aria-label="Home">
          <span className="nav-hex">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <span className="nav-hex-text">AP</span>
          </span>
          <span className="nav-logo-text">
            <span>AKIL PRABHU</span>
            <small>{page ? page.codename : 'SOFTWARE ENGINEER'}</small>
          </span>
        </HeroLink>

        <nav className="nav-links" aria-label="Pages">
          {PAGES.map((p, i) => (
            <HeroLink
              key={p.id}
              to={p.id}
              className={`nav-link ${page?.id === p.id ? 'is-active' : ''}`}
              data-nav-item
              style={{ '--h-a': p.theme.primary, '--h-b': p.theme.accent }}
              aria-current={page?.id === p.id ? 'page' : undefined}
            >
              <span className="nav-link-n">{String(i + 1).padStart(2, '0')}</span>
              <span className="nav-link-label">{p.label}</span>
            </HeroLink>
          ))}
        </nav>

        <div className="nav-right" data-nav-item>
          <Magnetic>
            <a href={`mailto:${profile.email}`} className="btn btn-primary nav-cta" data-cursor="MAIL">
              <span>Engage ↗</span>
            </a>
          </Magnetic>
          <button className={`nav-burger ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-label="Sections menu" aria-expanded={open}>
            <span />
            <span />
          </button>
        </div>
      </header>

      <div ref={menu} className={`hero-select ${open ? 'is-open' : ''}`} aria-hidden={!open} role="dialog" aria-label="Choose a page">
        <div className="hs-inner">
          <p className="hs-kicker mono">Choose a section</p>
          <ul className="hs-grid">
            {PAGES.map((p, i) => (
              <li key={p.id}>
                <HeroLink
                  to={p.id}
                  onNavigate={() => setOpen(false)}
                  className={`hs-card ${page?.id === p.id ? 'is-current' : ''}`}
                  style={{ '--h-a': p.theme.primary, '--h-b': p.theme.accent, '--h-c': p.theme.accent2, '--h-bg': p.theme.bg2, '--h-font': p.theme.heroFont, '--hs-len': Math.max(6, p.label.length) }}
                  tabIndex={open ? 0 : -1}
                  data-cursor="SELECT"
                >
                  <span className="hs-num mono">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hs-emblem">
                    <Emblem id={p.emblem} size={74} />
                  </span>
                  <span className="hs-hero">{p.label}</span>
                  <span className="hs-label mono">{p.hero} theme</span>
                  <span className="hs-blurb">{p.blurb}</span>
                </HeroLink>
              </li>
            ))}
          </ul>
          <div className="hs-foot mono">
            <a href={profile.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>
            <a href={profile.github} target="_blank" rel="noreferrer">GitHub</a>
            <a href={`mailto:${profile.email}`}>Email</a>
            <a href="/Akil-Prabhu-Resume.pdf" download>Résumé PDF</a>
          </div>
        </div>
      </div>
    </>
  )
}
