import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/* Electric arcs (the batons' DECRYPT discharge). Each bolt is a jagged polyline between two points, drawn as
   instanced thin boxes (one per segment) in two additive layers: a white-hot core and a wide coloured glow that
   blooms. The jag is a Brownian bridge (random walk pinned to zero at both ends) in two perpendicular directions,
   regenerated every 35–90 ms so the arc crackles; a sine "bow" lets long arcs leap over things.
   The parent owns the specs (`bolts` array of { a, b, power, amp, bow }) and mutates them every frame; this component
   only draws them. Zero allocations per frame. */

const SEG = 22
const UP = new THREE.Vector3(0, 1, 0)
const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpS = new THREE.Vector3()
const tmpP = new THREE.Vector3()
const dir = new THREE.Vector3()
const u = new THREE.Vector3()
const v = new THREE.Vector3()
const pA = new THREE.Vector3()
const pB = new THREE.Vector3()
const seg = new THREE.Vector3()
const col = new THREE.Color()

export function makeBolt(opts = {}) {
  return {
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    bow: new THREE.Vector3(),
    power: 0,
    amp: opts.amp ?? 0.12,
    width: opts.width ?? 1,
    ou: new Float32Array(SEG + 1),
    ov: new Float32Array(SEG + 1),
    next: 0,
    vis: 1,
  }
}

function regen(b) {
  let wu = 0
  let wv = 0
  b.ou[0] = 0
  b.ov[0] = 0
  for (let j = 1; j <= SEG; j++) {
    wu += (Math.random() - 0.5) * 2
    wv += (Math.random() - 0.5) * 2
    b.ou[j] = wu
    b.ov[j] = wv
  }
  // pin the walk to zero at the far end (Brownian bridge) and normalise its spread
  let m = 0.0001
  for (let j = 0; j <= SEG; j++) {
    const k = j / SEG
    b.ou[j] -= wu * k
    b.ov[j] -= wv * k
    m = Math.max(m, Math.abs(b.ou[j]), Math.abs(b.ov[j]))
  }
  for (let j = 0; j <= SEG; j++) {
    b.ou[j] /= m
    b.ov[j] /= m
  }
}

function pointAt(b, j, len, out) {
  const k = j / SEG
  out.copy(b.a).lerp(b.b, k)
  const s = Math.sin(Math.PI * k)
  out.addScaledVector(b.bow, s)
  const amp = b.amp * len * (0.25 + 0.75 * s)
  out.addScaledVector(u, b.ou[j] * amp).addScaledVector(v, b.ov[j] * amp)
  return out
}

export default function Bolts({ bolts, core = '#ffffff', glow = '#8ec5ff', thickness = 0.012 }) {
  const n = bolts.length * SEG
  const coreRef = useRef()
  const glowRef = useRef()
  const cCore = useMemo(() => new THREE.Color(core), [core])
  const cGlow = useMemo(() => new THREE.Color(glow), [glow])
  // instance colour buffers exist from the first frame (so the material compiles with per-instance colour once)
  const colA = useMemo(() => new Float32Array(n * 3), [n])
  const colB = useMemo(() => new Float32Array(n * 3), [n])

  useFrame((state) => {
    const ci = coreRef.current
    const gi = glowRef.current
    if (!ci || !gi) return
    const t = state.clock.elapsedTime
    let k = 0
    for (let i = 0; i < bolts.length; i++) {
      const b = bolts[i]
      if (t > b.next) {
        regen(b)
        b.next = t + 0.035 + Math.random() * 0.055
        b.vis = Math.random() < 0.3 + 0.7 * Math.min(1, b.power * 1.3) ? 1 : 0.15
      }
      const p = b.power * b.vis
      dir.subVectors(b.b, b.a)
      const len = dir.length()
      if (p < 0.02 || len < 1e-4) {
        for (let j = 0; j < SEG; j++, k++) {
          tmpM.makeScale(0, 0, 0)
          ci.setMatrixAt(k, tmpM)
          gi.setMatrixAt(k, tmpM)
        }
        continue
      }
      dir.multiplyScalar(1 / len)
      u.crossVectors(dir, Math.abs(dir.z) > 0.9 ? UP : tmpP.set(0, 0, 1)).normalize()
      v.crossVectors(dir, u).normalize()
      pointAt(b, 0, len, pA)
      for (let j = 0; j < SEG; j++, k++) {
        pointAt(b, j + 1, len, pB)
        seg.subVectors(pB, pA)
        const sl = seg.length()
        tmpP.addVectors(pA, pB).multiplyScalar(0.5)
        tmpQ.setFromUnitVectors(UP, seg.multiplyScalar(1 / Math.max(sl, 1e-5)))
        const w = thickness * b.width * (0.6 + 0.4 * p)
        tmpS.set(w, sl * 1.08, w)
        tmpM.compose(tmpP, tmpQ, tmpS)
        ci.setMatrixAt(k, tmpM)
        tmpS.set(w * 5.5, sl * 1.08, w * 5.5)
        tmpM.compose(tmpP, tmpQ, tmpS)
        gi.setMatrixAt(k, tmpM)
        col.copy(cCore).multiplyScalar(1.4 + 2.2 * p)
        ci.setColorAt(k, col)
        col.copy(cGlow).multiplyScalar(0.22 + 0.55 * p)
        gi.setColorAt(k, col)
        pA.copy(pB)
      }
    }
    ci.instanceMatrix.needsUpdate = true
    gi.instanceMatrix.needsUpdate = true
    if (ci.instanceColor) ci.instanceColor.needsUpdate = true
    if (gi.instanceColor) gi.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <instancedMesh ref={glowRef} args={[null, null, n]} frustumCulled={false} renderOrder={3}>
        <instancedBufferAttribute attach="instanceColor" args={[colB, 3]} />
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={coreRef} args={[null, null, n]} frustumCulled={false} renderOrder={4}>
        <instancedBufferAttribute attach="instanceColor" args={[colA, 3]} />
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
    </group>
  )
}
