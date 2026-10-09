import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitText from '../../../components/SplitText'
import { certifications, languages } from '../../../data/resume'
import { cert, isAnthropic, pad2 } from '../store'

gsap.registerPlugin(ScrollTrigger)

const anthropicCount = certifications.filter((c) => isAnthropic(c.issuer)).length
const guviCount = certifications.length - anthropicCount

// Each callout labels one layer of the exploded relic (the 3D layer lifts + glows while its callout is hovered).
const CALLOUTS = [
  { layer: 'Layer V · The gem', value: certifications.length, label: 'Certifications', copilot: 'GEM · CERTIFICATIONS' },
  { layer: 'Layer IV · The iris', value: anthropicCount, label: 'From Anthropic', copilot: 'IRIS · ANTHROPIC' },
  { layer: 'Layer II · The frame', value: guviCount, label: 'From GUVI', copilot: 'FRAME · GUVI' },
  { layer: 'Layer I · The seal', value: languages.length, label: languages.map((l) => l.name).join(' · '), copilot: 'SEAL · LANGUAGES' },
]

/*
 * BEAT II — THE CODEX. The relic comes apart into its layers (exploded view, 3D) while four HUD callouts lock on
 * around it: brackets snap in, a leader line draws toward the relic and the number counts up.
 */
export default function Codex() {
  const root = useRef(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const items = el.querySelectorAll('.codex-callout')
      const nums = el.querySelectorAll('[data-count]')
      const lede = el.querySelectorAll('[data-reveal]')
      if (reduced) return
      gsap.fromTo(lede, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 65%', once: true } })
      const tl = gsap.timeline({ scrollTrigger: { trigger: el.querySelector('.codex-callouts'), start: 'top 75%', once: true } })
      items.forEach((it, i) => {
        tl.fromTo(it, { x: 70, opacity: 0, filter: 'blur(8px)' }, { x: 0, opacity: 1, filter: 'blur(0px)', duration: 0.9, ease: 'back.out(1.6)', clearProps: 'filter,transform' }, i * 0.12)
        tl.add(() => it.classList.add('is-locked'), i * 0.12 + 0.35)
      })
      nums.forEach((n, i) => {
        const target = parseFloat(n.dataset.count)
        const o = { v: 0 }
        n.textContent = '00'
        tl.to(o, { v: target, duration: 1.4, ease: 'power2.out', onUpdate: () => (n.textContent = pad2(Math.round(o.v))) }, 0.3 + i * 0.12)
      })
    }, el)
    return () => ctx.revert()
  }, [])

  const enter = (i) => () => {
    cert.hoverCodex = i
  }
  const leave = (i) => () => {
    if (cert.hoverCodex === i) cert.hoverCodex = -1
  }

  return (
    <section ref={root} className="section cert-codex" id="certifications-codex" data-section="certifications-codex">
      <div className="section-inner codex-grid">
        <header className="codex-head">
          <span className="cert-kicker" data-reveal>
            <i className="cert-num">II</i> The codex
          </span>
          <SplitText as="h2" className="statement cert-statement-md codex-statement" lines={['Five seals.', <span className="hl" key="b">Two schools.</span>]} start="top 72%" aria-label="Five seals. Two schools." />
          <p className="codex-lede" data-reveal>
            Three seals from Anthropic on working with Claude — the fundamentals, Claude Code and prompt engineering. Two from GUVI on the .NET craft — Web APIs and C# with Windows Forms.
          </p>
        </header>

        {/* the exploded relic (3D) is centred in this slot; the DOM draws the lock-on reticle around it */}
        <div className="codex-slot" data-anchor="cert-codex-slot" aria-hidden="true">
          <span className="codex-reticle" />
          <span className="codex-reticle codex-reticle-2" />
          <span className="codex-corner tl" />
          <span className="codex-corner tr" />
          <span className="codex-corner bl" />
          <span className="codex-corner br" />
          <span className="mono codex-slot-tag">Exploded view · 6 layers</span>
        </div>

        <ul className="codex-callouts" aria-label="The codex in numbers">
          {CALLOUTS.map((c, i) => (
            <li
              key={c.layer}
              className={`codex-callout cc-${i}`}
              data-interactive=""
              data-copilot={i === 0 ? c.copilot : undefined}
              onPointerEnter={enter(i)}
              onPointerLeave={leave(i)}
            >
              <span className="cc-bracket" aria-hidden="true" />
              <span className="cc-layer mono">{c.layer}</span>
              <span className="cc-value">
                <span data-count={c.value}>{pad2(c.value)}</span>
              </span>
              <span className="cc-label">{c.label}</span>
              <span className="cc-lead" aria-hidden="true">
                <i />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
