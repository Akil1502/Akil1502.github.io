import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { profile } from '../../../data/resume'
import SplitText from '../../../components/SplitText'
import { scroll } from '../../../three/scrollStore'
import { TEAM } from '../timeline'

gsap.registerPlugin(ScrollTrigger)

// COMMS ARRAY — six channel cards, one per hero. Each card is opened through a SLING-RING PORTAL: an orange spark
// ring spins open at the card's emblem slot, the card is revealed through it (a clip-path circle growing from the
// slot), and the matching 3D token hops out of the formation through a portal pair into that slot.
// Store: sets scroll.ctCardOn[i] when card i opens; scroll.ctHover / scroll.ctEmail on hover.

export const RESUME_HREF = '/Akil-Prabhu-Resume.pdf'
export const PHONE_HREF = `tel:${profile.phone.replace(/\s+/g, '')}`
export const displayUrl = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '')

const CHANNELS = [
  {
    label: 'Email',
    value: profile.email,
    href: `mailto:${profile.email}`,
    note: 'Straight to my inbox. The best line for briefs, questions and introductions.',
    cta: 'Write to me',
    arrow: '↗',
    cursor: 'MAIL',
    copilot: 'SEND MAIL',
    email: true,
  },
  {
    label: 'Phone',
    value: profile.phone,
    href: PHONE_HREF,
    note: 'A direct voice line, on India Standard Time.',
    cta: 'Call',
    arrow: '↗',
    cursor: 'CALL',
  },
  {
    label: 'LinkedIn',
    value: displayUrl(profile.linkedin),
    href: profile.linkedin,
    external: true,
    note: 'My professional profile and network.',
    cta: 'Connect',
    arrow: '↗',
    cursor: 'OPEN',
    copilot: 'LINKEDIN',
  },
  {
    label: 'Résumé',
    value: 'Akil-Prabhu-Resume.pdf',
    href: RESUME_HREF,
    download: 'Akil-Prabhu-Resume.pdf',
    note: 'The full dossier as a PDF: experience, projects, skills and certifications.',
    cta: 'Download',
    arrow: '↓',
    cursor: 'PDF',
    copilot: 'RÉSUMÉ PDF',
  },
  {
    label: 'GitHub',
    value: displayUrl(profile.github),
    href: profile.github,
    external: true,
    note: 'Repositories, experiments and code.',
    cta: 'Open',
    arrow: '↗',
    cursor: 'CODE',
    copilot: 'GITHUB',
  },
  {
    label: 'Location',
    value: profile.location,
    note: 'The assembly point: home base for both roles so far.',
    cta: 'Assembly point',
    arrow: '◎',
  },
]

export default function Channels() {
  const root = useRef(null)

  // SLING-RING reveal per card (one-shot), staggered left → right within each row
  useEffect(() => {
    const el = root.current
    if (!el) return
    const cards = Array.from(el.querySelectorAll('[data-ct-card]'))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      cards.forEach((c, i) => {
        c.classList.add('is-open')
        scroll.ctCardOn[i] = true
      })
      return
    }
    const sts = []
    const tls = []
    const calls = []
    cards.forEach((card, i) => {
      const ring = card.querySelector('.ct-card-portal')
      const inner = card.querySelectorAll('[data-card-in]')
      gsap.set(card, { '--open': 0 })
      gsap.set(ring, { scale: 0, opacity: 0, rotate: -120 })
      gsap.set(inner, { opacity: 0, y: 18 })
      const tl = gsap.timeline({ paused: true })
      tl.to(ring, { scale: 1, opacity: 1, rotate: 0, duration: 0.55, ease: 'back.out(1.6)' }, 0)
      tl.to(card, { '--open': 1, duration: 1.0, ease: 'expo.inOut' }, 0.22)
      tl.to(ring, { scale: 3.4, opacity: 0, duration: 0.8, ease: 'power2.in' }, 0.62)
      tl.to(inner, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06 }, 0.75)
      tl.call(() => card.classList.add('is-open'), null, 0.9)
      tls.push(tl)
      const col = window.innerWidth > 960 ? i % 3 : 0
      sts.push(
        ScrollTrigger.create({
          trigger: card,
          start: 'top 86%',
          once: true,
          onEnter: () => {
            calls.push(
              gsap.delayedCall(col * 0.16, () => {
                if (scroll.ctCardOn) scroll.ctCardOn[i] = true
                tl.play()
              }),
            )
          },
        }),
      )
    })
    return () => {
      sts.forEach((s) => s.kill())
      calls.forEach((c) => c.kill())
      tls.forEach((t) => t.kill())
    }
  }, [])

  // holographic tilt (pointer → CSS vars)
  useEffect(() => {
    const el = root.current
    if (!el || window.matchMedia('(pointer: coarse)').matches) return
    const cards = Array.from(el.querySelectorAll('[data-ct-card]'))
    const offs = cards.map((card) => {
      const move = (e) => {
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / Math.max(1, r.width)
        const py = (e.clientY - r.top) / Math.max(1, r.height)
        card.style.setProperty('--ry', `${((px - 0.5) * 10).toFixed(2)}deg`)
        card.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`)
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      }
      const leave = () => {
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
      }
      card.addEventListener('pointermove', move, { passive: true })
      card.addEventListener('pointerleave', leave)
      return () => {
        card.removeEventListener('pointermove', move)
        card.removeEventListener('pointerleave', leave)
      }
    })
    return () => offs.forEach((f) => f())
  }, [])

  const on = (i, email) => () => {
    scroll.ctHover = i
    if (email) scroll.ctEmail = 1
  }
  const off = (i, email) => () => {
    if (scroll.ctHover === i) scroll.ctHover = -1
    if (email) scroll.ctEmail = 0
  }

  return (
    <section ref={root} className="section ct-channels" data-section="contact-channels">
      <div className="section-inner">
        <header className="ct-ch-head">
          <span className="ct-kicker">
            <i className="ct-dot" aria-hidden="true" /> Comms array · six channels
          </span>
          <SplitText as="h2" className="statement ct-ch-title" lines={['Six channels.', <span key="hl" className="hl">One signal.</span>]} start="top 80%" />
          <p className="ct-ch-lede">Every hero carries a line to me. Each card opens through its own portal: pick whichever suits you.</p>
        </header>

        <ul className="ct-cards">
          {CHANNELS.map((c, i) => {
            const m = TEAM[i]
            const Tag = c.href ? 'a' : 'div'
            const linkProps = c.href
              ? {
                  href: c.href,
                  ...(c.external ? { target: '_blank', rel: 'noreferrer noopener' } : {}),
                  ...(c.download ? { download: c.download } : {}),
                  'data-cursor': c.cursor,
                  ...(c.copilot ? { 'data-copilot': c.copilot } : {}),
                }
              : { 'data-interactive': '' }
            return (
              <li key={c.label} className="ct-card-cell">
                <Tag
                  className="ct-card"
                  data-ct-card={i}
                  style={{ '--c': m.color, '--t': m.tint }}
                  onPointerEnter={on(i, c.email)}
                  onPointerLeave={off(i, c.email)}
                  onFocus={on(i, c.email)}
                  onBlur={off(i, c.email)}
                  {...linkProps}
                >
                  <span className="ct-card-portal" aria-hidden="true" />
                  <span className="ct-card-shine" aria-hidden="true" />
                  <span className="ct-card-top" data-card-in="">
                    <span className="ct-card-ch mono">CH {String(i + 1).padStart(2, '0')}</span>
                    <span className="ct-card-hero mono">
                      {m.short} · {m.role}
                    </span>
                  </span>
                  <span className="ct-slot" data-anchor={`ct-slot-${i}`} aria-hidden="true">
                    <i />
                  </span>
                  <span className="ct-card-label" data-card-in="">
                    {c.label}
                  </span>
                  <span className="ct-card-value" data-card-in="">
                    {c.value}
                  </span>
                  <span className="ct-card-note" data-card-in="">
                    {c.note}
                  </span>
                  <span className="ct-card-cta mono" data-card-in="">
                    {c.cta} <span className="ct-card-arrow">{c.arrow}</span>
                  </span>
                </Tag>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
