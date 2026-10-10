import { useMemo, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { armorUniforms } from '../../three/armor'
import { naniteSize } from '../../three/Nanites'
import { disposeAll } from '../../three/useDispose'
import { loadChestData } from './loadChest'
import { getChestMaterials, chestUniforms } from './chestMaterials'
import { NANO_F } from './chestField'

// ARMOURED CHEST — the Home (Iron Man) centrepiece. A collectible-style armour bust built around the shared arc
// reactor (which sits in the bezel socket): sculpted red pectorals, gold keel and chevron abs, red yoke and
// obliques, gunmetal ribs and flank slats, dome pauldrons over sealed upper arms, a stacked gorget.
//  · suit-up   nanites burst out of the reactor and the armour grows radially from it (chestField.js)
//  · power-up  the panel seams, chest vents and seal rings lamp-strike on (cyan), then pulse outward from the heart
//  · diagnostic the plates fly out radially from the reactor over the circuit-traced under-suit
// Geometry is generated procedurally in a worker (chestGeometry.js); materials are session-cached.

const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1] // lamp strike over 0.7 s
function strikeAt(t) {
  if (t >= 0.7) return 1
  const f = (t / 0.7) * (STRIKE.length - 1)
  const i = Math.floor(f)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (f - i)
}

// dev-only inspection: ?cpx=noglow (no power-up glow), ?cpx=e0.7 (force the exploded view to 0.7)
const CPX = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cpx') || '' : ''
const CPX_E = /e([\d.]+)/.exec(CPX)

const PARTS = ['under', 'red', 'gold', 'gun', 'chrome', 'glow']

function toGeometry(m) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3))
  g.setAttribute('aExp', new THREE.BufferAttribute(m.aExp, 4))
  g.setAttribute('aSeam', new THREE.BufferAttribute(m.aSeam, 1))
  g.setIndex(new THREE.BufferAttribute(m.index, 1))
  g.computeBoundingSphere()
  // the exploded view moves vertices in the shader: grow the culling sphere to cover it
  g.boundingSphere.radius += 0.75
  return g
}

function buildSwarm(sw, count, material) {
  const size = naniteSize(count)
  const hex = new THREE.CylinderGeometry(size, size, size * 0.32, 6, 1)
  hex.setAttribute('aTarget', new THREE.InstancedBufferAttribute(sw.aTarget, 3))
  hex.setAttribute('aNormalT', new THREE.InstancedBufferAttribute(sw.aNormal, 3))
  hex.setAttribute('aRand', new THREE.InstancedBufferAttribute(sw.aRand, 4))
  const mesh = new THREE.InstancedMesh(hex, material, count)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(sw.color, 3)
  mesh.frustumCulled = false
  mesh.visible = false
  return mesh
}

export default function Centerpiece({ dir, tier = 'high', count = 5200, sourceRef }) {
  const quality = tier === 'low' ? 'low' : 'high'
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    loadChestData(quality, count).then((d) => alive && setData(d))
    return () => {
      alive = false
    }
  }, [quality, count])
  const M = useMemo(() => getChestMaterials(tier), [tier])
  return data ? <Chest data={data} M={M} dir={dir} tier={tier} count={count} sourceRef={sourceRef} /> : null
}

function Chest({ data, M, dir, tier, count, sourceRef }) {
  const { gl, camera, scene } = useThree()
  const geos = useMemo(() => Object.fromEntries(PARTS.map((k) => [k, toGeometry(data.meshes[k])])), [data])
  const swarm = useMemo(() => buildSwarm(data.swarm, count, M.nanites), [data, count, M])
  const hitGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 24, 16)
    g.scale(1.35, 1.2, 0.6)
    g.translate(0, 0, -0.5)
    return g
  }, [])
  // the materials are session-cached (programs survive a round trip); only per-mount geometry is freed here
  useEffect(
    () => () => {
      disposeAll(Object.values(geos), hitGeo)
      swarm.geometry.dispose()
      swarm.dispose()
    },
    [geos, swarm, hitGeo],
  )

  const all = useRef()
  const root = useRef()
  const strike = useRef({ on: false, t: 10, level: 0, fired: false })
  const warmed = useRef(false)

  // HUD anchors: four plates on four different parts (gorget, pauldron, pectoral, abdominals), top → bottom
  useEffect(() => {
    dir.helmAnchor = (name, out) => {
      const a = data.anchors[name]
      if (!a || !root.current) return out.set(0, 0, 0)
      const E = chestUniforms.uExplode.value
      out.set(a.p[0] + a.e[0] * E, a.p[1] + a.e[1] * E, a.p[2] + a.e[2] * E)
      root.current.updateWorldMatrix(true, false)
      return root.current.localToWorld(out)
    }
    return () => {
      dir.helmAnchor = null
      dir.hover = false
      chestUniforms.uExplode.value = 0
      chestUniforms.uPower.value = 0
      M.glow.uniforms.uLevel.value = 0
    }
  }, [dir, data, M])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    const reveal = armorUniforms.uReveal.value

    // one-time shader warm-up against the real scene (lights, env map) and a render target — the way HomeScene
    // warms the shared materials — so the armour, under-suit, glow and swarm programs exist before the suit-up
    if (!warmed.current && all.current) {
      warmed.current = true
      const rt = tier !== 'low' ? new THREE.WebGLRenderTarget(1, 1) : null
      const prev = gl.getRenderTarget()
      try {
        if (rt) gl.setRenderTarget(rt)
        gl.compile(all.current, camera, scene)
      } catch {
        /* compiles on first draw instead */
      } finally {
        gl.setRenderTarget(prev)
        rt?.dispose()
      }
    }

    // below this reveal every armour fragment is discarded → skip the draw calls entirely
    if (root.current) root.current.visible = reveal > NANO_F - 0.01
    swarm.visible = reveal > 0.001 && reveal < 1.1
    if (sourceRef?.current) M.nanites.userData.uni.uSource.value.copy(sourceRef.current)

    chestUniforms.uExplode.value = CPX_E ? +CPX_E[1] : dir.explode || 0

    // power-up: lamp strike on the seams / vents / seal rings once the suit is formed; re-armed on retract
    const s = strike.current
    const formed = reveal >= 1.06
    if (formed && !s.on) {
      s.on = true
      s.t = 0
      s.fired = false
    } else if (!formed && s.on && reveal < 0.98) s.on = false
    if (s.on) {
      s.t += dt
      s.level = strikeAt(s.t)
      if (!s.fired && s.t >= 0.7) {
        s.fired = true
        dir.onPowerUp?.()
      }
    } else s.level = Math.max(0, s.level - dt * 5)
    const flare = 1 + (dir.hover ? 0.55 : 0) + (dir.blink || 0) * 1.6
    const lvl = CPX.includes('noglow') ? 0 : s.level * flare
    const t = state.clock.elapsedTime
    chestUniforms.uPower.value = lvl * (0.85 + 0.15 * Math.sin(t * 1.7))
    M.glow.uniforms.uLevel.value = lvl * 3.2
    dir.eyes = s.level
    dir.eyeLight = lvl * 0.8
  })

  return (
    <group ref={all}>
      <group
        ref={root}
        visible={false}
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
        {PARTS.map((k) => (
          <mesh key={k} geometry={geos[k]} material={M[k]} raycast={noRaycast} />
        ))}
        {/* cheap invisible hit volume for hover / click (the armour itself is ~300k triangles) */}
        <mesh geometry={hitGeo}>
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <primitive object={swarm} />
    </group>
  )
}

const noRaycast = () => null
