import { useLocation } from 'react-router'
import { heroNavigate } from './controller'
import { pageById } from '../data/heroes'
import { prefetchPage } from '../pages/registry'

// A link to another hero page that plays the cinematic transition. Renders a real <a href> (works without JS,
// middle-click / cmd-click open new tabs normally) and prefetches the destination chunk on hover/focus.
export default function HeroLink({ to, children, className = '', onNavigate, ...rest }) {
  const location = useLocation()
  const page = pageById[to]
  if (!page) return null
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    onNavigate?.()
    heroNavigate(page, { currentPath: location.pathname })
  }
  const warm = () => prefetchPage(page.id)
  return (
    <a href={page.path} onClick={onClick} onPointerEnter={warm} onFocus={warm} className={className} data-hero-link={page.id} {...rest}>
      {children}
    </a>
  )
}
