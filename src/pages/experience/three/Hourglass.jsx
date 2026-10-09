import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { disposeAll } from '../signals'

/* The red-glass HOURGLASS emblem: two extruded, bevelled triangles meeting point to point (an original geometric
   homage, not a logo), pivoting on a horizontal axle through the neck.
   - shell: clear-coated red "glass" (physical material, transparent, double-sided) + a crisp neon outline
   - sand: a glowing red core inside each triangle whose fill level is clipped in a shader. The page is an hourglass:
     the triangle that is on top drains into the one below, and every scroll beat turns the glass over (stage.flip),
     so the sand always runs world-down. Fill fractions are areas (a triangle filled to height L from its apex holds
     (L/h)² of its volume), so the level moves like real sand.
   - stream: instanced grains falling through the neck while the glass is upright
   Props: `turn` (radians about x, from the stage), `spin` (turntable about y), `glow` (0..1 power), `assemble`
   ({ a, b } offsets/rotations for the intro). Everything is mutated per frame, no React state. */

export const HG = { W: 1.66, H: 1.2, DEPTH: 0.34, BT: 0.07, BS: 0.05 }
const APEX_DROP = HG.BS / Math.sin(Math.atan(HG.W / 2 / HG.H)) // how far the bevel pushes the apex out
export const NECK = 0.035 + APEX_DROP // y of each triangle's local origin (its apex) from the neck centre
const A0 = 0.14 // sand core apex inside the shell
const HC = HG.H - 0.07 - A0 // sand core height
const GRAINS = 40

const sandVert = /* glsl */ `
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vP = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz;
    vN = normalMatrix * normal;
    gl_Position = projectionMatrix * mv;
  }
`
const sandFrag = /* glsl */ `
  uniform float uLo;
  uniform float uHi;
  uniform float uOrient;
  uniform float uTime;
  uniform float uGlow;
  uniform vec3 uDeep;
  uniform vec3 uHot;
  varying vec3 vP;
  varying vec3 vN;
  varying vec3 vV;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    if (vP.y < uLo || vP.y > uHi) discard;
    float surf = uOrient > 0.0 ? (uHi - vP.y) : (vP.y - uLo);
    float rim = exp(-surf * 16.0);
    float g = h21(floor(vP.xy * 110.0) + floor(uTime * 9.0));
    float sparkle = step(0.982, g);
    float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
    vec3 col = mix(uDeep, uHot, rim * 0.85 + fres * 0.35) * (0.72 + 0.28 * g);
    col += sparkle * vec3(2.6, 1.7, 1.7) * (0.4 + rim);
    gl_FragColor = vec4(col * uGlow, 1.0);
  }
`

function triangleShape(w, h, apexY = 0) {
  const s = new THREE.Shape()
  s.moveTo(0, apexY)
  s.lineTo(w / 2, apexY + h)
  s.lineTo(-w / 2, apexY + h)
  s.closePath()
  return s
}

// outline of the bevelled shell: the triangle offset outward by the bevel size (each vertex along its bisector)
function inflatedShape() {
  const { W, H, BS } = HG
  const P = [new THREE.Vector2(0, 0), new THREE.Vector2(W / 2, H), new THREE.Vector2(-W / 2, H)]
  const out = P.map((p, i) => {
    const a = P[(i + 2) % 3]
    const b = P[(i + 1) % 3]
    const e1 = new THREE.Vector2().subVectors(a, p).normalize()
    const e2 = new THREE.Vector2().subVectors(b, p).normalize()
    const bis = new THREE.Vector2().addVectors(e1, e2).normalize()
    const half = Math.acos(THREE.MathUtils.clamp(e1.dot(e2), -1, 1)) / 2
    return p.clone().addScaledVector(bis, -BS / Math.sin(half))
  })
  const s = new THREE.Shape()
  s.moveTo(out[0].x, out[0].y)
  s.lineTo(out[1].x, out[1].y)
  s.lineTo(out[2].x, out[2].y)
  s.closePath()
  return s
}

function makeSandMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: sandVert,
    fragmentShader: sandFrag,
    uniforms: {
      uLo: { value: 0 },
      uHi: { value: 0.5 },
      uOrient: { value: 1 },
      uTime: { value: 0 },
      uGlow: { value: 1 },
      uDeep: { value: new THREE.Color(0.42, 0.012, 0.035) },
      uHot: { value: new THREE.Color(3.2, 0.42, 0.5) },
    },
  })
}

const tmp = new THREE.Object3D()

// Clips a sand core to fill fraction f. o > 0: its apex points world-down (sand sits in the point);
// o < 0: apex up, the sand sits on the wide base. Levels are measured from the core apex.
function setSand(m, f, o, t, glow) {
  const u = m.uniforms
  if (o > 0) {
    u.uLo.value = -0.01
    u.uHi.value = HC * Math.sqrt(f)
  } else {
    u.uLo.value = HC * Math.sqrt(1 - f)
    u.uHi.value = HC + 0.01
  }
  if (f < 0.002) u.uHi.value = u.uLo.value - 1
  u.uOrient.value = o
  u.uTime.value = t
  u.uGlow.value = 0.35 + 0.65 * glow
}

export default function Hourglass({ fx }) {
  const root = useRef()
  const flipper = useRef()
  const triA = useRef()
  const triB = useRef()
  const neck = useRef()
  const neckMat = useRef()
  const grains = useRef()
  const fillA = useRef(0.82) // sand fraction held by triangle A (B holds the rest)

  const { shellGeo, edgeGeo, coreGeo, shellMat, lineMat, sandA, sandB } = useMemo(() => {
    const { W, H, DEPTH, BT, BS } = HG
    const shellGeo = new THREE.ExtrudeGeometry(triangleShape(W, H), {
      depth: DEPTH,
      bevelEnabled: true,
      bevelThickness: BT,
      bevelSize: BS,
      bevelSegments: 5,
      curveSegments: 1,
    })
    shellGeo.translate(0, 0, -DEPTH / 2)
    shellGeo.computeVertexNormals()
    const flat = new THREE.ExtrudeGeometry(inflatedShape(), { depth: DEPTH + 2 * BT, bevelEnabled: false })
    flat.translate(0, 0, -(DEPTH / 2 + BT))
    const edgeGeo = new THREE.EdgesGeometry(flat, 20)
    flat.dispose()
    const coreGeo = new THREE.ExtrudeGeometry(triangleShape((W / H) * HC * 0.9, HC), { depth: 0.2, bevelEnabled: false })
    coreGeo.translate(0, 0, -0.1)
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: '#d81a35',
      emissive: '#8a0014',
      emissiveIntensity: 0.3,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      transparent: true,
      opacity: 0.34,
      envMapIntensity: 3.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(2.4, 0.5, 0.6), toneMapped: false, transparent: true, opacity: 0.6 })
    return { shellGeo, edgeGeo, coreGeo, shellMat, lineMat, sandA: makeSandMaterial(), sandB: makeSandMaterial() }
  }, [])
  useEffect(
    () => () => disposeAll(shellGeo, edgeGeo, coreGeo, shellMat, lineMat, sandA, sandB),
    [shellGeo, edgeGeo, coreGeo, shellMat, lineMat, sandA, sandB],
  )

  useFrame((state, dt) => {
    const st = fx
    if (!root.current || !st) return
    const t = state.clock.elapsedTime
    const d = Math.min(dt, 0.05)
    const glow = st.glow // 0..1 overall power (focus × intro)

    // turn over (stage) + turntable (hero ignition) + a breath of idle wobble
    flipper.current.rotation.x = st.turn
    flipper.current.rotation.y = st.spin + Math.sin(t * 0.6) * 0.05

    // assemble offsets: A drops in from above, B rises from below
    triA.current.position.set(0, NECK + st.asmA * 4.2, st.asmA * -1.5)
    triA.current.rotation.set(st.asmA * 1.9, st.asmA * -2.4, 0)
    triB.current.position.set(0, -NECK - st.asmB * 4.2, st.asmB * -1.5)
    triB.current.rotation.set(st.asmB * -1.6, st.asmB * 2.2, Math.PI)

    // --- sand: the triangle on top (world) drains into the one below while the glass is upright
    const c = Math.cos(st.turn)
    const upright = Math.abs(c) > 0.92 && st.asmA < 0.01
    const rate = (1 / 26) * (1 + Math.min(Math.abs(st.velocity || 0) / 40, 2))
    if (upright) fillA.current = THREE.MathUtils.clamp(fillA.current - Math.sign(c) * rate * d, 0, 1)
    const fA = fillA.current
    const fB = 1 - fA
    const oA = c >= 0 ? 1 : -1
    const oB = -oA
    setSand(sandA, fA, oA, t, glow)
    setSand(sandB, fB, oB, t, glow)

    // neon outline + shell emissive breathe with the power; the flare (st.flash) whites them out for a beat
    const breathe = 0.85 + 0.15 * Math.sin(t * 2.4)
    shellMat.emissiveIntensity = (0.08 + 0.3 * glow) * breathe + st.flash * 1.2
    lineMat.opacity = Math.min(1, 0.25 + 0.6 * glow + st.flash)
    neck.current.scale.setScalar(0.7 + 0.3 * Math.sin(t * 7) + st.flash * 1.4)
    neckMat.current.color.setRGB(3 * glow + st.flash * 4, 0.35 * glow + st.flash * 2, 0.4 * glow + st.flash * 2)

    // --- falling grains through the neck (in the flipper frame: world-down is -y when c > 0, +y when c < 0)
    const gi = grains.current
    if (gi) {
      const topFill = c >= 0 ? fA : fB
      const botFill = c >= 0 ? fB : fA
      const show = upright && topFill > 0.004 && glow > 0.05
      const dirY = c >= 0 ? -1 : 1
      const end = NECK + A0 + HC * Math.sqrt(1 - botFill) // distance from the neck to the lower sand surface
      for (let i = 0; i < GRAINS; i++) {
        if (!show) {
          tmp.scale.setScalar(0)
        } else {
          const ph = (t * (1.3 + (i % 5) * 0.12) + i / GRAINS) % 1
          const y = 0.01 + ph * ph * (end - 0.01)
          tmp.position.set(Math.sin(i * 7.31 + t * 3) * 0.012 * ph, dirY * y, Math.cos(i * 3.7) * 0.03)
          tmp.scale.setScalar(0.014 + (i % 3) * 0.004)
        }
        tmp.updateMatrix()
        gi.setMatrixAt(i, tmp.matrix)
      }
      gi.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={root}>
      <group ref={flipper}>
        {/* triangle A (upper at rest): apex at its local origin, points down to the neck */}
        <group ref={triA} position={[0, NECK, 0]}>
          <mesh geometry={coreGeo} material={sandA} position={[0, A0, 0]} renderOrder={1} />
          <mesh geometry={shellGeo} material={shellMat} renderOrder={2} />
          <lineSegments geometry={edgeGeo} material={lineMat} renderOrder={3} />
        </group>
        {/* triangle B (lower at rest): the same piece turned point-up */}
        <group ref={triB} position={[0, -NECK, 0]} rotation={[0, 0, Math.PI]}>
          <mesh geometry={coreGeo} material={sandB} position={[0, A0, 0]} renderOrder={1} />
          <mesh geometry={shellGeo} material={shellMat} renderOrder={2} />
          <lineSegments geometry={edgeGeo} material={lineMat} renderOrder={3} />
        </group>

        {/* neck spark + falling grains */}
        <mesh ref={neck}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial ref={neckMat} toneMapped={false} />
        </mesh>
        <instancedMesh ref={grains} args={[null, null, GRAINS]} frustumCulled={false}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={[3, 0.6, 0.6]} toneMapped={false} />
        </instancedMesh>

        {/* axle hub through the neck */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.2, 20]} />
          <meshStandardMaterial color={'#5b616c'} metalness={1} roughness={0.25} envMapIntensity={1.6} />
        </mesh>
      </group>
    </group>
  )
}
