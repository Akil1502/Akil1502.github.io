import { Fragment, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Splits text into lines (array of strings) or chars and animates each on scroll.
// <SplitText as="h2" lines={['Enterprise', 'Systems']} mode="lines" />
// <SplitText as="p" text="..." mode="words" />
export default function SplitText({
  as: Tag = 'div',
  lines,
  text,
  mode = 'lines', // 'lines' | 'words' | 'chars'
  className = '',
  delay = 0,
  stagger,
  start = 'top 85%',
  rotate = true,
  ...rest
}) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll('.st-item')
    if (!items.length) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const st = stagger ?? (mode === 'chars' ? 0.028 : mode === 'words' ? 0.04 : 0.12)
    // Title-card slam: each piece drops in from a blurred, oversized state and snaps sharp with a short overshoot.
    gsap.set(items, {
      yPercent: mode === 'lines' ? 70 : 40,
      scale: mode === 'chars' ? 2.2 : mode === 'lines' ? 1.12 : 1.35,
      rotateX: rotate ? -30 : 0,
      opacity: 0,
      filter: 'blur(14px)',
      transformOrigin: '50% 100%',
    })
    const tween = gsap.to(items, {
      yPercent: 0,
      scale: 1,
      rotateX: 0,
      opacity: 1,
      filter: 'blur(0px)',
      duration: mode === 'chars' ? 0.7 : 1.15,
      delay,
      stagger: st,
      ease: mode === 'chars' ? 'back.out(2.2)' : 'expo.out',
      scrollTrigger: { trigger: el, start, once: true },
      onComplete: () => gsap.set(items, { clearProps: 'filter' }),
    })
    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let content
  if (mode === 'lines') {
    // The {' '} between block lines collapses visually but keeps words separate for screen readers and textContent.
    content = (lines || [text]).map((l, i) => (
      <Fragment key={i}>
        {i > 0 ? ' ' : null}
        <span className="st-line" style={{ display: 'block', overflow: 'visible', paddingBottom: '0.08em', marginBottom: '-0.08em' }}>
          <span className="st-item" style={{ display: 'block', willChange: 'transform' }}>
            {l}
          </span>
        </span>
      </Fragment>
    ))
  } else {
    const str = text ?? (lines || []).join(' ')
    const parts = mode === 'words' ? str.split(' ') : Array.from(str)
    content = parts.map((p, i) => (
      <span key={i} style={{ display: 'inline-block', overflow: mode === 'chars' ? 'visible' : 'hidden', whiteSpace: 'pre' }}>
        <span className="st-item" style={{ display: 'inline-block', willChange: 'transform' }}>
          {p}
          {mode === 'words' && i < parts.length - 1 ? ' ' : ''}
        </span>
      </span>
    ))
  }
  return (
    <Tag ref={ref} className={className} style={{ perspective: '900px' }} {...rest}>
      {content}
    </Tag>
  )
}
