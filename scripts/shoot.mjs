// Headless visual check for the multi-page hero site.
// Usage: node scripts/shoot.mjs [baseUrl] [desktop|mobile|both] [pageIds comma list] [stops per page]
// Saves shots/<device>-<page>-<n>.png (n = scroll stop) and shots/transition-*.png; prints console errors.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const mode = process.argv[3] || 'desktop'
const ROUTES = { home: '/', about: '/about', skills: '/skills', experience: '/experience', projects: '/projects', certifications: '/certifications', contact: '/contact' }
const only = (process.argv[4] || Object.keys(ROUTES).join(',')).split(',').filter((k) => ROUTES[k])
const STOPS = parseInt(process.argv[5] || '4', 10)
const transition = process.argv.includes('--transition')
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })

async function run(device, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && !m.text().includes('GL Driver'))) errors.push(`[${m.type()}] ${m.text().slice(0, 300)}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  for (const id of only) {
    const t0 = Date.now()
    await page.goto(base + ROUTES[id] + '?tier=high', { waitUntil: 'load' })
    await page.waitForSelector('.ld', { state: 'detached', timeout: 45000 }).catch(() => errors.push(`[${id}] loader never finished`))
    await page.waitForSelector('.page', { timeout: 60000 }).catch(() => errors.push(`[${id}] page never mounted`))
    await page.waitForTimeout(4000)
    const h = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
    for (let s = 0; s < STOPS; s++) {
      const y = STOPS === 1 ? 0 : Math.round((h * s) / (STOPS - 1))
      await page.evaluate((y) => (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)), y)
      await page.waitForTimeout(s === 0 ? 800 : 3500)
      await page.screenshot({ path: `shots/${device}-${id}-${s}.png`, timeout: 180000 })
    }
    const m = await page.evaluate(() => ({ h: document.documentElement.scrollHeight, overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, hero: document.documentElement.dataset.hero }))
    console.log(`${device} ${id}: ${((Date.now() - t0) / 1000).toFixed(1)}s height=${m.h} overflowX=${m.overflowX} theme=${m.hero}`)
  }
  if (transition && !isMobile) {
    await page.goto(base + '/?tier=high', { waitUntil: 'load' })
    await page.waitForSelector('.ld', { state: 'detached', timeout: 45000 })
    await page.waitForTimeout(2500)
    await page.click('.nav-links [data-hero-link="about"]').catch(() => page.evaluate(() => document.querySelector('[data-hero-link="about"]')?.click()))
    for (const ms of [250, 650, 1100, 2200, 3500]) {
      await page.waitForTimeout(ms === 250 ? 250 : ms - [250, 650, 1100, 2200, 3500][[250, 650, 1100, 2200, 3500].indexOf(ms) - 1])
      await page.screenshot({ path: `shots/transition-${ms}.png`, timeout: 180000 })
    }
    console.log('transition url now:', page.url())
  }
  console.log(errors.length ? `${device}: ${errors.length} issues\n  ` + [...new Set(errors)].slice(0, 30).join('\n  ') : `${device}: no console errors`)
  await ctx.close()
}

if (mode === 'desktop' || mode === 'both') await run('desktop', { width: 1440, height: 900 }, false)
if (mode === 'mobile' || mode === 'both') await run('mobile', { width: 390, height: 844 }, true)
await browser.close()
