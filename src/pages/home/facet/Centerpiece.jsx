import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { armorUniforms, patchArmor, NANO_F } from '../three/armor'
import { disposeAll } from '../three/useDispose'
import { home } from '../homeStore'
import { buildFacetHelmet } from './facetGeometry'
import FacetNanites from './FacetNanites'
import { makeFacetEnv } from './facetEnv'

// FACETED HELMET — the Home centrepiece re-sculpted as a low-poly "designer collectible": a candy-red shell (crest,
// crown, side plates radiating from the ear pods, outer jaw, back) framing a polished gold faceplate built from a few
// large symmetric planes (chevron forehead, cheekbones, muzzle, chin), crisp chamfered plate borders, thin glowing
// seams on a dark under-suit and angular eye slits with a white-hot core.
// Contract (see CENTERPIECE_BRIEF.md): nanotech suit-up driven by armorUniforms.uReveal, lamp-strike power-up,
// exploded diagnostic view (dir.explode), HUD anchors (dir.helmAnchor), hover/click interaction.

// Lamp-strike flicker: [0, 0.7, 0.15, 1, 0.4, 1] over 0.7 s
const STRIKE = [0, 0.7, 0.15, 1, 0.4, 1]
function strikeAt(t) {
  if (t >= 0.7) return 1
  const f = (t / 0.7) * (STRIKE.length - 1)
  const i = Math.floor(f)
  return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (f - i)
}

// Exploded-view choreography — an engineering "expanded assembly": the gold faceplate hinges forward/up as one
// visor (its plates also part a little so every seam reads), the red shell opens around it: crest and crown lift,
// the side plates and outer jaw slide out sideways, the back plates step back. Every plate moves along its own
// outward direction (average normal blended with the radial direction) plus a hand-tuned offset.
//   d: distance along the outward direction · add: extra offset (x mirrored per side) · tilt: fan angle (x, y, z;
//   y/z mirrored per side) · face: part of the hinged visor
const EXPLODE = {
  // the visor stays one readable faceplate: its plates only part by a seam-width or two
  forehead: { face: true, d: 0.02, add: [0, 0.035, 0.01] },
  muzzle: { face: true, d: 0.04, add: [0, -0.01, 0.035] },
  cheek: { face: true, d: 0.03, add: [0.055, -0.01, 0] },
  chin: { face: true, d: 0.03, add: [0, -0.055, 0.02] },
  crest: { d: 0.28, add: [0, 0.16, -0.06], tilt: [-0.14, 0, 0] },
  crown: { d: 0.3, add: [0.1, 0.1, -0.05], tilt: [-0.06, 0, -0.16] },
  temple: { d: 0.16, add: [0.36, 0.02, -0.06], tilt: [0, 0.12, -0.08] },
  jaw: { d: 0.18, add: [0.24, -0.18, 0.04], tilt: [0.1, 0, 0.1] },
  backU: { d: 0.3, add: [0, 0.1, -0.1], tilt: [0.12, 0, 0] },
  backM: { d: 0.36, add: [0, 0, -0.12], tilt: [0, 0, 0] },
  backL: { d: 0.3, add: [0, -0.1, -0.1], tilt: [-0.12, 0, 0] },
}
// the visor hinge: a pivot inside the head above the forehead, swung so the chin comes forward and up
const HINGE_P = new THREE.Vector3(0, 0.78, 0.2)
const HINGE_Q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.42)
const HINGE_LIFT = new THREE.Vector3(0, 0.12, 0.3)
const CENTER = new THREE.Vector3(0, -0.05, 0)
// dev-only inspection switches (pair with HomeScene's ?hd=…): ?fx=0..1 forces the exploded view, ?rv=0..1.1 freezes
// the nanotech reveal (suit-up mid-flight)
const DBG_Q = import.meta.env.DEV && typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const DBG_FX = DBG_Q ? parseFloat(DBG_Q.get('fx')) : NaN
const DBG_RV = DBG_Q ? parseFloat(DBG_Q.get('rv')) : NaN
const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
const _n = new THREE.Vector3()
const _id = new THREE.Quaternion()
// eye halos: on the low tier (phones) there is no bloom pass, so the sprites alone have to carry the glow
const HALO = { high: { w: 0.42, h: 0.1, o: 0.75 }, low: { w: 0.6, h: 0.16, o: 1.05 } }

function makeMaterials(tier, shared) {
  const hi = tier !== 'low'
  const Phys = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial
  // same features as the shared armour materials (+ a private env map of the same PMREM size, assigned on the first
  // frame) → same shader programs as the ones the scene warm-up already compiled; only the gold (tint patch) and the
  // eye slits need programs of their own, linked by the one-off warm-up in the frame loop
  // candy-apple red: a saturated metallic base under a mirror clearcoat (the facets flash white as they turn)
  const red = patchArmor(
    new Phys({
      color: '#a00914',
      metalness: 0.55,
      roughness: 0.24,
      envMapIntensity: 1.35,
      ...(hi ? { clearcoat: 1, clearcoatRoughness: 0.05 } : {}),
    }),
  )
  // polished gold faceplate (own program key: its shader carries the gold-tint patch below)
  const gold = goldTint(
    patchArmor(
      new Phys({ color: '#e8b25a', metalness: 1, roughness: 0.26, envMapIntensity: 1.2, ...(hi ? { clearcoat: 0.18, clearcoatRoughness: 0.32 } : {}) }),
      { key: 'facet-gold' },
    ),
  )
  const gun = patchArmor(new THREE.MeshStandardMaterial({ color: '#2a2c33', metalness: 0.95, roughness: 0.3, envMapIntensity: 1.15 }))
  const silver = patchArmor(new THREE.MeshStandardMaterial({ color: '#c2c7d1', metalness: 1, roughness: 0.2, envMapIntensity: 1.2 }))
  const seam = patchArmor(
    new THREE.MeshStandardMaterial({ color: '#000000', metalness: 0, roughness: 1, envMapIntensity: 0, emissive: '#ffa04a', emissiveIntensity: 0 }),
  )
  // ear-pod glow channels: one material per ear (same program) so each can fade on its own as it turns edge-on
  const glowR = patchArmor(
    new THREE.MeshStandardMaterial({ color: '#000000', metalness: 0, roughness: 1, envMapIntensity: 0, emissive: '#8ff0ff', emissiveIntensity: 0 }),
  )
  const glowL = patchArmor(glowR.clone())
  // eye slits: vertex colours carry the cyan lens + white-hot core, `color` is the power level (HDR → bloom)
  const eye = new THREE.MeshBasicMaterial({ color: '#000000', vertexColors: true, toneMapped: false })
  return { red, gold, gun, silver, seam, glowR, glowL, eye, under: shared.under }
}

// The scene's cyan lights (the rim light behind the helmet and the reactor under the chin) mirrored by gold metal
// come out lime green on the cheeks and olive on the chin. Polished gold never reads green, so the DIRECT specular of
// the gold is pulled toward the gold hue at the same luminance (the warm studio reflections are untouched).
function goldTint(mat, k = 0.85) {
  const base = mat.onBeforeCompile
  const c = mat.color // linear working space
  const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
  const uGoldTint = { value: new THREE.Vector3(c.r / lum, c.g / lum, c.b / lum) }
  mat.onBeforeCompile = (shader, renderer) => {
    base(shader, renderer)
    shader.uniforms.uGoldTint = uGoldTint
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uGoldTint;').replace(
      '#include <aomap_fragment>',
      `{
  float gLum = dot(reflectedLight.directSpecular, vec3(0.2126, 0.7152, 0.0722));
  reflectedLight.directSpecular = mix(reflectedLight.directSpecular, gLum * uGoldTint, ${k.toFixed(2)});
}
#include <aomap_fragment>`,
    )
  }
  return mat
}

export default function Centerpiece({ dir, tier = 'high', mats, naniteMat, count = 5000, sourceRef }) {
  // selectors: a bare useThree() would re-render the whole piece on every store change (resize, pointer...)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const H = useMemo(() => buildFacetHelmet({ low: tier === 'low' }), [tier])
  const env = useRef(null)
  const M = useMemo(() => makeMaterials(tier, mats), [tier, mats])
  const glowTex = useMemo(() => makeGlowTexture(), [])
  const nanoParts = useMemo(() => {
    const c = { gold: '#e3a83c', red: '#b0121a' }
    return [...H.plates.map((p) => [p.sample, c[p.mat]]), ...H.ears.map((e) => [e.cap, '#9aa0aa'])]
  }, [H])

  useEffect(
    () => () => {
      disposeAll(
        H.plates.map((p) => [p.geometry, p.sample]),
        H.seams,
        H.skull,
        H.eyes,
        H.neck,
        H.ears.map((e) => [e.bezel, e.cap, e.glow]),
      )
    },
    [H],
  )
  useEffect(
    () => () => {
      const { under, ...own } = M // `under` is the scene's shared material
      void under
      disposeAll(own)
    },
    [M],
  )
  useEffect(() => () => glowTex.dispose(), [glowTex])
  useEffect(
    () => () => {
      env.current?.dispose()
      env.current = null
    },
    [],
  )

  // per-plate exploded-view targets (pivot = plate centroid): target position + target orientation at E = 1
  const rig = useMemo(
    () =>
      H.plates.map((p) => {
        const fam = p.name.replace(/[RL]$/, '')
        const cfg = EXPLODE[fam] || { d: 0.3 }
        const side = p.side || 1
        const off = _v.copy(p.centroid).sub(CENTER).normalize().add(p.normal).normalize().clone().multiplyScalar(cfg.d)
        if (cfg.add) off.add(new THREE.Vector3(cfg.add[0] * side, cfg.add[1], cfg.add[2]))
        const tl = cfg.tilt || [0, 0, 0]
        let rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(tl[0], tl[1] * side, tl[2] * side))
        let pos
        if (cfg.face) {
          // rigid visor swing about the hinge, then the plate's own small parting move in the visor's frame
          pos = p.centroid.clone().sub(HINGE_P).applyQuaternion(HINGE_Q).add(HINGE_P).add(HINGE_LIFT).add(off.applyQuaternion(HINGE_Q))
          rot = HINGE_Q.clone().multiply(rot)
        } else pos = p.centroid.clone().add(off)
        return { pos, rot, phase: p.centroid.x * 3 + p.centroid.y * 5 }
      }),
    [H],
  )
  const foreheadIdx = useMemo(() => H.plates.findIndex((p) => p.name === 'forehead'), [H])

  const root = useRef()
  const pivots = useRef([])
  const hosts = useRef({})
  const ears = useRef([])
  const neck = useRef()
  const eyeMesh = useRef()
  const eyeGlow = useRef([])
  const strike = useRef({ on: false, t: 10, level: 0, fired: false })
  const warmed = useRef(false)

  // HUD anchors (world space), glued to the plate they describe
  useEffect(() => {
    dir.helmAnchor = (name, out) => {
      const a = H.anchors[name]
      const host = a && hosts.current[a.plate]
      if (!host) return out.set(0, 0, 0)
      return host.localToWorld(out.copy(a.p))
    }
    return () => {
      dir.helmAnchor = null
      dir.hover = false // unmounting under the cursor must not leave the glow stuck on
    }
  }, [dir, H])
  // pointer: only a formed (visible) helmet reacts — the meshes stay raycastable while the armour is retracted
  const live = () => !!root.current?.visible && armorUniforms.uReveal.value > 0.9

  useFrame((state, delta) => {
    // private reflection studio: baked inside the frame loop (a bake during React's render phase comes out black)
    if (!env.current) env.current = makeFacetEnv(gl)
    const envTex = env.current.texture
    if (M.gold.envMap !== envTex) for (const m of [M.red, M.gold, M.gun, M.silver]) m.envMap = envTex
    // slow light sweep: the studio swings a little so single facets glint in turn, like a turntable product shot
    const sweep = Math.sin(state.clock.elapsedTime * 0.32) * 0.22
    M.red.envMapRotation.y = M.gold.envMapRotation.y = M.gun.envMapRotation.y = M.silver.envMapRotation.y = sweep
    // one-off safety net: link this piece's programs before its first visible frame (the scene warm-up already
    // covers the shared armour programs most of these materials map onto; what is left is the gold's tinted program,
    // which would otherwise stall the first frame of the suit-up, and the eye-slit material, which would otherwise
    // compile at the very moment of the power-up). compile() skips invisible objects, so the root and the eye mesh
    // are shown for the duration of the call.
    if (!warmed.current && root.current && eyeMesh.current && scene.environment) {
      warmed.current = true
      const prev = gl.getRenderTarget()
      const rt = tier !== 'low' ? new THREE.WebGLRenderTarget(1, 1) : null
      const rootVis = root.current.visible
      const eyeVis = eyeMesh.current.visible
      root.current.visible = eyeMesh.current.visible = true
      try {
        if (rt) gl.setRenderTarget(rt)
        const compiled = gl.compile(root.current, camera, scene)
        // without parallel compile the link would otherwise land on the first visible frame of the suit-up: force
        // it now, while only the reactor is on stage
        if (!gl.extensions.has('KHR_parallel_shader_compile'))
          for (const m of compiled) gl.properties.get(m)?.currentProgram?.getUniforms()
      } catch {
        /* compiles on first draw instead */
      } finally {
        root.current.visible = rootVis
        eyeMesh.current.visible = eyeVis
        gl.setRenderTarget(prev)
        rt?.dispose()
      }
    }
    const dt = Math.min(delta, 0.1)
    if (!Number.isNaN(DBG_RV)) armorUniforms.uReveal.value = DBG_RV
    const reveal = armorUniforms.uReveal.value
    if (root.current) root.current.visible = reveal > NANO_F - 0.01
    if (dir.hover && reveal <= 0.9) dir.hover = false // retracted under a still cursor (no pointer-out fires)
    const t = state.clock.elapsedTime
    const E = Number.isNaN(DBG_FX) ? dir.explode || 0 : DBG_FX
    const Ee = E * E * (3 - 2 * E)

    // exploded view: plates slide out along their normals and fan open, with a small idle breathing
    for (let i = 0; i < rig.length; i++) {
      const g = pivots.current[i]
      if (!g) continue
      const r = rig[i]
      const k = Ee * (1 + E * 0.045 * Math.sin(t * 1.6 + r.phase))
      const c = H.plates[i].centroid
      g.position.set(c.x + (r.pos.x - c.x) * k, c.y + (r.pos.y - c.y) * k, c.z + (r.pos.z - c.z) * k)
      g.quaternion.copy(_id).slerp(r.rot, Ee)
    }
    for (let i = 0; i < 2; i++) {
      const g = ears.current[i]
      if (!g) continue
      const e = H.ears[i]
      const k = Ee * (0.95 + 0.04 * Math.sin(t * 1.8 + i))
      g.position.copy(e.center).addScaledVector(e.normal, 0.78 * k)
      g.quaternion.setFromAxisAngle(e.normal, Ee * 0.6 * e.side)
    }
    if (neck.current) neck.current.position.set(0, -0.32 * Ee, -0.04 * Ee)

    // power-up: lamp strike once the suit is fully formed; quick fade when the armour retracts
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
    const lvl = s.level * flare
    dir.eyes = s.level
    // the scene's eye light: kept very low — on polished metal a point light only paints a hot blob on the nose
    // bridge; the slits themselves (HDR emissive + bloom + halos) carry the glow
    dir.eyeLight = lvl * 0.06

    // hero select: the helmet watches from behind the glass cards → eyes and seams burn a little hotter so its
    // silhouette still reads through them
    const bg = THREE.MathUtils.smoothstep(home.b, 3.85, 4.2)
    const ek = lvl * (1.55 + 0.9 * bg)
    M.eye.color.setRGB(ek, ek, ek)
    if (eyeMesh.current) eyeMesh.current.visible = s.level > 0.002
    const halo = tier === 'low' ? HALO.low : HALO.high
    for (let i = 0; i < eyeGlow.current.length; i++) {
      const g = eyeGlow.current[i]
      if (!g) continue
      // the halos ignore depth (they must bloom over the brow), so each one fades as its eye turns away from the
      // camera — otherwise the far eye would glow through the head in the turned beats
      const e = H.eyeC[i]
      g.getWorldPosition(_w)
      _n.copy(e.n).transformDirection(g.parent.matrixWorld)
      const facing = THREE.MathUtils.smoothstep(_n.dot(_v.copy(state.camera.position).sub(_w).normalize()), 0.08, 0.42)
      const op = Math.min(1, lvl * (halo.o + 0.25 * bg)) * facing
      g.visible = op > 0.003
      g.material.opacity = op
      g.scale.set(halo.w * (1 + 0.07 * Math.sin(t * 9 + i) * s.level), halo.h, 1)
    }
    // seams: a dim ember glow while forming, full power with the eyes, brighter in the diagnostic / on hover
    const pulse = 0.85 + 0.15 * Math.sin(t * 2.2)
    // (dimmed while exploded so the cyan circuitry of the under-suit reads)
    M.seam.emissiveIntensity = (0.25 + 1.5 * lvl * pulse) * (1 - E * 0.7) * (1 + 0.6 * bg)
    // ear rings: each fades as its pod turns edge-on (seen from the front a ring is only a hot sliver on the
    // silhouette, right next to the eye)
    for (let i = 0; i < 2; i++) {
      const g = ears.current[i]
      if (!g) continue
      const e = H.ears[i]
      g.getWorldPosition(_w)
      _n.copy(e.normal).transformDirection(g.matrixWorld)
      const facing = THREE.MathUtils.smoothstep(_n.dot(_v.copy(state.camera.position).sub(_w).normalize()), 0.12, 0.5)
      ;(e.side > 0 ? M.glowR : M.glowL).emissiveIntensity = (0.2 + 1.3 * lvl * pulse) * facing
    }
  })

  const regHost = (k) => (el) => {
    if (el) hosts.current[k] = el
  }

  return (
    <>
      <group
        ref={root}
        visible={false}
        onPointerOver={(e) => {
          if (!live()) return
          e.stopPropagation()
          dir.hover = true
        }}
        onPointerOut={() => (dir.hover = false)}
        onClick={(e) => {
          if (!live()) return
          e.stopPropagation()
          dir.onRepulsor?.()
        }}
      >
        {/* dark under-suit (circuitry in the diagnostic) + the glowing seam ribbons that show between plates */}
        <mesh geometry={H.skull} material={M.under} />
        <mesh geometry={H.seams} material={M.seam} />
        {H.plates.map((p, i) => (
          <group key={p.name} ref={(el) => (pivots.current[i] = el)} position={p.centroid}>
            <mesh ref={regHost(p.name)} position={[-p.centroid.x, -p.centroid.y, -p.centroid.z]} geometry={p.geometry} material={M[p.mat]} />
            {i === foreheadIdx ? (
              // the eye slits + their halos ride on the forehead plate (they open with the visor)
              <group position={[-p.centroid.x, -p.centroid.y, -p.centroid.z]}>
                <mesh ref={eyeMesh} geometry={H.eyes} material={M.eye} renderOrder={2} visible={false} />
                {H.eyeC.map((e, k) => (
                  <sprite
                    key={k}
                    ref={(el) => (eyeGlow.current[k] = el)}
                    position={[e.p.x, e.p.y, e.p.z + 0.02]}
                    scale={[0.42, 0.1, 1]}
                    renderOrder={3}
                  >
                    <spriteMaterial
                      map={glowTex}
                      color={'#a6f4ff'}
                      rotation={Math.atan2(e.ax.y, Math.abs(e.ax.x)) * Math.sign(e.p.x)}
                      transparent
                      opacity={0}
                      depthWrite={false}
                      depthTest={false}
                      blending={THREE.AdditiveBlending}
                      toneMapped={false}
                    />
                  </sprite>
                ))}
              </group>
            ) : null}
          </group>
        ))}

        {H.ears.map((e, i) => (
          <group key={i} ref={(el) => (ears.current[i] = el)} position={e.center}>
            <group position={[-e.center.x, -e.center.y, -e.center.z]}>
              <mesh ref={regHost(e.side > 0 ? 'earR' : 'earL')} geometry={e.bezel} material={M.gun} />
              <mesh geometry={e.cap} material={M.silver} />
              <mesh geometry={e.glow} material={e.side > 0 ? M.glowR : M.glowL} />
            </group>
          </group>
        ))}

        <group ref={neck}>
          <mesh geometry={H.neck} material={M.gun} />
        </group>
      </group>
      {/* the swarm flies while the solid root is still hidden */}
      <FacetNanites parts={nanoParts} count={count} sourceRef={sourceRef} material={naniteMat} />
    </>
  )
}

// soft radial glow for the eye halos
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(210,248,255,0.75)')
  grd.addColorStop(0.3, 'rgba(140,232,255,0.3)')
  grd.addColorStop(0.65, 'rgba(90,210,255,0.07)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
