import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { sealTexture } from './textures'

// Wet stone ground + the scorched landing seal (an original circular rune / woven-rosette mark, the kind a bolt
// from the sky leaves where it lands). The seal glows faintly at rest; flare() makes it blaze gold-and-lightning
// with a ring racing outward (hero arrival, finale slam). ref: { flare(power) }.
const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uFlare;
  uniform float uRing;
  uniform float uBase;
  uniform float uTime;
  uniform vec3 uBurn;
  uniform vec3 uGlow;
  uniform vec3 uGold;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float a = texture2D(uMap, vUv).a;
    float ang = atan(c.y, c.x);
    float sweep = pow(0.5 + 0.5 * cos(ang - uTime * 0.7), 14.0);
    float ring = exp(-pow((r - uRing) * 7.0, 2.0)) * step(0.001, uRing) * (1.0 - uRing * 0.6);
    vec3 col = uBurn * uBase * 1.2 + uGlow * (uFlare * 2.6 + sweep * 0.9 * uBase) + uGold * (ring * 2.2 + uFlare * 0.8);
    float alpha = a * (0.35 * uBase + 0.25 + uFlare + ring * 0.8) + ring * 0.35 * (1.0 - smoothstep(0.95, 1.0, r));
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
  }
`

// Wet black stone: a custom shader so the floor stays cinematic-dark at any angle (a standard material's grazing
// specular turned it into a bright grey sheet). Light reaches it only as pools: the strike light, the hammer's
// charge glow and a cape-red ember under the hammer, each with a glossy streak toward the camera (rain-wet),
// then it fades into the storm with distance.
const floorVert = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const floorFrag = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uBg;
  uniform vec3 uCam;
  uniform vec3 uP0;
  uniform vec3 uC0;
  uniform float uI0;
  uniform vec3 uP1;
  uniform vec3 uC1;
  uniform float uI1;
  uniform vec3 uP2;
  uniform vec3 uC2;
  uniform float uI2;
  uniform float uFlash;
  varying vec3 vW;
  vec3 light(vec3 p, vec3 c, float k) {
    vec2 d = vW.xz - p.xz;
    float h = max(0.35, p.y - vW.y);
    float pool = h / pow(dot(d, d) + h * h, 1.5);
    // glossy streak: the reflection smears toward the viewer on wet stone
    vec2 v = normalize(uCam.xz - p.xz + 1e-4);
    float along = dot(d, v);
    float across = abs(d.x * v.y - d.y * v.x);
    float streak = exp(-across * across * 9.0) * exp(-max(along, 0.0) * 0.45) * step(0.0, along) * 0.35;
    return c * k * (pool + streak);
  }
  void main() {
    vec3 col = uBase;
    col += light(uP0, uC0, uI0) + light(uP1, uC1, uI1) + light(uP2, uC2, uI2);
    col += vec3(0.55, 0.7, 0.9) * uFlash * 0.025;
    float dist = length(vW.xz - uCam.xz);
    col = mix(col, uBg, smoothstep(7.0, 26.0, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const Ground = forwardRef(function Ground({ y = -2.3, radius = 3.2, fx }, ref) {
  const seal = useRef()
  const state = useRef({ flare: 0, ring: 0, ringOn: false })
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uMap: { value: sealTexture() },
          uFlare: { value: 0 },
          uRing: { value: 0 },
          uBase: { value: 0.4 },
          uTime: { value: 0 },
          uBurn: { value: new THREE.Color('#7a3b12') },
          uGlow: { value: new THREE.Color('#8fd8ff') },
          uGold: { value: new THREE.Color('#ffd27a') },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  )
  const floorMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: floorVert,
        fragmentShader: floorFrag,
        uniforms: {
          uBase: { value: new THREE.Color('#05070c') },
          uBg: { value: new THREE.Color('#04060c') },
          uCam: { value: new THREE.Vector3(0, 0, 10) },
          uP0: { value: new THREE.Vector3() },
          uC0: { value: new THREE.Color('#bfe6ff') },
          uI0: { value: 0 },
          uP1: { value: new THREE.Vector3() },
          uC1: { value: new THREE.Color('#8fd8ff') },
          uI1: { value: 0 },
          uP2: { value: new THREE.Vector3() },
          uC2: { value: new THREE.Color('#b3151d') },
          uI2: { value: 0 },
          uFlash: { value: 0 },
        },
      }),
    [],
  )

  useImperativeHandle(
    ref,
    () => ({
      flare(p = 1) {
        const s = state.current
        s.flare = Math.max(s.flare, p)
        s.ring = 0.02
        s.ringOn = true
      },
    }),
    [],
  )

  useFrame((st, dt) => {
    const d = Math.min(dt, 0.1)
    const s = state.current
    s.flare *= Math.exp(-d * 2.2)
    if (s.ringOn) {
      s.ring += d * 0.9
      if (s.ring > 1.4) {
        s.ringOn = false
        s.ring = 0
      }
    }
    // during the hand-off to the next-mission CTA (fx.out -> 1) the seal goes dark: no flare, no racing ring
    const keep = 1 - (fx.out || 0)
    const u = mat.uniforms
    u.uFlare.value = (s.flare + fx.flash * 0.1) * keep
    u.uRing.value = keep > 0.5 ? s.ring : 0
    u.uBase.value = fx.seal
    u.uTime.value = st.clock.elapsedTime
    if (seal.current) seal.current.rotation.z = st.clock.elapsedTime * 0.03
    const f = floorMat.uniforms
    f.uCam.value.copy(st.camera.position)
    f.uP0.value.copy(fx.strikeP)
    f.uI0.value = fx.strikeI * 0.022
    f.uP1.value.copy(fx.headP)
    f.uI1.value = (0.05 + fx.charge * 0.12 + fx.flash * 0.1) * keep
    f.uP2.value.set(fx.headP.x, fx.headP.y - 1.2, fx.headP.z + 0.6)
    f.uI2.value = 0.09 * keep
    f.uFlash.value = fx.flash
  })

  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={floorMat}>
        <circleGeometry args={[40, 48]} />
      </mesh>
      <mesh ref={seal} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} material={mat} renderOrder={3}>
        <planeGeometry args={[radius * 2, radius * 2]} />
      </mesh>
    </group>
  )
})

export default Ground
