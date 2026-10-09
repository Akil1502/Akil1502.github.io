import gsap from 'gsap'
import { initXp } from './signals'

/* DECRYPT — the page's signature text move.
   armDecrypt(el) lays the element's text out as three inline spans:
     [resolved text][scrambled glyph window][redacted rest]
   The redacted rest keeps the REAL characters (transparent, on an inline black bar with box-decoration-break: clone),
   so the bars wrap line by line exactly like the final text and nothing reflows when it resolves. play() sweeps the
   glyph window left → right; on completion the element's original markup (highlighted numbers etc.) is restored
   exactly. Screen readers always get the real text: the redacted rest holds it and the glyph window is aria-hidden.

   Guarantees (a reader must never be left looking at glyphs):
   - render(1) shows the full real text, and completion swaps the untouched original nodes back in;
   - kill() / finish() restore the original nodes immediately (unmount, or an element already scrolled past);
   - `speed` compresses a run when its trigger fired late (jump, fast fling, restored scroll position). */

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&*+=<>/\\[]{}'
const rndGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]

export function armDecrypt(el, { redact = true, win = 8 } = {}) {
  // Keep the ORIGINAL child nodes (React owns them) and put the very same nodes back on restore, so React's
  // references stay valid; the animation only ever swaps in its own three spans.
  const originals = Array.from(el.childNodes)
  const text = el.textContent
  let tween = null
  let armed = false
  const done = document.createElement('span')
  const front = document.createElement('span')
  const rest = document.createElement('span')
  done.className = 'dc-done'
  front.className = 'dc-front'
  rest.className = redact ? 'dc-rest' : 'dc-plain'
  front.setAttribute('aria-hidden', 'true')

  const arm = () => {
    if (armed) return
    armed = true
    done.textContent = ''
    front.textContent = ''
    rest.textContent = text
    el.replaceChildren(done, front, rest)
    el.classList.add('is-armed')
  }

  const restore = () => {
    if (!armed) return
    armed = false
    el.replaceChildren(...originals)
    el.classList.remove('is-armed', 'is-decrypting')
  }

  const render = (p) => {
    const n = Math.floor(p * (text.length + win))
    const a = Math.min(text.length, Math.max(0, n - win))
    const b = Math.min(text.length, n)
    done.textContent = text.slice(0, a)
    let s = ''
    for (let i = a; i < b; i++) {
      const c = text[i]
      s += c === ' ' || c === '\n' ? c : rndGlyph()
    }
    front.textContent = s
    rest.textContent = text.slice(b)
  }

  if (redact) arm()

  const baseDuration = Math.min(1.6, Math.max(0.5, 0.32 + text.length * 0.0085))

  return {
    el,
    text,
    baseDuration,
    play({ duration, delay = 0, speed = 1, onStart, onComplete } = {}) {
      tween?.kill()
      const o = { p: 0 }
      const dur = (duration ?? baseDuration) / Math.max(0.1, speed)
      tween = gsap.to(o, {
        p: 1,
        duration: dur,
        delay,
        ease: 'none',
        onStart: () => {
          arm()
          el.classList.add('is-decrypting')
          onStart?.()
        },
        onUpdate: () => render(o.p),
        onComplete: () => {
          tween = null
          restore()
          onComplete?.()
        },
      })
      return tween
    },
    isArmed: () => armed,
    isRunning: () => !!tween && tween.isActive(),
    restore,
    kill() {
      tween?.kill()
      tween = null
      restore()
    },
  }
}

/* Sequential DECRYPT queue. Items join as they scroll into view and start no closer than `stagger` seconds apart
   (divided by the item's speed), so a burst — a jump, a fast fling, a whole sheet already on screen — still reads
   as a top→bottom cascade instead of everything scrambling at once. Items pushed before `open()` wait for it (e.g.
   until the sheet holding them has landed). `onItemStart(item, speed, meta)` fires as each item begins; `onDrain`
   fires once all `expected` items have resolved. While items run, xp.decrypting keeps the batons crackling. */
export function decryptQueue({ stagger = 0.18, expected = 0, onItemStart, onDrain } = {}) {
  let isOpen = false
  let openAt = 0
  let nextAt = 0
  let done = 0
  let lastSpeed = 1
  const waiting = []
  const finishOne = () => {
    done++
    if (done === expected) onDrain?.(lastSpeed)
  }
  const run = (d, speed, meta) => {
    const now = gsap.ticker.time
    const at = Math.max(now, nextAt, openAt)
    nextAt = at + stagger / speed
    lastSpeed = speed
    if (!d.isArmed()) {
      // already readable (never armed / restored): nothing to animate
      finishOne()
      return
    }
    d.play({
      speed,
      delay: at - now,
      onStart: () => {
        initXp().decrypting++
        onItemStart?.(d, speed, meta)
      },
      onComplete: () => {
        const x = initXp()
        x.decrypting = Math.max(0, x.decrypting - 1)
        finishOne()
      },
    })
  }
  return {
    push(d, speed = 1, meta) {
      if (!d) return finishOne()
      if (isOpen) run(d, speed, meta)
      else waiting.push([d, speed, meta])
    },
    open(delay = 0, speed = 1) {
      if (isOpen) return
      isOpen = true
      openAt = gsap.ticker.time + delay / Math.max(0.1, speed)
      waiting.splice(0).forEach((a) => run(...a))
    },
  }
}
