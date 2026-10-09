import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { TickRing } from './HudBits'
import { useDispose } from './useDispose'

// Original chest-reactor design: turned gunmetal housing, ten copper coil blocks over a glowing channel, a bright
// inner ring, a triangular core frame and a white-hot core disc. `dir.charge` (0..1) spins it up, brightens it and
// throws crackling arcs between the coils (REPULSOR CHARGE beat). Faces +z.
const COILS = 10
const tmp = new THREE.Object3D()

const coreVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
const coreFrag = /* glsl */ `
uniform float uTime; uniform float uPower; varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; float d = length(p) * 2.0; float a = atan(p.y, p.x);
  float rays = 0.5 + 0.5 * sin(a * 12.0 + uTime * 2.0) * sin(a * 7.0 - uTime * 1.3);
  float core = smoothstep(1.0, 0.0, d);
  vec3 col = mix(vec3(0.25, 0.85, 1.0), vec3(1.0), smoothstep(0.55, 0.0, d));
  col *= (0.8 + 0.35 * rays * smoothstep(0.2, 0.9, d)) * uPower;
  gl_FragColor = vec4(col * 2.4, core);
}`

const haloFrag = /* glsl */ `
uniform float uPower; uniform vec3 uColor; varying vec2 vUv;
void main(){ vec2 p = vUv - 0.5; float d = length(p) * 2.0;
  float g = pow(smoothstep(1.0, 0.0, d), 2.4);
  gl_FragColor = vec4(uColor * 1.6, g * uPower); }`

export default function Reactor({ dir, tier = 'high' }) {
  const coils = useRef()
  const spin = useRef()
  const tri = useRef()
  const light = useRef()
  const arcs = useRef()
  const ringMat = useRef()
  const channelMat = useRef()
  const hudA = useRef()
  const hudB = useRef()

  const housing = useMemo(() => {
    const prof = [
      [0.46, 0.0],
      [1.0, 0.0],
      [1.07, 0.05],
      [1.07, 0.15],
      [1.01, 0.21],
      [0.92, 0.21],
      [0.9, 0.12],
      [0.62, 0.12],
      [0.6, 0.19],
      [0.53, 0.19],
      [0.5, 0.1],
      [0.46, 0.08],
    ].map(([r, h]) => new THREE.Vector2(r, h))
    const g = new THREE.LatheGeometry(prof, 96)
    g.rotateX(Math.PI / 2)
    g.computeVertexNormals()
    return g
  }, [])
  const triGeo = useMemo(() => {
    const s = new THREE.Shape()
    const R = 0.44
    const r = 0.3
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i / 3) * Math.PI * 2
      i ? s.lineTo(Math.cos(a) * R, Math.sin(a) * R) : s.moveTo(Math.cos(a) * R, Math.sin(a) * R)
    }
    s.closePath()
    const h = new THREE.Path()
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i / 3) * Math.PI * 2
      i ? h.lineTo(Math.cos(a) * r, Math.sin(a) * r) : h.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    h.closePath()
    s.holes.push(h)
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 })
    return g
  }, [])
  const coreMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: coreVert, fragmentShader: coreFrag, transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uPower: { value: 1 } }, toneMapped: false }),
    [],
  )
  const haloMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVert,
        fragmentShader: haloFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uPower: { value: 0.4 }, uColor: { value: new THREE.Color('#7fe9ff') } },
      }),
    [],
  )
  // crackling arcs between coils (regenerated jagged polylines)
  const ARC_N = tier === 'low' ? 3 : 6
  const SEG = 7
  const arcGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * SEG * 2 * 3), 3))
    return g
  }, [ARC_N])
  const arcMat = useMemo(() => new THREE.LineBasicMaterial({ color: new THREE.Color('#bff7ff'), transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), [])
  const arcClock = useRef(0)
  useDispose([housing, triGeo, coreMat, haloMat, arcGeo, arcMat], [housing, triGeo, coreMat, haloMat, arcGeo, arcMat])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const c = dir.charge || 0
    const power = (dir.reactorPower ?? 1) * (0.75 + 0.25 * Math.sin(t * 2.4)) + c * 1.6
    coreMat.uniforms.uTime.value = t
    coreMat.uniforms.uPower.value = 0.75 + power * 0.45
    haloMat.uniforms.uPower.value = 0.22 + power * 0.32 + (dir.blast || 0) * 1.5
    if (ringMat.current) ringMat.current.color.setRGB(0.6 * (1 + power), 0.95 * (1 + power), 1.0 * (1 + power))
    if (channelMat.current) channelMat.current.color.setRGB(0.3 * (0.6 + power), 0.85 * (0.6 + power), 1.0 * (0.6 + power))
    // never unmount/hide the light (that would change the light count and recompile every material) — fade it
    if (light.current) light.current.intensity = (6 + power * 14 + (dir.blast || 0) * 60) * (dir.lightScale ?? 1) * (dir.reactorVis ?? 1)
    if (spin.current) spin.current.rotation.z -= dt * (0.25 + c * 3.5)
    if (tri.current) tri.current.rotation.z = Math.sin(t * 0.5) * 0.04 + c * t * 0.6
    if (coils.current && !coils.current.userData.done) {
      for (let i = 0; i < COILS; i++) {
        const a = (i / COILS) * Math.PI * 2 + Math.PI / 2
        tmp.position.set(Math.cos(a) * 0.76, Math.sin(a) * 0.76, 0.17)
        tmp.rotation.set(0, 0, a)
        tmp.scale.set(0.22, 0.16, 0.1)
        tmp.updateMatrix()
        coils.current.setMatrixAt(i, tmp.matrix)
      }
      coils.current.instanceMatrix.needsUpdate = true
      coils.current.userData.done = true
    }
    const hud = dir.reactorHud || 0
    hudA.current?.setOpacity((0.06 + hud * 0.3 + c * 0.4) * (0.3 + hud * 0.7))
    hudB.current?.setOpacity((0.04 + hud * 0.2 + c * 0.3) * (0.3 + hud * 0.7))
    // arcs flicker in only when charged
    arcClock.current += dt
    const arcOn = c > 0.35 ? (c - 0.35) / 0.65 : 0
    arcMat.opacity = arcOn * (0.5 + 0.5 * Math.random())
    if (arcOn > 0 && arcClock.current > 0.06) {
      arcClock.current = 0
      const pos = arcGeo.attributes.position.array
      let o = 0
      for (let k = 0; k < ARC_N; k++) {
        const i = Math.floor(Math.random() * COILS)
        const a0 = (i / COILS) * Math.PI * 2 + Math.PI / 2
        const r0 = 0.62 + Math.random() * 0.25
        const x0 = Math.cos(a0) * r0
        const y0 = Math.sin(a0) * r0
        const x1 = Math.cos(a0 + (Math.random() - 0.5) * 1.2) * 0.2
        const y1 = Math.sin(a0 + (Math.random() - 0.5) * 1.2) * 0.2
        let px = x0
        let py = y0
        for (let s = 1; s <= SEG; s++) {
          const f = s / SEG
          const j = s === SEG ? 0 : 0.07
          const nx = x0 + (x1 - x0) * f + (Math.random() - 0.5) * j
          const ny = y0 + (y1 - y0) * f + (Math.random() - 0.5) * j
          pos[o++] = px
          pos[o++] = py
          pos[o++] = 0.24
          pos[o++] = nx
          pos[o++] = ny
          pos[o++] = 0.24
          px = nx
          py = ny
        }
      }
      arcGeo.attributes.position.needsUpdate = true
    }
  })

  return (
    <group>
      <mesh geometry={housing}>
        <meshStandardMaterial color={'#33363e'} metalness={1} roughness={0.32} envMapIntensity={1.5} />
      </mesh>
      {/* back plate */}
      <mesh position={[0, 0, 0.02]}>
        <circleGeometry args={[0.5, 48]} />
        <meshStandardMaterial color={'#14161b'} metalness={0.9} roughness={0.5} />
      </mesh>
      {/* glowing channel under the coils */}
      <mesh position={[0, 0, 0.13]}>
        <torusGeometry args={[0.76, 0.06, 10, 96]} />
        <meshBasicMaterial ref={channelMat} color={'#7fe9ff'} toneMapped={false} />
      </mesh>
      <group ref={spin}>
        <instancedMesh ref={coils} args={[null, null, COILS]} frustumCulled={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={'#c98a4b'} metalness={1} roughness={0.3} envMapIntensity={1.6} />
        </instancedMesh>
      </group>
      {/* inner ring */}
      <mesh position={[0, 0, 0.16]}>
        <torusGeometry args={[0.535, 0.03, 10, 96]} />
        <meshBasicMaterial ref={ringMat} color={'#bff7ff'} toneMapped={false} />
      </mesh>
      {/* core */}
      <mesh position={[0, 0, 0.12]} material={coreMat}>
        <circleGeometry args={[0.5, 64]} />
      </mesh>
      <mesh ref={tri} geometry={triGeo} position={[0, 0, 0.17]}>
        <meshStandardMaterial color={'#b9bec8'} metalness={1} roughness={0.25} envMapIntensity={1.8} />
      </mesh>
      <lineSegments geometry={arcGeo} material={arcMat} frustumCulled={false} />
      {/* bloom halo */}
      <mesh position={[0, 0, 0.3]} material={haloMat} renderOrder={4}>
        <planeGeometry args={[4.2, 4.2]} />
      </mesh>
      <TickRing ref={hudA} radius={1.42} ticks={120} gauge={0.72} color={'#7fe9ff'} opacity={0.35} speed={0.12} position={[0, 0, -0.05]} />
      <TickRing ref={hudB} radius={1.78} ticks={60} gauge={0.35} color={'#f5c04a'} opacity={0.2} speed={-0.06} tickLength={0.07} major={5} position={[0, 0, -0.1]} />
      <pointLight ref={light} position={[0, 0, 0.9]} color={'#7fe9ff'} intensity={10} distance={9} decay={2} />
    </group>
  )
}
