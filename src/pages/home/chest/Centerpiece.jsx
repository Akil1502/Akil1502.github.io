import { useMemo, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { armorUniforms } from '../three/armor'
import { naniteSize } from '../three/Nanites'
import { disposeAll } from '../three/useDispose'
import { loadChestData } from './loadChest'
import { getChestMaterials, chestUniforms } from './chestMaterials'
import { NANO_D, NANO_F, REACTOR } from './chestField'
import meta from './meta'

// ARMOURED CHEST — the Home (Iron Man) centrepiece. A collectible-style armour bust with a heroic V-taper, built
// around the shared arc reactor (which sits recessed in a deep machined socket): candy-red pectorals on a gold trim
// layer meeting at a gold sternum ridge and keel, a segmented gold chevron ab stack, red side-rib plates sweeping into a
// narrow waist, gunmetal collarbones under a hollow gorget, and articulated pauldrons (a broad red cap with a spine
// over a gold trim and two tucked lames). No arms, no head, no face.
//  · suit-up   nanites hop out of the reactor and skim over the body; the armour grows radially behind them
//  · power-up  the panel seams and seal rings lamp-strike on (cyan), then pulse outward from the heart
//  · diagnostic the plates fly out radially from the reactor over the circuit-traced (PCB) under-suit
// The group pivots round the reactor socket (see useFrame), so the socket stays on the reactor whatever the turn.
// Geometry is generated procedurally in a worker (chestGeometry.js); materials are session-cached.

const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1] // lamp strike over 0.7 s
function strikeAt(t) {
  if (t >= 0.7) return 1
  const f = (t / 0.7) * (STRIKE.length - 1)
  const i = Math.floor(f)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (f - i)
}

// dev-only inspection: ?cpx=noglow (no power-up glow), ?cpx=e0.7 (force the exploded view to 0.7), ?cpx=r0.5 (freeze
// the nanotech suit-up at reveal 0.5; combine as ?cpx=e0.7r0.9)
const CPX = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cpx') || '' : ''
const CPX_E = /e([\d.]+)/.exec(CPX)
const CPX_R = /r([\d.]+)/.exec(CPX)

const PARTS = ['under', 'red', 'gold', 'gun', 'chrome', 'glow']
// the swarm is fully landed (every nanite past nk = 1.1) above this reveal → skip its draw call
const SWARM_DONE = NANO_D + NANO_F * 1.1
// where HomeScene attaches the reactor (helmet-group space, not rotated with the armour) and where the socket is
const ATTACH = new THREE.Vector3(...meta.reactorAnchor)
const SOCKET = new THREE.Vector3(...REACTOR)
const _q = new THREE.Quaternion()

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
    g.scale(1.3, 1.12, 0.6)
    g.translate(0, -0.05, -0.45)
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
  const warmWait = useRef(0)
  // hover / click only count while the armour is (mostly) formed: the raycaster does not skip hidden objects, so the
  // invisible hit volume would otherwise answer while the suit is retracted into the reactor
  const live = useRef(false)

  // HUD anchors: four different plates (pauldron cap, pectoral, side rib, abdominal segment), top → bottom
  useEffect(() => {
    dir.helmAnchor = (name, out) => {
      const a = data.anchors[name]
      if (!a || !root.current) return out.set(0, 0, 0)
      const E = chestUniforms.uExplode.value
      // same offset (and breathing) as the vertex shader applies to the plate
      const k = E * (1 + 0.045 * Math.sin(armorUniforms.uTime.value * 1.6 + a.w * 6.2832) * E)
      out.set(a.p[0] + a.e[0] * k, a.p[1] + a.e[1] * k, a.p[2] + a.e[2] * k)
      root.current.updateWorldMatrix(true, false)
      return root.current.localToWorld(out)
    }
    return () => {
      dir.helmAnchor = null
      dir.hover = false
      dir.eyes = 0
      dir.eyeLight = 0
      chestUniforms.uExplode.value = 0
      chestUniforms.uPower.value = 0
      M.glow.uniforms.uLevel.value = 0
    }
  }, [dir, data, M])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1)
    if (CPX_R) armorUniforms.uReveal.value = +CPX_R[1]
    const reveal = armorUniforms.uReveal.value

    // one-time shader warm-up against the real scene (lights, env map) and a render target — the way HomeScene
    // warms the shared materials — so the armour, under-suit, glow and swarm programs exist before the suit-up.
    // Waits for the studio environment map (part of the program key) so the warm-up is not thrown away.
    if (!warmed.current && all.current && (scene.environment || ++warmWait.current > 120)) {
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

    // Pivot round the heart: HomeScene attaches the reactor at a fixed offset that does not turn with the armour, so
    // an armour turned about the stage origin would slide its socket off the reactor (at a strong mouse-look pitch
    // the reactor sank behind the socket floor or stood proud of it). Offset this group so the socket centre always
    // lands on the attachment point, whatever the parent's rotation.
    const g = all.current
    if (g?.parent) {
      _q.copy(g.parent.quaternion).invert()
      g.position.copy(ATTACH).applyQuaternion(_q).sub(SOCKET)
    }

    // below this reveal every armour fragment is discarded → skip the draw calls entirely
    if (root.current) root.current.visible = reveal > NANO_F - 0.01
    live.current = reveal > 0.8
    if (!live.current) dir.hover = false
    swarm.visible = reveal > 0.001 && reveal < SWARM_DONE
    // nanite source: the reactor centre, given in the parent's space → this group's space
    if (sourceRef?.current && g) M.nanites.userData.uni.uSource.value.copy(sourceRef.current).sub(g.position)

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
    chestUniforms.uRim.value = dir.lightScale ?? 1
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
          if (!live.current) return
          e.stopPropagation()
          dir.hover = true
        }}
        onPointerOut={() => (dir.hover = false)}
        onClick={(e) => {
          if (!live.current) return
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
