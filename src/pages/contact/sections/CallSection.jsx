import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile } from '../../../data/resume'
import SplitText from '../../../components/SplitText'
import Magnetic from '../../../components/Magnetic'
import { scroll } from '../../../three/scrollStore'
import { RESUME_HREF, PHONE_HREF } from './Channels'

gsap.registerPlugin(ScrollTrigger)

// THE CALL — the finale. Every token portals home and the formation re-forms face-on around the biggest link on
// the site. Hovering / focusing the email makes all six lean in toward the beacon and the vortex surge
// (scroll.ctEmail). [data-anchor="ct-call-crest"] is the rectangle the 3D formation is fitted into.
export default function CallSection() {
  const root = useRef(null)

  // reveal: kicker / email / actions rise in; the email "locks on" with a lamp-strike
  useEffect(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const items = el.querySelectorAll('[data-call-in]')
    const mail = el.querySelector('.ct-email')
    gsap.set(items, { opacity: 0, y: 30 })
    const tl = gsap.timeline({ paused: true })
    tl.to(items, { opacity: 1, y: 0, duration: 1, ease: 'power4.out', stagger: 0.1 }, 0)
    tl.fromTo(mail, { opacity: 0 }, { keyframes: { opacity: [0, 0.7, 0.15, 1, 0.4, 1] }, duration: 0.7, ease: 'none' }, 0.25)
    const st = ScrollTrigger.create({ trigger: el, start: 'top 62%', once: true, onEnter: () => tl.play() })
    return () => {
      st.kill()
      tl.kill()
    }
  }, [])

  useEffect(() => () => void (scroll.ctEmail = 0), [])
  const on = () => void (scroll.ctEmail = 1)
  const off = () => void (scroll.ctEmail = 0)

  return (
    <section ref={root} className="section ct-call" data-section="contact-call">
      <div className="ct-call-crest" data-anchor="ct-call-crest" aria-hidden="true" />
      <div className="ct-call-inner">
        <span className="ct-kicker" data-call-in="">
          <i className="ct-dot" aria-hidden="true" /> Assembly point · {profile.location}
        </span>
        <SplitText as="h2" className="statement ct-call-title" lines={['Send the', <span key="hl" className="hl">signal.</span>]} start="top 70%" />
        <div className="ct-email-wrap" data-call-in="">
          <Magnetic strength={0.14} radius={150} className="ct-email-magnet">
            <a
              className="ct-email"
              href={`mailto:${profile.email}`}
              data-cursor="MAIL"
              data-copilot="SEND MAIL"
              onPointerEnter={on}
              onPointerLeave={off}
              onPointerCancel={off}
              onFocus={on}
              onBlur={off}
            >
              <span className="ct-email-text">{profile.email}</span>
              <span className="ct-email-line" aria-hidden="true" />
            </a>
          </Magnetic>
        </div>
        <div className="ct-call-actions" data-call-in="">
          <Magnetic strength={0.2} radius={36}>
            <a className="btn btn-ghost" href={profile.linkedin} target="_blank" rel="noreferrer noopener" data-cursor="OPEN">
              LinkedIn <span className="arrow">↗</span>
            </a>
          </Magnetic>
          <Magnetic strength={0.2} radius={36}>
            <a className="btn btn-ghost" href={profile.github} target="_blank" rel="noreferrer noopener" data-cursor="CODE">
              GitHub <span className="arrow">↗</span>
            </a>
          </Magnetic>
          <Magnetic strength={0.2} radius={36}>
            <a className="btn btn-gold" href={RESUME_HREF} download="Akil-Prabhu-Resume.pdf" data-cursor="PDF">
              Download résumé <span className="arrow">↓</span>
            </a>
          </Magnetic>
          <Magnetic strength={0.2} radius={36}>
            <a className="btn btn-ghost" href={PHONE_HREF} data-cursor="CALL">
              {profile.phone}
            </a>
          </Magnetic>
        </div>
        <p className="ct-call-note" data-call-in="">
          Let&apos;s build something together.
        </p>
      </div>
    </section>
  )
}
