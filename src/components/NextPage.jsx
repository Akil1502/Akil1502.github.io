import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import HeroLink from '../transition/HeroLink'
import Emblem from './Emblem'
import { nextPage, PAGES } from '../data/heroes'
import { prefetchPage } from '../pages/registry'

gsap.registerPlugin(ScrollTrigger)

// The end-of-page "next mission" call to action. Every page ends with one. It prefetches the next page as soon as
// it scrolls into view, and its hero name + emblem are painted in the NEXT hero's colours.
export default function NextPage({ current }) {
  const nxt = nextPage(current)
  const root = useRef(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const st = ScrollTrigger.create({
      trigger: el,
      start: 'top 95%',
      once: true,
      onEnter: () => prefetchPage(nxt.id),
    })
    const tween = gsap.fromTo(
      el.querySelectorAll('[data-np]'),
      { y: 60, opacity: 0, scale: 0.94, filter: 'blur(10px)' },
      { y: 0, opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 80%', once: true } },
    )
    return () => {
      st.kill()
      tween.scrollTrigger?.kill()
      tween.kill()
    }
  }, [nxt.id])
  const isLoop = nxt.id === PAGES[0].id
  const style = {
    '--np-a': nxt.theme.primary,
    '--np-b': nxt.theme.accent,
    '--np-c': nxt.theme.accent2,
    '--np-font': nxt.theme.heroFont,
    '--np-len': Math.max(6, nxt.label.length),
  }
  return (
    <section ref={root} className="next-page" style={style} data-section={`${current}-next`}>
      <HeroLink to={nxt.id} className="np-link" data-cursor={isLoop ? 'AGAIN' : 'NEXT'} data-copilot={`NEXT · ${nxt.label.toUpperCase()}`}>
        <span className="np-kicker" data-np>
          {isLoop ? 'Back to the beginning' : 'Next mission'} <span className="np-rule" />
        </span>
        <div className="np-row" data-np>
          <span className="np-emblem">
            <Emblem id={nxt.emblem} size={96} />
          </span>
          <div className="np-text">
            <h2 className="np-hero">{nxt.label}</h2>
            <span className="np-label">
              {isLoop ? 'Start again' : `Section ${String(PAGES.indexOf(nxt) + 1).padStart(2, '0')} / ${String(PAGES.length).padStart(2, '0')}`} <span className="np-arrow">→</span>
            </span>
          </div>
        </div>
        <span className="np-blurb" data-np>
          {nxt.blurb}
        </span>
      </HeroLink>
    </section>
  )
}
