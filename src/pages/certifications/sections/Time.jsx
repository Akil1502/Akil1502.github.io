import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { education, languages } from '../../../data/resume'
import { cert } from '../store'
import { makeShards } from './shards'

gsap.registerPlugin(ScrollTrigger)

const START = parseInt(education.start, 10)
const END = parseInt(education.end, 10)
const SCORE = parseFloat(education.score) / 100

// the education record (rendered once for real, and once per shard as an aria-hidden clone)
function EduContent() {
  return (
    <>
      <div className="edu-top">
        <span className="mono edu-tag">
          Education · {education.start} — {education.end}
        </span>
        <span className="mono edu-loc">{education.location}</span>
      </div>
      <div className="edu-main">
        <div className="edu-text">
          <h3 className="edu-degree">{education.degree}</h3>
          <p className="edu-school">{education.school}</p>
          <ul className="edu-facts mono">
            <li>{education.location}</li>
            <li>
              {education.start} — {education.end}
            </li>
            <li>Score {education.score}</li>
          </ul>
        </div>
        <div className="edu-gauge" style={{ '--score': SCORE }}>
          <span className="edu-gauge-ring" />
          <span className="edu-gauge-ticks" />
          <span className="edu-gauge-val">{education.score}</span>
          <span className="edu-gauge-lbl mono">Score</span>
        </div>
      </div>
      <div className="edu-langs">
        <span className="mono edu-langs-lbl">Languages</span>
        {languages.map((l) => (
          <span className="cert-chip is-green" key={l.name}>
            {l.name} · {l.level}
          </span>
        ))}
      </div>
    </>
  )
}

/*
 * BEAT IV — THE FOUNDATION (TIME REVERSAL). A pinned stage (sticky, ~2.6 screens of scroll). The education record
 * starts shattered — real clip-path shards of the panel, flung out and tumbled in 3D — and as the visitor scrolls,
 * time runs backwards: the year dial rewinds from 2024 to 2021, the shards fly back home (slow, then snapping in,
 * like an explosion played in reverse) and the fault lines glow green and heal. The 3D relic's gem burns green while
 * time is moving and its emerald seal reassembles in step (cert.time).
 */
export default function Time() {
  const root = useRef(null)
  const stack = useRef(null)
  const yearRef = useRef(null)
  const handRef = useRef(null)
  const cracks = useRef(null)
  const meter = useRef(null)

  const spokes = typeof window !== 'undefined' && window.innerWidth < 720 ? 7 : 10
  const { shards } = useMemo(() => makeShards({ cx: 38, cy: 44, spokes, seed: 4 }), [spokes])

  useEffect(() => {
    const el = root.current
    const st = stack.current
    if (!el || !st) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nodes = Array.from(st.querySelectorAll('.edu-shard'))
    if (reduced) {
      st.classList.add('is-whole')
      cert.time = 1
      if (yearRef.current) yearRef.current.textContent = String(START)
      return
    }
    const spread = Math.max(0.45, Math.min(1, window.innerWidth / 1280))
    const maxDist = Math.max(...shards.map((s) => s.dist), 1)
    let seed = 91
    const r = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const fly = shards.map((s) => {
      const vx = s.centroid[0] - 38
      const vy = s.centroid[1] - 44
      const len = Math.hypot(vx, vy) || 1
      const mag = (70 + (s.dist / maxDist) * 190 + r() * 90) * spread
      return {
        dx: (vx / len) * mag,
        dy: (vy / len) * mag * 0.5 + (r() * 0.6 + 0.2) * 50 * spread,
        dz: 40 + r() * 200,
        rx: (r() - 0.5) * 110,
        ry: (r() - 0.5) * 110,
        rz: (r() - 0.5) * 70,
        delay: 0.32 * (1 - s.dist / maxDist),
      }
    })
    nodes.forEach((n, i) => {
      n.style.transformOrigin = `${shards[i].centroid[0]}% ${shards[i].centroid[1]}%`
    })

    let whole = false
    let last = -1
    const apply = (p) => {
      // hold shattered for a moment, rewind, hold whole at the end
      const q = Math.max(0, Math.min(1, (p - 0.06) / 0.8))
      if (Math.abs(q - last) < 0.0005) return
      last = q
      cert.time = q
      for (let i = 0; i < nodes.length; i++) {
        const f = fly[i]
        const k = Math.max(0, Math.min(1, (q - f.delay) / (1 - f.delay)))
        const rem = 1 - Math.pow(k, 1.7)
        nodes[i].style.transform = rem < 0.0005 ? 'none' : `translate3d(${(f.dx * rem).toFixed(1)}px, ${(f.dy * rem).toFixed(1)}px, ${(f.dz * rem).toFixed(1)}px) rotateX(${(f.rx * rem).toFixed(1)}deg) rotateY(${(f.ry * rem).toFixed(1)}deg) rotateZ(${(f.rz * rem).toFixed(1)}deg)`
        nodes[i].style.opacity = (1 - rem * 0.3).toFixed(3)
      }
      if (cracks.current) {
        const c = Math.max(0, Math.min(1, (q - 0.55) / 0.3)) * (1 - Math.max(0, Math.min(1, (q - 0.97) / 0.03)))
        cracks.current.style.opacity = c.toFixed(3)
      }
      if (yearRef.current) yearRef.current.textContent = String(Math.round(END - (END - START) * q))
      if (handRef.current) handRef.current.style.transform = `rotate(${(-q * 1080).toFixed(1)}deg)`
      if (meter.current) meter.current.style.transform = `scaleX(${q.toFixed(3)})`
      el.style.setProperty('--rewind', q.toFixed(3))
      const nowWhole = q >= 0.999
      if (nowWhole !== whole) {
        whole = nowWhole
        st.classList.toggle('is-whole', whole)
        if (whole) {
          cert.flash = 1
          window.__portfolioImpulse?.(0.45)
          st.classList.remove('is-snap')
          void st.offsetWidth
          st.classList.add('is-snap')
        }
      }
    }
    apply(0)
    const trig = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => apply(self.progress),
      onRefresh: (self) => apply(self.progress),
    })
    // copy reveal
    const tw = gsap.fromTo(
      el.querySelectorAll('[data-time-in]'),
      { y: 34, opacity: 0, filter: 'blur(8px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.1, ease: 'expo.out', clearProps: 'filter', scrollTrigger: { trigger: el, start: 'top 70%', once: true } },
    )
    return () => {
      trig.kill()
      tw.scrollTrigger?.kill()
      tw.kill()
      nodes.forEach((n) => {
        n.style.transform = ''
        n.style.opacity = ''
      })
      st.classList.remove('is-whole', 'is-snap')
      cert.time = 0
    }
  }, [shards])

  const crackPaths = useMemo(() => shards.map((s) => 'M' + s.points.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L') + ' Z').join(' '), [shards])

  return (
    <section ref={root} className="cert-time" id="certifications-time" data-section="certifications-time">
      <div className="time-stage">
        <div className="time-grid">
          <div className="time-copy">
            <span className="cert-kicker" data-time-in>
              <i className="cert-num">IV</i> The foundation
            </span>
            <h2 className="statement cert-statement-md" aria-label="Turn back the clock." data-time-in>
              <span className="st-block" aria-hidden="true">
                Turn back
              </span>
              <span className="st-block hl hl-green" aria-hidden="true">
                the clock.
              </span>
            </h2>
            <p className="time-lede" data-time-in>
              Before the spells, the groundwork. Keep scrolling to rewind time — the record pieces itself back together.
            </p>

            <div className="edu-stack" ref={stack} data-time-in>
              <article className="edu-panel is-real" data-interactive="" data-copilot="RECORD · B.COM" data-cursor="EDU">
                <EduContent />
              </article>
              <div className="edu-shards" aria-hidden="true">
                {shards.map((s, i) => (
                  <div className="edu-shard" key={i} style={{ clipPath: s.poly }}>
                    <div className="edu-panel">
                      <EduContent />
                    </div>
                  </div>
                ))}
              </div>
              <svg ref={cracks} className="edu-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path d={crackPaths} />
              </svg>
              <span className="edu-snap" aria-hidden="true" />
            </div>
          </div>

          <div className="time-dial" aria-hidden="true" data-time-in>
            <svg className="time-dial-svg" viewBox="0 0 200 200">
              <circle className="td-ring" cx="100" cy="100" r="94" />
              <circle className="td-ring td-ring-2" cx="100" cy="100" r="80" />
              {Array.from({ length: 60 }, (_, i) => {
                const a = (i / 60) * Math.PI * 2
                const r0 = i % 5 === 0 ? 84 : 88
                return <line key={i} className={i % 5 === 0 ? 'td-tick major' : 'td-tick'} x1={100 + Math.cos(a) * r0} y1={100 + Math.sin(a) * r0} x2={100 + Math.cos(a) * 92} y2={100 + Math.sin(a) * 92} />
              })}
              <g ref={handRef} className="td-hand">
                <line x1="100" y1="100" x2="100" y2="30" />
                <circle cx="100" cy="30" r="3.5" />
              </g>
              <circle className="td-core" cx="100" cy="100" r="5" />
            </svg>
            <div className="time-year">
              <span className="mono">Rewinding to</span>
              <b ref={yearRef}>{END}</b>
              <span className="time-meter">
                <i ref={meter} />
              </span>
              <span className="mono time-range">
                {education.end} → {education.start}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
