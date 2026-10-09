import ShieldRig from './three/ShieldRig'
import { Haze, StarField } from './three/Atmosphere'

// ABOUT · CAPTAIN AMERICA — 3D stage: drifting haze, tumbling stars, and the shield rig (the shield, its
// travelling stage lights, the poster ray burst behind it and the SHIELD THROW impact kit).
export default function AboutScene({ tier = 'high', ready }) {
  return (
    <>
      <Haze tier={tier} />
      <StarField tier={tier} />
      <ShieldRig tier={tier} ready={ready} />
    </>
  )
}
