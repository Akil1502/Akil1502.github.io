import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

/* ------------------------------------------------------------------------------------------------
 * IMPACT kit for the SHIELD THROW: a pool of spark bursts (instanced streaks simulated on the CPU with
 * gravity + drag, stretched along their velocity), expanding shockwave rings, a hot flash sprite and one
 * shared point light that pops at the latest impact. burst(x, y, z, opts) fires one; nothing allocates
 * per frame.
 * ---------------------------------------------------------------------------------------------- */

const POOL = 4
const X_AXIS = new THREE.Vector3(1, 0, 0)
const RING_COLOR = new THREE.Color(1.9, 2.1, 2.8) // > 1: picked up by bloom as a hot blue-white ring
const SPARK_COLORS = ['#ffffff', '#fff4e2', '#ffe3c4', '#ffffff', '#ff5a64', '#8fb2ff']

const flashVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const flashFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p) * 2.0;
    float core = pow(max(0.0, 1.0 - d), 3.0);
    // four-point glint (star-shaped lens flare)
    float glint = max(0.0, 1.0 - abs(p.x) * 26.0) * max(0.0, 1.0 - abs(p.y) * 2.2) + max(0.0, 1.0 - abs(p.y) * 26.0) * max(0.0, 1.0 - abs(p.x) * 2.2);
    float a = (core + glint * 0.55) * uIntensity;
    gl_FragColor = vec4(uColor * (1.0 + core * 2.0), a);
    #include <colorspace_fragment>
  }
`

const ImpactFX = forwardRef(function ImpactFX({ tier = 'high' }, ref) {
  const per = tier === 'high' ? 56 : tier === 'medium' ? 34 : 18
  const count = per * POOL
  const sparks = useRef()
  const rings = useRef([])
  const ringMats = useRef([])
  const flashes = useRef([])
  const light = useRef()

  const sim = useMemo(
    () => ({
      pos: new Float32Array(count * 3),
      vel: new Float32Array(count * 3),
      life: new Float32Array(count).fill(1),
      age: new Float32Array(count).fill(99),
      next: 0,
      bursts: Array.from({ length: POOL }, () => ({ x: 0, y: 0, z: 0, age: 99, power: 0, scale: 1 })),
      light: 0,
    }),
    [count],
  )
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), v: new THREE.Vector3(), c: new THREE.Color(), zero: new THREE.Matrix4().makeScale(0, 0, 0) }), [])

  const flashMats = useMemo(
    () =>
      Array.from(
        { length: POOL },
        () =>
          new THREE.ShaderMaterial({
            vertexShader: flashVert,
            fragmentShader: flashFrag,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uColor: { value: new THREE.Color('#dfe8ff') }, uIntensity: { value: 0 } },
          }),
      ),
    [],
  )
  useEffect(() => () => flashMats.forEach((m) => m.dispose()), [flashMats])

  // hide every spark until it is fired
  useEffect(() => {
    const m = sparks.current
    if (!m) return
    for (let i = 0; i < count; i++) {
      m.setMatrixAt(i, tmp.zero)
      tmp.c.set(SPARK_COLORS[i % SPARK_COLORS.length]).multiplyScalar(2.2)
      m.setColorAt(i, tmp.c)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count, tmp])

  useImperativeHandle(
    ref,
    () => ({
      // dirX/dirY: preferred spray direction in the screen plane (e.g. back along the incoming flight)
      burst(x, y, z, { power = 1, dirX = 0, dirY = 0, scale = 1, sparks: withSparks = true } = {}) {
        const b = sim.next
        sim.next = (sim.next + 1) % POOL
        const B = sim.bursts[b]
        B.x = x
        B.y = y
        B.z = z
        B.age = 0
        B.power = power
        B.scale = scale
        sim.light = Math.max(sim.light, power)
        if (light.current) light.current.position.set(x, y, z + 0.8)
        if (!withSparks) {
          for (let k = 0; k < per; k++) sim.age[b * per + k] = 99
          return
        }
        const dl = Math.hypot(dirX, dirY)
        const bx = dl > 0 ? dirX / dl : 0
        const by = dl > 0 ? dirY / dl : 0
        for (let k = 0; k < per; k++) {
          const i = b * per + k
          const a = Math.random() * Math.PI * 2
          const spread = Math.random()
          let vx = Math.cos(a) * spread + bx * 0.9
          let vy = Math.sin(a) * spread + by * 0.9 + 0.25
          let vz = 0.3 + Math.random() * 0.9
          const l = Math.hypot(vx, vy, vz) || 1
          const speed = (3.2 + Math.random() * 6.5) * scale * (0.7 + 0.3 * power)
          vx = (vx / l) * speed
          vy = (vy / l) * speed
          vz = (vz / l) * speed
          sim.pos[i * 3] = x
          sim.pos[i * 3 + 1] = y
          sim.pos[i * 3 + 2] = z
          sim.vel[i * 3] = vx
          sim.vel[i * 3 + 1] = vy
          sim.vel[i * 3 + 2] = vz
          sim.age[i] = 0
          sim.life[i] = 0.28 + Math.random() * 0.5
        }
      },
    }),
    [sim, per],
  )

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const m = sparks.current
    // ---- sparks ----
    if (m) {
      let dirty = false
      const drag = Math.exp(-dt * 2.4)
      for (let i = 0; i < count; i++) {
        const age = sim.age[i]
        if (age >= sim.life[i]) {
          if (age < 98) {
            sim.age[i] = 99
            m.setMatrixAt(i, tmp.zero)
            dirty = true
          }
          continue
        }
        dirty = true
        const i3 = i * 3
        sim.vel[i3 + 1] -= 9.5 * dt
        sim.vel[i3] *= drag
        sim.vel[i3 + 1] *= drag
        sim.vel[i3 + 2] *= drag
        sim.pos[i3] += sim.vel[i3] * dt
        sim.pos[i3 + 1] += sim.vel[i3 + 1] * dt
        sim.pos[i3 + 2] += sim.vel[i3 + 2] * dt
        sim.age[i] = age + dt
        const k = sim.age[i] / sim.life[i]
        const vx = sim.vel[i3]
        const vy = sim.vel[i3 + 1]
        const vz = sim.vel[i3 + 2]
        const sp = Math.hypot(vx, vy, vz) || 1
        tmp.v.set(vx / sp, vy / sp, vz / sp)
        tmp.o.position.set(sim.pos[i3], sim.pos[i3 + 1], sim.pos[i3 + 2])
        tmp.o.quaternion.setFromUnitVectors(X_AXIS, tmp.v)
        const fade = 1 - k
        tmp.o.scale.set(0.03 + sp * 0.032 * fade, 0.016 * fade + 0.002, 0.016 * fade + 0.002)
        tmp.o.updateMatrix()
        m.setMatrixAt(i, tmp.o.matrix)
      }
      if (dirty) m.instanceMatrix.needsUpdate = true
    }
    // ---- rings + flashes ----
    for (let b = 0; b < POOL; b++) {
      const B = sim.bursts[b]
      const ring = rings.current[b]
      const rm = ringMats.current[b]
      const fl = flashes.current[b]
      if (B.age < 2) B.age += dt
      const kr = B.age / 0.7
      if (ring && rm) {
        if (kr < 1) {
          const e = 1 - Math.pow(1 - kr, 3)
          ring.visible = true
          ring.position.set(B.x, B.y, B.z)
          ring.scale.setScalar((0.25 + e * 1.9) * B.scale)
          rm.opacity = (1 - kr) * (1 - kr) * (1 - kr) * B.power * 0.9
        } else ring.visible = false
      }
      const kf = B.age / 0.32
      if (fl) {
        if (kf < 1) {
          fl.visible = true
          fl.position.set(B.x, B.y, B.z + 0.3)
          fl.scale.setScalar((1.2 + kf * 1.6) * B.scale)
          flashMats[b].uniforms.uIntensity.value = (1 - kf) * (1 - kf) * 1.6 * B.power
        } else fl.visible = false
      }
    }
    sim.light *= Math.exp(-dt * 7)
    if (light.current) light.current.intensity = sim.light * 70
  })

  return (
    <group>
      <instancedMesh ref={sparks} args={[null, null, count]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      {Array.from({ length: POOL }, (_, b) => (
        <mesh key={`r${b}`} ref={(el) => (rings.current[b] = el)} visible={false} frustumCulled={false}>
          <torusGeometry args={[1, 0.012, 6, 96]} />
          <meshBasicMaterial
            ref={(el) => (ringMats.current[b] = el)}
            color={RING_COLOR}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
      {Array.from({ length: POOL }, (_, b) => (
        <mesh key={`f${b}`} ref={(el) => (flashes.current[b] = el)} material={flashMats[b]} visible={false} renderOrder={3} frustumCulled={false}>
          <planeGeometry args={[1.6, 1.6]} />
        </mesh>
      ))}
      <pointLight ref={light} color="#dfe8ff" intensity={0} distance={9} decay={2} />
    </group>
  )
})

export default ImpactFX
