import { lazy } from 'react'

// Every page = a DOM component (src/pages/<id>/<Name>Page.jsx) + a 3D scene (src/pages/<id>/<Name>Scene.jsx)
// rendered inside the single persistent <Canvas>. Both are code-split; prefetchPage() warms the chunks.
const loaders = {
  home: { dom: () => import('./home/HomePage.jsx'), gl: () => import('./home/HomeScene.jsx') },
  about: { dom: () => import('./about/AboutPage.jsx'), gl: () => import('./about/AboutScene.jsx') },
  skills: { dom: () => import('./skills/SkillsPage.jsx'), gl: () => import('./skills/SkillsScene.jsx') },
  experience: { dom: () => import('./experience/ExperiencePage.jsx'), gl: () => import('./experience/ExperienceScene.jsx') },
  projects: { dom: () => import('./projects/ProjectsPage.jsx'), gl: () => import('./projects/ProjectsScene.jsx') },
  certifications: { dom: () => import('./certifications/CertificationsPage.jsx'), gl: () => import('./certifications/CertificationsScene.jsx') },
  contact: { dom: () => import('./contact/ContactPage.jsx'), gl: () => import('./contact/ContactScene.jsx') },
}

export const PAGE_DOM = Object.fromEntries(Object.entries(loaders).map(([id, l]) => [id, lazy(l.dom)]))
export const PAGE_GL = Object.fromEntries(Object.entries(loaders).map(([id, l]) => [id, lazy(l.gl)]))

const warmed = new Set()
export function prefetchPage(id) {
  if (!loaders[id] || warmed.has(id)) return
  warmed.add(id)
  loaders[id].dom().catch(() => warmed.delete(id))
  loaders[id].gl().catch(() => warmed.delete(id))
}
