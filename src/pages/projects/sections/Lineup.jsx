import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { projects } from '../../../data/resume'
import Emblem from '../../../components/Emblem'
import { measureSections, updateSectionProgress } from '../../../three/scrollStore'
import { getLenis } from '../../../hooks/useLenis'
import { gamma, requestSmash, REDUCED } from '../store'
import { crackPaths, crackFlash, dustBurst, lampStrike, pad } from './fx'

gsap.registerPlugin(ScrollTrigger)

// PROJECTS · BEAT 2 — THE LINEUP. The five systems as a horizontally scrolling lineup on a sticky stage (stacked on
// mobile). SMASH, five times: every card falls out of the sky like a ground-pound, hits the ground (camera impact
// 0.6, a shockwave through the 3D ground right under it, shards jump, dust rolls out, crack decals flare), then
// its HUD locks on, the metric counts up and its 3D machine assembles in the slot. The SMASH button replays it.

// DOM twins of the 3D machine labels (every 3D label has a DOM twin)
const MACHINE_LABELS = {
  hangfire: 'EVERY TICK · ORG-WIDE',
  'agent-crm': '~450 AGENTS · DAILY',
  ess: '1,000+ EMPLOYEES · 3 ENTITIES',
  knitting: '4 MODULES · PDF / EXCEL / CRYSTAL',
  'prime-delay': '200 RECIPIENTS · DAILY · NO MANUAL STEP',
}
const KIND_LABELS = {
  scheduler: 'Background job scheduler',
  crm: 'Live enterprise CRM',
  portal: 'Attendance & payroll portal',
  documents: 'Document management',
  mail: 'Automated daily mail dispatch',
}
const SHORT = { hangfire: 'HANGFIRE', 'agent-crm': 'AGENT CRM', ess: 'ESS', knitting: 'KNITTING', 'prime-delay': 'PRIME DELAY' }

function parseMetric(value) {
  const m = /^([\d,]+)(.*)$/.exec(String(value).trim())
  if (!m) return null
  return { n: parseInt(m[1].replace(/,/g, ''), 10), suffix: m[2] }
}

const typing = new WeakMap()
function typeText(el, text, duration = 0.6, delay = 0) {
  if (!el) return
  typing.get(el)?.kill()
  const o = { n: 0 }
  const len = text.length
  const tw = gsap.to(o, {
    n: len,
    duration,
    delay,
    ease: 'none',
    onStart: () => {
      el.textContent = '▌'
    },
    onUpdate: () => {
      const k = Math.round(o.n)
      el.textContent = text.slice(0, k) + (k < len ? '▌' : '')
    },
    onComplete: () => {
      el.textContent = text
    },
  })
  typing.set(el, tw)
}
function countUp(scope, duration = 1.6) {
  scope.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseFloat(el.dataset.count)
    const suffix = el.dataset.suffix || ''
    const o = { v: 0 }
    gsap.to(o, {
      v: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(o.v).toLocaleString('en-US') + suffix
      },
    })
  })
}
function finalCounts(scope) {
  scope.querySelectorAll('[data-count]').forEach((el) => {
    el.textContent = parseFloat(el.dataset.count).toLocaleString('en-US') + (el.dataset.suffix || '')
  })
}

const narrow = () => window.matchMedia('(max-width: 960px)').matches

// Pre-flight: every card waits above the stage (hidden), its text and chips up in the air.
function hold(items) {
  items.forEach((li) => {
    gsap.set(li.querySelector('.pj-rig'), { opacity: 0 })
    gsap.set(li.querySelectorAll('[data-card-in]'), { opacity: 0, y: -26 })
    gsap.set(li.querySelectorAll('.pj-stack .chip'), { opacity: 0, y: -60, rotation: (i) => (i % 2 ? 8 : -8) })
    const twin = li.querySelector('[data-type="twin"]')
    if (twin) twin.textContent = ''
  })
}
function settle(items) {
  items.forEach((li) => {
    const twin = li.querySelector('[data-type="twin"]')
    if (twin) twin.textContent = twin.dataset.text
    const status = li.querySelector('[data-type="status"]')
    if (status) status.textContent = 'LIVE'
    finalCounts(li)
    if (li.dataset.id) gamma.landed[li.dataset.id] = performance.now()
    li.classList.add('is-landed')
  })
}

// The ground-pound lands: camera impact + ground shockwave under the card, dust, crack decal, lock-on, count-up,
// and the hand-off to the card's 3D machine.
function land(li, power = 0.6) {
  const id = li.dataset.id
  const r = li.getBoundingClientRect()
  requestSmash({ sx: r.left + r.width / 2, sy: Math.min(window.innerHeight - 8, r.bottom - 6), power, crack: 0.62 + 0.08 * Number(li.dataset.i || 0) })
  li.classList.add('is-landed')
  const flash = li.querySelector('.pj-impact')
  if (flash) gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.9, ease: 'power2.out' })
  crackFlash(li.querySelector('.pj-card-cracks'))
  dustBurst(li.querySelector('.pj-dust'), power)
  if (!id) return
  gamma.landed[id] = performance.now()
  const frame = li.querySelector('.pj-machine-frame')
  if (frame) gsap.fromTo(frame, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: 'auto' })
  const twin = li.querySelector('[data-type="twin"]')
  if (twin) typeText(twin, twin.dataset.text, 0.8, 0.12)
  typeText(li.querySelector('[data-type="status"]'), 'LIVE', 0.35, 0.5)
  countUp(li)
}

// SMASH: the rig falls out of the sky (accelerating), squashes on contact and springs back; text and chips
// rain down after it.
function smashCard(li, delay = 0) {
  const rig = li.querySelector('.pj-rig')
  const fall = narrow() ? Math.min(420, window.innerHeight * 0.5) : window.innerHeight * 0.85
  const side = Number(li.dataset.i || 0) % 2 ? 1 : -1
  const tl = gsap.timeline({ delay })
  tl.set(rig, { opacity: 1, y: -fall, rotation: side * 2.2, scale: 1.05, transformOrigin: '50% 100%' })
  // the copy rides down with the slab (slightly lifted) and jolts into place on impact
  tl.set(li.querySelectorAll('[data-card-in]'), { opacity: 1, y: -18 }, 0)
  tl.to(rig, { y: 0, rotation: 0, scale: 1, duration: 0.48, ease: 'power4.in' })
  tl.add(() => land(li), 0.48)
  tl.to(rig, { scaleY: 0.95, scaleX: 1.025, duration: 0.07, ease: 'power2.out' }, 0.48)
  tl.to(rig, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.32)' }, 0.55)
  tl.to(li.querySelectorAll('[data-card-in]'), { y: 0, duration: 0.5, stagger: 0.04, ease: 'bounce.out' }, 0.5)
  tl.to(li.querySelectorAll('.pj-stack .chip'), { opacity: 1, y: 0, rotation: 0, duration: 0.5, stagger: 0.05, ease: 'bounce.out' }, 0.62)
  tl.add(() => gsap.set(rig, { clearProps: 'transform' }), 1.3)
  return tl
}

export default function Lineup({ live }) {
  const root = useRef(null)
  const stage = useRef(null)
  const track = useRef(null)
  const hud = useRef(null)
  const hudCur = useRef(null)
  const title = useRef(null)
  const n = projects.length
  const cracks = useMemo(() => projects.map((p, i) => crackPaths(31 + i * 17, { mains: 3, len: 52 })), [])
  const smashed = useRef(new Set())

  useLayoutEffect(() => {
    const items = Array.from(track.current?.querySelectorAll('.pj-card') || [])
    smashed.current = new Set()
    if (REDUCED()) settle(items)
    else hold(items)
  }, [])

  // ---------------------------------------------------------------- horizontal drive + HUD + smash triggers
  useLayoutEffect(() => {
    const section = root.current
    const stageEl = stage.current
    const trackEl = track.current
    if (!section || !stageEl || !trackEl) return
    const cards = Array.from(trackEl.querySelectorAll('.pj-card'))
    let current = -1
    const running = []
    let lastAt = -1e9
    let chain = 0
    const fire = (li) => {
      const id = li.dataset.id
      if (smashed.current.has(id)) return
      if (!gamma.live || REDUCED()) return
      smashed.current.add(id)
      const now = performance.now()
      chain = now - lastAt < 500 ? chain + 1 : 0
      lastAt = now
      running.push(smashCard(li, chain * 0.36))
    }
    const setIndex = (i) => {
      i = Math.max(0, Math.min(n - 1, i))
      if (i === current) return
      current = i
      gamma.index = i
      if (hudCur.current) hudCur.current.textContent = pad(i + 1)
      cards.forEach((c, k) => c.classList.toggle('is-active', k === i))
    }
    const setProgress = (p) => hud.current && hud.current.style.setProperty('--p', p.toFixed(4))

    const mm = gsap.matchMedia()
    mm.add('(min-width: 961px)', () => {
      // The track does not slide linearly: it DWELLS. Every card gets a stop where it sits centred on the stage
      // (fully readable, its neighbours dimmed and peeking in from the edges), and the scroll between two stops
      // carries the track across in one eased move. The last stop is the end of the track (last card + the
      // closing panel). `proxy.p` is the scrubbed 0..1 of the pinned section.
      let stageW = 1
      let centres = []
      let stops = [0]
      let x = 0
      const proxy = { p: 0 }
      const HOLD = 0.27 // share of each move spent parked on a stop (both ends)
      const measure = () => {
        stageW = stageEl.clientWidth
        const dist = Math.max(0, trackEl.scrollWidth - stageW)
        centres = cards.map((c) => c.offsetLeft + c.offsetWidth / 2)
        const s = centres.map((c) => Math.max(-dist, stageW / 2 - c))
        // the closing stop: merge it into the last card's stop when they are close, so the end never stalls
        if (s.length && Math.abs(s[s.length - 1] + dist) < 200) s[s.length - 1] = -dist
        else s.push(-dist)
        stops = s
      }
      const stopPos = (p) => {
        const k = stops.length - 1
        if (k <= 0) return 0
        const s = Math.min(k, Math.max(0, p * k))
        const i = Math.min(k - 1, Math.floor(s))
        const f = s - i
        const u = Math.min(1, Math.max(0, (f - HOLD) / (1 - 2 * HOLD)))
        return i + u * u * (3 - 2 * u)
      }
      // the stage is "on" once the section has reached the top of the viewport (sticky engaged)
      const stageOn = () => section.getBoundingClientRect().top < window.innerHeight * 0.18
      const sync = () => {
        let best = 0
        let bd = Infinity
        for (let i = 0; i < centres.length; i++) {
          const d = Math.abs(centres[i] + x - stageW / 2)
          if (d < bd) {
            bd = d
            best = i
          }
        }
        setIndex(best)
        if (!stageOn()) return
        // a card smashes down while it slides in, so it lands as it reaches the centre of the stage
        for (let i = 0; i < cards.length; i++) if (centres[i] + x < stageW * 0.8) fire(cards[i])
      }
      const apply = () => {
        const pos = stopPos(proxy.p)
        const i = Math.min(stops.length - 1, Math.floor(pos))
        const j = Math.min(stops.length - 1, i + 1)
        x = stops[i] + (stops[j] - stops[i]) * (pos - i)
        gsap.set(trackEl, { x })
        setProgress(n > 1 ? Math.min(1, pos / (n - 1)) : 1)
        sync()
      }
      measure()
      const tw = gsap.to(proxy, {
        p: 1,
        ease: 'none',
        onUpdate: apply,
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.8,
          onRefresh: () => {
            measure()
            apply()
          },
        },
      })
      // also check while the stage is arriving (before the scrub starts moving the track)
      const arrive = ScrollTrigger.create({ trigger: section, start: 'top 20%', end: 'bottom bottom', onUpdate: sync, onEnter: sync })
      apply()
      // keyboard: tabbing into a card that is off stage must not scroll the clipped stage sideways (the browser
      // would); instead scroll the page to that card's stop so it slides in like it does on scroll
      const onFocus = (e) => {
        stageEl.scrollLeft = 0
        const li = e.target.closest?.('.pj-card')
        const st = tw.scrollTrigger
        if (!li || !st) return
        const i = cards.indexOf(li)
        const k = stops.length - 1
        if (i < 0 || k <= 0) return
        const y = st.start + (st.end - st.start) * (Math.min(i, k) / k)
        const lenis = getLenis()
        if (lenis) lenis.scrollTo(y, REDUCED() ? { immediate: true } : { duration: 0.9 })
        else window.scrollTo({ top: y, behavior: REDUCED() ? 'auto' : 'smooth' })
      }
      trackEl.addEventListener('focusin', onFocus)
      return () => {
        trackEl.removeEventListener('focusin', onFocus)
        tw.scrollTrigger?.kill()
        tw.kill()
        arrive.kill()
        gsap.set(trackEl, { clearProps: 'transform' })
      }
    })
    mm.add('(max-width: 960px)', () => {
      gsap.set(trackEl, { clearProps: 'transform' })
      const triggers = cards.map((c, i) =>
        ScrollTrigger.create({
          trigger: c,
          start: 'top 72%',
          end: 'bottom 30%',
          onEnter: () => fire(c),
          onEnterBack: () => fire(c),
          onLeave: () => fire(c),
          onToggle: (self) => {
            if (!self.isActive) return
            setIndex(i)
            setProgress(n > 1 ? i / (n - 1) : 1)
          },
        }),
      )
      setProgress(0)
      setIndex(0)
      return () => triggers.forEach((t) => t.kill())
    })

    // re-measure when the page height settles (fonts, lazy siblings)
    let dead = false
    let timer = 0
    const refresh = () => {
      if (dead) return
      measureSections()
      updateSectionProgress()
      ScrollTrigger.refresh()
    }
    const settleSoon = () => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 160)
    }
    const raf = requestAnimationFrame(refresh)
    const t1 = setTimeout(refresh, 900)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settleSoon)
    const host = section.parentElement
    let lastH = host ? host.offsetHeight : 0
    const ro =
      host && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            const h = host.offsetHeight
            if (Math.abs(h - lastH) < 2) return
            lastH = h
            settleSoon()
          })
        : null
    ro?.observe(host)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      clearTimeout(t1)
      clearTimeout(timer)
      ro?.disconnect()
      running.forEach((tl) => tl.kill())
      mm.revert()
    }
  }, [n])

  // cards already on stage when the page goes live (e.g. a deep scroll before arrival) smash now
  useEffect(() => {
    if (!live) return
    const id = setTimeout(() => ScrollTrigger.refresh(), 700)
    return () => clearTimeout(id)
  }, [live])

  // ---------------------------------------------------------------- title: lamp-strike once
  useEffect(() => {
    const el = title.current
    if (!el || REDUCED()) return
    gsap.set(el, { opacity: 0 })
    const st = ScrollTrigger.create({
      trigger: root.current,
      start: 'top 55%',
      once: true,
      onEnter: () => {
        lampStrike(el)
        gsap.fromTo(root.current.querySelectorAll('[data-head-in]'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: 'power4.out', delay: 0.2 })
      },
    })
    return () => st.kill()
  }, [])

  // ---------------------------------------------------------------- holographic tilt (3D machine follows)
  useEffect(() => {
    const trackEl = track.current
    if (!trackEl || window.matchMedia('(pointer: coarse)').matches) return
    const holos = Array.from(trackEl.querySelectorAll('.pj-holo'))
    const offs = holos.map((card) => {
      const onMove = (e) => {
        const r = card.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        const ry = (px - 0.5) * 10
        const rx = -(py - 0.5) * 7
        card.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
        card.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
        card.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        card.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
        gamma.hover = { id: card.dataset.id, rx, ry }
      }
      const onLeave = () => {
        card.style.setProperty('--rx', '0deg')
        card.style.setProperty('--ry', '0deg')
        if (gamma.hover && gamma.hover.id === card.dataset.id) gamma.hover = null
      }
      card.addEventListener('pointermove', onMove, { passive: true })
      card.addEventListener('pointerleave', onLeave)
      return () => {
        card.removeEventListener('pointermove', onMove)
        card.removeEventListener('pointerleave', onLeave)
      }
    })
    return () => {
      offs.forEach((f) => f())
      gamma.hover = null
    }
  }, [])

  // ---------------------------------------------------------------- SMASH button: replay the machine's beat
  const statusTimers = useRef(new WeakMap())
  const replay = (id, li) => {
    gamma.runBeat = { id, t: performance.now() }
    if (!li) return
    const r = li.getBoundingClientRect()
    requestSmash({ sx: r.left + r.width / 2, sy: Math.min(window.innerHeight - 8, r.bottom - 6), power: 0.42 })
    const rig = li.querySelector('.pj-rig')
    if (!REDUCED()) {
      gsap.fromTo(rig, { scaleY: 0.96, scaleX: 1.02, transformOrigin: '50% 100%' }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)', clearProps: 'transform' })
      crackFlash(li.querySelector('.pj-card-cracks'))
      dustBurst(li.querySelector('.pj-dust'), 0.6)
    }
    const slot = li.querySelector('.pj-machine')
    if (slot) {
      slot.classList.remove('is-firing')
      void slot.offsetWidth
      slot.classList.add('is-firing')
    }
    const status = li.querySelector('[data-type="status"]')
    if (!status || !li.classList.contains('is-landed')) return
    typeText(status, 'SMASH!', 0.2)
    statusTimers.current.get(status)?.kill()
    statusTimers.current.set(
      status,
      gsap.delayedCall(1.3, () => typeText(status, 'LIVE', 0.3)),
    )
  }

  return (
    <section ref={root} className="section pj-lineup" data-section="projects-lineup" aria-labelledby="pj-lineup-title" style={{ '--pj-n': n }}>
      <div ref={stage} className="pj-lineup-stage">
        <header className="pj-lineup-head">
          <div className="pj-lineup-head-l">
            <span className="pj-tag" data-head-in>
              The lineup <span>· {n} systems</span>
            </span>
            <h2 ref={title} id="pj-lineup-title" className="pj-lineup-title">
              Smashed into <span className="hl">production</span>
            </h2>
            <p className="pj-lineup-lede" data-head-in>
              Developed and maintained for daily enterprise use. Each card lands with its real number, drawn as a working machine.
            </p>
          </div>
          <div ref={hud} className="pj-hud" data-head-in data-copilot="LINEUP">
            <span className="pj-hud-label">
              <i aria-hidden="true" />
              System
            </span>
            <div className="pj-hud-row">
              <svg className="pj-hud-hex" viewBox="0 0 48 48" aria-hidden="true">
                <polygon className="pj-hud-hex-track" points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5" />
                <polygon className="pj-hud-hex-fill" points="24,3 42,13.5 42,34.5 24,45 6,34.5 6,13.5" pathLength="100" />
                <polygon className="pj-hud-hex-spin" points="24,12 34,18 34,30 24,36 14,30 14,18" />
              </svg>
              <span className="pj-hud-value" aria-live="polite" aria-atomic="true">
                <span className="visually-hidden">Project </span>
                <span ref={hudCur} className="pj-hud-cur">
                  01
                </span>
                <span className="pj-hud-sep">/</span>
                <span className="pj-hud-total">{pad(n)}</span>
              </span>
            </div>
            <span className="pj-hud-bar" aria-hidden="true">
              {projects.map((p, i) => (
                <i key={p.id} style={{ '--i': i }} />
              ))}
            </span>
            <span className="pj-hud-hint">Scroll to smash</span>
          </div>
        </header>

        <div className="pj-viewport">
          <ul ref={track} className="pj-track" aria-label="Projects">
            {projects.map((p, i) => {
              const metric = parseMetric(p.metric.value)
              return (
                <li key={p.id} className="pj-card" data-id={p.id} data-i={i}>
                  <div className="pj-rig">
                    <article className="holo-card pj-holo" data-interactive="" data-id={p.id} aria-labelledby={`pj-name-${p.id}`}>
                      <span className="holo-edge" aria-hidden="true" />
                      <span className="pj-impact" aria-hidden="true" />
                      <svg className="pj-card-cracks" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {cracks[i].map((c, k) => (
                          <path key={k} d={c.d} style={{ '--w': c.w }} vectorEffect="non-scaling-stroke" />
                        ))}
                      </svg>

                      <div
                        className="pj-machine"
                        data-anchor={`pj-machine-${p.id}`}
                        data-cursor="SMASH"
                        onClick={(e) => replay(p.id, e.currentTarget.closest('.pj-card'))}
                      >
                        <span className="pj-machine-frame" aria-hidden="true">
                          <i />
                        </span>
                        <span className="pj-machine-scan" aria-hidden="true" />
                        <p className="pj-machine-twin">
                          <span className="visually-hidden">
                            Machine {pad(i + 1)}: {MACHINE_LABELS[p.id]}
                          </span>
                          <span aria-hidden="true">
                            <b>γ{pad(i + 1)}</b>
                            <span data-type="twin" data-text={MACHINE_LABELS[p.id]}>
                              {MACHINE_LABELS[p.id]}
                            </span>
                          </span>
                        </p>
                        <span className="pj-machine-status" aria-hidden="true">
                          <i />
                          <span data-type="status">DORMANT</span>
                        </span>
                        <button
                          type="button"
                          className="pj-run"
                          aria-label={`Smash the ${p.name} machine again`}
                          onClick={(e) => {
                            e.stopPropagation()
                            replay(p.id, e.currentTarget.closest('.pj-card'))
                          }}
                        >
                          <span className="pj-run-dot" aria-hidden="true" />
                          Smash <span className="visually-hidden">{SHORT[p.id]}</span>
                        </button>
                      </div>

                      <div className="pj-body">
                        <div className="pj-meta" data-card-in>
                          <span className="pj-index" aria-hidden="true">
                            {pad(i + 1)}
                          </span>
                          <span className="pj-kind">
                            <b>{p.kind}</b> {KIND_LABELS[p.kind] || p.kind}
                          </span>
                        </div>
                        <h3 id={`pj-name-${p.id}`} className="pj-name" data-card-in>
                          {p.name}
                        </h3>
                        <p className="pj-desc" data-card-in>
                          {p.description}
                        </p>
                        <ul className="pj-stack" aria-label={`${p.name} stack`}>
                          {p.stack.map((s, k) => (
                            <li className="chip" key={s} style={{ '--k': k + i }}>
                              {s}
                            </li>
                          ))}
                        </ul>
                        <div className="pj-foot" data-card-in>
                          <div className="pj-metric">
                            <strong className="pj-metric-value">
                              {metric ? (
                                <span data-count={metric.n} data-suffix={metric.suffix}>
                                  0{metric.suffix}
                                </span>
                              ) : (
                                p.metric.value
                              )}
                            </strong>
                            <span className="pj-metric-label">{p.metric.label}</span>
                          </div>
                          <span className="chip pj-chip-honest">Internal · Enterprise</span>
                        </div>
                      </div>
                    </article>
                  </div>
                  <div className="pj-dust" aria-hidden="true">
                    {Array.from({ length: 9 }, (_, k) => (
                      <i key={`p${k}`} className="pj-puff" />
                    ))}
                    {Array.from({ length: 10 }, (_, k) => (
                      <i key={`c${k}`} className="pj-chip" />
                    ))}
                  </div>
                </li>
              )
            })}

            <li className="pj-end">
              <span className="pj-end-emblem" aria-hidden="true">
                <Emblem id="gamma" size={88} />
              </span>
              <span className="pj-end-kicker">End of lineup</span>
              <strong>
                No demos.
                <br />
                <span className="hl">Just proof.</span>
              </strong>
              <p>Internal enterprise software runs behind the company firewall. The machines are the evidence: every count on them is the real number.</p>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
