import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import SplitText from '../../components/SplitText'
import Magnetic from '../../components/Magnetic'
import NextPage from '../../components/NextPage'
import HeroLink from '../../transition/HeroLink'
import { useReveal } from '../../hooks/useReveal'
import { profile } from '../../data/resume'
import { STONES, CORE_COUNT, AI_COUNT, CONCEPTS, AI_NOTE, runePath, ROMAN, pad2 } from './runes'
import { storm, callStrike, setFeature, setHover, onFeature, resetStorm } from './stormBus'
import './skills.css'

gsap.registerPlugin(ScrollTrigger)

// SKILLS — THOR. The DOM is the source of truth for every skill (10 core, 3 AI tools with the AI note, 5 concepts);
// the storm in SkillsScene is its twin. Beats: the storm (hero) -> the core runes -> the summoning (AI) -> the laws
// of the forge (concepts) -> worthy (finale slam) -> next mission.
//
// LIGHTNING STRIKE (signature): every rune card that scrolls in, or is hovered / clicked, queues a strike from the
// hammer to its runestone (stormBus.callStrike). When the bolt lands the scene calls storm.flash(power): the DOM
// white flash (~80 ms, rate-limited to stay under three flashes a second) plus the struck card's electric pulse.

const CORE = STONES.slice(0, CORE_COUNT)
const AI = STONES.slice(CORE_COUNT, CORE_COUNT + AI_COUNT)
const AI_COPILOT = ['CLAUDE', 'WINDSURF', 'PROMPTS']
const LAMP = [0, 0.7, 0.15, 1, 0.4, 1]
const RUNE_NAME = (k) => k.charAt(0).toUpperCase() + k.slice(1)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function RuneGlyph({ rune, className = '' }) {
  return (
    <svg className={`sk-glyph ${className}`} viewBox="-1.5 -1.5 13 19" aria-hidden="true">
      <path d={runePath(rune)} />
    </svg>
  )
}

// a little jagged bolt used as decoration on cards and notes
function BoltMark({ className = '' }) {
  return (
    <svg className={`sk-boltmark ${className}`} viewBox="0 0 24 40" aria-hidden="true">
      <path d="M15 1 4 22h7l-3 17 13-24h-7l4-14z" />
    </svg>
  )
}

// One group's ASSEMBLE arrival (adapted from the old Arsenal): each [data-assemble] item launches from its own
// scattered offset / tumble in a shuffled order and snaps into place with a back-out overshoot.
function groupBeat(group, { start = 'top 85%', spread = 1, onLand } = {}) {
  const items = Array.from(group.querySelectorAll('[data-assemble]'))
  if (!items.length || reducedMotion()) return () => {}
  const R = gsap.utils.random
  const reach = Math.min(240, window.innerWidth * 0.22) * spread
  const EACH = 0.06
  const DUR = 0.9
  const BACK = 1.6
  const order = gsap.utils.shuffle(items.map((_, i) => i))
  const delays = new Array(items.length)
  order.forEach((itemIndex, slot) => (delays[itemIndex] = slot * EACH))
  const stagger = (i) => delays[i] ?? 0
  gsap.set(items, {
    opacity: 0,
    x: () => R(-reach, reach),
    y: () => R(0.4, 1) * reach,
    rotation: () => R(-18, 18),
    rotationX: () => R(-60, 60),
    rotationY: () => R(-70, 70),
    scale: () => R(0.5, 0.75),
    filter: 'blur(6px)',
    transformPerspective: 800,
  })
  const tl = gsap.timeline({ scrollTrigger: { trigger: group, start, once: true } })
  tl.to(items, { x: 0, y: 0, rotation: 0, rotationX: 0, rotationY: 0, scale: 1, duration: DUR, ease: `back.out(${BACK})`, stagger }, 0)
  tl.to(items, { opacity: 1, filter: 'blur(0px)', duration: DUR * 0.45, ease: 'power2.out', stagger, clearProps: 'filter' }, 0)
  const last = Math.max(...delays)
  tl.set(items, { clearProps: 'transform,opacity' }, last + DUR + 0.05)
  tl.call(() => onLand?.(group), null, last + DUR / (BACK + 1))
  return () => {
    tl.scrollTrigger?.kill()
    tl.kill()
  }
}

// Skill card (core runes + AI tools share it). Hover / focus features its stone; click (or Enter) calls a strike.
function RuneCard({ stone, index, gold = false, copilot }) {
  const last = useRef(0)
  const strike = (power) => {
    const now = performance.now()
    if (now - last.current < 450) return
    last.current = now
    callStrike(index, power)
  }
  const enter = (e) => {
    setHover(index)
    // a finger that lands on a card while scrolling should not call the storm; taps still do (onClick)
    if (e?.pointerType !== 'touch') strike(0.7)
  }
  const leave = () => {
    if (storm.hover === index) setHover(-1)
  }
  return (
    <li className={`sk-card ${gold ? 'is-gold' : ''}`} data-stone={index} data-assemble>
      <button
        type="button"
        className="sk-card-btn"
        aria-label={`${stone.name}, ${stone.kind}${stone.note ? `. ${stone.note}` : ''}. Calls a lightning strike`}
        data-cursor="STRIKE"
        data-copilot={copilot}
        onPointerEnter={enter}
        onPointerLeave={leave}
        onFocus={enter}
        onBlur={leave}
        onClick={() => {
          last.current = 0
          strike(1)
        }}
      >
        <span className="sk-card-glyph">
          <RuneGlyph rune={stone.rune} />
        </span>
        <span className="sk-card-body">
          <span className="sk-card-meta">
            <b>{pad2(index + 1)}</b>
            <span aria-hidden="true">{RUNE_NAME(stone.rune)}</span>
            <span className="sk-card-kind">{stone.kind}</span>
          </span>
          <span className="sk-card-name">{stone.name}</span>
          {stone.note ? <span className="sk-card-note">{stone.note}</span> : null}
        </span>
        <BoltMark className="sk-card-bolt" />
      </button>
    </li>
  )
}

// HUD lock-on readout for the featured stone (decorative twin of the card list, hidden from screen readers).
function RuneLock() {
  const [i, setI] = useState(0)
  const box = useRef(null)
  useEffect(
    () =>
      onFeature((n) => {
        if (n < 0 || n >= STONES.length) return
        setI(n)
        const b = box.current
        if (!b) return
        b.classList.remove('is-switch')
        void b.offsetWidth
        b.classList.add('is-switch')
      }),
    [],
  )
  const s = STONES[i]
  return (
    <div ref={box} className={`sk-lock ${s.ai ? 'is-gold' : ''}`} data-copilot="RUNE LOCK">
      <span className="sk-lock-corners" />
      <div className="sk-lock-row">
        <span className="sk-lock-label">Rune lock</span>
        <span className="sk-lock-idx">
          {pad2(i + 1)} / {pad2(STONES.length)}
        </span>
      </div>
      <div className="sk-lock-main">
        <RuneGlyph rune={s.rune} className="sk-lock-glyph" />
        <div>
          <strong className="sk-lock-name">{s.name}</strong>
          <span className="sk-lock-sub">
            {RUNE_NAME(s.rune)} · {s.kind}
          </span>
        </div>
      </div>
      <div className="sk-lock-row">
        <span className="sk-lock-label">Stone</span>
        <span className="sk-lock-bar">
          <i />
        </span>
        <span className="sk-lock-label">Struck</span>
      </div>
    </div>
  )
}

export default function SkillsPage({ ready = true }) {
  const root = useRef(null)
  const flash = useRef(null)
  const headCallout = useRef(null)
  const gripCallout = useRef(null)
  const chargeVal = useRef(null)
  const heroRef = useReveal({ selector: '[data-reveal]', y: 26, stagger: 0.1, start: 'top 90%', delay: 0.35 })
  const coreHead = useReveal({ selector: '[data-reveal]', y: 24, stagger: 0.1, start: 'top 80%' })
  const aiHead = useReveal({ selector: '[data-reveal]', y: 24, stagger: 0.1, start: 'top 78%' })
  const lawsHead = useReveal({ selector: '[data-reveal]', y: 24, stagger: 0.1, start: 'top 80%' })
  const finale = useReveal({ selector: '[data-reveal]', y: 30, stagger: 0.12, start: 'top 70%' })

  // bus lifecycle
  useEffect(() => {
    resetStorm()
    return () => {
      resetStorm()
      storm.flash = null
    }
  }, [])

  // the DOM half of every strike: white flash (~80 ms, at most ~3 / s) + the struck card's electric pulse
  useEffect(() => {
    const el = flash.current
    const host = root.current
    if (!el || !host) return
    const reduced = reducedMotion()
    let lastFlash = 0
    const timers = new Map()
    storm.flash = (power = 1) => {
      const i = storm.lastStrike
      const card = i >= 0 ? host.querySelector(`.sk-card[data-stone="${i}"]`) : null
      if (card) {
        card.classList.remove('is-struck')
        void card.offsetWidth
        card.classList.add('is-struck')
        clearTimeout(timers.get(card))
        timers.set(
          card,
          setTimeout(() => card.classList.remove('is-struck'), 900),
        )
      }
      if (reduced) return
      const now = performance.now()
      if (now - lastFlash < 340) return
      lastFlash = now
      gsap.killTweensOf(el)
      gsap.fromTo(el, { opacity: Math.min(0.62, 0.16 + power * 0.3) }, { opacity: 0, duration: 0.08 + power * 0.1, ease: 'power2.in' })
    }
    return () => {
      timers.forEach((t) => clearTimeout(t))
      if (storm.flash) storm.flash = null
    }
  }, [])

  // HUD LOCK-ON on the card list: the featured stone's card wears the targeting brackets
  useEffect(() => {
    const host = root.current
    if (!host) return
    let last = null
    return onFeature((i) => {
      const card = i >= 0 ? host.querySelector(`.sk-card[data-stone="${i}"]`) : null
      if (card === last) return
      last?.classList.remove('is-target')
      card?.classList.add('is-target')
      last = card
    })
  }, [])

  // LAMP STRIKE: Cinzel chapter kickers flicker on as they arrive
  useEffect(() => {
    const host = root.current
    if (!host || !ready) return
    const els = Array.from(host.querySelectorAll('[data-lamp]'))
    if (reducedMotion()) {
      els.forEach((e) => e.classList.add('is-lit'))
      return
    }
    const tweens = els.map((e) =>
      gsap.fromTo(
        e,
        { opacity: 0 },
        {
          keyframes: { opacity: LAMP, easeEach: 'none' },
          duration: 0.7,
          ease: 'none',
          scrollTrigger: { trigger: e, start: 'top 88%', once: true },
          onComplete: () => e.classList.add('is-lit'),
        },
      ),
    )
    return () =>
      tweens.forEach((tw) => {
        tw.scrollTrigger?.kill()
        tw.kill()
      })
  }, [ready])

  // ASSEMBLE the three groups; every core / AI card that scrolls in calls its strike and features its stone
  useLayoutEffect(() => {
    const host = root.current
    if (!host || !ready) return
    const kills = []
    const runes = host.querySelector('.sk-runes')
    const ai = host.querySelector('.sk-ai-cards')
    const laws = host.querySelector('.sk-laws')
    if (runes) kills.push(groupBeat(runes, { start: 'top 82%', spread: 0.8 }))
    if (ai) kills.push(groupBeat(ai, { start: 'top 84%', spread: 0.9 }))
    if (laws) kills.push(groupBeat(laws, { start: 'top 88%', spread: 0.7, onLand: () => callStrike(-1, 0.9) }))
    const sts = Array.from(host.querySelectorAll('.sk-card[data-stone]')).map((card) => {
      const i = parseInt(card.dataset.stone, 10)
      return ScrollTrigger.create({
        trigger: card,
        start: 'top 72%',
        onEnter: () => {
          setFeature(i)
          callStrike(i, 0.85)
        },
        onEnterBack: () => setFeature(i),
      })
    })
    return () => {
      kills.forEach((k) => k())
      sts.forEach((s) => s.kill())
    }
  }, [ready])

  // HUD LOCK-ON callouts that track the hammer head + grip (projected by the scene), live charge readout
  useEffect(() => {
    const hc = headCallout.current
    const gc = gripCallout.current
    const cv = chargeVal.current
    if (!hc || !gc) return
    let raf
    let shown = -1
    let lastVis = ''
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const s = storm.screen
      const vis = s && s.ok ? Math.max(0, Math.min(1, (1.05 - (s.stage ?? 0)) / 0.3)) : 0
      const o = vis.toFixed(3)
      // write only on change: past the hero this loop idles without touching the DOM
      if (o !== lastVis) {
        lastVis = o
        hc.style.opacity = gc.style.opacity = o
      }
      if (!s || vis <= 0) return
      hc.style.transform = `translate3d(${s.hx.toFixed(1)}px, ${s.hy.toFixed(1)}px, 0)`
      gc.style.transform = `translate3d(${s.gx.toFixed(1)}px, ${s.gy.toFixed(1)}px, 0)`
      const c = Math.round(storm.charge * 100)
      if (cv && c !== shown) {
        shown = c
        cv.textContent = `${c}%`
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div ref={root} className="page page-skills">
      <div ref={flash} className="sk-flash" aria-hidden="true" />

      {/* ============ I · THE STORM ============ */}
      <section ref={heroRef} className="section sk-hero" data-section="skills-hero">
        <div className="sk-hero-copy">
          <p className="sk-eyebrow" data-reveal>
            <span className="sk-eyebrow-dot" /> 03 · Skills — God of Thunder
          </p>
          <p className="sk-kicker hero-title" data-lamp>
            <span>I</span> The Storm
          </p>
          <SplitText key={ready ? 'live' : 'wait'} as="h1" className="statement sk-statement" lines={['Forged in ', <span className="hl">production.</span>]} start="top 95%" />
          <p className="sk-lede" data-reveal>
            Ten core technologies, three AI tools and five principles: the working kit of a {profile.title.toLowerCase()} shipping across 5 live enterprise portals.
          </p>
          <ul className="sk-tally" data-reveal aria-label="Skill counts">
            <li>
              <b>{pad2(CORE_COUNT)}</b>
              <span>Core runes</span>
            </li>
            <li>
              <b>{pad2(AI_COUNT)}</b>
              <span>AI tools</span>
            </li>
            <li>
              <b>{pad2(CONCEPTS.length)}</b>
              <span>Principles</span>
            </li>
          </ul>
          <p className="sk-hint" data-reveal>
            <BoltMark />
            <span>
              <span className="sk-hint-fine">Click</span>
              <span className="sk-hint-touch">Tap</span> the open sky to call the lightning
            </span>
          </p>
        </div>

        <figure className="quote-card sk-quote" data-reveal>
          <blockquote>“A tool is only worthy once it ships. These are the ones I reach for, every day.”</blockquote>
          <cite>
            {profile.name} <b>Storm log · 03</b>
          </cite>
        </figure>

        <div className="sk-scroll" aria-hidden="true">
          <span className="sk-scroll-line" /> Raise the hammer
        </div>
      </section>

      {/* hammer-tracking HUD callouts (decorative) */}
      <div className="sk-callouts" aria-hidden="true">
        <div ref={headCallout} className="sk-callout sk-callout-head">
          <i className="sk-callout-dot" />
          <span className="sk-callout-leader" />
          <span className="sk-callout-tag">
            <em>Head // rune-cut steel</em>
            <span>
              Charge <b ref={chargeVal}>35%</b>
            </span>
          </span>
        </div>
        <div ref={gripCallout} className="sk-callout sk-callout-grip">
          <i className="sk-callout-dot" />
          <span className="sk-callout-leader" />
          <span className="sk-callout-tag">
            <em>Grip // leather wrap</em>
            <span>
              Strap <b>locked</b>
            </span>
          </span>
        </div>
      </div>

      {/* ============ II · THE CORE RUNES ============ */}
      <section className="section sk-core" data-section="skills-core">
        <div className="sk-core-grid">
          <div className="sk-core-copy">
            <header ref={coreHead} className="sk-head">
              <p className="sk-kicker hero-title" data-lamp>
                <span>II</span> The Core Runes
              </p>
              <SplitText as="h2" className="statement sk-statement" lines={['Ten runes, ', <span className="hl">one stack.</span>]} start="top 80%" />
              <p className="sk-lede" data-reveal>
                C# and .NET at the heart, SQL Server beneath, Razor, JavaScript and Bootstrap on the surface. Every rune that rises calls its own strike; hover one to call it again.
              </p>
            </header>
            <h3 className="sk-group-title" data-reveal>
              <span>01</span> Core stack <i>{pad2(CORE_COUNT)} runes</i>
            </h3>
            <ol className="sk-runes">
              {CORE.map((s, i) => (
                <RuneCard key={s.name} stone={s} index={i} />
              ))}
            </ol>
          </div>
          <aside className="sk-lock-col" aria-hidden="true">
            <div className="sk-lock-sticky">
              <RuneLock />
            </div>
          </aside>
        </div>
      </section>

      {/* ============ III · THE SUMMONING ============ */}
      <section className="section sk-ai" data-section="skills-ai">
        <div className="sk-ai-grid">
          <div className="sk-ai-stage" aria-hidden="true">
            <span className="sk-ai-tag">Summoning // sky link open</span>
          </div>
          <div ref={aiHead} className="sk-ai-copy">
            <p className="sk-kicker hero-title" data-lamp>
              <span>III</span> The Summoning
            </p>
            <SplitText as="h2" className="statement sk-statement" lines={['Summoned ', <span className="hl">with AI.</span>]} start="top 80%" />
            <h3 className="sk-group-title" data-reveal>
              <span>02</span> AI tools <i>{pad2(AI_COUNT)} tools</i>
            </h3>
            <p className="sk-note" data-reveal>
              <BoltMark />
              {AI_NOTE}
            </p>
            <ol className="sk-ai-cards">
              {AI.map((s, j) => (
                <RuneCard key={s.name} stone={s} index={CORE_COUNT + j} gold copilot={AI_COPILOT[j]} />
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ============ IV · THE LAWS ============ */}
      <section className="section sk-laws-sec" data-section="skills-concepts">
        <div ref={lawsHead} className="sk-laws-head">
          <p className="sk-kicker hero-title" data-lamp>
            <span>IV</span> The Laws
          </p>
          <SplitText as="h2" className="statement sk-statement" lines={['Laws of ', <span className="hl">the forge.</span>]} start="top 80%" />
          <h3 className="sk-group-title" data-reveal>
            <span>03</span> Concepts <i>{pad2(CONCEPTS.length)} principles</i>
          </h3>
          <p className="sk-lede" data-reveal>
            The principles I build by, from how objects are shaped to the SQL jobs that run in the background with no one at the controls.
          </p>
        </div>
        <ol className="sk-laws">
          {CONCEPTS.map((c, j) => (
            <li key={c.name} className="sk-law" data-assemble>
              <span className="sk-law-n" aria-hidden="true">
                {ROMAN[j]}
              </span>
              <RuneGlyph rune={c.rune} className="sk-law-glyph" />
              <span className="sk-law-name">{c.name}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ============ V · WORTHY ============ */}
      <section ref={finale} className="section sk-finale" data-section="skills-finale">
        <div className="sk-finale-inner">
          <p className="sk-kicker hero-title" data-lamp>
            <span>V</span> Worthy
          </p>
          <SplitText as="h2" className="statement sk-statement sk-finale-title" lines={['Worthy of ', <span className="hl">the work.</span>]} start="top 75%" />
          <p className="sk-lede sk-finale-lede" data-reveal>
            Every rune lit, every stone awake. Next: the missions where these tools were put to work.
          </p>
          <p className="sk-finale-sum" data-reveal>
            <span>{CORE_COUNT} core runes</span>
            <span>{AI_COUNT} AI tools</span>
            <span>{CONCEPTS.length} principles</span>
            <span>{profile.livePortals} live portals</span>
          </p>
          <div className="sk-cta" data-reveal>
            <Magnetic>
              <HeroLink to="projects" className="btn btn-primary" data-cursor="SHIP" data-copilot="SEE THEM SHIP">
                See them in production <span className="arrow">→</span>
              </HeroLink>
            </Magnetic>
            <Magnetic>
              <a className="btn btn-gold" href="/Akil-Prabhu-Resume.pdf" download data-cursor="PDF">
                Résumé PDF <span className="arrow">↓</span>
              </a>
            </Magnetic>
          </div>
        </div>
      </section>

      <NextPage current="skills" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
