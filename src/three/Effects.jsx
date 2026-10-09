import { useMemo } from 'react'
import * as THREE from 'three'
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

// Cinematic grade: bloom for the glows, a whisper of chromatic aberration, vignette and film grain.
export default function Effects({ tier = 'high' }) {
  const caOffset = useMemo(() => new THREE.Vector2(0.0007, 0.0005), [])
  if (tier === 'low') return null
  return (
    <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.25} intensity={tier === 'high' ? 1.0 : 0.7} mipmapBlur radius={0.65} />
      {tier === 'high' ? <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} /> : null}
      <Vignette eskil={false} offset={0.22} darkness={0.8} />
      <Noise opacity={tier === 'high' ? 0.06 : 0.04} blendFunction={BlendFunction.OVERLAY} />
    </EffectComposer>
  )
}
