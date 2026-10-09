import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

// Storm sky: a huge plane far behind the stage shaded with domain-warped fbm value noise. Heavier cloud at the
// top, thinning toward the horizon. Every strike lights it from inside (uFlash at uFlashPos, projected onto the
// plane), the hammer's charge tints the cloud bellies blue, and uSwirl twists the clouds into a vortex above the
// hammer (the summoning beat). Octave count scales with the device tier.
//
// Driven through `fx` (mutable object owned by the scene): fx.flash, fx.flashX, fx.flashY, fx.swirl,
// fx.vortexX, fx.vortexY, fx.charge.

const DEPTH = -16
const PROJ = (10 - DEPTH) / 10 // world point at z=0 -> plane coordinates (camera at z=10)

const vert = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const frag = (oct) => /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform vec2 uFlashPos;
  uniform float uSwirl;
  uniform vec2 uVortex;
  uniform float uCharge;
  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uHi;
  uniform vec3 uLit;
  uniform vec3 uBolt;
  uniform vec3 uRed;
  varying vec2 vP;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  const mat2 M = mat2(1.6, 1.2, -1.2, 1.6);
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < ${oct}; i++) {
      v += a * noise(p);
      p = M * p;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // vortex: rotate the domain around the eye, more strongly near the centre
    vec2 d = vP - uVortex;
    float r = length(d);
    float ang = uSwirl * (2.4 / (0.8 + r * 0.22)) + uSwirl * uTime * 0.25 / (1.0 + r * 0.1);
    float cs = cos(ang);
    float sn = sin(ang);
    vec2 w = uVortex + mat2(cs, -sn, sn, cs) * d;

    vec2 q = w * 0.075 + vec2(uTime * 0.012, uTime * 0.003);
    float warp = fbm(q * 1.6 + vec2(0.0, uTime * 0.02));
    float n = fbm(q + warp * 0.75);
    float n2 = fbm(q * 2.3 - warp * 0.4 + 7.3);

    // cloud mass: denser high in the sky, thinning toward the horizon
    float sky = smoothstep(-16.0, 12.0, vP.y);
    float dens = smoothstep(0.32, 0.86, n) * mix(0.25, 1.0, sky);
    float ridge = smoothstep(0.45, 0.75, n2) * dens;

    vec3 col = mix(uDeep, uMid, dens);
    col = mix(col, uHi, ridge * 0.55);

    // strike light: a hot core around the bolt plus a sheet flash across the whole sky
    float fd = length(vP - uFlashPos);
    float hot = exp(-fd * 0.11);
    col += uLit * uFlash * (hot * (0.28 + dens * 1.8) + 0.08 * dens + 0.025);
    // charge glow in the cloud bellies + the vortex eye
    col += uBolt * (uCharge * 0.035 + uSwirl * 0.2 * exp(-r * 0.24)) * (0.2 + dens);
    // a faint cape-red ember glow low on the horizon
    col += uRed * 0.05 * (1.0 - sky) * (0.4 + n);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export default function StormClouds({ tier = 'high', fx }) {
  const mat = useMemo(() => {
    const c = (h) => new THREE.Color(h)
    return new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag(tier === 'high' ? 5 : tier === 'medium' ? 4 : 3),
      uniforms: {
        uTime: { value: 0 },
        uFlash: { value: 0 },
        uFlashPos: { value: new THREE.Vector2(0, 8) },
        uSwirl: { value: 0 },
        uVortex: { value: new THREE.Vector2(0, 6) },
        uCharge: { value: 0 },
        uDeep: { value: c('#04060c') },
        uMid: { value: c('#121b2a') },
        uHi: { value: c('#2c3d56') },
        uLit: { value: c('#cfeaff') },
        uBolt: { value: c('#8fd8ff') },
        uRed: { value: c('#b3151d') },
      },
      depthWrite: false,
      fog: false,
    })
  }, [tier])
  const mesh = useRef()

  useFrame((state) => {
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uFlash.value = fx.flash
    u.uFlashPos.value.set(fx.flashX * PROJ, fx.flashY * PROJ)
    u.uSwirl.value = fx.swirl
    u.uVortex.value.set(fx.vortexX * PROJ, fx.vortexY * PROJ)
    u.uCharge.value = fx.charge
  })

  return (
    <mesh ref={mesh} material={mat} position={[0, 2, DEPTH]} renderOrder={-10} frustumCulled={false}>
      <planeGeometry args={[110, 56]} />
    </mesh>
  )
}
