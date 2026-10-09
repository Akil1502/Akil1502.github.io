import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// SLING-RING PORTALS — the page's signature move. Every hero arrives through a ring of sputtering orange sparks
// that spins open in mid-air (one instanced, camera-facing quad per portal, polar-coordinate shader), while a
// shared Points system flings hot sparks off each ring tangentially (the "steel-wool spin" look) with a little
// gravity. The director writes `dir.portals[i] = { x, y, z, r, open }` every frame; open = 0 hides a portal.
//
// Also here: SHOCKWAVES (instanced camera-facing rings fired by `dir.shocks`) and the token back-GLOWS (one
// instanced billboard per token in its hero colour). Three draw calls for portals + sparks, one each for the rest.

export const PORTALS = 12

const portalVert = /* glsl */ `
  attribute float aOpen;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vOpen;
  varying float vSeed;
  void main() {
    vUv = uv;
    vOpen = aOpen;
    vSeed = aSeed;
    vec3 c = vec3(instanceMatrix[3]);
    float s = length(vec3(instanceMatrix[0]));
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * s * step(0.001, aOpen);
    gl_Position = projectionMatrix * mv;
  }
`
const portalFrag = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vOpen;
  varying float vSeed;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // value noise, periodic in x (so it wraps cleanly around the ring)
  float pnoise(vec2 p, float per) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, per);
    float x1 = mod(i.x + 1.0, per);
    float a = hash(vec2(x0, i.y));
    float b = hash(vec2(x1, i.y));
    float c = hash(vec2(x0, i.y + 1.0));
    float d = hash(vec2(x1, i.y + 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  void main() {
    if (vOpen < 0.002) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a01 = atan(p.y, p.x) / 6.2831853 + 0.5;
    float R = 0.6 * (0.25 + 0.75 * vOpen);
    float spin = uTime * 0.55 + vSeed;
    float ar = fract(a01 + spin);
    // the burning band: thickness and heat vary around the ring
    float n1 = pnoise(vec2(ar * 18.0, uTime * 2.2 + vSeed * 7.0), 18.0);
    float n2 = pnoise(vec2(ar * 46.0, uTime * 5.0), 46.0);
    float band = abs(r - R);
    float w = 0.018 + 0.03 * n1;
    float core = smoothstep(w, 0.0, band);
    float heat = exp(-band * 26.0) * (0.55 + 0.45 * n2);
    // spark streaks flung outward and dragged round with the spin
    float st = pnoise(vec2(fract(ar + (r - R) * 0.35) * 60.0, (r - R) * 7.0 - uTime * 6.0), 60.0);
    float outward = smoothstep(R - 0.01, R + 0.02, r) * exp(-(r - R) * 5.0);
    float streak = pow(st, 5.0) * outward * 2.6;
    // faint glowing window inside the ring (the other side)
    float window = smoothstep(R, R * 0.2, r) * 0.08;
    vec3 hot = vec3(1.0, 0.93, 0.74);
    vec3 orange = vec3(1.0, 0.5, 0.1);
    vec3 ember = vec3(0.85, 0.18, 0.03);
    vec3 col = orange * heat * 1.4 + hot * core * 1.6 + mix(orange, ember, clamp((r - R) * 3.0, 0.0, 1.0)) * streak + vec3(1.0, 0.55, 0.2) * window;
    float alpha = clamp(heat + core + streak + window, 0.0, 1.0) * smoothstep(0.0, 0.25, vOpen);
    alpha *= smoothstep(1.0, 0.86, r);
    gl_FragColor = vec4(col, alpha);
  }
`

const sparkVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec4 uP[${PORTALS}];
  uniform float uR[${PORTALS}];
  attribute float aPortal;
  attribute float aAngle;
  attribute float aSpeed;
  attribute float aSeed;
  attribute float aSize;
  varying float vLife;
  varying float vAlpha;
  void main() {
    int pi = int(aPortal + 0.5);
    vec4 P = uP[pi];
    float R = uR[pi] * (0.25 + 0.75 * P.w);
    float life = fract(uTime * aSpeed + aSeed);
    float ang = aAngle + uTime * 3.4 + life * 0.6;
    vec2 radial = vec2(cos(ang), sin(ang));
    vec2 tang = vec2(radial.y, -radial.x);
    vec2 off = radial * R + (tang * 1.15 + radial * (0.25 + aSeed * 0.5)) * life * R * 0.9 + vec2(0.0, -1.0) * life * life * R * 0.8;
    vec4 mv = modelViewMatrix * vec4(P.xyz, 1.0);
    mv.xy += off;
    gl_Position = projectionMatrix * mv;
    float on = step(0.02, P.w);
    gl_PointSize = aSize * uPixelRatio * (28.0 / max(-mv.z, 1.0)) * (1.0 - life * 0.7) * on * (0.4 + 0.6 * P.w) * (0.6 + R * 0.6);
    vLife = life;
    vAlpha = (1.0 - life) * smoothstep(0.02, 0.3, P.w);
  }
`
const sparkFrag = /* glsl */ `
  varying float vLife;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = mix(vec3(1.0, 0.92, 0.7), vec3(1.0, 0.42, 0.08), smoothstep(0.0, 0.6, vLife));
    gl_FragColor = vec4(col * (1.0 + (1.0 - vLife)), a * vAlpha);
  }
`

const tmp = new THREE.Object3D()

export function Portals({ dir, tier }) {
  const mesh = useRef()
  const sparksPer = tier === 'high' ? 110 : tier === 'medium' ? 60 : 28
  const { geometry, material, openAttr } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    const open = new THREE.InstancedBufferAttribute(new Float32Array(PORTALS), 1)
    open.setUsage(THREE.DynamicDrawUsage)
    const seed = new Float32Array(PORTALS)
    for (let i = 0; i < PORTALS; i++) seed[i] = Math.random()
    g.setAttribute('aOpen', open)
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: portalVert,
      fragmentShader: portalFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: { uTime: { value: 0 } },
    })
    return { geometry: g, material: m, openAttr: open }
  }, [])

  const sparks = useMemo(() => {
    const n = PORTALS * sparksPer
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    const portal = new Float32Array(n)
    const angle = new Float32Array(n)
    const speed = new Float32Array(n)
    const seed = new Float32Array(n)
    const size = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      portal[i] = Math.floor(i / sparksPer)
      angle[i] = Math.random() * Math.PI * 2
      speed[i] = 0.7 + Math.random() * 1.3
      seed[i] = Math.random()
      size[i] = 0.6 + Math.pow(Math.random(), 2.5) * 2.2
    }
    g.setAttribute('aPortal', new THREE.BufferAttribute(portal, 1))
    g.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: sparkVert,
      fragmentShader: sparkFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uP: { value: Array.from({ length: PORTALS }, () => new THREE.Vector4(0, 0, 0, 0)) },
        uR: { value: new Array(PORTALS).fill(0.5) },
      },
    })
    return { geometry: g, material: m }
  }, [sparksPer])

  useEffect(() => {
    if (mesh.current) mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])

  useFrame((state) => {
    const d = dir.current
    const t = state.clock.elapsedTime
    material.uniforms.uTime.value = t
    sparks.material.uniforms.uTime.value = t
    sparks.material.uniforms.uPixelRatio.value = state.viewport.dpr
    const uP = sparks.material.uniforms.uP.value
    const uR = sparks.material.uniforms.uR.value
    if (!mesh.current) return
    for (let i = 0; i < PORTALS; i++) {
      const p = d.portals[i]
      const open = d.active ? p.open : 0
      openAttr.array[i] = open
      // quad half-size: the ring sits at 0.6 of it
      tmp.position.set(p.x, p.y, p.z)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar((p.r / 0.6) * 2)
      tmp.updateMatrix()
      mesh.current.setMatrixAt(i, tmp.matrix)
      uP[i].set(p.x, p.y, p.z, open)
      uR[i] = p.r
    }
    openAttr.needsUpdate = true
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={mesh} args={[geometry, material, PORTALS]} frustumCulled={false} renderOrder={5} />
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} renderOrder={6} />
    </>
  )
}

/* ------------------------------------------------------------------ shockwaves */
const shockVert = /* glsl */ `
  attribute float aLife;
  varying vec2 vUv;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vLife = aLife;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    vec3 c = vec3(instanceMatrix[3]);
    float s = length(vec3(instanceMatrix[0]));
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += position.xy * s * step(0.0, aLife) * step(aLife, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`
const shockFrag = /* glsl */ `
  varying vec2 vUv;
  varying float vLife;
  varying vec3 vColor;
  void main() {
    if (vLife < 0.0 || vLife > 1.0) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float e = 1.0 - pow(1.0 - vLife, 3.0);
    float R = 0.08 + 0.9 * e;
    float w = 0.02 + 0.07 * (1.0 - vLife);
    float band = smoothstep(w, 0.0, abs(r - R));
    float fill = smoothstep(R, 0.0, r) * 0.25 * (1.0 - vLife);
    float a = (band + fill) * (1.0 - vLife) * (1.0 - vLife);
    gl_FragColor = vec4(mix(vColor, vec3(1.0), band * 0.35) * 1.6, a);
  }
`
export const SHOCKS = 10
export function Shockwaves({ dir }) {
  const mesh = useRef()
  const { geometry, material, lifeAttr } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    const life = new THREE.InstancedBufferAttribute(new Float32Array(SHOCKS).fill(-1), 1)
    life.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aLife', life)
    const m = new THREE.ShaderMaterial({
      vertexShader: shockVert,
      fragmentShader: shockFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { geometry: g, material: m, lifeAttr: life }
  }, [])
  const col = useMemo(() => new THREE.Color(), [])
  useEffect(() => {
    if (!mesh.current) return
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < SHOCKS; i++) mesh.current.setColorAt(i, col.set('#ffffff'))
  }, [col])
  useFrame((state) => {
    const d = dir.current
    const t = state.clock.elapsedTime
    if (!mesh.current) return
    for (let i = 0; i < SHOCKS; i++) {
      const s = d.shocks[i]
      const life = s.at < 0 ? -1 : (t - s.at) / s.dur
      if (life > 1) s.at = -1
      lifeAttr.array[i] = life > 1 ? -1 : life
      tmp.position.set(s.x, s.y, s.z)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar(s.size * 2)
      tmp.updateMatrix()
      mesh.current.setMatrixAt(i, tmp.matrix)
      if (s.dirty) {
        mesh.current.setColorAt(i, col.set(s.color))
        s.dirty = false
        if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
      }
    }
    lifeAttr.needsUpdate = true
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, SHOCKS]} frustumCulled={false} renderOrder={7} />
}

/* ------------------------------------------------------------------ token back-glows */
const glowVert = /* glsl */ `
  attribute float aAmt;
  varying vec2 vUv;
  varying float vAmt;
  varying vec3 vColor;
  void main() {
    vUv = uv;
    vAmt = aAmt;
    #ifdef USE_INSTANCING_COLOR
      vColor = instanceColor;
    #else
      vColor = vec3(1.0);
    #endif
    vec3 c = vec3(instanceMatrix[3]);
    float s = length(vec3(instanceMatrix[0]));
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.z -= 0.25 * s;
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`
const glowFrag = /* glsl */ `
  varying vec2 vUv;
  varying float vAmt;
  varying vec3 vColor;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = pow(max(0.0, 1.0 - d), 2.2);
    gl_FragColor = vec4(vColor, g * vAmt);
  }
`
export function TokenGlows({ dir, colors }) {
  const mesh = useRef()
  const n = colors.length
  const { geometry, material, amtAttr } = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1)
    const amt = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
    amt.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aAmt', amt)
    const m = new THREE.ShaderMaterial({ vertexShader: glowVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
    return { geometry: g, material: m, amtAttr: amt }
  }, [n])
  useEffect(() => {
    if (!mesh.current) return
    const c = new THREE.Color()
    colors.forEach((hex, i) => mesh.current.setColorAt(i, c.set(hex)))
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true
    mesh.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [colors])
  useFrame(() => {
    const d = dir.current
    if (!mesh.current) return
    for (let i = 0; i < n; i++) {
      const tk = d.tokens[i]
      tmp.position.copy(tk.pos)
      tmp.rotation.set(0, 0, 0)
      tmp.scale.setScalar(Math.max(0.0001, tk.scale * 2.4))
      tmp.updateMatrix()
      mesh.current.setMatrixAt(i, tmp.matrix)
      amtAttr.array[i] = d.active && tk.scale > 0.01 ? 0.22 + tk.live.glow * 0.18 + tk.live.pop * 0.5 + tk.live.hover * 0.35 : 0
    }
    amtAttr.needsUpdate = true
    mesh.current.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, n]} frustumCulled={false} renderOrder={-1} />
}
