import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile, skills, experience, education, languages } from '../../../data/resume'
import { PAGES, pageById } from '../../../data/heroes'
import HeroLink from '../../../transition/HeroLink'
import Emblem from '../../../components/Emblem'
import Magnetic from '../../../components/Magnetic'
import { RESUME_HREF, PHONE_HREF, displayUrl } from './Channels'

gsap.registerPlugin(ScrollTrigger)

// END CREDITS — the film-style crawl: "Starring", the credit block (every line from the résumé), the closing tally
// counting up one last time, the cast list (each hero = a link to its page), the replay link back to the start,
// and the footer. The formation sinks behind it in 3D, still turning.

const sk = (names) => skills.core.filter((s) => names.includes(s.name)).map((s) => s.name)
const now = experience.find((e) => e.current)
const before = experience.find((e) => !e.current)
const CREDITS = [
  { role: 'Back end', name: sk(['C# / .NET Core', 'ASP.NET Core', 'ASP.NET MVC', 'Web API']).join(' · ') },
  { role: 'Data', name: [...sk(['SQL Server', 'Entity Framework']), 'SQL Optimisation', 'Background SQL Jobs'].join(' · ') },
  { role: 'Front end', name: sk(['Razor Views', 'JavaScript', 'HTML5 / CSS3 / Bootstrap']).join(' · ') },
  { role: 'AI co-pilots', name: skills.ai.map((s) => s.name).join(' · ') },
  { role: 'Now showing', name: `${now.role}, ${now.company} · ${now.start} – ${now.end}` },
  { role: 'Previously', name: `${before.role}, ${before.company} · ${before.start} – ${before.end}` },
  { role: 'Education', name: `${education.degree} · ${education.start} – ${education.end}` },
  { role: 'Languages', name: languages.map((l) => `${l.name} (${l.level})`).join(' · ') },
  { role: 'Filmed on location', name: profile.location },
]

const TALLY = [
  { value: profile.yearsExperience, pad: 2, label: 'Years shipping' },
  { value: profile.livePortals, pad: 2, label: 'Live portals' },
  { value: profile.employeesServed, suffix: '+', label: 'Employees served' },
  { value: profile.entities, pad: 2, label: 'Entities' },
]
function fmt(n, v) {
  const suffix = n.dataset.suffix || ''
  const pad = n.dataset.pad ? parseInt(n.dataset.pad, 10) : 0
  let s = Math.round(v).toLocaleString('en-US')
  if (pad) s = s.padStart(pad, '0')
  return s + suffix
}
function finalCount({ value, pad, suffix }) {
  let s = value.toLocaleString('en-US')
  if (pad) s = s.padStart(pad, '0')
  return s + (suffix || '')
}

const CAST = PAGES.filter((p) => p.id !== 'contact')
const YEAR = 2026

export default function Credits() {
  const root = useRef(null)

  // credits crawl: each block rises out of the dark as it reaches the lower third (like a roll), plus count-ups
  useEffect(() => {
    const el = root.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const blocks = Array.from(el.querySelectorAll('[data-roll]'))
    const tweens = blocks.map((b) =>
      gsap.fromTo(
        b,
        { opacity: 0, y: 60, filter: 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true }, clearProps: 'filter' },
      ),
    )
    const nums = Array.from(el.querySelectorAll('[data-count]'))
    nums.forEach((n) => (n.textContent = fmt(n, 0)))
    const counts = []
    const st = ScrollTrigger.create({
      trigger: el.querySelector('.ct-tally'),
      start: 'top 88%',
      once: true,
      onEnter: () =>
        nums.forEach((n, i) => {
          const o = { v: 0 }
          counts.push(gsap.to(o, { v: parseFloat(n.dataset.count), duration: 1.8, delay: i * 0.12, ease: 'power2.out', onUpdate: () => (n.textContent = fmt(n, o.v)) }))
        }),
    })
    return () => {
      tweens.forEach((t) => {
        t.scrollTrigger?.kill()
        t.kill()
      })
      st.kill()
      counts.forEach((t) => t.kill())
      nums.forEach((n) => (n.textContent = fmt(n, parseFloat(n.dataset.count))))
    }
  }, [])

  return (
    <section ref={root} className="section ct-credits" data-section="contact-credits">
      <div className="section-inner ct-credits-inner">
        <div className="ct-star" data-roll="">
          <span className="ct-kicker">
            <i className="ct-dot" aria-hidden="true" /> End credits
          </span>
          <span className="ct-starring mono">Starring</span>
          <h2 className="ct-star-name">{profile.name}</h2>
          <span className="ct-star-role">as {profile.title}</span>
        </div>

        <dl className="ct-credit-list">
          {CREDITS.map((c) => (
            <div key={c.role} className="ct-credit" data-roll="">
              <dt className="mono">{c.role}</dt>
              <dd>{c.name}</dd>
            </div>
          ))}
        </dl>

        <ul className="ct-tally" data-roll="">
          {TALLY.map((n) => (
            <li key={n.label}>
              {/* the visible figure counts up; assistive tech always reads the final value */}
              <span className="visually-hidden">{finalCount(n)}</span>
              <span className="ct-tally-v" aria-hidden="true">
                <span data-count={n.value} data-pad={n.pad} data-suffix={n.suffix}>
                  {finalCount(n)}
                </span>
              </span>
              <span className="ct-tally-k mono">{n.label}</span>
            </li>
          ))}
        </ul>

        <div className="ct-cast" data-roll="">
          {/* zero-size marker: the 3D formation sinks and fades out as this block rises (ContactScene) */}
          <span className="ct-fade-mark" data-anchor="ct-fade-mark" aria-hidden="true" />
          <span className="ct-cast-title mono">The team · revisit any hero</span>
          <ul className="ct-cast-list">
            {CAST.map((p, i) => (
              <li key={p.id}>
                <HeroLink to={p.id} className="ct-cast-link" style={{ '--h-a': p.theme.primary, '--h-b': p.theme.accent, '--h-c': p.theme.accent2, '--h-font': p.theme.heroFont }} data-cursor="GO">
                  <span className="ct-cast-emblem">
                    <Emblem id={p.emblem} size={40} />
                  </span>
                  <span className="ct-cast-hero">{p.hero}</span>
                  <span className="ct-cast-dots" aria-hidden="true" />
                  <span className="ct-cast-page mono">
                    {String(i + 1).padStart(2, '0')} · {p.label}
                  </span>
                </HeroLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="ct-replay-wrap" data-roll="">
          <HeroLink to="home" className="ct-replay" data-cursor="AGAIN" data-copilot="REPLAY" style={{ '--np-a': pageById.home.theme.primary, '--np-b': pageById.home.theme.accent, '--np-c': pageById.home.theme.accent2 }}>
            <span className="ct-replay-kicker mono">
              Back to the beginning <span className="ct-replay-rule" />
            </span>
            <span className="ct-replay-row">
              <span className="ct-replay-emblem">
                <Emblem id="reactor" size={84} />
              </span>
              <span className="ct-replay-text">
                Replay from the <span className="hl">beginning</span> <span className="ct-replay-arrow">↺</span>
              </span>
            </span>
          </HeroLink>
        </div>

        <footer className="ct-foot" data-roll="">
          <div className="ct-foot-col">
            <span className="mono bright">
              © {YEAR} {profile.name} · {profile.location}
            </span>
            <span className="mono">Built with React Three Fiber, GSAP and Lenis · every 3D piece procedural</span>
          </div>
          <nav className="ct-foot-links" aria-label="Contact links">
            <a href={`mailto:${profile.email}`}>Email</a>
            <a href={profile.linkedin} target="_blank" rel="noreferrer noopener">
              {displayUrl(profile.linkedin)}
            </a>
            <a href={profile.github} target="_blank" rel="noreferrer noopener">
              {displayUrl(profile.github)}
            </a>
            <a href={RESUME_HREF} download="Akil-Prabhu-Resume.pdf">
              Résumé PDF
            </a>
            <a href={PHONE_HREF}>{profile.phone}</a>
          </nav>
          <Magnetic>
            <button type="button" className="ct-top" onClick={() => window.__lenis?.scrollTo(0, { duration: 2.2 })} data-cursor="TOP">
              Back to top <span aria-hidden="true">↑</span>
            </button>
          </Magnetic>
        </footer>
      </div>
    </section>
  )
}
