import { useEffect } from 'react'

// Frees GPU resources that were created imperatively (useMemo) when the component unmounts. R3F only disposes
// what it created from JSX, and pages unmount on every route change, so anything built by hand must go here.
// Accepts geometries, materials, textures, render targets, arrays of them, or objects whose values are them.
export function disposeAll(...items) {
  for (const it of items) {
    if (!it) continue
    if (Array.isArray(it)) disposeAll(...it)
    else if (typeof it.dispose === 'function') it.dispose()
    else if (typeof it === 'object') disposeAll(...Object.values(it))
  }
}

export function useDispose(items, deps) {
  useEffect(
    () => () => disposeAll(...items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  )
}
