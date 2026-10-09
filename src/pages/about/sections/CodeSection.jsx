import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { certifications } from '../../../data/resume'
import SplitText from '../../../components/SplitText'
import { TriBar, Stamp, prefersReduced } from '../parts'
import { SHIELD_EVENT } from '../choreo'

gsap.registerPlugin(ScrollTrigger)

const anthropicCerts = certifications.filter((c) => c.issuer.startsWith('Anthropic')).map((c) => c.name)

// Principles drawn from the résumé (coding standards, collaboration, growth, AI-assisted engineering).
const ARTICLES = [
  {
    n: 'I',
    title: 'Follows coding standards',
    body: 'UI components in HTML, CSS, Bootstrap and Razor, built to the team’s coding standards — readable, reviewable, consistent.',
    tags: ['Razor', 'Bootstrap', 'Clean code'],
  },
  {
    n: 'II',
    title: 'Strong team collaborator',
    body: 'Works alongside senior engineers through sprint planning, code reviews and delivery cycles.',
    tags: ['Sprints', 'Code review', 'Delivery'],
  },
  {
    n: 'III',
    title: 'Committed to continuous growth',
    body: `From a B.Com. graduate to a Software Engineer on live enterprise portals — and still training: ${anthropicCerts.join(', ')}.`,
    tags: ['Learning', 'Certifications'],
  },
  {
    n: 'IV',
    title: 'AI-assisted engineering',
    body: 'Prompt engineering with Claude and the Windsurf IDE to speed up code review, feature delivery and day-to-day engineering workflows.',
    tags: ['Claude', 'Windsurf IDE', 'Prompting'],
  },
]

// Beat 4 — the code. A pinned stage (desktop): four articles; the SHIELD THROW ricochets card → card as
// you scroll, each strike lighting the card and stamping it CONFIRMED. Stacked on mobile.
export default function CodeSection() {
  const root = useRef(null)
  const count = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ctx = gsap.context(() => {
      if (prefersReduced()) return
      gsap.fromTo(
        el.querySelectorAll('.ab-article'),
        { opacity: 0, y: 90, rotateX: -25, transformPerspective: 1000 },
        {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 1.1,
          stagger: 0.09,
          ease: 'expo.out',
          // trigger on the (non-sticky) section on desktop: a sticky element's measured position depends on the
          // scroll position at refresh time; on phones nothing is pinned, so the list itself is the trigger
          scrollTrigger: { trigger: window.innerWidth > 960 ? el : el.querySelector('.ab-articles'), start: window.innerWidth > 960 ? 'top 45%' : 'top 85%', once: true },
          clearProps: 'transform',
        },
      )
    }, el)
    // live ricochet counter
    const onShield = (e) => {
      const { type, key } = e.detail || {}
      if ((type !== 'hit' && type !== 'mark') || !key?.startsWith('code-')) return
      requestAnimationFrame(() => {
        if (count.current) count.current.textContent = String(el.querySelectorAll('.ab-article.is-struck').length)
      })
    }
    window.addEventListener(SHIELD_EVENT, onShield)
    return () => {
      window.removeEventListener(SHIELD_EVENT, onShield)
      ctx.revert()
    }
  }, [])

  return (
    <section ref={root} className="section ab-code" data-section="about-code" data-pin-track>
      <div className="ab-code-pin" data-pin>
        <header className="ab-code-head">
          <div>
            <p className="ab-label mono">
              <span className="ab-label-n hero-title">03</span> The code <TriBar />
            </p>
            <SplitText
              as="h2"
              className="statement ab-title"
              aria-label="What I stand for."
              lines={[
                'What I',
                <span className="hl" key="b">
                  stand for.
                </span>,
              ]}
              start="top 80%"
            />
          </div>
          <p className="ab-code-hud mono" aria-hidden="true">
            <span>
              Ricochet <b ref={count}>0</b> / {ARTICLES.length}
            </span>
            <span className="ab-code-hud-bar">
              {ARTICLES.map((a) => (
                <i key={a.n} />
              ))}
            </span>
          </p>
        </header>

        <ol className="ab-articles">
          {ARTICLES.map((a, i) => (
            <li key={a.n} className={`ab-article ab-article--${i}`} data-hit={`code-${i}`}>
              <div className="ab-plate" data-anchor={`about-card-${i}`} aria-hidden="true">
                <span className="ab-plate-ring" />
                <span className="ab-plate-ring ab-plate-ring--in" />
                <span className="ab-plate-flash" />
              </div>
              <span className="ab-article-n hero-title">Article {a.n}</span>
              <h3 className="ab-article-title">{a.title}</h3>
              <p className="ab-article-body">{a.body}</p>
              <ul className="ab-article-tags" aria-label="Keywords">
                {a.tags.map((t) => (
                  <li key={t} className="mono">
                    {t}
                  </li>
                ))}
              </ul>
              <Stamp className="ab-article-stamp" tone="blue">
                Confirmed
              </Stamp>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
