# HEROES.md — the design bible for the seven hero pages

The site is a **multi-page fan tribute**: every page is themed after one hero of the team, the way a film
franchise gives every hero their own visual language. It is a personal portfolio for **Akil Prabhu A**
(Software Engineer — ASP.NET Core, C#, SQL Server, REST APIs, AI-assisted development).

## Legal / taste guard-rails (non-negotiable)
- **All artwork is original and procedural** (three.js geometry, shaders, CSS, inline SVG). Never download,
  hot-link, trace or embed official images, film stills, logos, wordmarks, fonts or audio. No web images at all.
- Hero names may be used as page themes (it is a tribute). Do **not** reproduce film dialogue/quotes; write
  original lines about Akil's work. Do not use the studio wordmark, the team "A" logo, or character faces.
- Every page ends with the tribute note (already in the baseline page): *Fan-made tribute · not affiliated with
  or endorsed by Marvel or Disney · all 3D artwork original*.
- **Never invent facts or numbers about Akil.** Only numbers that are in `src/data/resume.js` text may be shown:
  2 years, 5 live portals, 1,000+ employees, 3 entities, ~450 agents, 4–6 modules, 4 modules, 3 modules,
  150–200 recipients, 80% (degree score), dates. The `level` fields in `skills` are NOT résumé facts — never print
  them as numbers/percentages; you may use them only for subtle visual emphasis. No "open to work" claims;
  neutral phrasing like "Let's build something together".
- Decorative HUD fiction (e.g. "ARC REACTOR 92.4%") is fine because it is obviously theme, not a claim.

## The reference (client-supplied video, use as inspiration, do not copy)
Frames: `C:\Users\ADMINI~1\AppData\Local\Temp\claude\D--Portfolio\fe1dcaf5-4d54-4746-9c8a-f60ea7c52c0b\scratchpad\ref\sheet_00.jpg`
and `sheet_01.jpg` (open them with Read). What to take from it:
1. **Cinematic darkness**: near-black stage, one hero object lit dramatically, smoke/haze, embers.
2. **Scroll-scrubbed hero**: the hero object animates frame-by-frame with scroll (we do it live in 3D).
3. **Two-tone statement type**: huge tight grotesk (`.statement`, Inter Tight 800), line 1 white, line 2 in the
   accent colour (`<span class="hl">`). e.g. "Build / with Akil."
4. **HUD micro-labels** at the frame edges (already global: `HudFrame`), thin accent rules, corner brackets.
5. **Glass quote cards** (`.quote-card` in `src/styles/shell.css`) with an attribution line.
6. Sparse composition: lots of negative space, one idea per screen, generous scroll length per beat.

## Shared animation vocabulary ("Avengers-oriented")
- **ASSEMBLE**: things fly in from scattered positions/rotations and snap into formation with overshoot
  (`src/three/primitives/AssembleWord.jsx` shows the pattern for 3D letters).
- **IMPACT**: when something lands: `scroll.impulse = Math.max(scroll.impulse||0, 0.3..0.6)` or
  `window.__portfolioImpulse(0.5)` → camera shake (decays automatically), plus a light flash / shockwave ring.
  Once per beat, never continuous.
- **TITLE SLAM**: `SplitText` (src/components/SplitText.jsx) slams lines/chars in blurred and oversized.
- **LAMP STRIKE**: arrival flicker keyframes `[0, 0.7, 0.15, 1, 0.4, 1]` over 0.7 s on a title or key light.
- **HUD LOCK-ON**: brackets snapping onto targets, typed readouts, scan lines. `data-copilot="LABEL"` on 2–5 key
  elements per page lets the global co-pilot reticle lock on.
- **DUST**: `dissolveElements(els, opts)` from `src/utils/dust.js` crumbles DOM text to particles (one dramatic
  beat max per page, never on content that must stay readable).
- Each hero adds a **signature move** (listed per page below). Use it at least twice on the page.

## Architecture (read the code, this is the contract)
- Routes + themes: `src/data/heroes.js` (PAGES). `applyTheme()` sets `--bg --bg-2 --primary --accent --accent-2
  --fg --font-statement --font-hero` on :root per page, so CSS should use those vars.
- Pages: `src/pages/<id>/<Name>Page.jsx` (DOM) and `src/pages/<id>/<Name>Scene.jsx` (3D, rendered inside the
  single persistent `<Canvas>`), lazy-loaded via `src/pages/registry.js`. Page CSS: `src/pages/<id>/<id>.css`,
  imported by the Page. Page-only 3D parts: `src/pages/<id>/three/*.jsx`.
- DOM root: `<div className="page page-<id>">` with one or more `<section className="section …"
  data-section="<id>-<name>">` (ids must be unique and prefixed with the page id). End with
  `<NextPage current="<id>" />` (except contact) and the tribute note.
- Scroll: Lenis smooth scroll; `scroll` store in `src/three/scrollStore.js`: `scroll.progress` (0..1 of the
  page), `scroll.y`, `scroll.velocity`, `scroll.mouse` (-1..1 smoothed), `scroll.sections['<id>-<name>']`
  `.progress` / `.visible`. Read them in `useFrame`, never in React state per frame.
- Camera: static at (0,0,10), fov 42 (visible height ≈ 7.7 world units at z=0), mouse parallax + shake are
  global. A page may steer the camera by writing `scroll.camOffset = {x,y,z}` and `scroll.camLook = {x,y,z}`
  (smoothed by `CameraRig`), e.g. to dolly in as the page scrolls.
- DOM↔3D placement: `useAnchor('[data-anchor="…"]', 0, { depth, follow })` from `src/three/anchor.js` maps a DOM
  slot to world coords every frame (`{ok,x,y,w,h,inView}`). For the main hero object you may instead pin it to
  the viewport and drive it purely from `scroll.progress` (reference style).
- Global already provided: background colour blend, fog, theme-coloured ember particles, studio env map,
  bloom/vignette/grain/CA postprocessing, HUD frame, nav, transitions, cursor, co-pilot. Don't duplicate them.
- Device tiers: prop `tier` = 'high' | 'medium' | 'low' (mobile). Scale instance counts (100% / 50% / 25%),
  skip expensive shaders on low. 60 fps target on an integrated GPU.
- Reuse is encouraged: copy and adapt code from `src/components/sections/*`, `src/three/sections/*`,
  `src/three/primitives/*` **into your page folder** (do not import from `src/components/sections` or
  `src/three/sections` — those folders will be deleted). Shared primitives in `src/three/primitives/` and shared
  components in `src/components/` (Emblem, SplitText, Magnetic, NextPage, HeroLink) may be imported.
- Fonts available (public/fonts): TTF for drei `<Text>`: `/fonts/BebasNeue-Regular.ttf`, `/fonts/Rajdhani-SemiBold.ttf`,
  `/fonts/Barlow-Medium.ttf`, `/fonts/JetBrainsMono-Medium.ttf`, `/fonts/InterTight-ExtraBold.ttf`,
  `/fonts/Cinzel-ExtraBold.ttf`, `/fonts/SairaStencilOne-Regular.ttf`, `/fonts/Anton-Regular.ttf`,
  `/fonts/ShareTechMono-Regular.ttf`. Typeface JSON for drei `<Text3D>`: `/fonts/BebasNeue.typeface.json`,
  `/fonts/BarlowCondensed-ExtraBold.typeface.json`, `/fonts/InterTight-ExtraBold.typeface.json`,
  `/fonts/Cinzel-ExtraBold.typeface.json`, `/fonts/SairaStencilOne-Regular.typeface.json`, `/fonts/Anton-Regular.typeface.json`.
  CSS families loaded: Bebas Neue, Barlow, Barlow Condensed, Rajdhani, JetBrains Mono, Inter Tight, Cinzel,
  Saira Stencil One, Anton, Share Tech Mono.

## The seven pages

### 01 · HOME — IRON MAN  (`/`, id `home`)
Palette: hot-rod red `#e8232a`, gold titanium `#f5c04a`, repulsor cyan `#7fe9ff` on `#07060a`.
Content: name, title, tagline, location, the four headline numbers (2 yrs · 5 live portals · 1,000+ employees ·
3 entities), résumé download (`/Akil-Prabhu-Resume.pdf`), a "choose a hero" teaser of the 6 other pages
(HeroLink cards). **No photo on this page.**
Centrepiece: an original, stylised **armoured helmet** built procedurally — red shell, gold faceplate (an
ExtrudeGeometry outline bent around a cylinder), glowing slit eyes, panel seams — plus a reactor core below it.
Signature move: **NANOTECH SUIT-UP** — thousands of tiny instanced plates stream out of the reactor core and
crawl over the helmet surface (sample targets with `MeshSurfaceSampler`) until the solid helmet resolves; the
eyes power on with the lamp-strike flicker. Scroll beats (reference-style, pinned stage):
1. "Build / with Akil." + glass quote card + HUD; helmet in smoke, eyes off → on.
2. Faceplate lifts / plates separate (exploded view) with HUD callouts for the four numbers.
3. Repulsor charge: cyan energy builds in the reactor, skill subsystems orbit as labels.
4. "And I am / Akil Prabhu." lockup + CTAs, helmet reassembles and powers up with an impact flash.

### 02 · ABOUT — CAPTAIN AMERICA  (`/about`, id `about`)
Palette: flag red `#c8202f`, star white/silver `#e9edf5`, star-spangled blue `#3d74ff` on navy `#050912`.
Type: hero titles in Saira Stencil One (military stencil), statements in Inter Tight.
Content: the full profile summary, location, current company and role, languages, the journey timeline
(2021 B.Com begins → 2024 graduated (80%) → Oct 2024 Software Developer at Creative Ideas IT Solutions →
Dec 2025 Software Engineer at Bannari Amman Spinning Mills), and principles drawn from the résumé (follows
coding standards · strong team collaborator · committed to continuous growth · AI-assisted engineering).
Optional: Akil's illustrated portrait `/akil-cutout.webp` once, as a "recruit file" photo with a vintage
blue/sepia duotone treatment + "APPROVED" stamp. Use it only if it fits the composition.
Centrepiece: an original **round vibranium-style shield** — LatheGeometry dish, concentric red/silver/red rings
and a blue centre with an extruded silver five-point star, brushed-metal material, rim highlights.
Signature move: **SHIELD THROW** — the shield spins in from off-screen, ricochets between DOM anchor points
(principle cards / timeline nodes) with an impact shake + spark burst on each hit, and returns; scroll drives
its flight path. Extras: red rubber-stamp slams ("CLASSIFIED", "APPROVED") with impact, film-grain newsreel
vignette, light stripes in red/white/blue.

### 03 · SKILLS — THOR  (`/skills`, id `skills`)
Palette: cape red `#b3151d`, Asgardian gold `#d9b25c`, lightning `#8fd8ff` on storm black `#04060c`.
Type: hero titles in Cinzel.
Content: all 10 core skills, the 3 AI tools (with the note: prompt engineering with Claude, Windsurf IDE for
code review and delivery), the 5 concepts. No numeric levels.
Centrepiece: an original **war hammer** — blocky rounded head with engraved knotwork/rune glow, leather-wrapped
handle (spiral TubeGeometry), pommel and wrist-strap loop — hovering over a ring of **runestones**, one per
skill (adapt the Arsenal hex carousel → carved stone tablets with glowing runes and the skill name).
Signature move: **LIGHTNING STRIKE** — procedural branching bolts (regenerated jagged polylines, additive,
bloom) from the hammer to the hovered/featured runestone; each strike = DOM white flash (≈80 ms) + impulse +
storm-cloud lighting flash. Storm clouds: fbm shader plane lit by the strikes. Scroll: the hammer rises,
spins up, and calls lightning as each skill group scrolls into view.

### 04 · EXPERIENCE — BLACK WIDOW  (`/experience`, id `experience`)
Palette: widow red `#e0102b`, gunmetal `#a7b0bb` on `#060507`. Type: Share Tech Mono for HUD/file text.
Content: both roles with all bullets, stack, dates, location, "current" flag on the Bannari role.
Centrepiece: a red-glass **hourglass emblem** (two extruded triangles) inside a spinning ring, over a dark
glossy floor (MeshReflectorMaterial is allowed if tier high) crossed by a **laser tripwire grid** that sweeps.
Signature move: **DECRYPT** — each mission file starts redacted/scrambled; as it scrolls in, red laser scan
lines sweep across it, redaction bars slide off and text decrypts (random glyphs resolving left→right); paired
with electric "baton" arcs (two batons with crackling arcs between them) that flare on each reveal + impact.
Timeline rail with travelling data packets (adapt `missions-DataRail`) in red.

### 05 · PROJECTS — HULK  (`/projects`, id `projects`)
Palette: gamma green `#7cff4f` / `#c6ff9e`, torn-trouser purple `#7a3fb0` on `#040805`. Type: Anton titles.
Content: all 5 projects (name, stack, description, metric + label), "INTERNAL · ENTERPRISE" honesty chip.
Centrepiece: a cracked **gamma-irradiated ground** (instanced flat-shaded rock shards with glowing green
fissures) and floating debris (instanced low-poly rocks) orbiting slowly in green haze.
Signature move: **SMASH** — every project card lands from above like a ground-pound: shockwave ring, shards
jump and settle, dust burst, crack decals glow, heavy impulse (0.6). Keep the "counts are the content"
machines from the old Roster (24-tooth Hangfire ring, 450-dot CRM switchboard, 1,000 tokens through 3 gates,
the Knitting press, 200 envelopes) but re-skin them gamma green / purple and make them land with a smash.
Horizontal pinned lineup on desktop is welcome (adapt Roster), stacked on mobile.

### 06 · CERTIFICATIONS — DOCTOR STRANGE  (`/certifications`, id `certifications`)
Palette: eldritch orange `#ffa63d`, emerald `#38f29a`, violet `#7b2cbf` on `#08050c`. Type: Cinzel titles.
Content: all 5 certifications (name, issuer, detail) and the education record (degree, school, location,
2021–2024, 80%), languages (English fluent, Tamil native).
Centrepiece: an original **amulet** — gold eye-shaped frame that opens to reveal a glowing green gem — floating
in front of slowly counter-rotating **spell mandalas** (shader rings: runes, rotating squares, orange glow).
Signature moves: **SLING-RING PORTAL** — each certification card is revealed through a spinning ring of
orange sparks that opens like a portal; **TIME REVERSAL** — content starts shattered (fragments scattered and
rotated) and reassembles backwards as you scroll, with the green gem glowing while time rewinds.
Faint mirror-dimension kaleidoscope shader in the background.

### 07 · CONTACT — AVENGERS ASSEMBLE  (`/contact`, id `contact`)
Palette: red `#e8232a`, gold `#f5c04a`, cyan `#4fd1ff` on `#07060a`.
Content: email, phone, LinkedIn, GitHub, résumé PDF, location (Coimbatore, India), "Let's build something
together", a replay link back to Home, footer with credits + tribute note.
Centrepiece: the **team assembles** — six small procedural tokens (a reactor ring, a star shield, a hammer,
an hourglass, a gamma hexagon, a spell mandala — build simplified versions inside this page's folder) arrive
through orange spark-portals that open around the screen edges, fly in and lock into a circle around the
central gold beacon (adapt the old Assemble beacon + vortex), then the big title "LET'S ASSEMBLE" slams in.
Hovering the email makes all six tokens lean in and the vortex surge.

## Quality bar
Awwwards-level. Every screen has motion, nothing is static, but text is always readable (glass/dim backing
where needed). DOM is the source of truth for content. Mobile (≤ 960 px) must stack cleanly with no horizontal
overflow and still feel 3D. 60 fps target; no per-frame allocations; instanced meshes for > 20 objects.
