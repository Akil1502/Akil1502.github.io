import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile, experience, languages } from '../../../data/resume'
import SplitText from '../../../components/SplitText'
import { dissolveElements } from '../../../utils/dust'
import { TriBar, Stamp, TypeCell, typeIn, slam, highlight, prefersReduced } from '../parts'

gsap.registerPlugin(ScrollTrigger)

const current = experience.find((e) => e.current) || experience[0]

// the three sentences of the summary, one per beat
const BEATS = profile.summary
  .split('. ')
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => (s.endsWith('.') ? s : `${s}.`))
const MARKS = ['2 years of experience', 'enterprise web applications', 'production-grade REST APIs', '5 live enterprise portals', 'prompt engineering with Claude and Windsurf IDE']

const FIELDS = [
  { k: 'Name', v: profile.name },
  { k: 'Rank', v: current.role },
  { k: 'Unit', v: current.company },
  { k: 'Posted', v: current.location },
  { k: 'Service', v: `${profile.yearsExperience} years · ${profile.livePortals} live portals` },
  { k: 'Languages', v: languages.map((l) => `${l.name} — ${l.level}`).join('  ·  ') },
  { k: 'Discipline', v: profile.tagline },
]

const CALLOUTS = [
  { cls: 'a', label: 'R1 · Flag red', note: 'outer ring' },
  { cls: 'b', label: 'R2 · Brushed silver', note: 'spun alloy' },
  { cls: 'c', label: 'R3 · Flag red', note: 'inner ring' },
  { cls: 'd', label: 'Core · Field blue', note: 'five-point star' },
]

// Beat 2 — the personnel file. A pinned inspection stage on the left turns the shield a full revolution
// (scrubbed), while the file on the right reads: the full summary, then the dossier card types itself in,
// the RESTRICTED banner crumbles to dust and the APPROVED stamp slams.
export default function FileSection() {
  const root = useRef(null)
  const track = useRef(null)
  const deg = useRef(null)
  const card = useRef(null)

  useLayoutEffect(() => {
    if (prefersReduced()) card.current?.classList.add('is-booted')
  }, [])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = prefersReduced()
    const ctx = gsap.context(() => {
      // inspection readout (mirrors the shield's scrubbed revolution in ShieldRig)
      ScrollTrigger.create({
        trigger: track.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          // mirrors ShieldRig's inspection turn: sin(progress · 2π) · 66°
          const a = Math.round(Math.sin(self.progress * Math.PI * 2) * 66)
          if (deg.current) deg.current.textContent = `${a < 0 ? '−' : '+'}${String(Math.abs(a)).padStart(2, '0')}`
        },
      })
      if (reduced) return
      // summary beats + marks
      gsap.fromTo(
        el.querySelectorAll('.ab-beat'),
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 1.1,
          stagger: 0.14,
          ease: 'power4.out',
          scrollTrigger: { trigger: el.querySelector('.ab-brief'), start: 'top 78%', once: true },
          onComplete: () => el.querySelector('.ab-brief')?.classList.add('is-marked'),
        },
      )
      // stage callouts lock on when the stage arrives
      gsap.fromTo(
        el.querySelectorAll('.ab-callout'),
        { opacity: 0, x: (i) => (i % 2 ? 30 : -30) },
        { opacity: 1, x: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: track.current, start: 'top 55%', once: true } },
      )
      // dossier: assemble, type, dust the RESTRICTED banner, slam APPROVED
      const c = card.current
      if (!c) return
      const rows = Array.from(c.querySelectorAll('.ab-row'))
      const tl = gsap.timeline({
        scrollTrigger: { trigger: c, start: 'top 72%', once: true },
        onComplete: () => c.classList.add('is-booted'),
      })
      tl.fromTo(c, { opacity: 0, y: 70, rotateX: 18, transformPerspective: 900 }, { opacity: 1, y: 0, rotateX: 0, duration: 1, ease: 'expo.out' }, 0)
      rows.forEach((row, i) => {
        const at = 0.35 + i * 0.16
        tl.call(() => row.classList.add('is-typing'), null, at)
        const d = typeIn(tl, row.querySelector('.ab-type-live'), at, 0.016)
        tl.call(
          () => {
            row.classList.remove('is-typing')
            row.classList.add('is-typed')
          },
          null,
          at + d,
        )
      })
      const banner = c.querySelector('.ab-restricted-text')
      tl.call(
        () => {
          if (!banner) return
          dissolveElements([banner], { duration: 1.3, step: 2 }).then(() => {})
          banner.style.visibility = 'hidden'
          c.classList.add('is-cleared')
        },
        null,
        0.35 + rows.length * 0.16 + 0.5,
      )
      slam(tl, c.querySelector('.ab-approved'), 0.35 + rows.length * 0.16 + 1.0, { rotate: -11, impulse: 0.42 })
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="section ab-file" data-section="about-file" id="about-file">
      <div className="ab-file-grid">
        <div ref={track} className="ab-file-track" data-pin-track>
          <div className="ab-file-stage" data-pin>
            <div className="ab-file-slot" data-anchor="about-shield-file">
              <span className="ab-ring" aria-hidden="true" />
              <span className="ab-ring ab-ring--2" aria-hidden="true" />
              <span className="ab-ring-ticks" aria-hidden="true" />
              {CALLOUTS.map((c) => (
                <span key={c.cls} className={`ab-callout ab-callout--${c.cls} mono`} aria-hidden="true">
                  <b>{c.label}</b>
                  <small>{c.note}</small>
                </span>
              ))}
            </div>
            <p className="ab-file-spec mono" aria-hidden="true">
              Inspection · yaw <b ref={deg}>+00</b>°
            </p>
          </div>
        </div>

        <div className="ab-file-content">
          <p className="ab-label mono">
            <span className="ab-label-n hero-title">01</span> Personnel <TriBar />
          </p>
          <SplitText
            as="h2"
            className="statement ab-title"
            aria-label="The engineer behind the build."
            lines={[
              'The engineer',
              <span className="hl hl-blue" key="b">
                behind the build.
              </span>,
            ]}
            start="top 80%"
          />
          <div className="ab-brief">
            {BEATS.map((b, i) => (
              <p className="ab-beat" key={i}>
                <span className="ab-beat-n mono" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{highlight(b, MARKS, `b${i}`)}</span>
              </p>
            ))}
          </div>

          <article ref={card} className="ab-dossier" data-copilot="PERSONNEL FILE" aria-labelledby="ab-dossier-name">
            <header className="ab-dossier-head">
              <span className="ab-restricted mono" aria-hidden="true">
                <span className="ab-restricted-text">Restricted · eyes only</span>
                <span className="ab-cleared-text">Clearance granted</span>
              </span>
              <span className="ab-dossier-file mono">File 02 / About</span>
            </header>
            <h3 id="ab-dossier-name" className="ab-dossier-name hero-title">
              {profile.name}
            </h3>
            <dl className="ab-fields">
              {FIELDS.map((f) => (
                <div className="ab-row" key={f.k}>
                  <dt className="mono">{f.k}</dt>
                  <dd>
                    <TypeCell text={f.v} />
                  </dd>
                </div>
              ))}
            </dl>
            <footer className="ab-dossier-foot" aria-hidden="true">
              <span className="ab-barcode" />
              <span className="mono">
                {profile.location} · {profile.github.replace('https://', '')}
              </span>
            </footer>
            <Stamp className="ab-approved">Approved</Stamp>
          </article>
        </div>
      </div>
    </section>
  )
}
