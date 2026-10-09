import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'
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
        copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
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
