// The seven pages of the site. Each page is themed after one hero of the team (a fan tribute — all artwork is
// original and procedural, no official logos or imagery). This file is the single source of truth for routing,
// theming (CSS variables are applied from `theme` on every route change), HUD vocabulary and transitions.

export const PAGES = [
  {
    id: 'home',
    path: '/',
    label: 'Home',
    hero: 'Iron Man',
    codename: 'MARK 85 · HOME',
    emblem: 'reactor',
    blurb: 'Suit up. Name, role and the headline numbers.',
    hud: {
      topLeft: 'TELEMETRY LINK — LIVE',
      topRight: 'ARC REACTOR',
      meter: 92.4,
      meterUnit: '%',
      bottomLeft: 'SEQ',
      bottomMid: 'SUIT DIAGNOSTIC // ONLINE',
    },
    theme: {
      bg: '#07060a',
      bg2: '#140608',
      primary: '#e8232a', // hot-rod red
      accent: '#f5c04a', // gold titanium
      accent2: '#7fe9ff', // repulsor cyan
      fg: '#f2f0ec',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Bebas Neue', 'Barlow Condensed', sans-serif",
    },
  },
  {
    id: 'about',
    path: '/about',
    label: 'About',
    hero: 'Captain America',
    codename: 'SUPER-SOLDIER FILE · ABOUT',
    emblem: 'shield',
    blurb: 'The origin story. Who I am and what I stand for.',
    hud: {
      topLeft: 'PERSONNEL FILE — CLASSIFIED',
      topRight: 'SHIELD INTEGRITY',
      meter: 100,
      meterUnit: '%',
      bottomLeft: 'FILE',
      bottomMid: 'STRATEGIC RESERVE // CLEARED',
    },
    theme: {
      bg: '#050912',
      bg2: '#0a1530',
      primary: '#c8202f', // flag red
      accent: '#e9edf5', // star white / brushed silver
      accent2: '#3d74ff', // star-spangled blue
      fg: '#f1f4fa',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Saira Stencil One', 'Bebas Neue', sans-serif",
    },
  },
  {
    id: 'skills',
    path: '/skills',
    label: 'Skills',
    hero: 'Thor',
    codename: 'GOD OF THUNDER · SKILLS',
    emblem: 'hammer',
    blurb: 'The arsenal. Every tool worthy of the hammer.',
    hud: {
      topLeft: 'STORM FRONT — INBOUND',
      topRight: 'CHARGE',
      meter: 7.4,
      meterUnit: ' GW',
      bottomLeft: 'STRIKE',
      bottomMid: 'BIFROST LINK // OPEN',
    },
    theme: {
      bg: '#04060c',
      bg2: '#0b1426',
      primary: '#b3151d', // cape red
      accent: '#d9b25c', // asgardian gold
      accent2: '#8fd8ff', // lightning
      fg: '#eef3fb',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Cinzel', 'Bebas Neue', serif",
    },
  },
  {
    id: 'experience',
    path: '/experience',
    label: 'Experience',
    hero: 'Black Widow',
    codename: 'RED LEDGER · EXPERIENCE',
    emblem: 'hourglass',
    blurb: 'Mission files. Where I have operated and what I delivered.',
    hud: {
      topLeft: 'COVERT CHANNEL — ENCRYPTED',
      topRight: 'SIGNAL',
      meter: 98.6,
      meterUnit: '%',
      bottomLeft: 'FILE',
      bottomMid: 'DOSSIER // DECRYPTING',
    },
    theme: {
      bg: '#060507',
      bg2: '#140409',
      primary: '#e0102b', // widow red
      accent: '#ff3b4e',
      accent2: '#a7b0bb', // gunmetal
      fg: '#f2eef0',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Share Tech Mono', 'JetBrains Mono', monospace",
    },
  },
  {
    id: 'projects',
    path: '/projects',
    label: 'Projects',
    hero: 'Hulk',
    codename: 'GAMMA LAB · PROJECTS',
    emblem: 'gamma',
    blurb: 'The heavy lifting. Five enterprise systems, smashed into production.',
    hud: {
      topLeft: 'GAMMA FIELD — UNSTABLE',
      topRight: 'GAMMA',
      meter: 4.8,
      meterUnit: ' kR',
      bottomLeft: 'SMASH',
      bottomMid: 'CONTAINMENT // FAILING',
    },
    theme: {
      bg: '#040805',
      bg2: '#0a170c',
      primary: '#7a3fb0', // torn-trouser purple
      accent: '#7cff4f', // gamma green
      accent2: '#c6ff9e',
      fg: '#eef7ec',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Anton', 'Bebas Neue', sans-serif",
    },
  },
  {
    id: 'certifications',
    path: '/certifications',
    label: 'Certifications',
    hero: 'Doctor Strange',
    codename: 'SANCTUM · CERTIFICATIONS',
    emblem: 'mandala',
    blurb: 'The training. Certifications and education, mastered like spells.',
    hud: {
      topLeft: 'SANCTUM WARD — ACTIVE',
      topRight: 'MYSTIC FLUX',
      meter: 61.8,
      meterUnit: '%',
      bottomLeft: 'SPELL',
      bottomMid: 'ASTRAL PLANE // STABLE',
    },
    theme: {
      bg: '#08050c',
      bg2: '#170a1c',
      primary: '#7b2cbf', // cloak-lining violet
      accent: '#ffa63d', // eldritch orange
      accent2: '#38f29a', // emerald eye
      fg: '#f6efe6',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Cinzel', 'Bebas Neue', serif",
    },
  },
  {
    id: 'contact',
    path: '/contact',
    label: 'Contact',
    hero: 'Avengers',
    codename: 'ASSEMBLE · CONTACT',
    emblem: 'assemble',
    blurb: 'The team is ready. Let us build something together.',
    hud: {
      topLeft: 'ALL CHANNELS — OPEN',
      topRight: 'TEAM READY',
      meter: 7,
      meterUnit: ' / 7',
      bottomLeft: 'CALL',
      bottomMid: 'ASSEMBLY POINT // COIMBATORE',
    },
    theme: {
      bg: '#07060a',
      bg2: '#120609',
      primary: '#e8232a',
      accent: '#f5c04a',
      accent2: '#4fd1ff',
      fg: '#f2f0ec',
      displayFont: "'Inter Tight', 'Bebas Neue', sans-serif",
      heroFont: "'Bebas Neue', 'Barlow Condensed', sans-serif",
    },
  },
]

export const pageById = Object.fromEntries(PAGES.map((p) => [p.id, p]))

export function pageForPath(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/'
  return PAGES.find((p) => p.path === clean) || null
}

export function nextPage(id) {
  const i = PAGES.findIndex((p) => p.id === id)
  return PAGES[(i + 1) % PAGES.length]
}

export function prevPage(id) {
  const i = PAGES.findIndex((p) => p.id === id)
  return PAGES[(i - 1 + PAGES.length) % PAGES.length]
}

// Applies a page theme to :root as CSS variables. Everything in CSS reads these.
export function applyTheme(page) {
  if (typeof document === 'undefined' || !page) return
  const r = document.documentElement.style
  const t = page.theme
  r.setProperty('--bg', t.bg)
  r.setProperty('--bg-2', t.bg2)
  r.setProperty('--primary', t.primary)
  r.setProperty('--accent', t.accent)
  r.setProperty('--accent-2', t.accent2)
  r.setProperty('--fg', t.fg)
  r.setProperty('--font-statement', t.displayFont)
  r.setProperty('--font-hero', t.heroFont)
  document.documentElement.dataset.hero = page.id
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', t.bg)
  document.title = page.id === 'home' ? 'Akil Prabhu · Software Engineer' : `${page.label} · Akil Prabhu`
}
