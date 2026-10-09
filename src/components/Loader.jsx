import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useProgress } from '@react-three/drei'
import { profile } from '../data/resume'
import { dissolveElements } from '../utils/dust'

// "Studio intro": a flip-book of panels races past in red, a frame counter climbs, then the title lockup
// slams in with a light sweep and the whole thing wipes away to reveal the hero.
const PANELS = [
  'IRON MAN', 'ASP.NET CORE', 'CAPTAIN AMERICA', 'C#', 'THOR', 'SQL SERVER', 'BLACK WIDOW', 'REST APIs', 'HULK',
  '5 LIVE PORTALS', 'DOCTOR STRANGE', '1,000+ EMPLOYEES', 'IRON MAN', 'HANGFIRE', 'CAPTAIN AMERICA', 'CLAUDE',
  'THOR', 'ENTITY FRAMEWORK', 'BLACK WIDOW', 'WINDSURF', 'HULK', 'MVC', 'DOCTOR STRANGE', 'ASSEMBLE',
]

export default function Loader({ onDone }) {
  const root = useRef(null)
  const counter = useRef(null)
  const [gone, setGone] = useState(false)
  const { progress, active } = useProgress()
  const progressRef = useRef(0)
  progressRef.current = progress

  useEffect(() => {
    const el = root.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const panels = el.querySelectorAll('.ld-panel')
    const strips = el.querySelectorAll('.ld-strip')
    const title = el.querySelectorAll('.ld-title .ld-word')
    const sub = el.querySelector('.ld-sub')
    const sweep = el.querySelector('.ld-sweep')
    const frame = el.querySelector('.ld-frame')
    const num = { v: 0 }
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

    if (reduced) {
      tl.set(title, { yPercent: 0, opacity: 1 }).to(el, { opacity: 0, duration: 0.4, delay: 0.6, onComplete: finish })
      return () => tl.kill()
    }

    // 1. counter + panel flip-book (2.6s)
    tl.to(num, {
      v: 100,
      duration: 3.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        // never show more than real asset progress + a cinematic floor
        const shown = Math.max(Math.min(num.v, Math.max(progressRef.current, num.v * 0.9)), num.v * 0.6)
        if (counter.current) counter.current.textContent = String(Math.round(shown)).padStart(3, '0')
      },
    }, 0)
    tl.fromTo(
      panels,
      { xPercent: 140, rotateY: 35, scale: 1.15 },
      { xPercent: -140, rotateY: -35, scale: 0.9, duration: 1.1, ease: 'none', stagger: { each: 0.085, from: 'start' } },
      0.15,
    )
    tl.fromTo(panels, { opacity: 0 }, { opacity: 1, duration: 0.12, ease: 'none', stagger: { each: 0.085, from: 'start' } }, 0.15)
    tl.to(panels, { opacity: 0, duration: 0.2, stagger: 0.02 }, 2.2)
    // 2. red strips collapse into the frame
    tl.fromTo(strips, { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: 'expo.inOut', stagger: { each: 0.03, from: 'center' } }, 2.25)
    tl.fromTo(frame, { scale: 1.3, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 2.55)
    // 3. title lockup slams in
    tl.fromTo(title, { yPercent: 120, rotateX: -50 }, { yPercent: 0, rotateX: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12 }, 2.65)
    tl.fromTo(sub, { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.32em', duration: 0.9 }, 3.0)
    tl.fromTo(sweep, { xPercent: -120 }, { xPercent: 120, duration: 1.1, ease: 'power2.inOut' }, 3.05)
    // 4. hold, then wipe away (waits for real assets)
    tl.add(() => {
      const wait = () => {
        if (progressRef.current >= 100 || !active) reveal()
        else setTimeout(wait, 80)
      }
      wait()
    }, 4.2)

    function reveal() {
      // the title crumbles into dust and drifts away, then the red curtain lifts
      const words = Array.from(title)
      gsap.set(words, { opacity: 0 })
      gsap.to([sub, frame], { opacity: 0, duration: 0.5, ease: 'power2.in' })
      dissolveElements(words, { duration: 1.5, step: 3, resolveAt: 0.55 }).then(() => {
        gsap.timeline({ onComplete: finish }).to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut' })
      })
    }
    function finish() {
      setGone(true)
      onDone?.()
    }
    return () => tl.kill()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (gone) return null
  return (
    <div ref={root} className="ld" role="status" aria-label="Loading portfolio">
      <div className="ld-strips" aria-hidden="true">
        {Array.from({ length: 14 }).map((_, i) => (
          <span className="ld-strip" key={i} />
        ))}
      </div>
      <div className="ld-panels" aria-hidden="true">
        {PANELS.map((p, i) => (
          <div className="ld-panel" key={i} style={{ '--i': i }}>
            <span className="ld-panel-text">{p}</span>
            <span className="ld-panel-num">{String(i + 1).padStart(2, '0')}</span>
          </div>
        ))}
      </div>
      <div className="ld-frame" aria-hidden="true" />
      <div className="ld-lockup">
        <h1 className="ld-title display" aria-label={profile.name}>
          <span className="ld-line"><span className="ld-word">AKIL</span></span>
          <span className="ld-line"><span className="ld-word">PRABHU</span></span>
        </h1>
        <p className="ld-sub">A SOFTWARE ENGINEER · SEVEN-PAGE TRIBUTE</p>
        <span className="ld-sweep" aria-hidden="true" />
      </div>
      <div className="ld-counter mono" aria-hidden="true">
        <span ref={counter}>000</span>
        <span className="ld-counter-label">LOADING ASSETS</span>
      </div>
    </div>
  )
}
