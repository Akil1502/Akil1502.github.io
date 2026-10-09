import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import GlowPlane from '../../../three/primitives/GlowPlane'
import { stage } from './stage'
import { age, decay, initXp, disposeAll } from '../signals'

/* The vault floor under the emblem:
   - a dark glossy floor (a real blurred reflector on the high tier, an env-mapped dark metal otherwise)
   - a LASER GRID painted on it (shader): minor/major lines that fade with distance, a scan line that sweeps across
     the floor, a band that rolls toward the camera, a shockwave ring on every IMPACT (xp.impact) and a flash on every
     DECRYPT flare (xp.arc)
   - TRIPWIRES: thin red laser beams with a white-hot core and travelling pulses criss-crossing the room at different
     heights and depths, slowly sweeping (yaw/height oscillation) and flaring when a file is decrypted
   - a red under-glow that follows the emblem cluster */

const gridVert = /* glsl */ `
  varying vec3 vW;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vW = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const gridFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uFocus;
  uniform float uSweep;
  uniform vec3 uPulse;
  uniform float uFlash;
  uniform vec2 uCenter;
  varying vec3 vW;
  float gridLine(vec2 p, float s, float w) {
    vec2 q = p / s;
    vec2 g = abs(fract(q - 0.5) - 0.5) / max(fwidth(q) * w, vec2(1e-4));
    return 1.0 - min(min(g.x, g.y), 1.0);
  }
  void main() {
    vec2 p = vW.xz;
    float d = length((p - uCenter) * vec2(0.8, 1.0));
    float fade = exp(-d * 0.13) * smoothstep(-30.0, -7.0, p.y) * smoothstep(5.5, -0.5, p.y);
    float minor = gridLine(p, 0.6, 1.0);
    float major = gridLine(p, 3.0, 1.4);
    float lines = minor * 0.045 + major * 0.2;
    float sweep = exp(-pow((p.x - uSweep) * 3.6, 2.0));
    float roll = exp(-pow((p.y - (mod(uTime * 2.6, 36.0) - 30.0)) * 1.1, 2.0));
    float r = length(p - uPulse.xy);
    float ring = uPulse.z < 0.0 ? 0.0 : exp(-pow((r - uPulse.z * 7.5) * 2.2, 2.0)) * exp(-uPulse.z * 1.3);
    vec3 col = uColor * (
      lines * (0.55 + uFlash * 1.8) * fade * uFocus
      + sweep * (0.07 + major * 0.75 + minor * 0.3) * fade
      + roll * lines * fade * 1.6
      + ring * (0.5 + lines * 2.5) * 1.5
    );
    gl_FragColor = vec4(col, 1.0);
  }
`

const beamVert = /* glsl */ `
  varying vec2 vUv;
  varying float vWX;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWX = wp.x;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`
const beamFrag = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform float uSeed;
  uniform vec3 uColor;
  uniform float uCenter;
  varying vec2 vUv;
  varying float vWX;
  void main() {
    float y = (vUv.y - 0.5) * 2.0;
    float near = 1.0 - smoothstep(3.2, 7.5, abs(vWX - uCenter));
    float core = exp(-y * y * 700.0);
    float glow = exp(-y * y * 30.0) * 0.32;
    float ends = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float dash = pow(max(0.0, sin(vUv.x * 48.0 - uTime * (4.0 + uSeed * 2.0) + uSeed * 10.0)), 28.0);
    float flick = 0.88 + 0.12 * sin(uTime * 31.0 + uSeed * 7.0);
    vec3 col = uColor * (glow + dash * (glow * 3.0 + core)) + vec3(1.0, 0.62, 0.66) * core * 1.5;
    gl_FragColor = vec4(col * ends * near * uPower * flick, 1.0);
  }
`

// [x, height above floor, z, yaw, tilt, length, sweep amp, speed]
const BEAMS = [
  [0.5, 0.1, -1.2, 0.3, 0.0, 26, 0.16, 0.21],
  [2.5, 0.75, -4.8, -0.42, 0.035, 30, 0.2, 0.17],
  [-3, 1.7, -8.5, 0.5, -0.05, 34, 0.18, 0.13],
  [1, 3.3, -12.5, -0.2, 0.07, 40, 0.14, 0.11],
  [6, 0.3, -2.6, -0.95, 0.0, 22, 0.12, 0.19],
  [-6.5, 2.5, -10.5, 0.7, -0.03, 30, 0.16, 0.12],
]

function Beam({ spec, i, mat }) {
  const ref = useRef()
  const [x, h, z, yaw, tilt, len, amp, sp] = spec
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const m = ref.current
    if (!m) return
    m.position.set(x + stage.x * 0.85 + Math.sin(t * sp * 0.7 + i) * 0.6, stage.floorY + h + Math.sin(t * sp * 1.9 + i * 2.1) * 0.12, z)
    m.rotation.set(0, yaw + Math.sin(t * sp + i * 1.3) * amp, tilt)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={2}>
      <planeGeometry args={[len, 0.24]} />
    </mesh>
  )
}

export default function TripwireFloor({ tier = 'high' }) {
  const grid = useRef()
  const under = useRef()
  const count = tier === 'high' ? BEAMS.length : tier === 'medium' ? 5 : 3

  const gridMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: gridVert,
        fragmentShader: gridFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(1.1, 0.04, 0.1) },
          uFocus: { value: 1 },
          uSweep: { value: 0 },
          uPulse: { value: new THREE.Vector3(0, 0, -1) },
          uFlash: { value: 0 },
          uCenter: { value: new THREE.Vector2(0, -2) },
        },
      }),
    [],
  )
  const beamMats = useMemo(
    () =>
      BEAMS.map(
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader: beamVert,
            fragmentShader: beamFrag,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            uniforms: {
              uTime: { value: 0 },
              uPower: { value: 0.7 },
              uSeed: { value: i * 0.37 + 0.1 },
              uColor: { value: new THREE.Color(1.5, 0.05, 0.12) },
              uCenter: { value: 0 },
            },
          }),
      ),
    [],
  )
  const pulseFrom = useRef({ stamp: 0, x: 0, z: 0 })
  useEffect(() => () => disposeAll(gridMat, beamMats), [gridMat, beamMats])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const x = initXp()
    const u = gridMat.uniforms
    u.uTime.value = t
    u.uFocus.value = 0.55 + 0.45 * stage.focus
    u.uSweep.value = ((t * 2.1) % 34) - 17
    u.uCenter.value.set(stage.x * 0.6, stage.z - 2)
    // shockwave ring from the latest impact, centred under where the emblem stood at that instant
    const pf = pulseFrom.current
    if (x.impact !== pf.stamp) {
      pf.stamp = x.impact
      pf.x = stage.x
      pf.z = stage.z
    }
    const ia = age(x.impact)
    u.uPulse.value.set(pf.x, pf.z, ia >= 0 && ia < 4 ? ia : -1)
    const fl = decay(x.arc, 3) * (x.arcPower || 0)
    u.uFlash.value = fl * 0.8 + decay(x.impact, 4) * 0.6
    const intro = Math.min(1, Math.max(0, age(x.intro) / 1.6))
    for (let i = 0; i < beamMats.length; i++) {
      const bu = beamMats[i].uniforms
      bu.uTime.value = t
      bu.uCenter.value = stage.x
      // tripwires arm one after another with the intro, flare on decrypt
      const arm = Math.min(1, Math.max(0, intro * 2.2 - i * 0.12))
      bu.uPower.value = arm * (0.26 + 0.14 * stage.focus + fl * 1.1 + (x.hover >= 0 ? 0.2 : 0))
    }
    if (under.current) {
      under.current.position.set(stage.x, stage.floorY + 0.02, stage.z)
      const uu = under.current.material?.uniforms
      if (uu) uu.uIntensity.value = 0.1 + 0.14 * stage.focus + fl * 0.5
    }
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, stage.floorY, -14]} renderOrder={0}>
        <planeGeometry args={[90, 70]} />
        {tier === 'high' ? (
          <MeshReflectorMaterial
            blur={[260, 80]}
            resolution={512}
            mixBlur={1}
            mixStrength={2.6}
            mixContrast={1.15}
            roughness={0.9}
            depthScale={0.9}
            minDepthThreshold={0.35}
            maxDepthThreshold={1.3}
            color={'#0e0c10'}
            metalness={0.55}
            mirror={0.7}
            envMapIntensity={0.35}
          />
        ) : (
          <meshStandardMaterial color={'#08060a'} metalness={0.55} roughness={0.42} envMapIntensity={0.04} />
        )}
      </mesh>
      <mesh ref={grid} material={gridMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, stage.floorY + 0.006, -14]} renderOrder={1}>
        <planeGeometry args={[90, 70]} />
      </mesh>
      <GlowPlane ref={under} color={'#ff1030'} intensity={0.4} size={[9, 7]} softness={2} rotation={[-Math.PI / 2, 0, 0]} />
      {BEAMS.slice(0, count).map((b, i) => (
        <Beam key={i} spec={b} i={i} mat={beamMats[i]} />
      ))}
    </group>
  )
}
