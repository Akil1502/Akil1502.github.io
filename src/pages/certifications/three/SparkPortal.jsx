import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

/*
 * SLING-RING PORTAL: a spinning ring of sparks. Every spark is simulated in the vertex shader from a seed (no CPU
 * work per particle): it is born on the ring at an angle that advances with its birth time (so the emitter spins),
 * shoots off tangentially with a little outward kick, falls under gravity and cools from white-hot through orange
 * to ember red. ~30% of the sparks are "rim crawlers" that race round the ring itself, which is what makes the
 * circle read as a solid, rotating portal edge. A thin flickering glow ring sits under the sparks.
 *
 * Drive it with the mutable `state` prop: { open (0..~1.4), intensity, boost } — read every frame. `radius` is in
 * local units; scale/position the returned group from the parent.
 */
const sparkVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uRadius;
  uniform float uSpin;
  uniform float uSpeed;
  uniform float uLife;
  uniform float uGravity;
  uniform float uSize;
  uniform float uPixel;
  varying float vHeat;
  void main() {
    float life = uLife * (0.45 + 0.55 * aSeed.y);
    float t = uTime + aSeed.z * 23.0;
    float age = fract(t / life);
    float born = t - age * life;
    float tt = age * life;
    float rim = step(aSeed.w, 0.3);
    float ang = aSeed.x * 6.2831853 + born * uSpin;
    vec2 dir = vec2(cos(ang), sin(ang));
    vec2 tang = vec2(-dir.y, dir.x) * sign(uSpin);
    float spd = uSpeed * (0.35 + aSeed.y * 0.9);
    vec2 pos = dir * uRadius + (tang * spd + dir * spd * 0.3 * aSeed.w) * tt + vec2(0.0, -uGravity) * tt * tt;
    if (rim > 0.5) {
      float a2 = ang + tt * uSpin * 2.6;
      pos = vec2(cos(a2), sin(a2)) * uRadius * (1.0 + 0.025 * sin(aSeed.y * 40.0 + uTime * 9.0));
    }
    vec4 mv = modelViewMatrix * vec4(pos, (aSeed.y - 0.5) * 0.12 * uRadius, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = uSize * (0.45 + aSeed.w * 0.9) * pow(1.0 - age, 0.6) * mix(1.0, 0.8, rim);
    gl_PointSize = max(sz * uPixel / max(-mv.z, 0.5), 0.0);
    vHeat = (1.0 - age) * mix(1.0, 0.85, rim);
  }
`
const sparkFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform vec3 uDeep;
  uniform float uIntensity;
  varying float vHeat;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a *= a;
    vec3 col = mix(uDeep, uColor, smoothstep(0.05, 0.55, vHeat));
    col = mix(col, uHot, smoothstep(0.7, 1.0, vHeat));
    gl_FragColor = vec4(col * a * uIntensity, 1.0);
  }
`
const ringVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const ringFrag = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform vec3 uHot;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float a = atan(p.y, p.x);
    float n = 0.5 * sin(a * 13.0 + uTime * 9.0) + 0.35 * sin(a * 31.0 - uTime * 13.0) + 0.15 * sin(a * 7.0 + uTime * 3.0);
    float w = 0.022 + 0.012 * n;
    float ring = exp(-pow((r - 0.8) / w, 2.0));
    float halo = exp(-abs(r - 0.8) * 12.0) * 0.32;
    float inner = smoothstep(0.8, 0.0, r) * 0.05;
    vec3 col = uColor * (ring * 1.4 + halo + inner) + uHot * ring * 0.7;
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`

const ringPlane = new THREE.PlaneGeometry(2, 2)

const SparkPortal = forwardRef(function SparkPortal(
  { count = 400, radius = 1, color = '#ffa63d', hot = '#fff4d6', deep = '#b3240b', spin = 1.6, speed = 0.55, life = 1.1, gravity = 0.55, size = 0.06, ring = true, state, seed = 1, ...props },
  ref,
) {
  const gl = useThree((s) => s.gl)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const seeds = new Float32Array(count * 4)
    let s = seed * 9301 + 49297
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rnd()
      seeds[i * 4 + 1] = rnd()
      seeds[i * 4 + 2] = rnd()
      seeds[i * 4 + 3] = rnd()
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    // positions are computed in the shader; a dummy attribute keeps three happy (draw count)
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)
    return g
  }, [count, seed])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sparkVert,
        fragmentShader: sparkFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uRadius: { value: radius },
          uSpin: { value: spin },
          uSpeed: { value: speed },
          uLife: { value: life },
          uGravity: { value: gravity },
          uSize: { value: size },
          uPixel: { value: 600 },
          uIntensity: { value: 1 },
          uColor: { value: new THREE.Color(color) },
          uHot: { value: new THREE.Color(hot) },
          uDeep: { value: new THREE.Color(deep) },
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const ringMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: ringVert,
        fragmentShader: ringFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 }, uColor: { value: new THREE.Color(color) }, uHot: { value: new THREE.Color(hot) } },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  useLayoutEffect(() => {
    mat.uniforms.uColor.value.set(color)
    ringMat.uniforms.uColor.value.set(color)
  }, [color, mat, ringMat])
  useLayoutEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
      ringMat.dispose()
    },
    [geo, mat, ringMat],
  )

  const group = useRef()
  const points = useRef()
  const ringMesh = useRef()
  const clock = useRef(0)

  useFrame((st, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const S = state || { open: 1, intensity: 1, boost: 0 }
    const open = Math.max(0, S.open ?? 1)
    const on = open > 0.002 && (S.intensity ?? 1) > 0.002
    if (points.current) points.current.visible = on
    if (ringMesh.current) ringMesh.current.visible = on && ring
    if (!on) return
    clock.current += dt * (1 + (S.boost || 0) * 1.4)
    const u = mat.uniforms
    u.uTime.value = clock.current
    // ease the radius: a portal opens fast and settles
    u.uRadius.value = radius * open
    u.uIntensity.value = (S.intensity ?? 1) * Math.min(1, open * 3)
    u.uSpin.value = spin * (1 + (S.boost || 0) * 0.8)
    // world-space point size: pixel scale = viewport height in px / (2 * tan(fov/2)) * dpr
    const cam = st.camera
    const worldScale = group.current ? group.current.matrixWorld.getMaxScaleOnAxis() : 1
    u.uPixel.value = (st.size.height * gl.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) * worldScale
    ringMat.uniforms.uTime.value = clock.current
    ringMat.uniforms.uIntensity.value = u.uIntensity.value * 0.6
    if (ringMesh.current) ringMesh.current.scale.setScalar((radius * open) / 0.8)
  })

  const setRef = (el) => {
    group.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }
  return (
    <group ref={setRef} {...props}>
      {ring ? <mesh ref={ringMesh} geometry={ringPlane} material={ringMat} frustumCulled={false} renderOrder={3} /> : null}
      <points ref={points} geometry={geo} material={mat} frustumCulled={false} renderOrder={4} />
    </group>
  )
})

export default SparkPortal
