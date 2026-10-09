import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import Cluster from './three/Cluster'
import TripwireFloor from './three/TripwireFloor'
import Smoke from './three/Smoke'
import LedgerRail from './three/LedgerRail'
import { stage, updateStage } from './three/stage'
import { scroll } from '../../three/scrollStore'
import { initXp, clearXp } from './signals'

/* EXPERIENCE — BLACK WIDOW, 3D layer.
   A dark vault: the red-glass hourglass emblem turning on its axle inside a gunmetal gimbal ring, flanked by two
   stun batons, standing in haze over a glossy floor crossed by a sweeping laser tripwire grid. The cluster is pinned
   to the viewport and steered between section keys by the stage director; the camera is dollied per key through
   scroll.camOffset / camLook (reset on unmount). The ledger rail runs down the mission files in the DOM.
   Light budget: exactly four point lights (cluster key + rim, two baton tips), all always mounted and visible —
   intensities fade instead — so the light count never changes mid-scroll (that would recompile every lit shader). */

export default function ExperienceScene({ tier = 'high' }) {
  const { gl, scene, camera } = useThree()

  // priority -1: the stage director runs before every other frame callback (the page parts and the shared
  // CameraRig), so they all read this frame's stage — negative priorities do not take over R3F's render loop.
  useFrame((state) => {
    const { width, height } = state.size
    updateStage(width < 960 || width / Math.max(1, height) < 0.85)
    scroll.camOffset = stage.cam
    scroll.camLook = stage.look
  }, -1)

  useEffect(() => {
    initXp()
    // Pre-compile every program of this page (including parts that only appear later in the scroll, e.g. the
    // ledger nodes) while the route transition still covers the screen, so no shader compiles mid-scroll.
    try {
      gl.compile(scene, camera)
    } catch {
      /* compile is only a warm-up */
    }
    return () => {
      scroll.camOffset = { x: 0, y: 0, z: 0 }
      scroll.camLook = { x: 0, y: 0, z: 0 }
      // only on a real route change (StrictMode's dev re-mount must keep the DOM page's live signal object)
      if (scroll.page !== 'experience') clearXp()
    }
  }, [gl, scene, camera])

  return (
    <group>
      <Cluster />
      <TripwireFloor tier={tier} />
      {tier !== 'low' && <Smoke />}
      <LedgerRail tier={tier} />
    </group>
  )
}
