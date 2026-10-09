import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { experience, profile } from '../../data/resume'
import SplitText from '../../components/SplitText'
import Magnetic from '../../components/Magnetic'
import NextPage from '../../components/NextPage'
import { isTransitioning } from '../../transition/controller'
import { scroll } from '../../three/scrollStore'
import { initXp, clearXp, flare, impact, nowSec } from './signals'
import { armDecrypt, decryptQueue } from './decrypt'
import './experience.css'

gsap.registerPlugin(ScrollTrigger)

/* 04 · EXPERIENCE — BLACK WIDOW ("Red Ledger").
   DOM is the source of truth and the choreographer; the 3D layer (ExperienceScene) answers through scroll.xp
   (contract in ./signals.js). Beats:
     HERO (pinned)  title SLAM + lamp strike, lede DECRYPT, emblem ASSEMBLE → IMPACT; scrolling the pin charges the
                    batons (HUD readout) and fires a full discharge at 100 %; the readout fades as the pin releases
     DOSSIER        "CLASSIFIED" stamp slams, a laser scan sweeps the sheet, every field DECRYPTS as it scrolls in,
                    the stamp flips to "DECLASSIFIED" with an impact; the emblem turns over to the left
     FILES 01 · 02  each mission file lands on the ledger rail (node shockwave + impact), its dates slam, role and
                    company decrypt; every log entry DECRYPTS as it scrolls in while the red laser follows the decrypt
                    front down the log; then the loadout chips ASSEMBLE; the batons discharge on every file
     OUTRO          "Still on duty." + decrypted status line + CTAs
   Every once-trigger measures how late it fired (lateSpeed): a jump or a fast fling compresses the beat so text is
   never left scrambled under the reader, and anything already scrolled past resolves almost instantly. */

const pad2 = (n) => String(n).padStart(2, '0')
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const sstep = (a, b, v) => {
  const k = clamp01((v - a) / (b - a))
  return k * k * (3 - 2 * k)
}

// Wraps the résumé's numbers ("5", "1,000+", "3") in a highlight span.
function highlightNumbers(text) {
  return text.split(/(\d[\d,]*\+?)/g).map((p, i) =>
    /^\d[\d,]*\+?$/.test(p) ? (
      <b className="xp-num" key={i}>
        {p}
      </b>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

// How late a once-trigger fired. 1 when reached by normal scrolling; faster when the visitor jumped or flung past
// the start (anchor jump, fast fling, restored scroll position); near-instant when the element is already above
// the viewport (nobody is watching it resolve, it just has to be readable when they scroll back).
function lateSpeed(self, el) {
  const r = el.getBoundingClientRect()
  if (r.bottom < 0) return 40
  const over = Math.max(0, self.scroll() - self.start)
  return 1 + Math.min(1.5, over / window.innerHeight) * 4
}

// HUD readout typing in behind a block caret (full text restored exactly on completion).
function typeIn(el, { delay = 0, speed = 0.028 } = {}) {
  const full = el.dataset.text || el.textContent
  el.dataset.text = full
  const o = { n: 0 }
  return gsap.to(o, {
    n: full.length,
    duration: Math.min(1, 0.12 + full.length * speed),
    delay,
    ease: 'none',
    onStart: () => {
      el.textContent = ''
      el.classList.add('is-typing')
    },
    onUpdate: () => {
      el.textContent = full.slice(0, Math.round(o.n))
    },
    onComplete: () => {
      el.textContent = full
      el.classList.remove('is-typing')
    },
  })
}

// Count-up for [data-count] (the markup ships the real final value, which is also what it ends on).
function countUp(el, { duration = 1.5, delay = 0 } = {}) {
  const target = parseFloat(el.dataset.count)
  const suffix = el.dataset.suffix || ''
  const final = target.toLocaleString('en-US') + suffix
  const o = { v: 0 }
  el.textContent = '0' + suffix
  return gsap.to(o, {
    v: target,
    duration,
    delay,
    ease: 'power3.out',
    onUpdate: () => {
      el.textContent = Math.round(o.v).toLocaleString('en-US') + suffix
    },
    onComplete: () => {
      el.textContent = final
    },
  })
}

// A DECRYPT run over a small group (all start together, staggered); keeps xp.decrypting up while it runs.
function decryptAll(list, { stagger = 0.14, delay = 0, speed = 1, onComplete } = {}) {
  let left = list.length
  if (!left) {
    onComplete?.()
    return []
  }
  initXp().decrypting++
  return list.map((d, i) =>
    d.play({
      speed,
      delay: (delay + i * stagger) / speed,
      onComplete: () => {
        left--
        if (left === 0) {
          const x = initXp()
          x.decrypting = Math.max(0, x.decrypting - 1)
          onComplete?.()
        }
      },
    }),
  )
}

const QUOTE =
  'Quiet precision: REST APIs, tuned SQL and steady production fixes across 5 live enterprise portals, built to team standards.'

export default function ExperiencePage({ ready }) {
  const root = useRef(null)
  const decrypts = useRef(new Map()) // element -> decrypt controller
  const charge = useRef(null)
  const accessNum = useRef(null)

  // Arm everything before paint: redacted text, hidden intro pieces (unless reduced motion).
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const x = initXp(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      x.intro = nowSec() - 10
      el.classList.add('is-reduced')
      return () => clearXp()
    }
    el.querySelectorAll('[data-decrypt]').forEach((n) => decrypts.current.set(n, armDecrypt(n)))
    gsap.set(el.querySelectorAll('.xp-hero [data-intro]'), { opacity: 0 })
    const map = decrypts.current
    return () => {
      map.forEach((d) => d.kill())
      map.clear()
      clearXp()
    }
  }, [])

  /* ---------------------------------------------------------------- intro (after the loader / transition) */
  useEffect(() => {
    const el = root.current
    if (!el || !ready || el.classList.contains('is-reduced')) return
    let raf = 0
    let timer = 0
    let tl = null
    let cancelled = false
    const play = () => {
      if (cancelled) return
      initXp().intro = nowSec() // the 3D emblem assembles from this stamp
      const hero = el.querySelector('.xp-hero')
      const kicker = hero.querySelector('.xp-kicker [data-type]')
      const lines = hero.querySelectorAll('.xp-statement .xp-line > span')
      const hl = hero.querySelector('.xp-statement .hl')
      const lede = hero.querySelector('.xp-lede')
      const meta = hero.querySelectorAll('.xp-hero-meta, .xp-cue')
      const quote = hero.querySelector('.xp-quote')
      const tags = hero.querySelectorAll('.xp-tag')
      gsap.set(hero.querySelectorAll('[data-intro]'), { opacity: 1 })
      tl = gsap.timeline()
      tl.add(typeIn(kicker), 0.05)
        .fromTo(
          lines,
          { yPercent: 70, scale: 1.3, rotateX: -32, opacity: 0, filter: 'blur(16px)' },
          { yPercent: 0, scale: 1, rotateX: 0, opacity: 1, filter: 'blur(0px)', duration: 1.15, stagger: 0.15, ease: 'expo.out', clearProps: 'filter' },
          0.2,
        )
        // LAMP STRIKE on the red line
        .fromTo(hl, { opacity: 0 }, { keyframes: { opacity: [0, 0.7, 0.15, 1, 0.4, 1] }, duration: 0.7, ease: 'none' }, 0.5)
        // DECRYPT #1: the lede resolves while the batons discharge
        .add(() => {
          const d = decrypts.current.get(lede)
          if (d) decryptAll([d])
          flare(0.6)
        }, 0.85)
        .fromTo(meta, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.1, ease: 'power3.out' }, 1.05)
        .fromTo(quote, { opacity: 0, x: -70, rotateY: 14, filter: 'blur(10px)' }, { opacity: 1, x: 0, rotateY: 0, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out', clearProps: 'filter' }, 1.25)
        .fromTo(tags, { opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1, duration: 0.55, stagger: 0.14, ease: 'back.out(3)' }, 1.95)
    }
    const wait = () => {
      if (cancelled) return
      if (!isTransitioning()) timer = setTimeout(play, 140)
      else raf = requestAnimationFrame(wait)
    }
    wait()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      tl?.kill()
    }
  }, [ready])

  /* ---------------------------------------------------------------- scroll choreography */
  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = el.classList.contains('is-reduced')
    const fine = !window.matchMedia('(pointer: coarse)').matches
    const D = (n) => decrypts.current.get(n)
    const offs = [] // listener removers
    const listen = (node, type, fn, opts) => {
      node.addEventListener(type, fn, opts)
      offs.push(() => node.removeEventListener(type, fn, opts))
    }

    const ctx = gsap.context(() => {
      /* HERO pin: charge the batons; full discharge at 100 %; the copy hands over to the access readout, which
         itself fades and lifts away as the pin releases (it must never ride up under the nav / HUD labels). */
      const hero = el.querySelector('.xp-hero')
      const outEls = Array.from(hero.querySelectorAll('.xp-hero-copy, .xp-quote-wrap, .xp-tags'))
      const access = hero.querySelector('.xp-access')
      // exit fade window (px scrolled after the pin releases): measured from where the readout sits, so it is gone
      // well before its top could ride up into the nav / HUD band (it is mostly faded by the time it passes ~1/3 vh).
      let fadeEnd = 360
      let fadeStart = 108
      const measureAccess = () => {
        fadeEnd = Math.max(90, access.offsetTop - 210)
        fadeStart = fadeEnd * 0.3
      }
      const handOver = (p, exitPx) => {
        if (reduced) return
        const o = sstep(0.5, 0.74, p)
        outEls.forEach((n, k) => {
          const ok = clamp01(o * 1.15 - k * 0.07)
          n.style.opacity = String(1 - ok)
          n.style.transform = ok > 0 ? `translate3d(0, ${(-70 * ok).toFixed(1)}px, 0)` : ''
          n.style.filter = ok > 0.01 ? `blur(${(8 * ok).toFixed(1)}px)` : ''
        })
        const inA = sstep(0.7, 0.94, p)
        const outA = sstep(fadeStart, fadeEnd, exitPx)
        const a = inA * (1 - outA)
        access.style.opacity = String(a)
        access.style.transform = `translate3d(0, ${(50 * (1 - inA) - 60 * outA).toFixed(1)}px, 0)`
        access.style.filter = a < 0.99 ? `blur(${(10 * (1 - a)).toFixed(1)}px)` : ''
      }

      let discharged = false
      let pinDist = Math.max(1, hero.offsetHeight - window.innerHeight)
      measureAccess()
      const onHero = (self) => {
        const y = self.scroll() - self.start
        const p = clamp01(y / pinDist)
        const pct = String(Math.round(30 + p * 70)).padStart(3, '0')
        if (charge.current) charge.current.textContent = `${pct}%`
        if (accessNum.current) accessNum.current.textContent = pct
        hero.style.setProperty('--charge', (0.3 + p * 0.7).toFixed(3))
        handOver(p, y - pinDist)
        if (p > 0.92 && !discharged) {
          discharged = true
          hero.classList.add('is-charged')
          if (!reduced && self.getVelocity() < 4000) {
            flare(1)
            impact(0.35)
          }
        } else if (p < 0.5 && discharged) {
          discharged = false
          hero.classList.remove('is-charged')
        }
      }
      ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom 40%', // pin (hero height − 1 vh) + 0.6 vh of exit
        onRefresh: (self) => {
          pinDist = Math.max(1, hero.offsetHeight - window.innerHeight)
          measureAccess()
          onHero(self)
        },
        onUpdate: onHero,
      })

      /* DOSSIER: sheet lands → stamp slam → scan → each field decrypts as it enters → DECLASSIFIED */
      const dossier = el.querySelector('.xp-dossier')
      const sheet = dossier.querySelector('.xp-dossier-sheet')
      const stamp = dossier.querySelector('.xp-dossier-file > .xp-stamp')
      const scan = sheet.querySelector('.xp-scan')
      const fields = Array.from(sheet.querySelectorAll('[data-decrypt]'))
      const intel = dossier.querySelectorAll('.xp-intel li')
      if (reduced) {
        stamp.textContent = 'Declassified'
        stamp.classList.add('is-open')
      } else {
        gsap.set([sheet, intel], { opacity: 0, y: 40 })
        gsap.set(stamp, { opacity: 0 })
        const declassify = (sp) => {
          gsap
            .timeline()
            .to(stamp, { scale: 1.25, opacity: 0, duration: 0.18, ease: 'power2.in' })
            .add(() => {
              stamp.textContent = 'Declassified'
              stamp.classList.add('is-open')
            })
            .to(stamp, { scale: 1, opacity: 1, rotate: -6, duration: 0.35, ease: 'back.out(3)' })
            .add(() => sp < 3 && impact(0.3), '-=0.2')
            .timeScale(sp)
        }
        const q = decryptQueue({ stagger: 0.16, expected: fields.length, onDrain: declassify })
        ScrollTrigger.create({
          trigger: sheet,
          start: 'top 78%',
          once: true,
          onEnter: (self) => {
            const sp = lateSpeed(self, sheet)
            const tl = gsap.timeline()
            tl.to(sheet, { opacity: 1, y: 0, duration: 0.9, ease: 'power4.out' })
              .fromTo(stamp, { opacity: 0, scale: 2.4, rotate: -22 }, { opacity: 1, scale: 1, rotate: -8, duration: 0.42, ease: 'power4.in' }, 0.25)
              .add(() => sp < 3 && impact(0.22), 0.67)
              .fromTo(scan, { top: '0%', opacity: 1 }, { top: '100%', opacity: 0.4, duration: 1.6, ease: 'power1.inOut' }, 0.7)
              .set(scan, { opacity: 0 })
              .add(() => {
                flare(0.8)
                q.open()
              }, 0.75)
              .to(intel, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12, ease: 'power4.out' }, 1.1)
              .add(() => {
                intel.forEach((li, i) => {
                  const b = li.querySelector('[data-count]')
                  if (b) countUp(b, { delay: (i * 0.12) / sp, duration: 1.5 / sp })
                })
              }, 1.1)
            tl.timeScale(sp)
          },
        })
        // (measured while the sheet still carries its 40 px pre-landing offset, hence the eager start)
        fields.forEach((dd) =>
          ScrollTrigger.create({ trigger: dd, start: 'top 97%', once: true, onEnter: (self) => q.push(D(dd), lateSpeed(self, dd)) }),
        )
      }

      /* MISSION FILES */
      const filesWrap = el.querySelector('.xp-files')
      gsap.fromTo(
        filesWrap.querySelector('.xp-rail-fill'),
        { scaleY: 0 },
        { scaleY: 1, ease: 'none', scrollTrigger: { trigger: filesWrap, start: 'top 60%', end: 'bottom 60%', scrub: 0.5 } },
      )
      el.querySelectorAll('.xp-file').forEach((sec, i) => {
        const card = sec.querySelector('.xp-file-card')
        const node = sec.querySelector('.xp-node')
        const tag = sec.querySelector('.xp-file-tag [data-type]')
        const dates = sec.querySelector('.xp-file-dates')
        const head = Array.from(sec.querySelectorAll('.xp-file-head [data-decrypt]'))
        const loc = sec.querySelector('.xp-file-loc')
        const stampF = sec.querySelector('.xp-stamp')
        const fsheet = sec.querySelector('.xp-file-sheet')
        const fscan = fsheet.querySelector('.xp-scan')
        const status = fsheet.querySelector('[data-status]')
        const items = Array.from(fsheet.querySelectorAll('.xp-bullets > li'))
        const bullets = items.map((li) => li.querySelector('[data-decrypt]'))
        const nums = fsheet.querySelectorAll('.xp-bn')
        const chips = fsheet.querySelectorAll('.xp-chip')
        if (reduced) {
          node.classList.add('is-lit')
          status.textContent = 'Verified'
          status.classList.add('is-ok')
          initXp().land[i] = nowSec() - 10
          return
        }
        gsap.set([dates, loc, stampF, fsheet], { opacity: 0 })
        gsap.set(chips, { opacity: 0 })

        // the operations log: entries join the queue as they scroll in; the red laser follows the decrypt front
        const q = decryptQueue({
          stagger: 0.2,
          expected: bullets.length,
          onItemStart: (d, sp, k) => {
            if (!status.classList.contains('is-ok')) status.textContent = 'Decrypting'
            if (k === 0) flare(0.55)
            const li = items[k]
            gsap.to(fscan, {
              top: li.offsetTop + li.offsetHeight + 8,
              opacity: 1,
              duration: (d.baseDuration * 0.85) / sp,
              ease: 'power1.inOut',
              overwrite: 'auto',
            })
          },
          onDrain: (sp) => {
            status.textContent = 'Verified'
            status.classList.add('is-ok')
            flare(0.45)
            // ASSEMBLE the loadout: chips scatter in and snap into the grid
            gsap
              .timeline()
              .to(fscan, { top: '100%', opacity: 0, duration: 0.55, ease: 'power2.in', overwrite: 'auto' })
              .fromTo(
                chips,
                {
                  opacity: 0,
                  x: () => gsap.utils.random(-160, 160),
                  y: () => gsap.utils.random(-70, 90),
                  rotation: () => gsap.utils.random(-50, 50),
                  scale: 0.5,
                },
                { opacity: 1, x: 0, y: 0, rotation: 0, scale: 1, duration: 0.75, ease: 'back.out(1.9)', stagger: { each: 0.05, from: 'random' } },
                0.1,
              )
              .timeScale(sp)
          },
        })

        ScrollTrigger.create({
          trigger: card,
          start: 'top 68%',
          once: true,
          onEnter: (self) => {
            const sp = lateSpeed(self, card)
            const tl = gsap.timeline()
            tl.add(() => {
              node.classList.add('is-lit')
              initXp().land[i] = nowSec()
              flare(1)
            }, 0)
              .add(typeIn(tag), 0)
              .fromTo(
                dates,
                { opacity: 0, scale: 1.4, yPercent: 18, filter: 'blur(14px)' },
                { opacity: 1, scale: 1, yPercent: 0, filter: 'blur(0px)', duration: 0.8, ease: 'expo.out', clearProps: 'filter' },
                0.08,
              )
              .add(() => sp < 3 && impact(0.42), 0.2)
              .add(() => decryptAll(head.map(D).filter(Boolean), { stagger: 0.18, speed: sp }), 0.25)
              .to(loc, { opacity: 1, duration: 0.4 }, 0.6)
              .fromTo(stampF, { opacity: 0, scale: 2.6, rotate: 18 }, { opacity: 1, scale: 1, rotate: 7, duration: 0.4, ease: 'power4.in' }, 0.75)
              .add(() => sp < 3 && stampF.classList.contains('is-live') && impact(0.3), 1.15)
              .fromTo(fsheet, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power4.out' }, 0.45)
              .fromTo(nums, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.12, ease: 'power3.out' }, 0.8)
              .add(() => q.open(), 0.85)
            tl.timeScale(sp)
          },
        })
        items.forEach((li, k) =>
          ScrollTrigger.create({ trigger: li, start: 'top 88%', once: true, onEnter: (self) => q.push(D(bullets[k]), lateSpeed(self, li), k) }),
        )

        // hover: the batons over-charge, a spotlight follows the pointer on the sheet
        if (fine) {
          listen(card, 'pointerenter', () => (initXp().hover = i))
          listen(card, 'pointerleave', () => {
            const x = initXp()
            if (x.hover === i) x.hover = -1
          })
          listen(
            card,
            'pointermove',
            (e) => {
              const r = fsheet.getBoundingClientRect()
              fsheet.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
              fsheet.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
            },
            { passive: true },
          )
        }
      })

      /* OUTRO */
      const outro = el.querySelector('.xp-outro')
      const sub = outro.querySelector('[data-decrypt]')
      const ctas = outro.querySelectorAll('.xp-ctas > *, .xp-outro-meta')
      if (!reduced) {
        gsap.set(ctas, { opacity: 0, y: 30 })
        const title = outro.querySelector('.xp-statement-3')
        ScrollTrigger.create({
          trigger: title, // same trigger as the title SLAM, so the status line always resolves after the title lands
          start: 'top 75%',
          once: true,
          onEnter: (self) => {
            const sp = lateSpeed(self, title)
            flare(0.9)
            const d = D(sub)
            if (d) decryptAll([d], { delay: 0.35, speed: sp, onComplete: () => sp < 3 && impact(0.3) })
            gsap.to(ctas, { opacity: 1, y: 0, duration: 1 / sp, stagger: 0.12 / sp, ease: 'power4.out', delay: 0.6 / sp })
          },
        })
      }
    }, el)

    /* dossier fields re-scramble briefly on hover (micro-interaction, once decrypted) */
    const glitches = new Set()
    if (!reduced && fine) {
      el.querySelectorAll('.xp-fields dd').forEach((dd) => {
        let g = null
        listen(dd, 'pointerenter', () => {
          if (dd.classList.contains('is-armed')) return // still redacted / decrypting
          g = g || armDecrypt(dd, { redact: false, win: 5 })
          g.play({ duration: 0.45 })
          glitches.add(g)
        })
      })
    }
    return () => {
      offs.forEach((off) => off())
      glitches.forEach((g) => g.kill())
      ctx.revert()
      const x = scroll.xp
      if (x) {
        x.hover = -1
        x.decrypting = 0
      }
    }
  }, [])

  const current = experience.find((e) => e.current)
  const first = experience[experience.length - 1]

  return (
    <div ref={root} className="page page-experience">
      {/* ================= HERO (pinned) ================= */}
      <section className="section xp-hero" data-section="experience-hero">
        <div className="xp-hero-pin">
          <div className="xp-hero-copy">
            <p className="xp-kicker" data-intro>
              <i className="xp-dot" aria-hidden="true" />
              <span data-type>Protocol · File 04 · Red Ledger</span>
            </p>
            <h1 className="statement xp-statement" data-intro aria-label="Mission files, declassified.">
              <span className="xp-line">
                <span>Mission files,</span>
              </span>
              <span className="xp-line">
                <span>
                  <span className="hl">declassified.</span>
                </span>
              </span>
            </h1>
            <p className="xp-lede" data-decrypt data-intro>
              Two postings, {first.start} to {current ? 'present' : experience[0].end}. REST APIs, SQL Server and live enterprise portals, built
              in {profile.location}.
            </p>
            <p className="xp-hero-meta" data-intro>
              <span>{profile.title}</span>
              <span>{profile.tagline}</span>
            </p>
            <p className="xp-cue" data-intro>
              <span className="xp-cue-line" aria-hidden="true" /> Scroll to decrypt
            </p>
          </div>

          <div className="xp-quote-wrap">
          <figure className="quote-card xp-quote" data-intro data-copilot="FIELD NOTE" data-interactive="">
            <blockquote>“{QUOTE}”</blockquote>
            <cite>
              <span>{profile.name}</span>
              <b>Field note · Dossier 04</b>
            </cite>
          </figure>
          </div>

          <div className="xp-tags" aria-hidden="true">
            <span className="xp-tag t1" data-intro>
              <i /> Emblem // red glass
            </span>
            <span className="xp-tag t2" data-intro>
              <i /> Tripwire grid // armed
            </span>
            <span className="xp-tag t3" data-intro>
              <i /> Baton charge <b ref={charge}>030%</b>
            </span>
          </div>

          {/* hand-over beat: appears as the hero copy leaves, scrubbed with the baton charge */}
          <div className="xp-access" aria-hidden="true">
            <p className="xp-kicker">
              <i className="xp-dot" /> Access granted · decrypting subject dossier
            </p>
            <p className="xp-access-big">
              <b ref={accessNum}>030</b>
              <span>%</span>
            </p>
            <span className="xp-access-bar">
              <i />
            </span>
            <p className="xp-access-sub">Baton charge · tripwires armed · channel encrypted</p>
          </div>
        </div>
      </section>

      {/* ================= DOSSIER ================= */}
      <section className="section xp-dossier" data-section="experience-dossier">
        <div className="xp-dossier-inner">
          <p className="xp-kicker">
            <i className="xp-dot" aria-hidden="true" /> Subject dossier · Clearance granted
          </p>
          <SplitText
            as="h2"
            className="statement xp-statement-2"
            aria-label="Two years in the field."
            lines={['Two years', <span className="hl">in the field.</span>]}
            start="top 80%"
          />
          <div className="xp-dossier-file">
          <span className="xp-stamp">Classified</span>
          <div className="xp-sheet xp-dossier-sheet" data-copilot="DOSSIER" data-interactive="">
            <div className="xp-sheet-bar">
              <span>Dossier // AP-04</span>
              <span className="xp-sheet-id">Eyes only</span>
            </div>
            <span className="xp-scan" aria-hidden="true" />
            <dl className="xp-fields">
              <div>
                <dt>Subject</dt>
                <dd data-decrypt>{profile.name}</dd>
              </div>
              <div>
                <dt>Designation</dt>
                <dd data-decrypt>{profile.title}</dd>
              </div>
              <div>
                <dt>Current post</dt>
                <dd data-decrypt>{current?.company}</dd>
              </div>
              <div>
                <dt>Base</dt>
                <dd data-decrypt>{profile.location}</dd>
              </div>
              <div>
                <dt>In the field</dt>
                <dd data-decrypt>
                  {profile.yearsExperience} years · since {first.start}
                </dd>
              </div>
              <div>
                <dt>Specialty</dt>
                <dd data-decrypt>{profile.tagline}</dd>
              </div>
            </dl>
          </div>
          </div>
          <ul className="xp-intel">
            <li>
              <b data-count={profile.livePortals}>{profile.livePortals}</b>
              <span>Live enterprise portals</span>
            </li>
            <li>
              <b data-count={profile.employeesServed} data-suffix="+">
                {profile.employeesServed.toLocaleString('en-US')}+
              </b>
              <span>Employees served</span>
            </li>
            <li>
              <b data-count={profile.entities}>{profile.entities}</b>
              <span>Company entities</span>
            </li>
          </ul>
        </div>
      </section>

      {/* ================= MISSION FILES (ledger rail) ================= */}
      <div className="xp-files" data-section="experience-files">
        <div className="xp-files-head">
          <h2 className="xp-kicker xp-files-title">
            <i className="xp-dot" aria-hidden="true" /> Mission files · {pad2(experience.length)} on record
          </h2>
        </div>
        <div className="xp-rail" data-anchor="xp-rail" aria-hidden="true">
          <span className="xp-rail-line" />
          <span className="xp-rail-fill" />
          <span className="xp-rail-cap is-top" />
          <span className="xp-rail-cap is-end" />
          <span className="xp-rail-label is-top">Present</span>
          <span className="xp-rail-label is-end">{first.start}</span>
        </div>
        {experience.map((job, i) => {
          const n = pad2(i + 1)
          return (
            <section key={job.id} className={`section xp-file${job.current ? ' is-current' : ''}`} data-section={`experience-file-${job.id}`}>
              <span className="xp-node" data-anchor={`xp-node-${job.id}`} aria-hidden="true">
                <i />
              </span>
              <article className="xp-file-card" data-interactive="" data-copilot={`FILE ${n}`} data-cursor="DECRYPT" aria-labelledby={`xp-${job.id}-role`}>
                <header className="xp-file-head">
                  <p className="xp-file-tag">
                    <i className="xp-dot" aria-hidden="true" />
                    <span data-type>{`File ${n} / ${pad2(experience.length)} · ${job.current ? 'Active assignment' : 'Archived'}`}</span>
                  </p>
                  <p className="xp-file-dates">
                    <time>{job.start}</time>
                    <span className="xp-dash" aria-hidden="true">
                      —
                    </span>
                    <span className="visually-hidden"> to </span>
                    <time className={job.current ? 'is-present' : ''}>{job.end}</time>
                  </p>
                  <h3 className="xp-file-role" id={`xp-${job.id}-role`} data-decrypt>
                    {job.role}
                  </h3>
                  <p className="xp-file-company" data-decrypt>
                    {job.company}
                  </p>
                  <p className="xp-file-loc">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    <span>{job.location}</span>
                  </p>
                  <span className={`xp-stamp ${job.current ? 'is-live' : 'is-archived'}`}>{job.current ? 'Current role' : 'Archived'}</span>
                </header>

                <div className="xp-sheet xp-file-sheet">
                  <div className="xp-sheet-bar">
                    <span>Operations log // File {n}</span>
                    <span className="xp-sheet-status" data-status>
                      Encrypted
                    </span>
                  </div>
                  <span className="xp-scan" aria-hidden="true" />
                  <span className="xp-spot" aria-hidden="true" />
                  <ol className="xp-bullets" aria-label={`Responsibilities at ${job.company}`}>
                    {job.bullets.map((b, k) => (
                      <li key={k}>
                        <span className="xp-bn" aria-hidden="true">
                          {pad2(k + 1)}
                        </span>
                        <p data-decrypt>{highlightNumbers(b)}</p>
                      </li>
                    ))}
                  </ol>
                  <div className="xp-loadout">
                    <p className="xp-loadout-label">Loadout</p>
                    <ul className="xp-chips" aria-label={`Stack at ${job.company}`}>
                      {job.stack.map((s, k) => (
                        <li key={s} className="xp-chip" style={{ '--i': k }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            </section>
          )
        })}
      </div>

      {/* ================= OUTRO ================= */}
      <section className="section xp-outro" data-section="experience-outro">
        <div className="xp-outro-inner">
          <p className="xp-kicker">
            Status · Active <i className="xp-dot" aria-hidden="true" />
          </p>
          <SplitText
            as="h2"
            className="statement xp-statement-3"
            aria-label="Still on duty."
            lines={['Still', <span className="hl">on duty.</span>]}
            start="top 75%"
          />
          <p className="xp-outro-sub" data-decrypt>
            {current?.role} at {current?.company} since {current?.start}. Let's build something together.
          </p>
          <div className="xp-ctas">
            <Magnetic>
              <a className="btn btn-primary" href="/Akil-Prabhu-Resume.pdf" download data-cursor="PDF" data-copilot="FULL DOSSIER">
                Request the full dossier <span className="arrow">↓</span>
              </a>
            </Magnetic>
            <Magnetic>
              <a className="btn btn-ghost" href={`mailto:${profile.email}`} data-cursor="MAIL">
                Open a channel <span className="arrow">→</span>
              </a>
            </Magnetic>
          </div>
          <p className="xp-outro-meta">
            <span>{profile.email}</span>
            <span>{profile.location}</span>
          </p>
        </div>
      </section>

      <NextPage current="experience" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
