import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync } from 'node:fs'
import { PAGES } from './src/data/heroes.js'
import { resolve } from 'node:path'

// GitHub Pages has no SPA rewrites: serving the app as 404.html makes deep links (/skills, /contact) work.
const spaFallback = () => {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir)
    },
    closeBundle() {
      try {
        const index = resolve(outDir, 'index.html')
        copyFileSync(index, resolve(outDir, '404.html'))
        // a real index.html per route so deep links (/skills) answer 200 for browsers and link-preview crawlers
        for (const p of PAGES) {
          if (p.path === '/') continue
          const dir = resolve(outDir, p.path.replace(/^\//, ''))
          mkdirSync(dir, { recursive: true })
          copyFileSync(index, resolve(dir, 'index.html'))
        }
      } catch {
        /* outDir without index.html (e.g. lib builds) */
      }
    },
  }
}

// Deployed at https://akil1502.github.io/ (user site repo) so base is '/'
export default defineConfig({
  plugins: [react(), spaFallback()],
  base: '/',
  server: {
    // build-check folders and screenshots are created/deleted constantly during development; watching them crashes
    // the dev server on Windows (EBUSY), so ignore them
    watch: { ignored: ['**/dist/**', '**/dist-*/**', '**/shots/**', '**/*.log', '**/scripts/**'] },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
          anim: ['gsap', 'lenis', 'motion'],
        },
      },
    },
  },
})
