import { useState, useEffect, useLayoutEffect, useCallback, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Scene from './three/Scene'
import Loader from './components/Loader'
import Nav from './components/Nav'
import Cursor from './components/Cursor'
import Copilot from './components/Copilot'
import HudFrame from './components/HudFrame'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './components/NotFound'
import TransitionOverlay from './transition/TransitionOverlay'
import { registerNavigate, completeTransition } from './transition/controller'
import { useLenis, getLenis } from './hooks/useLenis'
import { useDeviceTier } from './hooks/useDeviceTier'
import { measureSections, updateSectionProgress, scroll } from './three/scrollStore'
import { PAGES, pageForPath, applyTheme, nextPage } from './data/heroes'
import { PAGE_DOM, prefetchPage } from './pages/registry'

// Runs inside the page's Suspense boundary, so its layout effect fires only once the lazy page DOM has mounted.
function PageMount({ page }) {
  useLayoutEffect(() => {
    const lenis = getLenis()
    lenis?.scrollTo(0, { immediate: true, force: true })
    window.scrollTo(0, 0)
    scroll.y = 0
    scroll.progress = 0
    scroll.velocity = 0
    scroll.sections = {}
    measureSections()
    updateSectionProgress()
    let cancelled = false
    // wait for the page's 3D scene to mount (or give up after 2.5s), then two frames for shader compilation
    const start = performance.now()
    const waitGL = () => {
      if (cancelled) return
      if (scroll.glReady === page.id || performance.now() - start > 2500) {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (cancelled) return
            lenis?.resize?.()
            measureSections()
            updateSectionProgress()
            ScrollTrigger.refresh()
            completeTransition(page)
            // warm the next page while the visitor reads this one
            setTimeout(() => prefetchPage(nextPage(page.id).id), 1200)
          }),
        )
      } else requestAnimationFrame(waitGL)
    }
    requestAnimationFrame(waitGL)
    // Section positions go stale whenever the page height changes (webfont swaps, lazy parts, accordions):
    // re-measure on any resize of the DOM layer, coalesced to one pass per frame.
    let pending = 0
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (pending) return
            pending = requestAnimationFrame(() => {
              pending = 0
              if (cancelled) return
              lenis?.resize?.()
              measureSections()
              updateSectionProgress()
            })
          })
        : null
    const layer = document.querySelector('.dom-layer')
    if (ro && layer) ro.observe(layer)
    document.fonts?.ready?.then(() => {
      if (cancelled) return
      measureSections()
      updateSectionProgress()
      ScrollTrigger.refresh()
    })
    return () => {
      cancelled = true
      ro?.disconnect()
      if (pending) cancelAnimationFrame(pending)
    }
  }, [page])
  return null
}

function Shell() {
  const tier = useDeviceTier()
  const [ready, setReady] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const page = pageForPath(location.pathname)
  useLenis(true)

  useEffect(() => registerNavigate(navigate), [navigate])

  // theme the whole document for the active hero (CSS variables + data-hero attribute)
  useLayoutEffect(() => {
    applyTheme(page || PAGES[0])
    scroll.page = page ? page.id : 'notfound'
  }, [page])

  // Hold the page still during the studio intro.
  useEffect(() => {
    const l = getLenis()
    if (!l) return
    if (!ready) {
      l.stop()
      window.scrollTo(0, 0)
    } else {
      l.start()
      measureSections()
      updateSectionProgress()
    }
  }, [ready])

  const onDone = useCallback(() => setReady(true), [])

  return (
    <>
      <ErrorBoundary fallback={<div className="gl-layer gl-fallback" aria-hidden="true" />}>
        <Scene tier={tier} ready={ready} pageId={page ? page.id : null} />
      </ErrorBoundary>
      <Loader onDone={onDone} />
      <Nav ready={ready} page={page} />
      <HudFrame page={page} ready={ready} />
      <main className="dom-layer" key={location.pathname}>
        <Suspense fallback={<div style={{ minHeight: '100vh' }} />}>
          <Routes>
            {PAGES.map((p) => {
              const Page = PAGE_DOM[p.id]
              return (
                <Route
                  key={p.id}
                  path={p.path}
                  element={
                    <>
                      <Page ready={ready} tier={tier.tier} page={p} />
                      <PageMount page={p} />
                    </>
                  }
                />
              )
            })}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <TransitionOverlay />
      <Copilot ready={ready} />
      <Cursor />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
