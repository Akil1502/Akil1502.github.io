import { Component } from 'react'

// If WebGL fails (very old GPU, blocked context, headless bots) the DOM content still renders on its own.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    if (typeof console !== 'undefined') console.warn('[portfolio] 3D scene disabled:', err?.message || err)
    document.documentElement.classList.add('no-webgl')
  }
  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return this.props.children
  }
}
