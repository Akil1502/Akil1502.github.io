// Screenshots one Home centrepiece candidate at its key beats.
// Usage: node scripts/shoot-cp.mjs <cpId> [baseUrl] [--mobile]
// Writes shots/cp-<id>-{1-suitup,2-explode,3-repulsor,4-identity,5-select,close}.png (+ -mobile variants)
// Beat positions are computed from the real section tops, so they land on the same moment for every candidate.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const id = process.argv[2] || 'helmet'
const base = (process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'http://127.0.0.1:5180').replace(/\/$/, '')
const mobile = process.argv.includes('--mobile')
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })
const viewport = mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }
const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile })
const page = await ctx.newPage()
const errors = []
page.on('console', (m) => {
  if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('GL Driver'))) errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

const suffix = mobile ? '-mobile' : ''
await page.goto(`${base}/?tier=high&cp=${id}`, { waitUntil: 'load' })
await page.waitForSelector('.ld', { state: 'detached', timeout: 60000 }).catch(() => errors.push('loader never finished'))
await page.waitForSelector('[data-section="home-select"]', { timeout: 60000 }).catch(() => errors.push('page never mounted'))
// let the suit-up play out (software GL is slow)
await page.waitForTimeout(14000)
await page.screenshot({ path: `shots/cp-${id}-1-suitup${suffix}.png`, timeout: 180000 })
if (!mobile) await page.screenshot({ path: `shots/cp-${id}-close.png`, clip: { x: 700, y: 60, width: 720, height: 720 }, timeout: 180000 })

// beat b = i + f  → scroll to section i top + f * (next.top - section.top)
const beats = [
  ['2-explode', 1.4],
  ['3-repulsor', 2.45],
  ['4-identity', 3.5],
  ['5-select', 4.4],
]
for (const [name, b] of beats) {
  const y = await page.evaluate((b) => {
    const ids = ['home-suitup', 'home-diagnostic', 'home-repulsor', 'home-identity', 'home-select', 'home-next']
    const i = Math.floor(b)
    const f = b - i
    const el = document.querySelector(`[data-section="${ids[i]}"]`)
    const nx = document.querySelector(`[data-section="${ids[i + 1]}"]`) || document.querySelector('.next-page')
    const top = el.getBoundingClientRect().top + window.scrollY
    const end = nx ? nx.getBoundingClientRect().top + window.scrollY : top + el.offsetHeight
    return Math.round(top + f * (end - top))
  }, b)
  await page.evaluate((y) => window.__lenis.scrollTo(y, { immediate: true, force: true }), y)
  await page.waitForTimeout(7000)
  await page.screenshot({ path: `shots/cp-${id}-${name}${suffix}.png`, timeout: 180000 })
}
console.log(`cp=${id}${suffix}: ${errors.length ? errors.length + ' issues\n  ' + [...new Set(errors)].slice(0, 20).join('\n  ') : 'no console errors'}`)
await browser.close()
