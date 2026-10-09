import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { lensY, enamelTextures, discTextures, lidTextures, irisTexture } from './textures'

/*
 * THE ARCHIVE EYE — an original, procedural amulet (homage, not a replica):
 *   medallion  : a filled back disc engraved with a star + rune band, two gold rings, four studs, and two leaf
 *                crests (top / bottom)
 *   frame      : an eye-shaped (lens) gold frame, extruded + bevelled, ringed with glowing rune ticks, curled
 *                filigree tendrils at both tips and a small amber gem at each point
 *   enamel     : the violet "sclera" plate inside the frame, engraved with concentric channels
 *   chamber    : a gold bezel ring with 36 teeth and a rotating iris disc of green filaments
 *   gem        : a faceted emerald with an additive glow sprite and its own green light
 *   lids       : two engraved gold half-domes hinged on the horizontal diameter; they swing back to open the eye.
 *                A green seam glows between them while closed.
 *
 * Driven by the mutable `api` prop (written by the rig every frame):
 *   intro 0..1 (reverse-explosion assembly), open 0..1, explode 0..1 (layers separate in z), glow 0..1 (gem),
 *   runes 0..1 (engraving glow), green 0..1 (engravings turn emerald), flash 0..1, highlight (-1 | layer index)
 */
const TAU = Math.PI * 2
const OW = 1.45 // outer lens half-width
const OH = 0.8 // outer lens half-height
const IW = 1.2
const IH = 0.62
const CH = 0.46 // chamber radius
const LID_Z = 0.03

const ORANGE = new THREE.Color('#ff9a2e')
const EMERALD = new THREE.Color('#38f29a')
const tmpC = new THREE.Color()
const tmpObj = new THREE.Object3D()

function lensShape(W, H, n = 64) {
  const s = new THREE.Shape()
  for (let i = 0; i <= n; i++) {
    const x = W - (2 * W * i) / n
    const y = lensY(x, W, H)
    if (i === 0) s.moveTo(x, y)
    else s.lineTo(x, y)
  }
  for (let i = 1; i < n; i++) {
    const x = -W + (2 * W * i) / n
    s.lineTo(x, -lensY(x, W, H))
  }
  s.closePath()
  return s
}
function lensPath(W, H, n = 64) {
  const p = new THREE.Path()
  for (let i = 0; i <= n; i++) {
    const x = W - (2 * W * i) / n
    const y = lensY(x, W, H)
    if (i === 0) p.moveTo(x, y)
    else p.lineTo(x, y)
  }
  for (let i = 1; i < n; i++) {
    const x = -W + (2 * W * i) / n
    p.lineTo(x, -lensY(x, W, H))
  }
  p.closePath()
  return p
}
function merge(parts) {
  const flat = parts.map((g) => (g.index ? g.toNonIndexed() : g))
  flat.forEach((g) => {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
  })
  return mergeGeometries(flat, false) || flat[0]
}

// Where each layer flies in from during the reverse-explosion intro (and its tumble).
const SCATTER = {
  medallion: [0.0, -2.6, -3.5, 1.2, 0.4, -0.8],
  frame: [3.2, 1.2, 1.5, -0.6, 1.6, 0.5],
  enamel: [-3.0, 1.6, -1.0, 0.8, -1.2, 0.6],
  chamber: [-2.2, -1.8, 2.5, -1.4, 0.6, 1.4],
  gem: [0.6, 2.4, 3.5, 2.0, 2.0, 0.0],
  lids: [2.4, -2.2, 2.8, 1.0, -1.6, -0.9],
}
// z separation of each layer in the exploded (codex) view
const EXPLODE_Z = { medallion: -1.5, frame: 0, enamel: -0.75, chamber: 0.75, gem: 1.45, lids: 2.15 }
const LAYERS = ['medallion', 'frame', 'enamel', 'chamber', 'gem', 'lids']

const easeIn = (k) => k * k * k
const clamp01 = (v) => Math.max(0, Math.min(1, v))

export default function Amulet({ api, tier = 'high' }) {
  const groups = useRef({})
  const lidTop = useRef()
  const lidBot = useRef()
  const iris = useRef()
  const teeth = useRef()
  const gem = useRef()
  const glow = useRef()
  const gemLight = useRef()
  const runesRef = useRef()
  const seam = useRef()
  const spin = useRef({ iris: 0, teeth: 0, gem: 0 })

  const hi = tier !== 'low'

  // ---------------- geometry ----------------
  const geo = useMemo(() => {
    // frame: outer lens with the inner lens as a hole
    const fs = lensShape(OW, OH)
    fs.holes.push(lensPath(IW, IH))
    const frame = new THREE.ExtrudeGeometry(fs, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: hi ? 4 : 2, curveSegments: 8 })
    frame.translate(0, 0, -0.06)
    frame.computeVertexNormals()

    // enamel plate (slightly larger than the hole, tucked behind the frame)
    const enamel = new THREE.ShapeGeometry(lensShape(IW + 0.04, IH + 0.03), 1)

    // medallion: back disc + rings + studs
    const disc = new THREE.CircleGeometry(0.99, 96)
    const ringA = new THREE.TorusGeometry(0.985, 0.045, 16, 140)
    const ringB = new THREE.TorusGeometry(1.08, 0.016, 8, 140)
    const studs = []
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k / 4) * TAU
      studs.push(new THREE.SphereGeometry(0.05, 16, 12).translate(Math.cos(a) * 1.03, Math.sin(a) * 1.03, 0.0))
    }
    // leaf crests (top + bottom)
    const leaf = new THREE.Shape()
    leaf.moveTo(0, 0.44)
    leaf.quadraticCurveTo(0.2, 0.17, 0.11, 0)
    leaf.lineTo(-0.11, 0)
    leaf.quadraticCurveTo(-0.2, 0.17, 0, 0.44)
    const leafHole = new THREE.Path()
    leafHole.moveTo(0, 0.3)
    leafHole.quadraticCurveTo(0.08, 0.15, 0.04, 0.07)
    leafHole.lineTo(-0.04, 0.07)
    leafHole.quadraticCurveTo(-0.08, 0.15, 0, 0.3)
    leaf.holes.push(leafHole)
    const leafG = new THREE.ExtrudeGeometry(leaf, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.018, bevelSegments: 2, curveSegments: 12 })
    leafG.translate(0, 0, -0.045)
    const crestTop = leafG.clone().translate(0, 0.98, -0.02)
    const crestBot = leafG.clone().rotateZ(Math.PI).translate(0, -0.98, -0.02)
    const medallionGold = merge([ringA, ringB, ...studs, crestTop, crestBot])

    // tendrils: curled filigree at both tips (4 tubes)
    const curl = [
      [1.36, 0.04],
      [1.52, 0.14],
      [1.66, 0.32],
      [1.64, 0.52],
      [1.5, 0.6],
      [1.38, 0.52],
      [1.4, 0.4],
      [1.5, 0.38],
    ]
    const tubes = []
    for (const sx of [1, -1])
      for (const sy of [1, -1]) {
        const pts = curl.map(([x, y], i) => new THREE.Vector3(x * sx, y * sy, -0.02 - i * 0.006))
        const c = new THREE.CatmullRomCurve3(pts)
        tubes.push(new THREE.TubeGeometry(c, hi ? 64 : 32, 0.03, 8, false))
        tubes.push(new THREE.SphereGeometry(0.045, 12, 10).translate(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[pts.length - 1].z))
      }
    const tendrils = merge(tubes)

    // tip gems
    const tipGems = merge([new THREE.OctahedronGeometry(0.075, 0).scale(1.4, 1, 0.7).translate(1.57, 0, 0.0), new THREE.OctahedronGeometry(0.075, 0).scale(1.4, 1, 0.7).translate(-1.57, 0, 0.0)])

    // chamber bezel
    const bezel = new THREE.TorusGeometry(CH, 0.045, 16, 96)
    const tooth = new THREE.BoxGeometry(0.035, 0.05, 0.03)
    const irisG = new THREE.RingGeometry(0.16, CH - 0.02, 64, 1)

    // gem: faceted
    const gemG = new THREE.IcosahedronGeometry(0.2, 0)
    gemG.scale(1, 1, 0.72)
    gemG.computeVertexNormals()

    // lids: half-domes facing +z (upper lid phi PI..2PI, lower 0..PI after rotateX(PI/2))
    const lidT = new THREE.SphereGeometry(CH + 0.01, 48, 16, Math.PI, Math.PI, 0, Math.PI / 2)
    lidT.rotateX(Math.PI / 2)
    lidT.scale(1, 1, 0.48)
    const lidB = new THREE.SphereGeometry(CH + 0.01, 48, 16, 0, Math.PI, 0, Math.PI / 2)
    lidB.rotateX(Math.PI / 2)
    lidB.scale(1, 1, 0.48)
    // lid rims (half tori lying in the hinge plane)
    const rimT = new THREE.TorusGeometry(CH + 0.012, 0.018, 8, 48, Math.PI)
    const rimB = new THREE.TorusGeometry(CH + 0.012, 0.018, 8, 48, Math.PI).rotateZ(Math.PI)

    // seam: thin glowing tube along the meeting line of the two lids, over the dome
    const seamPts = []
    for (let i = 0; i <= 40; i++) {
      const x = -CH + (2 * CH * i) / 40
      const z = Math.sqrt(Math.max(0, CH * CH - x * x)) * 0.48
      seamPts.push(new THREE.Vector3(x, 0, z + 0.004))
    }
    const seamG = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts), 48, 0.009, 6, false)

    // rune ticks along the frame's front face (instanced)
    const runeTick = new THREE.BoxGeometry(0.014, 0.06, 0.006)

    return { frame, enamel, disc, medallionGold, tendrils, tipGems, bezel, tooth, irisG, gemG, lidT, lidB, rimT, rimB, seamG, runeTick, glowPlane: new THREE.PlaneGeometry(1.6, 1.6) }
  }, [hi])

  // ---------------- textures + materials ----------------
  const tx = useMemo(() => ({ enamel: enamelTextures(IW + 0.04, IH + 0.03), disc: discTextures(), lid: lidTextures(), iris: irisTexture() }), [])
  const mat = useMemo(() => {
    const gold = new THREE.MeshStandardMaterial({ color: '#f2bd5c', metalness: 0.88, roughness: 0.3, envMapIntensity: 2.4, emissive: '#3a2008', emissiveIntensity: 0.6 })
    const goldDark = new THREE.MeshStandardMaterial({ color: '#d39a42', metalness: 0.9, roughness: 0.32, envMapIntensity: 2, emissive: '#2a1606', emissiveIntensity: 0.6 })
    const frameGold = new THREE.MeshStandardMaterial({ color: '#f5c46a', metalness: 0.82, roughness: 0.36, envMapIntensity: 2.6, emissive: '#3d2309', emissiveIntensity: 0.7 })
    const lid = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tx.lid.map, metalness: 0.78, roughness: 0.34, envMapIntensity: 2.2, emissive: '#ff9a2e', emissiveMap: tx.lid.emit, emissiveIntensity: 0.0 })
    const enamel = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tx.enamel.map, metalness: 0.35, roughness: 0.32, envMapIntensity: 0.8, emissive: '#ff9a2e', emissiveMap: tx.enamel.emit, emissiveIntensity: 0.5 })
    const disc = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tx.disc.map, metalness: 0.4, roughness: 0.4, envMapIntensity: 0.7, emissive: '#ff9a2e', emissiveMap: tx.disc.emit, emissiveIntensity: 0.4 })
    const iris = new THREE.MeshBasicMaterial({ color: '#38f29a', map: tx.iris, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    const gemM = new THREE.MeshStandardMaterial({ color: '#2fd88a', emissive: '#38f29a', emissiveIntensity: 1.2, metalness: 0.2, roughness: 0.12, flatShading: true, envMapIntensity: 2, toneMapped: false })
    const amber = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff8a1e', emissiveIntensity: 0.8, metalness: 0.3, roughness: 0.15, flatShading: true, toneMapped: false })
    const seamM = new THREE.MeshBasicMaterial({ color: '#38f29a', toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    const rune = new THREE.MeshBasicMaterial({ color: '#ff9a2e', toneMapped: false })
    const glowM = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color('#38f29a') }, uIntensity: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader:
        'uniform vec3 uColor; uniform float uIntensity; varying vec2 vUv; void main(){ float d = length(vUv-0.5)*2.0; float g = exp(-d*d*6.0)*0.9 + exp(-d*14.0)*1.2; gl_FragColor = vec4(uColor*g*uIntensity, 1.0); }',
    })
    return { gold, goldDark, frameGold, lid, enamel, disc, iris, gem: gemM, amber, seam: seamM, rune, glow: glowM }
  }, [tx])

  useLayoutEffect(
    () => () => {
      Object.values(geo).forEach((g) => g.dispose?.())
      Object.values(mat).forEach((m) => m.dispose?.())
      Object.values(tx).forEach((t) => {
        if (t.isTexture) t.dispose()
        else Object.values(t).forEach((u) => u.dispose?.())
      })
    },
    [geo, mat, tx],
  )

  // instanced layouts (static)
  const RUNES = 44
  useLayoutEffect(() => {
    const m = runesRef.current
    if (m) {
      let k = 0
      let s = 77
      const r = () => {
        s = (s * 9301 + 49297) % 233280
        return s / 233280
      }
      for (const side of [1, -1]) {
        for (let i = 0; i < RUNES / 2; i++) {
          const x = -1.02 + (2.04 * (i + 0.5)) / (RUNES / 2)
          const yo = lensY(x, OW, OH)
          const yi = lensY(x, IW, IH)
          const y = ((yo + yi) / 2) * side
          // tangent of the mid curve -> tick stands along the normal
          const dx = 0.01
          const y2 = ((lensY(x + dx, OW, OH) + lensY(x + dx, IW, IH)) / 2) * side
          const ang = Math.atan2(y2 - y, dx)
          tmpObj.position.set(x, y, 0.1)
          tmpObj.rotation.set(0, 0, ang)
          const big = r()
          tmpObj.scale.set(1, 0.55 + big * 0.7, 1)
          tmpObj.updateMatrix()
          m.setMatrixAt(k++, tmpObj.matrix)
        }
      }
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    const t = teeth.current
    if (t) {
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TAU
        tmpObj.position.set(Math.cos(a) * (CH + 0.06), Math.sin(a) * (CH + 0.06), 0.02)
        tmpObj.rotation.set(0, 0, a + Math.PI / 2)
        tmpObj.scale.set(1, i % 3 === 0 ? 1.5 : 1, 1)
        tmpObj.updateMatrix()
        t.setMatrixAt(i, tmpObj.matrix)
      }
      t.instanceMatrix.needsUpdate = true
      t.computeBoundingSphere()
    }
  }, [geo])

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    const A = api
    const intro = clamp01(A.intro ?? 1)
    const ex = A.explode || 0
    const G = groups.current

    // layers: intro scatter (reverse explosion: accelerates into place) + exploded-view z separation
    for (let li = 0; li < LAYERS.length; li++) {
      const name = LAYERS[li]
      const g = G[name]
      if (!g) continue
      const sc = SCATTER[name]
      // layers land one after another (outer first), each over 0.55 of the intro
      const k = clamp01((intro - li * 0.08) / 0.6)
      const rem = 1 - easeIn(k)
      const hl = A.highlight === li ? 1 : 0
      g.position.set(sc[0] * rem, sc[1] * rem, sc[2] * rem + EXPLODE_Z[name] * ex + hl * 0.12)
      g.rotation.set(sc[3] * rem, sc[4] * rem, sc[5] * rem)
      g.visible = k > 0.001
    }
    // the gem's light lives outside the layer groups (their visibility toggles during the intro, and a light
    // that appears/disappears changes the scene's light count = a shader recompile hitch): it follows the gem
    // layer and is simply dark until that layer has landed
    const gemG = G.gem
    const gemIn = gemG && gemG.visible ? 1 : 0
    if (gemLight.current && gemG) gemLight.current.position.set(gemG.position.x, gemG.position.y, gemG.position.z + 0.6)

    // eyelids
    const open = clamp01(A.open || 0)
    const o = 1 - Math.pow(1 - open, 2)
    if (lidTop.current) lidTop.current.rotation.x = -o * 1.5
    if (lidBot.current) lidBot.current.rotation.x = o * 1.5

    // chamber motion
    const glowV = clamp01(A.glow || 0)
    const flash = A.flash || 0
    const S = spin.current
    S.iris -= dt * (0.25 + glowV * 1.4 + (A.rewind || 0) * 3)
    S.teeth += dt * (0.12 + glowV * 0.3)
    S.gem += dt * (0.5 + glowV * 0.8)
    if (iris.current) iris.current.rotation.z = S.iris
    if (teeth.current) teeth.current.rotation.z = S.teeth
    if (gem.current) {
      gem.current.rotation.set(Math.sin(t * 0.7) * 0.25, S.gem, 0)
      const pulse = 0.85 + 0.15 * Math.sin(t * 3.1)
      mat.gem.emissiveIntensity = (0.5 + glowV * 1.8 + flash * 3) * pulse
    }
    const see = 0.15 + 0.85 * o // the light escapes as the lids open
    mat.glow.uniforms.uIntensity.value = (0.18 + glowV * 0.75 + flash * 1.8) * see
    mat.iris.opacity = 0.14 + 0.46 * glowV
    if (gemLight.current) gemLight.current.intensity = (1.5 + glowV * 10 + flash * 26) * see * gemIn
    mat.seam.opacity = clamp01((1 - o) * (0.4 + glowV + flash))

    // engravings: orange, turning emerald while time is rewound
    const runes = clamp01(A.runes ?? 0.5)
    tmpC.copy(ORANGE).lerp(EMERALD, clamp01(A.green || 0))
    mat.enamel.emissive.copy(tmpC)
    mat.disc.emissive.copy(tmpC)
    mat.lid.emissive.copy(tmpC)
    mat.rune.color.copy(tmpC).multiplyScalar(0.4 + runes * 1.8 + flash * 1.5)
    mat.enamel.emissiveIntensity = 0.25 + runes * 1.1 + flash
    mat.disc.emissiveIntensity = 0.2 + runes * 0.9 + flash * 0.8
    mat.lid.emissiveIntensity = 0.15 + runes * 0.5 + flash * 0.6
    mat.amber.emissiveIntensity = 0.6 + runes * 0.9 + 0.2 * Math.sin(t * 2.3)
  })

  const setG = (name) => (el) => {
    groups.current[name] = el
  }

  return (
    <group>
      {/* medallion: back disc + rings + crests */}
      <group ref={setG('medallion')}>
        <mesh geometry={geo.disc} material={mat.disc} position={[0, 0, -0.1]} />
        <mesh geometry={geo.medallionGold} material={mat.gold} position={[0, 0, -0.06]} />
      </group>

      {/* frame: lens + filigree + tip gems + rune ticks */}
      <group ref={setG('frame')}>
        <mesh geometry={geo.frame} material={mat.frameGold} />
        <mesh geometry={geo.tendrils} material={mat.goldDark} />
        <mesh geometry={geo.tipGems} material={mat.amber} />
        <instancedMesh ref={runesRef} args={[geo.runeTick, mat.rune, RUNES]} />
      </group>

      {/* enamel eye plate */}
      <group ref={setG('enamel')}>
        <mesh geometry={geo.enamel} material={mat.enamel} position={[0, 0, -0.045]} />
      </group>

      {/* chamber: bezel, teeth, iris */}
      <group ref={setG('chamber')}>
        <mesh geometry={geo.bezel} material={mat.gold} position={[0, 0, 0.03]} />
        <instancedMesh ref={teeth} args={[geo.tooth, mat.goldDark, 36]} />
        <mesh ref={iris} geometry={geo.irisG} material={mat.iris} position={[0, 0, -0.02]} />
      </group>

      {/* gem + glow + light */}
      <group ref={setG('gem')}>
        <mesh ref={gem} geometry={geo.gemG} material={mat.gem} position={[0, 0, 0.02]} />
        <mesh ref={glow} geometry={geo.glowPlane} material={mat.glow} position={[0, 0, -0.03]} renderOrder={1} />
      </group>
      <pointLight ref={gemLight} color="#38f29a" intensity={0} distance={4.5} decay={2} position={[0, 0, 0.6]} />

      {/* lids hinge on the horizontal diameter */}
      <group ref={setG('lids')} position={[0, 0, 0]}>
        <group position={[0, 0, LID_Z]}>
          <group ref={lidTop}>
            <mesh geometry={geo.lidT} material={mat.lid} />
            <mesh geometry={geo.rimT} material={mat.gold} />
          </group>
          <group ref={lidBot}>
            <mesh geometry={geo.lidB} material={mat.lid} />
            <mesh geometry={geo.rimB} material={mat.gold} />
          </group>
          <mesh ref={seam} geometry={geo.seamG} material={mat.seam} />
        </group>
      </group>
    </group>
  )
}
