import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, AdaptiveDpr } from '@react-three/drei'
import CameraRig from './CameraRig'
import Effects from './Effects'
import Particles from './primitives/Particles'
import { PAGE_GL } from '../pages/registry'
import { pageById, PAGES } from '../data/heroes'
import { scroll } from './scrollStore'

// Lets anything (DOM or GL) request a camera impact shake: window.__portfolioImpulse(0.5)
if (typeof window !== 'undefined') {
  window.__portfolioImpulse = (v = 0.4) => {
    scroll.impulse = Math.max(scroll.impulse || 0, v)
  }
}

// Neutral studio environment for reflections (no network). Pages add their own coloured lights.
function Studio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={['#050308']} />
      <Lightformer intensity={4} color={'#ffffff'} position={[0, 6, -8]} scale={[12, 2, 1]} />
      <Lightformer intensity={3} color={'#ffd9b0'} position={[-8, 1, -4]} rotation-y={Math.PI / 2} scale={[14, 3, 1]} />
      <Lightformer intensity={3} color={'#cfe6ff'} position={[8, 3, -4]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
      <Lightformer intensity={1.5} color={'#ffffff'} position={[0, -6, -6]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
      <Lightformer form="ring" intensity={5} color={'#fff4e0'} position={[2, 4, 6]} scale={3} />
    </Environment>
  )
}

// Smoothly blends background + fog colour to the active hero's palette.
function ThemeBlend({ pageId }) {
  const { scene } = useThree()
  const target = useRef(new THREE.Color(PAGES[0].theme.bg))
  useEffect(() => {
    const p = pageById[pageId] || PAGES[0]
    target.current.set(p.theme.bg)
  }, [pageId])
  useFrame((_, dt) => {
    const k = 1 - Math.pow(0.02, dt)
    if (scene.background?.isColor) scene.background.lerp(target.current, k)
    if (scene.fog) scene.fog.color.lerp(target.current, k)
  })
  return null
}

// Marks the page's 3D scene as mounted so the transition can reveal (see PageMount in App.jsx).
function GLMounted({ id }) {
  useEffect(() => {
    scroll.glReady = id
  }, [id])
  return null
}

function PageGL({ pageId, tier, ready }) {
  if (!pageId || !PAGE_GL[pageId]) return null
  const C = PAGE_GL[pageId]
  return (
    <Suspense fallback={null}>
      <group key={pageId}>
        <C tier={tier} ready={ready} page={pageById[pageId]} />
      </group>
      <GLMounted id={pageId} />
    </Suspense>
  )
}

export default function Scene({ tier, ready, pageId }) {
  const isLow = tier.tier === 'low'
  const theme = (pageById[pageId] || PAGES[0]).theme
  return (
    <div className="gl-layer" aria-hidden="true">
      <Canvas
        dpr={[1, tier.dpr]}
        gl={{ antialias: !isLow, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true }}
        camera={{ fov: 42, near: 0.1, far: 140, position: [0, 0, 10] }}
        frameloop="always"
      >
        <color attach="background" args={[PAGES[0].theme.bg]} />
        <fog attach="fog" args={[PAGES[0].theme.bg, 18, 46]} />
        <ThemeBlend pageId={pageId} />
        <Suspense fallback={null}>
          <Studio />
        </Suspense>
        <ambientLight intensity={0.22} />
        <directionalLight position={[6, 8, 10]} intensity={1.2} color={'#fff1d6'} />
        <CameraRig enabled={ready} />
        <Particles tier={tier.tier} colorA={theme.primary} colorB={theme.accent} />
        <PageGL pageId={pageId} tier={tier.tier} ready={ready} />
        <Effects tier={tier.tier} />
        <AdaptiveDpr pixelated />
      </Canvas>
    </div>
  )
}
