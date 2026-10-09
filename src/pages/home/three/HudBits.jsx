import { useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useDispose } from './useDispose'

const tmp = new THREE.Object3D()

// Ring of HUD tick marks (one instanced draw) + a hairline circle. `gauge` lights an arc; opacity is controllable.
export const TickRing = forwardRef(function TickRing(
  { radius = 2, ticks = 96, gauge = 0.7, color = '#f5c04a', opacity = 0.6, tickLength = 0.1, thickness = 0.006, speed = 0.05, major = 8, ...props },
  ref,
) {
  const group = useRef()
  const inst = useRef()
  const matT = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, toneMapped: false, depthWrite: false }), [opacity])
  const matL = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: opacity * 0.6, toneMapped: false, depthWrite: false }), [color, opacity])
  const colors = useMemo(() => {
    const c = new Float32Array(ticks * 3)
    const on = new THREE.Color(color).multiplyScalar(1.6)
    const off = new THREE.Color(color).multiplyScalar(0.35)
    for (let i = 0; i < ticks; i++) (i / ticks < gauge ? on : off).toArray(c, i * 3)
    return c
  }, [ticks, gauge, color])
  const ready = useRef(false)
  useDispose([matT, matL], [matT, matL])
  useImperativeHandle(ref, () => ({ group: group.current, setOpacity: (o) => ((matT.opacity = o), (matL.opacity = o * 0.6)) }))
  useFrame((state, dt) => {
    if (inst.current && !ready.current) {
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2
        const big = i % major === 0
        const len = big ? tickLength * 2 : tickLength
        tmp.position.set(Math.cos(a) * (radius - len / 2), Math.sin(a) * (radius - len / 2), 0)
        tmp.rotation.set(0, 0, a)
        tmp.scale.set(len, big ? 0.022 : 0.012, 0.01)
        tmp.updateMatrix()
        inst.current.setMatrixAt(i, tmp.matrix)
      }
      inst.current.instanceMatrix.needsUpdate = true
      ready.current = true
    }
    if (group.current) group.current.rotation.z += speed * dt
  })
  return (
    <group ref={group} {...props}>
      <instancedMesh ref={inst} args={[null, null, ticks]} material={matT} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </boxGeometry>
      </instancedMesh>
      <mesh material={matL}>
        <torusGeometry args={[radius + tickLength * 0.4, thickness, 4, 180]} />
      </mesh>
    </group>
  )
})

const CORNER_SIGN = [
  [-1, 1, -Math.PI / 2],
  [1, 1, Math.PI],
  [1, -1, Math.PI / 2],
  [-1, -1, 0],
]

// Four L-shaped corner brackets that "lock on" (snap from wide to tight with overshoot) — HUD target lock.
export const LockBrackets = forwardRef(function LockBrackets({ w = 2, h = 2.4, color = '#f5c04a', arm = 0.32, ...props }, ref) {
  const group = useRef()
  const corners = useRef([])
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }), [color])
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([arm, 0, 0, 0, 0, 0, 0, 0, 0, 0, arm, 0], 3))
    return g
  }, [arm])
  const state = useRef({ t: 10, vis: 0 })
  useDispose([mat, geom], [mat, geom])
  useImperativeHandle(ref, () => ({
    lock: () => (state.current.t = 0),
    group: group.current,
    setVisible: (v) => (state.current.vis = v),
  }))
  useFrame((_, dt) => {
    const s = state.current
    s.t += dt
    const k = Math.min(1, s.t / 0.6)
    const c = 2.2
    const e = 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2) // back-out
    const spread = 1 + (1 - e) * 0.7
    const blink = s.t < 0.6 ? (Math.floor(s.t * 20) % 2 ? 1 : 0.35) : 1
    mat.opacity = s.vis * blink * Math.min(1, s.t * 4)
    const sx = (w / 2) * spread
    const sy = (h / 2) * spread
    for (let i = 0; i < 4; i++) {
      const o = corners.current[i]
      if (!o) continue
      o.position.set(CORNER_SIGN[i][0] * sx, CORNER_SIGN[i][1] * sy, 0)
      o.rotation.z = CORNER_SIGN[i][2]
    }
  })
  return (
    <group ref={group} {...props}>
      {[0, 1, 2, 3].map((i) => (
        <lineSegments key={i} ref={(el) => (corners.current[i] = el)} geometry={geom} material={mat} />
      ))}
    </group>
  )
})

// Expanding shockwave rings (impact / repulsor blast). fire(worldPos, color, size)
export const Shockwaves = forwardRef(function Shockwaves(_, ref) {
  const N = 4
  const meshes = useRef([])
  const slots = useRef(Array.from({ length: N }, () => ({ t: 10, size: 1, life: 0.9 })))
  const next = useRef(0)
  const mats = useMemo(
    () =>
      Array.from({ length: N }, () =>
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uColor: { value: new THREE.Color('#7fe9ff') }, uK: { value: 0 } },
          vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
          fragmentShader: `uniform vec3 uColor; uniform float uK; varying vec2 vUv;
            void main(){ vec2 p = vUv - 0.5; float d = length(p) * 2.0;
              float ring = smoothstep(0.86, 0.97, d) * (1.0 - smoothstep(0.97, 1.0, d));
              float fill = smoothstep(1.0, 0.0, d) * 0.12;
              float a = (ring + fill) * (1.0 - uK) * (1.0 - uK);
              gl_FragColor = vec4(uColor * 2.2, a); }`,
        }),
      ),
    [],
  )
  useDispose([mats], [mats])
  useImperativeHandle(ref, () => ({
    fire: (pos, color = '#7fe9ff', size = 3, life = 0.9) => {
      const i = next.current++ % N
      const s = slots.current[i]
      s.t = 0
      s.size = size
      s.life = life
      mats[i].uniforms.uColor.value.set(color)
      meshes.current[i]?.position.copy(pos)
    },
  }))
  useFrame((state, dt) => {
    for (let i = 0; i < N; i++) {
      const s = slots.current[i]
      const m = meshes.current[i]
      if (!m) continue
      s.t += dt
      const k = Math.min(1, s.t / s.life)
      m.visible = k < 1
      const e = 1 - Math.pow(1 - k, 3)
      m.scale.setScalar(0.2 + e * s.size)
      mats[i].uniforms.uK.value = k
      m.quaternion.copy(state.camera.quaternion)
    }
  })
  return (
    <>
      {mats.map((m, i) => (
        <mesh key={i} ref={(el) => (meshes.current[i] = el)} material={m} visible={false} renderOrder={5}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </>
  )
})
