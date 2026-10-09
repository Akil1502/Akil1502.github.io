import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import { STONES } from '../runes'
import { storm } from '../stormBus'
import { runeTexture, stoneGrainTexture } from './textures'

// The ring of runestones under the hammer: one carved standing stone per skill (10 core in storm-grey, 3 AI tools
// in warmer stone with gold runes). Each carries its rune (glowing additive glyph) and its skill name cut in Cinzel.
//
// ASSEMBLE: the first time the ring is called (fx.ring > 0.3) the stones burst up out of the ground in a shuffled
// order and snap into the ring with an overshoot; fx.ring then sinks / raises the whole ring per beat.
// The ring turns the featured stone (storm.hover, else storm.feature) to the front, which lifts and brightens.
// A struck stone (hit()) blazes, then stays "awake" (its rune keeps glowing).
// ref: { worldPos(i, target), hit(i, power), group }

const N = STONES.length
const STEP = (Math.PI * 2) / N
const RISE = 1.35 // how far below the floor the stones start
const FLY = 0.75
const STAGGER = 0.055
const FONT = '/fonts/Cinzel-ExtraBold.ttf'
const COOL = new THREE.Color('#8fd8ff')
const GOLD = new THREE.Color('#ffcf73')
const WHITE = new THREE.Color('#ffffff')
const NAME_COOL = new THREE.Color('#c9d6e6')
const NAME_GOLD = new THREE.Color('#f2cf86')
// frames rendered (sunk under the floor, so unseen) right after mount, so the stone / rune / text shaders compile
// while the page transition still covers the screen instead of stalling the frame the ring first rises
const WARM_FRAMES = 3

const backOut = (x, c = 1.7) => (x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2))
const wrapAngle = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI

function rng(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// A rough-hewn standing stone: straight-ish flanks, an uneven rounded crown, chipped corners. Base at y = 0.
function stoneGeometry(seed, tier) {
  const r = rng(seed)
  const j = (a) => (r() - 0.5) * a
  const w = 0.31
  const s = new THREE.Shape()
  s.moveTo(-w + j(0.03), 0)
  s.lineTo(w + j(0.03), 0)
  s.lineTo(w + 0.02 + j(0.03), 0.34 + j(0.05))
  s.lineTo(w - 0.01 + j(0.03), 0.66 + j(0.05))
  s.quadraticCurveTo(w - 0.02 + j(0.04), 0.96 + j(0.05), 0.04 + j(0.06), 1.02 + j(0.04))
  s.quadraticCurveTo(-w + 0.02 + j(0.04), 0.98 + j(0.05), -w + j(0.03), 0.62 + j(0.05))
  s.lineTo(-w - 0.02 + j(0.03), 0.3 + j(0.05))
  s.closePath()
  const depth = 0.2
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    steps: 1,
    curveSegments: tier === 'low' ? 4 : 7,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.035,
    bevelSegments: tier === 'low' ? 1 : 2,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

const Runestones = forwardRef(function Runestones({ tier = 'high', fx, radius = 2.7 }, ref) {
  const group = useRef()
  const stoneRefs = useRef([])
  const runeMats = useRef([])
  const textRefs = useRef([])
  const st = useRef({ clock: -1, rot: 0, landed: false, warm: WARM_FRAMES })
  const hit = useMemo(() => new Float32Array(N), [])
  const awake = useMemo(() => new Float32Array(N), [])
  const feat = useMemo(() => new Float32Array(N), [])
  const tmpC = useMemo(() => new THREE.Color(), [])

  const geos = useMemo(() => [stoneGeometry(11, tier), stoneGeometry(29, tier), stoneGeometry(47, tier)], [tier])
  const runeGeo = useMemo(() => new THREE.PlaneGeometry(0.3, 0.45), [])
  const mats = useMemo(() => {
    const grain = stoneGrainTexture()
    return STONES.map(
      (s) =>
        new THREE.MeshStandardMaterial({
          color: s.ai ? '#4b463f' : '#394049',
          roughness: 0.9,
          metalness: 0.06,
          flatShading: true,
          roughnessMap: grain,
          bumpMap: grain,
          bumpScale: 1.2,
          emissive: s.ai ? '#ffb347' : '#5fb8ff',
          emissiveIntensity: 0,
        }),
    )
  }, [])
  const runeMaterials = useMemo(
    () =>
      STONES.map(
        (s) =>
          new THREE.MeshBasicMaterial({
            map: runeTexture(s.rune),
            color: s.ai ? GOLD : COOL,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
      ),
    [],
  )
  runeMats.current = runeMaterials

  // shuffled launch order (seeded) so the ring fills from every side at once
  const delays = useMemo(() => {
    const r = rng(2026)
    const order = STONES.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const k = Math.floor(r() * (i + 1))
      ;[order[i], order[k]] = [order[k], order[i]]
    }
    const d = new Float32Array(N)
    order.forEach((idx, slot) => (d[idx] = slot * STAGGER))
    return d
  }, [])

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose())
      runeGeo.dispose()
      mats.forEach((m) => m.dispose())
      runeMaterials.forEach((m) => m.dispose())
    },
    [geos, runeGeo, mats, runeMaterials],
  )

  useImperativeHandle(
    ref,
    () => ({
      worldPos(i, target) {
        const s = stoneRefs.current[i]
        if (!s) return target.set(0, 0, 0)
        return s.localToWorld(target.set(0, 0.62, 0.16))
      },
      hit(i, power = 1) {
        if (i < 0 || i >= N) return
        hit[i] = Math.max(hit[i], power)
        awake[i] = 1
      },
      get group() {
        return group.current
      },
    }),
    [hit, awake],
  )

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    const d = Math.min(dt, 0.1)
    const s = st.current
    const t = state.clock.elapsedTime
    if (s.clock < 0 && fx.ring > 0.3) s.clock = 0
    if (s.clock < 0) {
      // stones still wait at their mount position (y = -5 local, well under the opaque floor)
      g.visible = s.warm > 0
      if (s.warm > 0) s.warm--
      return
    }
    g.visible = fx.ring > 0.01
    if (!g.visible) return // fully sunk (concepts beat, hand-off): nothing to place or light
    s.clock += d
    const sink = (1 - fx.ring) * (RISE + 1.2)

    // turn the featured stone to the front
    const hov = storm.hover
    const want = hov >= 0 && hov < N ? hov : storm.feature >= 0 && storm.feature < N ? storm.feature : -1
    if (want >= 0) s.rot += wrapAngle(-want * STEP - s.rot) * (1 - Math.pow(0.004, d))
    else s.rot += d * 0.07
    const allLit = fx.allLit

    for (let i = 0; i < N; i++) {
      const stone = stoneRefs.current[i]
      if (!stone) continue
      const k = Math.min(1, Math.max(0, (s.clock - delays[i]) / FLY))
      const e = backOut(k, 1.9)
      feat[i] += ((i === want ? 1 : 0) - feat[i]) * (1 - Math.pow(0.003, d))
      hit[i] *= Math.exp(-d * 3.2)
      if (allLit > 0) awake[i] = Math.max(awake[i], allLit)
      const f = feat[i]
      const a = i * STEP + s.rot
      const rr = radius + f * 0.25
      const bob = Math.sin(t * 1.3 + i * 1.9) * 0.02 * e
      stone.position.set(Math.sin(a) * rr, -RISE * (1 - e) - sink + f * 0.16 + bob, Math.cos(a) * rr)
      stone.rotation.set(-0.05 + (1 - e) * 0.5 * Math.sin(i * 2.3), a + (1 - e) * 1.2 * Math.cos(i), (1 - e) * 0.3 * Math.sin(i * 4.1))
      stone.scale.setScalar(Math.max(1e-4, (0.6 + 0.4 * Math.min(1, k * 2.5)) * (1 + 0.12 * f)))

      const glow = 0.22 + awake[i] * 0.55 + f * 0.6 + hit[i] * 3.2
      const rm = runeMats.current[i]
      if (rm) rm.color.copy(STONES[i].ai ? GOLD : COOL).multiplyScalar(glow * (0.8 + 0.2 * Math.sin(t * 3 + i)))
      mats[i].emissiveIntensity = hit[i] * 0.32 + f * 0.05 + fx.flash * 0.05
      const tx = textRefs.current[i]
      if (tx && tx.material) {
        tmpC.copy(STONES[i].ai ? NAME_GOLD : NAME_COOL).lerp(WHITE, Math.min(1, f * 0.6 + hit[i] * 0.6))
        tx.color = tmpC.getHex()
        tx.fillOpacity = 0.55 + 0.45 * Math.min(1, awake[i] + f)
      }
    }
  })

  return (
    <group ref={group} visible={false}>
      {STONES.map((s, i) => (
        <group
          key={s.name}
          ref={(el) => {
            stoneRefs.current[i] = el
          }}
          position={[0, -5, 0]}
        >
          <mesh geometry={geos[i % 3]} material={mats[i]} castShadow />
          <mesh geometry={runeGeo} material={runeMaterials[i]} position={[0, 0.64, 0.148]} renderOrder={4} />
          <Text
            ref={(el) => {
              textRefs.current[i] = el
            }}
            font={FONT}
            fontSize={s.name.length > 16 ? 0.052 : 0.064}
            maxWidth={0.52}
            lineHeight={1.05}
            letterSpacing={0.03}
            textAlign="center"
            anchorX="center"
            anchorY="top"
            position={[0, 0.34, 0.15]}
            color={s.ai ? '#f2cf86' : '#c9d6e6'}
            material-side={THREE.FrontSide}
            material-toneMapped={false}
          >
            {s.name.toUpperCase()}
          </Text>
        </group>
      ))}
    </group>
  )
})

export default Runestones
