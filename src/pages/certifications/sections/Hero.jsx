import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { certifications, education } from '../../../data/resume'

gsap.registerPlugin(ScrollTrigger)

const LAMP_STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]

/*
 * BEAT I — THE SANCTUM. Reference composition: the relic in smoke on the right (3D), a two-tone statement bottom
 * left, a glass quote card top right, HUD micro-labels. The statement slams in once the studio intro is done; the
 * "eye" readout flips from SEALED to OPEN as the visitor starts scrolling (the 3D lids open with it).
 */
export default function Hero({ ready }) {
  const root = useRef(null)
  const eye = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el || !ready) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const lines = el.querySelectorAll('.cs-in')
      const bits = el.querySelectorAll('[data-hero-in]')
      if (reduced) {
        gsap.set([lines, bits], { opacity: 1, clearProps: 'transform,filter' })
        return
      }
      const tl = gsap.timeline({ delay: 0.5 })
      tl.fromTo(
        lines,
        { yPercent: 70, scale: 1.3, rotateX: -32, opacity: 0, filter: 'blur(14px)', transformOrigin: '50% 100%' },
        { yPercent: 0, scale: 1, rotateX: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, stagger: 0.14, ease: 'expo.out', clearProps: 'filter' },
        0.9,
      )
      tl.fromTo(el.querySelector('.cert-statement .hl'), { opacity: 0 }, { keyframes: { opacity: LAMP_STRIKE }, duration: 0.7, ease: 'none' }, 1.6)
      tl.fromTo(bits, { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.09, ease: 'power4.out' }, 1.2)
      tl.fromTo(el.querySelector('.cert-quote'), { x: 40, opacity: 0, filter: 'blur(8px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', clearProps: 'filter' }, 1.9)

      // eye readout + parallax of the copy as the relic takes over
      ScrollTrigger.create({
        trigger: el,
        start: 'top top',
        end: 'bottom top',
        onUpdate: (self) => {
          if (eye.current) eye.current.textContent = self.progress > 0.12 ? 'open' : 'ajar'
          el.style.setProperty('--hero-p', self.progress.toFixed(3))
        },
      })
    }, el)
    return () => ctx.revert()
  }, [ready])

  return (
    <section ref={root} className="section cert-hero" id="certifications-hero" data-section="certifications-hero">
      <div className="cert-hero-inner">
        {/* mobile: the relic rides in this slot above the copy (desktop pins it to the viewport instead) */}
        <div className="cert-hero-slot" data-anchor="cert-hero-slot" aria-hidden="true" />
        <div className="cert-hero-copy">
          <p className="cert-kicker" data-hero-in>
            <i className="cert-dot" /> Relic 06 — The Sanctum Archive
          </p>
          <h1 className="statement cert-statement" aria-label="Certified in the arts.">
            <span className="cs-line" aria-hidden="true">
              <span className="cs-in">Certified</span>
            </span>
            <span className="cs-line" aria-hidden="true">
              <span className="cs-in hl">in the arts.</span>
            </span>
          </h1>
          <p className="cert-hero-sub" data-hero-in>
            {certifications.length} certifications and a degree, studied like spells — from Claude and prompt engineering to C#, .NET and Web APIs.
          </p>
          <div className="cert-hero-tags mono" data-hero-in>
            <span>Anthropic</span>
            <span>Anthropic Academy</span>
            <span>GUVI</span>
            <span>
              {education.start} — {education.end}
            </span>
          </div>
        </div>

        <figure className="quote-card cert-quote" data-copilot="CODEX · FOLIO VI">
          <blockquote>“A spell is only a lesson, repeated until it works the first time.”</blockquote>
          <cite>
            <span>Sanctum codex</span>
            <b>Folio VI</b>
          </cite>
        </figure>

        <div className="cert-hero-hud mono" aria-hidden="true">
          <span>
            <i className="cert-tick" /> Eye — <b ref={eye}>ajar</b>
          </span>
          <span>Ward 06 · Mystic arts</span>
          <span>Mandala lock · 72 runes</span>
        </div>

        <div className="cert-scroll-cue mono" aria-hidden="true">
          <span className="cert-cue-ring" />
          Scroll to open the eye
        </div>
      </div>
    </section>
  )
}
