import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { simplex3D, curlNoise } from '../../../three/shaders/noise.glsl.js'

// THE BEACON — the gold assembly point the whole team converges on. Built in world units (ring radius 1 at
// scale 1) and posed every frame by the director (dir.stage: position, tilt, orbit, scale, power, hover…):
//   gold portal ring + 36-bar aperture, a counter-rotating 60° ring with ticks, a red precessing orbit,
//   a red→gold spiral VORTEX of points funnelling into a white-hot core, 12 radiating RAYS, an engraved
//   assembly FLOOR (only when the stage lies down), six empty SOCKETS on the formation ring that light up in
//   each hero's colour when that hero locks in, and a vertical LIGHT PILLAR that fires on ignition.

const RING_R = 1
const APERTURE = 36
const TICKS = 24
const tmp = new THREE.Object3D()

/* ------------------------------------------------------------------ vortex */
const vortexVert = /* glsl */ `
  uniform float uPhase;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uRadius;
  uniform float uDepth;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uCurl;
  attribute float aSeed;
  attribute float aAngle;
  attribute float aRate;
  attribute float aSize;
  attribute float aZ;
  varying float vLife;
  varying float vSeed;
  varying float vAlpha;
  ${simplex3D}
  ${curlNoise}
  void main() {
    float life = fract(aSeed + uPhase * aRate * 0.16);
    float ease = life * life * (3.0 - 2.0 * life);
    float r = uRadius * mix(1.3, 0.015, pow(life, 0.72));
    float ang = aAngle + life * 7.5 * (0.8 + aRate * 0.4) + uPhase * 0.35;
    vec3 p = vec3(cos(ang) * r, sin(ang) * r, mix(-uDepth, 0.25, ease) + aZ * 0.2 * (1.0 - life));
    vec3 c = curl(p * 1.6 + vec3(aSeed * 13.0, 0.0, uTime * 0.25));
    p += c * uCurl * sin(life * 3.14159);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = aSize * uSize * uPixelRatio * (22.0 / max(-mv.z, 1.0));
    gl_PointSize = sz * (0.55 + 0.45 * (1.0 - life)) * (1.0 + 0.9 * smoothstep(0.86, 1.0, life));
    vLife = life;
    vSeed = aSeed;
    vAlpha = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.9, 1.0, life)) * uIntensity;
  }
`
const vortexFrag = /* glsl */ `
  uniform vec3 uRed;
  uniform vec3 uGold;
  uniform vec3 uHot;
  varying float vLife;
  varying float vSeed;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = 1.0 - smoothstep(0.06, 0.5, d);
    float core = 1.0 - smoothstep(0.0, 0.24, d);
    vec3 col = mix(uRed, uGold, smoothstep(0.1, 0.7, vLife + vSeed * 0.15 - 0.075));
    col = mix(col, uHot, smoothstep(0.78, 1.0, vLife) * 0.9);
    col += core * 0.4 * (0.3 + vLife);
    gl_FragColor = vec4(col, a * vAlpha);
  }
`
function Vortex({ dir, count }) {
  const phase = useRef(0)
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    const seed = new Float32Array(count)
    const angle = new Float32Array(count)
    const rate = new Float32Array(count)
    const size = new Float32Array(count)
    const z = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      seed[i] = Math.random()
      angle[i] = Math.random() * Math.PI * 2
      rate[i] = 0.65 + Math.random() * 0.7
      size[i] = 0.5 + Math.pow(Math.random(), 2.2) * 2.4
      z[i] = Math.random() * 2 - 1
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1))
    g.setAttribute('aRate', new THREE.BufferAttribute(rate, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aZ', new THREE.BufferAttribute(z, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: vortexVert,
      fragmentShader: vortexFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uPhase: { value: 0 },
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uRadius: { value: RING_R * 1.05 },
        uDepth: { value: 1.4 },
        uPixelRatio: { value: 1 },
        uSize: { value: 1 },
        uCurl: { value: 0.09 },
        uRed: { value: new THREE.Color('#e8232a') },
        uGold: { value: new THREE.Color('#f5c04a') },
        uHot: { value: new THREE.Color('#fff4d2') },
      },
    })
    return { geometry: g, material: m }
  }, [count])
  useFrame((state, dtRaw) => {
    const s = dir.current.stage
    const dt = Math.min(dtRaw, 0.05)
    const speed = (0.25 + 0.85 * s.power) * (1 + 1.4 * s.hover) + s.velocity * 0.6
    phase.current += dt * speed
    const u = material.uniforms
    u.uPhase.value = phase.current
    u.uTime.value = state.clock.elapsedTime
    u.uIntensity.value = s.glow * (1 + 0.8 * s.hover) * s.vis
    u.uSize.value = 1 + 0.4 * s.hover + 0.35 * s.strike
    u.uCurl.value = 0.09 + 0.06 * s.hover
    u.uPixelRatio.value = state.viewport.dpr
  })
  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/* ------------------------------------------------------------------ rays */
const raysVert = /* glsl */ `
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    vUv = uv;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`
const raysFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec2 vUv;
  varying float vSeed;
  void main() {
    float along = vUv.x;
    float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float falloff = pow(1.0 - along, 2.2);
    float edge = pow(across, 1.9);
    float flick = 0.72 + 0.28 * sin(uTime * (2.6 + vSeed * 4.0) + vSeed * 21.0);
    float shimmer = 0.82 + 0.18 * sin(along * 34.0 - uTime * 7.0 + vSeed * 9.0);
    vec3 col = mix(uColorA, uColorB, 0.1 + along * 0.8);
    gl_FragColor = vec4(col, falloff * edge * flick * shimmer * uIntensity);
  }
`
function Rays({ dir, count = 12, length = 2.6, width = 0.2 }) {
  const mesh = useRef()
  const rot = useRef(0)
  const { geometry, material, seeds } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    g.translate(0.5, 0, 0)
    const s = new Float32Array(count)
    for (let i = 0; i < count; i++) s[i] = Math.random()
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(s, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: raysVert,
      fragmentShader: raysFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uColorA: { value: new THREE.Color('#fff1c4') }, uColorB: { value: new THREE.Color('#e8232a') } },
    })
    return { geometry: g, material: m, seeds: s }
  }, [count])
  useEffect(() => {
    if (mesh.current) mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])
  useFrame((state, dtRaw) => {
    const s = dir.current.stage
    if (!mesh.current) return
    const dt = Math.min(dtRaw, 0.05)
    const t = state.clock.elapsedTime
    rot.current += dt * (0.08 + 0.3 * s.hover)
    const reach = 0.3 + 0.7 * s.power + 0.4 * s.hover + 0.5 * s.strike
    for (let i = 0; i < count; i++) {
      const a = rot.current + (i / count) * Math.PI * 2
      const len = length * reach * (0.78 + 0.22 * Math.sin(t * 1.3 + seeds[i] * 9))
      const w = width * (0.75 + 0.45 * Math.sin(t * 2.1 + i * 1.7))
      tmp.position.set(0, 0, -0.05)
      tmp.rotation.set(0, 0, a)
      tmp.scale.set(len, w, 1)
      tmp.updateMatrix()
      mesh.current.setMatrixAt(i, tmp.matrix)
    }
    mesh.current.instanceMatrix.needsUpdate = true
    material.uniforms.uTime.value = t
    material.uniforms.uIntensity.value = (s.glow * (0.4 + 0.5 * s.hover) + s.strike * 0.35) * s.vis
  })
  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} />
}

/* ------------------------------------------------------------------ soft glow planes */
const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const glowFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uSoftness;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5);
    float g = pow(1.0 - smoothstep(0.0, 0.5, d), uSoftness);
    float flicker = 0.94 + 0.06 * sin(uTime * 9.0 + d * 30.0) * sin(uTime * 2.3);
    gl_FragColor = vec4(uColor, g * uIntensity * flicker);
  }
`
function makeGlow(color, softness) {
  return new THREE.ShaderMaterial({
    vertexShader: glowVert,
    fragmentShader: glowFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: 0 }, uSoftness: { value: softness }, uTime: { value: 0 } },
  })
}

/* ------------------------------------------------------------------ assembly floor */
const floorFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uPower;
  varying vec2 vUv;
  float line(float r, float R, float w) { return smoothstep(w, 0.0, abs(r - R)); }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float a = atan(p.y, p.x);
    float v = 0.0;
    v += line(r, 0.29, 0.006) * 0.9;
    v += line(r, 0.33, 0.003) * 0.6;
    v += line(r, 0.64, 0.004) * 0.8;
    v += line(r, 0.7, 0.002) * 0.5;
    v += line(r, 0.92, 0.006) * 0.9;
    // 72 engraved ticks between 0.92 and 0.97, majors every 6
    float k = fract(a / 6.2831853 * 72.0 + 0.5);
    float idx = floor(a / 6.2831853 * 72.0 + 0.5);
    float major = 1.0 - step(0.5, mod(idx, 6.0));
    float outer = mix(0.952, 0.985, major);
    v += smoothstep(0.915, 0.93, r) * (1.0 - smoothstep(outer - 0.012, outer, r)) * smoothstep(0.14, 0.0, abs(k - 0.5)) * 0.8;
    // hex lattice, faint, inside the formation ring
    vec2 h = p * 9.0;
    vec2 q = vec2(h.x * 1.1547, h.y + h.x * 0.57735);
    vec2 fq = fract(q) - 0.5;
    float hexl = smoothstep(0.47, 0.5, max(abs(fq.x), abs(fq.y)));
    v += hexl * 0.12 * smoothstep(0.88, 0.4, r);
    // radar sweep
    float sweep = fract((a + uTime * 0.6) / 6.2831853);
    v += pow(sweep, 18.0) * smoothstep(1.0, 0.3, r) * 0.6;
    float fade = smoothstep(1.0, 0.85, r);
    vec3 col = mix(vec3(0.96, 0.75, 0.29), vec3(1.0, 0.93, 0.7), uPower * 0.4);
    float centre = exp(-r * 4.0) * 0.35 * uPower;
    gl_FragColor = vec4(col, (v * 0.6 + centre) * fade * uIntensity);
  }
`

/* ------------------------------------------------------------------ light pillar (world-vertical) */
const pillarVert = /* glsl */ `
  varying vec2 vUv;
  varying float vFacing;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * normal);
    vec3 v = normalize(cameraPosition - wp.xyz);
    vFacing = abs(dot(n, v));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const pillarFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vFacing;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    float y = vUv.y;
    float streak = 0.65 + 0.35 * sin(vUv.x * 6.2831 * 9.0 + uTime * 1.5) * sin(vUv.x * 6.2831 * 4.0 - uTime * 0.7);
    float rise = 0.75 + 0.25 * sin(y * 30.0 - uTime * 9.0);
    float a = pow(vFacing, 2.2) * pow(1.0 - y, 1.6) * smoothstep(0.0, 0.03, y) * streak * rise;
    vec3 col = mix(vec3(1.0, 0.96, 0.85), uColor, smoothstep(0.0, 0.7, y));
    gl_FragColor = vec4(col, a * uIntensity);
  }
`

export default function Beacon({ dir, tier, sockets }) {
  const low = tier === 'low'
  const vortexCount = tier === 'high' ? 4200 : tier === 'medium' ? 2200 : 900
  const stage = useRef()
  const ringGroup = useRef()
  const ringMat = useRef()
  const aperture = useRef()
  const apertureMat = useRef()
  const tiltGroup = useRef()
  const ring2 = useRef()
  const ring2Mat = useRef()
  const ticks = useRef()
  const ticksMat = useRef()
  const orbit = useRef()
  const orbitMat = useRef()
  const core = useRef()
  const coreMat = useRef()
  const formRing = useRef()
  const formMat = useRef()
  const socketMesh = useRef()
  const pillar = useRef()
  const light = useRef()
  const redGlow = useMemo(() => makeGlow('#e8232a', 1.5), [])
  const coreGlow = useMemo(() => makeGlow('#ffcf6e', 1.2), [])
  const floorMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVert,
        fragmentShader: floorFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uPower: { value: 0 } },
      }),
    [],
  )
  const pillarMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pillarVert,
        fragmentShader: pillarFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uColor: { value: new THREE.Color('#f5c04a') } },
      }),
    [],
  )
  const pillarGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.42, 0.85, 1, 40, 1, true)
    g.translate(0, 0.5, 0)
    return g
  }, [])
  const socketColors = useMemo(() => sockets.map((c) => new THREE.Color(c)), [sockets])
  const dimSocket = useMemo(() => new THREE.Color('#5a4a2a'), [])
  const sc = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    if (!socketMesh.current) return
    for (let i = 0; i < 6; i++) socketMesh.current.setColorAt(i, dimSocket)
    socketMesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [dimSocket])

  useFrame((state) => {
    const d = dir.current
    const s = d.stage
    const t = state.clock.elapsedTime
    const on = d.active && s.vis > 0.01
    if (stage.current) {
      stage.current.visible = on
      stage.current.position.set(s.x, s.y, s.z)
      stage.current.rotation.set(-s.tilt + s.rx, s.ry, 0)
      stage.current.scale.setScalar(s.scale)
    }
    if (!on) {
      // the light and the pillar live outside the stage group, so hiding the group does not switch them off
      if (light.current) light.current.intensity = 0
      pillarMat.uniforms.uIntensity.value = 0
      if (pillar.current) pillar.current.scale.y = 0.001
      return
    }
    const power = s.power
    const hover = s.hover
    const strike = s.strike
    const scatter = 1 - s.formed
    if (ringGroup.current) {
      ringGroup.current.rotation.set(Math.sin(t * 0.35) * 0.08 + scatter * 0.9, Math.cos(t * 0.27) * 0.08 - scatter * 0.6, t * 0.12 + s.spin)
      ringGroup.current.scale.setScalar(0.85 + 0.15 * s.formed)
    }
    if (ringMat.current) ringMat.current.emissiveIntensity = (0.08 + power * 0.4 + hover * 0.8 + strike * 0.6) * s.vis
    if (aperture.current) {
      aperture.current.rotation.z = -t * (0.3 + hover * 0.5)
      for (let i = 0; i < APERTURE; i++) {
        const ang = (i / APERTURE) * Math.PI * 2
        const len = (0.07 + 0.06 * Math.sin(t * 3 + i * 0.6)) * (0.35 + 0.65 * power) * (1 + hover * 0.6)
        tmp.position.set(Math.cos(ang) * (RING_R - 0.14), Math.sin(ang) * (RING_R - 0.14), 0)
        tmp.rotation.set(0, 0, ang)
        tmp.scale.set(len, 0.022, 0.04)
        tmp.updateMatrix()
        aperture.current.setMatrixAt(i, tmp.matrix)
      }
      aperture.current.instanceMatrix.needsUpdate = true
    }
    if (apertureMat.current) apertureMat.current.emissiveIntensity = (0.1 + power * 1.3 + hover * 0.9 + strike) * s.vis
    if (tiltGroup.current) tiltGroup.current.rotation.set(Math.PI / 3 + Math.sin(t * 0.22) * 0.06 + scatter * 1.1, 0, t * 0.18 + scatter * 2.2)
    if (ring2.current) ring2.current.rotation.z = -t * (0.32 + hover * 0.4)
    if (ticks.current && !ticks.current.userData.set) {
      for (let i = 0; i < TICKS; i++) {
        const ang = (i / TICKS) * Math.PI * 2
        const major = i % 4 === 0
        tmp.position.set(Math.cos(ang) * 1.2, Math.sin(ang) * 1.2, 0)
        tmp.rotation.set(0, 0, ang)
        tmp.scale.set(major ? 0.11 : 0.06, 0.014, major ? 0.07 : 0.04)
        tmp.updateMatrix()
        ticks.current.setMatrixAt(i, tmp.matrix)
      }
      ticks.current.instanceMatrix.needsUpdate = true
      ticks.current.userData.set = true
    }
    if (ring2Mat.current) ring2Mat.current.emissiveIntensity = (0.05 + power * 0.3 + hover * 0.6) * s.vis
    if (ticksMat.current) ticksMat.current.emissiveIntensity = (0.15 + power * 1.1 + hover * 0.8) * s.vis
    if (orbit.current) orbit.current.rotation.set(scatter * 0.9, 0.95 + Math.sin(t * 0.4) * 0.15 + scatter * 1.4, t * 0.25)
    if (orbitMat.current) orbitMat.current.opacity = (0.12 + power * 0.35 + hover * 0.3) * s.vis
    if (core.current) core.current.scale.setScalar(0.6 + 0.5 * power + 0.15 * Math.sin(t * 5) * power + hover * 0.45 + strike * 0.7)
    if (coreMat.current) coreMat.current.emissiveIntensity = (0.5 + power * 2.6 + hover * 2.5 + strike * 3) * s.vis
    redGlow.uniforms.uIntensity.value = (0.16 + power * 0.22 + hover * 0.16 + strike * 0.3) * s.vis * s.haze
    redGlow.uniforms.uTime.value = t
    coreGlow.uniforms.uIntensity.value = (0.25 + power * 0.7 + hover * 0.7 + strike * 1.1) * s.vis
    coreGlow.uniforms.uTime.value = t

    // formation ring + six sockets (light up in each hero's colour as they lock in)
    if (formRing.current) formRing.current.scale.set(s.rx0, s.ry0, 1)
    if (formMat.current) formMat.current.opacity = (0.16 + 0.25 * power + 0.2 * hover) * s.vis * s.ringVis
    if (socketMesh.current) {
      for (let i = 0; i < 6; i++) {
        const a = s.angles[i]
        const lock = d.tokens[i].socket
        tmp.position.set(Math.cos(a) * s.rx0, Math.sin(a) * s.ry0, 0)
        tmp.rotation.set(0, 0, t * 0.6 + i)
        tmp.scale.setScalar((0.32 + lock * 0.08) * s.socketScale * s.ringVis)
        tmp.updateMatrix()
        socketMesh.current.setMatrixAt(i, tmp.matrix)
        sc.copy(dimSocket).lerp(socketColors[i], lock)
        socketMesh.current.setColorAt(i, sc)
      }
      socketMesh.current.instanceMatrix.needsUpdate = true
      if (socketMesh.current.instanceColor) socketMesh.current.instanceColor.needsUpdate = true
    }
    floorMat.uniforms.uTime.value = t
    floorMat.uniforms.uIntensity.value = s.floor * s.vis
    floorMat.uniforms.uPower.value = power

    // key light at the core
    if (light.current) {
      light.current.position.set(s.x, s.y + 0.4 * s.scale, s.z + 0.9 * s.scale)
      light.current.intensity = (power * 30 + hover * 40 + strike * 70 + s.velocity * 8 * power + (d.impulse || 0) * 90 + 6) * s.vis
    }
    // pillar: world-vertical, rises from the stage centre
    if (pillar.current) {
      // always drawn (so its program compiles up front); zero intensity + a sliver of height when off
      const pv = s.pillar * s.vis
      pillar.current.position.set(s.x, s.y, s.z)
      pillar.current.scale.set(s.scale * (0.9 + strike * 0.5 + hover * 0.2), Math.max(0.001, s.scale * 9 * Math.min(1, pv * 1.4)), s.scale * (0.9 + strike * 0.5 + hover * 0.2))
      pillarMat.uniforms.uIntensity.value = pv * (0.5 + strike * 0.8 + hover * 0.3)
      pillarMat.uniforms.uTime.value = t
    }
  })

  return (
    <>
      <pointLight ref={light} color={'#ffcf7a'} intensity={0} distance={16} decay={2} />
      <mesh ref={pillar} geometry={pillarGeo} material={pillarMat} renderOrder={2} frustumCulled={false} />
      <group ref={stage}>
        {/* red haze behind everything */}
        <mesh material={redGlow} position={[0, 0, -1.6]}>
          <planeGeometry args={[9, 9]} />
        </mesh>
        {/* engraved floor (fades in when the stage lies down) */}
        <mesh material={floorMat} position={[0, 0, -0.02]}>
          <planeGeometry args={[7.4, 7.4]} />
        </mesh>
        {/* formation ring (unit circle scaled to the formation ellipse) + sockets */}
        <mesh ref={formRing}>
          <torusGeometry args={[1, 0.006, 6, 220]} />
          <meshBasicMaterial ref={formMat} color={'#f5c04a'} transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <instancedMesh ref={socketMesh} args={[null, null, 6]} frustumCulled={false}>
          <torusGeometry args={[1, 0.035, 6, 6]} />
          <meshBasicMaterial toneMapped={false} transparent opacity={0.85} depthWrite={false} />
        </instancedMesh>

        {/* gold portal ring + aperture */}
        <group ref={ringGroup}>
          <mesh>
            <torusGeometry args={[RING_R, 0.05, 24, low ? 120 : 200]} />
            <meshStandardMaterial ref={ringMat} color={'#f5c04a'} metalness={1} roughness={0.2} envMapIntensity={2.4} emissive={'#d9a53a'} emissiveIntensity={0.08} />
          </mesh>
          <mesh>
            <torusGeometry args={[RING_R + 0.09, 0.012, 8, low ? 120 : 200]} />
            <meshStandardMaterial color={'#d9a53a'} metalness={1} roughness={0.3} envMapIntensity={2} />
          </mesh>
          <instancedMesh ref={aperture} args={[null, null, APERTURE]} frustumCulled={false}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial ref={apertureMat} color={'#ffe2a0'} metalness={0.6} roughness={0.3} emissive={'#f5c04a'} emissiveIntensity={0.1} toneMapped={false} />
          </instancedMesh>
        </group>
        {/* counter-rotating 60° ring with ticks */}
        <group ref={tiltGroup} rotation-order="ZXY">
          <group ref={ring2}>
            <mesh>
              <torusGeometry args={[1.2, 0.02, 12, low ? 120 : 200]} />
              <meshStandardMaterial ref={ring2Mat} color={'#d9a53a'} metalness={1} roughness={0.3} envMapIntensity={2} emissive={'#d9a53a'} emissiveIntensity={0.05} />
            </mesh>
            <instancedMesh ref={ticks} args={[null, null, TICKS]} frustumCulled={false}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial ref={ticksMat} color={'#ffe9a8'} metalness={0.8} roughness={0.25} emissive={'#f5c04a'} emissiveIntensity={0.15} toneMapped={false} />
            </instancedMesh>
          </group>
        </group>
        {/* red orbit */}
        <mesh ref={orbit} rotation-order="ZYX">
          <torusGeometry args={[1.45, 0.009, 8, 200]} />
          <meshBasicMaterial ref={orbitMat} color={'#e8232a'} transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>

        <Vortex dir={dir} count={vortexCount} />
        <Rays dir={dir} count={12} length={2.7} width={0.2} />

        {/* core */}
        <mesh material={coreGlow} position={[0, 0, 0.1]}>
          <planeGeometry args={[2.2, 2.2]} />
        </mesh>
        <mesh ref={core} position={[0, 0, 0.15]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial ref={coreMat} color={'#fff6dc'} emissive={'#ffd27a'} emissiveIntensity={0.5} roughness={0.35} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
