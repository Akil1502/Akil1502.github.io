import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile, skills } from '../../data/resume'
import { PAGES } from '../../data/heroes'
import NextPage from '../../components/NextPage'
import SplitText from '../../components/SplitText'
import Magnetic from '../../components/Magnetic'
import Emblem from '../../components/Emblem'
import HeroLink from '../../transition/HeroLink'
import { scroll } from '../../three/scrollStore'
import { home, updateBeats, resetHome, prefersReducedMotion, BEATS } from './homeStore'
import './home.css'

// ============ HOME · IRON MAN ============
// Four pinned beats over one 3D stage (see HomeScene), then the hero-select teaser and the next mission.
// Every number below comes from resume.js (profile.*); nothing is invented.
const STATS = [
  { value: profile.yearsExperience, pad: 2, suffix: '', unit: 'YRS', label: 'Years of experience', note: 'Enterprise web apps in production', plate: 'PAULDRON' },
  { value: profile.livePortals, pad: 2, suffix: '', unit: 'LIVE', label: 'Live enterprise portals', note: 'CRM · ESS · MIS · Hangfire · Knitting', plate: 'PECTORAL' },
  { value: profile.employeesServed, pad: 0, suffix: '+', unit: 'USERS', label: 'Employees served', note: 'Attendance, payroll & invoicing', plate: 'SIDE RIB' },
  { value: profile.entities, pad: 2, suffix: '', unit: 'ORGS', label: 'Company entities', note: 'Bannari Mills · Shiva Mills · Automobiles', plate: 'ABDOMINAL' },
]
const SYSTEMS = [...skills.core.map((s) => s.name), ...skills.ai.map((s) => s.name)]
const OTHERS = PAGES.filter((p) => p.id !== 'home')
const pad = (n) => String(n).padStart(2, '0')
const fmt = (v, p, suffix) => {
  let s = Math.round(v).toLocaleString('en-US')
  if (p) s = s.padStart(p, '0')
  return s + suffix
}
const PIN_IDS = BEATS.slice(0, 4)
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

export default function HomePage({ ready }) {
  const root = useRef(null)
  const flash = useRef(null)
  const pct = useRef(null)
  const bar = useRef(null)
  const chargeState = useRef(null)
  const integrity = useRef(null)

  // ---- beat 1 entrance: title slam + lamp-strike, after the studio intro ----
  useLayoutEffect(() => {
    const el = root.current
    const items = el.querySelectorAll('[data-b1]')
    const lines = el.querySelectorAll('.ht-in')
    gsap.set(items, { opacity: 0, y: 26 })
    gsap.set(lines, { yPercent: 110, scale: 1.25, opacity: 0, filter: 'blur(16px)', transformOrigin: '0% 100%' })
  }, [])
  useEffect(() => {
    if (!ready) return
    const el = root.current
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tl = gsap.timeline({ delay: 0.25 })
    const lines = el.querySelectorAll('.ht-in')
    tl.to(el.querySelectorAll('.hb1-copy [data-b1]'), { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power3.out' }, 0)
    tl.to(lines, { yPercent: 0, scale: 1, opacity: 1, filter: 'blur(0px)', duration: reduced ? 0.01 : 1.2, stagger: 0.13, ease: 'expo.out' }, 0.15)
    // LAMP STRIKE on the accent line
    tl.fromTo(el.querySelector('.ht-in.hl'), { opacity: 0 }, { keyframes: { opacity: [0, 0.7, 0.15, 1, 0.4, 1] }, duration: 0.7, ease: 'none' }, 0.5)
    tl.to(el.querySelectorAll('.hb1-side [data-b1], .home-cue[data-b1]'), { opacity: 1, y: 0, duration: 1.1, stagger: 0.12, ease: 'power3.out' }, 1.2)
    tl.add(() => gsap.set(lines, { clearProps: 'filter' }))
    return () => tl.kill()
  }, [ready])

  // ---- one loop on GSAP's ticker (it runs right after Lenis has moved the page, so nothing lags a frame):
  //      pinned-beat hand-offs, counters, charge meter, systems online, impact flash ----
  useEffect(() => {
    const el = root.current
    const reduced = prefersReducedMotion()
    const sys = Array.from(el.querySelectorAll('.hb3-sys li'))
    const nums = Array.from(el.querySelectorAll('[data-count]'))
    const pins = Array.from(el.querySelectorAll('.home-pin'))
    // Desktop: each pinned beat is held in place while the next one cross-fades in on top of it (the stage never
    // scrolls under the HUD). Touch scrolling runs on the compositor, so there the beats simply scroll + fade.
    const hold = !reduced && !window.matchMedia('(pointer: coarse)').matches
    const pinState = pins.map(() => ({ o: -1, ty: NaN, pe: null }))
    // a faded beat must not attract the global co-pilot reticle: park its targets under another attribute, then
    // nudge the co-pilot (it re-collects [data-copilot] on DOM child-list mutations)
    const nudge = document.createComment('')
    const muteCopilot = (pin, mute) => {
      const from = mute ? 'data-copilot' : 'data-copilot-muted'
      const to = mute ? 'data-copilot-muted' : 'data-copilot'
      pin.querySelectorAll(`[${from}]`).forEach((n) => {
        n.setAttribute(to, n.getAttribute(from))
        n.removeAttribute(from)
      })
      pin.appendChild(nudge)
      nudge.remove()
    }
    const onRefreshInit = () =>
      pins.forEach((p, i) => {
        p.style.transform = ''
        pinState[i].ty = NaN
      })
    ScrollTrigger.addEventListener('refreshInit', onRefreshInit)

    // numbers are real text in the markup; when motion is allowed they reset and count up on the diagnostic beat
    let counted = reduced
    if (!reduced) nums.forEach((n) => (n.textContent = fmt(0, parseInt(n.dataset.pad || '0', 10), '')))
    const tweens = []
    let lastPct = -1
    let lastInt = -1
    let lastFlash = -1
    const loop = () => {
      updateBeats()
      // ---- pinned beat hand-off ----
      const vh = scroll.vh || window.innerHeight
      const y = scroll.y || 0
      for (let i = 0; i < pins.length; i++) {
        const sec = scroll.sections[PIN_IDS[i]]
        if (!sec) continue
        const ps = pinState[i]
        const pinStart = sec.top
        const pinEnd = sec.top + sec.height - vh
        const last = i === pins.length - 1
        const enter = i === 0 ? 1 : clamp01((y - (pinStart - vh)) / vh)
        const exit = clamp01((y - pinEnd) / vh)
        const o = sstep(0.5, 0.92, enter) * (1 - sstep(0.05, last ? 0.6 : 0.36, exit))
        let ty = 0
        if (hold) {
          const off = y < pinStart ? pinStart - y : y > pinEnd ? pinEnd - y : 0
          if (Math.abs(off) < vh && !(last && off < 0)) ty = -off
          ty += (1 - sstep(0.45, 1, enter)) * 48 - (last ? 0 : sstep(0, 0.4, exit) * 64)
        }
        if (Math.abs(o - ps.o) > 0.002) {
          ps.o = o
          pins[i].style.opacity = o.toFixed(3)
          const pe = o < 0.25 ? 'none' : ''
          if (pe !== ps.pe) {
            pins[i].style.pointerEvents = ps.pe = pe
            muteCopilot(pins[i], pe === 'none')
          }
        }
        if (!(Math.abs(ty - ps.ty) < 0.5)) {
          ps.ty = ty
          pins[i].style.transform = ty ? `translate3d(0, ${ty.toFixed(1)}px, 0)` : ''
        }
      }
      // impact flash overlay
      home.flash *= 0.9
      const fl = home.flash < 0.01 ? 0 : Math.round(home.flash * 500) / 500
      if (fl !== lastFlash && flash.current) {
        flash.current.style.opacity = String(fl)
        lastFlash = fl
      }
      // suit integrity readout (beat 1)
      const iv = Math.round(home.reveal * 100)
      if (iv !== lastInt && integrity.current) {
        integrity.current.textContent = String(iv).padStart(3, '0')
        lastInt = iv
      }
      // stats count up as the diagnostic beat arrives
      if (!counted && home.b > 0.92) {
        counted = true
        nums.forEach((n, i) => {
          const target = parseFloat(n.dataset.count)
          const p = parseInt(n.dataset.pad || '0', 10)
          const suf = n.dataset.suffix || ''
          const o = { v: 0 }
          tweens.push(
            gsap.to(o, {
              v: target,
              duration: 1.6,
              delay: i * 0.12,
              ease: 'power2.out',
              onUpdate: () => (n.textContent = fmt(o.v, p, '')),
              onComplete: () => (n.textContent = fmt(target, p, suf)),
            }),
          )
        })
      }
      // repulsor charge meter (beat 3)
      const c = home.charge
      const pc = Math.round(c * 100)
      if (pc !== lastPct) {
        lastPct = pc
        if (pct.current) pct.current.textContent = String(pc).padStart(3, '0')
        if (bar.current) bar.current.style.transform = `scaleX(${c.toFixed(3)})`
        if (chargeState.current) chargeState.current.textContent = pc >= 99 ? 'REPULSOR — DISCHARGE' : home.b > 2.6 ? 'VENTING' : pc > 0 ? 'CHARGING' : 'STANDBY'
        const n = sys.length
        sys.forEach((li, i) => li.classList.toggle('is-on', c >= (i + 1) / (n + 1)))
      }
    }
    gsap.ticker.add(loop)
    return () => {
      gsap.ticker.remove(loop)
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit)
      tweens.forEach((tw) => tw.kill())
      resetHome()
    }
  }, [])

  // ---- hero cards: 3D tilt + the armour turns to look at the hovered card ----
  const onCardMove = (e) => {
    const c = e.currentTarget
    const r = c.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    c.style.setProperty('--rx', `${(0.5 - py) * 10}deg`)
    c.style.setProperty('--ry', `${(px - 0.5) * 12}deg`)
    c.style.setProperty('--mx', `${px * 100}%`)
    c.style.setProperty('--my', `${py * 100}%`)
  }
  const onCardEnter = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    home.look.x = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1
    home.look.y = -(((r.top + r.height / 2) / window.innerHeight) * 2 - 1)
    home.look.active = true
  }
  const onCardLeave = (e) => {
    home.look.active = false
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }

  return (
    <div ref={root} className="page page-home">
      <div ref={flash} className="home-flash" aria-hidden="true" />

      {/* ============ BEAT 1 · SUIT-UP ============ */}
      <section className="section home-beat home-suitup" data-section="home-suitup">
        <div className="home-pin">
          <div className="home-stage">
            <div className="hb1-copy">
              <p className="home-kicker" data-b1>
                <i className="home-dot" /> Protocol — MK 85 · Nanotech suit-up
              </p>
              <h1 className="statement home-title">
                <span className="ht-line">
                  <span className="ht-in">Build</span>
                </span>
                <span className="ht-line">
                  <span className="ht-in hl">with Akil.</span>
                </span>
              </h1>
              <p className="home-sub" data-b1>
                Enterprise web apps &amp; REST APIs.
                <br />
                Engineered plate by plate.
              </p>
              <p className="home-ident" data-b1 data-copilot="PILOT ID">
                <strong>{profile.name}</strong>
                <span className="home-sep" />
                <span>{profile.title}</span>
                <span className="home-sep" />
                <span>{profile.location}</span>
              </p>
              <p className="home-tagline" data-b1>
                {profile.tagline}
              </p>
            </div>

            <div className="hb1-side">
              <figure className="quote-card home-quote" data-copilot="SUIT LOG" data-b1>
                <blockquote>“Production-grade REST APIs, business logic and database-driven modules — shipped across 5 live enterprise portals.”</blockquote>
                <cite>
                  <span>{profile.name}</span>
                  <b>Suit log · 001</b>
                </cite>
              </figure>
              <div className="home-readout" data-b1 aria-hidden="true">
                <span className="hr-bracket" />
                <span className="hr-k">Suit integrity</span>
                <span className="hr-v">
                  <b ref={integrity}>000</b>%
                </span>
                <span className="hr-k">Nanites · deployed</span>
              </div>
            </div>

            <div className="home-cue" data-b1>
              <span>Scroll — run diagnostic</span>
              <span className="home-cue-line" />
            </div>
          </div>
        </div>
      </section>

      {/* ============ BEAT 2 · DIAGNOSTIC (exploded view) ============ */}
      <section className="section home-beat home-diagnostic" data-section="home-diagnostic">
        <div className="home-pin">
          <div className="home-stage">
            <div className="hb2-copy">
              <p className="home-kicker">
                <i className="home-dot" /> Diagnostic — exploded view
              </p>
              <SplitText as="h2" className="statement home-h2" lines={['Every plate,', <span key="l2" className="hl">load-bearing.</span>]} start="top 78%" />
              <p className="home-lede">
                {profile.yearsExperience} years building and maintaining enterprise web applications with ASP.NET Core, ASP.NET MVC, C# and SQL Server.
              </p>
              <ul className="hb2-stats" data-copilot="DIAGNOSTIC">
                {STATS.map((s, i) => (
                  <li key={s.label} className="hb2-stat" style={{ '--i': i }}>
                    <span className="hb2-plate">
                      Plate {pad(i + 1)} · {s.plate}
                    </span>
                    <span className="hb2-num">
                      <span data-count={s.value} data-pad={s.pad} data-suffix={s.suffix} aria-hidden="true">
                        {fmt(s.value, s.pad, s.suffix)}
                      </span>
                      <small aria-hidden="true">{s.unit}</small>
                      <span className="visually-hidden">{fmt(s.value, 0, s.suffix)}</span>
                    </span>
                    <span className="hb2-text">
                      <strong>{s.label}</strong>
                      <span>{s.note}</span>
                    </span>
                    <i className="hb2-anchor" data-anchor={`home-stat-${i}`} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BEAT 3 · REPULSOR CHARGE ============ */}
      <section className="section home-beat home-repulsor" data-section="home-repulsor">
        <div className="home-pin">
          <div className="home-stage">
            <div className="hb3-copy">
              <p className="home-kicker">
                <i className="home-dot" /> Repulsor — charge cycle
              </p>
              <SplitText as="h2" className="statement home-h2" lines={['Power to', <span key="l2" className="hl">every layer.</span>]} start="top 78%" />
              <div className="hb3-meter" aria-hidden="true">
                <span className="hb3-pct">
                  <b ref={pct}>000</b>%
                </span>
                <span className="hb3-meta">
                  <span className="hb3-bar">
                    <i ref={bar} />
                  </span>
                  <span ref={chargeState} className="hb3-state">
                    STANDBY
                  </span>
                </span>
              </div>
              <p className="hb3-caption">Subsystems — the stack that powers every build</p>
              <ul className="hb3-sys">
                {SYSTEMS.map((n, i) => (
                  <li key={n} className={i >= skills.core.length ? 'is-ai' : ''}>
                    <span className="hb3-id">SYS.{pad(i + 1)}</span>
                    <span className="hb3-name">{n}</span>
                    <em />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BEAT 4 · IDENTITY ============ */}
      <section className="section home-beat home-identity" data-section="home-identity">
        <div className="home-pin">
          <div className="home-stage">
            <div className="hb4-copy">
              <p className="home-kicker">
                <i className="home-dot" /> MK 85 // All systems online
              </p>
              <SplitText as="h2" className="statement home-h2 hb4-title" lines={['And I am', <span key="l2" className="hl">Akil Prabhu.</span>]} start="top 78%" />
              <p className="home-lede">
                {profile.title} in {profile.location} — building production REST APIs, business logic and SQL Server modules, with Claude and Windsurf IDE accelerating code review and
                feature delivery.
              </p>
              <div className="hb4-ctas">
                <Magnetic>
                  <a className="btn btn-primary" href="/Akil-Prabhu-Resume.pdf" download="Akil-Prabhu-Resume.pdf" data-cursor="PDF" data-copilot="RÉSUMÉ · PDF">
                    Download résumé <span className="arrow">↓</span>
                  </a>
                </Magnetic>
                <Magnetic>
                  <HeroLink to="projects" className="btn btn-gold" data-cursor="GO">
                    See the work <span className="arrow">→</span>
                  </HeroLink>
                </Magnetic>
              </div>
              <HeroLink to="contact" className="hb4-contact" data-cursor="CALL">
                Let’s build something together <span className="arrow">→</span>
              </HeroLink>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HERO SELECT ============ */}
      <section className="section home-select" data-section="home-select">
        <div className="hsel-head">
          <p className="home-kicker">
            <i className="home-dot" /> Hero select — six more pages
          </p>
          <SplitText as="h2" className="statement home-h2" lines={['Choose', <span key="l2" className="hl">your hero.</span>]} />
          <p className="home-lede">Every page suits up as a different hero and tells a different part of the story.</p>
        </div>
        <ul className="hsel-grid" data-copilot="HERO SELECT">
          {OTHERS.map((p, i) => (
            <li key={p.id} style={{ '--d': `${i * 70}ms` }}>
              <HeroLink
                to={p.id}
                className="hsel-card"
                data-cursor="SUIT UP"
                style={{ '--h-a': p.theme.primary, '--h-b': p.theme.accent, '--h-c': p.theme.accent2, '--h-bg': p.theme.bg2, '--h-font': p.theme.heroFont }}
                onPointerMove={onCardMove}
                onPointerEnter={onCardEnter}
                onPointerLeave={onCardLeave}
              >
                <span className="hsel-glow" aria-hidden="true" />
                <span className="hsel-top">
                  <span className="hsel-num">{pad(i + 2)}</span>
                  <span className="hsel-code">{p.codename}</span>
                </span>
                <span className="hsel-emblem">
                  <Emblem id={p.emblem} size={64} />
                </span>
                <span className="hsel-hero">{p.hero}</span>
                <span className="hsel-label">
                  {p.label} <span className="arrow">→</span>
                </span>
                <span className="hsel-blurb">{p.blurb}</span>
                <span className="hsel-corners" aria-hidden="true" />
              </HeroLink>
            </li>
          ))}
        </ul>
      </section>

      <NextPage current="home" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
