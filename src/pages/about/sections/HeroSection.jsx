import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { profile, experience } from '../../../data/resume'
import { scroll } from '../../../three/scrollStore'
import { TriBar, Stamp, slam, useArrival, prefersReduced } from '../parts'
import { STRIKE } from '../choreo'

const current = experience.find((e) => e.current) || experience[0]

// Beat 1 — the recruit file opens. Statement left, the shield spins in from off-screen right and lands in
// the slot (ShieldRig), HUD brackets lock onto it, the title slams, the CLASSIFIED stamp hits.
export default function HeroSection({ ready }) {
  const root = useRef(null)

  // hide the arrival pieces before first paint (they animate in on arrival)
  useLayoutEffect(() => {
    const el = root.current
    if (!el || prefersReduced()) return
    gsap.set(el.querySelectorAll('[data-intro]'), { opacity: 0 })
    gsap.set(el.querySelectorAll('.ab-hero-title .ab-line > span'), { yPercent: 110 })
    gsap.set(el.querySelector('.ab-hero-stamp'), { opacity: 0 })
  }, [])

  // the arrival timeline must not outlive the page (its stamp slam shakes the camera)
  const intro = useRef(null)
  useEffect(() => () => intro.current?.kill(), [])

  useArrival(ready, () => {
    const el = root.current
    if (!el) return
    scroll.aboutArrive = performance.now()
    if (prefersReduced()) {
      el.classList.add('is-locked')
      return
    }
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
    intro.current = tl
    // shield lands at ~0.55 s (ShieldRig intro) → brackets lock on → title slams → stamp
    tl.to(el.querySelectorAll('.ab-eyebrow, .ab-hero-id'), { opacity: 1, duration: 0.8, stagger: 0.1 }, 0.15)
    tl.call(() => el.classList.add('is-locked'), null, 0.55)
    tl.fromTo(
      el.querySelectorAll('.ab-hero-title .ab-line > span'),
      { yPercent: 110, scale: 1.3, filter: 'blur(14px)' },
      { yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.12, clearProps: 'filter' },
      0.5,
    )
    tl.set(el.querySelector('.ab-hero-title'), { opacity: 1 }, 0.5)
    tl.fromTo(el.querySelectorAll('.ab-hero-lede, .ab-hero-actions'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.1 }, 0.95)
    // lamp strike on the quote card
    tl.to(el.querySelector('.ab-quote'), { keyframes: { opacity: STRIKE, easeEach: 'none' }, duration: 0.7, ease: 'none' }, 1.15)
    tl.to(el.querySelectorAll('.ab-hero-readout'), { opacity: 1, duration: 0.5, stagger: 0.12 }, 0.8)
    slam(tl, el.querySelector('.ab-hero-stamp'), 1.45, { rotate: -9, impulse: 0.38 })
  })

  const charge = (v) => () => {
    scroll.aboutCharge = v
  }

  return (
    <section ref={root} className="section ab-hero" data-section="about-hero">
      <div className="ab-newsreel" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="ab-hero-grid">
        <div className="ab-hero-copy">
          <p className="ab-eyebrow mono" data-intro>
            <TriBar /> Personnel file 02 <span className="ab-dim">· the origin</span>
          </p>
          <h1 className="statement ab-hero-title" data-intro aria-label="Built to hold the line." onPointerEnter={charge(1)} onPointerLeave={charge(0)} data-interactive="">
            <span className="ab-line" aria-hidden="true">
              <span>Built to</span>
            </span>
            <span className="ab-line" aria-hidden="true">
              <span className="hl">hold the line.</span>
            </span>
            <Stamp className="ab-hero-stamp">Classified</Stamp>
          </h1>
          <p className="ab-hero-id mono" data-intro>
            {profile.name} <span className="ab-sep">/</span> {profile.title} <span className="ab-sep">/</span> {current.company}
          </p>
          <p className="ab-hero-lede" data-intro>
            {profile.title} with {profile.yearsExperience} years of experience building enterprise web applications in {profile.location} &mdash; built to team
            coding standards, keeping live portals stable, and shipping alongside the team every sprint.
          </p>
          <div className="ab-hero-actions" data-intro>
            <a
              href="#about-file"
              className="btn btn-primary"
              data-cursor="OPEN"
              onClick={(e) => {
                e.preventDefault()
                const t = document.querySelector('[data-section="about-file"]')
                if (t) window.__lenis ? window.__lenis.scrollTo(t, { duration: 1.6 }) : t.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Open the file <span className="arrow">↓</span>
            </a>
            <span className="ab-hero-hint mono">Tip · click the shield</span>
          </div>
        </div>

        {/* empty slot: the 3D shield renders here (the canvas below takes the clicks) */}
        <div className="ab-hero-slot" data-anchor="about-shield-hero" data-copilot="SHIELD · CLICK TO THROW">
          <span className="ab-lock ab-lock--tl" aria-hidden="true" />
          <span className="ab-lock ab-lock--tr" aria-hidden="true" />
          <span className="ab-lock ab-lock--bl" aria-hidden="true" />
          <span className="ab-lock ab-lock--br" aria-hidden="true" />
          <span className="ab-hero-readout ab-hero-readout--a mono" data-intro aria-hidden="true">
            <i /> Target · round shield
          </span>
          <span className="ab-hero-readout ab-hero-readout--b mono" data-intro aria-hidden="true">
            Ø 0.76 m · rings 3 · star 1
          </span>
        </div>
      </div>

      <blockquote className="quote-card ab-quote" data-intro>
        &ldquo;Follow the standard. Back the team. Get a little better every sprint.&rdquo;
        <cite>
          <span>{profile.name}</span>
          <b>Field principles</b>
        </cite>
      </blockquote>
    </section>
  )
}
