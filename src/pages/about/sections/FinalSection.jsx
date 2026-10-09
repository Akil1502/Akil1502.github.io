import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile } from '../../../data/resume'
import Magnetic from '../../../components/Magnetic'
import HeroLink from '../../../transition/HeroLink'
import { TriBar, prefersReduced } from '../parts'
import { SHIELD_EVENT, STRIKE } from '../choreo'

gsap.registerPlugin(ScrollTrigger)

// Beat 5 — the return. The orders (contact / résumé) rise in as the section arrives; the shield comes home to
// the centre slot (the catch: flash, rim glow, impulse, burst ring) and the closing line lamp-strikes.
export default function FinalSection() {
  const root = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = prefersReduced()
    const title = el.querySelector('.ab-final-title')
    const parts = el.querySelectorAll('.ab-final-copy > *')
    const tweens = []
    // the orders read as soon as the section arrives (never an empty screen while the shield is still in flight)
    if (!reduced) {
      tweens.push(
        gsap.fromTo(
          parts,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 72%', once: true } },
        ),
      )
    }
    // the catch: burst ring + a lamp strike on the closing line
    let caught = false
    const catchIt = () => {
      if (caught) return
      caught = true
      el.classList.add('is-caught')
      if (reduced || !title) return
      tweens.push(gsap.fromTo(title, { opacity: 0 }, { keyframes: { opacity: STRIKE, easeEach: 'none' }, duration: 0.7, ease: 'none', delay: 0.05 }))
    }
    const onShield = (e) => {
      if (e.detail?.type === 'catch') catchIt()
    }
    window.addEventListener(SHIELD_EVENT, onShield)
    // fallback (no WebGL / shield never arrives): mark the catch once the section is well in view
    let timer = 0
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && en.intersectionRatio > 0.6 && !timer) timer = setTimeout(catchIt, 1400)
        })
      },
      { threshold: [0.6] },
    )
    io.observe(el)
    return () => {
      window.removeEventListener(SHIELD_EVENT, onShield)
      io.disconnect()
      clearTimeout(timer)
      tweens.forEach((t) => {
        t.scrollTrigger?.kill()
        t.kill()
      })
    }
  }, [])

  return (
    <section ref={root} className="section ab-final" data-section="about-final">
      <div className="ab-final-slot" data-anchor="about-shield-final" aria-hidden="true">
        <span className="ab-final-burst" />
      </div>
      <div className="ab-final-copy">
        <p className="ab-label mono">
          <span className="ab-label-n hero-title">04</span> Orders <TriBar />
        </p>
        <h2 className="statement ab-final-title">
          Let&rsquo;s build <span className="hl">something together.</span>
        </h2>
        <p className="ab-final-sub">
          <span>
            {profile.title} · {profile.location}
          </span>
          <span className="ab-dim">{profile.tagline}</span>
        </p>
        <div className="ab-final-ctas">
          <Magnetic strength={0.3}>
            <HeroLink to="contact" className="btn btn-primary" data-cursor="CONTACT" data-copilot="OPEN A CHANNEL">
              Open a channel <span className="arrow">→</span>
            </HeroLink>
          </Magnetic>
          <Magnetic strength={0.3}>
            <a className="btn btn-ghost" href="/Akil-Prabhu-Resume.pdf" download data-cursor="PDF">
              Résumé · PDF <span className="arrow">↓</span>
            </a>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
