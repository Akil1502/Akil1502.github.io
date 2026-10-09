import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile, projects } from '../../../data/resume'
import { dissolveElements } from '../../../utils/dust'
import { gamma, requestSmash, REDUCED } from '../store'
import { lampStrike } from './fx'

gsap.registerPlugin(ScrollTrigger)

// PROJECTS · BEAT 1 — THE GAMMA LAB (pinned, ~3 screens).
//   A  "Heavy / lifting."  The crater smoulders, debris hangs in the field. On arrival the statement drops out of
//      the sky and the first SMASH hits the crater (shockwave, dust, cracks spread, heavy camera impact).
//   ↓  scrolling charges the field: the gauge climbs, the debris rises, a gamma column grows out of the crater.
//   B  containment breaks: the "CONTAINMENT · STABLE" stamp crumbles to dust (the page's one DUST beat), the second
//      SMASH lands and "Counts are / the content." slams in with the honesty note and the real numbers.
const READINGS = [
  { v: `${profile.livePortals}`, l: 'live portals' },
  { v: '1,000+', l: 'employees served' },
  { v: `${profile.entities}`, l: 'entities' },
  { v: '~450', l: 'agents daily' },
  { v: '150–200', l: 'daily recipients' },
]

export default function HeroBeat({ live }) {
  const root = useRef(null)
  const beatA = useRef(null)
  const beatB = useRef(null)
  const quote = useRef(null)
  const gauge = useRef(null)
  const stamp = useRef(null)
  const cue = useRef(null)
  const st = useRef({ breached: false, introDone: false }).current

  // before first paint: statement lines up in the sky, B hidden, supporting pieces down
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    if (REDUCED()) return
    gsap.set(el.querySelectorAll('.pj-a-line'), { yPercent: -160, scaleY: 1.25, opacity: 0, filter: 'blur(12px)' })
    gsap.set(el.querySelectorAll('[data-a-rise]'), { opacity: 0, y: 26 })
    gsap.set(el.querySelectorAll('.pj-b-line'), { yPercent: -140, opacity: 0, filter: 'blur(10px)' })
    gsap.set(el.querySelectorAll('[data-b-rise]'), { opacity: 0, y: 30 })
  }, [])

  // ---------------------------------------------------------------- arrival: drop + first SMASH
  useEffect(() => {
    const el = root.current
    if (!live || !el) return
    if (REDUCED()) {
      gamma.live = true
      gamma.crack = Math.max(gamma.crack, 0.5)
      return
    }
    const lines = el.querySelectorAll('.pj-a-line')
    const tl = gsap.timeline({ delay: 0.15 })
    // the words fall (accelerating) and hit the ground together
    tl.to(lines, { yPercent: 0, opacity: 1, filter: 'blur(0px)', scaleY: 1, duration: 0.46, stagger: 0.09, ease: 'power4.in' })
    tl.add(() => {
      gamma.live = true
      // the blow lands in the crater, the camera takes the hit
      requestSmash({ power: 0.6, big: true, crack: 0.5 })
      st.introDone = true
    }, 0.55)
    tl.fromTo(lines, { scaleY: 0.86, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.32)' }, 0.55)
    tl.add(lampStrike(el.querySelector('.pj-a-line.hl')), 0.62)
    tl.to(el.querySelectorAll('[data-a-rise]'), { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power4.out' }, 0.7)
    return () => tl.kill()
  }, [live, st])

  // ---------------------------------------------------------------- scroll: charge → breach → B
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const setCharge = (p) => {
      const c = Math.min(1, p / 0.5)
      el.style.setProperty('--charge', c.toFixed(3))
      const pct = el.querySelector('[data-charge]')
      if (pct) pct.textContent = `${Math.round(c * 100)}`
    }
    const breach = () => {
      if (st.breached) return
      st.breached = true
      gamma.breach = performance.now() / 1000
      const reduced = REDUCED()
      // DUST: the containment stamp crumbles, then reads BREACHED
      const s = stamp.current
      if (s && !reduced) {
        const word = s.querySelector('b')
        dissolveElements([word], { duration: 1.2 })
        gsap.set(word, { opacity: 0 })
        gsap.delayedCall(0.55, () => {
          word.textContent = 'breached'
          s.classList.add('is-breached')
          lampStrike(word)
        })
      } else if (s) {
        s.querySelector('b').textContent = 'breached'
        s.classList.add('is-breached')
      }
      if (reduced) {
        gsap.set(el.querySelectorAll('.pj-b-line, [data-b-rise]'), { clearProps: 'all' })
        return
      }
      requestSmash({ power: 0.55, big: true, crack: 0.62 })
      const tl = gsap.timeline()
      tl.to(el.querySelectorAll('.pj-b-line'), { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.42, stagger: 0.08, ease: 'power4.in' })
      tl.fromTo(el.querySelectorAll('.pj-b-line'), { scaleY: 0.88, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.34)' }, 0.42)
      tl.add(lampStrike(el.querySelector('.pj-b-line.hl')), 0.45)
      tl.to(el.querySelectorAll('[data-b-rise]'), { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'power4.out' }, 0.5)
    }
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: el,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        onUpdate: (self) => {
          setCharge(self.progress)
          if (self.progress > 0.47) breach()
        },
      },
    })
    // A + quote leave as the field charges (scrubbed, so scrolling back brings them home)
    tl.to(beatA.current, { opacity: 0, y: -70, filter: 'blur(8px)', duration: 0.12, ease: 'power2.in' }, 0.3)
    tl.to(quote.current, { opacity: 0, y: -40, duration: 0.1 }, 0.3)
    tl.to(cue.current, { opacity: 0, duration: 0.05 }, 0.02)
    tl.fromTo(gauge.current, { '--shake': 0 }, { '--shake': 1, duration: 0.18, ease: 'none' }, 0.28)
    tl.to(gauge.current, { '--shake': 0, duration: 0.04 }, 0.48)
    // B's frame is scrubbed in; its lines slam once on the breach
    // (B is not faded out at the end: it rides up and away with the stage when the pin releases, so the frame is
    // never left empty between the readings and the lineup)
    tl.fromTo(beatB.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.04 }, 0.46)
    tl.fromTo(beatB.current, { y: 24 }, { y: -36, duration: 0.54, ease: 'none' }, 0.46)
    tl.to({}, { duration: 0.0001 }, 1)
    return () => {
      tl.scrollTrigger?.kill()
      tl.kill()
    }
  }, [st])

  const n = projects.length
  return (
    <section ref={root} className="section pj-hero" data-section="projects-hero" aria-label="Projects: the gamma lab">
      <div className="pj-hero-stage">
        <div ref={beatA} className="pj-beat pj-beat-a">
          <p className="pj-kicker" data-a-rise>
            <i className="pj-kicker-dot" aria-hidden="true" />
            Gamma lab <span>· 05 / Projects</span>
          </p>
          <h1 className="statement pj-statement pj-statement-a">
            <span className="pj-a-line">Heavy</span>
            <span className="pj-a-line hl">lifting.</span>
          </h1>
          <p className="pj-sub" data-a-rise>
            {n} enterprise systems, built and kept running in production. {profile.firstName} {profile.lastName} · {profile.title}.
          </p>
        </div>

        <blockquote ref={quote} className="quote-card pj-quote" data-a-rise>
          <p>“Nobody sees the scheduler. Everybody gets the notification.”</p>
          <cite>
            <span>Gamma lab · field note</span>
            <b>Hangfire · org-wide</b>
          </cite>
        </blockquote>

        <div ref={gauge} className="pj-gauge" data-a-rise data-copilot="GAMMA CHARGE">
          <span className="pj-gauge-head">
            <span>Gamma charge</span>
            <b>
              <span data-charge>0</span>%
            </b>
          </span>
          <span className="pj-gauge-bar" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} style={{ '--i': i }} />
            ))}
          </span>
          <span className="pj-gauge-row" aria-hidden="true">
            <span>Seismic</span>
            <span className="pj-seis">
              {Array.from({ length: 14 }, (_, i) => (
                <i key={i} style={{ '--i': i }} />
              ))}
            </span>
          </span>
          <span ref={stamp} className="pj-contain">
            Containment · <b>stable</b>
          </span>
        </div>

        <div ref={beatB} className="pj-beat pj-beat-b">
          <p className="pj-kicker pj-kicker-b" data-b-rise>
            <i className="pj-kicker-dot" aria-hidden="true" />
            Containment breached <span>· the readings</span>
          </p>
          <h2 className="statement pj-statement pj-statement-b">
            <span className="pj-b-line">Counts are</span>
            <span className="pj-b-line hl">the content.</span>
          </h2>
          <p className="pj-lede" data-b-rise>
            Internal enterprise software has no public demo. So every system below is drawn literally — tick by tick, agent by agent, envelope by envelope.
          </p>
          <ul className="pj-readings" data-b-rise aria-label="Headline numbers">
            {READINGS.map((r) => (
              <li key={r.l}>
                <strong>{r.v}</strong>
                <span>{r.l}</span>
              </li>
            ))}
          </ul>
          <span className="chip pj-honest" data-b-rise>
            Internal · Enterprise
          </span>
        </div>

        <div ref={cue} className="pj-cue" aria-hidden="true">
          <span>Scroll to charge</span>
          <i />
        </div>
      </div>
    </section>
  )
}
