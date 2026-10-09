import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import Mandala from './Mandala'

/*
 * TIME REVERSAL in 3D: an emerald seal made of 30 ring-sector shards (one instanced draw call) that starts blown
 * apart around the relic and flies back together *backwards* — slow at first, then accelerating into place like
 * an explosion played in reverse — as the visitor scrolls the education record whole. When it locks, a green
 * spell ring lamp-strikes on behind it and turns the wrong way (time running backwards).
 *
 * Driven by `state`: { progress 0..1, weight 0..1 (how present the beat is), flash 0..1 }.
 */
const N = 30
const TAU = Math.PI * 2
const R0 = 1.42
const R1 = 1.78
const tmp = new THREE.Object3D()

function rng(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export default function TimeSeal({ state, tier = 'high' }) {
  const inst = useRef()
  const ring = useRef()
  const inner = useRef()
  const group = useRef()

  const geo = useMemo(() => {
    const span = TAU / N - 0.025
    const s = new THREE.Shape()
    const steps = 8
    for (let i = 0; i <= steps; i++) {
      const a = -span / 2 + (span * i) / steps
      const p = [Math.cos(a) * R1, Math.sin(a) * R1]
      if (i === 0) s.moveTo(p[0], p[1])
      else s.lineTo(p[0], p[1])
    }
    for (let i = steps; i >= 0; i--) {
      const a = -span / 2 + (span * i) / steps
      s.lineTo(Math.cos(a) * R0, Math.sin(a) * R0)
    }
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1 })
    // shard local origin at its centre, so it tumbles about itself
    const mid = (R0 + R1) / 2
    g.translate(-mid, 0, -0.02)
    return g
  }, [])
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0c2a1e',
        emissive: '#38f29a',
        emissiveIntensity: 0.4,
        metalness: 0.85,
        roughness: 0.22,
        envMapIntensity: 1.4,
        transparent: true,
        opacity: 1,
      }),
    [],
  )
  useLayoutEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )

  // per-shard scatter (deterministic)
  const scatter = useMemo(() => {
    const r = rng(5)
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * TAU
      const out = 0.9 + r() * 1.7
      return {
        a,
        dx: Math.cos(a) * out + (r() - 0.5) * 0.8,
        dy: Math.sin(a) * out + (r() - 0.5) * 0.8,
        dz: (r() - 0.35) * 2.2,
        rx: (r() - 0.5) * 5,
        ry: (r() - 0.5) * 5,
        rz: (r() - 0.5) * 3,
        delay: r() * 0.28,
      }
    })
  }, [])

  useFrame((st, dt) => {
    const S = state
    const w = S.weight || 0
    const on = w > 0.01
    if (group.current) group.current.visible = on
    if (!on) return
    const p = Math.max(0, Math.min(1, S.progress || 0))
    const m = inst.current
    if (m) {
      for (let i = 0; i < N; i++) {
        const c = scatter[i]
        const k = Math.max(0, Math.min(1, (p - c.delay) / (0.95 - c.delay)))
        const rem = 1 - Math.pow(k, 1.7) // reverse explosion: accelerates home
        const mid = (R0 + R1) / 2
        tmp.position.set(Math.cos(c.a) * mid + c.dx * rem, Math.sin(c.a) * mid + c.dy * rem, c.dz * rem)
        tmp.rotation.set(c.rx * rem, c.ry * rem, c.a + c.rz * rem)
        tmp.scale.setScalar(0.75 + 0.25 * (1 - rem))
        tmp.updateMatrix()
        m.setMatrixAt(i, tmp.matrix)
      }
      m.instanceMatrix.needsUpdate = true
    }
    const locked = Math.max(0, Math.min(1, (p - 0.9) / 0.1))
    mat.emissiveIntensity = (0.22 + 0.2 * p + (S.flash || 0) * 1.4) * w
    mat.opacity = Math.min(1, w * 1.5)
    if (ring.current) {
      ring.current.material.uniforms.uIntensity.value = (locked * 0.26 + (S.flash || 0) * 0.6) * w
      ring.current.material.uniforms.uReveal.value = locked
      ring.current.userData.speed = -0.35 - (S.rewind || 0) * 2.5 // turns backwards
    }
    if (inner.current) {
      inner.current.material.uniforms.uIntensity.value = (0.06 + 0.1 * p) * w
      inner.current.userData.speed = 0.6 + (S.rewind || 0) * 3
    }
  })

  return (
    <group ref={group} visible={false}>
      <instancedMesh ref={inst} args={[geo, mat, N]} frustumCulled={false} />
      <Mandala ref={ring} radius={2.25} color="#38f29a" hot="#e6fff2" seed={7} cells={48} speed={-0.35} intensity={0} reveal={0} position={[0, 0, -0.15]} />
      {tier !== 'low' ? <Mandala ref={inner} radius={1.25} color="#38f29a" hot="#e6fff2" seed={13} cells={36} detail={0} speed={0.6} intensity={0} position={[0, 0, -0.3]} /> : null}
    </group>
  )
}

