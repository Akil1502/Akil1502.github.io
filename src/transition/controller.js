// Page-transition controller (module singleton). Links call heroNavigate(path); the overlay covers the screen in the
// destination hero's colours, the route swaps underneath, the new page measures itself, then the overlay reveals.
// Browser back/forward (no cover played) only runs the reveal half.
const state = {
  busy: false,
  overlay: null, // { cover(page) => Promise, reveal() => Promise } registered by <TransitionOverlay/>
  navigate: null, // react-router navigate, registered by the shell
  pendingReveal: false,
  listeners: new Set(),
}

export function registerOverlay(api) {
  state.overlay = api
  return () => {
    if (state.overlay === api) state.overlay = null
  }
}

export function registerNavigate(fn) {
  state.navigate = fn
}

export function isTransitioning() {
  return state.busy
}

export function onTransition(fn) {
  state.listeners.add(fn)
  return () => state.listeners.delete(fn)
}
function emit(phase, page) {
  state.listeners.forEach((fn) => fn(phase, page))
}

// Called by links. `page` is the destination entry from data/heroes.js
export async function heroNavigate(page, { currentPath } = {}) {
  if (!page || state.busy) return
  if (currentPath && page.path === currentPath) {
    // same page: scroll to top instead
    window.__lenis?.scrollTo(0, { duration: 1.2 })
    return
  }
  state.busy = true
  emit('cover', page)
  try {
    if (state.overlay) await state.overlay.cover(page)
  } catch {
    /* overlay failures must never block navigation */
  }
  state.pendingReveal = true
  state.navigate ? state.navigate(page.path) : (window.location.href = page.path)
}

// Called by the shell once the new route has mounted and measured.
export async function completeTransition(page) {
  emit('mounted', page)
  if (!state.pendingReveal) {
    state.busy = false
    emit('done', page)
    return
  }
  state.pendingReveal = false
  try {
    if (state.overlay) await state.overlay.reveal(page)
  } catch {
    /* ignore */
  }
  state.busy = false
  emit('done', page)
}
