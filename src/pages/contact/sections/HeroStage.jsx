import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { profile } from '../../../data/resume'
import { isTransitioning } from '../../../transition/controller'
import { TEAM, HERO, arriveK, arriveStart, heroProgress } from '../timeline'
import { clamp, smoothstep } from '../../../three/scrollStore'

// HERO STAGE (pinned, ~4.6 screens of scroll). Three DOM beats over one fixed 3D stage:
//   A · OPENING   reference-style two-tone statement + glass quote card, the beacon idling off to the right
//   B · ROLL CALL six sling-ring portals open; a HUD roll-call strip types each hero from STANDBY → PORTAL → LOCKED
//   C · SLAM      LET'S / ASSEMBLE. slams in (blurred, oversized → sharp) with a lamp-strike on the gold line
// Every value is derived from the same `heroProgress()` the 3D director uses, so DOM and GL never drift.

const STATES = ['STANDBY', 'PORTAL OPEN', 'LOCKED']

export default function HeroStage({ ready }) {
  const root = useRef(null)
  const openRef = useRef(null)
  const rollRef = useRef(null)
  const slamRef = useRef(null)
  const cueRef = useRef(null)
  const endCueRef = useRef(null)

  // intro: the opening lines slam in once the studio intro / page transition has cleared
  useEffect(() => {
    const el = openRef.current
    if (!el || !ready) return
    const items = el.querySelectorAll('[data-in]')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    gsap.set(items, { opacity: 0, yPercent: 40, scale: 1.25, filter: 'blur(14px)', transformOrigin: '0% 100%' })
    let raf
    let tl
    const go = () => {
      if (isTransitioning()) {
        raf = requestAnimationFrame(go)
        return
      }
      tl = gsap.timeline({ delay: 0.15 })
      tl.to(items, { opacity: 1, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 1.1, ease: 'expo.out', stagger: 0.09 })
      tl.fromTo(el.querySelector('.ct-open-hl'), { opacity: 0 }, { keyframes: { opacity: [0, 0.7, 0.15, 1, 0.4, 1] }, duration: 0.7, ease: 'none' }, 0.35)
      tl.set(items, { clearProps: 'filter' })
    }
    raf = requestAnimationFrame(go)
    return () => {
      cancelAnimationFrame(raf)
      tl?.kill()
      gsap.set(items, { clearProps: 'all' })
    }
  }, [ready])

  // the slam timeline (played forward when the pinned progress crosses HERO.slam, reversed fast when scrolling back)
  const slamTl = useRef(null)
  useEffect(() => {
    const el = slamRef.current
    if (!el) return
    const chars = el.querySelectorAll('.ct-slam-char')
    const gold = el.querySelector('.ct-slam-l2')
    const kicker = el.querySelectorAll('[data-slam-fade]')
    const tl = gsap.timeline({ paused: true })
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // reduced motion: no slam, blur or flicker; the lockup simply fades in
      tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35, ease: 'none' }, 0)
      slamTl.current = tl
      return () => {
        tl.kill()
        slamTl.current = null
      }
    }
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01 }, 0)
    tl.fromTo(
      chars,
      { opacity: 0, scale: 2.6, yPercent: -30, filter: 'blur(18px)' },
      { opacity: 1, scale: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.75, ease: 'back.out(2.1)', stagger: 0.045 },
      0,
    )
    tl.fromTo(gold, { opacity: 0.2 }, { keyframes: { opacity: [0.2, 0.8, 0.25, 1, 0.5, 1] }, duration: 0.7, ease: 'none' }, 0.55)
    tl.fromTo(kicker, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1 }, 0.5)
    slamTl.current = tl
    return () => {
      tl.kill()
      slamTl.current = null
    }
  }, [])

  // per-frame scroll choreography (writes only on change)
  useEffect(() => {
    const open = openRef.current
    const roll = rollRef.current
    const slam = slamRef.current
    const cue = cueRef.current
    const endCue = endCueRef.current
    if (!open || !roll || !slam) return
    const rows = Array.from(roll.querySelectorAll('.ct-roll-row'))
    const stateEls = rows.map((r) => r.querySelector('.ct-roll-state'))
    const count = roll.querySelector('.ct-roll-count')
    const bar = roll.querySelector('.ct-roll-bar > i')
    const rowState = rows.map(() => -1)
    let lastCount = -1
    let slammed = false
    let raf
    let lastP = -1
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const p = heroProgress()
      if (Math.abs(p - lastP) < 0.0004) return
      lastP = p
      // A · opening fades up and away as the first portal opens
      const out = smoothstep(0.025, 0.105, p)
      open.style.opacity = String(1 - out)
      open.style.transform = `translate3d(0, ${(-60 * out).toFixed(1)}px, 0)`
      open.style.visibility = out >= 0.999 ? 'hidden' : 'visible'
      if (cue) cue.style.opacity = String(1 - smoothstep(0.0, 0.04, p))
      // B · roll call
      const rv = smoothstep(0.08, 0.12, p) * (1 - smoothstep(HERO.ignite - 0.005, HERO.ignite + 0.05, p))
      roll.style.opacity = String(rv)
      roll.style.visibility = rv < 0.01 ? 'hidden' : 'visible'
      roll.style.transform = `translate3d(-50%, ${((1 - rv) * 24).toFixed(1)}px, 0)`
      let n = 0
      for (let i = 0; i < rows.length; i++) {
        const k = arriveK(p, i)
        const sIdx = k >= 1 ? 2 : p > arriveStart(i) - 0.05 ? 1 : 0
        if (k >= 1) n++
        if (sIdx !== rowState[i]) {
          rowState[i] = sIdx
          rows[i].dataset.state = String(sIdx)
          if (stateEls[i]) stateEls[i].textContent = STATES[sIdx]
        }
      }
      if (n !== lastCount) {
        lastCount = n
        if (count) count.textContent = String(n)
      }
      if (bar) bar.style.transform = `scaleX(${clamp((p - HERO.arriveStart) / (arriveStart(5) + HERO.arriveLen - HERO.arriveStart), 0, 1).toFixed(3)})`
      // C · slam
      const tl = slamTl.current
      if (tl) {
        if (!slammed && p >= HERO.slam) {
          slammed = true
          tl.timeScale(1).play(0)
        } else if (slammed && p < HERO.slam - 0.02) {
          slammed = false
          tl.timeScale(2.4).reverse()
        }
      }
      if (endCue) endCue.style.opacity = String(smoothstep(0.86, 0.95, p))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section ref={root} className="section ct-hero" data-section="contact-hero">
      <div className="ct-pin">
        {/* ---------------- A · opening ---------------- */}
        <div ref={openRef} className="ct-open">
          <div className="ct-open-copy">
            <span className="ct-kicker" data-in="">
              <i className="ct-dot" aria-hidden="true" /> 07 / 07 · Final call
            </span>
            <h1 className="statement ct-statement">
              <span className="ct-line" data-in="">
                Let&apos;s build
              </span>
              <span className="ct-line" data-in="">
                <span className="hl ct-open-hl">something together.</span>
              </span>
            </h1>
            <p className="ct-open-sub" data-in="">
              Six heroes, one engineer. Scroll to call the whole team in, then pick a channel.
            </p>
            <p className="ct-open-tag mono" data-in="">
              {profile.title} · {profile.tagline}
            </p>
          </div>
          <figure className="quote-card ct-quote" data-in="">
            <blockquote>“Every system I ship is assembled the same way: solid APIs, careful SQL and a team that shows up. Send the signal.”</blockquote>
            <cite>
              <span>{profile.name}</span>
              <b>{profile.location}</b>
            </cite>
          </figure>
          <div ref={cueRef} className="ct-cue mono" aria-hidden="true">
            <span className="ct-cue-line" /> Scroll to assemble
          </div>
        </div>

        {/* ---------------- B · roll call ---------------- */}
        <div ref={rollRef} className="ct-roll" aria-hidden="true" style={{ opacity: 0, visibility: 'hidden' }}>
          <span className="ct-roll-title mono">
            <i className="ct-dot" /> Roll call
            <small>Sling-ring portals</small>
          </span>
          <ol className="ct-roll-list">
            {TEAM.map((m, i) => (
              <li key={m.key} className="ct-roll-row" data-state="0" style={{ '--c': m.color }}>
                <span className="ct-roll-n">{String(i + 1).padStart(2, '0')}</span>
                <span className="ct-roll-hero">{m.short}</span>
                <span className="ct-roll-state">STANDBY</span>
              </li>
            ))}
          </ol>
          <span className="ct-roll-tally mono">
            <b className="ct-roll-count">0</b>
            <small>/ 6 assembled</small>
          </span>
          <span className="ct-roll-bar">
            <i />
          </span>
        </div>

        {/* ---------------- C · slam ---------------- */}
        <div ref={slamRef} className="ct-slam" style={{ visibility: 'hidden', opacity: 0 }}>
          <span className="ct-kicker ct-slam-kicker" data-slam-fade="">
            <i className="ct-dot" aria-hidden="true" /> The team is complete
          </span>
          {/* a display lockup, not a heading: the hero section's one heading is the h1 above */}
          <p className="ct-slam-title">
            <span className="visually-hidden">Let&apos;s assemble.</span>
            <span className="ct-slam-l1" aria-hidden="true">
              {Array.from("LET'S").map((c, i) => (
                <span key={i} className="ct-slam-char" style={{ '--i': i }}>
                  {c}
                </span>
              ))}
            </span>
            <span className="ct-slam-l2" aria-hidden="true">
              {Array.from('ASSEMBLE.').map((c, i) => (
                <span key={i} className="ct-slam-char" style={{ '--i': i + 3 }}>
                  {c}
                </span>
              ))}
            </span>
          </p>
          <p className="ct-slam-sub" data-slam-fade="">
            Backend, data, front end, AI tooling, delivery, learning: every discipline, standing in one circle.
          </p>
        </div>
        <div ref={endCueRef} className="ct-cue ct-cue-end mono" aria-hidden="true" style={{ opacity: 0 }}>
          <span className="ct-cue-line" /> Open a channel
        </div>
      </div>
    </section>
  )
}
