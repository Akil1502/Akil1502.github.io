import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import AmuletRig from './three/AmuletRig'
import CardPortals from './three/CardPortals'
import NextPortal from './three/NextPortal'
import { MirrorDimension } from './three/Backdrop'
import { resetCert } from './store'

/*
 * CERTIFICATIONS — DOCTOR STRANGE · 3D layer (inside the single persistent <Canvas>).
 *   - MirrorDimension: faint kaleidoscope city folding far behind everything (not on low tier)
 *   - AmuletRig: the relic (procedural amulet), its spell circles, spark crown, time seal, haze and lights;
 *     pinned to the viewport and blended between one pose per DOM beat
 *   - CardPortals: a sling-ring spark portal + sigil in each certification card's window
 *   - NextPortal: the portal that tears open around the next-page call to action
 */
export default function CertificationsScene({ tier = 'high', ready = true }) {
  const { size } = useThree()
  const aspect = size.width / Math.max(1, size.height)
  useEffect(() => () => resetCert(), [])
  // the kaleidoscope plane sits at z = -18: scale it to cover the view there (camera at z = 10, fov 42)
  const far = 18
  const halfH = Math.tan((21 * Math.PI) / 180) * (10 + far) * 1.12
  return (
    <>
      {tier !== 'low' ? <MirrorDimension tier={tier} aspect={aspect} intensity={0.13} position={[0, 0, -far]} scale={halfH} /> : null}
      <AmuletRig tier={tier} ready={ready} />
      <CardPortals tier={tier} />
      <NextPortal tier={tier} />
    </>
  )
}
