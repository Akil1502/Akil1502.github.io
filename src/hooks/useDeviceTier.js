import { useMemo } from 'react'

// Classifies the device so the scene can scale instance counts and postprocessing.
// Returns { tier: 'high' | 'medium' | 'low', isTouch, isMobile, reducedMotion, dpr }
export function detectDeviceTier() {
  if (typeof window === 'undefined') return { tier: 'medium', isTouch: false, isMobile: false, reducedMotion: false, dpr: 1 }
  const isTouch = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
  const isMobile = isTouch && Math.min(window.innerWidth, window.innerHeight) < 820
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4

  let gpuScore = 2 // 0 low, 1 mid, 2 high
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) gpuScore = 0
    else {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      const r = ext ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase() : ''
      if (/swiftshader|llvmpipe|software/.test(r)) gpuScore = 0
      else if (/intel|mali-4|mali-t|adreno 5|adreno 4|apple a1[0-2]/.test(r)) gpuScore = 1
    }
  } catch {
    gpuScore = 1
  }

  let tier = 'high'
  if (isMobile || gpuScore === 0 || cores <= 2 || mem <= 2) tier = 'low'
  else if (gpuScore === 1 || cores <= 4 || mem <= 4) tier = 'medium'

  // ?tier=high|medium|low forces a tier (used by the headless visual-check script and for debugging)
  try {
    const forced = new URLSearchParams(window.location.search).get('tier')
    if (forced === 'high' || forced === 'medium' || forced === 'low') tier = forced
  } catch {
    /* ignore */
  }

  const dpr = tier === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : tier === 'medium' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1
  return { tier, isTouch, isMobile, reducedMotion, dpr }
}

let cached = null
export function useDeviceTier() {
  return useMemo(() => {
    if (!cached) cached = detectDeviceTier()
    return cached
  }, [])
}
