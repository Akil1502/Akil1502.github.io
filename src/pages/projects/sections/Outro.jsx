import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { projects } from '../../../data/resume'
import Magnetic from '../../../components/Magnetic'
import { gamma, requestSmash, REDUCED } from '../store'
import { lampStrike, pad } from './fx'

gsap.registerPlugin(ScrollTrigger)

// PROJECTS · BEAT 3 — FINAL READING. The camera cranes up over the whole crater; the statement drops in with the
// last big SMASH (every crack on the ground lights up), then the roll call of all five systems lands row by row.
// Hovering a row makes the crater flare; "Smash it again" replays the ground-pound on demand.
export default function Outro() {
  const root = useRef(null)
  const btn = useRef(null)

  useLayoutEffect(() => {
    const el = root.current
    if (!el || REDUCED()) return
    gsap.set(el.querySelectorAll('.pj-o-line'), { yPercent: -150, opacity: 0, filter: 'blur(10px)' })
    gsap.set(el.querySelectorAll('[data-o-rise]'), { opacity: 0, y: 26 })
    gsap.set(el.querySelectorAll('.pj-roll li'), { opacity: 0, y: -40 })
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el || REDUCED()) return
    let tl = null
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 62%',
      once: true,
      onEnter: () => {
        tl = gsap.timeline()
        tl.to(el.querySelectorAll('.pj-o-line'), { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.45, stagger: 0.08, ease: 'power4.in' })
        tl.add(() => requestSmash({ power: 0.6, big: true, crack: 1 }), 0.5)
        tl.fromTo(el.querySelectorAll('.pj-o-line'), { scaleY: 0.86, transformOrigin: '50% 100%' }, { scaleY: 1, duration: 0.7, ease: 'elastic.out(1, 0.32)' }, 0.5)
        tl.add(lampStrike(el.querySelector('.pj-o-line.hl')), 0.56)
        tl.to(el.querySelectorAll('[data-o-rise]'), { opacity: 1, y: 0, duration: 0.9, stagger: 0.07, ease: 'power4.out' }, 0.6)
        tl.to(el.querySelectorAll('.pj-roll li'), { opacity: 1, y: 0, duration: 0.55, stagger: 0.09, ease: 'bounce.out' }, 0.75)
      },
    })
    return () => {
      st.kill()
      tl?.kill()
    }
  }, [])

  const again = () => {
    requestSmash({ power: 0.6, big: true, crack: 1 })
    const b = btn.current
    if (b && !REDUCED()) gsap.fromTo(b, { scale: 0.9 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.3)' })
  }

  return (
    <section ref={root} className="section pj-outro" data-section="projects-outro" aria-labelledby="pj-outro-title">
      <div className="pj-outro-inner">
        <p className="pj-kicker" data-o-rise>
          <i className="pj-kicker-dot" aria-hidden="true" />
          Final reading <span>· all systems</span>
        </p>
        <h2 id="pj-outro-title" className="statement pj-statement pj-statement-o">
          <span className="pj-o-line">Five systems.</span>
          <span className="pj-o-line hl">All in daily use.</span>
        </h2>
        <ol className="pj-roll" aria-label="All projects">
          {projects.map((p, i) => (
            <li
              key={p.id}
              data-interactive=""
              onPointerEnter={() => (gamma.rowHover = i)}
              onPointerLeave={() => {
                if (gamma.rowHover === i) gamma.rowHover = -1
              }}
            >
              <span className="pj-roll-i">{pad(i + 1)}</span>
              <span className="pj-roll-name">{p.name}</span>
              <span className="pj-roll-stack">{p.stack.join(' · ')}</span>
              <span className="pj-roll-metric">
                <b>{p.metric.value}</b> {p.metric.label}
              </span>
            </li>
          ))}
        </ol>
        <div className="pj-outro-cta" data-o-rise>
          <Magnetic strength={0.25}>
            <button ref={btn} type="button" className="btn btn-gold pj-again" onClick={again} data-copilot="SMASH AGAIN">
              Smash it again <span className="arrow">↯</span>
            </button>
          </Magnetic>
          <span className="chip pj-chip-honest">Internal · Enterprise</span>
          <p className="pj-outro-note">All five run inside the company network, so there are no public links. The machines above are the honest stand-in: every count is the real number.</p>
        </div>
      </div>
    </section>
  )
}
