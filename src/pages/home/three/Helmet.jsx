import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { buildEarGeometry, buildCollarGeometry } from './helmetGeometry'
import { armorUniforms, NANO_F } from './armor'
import { useDispose } from './useDispose'

// Exploded-view offsets (head units) + rotations for every plate. The faceplate hinges up around its pivot.
const PLATES = [
  { key: 'mask', mat: 'gold', off: [0, 0.34, 0.62], rot: [-0.62, 0, 0], pivot: [0, 0.62, 0.35] },
  { key: 'cheekR', mat: 'gold', off: [0.5, -0.16, 0.58], rot: [0, 0.4, -0.14] },
  { key: 'cheekL', mat: 'gold', off: [-0.5, -0.16, 0.58], rot: [0, -0.4, 0.14] },
  { key: 'crown', mat: 'red', off: [0, 0.52, -0.2], rot: [-0.2, 0, 0] },
  { key: 'crest', mat: 'red', off: [0, 0.92, -0.12], rot: [-0.3, 0, 0] },
  { key: 'sideR', mat: 'red', off: [0.66, -0.06, -0.16], rot: [0, 0.18, -0.08] },
  { key: 'sideL', mat: 'red', off: [-0.66, -0.06, -0.16], rot: [0, -0.18, 0.08] },
  { key: 'back', mat: 'red', off: [0, -0.02, -0.78], rot: [0.12, 0, 0] },
  { key: 'collar', mat: 'gunmetal', off: [0, -0.52, 0], rot: [0, 0, 0] },
]

// Lamp-strike flicker: [0, 0.7, 0.15, 1, 0.4, 1] over 0.7 s
const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]
function strikeAt(t) {
  if (t >= 0.7) return 1
  const f = (t / 0.7) * (STRIKE.length - 1)
  const i = Math.floor(f)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (f - i)
}

const _v = new THREE.Vector3()

export default function Helmet({ geo, mats, dir }) {
  const root = useRef()
  const plates = useRef({})
  const earR = useRef()
  const earL = useRef()
  const eyeMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#dffcff'), toneMapped: false, transparent: true, opacity: 1, depthWrite: false }), [])
  const eyeGlow = useRef([])
  const strike = useRef({ on: false, t: 10, level: 0, fired: false })
  const earGeo = useMemo(() => buildEarGeometry(), [])
  const collarGeo = useMemo(() => buildCollarGeometry(), [])
  const glowTex = useMemo(() => makeGlowTexture(), [])
  useDispose([eyeMat, earGeo, collarGeo, glowTex], [eyeMat, earGeo, collarGeo, glowTex])

  // place the ear discs on the surface (mirror for the left)
  const earQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), geo.earN), [geo])
  const earQuatL = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-geo.earN.x, geo.earN.y, geo.earN.z)), [geo])

  // expose anchors (in world space) for the HUD lines: anchor point + the object it is glued to
  useEffect(() => {
    dir.helmAnchor = (name, out) => {
      const a = geo.anchors[name]
      const host =
        name === 'forehead' || name === 'eyeR' || name === 'eyeL'
          ? plates.current.mask
          : name === 'crown'
            ? plates.current.crown
            : name === 'cheek'
              ? plates.current.cheekL
              : earL.current
      if (!host) return out.set(0, 0, 0)
      // the ear disc is a lathe (axis +Y = outwards), so its anchor sits just off the cap
      if (name === 'ear') return host.localToWorld(out.set(0, 0.1, 0))
      if (!a) return out.set(0, 0, 0)
      return host.localToWorld(out.copy(a))
    }
    return () => {
      dir.helmAnchor = null
    }
  }, [dir, geo])

  useFrame((state, dt) => {
    // below this reveal every armour fragment is discarded (see patchArmor) → skip the draw calls entirely
    if (root.current) root.current.visible = armorUniforms.uReveal.value > NANO_F - 0.01
    const E = dir.explode
    const t = state.clock.elapsedTime
    for (const p of PLATES) {
      const o = plates.current[p.key + 'G']
      if (!o) continue
      const piv = p.pivot || [0, 0, 0]
      // tiny idle "breathing" of the plates while exploded
      const breathe = E * 0.03 * Math.sin(t * 1.6 + p.off[0] * 3 + p.off[1] * 5)
      o.position.set(piv[0] + p.off[0] * E * (1 + breathe), piv[1] + p.off[1] * E * (1 + breathe), piv[2] + p.off[2] * E * (1 + breathe))
      o.rotation.set(p.rot[0] * E, p.rot[1] * E, p.rot[2] * E)
    }
    const earOff = 1.08 * E
    if (earR.current) earR.current.position.copy(geo.earP).addScaledVector(geo.earN, 0.05 + earOff * 0.6).add(_v.set(earOff * 0.5, 0, 0))
    if (earL.current) earL.current.position.set(-geo.earP.x, geo.earP.y, geo.earP.z).add(_v.set(-geo.earN.x, geo.earN.y, geo.earN.z).multiplyScalar(0.05 + earOff * 0.6)).add(_v.set(-earOff * 0.5, 0, 0))

    // eyes: power on (lamp strike) once the suit is fully formed; quick fade when the armour retracts
    const s = strike.current
    const formed = armorUniforms.uReveal.value >= 1.06
    if (formed && !s.on) {
      s.on = true
      s.t = 0
      s.fired = false
    } else if (!formed && s.on && armorUniforms.uReveal.value < 0.98) {
      s.on = false
    }
    if (s.on) {
      s.t += dt
      s.level = strikeAt(s.t)
      if (!s.fired && s.t >= 0.7) {
        s.fired = true
        dir.onPowerUp?.()
      }
    } else s.level = Math.max(0, s.level - dt * 5)
    const flare = 1 + (dir.hover ? 0.5 : 0) + (dir.blink || 0) * 1.5
    const lvl = s.level * flare
    dir.eyes = s.level
    eyeMat.color.setRGB(0.9 * lvl * 3.2, 0.99 * lvl * 3.2, 1.0 * lvl * 3.2)
    eyeMat.opacity = Math.min(1, s.level * 1.5)
    for (const g of eyeGlow.current) {
      if (!g) continue
      g.material.opacity = Math.min(1, lvl * 0.55)
      g.scale.set(0.66 + 0.05 * Math.sin(t * 9) * s.level, 0.24, 1)
    }
    dir.eyeLight = lvl // drives the eye light owned by the scene (lights never mount/unmount mid-page)
  })

  const reg = (k) => (el) => {
    if (el) plates.current[k] = el
  }

  return (
    <group
      ref={root}
      onPointerOver={(e) => {
        e.stopPropagation()
        dir.hover = true
      }}
      onPointerOut={() => (dir.hover = false)}
      onClick={(e) => {
        e.stopPropagation()
        dir.onRepulsor?.()
      }}
    >
      {/* dark under-suit skull (fills every seam, shows circuitry in the exploded view) */}
      <mesh ref={reg('skull')} geometry={geo.skull} material={mats.under} />

      {PLATES.map((p) => {
        const piv = p.pivot || [0, 0, 0]
        const g = p.key === 'collar' ? collarGeo : geo[p.key]
        return (
          <group key={p.key} ref={reg(p.key + 'G')} position={piv}>
            <group position={[-piv[0], -piv[1], -piv[2]]}>
              <mesh ref={reg(p.key)} geometry={g} material={mats[p.mat]} />
              {p.key === 'mask' ? (
                <>
                  <mesh geometry={geo.eyes} material={eyeMat} renderOrder={2} />
                  <mesh geometry={geo.eyesL} material={eyeMat} renderOrder={2} />
                  {[geo.anchors.eyeR, geo.anchors.eyeL].map((a, i) => (
                    <sprite key={i} ref={(el) => (eyeGlow.current[i] = el)} position={[a.x * 1.04, a.y + 0.02, a.z + 0.08]} scale={[0.66, 0.24, 1]} renderOrder={3}>
                      <spriteMaterial map={glowTex} color={'#9ff4ff'} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
                    </sprite>
                  ))}
                </>
              ) : null}
            </group>
          </group>
        )
      })}

      <mesh ref={earR} geometry={earGeo} material={mats.silver} quaternion={earQuat} />
      <mesh ref={earL} geometry={earGeo} material={mats.silver} quaternion={earQuatL} />
    </group>
  )
}

// soft radial glow texture for the eye halos
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.18, 'rgba(200,250,255,0.55)')
  grd.addColorStop(0.5, 'rgba(120,230,255,0.12)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
