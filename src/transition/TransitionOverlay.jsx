import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { registerOverlay } from './controller'
import Emblem from '../components/Emblem'
import { PAGES } from '../data/heroes'

const STRIPS = 9

// Studio-style flip transition. cover(): strips flip shut (staggered from the centre) in the destination hero's
// colours, the hero name slams in with a light sweep and the emblem punches out with a shockwave ring.
// reveal(): name crushes, strips flip open the other way.
export default function TransitionOverlay() {
  const root = useRef(null)
  const name = useRef(null)
  const label = useRef(null)
  const emblemWrap = useRef(null)
  const ring = useRef(null)
  const sweep = useRef(null)

  useEffect(() => {
    const el = root.current
    const strips = el.querySelectorAll('.tr-strip')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const paint = (page) => {
      el.style.setProperty('--tr-a', page.theme.primary)
      el.style.setProperty('--tr-b', page.theme.bg2)
      el.style.setProperty('--tr-c', page.theme.accent)
      el.style.setProperty('--tr-d', page.theme.accent2)
      el.style.setProperty('--tr-font', page.theme.heroFont)
      name.current.textContent = page.hero.toUpperCase()
      label.current.textContent = `${String(PAGES.indexOf(page) + 1).padStart(2, '0')} / ${String(PAGES.length).padStart(2, '0')} — ${page.label.toUpperCase()}`
      emblemWrap.current.dataset.emblem = page.emblem
      emblemWrap.current.querySelectorAll('.tr-emblem').forEach((n) => (n.style.display = n.dataset.id === page.emblem ? 'block' : 'none'))
    }

    const cover = (page) =>
      new Promise((resolve) => {
        paint(page)
        el.classList.add('is-active')
        if (reduced) {
          gsap.set(strips, { rotateY: 0, opacity: 1 })
          gsap.set([name.current, label.current, emblemWrap.current], { opacity: 1, y: 0, scale: 1 })
          setTimeout(resolve, 150)
          return
        }
        const tl = gsap.timeline({ onComplete: resolve })
        tl.set(strips, { rotateY: -92, opacity: 1, transformOrigin: '0% 50%' })
          .set([name.current, label.current], { opacity: 0, yPercent: 60, scale: 1.4, filter: 'blur(12px)' })
          .set(emblemWrap.current, { opacity: 0, scale: 0.2, rotate: -90 })
          .set(ring.current, { scale: 0.2, opacity: 0 })
          .to(strips, { rotateY: 0, duration: 0.5, ease: 'power3.inOut', stagger: { each: 0.035, from: 'center' } })
          .to(emblemWrap.current, { opacity: 1, scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2.4)' }, '-=0.12')
          .to(ring.current, { scale: 3.2, opacity: 0, duration: 0.7, ease: 'expo.out', startAt: { opacity: 0.9 } }, '<0.18')
          .to(name.current, { opacity: 1, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 0.5, ease: 'expo.out' }, '<0.02')
          .to(label.current, { opacity: 1, yPercent: 0, scale: 1, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' }, '<0.08')
          .fromTo(sweep.current, { xPercent: -130 }, { xPercent: 130, duration: 0.6, ease: 'power2.inOut' }, '<')
          .add(() => {
            window.__portfolioImpulse?.(0.5)
          }, '<0.05')
          .to({}, { duration: 0.12 })
      })

    const reveal = () =>
      new Promise((resolve) => {
        if (reduced) {
          el.classList.remove('is-active')
          resolve()
          return
        }
        const tl = gsap.timeline({
          onComplete: () => {
            el.classList.remove('is-active')
            resolve()
          },
        })
        tl.to([name.current, label.current], { opacity: 0, scaleY: 0.2, duration: 0.25, ease: 'power3.in' })
          .to(emblemWrap.current, { opacity: 0, scale: 1.6, duration: 0.3, ease: 'power3.in' }, '<')
          .set(strips, { transformOrigin: '100% 50%' })
          .to(strips, { rotateY: 92, duration: 0.55, ease: 'power3.inOut', stagger: { each: 0.035, from: 'edges' } }, '-=0.05')
      })

    return registerOverlay({ cover, reveal })
  }, [])

  return (
    <div ref={root} className="tr" aria-hidden="true">
      <div className="tr-strips">
        {Array.from({ length: STRIPS }).map((_, i) => (
          <span className="tr-strip" key={i} style={{ '--i': i }} />
        ))}
      </div>
      <div className="tr-center">
        <div ref={emblemWrap} className="tr-emblem-wrap">
          <span ref={ring} className="tr-ring" />
          {PAGES.map((p) => (
            <span key={p.id} className="tr-emblem" data-id={p.emblem}>
              <Emblem id={p.emblem} size={120} />
            </span>
          ))}
        </div>
        <div className="tr-name-wrap">
          <h2 ref={name} className="tr-name">
            HERO
          </h2>
          <span ref={sweep} className="tr-sweep" />
        </div>
        <p ref={label} className="tr-label" />
      </div>
    </div>
  )
}
