import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitText from '../../../components/SplitText'
import { certifications } from '../../../data/resume'
import { cert, isAnthropic, pad2, ROMAN } from '../store'

gsap.registerPlugin(ScrollTrigger)

const GLYPHS = 'ABCDEFGHJKLMNPRSTVXZ0123456789†‡§¤◊∆'

// text scramble: glyphs resolve left -> right into the final label
function scramble(node, final, duration = 0.6) {
  const o = { p: 0 }
  return gsap.to(o, {
    p: 1,
    duration,
    ease: 'none',
    onUpdate: () => {
      const n = Math.floor(o.p * final.length)
      let s = final.slice(0, n)
      for (let i = n; i < final.length; i++) s += final[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]
      node.textContent = s
    },
    onComplete: () => (node.textContent = final),
  })
}

/*
 * BEAT III — THE BOOK OF SPELLS. Five certification cards in a zig-zag. Each is revealed through a SLING-RING
 * PORTAL: as the card scrolls in, the 3D ring of sparks tears open in its round window (bursting wider than the
 * window), and the card itself is unveiled by a circle growing out of the portal's centre. One small impact per
 * portal. Hovering a card feeds its portal and turns the relic toward it; the spell label re-scrambles.
 */
export default function Spells() {
  const root = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const items = Array.from(el.querySelectorAll('.spell'))
    const ctx = gsap.context(() => {
      items.forEach((li, i) => {
        const P = cert.portals[i]
        const reveal = li.querySelector('.spell-reveal')
        const label = li.querySelector('.spell-label')
        const finalLabel = label?.textContent || ''
        if (reduced) {
          P.open = 1
          return
        }
        const origin = getComputedStyle(reveal).getPropertyValue('--origin').trim() || '90px 50%'
        gsap.set(reveal, { clipPath: `circle(0% at ${origin})` })
        const tl = gsap.timeline({ paused: true })
        // the portal tears open (3D), overshooting the window, burning hot
        tl.to(P, { open: 1.45, burst: 1, duration: 0.75, ease: 'power3.out' }, 0)
        tl.call(() => {
          window.__portfolioImpulse?.(0.22)
          cert.flashOrange = Math.max(cert.flashOrange, 0.5)
        }, null, 0.3)
        // the card is unveiled through it
        tl.fromTo(reveal, { clipPath: `circle(0% at ${origin})` }, { clipPath: `circle(150% at ${origin})`, duration: 1.15, ease: 'power2.inOut' }, 0.22)
        tl.fromTo(li.querySelectorAll('[data-spell-in]'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: 'power3.out' }, 0.55)
        if (label) tl.add(scramble(label, finalLabel, 0.7), 0.5)
        // ...and settles into a steady ring around the window
        tl.to(P, { open: 1, burst: 0, duration: 0.9, ease: 'back.out(2)' }, 0.85)
        tl.set(reveal, { clearProps: 'clipPath' }, 1.4)
        ScrollTrigger.create({ trigger: li, start: 'top 78%', once: true, onEnter: () => tl.play() })
      })
    }, el)

    // hover: feed the portal, tilt the card, re-scramble the label
    const fine = window.matchMedia('(pointer: fine)').matches
    const offs = items.map((li, i) => {
      const card = li.querySelector('.spell-card')
      const label = li.querySelector('.spell-label')
      const finalLabel = label?.textContent || ''
      let tw = null
      const onEnter = () => {
        cert.hover = i
        li.classList.add('is-hover')
        if (label && !reduced) {
          tw?.kill()
          tw = scramble(label, finalLabel, 0.45)
        }
      }
      const onLeave = () => {
        if (cert.hover === i) cert.hover = -1
        li.classList.remove('is-hover')
        if (card) {
          card.style.setProperty('--rx', '0deg')
          card.style.setProperty('--ry', '0deg')
        }
      }
      const onMove = (e) => {
        if (!card || !fine) return
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / Math.max(1, r.width)
        const py = (e.clientY - r.top) / Math.max(1, r.height)
        card.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`)
        card.style.setProperty('--rx', `${((0.5 - py) * 8).toFixed(2)}deg`)
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      }
      li.addEventListener('pointerenter', onEnter)
      li.addEventListener('pointerleave', onLeave)
      li.addEventListener('pointermove', onMove, { passive: true })
      return () => {
        tw?.kill()
        li.removeEventListener('pointerenter', onEnter)
        li.removeEventListener('pointerleave', onLeave)
        li.removeEventListener('pointermove', onMove)
      }
    })

    return () => {
      offs.forEach((f) => f())
      ctx.revert()
      cert.portals.forEach((p) => {
        p.open = 0
        p.burst = 0
      })
      cert.hover = -1
    }
  }, [])

  return (
    <section ref={root} className="section cert-spells" id="certifications-spells" data-section="certifications-spells">
      <div className="section-inner">
        <header className="spells-head">
          <span className="cert-kicker">
            <i className="cert-num">III</i> The spells
          </span>
          <SplitText as="h2" className="hero-title spells-title" lines={['The book', 'of spells']} start="top 75%" aria-label="The book of spells" />
          <p className="spells-lede">Every certification, opened like a portal. Hover one to feed it power.</p>
        </header>

        <ol className="spell-list" aria-label="Certifications">
          {certifications.map((c, i) => {
            const orange = isAnthropic(c.issuer)
            return (
              <li key={c.name} className={`spell ${i % 2 ? 'is-right' : 'is-left'} ${orange ? 'is-orange' : 'is-green'}`}>
                <div className="spell-reveal">
                  <div className="spell-portal" data-anchor={`cert-portal-${i}`} aria-hidden="true">
                    <span className="spell-portal-ring" />
                    <svg className="spell-portal-dash" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="48" pathLength="100" />
                    </svg>
                    <span className="spell-numeral">{ROMAN[i]}</span>
                  </div>
                  <article className="spell-card" data-interactive="" data-cursor="SPELL">
                    <span className="spell-sheen" aria-hidden="true" />
                    <div className="spell-meta" data-spell-in>
                      <span className="spell-label mono">
                        Spell {pad2(i + 1)} / {pad2(certifications.length)}
                      </span>
                      <span className={`cert-chip ${orange ? 'is-orange' : 'is-green'}`}>{c.issuer}</span>
                    </div>
                    <h3 className="spell-name" data-spell-in>
                      {c.name}
                    </h3>
                    <p className="spell-detail" data-spell-in>
                      {c.detail}
                    </p>
                    <div className="spell-foot" data-spell-in>
                      <span className="spell-issuer mono">Issued by {c.issuer}</span>
                      <span className="spell-seal mono">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <rect x="7" y="7" width="10" height="10" transform="rotate(45 12 12)" />
                          <circle cx="12" cy="12" r="2.6" className="core" />
                        </svg>
                        Certified
                      </span>
                    </div>
                  </article>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
