# Akil Prabhu · Avengers-themed 3D portfolio

A seven-page, fully 3D and animated portfolio for **Akil Prabhu A**, Software Engineer
(ASP.NET Core · C# · SQL Server · REST APIs · AI-assisted development).

Live: **https://akil1502.github.io/**

Each page is a fan tribute to one hero of the team, with original procedural 3D artwork:

| Page | Hero | Centrepiece |
| --- | --- | --- |
| `/` Home | Iron Man | Nanotech helmet suit-up, reactor, HUD diagnostics |
| `/about` About | Captain America | Ricocheting vibranium-style shield, personnel file |
| `/skills` Skills | Thor | War hammer, storm, lightning striking runestones |
| `/experience` Experience | Black Widow | Hourglass emblem, laser grid, decrypting mission files |
| `/projects` Projects | Hulk | Gamma-cracked ground, smashing project machines |
| `/certifications` Certifications | Doctor Strange | Amulet, spell mandalas, time-reversal reassembly |
| `/contact` Contact | Avengers | Six hero tokens assembling around a beacon |

> Fan-made tribute. Not affiliated with or endorsed by Marvel or Disney. All 3D artwork is original and
> generated in code; no official images, logos or film quotes are used.

## Stack

Vite · React 19 · React Router · three.js via @react-three/fiber and @react-three/drei ·
@react-three/postprocessing · GSAP ScrollTrigger · Lenis smooth scroll.

One persistent WebGL canvas renders the active page's scene; route changes play a flip-strip transition
in the next hero's colours.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

`npm run build` also writes `dist/404.html` so deep links work on GitHub Pages.

## Deploy

Every push to `main` builds the site and deploys it to GitHub Pages via `.github/workflows/deploy.yml`.

## Editing content

- Résumé content: `src/data/resume.js`
- Pages, routes, hero themes and HUD labels: `src/data/heroes.js`
- Each page: `src/pages/<id>/` (DOM page, 3D scene, CSS)
- Design bible: `HEROES.md`

## Visual checks

`node scripts/shoot.mjs http://127.0.0.1:5173 desktop|mobile <pageIds> <stops>` takes headless screenshots of
every page into `shots/` (needs `npx playwright install chromium` once).
