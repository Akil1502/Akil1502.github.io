import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { experience, education } from '../../../data/resume'
import SplitText from '../../../components/SplitText'
import { TriBar, prefersReduced } from '../parts'

gsap.registerPlugin(ScrollTrigger)

const cur = experience.find((e) => e.current) || experience[0]
const prev = experience.find((e) => !e.current) || experience[1]

// The journey, in order. Every line is résumé text (dates, schools, companies, roles, bullets).
export const STEPS = [
  {
    date: education.start,
    tag: 'Enlisted',
    title: 'B.Com. begins',
    org: `${education.school} · ${education.location}`,
    text: `Started the ${education.degree} degree.`,
  },
  {
    date: education.end,
    tag: 'Graduated',
    title: `Graduated · ${education.score}`,
    org: education.degree,
    text: `Completed the degree (${education.start}–${education.end}) with an ${education.score} score.`,
  },
  {
    date: prev.start,
    tag: 'First posting',
    title: prev.role,
    org: `${prev.company} · ${prev.start} – ${prev.end}`,
    text: prev.bullets[0],
  },
  {
    date: cur.start,
    tag: 'Current post',
    title: cur.role,
    org: `${cur.company} · ${cur.start} – ${cur.end}`,
    text: 'Develops and maintains 5 enterprise portals: REST APIs, business logic and SQL Server procedures for 1,000+ employees across 3 entities.',
    current: true,
  },
]

// Beat 3 — the road so far. A vertical rail; each stop carries a target medal. The SHIELD THROW
// ricochets from medal to medal as each stop crosses the middle of the screen (ShieldRig), every strike
// flashing the medal and stamping the stop.
export default function RoadSection() {
  const root = useRef(null)
  const fill = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ctx = gsap.context(() => {
      // rail fill scrubs with the scroll
      gsap.fromTo(
        fill.current,
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: el.querySelector('.ab-rail'), start: 'top 50%', end: 'bottom 50%', scrub: true } },
      )
      if (prefersReduced()) return
      // ghost date numerals drift against the scroll (depth), filling the half of the screen opposite each stop
      el.querySelectorAll('.ab-ghost').forEach((g) => {
        gsap.fromTo(g, { yPercent: 38 }, { yPercent: -38, ease: 'none', scrollTrigger: { trigger: g.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } })
      })
      // desktop stops are tall rows (content centred), phone stops are compact
      const wide = window.innerWidth > 960
      el.querySelectorAll('.ab-step').forEach((step, i) => {
        gsap.fromTo(
          step.querySelectorAll('.ab-step-body > :not(.ab-step-hit)'),
          { opacity: 0, x: i % 2 ? 50 : -50 },
          { opacity: 1, x: 0, duration: 1, stagger: 0.07, ease: 'expo.out', scrollTrigger: { trigger: step, start: wide ? 'top 64%' : 'top 82%', once: true } },
        )
        gsap.fromTo(
          step.querySelector('.ab-target'),
          { opacity: 0, scale: 1.8, rotate: -90 },
          { opacity: 1, scale: 1, rotate: 0, duration: 0.9, ease: 'back.out(2)', scrollTrigger: { trigger: step, start: wide ? 'top 70%' : 'top 86%', once: true } },
        )
      })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="section ab-road" data-section="about-road">
      <header className="ab-road-head">
        <p className="ab-label mono">
          <span className="ab-label-n hero-title">02</span> The road <TriBar />
        </p>
        <SplitText
          as="h2"
          className="statement ab-title"
          aria-label="Four stops. One direction."
          lines={[
            'Four stops.',
            <span className="hl" key="b">
              One direction.
            </span>,
          ]}
          start="top 80%"
        />
      </header>

      <ol className="ab-rail">
        <span className="ab-rail-line" aria-hidden="true">
          <span ref={fill} className="ab-rail-fill" />
        </span>
        {STEPS.map((s, i) => (
          <li key={s.date + s.tag} className={`ab-step ab-step--${i % 2 ? 'right' : 'left'}${s.current ? ' is-current' : ''}`} data-hit={`road-${i}`}>
            <div className="ab-target" data-anchor={`about-node-${i}`} aria-hidden="true">
              <span className="ab-target-ring" />
              <span className="ab-target-ring ab-target-ring--in" />
              <span className="ab-target-cross" />
              <span className="ab-chevrons">
                {Array.from({ length: i + 1 }).map((_, k) => (
                  <i key={k} />
                ))}
              </span>
              <span className="ab-target-flash" />
            </div>
            <span className="ab-ghost hero-title" aria-hidden="true">
              {s.date.includes(' ') ? <small>{s.date.split(' ')[0]}</small> : null}
              <b>{s.date.split(' ').pop()}</b>
            </span>
            <div className="ab-step-body" data-copilot={s.current ? 'CURRENT POST' : undefined}>
              <span className="ab-step-tag mono">
                {String(i + 1).padStart(2, '0')} · {s.tag}
              </span>
              <span className="ab-step-date hero-title">{s.date}</span>
              <h3 className="ab-step-title">{s.title}</h3>
              <p className="ab-step-org mono">{s.org}</p>
              <p className="ab-step-text">{s.text}</p>
              <span className="ab-step-hit mono" aria-hidden="true">
                Impact confirmed
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
