import { useEffect, useLayoutEffect } from 'react'
import NextPage from '../../components/NextPage'
import HeroBeat from './sections/HeroBeat'
import Lineup from './sections/Lineup'
import Outro from './sections/Outro'
import { useLive } from './sections/fx'
import { gamma, resetGamma } from './store'
import './projects.css'

// 05 · PROJECTS — HULK. "The heavy lifting." A cracked, gamma-irradiated impact crater is the stage (see
// ProjectsScene); the DOM carries every fact. Signature move: SMASH — the statement, every project card and the
// final reading land like a ground-pound (camera impact, a shockwave through the 3D ground, shards jump, dust,
// crack decals glow). Beats: the gamma lab (charge → containment breach) → the lineup → the final reading.
export default function ProjectsPage({ ready }) {
  // fresh page state before anything paints or lands (pages remount on route changes)
  useLayoutEffect(() => {
    resetGamma()
    return () => resetGamma()
  }, [])
  const live = useLive(ready)
  useEffect(() => {
    if (!live) gamma.live = false
  }, [live])

  return (
    <div className="page page-projects">
      <HeroBeat live={live} />
      <Lineup live={live} />
      <Outro />
      <NextPage current="projects" />
      <p className="tribute-note">Fan-made tribute · not affiliated with or endorsed by Marvel or Disney · all 3D artwork original</p>
    </div>
  )
}
