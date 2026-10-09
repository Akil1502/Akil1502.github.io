import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Magnetic from '../../../components/Magnetic'
import { cert } from '../store'

gsap.registerPlugin(ScrollTrigger)

const LINES = [
  { text: 'Study the craft.', hl: false },
  { text: 'Cast it in code.', hl: true },
]

/*
 * BEAT V — THE PRACTICE (TIME REVERSAL, second use). The closing statement begins as scattered, tumbling glyphs and
 * is scrubbed back together by scroll — last letters first, like a sentence being un-written in reverse — with a
 * green time-trail that fades as each letter locks. When the last glyph lands: lamp strike + green flare on the relic.
 */
export default function Close() {
  const root = useRef(null)
  const words = useMemo(
    () =>
      LINES.map((l) =>
        l.text.split(' ').map((w) => Array.from(w)),
      ),
    [],
  )

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const chars = Array.from(el.querySelectorAll('.cl-ch'))
    const head = el.querySelector('.close-statement')
    if (reduced) {
      cert.close = 1
      return
    }
    const spread = Math.max(0.4, Math.min(1, window.innerWidth / 1280))
    let s = 17
    const r = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    const n = chars.length
    const fly = chars.map((_, i) => ({
      x: (r() - 0.5) * 900 * spread,
      y: (r() - 0.5) * 520 * spread,
      rot: (r() - 0.5) * 300,
      rx: (r() - 0.5) * 140,
      sc: 0.4 + r() * 1.6,
      delay: ((n - 1 - i) / n) * 0.4,
    }))
    let done = false
    const apply = (p) => {
      cert.close = p
      for (let i = 0; i < n; i++) {
        const f = fly[i]
        const k = Math.max(0, Math.min(1, (p - f.delay) / 0.6))
        const rem = 1 - k * k * (3 - 2 * k) * k // ease-in-ish, snaps home
        const c = chars[i]
        if (rem < 0.001) {
          c.style.transform = 'none'
          c.style.opacity = '1'
          c.style.filter = 'none'
          c.style.textShadow = ''
          continue
        }
        c.style.transform = `translate3d(${(f.x * rem).toFixed(1)}px, ${(f.y * rem).toFixed(1)}px, 0) rotate(${(f.rot * rem).toFixed(1)}deg) rotateX(${(f.rx * rem).toFixed(1)}deg) scale(${(1 + (f.sc - 1) * rem).toFixed(3)})`
        c.style.opacity = (1 - rem * 0.75).toFixed(3)
        c.style.filter = `blur(${(rem * 6).toFixed(2)}px)`
        c.style.textShadow = `0 0 ${(rem * 28).toFixed(1)}px rgba(56, 242, 154, ${(rem * 0.9).toFixed(2)})`
      }
      const whole = p >= 0.999
      if (whole && !done) {
        done = true
        cert.flash = Math.max(cert.flash, 0.85)
        window.__portfolioImpulse?.(0.3)
        head.classList.remove('is-struck')
        void head.offsetWidth
        head.classList.add('is-struck')
      } else if (!whole && p < 0.9) done = false
    }
    apply(0)
    const trig = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      end: 'center 55%',
      onUpdate: (self) => apply(self.progress),
      onRefresh: (self) => apply(self.progress),
    })
    const tw = gsap.fromTo(
      el.querySelectorAll('[data-close-in]'),
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'center 70%', once: true } },
    )
    return () => {
      trig.kill()
      tw.scrollTrigger?.kill()
      tw.kill()
      chars.forEach((c) => {
        c.style.transform = ''
        c.style.opacity = ''
        c.style.filter = ''
        c.style.textShadow = ''
      })
      cert.close = 0
    }
  }, [])

  let ci = 0
  return (
    <section ref={root} className="section cert-close" id="certifications-close" data-section="certifications-close">
      {/* mobile: the relic re-appears in this empty band above the closing statement */}
      <div className="close-slot" data-anchor="cert-close-slot" aria-hidden="true" />
      <div className="section-inner close-inner">
        <span className="cert-kicker" data-close-in>
          <i className="cert-num">V</i> The practice
        </span>
        <h2 className="statement close-statement" aria-label={LINES.map((l) => l.text).join(' ')}>
          {words.map((line, li) => (
            <span className={`close-line ${LINES[li].hl ? 'hl' : ''}`} key={li} aria-hidden="true">
              {line.map((w, wi) => (
                <span className="cl-word" key={wi}>
                  {w.map((ch) => (
                    <span className="cl-ch" key={ci++}>
                      {ch}
                    </span>
                  ))}
                  {wi < line.length - 1 ? <span className="cl-space"> </span> : null}
                </span>
              ))}
            </span>
          ))}
        </h2>
        <p className="close-sub" data-close-in>
          Certified foundations, applied every day in ASP.NET Core, C# and SQL Server — with Claude in the loop.
        </p>
        <div className="close-cta" data-close-in>
          <Magnetic strength={0.25}>
            <a className="btn btn-gold close-btn" href="/Akil-Prabhu-Resume.pdf" download data-cursor="PDF" data-copilot="RÉSUMÉ · PDF">
              Download résumé <span className="arrow">↓</span>
            </a>
          </Magnetic>
          <span className="mono close-note">Doors open below ↓</span>
        </div>
      </div>
    </section>
  )
}
